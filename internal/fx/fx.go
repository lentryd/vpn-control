// Package fx fetches Central Bank of Russia exchange rates (RUB per one unit
// of a currency) and caches them per date in the database.
package fx

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/text/encoding/charmap"

	"vpn-control/ent"
	"vpn-control/ent/fxrate"
)

const cbrURL = "https://www.cbr.ru/scripts/XML_daily.asp?date_req=%s"

type Service struct {
	db   *ent.Client
	http *http.Client
	mu   sync.Mutex
}

func New(db *ent.Client) *Service {
	return &Service{db: db, http: &http.Client{Timeout: 15 * time.Second}}
}

// Rate returns RUB per one unit of currency on date. RUB is always 1. The
// CBR answers weekends/holidays with the last published rate.
func (s *Service) Rate(ctx context.Context, currency string, date time.Time) (float64, error) {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" || currency == "RUB" {
		return 1, nil
	}
	day := date.Format("2006-01-02")
	// Rates for a future date don't exist yet; use today's.
	if today := time.Now().Format("2006-01-02"); day > today {
		day = today
	}

	if r, err := s.db.FxRate.Query().Where(fxrate.Date(day), fxrate.Currency(currency)).Only(ctx); err == nil {
		return r.Rate, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	d, _ := time.Parse("2006-01-02", day)
	rates, err := s.fetch(ctx, d)
	if err != nil {
		return 0, err
	}
	// Don't cache today's rate permanently: the CBR publishes tomorrow's
	// rate during the day, and "today" may still change before it settles.
	cache := day < time.Now().Format("2006-01-02")
	if cache {
		for cur, rate := range rates {
			_ = s.db.FxRate.Create().SetDate(day).SetCurrency(cur).SetRate(rate).
				OnConflictColumns(fxrate.FieldDate, fxrate.FieldCurrency).UpdateNewValues().Exec(ctx)
		}
	}
	rate, ok := rates[currency]
	if !ok {
		return 0, fmt.Errorf("CBR has no rate for %s", currency)
	}
	return rate, nil
}

type valCurs struct {
	Valutes []struct {
		CharCode string `xml:"CharCode"`
		Nominal  string `xml:"Nominal"`
		Value    string `xml:"Value"`
	} `xml:"Valute"`
}

func (s *Service) fetch(ctx context.Context, date time.Time) (map[string]float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf(cbrURL, date.Format("02/01/2006")), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "vpn-control/1.0")
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch CBR rates: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CBR returned %d", resp.StatusCode)
	}
	return parse(resp.Body)
}

func parse(r io.Reader) (map[string]float64, error) {
	dec := xml.NewDecoder(r)
	dec.CharsetReader = func(charset string, input io.Reader) (io.Reader, error) {
		if strings.EqualFold(charset, "windows-1251") {
			return charmap.Windows1251.NewDecoder().Reader(input), nil
		}
		return input, nil
	}
	var vc valCurs
	if err := dec.Decode(&vc); err != nil {
		return nil, fmt.Errorf("parse CBR rates: %w", err)
	}
	rates := make(map[string]float64, len(vc.Valutes))
	for _, v := range vc.Valutes {
		value, err := strconv.ParseFloat(strings.ReplaceAll(v.Value, ",", "."), 64)
		if err != nil {
			continue
		}
		nominal, err := strconv.ParseFloat(v.Nominal, 64)
		if err != nil || nominal == 0 {
			nominal = 1
		}
		rates[v.CharCode] = value / nominal
	}
	if len(rates) == 0 {
		return nil, fmt.Errorf("CBR returned no rates")
	}
	return rates, nil
}
