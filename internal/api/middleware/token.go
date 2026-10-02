package middleware

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"vpn-control/ent"
	"vpn-control/ent/apitoken"
	"vpn-control/internal/apperr"
	"vpn-control/internal/audit"
)

// Endpoint keys of the public API, granted to tokens through scopes.
const (
	ScopeAddonsList      = "addons:list"
	ScopeBackupsList     = "backups:list"
	ScopeBackupsDownload = "backups:download"
	ScopeBackupsCreate   = "backups:create"
)

// ScopeEndpoint is one public API endpoint a token can be allowed.
type ScopeEndpoint struct {
	Key         string `json:"key"`
	Method      string `json:"method"`
	Path        string `json:"path"`
	Description string `json:"description"`
	Kind        string `json:"kind"` // read | write
}

// ScopeResource groups endpoints like the panel's API token scopes.
type ScopeResource struct {
	Resource  string          `json:"resource"`
	Endpoints []ScopeEndpoint `json:"endpoints"`
}

// ScopeCatalog is every grantable endpoint. Scopes follow the panel's
// grammar: "*", "<resource>:*", "<resource>:read", "<resource>:write" or
// an endpoint key.
var ScopeCatalog = []ScopeResource{
	{Resource: "addons", Endpoints: []ScopeEndpoint{
		{Key: ScopeAddonsList, Method: "GET", Path: "/api/v1/addons", Description: "Add-on catalog (JSON, or addons.yml with ?format=yaml)", Kind: "read"},
	}},
	{Resource: "backups", Endpoints: []ScopeEndpoint{
		{Key: ScopeBackupsList, Method: "GET", Path: "/api/v1/backups", Description: "List snapshots", Kind: "read"},
		{Key: ScopeBackupsDownload, Method: "GET", Path: "/api/v1/backups/{name}", Description: "Download a snapshot", Kind: "read"},
		{Key: ScopeBackupsCreate, Method: "POST", Path: "/api/v1/backups", Description: "Take a snapshot and download it", Kind: "write"},
	}},
}

func findEndpoint(key string) (string, *ScopeEndpoint) {
	for _, r := range ScopeCatalog {
		for i := range r.Endpoints {
			if r.Endpoints[i].Key == key {
				return r.Resource, &r.Endpoints[i]
			}
		}
	}
	return "", nil
}

// ValidScope reports whether s is a scope of the grammar above.
func ValidScope(s string) bool {
	if s == "*" {
		return true
	}
	if _, ep := findEndpoint(s); ep != nil {
		return true
	}
	res, rest, ok := strings.Cut(s, ":")
	if !ok || (rest != "*" && rest != "read" && rest != "write") {
		return false
	}
	return slices.ContainsFunc(ScopeCatalog, func(r ScopeResource) bool { return r.Resource == res })
}

// Allowed reports whether scopes grant the endpoint key.
func Allowed(scopes []string, key string) bool {
	res, ep := findEndpoint(key)
	if ep == nil {
		return false
	}
	for _, s := range scopes {
		switch s {
		case "*", key, res + ":*", res + ":" + ep.Kind:
			return true
		}
	}
	return false
}

// LocalsToken is the fiber.Ctx.Locals key holding the calling *ent.APIToken.
const LocalsToken = "token"

const tokenPrefix = "vpc_"

// NewToken returns a fresh API token and the hash to store.
func NewToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = tokenPrefix + base64.RawURLEncoding.EncodeToString(b)
	return token, HashToken(token), nil
}

// HashToken is how tokens are stored and looked up.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// RequireToken accepts "Authorization: Bearer <token>" of an unexpired
// token whose scopes allow the endpoint key.
func RequireToken(db *ent.Client, key string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		raw, ok := strings.CutPrefix(c.Get(fiber.HeaderAuthorization), "Bearer ")
		if !ok || raw == "" {
			return apperr.Status(fiber.StatusUnauthorized, "token.required", "API token required")
		}
		ctx := c.UserContext()
		t, err := db.APIToken.Query().Where(apitoken.TokenHash(HashToken(strings.TrimSpace(raw)))).Only(ctx)
		if err != nil {
			return apperr.Status(fiber.StatusUnauthorized, "token.invalid", "invalid API token")
		}
		if t.ExpireAt != nil && t.ExpireAt.Before(time.Now()) {
			return apperr.Status(fiber.StatusUnauthorized, "token.expired", "API token expired")
		}
		if !Allowed(t.Scopes, key) {
			return apperr.Status(fiber.StatusForbidden, "token.scope", "token lacks scope {{scope}}", "scope", key)
		}
		// Coarse last-use tracking: one write a minute at most.
		if t.LastUsedAt == nil || time.Since(*t.LastUsedAt) > time.Minute {
			_ = db.APIToken.UpdateOne(t).SetLastUsedAt(time.Now()).Exec(ctx)
		}
		c.Locals(LocalsToken, t)
		c.SetUserContext(audit.WithActor(ctx, "token:"+t.Name))
		return c.Next()
	}
}
