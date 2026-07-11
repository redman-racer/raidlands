CREATE TABLE IF NOT EXISTS server_heatmap_buckets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  server_id VARCHAR(120) NOT NULL,
  wipe_key VARCHAR(160) NOT NULL,
  bucket_size INT UNSIGNED NOT NULL,
  x INT NOT NULL,
  z INT NOT NULL,
  metric VARCHAR(40) NOT NULL,
  value DECIMAL(14,4) NOT NULL DEFAULT 0,
  sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  window_start DATETIME NOT NULL,
  window_end DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_heatmap_bucket (server_id, wipe_key, bucket_size, x, z, metric, window_start, window_end),
  KEY idx_heatmap_public_window (server_id, wipe_key, metric, window_end),
  KEY idx_heatmap_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
