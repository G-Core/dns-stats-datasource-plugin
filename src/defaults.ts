import { GCQuery, GCVariableQuery, GCGranularity, GCVariable, GCDNSRecordType } from "./types";
import { createOptionForGranularity } from "./granularity";
import { createOptionForRecordType } from "./recordtype"; 

export const defaultQuery: Partial<GCQuery> = {
  zone: "all",
  record_type: createOptionForRecordType(GCDNSRecordType.All).value,
  granularity: createOptionForGranularity(GCGranularity.OneHour),
};

export const defaultVariableQuery: Partial<GCVariableQuery> = {
  selector: { value: GCVariable.Zone, label: "Zone" },
};
