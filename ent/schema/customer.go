package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Customer is a person who pays: owns one or more subscriptions (Remnawave
// users) and may have been referred by another customer.
type Customer struct {
	ent.Schema
}

func (Customer) Mixin() []ent.Mixin { return []ent.Mixin{TimeMixin{}} }

func (Customer) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(),
		field.String("contact").Optional(),
		field.String("notes").Optional(),
		field.Int("referrer_id").Optional().Nillable(),
		// ReferralPercent overrides the global referral percent for payments
		// of customers this one referred; nil means "use the default".
		field.Float("referral_percent").Optional().Nillable(),
		field.Bool("archived").Default(false),
	}
}

func (Customer) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("referrals", Customer.Type).
			From("referrer").Field("referrer_id").Unique(),
		edge.To("subscriptions", Subscription.Type),
		edge.To("ledger_entries", LedgerEntry.Type),
		edge.To("payments", Payment.Type),
	}
}
