package importer

import (
	"vpn-control/ent/expense"

	"regexp"
	"strings"
)

var refRe = regexp.MustCompile(`^(.*?)\s*\(\s*от\s+(.+?)\s*\)\s*$`)

// splitName parses "Имя (от Кого)" into the name and the raw referrer.
func splitName(raw string) (name, ref string) {
	raw = strings.TrimSpace(raw)
	if m := refRe.FindStringSubmatch(raw); m != nil {
		return strings.TrimSpace(m[1]), strings.TrimSpace(m[2])
	}
	return raw, ""
}

// isSelf reports whether a referrer means "the owner" ("от меня").
func isSelf(ref string) bool {
	switch normalize(ref) {
	case "меня", "я", "мной":
		return true
	}
	return false
}

// normalize lowercases, drops dots and collapses spaces: "Лиза  Г." → "лиза г".
func normalize(s string) string {
	s = strings.ToLower(strings.ReplaceAll(s, ".", " "))
	s = strings.ReplaceAll(s, "ё", "е")
	return strings.Join(strings.Fields(s), " ")
}

// nominatives guesses the nominative forms of a (genitive) Russian first
// name: "Димы" → "дима", "Саши" → "саша", "Антона" → "антон".
func nominatives(word string) []string {
	w := normalize(word)
	out := []string{w}
	r := []rune(w)
	if len(r) < 3 {
		return out
	}
	stem := string(r[:len(r)-1])
	switch r[len(r)-1] {
	case 'ы':
		out = append(out, stem+"а")
	case 'и':
		out = append(out, stem+"а", stem+"я")
	case 'а':
		out = append(out, stem)
	case 'я':
		out = append(out, stem+"й", stem+"ь")
	}
	return out
}

// referrerCandidates are normalized full names "от X" may refer to.
func referrerCandidates(ref string) []string {
	parts := strings.Fields(normalize(ref))
	if len(parts) == 0 {
		return nil
	}
	rest := strings.Join(parts[1:], " ")
	var out []string
	for _, n := range nominatives(parts[0]) {
		if rest != "" {
			out = append(out, n+" "+rest)
		} else {
			out = append(out, n)
		}
	}
	return out
}

// diminutives maps full Russian first names to the short forms people are
// usually listed under, for suggesting payer → customer matches.
var diminutives = map[string][]string{
	"михаил":     {"миша"},
	"максим":     {"макс"},
	"екатерина":  {"катя"},
	"мария":      {"маша"},
	"юлия":       {"юля"},
	"анна":       {"аня"},
	"ання":       {"аня"},
	"александр":  {"саша", "александр"},
	"александра": {"саша"},
	"дмитрий":    {"дима"},
	"елизавета":  {"лиза"},
	"татьяна":    {"таня"},
	"анастасия":  {"настя", "анастасия"},
	"владислав":  {"влад"},
	"николай":    {"коля"},
	"алёна":      {"алена"},
	"алена":      {"алена"},
	"дарья":      {"даша"},
	"антон":      {"антон"},
	"юрий":       {"юра"},
	"борис":      {"боря", "борис"},
}

func expenseKind(k string) expense.Kind { return expense.Kind(k) }
