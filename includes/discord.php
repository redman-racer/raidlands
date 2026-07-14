<?php

require_once __DIR__ . '/store.php';

function raidlands_discord_tables_ready(): bool
{
    if (!raidlands_db_is_configured()) return false;
    try { raidlands_db_required()->query('SELECT 1 FROM discord_identities LIMIT 1'); return true; }
    catch (Throwable $error) { return false; }
}

function raidlands_discord_snowflake($value): string
{
    $value = preg_replace('/\D+/', '', (string) $value) ?? '';
    return preg_match('/^\d{17,20}$/', $value) ? $value : '';
}

function raidlands_discord_settings(bool $refresh = false): array
{
    static $cache = null;
    if ($refresh) $cache = null;
    if ($cache !== null) return $cache;
    $defaults = ['enabled'=>'0','guild_id'=>'','verified_role_id'=>'','connection_label'=>'Connect Discord','connection_guidance'=>'Connect Discord to verify your Raidlands player account and receive managed community roles.','auto_join_guild'=>'1','assign_verified_role'=>'1','remove_roles_on_unlink'=>'1','sync_interval_minutes'=>'15','retry_limit'=>'5','failure_notification_threshold'=>'3'];
    if (raidlands_discord_tables_ready()) {
        foreach (raidlands_db_fetch_all('SELECT setting_key, setting_value FROM discord_integration_settings') as $row) $defaults[(string)$row['setting_key']] = (string)$row['setting_value'];
    }
    $cache = $defaults;
    return $cache;
}

function raidlands_discord_config(): array
{
    global $discord_config;
    return is_array($discord_config ?? null) ? $discord_config : [];
}

function raidlands_discord_callback_url(): string
{
    $configured = trim((string)(raidlands_discord_config()['redirectUri'] ?? ''));
    return $configured !== '' ? $configured : raidlands_store_absolute_route_url('discord') . '?discord_callback=1';
}

function raidlands_discord_readiness(): array
{
    $config = raidlands_discord_config(); $settings = raidlands_discord_settings();
    $checks = ['tables'=>raidlands_discord_tables_ready(),'client_id'=>raidlands_discord_snowflake($config['clientId'] ?? '') !== '','client_secret'=>trim((string)($config['clientSecret'] ?? '')) !== '','bot_token'=>trim((string)($config['botToken'] ?? '')) !== '','guild_id'=>raidlands_discord_snowflake($settings['guild_id'] ?? '') !== '','verified_role_id'=>raidlands_discord_snowflake($settings['verified_role_id'] ?? '') !== ''];
    return ['ready'=>!in_array(false,$checks,true) && $settings['enabled']==='1','checks'=>$checks,'callback_url'=>raidlands_discord_callback_url(),'enabled'=>$settings['enabled']==='1'];
}

function raidlands_discord_http(string $method, string $path, ?array $json = null, string $authorization = '', ?array $form = null): array
{
    $config = raidlands_discord_config(); $url = rtrim((string)($config['apiBaseUrl'] ?? 'https://discord.com/api/v10'),'/') . '/' . ltrim($path,'/');
    $headers = ['Accept: application/json','User-Agent: RaidlandsDiscord/1.0'];
    $body = null;
    if ($json !== null) { $body=json_encode($json,JSON_UNESCAPED_SLASHES); $headers[]='Content-Type: application/json'; }
    elseif ($form !== null) { $body=http_build_query($form,'','&',PHP_QUERY_RFC3986); $headers[]='Content-Type: application/x-www-form-urlencoded'; }
    if ($authorization !== '') $headers[]='Authorization: '.$authorization;
    $curl=curl_init($url); if ($curl===false) throw new RuntimeException('Discord request could not start.');
    curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>max(2,(int)($config['timeoutSeconds']??8)),CURLOPT_HTTPHEADER=>$headers]);
    if ($body!==null) curl_setopt($curl,CURLOPT_POSTFIELDS,$body);
    $raw=curl_exec($curl); $status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE); $error=curl_error($curl); curl_close($curl);
    if ($raw===false) throw new RuntimeException('Discord is unavailable: '.$error);
    $data=$raw!==''?json_decode($raw,true):[]; if (!is_array($data)) $data=[];
    if ($status<200||$status>=300) { $message=(string)($data['message']??'Discord request failed'); throw new RuntimeException($message.' (HTTP '.$status.').'); }
    return $data;
}

