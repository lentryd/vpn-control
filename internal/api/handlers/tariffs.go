package handlers

import (
	"github.com/gofiber/fiber/v2"

	"vpn-control/ent"
	"vpn-control/ent/addon"
	"vpn-control/ent/subscription"
	"vpn-control/ent/subscriptionaddon"
	"vpn-control/ent/tariff"
	"vpn-control/ent/tariffperiod"
	"vpn-control/internal/audit"
	"vpn-control/internal/money"
	"vpn-control/internal/store"
)

type PeriodView struct {
	Months int     `json:"months"`
	Price  float64 `json:"price"`
}

type TariffView struct {
	ID                int          `json:"id"`
	Kind              string       `json:"kind"`
	AddonID           *int         `json:"addon_id"`
	AddonName         string       `json:"addon_name"`
	Name              string       `json:"name"`
	Description       string       `json:"description"`
	MonthlyPrice      float64      `json:"monthly_price"`
	Active            bool         `json:"active"`
	SortOrder         int          `json:"sort_order"`
	ManageRw          bool         `json:"manage_rw"`
	TrafficLimitBytes int64        `json:"traffic_limit_bytes"`
	TrafficStrategy   string       `json:"traffic_strategy"`
	HwidLimit         *int         `json:"hwid_limit"`
	SquadUUIDs        []string     `json:"squad_uuids"`
	Periods           []PeriodView `json:"periods"`
	Subscribers       int          `json:"subscribers"`
	Overridden        int          `json:"overridden"`
	MRR               float64      `json:"mrr"`
}

func (h *Handlers) ListTariffs(c *fiber.Ctx) error {
	ctx := c.UserContext()
	ts, err := h.DB.Tariff.Query().WithAddon().WithPeriods(func(q *ent.TariffPeriodQuery) {
		q.Order(ent.Asc(tariffperiod.FieldMonths))
	}).Order(ent.Asc(tariff.FieldKind), ent.Asc(tariff.FieldSortOrder), ent.Asc(tariff.FieldMonthlyPrice)).All(ctx)
	if err != nil {
		return err
	}
	subs, err := h.loadSubscriptions(ctx)
	if err != nil {
		return err
	}
	type agg struct {
		n, overridden int
		mrr           float64
	}
	stats := map[int]*agg{}
	add := func(tid *int, price float64, override *float64, liveItem bool) {
		if tid == nil {
			return
		}
		a := stats[*tid]
		if a == nil {
			a = &agg{}
			stats[*tid] = a
		}
		a.n++
		if override != nil {
			a.overridden++
		}
		if liveItem {
			a.mrr += price
		}
	}
	for _, s := range subs {
		if s.CustomerArch {
			continue
		}
		add(s.TariffID, s.Price, s.PriceOverride, live(s.RwUser))
		for _, a := range s.Addons {
			add(a.TariffID, a.Price, a.PriceOverride, a.RwUser != nil && live(a.RwUser))
		}
	}
	out := make([]TariffView, 0, len(ts))
	for _, t := range ts {
		v := TariffView{
			ID: t.ID, Kind: t.Kind.String(), AddonID: t.AddonID, Name: t.Name, Description: t.Description,
			MonthlyPrice: money.ToMajor(t.MonthlyPrice), Active: t.Active, SortOrder: t.SortOrder,
			ManageRw: t.ManageRw, TrafficLimitBytes: t.TrafficLimitBytes, TrafficStrategy: t.TrafficStrategy,
			HwidLimit: t.HwidLimit, SquadUUIDs: t.SquadUuids, Periods: []PeriodView{},
		}
		if v.SquadUUIDs == nil {
			v.SquadUUIDs = []string{}
		}
		if t.Edges.Addon != nil {
			v.AddonName = t.Edges.Addon.Name
		}
		for _, p := range t.Edges.Periods {
			v.Periods = append(v.Periods, PeriodView{Months: p.Months, Price: money.ToMajor(p.Price)})
		}
		if a := stats[t.ID]; a != nil {
			v.Subscribers, v.Overridden, v.MRR = a.n, a.overridden, a.mrr
		}
		out = append(out, v)
	}
	return c.JSON(out)
}

type tariffInput struct {
	Kind              string       `json:"kind"`
	AddonID           *int         `json:"addon_id"`
	Name              string       `json:"name"`
	Description       string       `json:"description"`
	MonthlyPrice      float64      `json:"monthly_price"`
	Active            bool         `json:"active"`
	SortOrder         int          `json:"sort_order"`
	ManageRw          bool         `json:"manage_rw"`
	TrafficLimitBytes int64        `json:"traffic_limit_bytes"`
	TrafficStrategy   string       `json:"traffic_strategy"`
	HwidLimit         *int         `json:"hwid_limit"`
	SquadUUIDs        []string     `json:"squad_uuids"`
	Periods           []PeriodView `json:"periods"`
	// PriceChange, when the monthly price changes: "keep" pins the old
	// price as an override on current subscribers, "apply" moves everyone.
	PriceChange string `json:"price_change"`
}

