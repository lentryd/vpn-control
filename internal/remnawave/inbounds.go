package remnawave

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// InboundKey identifies one inbound of one node.
type InboundKey struct {
	NodeUUID string
	Tag      string
}

// InboundCounters are cumulative upload+download bytes per inbound since
// the panel backend started (they reset when it restarts).
type InboundCounters map[InboundKey]float64

// MetricsScraper reads the panel's Prometheus endpoint (METRICS_PORT,
// basic auth METRICS_USER/METRICS_PASS) for exact inbound counters.
type MetricsScraper struct {
	URL, User, Pass string
	http            *http.Client
}

func NewMetricsScraper(url, user, pass string) *MetricsScraper {
	return &MetricsScraper{URL: url, User: user, Pass: pass, http: &http.Client{Timeout: 20 * time.Second}}
}

const (
	metricInboundUp   = "remnawave_node_inbound_upload_bytes"
	metricInboundDown = "remnawave_node_inbound_download_bytes"
)

func (m *MetricsScraper) InboundCounters(ctx context.Context) (InboundCounters, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.URL, nil)
	if err != nil {
		return nil, err
	}
	if m.User != "" {
		req.SetBasicAuth(m.User, m.Pass)
	}
	resp, err := m.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("scrape metrics: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("scrape metrics: status %d", resp.StatusCode)
	}
	return parsePrometheus(resp.Body)
}

var labelRe = regexp.MustCompile(`(\w+)="((?:[^"\\]|\\.)*)"`)

// parsePrometheus sums upload+download inbound counters from the text
// exposition format.
func parsePrometheus(r io.Reader) (InboundCounters, error) {
	res := InboundCounters{}
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 1024*1024), 16*1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, metricInboundUp+"{") && !strings.HasPrefix(line, metricInboundDown+"{") {
			continue
		}
		open, close := strings.IndexByte(line, '{'), strings.LastIndexByte(line, '}')
		if open < 0 || close < open {
			continue
		}
		var key InboundKey
		for _, l := range labelRe.FindAllStringSubmatch(line[open+1:close], -1) {
			switch l[1] {
			case "node_uuid":
				key.NodeUUID = l[2]
			case "tag":
				key.Tag = l[2]
			}
		}
		fields := strings.Fields(line[close+1:])
		if len(fields) == 0 || key.NodeUUID == "" {
			continue
		}
		v, err := strconv.ParseFloat(fields[0], 64)
		if err != nil {
			continue
		}
		res[key] += v
	}
	return res, sc.Err()
}