function raidlands_discord_oauth_url(string $return_path = 'discord'): string
{
    raidlands_store_boot(); $player=raidlands_store_current_player(); if ($player===null) throw new RuntimeException('Sign in with Steam before connecting Discord.');
    $ready=raidlands_discord_readiness(); if (!$ready['ready']) throw new RuntimeException('Discord account linking is not available yet.');
    $state=bin2hex(random_bytes(24)); $_SESSION['raidlands_discord_oauth']=['state'=>$state,'player_id'=>(int)$player['id'],'return_path'=>trim($return_path,'/'),'created_at'=>time()];
    $params=['client_id'=>(string)(raidlands_discord_config()['clientId']??''),'redirect_uri'=>raidlands_discord_callback_url(),'response_type'=>'code','scope'=>'identify guilds.join','state'=>$state,'prompt'=>'consent'];
    return 'https://discord.com/oauth2/authorize?'.http_build_query($params,'','&',PHP_QUERY_RFC3986);
}

function raidlands_discord_event(?int $player_id, string $discord_id, string $type, string $status='info', array $details=[], string $actor='system'): void
{
    if (!raidlands_discord_tables_ready()) return;
    raidlands_db_execute('INSERT INTO discord_connection_events (player_id,discord_user_id,event_type,status,actor,details_json) VALUES (:p,:d,:e,:s,:a,:j)',['p'=>$player_id,'d'=>$discord_id,'e'=>$type,'s'=>$status,'a'=>$actor,'j'=>$details===[]?null:json_encode($details,JSON_UNESCAPED_SLASHES)]);
}

function raidlands_discord_handle_callback(): array
{
    raidlands_store_boot(); $session=$_SESSION['raidlands_discord_oauth']??null; unset($_SESSION['raidlands_discord_oauth']);
    $player=raidlands_store_current_player();
    if (!is_array($session)||$player===null||time()-(int)($session['created_at']??0)>900||!hash_equals((string)($session['state']??''),(string)($_GET['state']??''))||(int)$player['id']!==(int)($session['player_id']??0)) throw new RuntimeException('Discord connection state expired. Start again from your account.');
    if (isset($_GET['error'])) throw new RuntimeException('Discord authorization was cancelled.');
    $config=raidlands_discord_config();
    $token=raidlands_discord_http('POST','oauth2/token',null,'',['client_id'=>$config['clientId']??'','client_secret'=>$config['clientSecret']??'','grant_type'=>'authorization_code','code'=>(string)($_GET['code']??''),'redirect_uri'=>raidlands_discord_callback_url()]);
    $access=(string)($token['access_token']??''); if ($access==='') throw new RuntimeException('Discord did not return an access token.');
    $user=raidlands_discord_http('GET','users/@me',null,'Bearer '.$access); $discord_id=raidlands_discord_snowflake($user['id']??''); if ($discord_id==='') throw new RuntimeException('Discord did not return a valid account.');
    $conflict=raidlands_db_fetch_one('SELECT player_id FROM discord_identities WHERE discord_user_id=:d AND player_id<>:p AND status<>"unlinked"',['d'=>$discord_id,'p'=>(int)$player['id']]);
    if ($conflict!==null) throw new RuntimeException('That Discord account is already connected to another Steam account. Unlink it there or contact support.');
    $player_conflict=raidlands_discord_identity_for_player((int)$player['id']);
    if ($player_conflict!==null && (string)$player_conflict['discord_user_id']!==$discord_id) throw new RuntimeException('This Steam account is already connected to another Discord account. Disconnect it before linking a different one.');
    raidlands_db_execute('INSERT INTO discord_identities (player_id,discord_user_id,username,global_name,avatar_hash,status,verified_at,unlinked_at) VALUES (:p,:d,:u,:g,:a,"sync_pending",NOW(),NULL) ON DUPLICATE KEY UPDATE discord_user_id=VALUES(discord_user_id),username=VALUES(username),global_name=VALUES(global_name),avatar_hash=VALUES(avatar_hash),status="sync_pending",verified_at=NOW(),unlinked_at=NULL,last_error=""',['p'=>(int)$player['id'],'d'=>$discord_id,'u'=>mb_substr((string)($user['username']??''),0,120),'g'=>mb_substr((string)($user['global_name']??''),0,120),'a'=>mb_substr((string)($user['avatar']??''),0,255)]);
    $settings=raidlands_discord_settings();
    if ($settings['auto_join_guild']==='1') raidlands_discord_http('PUT','guilds/'.$settings['guild_id'].'/members/'.$discord_id,['access_token'=>$access],'Bot '.($config['botToken']??''));
    raidlands_discord_event((int)$player['id'],$discord_id,'connected','success');
    try {
        raidlands_discord_reconcile_player((int)$player['id'],'oauth');
    } catch (Throwable $error) {
        raidlands_db_execute('UPDATE discord_identities SET status="error",last_error=:e WHERE player_id=:p',['e'=>mb_substr($error->getMessage(),0,1000),'p'=>(int)$player['id']]);
        raidlands_discord_event((int)$player['id'],$discord_id,'role_sync','error',['message'=>$error->getMessage()]);
        raidlands_discord_queue_player((int)$player['id'],'oauth_retry');
        throw $error;
    }
    return ['return_path'=>(string)($session['return_path']??'discord')];
}

