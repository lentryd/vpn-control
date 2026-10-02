package apperr

import (
	"errors"
	"net/http"
	"testing"
)

func TestError(t *testing.T) {
	e := New("expense.no_node", "item {{name}} has no node", "name", "CDN")
	if e.Error() != "item CDN has no node" || e.Status != http.StatusBadRequest || e.Params["name"] != "CDN" {
		t.Errorf("New = %+v", e)
	}
	base := Status(http.StatusConflict, "x", "conflict")
	w := Wrap(base, "y", "context: {{error}}")
	if w.Error() != "context: conflict" || w.Status != http.StatusConflict || !errors.Is(w, base) {
		t.Errorf("Wrap = %+v", w)
	}
}
