import {
  DataSourceInstanceSettings,
  MetricFindValue,
} from "@grafana/data";
import { DataSourceWithBackend, getBackendSrv } from "@grafana/runtime";
import {
  GCDataSourceOptions,
  GCQuery,
  GCVariable,
  GCVariableQuery,
  GCDNSRecordType,
  ZoneResponse,
  ZonesApiResponse,
} from "./types";
import { getValueVariable } from "./utils";

export class DataSource extends DataSourceWithBackend<GCQuery, GCDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<GCDataSourceOptions>) {
    super(instanceSettings);
  }

  async metricFindQuery(query: GCVariableQuery): Promise<MetricFindValue[]> {
    query.selector = query.selector || { value: GCVariable.Zone };

    switch (query.selector.value) {
      case GCVariable.Zone: {
        try {
          const zones = await this.getAllZones();
          return getValueVariable(zones.map((z) => z.name));
        } catch (error) {
          console.error('Failed to fetch zones:', error);
          return [];
        }
      }
      case GCVariable.RecordType: {
        return getValueVariable(Object.values(GCDNSRecordType));
      }
      default:
        return [];
    }
  }

  private async getAllZones(): Promise<ZoneResponse[]> {
    const limit = 1000;
    const fetchZones = async (offset = 0) => {
      try {
        const response = await getBackendSrv().fetch<ZonesApiResponse>({
          method: "GET",
          url: `api/datasources/proxy/uid/${this.uid}/zones`,
          params: { limit, offset },
        }).toPromise();

        if (!response || !response.data) {
          throw new Error("Failed to fetch zones - no response data");
        }
        return response.data;
      } catch (error) {
        console.error('Error fetching zones at offset', offset, error);
        throw error;
      }
    };

    try {
      const first = await fetchZones(0);
      const { total_amount, zones } = first;

      if (!zones || zones.length === 0) {
        console.warn('No zones found');
        return [];
      }

      if (total_amount <= limit) {
        return zones;
      }

      const rest = await Promise.all(
        Array.from({ length: Math.ceil(total_amount / limit) - 1 }, (_, i) =>
          fetchZones((i + 1) * limit)
        )
      );

      return rest.reduce((acc, cur) => acc.concat(cur.zones || []), zones);
    } catch (error) {
      console.error('Failed to fetch all zones:', error);
      return [];
    }
  }

  filterQuery(query: GCQuery): boolean {

    const isValid = !query.hide && !!query.zone && query.zone !== '';

    if (!isValid) {
      console.debug('Query filtered out:', query);
    }

    return isValid;
  }


  applyTemplateVariables(query: GCQuery, scopedVars: any): GCQuery {
    const interpolated = super.applyTemplateVariables(query, scopedVars);


    if (!interpolated.zone) {
      console.warn('Query missing zone after variable interpolation:', interpolated);
    }

    return interpolated;
  }
}