function raidlands_discord_identity_for_player(int $player_id): ?array
{
    if ($player_id<=0||!raidlands_discord_tables_ready()) return null;
    return raidlands_db_fetch_one('SELECT di.*,p.steam_id64,p.display_name FROM discord_identities di INNER JOIN players p ON p.id=di.player_id WHERE di.player_id=:p AND di.status<>"unlinked"',['p'=>$player_id]);
}

function raidlands_discord_role_mappings(bool $enabled_only=true): array
{
    if (!raidlands_discord_tables_ready()) return [];
    return raidlands_db_fetch_all('SELECT * FROM discord_role_mappings'.($enabled_only?' WHERE is_enabled=1':'').' ORDER BY sort_order,id');
}

function raidlands_discord_expected_roles(int $player_id): array
{
    $identity=raidlands_discord_identity_for_player($player_id); if ($identity===null) return [];
    $settings=raidlands_discord_settings(); $roles=[];
    if ($settings['assign_verified_role']==='1'&&raidlands_discord_snowflake($settings['verified_role_id'])!=='') $roles[]=$settings['verified_role_id'];
    $state=raidlands_store_active_groups_for_steam((string)$identity['steam_id64']); $groups=array_fill_keys(array_map('strval',(array)($state['groups']??[])),true);
    foreach (raidlands_discord_role_mappings() as $mapping) if (isset($groups[(string)$mapping['oxide_group']])) $roles[]=(string)$mapping['discord_role_id'];
    return array_values(array_unique(array_filter($roles,'raidlands_discord_snowflake')));
}

function raidlands_discord_managed_roles(): array
{
    $settings=raidlands_discord_settings(); $roles=[]; if (raidlands_discord_snowflake($settings['verified_role_id'])!=='') $roles[]=$settings['verified_role_id'];
    foreach (raidlands_discord_role_mappings(false) as $mapping) if (!empty($mapping['remove_when_inactive'])) $roles[]=(string)$mapping['discord_role_id'];
    return array_values(array_unique(array_filter($roles,'raidlands_discord_snowflake')));
}

