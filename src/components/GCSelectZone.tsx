import React, { FC } from "react";
import { Select, SelectCommonProps } from "@grafana/ui";
import { createZoneOptions } from "../zonenames";

export const GCSelectZone: FC<Omit<SelectCommonProps<string>, "options">> = (props) => {
  const options = createZoneOptions();
  return <Select<string> {...props} options={options} />;
};
