import defaults from "lodash/defaults";
import { LegacyForms } from "@grafana/ui";
import { DataSource } from "../datasource";
import React, { PureComponent, ChangeEvent } from "react";
import { QueryEditorProps, SelectableValue } from "@grafana/data";

import { GCSelectGranularity } from "./GCSelectGranularity";
import { GCSelectRecordType } from "./GCSelectRecordType";
import { GCSelectZone } from "./GCSelectZone";
import { GCInput } from "./GCInput";
import { defaultQuery } from "../defaults";
import { createOptionForZone } from "../zonenames";

import { GCDataSourceOptions, GCGranularity, GCQuery, GCDNSRecordType, GCZoneName } from "../types";

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, GCQuery, GCDataSourceOptions>;

export class GCQueryEditor extends PureComponent<Props> {
  onZoneChange = (value: SelectableValue<GCZoneName>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, zone: value?.value });
    onRunQuery();
  };

  onGranularityChange = (value: SelectableValue<GCGranularity>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, granularity: value });
    onRunQuery();
  };

  onRecordTypeChange = (value: SelectableValue<GCDNSRecordType>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, record_type: value?.value });
    onRunQuery();
  };

  onLegendFormatChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, legendFormat: event.target.value });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { zone, granularity, record_type, legendFormat } = query;

    const selectedGranularity =
      granularity?.value && Object.values(GCGranularity).includes(granularity.value as GCGranularity)
        ? (granularity as SelectableValue<GCGranularity>)
        : undefined;

    const selectedZone = zone ? createOptionForZone(zone as GCZoneName) : undefined;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: "500px",
        }}
      >
        <label
          className="gf-form-group-label"
          style={{ marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}
        >
          Test Zones
        </label>

        <FormField
          label="Zone"
          labelWidth={10}
          inputEl={
            <GCSelectZone
              width={25}
              isSearchable
              maxVisibleValues={20}
              minMenuHeight={30}
              menuPlacement="bottom"
              onChange={this.onZoneChange}
              value={selectedZone}
            />
          }
          style={{ width: "100%" }}
        />

        <FormField
          label="Granularity"
          labelWidth={10}
          tooltip="Time series granularity"
          inputEl={
            <GCSelectGranularity
              width={25}
              maxVisibleValues={20}
              minMenuHeight={30}
              menuPlacement="bottom"
              onChange={this.onGranularityChange}
              value={selectedGranularity}
            />
          }
          style={{ width: "100%" }}
        />

        <FormField
          label="Record"
          labelWidth={10}
          tooltip="Select DNS record"
          inputEl={
            <GCSelectRecordType
              width={25}
              isSearchable
              maxVisibleValues={20}
              minMenuHeight={30}
              menuPlacement="bottom"
              onChange={this.onRecordTypeChange}
              value={record_type ? { value: record_type, label: record_type } : undefined}
            />
          }
          style={{ width: "100%" }}
        />

        <GCInput
          inputWidth={30}
          value={legendFormat}
          onChange={this.onLegendFormatChange}
          label="Legend"
          placeholder="legend format"
          tooltip="Controls the name of the time series. Use placeholders like {{zone}} or {{record_type}}."
          type="text"
        />
      </div>
    );
  }
}
