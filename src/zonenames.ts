import { SelectableValue } from "@grafana/data";

export const createZoneOptions = (): Array<SelectableValue<string>> => [
  { value: "all", label: "All Zones" },
];

export const createOptionForZone = (zone: string): SelectableValue<string> => ({
  value: zone,
  label: zone,
});
