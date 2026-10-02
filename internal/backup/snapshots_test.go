package backup

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSnapshots(t *testing.T) {
	client, db := open(t)
	seed(t, client)
	ctx := context.Background()
	dir := t.TempDir()
	s := NewSnapshots(filepath.Join(dir, "db.sqlite"), db, "test")

	if list, err := s.List(); err != nil || len(list) != 0 {
		t.Fatalf("empty list = %v, %v", list, err)
	}
	var autos []string
	for range 3 {
		sn, err := s.Create(ctx, KindAuto, nil)
		if err != nil {
			t.Fatal(err)
		}
		autos = append(autos, sn.Name)
	}
	manual, err := s.Create(ctx, KindManual, []string{"customers"})
	if err != nil {
		t.Fatal(err)
	}
	if autos[0] == autos[1] {
		t.Fatal("snapshots in the same second must get distinct names")
	}

	list, err := s.List()
	if err != nil || len(list) != 4 {
		t.Fatalf("list = %v, %v", list, err)
	}
	p, err := s.Path(manual.Name)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(p)
	a, err := Open(data)
	if err != nil || len(a.Available()) != 1 {
		t.Fatalf("manual snapshot: %v, %v", a, err)
	}

	for _, bad := range []string{"../db.sqlite", "auto-1.zip", "x/../../etc/passwd", ".snapshot-123"} {
		if _, err := s.Path(bad); !errors.Is(err, ErrBadName) {
			t.Errorf("Path(%q) = %v, want ErrBadName", bad, err)
		}
	}

	// Pruning keeps the newest automatic ones and never touches manual ones.
	if err := s.Prune(1); err != nil {
		t.Fatal(err)
	}
	list, _ = s.List()
	kinds := map[string]int{}
	for _, sn := range list {
		kinds[sn.Kind]++
	}
	if kinds[KindAuto] != 1 || kinds[KindManual] != 1 {
		t.Errorf("after prune: %v", kinds)
	}
}
