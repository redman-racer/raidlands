<?php

$vote_ready = !empty($vote_state['ready']);
$vote_player = is_array($vote_state['player'] ?? null) ? $vote_state['player'] : null;
$vote_sites = (array) ($vote_state['sites'] ?? []);
$vote_claims = (array) ($vote_state['claims'] ?? []);
$vote_balance = is_array($vote_state['balance'] ?? null) ? $vote_state['balance'] : null;
?>
<?= render_page_hero('vote',
    '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Sign in with Steam', 'View Account')) . '</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('rp-games')) . '">Open RP Games</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($vote_flash !== null) : ?>
      <div class="form-status <?= e((string) $vote_flash['type']) ?>"><?= e((string) $vote_flash['message']) ?></div>
    <?php endif; ?>

    <?php if (!$vote_ready) : ?>
      <div class="form-status warning"><?= e((string) ($vote_state['message'] ?? 'Vote rewards are not installed yet.')) ?></div>
    <?php elseif ($vote_player === null || empty($vote_player['id'])) : ?>
      <div class="form-status warning">Link your Steam account before claiming vote rewards.</div>
    <?php else : ?>
      <div class="store-rp-status">
        <div>
          <p class="section-kicker">Your synced RP</p>
          <strong><?= e(raidlands_store_rp((int) ($vote_balance['reward_points'] ?? 0))) ?></strong>
        </div>
        <span><?= $vote_balance === null || empty($vote_balance['last_seen_at']) ? 'Waiting for the next server sync' : 'Last synced ' . e((string) $vote_balance['last_seen_at']) ?></span>
      </div>
    <?php endif; ?>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Vote Rewards</p>
      <h2>Claim RP after supporting Raidlands</h2>
      <p class="section-lede">Vote links can pass your SteamID64 to supported sites. Rewards stay pending until the Rust server confirms the RP credit.</p>
    </div>

    <?php if ($vote_ready && $vote_sites === []) : ?>
      <div class="form-status warning">No vote reward sites are active yet.</div>
    <?php elseif ($vote_ready) : ?>
      <div class="grid three reward-site-grid">
        <?php foreach ($vote_sites as $site) : ?>
          <?php
            $eligibility = is_array($site['eligibility'] ?? null) ? $site['eligibility'] : [];
            $can_claim = !empty($eligibility['can_claim']);
            $vote_url = trim((string) ($site['vote_url'] ?? ''));
            $mode = (string) ($site['verification_mode'] ?? 'hybrid');
            $provider = (string) ($site['api_provider'] ?? 'none');
            $verify_label = $provider === 'rust_servers' && $mode !== 'manual'
                ? 'Steam API'
                : ucfirst($mode);
          ?>
          <article class="metal-card reward-site-card">
            <span class="status-tag voting"><?= e(raidlands_store_rp((int) ($site['reward_rp'] ?? 0))) ?></span>
            <h3><?= e((string) ($site['name'] ?? 'Vote site')) ?></h3>
            <p class="card-copy"><?= e((string) ($site['description'] ?: 'Vote for Raidlands, then return here to claim your RP.')) ?></p>
            <div class="feature-score-grid">
              <span><strong><?= e((string) ($site['cooldown_hours'] ?? 24)) ?>h</strong> Cooldown</span>
              <span><strong><?= e($verify_label) ?></strong> Verify</span>
              <span><strong><?= e((string) ($eligibility['label'] ?? 'Ready')) ?></strong> Status</span>
            </div>
            <?php if (!empty($eligibility['next_available_at'])) : ?>
              <p class="store-muted">Next claim after <?= e((string) $eligibility['next_available_at']) ?> UTC.</p>
            <?php endif; ?>
            <div class="button-row">
              <?php if ($vote_url !== '') : ?>
                <a class="btn btn-secondary" href="<?= e($vote_url) ?>" target="_blank" rel="noopener noreferrer">Open Vote Site</a>
              <?php endif; ?>
              <?php if ($vote_player === null || empty($vote_player['id'])) : ?>
                <a class="btn btn-steam" href="<?= e(route_url('link')) ?>">Sign in with Steam</a>
              <?php else : ?>
                <form method="post" action="<?= e(route_url('vote')) ?>">
                  <input type="hidden" name="csrf" value="<?= e($vote_csrf) ?>">
                  <input type="hidden" name="action" value="claim_vote_reward">
                  <input type="hidden" name="site_id" value="<?= e((string) $site['id']) ?>">
                  <button class="btn btn-primary" type="submit" <?= $can_claim ? '' : 'disabled' ?>><?= $can_claim ? 'Claim Reward' : 'Not Ready' ?></button>
                </form>
              <?php endif; ?>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Reward rules</p>
      <h2>Server-confirmed RP</h2>
      <ul class="list-clean">
        <li>Vote rewards use in-game Raidlands RP only.</li>
        <li>Rewards have no cash value and cannot be cashed out.</li>
        <li>Rust-Servers.net claims are checked against their SteamID vote API.</li>
        <li>Queued claims become final only after the Rust server credits ServerRewards RP.</li>
        <li>Strict vote sites wait for their callback before RP is queued.</li>
      </ul>
    </div>
    <div class="metal-panel">
      <p class="section-kicker">Recent claims</p>
      <h2>Your vote history</h2>
      <?php if ($vote_claims === []) : ?>
        <p class="section-lede">No vote reward claims are attached to this account yet.</p>
      <?php else : ?>
        <div class="store-table-wrap">
          <table class="store-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Reward</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($vote_claims as $claim) : ?>
                <tr>
                  <td><?= e((string) ($claim['site_name'] ?? 'Vote site')) ?></td>
                  <td><?= e(raidlands_store_rp((int) ($claim['reward_rp'] ?? 0))) ?></td>
                  <td><span class="status-pill <?= e((string) ($claim['status'] ?? 'queued')) ?>"><?= e((string) ($claim['status'] ?? 'queued')) ?></span></td>
                  <td><?= e((string) ($claim['created_at'] ?? '')) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </div>
</section>
