package fx

import (
	"bytes"
	"testing"

	"golang.org/x/text/encoding/charmap"
)

func TestParse(t *testing.T) {
	src := `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="01.10.2026" name="Foreign Currency Market">
<Valute ID="R01239"><NumCode>978</NumCode><CharCode>EUR</CharCode><Nominal>1</Nominal><Name>Евро</Name><Value>93,5012</Value></Valute>
<Valute ID="R01375"><NumCode>156</NumCode><CharCode>CNY</CharCode><Nominal>10</Nominal><Name>Юань</Name><Value>112,3400</Value></Valute>
</ValCurs>`
	enc, err := charmap.Windows1251.NewEncoder().String(src)
	if err != nil {
		t.Fatal(err)
	}
	rates, err := parse(bytes.NewReader([]byte(enc)))
	if err != nil {
		t.Fatal(err)
	}
	if rates["EUR"] != 93.5012 {
		t.Errorf("EUR = %v", rates["EUR"])
	}
	if got := rates["CNY"]; got < 11.233 || got > 11.235 {
		t.Errorf("CNY per unit = %v, want 11.234", got)
	}
}
