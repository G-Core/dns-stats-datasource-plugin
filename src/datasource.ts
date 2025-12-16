import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  Field,
  Labels,
  LoadingState,
  toDataFrame,
  MetricFindValue,
} from "@grafana/data";
import { defaults } from "lodash";
import { getBackendSrv } from "@grafana/runtime";
import {
  GCDataSourceOptions,
  GCQuery,
  GCResponseStats,
  GCVariable,
  GCVariableQuery,
  GCDNSRecordType,
  GCPoint,
  ZoneResponse,
  GCGranularity,
  ZonesApiResponse,
} from "./types";
import { createLabelInfo, getEmptyDataFrame, getTimeField, getValueField, getValueVariable } from "./utils";
import { getUnit } from "./unit";
import { getSecondsByGranularity } from "./granularity";
import { defaultQuery, defaultVariableQuery } from "./defaults";

export class DataSource extends DataSourceApi<GCQuery, GCDataSourceOptions> {
  url?: string;
  // ← store instanceSettings so it's available on 'this'
  private instanceSettings: DataSourceInstanceSettings<GCDataSourceOptions>;

  constructor(instanceSettings: DataSourceInstanceSettings<GCDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url;
    this.instanceSettings = instanceSettings;
  }

  async metricFindQuery(query: GCVariableQuery): Promise<MetricFindValue[]> {
    query.selector = query.selector || defaultVariableQuery.selector!;

    switch (query.selector.value) {
      case GCVariable.Zone: {
        const zones = await this.getAllZones();
        return getValueVariable(zones.map((z) => z.name));
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
    const fetchZones = (offset = 0) =>
      getBackendSrv().datasourceRequest<ZonesApiResponse>({
        method: "GET",
        url: `${this.url}/zones`,
        responseType: "json",
        params: { limit, offset },
      });

    const first = await fetchZones(0);
    const { total_amount, zones } = first.data;

    if (total_amount <= limit) return zones;

    const rest = await Promise.all(
      Array.from({ length: Math.ceil(total_amount / limit) - 1 }, (_, i) =>
        fetchZones((i + 1) * limit)
      )
    );

    return rest.reduce((acc, cur) => acc.concat(cur.data.zones), zones);
  }

  private prepareTargets(targets: GCQuery[]): GCQuery[] {
    if (!targets || targets.length === 0) {
      return [defaults({}, defaultQuery)] as GCQuery[];
    }
    return targets.map((q) => defaults(q, defaultQuery));
  }

  private async transform(
    data: GCResponseStats[],
    options: DataQueryRequest<GCQuery>,
    query: GCQuery
  ): Promise<DataFrame> {
    if (!data || data.length === 0) return getEmptyDataFrame();

    const fields: Field[] = [];
    const firstRow = data[0];
    const [unit, transformFn] = getUnit(query, data);

    const bucketSizeMs =
      query.granularity?.value !== undefined
        ? getSecondsByGranularity(query.granularity.value as unknown as GCGranularity) *
          1000
        : 5 * 60 * 1000;

    const normalizeTs = (ts: number) => (ts > 1e12 ? ts : ts * 1000);

    const rawPoints: GCPoint[] = firstRow.requests
      ? Object.entries(firstRow.requests).map(
          ([ts, v]) => [normalizeTs(Number(ts)), Number(v)] as GCPoint
        )
      : [];

    const bucketMap = new Map<number, number>();
    rawPoints.forEach(([ts, value]) => {
      const bucket = Math.floor(ts / bucketSizeMs) * bucketSizeMs;
      bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + value);
    });

    const bucketedData: GCPoint[] = Array.from(bucketMap.entries()).sort(
      (a, b) => a[0] - b[0]
    );
    fields.push(getTimeField(bucketedData, true));

    for (const row of data) {
      const rawLabels: Labels = {
        zone: query.zone ?? "",
        record_type: query.record_type ?? "",
      };

      const metricsData: Map<number, number> = row.requests
        ? Object.entries(row.requests).reduce((acc, [ts, v]) => {
            const normalized = normalizeTs(Number(ts));
            const bucket = Math.floor(normalized / bucketSizeMs) * bucketSizeMs;
            acc.set(bucket, (acc.get(bucket) || 0) + Number(v));
            return acc;
          }, new Map<number, number>())
        : new Map();

      const finalData: GCPoint[] = Array.from(metricsData.entries()).sort(
        (a, b) => a[0] - b[0]
      );
      const { name, labels } = createLabelInfo(
        rawLabels,
        query,
        options.scopedVars
      );

      fields.push(
        getValueField({
          unit,
          labels,
          transform: transformFn,
          decimals: 2,
          data: finalData,
          displayNameFromDS: name,
        })
      );
    }

    return toDataFrame({ fields, refId: query.refId });
  }

  async query(
    options: DataQueryRequest<GCQuery>
  ): Promise<DataQueryResponse> {
    const targets = this.prepareTargets(
      options.targets.filter((t) => !t.hide)
    );

    const frames = await Promise.all(
      targets.map(async (query) => {
        const resp = await this.doRequest(options, query);
        const data: GCResponseStats[] = resp.data ? [resp.data] : [];
        return this.transform(data, options, query);
      })
    );

    return {
      data: frames,
      key: options.requestId,
      state: LoadingState.Done,
    };
  }

  private async doRequest(
    options: DataQueryRequest<GCQuery>,
    query: GCQuery
  ): Promise<{ data: GCResponseStats }> {
    if (!query.zone) throw new Error("Zone is required");

    const { range } = options;
    const zoneName = query.zone === "all" ? "all" : query.zone;

    const params: Record<string, any> = {
      from: Math.floor((range?.from.valueOf() ?? 0) / 1000),
      to: Math.floor((range?.to.valueOf() ?? 0) / 1000),
    };

    if (query.record_type && query.record_type !== GCDNSRecordType.All) {
      params.record_type = query.record_type;
    }

    if (query.granularity?.value !== undefined) {
      params.granularity = getSecondsByGranularity(
        query.granularity.value as unknown as GCGranularity
      );
    }

    return getBackendSrv().datasourceRequest({
      method: "GET",
      url: `${this.url}/zones/${zoneName}/statistics`,
      responseType: "json",
      params,
    });
  }

  // ✅ NEW TEST FUNCTION HERE
  async testDatasource(): Promise<{ status: string; message: string }> {
    const auth = async (path: string) =>
      getBackendSrv().datasourceRequest({
        method: "GET",
        url: `/api/datasources/proxy/uid/${this.instanceSettings.uid}/${path}`,
        responseType: "json",
        showErrorAlert: true,
      });

    try {
      const r1 = await auth("iam/users/me");
      return {
        status: "success",
        message: `Auth OK (IAM): ${(r1.data as { name?: string })?.name ?? "OK"}`,
      };
    } catch {
      try {
        const r2 = await auth("users/me");
        return {
          status: "success",
          message: `Auth OK: ${(r2.data as { name?: string })?.name ?? "OK"}`,
        };
      } catch (err: any) {
        const msg =
          err?.data?.message ||
          err?.statusText ||
          "Failed to authenticate. Check URL, API key, or network.";
        return { status: "error", message: msg };
      }
    }
  }
}
