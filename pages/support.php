<?= render_page_hero('support',
    '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Open Discord</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('play')) . '">Connection Help</a>'
) ?>

<?php
  $feedback_type = (string) ($feedback_old['type'] ?? 'bug');
  $feedback_summary = (string) ($feedback_old['summary'] ?? '');
  $feedback_details = (string) ($feedback_old['details'] ?? '');
  $feedback_contact_name = (string) ($feedback_old['contact_name'] ?? '');
  $feedback_contact_email = (string) ($feedback_old['contact_email'] ?? '');
  $feedback_linked_player = raidlands_linked_player();
  $feedback_linked_name = $feedback_linked_player !== null
      ? trim((string) (($feedback_linked_player['display_name'] ?? '') ?: ($feedback_linked_player['steam_display_name'] ?? '')))
      : '';
  $feedback_steam_id = $feedback_linked_player !== null
      ? (string) ($feedback_linked_player['steam_id64'] ?? '')
      : (string) ($feedback_old['steam_id64'] ?? '');
  $feedback_avatar = $feedback_linked_player !== null
      ? render_steam_avatar(
          (string) ($feedback_linked_player['steam_avatar_url'] ?? ''),
          (string) ($feedback_linked_player['steam_profile_url'] ?? ''),
          $feedback_linked_name,
          'steam-avatar-sm'
      )
      : '';
?>

