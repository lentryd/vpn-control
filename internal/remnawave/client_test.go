package remnawave

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientHeadersAndEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("auth header = %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("X-Forwarded-For") == "" || r.Header.Get("X-Forwarded-Proto") != "https" {
			t.Error("missing proxy headers")
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/users/7":
			_, _ = w.Write([]byte(`{"response":{"id":7,"username":"vasya","status":"ACTIVE","expireAt":"2026-11-01T00:00:00.000Z","userTraffic":{"usedTrafficBytes":42,"onlineAt":null}}}`))
		case r.Method == http.MethodPatch && r.URL.Path == "/api/users":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["id"].(float64) != 7 || body["status"] != "ACTIVE" {
				t.Errorf("patch body = %v", body)
			}
			if _, ok := body["trafficLimitBytes"]; ok {
				t.Error("unset fields must be omitted")
			}
			_, _ = w.Write([]byte(`{"response":{"id":7,"username":"vasya","status":"ACTIVE","expireAt":"2026-12-01T00:00:00.000Z"}}`))
		case r.URL.Path == "/api/users/by-username/nope":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"User not found","errorCode":"A062"}`))
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
	}))
	defer srv.Close()

	c := NewClient(srv.URL, "tok", "")
	ctx := context.Background()

	u, err := c.GetUser(ctx, 7)
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "vasya" || u.UserTraffic.UsedTrafficBytes != 42 {
		t.Errorf("user = %+v", u)
	}

	to := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	u, err = c.UpdateUser(ctx, UpdateUserRequest{ID: 7, ExpireAt: &to, Status: StatusActive})
	if err != nil {
		t.Fatal(err)
	}
	if !u.ExpireAt.Equal(to) {
		t.Errorf("expireAt = %v", u.ExpireAt)
	}

	_, err = c.GetUserByUsername(ctx, "nope")
	if !IsNotFound(err) {
		t.Errorf("want not found, got %v", err)
	}
}
