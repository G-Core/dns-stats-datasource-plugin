import { GCQuery, GCVariable, GCVariableQuery, GCGranularity } from "./types";

export const defaultQuery: Partial<GCQuery> = {
  zone: "all",
  granularity: { value: GCGranularity.FiveMinutes, label: "5m" },
};

export const defaultVariableQuery: Partial<GCVariableQuery> = {
  selector: { value: GCVariable.Zone, label: "Zone" },
};
