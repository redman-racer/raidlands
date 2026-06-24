(() => {
  const doc = document.documentElement;
  const app = document.getElementById("raidlands-app");
  const pageId = doc.dataset.page || "home";
  const basePath = doc.dataset.base || "./";

  const CONFIG = {
    serverName: "Raidlands 1000x",
    tagline: "Raid. Respawn. Rebuild. Repeat.",
    region: "US Central",
    mapName: "Procedural Battlefield",
    serverFps: "Stable",
    queue: "0",
    playersOnline: 127,
    maxPlayers: 250,
    serverOnline: true,
    connectCommand: "connect play.raidlands.gg:28015",
    steamConnectUrl: "steam://connect/play.raidlands.gg:28015",
    discordInviteUrl: "https://discord.gg/raidlands",
    wipe: {
      days: [1, 5],
      dayNames: ["Monday", "Friday"],
      time: "19:00",
      timezone: "America/Chicago"
    },
    auth: {
      steamUrl: "",
      discordUrl: ""
    }
  };

  const NAV = [
    ["home", "", "Home"],
    ["play", "play", "Play"],
    ["features", "features", "Features"],
    ["rules", "rules", "Rules"],
    ["discord", "discord", "Discord"],
    ["link", "link", "Link Account"]
  ];

  const FUTURE_NAV = [
    ["support", "support", "Support"],
    ["leaderboard", "leaderboard", "Leaderboard"],
    ["store", "store", "Store"],
    ["events", "events", "Events"],
    ["clans", "clans", "Clans"],
    ["vote", "vote", "Vote"],
    ["bans", "bans", "Bans"],
    ["profile", "profile", "Profile"]
  ];

  const quickFeatures = [
    ["GATHER", "1000x Gather"],
    ["KIT", "Kits"],
    ["TP", "Teleport / Homes"],
    ["CLAN", "Clans"],
    ["SKIN", "Skinbox"],
    ["PACK", "Backpacks"],
    ["RAID", "Fast Raids"],
    ["STAFF", "Active Staff"]
  ];

  const featureIconAliases = {
    "1000x": "GATHER",
    GATHER: "GATHER",
    PVP: "PVP",
    KIT: "KIT",
    TP: "TP",
    CLAN: "CLAN",
    SKIN: "SKIN",
    PACK: "PACK",
    RAID: "RAID",
    STAFF: "STAFF",
    MINI: "MINI",
    SHOP: "SHOP",
    EVENT: "EVENT",
    FPS: "FPS",
    PLAY: "PLAY",
    CMD: "CMD",
    SRCH: "SRCH",
    FIX: "FIX",
    ID: "ID",
    ROLE: "ROLE",
    STAT: "STAT",
    STM: "ID",
    DSC: "STAFF",
    SAFE: "SAFE",
    RISK: "RISK",
    BAN: "BAN",
    APPEAL: "APPEAL",
    EVID: "EVID",
    SOON: "EVENT",
    BUG: "FIX",
    EAC: "SAFE",
    TIMEOUT: "CMD",
    TICKET: "STAFF"
  };

  const featureIcons = {
    GATHER: iconSvg(`
      <path d="M17 43l9-24 14 6 7 18-15 6z"></path>
      <path d="M26 19l-8 24 14 6 8-24z"></path>
      <path d="M14 48l-5 6 9-1 3 6 4-8"></path>
      <path d="M45 45l4 8 7-4-7-5"></path>
    `),
    PVP: iconSvg(`
      <circle cx="32" cy="32" r="18"></circle>
      <circle cx="32" cy="32" r="6"></circle>
      <path d="M32 7v12M32 45v12M7 32h12M45 32h12"></path>
    `),
    KIT: iconSvg(`
      <path d="M13 22l19-9 19 9-19 9z"></path>
      <path d="M13 22v22l19 9 19-9V22"></path>
      <path d="M32 31v22M21 26v14M43 26v14"></path>
    `),
    TP: iconSvg(`
      <path d="M32 9c-9 0-16 7-16 16 0 13 16 30 16 30s16-17 16-30c0-9-7-16-16-16z"></path>
      <circle cx="32" cy="25" r="6"></circle>
      <path d="M15 53c4 4 30 4 34 0"></path>
    `),
    CLAN: iconSvg(`
      <circle cx="32" cy="20" r="7"></circle>
      <circle cx="17" cy="27" r="6"></circle>
      <circle cx="47" cy="27" r="6"></circle>
      <path d="M20 51c1-10 7-16 12-16s11 6 12 16"></path>
      <path d="M7 50c1-8 5-13 10-13M57 50c-1-8-5-13-10-13"></path>
    `),
    SKIN: iconSvg(`
      <path d="M14 20h36v28H14z"></path>
      <path d="M20 14h24l6 6H14z"></path>
      <path d="M23 28h18M23 36h10M42 33l6 6"></path>
    `),
    PACK: iconSvg(`
      <path d="M20 22h24c5 0 8 4 8 9v21H12V31c0-5 3-9 8-9z"></path>
      <path d="M24 22v-5c0-4 3-7 8-7s8 3 8 7v5"></path>
      <path d="M23 34h18v13H23zM12 34H6v12h6M52 34h6v12h-6"></path>
    `),
    RAID: iconSvg(`
      <path d="M32 8l6 15 16-6-8 15 12 10-18 1-8 13-8-13-18-1 12-10-8-15 16 6z"></path>
      <path d="M24 36l-10 12M40 36l10 12"></path>
    `),
    STAFF: iconSvg(`
      <path d="M14 36v-6c0-10 8-18 18-18s18 8 18 18v6"></path>
      <path d="M14 36h8v15h-8zM42 36h8v15h-8z"></path>
      <path d="M42 52c-3 3-7 4-12 4h-4"></path>
    `),
    MINI: iconSvg(`
      <path d="M20 34h22l8 8H15z"></path>
      <path d="M32 16v18M12 16h40M23 49h18M25 42l-4 9M39 42l4 9"></path>
    `),
    SHOP: iconSvg(`
      <path d="M11 17h8l5 24h24l5-16H22"></path>
      <circle cx="28" cy="51" r="4"></circle>
      <circle cx="45" cy="51" r="4"></circle>
      <path d="M26 31h22"></path>
    `),
    EVENT: iconSvg(`
      <path d="M32 8v12M32 44v12M8 32h12M44 32h12"></path>
      <path d="M18 18l8 8M46 18l-8 8M18 46l8-8M46 46l-8-8"></path>
      <circle cx="32" cy="32" r="7"></circle>
    `),
    FPS: iconSvg(`
      <path d="M14 45a20 20 0 1 1 36 0"></path>
      <path d="M32 38l12-15M20 45h24"></path>
      <path d="M19 34h5M40 34h5M32 18v5"></path>
    `),
    PLAY: iconSvg(`<path d="M22 14l28 18-28 18z"></path>`),
    CMD: iconSvg(`<path d="M12 16h40v32H12z"></path><path d="M20 27l7 5-7 5M32 38h12"></path>`),
    SRCH: iconSvg(`<circle cx="28" cy="28" r="14"></circle><path d="M39 39l12 12"></path>`),
    FIX: iconSvg(`<path d="M42 12l10 10-26 26-13 4 4-13z"></path><path d="M35 19l10 10"></path>`),
    ID: iconSvg(`<path d="M12 18h40v28H12z"></path><circle cx="25" cy="32" r="6"></circle><path d="M35 27h10M35 34h10M20 42c2-4 8-4 10 0"></path>`),
    ROLE: iconSvg(`<path d="M32 10l18 8v13c0 12-8 19-18 23-10-4-18-11-18-23V18z"></path><path d="M23 32l6 6 13-14"></path>`),
    STAT: iconSvg(`<path d="M14 50V34M26 50V24M38 50V30M50 50V16"></path><path d="M10 50h46"></path>`),
    SAFE: iconSvg(`<path d="M32 10l18 8v13c0 12-8 19-18 23-10-4-18-11-18-23V18z"></path><path d="M24 32l6 6 11-13"></path>`),
    RISK: iconSvg(`<path d="M32 10l22 40H10z"></path><path d="M32 24v13M32 45h.01"></path>`),
    BAN: iconSvg(`<circle cx="32" cy="32" r="20"></circle><path d="M18 46l28-28"></path>`),
    APPEAL: iconSvg(`<path d="M16 12h28l8 8v32H16z"></path><path d="M44 12v8h8M24 32h18M24 41h13"></path>`),
    EVID: iconSvg(`<path d="M14 16h36v34H14z"></path><path d="M21 25h22M21 34h22M21 43h12"></path>`)
  };

  const statusIcons = {
    players: iconSvg(`
      <circle cx="23" cy="25" r="7"></circle>
      <circle cx="42" cy="25" r="7"></circle>
      <path d="M11 51c1-10 6-17 12-17s11 7 12 17"></path>
      <path d="M29 51c1-10 6-17 13-17s11 7 12 17"></path>
    `),
    map: iconSvg(`
      <path d="M12 15l14-5 12 5 14-5v39l-14 5-12-5-14 5z"></path>
      <path d="M26 10v39M38 15v39"></path>
      <path d="M17 28l7-3 8 5 8-4 7 3"></path>
    `),
    wipe: iconSvg(`
      <path d="M15 16h34v36H15z"></path>
      <path d="M15 26h34M23 11v10M41 11v10"></path>
      <path d="M24 36h5M35 36h5M24 45h5M35 45h5"></path>
    `),
    cycle: iconSvg(`
      <path d="M47 22a18 18 0 0 0-31-4"></path>
      <path d="M47 12v10H37"></path>
      <path d="M17 42a18 18 0 0 0 31 4"></path>
      <path d="M17 52V42h10"></path>
    `),
    region: iconSvg(`
      <circle cx="32" cy="32" r="20"></circle>
      <path d="M12 32h40M32 12c7 7 10 14 10 20s-3 13-10 20M32 12c-7 7-10 14-10 20s3 13 10 20"></path>
    `),
    command: featureIcons.CMD
  };

  const actionIcons = {
    arrow: iconSvg(`<path d="M18 32h28"></path><path d="M34 18l14 14-14 14"></path>`),
    copy: iconSvg(`<path d="M22 18h24v30H22z"></path><path d="M16 26h-2v26h24v-2"></path>`),
    discord: iconSvg(`
      <path d="M20 24c8-5 16-5 24 0l3 22c-5 4-10 6-15 6s-10-2-15-6z"></path>
      <path d="M23 24l3-6M41 24l-3-6"></path>
      <circle cx="26" cy="36" r="2"></circle>
      <circle cx="38" cy="36" r="2"></circle>
      <path d="M28 44c3 2 5 2 8 0"></path>
    `)
  };

  const featureCards = [
    ["1000x", "1000x Gather", "Farm fast, gear fast, and spend more time fighting than waiting.", "Launch target"],
    ["PVP", "Battlefield PvP", "A high-rate battlefield tuned for counters, chaos, and quick returns.", "Launch target"],
    ["KIT", "Kits", "Fast starter and combat kits keep the pace moving after every death.", "Launch target"],
    ["TP", "Teleport / Homes", "Move between bases, fights, teammates, and rebuilds without dead time.", "Launch target"],
    ["CLAN", "Clans", "Build identity around teams, rivalries, and wipe-long wars.", "Planned"],
    ["SKIN", "Skinbox", "Keep bases and gear looking sharp without breaking the battlefield pace.", "Planned"],
    ["PACK", "Backpacks", "Extra carry capacity for raiders, builders, and loot runners.", "Launch target"],
    ["MINI", "Personal Mini", "Fast map movement for scouts, counters, and strike teams.", "Under review"],
    ["SHOP", "Shop", "High-rate convenience economy for supplies, movement, and recovery.", "Under review"],
    ["EVENT", "Custom Events", "Wipe fights, clan clashes, and staff-run chaos after launch.", "Planned"],
    ["STAFF", "Active Staff", "Clear support, bug response, and rule enforcement without over-policing PvP.", "Launch target"],
    ["FPS", "Performance Focused", "Lean systems and practical moderation built around stable wipe nights.", "Launch target"]
  ];

  const featureGroups = [
    {
      title: "Combat and Raiding",
      copy: "High-rate PvP, raid-focused progression, custom loot direction, and frequent resets keep each wipe violent and readable.",
      items: ["1000x gather", "Fast PvP", "Raid-focused economy", "Explosives availability", "Custom loot tables", "Frequent wipes"]
    },
    {
      title: "Movement and Convenience",
      copy: "The convenience layer removes the slow parts without removing the need to fight, defend, and counter.",
      items: ["Teleport", "Homes", "Backpacks", "Personal minicopter", "Instant craft", "Quick recycling"]
    },
    {
      title: "Community and Clans",
      copy: "Raidlands is built around recurring rivalries, Discord identity, support channels, and future clan pages.",
      items: ["Clans", "Team play", "Discord verification", "Events", "Staff support", "Wipe alerts"]
    },
    {
      title: "Trust and Performance",
      copy: "A battlefield server still needs clear enforcement, quick fixes, and a stable base for busy wipe nights.",
      items: ["Active admins", "Anti-cheat stance", "Bug patches", "Server performance", "Clear rules", "Appeal path"]
    }
  ];

  const roadMap = [
    ["Leaderboards", "Player and clan rankings for kills, raids, K/D, explosives, and wipe MVPs.", "Planned"],
    ["Player Profiles", "Linked Steam and Discord identity with stats, wipe history, and rewards.", "Planned"],
    ["Clan Rankings", "Clan pages, recruitment, rivalry records, and wipe archives.", "After launch"],
    ["Wipe Events", "Friday and Monday wipe events, staff battles, and community votes.", "In development"],
    ["VIP Kits", "Supporter perks may come later, without turning launch into a paywall.", "After launch"],
    ["Vote Rewards", "Voting loops for discovery, population growth, and player rewards.", "Planned"],
    ["Ban Appeals", "Structured appeal intake with Discord support as the first launch path.", "Planned"],
    ["Community Hub", "Patch notes, announcements, wipe winners, and support workflows.", "Planned"]
  ];

  const pageMeta = {
    home: {
      title: "Raidlands 1000x Rust",
      lede: "Twice-weekly apocalyptic battlefield wipes. Kit up, teleport, clan up, and raid without the grind."
    },
    play: {
      title: "Play Raidlands",
      lede: "Use Steam connect, copy the console command, or search Raidlands in Rust's modded browser."
    },
    features: {
      title: "Server Features",
      lede: "Everything points toward fast progression, constant raiding, predictable wipes, and a real community layer."
    },
    rules: {
      title: "Rules",
      lede: "Raidlands is a PvP battlefield. Raiding, counters, roofcamping, and revenge raids are part of the game. Cheating, exploits, and real-world threats are not."
    },
    discord: {
      title: "Raidlands Discord",
      lede: "Get wipe alerts, find teammates, report bugs, open tickets, appeal bans, and vote on what the server becomes next."
    },
    link: {
      title: "Link Account",
      lede: "Link once and keep your identity ready for wipe stats, future rewards, roles, and Raidlands profile systems."
    },
    support: {
      title: "Support",
      lede: "Connection help, ticket routing, bug reports, staff contact, and appeal direction for launch."
    },
    privacy: {
      title: "Privacy Policy",
      lede: "How Raidlands handles website, Steam, Discord, support, analytics, and future account data."
    },
    terms: {
      title: "Terms of Service",
      lede: "Server access, account linking, bans, rules, appeals, and future supporter systems."
    },
    leaderboard: {
      title: "Leaderboards",
      lede: "Future player and clan rankings for each wipe season."
    },
    store: {
      title: "Store",
      lede: "Raidlands is launching population-first. Supporter perks are planned for later."
    },
    events: {
      title: "Events",
      lede: "Future wipe fights, clan wars, staff events, and community chaos."
    },
    clans: {
      title: "Clans",
      lede: "Future clan pages, recruitment, rankings, and wipe history."
    },
    vote: {
      title: "Vote Rewards",
      lede: "Future voting loops for discovery, rewards, and community growth."
    },
    bans: {
      title: "Bans and Appeals",
      lede: "Ban policy, appeal direction, and future public ban tooling."
    },
    profile: {
      title: "Player Profile",
      lede: "Future linked profile page for Steam, Discord, wipe stats, and rewards."
    }
  };

  const pageViews = {
    home: renderHome,
    play: renderPlay,
    features: renderFeatures,
    rules: renderRules,
    discord: renderDiscord,
    link: renderLink,
    support: renderSupport,
    privacy: renderPrivacy,
    terms: renderTerms,
    leaderboard: () => renderFuture("leaderboard", [
      ["Kills", "Top killers and wipe MVP contenders."],
      ["Raids Won", "Base breaks, counters, and explosive pressure."],
      ["Clan Rankings", "Team-wide performance and wipe history."]
    ]),
    store: renderStore,
    events: () => renderFuture("events", [
      ["Wipe Fights", "Monday and Friday event hooks."],
      ["Clan Wars", "Scheduled rivalries and community brackets."],
      ["Community Votes", "Let active players steer the next event."]
    ]),
    clans: () => renderFuture("clans", [
      ["Recruitment", "Clan cards and member discovery."],
      ["Rivalries", "Wipe-long conflicts and archived wins."],
      ["Rankings", "Team stats when the data layer is live."]
    ]),
    vote: () => renderFuture("vote", [
      ["Vote Rewards", "Future rewards for server discovery loops."],
      ["Linked Identity", "Steam and Discord linking will keep rewards clean."],
      ["Growth", "Voting can help keep wipe nights populated."]
    ]),
    bans: renderBans,
    profile: () => renderFuture("profile", [
      ["Steam Identity", "SteamID64 backed ownership."],
      ["Discord Identity", "Community roles and support context."],
      ["Wipe History", "Stats, rewards, and season records after launch."]
    ])
  };

  function asset(path) {
    return `${basePath}assets/${path}`;
  }

  function route(path) {
    return path ? `${basePath}${path}/` : basePath;
  }

  function html(strings, ...values) {
    return strings.reduce((out, string, index) => out + string + (values[index] ?? ""), "");
  }

  function iconSvg(paths) {
    return html`
      <svg viewBox="0 0 64 64" focusable="false">
        ${paths}
      </svg>
    `;
  }

  function renderFeatureSymbol(icon) {
    const key = featureIconAliases[icon] || icon;
    const svg = featureIcons[key];

    if (svg) {
      return html`<span class="feature-symbol feature-symbol-svg" aria-hidden="true">${svg}</span>`;
    }

    return html`
      <span class="feature-symbol" aria-hidden="true">
        <span class="feature-symbol-label">${icon}</span>
      </span>
    `;
  }

  function init() {
    const render = pageViews[pageId] || pageViews.home;

    app.innerHTML = html`
      <div class="app-shell page-${pageId}">
        ${renderHeader()}
        <main id="main-content">
          ${render()}
        </main>
        ${renderFooter()}
        <div class="toast" role="status" aria-live="polite" data-toast></div>
      </div>
    `;

    bindNav();
    bindActions();
    initEffects();
    hydrateDates();
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);
  }

  function renderHeader() {
    return html`
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="${route("")}" aria-label="Raidlands home">
            <img src="${asset("media/raidlands-logo.webp")}" alt="Raidlands 1000x">
          </a>
          <nav class="nav-menu" id="site-menu" aria-label="Primary navigation">
            ${NAV.map(([id, path, label]) => html`
              <a class="nav-link ${id === pageId ? "is-active" : ""}" href="${route(path)}">${label}</a>
            `).join("")}
          </nav>
          <div class="header-actions">
            <a class="btn btn-primary" href="${CONFIG.steamConnectUrl}" data-track="join_server_clicked">
              Join Server
              <span class="btn-icon" aria-hidden="true">${actionIcons.arrow}</span>
            </a>
          </div>
          <button class="mobile-toggle" type="button" aria-expanded="false" aria-controls="site-menu" data-menu-toggle>
            <span aria-hidden="true"></span>
            <span class="sr-only">Open menu</span>
          </button>
        </div>
      </header>
    `;
  }

  function renderFooter() {
    const links = [...NAV, ["support", "support", "Support"], ["privacy", "privacy", "Privacy"], ["terms", "terms", "Terms"]];

    return html`
      <footer class="site-footer">
        <div class="footer-inner">
          <div>
            <img class="footer-logo" src="${asset("media/nav-logo.png")}" alt="Raidlands">
            <p class="footer-copy">1000x Rust warfare, built for nonstop raids. Raidlands is not affiliated with Facepunch Studios.</p>
          </div>
          <nav class="footer-nav" aria-label="Footer navigation">
            ${links.map(([, path, label]) => html`<a href="${route(path)}">${label}</a>`).join("")}
          </nav>
          <div class="button-row">
            <button class="btn btn-secondary" type="button" data-copy-command>
              Copy Connect
              <span class="btn-icon" aria-hidden="true">${actionIcons.copy}</span>
            </button>
            <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">
              Join Discord
              <span class="btn-icon" aria-hidden="true">${actionIcons.discord}</span>
            </a>
          </div>
        </div>
      </footer>
    `;
  }

  function renderHome() {
    return html`
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-layout">
            <div class="hero-copy">
              <img class="hero-brand-mark" src="${asset("media/raidlands-logo.webp")}" alt="">
              <h1>Raidlands 1000x</h1>
              <p class="hero-subtitle">${pageMeta.home.lede}</p>
              <div class="hero-actions">
                <a class="btn btn-primary" href="${CONFIG.steamConnectUrl}" data-track="join_server_clicked">
                  Join Server
                  <span class="btn-icon" aria-hidden="true">${actionIcons.arrow}</span>
                </a>
                <button class="btn btn-secondary" type="button" data-copy-command>
                  Copy Connect Command
                  <span class="btn-icon" aria-hidden="true">${actionIcons.copy}</span>
                </button>
                <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">
                  Join Discord
                  <span class="btn-icon" aria-hidden="true">${actionIcons.discord}</span>
                </a>
              </div>
            </div>
            ${renderStatusPanel()}
          </div>
          ${renderQuickFeatures()}
          ${renderWipeBar()}
        </div>
      </section>

      <section class="section">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Built for nonstop raids</p>
            <h2>Farm fast. Gear fast. Raid fast.</h2>
            <p class="section-lede">Raidlands removes the slow parts and keeps the war. Whether you play solo, with friends, or inside a full clan, every Monday and Friday wipe is a fresh battlefield.</p>
          </div>
          <div class="grid four">
            ${featureCards.slice(0, 8).map(renderFeatureCard).join("")}
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="section-inner split-panel">
          <div class="metal-panel">
            <p class="section-kicker">Wipe schedule</p>
            <h2>Wipes every Monday and Friday</h2>
            <p class="section-lede">The wasteland resets twice a week. New bases. New rivalries. New raids.</p>
            <div class="tag-row">
              <span class="tag">Last wipe: <span data-last-wipe>Loading</span></span>
              <span class="tag">Upcoming: <span data-next-wipe>Loading</span></span>
              <span class="tag">${CONFIG.wipe.time} ${CONFIG.wipe.timezone}</span>
            </div>
            ${renderWipeBar()}
            <div class="button-row">
              <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Get Wipe Alerts</a>
              <a class="btn btn-secondary" href="${route("play")}">Join Methods</a>
            </div>
          </div>
          <div class="image-panel wipe" role="img" aria-label="Raidlands wipe day artwork"></div>
        </div>
      </section>

      <section class="section">
        <div class="section-inner">
          <div class="section-header center">
            <p class="section-kicker">How to play</p>
            <h2>Three ways into the fight</h2>
          </div>
          <div class="grid three">
            ${renderJoinMethodCards()}
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="section-inner split-panel">
          <div class="metal-panel">
            <p class="section-kicker">Account linking</p>
            <h2>Keep your identity across wipes</h2>
            <p class="section-lede">Link Steam and Discord early so Raidlands can support future leaderboards, rewards, roles, support context, and profile identity.</p>
            <div class="grid two">
              ${renderAuthSummaryCard("steam")}
              ${renderAuthSummaryCard("discord")}
            </div>
          </div>
          <div class="metal-panel">
            <p class="section-kicker">Launch promise</p>
            <h2>Population first</h2>
            <p class="section-lede">VIP kits and supporter perks may come later, but the opening focus is simple: build the best 1000x battlefield community possible.</p>
            <div class="button-row">
              <a class="btn btn-primary" href="${route("play")}">Play Raidlands</a>
              <a class="btn btn-secondary" href="${route("store")}">Store Roadmap</a>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-inner split-panel">
          <div class="metal-panel">
            <p class="section-kicker">Discord community</p>
            <h2>Wipe pings, teams, support</h2>
            <p class="section-lede">Join Discord for wipe alerts, teammate finding, bug reports, ban appeals, feature votes, and launch announcements.</p>
            <div class="button-row">
              <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join the Raidlands Discord</a>
              <a class="btn btn-secondary" href="${route("link")}">Link Discord Account</a>
            </div>
          </div>
          <div class="image-panel discord" role="img" aria-label="Raidlands Discord banner"></div>
        </div>
      </section>

      <section class="section alt">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Coming soon</p>
            <h2>A server hub, not a dead landing page</h2>
            <p class="section-lede">These systems are scaffolded for later so the site can grow with the server without making launch feel paywalled.</p>
          </div>
          <div class="grid four">
            ${roadMap.map(renderRoadmapCard).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderPlay() {
    return html`
      ${renderPageHero("play", html`
        <button class="btn btn-secondary" type="button" data-copy-command>Copy Connect</button>
        <a class="btn btn-primary" href="${CONFIG.steamConnectUrl}" data-track="join_server_clicked">Launch Rust</a>
      `)}
      <section class="section">
        <div class="section-inner split-panel">
          ${renderStatusPanel()}
          <div class="metal-panel">
            <p class="section-kicker">Connection methods</p>
            <h2>Get in with a fallback ready</h2>
            <p class="section-lede">Direct connect is fastest. The console command is most reliable. Server browser search is the backup when protocols or overlays misbehave.</p>
            ${renderCommandBox()}
            <div class="button-row">
              <a class="btn btn-primary" href="${CONFIG.steamConnectUrl}" data-track="join_server_clicked">Launch Rust and Join</a>
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
          <div class="grid three">${renderJoinMethodCards()}</div>
        </div>
      </section>
      <section class="section">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Troubleshooting</p>
            <h2>Connection fixes</h2>
          </div>
          <div class="grid three">
            ${[
              ["Rust did not launch", "Copy the console command, open Rust manually, press F1, paste it, and press Enter."],
              ["Server does not appear", "Use the modded browser, search Raidlands, refresh the list, or direct connect through the console."],
              ["Connection timeout", "Restart Rust, verify EAC is running, check your network, then ask Discord support if it persists."],
              ["Wrong server selected", "Use the exact command from this site to avoid lookalike names."],
              ["EAC issue", "Restart Steam and Rust, then verify game files if EAC keeps failing."],
              ["Still stuck", "Join Discord and open a support ticket with your Steam name and the error text."]
            ].map(([title, copy]) => renderCard("FIX", title, copy)).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderFeatures() {
    return html`
      ${renderPageHero("features", html`
        <a class="btn btn-primary" href="${route("play")}">Join Raidlands</a>
        <button class="btn btn-secondary" type="button" data-copy-command>Copy Connect</button>
      `)}
      <section class="section">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Feature breakdown</p>
            <h2>Fast, convenient, and still dangerous</h2>
            <p class="section-lede">Raidlands is built for Rust players who already understand kits, teleporting, clans, wipe fights, and battlefield servers.</p>
          </div>
          <div class="grid three">
            ${featureCards.map(renderFeatureCard).join("")}
          </div>
        </div>
      </section>
      <section class="section alt">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Categories</p>
            <h2>What each system is for</h2>
          </div>
          <div class="grid two">
            ${featureGroups.map(group => html`
              <article class="metal-card">
                <h3>${group.title}</h3>
                <p class="card-copy">${group.copy}</p>
                <ul class="list-clean">
                  ${group.items.map(item => html`<li>${item}</li>`).join("")}
                </ul>
              </article>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderRules() {
    return html`
      ${renderPageHero("rules", html`
        <a class="btn btn-primary" href="${route("play")}">Play Now</a>
        <a class="btn btn-secondary" href="${route("bans")}">Appeals</a>
      `)}
      <section class="section">
        <div class="section-inner">
          <div class="grid two">
            ${renderRuleBlock("Server Rules", [
              "No cheating, scripting, exploiting, or ban evasion.",
              "No DDoS threats, doxxing, swatting, or real-world threats.",
              "No severe harassment, hate speech, or targeted abuse.",
              "No abusing bugs or intentionally crashing systems.",
              "No impersonating staff or pretending to represent Raidlands.",
              "No real-money trading unless Raidlands explicitly allows it later.",
              "Follow staff instructions during investigations.",
              "Respect group limits if any are added later."
            ])}
            ${renderRuleBlock("Gameplay Stance", [
              "Raidlands is a PvP battlefield.",
              "Raiding, counters, doorcamping, roofcamping, and revenge raids are normal Rust behavior.",
              "Staff will not punish ordinary PvP because someone lost gear.",
              "Cheating, exploits, and real-world threats are the line."
            ])}
            ${renderRuleBlock("Discord Rules", [
              "No spam or malicious links.",
              "No hate speech or targeted harassment.",
              "Use support channels correctly.",
              "Do not harass staff or demand private moderation details.",
              "Keep appeals and reports in the right channel."
            ])}
            ${renderRuleBlock("Enforcement", [
              "Warnings, kicks, temporary bans, permanent bans, Discord removal, and appeal restrictions may be used.",
              "Severity, intent, account history, and evidence all matter.",
              "Appeals start in Discord at launch."
            ])}
          </div>
        </div>
      </section>
    `;
  }

  function renderDiscord() {
    return html`
      ${renderPageHero("discord", html`
        <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join Discord</a>
        <a class="btn btn-secondary" href="${route("link")}">Link Discord</a>
      `)}
      <section class="section">
        <div class="section-inner split-panel">
          <div class="metal-panel">
            <p class="section-kicker">Community hub</p>
            <h2>Stay close to wipe night</h2>
            <p class="section-lede">Discord is the launch home for alerts, teammates, support, bug reports, feature votes, event announcements, and ban appeals.</p>
            <ul class="list-clean">
              <li>Get Monday and Friday wipe pings.</li>
              <li>Find teammates before the server resets.</li>
              <li>Report bugs with screenshots and repro steps.</li>
              <li>Open support tickets when connection issues block you.</li>
              <li>Vote on events, systems, and future server direction.</li>
            </ul>
            <div class="button-row">
              <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join the Raidlands Discord</a>
            </div>
          </div>
          <div class="image-panel discord" role="img" aria-label="Raidlands Discord server banner"></div>
        </div>
      </section>
    `;
  }

  function renderLink() {
    return html`
      ${renderPageHero("link", html`
        <button class="btn btn-steam" type="button" data-auth-provider="steam">Link Steam</button>
        <button class="btn btn-discord" type="button" data-auth-provider="discord">Link Discord</button>
      `)}
      <section class="section">
        <div class="section-inner">
          <div class="auth-grid">
            ${renderAuthCard("steam")}
            ${renderAuthCard("discord")}
          </div>
        </div>
      </section>
      <section class="section alt">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Account model</p>
            <h2>Ready for future systems</h2>
            <p class="section-lede">A Raidlands profile can store SteamID64, Discord ID, guild membership, roles, linked timestamps, and last login once the backend is attached.</p>
          </div>
          <div class="grid three">
            ${renderCard("ID", "Identity", "Reduce impersonation and keep one profile across wipes.")}
            ${renderCard("ROLE", "Discord Roles", "Prepare for member checks, event notices, and future role sync.")}
            ${renderCard("STAT", "Rewards and Stats", "Make leaderboards, profiles, and vote rewards possible later.")}
          </div>
        </div>
      </section>
    `;
  }

  function renderSupport() {
    return html`
      ${renderPageHero("support", html`
        <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Open Discord</a>
        <a class="btn btn-secondary" href="${route("play")}">Connection Help</a>
      `)}
      <section class="section">
        <div class="section-inner">
          <div class="grid three">
            ${renderCard("TICKET", "Support Tickets", "Use Discord support channels for connection issues, reports, and staff help at launch.")}
            ${renderCard("BUG", "Bug Reports", "Include screenshots, error text, Steam name, steps to reproduce, and when it happened.")}
            ${renderCard("APPEAL", "Ban Appeals", "Appeals start in Discord until the structured appeal route is connected.")}
            ${renderCard("EAC", "EAC Issues", "Restart Steam and Rust, verify files, then share the exact error in a ticket.")}
            ${renderCard("TIMEOUT", "Timeouts", "Try the console command first, then ask support if the server is online and reachable.")}
            ${renderCard("STAFF", "Staff Contact", "Keep moderation conversations in official channels so evidence stays organized.")}
          </div>
        </div>
      </section>
    `;
  }

  function renderPrivacy() {
    return html`
      ${renderPageHero("privacy", "")}
      <section class="section">
        <div class="section-inner legal-copy">
          <p>This policy is a launch-ready draft for the Raidlands website. Replace contact details, hosting details, and exact processors before public launch.</p>
          <h2>Data We May Collect</h2>
          <p>Raidlands may collect website usage events, connect button clicks, copied command events, Steam identity data, Discord identity data, support ticket details, and moderation records when those systems are enabled.</p>
          <h2>Steam and Discord Linking</h2>
          <p>Steam linking may store SteamID64, display name, avatar URL, and profile URL. Discord linking may store Discord ID, username, avatar URL, guild membership status, and linked timestamp.</p>
          <h2>Analytics</h2>
          <p>The website is prepared to track conversion events such as join clicks, copied commands, Discord joins, account link starts, and page views. Do not enable third-party analytics until the provider is named here.</p>
          <h2>Support and Moderation</h2>
          <p>Reports, appeals, and tickets may include account identifiers, messages, screenshots, timestamps, and staff decisions. These records help enforce server rules and handle appeals.</p>
          <h2>Contact</h2>
          <p>For launch, use the Raidlands Discord support channels until a dedicated contact address is published.</p>
        </div>
      </section>
    `;
  }

  function renderTerms() {
    return html`
      ${renderPageHero("terms", "")}
      <section class="section">
        <div class="section-inner legal-copy">
          <p>These terms are a practical launch draft. Review with the final server owner details, jurisdiction, and store provider terms before going public.</p>
          <h2>Server Access</h2>
          <p>Raidlands may change server configuration, maps, wipes, features, rules, or access at any time to protect server health and gameplay quality.</p>
          <h2>Rules and Enforcement</h2>
          <p>By playing Raidlands or using its Discord and website, you agree to follow server rules, Discord rules, and staff instructions. Enforcement can include warnings, kicks, temporary bans, permanent bans, Discord removal, or appeal restrictions.</p>
          <h2>Account Linking</h2>
          <p>Steam and Discord linking may be required for future rewards, profiles, statistics, events, roles, support, appeals, or store entitlements.</p>
          <h2>Supporter Perks</h2>
          <p>Raidlands is population-first at launch. Future supporter perks may change, rotate, or be removed if they harm server balance or community trust.</p>
          <h2>Facepunch Disclaimer</h2>
          <p>Raidlands is not affiliated with Facepunch Studios.</p>
        </div>
      </section>
    `;
  }

  function renderStore() {
    return html`
      ${renderPageHero("store", html`
        <a class="btn btn-primary" href="${route("play")}">Play Free</a>
        <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Get Updates</a>
      `)}
      <section class="section">
        <div class="section-inner split-panel">
          <div class="metal-panel">
            <p class="section-kicker">Launch stance</p>
            <h2>No launch paywall</h2>
            <p class="section-lede">All launch kits are open while Raidlands grows the population. Supporter perks may come later, but the first job is building the battlefield.</p>
            <div class="grid two">
              ${renderCard("SAFE", "Safer Perks", "Queue priority, cosmetic titles, Discord roles, profile badges, and convenience perks.")}
              ${renderCard("RISK", "Avoid Pay-to-Win", "Strong combat kits and huge raid packages should be handled carefully or avoided.")}
            </div>
          </div>
          <div class="image-panel" style="background-image: linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.65)), url('${asset("media/header-bg-rust-v2.png")}')" role="img" aria-label="Raidlands brand banner"></div>
        </div>
      </section>
    `;
  }

  function renderBans() {
    return html`
      ${renderPageHero("bans", html`
        <a class="btn btn-discord" href="${CONFIG.discordInviteUrl}" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Appeal in Discord</a>
        <a class="btn btn-secondary" href="${route("rules")}">Read Rules</a>
      `)}
      <section class="section">
        <div class="section-inner">
          <div class="grid three">
            ${renderCard("BAN", "Ban Policy", "Cheating, ban evasion, exploits, threats, doxxing, and severe harassment can lead to permanent bans.")}
            ${renderCard("APPEAL", "Appeal Path", "At launch, appeals are handled in Discord. A structured appeal form is planned later.")}
            ${renderCard("EVID", "Evidence", "Include your Steam name, SteamID64 if known, the ban reason, and any relevant context.")}
          </div>
        </div>
      </section>
    `;
  }

  function renderFuture(key, cards) {
    const meta = pageMeta[key];
    return html`
      ${renderPageHero(key, html`
        <a class="btn btn-primary" href="${route("play")}">Join Server</a>
        <a class="btn btn-secondary" href="${route("discord")}">Follow Updates</a>
      `)}
      <section class="section">
        <div class="section-inner">
          <div class="section-header">
            <p class="section-kicker">Planned system</p>
            <h2>${meta.title} are coming later</h2>
            <p class="section-lede">${meta.lede}</p>
          </div>
          <div class="grid three">
            ${cards.map(([title, copy]) => renderCard("SOON", title, copy)).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderPageHero(key, actions) {
    const meta = pageMeta[key] || pageMeta.home;
    return html`
      <section class="page-hero">
        <div class="page-hero-content">
          <img class="page-hero-logo" src="${asset("media/raidlands-logo.webp")}" alt="">
          <div class="page-hero-copy">
            <p class="eyebrow">${CONFIG.tagline}</p>
            <h1>${meta.title}</h1>
            <p class="page-lede">${meta.lede}</p>
          </div>
          ${actions ? html`<div class="button-row">${actions}</div>` : ""}
        </div>
      </section>
    `;
  }

  function renderStatusPanel() {
    return html`
      <aside class="status-panel" aria-label="Raidlands server status">
        <div class="status-head">
          <span class="online-light" aria-hidden="true"></span>
          <strong class="status-title">${CONFIG.serverOnline ? "Online" : "Offline"}</strong>
        </div>
        <ul class="status-list">
          <li class="status-row">
            <span class="row-icon" aria-hidden="true">${statusIcons.players}</span>
            <span><span class="status-label">Players: <span class="status-value">${CONFIG.playersOnline}</span> / ${CONFIG.maxPlayers}</span></span>
          </li>
          <li class="status-row">
            <span class="row-icon" aria-hidden="true">${statusIcons.map}</span>
            <span><span class="status-label">Map: <span class="status-value">${CONFIG.mapName}</span></span></span>
          </li>
          <li class="status-row">
            <span class="row-icon" aria-hidden="true">${statusIcons.wipe}</span>
            <span><span class="status-label">Next Wipe: <span class="status-value" data-next-wipe>Loading</span></span></span>
          </li>
          <li class="status-row">
            <span class="row-icon" aria-hidden="true">${statusIcons.cycle}</span>
            <span><span class="status-label">Wipes: <span class="status-value">${CONFIG.wipe.dayNames.join(" and ")}</span></span></span>
          </li>
          <li class="status-row">
            <span class="row-icon" aria-hidden="true">${statusIcons.region}</span>
            <span><span class="status-label">Region: <span class="status-value">${CONFIG.region}</span></span></span>
          </li>
          <li class="status-row">
            <span class="row-icon" aria-hidden="true">${statusIcons.command}</span>
            <span><span class="status-label status-command">Console command: <span class="status-value">${CONFIG.connectCommand}</span></span></span>
          </li>
        </ul>
      </aside>
    `;
  }

  function renderQuickFeatures() {
    return html`
      <div class="quick-feature-wrap" aria-label="Raidlands core features">
        <div class="quick-feature-grid">
          ${quickFeatures.map(([icon, label]) => html`
            <div class="quick-feature">
              ${renderFeatureSymbol(icon)}
              <span>${label}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderWipeBar() {
    return html`
      <div class="wipe-bar">
        <div class="wipe-title">
          <span class="warning-mark" aria-hidden="true">!</span>
          <div>
            <h2>Next Wipe Incoming</h2>
            <p>Prepare. Raid. Repeat.</p>
          </div>
        </div>
        <div class="countdown" data-countdown>
          ${["Days", "Hours", "Minutes", "Seconds"].map(label => html`
            <div class="count-box">
              <strong data-count-${label.toLowerCase()}>00</strong>
              <span>${label}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderJoinMethodCards() {
    return [
      renderCard("PLAY", "Launch Rust and Join", "Use the Steam connect button for the fastest path into Raidlands.", html`
        <a class="btn btn-primary" href="${CONFIG.steamConnectUrl}" data-track="join_server_clicked">Launch Rust</a>
      `),
      renderCard("CMD", "Console Command", "Open Rust, press F1, paste the command, and press Enter.", renderCommandBox()),
      renderCard("SRCH", "Server Browser", "Open Rust's modded server browser and search Raidlands.", html`
        <a class="btn btn-secondary" href="${route("support")}">Need Help?</a>
      `)
    ].join("");
  }

  function renderFeatureCard([icon, title, copy, status]) {
    return renderCard(icon, title, copy, html`
      <div class="tag-row">
        <span class="status-tag ${statusClass(status)}">${status}</span>
      </div>
    `);
  }

  function renderCard(icon, title, copy, extra = "") {
    return html`
      <article class="metal-card">
        ${renderFeatureSymbol(icon)}
        <h3>${title}</h3>
        <p class="card-copy">${copy}</p>
        ${extra}
      </article>
    `;
  }

  function renderRoadmapCard([title, copy, status]) {
    return html`
      <article class="metal-card roadmap-card">
        <h3>${title}</h3>
        <p class="card-copy">${copy}</p>
        <div class="tag-row"><span class="status-tag planned">${status}</span></div>
      </article>
    `;
  }

  function renderRuleBlock(title, items) {
    return html`
      <article class="rule-block">
        <h3>${title}</h3>
        <ul class="list-clean">
          ${items.map(item => html`<li>${item}</li>`).join("")}
        </ul>
      </article>
    `;
  }

  function renderAuthSummaryCard(provider) {
    const label = provider === "steam" ? "Steam" : "Discord";
    const icon = provider === "steam" ? "STM" : "DSC";
    const copy = provider === "steam"
      ? "Prepare for SteamID64 backed profiles, leaderboards, rewards, and ownership."
      : "Prepare for wipe alerts, guild membership checks, support context, and roles.";

    return renderCard(icon, `Link ${label}`, copy, html`
      <button class="btn ${provider === "steam" ? "btn-steam" : "btn-discord"}" type="button" data-auth-provider="${provider}">Link ${label}</button>
    `);
  }

  function renderAuthCard(provider) {
    const label = provider === "steam" ? "Steam" : "Discord";
    const icon = provider === "steam" ? "STM" : "DSC";
    const benefits = provider === "steam"
      ? ["Prepare for leaderboards.", "Prepare for rewards.", "Connect profile identity.", "Reduce impersonation."]
      : ["Get wipe alerts.", "Verify community membership.", "Prepare for Discord roles.", "Access support context."];

    return html`
      <article class="metal-panel auth-card">
        ${renderFeatureSymbol(icon)}
        <h2>${label}</h2>
        <div class="auth-status">
          <strong>Not linked.</strong> OAuth is ready to connect once the ${label} credentials are configured.
        </div>
        <ul class="list-clean">
          ${benefits.map(benefit => html`<li>${benefit}</li>`).join("")}
        </ul>
        <div class="button-row">
          <button class="btn ${provider === "steam" ? "btn-steam" : "btn-discord"}" type="button" data-auth-provider="${provider}">Link ${label}</button>
          <button class="btn btn-ghost" type="button" data-unlink-provider="${provider}">Unlink</button>
        </div>
      </article>
    `;
  }

  function renderCommandBox() {
    return html`
      <div class="command-box">
        <code>${CONFIG.connectCommand}</code>
        <button class="btn btn-secondary copy-small" type="button" data-copy-command>Copy</button>
      </div>
    `;
  }

  function statusClass(status) {
    if (status === "Launch target") return "review";
    if (status === "Planned") return "planned";
    return "review";
  }

  function initEffects() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initCardGlareTiming(reducedMotion);
    initScrollReveals(reducedMotion);

    if (!reducedMotion) {
      queueEmberField();
    }
  }

  function initCardGlareTiming(reducedMotion) {
    if (reducedMotion) return;

    app.querySelectorAll(".metal-card, .metal-panel, .route-card").forEach(panel => {
      const duration = randomBetween(10.5, 18.5);
      panel.style.setProperty("--surface-glare-duration", `${duration.toFixed(2)}s`);
      panel.style.setProperty("--surface-glare-delay", `${randomBetween(-duration, 0).toFixed(2)}s`);
      panel.style.setProperty("--surface-glare-opacity", randomBetween(.24, .44).toFixed(2));
    });
  }

  function queueEmberField() {
    const start = () => createEmberField();

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 1200 });
      return;
    }

    window.setTimeout(start, 600);
  }

  function createEmberField() {
    const shell = app.querySelector(".app-shell");
    if (!shell || shell.querySelector(".ambient-effects")) return;

    const field = document.createElement("div");
    const particleCount = window.innerWidth < 640 ? 20 : 40;
    const particles = document.createDocumentFragment();

    field.className = "ambient-effects";
    field.setAttribute("aria-hidden", "true");

    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("span");
      const isAsh = index % 7 === 0;
      const size = isAsh ? randomBetween(1.5, 3.5) : randomBetween(2, 6);
      const duration = isAsh ? randomBetween(22, 36) : randomBetween(16, 30);

      particle.className = `ember-particle ${isAsh ? "is-ash" : "is-spark"}`;
      particle.style.setProperty("--x", `${randomBetween(-4, 104).toFixed(2)}%`);
      particle.style.setProperty("--drift", `${randomBetween(-96, 96).toFixed(2)}px`);
      particle.style.setProperty("--size", `${size.toFixed(2)}px`);
      particle.style.setProperty("--duration", `${duration.toFixed(2)}s`);
      particle.style.setProperty("--delay", `${randomBetween(-duration, 0).toFixed(2)}s`);
      particle.style.setProperty("--opacity", randomBetween(.18, .56).toFixed(2));
      particle.style.setProperty("--blur", `${randomBetween(0, 1.4).toFixed(2)}px`);
      particle.style.setProperty("--pulse", `${randomBetween(2.2, 5.4).toFixed(2)}s`);
      particles.appendChild(particle);
    }

    field.appendChild(particles);
    shell.prepend(field);
  }

  function initScrollReveals(reducedMotion) {
    const revealGroups = [
      [".hero-copy, .page-hero-logo, .page-hero-copy", "reveal-left"],
      [".status-panel, .page-hero .button-row, .image-panel", "reveal-right"],
      [".section-header, .wipe-bar, .quick-feature-wrap, .metal-panel, .metal-card, .route-card, .rule-block, .steps li, .count-box, .footer-inner", "reveal-up"]
    ];
    const elements = [];
    const seen = new Set();

    revealGroups.forEach(([selector, direction]) => {
      app.querySelectorAll(selector).forEach((element, index) => {
        if (seen.has(element)) return;

        seen.add(element);
        element.classList.add("reveal-on-scroll", direction);
        element.style.setProperty("--reveal-delay", `${Math.min(index * 55, 360)}ms`);
        elements.push(element);
      });
    });

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach(element => element.classList.add("is-visible"));
      return;
    }

    doc.classList.add("motion-ready");

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -12% 0px",
      threshold: .12
    });

    window.requestAnimationFrame(() => {
      elements.forEach(element => observer.observe(element));
    });
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function bindNav() {
    const toggle = app.querySelector("[data-menu-toggle]");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  function bindActions() {
    app.querySelectorAll("[data-copy-command]").forEach(button => {
      button.addEventListener("click", async () => {
        const copied = await copyText(CONFIG.connectCommand);
        track("connect_command_copied");
        showToast(copied ? "Connect command copied." : `Copy blocked. Use: ${CONFIG.connectCommand}`);
      });
    });

    app.querySelectorAll("[data-track]").forEach(item => {
      item.addEventListener("click", () => track(item.dataset.track));
    });

    app.querySelectorAll("[data-auth-provider]").forEach(button => {
      button.addEventListener("click", () => {
        const provider = button.dataset.authProvider;
        const url = provider === "steam" ? CONFIG.auth.steamUrl : CONFIG.auth.discordUrl;
        track(`${provider}_link_started`);

        if (url) {
          window.location.href = url;
          return;
        }

        showToast(`${provider === "steam" ? "Steam" : "Discord"} OAuth credentials are not configured yet.`);
      });
    });

    app.querySelectorAll("[data-unlink-provider]").forEach(button => {
      button.addEventListener("click", () => {
        const provider = button.dataset.unlinkProvider;
        track(`${provider}_unlink_clicked`);
        showToast(`${provider === "steam" ? "Steam" : "Discord"} is not linked on this device.`);
      });
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the selection-based path.
    }

    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }

  function track(name) {
    try {
      const key = "raidlands_metrics";
      const events = JSON.parse(window.localStorage.getItem(key) || "[]");
      events.push({ name, at: new Date().toISOString(), page: pageId });
      window.localStorage.setItem(key, JSON.stringify(events.slice(-100)));
    } catch (error) {
      console.info("Raidlands metric:", name);
    }
  }

  function showToast(message) {
    const toast = app.querySelector("[data-toast]");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function hydrateDates() {
    const next = getNextWipeDate();
    const last = getPreviousWipeDate();
    const nextText = formatDate(next);
    const lastText = formatDate(last);

    app.querySelectorAll("[data-next-wipe]").forEach(item => {
      item.textContent = nextText;
    });

    app.querySelectorAll("[data-last-wipe]").forEach(item => {
      item.textContent = lastText;
    });
  }

  function updateCountdowns() {
    const next = getNextWipeDate();
    const now = new Date();
    const distance = Math.max(0, next.getTime() - now.getTime());
    const values = {
      days: Math.floor(distance / 86400000),
      hours: Math.floor((distance % 86400000) / 3600000),
      minutes: Math.floor((distance % 3600000) / 60000),
      seconds: Math.floor((distance % 60000) / 1000)
    };

    Object.entries(values).forEach(([key, value]) => {
      app.querySelectorAll(`[data-count-${key}]`).forEach(item => {
        item.textContent = String(value).padStart(2, "0");
      });
    });
  }

  function getNextWipeDate(now = new Date()) {
    const [hour, minute] = CONFIG.wipe.time.split(":").map(Number);

    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);

      if (CONFIG.wipe.days.includes(candidate.getDay()) && candidate > now) {
        return candidate;
      }
    }

    return new Date(now.getTime() + 86400000);
  }

  function getPreviousWipeDate(now = new Date()) {
    const [hour, minute] = CONFIG.wipe.time.split(":").map(Number);

    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() - offset);
      candidate.setHours(hour, minute, 0, 0);

      if (CONFIG.wipe.days.includes(candidate.getDay()) && candidate < now) {
        return candidate;
      }
    }

    return now;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  init();
})();
