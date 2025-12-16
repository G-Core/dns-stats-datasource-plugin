import defaults from "lodash/defaults";
import React, { useState } from "react";
import { Select } from "@grafana/ui";
import { SelectableValue, MetricFindValue } from "@grafana/data";

import { defaultVariableQuery } from "../defaults";
import { GCSelectRecordType } from "./GCSelectRecordType";
import { GCSelectGranularity } from "./GCSelectGranularity";

import { GCVariable, GCVariableQuery, GCDNSRecordType, GCGranularity } from "../types";

type SelectorState = SelectableValue<GCVariable> & {
  selected?: GCDNSRecordType | GCGranularity | string;
};

export interface GCVariableQueryProps {
  query: GCVariableQuery;
  onChange: (query: GCVariableQuery, definition: string) => void;
  options: {
    zones?: SelectableValue<string>[]; 
  };
}

export const GCVariableQueryEditor: React.FC<GCVariableQueryProps> = ({ query: rawQuery, onChange, options }) => {
  const query = defaults(rawQuery, defaultVariableQuery);

  const [selector, setSelector] = useState<SelectorState>({
    value: query.selector?.value ?? GCVariable.Zone,
    label: query.selector?.label,
    selected: query.selector?.selected,
  });

  const handleVariableTypeChange = (sel: SelectableValue<GCVariable>) => {
    const newSelector: SelectorState = { value: sel.value!, label: sel.label, selected: undefined };
    setSelector(newSelector);
    onChange({ ...query, selector: newSelector }, sel.label || "");
  };

  const handleValueChange = <T extends GCDNSRecordType | GCGranularity | string>(sel: SelectableValue<T>) => {
    const newSelector: SelectorState = { ...selector, selected: sel.value };
    setSelector(newSelector);
    onChange({ ...query, selector: newSelector }, sel.label || "");
  };

  const renderValueSelector = () => {
    switch (selector.value) {
      case GCVariable.RecordType:
        return <GCSelectRecordType value={selector.selected as GCDNSRecordType | undefined} onChange={handleValueChange} />;
      case GCVariable.Granularity:
        return <GCSelectGranularity value={selector.selected as GCGranularity | undefined} onChange={handleValueChange} />;
      case GCVariable.Zone:
        return (
          <Select
            width={16}
            value={options.zones?.find((z) => z.value === selector.selected)}
            options={options.zones} // populated via metricFindQuery
            onChange={handleValueChange}
            menuPlacement="bottom"
            placeholder="Select zone"
          />
        );
      default:
        return null;
    }
  };

  const variableOptions: Array<SelectableValue<GCVariable>> = [
    { value: GCVariable.RecordType, label: "Record" },
    { value: GCVariable.Granularity, label: "Granularity" },
    { value: GCVariable.Zone, label: "Zone" },
  ];

  return (
    <div className="gf-form">
      <span className="gf-form-label width-10">Values for</span>
      <Select
        width={16}
        value={{
          value: selector.value,
          label: variableOptions.find((o) => o.value === selector.value)?.label,
        }}
        onChange={handleVariableTypeChange}
        options={variableOptions}
        menuPlacement="bottom"
      />
      <div style={{ marginTop: "6px" }}>{renderValueSelector()}</div>
    </div>
  );
};
