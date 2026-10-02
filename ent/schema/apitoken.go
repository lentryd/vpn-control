package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

// APIToken lets other services call the public API (/api/v1). Only a hash
// of the token is stored; the token itself is shown once, on creation.
type APIToken struct {
	ent.Schema
}

func (APIToken) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(),
		field.String("token_hash").Unique().Sensitive(),
		// Prefix is the token's start, to tell tokens apart in the UI.
		field.String("prefix"),
		field.Strings("scopes"),
		field.Time("created_at").Immutable().Default(time.Now),
		field.Time("last_used_at").Optional().Nillable(),
	}
}
