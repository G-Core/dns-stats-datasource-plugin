import defaults from "lodash/defaults";
import { LegacyForms } from "@grafana/ui";
import { DataSource } from "../datasource";
import React, { PureComponent, ChangeEvent } from "react";
import { QueryEditorProps, SelectableValue } from "@grafana/data";

import { GCSelectGranularity } from "./GCSelectGranularity";
import { GCSelectRecordType } from "./GCSelectRecordType";
import { GCInput } from "./GCInput";
import { defaultQuery } from "../defaults";

import {
  GCDataSourceOptions,
  GCGranularity,
  GCQuery,
  GCDNSRecordType,
  GCVariable,
} from "../types";

const { FormField, Select } = LegacyForms;

type Props = QueryEditorProps<DataSource, GCQuery, GCDataSourceOptions>;

type State = {
  zones: SelectableValue<string>[];
  loadingZones: boolean;
};

export class GCQueryEditor extends PureComponent<Props, State> {
  state: State = { zones: [], loadingZones: true };

  componentDidMount() {
    this.loadZones();
  }

  loadZones = async () => {
    const { datasource } = this.props;

    this.setState({ loadingZones: true });

    try {
      const result = await datasource.metricFindQuery({
        selector: { value: GCVariable.Zone },
      });

      const zones: SelectableValue<string>[] = (result as Array<{ text: string }>).map(
        (z) => ({
          value: z.text,
          label: z.text,
        })
      );

    
      const allOption: SelectableValue<string> = {
        value: "all",
        label: "All Zones",
      };

      this.setState({
        zones: [allOption, ...zones],
        loadingZones: false,
      });
    } catch (e) {
      console.error("Failed to fetch zones:", e);
      this.setState({ zones: [], loadingZones: false });
    }
  };

  onZoneChange = (value: SelectableValue<string>) => {
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
    const { granularity, record_type, legendFormat, zone } = query;
    const { zones, loadingZones } = this.state;

   
    const selectedZone =
      zone === "all"
        ? { value: "all", label: "All Zones" }
        : zones.find((opt) => opt.value === zone) || (zone ? { value: zone, label: zone } : undefined);

   
    const selectedRecordType =
      record_type === GCDNSRecordType.All
        ? { value: GCDNSRecordType.All, label: "All" }
        : { value: record_type, label: record_type };

    const selectedGranularity =
      granularity?.value &&
      Object.values(GCGranularity).includes(granularity.value as GCGranularity)
        ? (granularity as SelectableValue<GCGranularity>)
        : undefined;

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
        {/* Zone Selector */}
        <FormField
          label="Zone"
          labelWidth={10}
          tooltip="Select a DNS Zone"
          inputEl={
            <Select
              width={25}
              options={zones}
              isLoading={loadingZones}
              isSearchable
              menuPlacement="bottom"
              onChange={this.onZoneChange}
              value={selectedZone}
              placeholder={loadingZones ? "Loading zones..." : "Select zone"}
            />
          }
        />

        {/* Granularity */}
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
        />

        {/* Record Type */}
        <FormField
          label="Record"
          labelWidth={10}
          tooltip="DNS Record Type"
          inputEl={
            <GCSelectRecordType
              width={25}
              isSearchable
              maxVisibleValues={20}
              minMenuHeight={30}
              menuPlacement="bottom"
              onChange={this.onRecordTypeChange}
              value={selectedRecordType}
            />
          }
        />

        {/* Legend */}
        <GCInput
          inputWidth={30}
          value={legendFormat}
          onChange={this.onLegendFormatChange}
          label="Legend"
          placeholder="legend format"
          tooltip="Use placeholders like {{record_type}}."
          type="text"
        />
      </div>
    );
  }
}
