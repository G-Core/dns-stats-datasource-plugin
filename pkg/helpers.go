package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func buildQueryModel(query backend.DataQuery) (*QueryModel, error) {
	var qm QueryModel
	if err := json.Unmarshal(query.JSON, &qm); err != nil {
		return nil, fmt.Errorf("failed to parse query JSON: %w", err)
	}
	return &qm, nil
}

func granularityToSeconds(granularity string) int {
	switch granularity {
	case "5m":
		return 300
	case "10m":
		return 600
	case "30m":
		return 1800
	case "1h":
		return 3600
	case "1.5h":
		return 5400
	case "2h45m":
		return 9900
	case "24h":
		return 86400
	default:
		return 3600
	}
}

func parseStrings(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}
