package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// A time in a zone without a name (an offset other than the local one)
// must survive a write and a read.
func TestTimeRoundTripUnnamedZone(t *testing.T) {
	ctx := context.Background()
	db, _, err := OpenDB(ctx, filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()

	at := time.Date(2026, 10, 4, 0, 34, 37, 0, time.FixedZone("", 3*3600))
	c, err := db.Customer.Create().SetName("Test").SetCreatedAt(at).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	got, err := db.Customer.Get(ctx, c.ID)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if !got.CreatedAt.Equal(at) {
		t.Fatalf("created_at = %v, want %v", got.CreatedAt, at)
	}
}
