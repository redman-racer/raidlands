ALTER TABLE rp_game_rounds
  ADD INDEX idx_rp_game_rounds_leaderboard (status, created_at, player_id, payout_rp);

ALTER TABLE rp_jackpot_entries
  ADD INDEX idx_rp_jackpot_entries_leaderboard (status, round_id, player_id);

ALTER TABLE rp_pool_entries
  ADD INDEX idx_rp_pool_entries_leaderboard (status, round_id, player_id, payout_rp);

ALTER TABLE monument_extraction_runs
  ADD INDEX idx_monument_runs_leaderboard (status, completed_at, player_id, payout_status);
