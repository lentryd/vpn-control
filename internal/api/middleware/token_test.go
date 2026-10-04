package middleware

import "testing"

func TestScopes(t *testing.T) {
	cases := []struct {
		scopes []string
		key    string
		want   bool
	}{
		{[]string{"*"}, "backups:create", true},
		{[]string{"backups:*"}, "backups:create", true},
		{[]string{"backups:read"}, "backups:download", true},
		{[]string{"backups:read"}, "backups:create", false},
		{[]string{"backups:write"}, "backups:create", true},
		{[]string{"addons:read"}, "addons:list", true}, // tokens made before endpoint keys
		{[]string{"backups:list"}, "backups:download", false},
		{[]string{"addons:*"}, "backups:list", false},
		{[]string{"customers:read"}, "customers:pay", false},
		{[]string{"customers:write"}, "customers:pay", true},
	}
	for _, c := range cases {
		if got := Allowed(c.scopes, c.key); got != c.want {
			t.Errorf("Allowed(%v, %s) = %v", c.scopes, c.key, got)
		}
	}
	for s, want := range map[string]bool{"*": true, "backups:write": true, "addons:list": true, "nodes:read": false, "backups:delete": false, "backups": false} {
		if ValidScope(s) != want {
			t.Errorf("ValidScope(%q) != %v", s, want)
		}
	}
}
