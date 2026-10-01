package remnawave

import (
	"strings"
	"testing"
)

func TestParseIECBytes(t *testing.T) {
	cases := map[string]float64{"0": 0, "512 B": 512, "1.5 KiB": 1536, "2 GiB": 2 << 30, "1,25 MiB": 1.25 * (1 << 20)}
	for in, want := range cases {
		got, err := ParseIECBytes(in)
		if err != nil || got != want {
			t.Errorf("ParseIECBytes(%q) = %v, %v; want %v", in, got, err, want)
		}
	}
	if _, err := ParseIECBytes("lots"); err == nil {
		t.Error("want error")
	}
}

func TestParsePrometheus(t *testing.T) {
	src := `# HELP remnawave_node_inbound_upload_bytes Inbound upload bytes
# TYPE remnawave_node_inbound_upload_bytes counter
remnawave_node_inbound_upload_bytes{node_uuid="n1",tag="CDN_WS"} 1000
remnawave_node_inbound_download_bytes{tag="CDN_WS",node_uuid="n1"} 5000
remnawave_node_inbound_upload_bytes{node_uuid="n1",tag="REALITY"} 7
remnawave_node_outbound_upload_bytes{node_uuid="n1",tag="DIRECT"} 99999
remnawave_node_online_users{node_uuid="n1"} 3
`
	got, err := parsePrometheus(strings.NewReader(src))
	if err != nil {
		t.Fatal(err)
	}
	if got[InboundKey{"n1", "CDN_WS"}] != 6000 || got[InboundKey{"n1", "REALITY"}] != 7 || len(got) != 2 {
		t.Errorf("got %v", got)
	}
}
