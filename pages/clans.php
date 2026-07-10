<?php

require_once $site_root . '/includes/clans.php';

$clan_player = raidlands_store_current_player();
$clan_flash = raidlands_store_flash();
$clan_csrf = raidlands_store_csrf_token();
$clan_context = raidlands_clans_context_for_player($clan_player);
$clan_role = $clan_context['role'];
$clan_snapshot = $clan_context['snapshot'];
$clan_api_keys = $clan_player !== null && !empty($clan_player['id'])
    ? raidlands_clans_api_keys_for_player((int) $clan_player['id'])
    : [];
$new_clan_api_key = $_SESSION['raidlands_new_clan_api_key'] ?? null;
unset($_SESSION['raidlands_new_clan_api_key']);

$clan_player_name = $clan_player !== null
    ? (string) (($clan_player['display_name'] ?? '') ?: ($clan_player['steam_display_name'] ?? 'Raidlands Player'))
    : '';
$clan_avatar = $clan_player !== null
    ? render_steam_avatar(
        (string) ($clan_player['steam_avatar_url'] ?? ''),
        (string) ($clan_player['steam_profile_url'] ?? ''),
        $clan_player_name,
        'steam-avatar-sm'
    )
    : '';
$clan_tag = is_array($clan_snapshot) ? (string) ($clan_snapshot['clan_tag'] ?? '') : '';
$clan_is_stale = !empty($clan_context['is_stale']);
$clan_can_manage = !empty($clan_context['can_manage']) && !$clan_is_stale;
$clan_is_owner = !empty($clan_context['can_owner_manage']) && !$clan_is_stale;
$clan_recent_actions = (array) $clan_context['recent_actions'];
$clan_active_actions = array_values(array_filter($clan_recent_actions, static function (array $action_row): bool {
    return in_array((string) ($action_row['status'] ?? ''), ['queued', 'processing'], true);
}));
$clan_action_state_json = $clan_player !== null
    ? json_encode([
        'recent_actions' => array_map('raidlands_clans_public_action_payload', $clan_recent_actions),
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES)
    : '{}';

function raidlands_clans_page_action_label(string $action): string
{
    return match ($action) {
        'withdraw_invite' => 'Withdraw Invite',
        default => ucwords(str_replace('_', ' ', $action)),
    };
}

function raidlands_clans_page_action_form(string $csrf, string $clan_tag, string $action, string $target_steam_id64, string $target_display_name, string $label, string $button_class = 'btn-secondary'): string
{
    return '<form class="clan-inline-form" method="post" action="' . e(route_url('clans')) . '" data-clan-queue-form>'
        . '<input type="hidden" name="form_action" value="queue_clan_action">'
        . '<input type="hidden" name="csrf" value="' . e($csrf) . '">'
        . '<input type="hidden" name="action" value="' . e($action) . '">'
        . '<input type="hidden" name="clan_tag" value="' . e($clan_tag) . '">'
        . '<input type="hidden" name="target_steam_id64" value="' . e($target_steam_id64) . '">'
        . '<input type="hidden" name="target_display_name" value="' . e($target_display_name) . '">'
        . '<button class="btn ' . e($button_class) . '" type="submit">' . e($label) . '</button>'
        . '</form>';
}

function raidlands_clans_page_action_target(array $action_row): string
{
    $target = trim((string) ($action_row['target_display_name'] ?? ''));

    if ($target !== '') {
        return $target;
    }

    $target = trim((string) ($action_row['target_steam_id64'] ?? ''));

    return $target !== '' ? $target : (string) ($action_row['clan_tag'] ?? '');
}

function raidlands_clans_page_action_item(array $action_row): string
{
    $status = (string) ($action_row['status'] ?? 'queued');
    $error = trim((string) ($action_row['error_message'] ?? ''));
    $meta = raidlands_clans_page_action_target($action_row);

    return '<div class="clan-list-item clan-queue-item" data-clan-action-id="' . e((string) ($action_row['id'] ?? '')) . '">'
        . '<span>'
        . '<strong>' . e(raidlands_clans_page_action_label((string) ($action_row['action_type'] ?? ''))) . '</strong>'
        . '<code>' . e($meta) . '</code>'
        . ($error !== '' ? '<small>' . e($error) . '</small>' : '')
        . '</span>'
        . '<span class="status-pill ' . e($status) . '">' . e($status) . '</span>'
        . '</div>';
}
?>
<?= render_page_hero('clans',
    '<a class="btn btn-primary" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Connect Steam', 'View Account')) . '</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('api-docs')) . '">API Docs</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($clan_flash !== null) : ?>
      <div class="form-status <?= e((string) $clan_flash['type']) ?>"><?= e((string) $clan_flash['message']) ?></div>
    <?php endif; ?>

    <?php if (is_array($new_clan_api_key) && !empty($new_clan_api_key['secret'])) : ?>
      <div class="form-status success clan-api-secret">
        <strong>New API key:</strong>
        <code><?= e((string) $new_clan_api_key['secret']) ?></code>
        <button class="btn btn-secondary copy-small" type="button" data-copy-value="<?= e((string) $new_clan_api_key['secret']) ?>">Copy Key</button>
      </div>
    <?php endif; ?>

    <?php if ($clan_player === null) : ?>
      <div class="metal-panel">
        <p class="section-kicker">Steam required</p>
        <h2>Connect Steam to manage clans</h2>
        <p class="section-lede">Clan access is resolved from the Steam account signed in on this browser. Once the game server syncs your role, management tools unlock here.</p>
        <div class="button-row">
          <a class="btn btn-primary" href="<?= e(route_url('link') . '?action=steam') ?>">Continue with Steam</a>
          <a class="btn btn-secondary" href="<?= e(route_url('api-docs')) ?>">Read API Docs</a>
        </div>
      </div>
    <?php else : ?>
      <div class="split-panel">
        <div class="metal-panel">
          <div class="linked-steam-account">
            <?= $clan_avatar ?>
            <span>
              <strong><?= e($clan_player_name) ?></strong>
              <code><?= e((string) $clan_player['steam_id64']) ?></code>
            </span>
          </div>
          <div class="tag-row">
            <?php if ($clan_role !== null) : ?>
              <span class="tag"><?= e((string) $clan_role['role']) ?></span>
              <span class="tag"><?= e($clan_tag) ?></span>
            <?php else : ?>
              <span class="tag">No synced clan</span>
            <?php endif; ?>
          </div>
        </div>

        <div class="metal-panel">
          <p class="section-kicker">Sync status</p>
          <?php if (!$clan_context['ready']) : ?>
            <h2>Clan setup pending</h2>
            <p class="section-lede"><?= e((string) $clan_context['readiness_message']) ?></p>
          <?php elseif ($clan_snapshot === null) : ?>
            <h2>No clan synced yet</h2>
            <p class="section-lede">Join or create a clan in game, then wait for the next server sync.</p>
          <?php else : ?>
            <h2><?= e($clan_is_stale ? 'Snapshot is stale' : 'Clan data is current') ?></h2>
            <p class="section-lede">Last sync: <?= e((string) ($clan_snapshot['updated_at'] ?? 'Pending')) ?>. Actions are disabled when snapshots are older than ten minutes.</p>
          <?php endif; ?>
        </div>
      </div>

      <div
        class="metal-panel clan-queue-monitor<?= $clan_active_actions === [] ? ' is-idle' : '' ?>"
        data-clan-action-monitor
        data-poll-url="<?= e($base_path . 'api/clans/me.php') ?>"
        data-action-url="<?= e($base_path . 'api/clans/action.php') ?>">
        <div class="clan-queue-head">
          <div>
            <p class="section-kicker">Action queue</p>
            <h2>Server actions</h2>
          </div>
          <span class="status-pill queued" data-clan-queue-count><?= e((string) count($clan_active_actions)) ?> active</span>
        </div>
        <div class="clan-resolution-stack" data-clan-resolution-stack aria-live="polite"></div>
        <div class="clan-list-stack clan-queue-list" data-clan-queue-list<?= $clan_active_actions === [] ? ' hidden' : '' ?>>
          <?php foreach ($clan_active_actions as $action_row) : ?>
            <?= raidlands_clans_page_action_item($action_row) ?>
          <?php endforeach; ?>
        </div>
        <p class="section-lede clan-queue-empty" data-clan-queue-empty<?= $clan_active_actions !== [] ? ' hidden' : '' ?>>No clan actions are waiting on the server.</p>
      </div>
      <script type="application/json" id="clan-action-state"><?= $clan_action_state_json ?: '{}' ?></script>
    <?php endif; ?>
  </div>