<section class="section" id="feedback-form">
  <div class="section-inner split-panel support-feedback-layout">
    <div class="metal-panel support-form-panel">
      <p class="section-kicker">Player feedback</p>
      <h2>Report a bug or request a change</h2>
      <p class="section-lede">Send staff the details without leaving the site. Discord is still best for urgent moderation, but this keeps bugs and ideas organized.</p>

      <?php if ($feedback_flash !== null) : ?>
        <div class="form-status <?= e((string) $feedback_flash['type']) ?>"><?= e((string) $feedback_flash['message']) ?></div>
      <?php endif; ?>

      <?php if (!$feedback_ready) : ?>
        <div class="form-status warning"><?= e($feedback_readiness_message) ?></div>
      <?php endif; ?>

      <form class="feedback-form" method="post" action="<?= e(route_url('support')) ?>#feedback-form">
        <input type="hidden" name="action" value="submit_feedback">
        <input type="hidden" name="csrf" value="<?= e($feedback_csrf) ?>">
        <input type="hidden" name="page_url" value="<?= e(raidlands_feedback_current_url()) ?>">
        <label class="feedback-honeypot">
          Website
          <input type="text" name="website" tabindex="-1" autocomplete="off">
        </label>

        <div class="feedback-grid">
          <label class="store-field">
            <span>Type</span>
            <select name="type" required>
              <?php foreach (raidlands_feedback_type_options() as $type_value => $type_label) : ?>
                <option value="<?= e($type_value) ?>" <?= $feedback_type === $type_value ? 'selected' : '' ?>><?= e($type_label) ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <?php if ($feedback_linked_player !== null) : ?>
            <div class="auth-status is-linked feedback-linked-account">
              <input type="hidden" name="steam_id64" value="<?= e($feedback_steam_id) ?>">
              <div class="linked-steam-account">
                <?= $feedback_avatar ?>
                <span>
                  <strong>Steam connected.</strong>
                  <?= $feedback_linked_name !== '' ? e($feedback_linked_name) . ' ' : '' ?><code><?= e($feedback_steam_id) ?></code>
                </span>
              </div>
            </div>
          <?php else : ?>
            <label class="store-field">
              <span>SteamID64</span>
              <input type="text" name="steam_id64" inputmode="numeric" autocomplete="off" value="<?= e($feedback_steam_id) ?>" placeholder="Optional">
            </label>
          <?php endif; ?>
        </div>

        <label class="store-field">
          <span>Short summary</span>
          <input type="text" name="summary" value="<?= e($feedback_summary) ?>" maxlength="160" placeholder="Example: Backpack command fails after teleporting" required>
        </label>

        <label class="store-field">
          <span>Details</span>
          <textarea name="details" rows="7" maxlength="3000" placeholder="What happened, what you expected, steps to reproduce, screenshots/error text, or why the feature would help." required><?= e($feedback_details) ?></textarea>
        </label>

        <div class="feedback-grid">
          <label class="store-field">
            <span>Name</span>
            <input type="text" name="contact_name" value="<?= e($feedback_contact_name) ?>" maxlength="90" placeholder="Optional">
          </label>
          <label class="store-field">
            <span>Email</span>
            <input type="email" name="contact_email" value="<?= e($feedback_contact_email) ?>" maxlength="180" placeholder="Optional">
          </label>
        </div>

        <button class="btn btn-primary" type="submit" <?= $feedback_ready ? '' : 'disabled' ?>>Send Feedback</button>
      </form>
    </div>

    <aside class="metal-panel support-routing-panel">
      <p class="section-kicker">What to include</p>
      <h2>Useful reports get fixed faster</h2>
      <ul class="list-clean">
        <li>Steps staff can repeat.</li>
        <li>What page, command, kit, perk, or server action was involved.</li>
        <li>Steam name or SteamID64 if the issue touches your account.</li>
        <li>Screenshots, error text, or timestamps when you have them.</li>
      </ul>
      <div class="button-row">
        <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Open Discord</a>
      </div>
    </aside>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">10X quick answers</p>
      <h2>Rates, backpacks, wipes, and RP</h2>
    </div>
    <div class="grid two">
      <?= render_card('GATHER', 'What are the live rates?', 'Player gathering and production are 10X, general loot is 5X, components are approximately 5X with 10X stacks, and scrap plus raid-resource progression are approximately 3X.') ?>
      <?= render_card('PACK', 'Do backpacks drop on death?', 'No. Everyone receives six backpack slots and keeps backpack contents on death. VIP, VIP+, and MVP receive 36 slots; Golden receives 42; Diamond, Ultimate, and Titan receive 48.') ?>
      <?= render_card('WIPE', 'When does the server wipe?', 'The website uses the live configured schedule: ' . implode(' and ', (array) ($site_config['wipe']['dayNames'] ?? ['Thursday'])) . ' at ' . (string) ($site_config['wipe']['time'] ?? '19:00') . ' ' . (string) ($site_config['wipe']['timezone'] ?? 'Europe/London') . '.') ?>
      <?= render_card('RP', 'When does spendable RP reset?', 'Spendable RP resets only on force wipe. RP earned this wipe is a separate seasonal statistic used by profiles and leaderboards.') ?>
      <?= render_card('KIT', 'Where do kit contents come from?', 'The store displays active kit contents, uses, cooldowns, and permissions synchronized from the live Rust server rather than placeholder inventories.') ?>
      <?= render_card('CRATE', 'Can event crates contain explosives?', 'Locked, helicopter, and Bradley crates can contain direct C4 or rockets, with rare explosive limits applied per crate.') ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner">
    <div class="grid three">
      <?= render_card('TICKET', 'Support Tickets', 'Use Discord support channels for urgent connection issues, reports, and staff help.') ?>
      <?= render_card('BUG', 'Bug Reports', 'Use the form above to keep bugs, steps, and context in one review queue.') ?>
      <?= render_card('APPEAL', 'Ban Appeals', 'Appeals start in Discord so staff can keep moderation context organized.') ?>
      <?= render_card('EAC', 'EAC Issues', 'Restart Steam and Rust, verify files, then share the exact error in a ticket.') ?>
      <?= render_card('TIMEOUT', 'Timeouts', 'Try the console command first, then ask support if the server is online and reachable.') ?>
      <?= render_card('STAFF', 'Staff Contact', 'Keep moderation conversations in official channels so evidence stays organized.') ?>
    </div>
  </div>
</section>
