package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type GCDataSource struct {
	URL    string
	APIKey string
	Client *http.Client
}

func NewDataSource(url, apiKey string) *GCDataSource {
	apiKey = strings.TrimSpace(apiKey)
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "https://" + url
	}
	url = strings.TrimSuffix(url, "/")

	return &GCDataSource{
		URL:    url,
		APIKey: apiKey,
		Client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (ds *GCDataSource) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if ds.APIKey != "" {
		if strings.HasPrefix(ds.APIKey, "APIKey ") || strings.HasPrefix(ds.APIKey, "Bearer ") {
			req.Header.Set("Authorization", ds.APIKey)
		} else {
			req.Header.Set("Authorization", "APIKey "+ds.APIKey)
		}
	}
}

func (ds *GCDataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		resp.Responses[q.RefID] = ds.query(ctx, q)
	}
	return resp, nil
}

func (ds *GCDataSource) query(ctx context.Context, query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}

	qm, err := buildQueryModel(query)
	if err != nil {
		response.Error = err
		return response
	}

	if qm.Zone == "" {
		response.Error = fmt.Errorf("zone is required")
		return response
	}

	stats, err := ds.fetchStats(ctx, qm, query.TimeRange)
	if err != nil {
		response.Error = err
		return response
	}

	response.Frames = ds.transformStatsToFrames(stats, qm)
	return response
}

func (ds *GCDataSource) fetchStats(ctx context.Context, qm *QueryModel, tr backend.TimeRange) (*StatsResponse, error) {
	zonesToFetch := []string{}

	if qm.Zone == "" || qm.Zone == "all" {

		allZones, err := ds.getAllZones(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch all zones: %w", err)
		}
		for _, z := range allZones {
			zonesToFetch = append(zonesToFetch, z.Name)
		}
	} else if strings.Contains(qm.Zone, ",") {

		parts := strings.Split(qm.Zone, ",")
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				zonesToFetch = append(zonesToFetch, trimmed)
			}
		}
	} else {

		zonesToFetch = append(zonesToFetch, qm.Zone)
	}

	if len(zonesToFetch) == 0 {
		log.DefaultLogger.Warn("No zones to fetch")
		return &StatsResponse{Requests: make(map[string]float64)}, nil
	}

	aggregatedRequests := make(map[string]float64)
	var aggregatedTotal float64
	var fetchErrors []string

	for _, zoneName := range zonesToFetch {
		log.DefaultLogger.Debug("Fetching stats for zone", "zone", zoneName)
		stats, err := ds.fetchZoneStats(ctx, zoneName, qm, tr)
		if err != nil {
			log.DefaultLogger.Warn("Failed to fetch stats for zone", "zone", zoneName, "error", err)
			fetchErrors = append(fetchErrors, fmt.Sprintf("%s: %v", zoneName, err))
			continue
		}
		if stats == nil {
			log.DefaultLogger.Debug("No stats returned for zone", "zone", zoneName)
			continue
		}

		aggregatedTotal += stats.Total
		for ts, val := range stats.Requests {
			aggregatedRequests[ts] += val
		}
	}

	if len(fetchErrors) > 0 && len(aggregatedRequests) == 0 {
		return nil, fmt.Errorf("failed to fetch stats for all zones: %s", strings.Join(fetchErrors, "; "))
	}

	log.DefaultLogger.Debug("Aggregated stats", "points", len(aggregatedRequests), "total", aggregatedTotal)

	return &StatsResponse{
		Requests: aggregatedRequests,
		Total:    aggregatedTotal,
	}, nil
}

func (ds *GCDataSource) fetchZoneStats(ctx context.Context, zoneName string, qm *QueryModel, tr backend.TimeRange) (*StatsResponse, error) {
	baseURL := strings.TrimSuffix(ds.URL, "/")

	if !strings.Contains(baseURL, "/dns") {
		baseURL += "/dns"
	}

	url := fmt.Sprintf("%s/v2/zones/%s/statistics", baseURL, zoneName)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	q := req.URL.Query()
	q.Add("from", strconv.FormatInt(tr.From.Unix(), 10))
	q.Add("to", strconv.FormatInt(tr.To.Unix(), 10))

	if qm.RecordType != "" && qm.RecordType != "ALL" {
		q.Add("record_type", qm.RecordType)
	}

	if qm.Granularity.Value != "" {
		granularitySeconds := granularityToSeconds(qm.Granularity.Value)
		q.Add("granularity", strconv.Itoa(granularitySeconds))
	}

	req.URL.RawQuery = q.Encode()
	ds.setHeaders(req)

	log.DefaultLogger.Debug("Fetching zone stats", "url", req.URL.String())

	resp, err := ds.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode == 404 {

		log.DefaultLogger.Warn("Zone not found", "zone", zoneName)
		return nil, nil
	}

	if err := handleAPIError(resp.StatusCode, raw); err != nil {
		return nil, err
	}

	var stats StatsResponse
	if err := json.Unmarshal(raw, &stats); err != nil {
		return nil, fmt.Errorf("failed to decode stats for zone %s: %w (body: %s)", zoneName, err, string(raw))
	}

	log.DefaultLogger.Debug("Fetched zone stats", "zone", zoneName, "points", len(stats.Requests))

	return &stats, nil
}

