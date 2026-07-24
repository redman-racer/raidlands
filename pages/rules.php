<?= render_page_hero('rules',
    '<a class="btn btn-primary" href="' . e(route_url('play')) . '">Play Now</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('bans')) . '">Appeals</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="grid two">
      <?= render_rule_block('Server Rules', [
          'No cheating, scripting, exploiting, or ban evasion.',
          'No DDoS threats, doxxing, swatting, or real-world threats.',
          'No severe harassment, hate speech, or targeted abuse.',
          'No abusing bugs or intentionally crashing systems.',
          'No impersonating staff or pretending to represent Raidlands.',
          'No real-money trading outside official Raidlands store systems.',
          'Follow staff instructions during investigations.',
          'The maximum team size is 16. Do not exceed that limit through alliances or coordinated group splitting.',
          'Respect staff-posted wipe rules and configured stack limits, including the 120 cap for C4 and rockets.',
      ]) ?>
      <?= render_rule_block('Gameplay Stance', [
          'Raidlands is a progression-focused PvP server.',
          'Raiding, counters, doorcamping, roofcamping, and revenge raids are normal Rust behavior.',
          'Staff will not punish ordinary PvP because someone lost gear.',
          'Cheating, exploits, and real-world threats are the line.',
      ]) ?>
      <?= render_rule_block('Discord Rules', [
          'No spam or malicious links.',
          'No hate speech or targeted harassment.',
          'Use support channels correctly.',
          'Do not harass staff or demand private moderation details.',
          'Keep appeals and reports in the right channel.',
      ]) ?>
      <?= render_rule_block('Enforcement', [
          'Warnings, kicks, temporary bans, permanent bans, Discord removal, and appeal restrictions may be used.',
          'Severity, intent, account history, and evidence all matter.',
          'Appeals start in Discord.',
      ]) ?>
    </div>
  </div>
</section>
