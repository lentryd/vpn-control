// Package importer does the one-time import of the old "Траты на VPN"
// spreadsheet: customers with referrers and prices (sheet 1, columns A–C),
// recurring infrastructure costs (sheet 1, columns E–F), and the income and
// expense journals (sheet 2).
package importer

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
	"gopkg.in/yaml.v3"

	"vpn-control/ent"
	"vpn-control/ent/expenseitem"
	"vpn-control/ent/tariff"
	"vpn-control/internal/billing"
	"vpn-control/internal/expenses"
	"vpn-control/internal/money"
	"vpn-control/internal/store"
)

type Options struct {
	File            string
	MapPath         string
	Referrals       bool
	Force           bool
	ReferralPercent float64
}

type customerRow struct {
	raw, name, ref string
	price          int64
	active         bool
}

type itemRow struct {
	name       string
	currency   string
	amount     int64
	fee, share float64
	metered    bool
}

type paymentRow struct {
	date   time.Time
	payer  string
	amount int64
}

type expenseRow struct {
	date     time.Time
	provider string
	orig     int64
	share    float64
	refund   bool
}

type parsed struct {
	customers []customerRow
	items     []itemRow
	payments  []paymentRow
	expenses  []expenseRow
}

// Run imports opts.File. When payer names in sheet 2 don't all match
// customers exactly, the first run writes opts.MapPath with suggestions and
// stops; edit it and run again.
func Run(ctx context.Context, db *ent.Client, opts Options) (string, error) {
	if !opts.Force {
		if n, err := db.Customer.Query().Count(ctx); err != nil {
			return "", err
		} else if n > 0 {
			return "", errors.New("в базе уже есть клиенты — импорт рассчитан на пустую базу (или используйте -force)")
		}
	}
	p, err := parse(opts.File)
	if err != nil {
		return "", err
	}

	names := customerNames(p.customers)
	payerMap, pending, err := resolvePayers(p.payments, names, opts.MapPath)
	if err != nil {
		return "", err
	}
	if pending {
		return fmt.Sprintf("Не все плательщики сопоставлены с клиентами.\n"+
			"Проверьте и заполните %s, затем запустите импорт ещё раз.\n", opts.MapPath), nil
	}

	var rep strings.Builder
	err = store.WithTx(ctx, db, func(tx *ent.Tx) error {
		return apply(ctx, tx, p, names, payerMap, opts, &rep)
	})
	if err != nil {
		return "", err
	}
	return rep.String(), nil
}

func parse(path string) (*parsed, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer func() { _ = f.Close() }()
	sheets := f.GetSheetList()
	if len(sheets) < 2 {
		return nil, errors.New("ожидаются два листа: клиенты/инфраструктура и журнал поступлений/списаний")
	}
	p := &parsed{}
	if err := parseSheet1(f, sheets[0], p); err != nil {
		return nil, err
	}
	if err := parseSheet2(f, sheets[1], p); err != nil {
		return nil, err
	}
	return p, nil
}

func cell(f *excelize.File, sheet, col string, row int) string {
	v, _ := f.GetCellValue(sheet, fmt.Sprintf("%s%d", col, row), excelize.Options{RawCellValue: true})
	return strings.TrimSpace(v)
}

func formula(f *excelize.File, sheet, col string, row int) string {
	v, _ := f.GetCellFormula(sheet, fmt.Sprintf("%s%d", col, row))
	return v
}

func parseMoney(s string) (int64, bool) {
	s = strings.ReplaceAll(strings.ReplaceAll(s, " ", ""), ",", ".")
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return money.FromMajor(v), true
}

var (
	fxFormulaRe = regexp.MustCompile(`([\d.]+)\s*\*\s*GOOGLEFINANCE\(""?CURRENCY:([A-Z]{3})RUB""?\)\s*\*\s*([\d.]+)`)
	shareRe     = regexp.MustCompile(`\((\d+(?:[.,]\d+)?)\s*%\)`)
	mulRe       = regexp.MustCompile(`^=?\s*([\d.]+)\s*\*\s*(0?\.\d+)\s*$`)
)

