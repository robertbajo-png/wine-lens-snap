create or replace view public.scan_quality_weekly as
with scans as (
  select
    date_trunc('week', occurred_at)::date as week_start,
    nullif(payload_json ->> 'mode', '') as mode,
    (payload_json ->> 'confidence')::numeric as confidence
  from public.telemetry_events
  where event_name = 'scan_succeeded'
)
select
  week_start,
  count(*) as total_scans,
  round(
    percentile_cont(0.5) within group (order by confidence)
      filter (where confidence is not null),
    4
  ) as median_confidence,
  sum(case when mode = 'label_only' then 1 else 0 end) as label_only_count,
  sum(case when mode = 'label+web' then 1 else 0 end) as label_web_count,
  round(
    sum(case when mode = 'label_only' then 1 else 0 end)::numeric / nullif(count(*), 0),
    4
  ) as share_label_only,
  round(
    sum(case when mode = 'label+web' then 1 else 0 end)::numeric / nullif(count(*), 0),
    4
  ) as share_label_web
from scans
group by week_start
order by week_start desc;
