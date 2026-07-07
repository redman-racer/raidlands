SET @vip_kit_screenshot_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

CREATE TEMPORARY TABLE raidlands_vip_kit_screenshot_items (
  kit_name VARCHAR(160) NOT NULL,
  container_name ENUM('main', 'wear', 'belt') NOT NULL,
  position INT NOT NULL,
  shortname VARCHAR(160) NOT NULL,
  display_name VARCHAR(160) NULL,
  skin BIGINT UNSIGNED NOT NULL DEFAULT 0,
  amount INT NOT NULL DEFAULT 1,
  condition_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_condition DECIMAL(10,2) NOT NULL DEFAULT 0,
  ammo INT NOT NULL DEFAULT 0,
  ammo_type VARCHAR(160) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_vip_kit_screenshot_items (kit_name, container_name, position)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE raidlands_vip_kit_screenshot_targets (
  kit_name VARCHAR(160) NOT NULL,
  required_permission VARCHAR(160) NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  reward_icon_url VARCHAR(500) NOT NULL,
  PRIMARY KEY (kit_name),
  UNIQUE KEY uq_vip_kit_screenshot_targets_permission (required_permission)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO raidlands_vip_kit_screenshot_targets (kit_name, required_permission, image_path, reward_icon_url)
VALUES
  ('vip', 'kits.vip', '/assets/media/kits/vip-kit.png', 'https://raidlands.net/assets/media/kits/vip-kit.png'),
  ('vip_plus', 'kits.vipplus', '/assets/media/kits/vip-plus-kit.png', 'https://raidlands.net/assets/media/kits/vip-plus-kit.png'),
  ('mvp', 'kits.mvp', '/assets/media/kits/mvp-kit.png', 'https://raidlands.net/assets/media/kits/mvp-kit.png'),
  ('golden', 'kits.goldenvip', '/assets/media/kits/golden-vip-kit.png', 'https://raidlands.net/assets/media/kits/golden-vip-kit.png'),
  ('ultimate', 'kits.ultimatevip', '/assets/media/kits/ultimate-vip-kit.png', 'https://raidlands.net/assets/media/kits/ultimate-vip-kit.png'),
  ('titan', 'kits.titanvip', '/assets/media/kits/titan-vip-kit.png', 'https://raidlands.net/assets/media/kits/titan-vip-kit.png');

INSERT INTO raidlands_vip_kit_screenshot_items
  (kit_name, container_name, position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, sort_order)
VALUES
  -- VIP
  ('vip', 'main', 0, 'ammo.rocket.basic', NULL, 0, 100, 0.00, 0.00, 0, NULL, 0),
  ('vip', 'main', 1, 'ammo.rocket.hv', NULL, 0, 100, 0.00, 0.00, 0, NULL, 10),
  ('vip', 'main', 2, 'electric.generator.small', NULL, 0, 10, 100.00, 100.00, 0, NULL, 20),
  ('vip', 'main', 3, 'weapon.mod.holosight', NULL, 0, 100, 300.00, 300.00, 0, NULL, 30),
  ('vip', 'main', 4, 'weapon.mod.lasersight', NULL, 0, 100, 300.00, 300.00, 0, NULL, 40),
  ('vip', 'main', 5, 'weapon.mod.flashlight', NULL, 0, 100, 0.00, 0.00, 0, NULL, 50),
  ('vip', 'main', 6, 'ammo.rifle.explosive', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 60),
  ('vip', 'main', 7, 'ammo.rifle', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 70),
  ('vip', 'main', 9, 'weapon.mod.small.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, 90),
  ('vip', 'main', 10, 'weapon.mod.silencer', NULL, 0, 100, 100.00, 100.00, 0, NULL, 100),
  ('vip', 'main', 11, 'weapon.mod.8x.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, 110),
  ('vip', 'main', 14, 'explosive.timed', NULL, 0, 50, 0.00, 0.00, 0, NULL, 140),
  ('vip', 'main', 15, 'rifle.lr300', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 150),
  ('vip', 'main', 16, 'smg.mp5', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.pistol', 160),
  ('vip', 'main', 17, 'rifle.l96', NULL, 0, 1, 60.00, 60.00, 0, 'ammo.rifle', 170),
  ('vip', 'main', 18, 'syringe.medical', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 180),
  ('vip', 'main', 19, 'black.raspberries', NULL, 0, 1500, 0.00, 0.00, 0, NULL, 190),
  ('vip', 'main', 21, 'lmg.m249', NULL, 0, 1, 500.00, 500.00, 0, 'ammo.rifle', 210),
  ('vip', 'main', 22, 'rifle.ak', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 220),
  ('vip', 'main', 23, 'rocket.launcher', NULL, 0, 1, 100.00, 100.00, 0, 'ammo.rocket.basic', 230),
  ('vip', 'wear', 0, 'metal.facemask', NULL, 0, 10, 320.00, 320.00, 0, NULL, 0),
  ('vip', 'wear', 1, 'metal.plate.torso', NULL, 0, 10, 360.00, 360.00, 0, NULL, 10),
  ('vip', 'wear', 2, 'roadsign.kilt', NULL, 0, 10, 150.00, 150.00, 0, NULL, 20),
  ('vip', 'wear', 3, 'hoodie', NULL, 0, 10, 0.00, 0.00, 0, NULL, 30),
  ('vip', 'wear', 4, 'pants', NULL, 0, 10, 0.00, 0.00, 0, NULL, 40),
  ('vip', 'wear', 5, 'shoes.boots', NULL, 0, 10, 0.00, 0.00, 0, NULL, 50),
  ('vip', 'wear', 6, 'tactical.gloves', NULL, 0, 10, 0.00, 0.00, 0, NULL, 60),

  -- VIP+
  ('vip_plus', 'main', 0, 'ammo.rocket.basic', NULL, 0, 500, 0.00, 0.00, 0, NULL, 0),
  ('vip_plus', 'main', 1, 'ammo.rocket.hv', NULL, 0, 500, 0.00, 0.00, 0, NULL, 10),
  ('vip_plus', 'main', 2, 'electric.generator.small', NULL, 0, 10, 100.00, 100.00, 0, NULL, 20),
  ('vip_plus', 'main', 3, 'weapon.mod.holosight', NULL, 0, 100, 300.00, 300.00, 0, NULL, 30),
  ('vip_plus', 'main', 4, 'weapon.mod.lasersight', NULL, 0, 100, 300.00, 300.00, 0, NULL, 40),
  ('vip_plus', 'main', 5, 'weapon.mod.flashlight', NULL, 0, 100, 0.00, 0.00, 0, NULL, 50),
  ('vip_plus', 'main', 6, 'ammo.rifle.explosive', NULL, 0, 20000, 0.00, 0.00, 0, NULL, 60),
  ('vip_plus', 'main', 7, 'ammo.rifle', NULL, 0, 20000, 0.00, 0.00, 0, NULL, 70),
  ('vip_plus', 'main', 9, 'weapon.mod.small.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, 90),
  ('vip_plus', 'main', 10, 'weapon.mod.silencer', NULL, 0, 100, 100.00, 100.00, 0, NULL, 100),
  ('vip_plus', 'main', 11, 'weapon.mod.8x.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, 110),
  ('vip_plus', 'main', 12, 'explosive.timed', NULL, 0, 150, 0.00, 0.00, 0, NULL, 120),
  ('vip_plus', 'main', 14, 'ammo.pistol', NULL, 0, 20000, 0.00, 0.00, 0, NULL, 140),
  ('vip_plus', 'main', 15, 'rifle.lr300', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 150),
  ('vip_plus', 'main', 16, 'smg.mp5', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.pistol', 160),
  ('vip_plus', 'main', 17, 'rifle.l96', NULL, 0, 1, 60.00, 60.00, 0, 'ammo.rifle', 170),
  ('vip_plus', 'main', 18, 'syringe.medical', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 180),
  ('vip_plus', 'main', 19, 'black.raspberries', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 190),
  ('vip_plus', 'main', 20, 'largemedkit', NULL, 0, 1000, 0.00, 0.00, 0, NULL, 200),
  ('vip_plus', 'main', 21, 'lmg.m249', NULL, 0, 1, 500.00, 500.00, 0, 'ammo.rifle', 210),
  ('vip_plus', 'main', 22, 'rifle.ak', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 220),
  ('vip_plus', 'main', 23, 'rocket.launcher', NULL, 0, 1, 100.00, 100.00, 0, 'ammo.rocket.basic', 230),
  ('vip_plus', 'wear', 0, 'metal.facemask', NULL, 0, 50, 320.00, 320.00, 0, NULL, 0),
  ('vip_plus', 'wear', 1, 'metal.plate.torso', NULL, 0, 50, 360.00, 360.00, 0, NULL, 10),
  ('vip_plus', 'wear', 2, 'roadsign.kilt', NULL, 0, 50, 150.00, 150.00, 0, NULL, 20),
  ('vip_plus', 'wear', 3, 'hoodie', NULL, 0, 50, 0.00, 0.00, 0, NULL, 30),
  ('vip_plus', 'wear', 4, 'pants', NULL, 0, 50, 0.00, 0.00, 0, NULL, 40),
  ('vip_plus', 'wear', 5, 'shoes.boots', NULL, 0, 50, 0.00, 0.00, 0, NULL, 50),
  ('vip_plus', 'wear', 6, 'tactical.gloves', NULL, 0, 50, 0.00, 0.00, 0, NULL, 60),

  -- MVP
  ('mvp', 'main', 0, 'ammo.rocket.hv', NULL, 0, 500, 0.00, 0.00, 0, NULL, 0),
  ('mvp', 'main', 1, 'ammo.rocket.basic', NULL, 0, 500, 0.00, 0.00, 0, NULL, 10),
  ('mvp', 'main', 3, 'lowgradefuel', NULL, 0, 500, 0.00, 0.00, 0, NULL, 30),
  ('mvp', 'main', 4, 'explosive.timed', NULL, 0, 500, 0.00, 0.00, 0, NULL, 40),
  ('mvp', 'main', 5, 'samsite', NULL, 0, 1, 100.00, 100.00, 0, NULL, 50),
  ('mvp', 'main', 6, 'ammo.rifle.explosive', NULL, 0, 25000, 0.00, 0.00, 0, NULL, 60),
  ('mvp', 'main', 7, 'ammo.rifle', NULL, 0, 25000, 0.00, 0.00, 0, NULL, 70),
  ('mvp', 'main', 8, 'ammo.pistol', NULL, 0, 25000, 0.00, 0.00, 0, NULL, 80),
  ('mvp', 'main', 11, 'autoturret', NULL, 0, 25, 100.00, 100.00, 0, NULL, 110),
  ('mvp', 'main', 12, 'largemedkit', NULL, 0, 500, 0.00, 0.00, 0, NULL, 120),
  ('mvp', 'main', 13, 'black.raspberries', NULL, 0, 1250, 0.00, 0.00, 0, NULL, 130),
  ('mvp', 'main', 15, 'rifle.lr300', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 150),
  ('mvp', 'main', 16, 'smg.mp5', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.pistol', 160),
  ('mvp', 'main', 17, 'rifle.l96', NULL, 0, 1, 60.00, 60.00, 0, 'ammo.rifle', 170),
  ('mvp', 'main', 18, 'syringe.medical', NULL, 0, 1250, 0.00, 0.00, 0, NULL, 180),
  ('mvp', 'main', 21, 'rocket.launcher', NULL, 0, 1, 100.00, 100.00, 0, 'ammo.rocket.basic', 210),
  ('mvp', 'main', 22, 'lmg.m249', NULL, 0, 1, 500.00, 500.00, 0, 'ammo.rifle', 220),
  ('mvp', 'main', 23, 'rifle.ak', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 230),
  ('mvp', 'wear', 0, 'metal.facemask', NULL, 0, 5, 320.00, 320.00, 0, NULL, 0),
  ('mvp', 'wear', 1, 'metal.plate.torso', NULL, 0, 5, 360.00, 360.00, 0, NULL, 10),
  ('mvp', 'wear', 2, 'roadsign.kilt', NULL, 0, 5, 150.00, 150.00, 0, NULL, 20),
  ('mvp', 'wear', 3, 'hoodie', NULL, 0, 5, 0.00, 0.00, 0, NULL, 30),
  ('mvp', 'wear', 4, 'pants', NULL, 0, 5, 0.00, 0.00, 0, NULL, 40),
  ('mvp', 'wear', 5, 'tactical.gloves', NULL, 0, 5, 0.00, 0.00, 0, NULL, 50),
  ('mvp', 'wear', 6, 'shoes.boots', NULL, 0, 5, 0.00, 0.00, 0, NULL, 60),

  -- Golden VIP
  ('golden', 'main', 0, 'ammo.rocket.basic', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 0),
  ('golden', 'main', 1, 'ammo.rocket.hv', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 10),
  ('golden', 'main', 3, 'lowgradefuel', NULL, 0, 50000, 0.00, 0.00, 0, NULL, 30),
  ('golden', 'main', 4, 'explosive.timed', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 40),
  ('golden', 'main', 5, 'samsite', NULL, 0, 3, 100.00, 100.00, 0, NULL, 50),
  ('golden', 'main', 6, 'ammo.rifle.explosive', NULL, 0, 100000, 0.00, 0.00, 0, NULL, 60),
  ('golden', 'main', 7, 'ammo.rifle', NULL, 0, 100000, 0.00, 0.00, 0, NULL, 70),
  ('golden', 'main', 8, 'ammo.pistol', NULL, 0, 100000, 0.00, 0.00, 0, NULL, 80),
  ('golden', 'main', 9, 'electric.generator.small', NULL, 0, 500, 100.00, 100.00, 0, NULL, 90),
  ('golden', 'main', 11, 'autoturret', NULL, 0, 100, 100.00, 100.00, 0, NULL, 110),
  ('golden', 'main', 12, 'largemedkit', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 120),
  ('golden', 'main', 13, 'black.raspberries', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 130),
  ('golden', 'main', 15, 'rifle.lr300', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 150),
  ('golden', 'main', 16, 'smg.mp5', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.pistol', 160),
  ('golden', 'main', 17, 'rifle.l96', NULL, 0, 1, 60.00, 60.00, 0, 'ammo.rifle', 170),
  ('golden', 'main', 18, 'syringe.medical', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 180),
  ('golden', 'main', 21, 'rocket.launcher', NULL, 0, 1, 100.00, 100.00, 0, 'ammo.rocket.basic', 210),
  ('golden', 'main', 22, 'lmg.m249', NULL, 0, 1, 500.00, 500.00, 0, 'ammo.rifle', 220),
  ('golden', 'main', 23, 'rifle.ak', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 230),
  ('golden', 'wear', 0, 'metal.facemask', NULL, 0, 100, 320.00, 320.00, 0, NULL, 0),
  ('golden', 'wear', 1, 'metal.plate.torso', NULL, 0, 100, 360.00, 360.00, 0, NULL, 10),
  ('golden', 'wear', 2, 'roadsign.kilt', NULL, 0, 100, 150.00, 150.00, 0, NULL, 20),
  ('golden', 'wear', 3, 'hoodie', NULL, 0, 100, 0.00, 0.00, 0, NULL, 30),
  ('golden', 'wear', 4, 'pants', NULL, 0, 100, 0.00, 0.00, 0, NULL, 40),
  ('golden', 'wear', 5, 'shoes.boots', NULL, 0, 100, 0.00, 0.00, 0, NULL, 50),
  ('golden', 'wear', 6, 'tactical.gloves', NULL, 0, 100, 0.00, 0.00, 0, NULL, 60),

  -- Ultimate VIP
  ('ultimate', 'main', 0, 'ammo.rocket.hv', NULL, 0, 20000, 0.00, 0.00, 0, NULL, 0),
  ('ultimate', 'main', 1, 'ammo.rocket.basic', NULL, 0, 20000, 0.00, 0.00, 0, NULL, 10),
  ('ultimate', 'main', 2, 'ammo.rifle.explosive', NULL, 0, 200000, 0.00, 0.00, 0, NULL, 20),
  ('ultimate', 'main', 3, 'samsite', NULL, 0, 3, 100.00, 100.00, 0, NULL, 30),
  ('ultimate', 'main', 4, 'electric.generator.small', NULL, 0, 1500, 100.00, 100.00, 0, NULL, 40),
  ('ultimate', 'main', 5, 'supply.signal', NULL, 0, 10, 0.00, 0.00, 0, NULL, 50),
  ('ultimate', 'main', 6, 'ammo.rifle', NULL, 0, 200000, 0.00, 0.00, 0, NULL, 60),
  ('ultimate', 'main', 7, 'lowgradefuel', NULL, 0, 100000, 0.00, 0.00, 0, NULL, 70),
  ('ultimate', 'main', 8, 'weapon.mod.silencer', NULL, 0, 100, 100.00, 100.00, 0, NULL, 80),
  ('ultimate', 'main', 9, 'autoturret', NULL, 0, 150, 100.00, 100.00, 0, NULL, 90),
  ('ultimate', 'main', 10, 'explosive.timed', NULL, 0, 15000, 0.00, 0.00, 0, NULL, 100),
  ('ultimate', 'main', 11, 'supertea', 'Super Serum', 0, 100, 0.00, 0.00, 0, NULL, 110),
  ('ultimate', 'main', 12, 'weapon.mod.holosight', NULL, 0, 100, 300.00, 300.00, 0, NULL, 120),
  ('ultimate', 'main', 13, 'weapon.mod.flashlight', NULL, 0, 100, 0.00, 0.00, 0, NULL, 130),
  ('ultimate', 'main', 14, 'weapon.mod.lasersight', NULL, 0, 100, 300.00, 300.00, 0, NULL, 140),
  ('ultimate', 'main', 15, 'ammo.grenadelauncher.he', NULL, 0, 20000, 0.00, 0.00, 0, NULL, 150),
  ('ultimate', 'main', 16, 'rifle.ak', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 160),
  ('ultimate', 'main', 17, 'lmg.m249', NULL, 0, 1, 500.00, 500.00, 0, 'ammo.rifle', 170),
  ('ultimate', 'main', 18, 'syringe.medical', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 180),
  ('ultimate', 'main', 19, 'black.raspberries', NULL, 0, 30000, 0.00, 0.00, 0, NULL, 190),
  ('ultimate', 'main', 20, 'weapon.mod.8x.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, 200),
  ('ultimate', 'main', 21, 'rifle.lr300', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 210),
  ('ultimate', 'main', 22, 'smg.mp5', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.pistol', 220),
  ('ultimate', 'main', 23, 'rocket.launcher', NULL, 0, 1, 100.00, 100.00, 0, 'ammo.rocket.basic', 230),
  ('ultimate', 'belt', 0, 'largemedkit', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 0),
  ('ultimate', 'belt', 1, 'bandage', NULL, 0, 5000, 0.00, 0.00, 0, NULL, 10),
  ('ultimate', 'belt', 3, 'scrap', NULL, 0, 100000, 0.00, 0.00, 0, NULL, 30),
  ('ultimate', 'belt', 4, 'rifle.l96', NULL, 0, 1, 60.00, 60.00, 0, 'ammo.rifle', 40),
  ('ultimate', 'belt', 5, 'multiplegrenadelauncher', NULL, 0, 1, 200.00, 200.00, 0, 'ammo.grenadelauncher.he', 50),
  ('ultimate', 'wear', 0, 'metal.facemask', NULL, 0, 100, 320.00, 320.00, 0, NULL, 0),
  ('ultimate', 'wear', 1, 'metal.plate.torso', NULL, 0, 100, 360.00, 360.00, 0, NULL, 10),
  ('ultimate', 'wear', 2, 'roadsign.kilt', NULL, 0, 100, 150.00, 150.00, 0, NULL, 20),
  ('ultimate', 'wear', 3, 'hoodie', NULL, 0, 100, 0.00, 0.00, 0, NULL, 30),
  ('ultimate', 'wear', 4, 'pants', NULL, 0, 100, 0.00, 0.00, 0, NULL, 40),
  ('ultimate', 'wear', 5, 'shoes.boots', NULL, 0, 100, 0.00, 0.00, 0, NULL, 50),
  ('ultimate', 'wear', 6, 'tactical.gloves', NULL, 0, 100, 0.00, 0.00, 0, NULL, 60),

  -- Titan VIP
  ('titan', 'main', 0, 'ammo.rocket.basic', NULL, 0, 150000, 0.00, 0.00, 0, NULL, 0),
  ('titan', 'main', 1, 'ammo.rocket.hv', NULL, 0, 150000, 0.00, 0.00, 0, NULL, 10),
  ('titan', 'main', 2, 'ammo.pistol', NULL, 0, 500000, 0.00, 0.00, 0, NULL, 20),
  ('titan', 'main', 3, 'samsite', NULL, 0, 5, 100.00, 100.00, 0, NULL, 30),
  ('titan', 'main', 4, 'electric.generator.small', NULL, 0, 10000, 100.00, 100.00, 0, NULL, 40),
  ('titan', 'main', 5, 'supply.signal', NULL, 0, 35, 0.00, 0.00, 0, NULL, 50),
  ('titan', 'main', 6, 'ammo.rifle', NULL, 0, 500000, 0.00, 0.00, 0, NULL, 60),
  ('titan', 'main', 7, 'ammo.rifle.explosive', NULL, 0, 500000, 0.00, 0.00, 0, NULL, 70),
  ('titan', 'main', 8, 'autoturret', 'Outpost Sentry Turret', 0, 5, 100.00, 100.00, 0, NULL, 80),
  ('titan', 'main', 9, 'autoturret', NULL, 0, 1000, 100.00, 100.00, 0, NULL, 90),
  ('titan', 'main', 10, 'explosive.timed', NULL, 0, 50000, 0.00, 0.00, 0, NULL, 100),
  ('titan', 'main', 11, 'supertea', 'Super Serum', 0, 5000, 0.00, 0.00, 0, NULL, 110),
  ('titan', 'main', 12, 'ammo.grenadelauncher.he', NULL, 0, 100000, 0.00, 0.00, 0, NULL, 120),
  ('titan', 'main', 13, 'metal.refined', NULL, 0, 50000000, 0.00, 0.00, 0, NULL, 130),
  ('titan', 'main', 14, 'cloth', NULL, 0, 1000000, 0.00, 0.00, 0, NULL, 140),
  ('titan', 'main', 15, 'scrap', NULL, 0, 1000000, 0.00, 0.00, 0, NULL, 150),
  ('titan', 'main', 16, 'lmg.m249', NULL, 0, 1, 500.00, 500.00, 15, 'ammo.rifle', 160),
  ('titan', 'main', 17, 'rifle.ak', NULL, 0, 1, 150.00, 150.00, 0, 'ammo.rifle', 170),
  ('titan', 'main', 18, 'syringe.medical', NULL, 0, 250000, 0.00, 0.00, 0, NULL, 180),
  ('titan', 'main', 19, 'black.raspberries', NULL, 0, 500000, 0.00, 0.00, 0, NULL, 190),
  ('titan', 'main', 20, 'largemedkit', NULL, 0, 10000, 0.00, 0.00, 0, NULL, 200),
  ('titan', 'main', 21, 'grenade.smoke', 'Portafort Token', 0, 25, 0.00, 0.00, 0, NULL, 210),
  ('titan', 'main', 22, 'rocket.launcher', NULL, 0, 1, 100.00, 100.00, 0, 'ammo.rocket.basic', 220),
  ('titan', 'main', 23, 'rifle.lr300', NULL, 0, 1, 150.00, 150.00, 4, 'ammo.rifle', 230),
  ('titan', 'belt', 0, 'weapon.mod.holosight', NULL, 0, 5000, 300.00, 300.00, 0, NULL, 0),
  ('titan', 'belt', 1, 'weapon.mod.lasersight', NULL, 0, 5000, 300.00, 300.00, 0, NULL, 10),
  ('titan', 'belt', 3, 'smg.mp5', NULL, 0, 1, 150.00, 150.00, 8, 'ammo.pistol', 30),
  ('titan', 'belt', 4, 'rifle.l96', NULL, 0, 1, 60.00, 60.00, 2, 'ammo.rifle', 40),
  ('titan', 'belt', 5, 'multiplegrenadelauncher', NULL, 0, 1, 200.00, 200.00, 0, 'ammo.grenadelauncher.he', 50),
  ('titan', 'wear', 0, 'metal.facemask', NULL, 0, 500, 320.00, 320.00, 0, NULL, 0),
  ('titan', 'wear', 1, 'metal.plate.torso', NULL, 0, 500, 360.00, 360.00, 0, NULL, 10),
  ('titan', 'wear', 2, 'roadsign.kilt', NULL, 0, 500, 150.00, 150.00, 0, NULL, 20),
  ('titan', 'wear', 3, 'hoodie', NULL, 0, 500, 0.00, 0.00, 0, NULL, 30),
  ('titan', 'wear', 4, 'pants', NULL, 0, 500, 0.00, 0.00, 0, NULL, 40),
  ('titan', 'wear', 5, 'shoes.boots', NULL, 0, 500, 0.00, 0.00, 0, NULL, 50),
  ('titan', 'wear', 6, 'tactical.gloves', NULL, 0, 500, 0.00, 0.00, 0, NULL, 60);

DELETE gki
FROM game_kit_items AS gki
INNER JOIN game_kits AS gk ON gk.id = gki.kit_id
INNER JOIN raidlands_vip_kit_screenshot_targets AS target_kits
  ON target_kits.required_permission = gk.required_permission
WHERE gk.deleted_at IS NULL
  AND gk.is_active = 1;

INSERT INTO game_kit_items
  (kit_id, container_name, position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, sort_order)
SELECT
  gk.id,
  desired.container_name,
  desired.position,
  desired.shortname,
  desired.display_name,
  desired.skin,
  desired.amount,
  desired.condition_value,
  desired.max_condition,
  desired.ammo,
  desired.ammo_type,
  -1,
  NULL,
  NULL,
  NULL,
  NULL,
  desired.sort_order
FROM raidlands_vip_kit_screenshot_items AS desired
INNER JOIN raidlands_vip_kit_screenshot_targets AS target_kits
  ON target_kits.kit_name = desired.kit_name
INNER JOIN game_kits AS gk ON gk.required_permission = target_kits.required_permission
WHERE gk.deleted_at IS NULL
  AND gk.is_active = 1
ORDER BY gk.id ASC, desired.container_name ASC, desired.position ASC, desired.sort_order ASC;

SET @vip_kit_screenshot_item_count := ROW_COUNT();

UPDATE game_kits AS gk
INNER JOIN raidlands_vip_kit_screenshot_targets AS target_kits
  ON target_kits.required_permission = gk.required_permission
SET
  gk.image_path = target_kits.image_path,
  gk.reward_icon_url = target_kits.reward_icon_url,
  gk.draft_revision = @vip_kit_screenshot_revision,
  gk.published_revision = @vip_kit_screenshot_revision,
  gk.published_at = NOW(),
  gk.updated_at = NOW()
WHERE gk.deleted_at IS NULL
  AND gk.is_active = 1;

SET @vip_kit_screenshot_kit_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT
  @vip_kit_screenshot_revision,
  'pending',
  NULL,
  '',
  CONCAT('Synced VIP kit items from July 7 screenshots: ', @vip_kit_screenshot_item_count, ' item rows across ', @vip_kit_screenshot_kit_count, ' kits.')
WHERE @vip_kit_screenshot_item_count > 0
   OR @vip_kit_screenshot_kit_count > 0;

DROP TEMPORARY TABLE raidlands_vip_kit_screenshot_items;
DROP TEMPORARY TABLE raidlands_vip_kit_screenshot_targets;
