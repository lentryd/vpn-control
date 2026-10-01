// Package handlers implements the JSON API. One file per area; each handler
// parses the request, calls a service or Ent, and responds with DTOs where
// money is in rubles (float) and dates are RFC 3339.
package handlers

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"vpn-control/ent"
	"vpn-control/internal/billing"
	"vpn-control/internal/config"
	"vpn-control/internal/expenses"
	"vpn-control/internal/fx"
	"vpn-control/internal/remnawave"
	"vpn-control/internal/rwsync"
	"vpn-control/internal/settings"
)

type Handlers struct {
	DB       *ent.Client
	RW       *remnawave.Client
	Billing  *billing.Service
	Expenses *expenses.Service
	FX       *fx.Service
	Sync     *rwsync.Service
	Settings *settings.Store
	Config   *config.Config
}

func paramID(c *fiber.Ctx, name string) (int, error) {
	id, err := strconv.Atoi(c.Params(name))
	if err != nil || id <= 0 {
		return 0, fiber.NewError(fiber.StatusBadRequest, "некорректный id")
	}
	return id, nil
}

func bind(c *fiber.Ctx, v any) error {
	if err := c.BodyParser(v); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "некорректный запрос: "+err.Error())
	}
	return nil
}

// badRequest turns service validation errors into 400s; Ent not-found into
// 404s; everything else stays a 500.
func badRequest(err error) error {
	if err == nil {
		return nil
	}
	var fe *fiber.Error
	if errors.As(err, &fe) {
		return err
	}
	if ent.IsNotFound(err) {
		return fiber.NewError(fiber.StatusNotFound, "не найдено")
	}
	if ent.IsConstraintError(err) {
		return fiber.NewError(fiber.StatusConflict, "конфликт данных: "+err.Error())
	}
	var apiErr *remnawave.APIError
	if errors.As(err, &apiErr) {
		return fiber.NewError(fiber.StatusBadGateway, "Remnawave: "+err.Error())
	}
	return fiber.NewError(fiber.StatusBadRequest, err.Error())
}

// Date is a JSON date accepting "2006-01-02" or RFC 3339.
type Date struct{ time.Time }

func (d *Date) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02"} {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			d.Time = t
			return nil
		}
	}
	return errors.New("некорректная дата " + s)
}

func (d Date) Ptr() *time.Time {
	if d.IsZero() {
		return nil
	}
	t := d.Time
	return &t
}

// fiberCtx is the context type used by helpers that only need a context.
type fiberCtx = context.Context