function raidlands_discord_reconcile_player(int $player_id, string $source='system', bool $dry_run=false): array
{
    $identity=raidlands_discord_identity_for_player($player_id); if ($identity===null) throw new RuntimeException('No active Discord identity was found.');
    $settings=raidlands_discord_settings(); $config=raidlands_discord_config(); $discord_id=(string)$identity['discord_user_id'];
    $member=raidlands_discord_http('GET','guilds/'.$settings['guild_id'].'/members/'.$discord_id,null,'Bot '.($config['botToken']??''));
    $observed=array_values(array_map('strval',(array)($member['roles']??[]))); $expected=raidlands_discord_expected_roles($player_id); $managed=raidlands_discord_managed_roles();
    $add=array_values(array_diff($expected,$observed)); $remove=array_values(array_diff(array_intersect($observed,$managed),$expected));
    if (!$dry_run) {
        foreach ($add as $role) raidlands_discord_http('PUT','guilds/'.$settings['guild_id'].'/members/'.$discord_id.'/roles/'.$role,[], 'Bot '.($config['botToken']??''));
        foreach ($remove as $role) raidlands_discord_http('DELETE','guilds/'.$settings['guild_id'].'/members/'.$discord_id.'/roles/'.$role,null,'Bot '.($config['botToken']??''));
        $final=array_values(array_unique(array_merge(array_diff($observed,$remove),$add)));
        raidlands_db_execute('UPDATE discord_identities SET guild_member=1,observed_role_ids_json=:r,status="synced",last_error="",last_synced_at=NOW() WHERE player_id=:p',['r'=>json_encode($final),'p'=>$player_id]);
        raidlands_discord_event($player_id,$discord_id,'role_sync','success',['source'=>$source,'added'=>$add,'removed'=>$remove]);
    }
    return ['player_id'=>$player_id,'discord_user_id'=>$discord_id,'expected'=>$expected,'observed'=>$observed,'add'=>$add,'remove'=>$remove,'dry_run'=>$dry_run];
}

function raidlands_discord_queue_player(int $player_id,string $source='system'): void
{
    if ($player_id<=0||raidlands_discord_identity_for_player($player_id)===null) return;
    $existing=raidlands_db_fetch_one('SELECT id FROM discord_sync_jobs WHERE player_id=:p AND status IN ("pending","processing") LIMIT 1',['p'=>$player_id]);
    if ($existing===null) raidlands_db_execute('INSERT INTO discord_sync_jobs (player_id,source) VALUES (:p,:s)',['p'=>$player_id,'s'=>$source]);
}

function raidlands_discord_process_queue(int $limit=25): array
{
    $limit=max(1,min(100,$limit)); $settings=raidlands_discord_settings(); $jobs=raidlands_db_fetch_all('SELECT * FROM discord_sync_jobs WHERE status="pending" AND available_at<=NOW() ORDER BY id LIMIT '.$limit); $result=['complete'=>0,'failed'=>0];
    foreach($jobs as $job){ $id=(int)$job['id']; raidlands_db_execute('UPDATE discord_sync_jobs SET status="processing",attempts=attempts+1 WHERE id=:id',['id'=>$id]); try{raidlands_discord_reconcile_player((int)$job['player_id'],(string)$job['source']);raidlands_db_execute('UPDATE discord_sync_jobs SET status="complete",last_error="" WHERE id=:id',['id'=>$id]);$result['complete']++;}catch(Throwable $error){$attempts=(int)$job['attempts']+1;$failed=$attempts>=max(1,(int)$settings['retry_limit']);$message=mb_substr($error->getMessage(),0,1000);raidlands_db_execute('UPDATE discord_sync_jobs SET status=:s,last_error=:e,available_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=:id',['s'=>$failed?'failed':'pending','e'=>$message,'id'=>$id]);raidlands_db_execute('UPDATE discord_identities SET status="error",last_error=:e WHERE player_id=:p',['e'=>$message,'p'=>(int)$job['player_id']]);$result['failed']++;} }
    return $result;
}

