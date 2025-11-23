create or replace view public.view_scan_summary_last_7d as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_name = 'scan_started') as scan_started_count,
  count(*) filter (where event_name = 'scan_succeeded') as scan_succeeded_count,
  case
    when count(*) filter (where event_name = 'scan_started') > 0 then
      (count(*) filter (where event_name = 'scan_succeeded')::numeric)
      / nullif(count(*) filter (where event_name = 'scan_started'), 0)::numeric
    else 0
  end as success_rate,
  percentile_cont(0.5) within group (order by (properties ->> 'latencyMs')::numeric)
    filter (
      where event_name = 'scan_succeeded'
        and properties ? 'latencyMs'
        and properties ->> 'latencyMs' is not null
    ) as median_latency_ms,
  avg((properties ->> 'confidence')::numeric)
    filter (
      where event_name = 'scan_succeeded'
        and properties ? 'confidence'
        and properties ->> 'confidence' is not null
    ) as avg_confidence
from public.event_logs
where event_name in ('scan_started', 'scan_succeeded')
  and created_at >= date_trunc('day', now()) - interval '7 days'
group by 1
order by day desc;

create or replace view public.view_scan_mode_breakdown_last_30d as
select
  coalesce(properties ->> 'mode', 'unknown') as mode,
  count(*) as scan_succeeded_count,
  avg((properties ->> 'confidence')::numeric)
    filter (where properties ? 'confidence' and properties ->> 'confidence' is not null) as avg_confidence
from public.event_logs
where event_name = 'scan_succeeded'
  and created_at >= date_trunc('day', now()) - interval '30 days'
group by 1
order by 1;