</section>

<?php if ($clan_player !== null) : ?>
  <?php if ($clan_snapshot !== null) : ?>
    <section class="section alt">
      <div class="section-inner">
        <div class="section-header">
          <p class="section-kicker">Clan roster</p>
          <h2><?= e($clan_tag) ?> command table</h2>
          <p class="section-lede">Roster data comes from the game server. Changes queue here and finish after the server processes them.</p>
        </div>

        <?php if ($clan_is_stale) : ?>
          <div class="form-status warning" data-clan-stale-warning>Clan actions are disabled until the game server posts a fresh snapshot.</div>
        <?php else : ?>
          <div class="form-status warning" data-clan-stale-warning hidden>Clan actions are disabled until the game server posts a fresh snapshot.</div>
        <?php endif; ?>

        <div class="profile-stat-grid clan-stat-grid">
          <article class="stat-tile"><span>Members</span><strong data-clan-stat="members"><?= e((string) count((array) ($clan_snapshot['members'] ?? []))) ?></strong></article>
          <article class="stat-tile"><span>Pending Invites</span><strong data-clan-stat="invites"><?= e((string) count((array) ($clan_snapshot['member_invites'] ?? []))) ?></strong></article>
          <article class="stat-tile"><span>Allies</span><strong data-clan-stat="allies"><?= e((string) count((array) ($clan_snapshot['allies'] ?? []))) ?></strong></article>
          <article class="stat-tile"><span>Your Role</span><strong data-clan-stat="role"><?= e((string) ($clan_role['role'] ?? 'member')) ?></strong></article>
        </div>

        <?php if ($clan_can_manage) : ?>
          <div class="metal-panel clan-invite-panel">
            <p class="section-kicker">Invite player</p>
            <h3>Queue a clan invite</h3>
            <form class="clan-action-form" method="post" action="<?= e(route_url('clans')) ?>" data-clan-queue-form>
              <input type="hidden" name="form_action" value="queue_clan_action">
              <input type="hidden" name="csrf" value="<?= e($clan_csrf) ?>">
              <input type="hidden" name="action" value="invite">
              <input type="hidden" name="clan_tag" value="<?= e($clan_tag) ?>">
              <label class="store-field">
                <span>Target SteamID64</span>
                <input type="text" name="target_steam_id64" inputmode="numeric" pattern="[0-9]{17}" maxlength="17" placeholder="7656119XXXXXXXXXX" required>
              </label>
              <label class="store-field">
                <span>Display name</span>
                <input type="text" name="target_display_name" maxlength="120" placeholder="Optional">
              </label>
              <button class="btn btn-primary" type="submit">Queue Invite</button>
            </form>
          </div>
        <?php endif; ?>

        <div class="store-table-wrap">
          <table class="store-table clan-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>SteamID64</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody data-clan-members>
              <?php foreach ((array) ($clan_snapshot['members'] ?? []) as $member) : ?>
                <?php
                  $member_steam = raidlands_clans_normalize_steam_id((string) ($member['steam_id64'] ?? ''));
                  $member_role = strtolower((string) ($member['role'] ?? 'member'));
                  $member_name = trim((string) ($member['display_name'] ?? '')) ?: $member_steam;
                  $is_self = $member_steam === (string) ($clan_player['steam_id64'] ?? '');
                ?>
                <tr>
                  <td><?= e($member_name) ?></td>
                  <td><code><?= e($member_steam) ?></code></td>
                  <td><span class="status-pill <?= e($member_role) ?>"><?= e($member_role) ?></span></td>
                  <td><?= !empty($member['is_online']) ? 'Online' : 'Offline' ?></td>
                  <td>
                    <div class="clan-action-row">
                      <?php if ($clan_can_manage && !$is_self && $member_role !== 'owner' && ($member_role !== 'moderator' || $clan_is_owner)) : ?>
                        <?= raidlands_clans_page_action_form($clan_csrf, $clan_tag, 'kick', $member_steam, $member_name, 'Kick', 'btn-secondary') ?>
                      <?php endif; ?>
                      <?php if ($clan_is_owner && !$is_self && $member_role === 'member') : ?>
                        <?= raidlands_clans_page_action_form($clan_csrf, $clan_tag, 'promote', $member_steam, $member_name, 'Promote', 'btn-secondary') ?>
                      <?php endif; ?>
                      <?php if ($clan_is_owner && !$is_self && $member_role === 'moderator') : ?>
                        <?= raidlands_clans_page_action_form($clan_csrf, $clan_tag, 'demote', $member_steam, $member_name, 'Demote', 'btn-ghost') ?>
                      <?php endif; ?>
                      <?php if (!$clan_can_manage || $is_self || $member_role === 'owner') : ?>
                        <span class="store-muted">No action</span>
                      <?php endif; ?>
                    </div>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner split-panel">
        <div class="metal-panel">
          <p class="section-kicker">Pending invites</p>
          <h2>Invited players</h2>
          <p class="section-lede" data-clan-invites-empty<?= empty($clan_snapshot['member_invites']) ? '' : ' hidden' ?>>No player invites are pending.</p>
          <div class="clan-list-stack" data-clan-invites<?= empty($clan_snapshot['member_invites']) ? ' hidden' : '' ?>>
            <?php foreach ((array) $clan_snapshot['member_invites'] as $invite) : ?>
              <?php
                $invite_steam = raidlands_clans_normalize_steam_id((string) ($invite['steam_id64'] ?? ''));
                $invite_name = trim((string) ($invite['display_name'] ?? '')) ?: $invite_steam;
              ?>
              <div class="clan-list-item">
                <span><strong><?= e($invite_name) ?></strong><code><?= e($invite_steam) ?></code></span>
                <?php if ($clan_can_manage) : ?>
                  <?= raidlands_clans_page_action_form($clan_csrf, $clan_tag, 'withdraw_invite', $invite_steam, $invite_name, 'Withdraw', 'btn-secondary') ?>
                <?php endif; ?>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="metal-panel">
          <p class="section-kicker">Alliances</p>
          <h2>Clan relations</h2>
          <div class="tag-row" data-clan-allies>
            <?php foreach ((array) ($clan_snapshot['allies'] ?? []) as $ally) : ?>
              <span class="tag"><?= e((string) $ally) ?></span>
            <?php endforeach; ?>
            <?php if (empty($clan_snapshot['allies'])) : ?>
              <span class="tag">No allies synced</span>
            <?php endif; ?>
          </div>
          <?php if (!empty($clan_snapshot['invited_allies'])) : ?>
            <p class="store-muted" data-clan-pending-allies>Pending ally invites: <?= e(implode(', ', array_map('strval', (array) $clan_snapshot['invited_allies']))) ?></p>
          <?php else : ?>
            <p class="store-muted" data-clan-pending-allies hidden></p>
          <?php endif; ?>
        </div>
      </div>
    </section>

    <?php if ($clan_is_owner) : ?>
      <section class="section alt">
        <div class="section-inner">
          <div class="metal-panel danger-panel">
            <p class="section-kicker">Owner action</p>
            <h2>Disband clan</h2>
            <p class="section-lede">This queues a destructive server action. Type the clan tag exactly to confirm.</p>
            <form class="clan-action-form" method="post" action="<?= e(route_url('clans')) ?>" data-clan-queue-form>
              <input type="hidden" name="form_action" value="queue_clan_action">
              <input type="hidden" name="csrf" value="<?= e($clan_csrf) ?>">
              <input type="hidden" name="action" value="disband">
              <input type="hidden" name="clan_tag" value="<?= e($clan_tag) ?>">
              <label class="store-field">
                <span>Confirm clan tag</span>
                <input type="text" name="confirm_clan_tag" maxlength="32" placeholder="<?= e($clan_tag) ?>" required>
              </label>
              <button class="btn btn-secondary" type="submit">Queue Disband</button>
            </form>
          </div>
        </div>
      </section>
    <?php endif; ?>
  <?php endif; ?>

  <section class="section<?= $clan_snapshot !== null ? '' : ' alt' ?>">
    <div class="section-inner split-panel">
      <div class="metal-panel">
        <p class="section-kicker">Public API keys</p>
        <h2>Bot and website access</h2>
        <p class="section-lede">Keys are tied to this Steam account and can read or queue the same clan actions your current synced role allows.</p>

        <?php if (!$clan_context['ready']) : ?>
          <div class="form-status warning"><?= e((string) $clan_context['readiness_message']) ?></div>
        <?php elseif (empty($clan_player['id'])) : ?>
          <div class="form-status warning">Your Steam account needs a database player record before API keys can be created.</div>
        <?php else : ?>
          <form class="clan-action-form" method="post" action="<?= e(route_url('clans')) ?>">
            <input type="hidden" name="form_action" value="create_api_key">
            <input type="hidden" name="csrf" value="<?= e($clan_csrf) ?>">
            <label class="store-field">
              <span>Key label</span>
              <input type="text" name="label" maxlength="120" placeholder="Discord bot, website widget, tools">
            </label>
            <button class="btn btn-primary" type="submit">Create API Key</button>
          </form>
        <?php endif; ?>

        <?php if ($clan_api_keys !== []) : ?>
          <div class="clan-list-stack api-key-list">
            <?php foreach ($clan_api_keys as $key) : ?>
              <div class="clan-list-item">
                <span>
                  <strong><?= e((string) ($key['label'] ?: 'Clan API key')) ?></strong>
                  <code><?= e((string) $key['key_prefix']) ?>...</code>
                  <small>Created <?= e((string) $key['created_at']) ?><?= !empty($key['last_used_at']) ? ' · Last used ' . e((string) $key['last_used_at']) : '' ?></small>
                </span>
                <form class="clan-inline-form" method="post" action="<?= e(route_url('clans')) ?>">
                  <input type="hidden" name="form_action" value="revoke_api_key">
                  <input type="hidden" name="csrf" value="<?= e($clan_csrf) ?>">
                  <input type="hidden" name="key_id" value="<?= e((string) $key['id']) ?>">
                  <button class="btn btn-ghost" type="submit">Revoke</button>
                </form>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <div class="metal-panel">
        <p class="section-kicker">Recent queue</p>
        <h2>Action history</h2>
        <p class="section-lede" data-clan-action-history-empty<?= $clan_recent_actions === [] ? '' : ' hidden' ?>>No website clan actions have been queued from this Steam account yet.</p>
        <div class="clan-list-stack" data-clan-action-history<?= $clan_recent_actions === [] ? ' hidden' : '' ?>>
          <?php foreach ($clan_recent_actions as $action_row) : ?>
            <?= raidlands_clans_page_action_item($action_row) ?>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </section>

  <section class="section alt">
    <div class="section-inner">
      <div class="metal-panel">
        <p class="section-kicker">Developer endpoint</p>
        <h2>Use clan tools outside Raidlands</h2>
        <p class="section-lede">External sites and Discord bots authenticate with a clan API key. The key resolves your SteamID64, applies rate limits, and only permits actions your synced role can perform.</p>
        <div class="button-row">
          <a class="btn btn-primary" href="<?= e(route_url('api-docs')) ?>">Open API Docs</a>
        </div>
      </div>
    </div>
  </section>
<?php endif; ?>
