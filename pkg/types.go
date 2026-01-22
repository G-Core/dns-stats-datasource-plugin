package main

type SelectableValue struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type QueryModel struct {
	Zone         string            `json:"zone"`
	RecordType   string            `json:"record_type"`
	Granularity  SelectableValue   `json:"granularity"`
	LegendFormat string            `json:"legendFormat,omitempty"`
	Grouping     []SelectableValue `json:"grouping,omitempty"`
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
