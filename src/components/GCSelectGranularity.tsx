import React, { FC, useMemo } from "react";
import { Select, SelectCommonProps } from "@grafana/ui";
import { GCGranularity } from "../types";
import { createOptions } from "../granularity";

export const GCSelectGranularity: FC<Omit<SelectCommonProps<GCGranularity>, "options">> = (props) => {
  const options = useMemo(() => createOptions(), []);
  return <Select {...props} options={options} />;
};
