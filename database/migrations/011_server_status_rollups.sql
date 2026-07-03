CREATE TABLE IF NOT EXISTS server_status_hourly_rollups (
  server_id VARCHAR(120) NOT NULL,
  bucket_hour DATETIME NOT NULL,
  avg_players DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  peak_players INT UNSIGNED NOT NULL DEFAULT 0,
  avg_queue DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  online_sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, bucket_hour),
  KEY idx_server_status_hourly_bucket (bucket_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS server_status_daily_rollups (
  server_id VARCHAR(120) NOT NULL,
  bucket_date DATE NOT NULL,
  daily_peak INT UNSIGNED NOT NULL DEFAULT 0,
  average_players DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  uptime_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  downtime_count INT UNSIGNED NOT NULL DEFAULT 0,
  online_sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, bucket_date),
  KEY idx_server_status_daily_bucket (bucket_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
