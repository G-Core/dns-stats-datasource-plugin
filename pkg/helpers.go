package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
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

var durationRegex = regexp.MustCompile(`(?i)^(\d+(?:\.\d+)?)\s*(h|m|s|d)?$`)

// granularityToSeconds converts human-readable granularity (5m, 1h, 2h45m, etc.)
// to seconds. Supports all DNS-03 / DNS-Alert-02 test intervals.
func granularityToSeconds(granularity string) int {
	g := strings.TrimSpace(strings.ToLower(granularity))
	if g == "" {
		return 3600
	}

	// Known formats (exact match for consistency)
	switch g {
	case "5m":
		return 300
	case "10m":
		return 600
	case "15m":
		return 900
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
	}

	if sec, err := strconv.Atoi(g); err == nil && sec > 0 {
		return sec
	}

	if seconds := parseDurationString(g); seconds > 0 {
		return seconds
	}

	return 3600
}

// granularityToAPIFormat returns the value to send to Gcore DNS API.
// API accepts duration strings (e.g. "5m", "1h", "2h45m") per docs.
// Falls back to "Ns" (e.g. "300s") if format is non-standard.
func granularityToAPIFormat(granularity string) string {
	g := strings.TrimSpace(strings.ToLower(granularity))
	if g == "" {
		return "1h"
	}
	// Standard formats the API accepts directly
	switch g {
	case "5m", "10m", "15m", "30m", "1h", "1.5h", "2h45m", "24h":
		return g
	}
	// Integer seconds -> "Ns"
	if sec, err := strconv.Atoi(g); err == nil && sec > 0 {
		return strconv.Itoa(sec) + "s"
	}
	if sec := parseDurationString(g); sec > 0 {
		return strconv.Itoa(sec) + "s"
	}
	return "1h"
}

func parseDurationString(s string) int {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return 0
	}

	var totalSeconds int

	if idx := strings.Index(s, "h"); idx >= 0 {
		hoursStr := s[:idx]
		if h, err := strconv.ParseFloat(hoursStr, 64); err == nil {
			totalSeconds += int(h * 3600)
		}
		s = s[idx+1:]
	}

	if idx := strings.Index(s, "m"); idx >= 0 {
		minsStr := s[:idx]
		if m, err := strconv.ParseFloat(minsStr, 64); err == nil {
			totalSeconds += int(m * 60)
		}
	} else if len(s) > 0 && s != "m" {
		minsStr := strings.TrimSuffix(s, "m")
		if m, err := strconv.ParseFloat(minsStr, 64); err == nil {
			totalSeconds += int(m * 60)
		}
	}

	if totalSeconds > 0 {
		return totalSeconds
	}

	matches := durationRegex.FindStringSubmatch(s)
	if len(matches) == 3 {
		val, _ := strconv.ParseFloat(matches[1], 64)
		unit := matches[2]
		switch unit {
		case "h":
			return int(val * 3600)
		case "m":
			return int(val * 60)
		case "s":
			return int(val)
		case "d":
			return int(val * 86400)
		}
	}

	return 0
}
