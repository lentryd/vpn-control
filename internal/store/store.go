// Package store opens the SQLite database and runs Ent's auto-migration.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"modernc.org/sqlite"

	"vpn-control/ent"
)

func init() {
	// Ent's SQLite dialect expects the driver registered as "sqlite3"
	// (mattn's name); modernc registers itself as "sqlite".
	sql.Register("sqlite3", &sqlite.Driver{})
}

// Open opens (creating if needed) the SQLite file at path and migrates the
// schema. Additive auto-migration on every boot is fine at this scale.
func Open(ctx context.Context, path string) (*ent.Client, error) {
	client, _, err := OpenDB(ctx, path)
	return client, err
}

// OpenDB is Open that also returns the underlying connection pool, for
// table-level work Ent doesn't cover (backups).
func OpenDB(ctx context.Context, path string) (*ent.Client, *sql.DB, error) {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, nil, fmt.Errorf("create db dir: %w", err)
		}
	}

	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, nil, fmt.Errorf("open database: %w", err)
	}
	// SQLite allows one writer; a single connection avoids SQLITE_BUSY.
	db.SetMaxOpenConns(1)

	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.SQLite, db)))
	if err := client.Schema.Create(ctx); err != nil {
		_ = client.Close()
		return nil, nil, fmt.Errorf("run schema migration: %w", err)
	}
	return client, db, nil
}

// WithTx runs fn in a transaction, rolling back on error or panic.
func WithTx(ctx context.Context, client *ent.Client, fn func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()
	if err := fn(tx); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("%w: rolling back: %v", err, rerr)
		}
		return err
	}
	return tx.Commit()
}
