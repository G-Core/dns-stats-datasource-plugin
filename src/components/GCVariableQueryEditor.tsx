import defaults from "lodash/defaults";
import React, { useState } from "react";
import { Select } from "@grafana/ui";
import { SelectableValue } from "@grafana/data";

import { defaultVariableQuery } from "../defaults";
import { GCSelectZone } from "./GCSelectZone";
import { GCSelectRecordType } from "./GCSelectRecordType";
import { GCSelectGranularity } from "./GCSelectGranularity";

import { GCVariable, GCVariableQuery,GCZoneName,GCDNSRecordType,GCGranularity, } from "../types";

type SelectorState = SelectableValue<GCVariable> & {
  selected?: GCZoneName | GCDNSRecordType | GCGranularity;
};

export interface GCVariableQueryProps {
  query: GCVariableQuery;
  onChange: (query: GCVariableQuery, definition: string) => void;
}

export const GCVariableQueryEditor: React.FC<GCVariableQueryProps> = ({
  query: rawQuery,
  onChange,
}) => {
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

  const handleValueChange = <T extends GCZoneName | GCDNSRecordType | GCGranularity>(
    sel: SelectableValue<T>
  ) => {
    const newSelector: SelectorState = { ...selector, selected: sel.value };
    setSelector(newSelector);
    onChange({ ...query, selector: newSelector }, sel.label || "");
  };

  const renderValueSelector = () => {
    switch (selector.value) {
      case GCVariable.Zone:
        return (
          <GCSelectZone
            value={selector.selected as GCZoneName | undefined}
            onChange={handleValueChange}
          />
        );
      case GCVariable.RecordType:
        return (
          <GCSelectRecordType
            value={selector.selected as GCDNSRecordType | undefined}
            onChange={handleValueChange}
          />
        );
      case GCVariable.Granularity:
        return (
          <GCSelectGranularity
            value={selector.selected as GCGranularity | undefined}
            onChange={handleValueChange}
          />
        );
      default:
        return null;
    }
  };

  const variableOptions: Array<SelectableValue<GCVariable>> = [
    { value: GCVariable.Zone, label: "Zone" },
    { value: GCVariable.RecordType, label: "Record" },
    { value: GCVariable.Granularity, label: "Granularity" },
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
