<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="./assets/css/styles.css">
  <title>Podium acceptance fixture</title>
</head>
<body>
<main style="max-width: 1440px; margin: 0 auto; padding: 32px;">
  <section class="leaderboard-podium" data-leaderboard-podium data-podium-state="poster" data-board="players" data-metric="kills"
    data-model-base="./assets/media/models/leaderboard/" data-scene-manifest="./assets/data/leaderboard-scene-manifest.json"
    data-scene-model-base="./assets/media/models/leaderboard-scene/" data-environment-src="./assets/media/skyboxes/leaderboard-industrial-night-v2.hdr"
    data-backdrop-src="./assets/media/leaderboard-arena-backdrop-v1.webp" data-ground-albedo-src="./assets/media/textures/leaderboard-junkyard-dirt-albedo.webp"
    data-ground-normal-src="./assets/media/textures/leaderboard-junkyard-dirt-normal.webp" data-ground-arm-src="./assets/media/textures/leaderboard-junkyard-dirt-arm.webp"
    data-ground-fallback-src="./assets/media/textures/road-dirt.webp" data-sign-albedo-src="./assets/media/textures/leaderboard-signs/weathered-steel-albedo.webp"
    data-sign-normal-src="./assets/media/textures/leaderboard-signs/weathered-steel-normal.webp" data-sign-arm-src="./assets/media/textures/leaderboard-signs/weathered-steel-arm.webp"
    data-poster-src="./assets/media/leaderboard-podium-poster.webp" data-decoder-path="./assets/media/models/draco/">
    <div class="leaderboard-podium-heading"><span>Current category</span><strong data-podium-category>MOST KILLS</strong></div>
    <div class="leaderboard-podium-drag" aria-hidden="true"><span>◌</span> Drag to rotate</div>
    <div class="leaderboard-podium-stage" data-podium-stage><img class="leaderboard-podium-poster" data-podium-poster src="./assets/media/leaderboard-podium-poster.webp" alt=""></div>
    <div class="leaderboard-podium-cards" data-podium-cards></div>
    <div class="leaderboard-podium-loader" data-podium-loader><span data-podium-progress-value>00</span><p data-podium-status>Waiting</p></div>
    <div class="leaderboard-podium-streaming"><span data-podium-streaming-status>Loading arena detail — 0/0</span></div>
    <script type="application/json" data-podium-payload>{"leaders":[],"board":"players","metric":"kills"}</script>
  </section>
</main>
<script>
window.acceptanceMetrics = { gaps: [], tasks: [] };
(function sampleFrames(previous) {
  requestAnimationFrame(function (now) {
    var gap = now - previous;
    var host = document.querySelector('[data-leaderboard-podium]');
    if (gap > 100 && host) window.acceptanceMetrics.gaps.push({
      duration: gap,
      phase: host.dataset.podiumLoadPhase || '',
      state: host.dataset.podiumState || '',
      status: (host.querySelector('[data-podium-streaming-status]') || {}).textContent || '',
      placements: host.dataset.scenePlacements || '',
      mainActive: host.dataset.podiumMainActive || '',
      mainQueued: host.dataset.podiumMainQueued || ''
    });
    sampleFrames(now);
  });
})(performance.now());
if ('PerformanceObserver' in window) {
  new PerformanceObserver(function (entries) {
    var host = document.querySelector('[data-leaderboard-podium]');
    entries.getEntries().forEach(function (entry) {
      window.acceptanceMetrics.tasks.push({
        duration: entry.duration,
        phase: host ? host.dataset.podiumLoadPhase || '' : '',
        state: host ? host.dataset.podiumState || '' : '',
        placements: host ? host.dataset.scenePlacements || '' : '',
        mainActive: host ? host.dataset.podiumMainActive || '' : '',
        mainQueued: host ? host.dataset.podiumMainQueued || '' : ''
      });
    });
  }).observe({ type: 'longtask', buffered: false });
}
</script>
<script type="module" src="./assets/build/airstrike-animation-editor/leaderboard-podium-loader.js?acceptance=11"></script>
</body>
</html>
