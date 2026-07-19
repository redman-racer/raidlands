CREATE TABLE IF NOT EXISTS podium_pose_presets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pose_key VARCHAR(64) NOT NULL,
    label VARCHAR(80) NOT NULL,
    rotations_json JSON NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by_steam_id64 VARCHAR(20) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_podium_pose_key (pose_key),
    KEY idx_podium_pose_active_label (is_active, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE player_podium_profiles
    ADD COLUMN pose_key VARCHAR(64) NOT NULL DEFAULT 'default' AFTER weapon_key;
