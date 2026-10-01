package handlers

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"vpn-control/internal/audit"
	"vpn-control/internal/backup"
)

// maxBackupSize caps uploaded archives (also the app's body limit).
const maxBackupSize = 256 << 20

func (h *Handlers) BackupCategories(c *fiber.Ctx) error {
	counts, err := backup.Counts(c.UserContext(), h.SQL)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"categories": backup.Categories, "counts": counts})
}

// ExportBackup streams a zip of the categories in ?categories=a,b.
func (h *Handlers) ExportBackup(c *fiber.Ctx) error {
	cats := splitList(c.Query("categories"))
	var buf bytes.Buffer
	m, err := backup.Export(c.UserContext(), h.SQL, &buf, cats, h.Version)
	audit.Log(c.UserContext(), h.DB, "backup.export", "", 0, cats, err)
	if err != nil {
		return badRequest(err)
	}
	name := "vpn-control-backup-" + m.CreatedAt.Format("20060102-150405") + ".zip"
	c.Set(fiber.HeaderContentType, "application/zip")
	c.Set(fiber.HeaderContentDisposition, `attachment; filename="`+name+`"`)
	return c.Send(buf.Bytes())
}

// InspectBackup reads an uploaded archive's manifest so the UI can show
// what's inside before importing.
func (h *Handlers) InspectBackup(c *fiber.Ctx) error {
	a, err := uploadedBackup(c)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"manifest": a.Manifest, "available": a.Available()})
}

// ImportBackup replaces the selected categories with the archive's data.
// The current state of those categories is saved next to the database
// first, so a wrong file can be rolled back.
func (h *Handlers) ImportBackup(c *fiber.Ctx) error {
	a, err := uploadedBackup(c)
	if err != nil {
		return err
	}
	cats := splitList(c.FormValue("categories"))
	if err := backup.Validate(cats); err != nil {
		return badRequest(err)
	}
	ctx := c.UserContext()

	snapshot, err := h.snapshot(c, cats)
	if err != nil {
		return badRequest(fmt.Errorf("не удалось сохранить текущие данные перед импортом: %w", err))
	}
	rep, err := backup.Import(ctx, h.SQL, a, cats)
	audit.Log(ctx, h.DB, "backup.import", "", 0, fiber.Map{
		"categories": cats, "from": a.Manifest.CreatedAt, "app_version": a.Manifest.AppVersion, "snapshot": snapshot,
	}, err)
	if err != nil {
		var ie *backup.IntegrityError
		if errors.As(err, &ie) {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return badRequest(err)
	}
	return c.JSON(fiber.Map{"report": rep, "snapshot": filepath.Base(snapshot)})
}

func (h *Handlers) snapshot(c *fiber.Ctx, cats []string) (string, error) {
	dir := filepath.Join(filepath.Dir(h.Config.DBPath), "backups")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "pre-import-"+time.Now().Format("20060102-150405")+".zip")
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	_, err = backup.Export(c.UserContext(), h.SQL, f, cats, h.Version)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(path)
		return "", err
	}
	slog.Info("pre-import snapshot saved", "path", path)
	return path, nil
}

func uploadedBackup(c *fiber.Ctx) (*backup.Archive, error) {
	fh, err := c.FormFile("file")
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "файл не передан")
	}
	if fh.Size > maxBackupSize {
		return nil, fiber.NewError(fiber.StatusRequestEntityTooLarge, "файл слишком большой")
	}
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	a, err := backup.Open(data)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return a, nil
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