func parseSheet1(f *excelize.File, sheet string, p *parsed) error {
	for row := 2; row < 1000; row++ {
		raw := cell(f, sheet, "A", row)
		if raw == "" || strings.EqualFold(raw, "Итого") {
			break
		}
		price, _ := parseMoney(cell(f, sheet, "B", row))
		name, ref := splitName(raw)
		p.customers = append(p.customers, customerRow{
			raw: raw, name: name, ref: ref, price: price,
			active: strings.EqualFold(cell(f, sheet, "C", row), "Активен"),
		})
	}

	// Infrastructure block: header "Имя | Цена" in E/F, rows until "Итого".
	start := 0
	for row := 1; row < 50; row++ {
		if strings.EqualFold(cell(f, sheet, "E", row), "Имя") {
			start = row + 1
			break
		}
	}
	if start == 0 {
		return nil
	}
	for row := start; row < start+100; row++ {
		name := cell(f, sheet, "E", row)
		if name == "" || strings.EqualFold(name, "Итого") {
			break
		}
		it := itemRow{name: name, currency: "RUB", share: 100}
		value, _ := parseMoney(cell(f, sheet, "F", row))
		if m := fxFormulaRe.FindStringSubmatch(formula(f, sheet, "F", row)); m != nil {
			amount, _ := strconv.ParseFloat(m[1], 64)
			mult, _ := strconv.ParseFloat(m[3], 64)
			it.currency, it.amount = m[2], money.FromMajor(amount)
			it.fee = math.Round((mult-1)*10000) / 100
		} else {
			it.amount = value
		}
		if m := shareRe.FindStringSubmatch(name); m != nil {
			share, _ := strconv.ParseFloat(strings.ReplaceAll(m[1], ",", "."), 64)
			it.share = share
			it.name = strings.TrimSpace(shareRe.ReplaceAllString(name, ""))
			// The sheet holds our part; store the full price + share.
			it.amount = int64(math.Round(float64(it.amount) * 100 / share))
		}
		it.metered = strings.Contains(strings.ToLower(name), "cdn")
		p.items = append(p.items, it)
	}
	return nil
}

func parseSheet2(f *excelize.File, sheet string, p *parsed) error {
	for row := 4; row < 5000; row++ {
		pd, payer, pa := cell(f, sheet, "A", row), cell(f, sheet, "B", row), cell(f, sheet, "C", row)
		ed, prov, ea := cell(f, sheet, "D", row), cell(f, sheet, "E", row), cell(f, sheet, "F", row)
		if pd == "" && payer == "" && ed == "" && prov == "" {
			break
		}
		if payer != "" {
			date, err := excelDate(pd)
			if err != nil {
				return fmt.Errorf("A%d: %w", row, err)
			}
			amount, ok := parseMoney(pa)
			if !ok || amount <= 0 {
				return fmt.Errorf("C%d: некорректная сумма %q", row, pa)
			}
			p.payments = append(p.payments, paymentRow{date: date, payer: strings.TrimSpace(payer), amount: amount})
		}
		if prov != "" {
			date, err := excelDate(ed)
			if err != nil {
				return fmt.Errorf("D%d: %w", row, err)
			}
			amount, ok := parseMoney(ea)
			if !ok || amount == 0 {
				return fmt.Errorf("F%d: некорректная сумма %q", row, ea)
			}
			e := expenseRow{date: date, provider: prov, orig: amount, share: 100}
			if m := mulRe.FindStringSubmatch(formula(f, sheet, "F", row)); m != nil {
				full, _ := strconv.ParseFloat(m[1], 64)
				k, _ := strconv.ParseFloat(m[2], 64)
				e.orig, e.share = money.FromMajor(full), math.Round(k*10000)/100
			}
			if e.orig < 0 {
				e.orig, e.refund = -e.orig, true
			}
			p.expenses = append(p.expenses, e)
		}
	}
	return nil
}

func excelDate(s string) (time.Time, error) {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		for _, layout := range []string{"02.01.2006", "2006-01-02", "01-02-06"} {
			if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
				return t, nil
			}
		}
		return time.Time{}, fmt.Errorf("некорректная дата %q", s)
	}
	t, err := excelize.ExcelDateToTime(v, false)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 12, 0, 0, 0, time.Local), nil
}

