package importer

import (
	"slices"
	"testing"
)

func TestSplitName(t *testing.T) {
	cases := []struct{ raw, name, ref string }{
		{"Эвелина (от Димы)", "Эвелина", "Димы"},
		{"Алена (от Димы Н.)", "Алена", "Димы Н."},
		{"Родители Саши", "Родители Саши", ""},
		{"Лиза Г (от меня)", "Лиза Г", "меня"},
	}
	for _, c := range cases {
		n, r := splitName(c.raw)
		if n != c.name || r != c.ref {
			t.Errorf("splitName(%q) = %q, %q", c.raw, n, r)
		}
	}
}

func TestReferrerCandidates(t *testing.T) {
	cases := map[string]string{
		"Димы":    "дима",
		"Димы Н.": "дима н",
		"Саши":    "саша",
		"Антона":  "антон",
		"Лизы Г":  "лиза г",
		"Элизады": "элизада",
		"Дима Н.": "дима н",
	}
	for ref, want := range cases {
		if got := referrerCandidates(ref); !slices.Contains(got, want) {
			t.Errorf("referrerCandidates(%q) = %v, want %q among them", ref, got, want)
		}
	}
	if !isSelf("меня") || isSelf("Димы") {
		t.Error("isSelf")
	}
}

func TestCustomerNamesDisambiguates(t *testing.T) {
	rows := []customerRow{
		{raw: "Катя (от Димы)", name: "Катя"},
		{raw: "Катя (от Алины)", name: "Катя"},
		{raw: "Лиза (от меня)", name: "Лиза"},
	}
	got := customerNames(rows)
	want := []string{"Катя (от Димы)", "Катя (от Алины)", "Лиза"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v", got)
	}
}

func TestSuggest(t *testing.T) {
	byNorm := map[string][]string{
		"миша": {"Миша"}, "макс": {"Макс"}, "лиза г": {"Лиза Г"}, "лиза": {"Лиза"}, "юля": {"Юля"},
	}
	cases := map[string]string{"Михаил": "Миша", "Максим": "Макс", "Юля П.": "Юля", "Николай": ""}
	for payer, want := range cases {
		if got := suggest(payer, byNorm); got != want {
			t.Errorf("suggest(%q) = %q, want %q", payer, got, want)
		}
	}
}
