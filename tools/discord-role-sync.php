<?php
require dirname(__DIR__) . '/includes/config.php';
require dirname(__DIR__) . '/includes/database.php';
require dirname(__DIR__) . '/includes/discord.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
try { $limit=isset($argv[1])?(int)$argv[1]:50; foreach(raidlands_db_fetch_all('SELECT player_id FROM discord_identities WHERE status <> "unlinked" ORDER BY player_id LIMIT '.max(1,min(100,$limit))) as $row) raidlands_discord_queue_player((int)$row['player_id'],'scheduled'); $result=raidlands_discord_process_queue($limit); echo json_encode($result,JSON_PRETTY_PRINT).PHP_EOL; exit($result['failed']>0?1:0); }
catch(Throwable $error){fwrite(STDERR,$error->getMessage().PHP_EOL);exit(1);}
