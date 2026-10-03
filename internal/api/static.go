package api

import (
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// staticFile is an SPA file kept in memory with its precompressed copies
// (made by web/scripts/build.ts), so serving it costs no compression work.
type staticFile struct {
	data, br, gz []byte
	contentType  string
	etag         string
	cacheControl string
}

// staticHandler serves the SPA from fsys: brotli/gzip copies by
// Accept-Encoding, ETag revalidation, and a year of caching for the
// content-hashed files in assets/. Unknown paths get index.html (the
// router is hash-based, but old bookmarks may still point at a path),
// except under assets/, where a missing chunk is a real 404.
func staticHandler(fsys fs.FS, base string) (fiber.Handler, error) {
	files := map[string]*staticFile{}
	err := fs.WalkDir(fsys, ".", func(name string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || strings.HasSuffix(name, ".br") || strings.HasSuffix(name, ".gz") || path.Base(name) == ".gitkeep" {
			return err
		}
		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			return err
		}
		f := &staticFile{data: data, cacheControl: "no-cache"}
		f.br, _ = fs.ReadFile(fsys, name+".br")
		f.gz, _ = fs.ReadFile(fsys, name+".gz")
		// the system MIME table may not know .webmanifest
		if path.Ext(name) == ".webmanifest" {
			f.contentType = "application/manifest+json"
		} else if f.contentType = mime.TypeByExtension(path.Ext(name)); f.contentType == "" {
			f.contentType = http.DetectContentType(data)
		}
		sum := sha256.Sum256(data)
		f.etag = hex.EncodeToString(sum[:8])
		if strings.HasPrefix(name, "assets/") {
			f.cacheControl = "public, max-age=31536000, immutable"
		}
		files[name] = f
		return nil
	})
	if err != nil {
		return nil, err
	}

	return func(c *fiber.Ctx) error {
		if c.Method() != fiber.MethodGet && c.Method() != fiber.MethodHead {
			return c.Next()
		}
		name := strings.Trim(strings.TrimPrefix(c.Path(), base), "/")
		f := files[name]
		if f == nil {
			if strings.HasPrefix(name, "assets/") {
				return fiber.ErrNotFound
			}
			if f = files["index.html"]; f == nil {
				return fiber.ErrNotFound
			}
		}

		body, encoding := f.data, ""
		accept := c.Get(fiber.HeaderAcceptEncoding)
		switch {
		case f.br != nil && acceptsEncoding(accept, "br"):
			body, encoding = f.br, "br"
		case f.gz != nil && acceptsEncoding(accept, "gzip"):
			body, encoding = f.gz, "gzip"
		}
		// One ETag per representation: the compressed bodies differ.
		etag := `"` + f.etag + encoding + `"`

		c.Set(fiber.HeaderCacheControl, f.cacheControl)
		c.Set(fiber.HeaderETag, etag)
		if f.br != nil || f.gz != nil {
			c.Vary(fiber.HeaderAcceptEncoding)
		}
		if match := c.Get(fiber.HeaderIfNoneMatch); match != "" && (match == "*" || strings.Contains(match, etag)) {
			return c.SendStatus(fiber.StatusNotModified)
		}
		if encoding != "" {
			c.Set(fiber.HeaderContentEncoding, encoding)
		}
		c.Set(fiber.HeaderContentType, f.contentType)
		return c.Send(body)
	}, nil
}

// acceptsEncoding reports whether an Accept-Encoding header allows coding
// (not listed with q=0).
func acceptsEncoding(header, coding string) bool {
	for _, part := range strings.Split(header, ",") {
		name, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		if !strings.EqualFold(strings.TrimSpace(name), coding) {
			continue
		}
		q := strings.ReplaceAll(strings.TrimSpace(params), " ", "")
		return q != "q=0" && q != "q=0.0" && q != "q=0.00" && q != "q=0.000"
	}
	return false
}
