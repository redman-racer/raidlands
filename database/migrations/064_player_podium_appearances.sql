CREATE TABLE IF NOT EXISTS player_podium_profiles (
    player_id BIGINT UNSIGNED NOT NULL,
    outfit_mode VARCHAR(16) NOT NULL DEFAULT 'auto',
    outfit_key VARCHAR(96) NULL,
    weapon_mode VARCHAR(16) NOT NULL DEFAULT 'auto',
    weapon_key VARCHAR(96) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id),
    CONSTRAINT fk_player_podium_profiles_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS player_outfit_observations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    player_id BIGINT UNSIGNED NOT NULL,
    server_id VARCHAR(120) NOT NULL,
    wipe_id BIGINT UNSIGNED NOT NULL,
    outfit_signature CHAR(64) NOT NULL,
    items_json JSON NOT NULL,
    sample_count INT UNSIGNED NOT NULL DEFAULT 1,
    first_seen_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_player_outfit_wipe_signature (player_id, server_id, wipe_id, outfit_signature),
    KEY idx_player_outfit_auto (player_id, wipe_id, sample_count, last_seen_at),
    CONSTRAINT fk_player_outfit_observations_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_player_outfit_observations_wipe
        FOREIGN KEY (wipe_id) REFERENCES wipe_seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS player_weapon_observations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    player_id BIGINT UNSIGNED NOT NULL,
    server_id VARCHAR(120) NOT NULL,
    wipe_id BIGINT UNSIGNED NOT NULL,
    weapon_shortname VARCHAR(64) NOT NULL,
    skin_id VARCHAR(24) NOT NULL DEFAULT '0',
    sample_count INT UNSIGNED NOT NULL DEFAULT 1,
    first_seen_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_player_weapon_wipe_item (player_id, server_id, wipe_id, weapon_shortname, skin_id),
    KEY idx_player_weapon_auto (player_id, wipe_id, sample_count, last_seen_at),
    CONSTRAINT fk_player_weapon_observations_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_player_weapon_observations_wipe
        FOREIGN KEY (wipe_id) REFERENCES wipe_seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
