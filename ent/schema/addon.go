package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Addon is a kind of add-on (from subpage's addons.yml): an extra Remnawave
// user named prefix+<main username>+suffix appended to the main subscription.
type Addon struct {
	ent.Schema
}

func (Addon) Mixin() []ent.Mixin { return []ent.Mixin{TimeMixin{}} }

func (Addon) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").Unique(),
		field.String("prefix").Optional(),
		field.String("suffix").Optional(),
		// InConfig is false once the add-on disappears from addons.yml.
		field.Bool("in_config").Default(true),
	}
}

func (Addon) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("tariffs", Tariff.Type),
		edge.To("subscription_addons", SubscriptionAddon.Type),
	}
}
