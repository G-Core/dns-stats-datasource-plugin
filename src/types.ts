import { DataQuery, DataSourceJsonData, SelectableValue } from "@grafana/data";

export { SelectableValue };

export enum GCGranularity {
  FiveMinutes = "5m",
  TenMinutes = "10m",
  ThirtyMinutes = "30m",
  OneHour = "1h",
  NinetyMinutes = "1.5h",
  TwoHoursFortyFiveMinutes = "2h45m",
  OneDay = "24h",
}

export type GCGranularityType = GCGranularity | keyof typeof GCGranularity;

export enum GCVariable {
  Zone = "zone",
  RecordType = "record_type",
  Granularity = "granularity",
}

export enum GCDNSRecordType {
  All ="ALL",
  A = "A",
  AAAA = "AAAA",
  NS = "NS",
  CNAME = "CNAME",
  MX = "MX",
  TXT = "TXT",
  SVCB = "SVCB",
  HTTPS = "HTTPS",
}

export enum GCZoneName {
  TesttCom = "testt.com",
  Test2Com = "test2.com",
  All = "all",
}

export type GCZone = GCZoneName | string;

export interface GCZoneNameConfig {
  label: string;
}

export interface GCQuery extends DataQuery {
  granularity?: SelectableValue<GCGranularityType>;
  zone?: GCZone;
  record_type?: GCDNSRecordType;
  from?: number;
  to?: number;
  legendFormat?: string;
  grouping?: Array<SelectableValue<GCVariable>>;
}

export interface GCStatsRequestData {
  zone: GCZone;
  from: number;
  to: number;
  record_type?: GCDNSRecordType;
  granularity?: GCGranularityType;
}

export interface GCResponseStats {
  requests: Record<string, number>;
  total: number;
}

export type GCPoint = [number, number];

export interface GCDataSourceOptions extends DataSourceJsonData {
  apiUrl?: string;
  apiKey?: string;
}

export interface GCSecureJsonData {
  apiKey?: string;
}

export interface GCJsonData {
  apiUrl?: string;
}

export interface GCVariableQuery {
  selector?: SelectableValue<GCVariable>;
}

export interface Paginator<T> {
  count: number;
  results: T[];
}

export interface ZoneResponse {
  name: GCZone;
}

export enum GCUnit {
  Number = "count",
  Milliseconds = "ms",
}
