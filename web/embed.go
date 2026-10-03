// Package web provides the embedded frontend build files.
//
// Run `bun run build` inside web/ before `go build` — it produces the
// dist/ directory embedded below.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var distFS embed.FS

// Dist is the dist/ directory as the root of the file system: the SPA
// files plus their precompressed .br/.gz copies.
var Dist = func() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	return sub
}()
