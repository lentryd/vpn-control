package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// RwUser is a local cache of a Remnawave user, keyed by its panel id. It's
// refreshed by the sync worker, webhooks and after every mutation we make.
type RwUser struct {
	ent.Schema
}

func (RwUser) Fields() []ent.Field {
	return []ent.Field{
		field.Int("id").Immutable(),
		field.String("username"),
		field.String("short_uuid").Optional(),
		field.String("status").Optional(),
		field.Time("expire_at").Optional().Nillable(),
		field.Int64("used_traffic_bytes").Default(0),
		field.Int64("traffic_limit_bytes").Default(0),
		field.String("traffic_limit_strategy").Optional(),
		field.Int("hwid_device_limit").Optional().Nillable(),
		field.Time("online_at").Optional().Nillable(),
		field.String("description").Optional(),
		field.String("tag").Optional(),
		field.Int64("telegram_id").Optional().Nillable(),
		field.String("subscription_url").Optional(),
		field.Strings("squad_uuids").Optional(),
		field.Bool("deleted").Default(false),
		field.Time("synced_at").Default(time.Now),
	}
}

func (RwUser) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("subscription", Subscription.Type).Unique(),
		edge.To("subscription_addon", SubscriptionAddon.Type).Unique(),
	}
}
