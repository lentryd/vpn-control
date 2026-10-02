package handlers

import (
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"vpn-control/ent"
	"vpn-control/ent/addon"
	"vpn-control/ent/apitoken"
	"vpn-control/internal/addons"
	appmiddleware "vpn-control/internal/api/middleware"
	"vpn-control/internal/apperr"
	"vpn-control/internal/audit"
)

type tokenView struct {
	ID         int        `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scopes     []string   `json:"scopes"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

func (h *Handlers) ListTokens(c *fiber.Ctx) error {
	ts, err := h.DB.APIToken.Query().Order(ent.Desc(apitoken.FieldID)).All(c.UserContext())
	if err != nil {
		return err
	}
	out := make([]tokenView, 0, len(ts))
	for _, t := range ts {
		out = append(out, tokenView{ID: t.ID, Name: t.Name, Prefix: t.Prefix, Scopes: t.Scopes, CreatedAt: t.CreatedAt, LastUsedAt: t.LastUsedAt})
	}
	return c.JSON(fiber.Map{"tokens": out, "scopes": appmiddleware.Scopes})
}

// CreateToken returns the new token once; only its hash is kept.
func (h *Handlers) CreateToken(c *fiber.Ctx) error {
	var in struct {
		Name   string   `json:"name"`
		Scopes []string `json:"scopes"`
	}
	if err := bind(c, &in); err != nil {
		return err
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return apperr.New("token.name_required", "name is required")
	}
	if len(in.Scopes) == 0 {
		return apperr.New("token.scope_required", "choose at least one scope")
	}
	for _, s := range in.Scopes {
		if !slices.Contains(appmiddleware.Scopes, s) {
			return apperr.New("token.unknown_scope", "unknown scope {{scope}}", "scope", s)
		}
	}
	token, hash, err := appmiddleware.NewToken()
	if err != nil {
		return err
	}
	ctx := c.UserContext()
	t, err := h.DB.APIToken.Create().
		SetName(in.Name).SetTokenHash(hash).SetPrefix(token[:12]).SetScopes(in.Scopes).
		Save(ctx)
	audit.Log(ctx, h.DB, "api_token.create", "api_token", tokenID(t), in, err)
	if err != nil {
		return badRequest(err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": t.ID, "token": token})
}

func (h *Handlers) DeleteToken(c *fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	ctx := c.UserContext()
	err = h.DB.APIToken.DeleteOneID(id).Exec(ctx)
	audit.Log(ctx, h.DB, "api_token.delete", "api_token", id, nil, err)
	if err != nil {
		return badRequest(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func tokenID(t *ent.APIToken) int {
	if t == nil {
		return 0
	}
	return t.ID
}

// PublicAddons: GET /api/v1/addons[?format=yaml] — the add-on catalog in
// subpage's addons.yml format, for subpage or any other service.
func (h *Handlers) PublicAddons(c *fiber.Ctx) error {
	list, err := h.DB.Addon.Query().
		Where(addon.Or(addon.SourceEQ(addon.SourceUI), addon.InConfig(true))).
		Order(ent.Asc(addon.FieldName)).All(c.UserContext())
	if err != nil {
		return err
	}
	out := make([]addons.Addon, 0, len(list))
	for _, a := range list {
		out = append(out, addons.Addon{
			Name: a.Name, Prefix: a.Prefix, Suffix: a.Suffix,
			Remark: a.Remark, RemarkUnlimited: a.RemarkUnlimited, Stubs: a.Stubs,
		})
	}
	if c.Query("format") == "yaml" {
		b, err := addons.Marshal(out)
		if err != nil {
			return err
		}
		c.Set(fiber.HeaderContentType, "application/yaml; charset=utf-8")
		return c.Send(b)
	}
	return c.JSON(addons.File{Addons: out})
}
