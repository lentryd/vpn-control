// Package web provides the embedded frontend build files.
//
// Run `bun run build` inside web/ before `go build` — it produces the
// dist/ directory embedded below.
package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:dist
var distFS embed.FS

// StaticFS is the dist/ directory rooted at "/", ready to hand to a static
// file server.
var StaticFS = func() http.FileSystem {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	return http.FS(sub)
}()
