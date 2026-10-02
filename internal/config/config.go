// Package config loads and validates process configuration from
// environment variables (see .env.example for the full list).
package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	// Port is the HTTP port the API/web server listens on.
	Port string
	// BasePath is the URL prefix the app is served under (e.g. "/control"
	// when mounted under the panel's domain); empty for the root.
	BasePath string
	// DBPath is the SQLite database file.
	DBPath string
	// Debug enables verbose (slog debug level) logging.
	Debug bool

	// RemnawaveURL is the panel backend base URL; inside the docker network
	// that's http://remnawave:3000.
	RemnawaveURL string
	// RemnawaveToken is a panel API token (scopes: users:*,
	// internal-squads:read, nodes:read, bandwidth-stats:read — or *).
	RemnawaveToken string
	// RemnawaveAPIKey is the optional X-Api-Key for panels behind
	// caddy-with-auth.
	RemnawaveAPIKey string

	// RemnawaveMetricsURL is the panel's Prometheus endpoint
	// (http://remnawave:3001/metrics) with METRICS_USER/METRICS_PASS. It
	// enables per-inbound metering; without it items can't pick an inbound.
	RemnawaveMetricsURL  string
	RemnawaveMetricsUser string
	RemnawaveMetricsPass string

	// AddonsConfig is subpage's addons.yml, shared read-only.
	AddonsConfig string

	// JWTSecret signs admin session cookies.
	JWTSecret string
	// SecureCookie sets the Secure flag on the session cookie.
	SecureCookie bool
	// AdminUsername/AdminPassword is a local fallback login for panels where
	// password login is disabled (OAuth/passkey only). Empty disables it.
	AdminUsername string
	AdminPassword string

	// WebhookSecret is the panel's WEBHOOK_SECRET_HEADER; empty disables the
	// webhook endpoint.
	WebhookSecret string

	// SyncInterval is how often Remnawave users are re-synced.
	SyncInterval time.Duration
	// Location is the time zone dates (expiry, expense dates) are shown in.
	Location *time.Location
}

func Load() (*Config, error) {
	syncInterval, err := time.ParseDuration(envOrDefault("SYNC_INTERVAL", "10m"))
	if err != nil {
		return nil, fmt.Errorf("SYNC_INTERVAL: %w", err)
	}
	loc, err := time.LoadLocation(envOrDefault("TZ", "Europe/Moscow"))
	if err != nil {
		return nil, fmt.Errorf("TZ: %w", err)
	}

	cfg := &Config{
		Port:     envOrDefault("PORT", "8080"),
		BasePath: normalizeBasePath(getenv("BASE_PATH")),
		DBPath:   envOrDefault("DB_PATH", "./data/vpn-control.db"),
		Debug:    getenv("DEBUG") == "true",

		RemnawaveURL:    strings.TrimSuffix(getenv("REMNAWAVE_URL"), "/"),
		RemnawaveToken:  getenv("REMNAWAVE_TOKEN"),
		RemnawaveAPIKey: getenv("REMNAWAVE_API_KEY"),

		RemnawaveMetricsURL:  getenv("REMNAWAVE_METRICS_URL"),
		RemnawaveMetricsUser: getenv("REMNAWAVE_METRICS_USER"),
		RemnawaveMetricsPass: getenv("REMNAWAVE_METRICS_PASS"),

		AddonsConfig: envOrDefault("ADDONS_CONFIG", "./addons.yml"),

		JWTSecret:     getenv("JWT_SECRET"),
		SecureCookie:  getenv("SECURE_COOKIE") != "false",
		AdminUsername: envOrDefault("ADMIN_USERNAME", "admin"),
		AdminPassword: getenv("ADMIN_PASSWORD"),

		WebhookSecret: getenv("WEBHOOK_SECRET"),

		SyncInterval: syncInterval,
		Location:     loc,
	}

	if cfg.RemnawaveURL == "" {
		return nil, fmt.Errorf("REMNAWAVE_URL is required")
	}
	if cfg.RemnawaveToken == "" {
		return nil, fmt.Errorf("REMNAWAVE_TOKEN is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

// normalizeBasePath turns "control", "/control/" etc. into "/control", and
// "/" or "" into "".
func normalizeBasePath(p string) string {
	p = strings.Trim(p, "/")
	if p == "" {
		return ""
	}
	return "/" + p
}

// getenv reads an env var trimmed of surrounding whitespace — hand-edited
// .env files routinely pick up a trailing space.
func getenv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func envOrDefault(key, fallback string) string {
	if v := getenv(key); v != "" {
		return v
	}
	return fallback
}