func (ds *GCDataSource) getAllZones(ctx context.Context) ([]Zone, error) {
	baseURL := strings.TrimSuffix(ds.URL, "/")
	if !strings.Contains(baseURL, "/dns") {
		baseURL += "/dns"
	}

	var allZones []Zone
	limit := 1000
	offset := 0

	for {
		url := fmt.Sprintf("%s/v2/zones?limit=%d&offset=%d", baseURL, limit, offset)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		ds.setHeaders(req)

		resp, err := ds.Client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		raw, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		if err := handleAPIError(resp.StatusCode, raw); err != nil {
			return nil, err
		}

		var zonesResp ZonesResponse
		if err := json.Unmarshal(raw, &zonesResp); err != nil {
			return nil, fmt.Errorf("failed to parse zones response: %w", err)
		}

		allZones = append(allZones, zonesResp.Zones...)

		if len(zonesResp.Zones) < limit {
			break
		}
		offset += limit
		if offset >= zonesResp.TotalAmount && zonesResp.TotalAmount > 0 {
			break
		}
	}

	log.DefaultLogger.Debug("Fetched all zones", "count", len(allZones))
	return allZones, nil
}

func handleAPIError(statusCode int, body []byte) error {
	if statusCode == 200 {
		return nil
	}

	errorMsg := strings.TrimSpace(string(body))
	if errorMsg == "" {
		errorMsg = "unknown error"
	}

	switch statusCode {
	case 400:
		return fmt.Errorf("bad request (400): %s", errorMsg)
	case 401:
		return fmt.Errorf("datasource authentication error: invalid API key. Please verify your credentials in the datasource settings. Details: %s", errorMsg)
	case 403:
		return fmt.Errorf("forbidden (403): access denied. You may not have permissions to access this resource")
	case 404:
		return fmt.Errorf("not found (404): resource not found. Check if the URL/Zone exists")
	case 429:
		return fmt.Errorf("too many requests (429): rate limit exceeded. Please reduce query frequency")
	}

	if statusCode >= 500 {
		return fmt.Errorf("server error (%d): %s. This is an issue with the Gcore API", statusCode, errorMsg)
	}

	return fmt.Errorf("Gcore API error (status %d): %s", statusCode, errorMsg)
}

func (ds *GCDataSource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	rootURL := strings.TrimSuffix(ds.URL, "/dns")
	reqHTTP, err := http.NewRequestWithContext(ctx, http.MethodGet, rootURL+"/iam/users/me", nil)
	if err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}

	ds.setHeaders(reqHTTP)
	resp, err := ds.Client.Do(reqHTTP)
	if err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}

	if err := handleAPIError(resp.StatusCode, raw); err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}

	var user IAMUser
	if err := json.Unmarshal(raw, &user); err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}

	name := user.Email
	if user.Name != "" {
		name = user.Name
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Authentication successful. User: " + name,
	}, nil
}

func (ds *GCDataSource) transformStatsToFrames(stats *StatsResponse, qm *QueryModel) []*data.Frame {

	frame := data.NewFrame("Statistics",
		data.NewField("time", nil, []time.Time{}),
		data.NewField("value", nil, []float64{}),
	)

	displayName := "Requests"
	if qm.LegendFormat != "" {
		displayName = qm.LegendFormat
	} else {
		details := []string{}
		if qm.Zone != "" && qm.Zone != "all" {
			details = append(details, qm.Zone)
		} else if qm.Zone == "all" {
			details = append(details, "All Zones")
		}
		if qm.RecordType != "" && qm.RecordType != "ALL" {
			details = append(details, qm.RecordType)
		}
		if len(details) > 0 {
			displayName = fmt.Sprintf("Requests (%s)", strings.Join(details, ", "))
		}
	}

	frame.Fields[1].SetConfig(&data.FieldConfig{
		DisplayName: displayName,
		Unit:        "short",
	})

	if stats == nil || len(stats.Requests) == 0 {
		log.DefaultLogger.Debug("No stats data to transform")
		return []*data.Frame{frame}
	}

	keys := make([]string, 0, len(stats.Requests))
	for k := range stats.Requests {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		ts, err := strconv.ParseInt(k, 10, 64)
		if err != nil {
			log.DefaultLogger.Warn("Failed to parse timestamp", "timestamp", k, "error", err)
			continue
		}

		if ts > 10000000000 {
			ts = ts / 1000
		}
		frame.AppendRow(time.Unix(ts, 0), stats.Requests[k])
	}

	log.DefaultLogger.Debug("Transformed stats to frame", "rows", frame.Rows())

	return []*data.Frame{frame}
}