// customerNames gives each sheet-1 row a unique display name: the bare name,
// or the full "Имя (от Кого)" when the bare name repeats.
func customerNames(rows []customerRow) []string {
	count := map[string]int{}
	for _, r := range rows {
		count[normalize(r.name)]++
	}
	out := make([]string, len(rows))
	for i, r := range rows {
		if count[normalize(r.name)] > 1 {
			out[i] = r.raw
		} else {
			out[i] = r.name
		}
	}
	return out
}

type mapFile struct {
	Payers map[string]string `yaml:"payers"`
}

// resolvePayers maps sheet-2 payer names to customer display names. Exact
// (normalized) matches are automatic; the rest come from the map file,
// which is written with suggestions when missing.
func resolvePayers(payments []paymentRow, names []string, mapPath string) (map[string]string, bool, error) {
	byNorm := map[string][]string{}
	for _, n := range names {
		byNorm[normalize(n)] = append(byNorm[normalize(n)], n)
		// "Катя (от Димы)" is also reachable as "Катя" — ambiguous when
		// two customers share the bare name, which the error then lists.
		if bare, _ := splitName(n); bare != n {
			byNorm[normalize(bare)] = append(byNorm[normalize(bare)], n)
		}
	}
	var unresolved []string
	resolved := map[string]string{}
	seen := map[string]bool{}
	for _, p := range payments {
		if seen[p.payer] {
			continue
		}
		seen[p.payer] = true
		if m := byNorm[normalize(p.payer)]; len(m) == 1 {
			resolved[p.payer] = m[0]
		} else {
			unresolved = append(unresolved, p.payer)
		}
	}
	if len(unresolved) == 0 {
		return resolved, false, nil
	}
	sort.Strings(unresolved)

	if b, err := os.ReadFile(mapPath); err == nil {
		var mf mapFile
		if err := yaml.Unmarshal(b, &mf); err != nil {
			return nil, false, fmt.Errorf("parse %s: %w", mapPath, err)
		}
		pending := false
		var problems []string
		for _, name := range unresolved {
			v := strings.TrimSpace(mf.Payers[name])
			switch {
			case v == "":
				pending = true
			case v == "skip" || v == "new":
				resolved[name] = v
			case strings.HasPrefix(v, "new:") && strings.TrimSpace(v[4:]) != "":
				resolved[name] = "new:" + strings.TrimSpace(v[4:])
			default:
				switch m := byNorm[normalize(v)]; len(m) {
				case 1:
					resolved[name] = m[0]
				case 0:
					problems = append(problems, fmt.Sprintf("  «%s» → «%s»: такого клиента в листе 1 нет (для нового клиента напишите \"new\")", name, v))
				default:
					problems = append(problems, fmt.Sprintf("  «%s» → «%s»: неоднозначно, укажите одно из: %s", name, v, strings.Join(quoteAll(m), ", ")))
				}
			}
		}
		if len(problems) > 0 {
			return nil, false, fmt.Errorf("%s:\n%s", mapPath, strings.Join(problems, "\n"))
		}
		return resolved, pending, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, false, err
	}

	var sb strings.Builder
	sb.WriteString("# Плательщики из листа 2, которых не удалось однозначно сопоставить с клиентами листа 1.\n")
	sb.WriteString("# Значение — имя клиента точно как в списке ниже, \"new\" — создать отдельного клиента (в архиве),\n")
	sb.WriteString("# \"new:Имя\" — создать (или дополнить) клиента с таким именем,\n")
	sb.WriteString("# \"skip\" — не импортировать платежи этого плательщика. Пустое значение остановит импорт.\n#\n# Клиенты:\n")
	for _, n := range names {
		sb.WriteString("#   " + n + "\n")
	}
	sb.WriteString("payers:\n")
	for _, name := range unresolved {
		sug := suggest(name, byNorm)
		line := fmt.Sprintf("  %q: %q", name, sug)
		if sug != "" {
			line += "  # предложено автоматически — проверьте"
		}
		sb.WriteString(line + "\n")
	}
	if err := os.WriteFile(mapPath, []byte(sb.String()), 0o644); err != nil {
		return nil, false, err
	}
	return resolved, true, nil
}