func (in *tariffInput) validate() error {
	if in.Kind != "base" && in.Kind != "addon" {
		return fiber.NewError(fiber.StatusBadRequest, "тип тарифа: base | addon")
	}
	if in.Kind == "addon" && in.AddonID == nil {
		return fiber.NewError(fiber.StatusBadRequest, "выберите аддон")
	}
	if in.Kind == "base" {
		in.AddonID = nil
	}
	if in.TrafficStrategy == "" {
		in.TrafficStrategy = "NO_RESET"
	}
	return nil
}

func (h *Handlers) CreateTariff(c *fiber.Ctx) error {
	var in tariffInput
	if err := bind(c, &in); err != nil {
		return err
	}
	if err := in.validate(); err != nil {
		return err
	}
	ctx := c.UserContext()
	var id int
	err := store.WithTx(ctx, h.DB, func(tx *ent.Tx) error {
		t, err := tx.Tariff.Create().
			SetKind(tariff.Kind(in.Kind)).SetNillableAddonID(in.AddonID).SetName(in.Name).SetDescription(in.Description).
			SetMonthlyPrice(money.FromMajor(in.MonthlyPrice)).SetActive(in.Active).SetSortOrder(in.SortOrder).
			SetManageRw(in.ManageRw).SetTrafficLimitBytes(in.TrafficLimitBytes).SetTrafficStrategy(in.TrafficStrategy).
			SetNillableHwidLimit(in.HwidLimit).SetSquadUuids(in.SquadUUIDs).
			Save(ctx)
		if err != nil {
			return err
		}
		id = t.ID
		return savePeriods(ctx, tx, t.ID, in.Periods)
	})
	audit.Log(ctx, h.DB, "tariff.create", "tariff", id, in, err)
	if err != nil {
		return badRequest(err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func savePeriods(ctx fiberCtx, tx *ent.Tx, tariffID int, periods []PeriodView) error {
	if _, err := tx.TariffPeriod.Delete().Where(tariffperiod.TariffID(tariffID)).Exec(ctx); err != nil {
		return err
	}
	for _, p := range periods {
		if p.Months <= 1 {
			continue
		}
		if err := tx.TariffPeriod.Create().SetTariffID(tariffID).SetMonths(p.Months).SetPrice(money.FromMajor(p.Price)).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (h *Handlers) UpdateTariff(c *fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	var in tariffInput
	if err := bind(c, &in); err != nil {
		return err
	}
	if err := in.validate(); err != nil {
		return err
	}
	ctx := c.UserContext()
	old, err := h.DB.Tariff.Get(ctx, id)
	if err != nil {
		return badRequest(err)
	}
	newPrice := money.FromMajor(in.MonthlyPrice)
	err = store.WithTx(ctx, h.DB, func(tx *ent.Tx) error {
		if newPrice != old.MonthlyPrice && in.PriceChange == "keep" {
			if _, err := tx.Subscription.Update().
				Where(subscription.TariffID(id), subscription.PriceOverrideIsNil()).
				SetPriceOverride(old.MonthlyPrice).Save(ctx); err != nil {
				return err
			}
			if _, err := tx.SubscriptionAddon.Update().
				Where(subscriptionaddon.TariffID(id), subscriptionaddon.PriceOverrideIsNil()).
				SetPriceOverride(old.MonthlyPrice).Save(ctx); err != nil {
				return err
			}
		}
		q := tx.Tariff.UpdateOneID(id).
			SetName(in.Name).SetDescription(in.Description).SetMonthlyPrice(newPrice).
			SetActive(in.Active).SetSortOrder(in.SortOrder).SetManageRw(in.ManageRw).
			SetTrafficLimitBytes(in.TrafficLimitBytes).SetTrafficStrategy(in.TrafficStrategy).
			SetSquadUuids(in.SquadUUIDs)
		if in.HwidLimit != nil {
			q.SetHwidLimit(*in.HwidLimit)
		} else {
			q.ClearHwidLimit()
		}
		if err := q.Exec(ctx); err != nil {
			return err
		}
		return savePeriods(ctx, tx, id, in.Periods)
	})
	audit.Log(ctx, h.DB, "tariff.update", "tariff", id, in, err)
	if err != nil {
		return badRequest(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handlers) DeleteTariff(c *fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	ctx := c.UserContext()
	n1, _ := h.DB.Subscription.Query().Where(subscription.TariffID(id)).Count(ctx)
	n2, _ := h.DB.SubscriptionAddon.Query().Where(subscriptionaddon.TariffID(id)).Count(ctx)
	if n1+n2 > 0 {
		return fiber.NewError(fiber.StatusConflict, "тариф используется — отключите его вместо удаления")
	}
	if _, err := h.DB.TariffPeriod.Delete().Where(tariffperiod.TariffID(id)).Exec(ctx); err != nil {
		return err
	}
	err = h.DB.Tariff.DeleteOneID(id).Exec(ctx)
	audit.Log(ctx, h.DB, "tariff.delete", "tariff", id, nil, err)
	if err != nil {
		return badRequest(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handlers) ListAddons(c *fiber.Ctx) error {
	list, err := h.DB.Addon.Query().Order(ent.Asc(addon.FieldName)).All(c.UserContext())
	if err != nil {
		return err
	}
	out := make([]fiber.Map, 0, len(list))
	for _, a := range list {
		out = append(out, fiber.Map{"id": a.ID, "name": a.Name, "prefix": a.Prefix, "suffix": a.Suffix, "in_config": a.InConfig})
	}
	return c.JSON(out)
}
