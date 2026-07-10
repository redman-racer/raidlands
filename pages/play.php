<?= render_page_hero('play',
    '<button class="btn btn-secondary" type="button" data-copy-command>Copy Connect</button>'
    . '<a class="btn btn-primary" href="' . e($site_config['steamConnectUrl']) . '" data-track="join_server_clicked">Launch Rust</a>'
) ?>

<section class="section">
  <div class="section-inner split-panel">
    <?= render_status_panel() ?>
    <div class="metal-panel">
      <p class="section-kicker">Connection methods</p>
      <h2>Get in with a fallback ready</h2>
      <p class="section-lede">Direct connect is fastest. The console command is most reliable. Server browser search is the backup when protocols or overlays misbehave.</p>
      <?= render_command_box() ?>
      <div class="button-row">
        <a class="btn btn-primary" href="<?= e($site_config['steamConnectUrl']) ?>" data-track="join_server_clicked">Launch Rust and Join</a>
        <button class="btn btn-secondary" type="button" data-copy-command>Copy Command</button>
      </div>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Join methods</p>
      <h2>Pick the route that works</h2>
    </div>
    <div class="grid three"><?= render_join_method_cards() ?></div>
  </div>
</section>

<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Troubleshooting</p>
      <h2>Connection fixes</h2>
    </div>
    <div class="grid three">
      <?php foreach ([
          ['Rust did not launch', 'Copy the console command, open Rust manually, press F1, paste it, and press Enter.'],
          ['Server does not appear', 'Use the modded browser, search Raidlands, refresh the list, or direct connect through the console.'],
          ['Connection timeout', 'Restart Rust, verify EAC is running, check your network, then ask Discord support if it persists.'],
          ['Wrong server selected', 'Use the exact command above to avoid lookalike names.'],
          ['EAC issue', 'Restart Steam and Rust, then verify game files if EAC keeps failing.'],
          ['Still stuck', 'Join Discord and open a support ticket with your Steam name and the error text.'],
      ] as [$title, $copy]) : ?>
        <?= render_card('FIX', $title, $copy) ?>
      <?php endforeach; ?>
    </div>
  </div>
</section>
