package middleware

import "testing"

func TestScopes(t *testing.T) {
	cases := []struct {
		scopes []string
		key    string
		want   bool
	}{
		{[]string{"*"}, ScopeBackupsCreate, true},
		{[]string{"backups:*"}, ScopeBackupsCreate, true},
		{[]string{"backups:read"}, ScopeBackupsDownload, true},
		{[]string{"backups:read"}, ScopeBackupsCreate, false},
		{[]string{"backups:write"}, ScopeBackupsCreate, true},
		{[]string{"addons:read"}, ScopeAddonsList, true}, // tokens made before endpoint keys
		{[]string{ScopeBackupsList}, ScopeBackupsDownload, false},
		{[]string{"addons:*"}, ScopeBackupsList, false},
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
