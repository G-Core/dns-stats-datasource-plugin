# Grafana Data Source Plugin for Gcore DNS Zone Statistics

[![Build](https://github.com/G-Core/dns-stats-datasource-plugin)](https://github.com/G-Core/dns-stats-datasource-plugin/actions/workflows/ci.yml)

This is a Grafana datasource plugin for G-Core Labs DNS statistics.

## What is Gcore Grafana Data Source Plugin?

Grafana supports a wide range of data sources, including Prometheus, MySQL, and even Datadog. There’s a good chance you can already visualize metrics from the systems you have set up.

In our case this datasource plugin is backed by Gcore DNS Zone Statistics API.

## Key Features

- Visualizing data from DNS statistics API
- Utilize zone name filters (use `all` for summary of all zones)
- Utilize DNS record type filters (A, AAAA, NS, CNAME, MX, TXT, SVCB, HTTPS)
- Utilize granularity for time-based intervals
- Utilize variables

## Example data source Config File
If you are running multiple instances of Grafana you might run into problems if they have different versions of the datasource.yaml configuration file.
The best way to solve this problem is to add a version number to each datasource in the configuration and increase it when you update the config.
Grafana will only update datasources with the same or lower version number than specified in the config. That way, old configs cannot overwrite newer configs if they restart at the same time.


```yaml
apiVersion: 1

datasources:
  - name: dns-stats
    orgId: 1
    editable: true
    access: proxy
    type: gcorelabs-dns-stats-datasource
    isDefault: true
    version: 1
    jsonData:
      apiUrl: api.gcore.com/dns/v2
    secureJsonData:
      apiKey: 'apikey 1234$abcdef'

