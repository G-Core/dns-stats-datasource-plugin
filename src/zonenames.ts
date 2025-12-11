import { SelectableValue } from "@grafana/data";
import { GCZoneName } from "./types";

// Config object for zones
interface GCZoneNameConfig {
  label: string;
}

const config: Record<GCZoneName, GCZoneNameConfig> = {
  [GCZoneName.TesttCom]: { label: "testt.com" },
  [GCZoneName.Test2Com]:{label:"test2.com"},
  [GCZoneName.All]: { label: "All" },
};


export const createZoneOptions = (): Array<SelectableValue<GCZoneName>> =>
  Object.entries(config).map(([value, { label }]) => ({
    value: value as GCZoneName,
    label,
  }));


export const createOptionForZone = (zone: GCZoneName): SelectableValue<GCZoneName> => ({
  value: zone,
  ...config[zone],
});
