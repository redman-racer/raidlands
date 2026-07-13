-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 13, 2026 at 12:13 AM
-- Server version: 11.4.12-MariaDB-cll-lve-log
-- PHP Version: 8.4.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `raiduonz_website`
--

-- --------------------------------------------------------

--
-- Table structure for table `server_environment_snapshots`
--

CREATE TABLE `server_environment_snapshots` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `server_id` varchar(120) NOT NULL,
  `wipe_key` varchar(160) NOT NULL,
  `sampled_at` datetime NOT NULL,
  `rust_time` decimal(6,3) NOT NULL DEFAULT 0.000,
  `day_fraction` decimal(7,6) NOT NULL DEFAULT 0.000000,
  `sun_x` decimal(9,6) NOT NULL DEFAULT 0.000000,
  `sun_y` decimal(9,6) NOT NULL DEFAULT 1.000000,
  `sun_z` decimal(9,6) NOT NULL DEFAULT 0.000000,
  `sun_intensity` decimal(7,4) NOT NULL DEFAULT 1.0000,
  `sun_color` varchar(7) NOT NULL DEFAULT '#ffc47a',
  `ambient_intensity` decimal(7,4) NOT NULL DEFAULT 0.3800,
  `ambient_color` varchar(7) NOT NULL DEFAULT '#ffead2',
  `cloud_coverage` decimal(7,4) DEFAULT NULL,
  `rain_intensity` decimal(7,4) DEFAULT NULL,
  `fog_intensity` decimal(7,4) DEFAULT NULL,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `server_environment_snapshots`
--

