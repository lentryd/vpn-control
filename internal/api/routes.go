package api

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/filesystem"

	appmiddleware "vpn-control/internal/api/middleware"
	"vpn-control/web"
)

// RegisterRoutes wires the route table. Everything lives under BasePath so
// the app can sit at a path of the panel's domain; JSON endpoints are under
// {base}/api, the SPA is served for the rest.
func RegisterRoutes(app *fiber.App, deps *Deps) {
	h := deps.Handlers
	base := h.Config.BasePath

	root := app.Group(base)
	api := root.Group("/api")

	api.Get("/healthz", func(c *fiber.Ctx) error { return c.SendString("ok") })
	api.Post("/auth/login", h.Login)
	api.Post("/auth/logout", h.Logout)
	api.Post("/webhooks/remnawave", h.RemnawaveWebhook)

	// Public API for other services, authorized by API tokens. Registered
	// before the session group, whose middleware covers all of /api.
	token := func(scope string) fiber.Handler { return appmiddleware.RequireToken(h.DB, scope) }
	v1 := api.Group("/v1")
	v1.Get("/addons", token(appmiddleware.ScopeAddonsList), h.PublicAddons)
	v1.Get("/backups", token(appmiddleware.ScopeBackupsList), h.ListSnapshots)
	v1.Get("/backups/:name", token(appmiddleware.ScopeBackupsDownload), h.DownloadSnapshot)
	v1.Post("/backups", token(appmiddleware.ScopeBackupsCreate), h.CreateAndSendSnapshot)

	a := api.Group("", appmiddleware.RequireSession(h.Config.JWTSecret))
	a.Get("/auth/me", h.Me)
	a.Get("/dashboard", h.Dashboard)

	a.Get("/customers", h.ListCustomers)
	a.Post("/customers", h.CreateCustomer)
	a.Get("/customers/:id", h.GetCustomer)
	a.Put("/customers/:id", h.UpdateCustomer)
	a.Delete("/customers/:id", h.DeleteCustomer)
	a.Post("/customers/:id/payments/preview", h.PreviewPayment)
	a.Post("/customers/:id/payments", h.CommitPayment)
	a.Post("/customers/:id/adjust", h.AdjustBalance)

	a.Get("/payments", h.ListPayments)
	a.Put("/payments/:id", h.UpdatePayment)
	a.Delete("/payments/:id", h.DeletePayment)

	a.Get("/referrals/tree", h.ReferralTree)
	a.Get("/referrals/accruals", h.ListAccruals)

	a.Get("/subscriptions", h.ListSubscriptions)
	a.Post("/subscriptions", h.CreateSubscription)
	a.Post("/subscriptions/provision", h.ProvisionSubscription)
	a.Put("/subscriptions/:id", h.UpdateSubscription)
	a.Delete("/subscriptions/:id", h.DeleteSubscription)
	a.Post("/subscriptions/:id/addons", h.ConnectAddon)
	a.Put("/subscription-addons/:id", h.UpdateSubscriptionAddon)
	a.Delete("/subscription-addons/:id", h.DeleteSubscriptionAddon)

	// kind: subscription | addon
	a.Get("/items/:kind/:id/quote", h.QuoteExtend)
	a.Post("/items/:kind/:id/extend", h.Extend)
	a.Get("/items/:kind/:id/tariff-quote", h.QuoteTariff)
	a.Post("/items/:kind/:id/tariff", h.ChangeTariff)
	a.Post("/items/:kind/:id/enable", h.SetEnabled(true))
	a.Post("/items/:kind/:id/disable", h.SetEnabled(false))

	a.Get("/tariffs", h.ListTariffs)
	a.Post("/tariffs", h.CreateTariff)
	a.Put("/tariffs/:id", h.UpdateTariff)
	a.Delete("/tariffs/:id", h.DeleteTariff)
	a.Post("/tariffs/:id/sync-included", h.SyncIncluded)
	a.Get("/addons", h.ListAddons)
	a.Post("/addons", h.CreateAddon)
	a.Put("/addons/:id", h.UpdateAddon)
	a.Delete("/addons/:id", h.DeleteAddon)

	a.Get("/api-tokens", h.ListTokens)
	a.Get("/api-tokens/scopes", h.TokenScopes)
	a.Post("/api-tokens", h.CreateToken)
	a.Delete("/api-tokens/:id", h.DeleteToken)

	a.Get("/rw/users", h.ListRwUsers)
	a.Get("/rw/squads", h.ListSquads)
	a.Get("/rw/nodes", h.ListNodes)
	a.Get("/rw/infra", h.ListInfra)
	a.Get("/rw/sync", h.SyncStatus)
	a.Post("/rw/sync", h.SyncNow)

	a.Get("/expenses", h.ListExpenses)
	a.Post("/expenses", h.CreateExpense)
	a.Put("/expenses/:id", h.UpdateExpense)
	a.Delete("/expenses/:id", h.DeleteExpense)
	a.Get("/expenses/providers", h.ProviderReport)

	a.Get("/expense-items", h.ListExpenseItems)
	a.Post("/expense-items", h.CreateExpenseItem)
	a.Put("/expense-items/:id", h.UpdateExpenseItem)
	a.Delete("/expense-items/:id", h.DeleteExpenseItem)
	a.Get("/expense-items/:id/metered", h.MeteredSummary)
	a.Post("/expense-items/:id/close-period", h.ClosePeriod)
	a.Post("/traffic/sync", h.SyncTraffic)

	a.Get("/fx/rate", h.FxRate)
	a.Get("/settings", h.GetSettings)
	a.Put("/settings", h.UpdateSettings)
	a.Get("/audit", h.ListAudit)

	a.Get("/backup/categories", h.BackupCategories)
	a.Get("/backup/export", h.ExportBackup)
	a.Post("/backup/inspect", h.InspectBackup)
	a.Post("/backup/import", h.ImportBackup)
	a.Get("/backup/snapshots", h.ListSnapshots)
	a.Post("/backup/snapshots", h.CreateSnapshot)
	a.Get("/backup/snapshots/:name", h.DownloadSnapshot)
	a.Delete("/backup/snapshots/:name", h.DeleteSnapshot)
	a.Get("/backup/snapshots/:name/inspect", h.InspectSnapshot)
	a.Post("/backup/snapshots/:name/restore", h.RestoreSnapshot)

	api.Use(func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "unknown endpoint")
	})

	if deps.NoWeb {
		return
	}

	// The SPA uses relative asset URLs and a hash router, so it works under
	// any BasePath — as long as the page URL ends with "/".
	if base != "" {
		// Fiber matches "/control" and "/control/" alike, so check the raw
		// path to redirect only the slash-less form.
		app.Get(base, func(c *fiber.Ctx) error {
			if path, _, _ := strings.Cut(c.OriginalURL(), "?"); path == base {
				return c.Redirect(base+"/", fiber.StatusMovedPermanently)
			}
			return c.Next()
		})
	}
	// Registered after the API, so only the SPA files are compressed
	// (brotli/gzip by Accept-Encoding): ~1.2 MB of JS turns into ~350 KB.
	root.Use(compress.New())
	root.Use(filesystem.New(filesystem.Config{
		Root:         web.StaticFS,
		PathPrefix:   "",
		Index:        "index.html",
		NotFoundFile: "index.html",
		MaxAge:       3600,
	}))
}
