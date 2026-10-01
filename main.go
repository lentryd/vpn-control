package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // distroless images have no zoneinfo

	"github.com/joho/godotenv"

	"vpn-control/internal/api"
	"vpn-control/internal/api/handlers"
	"vpn-control/internal/billing"
	"vpn-control/internal/config"
	"vpn-control/internal/expenses"
	"vpn-control/internal/fx"
	"vpn-control/internal/importer"
	"vpn-control/internal/remnawave"
	"vpn-control/internal/rwsync"
	"vpn-control/internal/settings"
	"vpn-control/internal/store"
)

// Set via -ldflags; "dev"/"none" when built with a plain `go build`.
var (
	Version = "dev"
	Commit  = "none"
)

const usage = `vpn-control — VPN business admin on top of Remnawave.

Usage:
  vpn-control [flags]                       run the server
  vpn-control import-xlsx [flags] <file>    one-time import of the old spreadsheet

Run "vpn-control import-xlsx -h" for import flags.
`

func main() {
	if len(os.Args) > 1 && os.Args[1] == "import-xlsx" {
		os.Exit(runImport(os.Args[2:]))
	}

	port := flag.String("port", "", "HTTP port override (defaults to $PORT or 8080)")
	noWeb := flag.Bool("no-web", false, "Don't serve the embedded SPA (use with the Vite dev server)")
	noSync := flag.Bool("no-sync", false, "Disable background Remnawave/traffic sync")
	debug := flag.Bool("debug", false, "Enable debug logging")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Usage = func() { fmt.Fprint(os.Stderr, usage); flag.PrintDefaults() }
	flag.Parse()

	if *showVersion {
		fmt.Printf("vpn-control %s (commit: %s)\n", Version, Commit)
		return
	}

	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config:", err)
		os.Exit(1)
	}
	if *port != "" {
		cfg.Port = *port
	}
	if *debug {
		cfg.Debug = true
	}
	setupLogging(cfg.Debug)
	time.Local = cfg.Location

	slog.Info("starting", "version", Version, "commit", Commit, "base_path", cfg.BasePath)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	db, err := store.Open(ctx, cfg.DBPath)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	rw := remnawave.NewClient(cfg.RemnawaveURL, cfg.RemnawaveToken, cfg.RemnawaveAPIKey)
	st := settings.New(db)
	fxs := fx.New(db)
	syncSvc := rwsync.New(db, rw, cfg.AddonsConfig)
	expSvc := expenses.New(db, rw, fxs, cfg.Location)
	if cfg.RemnawaveMetricsURL != "" {
		expSvc.UseMetricsScraper(remnawave.NewMetricsScraper(cfg.RemnawaveMetricsURL, cfg.RemnawaveMetricsUser, cfg.RemnawaveMetricsPass))
	}

	if !*noSync {
		go syncSvc.Run(ctx, cfg.SyncInterval)
		go expSvc.RunTrafficSync(ctx, time.Hour)
		go expSvc.RunInboundPolling(ctx, 2*time.Minute)
	} else if err := syncSvc.SyncAddons(ctx); err != nil {
		slog.Warn("addons sync failed", "error", err)
	}

	app := api.New(&api.Deps{
		Handlers: &handlers.Handlers{
			DB: db, RW: rw, Billing: billing.New(db, rw, st), Expenses: expSvc,
			FX: fxs, Sync: syncSvc, Settings: st, Config: cfg,
		},
		NoWeb: *noWeb,
	})

	go func() {
		slog.Info("server listening", "port", cfg.Port)
		if err := app.Listen("0.0.0.0:" + cfg.Port); err != nil {
			slog.Error("server error", "error", err)
			cancel()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = app.ShutdownWithContext(shutdownCtx)
}

func setupLogging(debug bool) {
	level := slog.LevelInfo
	if debug {
		level = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})))
}

func runImport(args []string) int {
	fs := flag.NewFlagSet("import-xlsx", flag.ExitOnError)
	mapPath := fs.String("map", "import-map.yml", "Name mapping file (written on the first run when names don't match)")
	referrals := fs.Bool("referrals", false, "Also accrue referral percents for the imported (historical) payments")
	dbPath := fs.String("db", "", "SQLite file (defaults to $DB_PATH or ./data/vpn-control.db)")
	force := fs.Bool("force", false, "Import even if the database already has customers")
	fs.Usage = func() {
		fmt.Fprintln(os.Stderr, "Usage: vpn-control import-xlsx [flags] <file.xlsx>")
		fs.PrintDefaults()
	}
	_ = fs.Parse(args)
	if fs.NArg() != 1 {
		fs.Usage()
		return 2
	}

	_ = godotenv.Load()
	setupLogging(false)
	path := *dbPath
	if path == "" {
		path = os.Getenv("DB_PATH")
	}
	if path == "" {
		path = "./data/vpn-control.db"
	}
	ctx := context.Background()
	db, err := store.Open(ctx, path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open database:", err)
		return 1
	}
	defer db.Close()

	rep, err := importer.Run(ctx, db, importer.Options{
		File: fs.Arg(0), MapPath: *mapPath, Referrals: *referrals, Force: *force,
		ReferralPercent: settings.New(db).Float(ctx, settings.ReferralPercent),
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "import:", err)
		return 1
	}
	fmt.Print(rep)
	return 0
}