INSERT INTO `server_environment_snapshots` (`id`, `server_id`, `wipe_key`, `sampled_at`, `rust_time`, `day_fraction`, `sun_x`, `sun_y`, `sun_z`, `sun_intensity`, `sun_color`, `ambient_intensity`, `ambient_color`, `cloud_coverage`, `rain_intensity`, `fog_intensity`, `payload_json`, `created_at`) VALUES
(576, 'raidlands-main', 'raidlands-main', '2026-07-13 04:08:16', 7.882, 0.328431, 0.960108, 0.048170, 0.275451, 0.1367, '#ff613b', 0.1564, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:08:16.6882280Z\",\"rust_time\":7.882,\"day_fraction\":0.328431,\"sun_direction\":{\"x\":0.960108,\"y\":0.04817,\"z\":0.275451},\"sun_intensity\":0.1367,\"sun_color\":\"#ff613b\",\"ambient_intensity\":0.1564,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:08:16'),
(577, 'raidlands-main', 'raidlands-main', '2026-07-13 04:08:31', 7.986, 0.332765, 0.957152, 0.073874, 0.280004, 0.1830, '#ff643d', 0.1651, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:08:31.6866170Z\",\"rust_time\":7.986,\"day_fraction\":0.332765,\"sun_direction\":{\"x\":0.957152,\"y\":0.073874,\"z\":0.280004},\"sun_intensity\":0.183,\"sun_color\":\"#ff643d\",\"ambient_intensity\":0.1651,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:08:31'),
(578, 'raidlands-main', 'raidlands-main', '2026-07-13 04:08:46', 8.090, 0.337074, 0.953510, 0.099344, 0.284516, 0.2288, '#ff663f', 0.1738, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:08:46.6785610Z\",\"rust_time\":8.09,\"day_fraction\":0.337074,\"sun_direction\":{\"x\":0.95351,\"y\":0.099344,\"z\":0.284516},\"sun_intensity\":0.2288,\"sun_color\":\"#ff663f\",\"ambient_intensity\":0.1738,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:08:46'),
(579, 'raidlands-main', 'raidlands-main', '2026-07-13 04:09:01', 8.194, 0.341401, 0.949149, 0.124815, 0.289030, 0.2747, '#ff6940', 0.1824, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:09:01.6853590Z\",\"rust_time\":8.194,\"day_fraction\":0.341401,\"sun_direction\":{\"x\":0.949149,\"y\":0.124815,\"z\":0.28903},\"sun_intensity\":0.2747,\"sun_color\":\"#ff6940\",\"ambient_intensity\":0.1824,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:09:01'),
(580, 'raidlands-main', 'raidlands-main', '2026-07-13 04:09:16', 8.297, 0.345699, 0.944122, 0.149990, 0.293492, 0.3200, '#ff6c42', 0.1910, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:09:16.6932720Z\",\"rust_time\":8.297,\"day_fraction\":0.345699,\"sun_direction\":{\"x\":0.944122,\"y\":0.14999,\"z\":0.293492},\"sun_intensity\":0.32,\"sun_color\":\"#ff6c42\",\"ambient_intensity\":0.191,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:09:16'),
(581, 'raidlands-main', 'raidlands-main', '2026-07-13 04:09:31', 8.399, 0.349979, 0.938433, 0.174912, 0.297909, 0.3648, '#ff6f44', 0.1995, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:09:31.8047740Z\",\"rust_time\":8.399,\"day_fraction\":0.349979,\"sun_direction\":{\"x\":0.938433,\"y\":0.174912,\"z\":0.297909},\"sun_intensity\":0.3648,\"sun_color\":\"#ff6f44\",\"ambient_intensity\":0.1995,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:09:32'),
(582, 'raidlands-main', 'raidlands-main', '2026-07-13 04:09:46', 8.502, 0.354267, 0.932051, 0.199729, 0.302308, 0.4095, '#ff7145', 0.2079, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:09:46.6796380Z\",\"rust_time\":8.502,\"day_fraction\":0.354267,\"sun_direction\":{\"x\":0.932051,\"y\":0.199729,\"z\":0.302308},\"sun_intensity\":0.4095,\"sun_color\":\"#ff7145\",\"ambient_intensity\":0.2079,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:09:46'),
(583, 'raidlands-main', 'raidlands-main', '2026-07-13 04:10:01', 8.606, 0.358575, 0.924960, 0.224476, 0.306692, 0.4541, '#ff7447', 0.2163, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:10:01.6921150Z\",\"rust_time\":8.606,\"day_fraction\":0.358575,\"sun_direction\":{\"x\":0.92496,\"y\":0.224476,\"z\":0.306692},\"sun_intensity\":0.4541,\"sun_color\":\"#ff7447\",\"ambient_intensity\":0.2163,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:10:01'),
(584, 'raidlands-main', 'raidlands-main', '2026-07-13 04:10:16', 8.709, 0.362864, 0.917226, 0.248918, 0.311025, 0.4981, '#ff7649', 0.2246, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:10:16.7894440Z\",\"rust_time\":8.709,\"day_fraction\":0.362864,\"sun_direction\":{\"x\":0.917226,\"y\":0.248918,\"z\":0.311025},\"sun_intensity\":0.4981,\"sun_color\":\"#ff7649\",\"ambient_intensity\":0.2246,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:10:17'),
(585, 'raidlands-main', 'raidlands-main', '2026-07-13 04:10:31', 8.812, 0.367172, 0.908788, 0.273253, 0.315336, 0.5419, '#ff794a', 0.2329, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:10:31.6823010Z\",\"rust_time\":8.812,\"day_fraction\":0.367172,\"sun_direction\":{\"x\":0.908788,\"y\":0.273253,\"z\":0.315336},\"sun_intensity\":0.5419,\"sun_color\":\"#ff794a\",\"ambient_intensity\":0.2329,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:10:31'),
(586, 'raidlands-main', 'raidlands-main', '2026-07-13 04:10:49', 8.934, 0.372259, 0.897968, 0.301685, 0.320375, 0.5930, '#ff7c4c', 0.2426, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:10:49.5174490Z\",\"rust_time\":8.934,\"day_fraction\":0.372259,\"sun_direction\":{\"x\":0.897968,\"y\":0.301685,\"z\":0.320375},\"sun_intensity\":0.593,\"sun_color\":\"#ff7c4c\",\"ambient_intensity\":0.2426,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:10:49'),
(587, 'raidlands-main', 'raidlands-main', '2026-07-13 04:10:54', 8.934, 0.372269, 0.897947, 0.301738, 0.320384, 0.5931, '#ff7c4c', 0.2426, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:10:54.9353630Z\",\"rust_time\":8.934,\"day_fraction\":0.372269,\"sun_direction\":{\"x\":0.897947,\"y\":0.301738,\"z\":0.320384},\"sun_intensity\":0.5931,\"sun_color\":\"#ff7c4c\",\"ambient_intensity\":0.2426,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:10:55'),
(588, 'raidlands-main', 'raidlands-main', '2026-07-13 04:11:09', 9.035, 0.376471, 0.888313, 0.324959, 0.324502, 0.6349, '#ff7f4e', 0.2505, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:11:09.5131530Z\",\"rust_time\":9.035,\"day_fraction\":0.376471,\"sun_direction\":{\"x\":0.888313,\"y\":0.324959,\"z\":0.324502},\"sun_intensity\":0.6349,\"sun_color\":\"#ff7f4e\",\"ambient_intensity\":0.2505,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:11:09'),
(589, 'raidlands-main', 'raidlands-main', '2026-07-13 04:11:28', 9.168, 0.382010, 0.874672, 0.355167, 0.329856, 0.6893, '#ff8250', 0.2608, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:11:28.8829170Z\",\"rust_time\":9.168,\"day_fraction\":0.38201,\"sun_direction\":{\"x\":0.874672,\"y\":0.355167,\"z\":0.329856},\"sun_intensity\":0.6893,\"sun_color\":\"#ff8250\",\"ambient_intensity\":0.2608,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:11:30'),
(590, 'raidlands-main', 'raidlands-main', '2026-07-13 04:11:34', 9.170, 0.382077, 0.874500, 0.355531, 0.329920, 0.6900, '#ff8250', 0.2609, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:11:34.4753910Z\",\"rust_time\":9.17,\"day_fraction\":0.382077,\"sun_direction\":{\"x\":0.8745,\"y\":0.355531,\"z\":0.32992},\"sun_intensity\":0.69,\"sun_color\":\"#ff8250\",\"ambient_intensity\":0.2609,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:11:34'),
(591, 'raidlands-main', 'raidlands-main', '2026-07-13 04:11:48', 9.271, 0.386280, 0.863433, 0.378123, 0.333926, 0.7306, '#ff8451', 0.2686, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:11:48.8722570Z\",\"rust_time\":9.271,\"day_fraction\":0.38628,\"sun_direction\":{\"x\":0.863433,\"y\":0.378123,\"z\":0.333926},\"sun_intensity\":0.7306,\"sun_color\":\"#ff8451\",\"ambient_intensity\":0.2686,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:11:49'),
(592, 'raidlands-main', 'raidlands-main', '2026-07-13 04:12:03', 9.374, 0.390597, 0.851435, 0.401026, 0.337988, 0.7718, '#ff8753', 0.2763, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:12:03.8712770Z\",\"rust_time\":9.374,\"day_fraction\":0.390597,\"sun_direction\":{\"x\":0.851435,\"y\":0.401026,\"z\":0.337988},\"sun_intensity\":0.7718,\"sun_color\":\"#ff8753\",\"ambient_intensity\":0.2763,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:12:04'),
(593, 'raidlands-main', 'raidlands-main', '2026-07-13 04:12:23', 9.510, 0.396261, 0.834749, 0.430569, 0.343227, 0.8250, '#ff8a55', 0.2864, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:12:23.7193760Z\",\"rust_time\":9.51,\"day_fraction\":0.396261,\"sun_direction\":{\"x\":0.834749,\"y\":0.430569,\"z\":0.343227},\"sun_intensity\":0.825,\"sun_color\":\"#ff8a55\",\"ambient_intensity\":0.2864,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:12:25'),
(594, 'raidlands-main', 'raidlands-main', '2026-07-13 04:12:28', 9.511, 0.396300, 0.834632, 0.430767, 0.343262, 0.8254, '#ff8a55', 0.2865, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:12:28.7556150Z\",\"rust_time\":9.511,\"day_fraction\":0.3963,\"sun_direction\":{\"x\":0.834632,\"y\":0.430767,\"z\":0.343262},\"sun_intensity\":0.8254,\"sun_color\":\"#ff8a55\",\"ambient_intensity\":0.2865,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:12:29'),
(595, 'raidlands-main', 'raidlands-main', '2026-07-13 04:12:43', 9.615, 0.400608, 0.821227, 0.452834, 0.347171, 0.8651, '#ff8c56', 0.2940, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:12:43.7358560Z\",\"rust_time\":9.615,\"day_fraction\":0.400608,\"sun_direction\":{\"x\":0.821227,\"y\":0.452834,\"z\":0.347171},\"sun_intensity\":0.8651,\"sun_color\":\"#ff8c56\",\"ambient_intensity\":0.294,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:12:44'),
(596, 'raidlands-main', 'raidlands-main', '2026-07-13 04:12:58', 9.719, 0.404945, 0.807123, 0.474679, 0.351046, 0.9044, '#ff8f58', 0.3014, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:12:58.7050920Z\",\"rust_time\":9.719,\"day_fraction\":0.404945,\"sun_direction\":{\"x\":0.807123,\"y\":0.474679,\"z\":0.351046},\"sun_intensity\":0.9044,\"sun_color\":\"#ff8f58\",\"ambient_intensity\":0.3014,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:12:58'),
(597, 'raidlands-main', 'raidlands-main', '2026-07-13 04:13:13', 9.821, 0.409205, 0.792686, 0.495758, 0.354786, 0.9424, '#ff9159', 0.3086, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:13:13.7028370Z\",\"rust_time\":9.821,\"day_fraction\":0.409205,\"sun_direction\":{\"x\":0.792686,\"y\":0.495758,\"z\":0.354786},\"sun_intensity\":0.9424,\"sun_color\":\"#ff9159\",\"ambient_intensity\":0.3086,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:13:13'),
(598, 'raidlands-main', 'raidlands-main', '2026-07-13 04:13:28', 9.924, 0.413513, 0.777509, 0.516681, 0.358498, 0.9800, '#ff935a', 0.3157, '#1e1d2e', NULL, NULL, 1.0000, '{\"server_id\":\"raidlands-main\",\"wipe_key\":\"raidlands-main\",\"sampled_at\":\"2026-07-13T04:13:28.7388960Z\",\"rust_time\":9.924,\"day_fraction\":0.413513,\"sun_direction\":{\"x\":0.777509,\"y\":0.516681,\"z\":0.358498},\"sun_intensity\":0.98,\"sun_color\":\"#ff935a\",\"ambient_intensity\":0.3157,\"ambient_color\":\"#1e1d2e\",\"cloud_coverage\":null,\"rain_intensity\":null,\"fog_intensity\":1}', '2026-07-13 04:13:29');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `server_environment_snapshots`
--
ALTER TABLE `server_environment_snapshots`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_server_environment_sample` (`server_id`,`sampled_at`),
  ADD KEY `idx_server_environment_wipe_time` (`server_id`,`wipe_key`,`sampled_at`),
  ADD KEY `idx_server_environment_sampled` (`sampled_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `server_environment_snapshots`
--
ALTER TABLE `server_environment_snapshots`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=599;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