function raidlands_discord_unlink(int $player_id,string $actor='player'): void
{
    $identity=raidlands_discord_identity_for_player($player_id); if($identity===null) return; $settings=raidlands_discord_settings(); $config=raidlands_discord_config();
    $failures=[];
    if($settings['remove_roles_on_unlink']==='1'){ foreach(raidlands_discord_managed_roles() as $role){ try{raidlands_discord_http('DELETE','guilds/'.$settings['guild_id'].'/members/'.$identity['discord_user_id'].'/roles/'.$role,null,'Bot '.($config['botToken']??''));}catch(Throwable $error){if(!str_contains($error->getMessage(),'HTTP 404'))$failures[]=$error->getMessage();} } }
    if($failures!==[]){$message='Discord roles could not be removed. Try again or ask staff to review bot permissions.';raidlands_db_execute('UPDATE discord_identities SET status="error",last_error=:e WHERE player_id=:p',['e'=>$message,'p'=>$player_id]);throw new RuntimeException($message);}
    raidlands_discord_event($player_id,(string)$identity['discord_user_id'],'unlinked','success',[],$actor); raidlands_db_execute('DELETE FROM discord_identities WHERE player_id=:p',['p'=>$player_id]);
}

function raidlands_discord_avatar_url(array $identity, int $size=128): string
{
    $id=raidlands_discord_snowflake($identity['discord_user_id']??'');$hash=trim((string)($identity['avatar_hash']??''));if($id===''||$hash==='')return '';
    return 'https://cdn.discordapp.com/avatars/'.$id.'/'.rawurlencode($hash).'.png?size='.max(32,min(512,$size));
}

function raidlands_discord_live_diagnostics(): array
{
    $readiness=raidlands_discord_readiness(); if (!$readiness['ready']) return ['ok'=>false,'message'=>'Complete all configuration checks before running live diagnostics.'];
    $settings=raidlands_discord_settings(); $config=raidlands_discord_config();
    try {
        $bot=raidlands_discord_http('GET','users/@me',null,'Bot '.$config['botToken']);
        $guild=raidlands_discord_http('GET','guilds/'.$settings['guild_id'],null,'Bot '.$config['botToken']);
        $roles=raidlands_discord_http('GET','guilds/'.$settings['guild_id'].'/roles',null,'Bot '.$config['botToken']);
        $member=raidlands_discord_http('GET','guilds/'.$settings['guild_id'].'/members/'.$bot['id'],null,'Bot '.$config['botToken']);
        $positions=[]; foreach($roles as $role) $positions[(string)($role['id']??'')]=(int)($role['position']??0);
        $bot_position=0; foreach((array)($member['roles']??[]) as $role_id) $bot_position=max($bot_position,$positions[(string)$role_id]??0);
        $blocked=[]; foreach(raidlands_discord_managed_roles() as $role_id) if(!isset($positions[$role_id])||$positions[$role_id]>=$bot_position)$blocked[]=$role_id;
        return ['ok'=>$blocked===[],'bot_name'=>(string)($bot['username']??''),'guild_name'=>(string)($guild['name']??''),'bot_position'=>$bot_position,'blocked_roles'=>$blocked,'message'=>$blocked===[]?'Bot can manage all configured roles.':'Bot role hierarchy cannot manage one or more configured roles.'];
    } catch(Throwable $error) { return ['ok'=>false,'message'=>$error->getMessage()]; }
}

function raidlands_discord_admin_state(): array
{
    if(!raidlands_discord_tables_ready()) return ['ready'=>false,'message'=>'Run migration 061_discord_identity_integration.sql.'];
    $summary=raidlands_db_fetch_one('SELECT COUNT(*) total,SUM(status="synced") synced,SUM(status="error") errors FROM discord_identities WHERE status<>"unlinked"')??[];
    $jobs=raidlands_db_fetch_one('SELECT SUM(status="pending") pending,SUM(status="failed") failed FROM discord_sync_jobs')??[];
    $readiness=raidlands_discord_readiness();
    return ['ready'=>true,'settings'=>raidlands_discord_settings(),'readiness'=>$readiness,'diagnostics'=>$readiness['ready']?raidlands_discord_live_diagnostics():['ok'=>false,'message'=>'Complete configuration first.'],'mappings'=>raidlands_discord_role_mappings(false),'identities'=>raidlands_db_fetch_all('SELECT di.*,p.steam_id64,p.display_name FROM discord_identities di INNER JOIN players p ON p.id=di.player_id ORDER BY di.updated_at DESC LIMIT 200'),'events'=>raidlands_db_fetch_all('SELECT * FROM discord_connection_events ORDER BY id DESC LIMIT 50'),'summary'=>$summary,'jobs'=>$jobs];
}

