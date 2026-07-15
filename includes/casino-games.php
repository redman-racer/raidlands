<?php

/** Backed casino games layered on the shared RP-point queue. */

function raidlands_casino_backend_ready(string $game): bool
{
    if (!in_array($game, ['roulette', 'slots', 'blackjack'], true)) {
        return false;
    }
    if (!raidlands_store_table_has_columns('rp_game_settings', [$game . '_enabled', 'casino_rtp_preset'])) {
        return false;
    }
    if ($game === 'blackjack') {
        return raidlands_rewards_table_exists('rp_blackjack_hands')
            && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', 'blackjack_wager')
            && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', 'blackjack_double')
            && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', 'blackjack_payout');
    }
    return raidlands_rewards_enum_allows('rp_game_rounds', 'game_type', $game)
        && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', $game);
}

function raidlands_casino_require_player(string $game): array
{
    if (!raidlands_casino_backend_ready($game)) {
        throw new RuntimeException(ucfirst($game) . ' is staged until migration 063 is installed.');
    }
    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, $game);
    $player = raidlands_rewards_require_player();
    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }
    return [$player, $settings];
}

function raidlands_casino_roulette_red_numbers(): array
{
    return [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
}

function raidlands_casino_roulette_normalize_bet(array $bet): array
{
    $type = strtolower(trim((string) ($bet['type'] ?? '')));
    $stake = (int) ($bet['stake_rp'] ?? $bet['stake'] ?? 0);
    $numbers = array_values(array_unique(array_map('intval', (array) ($bet['numbers'] ?? []))));
    sort($numbers);
    if ($stake <= 0) throw new InvalidArgumentException('Every roulette bet needs a positive RP stake.');
    if (array_filter($numbers, static fn(int $n): bool => $n < 0 || $n > 36)) throw new InvalidArgumentException('Roulette numbers must be between 0 and 36.');

    $insideSizes = ['straight'=>1,'split'=>2,'street'=>3,'corner'=>4,'first_four'=>4,'six_line'=>6];
    if (isset($insideSizes[$type])) {
        if (count($numbers) !== $insideSizes[$type]) throw new InvalidArgumentException('Invalid ' . str_replace('_', '-', $type) . ' selection.');
        $valid = false;
        if ($type === 'straight') $valid = true;
        elseif ($type === 'split') {
            [$a,$b] = $numbers;
            $valid = ($a === 0 && in_array($b,[1,2,3],true)) || ($a > 0 && (($b-$a===3) || ($b-$a===1 && intdiv($a-1,3)===intdiv($b-1,3))));
        } elseif ($type === 'street') {
            $valid = in_array($numbers, [[0,1,2],[0,2,3]], true) || ($numbers[0] > 0 && $numbers === [$numbers[0],$numbers[0]+1,$numbers[0]+2] && (($numbers[0]-1)%3===0));
        } elseif ($type === 'corner') {
            [$a,$b,$c,$d] = $numbers; $valid = $a>0 && $b===$a+1 && $c===$a+3 && $d===$a+4 && intdiv($a-1,3)===intdiv($b-1,3);
        } elseif ($type === 'first_four') {
            $valid = $numbers === [0,1,2,3];
        } else {
            $a=$numbers[0]; $valid=$a>0 && (($a-1)%3===0) && $numbers===[$a,$a+1,$a+2,$a+3,$a+4,$a+5];
        }
        if (!$valid) throw new InvalidArgumentException('That roulette ' . str_replace('_', '-', $type) . ' is not on the European board.');
        return ['type'=>$type,'numbers'=>$numbers,'stake_rp'=>$stake,'gross_multiplier'=>['straight'=>36,'split'=>18,'street'=>12,'corner'=>9,'first_four'=>9,'six_line'=>6][$type]];
    }

    $key = strtolower(trim((string) ($bet['key'] ?? '')));
    $outside = ['red','black','odd','even','low','high','dozen_1','dozen_2','dozen_3','column_1','column_2','column_3'];
    if ($type !== 'outside' || !in_array($key,$outside,true)) throw new InvalidArgumentException('Choose a valid roulette board position.');
    return ['type'=>'outside','key'=>$key,'numbers'=>[],'stake_rp'=>$stake,'gross_multiplier'=>str_starts_with($key,'dozen_')||str_starts_with($key,'column_')?3:2];
}

function raidlands_casino_roulette_bet_wins(array $bet, int $roll): bool
{
    if ($bet['type'] !== 'outside') return in_array($roll,$bet['numbers'],true);
    if ($roll === 0) return false;
    $key=$bet['key'];
    if ($key==='red'||$key==='black') return in_array($roll,raidlands_casino_roulette_red_numbers(),true) === ($key==='red');
    if ($key==='odd'||$key==='even') return ($roll%2===1) === ($key==='odd');
    if ($key==='low'||$key==='high') return $key==='low' ? $roll<=18 : $roll>=19;
    if (str_starts_with($key,'dozen_')) { $d=(int)substr($key,-1); return $roll>=($d-1)*12+1 && $roll<=$d*12; }
    $column=(int)substr($key,-1); return (($roll-1)%3)+1===$column;
}

function raidlands_casino_play_roulette(array $rawBets): array
{
    [$player,$settings]=raidlands_casino_require_player('roulette');
    if ($rawBets===[] || count($rawBets)>64) throw new InvalidArgumentException('Place between 1 and 64 roulette bets.');
    $bets=array_map('raidlands_casino_roulette_normalize_bet',$rawBets);
    $stake=array_sum(array_column($bets,'stake_rp'));
    if ($stake!==raidlands_rewards_normalize_stake($stake,$settings)) throw new InvalidArgumentException('Your total roulette stake is outside the allowed range.');
    $roll=random_int(0,36); $payout=0;
    foreach ($bets as &$bet) { $bet['won']=raidlands_casino_roulette_bet_wins($bet,$roll); $bet['payout_rp']=$bet['won']?$bet['stake_rp']*$bet['gross_multiplier']:0; $payout+=$bet['payout_rp']; }
    unset($bet); $loss=max(0,$stake-$payout);
    raidlands_rewards_check_daily_limits($player,$settings,$stake,$loss);
    return raidlands_casino_insert_instant_round('roulette',$player,$stake,$payout,(string)$roll,json_encode($bets),['roll'=>$roll,'bets'=>$bets],$loss);
}

function raidlands_casino_slot_config(string $preset): array
{
    // Keep the default comfortably house-positive even during volatile max-bet sessions.
    // These scales produce audited theoretical RTPs of roughly 80.75%, 85.39%, and 90.06%.
    $scale=['safe'=>7.2,'balanced'=>7.6,'generous'=>8.0][$preset]??7.6;
    $pay=static fn(array $values): array=>array_map(static fn(int $value): int=>(int)round($value*$scale),$values);
    return [
        'symbols'=>[
            'scrap'=>['label'=>'Scrap','weight'=>28,'pays'=>$pay([3=>2,4=>5,5=>12])],
            'sulfur'=>['label'=>'Sulfur','weight'=>20,'pays'=>$pay([3=>3,4=>8,5=>20])],
            'crate'=>['label'=>'Crate','weight'=>14,'pays'=>$pay([3=>5,4=>14,5=>35])],
            'hazmat'=>['label'=>'Hazmat','weight'=>9,'pays'=>$pay([3=>8,4=>24,5=>60])],
            'c4'=>['label'=>'C4','weight'=>5,'pays'=>$pay([3=>15,4=>50,5=>120])],
            'blank'=>['label'=>'Ash','weight'=>30,'pays'=>[]],
        ],
        'lines'=>[[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0]],
    ];
}

function raidlands_casino_weighted_symbol(array $symbols): string
{
    $total=array_sum(array_column($symbols,'weight')); $roll=random_int(1,$total);
    foreach ($symbols as $key=>$symbol) { $roll-=(int)$symbol['weight']; if ($roll<=0) return $key; }
    return 'blank';
}

function raidlands_casino_evaluate_slots(array $grid, int $stake, string $preset='balanced'): array
{
    $config=raidlands_casino_slot_config($preset); $lineStake=intdiv($stake,10); $wins=[]; $payout=0;
    foreach ($config['lines'] as $index=>$rows) {
        $symbol=$grid[0][$rows[0]]??'blank'; $count=1;
        for($reel=1;$reel<5;$reel++){ if(($grid[$reel][$rows[$reel]]??'')!==$symbol) break; $count++; }
        $multiple=(int)($config['symbols'][$symbol]['pays'][$count]??0);
        if($multiple>0){$amount=$lineStake*$multiple;$payout+=$amount;$wins[]=['line'=>$index+1,'symbol'=>$symbol,'count'=>$count,'payout_rp'=>$amount];}
    }
    return ['payout_rp'=>$payout,'winning_lines'=>$wins];
}

function raidlands_casino_play_slots(int $stake): array
{
    [$player,$settings]=raidlands_casino_require_player('slots'); $stake=raidlands_rewards_normalize_stake($stake,$settings);
    if($stake%10!==0) throw new InvalidArgumentException('Slots stake must be divisible by 10 RP.');
    $preset=in_array($settings['casino_rtp_preset']??'balanced',['safe','balanced','generous'],true)?$settings['casino_rtp_preset']:'balanced';
    $symbols=raidlands_casino_slot_config($preset)['symbols']; $grid=[];
    for($reel=0;$reel<5;$reel++) for($row=0;$row<3;$row++) $grid[$reel][$row]=raidlands_casino_weighted_symbol($symbols);
    $result=raidlands_casino_evaluate_slots($grid,$stake,$preset); $payout=$result['payout_rp']; $loss=max(0,$stake-$payout);
    raidlands_rewards_check_daily_limits($player,$settings,$stake,$loss);
    return raidlands_casino_insert_instant_round('slots',$player,$stake,$payout,implode('|',array_map(static fn($r)=>implode(',',$r),$grid)),'10 lines',['grid'=>$grid,'winning_lines'=>$result['winning_lines'],'preset'=>$preset],$loss);
}

function raidlands_casino_insert_instant_round(string $game,array $player,int $stake,int $payout,string $roll,string $choice,array $metadata,int $loss): array
{
    $pdo=raidlands_db_required(); $pdo->beginTransaction();
    try {
        $stmt=$pdo->prepare('INSERT INTO rp_game_rounds (game_type,player_id,steam_id64,stake_rp,payout_rp,net_rp,odds_basis_points,player_choice,roll_result,status,message) VALUES (:game,:player,:steam,:stake,:payout,:net,0,:choice,:roll,"queued",:message)');
        $stmt->execute(['game'=>$game,'player'=>$player['id'],'steam'=>$player['steam_id64'],'stake'=>$stake,'payout'=>$payout,'net'=>$payout-$stake,'choice'=>mb_substr($choice,0,40),'roll'=>mb_substr($roll,0,80),'message'=>ucfirst($game).' result saved. Waiting for server confirmation.']);
        $id=(int)$pdo->lastInsertId();
        $request=raidlands_rewards_queue_point_request($pdo,(int)$player['id'],(string)$player['steam_id64'],$game,(string)$id,$stake,$payout,'RP '.ucfirst($game),$metadata);
        $pdo->prepare('UPDATE rp_game_rounds SET rp_point_request_id=:request,request_token=:token WHERE id=:id')->execute(['request'=>$request['id'],'token'=>$request['request_token'],'id'=>$id]);
        raidlands_rewards_record_daily_wager($pdo,$player,$stake,$loss); $pdo->commit();
        return ['round_id'=>$id,'game'=>$game,'stake_rp'=>$stake,'payout_rp'=>$payout,'won'=>$payout>$stake]+$metadata;
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function raidlands_blackjack_new_deck(): array
{
    $deck=[]; foreach(['S','H','D','C'] as $suit) foreach(['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as $rank) for($d=0;$d<6;$d++) $deck[]=$rank.$suit;
    shuffle($deck); return $deck;
}

function raidlands_blackjack_hand_value(array $cards): array
{
    $total=0;$aces=0; foreach($cards as $card){$rank=substr((string)$card,0,-1);if($rank==='A'){$total+=11;$aces++;}elseif(in_array($rank,['J','Q','K'],true))$total+=10;else$total+=(int)$rank;}
    while($total>21&&$aces>0){$total-=10;$aces--;}
    return ['total'=>$total,'soft'=>$aces>0,'blackjack'=>count($cards)===2&&$total===21,'bust'=>$total>21];
}

function raidlands_blackjack_public_hand(array $row): array
{
    $player=json_decode((string)$row['player_cards_json'],true)?:[];$dealer=json_decode((string)$row['dealer_cards_json'],true)?:[];$status=(string)$row['status'];$playing=in_array($status,['playing','double_queued'],true);
    return ['id'=>(int)$row['id'],'status'=>$status,'stake_rp'=>(int)$row['total_stake_rp'],'payout_rp'=>(int)$row['payout_rp'],'player_cards'=>$player,'dealer_cards'=>$playing&&count($dealer)>1?[$dealer[0],null]:$dealer,'player_value'=>raidlands_blackjack_hand_value($player),'dealer_value'=>$playing?null:raidlands_blackjack_hand_value($dealer),'can_hit'=>$status==='playing','can_stand'=>$status==='playing','can_double'=>$status==='playing'&&count($player)===2,'action_version'=>(int)$row['action_version'],'message'=>(string)$row['message']];
}

function raidlands_blackjack_start(int $stake): array
{
    [$player,$settings]=raidlands_casino_require_player('blackjack');$stake=raidlands_rewards_normalize_stake($stake,$settings);
    if($stake%2!==0)throw new InvalidArgumentException('Blackjack stake must be divisible by 2 RP.');
    raidlands_rewards_check_daily_limits($player,$settings,$stake,$stake);$pdo=raidlands_db_required();$pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare('INSERT INTO rp_blackjack_hands (player_id,steam_id64,active_player_key,stake_rp,total_stake_rp,player_cards_json,dealer_cards_json,deck_json,message) VALUES (:player,:steam,:active,:stake,:total_stake,"[]","[]","[]","Waiting for the Rust server to confirm the wager.")');
        $stmt->execute(['player'=>$player['id'],'steam'=>$player['steam_id64'],'active'=>$player['id'],'stake'=>$stake,'total_stake'=>$stake]);$id=(int)$pdo->lastInsertId();
        $request=raidlands_rewards_queue_point_request($pdo,(int)$player['id'],(string)$player['steam_id64'],'blackjack_wager',(string)$id,$stake,0,'RP Blackjack wager',['hand_id'=>$id,'action'=>'wager']);
        $pdo->prepare('UPDATE rp_blackjack_hands SET wager_request_id=:request WHERE id=:id')->execute(['request'=>$request['id'],'id'=>$id]);raidlands_rewards_record_daily_wager($pdo,$player,$stake,$stake);$pdo->commit();
        return ['hand'=>raidlands_blackjack_public_hand(raidlands_db_fetch_one('SELECT * FROM rp_blackjack_hands WHERE id=:id',['id'=>$id]))];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function raidlands_blackjack_draw(array &$row,int $count=1): array
{
    $deck=json_decode((string)$row['deck_json'],true)?:[];$pos=(int)$row['deck_position'];$cards=[];
    for($i=0;$i<$count;$i++){if(!isset($deck[$pos]))throw new RuntimeException('Blackjack deck was exhausted.');$cards[]=$deck[$pos++];}
    $row['deck_position']=$pos;return $cards;
}

function raidlands_blackjack_deal_confirmed(PDO $pdo,array $row): void
{
    $deck=raidlands_blackjack_new_deck();$player=[$deck[0],$deck[2]];$dealer=[$deck[1],$deck[3]];
    $pdo->prepare('UPDATE rp_blackjack_hands SET status="playing",player_cards_json=:player,dealer_cards_json=:dealer,deck_json=:deck,deck_position=4,last_action_at=NOW(),action_version=action_version+1,message="Wager confirmed. Hit, stand, or double down." WHERE id=:id')->execute(['player'=>json_encode($player),'dealer'=>json_encode($dealer),'deck'=>json_encode($deck),'id'=>$row['id']]);
    $row=raidlands_db_fetch_one('SELECT * FROM rp_blackjack_hands WHERE id=:id',['id'=>$row['id']]);
    if(raidlands_blackjack_hand_value($player)['blackjack']||raidlands_blackjack_hand_value($dealer)['blackjack']) raidlands_blackjack_resolve($pdo,$row);
}

function raidlands_blackjack_resolve(PDO $pdo,array $row): void
{
    $player=json_decode((string)$row['player_cards_json'],true)?:[];$dealer=json_decode((string)$row['dealer_cards_json'],true)?:[];$pv=raidlands_blackjack_hand_value($player);
    while(!$pv['bust']){$dv=raidlands_blackjack_hand_value($dealer);if($dv['total']>17||($dv['total']===17&&$dv['soft'])||$dv['total']===17)break;$dealer=array_merge($dealer,raidlands_blackjack_draw($row));}
    $dv=raidlands_blackjack_hand_value($dealer);$stake=(int)$row['total_stake_rp'];$payout=0;$terminal='lost';
    if($pv['blackjack']&&!$dv['blackjack']){$payout=(int)($stake*2.5);$terminal='payout_queued';}
    elseif(!$pv['bust']&&($dv['bust']||$pv['total']>$dv['total'])){$payout=$stake*2;$terminal='payout_queued';}
    elseif(!$pv['bust']&&$pv['total']===$dv['total']){$payout=$stake;$terminal='payout_queued';}
    $message=$payout===0?'Dealer wins.':($payout===$stake?'Push. Stake return queued.':'Win. Payout queued.');$requestId=null;
    if($payout>0){$request=raidlands_rewards_queue_point_request($pdo,(int)$row['player_id'],(string)$row['steam_id64'],'blackjack_payout',(string)$row['id'],0,$payout,'RP Blackjack payout',['hand_id'=>(int)$row['id'],'player'=>$player,'dealer'=>$dealer]);$requestId=$request['id'];raidlands_rewards_rollback_daily_wager($pdo,(int)$row['player_id'],0,$stake);}
    $pdo->prepare('UPDATE rp_blackjack_hands SET status=:status,active_player_key=NULL,payout_rp=:payout,payout_request_id=:request,player_cards_json=:player,dealer_cards_json=:dealer,deck_position=:position,resolved_at=NOW(),last_action_at=NOW(),action_version=action_version+1,message=:message WHERE id=:id')->execute(['status'=>$terminal,'payout'=>$payout,'request'=>$requestId,'player'=>json_encode($player),'dealer'=>json_encode($dealer),'position'=>$row['deck_position'],'message'=>$message,'id'=>$row['id']]);
}

function raidlands_blackjack_active(int $playerId): ?array
{
    if(!raidlands_casino_backend_ready('blackjack')||$playerId<=0)return null;
    $row=raidlands_db_fetch_one('SELECT * FROM rp_blackjack_hands WHERE active_player_key=:player LIMIT 1',['player'=>$playerId]);return $row?raidlands_blackjack_public_hand($row):null;
}

function raidlands_blackjack_action(string $action,int $handId,int $version): array
{
    [$player,$settings]=raidlands_casino_require_player('blackjack');$pdo=raidlands_db_required();$pdo->beginTransaction();
    try{$stmt=$pdo->prepare('SELECT * FROM rp_blackjack_hands WHERE id=:id AND player_id=:player FOR UPDATE');$stmt->execute(['id'=>$handId,'player'=>$player['id']]);$row=$stmt->fetch(PDO::FETCH_ASSOC);
        if(!$row||$row['status']!=='playing')throw new RuntimeException('That blackjack hand is not ready for an action.');if((int)$row['action_version']!==$version)throw new RuntimeException('That hand changed in another request. Refresh and try again.');
        $cards=json_decode((string)$row['player_cards_json'],true)?:[];
        if($action==='double'){
            if(count($cards)!==2)throw new RuntimeException('Double down is only available on the first two cards.');$stake=(int)$row['stake_rp'];raidlands_rewards_check_daily_limits($player,$settings,$stake,$stake);
            $request=raidlands_rewards_queue_point_request($pdo,(int)$player['id'],(string)$player['steam_id64'],'blackjack_double',(string)$handId,$stake,0,'RP Blackjack double',['hand_id'=>$handId,'action'=>'double']);
            $pdo->prepare('UPDATE rp_blackjack_hands SET status="double_queued",double_request_id=:request,last_action_at=NOW(),action_version=action_version+1,message="Waiting for the Rust server to confirm the double-down stake." WHERE id=:id')->execute(['request'=>$request['id'],'id'=>$handId]);raidlands_rewards_record_daily_wager($pdo,$player,$stake,$stake);
        }elseif($action==='hit'){$cards=array_merge($cards,raidlands_blackjack_draw($row));$pdo->prepare('UPDATE rp_blackjack_hands SET player_cards_json=:cards,deck_position=:position,last_action_at=NOW(),action_version=action_version+1 WHERE id=:id')->execute(['cards'=>json_encode($cards),'position'=>$row['deck_position'],'id'=>$handId]);$row=raidlands_db_fetch_one('SELECT * FROM rp_blackjack_hands WHERE id=:id',['id'=>$handId]);if(raidlands_blackjack_hand_value($cards)['total']>=21)raidlands_blackjack_resolve($pdo,$row);
        }elseif($action==='stand')raidlands_blackjack_resolve($pdo,$row);else throw new InvalidArgumentException('Invalid blackjack action.');
        $pdo->commit();$fresh=raidlands_db_fetch_one('SELECT * FROM rp_blackjack_hands WHERE id=:id',['id'=>$handId]);return ['hand'=>raidlands_blackjack_public_hand($fresh)];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function raidlands_blackjack_run_timeouts(): void
{
    if(!raidlands_casino_backend_ready('blackjack'))return;
    $expired=raidlands_db_fetch_all('SELECT b.*, r.source_type FROM rp_blackjack_hands b INNER JOIN rp_point_requests r ON r.id=CASE WHEN b.status="wager_queued" THEN b.wager_request_id ELSE b.double_request_id END WHERE b.status IN ("wager_queued","double_queued") AND r.status="expired" LIMIT 25');
    foreach($expired as $row){$pdo=raidlands_db_required();$pdo->beginTransaction();try{if($row['status']==='wager_queued'){$pdo->prepare('UPDATE rp_blackjack_hands SET status="canceled",active_player_key=NULL,resolved_at=NOW(),message="Blackjack wager expired before server confirmation." WHERE id=:id AND status="wager_queued"')->execute(['id'=>$row['id']]);}else{$pdo->prepare('UPDATE rp_blackjack_hands SET status="playing",double_request_id=NULL,action_version=action_version+1,message="Double down expired; continue the original hand." WHERE id=:id AND status="double_queued"')->execute(['id'=>$row['id']]);}raidlands_rewards_rollback_daily_wager($pdo,(int)$row['player_id'],(int)$row['stake_rp'],(int)$row['stake_rp']);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();}}
    $ids=raidlands_db_fetch_all('SELECT id FROM rp_blackjack_hands WHERE status="playing" AND last_action_at<=DATE_SUB(NOW(),INTERVAL 10 MINUTE) LIMIT 25');
    foreach($ids as $item){$pdo=raidlands_db_required();$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM rp_blackjack_hands WHERE id=:id AND status="playing" FOR UPDATE');$stmt->execute(['id'=>$item['id']]);$row=$stmt->fetch(PDO::FETCH_ASSOC);if($row)raidlands_blackjack_resolve($pdo,$row);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();}}
}

function raidlands_blackjack_sync_point_result(PDO $pdo,array $request,string $status,string $message): bool
{
    $type=(string)$request['source_type'];if(!in_array($type,['blackjack_wager','blackjack_double','blackjack_payout'],true))return false;
    $stmt=$pdo->prepare('SELECT * FROM rp_blackjack_hands WHERE id=:id FOR UPDATE');$stmt->execute(['id'=>(int)$request['source_id']]);$row=$stmt->fetch(PDO::FETCH_ASSOC);if(!$row)return true;
    if($type==='blackjack_wager'){
        if($status==='confirmed')raidlands_blackjack_deal_confirmed($pdo,$row);elseif(in_array($status,['rejected','failed','expired'],true)){$pdo->prepare('UPDATE rp_blackjack_hands SET status="canceled",active_player_key=NULL,resolved_at=NOW(),message=:message WHERE id=:id')->execute(['message'=>$message?:'Blackjack wager was not confirmed.','id'=>$row['id']]);raidlands_rewards_rollback_daily_wager($pdo,(int)$row['player_id'],(int)$row['stake_rp'],(int)$row['stake_rp']);}
    }elseif($type==='blackjack_double'){
        if($status==='confirmed'){$cards=json_decode((string)$row['player_cards_json'],true)?:[];$cards=array_merge($cards,raidlands_blackjack_draw($row));$pdo->prepare('UPDATE rp_blackjack_hands SET status="playing",total_stake_rp=total_stake_rp+stake_rp,player_cards_json=:cards,deck_position=:position WHERE id=:id')->execute(['cards'=>json_encode($cards),'position'=>$row['deck_position'],'id'=>$row['id']]);$row=raidlands_db_fetch_one('SELECT * FROM rp_blackjack_hands WHERE id=:id',['id'=>$row['id']]);raidlands_blackjack_resolve($pdo,$row);}elseif(in_array($status,['rejected','failed','expired'],true)){$pdo->prepare('UPDATE rp_blackjack_hands SET status="playing",double_request_id=NULL,action_version=action_version+1,message="Double down was not confirmed; continue the original hand." WHERE id=:id')->execute(['id'=>$row['id']]);raidlands_rewards_rollback_daily_wager($pdo,(int)$row['player_id'],(int)$row['stake_rp'],(int)$row['stake_rp']);}
    }else{$terminal=$status==='confirmed'?((int)$row['payout_rp']===(int)$row['total_stake_rp']?'push':'paid'):'failed';$pdo->prepare('UPDATE rp_blackjack_hands SET status=:status,message=:message WHERE id=:id')->execute(['status'=>$terminal,'message'=>$message?:($terminal==='paid'?'Blackjack payout confirmed.':'Blackjack payout needs attention.'),'id'=>$row['id']]);}
    return true;
}
