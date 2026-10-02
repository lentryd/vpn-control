package fx

import (
	"bytes"
	"math"
	"strings"
	"testing"
	"time"

	"golang.org/x/text/encoding/charmap"
)

func TestParseCBR(t *testing.T) {
	src := `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="01.10.2026" name="Foreign Currency Market">
<Valute ID="R01239"><NumCode>978</NumCode><CharCode>EUR</CharCode><Nominal>1</Nominal><Name>Евро</Name><Value>93,5012</Value></Valute>
<Valute ID="R01375"><NumCode>156</NumCode><CharCode>CNY</CharCode><Nominal>10</Nominal><Name>Юань</Name><Value>112,3400</Value></Valute>
</ValCurs>`
	enc, err := charmap.Windows1251.NewEncoder().String(src)
	if err != nil {
		t.Fatal(err)
	}
	rates, err := parseCBR(bytes.NewReader([]byte(enc)))
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

func TestParseECB(t *testing.T) {
	src := `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<Cube>
<Cube time="2026-10-02"><Cube currency="USD" rate="1.2000"/><Cube currency="GBP" rate="0.8000"/></Cube>
<Cube time="2026-10-01"><Cube currency="USD" rate="1.1000"/><Cube currency="GBP" rate="0.9000"/></Cube>
</Cube>
</gesmes:Envelope>`
	// Saturday: the latest day not after it is Friday the 2nd.
	perEUR, err := parseECB(strings.NewReader(src), time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if perEUR["USD"] != 1.2 {
		t.Errorf("USD per EUR = %v", perEUR["USD"])
	}
	usd, err := crossRates(perEUR, "USD")
	if err != nil {
		t.Fatal(err)
	}
	if usd["EUR"] != 1.2 || usd["USD"] != 1 || math.Abs(usd["GBP"]-1.5) > 1e-9 {
		t.Errorf("USD base = %v", usd)
	}
	if _, err := parseECB(strings.NewReader(src), time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)); err == nil {
		t.Error("want an error before the first published day")
	}
	if _, err := crossRates(perEUR, "RUB"); err == nil {
		t.Error("want an error for an unpublished base")
	}
}