function raidlands_discord_admin_save(array $post,string $actor): void
{
    $allowed=['enabled','guild_id','verified_role_id','connection_label','connection_guidance','auto_join_guild','assign_verified_role','remove_roles_on_unlink','sync_interval_minutes','retry_limit','failure_notification_threshold']; $input=(array)($post['discord_settings']??[]);
    foreach(['enabled','auto_join_guild','assign_verified_role','remove_roles_on_unlink'] as $key) $input[$key]=isset($input[$key])?'1':'0';
    foreach(['guild_id','verified_role_id'] as $key) if(($input[$key]??'')!==''&&raidlands_discord_snowflake($input[$key])==='') throw new InvalidArgumentException('Discord IDs must contain 17 to 20 digits.');
    $input['sync_interval_minutes']=(string)max(5,min(1440,(int)($input['sync_interval_minutes']??15)));$input['retry_limit']=(string)max(1,min(20,(int)($input['retry_limit']??5)));$input['failure_notification_threshold']=(string)max(1,min(100,(int)($input['failure_notification_threshold']??3)));
    $seen_groups=[];$seen_roles=[];$mappings=[];
    foreach((array)($post['discord_mappings']??[]) as $row){$group=raidlands_store_clean_group($row['oxide_group']??'');$role=raidlands_discord_snowflake($row['discord_role_id']??'');if($group===''&&$role==='')continue;if($group===''||$role==='')throw new InvalidArgumentException('Every Discord role mapping needs an access group and role ID.');if($role===($input['guild_id']??'')||$role===($input['verified_role_id']??''))throw new InvalidArgumentException('Mapped roles cannot be the guild default role or the base verified role.');if(isset($seen_groups[$group])||isset($seen_roles[$role]))throw new InvalidArgumentException('Discord mappings cannot repeat a group or role ID.');$seen_groups[$group]=1;$seen_roles[$role]=1;$mappings[]=['g'=>$group,'r'=>$role,'l'=>mb_substr(trim((string)($row['label']??'')),0,160),'e'=>isset($row['is_enabled'])?1:0,'x'=>isset($row['remove_when_inactive'])?1:0,'s'=>max(0,min(9999,(int)($row['sort_order']??100)))];}
    $pdo=raidlands_db_required();$owns_transaction=!$pdo->inTransaction();if($owns_transaction)$pdo->beginTransaction();
    try {
        foreach($allowed as $key){$value=trim((string)($input[$key]??''));raidlands_db_execute('INSERT INTO discord_integration_settings (setting_key,setting_value,updated_by_steam_id64) VALUES (:k,:v,:a) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_steam_id64=VALUES(updated_by_steam_id64),updated_at=NOW()',['k'=>$key,'v'=>mb_substr($value,0,$key==='connection_guidance'?1000:255),'a'=>$actor]);}
        raidlands_db_execute('DELETE FROM discord_role_mappings');
        foreach($mappings as $mapping) raidlands_db_execute('INSERT INTO discord_role_mappings (oxide_group,discord_role_id,label,is_enabled,remove_when_inactive,sort_order) VALUES (:g,:r,:l,:e,:x,:s)',$mapping);
        if($owns_transaction)$pdo->commit();
    } catch(Throwable $error) { if($owns_transaction&&$pdo->inTransaction())$pdo->rollBack(); throw $error; }
    raidlands_discord_settings(true); raidlands_discord_event(null,'','settings_updated','success',['mapping_count'=>count($seen_groups)],$actor); foreach(raidlands_db_fetch_all('SELECT player_id FROM discord_identities WHERE status<>"unlinked"') as $row) raidlands_discord_queue_player((int)$row['player_id'],'settings_changed');
}