// suggest guesses a customer for a payer name via diminutives or a unique
// first-name match.
func suggest(payer string, byNorm map[string][]string) string {
	parts := strings.Fields(normalize(payer))
	if len(parts) == 0 {
		return ""
	}
	cands := append([]string{parts[0]}, diminutives[parts[0]]...)
	for _, c := range cands {
		full := c
		if len(parts) > 1 {
			full = c + " " + strings.Join(parts[1:], " ")
		}
		if m := byNorm[full]; len(m) == 1 {
			return m[0]
		}
	}
	for _, c := range cands {
		var hits []string
		for norm, ns := range byNorm {
			if strings.Fields(norm)[0] == c {
				hits = append(hits, ns...)
			}
		}
		if len(hits) == 1 {
			return hits[0]
		}
	}
	return ""
}

func apply(ctx context.Context, tx *ent.Tx, p *parsed, names []string, payerMap map[string]string, opts Options, rep *strings.Builder) error {
	// Base tariffs: one per distinct price.
	tariffs := map[int64]int{}
	var prices []int64
	for _, r := range p.customers {
		if _, ok := tariffs[r.price]; !ok {
			tariffs[r.price] = 0
			prices = append(prices, r.price)
		}
	}
	sort.Slice(prices, func(i, j int) bool { return prices[i] > prices[j] })
	for i, price := range prices {
		name := fmt.Sprintf("%g ₽", money.ToMajor(price))
		if price == 0 {
			name = "Бесплатно"
		}
		t, err := tx.Tariff.Create().SetKind(tariff.KindBase).SetName(name).
			SetMonthlyPrice(price).SetSortOrder(i).Save(ctx)
		if err != nil {
			return err
		}
		tariffs[price] = t.ID
	}

	// Customers + one (not yet linked) subscription each.
	ids := map[string]int{} // display name → id
	byNorm := map[string]int{}
	for i, r := range p.customers {
		c, err := tx.Customer.Create().SetName(names[i]).SetArchived(!r.active).
			SetNotes("Импорт: " + r.raw).Save(ctx)
		if err != nil {
			return err
		}
		ids[names[i]] = c.ID
		byNorm[normalize(r.name)] = c.ID
		byNorm[normalize(names[i])] = c.ID
		if err := tx.Subscription.Create().SetCustomerID(c.ID).SetTariffID(tariffs[r.price]).
			SetLabel(r.name).Exec(ctx); err != nil {
			return err
		}
	}
	var unknownRefs []string
	for i, r := range p.customers {
		if r.ref == "" || isSelf(r.ref) {
			continue
		}
		refID := 0
		for _, cand := range referrerCandidates(r.ref) {
			if id, ok := byNorm[cand]; ok {
				refID = id
				break
			}
		}
		if refID == 0 || refID == ids[names[i]] {
			unknownRefs = append(unknownRefs, fmt.Sprintf("%s (от %s)", r.name, r.ref))
			continue
		}
		if err := tx.Customer.UpdateOneID(ids[names[i]]).SetReferrerID(refID).Exec(ctx); err != nil {
			return err
		}
	}

	// Infrastructure items.
	for _, it := range p.items {
		q := tx.ExpenseItem.Create().SetName(it.name).SetCurrency(it.currency).
			SetFeePercent(it.fee).SetSharePercent(it.share)
		if it.metered {
			// Minimum = the sheet's amount, 1 per GB beyond it (edit later).
			q.SetPricing(expenseitem.PricingMetered).SetMinCharge(it.amount).SetPricePerGB(100).
				SetNotes("Выберите ноду CDN, чтобы считать трафик")
		} else {
			q.SetPricing(expenseitem.PricingFixed).SetAmount(it.amount)
		}
		if err := q.Exec(ctx); err != nil {
			return err
		}
	}

	// Payments (historical: income, but no balance movement).
	var income int64
	created := map[string]int{}
	skipped := 0
	for _, pay := range p.payments {
		target := payerMap[pay.payer]
		if target == "skip" {
			skipped++
			continue
		}
		cid, ok := ids[target]
		if target == "new" || strings.HasPrefix(target, "new:") {
			newName := pay.payer
			if strings.HasPrefix(target, "new:") {
				newName = target[4:]
			}
			if cid, ok = created[newName]; !ok {
				c, err := tx.Customer.Create().SetName(newName).SetArchived(true).SetNotes("Импорт: плательщик без строки в листе 1").Save(ctx)
				if err != nil {
					return err
				}
				cid, ok = c.ID, true
				created[newName] = cid
			}
		}
		if !ok {
			return fmt.Errorf("плательщик %q не сопоставлен", pay.payer)
		}
		pm, err := tx.Payment.Create().SetCustomerID(cid).SetAmount(pay.amount).SetDate(pay.date).
			SetHistorical(true).SetNote("Импорт из таблицы").Save(ctx)
		if err != nil {
			return err
		}
		income += pay.amount
		if opts.Referrals {
			if err := accrue(ctx, tx, pm, opts.ReferralPercent); err != nil {
				return err
			}
		}
	}

	// Expenses (all RUB in the sheet).
	var spent, refunded int64
	for _, e := range p.expenses {
		rub := expenses.ToRub(e.orig, 1, 0, e.share)
		kind := "charge"
		if e.refund {
			kind, rub = "refund", -rub
			refunded += -rub
		} else {
			spent += rub
		}
		if err := tx.Expense.Create().SetDate(e.date).SetProvider(e.provider).
			SetKind(expenseKind(kind)).SetOrigAmount(e.orig).SetOrigCurrency("RUB").
			SetFxRate(1).SetSharePercent(e.share).SetRubAmount(rub).SetNote("Импорт из таблицы").
			Exec(ctx); err != nil {
			return err
		}
	}

	var mrr int64
	active := 0
	for _, r := range p.customers {
		if r.active {
			mrr += r.price
			active++
		}
	}
	fmt.Fprintf(rep, "Импорт завершён.\n")
	fmt.Fprintf(rep, "  Клиенты: %d (активных %d), тарифов: %d, MRR активных: %.2f ₽\n", len(p.customers), active, len(prices), money.ToMajor(mrr))
	fmt.Fprintf(rep, "  Статьи расходов: %d\n", len(p.items))
	fmt.Fprintf(rep, "  Поступления: %d на %.2f ₽ (пропущено %d, новых клиентов %d)\n", len(p.payments)-skipped, money.ToMajor(income), skipped, len(created))
	fmt.Fprintf(rep, "  Списания: %d, потрачено %.2f ₽, возвраты %.2f ₽, итого %.2f ₽\n", len(p.expenses), money.ToMajor(spent), money.ToMajor(refunded), money.ToMajor(spent-refunded))
	if len(unknownRefs) > 0 {
		fmt.Fprintf(rep, "  Не удалось определить, кто привёл (поправьте в UI): %s\n", strings.Join(unknownRefs, "; "))
	}
	fmt.Fprintf(rep, "Дальше: привяжите подписки к пользователям Remnawave на вкладке «Пользователи панели».\n")
	return nil
}

func accrue(ctx context.Context, tx *ent.Tx, pm *ent.Payment, defaultPercent float64) error {
	c, err := tx.Customer.Get(ctx, pm.CustomerID)
	if err != nil || c.ReferrerID == nil {
		return err
	}
	ref, err := tx.Customer.Get(ctx, *c.ReferrerID)
	if err != nil {
		return err
	}
	pct := defaultPercent
	if ref.ReferralPercent != nil {
		pct = *ref.ReferralPercent
	}
	if pct <= 0 {
		return nil
	}
	return tx.ReferralAccrual.Create().SetReferrerID(ref.ID).SetRefereeID(c.ID).SetPaymentID(pm.ID).
		SetPercent(pct).SetAmount(billing.ReferralAmount(pm.Amount, pct)).SetDate(pm.Date).Exec(ctx)
}

func quoteAll(ss []string) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = "«" + s + "»"
	}
	return out
}
