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

// API token scopes.
const (
	ScopeAddonsRead   = "addons:read"
	ScopeBackupsRead  = "backups:read"
	ScopeBackupsWrite = "backups:write"
)

// Scopes lists every scope a token can have.
var Scopes = []string{ScopeAddonsRead, ScopeBackupsRead, ScopeBackupsWrite}

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

// RequireToken accepts "Authorization: Bearer <token>" with scope.
func RequireToken(db *ent.Client, scope string) fiber.Handler {
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
		if !slices.Contains(t.Scopes, scope) {
			return apperr.Status(fiber.StatusForbidden, "token.scope", "token lacks scope {{scope}}", "scope", scope)
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
