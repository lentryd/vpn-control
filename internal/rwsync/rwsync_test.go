package rwsync

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestMainUsername(t *testing.T) {
	cases := []struct {
		user, prefix, suffix, want string
		ok                         bool
	}{
		{"white_vasya", "white_", "", "vasya", true},
		{"vasya_lte", "", "_lte", "vasya", true},
		{"vasya", "white_", "", "", false},
		{"white_", "white_", "", "", false},
		{"vasya", "", "", "", false},
	}
	for _, c := range cases {
		got, ok := MainUsername(c.user, c.prefix, c.suffix)
		if got != c.want || ok != c.ok {
			t.Errorf("MainUsername(%q,%q,%q) = %q,%v", c.user, c.prefix, c.suffix, got, ok)
		}
	}
}

func TestVerifySignature(t *testing.T) {
	body := []byte(`{"event":"user.modified"}`)
	mac := hmac.New(sha256.New, []byte("secret"))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))
	if !VerifySignature("secret", body, sig) {
		t.Error("valid signature rejected")
	}
	if VerifySignature("other", body, sig) {
		t.Error("wrong secret accepted")
	}
}
