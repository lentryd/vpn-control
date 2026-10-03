package api

import (
	"io"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/gofiber/fiber/v2"
)

func TestStaticHandler(t *testing.T) {
	fsys := fstest.MapFS{
		"index.html":          {Data: []byte("<html>")},
		"assets/app-x1.js":    {Data: []byte("plain")},
		"assets/app-x1.js.br": {Data: []byte("brotli")},
		"assets/app-x1.js.gz": {Data: []byte("gzip")},
	}
	h, err := staticHandler(fsys, "/control")
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New()
	app.Group("/control").Use(h)

	tests := []struct {
		path, accept, ifNoneMatch string
		status                    int
		body, encoding, cache     string
	}{
		{path: "/control/assets/app-x1.js", accept: "gzip, deflate, br", status: 200, body: "brotli", encoding: "br", cache: "public, max-age=31536000, immutable"},
		{path: "/control/assets/app-x1.js", accept: "gzip, br;q=0", status: 200, body: "gzip", encoding: "gzip"},
		{path: "/control/assets/app-x1.js", status: 200, body: "plain"},
		{path: "/control/assets/app-x1.js", accept: "br", ifNoneMatch: `"5a8ea5e1d3d0d2d8br"`, status: 200, body: "brotli", encoding: "br"},
		{path: "/control/assets/missing.js", status: 404},
		{path: "/control/", status: 200, body: "<html>", cache: "no-cache"},
		{path: "/control/customers/1", status: 200, body: "<html>", cache: "no-cache"},
	}
	for _, tt := range tests {
		req := httptest.NewRequest("GET", tt.path, nil)
		if tt.accept != "" {
			req.Header.Set("Accept-Encoding", tt.accept)
		}
		if tt.ifNoneMatch != "" {
			req.Header.Set("If-None-Match", tt.ifNoneMatch)
		}
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(res.Body)
		if res.StatusCode != tt.status {
			t.Errorf("%s: status %d, want %d", tt.path, res.StatusCode, tt.status)
			continue
		}
		if tt.status != 200 {
			continue
		}
		if string(body) != tt.body || res.Header.Get("Content-Encoding") != tt.encoding {
			t.Errorf("%s (%q): body %q encoding %q, want %q %q", tt.path, tt.accept, body, res.Header.Get("Content-Encoding"), tt.body, tt.encoding)
		}
		if tt.cache != "" && res.Header.Get("Cache-Control") != tt.cache {
			t.Errorf("%s: Cache-Control %q, want %q", tt.path, res.Header.Get("Cache-Control"), tt.cache)
		}
	}

	// Revalidation with the ETag just served.
	req := httptest.NewRequest("GET", "/control/assets/app-x1.js", nil)
	req.Header.Set("Accept-Encoding", "br")
	res, _ := app.Test(req)
	req.Header.Set("If-None-Match", res.Header.Get("ETag"))
	if res, _ = app.Test(req); res.StatusCode != 304 {
		t.Errorf("revalidation: status %d, want 304", res.StatusCode)
	}
}
