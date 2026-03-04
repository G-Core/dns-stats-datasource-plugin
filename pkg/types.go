package main

import (
	"encoding/json"
	"strconv"
)

type SelectableValue struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// QueryModel holds DNS query parameters. Uses custom UnmarshalJSON to be robust
// against mixed-datasource panels (BUG-02) where query JSON may contain extra
// fields like metric (object) from other datasources.
type QueryModel struct {
	Zone         string            `json:"zone"`
	RecordType   string            `json:"record_type"`
	Granularity  SelectableValue   `json:"granularity"`
	LegendFormat string            `json:"legendFormat,omitempty"`
	Grouping     []SelectableValue `json:"grouping,omitempty"`
}

// UnmarshalJSON extracts only our known fields and ignores all others (e.g. metric,
// refId, datasource). Fixes BUG-02: "json: cannot unmarshal object into Go struct
// field GCQueryModel.metric of type string" when multi-datasource panels send
// merged query JSON with object-typed metric from FastEdge/Prometheus.
func (qm *QueryModel) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	// Extract only our fields; ignore metric, refId, datasource, etc.
	if v, ok := raw["zone"]; ok {
		_ = json.Unmarshal(v, &qm.Zone)
	}
	if v, ok := raw["record_type"]; ok {
		_ = json.Unmarshal(v, &qm.RecordType)
	}
	if v, ok := raw["legendFormat"]; ok {
		_ = json.Unmarshal(v, &qm.LegendFormat)
	}
	if v, ok := raw["grouping"]; ok {
		_ = json.Unmarshal(v, &qm.Grouping)
	}
	if v, ok := raw["granularity"]; ok {
		extractGranularityFromJSON(v, qm)
	}
	return nil
}

func extractGranularityFromJSON(data json.RawMessage, qm *QueryModel) {
	var s string
	if json.Unmarshal(data, &s) == nil && s != "" {
		qm.Granularity.Value = s
		qm.Granularity.Label = s
		return
	}
	var obj map[string]interface{}
	if json.Unmarshal(data, &obj) != nil {
		return
	}
	if val, ok := obj["value"]; ok {
		switch v := val.(type) {
		case string:
			if v != "" {
				qm.Granularity.Value = v
				if l, ok := obj["label"].(string); ok && l != "" {
					qm.Granularity.Label = l
				} else {
					qm.Granularity.Label = v
				}
			}
		case float64:
			qm.Granularity.Value = strconv.Itoa(int(v))
			qm.Granularity.Label = qm.Granularity.Value
		}
	}
}

type StatsResponse struct {
	Requests map[string]float64 `json:"requests"`
	Total    float64            `json:"total"`
}

type IAMUser struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Zone struct {
	Name string `json:"name"`
	ID   int    `json:"id"`
}

type ZonesResponse struct {
	Zones       []Zone `json:"zones"`
	TotalAmount int    `json:"total_amount"`
}
