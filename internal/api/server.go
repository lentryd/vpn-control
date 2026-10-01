// Package api implements the HTTP server: JSON API routes under
// {BASE_PATH}/api and the embedded SPA.
package api

import (
	"errors"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"vpn-control/internal/api/handlers"
	appmiddleware "vpn-control/internal/api/middleware"
)

type Deps struct {
	Handlers *handlers.Handlers
	// NoWeb disables serving the embedded SPA build (dev: Vite serves it).
	NoWeb bool
}

func New(deps *Deps) *fiber.App {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          60 * time.Second,
		IdleTimeout:           120 * time.Second,
		BodyLimit:             256 << 20, // backup archives
		ErrorHandler:          errorHandler,
	})

	app.Use(recover.New())
	app.Use(appmiddleware.RequestLogger())

	RegisterRoutes(app, deps)
	return app
}

// errorHandler answers {"message": ...} with the error's status.
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := err.Error()
	var fe *fiber.Error
	if errors.As(err, &fe) {
		code = fe.Code
	}
	if code >= 500 {
		slog.Error("request failed", "method", c.Method(), "path", c.Path(), "error", err)
	}
	return c.Status(code).JSON(fiber.Map{"message": msg})
}
