ALTER TABLE server_map_replay_events
  ADD COLUMN span_started_at DATETIME NULL AFTER occurred_at,
  ADD COLUMN span_ended_at DATETIME NULL AFTER span_started_at,
  ADD KEY idx_replay_events_span (server_id, wipe_key, span_started_at, span_ended_at);

UPDATE server_map_replay_events
SET
  span_started_at = LEAST(CAST(created_at AS DATETIME), CAST(occurred_at AS DATETIME)),
  span_ended_at = CAST(occurred_at AS DATETIME)
WHERE span_started_at IS NULL;
