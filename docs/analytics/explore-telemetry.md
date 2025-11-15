# Explore-telemetri

## Tabell

Alla Explore-händelser skrivs till tabellen `telemetry_events` i `public`-schemat. Kolumnerna är:

- `event_name`
- `occurred_at`
- `payload_json`
- `session_id`
- `user_id`

## Sparade vyer

### explore_session_conversion

```sql
select * from public.explore_session_conversion;
```

Visar antal Explore-sessioner (baserat på `session_id` i `explore_opened`-event), antal sessioner där CTA:n för ny skanning klickats samt konverteringsgrad (`conversion_rate`).

### explore_filter_usage_top3

```sql
select * from public.explore_filter_usage_top3;
```

Returnerar de tre mest använda filtren baserat på `explore_filter_changed`-eventen. Fälten `field` och `value` beskriver filterparametern samt dess värde.
