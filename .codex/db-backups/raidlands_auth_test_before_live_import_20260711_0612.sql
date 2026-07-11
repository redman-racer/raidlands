-- MySQL dump 10.13  Distrib 9.1.0, for Win64 (x86_64)
--
-- Host: localhost    Database: raidlands_auth_test
-- ------------------------------------------------------
-- Server version	9.1.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_audit_log`
--

DROP TABLE IF EXISTS `admin_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `subject_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `details_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_audit_created` (`created_at`),
  KEY `idx_admin_audit_action` (`action`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_audit_log`
--

LOCK TABLES `admin_audit_log` WRITE;
/*!40000 ALTER TABLE `admin_audit_log` DISABLE KEYS */;
INSERT INTO `admin_audit_log` VALUES (1,'76561190000000000','airstrike_animation_create','airstrike_animation_profile','codex_full_migration_1783734757748','{\"source_sha256\":\"d2b0bf3f077689ac611bd792166c999297d6b7b6b4c9a936c17a85c71bf5ad16\"}','2026-07-11 01:52:37');
/*!40000 ALTER TABLE `admin_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_permissions`
--

DROP TABLE IF EXISTS `admin_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `permission_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_permissions_key` (`permission_key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_permissions`
--

LOCK TABLES `admin_permissions` WRITE;
/*!40000 ALTER TABLE `admin_permissions` DISABLE KEYS */;
INSERT INTO `admin_permissions` VALUES (1,'admin.access','Access admin panel','Allows an approved Steam account to enter the admin panel.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(2,'admin.users.manage','Manage admin users','Allows managing approved Steam IDs, roles, and permissions.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(3,'admin.content.manage','Manage site content','Allows editing identity, links, wipe settings, features, pages, and SEO.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(4,'admin.feedback.manage','Manage feedback','Allows reviewing and updating support feedback.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(5,'admin.store.manage','Manage store','Allows editing store products and prices.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(6,'admin.kits.manage','Manage kits','Allows editing and publishing game kit catalog changes.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(7,'admin.permissions.manage','Manage groups','Allows editing and publishing Oxide group permission changes.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(8,'admin.grants.manage','Manage manual grants','Allows granting store entitlements manually by SteamID64.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(9,'admin.sync.view','View bridge sync','Allows viewing bridge state, stats ingest, clan bridge, and entitlement sync status.','2026-07-11 01:51:34','2026-07-11 01:51:34'),(10,'admin.rewards.manage','Manage rewards and RP games','Allows managing vote rewards, RP game settings, and reward-game request queues.','2026-07-11 01:51:37','2026-07-11 01:51:37'),(11,'admin.chat.manage','Manage public chat','Allows moderating the Steam-linked public lobby chat.','2026-07-11 01:51:37','2026-07-11 01:51:37'),(12,'admin.airstrike_animations.manage','Manage airstrike animations','Allows creating, editing, publishing, restoring, and synchronizing Portable Airstrikes animation profiles.','2026-07-11 01:51:37','2026-07-11 01:51:37');
/*!40000 ALTER TABLE `admin_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_role_permissions`
--

DROP TABLE IF EXISTS `admin_role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_role_permissions` (
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `fk_admin_role_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_admin_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `admin_permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_admin_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `admin_roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_role_permissions`
--

LOCK TABLES `admin_role_permissions` WRITE;
/*!40000 ALTER TABLE `admin_role_permissions` DISABLE KEYS */;
INSERT INTO `admin_role_permissions` VALUES (1,1,'2026-07-11 01:51:34'),(1,2,'2026-07-11 01:51:34'),(1,3,'2026-07-11 01:51:34'),(1,4,'2026-07-11 01:51:34'),(1,5,'2026-07-11 01:51:34'),(1,6,'2026-07-11 01:51:34'),(1,7,'2026-07-11 01:51:34'),(1,8,'2026-07-11 01:51:34'),(1,9,'2026-07-11 01:51:34'),(1,10,'2026-07-11 01:51:37'),(1,11,'2026-07-11 01:51:37'),(1,12,'2026-07-11 01:51:37'),(2,1,'2026-07-11 01:51:34'),(2,3,'2026-07-11 01:51:34'),(2,4,'2026-07-11 01:51:34'),(2,5,'2026-07-11 01:51:34'),(2,6,'2026-07-11 01:51:34'),(2,7,'2026-07-11 01:51:34'),(2,8,'2026-07-11 01:51:34'),(2,9,'2026-07-11 01:51:34'),(2,10,'2026-07-11 01:51:37'),(2,11,'2026-07-11 01:51:37'),(2,12,'2026-07-11 01:51:37'),(3,1,'2026-07-11 01:51:34'),(3,4,'2026-07-11 01:51:34'),(3,9,'2026-07-11 01:51:34'),(3,11,'2026-07-11 01:51:37'),(4,1,'2026-07-11 01:51:34'),(4,3,'2026-07-11 01:51:34'),(5,1,'2026-07-11 01:51:34'),(5,4,'2026-07-11 01:51:34'),(5,9,'2026-07-11 01:51:34'),(5,11,'2026-07-11 01:51:37');
/*!40000 ALTER TABLE `admin_role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_roles`
--

DROP TABLE IF EXISTS `admin_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_system` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_roles_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_roles`
--

LOCK TABLES `admin_roles` WRITE;
/*!40000 ALTER TABLE `admin_roles` DISABLE KEYS */;
INSERT INTO `admin_roles` VALUES (1,'owner','Owner','Full access to every admin section and future admin-user management.',1,'2026-07-11 01:51:34','2026-07-11 01:51:34'),(2,'administrator','Administrator','Can manage site content, store setup, kits, grants, feedback, and bridge status.',1,'2026-07-11 01:51:34','2026-07-11 01:51:34'),(3,'moderator','Moderator','Can review player feedback and inspect bridge status.',1,'2026-07-11 01:51:34','2026-07-11 01:51:34'),(4,'editor','Editor','Can update public website identity, links, wipe settings, pages, features, and SEO.',1,'2026-07-11 01:51:34','2026-07-11 01:51:34'),(5,'support','Support','Can review player feedback and inspect sync status.',1,'2026-07-11 01:51:34','2026-07-11 01:51:34');
/*!40000 ALTER TABLE `admin_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_todo_snapshots`
--

DROP TABLE IF EXISTS `admin_todo_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_todo_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `status` enum('generated','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'generated',
  `model` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `item_count` int NOT NULL DEFAULT '0',
  `open_bug_count` int NOT NULL DEFAULT '0',
  `pending_suggestion_count` int NOT NULL DEFAULT '0',
  `active_feature_count` int NOT NULL DEFAULT '0',
  `generated_json` json DEFAULT NULL,
  `error_text` text COLLATE utf8mb4_unicode_ci,
  `generated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_todo_snapshots_status` (`status`,`generated_at`),
  KEY `idx_admin_todo_snapshots_source_hash` (`source_hash`),
  KEY `idx_admin_todo_snapshots_generated_at` (`generated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_todo_snapshots`
--

LOCK TABLES `admin_todo_snapshots` WRITE;
/*!40000 ALTER TABLE `admin_todo_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_todo_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_user_roles`
--

DROP TABLE IF EXISTS `admin_user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_user_roles` (
  `admin_user_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_user_id`,`role_id`),
  KEY `fk_admin_user_roles_role` (`role_id`),
  CONSTRAINT `fk_admin_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `admin_roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_admin_user_roles_user` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_user_roles`
--

LOCK TABLES `admin_user_roles` WRITE;
/*!40000 ALTER TABLE `admin_user_roles` DISABLE KEYS */;
INSERT INTO `admin_user_roles` VALUES (1,1,'2026-07-11 01:51:37');
/*!40000 ALTER TABLE `admin_user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_users_steam_id64` (`steam_id64`),
  KEY `idx_admin_users_active` (`is_active`,`steam_id64`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,'76561190000000000','Codex Auth Test Owner','Local auth-test admin seeded by Codex.',1,'76561190000000000',NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37');
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_feedback_reviews`
--

DROP TABLE IF EXISTS `ai_feedback_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_feedback_reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_type` enum('feedback','suggestion') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `status` enum('skipped','failed','reviewed','applied') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'skipped',
  `model` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `action` enum('group_existing','create_public_card','close_invalid','needs_review','split_submission','none') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `confidence` decimal(5,4) NOT NULL DEFAULT '0.0000',
  `target_feature_id` bigint unsigned DEFAULT NULL,
  `target_suggestion_id` bigint unsigned DEFAULT NULL,
  `admin_note` text COLLATE utf8mb4_unicode_ci,
  `result_json` json DEFAULT NULL,
  `error_text` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_feedback_reviews_source` (`source_type`,`source_id`),
  KEY `idx_ai_feedback_reviews_status` (`status`,`updated_at`),
  KEY `idx_ai_feedback_reviews_feature` (`target_feature_id`),
  KEY `idx_ai_feedback_reviews_suggestion` (`target_suggestion_id`),
  CONSTRAINT `fk_ai_feedback_reviews_feature` FOREIGN KEY (`target_feature_id`) REFERENCES `feature_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ai_feedback_reviews_suggestion` FOREIGN KEY (`target_suggestion_id`) REFERENCES `feature_suggestions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_feedback_reviews`
--

LOCK TABLES `ai_feedback_reviews` WRITE;
/*!40000 ALTER TABLE `ai_feedback_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_feedback_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `airstrike_animation_bundles`
--

DROP TABLE IF EXISTS `airstrike_animation_bundles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airstrike_animation_bundles` (
  `revision` bigint unsigned NOT NULL AUTO_INCREMENT,
  `schema_version` int unsigned NOT NULL DEFAULT '2',
  `compiler_version` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bundle_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_count` int unsigned NOT NULL DEFAULT '0',
  `publish_notes` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `published_by` bigint unsigned DEFAULT NULL,
  `published_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`revision`),
  KEY `idx_airstrike_animation_bundle_sha` (`sha256`),
  KEY `idx_airstrike_animation_bundles_published` (`published_at`),
  KEY `fk_airstrike_animation_bundles_published_by` (`published_by`),
  CONSTRAINT `fk_airstrike_animation_bundles_published_by` FOREIGN KEY (`published_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `airstrike_animation_bundles`
--

LOCK TABLES `airstrike_animation_bundles` WRITE;
/*!40000 ALTER TABLE `airstrike_animation_bundles` DISABLE KEYS */;
/*!40000 ALTER TABLE `airstrike_animation_bundles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `airstrike_animation_profile_revisions`
--

DROP TABLE IF EXISTS `airstrike_animation_profile_revisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airstrike_animation_profile_revisions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `profile_id` bigint unsigned NOT NULL,
  `profile_revision` int unsigned NOT NULL,
  `bundle_revision` bigint unsigned NOT NULL,
  `source_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `runtime_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `runtime_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publish_notes` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_airstrike_animation_profile_revision` (`profile_id`,`profile_revision`),
  KEY `idx_airstrike_animation_profile_bundle` (`bundle_revision`,`profile_id`),
  KEY `fk_airstrike_animation_revisions_created_by` (`created_by`),
  CONSTRAINT `fk_airstrike_animation_revisions_bundle` FOREIGN KEY (`bundle_revision`) REFERENCES `airstrike_animation_bundles` (`revision`) ON DELETE RESTRICT,
  CONSTRAINT `fk_airstrike_animation_revisions_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_airstrike_animation_revisions_profile` FOREIGN KEY (`profile_id`) REFERENCES `airstrike_animation_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `airstrike_animation_profile_revisions`
--

LOCK TABLES `airstrike_animation_profile_revisions` WRITE;
/*!40000 ALTER TABLE `airstrike_animation_profile_revisions` DISABLE KEYS */;
/*!40000 ALTER TABLE `airstrike_animation_profile_revisions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `airstrike_animation_profiles`
--

DROP TABLE IF EXISTS `airstrike_animation_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airstrike_animation_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `profile_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `vehicle` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `draft_source_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `draft_source_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `draft_version` int unsigned NOT NULL DEFAULT '1',
  `last_published_profile_revision` int unsigned DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_airstrike_animation_profile_key` (`profile_key`),
  KEY `idx_airstrike_animation_profiles_active` (`archived_at`,`profile_key`),
  KEY `idx_airstrike_animation_profiles_updated` (`updated_at`),
  KEY `fk_airstrike_animation_profiles_created_by` (`created_by`),
  KEY `fk_airstrike_animation_profiles_updated_by` (`updated_by`),
  CONSTRAINT `fk_airstrike_animation_profiles_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_airstrike_animation_profiles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `airstrike_animation_profiles`
--

LOCK TABLES `airstrike_animation_profiles` WRITE;
/*!40000 ALTER TABLE `airstrike_animation_profiles` DISABLE KEYS */;
INSERT INTO `airstrike_animation_profiles` VALUES (1,'codex_full_migration_1783734757748','Codex Full Migration Test Profile','f15','{\"DisplayName\":\"Codex Full Migration Test Profile\",\"DurationSeconds\":8,\"EditorMetadata\":{\"Notes\":\"\",\"Tags\":[],\"VehiclePreviewOverrides\":[]},\"EditorSourceSchemaVersion\":1,\"FirstPayloadDelaySeconds\":3.5,\"MinimumTerrainClearance\":55,\"PositionInterpolation\":\"time_hermite\",\"ProfileKey\":\"codex_full_migration_1783734757748\",\"ReleaseSource\":{\"Events\":[],\"FallbackIntervalSeconds\":0.5,\"LegacyDynamic\":true,\"Mode\":\"manual\",\"Template\":{\"CarrierOffsetX\":0,\"CarrierOffsetY\":0,\"CarrierOffsetZ\":0,\"Count\":1,\"DamageScale\":1,\"DamageScales\":[],\"FuseSeconds\":-1,\"ImpactRadius\":-1,\"LaunchSpeed\":-1,\"MaxTrackingDistance\":-1,\"MaxTrackingSeconds\":-1,\"Payload\":\"hv_rocket\",\"SplashRadius\":-1,\"SpreadRadius\":-1,\"TargetOffsetX\":0,\"TargetOffsetY\":0,\"TargetOffsetZ\":0,\"VehicleDamageScale\":-1}},\"RotationMode\":\"follow_path_plus_offset\",\"RotationSmoothTimeSeconds\":0.12,\"StopAtWaypoints\":false,\"Vehicle\":\"f15\",\"Waypoints\":[{\"Id\":\"wp_001\",\"RotationX\":0,\"RotationY\":0,\"RotationZ\":0,\"Time\":0,\"X\":0,\"Y\":90,\"Z\":-300},{\"Id\":\"wp_002\",\"RotationX\":-15,\"RotationY\":0,\"RotationZ\":0,\"Time\":3.5,\"X\":0,\"Y\":60,\"Z\":0},{\"Id\":\"wp_003\",\"RotationX\":0,\"RotationY\":0,\"RotationZ\":0,\"Time\":8,\"X\":0,\"Y\":90,\"Z\":300}]}','d2b0bf3f077689ac611bd792166c999297d6b7b6b4c9a936c17a85c71bf5ad16',1,NULL,NULL,1,1,'2026-07-11 01:52:37','2026-07-11 01:52:37');
/*!40000 ALTER TABLE `airstrike_animation_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `airstrike_animation_server_snapshots`
--

DROP TABLE IF EXISTS `airstrike_animation_server_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airstrike_animation_server_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `based_on_revision` bigint unsigned DEFAULT NULL,
  `reason` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_profile_keys_json` longtext COLLATE utf8mb4_unicode_ci,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `conflict_message` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `imported_at` timestamp NULL DEFAULT NULL,
  `imported_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_airstrike_animation_snapshot_server_sha` (`server_id`,`sha256`),
  KEY `idx_airstrike_animation_snapshots_queue` (`server_id`,`status`,`received_at`),
  KEY `idx_airstrike_animation_snapshots_revision` (`based_on_revision`),
  KEY `fk_airstrike_animation_snapshots_imported_by` (`imported_by`),
  CONSTRAINT `fk_airstrike_animation_snapshots_imported_by` FOREIGN KEY (`imported_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `airstrike_animation_server_snapshots`
--

LOCK TABLES `airstrike_animation_server_snapshots` WRITE;
/*!40000 ALTER TABLE `airstrike_animation_server_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `airstrike_animation_server_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `airstrike_animation_server_syncs`
--

DROP TABLE IF EXISTS `airstrike_animation_server_syncs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airstrike_animation_server_syncs` (
  `server_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `installed_revision` bigint unsigned DEFAULT NULL,
  `installed_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `local_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `local_dirty` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'never_contacted',
  `message` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `plugin_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `runtime_plugin_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `editor_plugin_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `installed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`),
  KEY `idx_airstrike_animation_sync_status` (`status`,`updated_at`),
  KEY `idx_airstrike_animation_sync_revision` (`installed_revision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `airstrike_animation_server_syncs`
--

LOCK TABLES `airstrike_animation_server_syncs` WRITE;
/*!40000 ALTER TABLE `airstrike_animation_server_syncs` DISABLE KEYS */;
/*!40000 ALTER TABLE `airstrike_animation_server_syncs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `animation_diagnostics`
--

DROP TABLE IF EXISTS `animation_diagnostics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `animation_diagnostics` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned DEFAULT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `event_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `page_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `page_url` varchar(700) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `referrer_url` varchar(700) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `viewport_width` smallint unsigned NOT NULL DEFAULT '0',
  `viewport_height` smallint unsigned NOT NULL DEFAULT '0',
  `device_pixel_ratio` decimal(5,2) NOT NULL DEFAULT '0.00',
  `reduced_motion` tinyint(1) DEFAULT NULL,
  `mobile_performance` tinyint(1) DEFAULT NULL,
  `loader_should_show` tinyint(1) DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `details_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_animation_diagnostics_player_time` (`steam_id64`,`created_at`),
  KEY `idx_animation_diagnostics_session_time` (`session_hash`,`created_at`),
  KEY `idx_animation_diagnostics_event_time` (`event_type`,`created_at`),
  KEY `idx_animation_diagnostics_page_time` (`page_id`,`created_at`),
  KEY `fk_animation_diagnostics_player` (`player_id`),
  CONSTRAINT `fk_animation_diagnostics_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `animation_diagnostics`
--

LOCK TABLES `animation_diagnostics` WRITE;
/*!40000 ALTER TABLE `animation_diagnostics` DISABLE KEYS */;
INSERT INTO `animation_diagnostics` VALUES (1,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T10:00:52.803Z\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}','2026-07-11 10:00:53'),(2,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:00:53.014Z\"}','2026-07-11 10:00:53'),(3,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_runtime_config','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"startupMs\": 1500, \"hasLoadGate\": true, \"maxVisibleMs\": 5000, \"minVisibleMs\": 1500, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:00:53.016Z\", \"mobilePerformance\": false, \"documentReadyState\": \"loading\", \"explosionAssetCount\": 6, \"mobileExplosionAssetCount\": 2}','2026-07-11 10:00:53'),(4,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.75, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:00:53.131Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:00:53'),(5,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}, \"loaderSkipped\": false, \"recordedAtClient\": \"2026-07-11T10:00:53.131Z\"}','2026-07-11 10:00:53'),(6,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_explosion_assets','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"mode\": \"desktop\", \"failed\": 0, \"loaded\": 6, \"expected\": 6, \"recordedAtClient\": \"2026-07-11T10:00:53.170Z\"}','2026-07-11 10:00:53'),(7,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 408}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:00:53.186Z\"}','2026-07-11 10:00:53'),(8,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_reveal','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"elapsedMs\": 2814, \"typedLines\": 14, \"expectedLines\": 20, \"reducedMotion\": false, \"currentProgress\": 100, \"recordedAtClient\": \"2026-07-11T10:00:55.829Z\", \"mobilePerformance\": false, \"mobileExplosionAssetsReady\": false}','2026-07-11 10:00:56'),(9,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"site-reveal\", \"rootClassName\": \"raidlands-loading raidlands-loader-fading\", \"recordedAtClient\": \"2026-07-11T10:00:57.165Z\", \"documentReadyState\": \"complete\"}','2026-07-11 10:00:57'),(10,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:00:57.165Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 10:00:57'),(11,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T10:00:57.165Z\", \"mobilePerformance\": false}','2026-07-11 10:00:57'),(12,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T10:00:57.166Z\", \"requestIdleCallback\": true}','2026-07-11 10:00:57'),(13,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T10:00:57.281Z\", \"mobilePerformance\": false}','2026-07-11 10:00:57'),(14,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T10:01:01.224Z\", \"sessionStorageHadSeen\": true, \"sessionStorageReadable\": true}','2026-07-11 10:01:01'),(15,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:01:01.229Z\"}','2026-07-11 10:01:01'),(16,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_skipped','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"session\", \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:01:01.229Z\"}','2026-07-11 10:01:01'),(17,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.75, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loader-skipped\", \"recordedAtClient\": \"2026-07-11T10:01:01.231Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:01:01'),(18,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": false, \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": true, \"sessionStorageReadable\": true}, \"loaderSkipped\": true, \"recordedAtClient\": \"2026-07-11T10:01:01.231Z\"}','2026-07-11 10:01:01'),(19,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"immediate\", \"rootClassName\": \"raidlands-loader-skipped\", \"recordedAtClient\": \"2026-07-11T10:01:01.231Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:01:01'),(20,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:01:01.231Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 10:01:01'),(21,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T10:01:01.232Z\", \"mobilePerformance\": false}','2026-07-11 10:01:01'),(22,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T10:01:01.232Z\", \"requestIdleCallback\": true}','2026-07-11 10:01:01'),(23,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 92}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loader-skipped motion-ready\", \"recordedAtClient\": \"2026-07-11T10:01:01.267Z\"}','2026-07-11 10:01:01'),(24,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T10:01:01.294Z\", \"mobilePerformance\": false}','2026-07-11 10:01:01'),(25,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T10:42:23.205Z\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}','2026-07-11 10:42:23'),(26,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:42:23.219Z\"}','2026-07-11 10:42:23'),(27,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_runtime_config','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"startupMs\": 1500, \"hasLoadGate\": true, \"maxVisibleMs\": 5000, \"minVisibleMs\": 1500, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:42:23.220Z\", \"mobilePerformance\": false, \"documentReadyState\": \"loading\", \"explosionAssetCount\": 6, \"mobileExplosionAssetCount\": 2}','2026-07-11 10:42:23'),(28,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.75, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:42:23.222Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:42:23'),(29,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}, \"loaderSkipped\": false, \"recordedAtClient\": \"2026-07-11T10:42:23.222Z\"}','2026-07-11 10:42:23'),(30,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_explosion_assets','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"mode\": \"desktop\", \"failed\": 0, \"loaded\": 6, \"expected\": 6, \"recordedAtClient\": \"2026-07-11T10:42:23.357Z\"}','2026-07-11 10:42:23'),(31,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 150}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:42:23.363Z\"}','2026-07-11 10:42:23'),(32,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_reveal','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"elapsedMs\": 2357, \"typedLines\": 14, \"expectedLines\": 20, \"reducedMotion\": false, \"currentProgress\": 100, \"recordedAtClient\": \"2026-07-11T10:42:25.577Z\", \"mobilePerformance\": false, \"mobileExplosionAssetsReady\": false}','2026-07-11 10:42:26'),(33,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"site-reveal\", \"rootClassName\": \"raidlands-loading raidlands-loader-fading\", \"recordedAtClient\": \"2026-07-11T10:42:26.907Z\", \"documentReadyState\": \"complete\"}','2026-07-11 10:42:27'),(34,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:42:26.907Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 10:42:27'),(35,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T10:42:26.908Z\", \"mobilePerformance\": false}','2026-07-11 10:42:27'),(36,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T10:42:26.908Z\", \"requestIdleCallback\": true}','2026-07-11 10:42:27'),(37,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T10:42:26.991Z\", \"mobilePerformance\": false}','2026-07-11 10:42:27'),(38,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T10:42:34.191Z\", \"sessionStorageHadSeen\": true, \"sessionStorageReadable\": true}','2026-07-11 10:42:34'),(39,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:42:34.194Z\"}','2026-07-11 10:42:34'),(40,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_skipped','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"session\", \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:42:34.194Z\"}','2026-07-11 10:42:34'),(41,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.75, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loader-skipped\", \"recordedAtClient\": \"2026-07-11T10:42:34.195Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:42:34'),(42,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": false, \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": true, \"sessionStorageReadable\": true}, \"loaderSkipped\": true, \"recordedAtClient\": \"2026-07-11T10:42:34.195Z\"}','2026-07-11 10:42:34'),(43,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"immediate\", \"rootClassName\": \"raidlands-loader-skipped\", \"recordedAtClient\": \"2026-07-11T10:42:34.195Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:42:34'),(44,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:42:34.195Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 10:42:34'),(45,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T10:42:34.196Z\", \"mobilePerformance\": false}','2026-07-11 10:42:34'),(46,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T10:42:34.196Z\", \"requestIdleCallback\": true}','2026-07-11 10:42:34'),(47,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 57}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loader-skipped motion-ready\", \"recordedAtClient\": \"2026-07-11T10:42:34.217Z\"}','2026-07-11 10:42:34'),(48,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T10:42:34.234Z\", \"mobilePerformance\": false}','2026-07-11 10:42:34'),(49,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T10:52:22.181Z\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}','2026-07-11 10:52:23'),(50,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:52:22.187Z\"}','2026-07-11 10:52:23'),(51,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_runtime_config','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"startupMs\": 1500, \"hasLoadGate\": true, \"maxVisibleMs\": 5000, \"minVisibleMs\": 1500, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:52:22.188Z\", \"mobilePerformance\": false, \"documentReadyState\": \"loading\", \"explosionAssetCount\": 6, \"mobileExplosionAssetCount\": 2}','2026-07-11 10:52:23'),(52,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.5, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:52:22.195Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:52:23'),(53,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}, \"loaderSkipped\": false, \"recordedAtClient\": \"2026-07-11T10:52:22.195Z\"}','2026-07-11 10:52:23'),(54,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 217}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:52:22.375Z\"}','2026-07-11 10:52:23'),(55,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_explosion_assets','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"mode\": \"desktop\", \"failed\": 6, \"loaded\": 0, \"expected\": 6, \"recordedAtClient\": \"2026-07-11T10:52:29.306Z\"}','2026-07-11 10:52:30'),(56,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_reveal','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"elapsedMs\": 8125, \"typedLines\": 0, \"expectedLines\": 20, \"reducedMotion\": false, \"currentProgress\": 0, \"recordedAtClient\": \"2026-07-11T10:52:30.312Z\", \"mobilePerformance\": false, \"mobileExplosionAssetsReady\": false}','2026-07-11 10:52:31'),(57,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"loader-timeout\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:52:31.313Z\", \"documentReadyState\": \"complete\"}','2026-07-11 10:52:32'),(58,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:52:31.313Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 10:52:32'),(59,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T10:52:31.313Z\", \"mobilePerformance\": false}','2026-07-11 10:52:32'),(60,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T10:52:31.314Z\", \"requestIdleCallback\": true}','2026-07-11 10:52:32'),(61,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T10:52:31.314Z\", \"mobilePerformance\": false}','2026-07-11 10:52:32'),(62,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T10:52:47.409Z\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}','2026-07-11 10:52:48'),(63,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T10:52:47.416Z\"}','2026-07-11 10:52:48'),(64,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_runtime_config','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"startupMs\": 1500, \"hasLoadGate\": true, \"maxVisibleMs\": 5000, \"minVisibleMs\": 1500, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:52:47.417Z\", \"mobilePerformance\": false, \"documentReadyState\": \"loading\", \"explosionAssetCount\": 6, \"mobileExplosionAssetCount\": 2}','2026-07-11 10:52:48'),(65,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.5, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:52:47.421Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 10:52:48'),(66,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}, \"loaderSkipped\": false, \"recordedAtClient\": \"2026-07-11T10:52:47.422Z\"}','2026-07-11 10:52:48'),(67,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 236}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:52:47.592Z\"}','2026-07-11 10:52:48'),(68,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_explosion_assets','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"mode\": \"desktop\", \"failed\": 6, \"loaded\": 0, \"expected\": 6, \"recordedAtClient\": \"2026-07-11T10:52:54.320Z\"}','2026-07-11 10:52:55'),(69,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_reveal','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"elapsedMs\": 7891, \"typedLines\": 0, \"expectedLines\": 20, \"reducedMotion\": false, \"currentProgress\": 0, \"recordedAtClient\": \"2026-07-11T10:52:55.308Z\", \"mobilePerformance\": false, \"mobileExplosionAssetsReady\": false}','2026-07-11 10:52:56'),(70,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"loader-timeout\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T10:52:57.306Z\", \"documentReadyState\": \"complete\"}','2026-07-11 10:52:58'),(71,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T10:52:57.306Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 10:52:58'),(72,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T10:52:57.308Z\", \"mobilePerformance\": false}','2026-07-11 10:52:58'),(73,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T10:52:57.309Z\", \"requestIdleCallback\": true}','2026-07-11 10:52:58'),(74,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T10:52:57.319Z\", \"mobilePerformance\": false}','2026-07-11 10:52:58'),(75,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T11:01:29.184Z\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}','2026-07-11 11:01:29'),(76,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T11:01:29.198Z\"}','2026-07-11 11:01:29'),(77,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_runtime_config','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"startupMs\": 1500, \"hasLoadGate\": true, \"maxVisibleMs\": 5000, \"minVisibleMs\": 1500, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T11:01:29.199Z\", \"mobilePerformance\": false, \"documentReadyState\": \"loading\", \"explosionAssetCount\": 6, \"mobileExplosionAssetCount\": 2}','2026-07-11 11:01:29'),(78,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.45, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T11:01:29.201Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 11:01:29'),(79,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": true, \"loaderSession\": {\"shouldShow\": true, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": false, \"sessionStorageReadable\": true}, \"loaderSkipped\": false, \"recordedAtClient\": \"2026-07-11T11:01:29.201Z\"}','2026-07-11 11:01:29'),(80,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_explosion_assets','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"mode\": \"desktop\", \"failed\": 0, \"loaded\": 6, \"expected\": 6, \"recordedAtClient\": \"2026-07-11T11:01:29.337Z\"}','2026-07-11 11:01:29'),(81,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 163}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loading\", \"recordedAtClient\": \"2026-07-11T11:01:29.343Z\"}','2026-07-11 11:01:29'),(82,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_reveal','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"elapsedMs\": 2346, \"typedLines\": 14, \"expectedLines\": 20, \"reducedMotion\": false, \"currentProgress\": 100, \"recordedAtClient\": \"2026-07-11T11:01:31.544Z\", \"mobilePerformance\": false, \"mobileExplosionAssetsReady\": false}','2026-07-11 11:01:32'),(83,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"site-reveal\", \"rootClassName\": \"raidlands-loading raidlands-loader-fading\", \"recordedAtClient\": \"2026-07-11T11:01:32.874Z\", \"documentReadyState\": \"complete\"}','2026-07-11 11:01:33'),(84,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T11:01:32.874Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 11:01:33'),(85,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T11:01:32.875Z\", \"mobilePerformance\": false}','2026-07-11 11:01:33'),(86,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T11:01:32.875Z\", \"requestIdleCallback\": true}','2026-07-11 11:01:33'),(87,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T11:01:32.913Z\", \"mobilePerformance\": false}','2026-07-11 11:01:33'),(88,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_decision','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"rootClassName\": \"\", \"navigationType\": \"navigate\", \"recordedAtClient\": \"2026-07-11T11:01:38.453Z\", \"sessionStorageHadSeen\": true, \"sessionStorageReadable\": true}','2026-07-11 11:01:38'),(89,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_script_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"hasLoader\": true, \"hasDataNode\": true, \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T11:01:38.456Z\"}','2026-07-11 11:01:38'),(90,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','loader_skipped','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"session\", \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\"}, \"recordedAtClient\": \"2026-07-11T11:01:38.456Z\"}','2026-07-11 11:01:38'),(91,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','site_script_ready','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"connection\": {\"rtt\": 50, \"downlink\": 1.45, \"saveData\": false, \"effectiveType\": \"4g\"}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loader-skipped\", \"recordedAtClient\": \"2026-07-11T11:01:38.457Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 11:01:38'),(92,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_gate','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"rootLoading\": false, \"loaderSession\": {\"shouldShow\": false, \"storageKey\": \"raidlands-loader-seen\", \"navigationType\": \"navigate\", \"sessionStorageHadSeen\": true, \"sessionStorageReadable\": true}, \"loaderSkipped\": true, \"recordedAtClient\": \"2026-07-11T11:01:38.458Z\"}','2026-07-11 11:01:38'),(93,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_start','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"reason\": \"immediate\", \"rootClassName\": \"raidlands-loader-skipped\", \"recordedAtClient\": \"2026-07-11T11:01:38.458Z\", \"documentReadyState\": \"interactive\"}','2026-07-11 11:01:38'),(94,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','effects_configured','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"matchMedia\": true, \"reducedMotion\": false, \"recordedAtClient\": \"2026-07-11T11:01:38.458Z\", \"mobilePerformance\": false, \"requestIdleCallback\": true, \"intersectionObserver\": true}','2026-07-11 11:01:38'),(95,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','scroll_reveals_initialized','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"count\": 13, \"threshold\": 0.12, \"rootMargin\": \"0px 0px -12% 0px\", \"recordedAtClient\": \"2026-07-11T11:01:38.458Z\", \"mobilePerformance\": false}','2026-07-11 11:01:38'),(96,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_queued','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"recordedAtClient\": \"2026-07-11T11:01:38.459Z\", \"requestIdleCallback\": true}','2026-07-11 11:01:38'),(97,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','window_loaded','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"performance\": {\"type\": \"navigate\", \"loadMs\": 0, \"transferSize\": 31684, \"domContentLoadedMs\": 64}, \"appClassName\": \"\", \"rootClassName\": \"raidlands-loader-skipped motion-ready\", \"recordedAtClient\": \"2026-07-11T11:01:38.482Z\"}','2026-07-11 11:01:38'),(98,1,'76561190000000000','cd74eefbf1e5f4ad4d4290ee6df7dfc427b39782a492e99e29be60127006af2a','ember_field_created','server','http://localhost/raidlands/server/','',1280,720,1.00,0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"isMobile\": false, \"particleCount\": 40, \"recordedAtClient\": \"2026-07-11T11:01:38.500Z\", \"mobilePerformance\": false}','2026-07-11 11:01:38');
/*!40000 ALTER TABLE `animation_diagnostics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_rate_limits`
--

DROP TABLE IF EXISTS `api_rate_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_rate_limits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `rate_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `window_start` timestamp NOT NULL,
  `request_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_api_rate_limit_window` (`rate_key`,`route_key`,`window_start`),
  KEY `idx_api_rate_limits_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_rate_limits`
--

LOCK TABLES `api_rate_limits` WRITE;
/*!40000 ALTER TABLE `api_rate_limits` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_rate_limits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bot_wipe_stats`
--

DROP TABLE IF EXISTS `bot_wipe_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bot_wipe_stats` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `wipe_id` bigint unsigned NOT NULL,
  `bot_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `kit_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `skill_tier` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `raw_kills` int unsigned NOT NULL DEFAULT '0',
  `raw_deaths` int unsigned NOT NULL DEFAULT '0',
  `baseline_kills` int unsigned NOT NULL DEFAULT '0',
  `baseline_deaths` int unsigned NOT NULL DEFAULT '0',
  `kills` int unsigned NOT NULL DEFAULT '0',
  `deaths` int unsigned NOT NULL DEFAULT '0',
  `kdr` decimal(10,3) NOT NULL DEFAULT '0.000',
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bot_wipe_stats_bot` (`wipe_id`,`bot_key`),
  KEY `idx_bot_wipe_stats_kills` (`wipe_id`,`kills`,`deaths`),
  KEY `idx_bot_wipe_stats_kdr` (`wipe_id`,`kdr`,`kills`),
  KEY `idx_bot_wipe_stats_bot_key` (`bot_key`),
  CONSTRAINT `fk_bot_wipe_stats_wipe` FOREIGN KEY (`wipe_id`) REFERENCES `wipe_seasons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bot_wipe_stats`
--

LOCK TABLES `bot_wipe_stats` WRITE;
/*!40000 ALTER TABLE `bot_wipe_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `bot_wipe_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bridge_sync_cursors`
--

DROP TABLE IF EXISTS `bridge_sync_cursors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bridge_sync_cursors` (
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_cursor` bigint unsigned NOT NULL DEFAULT '0',
  `last_seen_changed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bridge_sync_cursors`
--

LOCK TABLES `bridge_sync_cursors` WRITE;
/*!40000 ALTER TABLE `bridge_sync_cursors` DISABLE KEYS */;
/*!40000 ALTER TABLE `bridge_sync_cursors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned DEFAULT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `steam_avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `steam_profile_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_staff` tinyint(1) NOT NULL DEFAULT '0',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('visible','hidden') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'visible',
  `hidden_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hidden_reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `hidden_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_messages_public` (`status`,`id`),
  KEY `idx_chat_messages_created` (`created_at`,`id`),
  KEY `idx_chat_messages_player_time` (`steam_id64`,`created_at`),
  KEY `fk_chat_messages_player` (`player_id`),
  CONSTRAINT `fk_chat_messages_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_moderation_actions`
--

DROP TABLE IF EXISTS `chat_moderation_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_moderation_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `message_id` bigint unsigned DEFAULT NULL,
  `target_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `actor_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `action` enum('hide','restore','mute','unmute') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `details_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_moderation_message` (`message_id`,`created_at`),
  KEY `idx_chat_moderation_target` (`target_steam_id64`,`created_at`),
  KEY `idx_chat_moderation_actor` (`actor_steam_id64`,`created_at`),
  CONSTRAINT `fk_chat_moderation_message` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_moderation_actions`
--

LOCK TABLES `chat_moderation_actions` WRITE;
/*!40000 ALTER TABLE `chat_moderation_actions` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_moderation_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_mutes`
--

DROP TABLE IF EXISTS `chat_mutes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_mutes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `muted_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `expires_at` timestamp NULL DEFAULT NULL,
  `revoked_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_mutes_player_active` (`steam_id64`,`is_active`,`expires_at`),
  KEY `idx_chat_mutes_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_mutes`
--

LOCK TABLES `chat_mutes` WRITE;
/*!40000 ALTER TABLE `chat_mutes` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_mutes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clan_action_queue`
--

DROP TABLE IF EXISTS `clan_action_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clan_action_queue` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clan_tag` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `actor_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `target_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `target_display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `status` enum('queued','processing','succeeded','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `result_json` longtext COLLATE utf8mb4_unicode_ci,
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `claimed_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clan_action_queue_poll` (`server_id`,`status`,`id`),
  KEY `idx_clan_action_queue_actor` (`server_id`,`actor_steam_id64`,`created_at`),
  KEY `idx_clan_action_queue_clan` (`server_id`,`clan_tag`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clan_action_queue`
--

LOCK TABLES `clan_action_queue` WRITE;
/*!40000 ALTER TABLE `clan_action_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `clan_action_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clan_members`
--

DROP TABLE IF EXISTS `clan_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clan_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clan_tag` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `role` enum('owner','moderator','member') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member',
  `is_online` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clan_members_server_player` (`server_id`,`steam_id64`),
  KEY `idx_clan_members_clan` (`server_id`,`clan_tag`,`role`),
  KEY `idx_clan_members_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clan_members`
--

LOCK TABLES `clan_members` WRITE;
/*!40000 ALTER TABLE `clan_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `clan_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clan_snapshots`
--

DROP TABLE IF EXISTS `clan_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clan_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clan_tag` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `owner_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `tag_color` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `moderators_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `members_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_invites_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `allies_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `invited_allies_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clan_snapshots_server_tag` (`server_id`,`clan_tag`),
  KEY `idx_clan_snapshots_owner` (`server_id`,`owner_steam_id64`),
  KEY `idx_clan_snapshots_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clan_snapshots`
--

LOCK TABLES `clan_snapshots` WRITE;
/*!40000 ALTER TABLE `clan_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `clan_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entitlements`
--

DROP TABLE IF EXISTS `entitlements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entitlements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `source_type` enum('order','subscription','manual','rp_purchase','rp_subscription') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `oxide_group` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('pending','active','revoked','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `starts_at` timestamp NULL DEFAULT NULL,
  `ends_at` timestamp NULL DEFAULT NULL,
  `last_synced_at` timestamp NULL DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entitlements_source_product` (`source_type`,`source_id`,`product_id`),
  KEY `idx_entitlements_player_status` (`player_id`,`status`),
  KEY `idx_entitlements_changed` (`changed_at`),
  KEY `fk_entitlements_product` (`product_id`),
  CONSTRAINT `fk_entitlements_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_entitlements_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entitlements`
--

LOCK TABLES `entitlements` WRITE;
/*!40000 ALTER TABLE `entitlements` DISABLE KEYS */;
/*!40000 ALTER TABLE `entitlements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feature_items`
--

DROP TABLE IF EXISTS `feature_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon_alias` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EVENT',
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `category` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `public_status` enum('active','voting','planned','in_development','under_review','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'under_review',
  `is_public` tinyint(1) NOT NULL DEFAULT '1',
  `is_voteable` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '100',
  `created_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feature_items_slug` (`slug`),
  KEY `idx_feature_items_public_status` (`is_public`,`public_status`,`sort_order`),
  KEY `idx_feature_items_voteable` (`is_voteable`,`public_status`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature_items`
--

LOCK TABLES `feature_items` WRITE;
/*!40000 ALTER TABLE `feature_items` DISABLE KEYS */;
INSERT INTO `feature_items` VALUES (1,'1000x-gather','GATHER','1000x Gather','Farm fast, gear fast, and spend more time fighting than waiting.','Combat and Raiding','active',1,0,10,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,'battlefield-pvp','PVP','Battlefield PvP','A high-rate battlefield tuned for counters, chaos, and quick returns.','Combat and Raiding','active',1,0,20,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(3,'kits','KIT','Kits','Fast starter and combat kits keep the pace moving after every death.','Movement and Convenience','active',1,0,30,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(4,'teleport-homes','TP','Teleport / Homes','Move between bases, fights, teammates, and rebuilds without dead time.','Movement and Convenience','active',1,0,40,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(5,'clans','CLAN','Clans','Build your team name around rivalries and wipe-long wars.','Community and Clans','active',1,0,50,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(6,'skinbox','SKIN','Skinbox','Keep bases and gear looking sharp without breaking the battlefield pace.','Movement and Convenience','active',1,0,60,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(7,'backpacks','PACK','Backpacks','Extra carry capacity for raiders, builders, and loot runners.','Movement and Convenience','active',1,0,70,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(8,'personal-mini','MINI','Personal Mini','Fast map movement for scouts, counters, and strike teams.','Movement and Convenience','active',1,0,80,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(9,'shop','SHOP','Shop','High-rate convenience economy for supplies, movement, and recovery.','Movement and Convenience','active',1,0,90,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(10,'custom-events','EVENT','Custom Events','Wipe fights, clan clashes, and staff-run chaos during live seasons.','Community and Clans','active',1,0,100,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(11,'active-staff','STAFF','Active Staff','Clear support, bug response, and rule enforcement without over-policing PvP.','Trust and Performance','active',1,0,110,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(12,'performance-focused','FPS','Performance Focused','Lean systems and practical moderation built around stable wipe nights.','Trust and Performance','active',1,0,120,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(13,'leaderboards','STAT','Leaderboards','Player rankings for kills, K/D, playtime, and RP sync from the game server.','Website Systems','active',1,0,130,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(14,'player-profiles','ID','Player Profiles','Connected Steam profiles show VIP access, wipe stats, RP, and entitlement history.','Website Systems','active',1,0,140,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(15,'account-linking','ID','Account Linking','Native Steam sign-in ties stats, VIP, and perks to the right Rust player.','Website Systems','active',1,0,150,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(16,'vip-kits','KIT','VIP Kits','VIP tiers and one-time perks are tied to Steam and synced into the game.','Store and Rewards','active',1,0,160,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(17,'clan-web-pages','CLAN','Clan Website Pages','Clan play and rivalries are active in game, with richer website pages able to build on top.','Community and Clans','voting',1,1,170,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(18,'wipe-events','EVENT','Wipe Events','Wipe fights, clan clashes, staff battles, and community chaos are part of the live cadence.','Community and Clans','active',1,0,180,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(19,'vote-rewards','PLAY','Vote Rewards','Voting loops can plug into the connected account layer as the web hub expands.','Store and Rewards','voting',1,1,190,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35'),(20,'appeals-and-support','APPEAL','Appeals and Support','Discord remains the active path for tickets, reports, and ban appeals.','Trust and Performance','active',1,0,200,'76561198274680338','2026-07-11 01:51:35','2026-07-11 01:51:35');
/*!40000 ALTER TABLE `feature_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feature_suggestions`
--

DROP TABLE IF EXISTS `feature_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_suggestions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `feature_id` bigint unsigned DEFAULT NULL,
  `support_feedback_id` bigint unsigned DEFAULT NULL,
  `parent_suggestion_id` bigint unsigned DEFAULT NULL,
  `split_group_key` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `split_index` int DEFAULT NULL,
  `player_id` bigint unsigned DEFAULT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source_type` enum('public','feedback','staff','staff_import') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'public',
  `ai_kind` enum('bug','suggestion','feature_request') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','grouped','rejected','split') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_note` text COLLATE utf8mb4_unicode_ci,
  `created_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feature_suggestions_feedback` (`support_feedback_id`),
  UNIQUE KEY `uq_feature_suggestions_split_group` (`split_group_key`,`split_index`),
  KEY `idx_feature_suggestions_status` (`status`,`created_at`),
  KEY `idx_feature_suggestions_feature` (`feature_id`,`status`),
  KEY `idx_feature_suggestions_player` (`player_id`,`created_at`),
  KEY `idx_feature_suggestions_steam` (`steam_id64`,`created_at`),
  KEY `idx_feature_suggestions_parent` (`parent_suggestion_id`,`split_index`),
  KEY `idx_feature_suggestions_split_group` (`split_group_key`,`split_index`),
  CONSTRAINT `fk_feature_suggestions_feature` FOREIGN KEY (`feature_id`) REFERENCES `feature_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_feature_suggestions_feedback` FOREIGN KEY (`support_feedback_id`) REFERENCES `support_feedback` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_feature_suggestions_parent` FOREIGN KEY (`parent_suggestion_id`) REFERENCES `feature_suggestions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_feature_suggestions_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature_suggestions`
--

LOCK TABLES `feature_suggestions` WRITE;
/*!40000 ALTER TABLE `feature_suggestions` DISABLE KEYS */;
/*!40000 ALTER TABLE `feature_suggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feature_votes`
--

DROP TABLE IF EXISTS `feature_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_votes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `feature_id` bigint unsigned NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vote_window_start` datetime NOT NULL,
  `vote_window_end` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feature_votes_player_feature_window` (`player_id`,`feature_id`,`vote_window_start`),
  KEY `idx_feature_votes_feature_window` (`feature_id`,`vote_window_start`),
  KEY `idx_feature_votes_player_window` (`player_id`,`vote_window_start`),
  CONSTRAINT `fk_feature_votes_feature` FOREIGN KEY (`feature_id`) REFERENCES `feature_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_feature_votes_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature_votes`
--

LOCK TABLES `feature_votes` WRITE;
/*!40000 ALTER TABLE `feature_votes` DISABLE KEYS */;
/*!40000 ALTER TABLE `feature_votes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_kit_items`
--

DROP TABLE IF EXISTS `game_kit_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_kit_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `kit_id` bigint unsigned NOT NULL,
  `container_name` enum('main','wear','belt') COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `shortname` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skin` bigint unsigned NOT NULL DEFAULT '0',
  `amount` int NOT NULL DEFAULT '1',
  `condition_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `max_condition` decimal(10,2) NOT NULL DEFAULT '0.00',
  `ammo` int NOT NULL DEFAULT '0',
  `ammo_type` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `frequency` int NOT NULL DEFAULT '-1',
  `blueprint_shortname` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `text_value` text COLLATE utf8mb4_unicode_ci,
  `contents_json` json DEFAULT NULL,
  `container_json` json DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '100',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_game_kit_items_kit_container` (`kit_id`,`container_name`,`position`,`sort_order`),
  CONSTRAINT `fk_game_kit_items_kit` FOREIGN KEY (`kit_id`) REFERENCES `game_kits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1022 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_kit_items`
--

LOCK TABLES `game_kit_items` WRITE;
/*!40000 ALTER TABLE `game_kit_items` DISABLE KEYS */;
INSERT INTO `game_kit_items` VALUES (28,2,'main',0,'ammo.rocket.basic',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(29,2,'main',1,'ammo.rocket.hv',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(30,2,'main',2,'electric.generator.small',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(31,2,'main',3,'weapon.mod.lasersight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(32,2,'main',4,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(33,2,'main',5,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(34,2,'main',6,'ammo.rifle.explosive',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(35,2,'main',7,'ammo.rifle',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,8,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(36,2,'main',8,'weapon.mod.small.scope',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,9,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(37,2,'main',9,'weapon.mod.silencer',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(38,2,'main',10,'weapon.mod.muzzlebrake',NULL,0,1,200.00,200.00,0,NULL,-1,NULL,NULL,NULL,NULL,11,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(39,2,'main',11,'explosive.timed',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,12,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(40,2,'main',12,'syringe.medical',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,13,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(41,2,'main',13,'gunpowder',NULL,0,15,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,14,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(42,2,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(43,2,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(44,2,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(45,2,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(46,2,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(47,2,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(48,2,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(49,2,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(50,2,'belt',1,'smg.mp5',NULL,0,1,150.00,150.00,30,'ammo.pistol',-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(51,2,'belt',2,'rifle.l96',NULL,0,1,60.00,60.00,5,'ammo.rifle',-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(52,2,'belt',3,'lmg.m249',NULL,0,1,500.00,500.00,100,'ammo.rifle',-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(53,2,'belt',4,'rifle.ak',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(54,2,'belt',5,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(84,4,'main',0,'ammo.rocket.basic',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(85,4,'main',1,'ammo.rocket.hv',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(86,4,'main',2,'electric.generator.small',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(87,4,'main',3,'ammo.rifle.explosive',NULL,0,200,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(88,4,'main',4,'ammo.rifle',NULL,0,200,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(89,4,'main',5,'ammo.pistol',NULL,0,200,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(90,4,'main',6,'syringe.medical',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(91,4,'main',7,'largemedkit',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,8,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(92,4,'main',8,'gunpowder',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,9,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(93,4,'main',9,'explosive.timed',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(94,4,'main',10,'weapon.mod.lasersight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,11,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(95,4,'main',11,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,12,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(96,4,'main',12,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,13,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(97,4,'main',13,'weapon.mod.small.scope',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,14,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(98,4,'main',14,'weapon.mod.silencer',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,15,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(99,4,'main',15,'weapon.mod.muzzlebrake',NULL,0,1,200.00,200.00,0,NULL,-1,NULL,NULL,NULL,NULL,16,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(100,4,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(101,4,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(102,4,'wear',2,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(103,4,'wear',3,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(104,4,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(105,4,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(106,4,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(107,4,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(108,4,'belt',1,'smg.mp5',NULL,0,1,150.00,150.00,30,'ammo.pistol',-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(109,4,'belt',2,'rifle.l96',NULL,0,1,60.00,60.00,5,'ammo.rifle',-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(110,4,'belt',3,'lmg.m249',NULL,0,1,500.00,500.00,100,'ammo.rifle',-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(111,4,'belt',4,'rifle.ak',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(112,4,'belt',5,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(236,9,'main',0,'autoturret',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(237,10,'main',0,'autoturret',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(238,11,'main',0,'grenade.smoke','Portafort Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(239,12,'main',0,'wrappedgift','Minicopter Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(240,12,'main',1,'wrappedgift','Scrap Transport Helicopter Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(241,12,'main',2,'wrappedgift','Attack Helicopter Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(242,12,'main',3,'wrappedgift','RHIB Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(243,12,'main',4,'wrappedgift','Tugboat Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(244,12,'main',5,'wrappedgift','Solo Submarine Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(245,12,'main',6,'wrappedgift','Duo Submarine Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(246,12,'main',7,'wrappedgift','Snowmobile Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,8,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(247,12,'main',8,'wrappedgift','Hot Air Balloon Token',0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,9,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(248,13,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(249,13,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(250,13,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(251,13,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(252,13,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(253,13,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(254,13,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(255,13,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(256,13,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(257,13,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(258,13,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(259,13,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(260,13,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(261,13,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(262,13,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(263,13,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(264,14,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(265,14,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(266,14,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(267,14,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(268,14,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(269,14,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(270,14,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(271,14,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(272,14,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(273,14,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(274,14,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(275,14,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(276,14,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(277,14,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(278,14,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(279,14,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(280,15,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(281,15,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(282,15,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(283,15,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(284,15,'main',4,'rifle.l96',NULL,0,1,60.00,60.00,5,'ammo.rifle',-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(285,15,'main',5,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(286,15,'main',6,'rifle.ak',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(287,15,'main',7,'ammo.rocket.basic',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,8,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(288,15,'main',8,'ammo.rocket.hv',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,9,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(289,15,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(290,15,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(291,15,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(292,15,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(293,15,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(294,15,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(295,15,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(296,15,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(297,15,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(298,15,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(299,15,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(300,15,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(301,15,'belt',5,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(302,16,'main',0,'ammo.rifle',NULL,0,40,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(303,16,'main',1,'ammo.rifle.explosive',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(304,16,'main',2,'ammo.rocket.hv',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(305,16,'main',3,'ammo.rocket.basic',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(306,16,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(307,16,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(308,16,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(309,16,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(310,16,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(311,16,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(312,16,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(313,16,'belt',0,'rifle.ak',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(314,16,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(315,16,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(316,16,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(317,16,'belt',4,'explosive.timed',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(318,16,'belt',5,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(319,17,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(320,17,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(321,17,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(322,17,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(323,17,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(324,17,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(325,17,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(326,17,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(327,17,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(328,17,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(329,17,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(330,17,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(331,17,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(332,17,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(333,17,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(334,17,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(335,18,'main',0,'ammo.rifle',NULL,0,350,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(336,19,'belt',0,'keycard_red',NULL,0,1,2.00,2.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(337,19,'belt',1,'keycard_green',NULL,0,1,4.00,4.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(338,19,'belt',2,'keycard_blue',NULL,0,1,4.00,4.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(339,20,'main',0,'scrap',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(340,21,'wear',0,'diving.mask',NULL,0,1,200.00,200.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(341,21,'wear',1,'diving.fins',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(342,21,'wear',2,'diving.tank',NULL,0,1,600.00,600.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(343,21,'wear',3,'diving.wetsuit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(344,21,'belt',0,'flashlight.held',NULL,0,1,50.00,50.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(345,22,'main',0,'cctv.camera',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(346,22,'main',1,'gears',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(347,22,'main',2,'metalspring',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(348,22,'main',3,'propanetank',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(349,22,'main',4,'roadsigns',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(350,22,'main',5,'techparts',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(351,22,'main',6,'sewingkit',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(352,22,'main',7,'sheetmetal',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,8,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(353,22,'main',8,'metalblade',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,9,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(354,22,'main',9,'metalpipe',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(355,22,'main',10,'semibody',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,11,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(356,22,'main',11,'rope',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,12,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(357,23,'main',0,'wood',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(358,23,'main',1,'stones',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(359,23,'main',2,'metal.fragments',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(360,23,'main',3,'metal.refined',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(361,23,'main',4,'gears',NULL,0,3,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(362,23,'belt',0,'building.planner',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(363,23,'belt',1,'hammer',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(364,24,'main',0,'ammo.rifle',NULL,0,150,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(365,24,'main',1,'ammo.rifle.explosive',NULL,0,75,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(366,24,'main',2,'ammo.rocket.basic',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(367,24,'main',3,'ammo.rocket.hv',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(368,24,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(369,24,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(370,24,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(371,24,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(372,24,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(373,24,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(374,24,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(375,24,'belt',0,'rifle.ak',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(376,24,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(377,24,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(378,24,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(379,24,'belt',4,'explosive.timed',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(380,24,'belt',5,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(381,25,'belt',0,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(382,25,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(383,26,'main',0,'ammo.pistol',NULL,0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(384,26,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(385,26,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(386,26,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(387,26,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(388,26,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(389,26,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(390,26,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(391,26,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(392,26,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(393,26,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(394,26,'belt',0,'smg.mp5',NULL,0,1,150.00,150.00,30,'ammo.pistol',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:37'),(395,26,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(396,26,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(397,26,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(398,26,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(399,27,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(400,27,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(401,27,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(402,27,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(403,27,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(404,27,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(405,27,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(406,27,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(407,27,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(408,27,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(409,27,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(410,27,'belt',0,'rifle.lr300',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(411,27,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(412,27,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(413,27,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(414,27,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(415,28,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(416,28,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(417,28,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(418,28,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(419,28,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(420,28,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(421,28,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(422,28,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(423,28,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(424,28,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(425,28,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(426,28,'belt',0,'m16a2',NULL,0,1,200.00,200.00,4,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(427,28,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(428,28,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(429,28,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(430,28,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(431,29,'main',0,'ammo.rifle',NULL,0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(432,29,'main',1,'weapon.mod.holosight',NULL,0,1,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(433,29,'main',2,'weapon.mod.flashlight',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(434,29,'main',3,'weapon.mod.extendedmags',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(435,29,'wear',0,'metal.facemask',NULL,0,1,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(436,29,'wear',1,'metal.plate.torso',NULL,0,1,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(437,29,'wear',2,'roadsign.kilt',NULL,0,1,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(438,29,'wear',3,'hoodie',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(439,29,'wear',4,'pants',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(440,29,'wear',5,'shoes.boots',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,6,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(441,29,'wear',6,'tactical.gloves',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,7,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(442,29,'belt',0,'rifle.ak',NULL,0,1,150.00,150.00,30,'ammo.rifle',-1,NULL,NULL,NULL,NULL,1,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(443,29,'belt',1,'syringe.medical',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,2,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(444,29,'belt',2,'largemedkit',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,3,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(445,29,'belt',3,'wall.external.high.stone',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,4,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(446,29,'belt',4,'wall.external.high',NULL,0,1,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,5,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(767,1,'main',0,'ammo.rocket.basic',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(768,1,'main',1,'ammo.rocket.hv',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(769,1,'main',2,'electric.generator.small',NULL,0,10,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(770,1,'main',3,'weapon.mod.small.scope',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(771,1,'main',4,'weapon.mod.holosight',NULL,0,100,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(772,1,'main',5,'weapon.mod.flashlight',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(773,1,'main',6,'ammo.rifle.explosive',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(774,1,'main',7,'ammo.rifle',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,70,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(775,1,'main',9,'weapon.mod.8x.scope',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,90,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(776,1,'main',10,'weapon.mod.silencer',NULL,0,100,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,100,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(777,1,'main',11,'weapon.mod.lasersight',NULL,0,100,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,110,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(778,1,'main',14,'explosive.timed',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,140,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(779,1,'main',15,'rifle.lr300',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,150,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(780,1,'main',16,'smg.mp5',NULL,0,1,150.00,150.00,0,'ammo.pistol',-1,NULL,NULL,NULL,NULL,160,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(781,1,'main',17,'rifle.l96',NULL,0,1,60.00,60.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,170,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(782,1,'main',18,'syringe.medical',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,180,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(783,1,'main',19,'gunpowder',NULL,0,1500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,190,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(784,1,'main',21,'lmg.m249',NULL,0,1,500.00,500.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,210,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(785,1,'main',22,'rifle.ak',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,220,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(786,1,'main',23,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,230,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(787,1,'wear',0,'metal.facemask',NULL,0,10,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(788,1,'wear',1,'metal.plate.torso',NULL,0,10,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(789,1,'wear',2,'roadsign.kilt',NULL,0,10,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(790,1,'wear',3,'hoodie',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(791,1,'wear',4,'pants',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(792,1,'wear',5,'shoes.boots',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(793,1,'wear',6,'tactical.gloves',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(794,3,'main',0,'ammo.rocket.basic',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(795,3,'main',1,'ammo.rocket.hv',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(796,3,'main',2,'electric.generator.small',NULL,0,10,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(797,3,'main',3,'weapon.mod.small.scope',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(798,3,'main',4,'weapon.mod.holosight',NULL,0,100,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(799,3,'main',5,'weapon.mod.flashlight',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(800,3,'main',6,'ammo.rifle.explosive',NULL,0,20000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(801,3,'main',7,'ammo.rifle',NULL,0,20000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,70,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(802,3,'main',9,'weapon.mod.8x.scope',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,90,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(803,3,'main',10,'weapon.mod.silencer',NULL,0,100,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,100,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(804,3,'main',11,'weapon.mod.lasersight',NULL,0,100,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,110,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(805,3,'main',12,'explosive.timed',NULL,0,150,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,120,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(806,3,'main',14,'ammo.pistol',NULL,0,20000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,140,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(807,3,'main',15,'rifle.lr300',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,150,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(808,3,'main',16,'smg.mp5',NULL,0,1,150.00,150.00,0,'ammo.pistol',-1,NULL,NULL,NULL,NULL,160,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(809,3,'main',17,'rifle.l96',NULL,0,1,60.00,60.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,170,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(810,3,'main',18,'syringe.medical',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,180,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(811,3,'main',19,'gunpowder',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,190,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(812,3,'main',20,'largemedkit',NULL,0,1000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,200,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(813,3,'main',21,'lmg.m249',NULL,0,1,500.00,500.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,210,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(814,3,'main',22,'rifle.ak',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,220,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(815,3,'main',23,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,230,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(816,3,'wear',0,'metal.facemask',NULL,0,50,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(817,3,'wear',1,'metal.plate.torso',NULL,0,50,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(818,3,'wear',2,'roadsign.kilt',NULL,0,50,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(819,3,'wear',3,'hoodie',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(820,3,'wear',4,'pants',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(821,3,'wear',5,'shoes.boots',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(822,3,'wear',6,'tactical.gloves',NULL,0,50,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(823,5,'main',0,'ammo.rocket.hv',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(824,5,'main',1,'ammo.rocket.basic',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(825,5,'main',3,'ammo.rocket.sam',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(826,5,'main',4,'explosive.timed',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(827,5,'main',5,'samsite',NULL,0,1,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(828,5,'main',6,'ammo.rifle.explosive',NULL,0,25000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(829,5,'main',7,'ammo.rifle',NULL,0,25000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,70,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(830,5,'main',8,'ammo.pistol',NULL,0,25000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,80,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(831,5,'main',11,'autoturret',NULL,0,25,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,110,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(832,5,'main',12,'largemedkit',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,120,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(833,5,'main',13,'gunpowder',NULL,0,1250,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,130,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(834,5,'main',15,'rifle.lr300',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,150,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(835,5,'main',16,'smg.mp5',NULL,0,1,150.00,150.00,0,'ammo.pistol',-1,NULL,NULL,NULL,NULL,160,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(836,5,'main',17,'rifle.l96',NULL,0,1,60.00,60.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,170,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(837,5,'main',18,'syringe.medical',NULL,0,1250,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,180,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(838,5,'main',21,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,210,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(839,5,'main',22,'lmg.m249',NULL,0,1,500.00,500.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,220,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(840,5,'main',23,'rifle.ak',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,230,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(841,5,'wear',0,'metal.facemask',NULL,0,5,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(842,5,'wear',1,'metal.plate.torso',NULL,0,5,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(843,5,'wear',2,'roadsign.kilt',NULL,0,5,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(844,5,'wear',3,'hoodie',NULL,0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(845,5,'wear',4,'pants',NULL,0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(846,5,'wear',5,'tactical.gloves',NULL,0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(847,5,'wear',6,'shoes.boots',NULL,0,5,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(848,6,'main',0,'ammo.rocket.basic',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(849,6,'main',1,'ammo.rocket.hv',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(850,6,'main',3,'ammo.rocket.sam',NULL,0,50000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(851,6,'main',4,'explosive.timed',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(852,6,'main',5,'samsite',NULL,0,3,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(853,6,'main',6,'ammo.rifle.explosive',NULL,0,100000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(854,6,'main',7,'ammo.rifle',NULL,0,100000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,70,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(855,6,'main',8,'ammo.pistol',NULL,0,100000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,80,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(856,6,'main',9,'electric.generator.small',NULL,0,500,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,90,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(857,6,'main',11,'autoturret',NULL,0,100,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,110,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(858,6,'main',12,'largemedkit',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,120,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(859,6,'main',13,'gunpowder',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,130,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(860,6,'main',15,'rifle.lr300',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,150,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(861,6,'main',16,'smg.mp5',NULL,0,1,150.00,150.00,0,'ammo.pistol',-1,NULL,NULL,NULL,NULL,160,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(862,6,'main',17,'rifle.l96',NULL,0,1,60.00,60.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,170,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(863,6,'main',18,'syringe.medical',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,180,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(864,6,'main',21,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,210,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(865,6,'main',22,'lmg.m249',NULL,0,1,500.00,500.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,220,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(866,6,'main',23,'rifle.ak',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,230,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(867,6,'wear',0,'metal.facemask',NULL,0,100,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(868,6,'wear',1,'metal.plate.torso',NULL,0,100,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(869,6,'wear',2,'roadsign.kilt',NULL,0,100,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(870,6,'wear',3,'hoodie',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(871,6,'wear',4,'pants',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(872,6,'wear',5,'shoes.boots',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(873,6,'wear',6,'tactical.gloves',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(874,7,'main',0,'ammo.rocket.hv',NULL,0,20000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(875,7,'main',1,'ammo.rocket.basic',NULL,0,20000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(876,7,'main',2,'ammo.rifle.explosive',NULL,0,200000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(877,7,'main',3,'samsite',NULL,0,3,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(878,7,'main',4,'electric.generator.small',NULL,0,1500,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(879,7,'main',5,'supply.signal',NULL,0,10,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(880,7,'main',6,'ammo.rifle',NULL,0,200000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(881,7,'main',7,'ammo.rocket.sam',NULL,0,100000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,70,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(882,7,'main',8,'weapon.mod.silencer',NULL,0,100,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,80,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(883,7,'main',9,'autoturret',NULL,0,150,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,90,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(884,7,'main',10,'explosive.timed',NULL,0,15000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,100,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(885,7,'main',11,'healingtea.pure',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,110,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(886,7,'main',12,'weapon.mod.small.scope',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,120,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(887,7,'main',13,'weapon.mod.lasersight',NULL,0,100,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,130,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(888,7,'main',14,'weapon.mod.holosight',NULL,0,100,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,140,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(889,7,'main',15,'ammo.grenadelauncher.he',NULL,0,20000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,150,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(890,7,'main',16,'rifle.ak',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,160,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(891,7,'main',17,'lmg.m249',NULL,0,1,500.00,500.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,170,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(892,7,'main',18,'syringe.medical',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,180,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(893,7,'main',19,'gunpowder',NULL,0,30000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,190,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(894,7,'main',20,'weapon.mod.flashlight',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,200,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(895,7,'main',21,'rifle.lr300',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,210,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(896,7,'main',22,'smg.mp5',NULL,0,1,150.00,150.00,0,'ammo.pistol',-1,NULL,NULL,NULL,NULL,220,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(897,7,'main',23,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,230,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(898,7,'main',24,'largemedkit',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,240,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(899,7,'main',25,'bandage',NULL,0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,250,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(900,7,'main',27,'scrap',NULL,0,100000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,270,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(901,7,'main',28,'rifle.l96',NULL,0,1,60.00,60.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,280,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(902,7,'main',29,'multiplegrenadelauncher',NULL,0,1,200.00,200.00,0,'ammo.grenadelauncher.he',-1,NULL,NULL,NULL,NULL,290,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(903,7,'wear',0,'metal.facemask',NULL,0,100,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(904,7,'wear',1,'metal.plate.torso',NULL,0,100,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(905,7,'wear',2,'roadsign.kilt',NULL,0,100,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(906,7,'wear',3,'hoodie',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(907,7,'wear',4,'pants',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(908,7,'wear',5,'shoes.boots',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(909,7,'wear',6,'tactical.gloves',NULL,0,100,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(910,8,'main',0,'ammo.rocket.basic',NULL,0,150000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(911,8,'main',1,'ammo.rocket.hv',NULL,0,150000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(912,8,'main',2,'ammo.pistol',NULL,0,500000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(913,8,'main',3,'samsite',NULL,0,5,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(914,8,'main',4,'electric.generator.small',NULL,0,10000,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(915,8,'main',5,'supply.signal',NULL,0,35,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(916,8,'main',6,'ammo.rifle',NULL,0,500000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(917,8,'main',7,'ammo.rifle.explosive',NULL,0,500000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,70,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(918,8,'main',8,'autoturret','Outpost Sentry Turret',0,5,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,80,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(919,8,'main',9,'autoturret',NULL,0,1000,100.00,100.00,0,NULL,-1,NULL,NULL,NULL,NULL,90,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(920,8,'main',10,'explosive.timed',NULL,0,50000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,100,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(921,8,'main',11,'supertea','Super Serum',0,5000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,110,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(922,8,'main',12,'ammo.grenadelauncher.he',NULL,0,100000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,120,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(923,8,'main',13,'metal.fragments',NULL,0,50000000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,130,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(924,8,'main',14,'cloth',NULL,0,1000000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,140,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(925,8,'main',15,'scrap',NULL,0,1000000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,150,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(926,8,'main',16,'lmg.m249',NULL,0,1,500.00,500.00,15,'ammo.rifle',-1,NULL,NULL,NULL,NULL,160,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(927,8,'main',17,'rifle.ak',NULL,0,1,150.00,150.00,0,'ammo.rifle',-1,NULL,NULL,NULL,NULL,170,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(928,8,'main',18,'syringe.medical',NULL,0,250000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,180,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(929,8,'main',19,'gunpowder',NULL,0,500000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,190,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(930,8,'main',20,'largemedkit',NULL,0,10000,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,200,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(931,8,'main',21,'grenade.smoke','Portafort Token',0,25,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,210,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(932,8,'main',22,'rocket.launcher',NULL,0,1,100.00,100.00,0,'ammo.rocket.basic',-1,NULL,NULL,NULL,NULL,220,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(933,8,'main',23,'rifle.lr300',NULL,0,1,150.00,150.00,4,'ammo.rifle',-1,NULL,NULL,NULL,NULL,230,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(934,8,'main',24,'weapon.mod.holosight',NULL,0,5000,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,240,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(935,8,'main',25,'weapon.mod.lasersight',NULL,0,5000,300.00,300.00,0,NULL,-1,NULL,NULL,NULL,NULL,250,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(936,8,'main',27,'smg.mp5',NULL,0,1,150.00,150.00,8,'ammo.pistol',-1,NULL,NULL,NULL,NULL,270,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(937,8,'main',28,'rifle.l96',NULL,0,1,60.00,60.00,2,'ammo.rifle',-1,NULL,NULL,NULL,NULL,280,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(938,8,'main',29,'multiplegrenadelauncher',NULL,0,1,200.00,200.00,0,'ammo.grenadelauncher.he',-1,NULL,NULL,NULL,NULL,290,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(939,8,'wear',0,'metal.facemask',NULL,0,500,320.00,320.00,0,NULL,-1,NULL,NULL,NULL,NULL,0,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(940,8,'wear',1,'metal.plate.torso',NULL,0,500,360.00,360.00,0,NULL,-1,NULL,NULL,NULL,NULL,10,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(941,8,'wear',2,'roadsign.kilt',NULL,0,500,150.00,150.00,0,NULL,-1,NULL,NULL,NULL,NULL,20,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(942,8,'wear',3,'hoodie',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,30,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(943,8,'wear',4,'pants',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,40,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(944,8,'wear',5,'shoes.boots',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,50,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(945,8,'wear',6,'tactical.gloves',NULL,0,500,0.00,0.00,0,NULL,-1,NULL,NULL,NULL,NULL,60,'2026-07-11 01:51:37','2026-07-11 01:51:37');
/*!40000 ALTER TABLE `game_kit_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_kit_sync_log`
--

DROP TABLE IF EXISTS `game_kit_sync_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_kit_sync_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `revision` bigint unsigned NOT NULL,
  `status` enum('draft','pending','applied','failed','snapshot') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payload_json` json DEFAULT NULL,
  `payload_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `error_text` text COLLATE utf8mb4_unicode_ci,
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_game_kit_sync_log_revision` (`revision`),
  KEY `idx_game_kit_sync_log_status` (`status`,`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_kit_sync_log`
--

LOCK TABLES `game_kit_sync_log` WRITE;
/*!40000 ALTER TABLE `game_kit_sync_log` DISABLE KEYS */;
INSERT INTO `game_kit_sync_log` VALUES (1,1783734695,'pending',NULL,'','Published Raidlands VIP kit workbook rollout.',NULL,NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,1783734696,'pending',NULL,'','Published generated kit image links.',NULL,NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(3,1783734697,'pending',NULL,'','Published generated kit image links for live kit aliases.',NULL,NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(4,1783734698,'pending',NULL,'','Republished canonical generated kit image links.',NULL,NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(5,1783734699,'pending',NULL,'','Corrected VIP Super Serum kit shortnames to supertea.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(6,1783734700,'pending',NULL,'','Converted kit sync image paths from WebP to PNG.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(7,1783734701,'pending',NULL,'','Published absolute PNG kit image URLs for Rust kit sync.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(8,1783734702,'pending',NULL,'','Repaired kit item condition defaults and non-stackable item amounts.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(9,1783734703,'pending',NULL,'','Synced VIP kit items from July 7 screenshots: 179 item rows across 6 kits.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(10,1783734704,'pending',NULL,'','Restored VIP kit artwork URLs to existing WEBP assets across 6 kits.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(11,1783734705,'pending',NULL,'','Corrected VIP kit items from verified Rust icon comparison: 179 item rows across 6 kits.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37'),(12,1783734706,'pending',NULL,'','Updated VIP kit artwork URLs to PNG assets across 6 kits.',NULL,NULL,'2026-07-11 01:51:37','2026-07-11 01:51:37');
/*!40000 ALTER TABLE `game_kit_sync_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_kits`
--

DROP TABLE IF EXISTS `game_kits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_kits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `kit_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_kit_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci,
  `required_permission` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `maximum_uses` int NOT NULL DEFAULT '0',
  `required_auth` tinyint NOT NULL DEFAULT '0',
  `cooldown_seconds` int NOT NULL DEFAULT '0',
  `cost` int NOT NULL DEFAULT '0',
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0',
  `copy_paste_file` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '100',
  `reward_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `reward_product_id` int NOT NULL DEFAULT '-1',
  `reward_display_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reward_description` text COLLATE utf8mb4_unicode_ci,
  `reward_cost` int NOT NULL DEFAULT '0',
  `reward_cooldown` int NOT NULL DEFAULT '0',
  `reward_icon_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reward_permission` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `draft_revision` bigint unsigned NOT NULL DEFAULT '0',
  `published_revision` bigint unsigned NOT NULL DEFAULT '0',
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_revision` bigint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_game_kits_name` (`kit_name`),
  KEY `idx_game_kits_active_sort` (`is_active`,`sort_order`),
  KEY `idx_game_kits_published_revision` (`published_revision`),
  KEY `idx_game_kits_deleted_revision` (`deleted_at`,`deleted_revision`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_kits`
--

LOCK TABLES `game_kits` WRITE;
/*!40000 ALTER TABLE `game_kits` DISABLE KEYS */;
INSERT INTO `game_kits` VALUES (1,'kit_vip','','Main VIP kit screenshot.','kits.vip',10,0,3600,0,0,'','/assets/media/kits/vip-kit.png',1,210,1,1395,'VIP Kit','Main VIP kit screenshot.',8000,0,'https://raidlands.net/assets/media/kits/vip-kit.png','',1783734706,1783734706,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(2,'kit_vip_diamond','','Main VIP kit screenshot. Diamond cooldown alias.','kits.vip.diamond',10,0,18000,0,0,'','https://raidlands.net/assets/media/kits/vip-diamond-kit.png',1,211,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(3,'kit_vip_plus','','Diamond uses this with 5h cooldown override if separate diamond permission kit clone is needed.','kits.vipplus',10,0,3600,0,0,'','/assets/media/kits/vip-plus-kit.png',1,220,1,1396,'VIP+ Kit','Diamond uses this with 5h cooldown override if separate diamond permission kit clone is needed.',12000,0,'https://raidlands.net/assets/media/kits/vip-plus-kit.png','',1783734706,1783734706,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(4,'kit_vip_plus_diamond','','Diamond uses this with 5h cooldown override if separate diamond permission kit clone is needed. Diamond cooldown alias.','kits.vipplus.diamond',10,0,18000,0,0,'','https://raidlands.net/assets/media/kits/vip-plus-diamond-kit.png',1,221,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(5,'kit_mvp','','Recommended 10/wipe for weekly balance.','kits.mvp',10,0,3600,0,0,'','/assets/media/kits/mvp-kit.png',1,230,1,1397,'MVP Kit','Recommended 10/wipe for weekly balance.',16000,0,'https://raidlands.net/assets/media/kits/mvp-kit.png','',1783734706,1783734706,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(6,'kit_golden_vip','','Once per wipe.','kits.goldenvip',1,0,0,0,0,'','/assets/media/kits/golden-vip-kit.png',1,240,1,1398,'Golden VIP Kit','Once per wipe.',35000,0,'https://raidlands.net/assets/media/kits/golden-vip-kit.png','',1783734706,1783734706,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(7,'kit_ultimate_vip','','Once per wipe.','kits.ultimatevip',1,0,0,0,0,'','/assets/media/kits/ultimate-vip-kit.png',1,250,1,1399,'Ultimate VIP Kit','Once per wipe.',70000,0,'https://raidlands.net/assets/media/kits/ultimate-vip-kit.png','',1783734706,1783734706,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(8,'kit_titan_vip','','Once per wipe.','kits.titanvip',1,0,0,0,0,'','/assets/media/kits/titan-vip-kit.png',1,260,1,1400,'Titan VIP Kit','Once per wipe.',150000,0,'https://raidlands.net/assets/media/kits/titan-vip-kit.png','',1783734706,1783734706,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(9,'pack_sentry_small','','1 sentry.','kits.sentry.small',1,0,0,0,0,'','https://raidlands.net/assets/media/kits/sentry-small-pack.png',1,270,1,1401,'Sentry Pack Small','1 sentry.',10000,0,'https://raidlands.net/assets/media/kits/sentry-small-pack.png','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(10,'pack_sentry_large','','5 sentries.','kits.sentry.large',1,0,0,0,0,'','https://raidlands.net/assets/media/kits/sentry-large-pack.png',1,280,1,1402,'Sentry Pack Large','5 sentries.',30000,0,'https://raidlands.net/assets/media/kits/sentry-large-pack.png','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(11,'pack_portafort','','5 portaforts per redeem.','kits.portafort',10,0,60,0,0,'','https://raidlands.net/assets/media/kits/portafort-token.png',1,290,1,1403,'Portafort Pack','5 portaforts per redeem.',8000,0,'https://raidlands.net/assets/media/kits/portafort-token.png','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(12,'pack_vehicle','','5 of each allowed vehicle except car chassis, rowboat, horse.','kits.vehicle',1,0,0,0,0,'','https://raidlands.net/assets/media/kits/vehicle-pack.png',1,300,1,1404,'Vehicle Pack','5 of each allowed vehicle except car chassis, rowboat, horse.',40000,0,'https://raidlands.net/assets/media/kits/vehicle-pack.png','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(13,'kit_claim_steam_name_rewards','','Outside shop purchase flow.','kits.claim.steam_name_rewards',0,0,600,0,0,'','https://raidlands.net/assets/media/kits/steam-name-rewards-kit.png',1,310,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(14,'kit_claim_steam_rewards','','Outside shop purchase flow.','kits.claim.steam_rewards',0,0,600,0,0,'','https://raidlands.net/assets/media/kits/steam-rewards-kit.png',1,320,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(15,'kit_claim_discord_booster','','Outside shop purchase flow; booster role sync required.','kits.claim.discord_booster',0,0,1800,0,0,'','https://raidlands.net/assets/media/kits/discord-booster-kit.png',1,330,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(16,'kit_claim_discord_raid','','Max uses shown as 15.','kits.claim.discord_raid',15,0,3600,0,0,'','https://raidlands.net/assets/media/kits/discord-raid-kit.png',1,340,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(17,'kit_claim_discord','','Outside shop purchase flow.','kits.claim.discord',0,0,390,0,0,'','https://raidlands.net/assets/media/kits/discord-kit.png',1,350,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(18,'kit_claim_556','','Default in-game claimable.','kits.claim.556',0,0,1800,0,0,'','https://raidlands.net/assets/media/kits/556-kit.png',1,360,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(19,'kit_claim_cards','','Default in-game claimable.','kits.claim.cards',0,0,3600,0,0,'','https://raidlands.net/assets/media/kits/cards-kit.png',1,370,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(20,'kit_claim_scrap','','Default in-game claimable.','kits.claim.scrap',0,0,3600,0,0,'','https://raidlands.net/assets/media/kits/scrap-kit.png',1,380,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(21,'kit_claim_scuba','','Default in-game claimable.','kits.claim.scuba',0,0,1800,0,0,'','https://raidlands.net/assets/media/kits/scuba-kit.png',1,390,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(22,'kit_claim_components','','Max uses shown as 5.','kits.claim.components',5,0,3600,0,0,'','https://raidlands.net/assets/media/kits/comps-kit.png',1,400,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(23,'kit_claim_build','','Default resource/build kit.','kits.claim.build',0,0,1200,0,0,'','https://raidlands.net/assets/media/kits/build-kit.png',1,410,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(24,'kit_claim_raid','','Default raid kit.','kits.claim.raid',0,0,1800,0,0,'','https://raidlands.net/assets/media/kits/raid-kit.png',1,420,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(25,'kit_claim_medical','','Default medical kit.','kits.claim.medical',0,0,1800,0,0,'','https://raidlands.net/assets/media/kits/medical-kit.png',1,430,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(26,'kit_claim_mp5','','Default combat kit.','kits.claim.mp5',0,0,390,0,0,'','https://raidlands.net/assets/media/kits/mp5-kit.png',1,440,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(27,'kit_claim_lr300','','Default combat kit.','kits.claim.lr300',0,0,390,0,0,'','https://raidlands.net/assets/media/kits/lr300-kit.png',1,450,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(28,'kit_claim_m16a2','','Custom weapon/skin key needs final confirmation.','kits.claim.m16a2',0,0,390,0,0,'','https://raidlands.net/assets/media/kits/m16a2-kit.png',1,460,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0),(29,'kit_claim_ak','','Default combat kit.','kits.claim.ak',0,0,390,0,0,'','https://raidlands.net/assets/media/kits/ak-kit.png',1,470,0,-1,'','',0,0,'','',1783734702,1783734702,'2026-07-11 01:51:37','2026-07-11 01:51:35','2026-07-11 01:51:37',NULL,0);
/*!40000 ALTER TABLE `game_kits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monument_extraction_actions`
--

DROP TABLE IF EXISTS `monument_extraction_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monument_extraction_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `run_id` bigint unsigned NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `client_action_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequence_number` int unsigned NOT NULL,
  `action_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `result_payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `random_draw_start` int unsigned NOT NULL DEFAULT '0',
  `random_draw_end` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_monument_action_client` (`player_id`,`client_action_id`),
  UNIQUE KEY `uq_monument_action_sequence` (`run_id`,`sequence_number`),
  KEY `idx_monument_actions_run` (`run_id`,`id`),
  CONSTRAINT `fk_monument_actions_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monument_actions_run` FOREIGN KEY (`run_id`) REFERENCES `monument_extraction_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monument_extraction_actions`
--

LOCK TABLES `monument_extraction_actions` WRITE;
/*!40000 ALTER TABLE `monument_extraction_actions` DISABLE KEYS */;
/*!40000 ALTER TABLE `monument_extraction_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monument_extraction_config_versions`
--

DROP TABLE IF EXISTS `monument_extraction_config_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monument_extraction_config_versions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `version_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schema_version` int unsigned NOT NULL DEFAULT '1',
  `config_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `activated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_monument_config_hash` (`config_hash`),
  KEY `idx_monument_config_active` (`is_active`,`id`),
  KEY `fk_monument_config_admin` (`created_by`),
  CONSTRAINT `fk_monument_config_admin` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monument_extraction_config_versions`
--

LOCK TABLES `monument_extraction_config_versions` WRITE;
/*!40000 ALTER TABLE `monument_extraction_config_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `monument_extraction_config_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monument_extraction_runs`
--

DROP TABLE IF EXISTS `monument_extraction_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monument_extraction_runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active_player_key` bigint unsigned DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATING',
  `wager_rp` int unsigned NOT NULL,
  `payout_rp` int unsigned NOT NULL DEFAULT '0',
  `payout_multiplier_bps` int unsigned NOT NULL DEFAULT '0',
  `loadout_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_version_id` bigint unsigned NOT NULL,
  `frozen_config_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `seed_commitment` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `server_seed_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `state_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `wager_request_id` bigint unsigned DEFAULT NULL,
  `payout_request_id` bigint unsigned DEFAULT NULL,
  `payout_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `failure_reason` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lock_version` int unsigned NOT NULL DEFAULT '0',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_action_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_monument_active_player` (`active_player_key`),
  UNIQUE KEY `uq_monument_wager_request` (`wager_request_id`),
  UNIQUE KEY `uq_monument_payout_request` (`payout_request_id`),
  KEY `idx_monument_runs_player` (`player_id`,`created_at`),
  KEY `idx_monument_runs_status` (`status`,`expires_at`),
  KEY `fk_monument_runs_config` (`config_version_id`),
  CONSTRAINT `fk_monument_runs_config` FOREIGN KEY (`config_version_id`) REFERENCES `monument_extraction_config_versions` (`id`),
  CONSTRAINT `fk_monument_runs_payout` FOREIGN KEY (`payout_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_monument_runs_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monument_runs_wager` FOREIGN KEY (`wager_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monument_extraction_runs`
--

LOCK TABLES `monument_extraction_runs` WRITE;
/*!40000 ALTER TABLE `monument_extraction_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `monument_extraction_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `store_price_id` bigint unsigned NOT NULL,
  `stripe_checkout_session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode` enum('payment','subscription') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `amount_total_cents` int unsigned NOT NULL DEFAULT '0',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` timestamp NULL DEFAULT NULL,
  `refunded_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_checkout_session` (`stripe_checkout_session_id`),
  KEY `idx_orders_player_status` (`player_id`,`status`),
  KEY `idx_orders_payment_intent` (`stripe_payment_intent_id`),
  KEY `fk_orders_product` (`product_id`),
  KEY `fk_orders_price` (`store_price_id`),
  CONSTRAINT `fk_orders_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orders_price` FOREIGN KEY (`store_price_id`) REFERENCES `store_prices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `oxide_group_permission_grants`
--

DROP TABLE IF EXISTS `oxide_group_permission_grants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oxide_group_permission_grants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_oxide_group_permission_grants` (`group_id`,`permission_id`),
  KEY `idx_oxide_group_permission_grants_group` (`group_id`),
  KEY `idx_oxide_group_permission_grants_permission` (`permission_id`),
  CONSTRAINT `fk_oxide_group_permission_grants_group` FOREIGN KEY (`group_id`) REFERENCES `oxide_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oxide_group_permission_grants_permission` FOREIGN KEY (`permission_id`) REFERENCES `oxide_permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=271 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `oxide_group_permission_grants`
--

LOCK TABLES `oxide_group_permission_grants` WRITE;
/*!40000 ALTER TABLE `oxide_group_permission_grants` DISABLE KEYS */;
INSERT INTO `oxide_group_permission_grants` VALUES (1,46,79,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,45,78,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(3,45,80,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(4,44,89,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(5,43,88,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(6,1,73,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(7,1,74,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(8,1,75,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(9,1,76,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(10,1,77,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(11,1,81,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(12,1,82,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(13,1,83,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(14,1,84,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(15,1,85,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(16,1,86,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(17,1,87,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(18,30,61,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(19,31,62,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(20,32,8,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(21,33,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(22,34,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(23,29,66,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(24,27,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(25,39,114,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(26,9,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(27,28,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(28,38,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(29,26,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(30,36,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(31,37,112,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(32,23,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(33,23,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(34,23,8,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(35,23,63,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(36,23,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(37,23,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(38,23,90,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(39,23,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(40,23,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(41,23,99,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(42,23,101,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(43,23,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(44,23,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(45,23,104,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(46,23,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(47,23,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(48,22,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(49,22,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(50,22,62,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(51,22,64,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(52,22,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(53,22,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(54,22,90,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(55,22,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(56,22,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(57,22,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(58,22,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(59,22,105,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(60,22,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(61,22,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(62,21,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(63,21,61,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(64,21,65,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(65,21,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(66,21,91,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(67,21,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(68,21,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(69,21,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(70,21,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(71,21,106,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(72,21,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(73,21,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(74,25,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(75,25,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(76,25,8,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(77,25,67,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(78,25,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(79,25,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(80,25,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(81,25,93,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(82,25,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(83,25,95,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(84,25,97,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(85,25,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(86,25,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(87,25,107,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(88,25,112,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(89,25,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(90,25,114,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(91,24,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(92,24,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(93,24,8,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(94,24,68,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(95,24,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(96,24,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(97,24,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(98,24,93,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(99,24,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(100,24,96,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(101,24,97,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(102,24,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(103,24,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(104,24,108,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(105,24,112,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(106,24,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(107,19,61,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(108,19,69,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(109,19,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(110,19,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(111,19,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(112,19,98,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(113,19,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(114,19,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(115,19,109,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(116,19,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(117,19,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(118,20,61,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(119,20,70,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(120,20,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(121,20,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(122,20,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(123,20,100,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(124,20,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(125,20,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(126,20,110,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(127,20,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(128,20,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(129,3,61,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(130,3,69,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(131,3,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(132,3,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(133,3,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(134,3,98,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(135,3,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(136,3,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(137,3,109,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(138,3,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(139,3,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(140,5,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(141,5,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(142,5,8,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(143,5,68,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(144,5,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(145,5,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(146,5,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(147,5,93,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(148,5,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(149,5,96,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(150,5,97,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(151,5,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(152,5,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(153,5,108,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(154,5,112,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(155,5,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(156,4,12,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(157,4,60,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(158,4,62,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(159,4,64,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(160,4,71,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(161,4,72,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(162,4,90,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(163,4,92,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(164,4,94,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(165,4,102,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(166,4,103,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(167,4,105,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(168,4,111,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(169,4,113,'workbook','2026-07-11 01:51:35','2026-07-11 01:51:35'),(256,54,98,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(257,55,100,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(258,56,91,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(259,57,90,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(260,58,96,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(261,59,95,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(262,60,94,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(263,61,93,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(264,62,92,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36'),(265,63,97,'store-kit-lifetime','2026-07-11 01:51:36','2026-07-11 01:51:36');
/*!40000 ALTER TABLE `oxide_group_permission_grants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `oxide_group_permission_live`
--

DROP TABLE IF EXISTS `oxide_group_permission_live`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oxide_group_permission_live` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'snapshot',
  `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_oxide_group_permission_live` (`group_id`,`permission_id`),
  KEY `idx_oxide_group_permission_live_group` (`group_id`),
  KEY `idx_oxide_group_permission_live_permission` (`permission_id`),
  CONSTRAINT `fk_oxide_group_permission_live_group` FOREIGN KEY (`group_id`) REFERENCES `oxide_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oxide_group_permission_live_permission` FOREIGN KEY (`permission_id`) REFERENCES `oxide_permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `oxide_group_permission_live`
--

LOCK TABLES `oxide_group_permission_live` WRITE;
/*!40000 ALTER TABLE `oxide_group_permission_live` DISABLE KEYS */;
/*!40000 ALTER TABLE `oxide_group_permission_live` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `oxide_groups`
--

DROP TABLE IF EXISTS `oxide_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oxide_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `group_rank` int NOT NULL DEFAULT '0',
  `parent_group` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `category` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `is_managed` tinyint(1) NOT NULL DEFAULT '0',
  `is_protected` tinyint(1) NOT NULL DEFAULT '0',
  `is_read_only` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '100',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `draft_revision` bigint unsigned NOT NULL DEFAULT '0',
  `published_revision` bigint unsigned NOT NULL DEFAULT '0',
  `published_at` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_revision` bigint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_oxide_groups_name` (`group_name`),
  KEY `idx_oxide_groups_active_sort` (`is_active`,`sort_order`),
  KEY `idx_oxide_groups_managed` (`is_managed`,`is_active`),
  KEY `idx_oxide_groups_deleted_revision` (`deleted_at`,`deleted_revision`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `oxide_groups`
--

LOCK TABLES `oxide_groups` WRITE;
/*!40000 ALTER TABLE `oxide_groups` DISABLE KEYS */;
INSERT INTO `oxide_groups` VALUES (1,'default','default',0,'','public',1,1,0,1,10,'',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(2,'discord','discord',0,'','public',1,1,0,1,20,'',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(3,'vip_bronze','vip_bronze',0,'','legacy',1,0,0,1,360,'Replace or alias to new rank_vip/rank_vip_plus model.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(4,'vip_gold','vip_gold',0,'','legacy',1,0,0,1,370,'Replace or alias to new rank_golden_vip model.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(5,'vip_elite','vip_elite',0,'','legacy',1,0,0,1,380,'Replace or alias to rank_ultimate_vip/rank_titan_vip model.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(6,'perk_personal_mini','perk_personal_mini',0,'','perk',1,0,0,1,200,NULL,0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(7,'perk_skinbox','perk_skinbox',0,'','perk',1,0,0,1,210,NULL,0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(8,'perk_raid_kit','perk_raid_kit',0,'','perk',1,0,0,1,220,NULL,0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(9,'perk_queue_priority','perk_queue_priority',0,'','perk',1,0,0,1,180,'BypassQueue is staged; verify live queue bypass before final approval.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(10,'perk_supporter_badge','perk_supporter_badge',0,'','perk',1,0,0,1,240,NULL,0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(11,'admin','admin',1,'','system',0,1,1,1,900,'Server-owned admin group; visible from snapshots only.',1783734697,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(12,'authenticated','authenticated',0,'','system',0,1,1,1,910,'Server-owned authenticated group; visible from snapshots only.',1783734697,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(13,'perk_pvp_light','perk_pvp_light',0,'','perk',1,0,0,1,250,'Standalone Light PvP kit unlock.',0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(14,'perk_pvp_rifle','perk_pvp_rifle',0,'','perk',1,0,0,1,260,'Standalone Rifle PvP kit unlock.',0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(15,'perk_pvp_roamer','perk_pvp_roamer',0,'','perk',1,0,0,1,270,'Standalone Roamer PvP kit unlock.',0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(16,'perk_pvp_heavy','perk_pvp_heavy',0,'','perk',1,0,0,1,280,'Standalone Heavy PvP kit unlock.',0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(17,'perk_pvp_elite','perk_pvp_elite',0,'','perk',1,0,0,1,290,'Standalone Elite PvP kit unlock.',0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(18,'perk_pvp_breach','perk_pvp_breach',0,'','perk',1,0,0,1,300,'Standalone Breach PvP kit unlock.',0,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(19,'rank_vip','rank_vip',10,'','rank',1,0,0,1,110,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(20,'rank_vip_plus','rank_vip_plus',20,'','rank',1,0,0,1,120,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(21,'rank_mvp','rank_mvp',30,'','rank',1,0,0,1,130,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(22,'rank_golden_vip','rank_golden_vip',40,'','rank',1,0,0,1,140,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(23,'rank_diamond_vip','rank_diamond_vip',50,'','rank',1,0,0,1,150,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(24,'rank_ultimate_vip','rank_ultimate_vip',60,'','rank',1,0,0,1,160,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(25,'rank_titan_vip','rank_titan_vip',70,'','rank',1,0,0,1,170,'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(26,'perk_teleport_instant','perk_teleport_instant',0,'','perk',1,0,0,1,190,'Map to NTeleportation VIP countdown/cooldown keys.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(27,'perk_home_5s','perk_home_5s',0,'','perk',1,0,0,1,200,'NTeleportation supports VIP home cooldown/countdown permissions.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(28,'perk_sign_art','perk_sign_art',0,'','perk',1,0,0,1,210,'SignArtist is staged; verify /sil before final approval.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(29,'perk_chat_title','perk_chat_title',0,'','perk',1,0,0,1,220,'Use BetterChat group/title data.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(30,'perk_backpack_36','perk_backpack_36',0,'','perk',1,0,0,1,230,'Uses current Backpacks permission size support.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(31,'perk_backpack_42','perk_backpack_42',0,'','perk',1,0,0,1,240,'Uses current Backpacks permission size support.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(32,'perk_backpack_48','perk_backpack_48',0,'','perk',1,0,0,1,250,'Uses current Backpacks permission size support.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(33,'perk_backpack_keep_death','perk_backpack_keep_death',0,'','perk',1,0,0,1,260,'Ensure death retention is permission-gated, not global.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(34,'perk_backpack_keep_wipe','perk_backpack_keep_wipe',0,'','perk',1,0,0,1,270,'Force wipe excluded; configure wipe ruleset permission.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(35,'perk_spawn_full','perk_spawn_full',0,'','perk',1,0,0,1,280,'Needs custom spawn hook if no existing plugin handles this.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(36,'perk_vehicle_hp_125','perk_vehicle_hp_125',0,'','perk',1,0,0,1,290,'Can be custom vehicle spawn wrapper or per-vehicle config.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(37,'perk_vehicle_hp_150','perk_vehicle_hp_150',0,'','perk',1,0,0,1,300,'Can be custom vehicle spawn wrapper or per-vehicle config.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(38,'perk_tc_12','perk_tc_12',0,'','perk',1,0,0,1,310,'CupboardLimiter custom limit permission after config change.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(39,'perk_minicopter_instant_takeoff','perk_minicopter_instant_takeoff',0,'','perk',1,0,0,1,320,'SpawnHeli supports permission-gated instant takeoff.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(40,'perk_shop_sale_25','perk_shop_sale_25',0,'','perk',1,0,0,1,330,'Exclude ranks, perks, RP, and subscriptions from discount loops.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(41,'perk_shop_sale_50','perk_shop_sale_50',0,'','perk',1,0,0,1,340,'Exclude ranks, perks, RP, and subscriptions from discount loops.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(42,'perk_shop_sale_75','perk_shop_sale_75',0,'','perk',1,0,0,1,350,'Exclude ranks, perks, RP, and subscriptions from discount loops.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(43,'claim_steam_name','claim_steam_name',0,'','claim',1,0,0,1,390,'Grant when linked Steam name contains Scrapland.GG.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(44,'claim_steam_group','claim_steam_group',0,'','claim',1,0,0,1,400,'Grant when linked account is in Steam group.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(45,'claim_discord_member','claim_discord_member',0,'','claim',1,0,0,1,410,'Grant after Discord link/member role check.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(46,'claim_discord_booster','claim_discord_booster',0,'','claim',1,0,0,1,420,'Grant through Discord role/boost sync; should coexist with member entitlement.',1783734695,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36',NULL,0),(54,'store_redeem_kit_vip','store_redeem_kit_vip',0,'','store',1,0,0,1,260,'Store lifetime kit unlock for kit_vip.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(55,'store_redeem_kit_vip_plus','store_redeem_kit_vip_plus',0,'','store',1,0,0,1,270,'Store lifetime kit unlock for kit_vip_plus.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(56,'store_redeem_kit_mvp','store_redeem_kit_mvp',0,'','store',1,0,0,1,280,'Store lifetime kit unlock for kit_mvp.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(57,'store_redeem_kit_golden_vip','store_redeem_kit_golden_vip',0,'','store',1,0,0,1,290,'Store lifetime kit unlock for kit_golden_vip.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(58,'store_redeem_kit_ultimate_vip','store_redeem_kit_ultimate_vip',0,'','store',1,0,0,1,300,'Store lifetime kit unlock for kit_ultimate_vip.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(59,'store_redeem_kit_titan_vip','store_redeem_kit_titan_vip',0,'','store',1,0,0,1,310,'Store lifetime kit unlock for kit_titan_vip.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(60,'store_redeem_pack_sentry_small','store_redeem_pack_sentry_small',0,'','store',1,0,0,1,320,'Store lifetime kit unlock for pack_sentry_small.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(61,'store_redeem_pack_sentry_large','store_redeem_pack_sentry_large',0,'','store',1,0,0,1,330,'Store lifetime kit unlock for pack_sentry_large.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(62,'store_redeem_pack_portafort','store_redeem_pack_portafort',0,'','store',1,0,0,1,340,'Store lifetime kit unlock for pack_portafort.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0),(63,'store_redeem_pack_vehicle','store_redeem_pack_vehicle',0,'','store',1,0,0,1,350,'Store lifetime kit unlock for pack_vehicle.',1783734696,1783734697,'2026-07-11 01:51:36',NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36',NULL,0);
/*!40000 ALTER TABLE `oxide_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `oxide_permission_sync_log`
--

DROP TABLE IF EXISTS `oxide_permission_sync_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oxide_permission_sync_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `revision` bigint unsigned NOT NULL,
  `status` enum('draft','pending','applied','failed','snapshot') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payload_json` json DEFAULT NULL,
  `payload_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `error_text` text COLLATE utf8mb4_unicode_ci,
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_oxide_permission_sync_log_revision` (`revision`),
  KEY `idx_oxide_permission_sync_log_status` (`status`,`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `oxide_permission_sync_log`
--

LOCK TABLES `oxide_permission_sync_log` WRITE;
/*!40000 ALTER TABLE `oxide_permission_sync_log` DISABLE KEYS */;
INSERT INTO `oxide_permission_sync_log` VALUES (1,1783734695,'pending',NULL,'','Published Raidlands VIP permission workbook rollout.',NULL,NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,1783734695,'pending',NULL,'','Published group-owned kit permission backfill.',NULL,NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(3,1783734696,'pending',NULL,'','Published store lifetime kit unlock groups.',NULL,NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(4,1783734697,'pending',NULL,'','Republished permissions after locking server-owned admin groups to snapshot-only.',NULL,NULL,'2026-07-11 01:51:36','2026-07-11 01:51:36');
/*!40000 ALTER TABLE `oxide_permission_sync_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `oxide_permissions`
--

DROP TABLE IF EXISTS `oxide_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oxide_permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `permission_name` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plugin_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `permission_prefix` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `first_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_oxide_permissions_name` (`permission_name`),
  KEY `idx_oxide_permissions_prefix` (`permission_prefix`),
  KEY `idx_oxide_permissions_active` (`is_active`,`permission_name`)
) ENGINE=InnoDB AUTO_INCREMENT=119 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `oxide_permissions`
--

LOCK TABLES `oxide_permissions` WRITE;
/*!40000 ALTER TABLE `oxide_permissions` DISABLE KEYS */;
INSERT INTO `oxide_permissions` VALUES (1,'autodoors.use','AutoDoors','autodoors','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,'automaticauthorization.use','AutomaticAuthorization','automaticauthorization','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(3,'backpacks.use','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(4,'backpacks.gui','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(5,'backpacks.size.6','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(6,'backpacks.size.12','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(7,'backpacks.size.24','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(8,'backpacks.size.48','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(9,'backpacks.fetch','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(10,'backpacks.gather','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(11,'backpacks.retrieve','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(12,'backpacks.keepondeath','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(13,'backpacks.nofoodspoiling','Backpacks','backpacks','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(14,'bgrade.all','BGrade','bgrade','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(15,'blueprintmanager.all','BlueprintManager','blueprintmanager','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(16,'buildingskins.use','BuildingSkins','buildingskins','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(17,'buildingskins.build','BuildingSkins','buildingskins','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(18,'buildingskins.tc','BuildingSkins','buildingskins','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(19,'buildingskins.all','BuildingSkins','buildingskins','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(20,'disablewet.use','DisableWet','disablewet','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(21,'discordauth.auth','DiscordAuth','discordauth','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(22,'instantbuy.use','InstantBuy','instantbuy','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(23,'instantcraft.use','InstantCraft','instantcraft','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(24,'instantgather.use','InstantGather','instantgather','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(25,'instantsmelt.use','InstantSmelt','instantsmelt','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(26,'quicksmelt.use','QuickSmelt','quicksmelt','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(27,'randomrespawner.use','RandomRespawner','randomrespawner','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(28,'recyclerspeed.use','RecyclerSpeed','recyclerspeed','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(29,'removertool.normal','RemoverTool','removertool','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(30,'skins.use','Skins','skins','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(31,'sortbutton.use','SortButton','sortbutton','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(32,'spawnheli.minicopter.spawn','SpawnHeli','spawnheli','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(33,'spawnheli.minicopter.fetch','SpawnHeli','spawnheli','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(34,'spawnheli.minicopter.despawn','SpawnHeli','spawnheli','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(35,'powerlessturrets.use','PowerlessTurrets','powerlessturrets','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(36,'powerlessturrets.radius','PowerlessTurrets','powerlessturrets','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(37,'powerlessturrets.samradius','PowerlessTurrets','powerlessturrets','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(38,'nteleportation.home','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(39,'nteleportation.tpr','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(40,'nteleportation.tpb','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(41,'nteleportation.tptown','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(42,'nteleportation.tpoutpost','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(43,'nteleportation.tpbandit','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(44,'nteleportation.globalcooldownvip','NTeleportation','nteleportation','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(45,'kits.discord','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(46,'kits.build','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(47,'kits.cards','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(48,'kits.comp','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(49,'kits.medical','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(50,'kits.raid','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(51,'kits.scuba','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(52,'kits.paidpvpkit','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(53,'serverrewards.paidpvpkit','ServerRewards','serverrewards','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(54,'kits.pvp.light','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(55,'kits.pvp.rifle','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(56,'kits.pvp.roamer','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(57,'kits.pvp.heavy','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(58,'kits.pvp.elite','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(59,'kits.pvp.breach','Kits','kits','seed',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(60,'backpacks.keeponwipe.all','Backpacks','backpacks','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(61,'backpacks.size.36','Backpacks','backpacks','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(62,'backpacks.size.42','Backpacks','backpacks','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(63,'betterchat.group.diamond_vip','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(64,'betterchat.group.golden_vip','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(65,'betterchat.group.mvp','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(66,'betterchat.group.perk_chat_title','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(67,'betterchat.group.titan_vip','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(68,'betterchat.group.ultimate_vip','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(69,'betterchat.group.vip','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(70,'betterchat.group.vip_plus','BetterChat','betterchat','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(71,'bypassqueue.allow','BypassQueue','bypassqueue','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(72,'cupboardlimiter.limit_1','CupboardLimiter','cupboardlimiter','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(73,'kits.claim.556','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(74,'kits.claim.ak','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(75,'kits.claim.build','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(76,'kits.claim.cards','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(77,'kits.claim.components','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(78,'kits.claim.discord','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(79,'kits.claim.discord_booster','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(80,'kits.claim.discord_raid','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(81,'kits.claim.lr300','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(82,'kits.claim.m16a2','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(83,'kits.claim.medical','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(84,'kits.claim.mp5','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(85,'kits.claim.raid','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(86,'kits.claim.scrap','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(87,'kits.claim.scuba','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(88,'kits.claim.steam_name_rewards','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(89,'kits.claim.steam_rewards','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(90,'kits.goldenvip','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(91,'kits.mvp','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(92,'kits.portafort','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(93,'kits.sentry.large','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(94,'kits.sentry.small','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(95,'kits.titanvip','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(96,'kits.ultimatevip','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(97,'kits.vehicle','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(98,'kits.vip','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(99,'kits.vip.diamond','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(100,'kits.vipplus','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:36','2026-07-11 01:51:35','2026-07-11 01:51:36'),(101,'kits.vipplus.diamond','Kits','kits','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(102,'nteleportation.home.5s','NTeleportation','nteleportation','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(103,'nteleportation.instant','NTeleportation','nteleportation','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(104,'playtimetracker.diamond_vip','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(105,'playtimetracker.golden_vip','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(106,'playtimetracker.mvp','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(107,'playtimetracker.titan_vip','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(108,'playtimetracker.ultimate_vip','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(109,'playtimetracker.vip','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(110,'playtimetracker.vip_plus','PlaytimeTracker','playtimetracker','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(111,'raidlands.vehicle.hp.125','Custom','raidlands','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(112,'raidlands.vehicle.hp.150','Custom','raidlands','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(113,'signartist.url','SignArtist','signartist','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35'),(114,'spawnheli.minicopter.instanttakeoff','SpawnHeli','spawnheli','workbook',1,'2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35','2026-07-11 01:51:35');
/*!40000 ALTER TABLE `oxide_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `player_api_keys`
--

DROP TABLE IF EXISTS `player_api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_api_keys` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_prefix` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `scopes_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_player_api_keys_hash` (`key_hash`),
  KEY `idx_player_api_keys_player` (`player_id`,`revoked_at`,`created_at`),
  KEY `idx_player_api_keys_steam` (`steam_id64`,`revoked_at`),
  CONSTRAINT `fk_player_api_keys_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `player_api_keys`
--

LOCK TABLES `player_api_keys` WRITE;
/*!40000 ALTER TABLE `player_api_keys` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_api_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `player_group_assignments`
--

DROP TABLE IF EXISTS `player_group_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_group_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `group_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','revoked','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `starts_at` timestamp NULL DEFAULT NULL,
  `ends_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revoked_by_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_note` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_player_group_assignment` (`player_id`,`group_name`),
  KEY `idx_player_group_assignments_group_status` (`group_name`,`status`),
  KEY `idx_player_group_assignments_status_ends` (`status`,`ends_at`),
  KEY `idx_player_group_assignments_changed` (`changed_at`),
  CONSTRAINT `fk_player_group_assignments_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `player_group_assignments`
--

LOCK TABLES `player_group_assignments` WRITE;
/*!40000 ALTER TABLE `player_group_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_group_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `player_wipe_stats`
--

DROP TABLE IF EXISTS `player_wipe_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_wipe_stats` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `wipe_id` bigint unsigned NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `raw_kills` int unsigned NOT NULL DEFAULT '0',
  `raw_deaths` int unsigned NOT NULL DEFAULT '0',
  `raw_playtime_seconds` int unsigned NOT NULL DEFAULT '0',
  `raw_afk_seconds` int unsigned NOT NULL DEFAULT '0',
  `raw_reward_points` int unsigned NOT NULL DEFAULT '0',
  `raw_npc_kills` int unsigned NOT NULL DEFAULT '0',
  `raw_deaths_by_npc` int unsigned NOT NULL DEFAULT '0',
  `baseline_kills` int unsigned NOT NULL DEFAULT '0',
  `baseline_deaths` int unsigned NOT NULL DEFAULT '0',
  `baseline_playtime_seconds` int unsigned NOT NULL DEFAULT '0',
  `baseline_afk_seconds` int unsigned NOT NULL DEFAULT '0',
  `baseline_reward_points` int unsigned NOT NULL DEFAULT '0',
  `baseline_npc_kills` int unsigned NOT NULL DEFAULT '0',
  `baseline_deaths_by_npc` int unsigned NOT NULL DEFAULT '0',
  `kills` int unsigned NOT NULL DEFAULT '0',
  `deaths` int unsigned NOT NULL DEFAULT '0',
  `npc_kills` int unsigned NOT NULL DEFAULT '0',
  `deaths_by_npc` int unsigned NOT NULL DEFAULT '0',
  `playtime_seconds` int unsigned NOT NULL DEFAULT '0',
  `afk_seconds` int unsigned NOT NULL DEFAULT '0',
  `reward_points` int unsigned NOT NULL DEFAULT '0',
  `kdr` decimal(10,3) NOT NULL DEFAULT '0.000',
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_player_wipe_stats_player` (`wipe_id`,`player_id`),
  KEY `idx_player_wipe_stats_kills` (`wipe_id`,`kills`,`deaths`),
  KEY `idx_player_wipe_stats_kdr` (`wipe_id`,`kdr`,`kills`),
  KEY `idx_player_wipe_stats_playtime` (`wipe_id`,`playtime_seconds`),
  KEY `idx_player_wipe_stats_reward_points` (`wipe_id`,`reward_points`),
  KEY `idx_player_wipe_stats_player_id` (`player_id`),
  KEY `idx_player_wipe_stats_npc_kills` (`wipe_id`,`npc_kills`,`deaths_by_npc`),
  KEY `idx_player_wipe_stats_deaths_by_npc` (`wipe_id`,`deaths_by_npc`,`npc_kills`),
  CONSTRAINT `fk_player_wipe_stats_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_player_wipe_stats_wipe` FOREIGN KEY (`wipe_id`) REFERENCES `wipe_seasons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `player_wipe_stats`
--

LOCK TABLES `player_wipe_stats` WRITE;
/*!40000 ALTER TABLE `player_wipe_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_wipe_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `players`
--

DROP TABLE IF EXISTS `players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `players` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_players_steam_id64` (`steam_id64`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `players`
--

LOCK TABLES `players` WRITE;
/*!40000 ALTER TABLE `players` DISABLE KEYS */;
INSERT INTO `players` VALUES (1,'76561190000000000','Codex Auth Test','2026-07-11 01:51:37','2026-07-11 01:51:37','2026-07-11 01:51:37');
/*!40000 ALTER TABLE `players` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_fulfillment_actions`
--

DROP TABLE IF EXISTS `product_fulfillment_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_fulfillment_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `action_type` enum('grant_group','revoke_group','note') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'grant_group',
  `oxide_group` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT '100',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_fulfillment_action` (`product_id`,`action_type`,`oxide_group`),
  KEY `idx_product_fulfillment_product` (`product_id`,`sort_order`),
  CONSTRAINT `fk_product_fulfillment_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_fulfillment_actions`
--

LOCK TABLES `product_fulfillment_actions` WRITE;
/*!40000 ALTER TABLE `product_fulfillment_actions` DISABLE KEYS */;
INSERT INTO `product_fulfillment_actions` VALUES (1,1,'grant_group','perk_pvp_light',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,2,'grant_group','perk_pvp_rifle',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(3,3,'grant_group','perk_pvp_roamer',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(4,4,'grant_group','perk_pvp_heavy',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(5,5,'grant_group','perk_pvp_elite',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(6,6,'grant_group','perk_pvp_breach',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(8,7,'grant_group','rank_vip',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(9,8,'grant_group','rank_vip_plus',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(10,9,'grant_group','rank_mvp',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(11,10,'grant_group','rank_golden_vip',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(12,11,'grant_group','rank_diamond_vip',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(13,12,'grant_group','rank_ultimate_vip',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(14,13,'grant_group','rank_titan_vip',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(15,14,'grant_group','perk_queue_priority',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(16,15,'grant_group','perk_teleport_instant',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(17,16,'grant_group','perk_home_5s',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(18,17,'grant_group','perk_sign_art',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(19,18,'grant_group','perk_chat_title',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(20,19,'grant_group','perk_backpack_36',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(21,20,'grant_group','perk_backpack_42',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(22,21,'grant_group','perk_backpack_48',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(23,22,'grant_group','perk_backpack_keep_death',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(24,23,'grant_group','perk_backpack_keep_wipe',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(25,24,'grant_group','perk_spawn_full',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(26,25,'grant_group','perk_vehicle_hp_125',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(27,26,'grant_group','perk_vehicle_hp_150',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(28,27,'grant_group','perk_tc_12',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(29,28,'grant_group','perk_minicopter_instant_takeoff',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(30,29,'grant_group','perk_shop_sale_25',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(31,30,'grant_group','perk_shop_sale_50',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(32,31,'grant_group','perk_shop_sale_75',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(40,35,'grant_group','store_redeem_kit_golden_vip',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(41,34,'grant_group','store_redeem_kit_mvp',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(42,37,'grant_group','store_redeem_kit_titan_vip',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(43,36,'grant_group','store_redeem_kit_ultimate_vip',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(44,32,'grant_group','store_redeem_kit_vip',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(45,33,'grant_group','store_redeem_kit_vip_plus',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(46,40,'grant_group','store_redeem_pack_portafort',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(47,39,'grant_group','store_redeem_pack_sentry_large',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(48,38,'grant_group','store_redeem_pack_sentry_small',10,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(49,41,'grant_group','store_redeem_pack_vehicle',10,'2026-07-11 01:51:36','2026-07-11 01:51:36');
/*!40000 ALTER TABLE `product_fulfillment_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_game_daily_limits`
--

DROP TABLE IF EXISTS `rp_game_daily_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_game_daily_limits` (
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `limit_date` date NOT NULL,
  `wagered_rp` int unsigned NOT NULL DEFAULT '0',
  `loss_rp` int unsigned NOT NULL DEFAULT '0',
  `rounds_played` int unsigned NOT NULL DEFAULT '0',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`player_id`,`limit_date`),
  KEY `idx_rp_game_daily_limits_date` (`limit_date`),
  CONSTRAINT `fk_rp_game_daily_limits_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_game_daily_limits`
--

LOCK TABLES `rp_game_daily_limits` WRITE;
/*!40000 ALTER TABLE `rp_game_daily_limits` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_game_daily_limits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_game_rounds`
--

DROP TABLE IF EXISTS `rp_game_rounds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_game_rounds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `game_type` enum('coinflip','dice','high_low','wheel') COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rp_point_request_id` bigint unsigned DEFAULT NULL,
  `request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stake_rp` int unsigned NOT NULL DEFAULT '0',
  `payout_rp` int unsigned NOT NULL DEFAULT '0',
  `net_rp` int NOT NULL DEFAULT '0',
  `odds_basis_points` int unsigned NOT NULL DEFAULT '0',
  `player_choice` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `roll_result` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('queued','processing','confirmed','rejected','failed','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rp_game_rounds_player` (`player_id`,`created_at`),
  KEY `idx_rp_game_rounds_request` (`rp_point_request_id`),
  KEY `idx_rp_game_rounds_status` (`status`,`created_at`),
  CONSTRAINT `fk_rp_game_rounds_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_game_rounds_request` FOREIGN KEY (`rp_point_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_game_rounds`
--

LOCK TABLES `rp_game_rounds` WRITE;
/*!40000 ALTER TABLE `rp_game_rounds` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_game_rounds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_game_self_exclusions`
--

DROP TABLE IF EXISTS `rp_game_self_exclusions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_game_self_exclusions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `starts_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ends_at` timestamp NULL DEFAULT NULL,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rp_game_self_exclusions_player` (`player_id`,`starts_at`,`ends_at`),
  CONSTRAINT `fk_rp_game_self_exclusions_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_game_self_exclusions`
--

LOCK TABLES `rp_game_self_exclusions` WRITE;
/*!40000 ALTER TABLE `rp_game_self_exclusions` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_game_self_exclusions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_game_settings`
--

DROP TABLE IF EXISTS `rp_game_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_game_settings` (
  `id` tinyint unsigned NOT NULL,
  `games_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `coinflip_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `dice_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `jackpot_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `monument_extraction_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `raid_duel_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `supply_run_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `high_low_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `wheel_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `min_stake_rp` int unsigned NOT NULL DEFAULT '200',
  `max_stake_rp` int unsigned NOT NULL DEFAULT '2000',
  `coinflip_payout_multiplier_basis` int unsigned NOT NULL DEFAULT '200',
  `dice_win_chance_percent` int unsigned NOT NULL DEFAULT '45',
  `dice_payout_multiplier_basis` int unsigned NOT NULL DEFAULT '200',
  `jackpot_ticket_cost_rp` int unsigned NOT NULL DEFAULT '200',
  `jackpot_max_entries_per_player` int unsigned NOT NULL DEFAULT '10',
  `jackpot_round_minutes` int unsigned NOT NULL DEFAULT '30',
  `jackpot_house_edge_percent` int unsigned NOT NULL DEFAULT '10',
  `pool_round_minutes` int unsigned NOT NULL DEFAULT '20',
  `pool_house_edge_percent` int unsigned NOT NULL DEFAULT '8',
  `daily_wager_cap_rp` int unsigned NOT NULL DEFAULT '10000',
  `daily_loss_cap_rp` int unsigned NOT NULL DEFAULT '5000',
  `self_exclusion_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `terms_copy` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_game_settings`
--

LOCK TABLES `rp_game_settings` WRITE;
/*!40000 ALTER TABLE `rp_game_settings` DISABLE KEYS */;
INSERT INTO `rp_game_settings` VALUES (1,1,1,1,1,0,1,1,1,1,200,2000,200,45,200,200,10,30,10,20,8,10000,5000,1,'RP games use in-game Raidlands RP only. RP has no cash value, outcomes are not final until the Rust server confirms the point change, and admins may pause games at any time.','2026-07-11 01:51:36','2026-07-11 01:51:36');
/*!40000 ALTER TABLE `rp_game_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_jackpot_entries`
--

DROP TABLE IF EXISTS `rp_jackpot_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_jackpot_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `round_id` bigint unsigned NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rp_point_request_id` bigint unsigned DEFAULT NULL,
  `request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `ticket_count` int unsigned NOT NULL DEFAULT '1',
  `cost_rp` int unsigned NOT NULL DEFAULT '0',
  `status` enum('queued','processing','confirmed','rejected','failed','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rp_jackpot_entries_round` (`round_id`,`status`),
  KEY `idx_rp_jackpot_entries_player_round` (`player_id`,`round_id`,`status`),
  KEY `idx_rp_jackpot_entries_request` (`rp_point_request_id`),
  CONSTRAINT `fk_rp_jackpot_entries_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_jackpot_entries_request` FOREIGN KEY (`rp_point_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rp_jackpot_entries_round` FOREIGN KEY (`round_id`) REFERENCES `rp_jackpot_rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_jackpot_entries`
--

LOCK TABLES `rp_jackpot_entries` WRITE;
/*!40000 ALTER TABLE `rp_jackpot_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_jackpot_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_jackpot_rounds`
--

DROP TABLE IF EXISTS `rp_jackpot_rounds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_jackpot_rounds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `round_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('open','drawing','payout_queued','paid','failed','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `ticket_cost_rp` int unsigned NOT NULL DEFAULT '200',
  `max_entries_per_player` int unsigned NOT NULL DEFAULT '10',
  `house_edge_percent` int unsigned NOT NULL DEFAULT '10',
  `opens_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closes_at` timestamp NULL DEFAULT NULL,
  `pot_rp` int unsigned NOT NULL DEFAULT '0',
  `total_entries` int unsigned NOT NULL DEFAULT '0',
  `winner_player_id` bigint unsigned DEFAULT NULL,
  `winner_steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `winner_entry_id` bigint unsigned DEFAULT NULL,
  `payout_request_id` bigint unsigned DEFAULT NULL,
  `payout_request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `payout_rp` int unsigned NOT NULL DEFAULT '0',
  `draw_roll` int unsigned NOT NULL DEFAULT '0',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rp_jackpot_rounds_key` (`round_key`),
  KEY `idx_rp_jackpot_rounds_status` (`status`,`closes_at`),
  KEY `idx_rp_jackpot_rounds_winner` (`winner_player_id`),
  KEY `idx_rp_jackpot_rounds_payout` (`payout_request_id`),
  CONSTRAINT `fk_rp_jackpot_rounds_payout` FOREIGN KEY (`payout_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rp_jackpot_rounds_winner` FOREIGN KEY (`winner_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_jackpot_rounds`
--

LOCK TABLES `rp_jackpot_rounds` WRITE;
/*!40000 ALTER TABLE `rp_jackpot_rounds` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_jackpot_rounds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_point_requests`
--

DROP TABLE IF EXISTS `rp_point_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_point_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` enum('vote_reward','coinflip','dice','high_low','wheel','jackpot_entry','jackpot_payout','raid_duel_entry','raid_duel_payout','supply_run_entry','supply_run_payout','monument_wager','monument_payout','admin_adjustment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `debit_rp` int unsigned NOT NULL DEFAULT '0',
  `credit_rp` int unsigned NOT NULL DEFAULT '0',
  `reason` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('queued','processing','confirmed','rejected','failed','expired','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `fail_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `balance_before` int DEFAULT NULL,
  `balance_after` int DEFAULT NULL,
  `bridge_attempts` int unsigned NOT NULL DEFAULT '0',
  `locked_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `metadata_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rp_point_requests_token` (`request_token`),
  KEY `idx_rp_point_requests_status` (`status`,`expires_at`,`locked_at`),
  KEY `idx_rp_point_requests_player` (`player_id`,`created_at`),
  KEY `idx_rp_point_requests_source` (`source_type`,`source_id`),
  CONSTRAINT `fk_rp_point_requests_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_point_requests`
--

LOCK TABLES `rp_point_requests` WRITE;
/*!40000 ALTER TABLE `rp_point_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_point_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_pool_entries`
--

DROP TABLE IF EXISTS `rp_pool_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_pool_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `round_id` bigint unsigned NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entry_request_id` bigint unsigned DEFAULT NULL,
  `entry_request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `payout_request_id` bigint unsigned DEFAULT NULL,
  `payout_request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `option_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stake_rp` int unsigned NOT NULL DEFAULT '0',
  `payout_rp` int unsigned NOT NULL DEFAULT '0',
  `net_rp` int NOT NULL DEFAULT '0',
  `status` enum('queued','processing','confirmed','rejected','failed','expired','canceled','lost','payout_queued','paid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rp_pool_entries_round` (`round_id`,`status`),
  KEY `idx_rp_pool_entries_player` (`player_id`,`created_at`),
  KEY `idx_rp_pool_entries_entry_request` (`entry_request_id`),
  KEY `idx_rp_pool_entries_payout_request` (`payout_request_id`),
  CONSTRAINT `fk_rp_pool_entries_entry_request` FOREIGN KEY (`entry_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rp_pool_entries_payout_request` FOREIGN KEY (`payout_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rp_pool_entries_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_pool_entries_round` FOREIGN KEY (`round_id`) REFERENCES `rp_pool_rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_pool_entries`
--

LOCK TABLES `rp_pool_entries` WRITE;
/*!40000 ALTER TABLE `rp_pool_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_pool_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_pool_rounds`
--

DROP TABLE IF EXISTS `rp_pool_rounds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_pool_rounds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `game_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `round_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('open','drawing','payout_queued','paid','failed','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `options_json` longtext COLLATE utf8mb4_unicode_ci,
  `house_edge_percent` int unsigned NOT NULL DEFAULT '8',
  `opens_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closes_at` timestamp NULL DEFAULT NULL,
  `total_stake_rp` int unsigned NOT NULL DEFAULT '0',
  `total_entries` int unsigned NOT NULL DEFAULT '0',
  `outcome_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outcome_roll` int unsigned NOT NULL DEFAULT '0',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rp_pool_rounds_key` (`round_key`),
  KEY `idx_rp_pool_rounds_game_status` (`game_type`,`status`,`closes_at`),
  KEY `idx_rp_pool_rounds_status` (`status`,`closes_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_pool_rounds`
--

LOCK TABLES `rp_pool_rounds` WRITE;
/*!40000 ALTER TABLE `rp_pool_rounds` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_pool_rounds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_purchase_requests`
--

DROP TABLE IF EXISTS `rp_purchase_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_purchase_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `store_price_id` bigint unsigned NOT NULL,
  `rp_subscription_id` bigint unsigned DEFAULT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rp_cost` int unsigned NOT NULL DEFAULT '0',
  `access_interval` enum('one_time','day','week','month','year') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'month',
  `access_duration_seconds` int unsigned NOT NULL DEFAULT '0',
  `auto_renew_requested` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('queued','processing','confirmed','rejected','failed','expired','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `fail_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `balance_before` int DEFAULT NULL,
  `balance_after` int DEFAULT NULL,
  `bridge_attempts` int unsigned NOT NULL DEFAULT '0',
  `locked_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rp_purchase_requests_token` (`request_token`),
  KEY `idx_rp_purchase_requests_status` (`status`,`expires_at`,`locked_at`),
  KEY `idx_rp_purchase_requests_player` (`player_id`,`created_at`),
  KEY `idx_rp_purchase_requests_subscription` (`rp_subscription_id`,`created_at`),
  KEY `fk_rp_purchase_requests_product` (`product_id`),
  KEY `fk_rp_purchase_requests_price` (`store_price_id`),
  CONSTRAINT `fk_rp_purchase_requests_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_purchase_requests_price` FOREIGN KEY (`store_price_id`) REFERENCES `store_prices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rp_purchase_requests_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rp_purchase_requests_subscription` FOREIGN KEY (`rp_subscription_id`) REFERENCES `rp_subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_purchase_requests`
--

LOCK TABLES `rp_purchase_requests` WRITE;
/*!40000 ALTER TABLE `rp_purchase_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_purchase_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rp_subscriptions`
--

DROP TABLE IF EXISTS `rp_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rp_subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `store_price_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','cancel_at_period_end','past_due','canceled','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `rp_cost` int unsigned NOT NULL DEFAULT '0',
  `access_interval` enum('one_time','day','week','month','year') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'month',
  `access_duration_seconds` int unsigned NOT NULL DEFAULT '0',
  `current_period_start` timestamp NULL DEFAULT NULL,
  `current_period_end` timestamp NULL DEFAULT NULL,
  `next_renewal_at` timestamp NULL DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT '0',
  `last_request_id` bigint unsigned DEFAULT NULL,
  `failed_attempts` int unsigned NOT NULL DEFAULT '0',
  `canceled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rp_subscriptions_player_status` (`player_id`,`status`),
  KEY `idx_rp_subscriptions_due` (`status`,`cancel_at_period_end`,`next_renewal_at`),
  KEY `idx_rp_subscriptions_price` (`store_price_id`),
  KEY `fk_rp_subscriptions_product` (`product_id`),
  CONSTRAINT `fk_rp_subscriptions_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_subscriptions_price` FOREIGN KEY (`store_price_id`) REFERENCES `store_prices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rp_subscriptions_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rp_subscriptions`
--

LOCK TABLES `rp_subscriptions` WRITE;
/*!40000 ALTER TABLE `rp_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `rp_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `server_map_images`
--

DROP TABLE IF EXISTS `server_map_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `server_map_images` (
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wipe_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `map_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `render_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `public_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `relative_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image_mime` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image_extension` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image_bytes` int unsigned NOT NULL DEFAULT '0',
  `image_width` int unsigned NOT NULL DEFAULT '0',
  `image_height` int unsigned NOT NULL DEFAULT '0',
  `resolution` int unsigned NOT NULL DEFAULT '0',
  `world_size` int unsigned NOT NULL DEFAULT '0',
  `seed` int unsigned NOT NULL DEFAULT '0',
  `protocol_network` int unsigned NOT NULL DEFAULT '0',
  `generated_at` timestamp NULL DEFAULT NULL,
  `published_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`),
  KEY `idx_server_map_images_wipe` (`server_id`,`wipe_key`),
  KEY `idx_server_map_images_published` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `server_map_images`
--

LOCK TABLES `server_map_images` WRITE;
/*!40000 ALTER TABLE `server_map_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `server_map_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `server_status`
--

DROP TABLE IF EXISTS `server_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `server_status` (
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `online` tinyint(1) DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `status_label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Unknown',
  `generated_at` timestamp NULL DEFAULT NULL,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `players` int unsigned NOT NULL DEFAULT '0',
  `max_players` int unsigned NOT NULL DEFAULT '0',
  `queue` int unsigned NOT NULL DEFAULT '0',
  `joining` int unsigned NOT NULL DEFAULT '0',
  `sleepers` int unsigned NOT NULL DEFAULT '0',
  `server_fps` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `server_fps_average` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `entity_count` int unsigned NOT NULL DEFAULT '0',
  `map_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `world_size` int unsigned NOT NULL DEFAULT '0',
  `seed` int unsigned NOT NULL DEFAULT '0',
  `wipe_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `wipe_started_at` timestamp NULL DEFAULT NULL,
  `payload_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `details_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`),
  KEY `idx_server_status_received` (`received_at`),
  KEY `idx_server_status_generated` (`generated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `server_status`
--

LOCK TABLES `server_status` WRITE;
/*!40000 ALTER TABLE `server_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `server_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `server_status_daily_rollups`
--

DROP TABLE IF EXISTS `server_status_daily_rollups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `server_status_daily_rollups` (
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bucket_date` date NOT NULL,
  `daily_peak` int unsigned NOT NULL DEFAULT '0',
  `average_players` decimal(8,2) NOT NULL DEFAULT '0.00',
  `uptime_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `downtime_count` int unsigned NOT NULL DEFAULT '0',
  `online_sample_count` int unsigned NOT NULL DEFAULT '0',
  `sample_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`,`bucket_date`),
  KEY `idx_server_status_daily_bucket` (`bucket_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `server_status_daily_rollups`
--

LOCK TABLES `server_status_daily_rollups` WRITE;
/*!40000 ALTER TABLE `server_status_daily_rollups` DISABLE KEYS */;
/*!40000 ALTER TABLE `server_status_daily_rollups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `server_status_hourly_rollups`
--

DROP TABLE IF EXISTS `server_status_hourly_rollups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `server_status_hourly_rollups` (
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bucket_hour` datetime NOT NULL,
  `avg_players` decimal(8,2) NOT NULL DEFAULT '0.00',
  `peak_players` int unsigned NOT NULL DEFAULT '0',
  `avg_queue` decimal(8,2) NOT NULL DEFAULT '0.00',
  `online_sample_count` int unsigned NOT NULL DEFAULT '0',
  `sample_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`,`bucket_hour`),
  KEY `idx_server_status_hourly_bucket` (`bucket_hour`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `server_status_hourly_rollups`
--

LOCK TABLES `server_status_hourly_rollups` WRITE;
/*!40000 ALTER TABLE `server_status_hourly_rollups` DISABLE KEYS */;
/*!40000 ALTER TABLE `server_status_hourly_rollups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `server_status_samples`
--

DROP TABLE IF EXISTS `server_status_samples`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `server_status_samples` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generated_at` timestamp NULL DEFAULT NULL,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `online` tinyint(1) DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `players` int unsigned NOT NULL DEFAULT '0',
  `max_players` int unsigned NOT NULL DEFAULT '0',
  `queue` int unsigned NOT NULL DEFAULT '0',
  `joining` int unsigned NOT NULL DEFAULT '0',
  `sleepers` int unsigned NOT NULL DEFAULT '0',
  `map_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `payload_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_server_status_samples_payload` (`server_id`,`generated_at`,`payload_hash`),
  KEY `idx_server_status_samples_server_received` (`server_id`,`received_at`),
  KEY `idx_server_status_samples_status` (`server_id`,`online`,`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `server_status_samples`
--

LOCK TABLES `server_status_samples` WRITE;
/*!40000 ALTER TABLE `server_status_samples` DISABLE KEYS */;
/*!40000 ALTER TABLE `server_status_samples` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stats_ingest_log`
--

DROP TABLE IF EXISTS `stats_ingest_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_ingest_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wipe_id` bigint unsigned DEFAULT NULL,
  `wipe_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `generated_at` timestamp NULL DEFAULT NULL,
  `players_received` int unsigned NOT NULL DEFAULT '0',
  `players_accepted` int unsigned NOT NULL DEFAULT '0',
  `error_count` int unsigned NOT NULL DEFAULT '0',
  `payload_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stats_ingest_server_created` (`server_id`,`created_at`),
  KEY `idx_stats_ingest_wipe` (`wipe_id`),
  CONSTRAINT `fk_stats_ingest_wipe` FOREIGN KEY (`wipe_id`) REFERENCES `wipe_seasons` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stats_ingest_log`
--

LOCK TABLES `stats_ingest_log` WRITE;
/*!40000 ALTER TABLE `stats_ingest_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `stats_ingest_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `steam_identities`
--

DROP TABLE IF EXISTS `steam_identities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `steam_identities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_steam_identities_steam_id64` (`steam_id64`),
  KEY `idx_steam_identities_player_id` (`player_id`),
  CONSTRAINT `fk_steam_identities_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `steam_identities`
--

LOCK TABLES `steam_identities` WRITE;
/*!40000 ALTER TABLE `steam_identities` DISABLE KEYS */;
INSERT INTO `steam_identities` VALUES (1,1,'76561190000000000','Codex Auth Test','','','2026-07-11 01:51:37','2026-07-11 01:51:37','2026-07-11 01:51:37');
/*!40000 ALTER TABLE `steam_identities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_prices`
--

DROP TABLE IF EXISTS `store_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_prices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `payment_method` enum('stripe','rp') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'stripe',
  `stripe_price_id` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stripe_lookup_key` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stripe_managed` tinyint(1) NOT NULL DEFAULT '0',
  `stripe_sync_mode` enum('auto','external','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'auto',
  `stripe_sync_status` enum('pending','synced','skipped','archived','external','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `stripe_sync_error` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stripe_last_synced_at` timestamp NULL DEFAULT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `amount_cents` int unsigned NOT NULL DEFAULT '0',
  `rp_cost` int unsigned NOT NULL DEFAULT '0',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `billing_interval` enum('one_time','day','week','month','year') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'one_time',
  `access_interval` enum('one_time','day','week','month','year') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'one_time',
  `access_duration_seconds` int unsigned NOT NULL DEFAULT '0',
  `allow_auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `is_default` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_prices_stripe_price_id` (`stripe_price_id`),
  KEY `idx_store_prices_product_active` (`product_id`,`is_active`,`is_default`),
  KEY `idx_store_prices_stripe_lookup` (`stripe_lookup_key`),
  KEY `idx_store_prices_stripe_sync` (`stripe_managed`,`stripe_sync_status`,`stripe_last_synced_at`),
  CONSTRAINT `fk_store_prices_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_prices`
--

LOCK TABLES `store_prices` WRITE;
/*!40000 ALTER TABLE `store_prices` DISABLE KEYS */;
INSERT INTO `store_prices` VALUES (1,6,'rp','rp_pvp-kit-breach_one_time','',0,'disabled','skipped','',NULL,'One-time RP Unlock',0,0,'rp','one_time','one_time',0,0,0,0,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(2,5,'rp','rp_pvp-kit-elite_one_time','',0,'disabled','skipped','',NULL,'One-time RP Unlock',0,0,'rp','one_time','one_time',0,0,0,0,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(3,4,'rp','rp_pvp-kit-heavy_one_time','',0,'disabled','skipped','',NULL,'One-time RP Unlock',0,0,'rp','one_time','one_time',0,0,0,0,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(4,1,'rp','rp_pvp-kit-light_one_time','',0,'disabled','skipped','',NULL,'One-time RP Unlock',0,0,'rp','one_time','one_time',0,0,0,0,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(5,2,'rp','rp_pvp-kit-rifle_one_time','',0,'disabled','skipped','',NULL,'One-time RP Unlock',0,0,'rp','one_time','one_time',0,0,0,0,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(6,3,'rp','rp_pvp-kit-roamer_one_time','',0,'disabled','skipped','',NULL,'One-time RP Unlock',0,0,'rp','one_time','one_time',0,0,0,0,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(8,7,'rp','rp_rank-vip_week','',0,'disabled','skipped','',NULL,'RP Week',0,45000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(9,8,'rp','rp_rank-vip-plus_week','',0,'disabled','skipped','',NULL,'RP Week',0,70000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(10,9,'rp','rp_rank-mvp_week','',0,'disabled','skipped','',NULL,'RP Week',0,90000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(11,10,'rp','rp_rank-golden-vip_week','',0,'disabled','skipped','',NULL,'RP Week',0,130000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(12,11,'rp','rp_rank-diamond-vip_week','',0,'disabled','skipped','',NULL,'RP Week',0,250000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(13,12,'rp','rp_rank-ultimate-vip_week','',0,'disabled','skipped','',NULL,'RP Week',0,400000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(14,13,'rp','rp_rank-titan-vip_week','',0,'disabled','skipped','',NULL,'RP Week',0,750000,'usd','one_time','week',604800,1,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(15,14,'rp','rp_perk-queue-priority_week','',0,'disabled','skipped','',NULL,'RP Week',0,8000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(16,15,'rp','rp_perk-teleport-instant_week','',0,'disabled','skipped','',NULL,'RP Week',0,12000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(17,16,'rp','rp_perk-home-5s_week','',0,'disabled','skipped','',NULL,'RP Week',0,10000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(18,17,'rp','rp_perk-sign-art_week','',0,'disabled','skipped','',NULL,'RP Week',0,6000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(19,18,'rp','rp_perk-chat-title_week','',0,'disabled','skipped','',NULL,'RP Week',0,8000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(20,19,'rp','rp_perk-backpack-36_week','',0,'disabled','skipped','',NULL,'RP Week',0,12000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(21,20,'rp','rp_perk-backpack-42_week','',0,'disabled','skipped','',NULL,'RP Week',0,18000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(22,21,'rp','rp_perk-backpack-48_week','',0,'disabled','skipped','',NULL,'RP Week',0,24000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(23,22,'rp','rp_perk-backpack-keep-death_week','',0,'disabled','skipped','',NULL,'RP Week',0,25000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(24,23,'rp','rp_perk-backpack-keep-wipe_week','',0,'disabled','skipped','',NULL,'RP Week',0,40000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(25,24,'rp','rp_perk-spawn-full_week','',0,'disabled','skipped','',NULL,'RP Week',0,10000,'usd','one_time','week',604800,0,0,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(26,25,'rp','rp_perk-vehicle-hp-125_week','',0,'disabled','skipped','',NULL,'RP Week',0,18000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(27,26,'rp','rp_perk-vehicle-hp-150_week','',0,'disabled','skipped','',NULL,'RP Week',0,35000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(28,27,'rp','rp_perk-tc-12_week','',0,'disabled','skipped','',NULL,'RP Week',0,35000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(29,28,'rp','rp_perk-minicopter-instant-takeoff_week','',0,'disabled','skipped','',NULL,'RP Week',0,25000,'usd','one_time','week',604800,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(30,29,'rp','rp_perk-shop-sale-25_week','',0,'disabled','skipped','',NULL,'RP Week',0,60000,'usd','one_time','week',604800,0,0,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(31,30,'rp','rp_perk-shop-sale-50_week','',0,'disabled','skipped','',NULL,'RP Week',0,140000,'usd','one_time','week',604800,0,0,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(32,31,'rp','rp_perk-shop-sale-75_week','',0,'disabled','skipped','',NULL,'RP Week',0,300000,'usd','one_time','week',604800,0,0,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(33,32,'rp','rp_redeem-kit-vip_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,8000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(34,33,'rp','rp_redeem-kit-vip-plus_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,12000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(35,34,'rp','rp_redeem-kit-mvp_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,16000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(36,35,'rp','rp_redeem-kit-golden-vip_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,35000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(37,36,'rp','rp_redeem-kit-ultimate-vip_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,70000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(38,37,'rp','rp_redeem-kit-titan-vip_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,150000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(39,38,'rp','rp_redeem-pack-sentry-small_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,10000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(40,39,'rp','rp_redeem-pack-sentry-large_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,30000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(41,40,'rp','rp_redeem-pack-portafort_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,8000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(42,41,'rp','rp_redeem-pack-vehicle_one_time','',0,'disabled','skipped','',NULL,'RP One Time',0,40000,'usd','one_time','one_time',0,0,1,1,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(71,35,'stripe','configure_redeem-kit-golden-vip_cash_pass_one_time','raidlands_store_price_71',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(72,34,'stripe','configure_redeem-kit-mvp_cash_pass_one_time','raidlands_store_price_72',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(73,37,'stripe','configure_redeem-kit-titan-vip_cash_pass_one_time','raidlands_store_price_73',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(74,36,'stripe','configure_redeem-kit-ultimate-vip_cash_pass_one_time','raidlands_store_price_74',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(75,32,'stripe','configure_redeem-kit-vip_cash_pass_one_time','raidlands_store_price_75',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(76,33,'stripe','configure_redeem-kit-vip-plus_cash_pass_one_time','raidlands_store_price_76',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(77,40,'stripe','configure_redeem-pack-portafort_cash_pass_one_time','raidlands_store_price_77',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(78,39,'stripe','configure_redeem-pack-sentry-large_cash_pass_one_time','raidlands_store_price_78',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(79,38,'stripe','configure_redeem-pack-sentry-small_cash_pass_one_time','raidlands_store_price_79',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(80,41,'stripe','configure_redeem-pack-vehicle_cash_pass_one_time','raidlands_store_price_80',0,'auto','skipped','',NULL,'Lifetime Cash Pass',0,0,'usd','one_time','one_time',0,0,0,1,'2026-07-11 01:51:36','2026-07-11 01:51:36');
/*!40000 ALTER TABLE `store_prices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_product_permission_grants`
--

DROP TABLE IF EXISTS `store_product_permission_grants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_product_permission_grants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `permission_name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_label` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT '100',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_product_permission_grants` (`product_id`,`permission_name`),
  KEY `idx_store_product_permission_product` (`product_id`,`sort_order`),
  CONSTRAINT `fk_store_product_permission_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_product_permission_grants`
--

LOCK TABLES `store_product_permission_grants` WRITE;
/*!40000 ALTER TABLE `store_product_permission_grants` DISABLE KEYS */;
INSERT INTO `store_product_permission_grants` VALUES (1,7,'backpacks.size.36','backpacks.size.36',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(2,7,'betterchat.group.vip','betterchat.group.vip',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(3,7,'bypassqueue.allow','bypassqueue.allow',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(4,7,'nteleportation.home.5s','nteleportation.home.5s',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(5,7,'nteleportation.instant','nteleportation.instant',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(6,7,'playtimetracker.vip','playtimetracker.vip',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(7,7,'raidlands.vehicle.hp.125','raidlands.vehicle.hp.125',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(8,7,'signartist.url','signartist.url',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(9,8,'backpacks.size.36','backpacks.size.36',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(10,8,'betterchat.group.vip_plus','betterchat.group.vip_plus',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(11,8,'bypassqueue.allow','bypassqueue.allow',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(12,8,'nteleportation.home.5s','nteleportation.home.5s',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(13,8,'nteleportation.instant','nteleportation.instant',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(14,8,'playtimetracker.vip_plus','playtimetracker.vip_plus',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(15,8,'raidlands.vehicle.hp.125','raidlands.vehicle.hp.125',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(16,8,'signartist.url','signartist.url',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(17,9,'backpacks.keepondeath','backpacks.keepondeath',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(18,9,'backpacks.size.36','backpacks.size.36',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(19,9,'betterchat.group.mvp','betterchat.group.mvp',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(20,9,'bypassqueue.allow','bypassqueue.allow',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(21,9,'nteleportation.home.5s','nteleportation.home.5s',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(22,9,'nteleportation.instant','nteleportation.instant',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(23,9,'playtimetracker.mvp','playtimetracker.mvp',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(24,9,'raidlands.vehicle.hp.125','raidlands.vehicle.hp.125',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(25,9,'signartist.url','signartist.url',90,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(26,10,'backpacks.keepondeath','backpacks.keepondeath',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(27,10,'backpacks.keeponwipe.all','backpacks.keeponwipe.all',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(28,10,'backpacks.size.42','backpacks.size.42',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(29,10,'betterchat.group.golden_vip','betterchat.group.golden_vip',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(30,10,'bypassqueue.allow','bypassqueue.allow',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(31,10,'cupboardlimiter.limit_1','cupboardlimiter.limit_1',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(32,10,'nteleportation.home.5s','nteleportation.home.5s',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(33,10,'nteleportation.instant','nteleportation.instant',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(34,10,'playtimetracker.golden_vip','playtimetracker.golden_vip',90,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(35,10,'raidlands.vehicle.hp.125','raidlands.vehicle.hp.125',100,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(36,10,'signartist.url','signartist.url',110,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(37,11,'backpacks.keepondeath','backpacks.keepondeath',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(38,11,'backpacks.keeponwipe.all','backpacks.keeponwipe.all',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(39,11,'backpacks.size.48','backpacks.size.48',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(40,11,'betterchat.group.diamond_vip','betterchat.group.diamond_vip',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(41,11,'bypassqueue.allow','bypassqueue.allow',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(42,11,'cupboardlimiter.limit_1','cupboardlimiter.limit_1',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(43,11,'nteleportation.home.5s','nteleportation.home.5s',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(44,11,'nteleportation.instant','nteleportation.instant',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(45,11,'playtimetracker.diamond_vip','playtimetracker.diamond_vip',90,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(46,11,'raidlands.vehicle.hp.125','raidlands.vehicle.hp.125',100,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(47,11,'signartist.url','signartist.url',110,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(48,12,'backpacks.keepondeath','backpacks.keepondeath',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(49,12,'backpacks.keeponwipe.all','backpacks.keeponwipe.all',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(50,12,'backpacks.size.48','backpacks.size.48',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(51,12,'betterchat.group.ultimate_vip','betterchat.group.ultimate_vip',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(52,12,'bypassqueue.allow','bypassqueue.allow',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(53,12,'cupboardlimiter.limit_1','cupboardlimiter.limit_1',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(54,12,'nteleportation.home.5s','nteleportation.home.5s',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(55,12,'nteleportation.instant','nteleportation.instant',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(56,12,'playtimetracker.ultimate_vip','playtimetracker.ultimate_vip',90,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(57,12,'raidlands.vehicle.hp.150','raidlands.vehicle.hp.150',100,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(58,12,'signartist.url','signartist.url',110,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(59,13,'backpacks.keepondeath','backpacks.keepondeath',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(60,13,'backpacks.keeponwipe.all','backpacks.keeponwipe.all',20,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(61,13,'backpacks.size.48','backpacks.size.48',30,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(62,13,'betterchat.group.titan_vip','betterchat.group.titan_vip',40,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(63,13,'bypassqueue.allow','bypassqueue.allow',50,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(64,13,'cupboardlimiter.limit_1','cupboardlimiter.limit_1',60,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(65,13,'nteleportation.home.5s','nteleportation.home.5s',70,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(66,13,'nteleportation.instant','nteleportation.instant',80,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(67,13,'playtimetracker.titan_vip','playtimetracker.titan_vip',90,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(68,13,'raidlands.vehicle.hp.150','raidlands.vehicle.hp.150',100,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(69,13,'signartist.url','signartist.url',110,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(70,13,'spawnheli.minicopter.instanttakeoff','spawnheli.minicopter.instanttakeoff',120,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(71,14,'bypassqueue.allow','bypassqueue.allow',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(72,15,'nteleportation.instant','nteleportation.instant',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(73,16,'nteleportation.home.5s','nteleportation.home.5s',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(74,17,'signartist.url','signartist.url',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(75,18,'betterchat.group.perk_chat_title','betterchat.group.perk_chat_title',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(76,19,'backpacks.size.36','backpacks.size.36',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(77,20,'backpacks.size.42','backpacks.size.42',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(78,21,'backpacks.size.48','backpacks.size.48',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(79,22,'backpacks.keepondeath','backpacks.keepondeath',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(80,23,'backpacks.keeponwipe.all','backpacks.keeponwipe.all',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(81,25,'raidlands.vehicle.hp.125','raidlands.vehicle.hp.125',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(82,26,'raidlands.vehicle.hp.150','raidlands.vehicle.hp.150',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(83,27,'cupboardlimiter.limit_1','cupboardlimiter.limit_1',10,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(84,28,'spawnheli.minicopter.instanttakeoff','spawnheli.minicopter.instanttakeoff',10,'2026-07-11 01:51:35','2026-07-11 01:51:35');
/*!40000 ALTER TABLE `store_product_permission_grants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_products`
--

DROP TABLE IF EXISTS `store_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_type` enum('kit_bundle','kit_unlock','perk','vip_subscription','one_time_perk','one_time_kit_unlock') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'perk',
  `short_description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci,
  `oxide_group` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `tier_priority` int NOT NULL DEFAULT '0',
  `is_stackable` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '100',
  `stripe_product_id` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stripe_sync_mode` enum('auto','external','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'auto',
  `stripe_sync_status` enum('pending','synced','skipped','archived','external','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `stripe_sync_error` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `stripe_last_synced_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_products_slug` (`slug`),
  KEY `idx_store_products_type_active` (`product_type`,`is_active`,`sort_order`),
  KEY `idx_store_products_stripe_product` (`stripe_product_id`),
  KEY `idx_store_products_stripe_sync` (`stripe_sync_status`,`stripe_last_synced_at`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_products`
--

LOCK TABLES `store_products` WRITE;
/*!40000 ALTER TABLE `store_products` DISABLE KEYS */;
INSERT INTO `store_products` VALUES (1,'pvp-kit-light','Light PvP Kit Unlock','kit_unlock','Standalone unlock for the Light PvP kit.','Inactive RP product stub for the Light PvP kit. Set the final RP cost before launch.','perk_pvp_light',0,1,0,0,200,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(2,'pvp-kit-rifle','Rifle PvP Kit Unlock','kit_unlock','Standalone unlock for the Rifle PvP kit.','Inactive RP product stub for the Rifle PvP kit. Set the final RP cost before launch.','perk_pvp_rifle',0,1,0,0,210,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(3,'pvp-kit-roamer','Roamer PvP Kit Unlock','kit_unlock','Standalone unlock for the Roamer PvP kit.','Inactive RP product stub for the Roamer PvP kit. Set the final RP cost before launch.','perk_pvp_roamer',0,1,0,0,220,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(4,'pvp-kit-heavy','Heavy PvP Kit Unlock','kit_unlock','Standalone unlock for the Heavy PvP kit.','Inactive RP product stub for the Heavy PvP kit. Set the final RP cost before launch.','perk_pvp_heavy',0,1,0,0,230,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(5,'pvp-kit-elite','Elite PvP Kit Unlock','kit_unlock','Standalone unlock for the Elite PvP kit.','Inactive RP product stub for the Elite PvP kit. Set the final RP cost before launch.','perk_pvp_elite',0,1,0,0,240,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(6,'pvp-kit-breach','Breach PvP Kit Unlock','kit_unlock','Standalone unlock for the Breach PvP kit.','Inactive RP product stub for the Breach PvP kit. Set the final RP cost before launch.','perk_pvp_breach',0,1,0,0,250,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(7,'rank-vip','VIP','kit_bundle','Base paid package.','Base paid package.','rank_vip',10,0,1,1,10,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(8,'rank-vip-plus','VIP+','kit_bundle','Base package plus stronger playtime rate.','Base package plus stronger playtime rate.','rank_vip_plus',20,0,1,1,20,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(9,'rank-mvp','MVP','kit_bundle','Adds backpack keep-on-death.','Adds backpack keep-on-death.','rank_mvp',30,0,1,1,30,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(10,'rank-golden-vip','Golden VIP','kit_bundle','Adds wipe backpack retention and 12 TC limit.','Adds wipe backpack retention and 12 TC limit.','rank_golden_vip',40,0,1,1,40,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(11,'rank-diamond-vip','Diamond VIP','kit_bundle','No Diamond kit of its own; bundle tier only.','No Diamond kit of its own; bundle tier only.','rank_diamond_vip',50,0,1,1,50,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(12,'rank-ultimate-vip','Ultimate VIP','kit_bundle','Adds vehicle pack and 50% shop sale.','Adds vehicle pack and 50% shop sale.','rank_ultimate_vip',60,0,1,1,60,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(13,'rank-titan-vip','Titan VIP','kit_bundle','Top package; instant minicopter takeoff and 75% shop sale.','Top package; instant minicopter takeoff and 75% shop sale.','rank_titan_vip',70,0,1,1,70,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(14,'perk-queue-priority','Queue Priority / Bypass','perk','BypassQueue plugin and no-config permission backend are staged; verify live queue bypass before final approval.','BypassQueue plugin and no-config permission backend are staged; verify live queue bypass before final approval.','perk_queue_priority',0,0,1,0,80,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(15,'perk-teleport-instant','Instant Teleport','perk','Map to NTeleportation VIP countdown/cooldown keys.','Map to NTeleportation VIP countdown/cooldown keys.','perk_teleport_instant',0,0,1,0,90,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(16,'perk-home-5s','5 Second Home Teleport','perk','NTeleportation supports VIP home cooldown/countdown permissions.','NTeleportation supports VIP home cooldown/countdown permissions.','perk_home_5s',0,0,1,0,100,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(17,'perk-sign-art','Custom Sign Art /sil','perk','SignArtist plugin/config are staged; verify /sil on a player-owned sign before final approval.','SignArtist plugin/config are staged; verify /sil on a player-owned sign before final approval.','perk_sign_art',0,0,1,0,110,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(18,'perk-chat-title','Custom Chat Title','perk','Use BetterChat group/title data.','Use BetterChat group/title data.','perk_chat_title',0,0,1,0,120,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(19,'perk-backpack-36','Backpack Tier 1 - 36 Slots','perk','Uses current Backpacks permission size support.','Uses current Backpacks permission size support.','perk_backpack_36',0,0,1,0,130,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(20,'perk-backpack-42','Backpack Tier 2 - 42 Slots','perk','Uses current Backpacks permission size support.','Uses current Backpacks permission size support.','perk_backpack_42',0,0,1,0,140,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(21,'perk-backpack-48','Backpack Tier 3 - 48 Slots','perk','Uses current Backpacks permission size support.','Uses current Backpacks permission size support.','perk_backpack_48',0,0,1,0,150,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(22,'perk-backpack-keep-death','Keep Backpack on Death','perk','Ensure death retention is permission-gated, not global.','Ensure death retention is permission-gated, not global.','perk_backpack_keep_death',0,0,1,0,160,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(23,'perk-backpack-keep-wipe','Keep Backpack on Wipe','perk','Force wipe excluded; configure wipe ruleset permission.','Force wipe excluded; configure wipe ruleset permission.','perk_backpack_keep_wipe',0,0,1,0,170,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(24,'perk-spawn-full','Spawn Full Health + Food + Water','perk','Needs custom spawn hook if no existing plugin handles this.','Needs custom spawn hook if no existing plugin handles this.','perk_spawn_full',0,0,0,0,180,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(25,'perk-vehicle-hp-125','Shop Vehicle HP 1.25x','perk','Can be custom vehicle spawn wrapper or per-vehicle config.','Can be custom vehicle spawn wrapper or per-vehicle config.','perk_vehicle_hp_125',0,0,1,0,190,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(26,'perk-vehicle-hp-150','Shop Vehicle HP 1.5x','perk','Can be custom vehicle spawn wrapper or per-vehicle config.','Can be custom vehicle spawn wrapper or per-vehicle config.','perk_vehicle_hp_150',0,0,1,0,200,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(27,'perk-tc-12','TC Limit 12','perk','CupboardLimiter custom limit permission after config change.','CupboardLimiter custom limit permission after config change.','perk_tc_12',0,0,1,0,210,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(28,'perk-minicopter-instant-takeoff','Instant Minicopter Takeoff','perk','SpawnHeli supports permission-gated instant takeoff.','SpawnHeli supports permission-gated instant takeoff.','perk_minicopter_instant_takeoff',0,0,1,0,220,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:35'),(29,'perk-shop-sale-25','25% Shop Sale','perk','Exclude ranks, perks, RP, and subscriptions from discount loops.','Exclude ranks, perks, RP, and subscriptions from discount loops.','perk_shop_sale_25',0,0,0,0,230,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(30,'perk-shop-sale-50','50% Shop Sale','perk','Exclude ranks, perks, RP, and subscriptions from discount loops.','Exclude ranks, perks, RP, and subscriptions from discount loops.','perk_shop_sale_50',0,0,0,0,240,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(31,'perk-shop-sale-75','75% Shop Sale','perk','Exclude ranks, perks, RP, and subscriptions from discount loops.','Exclude ranks, perks, RP, and subscriptions from discount loops.','perk_shop_sale_75',0,0,0,0,250,'','auto','skipped','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(32,'redeem-kit-vip','VIP Kit Redeem','kit_unlock','Respect kit cooldown/max uses.','Respect kit cooldown/max uses.','store_redeem_kit_vip',0,1,1,0,260,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(33,'redeem-kit-vip-plus','VIP+ Kit Redeem','kit_unlock','Respect kit cooldown/max uses.','Respect kit cooldown/max uses.','store_redeem_kit_vip_plus',0,1,1,0,270,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(34,'redeem-kit-mvp','MVP Kit Redeem','kit_unlock','Respect kit cooldown/max uses.','Respect kit cooldown/max uses.','store_redeem_kit_mvp',0,1,1,0,280,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(35,'redeem-kit-golden-vip','Golden VIP Kit Redeem','kit_unlock','Once per wipe.','Once per wipe.','store_redeem_kit_golden_vip',0,1,1,0,290,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(36,'redeem-kit-ultimate-vip','Ultimate VIP Kit Redeem','kit_unlock','Once per wipe.','Once per wipe.','store_redeem_kit_ultimate_vip',0,1,1,0,300,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(37,'redeem-kit-titan-vip','Titan VIP Kit Redeem','kit_unlock','Once per wipe.','Once per wipe.','store_redeem_kit_titan_vip',0,1,1,0,310,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(38,'redeem-pack-sentry-small','Sentry Pack Small','kit_unlock','1 sentry, once/wipe.','1 sentry, once/wipe.','store_redeem_pack_sentry_small',0,1,1,0,320,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(39,'redeem-pack-sentry-large','Sentry Pack Large','kit_unlock','5 sentries, once/wipe.','5 sentries, once/wipe.','store_redeem_pack_sentry_large',0,1,1,0,330,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(40,'redeem-pack-portafort','Portafort Pack','kit_unlock','5 portaforts; requires CopyPaste/token implementation.','5 portaforts; requires CopyPaste/token implementation.','store_redeem_pack_portafort',0,1,1,0,340,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36'),(41,'redeem-pack-vehicle','Vehicle Pack','kit_unlock','5 of each allowed vehicle; non-heli vehicles need plugin support.','5 of each allowed vehicle; non-heli vehicles need plugin support.','store_redeem_pack_vehicle',0,1,1,0,350,'','auto','pending','',NULL,'2026-07-11 01:51:35','2026-07-11 01:51:36');
/*!40000 ALTER TABLE `store_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stripe_events`
--

DROP TABLE IF EXISTS `stripe_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stripe_event_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `processed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payload_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stripe_events_event_id` (`stripe_event_id`),
  KEY `idx_stripe_events_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stripe_events`
--

LOCK TABLES `stripe_events` WRITE;
/*!40000 ALTER TABLE `stripe_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `stripe_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `store_price_id` bigint unsigned NOT NULL,
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'incomplete',
  `current_period_start` timestamp NULL DEFAULT NULL,
  `current_period_end` timestamp NULL DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT '0',
  `canceled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscriptions_stripe_subscription` (`stripe_subscription_id`),
  KEY `idx_subscriptions_player_status` (`player_id`,`status`),
  KEY `fk_subscriptions_product` (`product_id`),
  KEY `fk_subscriptions_price` (`store_price_id`),
  CONSTRAINT `fk_subscriptions_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subscriptions_price` FOREIGN KEY (`store_price_id`) REFERENCES `store_prices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_subscriptions_product` FOREIGN KEY (`product_id`) REFERENCES `store_products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_feedback`
--

DROP TABLE IF EXISTS `support_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_feedback` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` bigint unsigned DEFAULT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `type` enum('bug','suggestion','feature_request') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bug',
  `status` enum('open','reviewing','planned','resolved','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `summary` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `contact_email` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `linked_display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `page_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `browser` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `admin_note` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_feedback_public_id` (`public_id`),
  KEY `idx_support_feedback_status_submitted` (`status`,`submitted_at`),
  KEY `idx_support_feedback_type_submitted` (`type`,`submitted_at`),
  KEY `idx_support_feedback_player` (`player_id`,`submitted_at`),
  KEY `idx_support_feedback_steam_id64` (`steam_id64`),
  CONSTRAINT `fk_support_feedback_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_feedback`
--

LOCK TABLES `support_feedback` WRITE;
/*!40000 ALTER TABLE `support_feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vote_reward_claims`
--

DROP TABLE IF EXISTS `vote_reward_claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vote_reward_claims` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `site_id` bigint unsigned NOT NULL,
  `player_id` bigint unsigned NOT NULL,
  `steam_id64` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rp_point_request_id` bigint unsigned DEFAULT NULL,
  `request_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `external_vote_id` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `claim_source` enum('manual','callback') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `status` enum('pending_callback','queued','processing','confirmed','rejected','failed','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `reward_rp` int unsigned NOT NULL DEFAULT '0',
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `callback_received` tinyint(1) NOT NULL DEFAULT '0',
  `claimed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vote_reward_external_vote` (`site_id`,`external_vote_id`),
  KEY `idx_vote_reward_claims_player_site` (`player_id`,`site_id`,`created_at`),
  KEY `idx_vote_reward_claims_request` (`rp_point_request_id`),
  CONSTRAINT `fk_vote_reward_claims_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_reward_claims_request` FOREIGN KEY (`rp_point_request_id`) REFERENCES `rp_point_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vote_reward_claims_site` FOREIGN KEY (`site_id`) REFERENCES `vote_reward_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vote_reward_claims`
--

LOCK TABLES `vote_reward_claims` WRITE;
/*!40000 ALTER TABLE `vote_reward_claims` DISABLE KEYS */;
/*!40000 ALTER TABLE `vote_reward_claims` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vote_reward_sites`
--

DROP TABLE IF EXISTS `vote_reward_sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vote_reward_sites` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `vote_url_template` varchar(700) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `verification_mode` enum('hybrid','strict','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hybrid',
  `api_provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `api_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `api_server_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `callback_token` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reward_rp` int unsigned NOT NULL DEFAULT '200',
  `cooldown_hours` int unsigned NOT NULL DEFAULT '24',
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '100',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vote_reward_sites_slug` (`slug`),
  KEY `idx_vote_reward_sites_active` (`is_active`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vote_reward_sites`
--

LOCK TABLES `vote_reward_sites` WRITE;
/*!40000 ALTER TABLE `vote_reward_sites` DISABLE KEYS */;
INSERT INTO `vote_reward_sites` VALUES (1,'raidlands-vote-site','Raidlands vote site','Configure the real vote URL, callback token, and active flag before showing this site publicly.','https://example.com/vote?steam={steam_id64}','hybrid','none','','','',200,24,0,100,'2026-07-11 01:51:36','2026-07-11 01:51:36'),(2,'rust-servers-net','Rust-Servers.net','Vote using Steam on Rust-Servers.net, then return here to verify and claim RP.','https://rust-servers.net/server/178053/vote/','hybrid','rust_servers','','178053','',200,24,0,10,'2026-07-11 07:05:40','2026-07-11 07:05:51');
/*!40000 ALTER TABLE `vote_reward_sites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wipe_seasons`
--

DROP TABLE IF EXISTS `wipe_seasons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wipe_seasons` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `server_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wipe_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_snapshot_at` timestamp NULL DEFAULT NULL,
  `snapshot_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wipe_seasons_server_key` (`server_id`,`wipe_key`),
  KEY `idx_wipe_seasons_active` (`server_id`,`is_active`,`started_at`),
  KEY `idx_wipe_seasons_last_snapshot` (`last_snapshot_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wipe_seasons`
--

LOCK TABLES `wipe_seasons` WRITE;
/*!40000 ALTER TABLE `wipe_seasons` DISABLE KEYS */;
/*!40000 ALTER TABLE `wipe_seasons` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-11  6:10:42
