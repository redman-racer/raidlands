(function () {
  "use strict";

  var root = document.querySelector("[data-podium-profile]");
  if (!root) return;
  var form = root.querySelector("[data-podium-profile-form]");
  var host = root.querySelector("[data-leaderboard-podium]");
  var bundleNode = root.querySelector("[data-podium-profile-bundle]");
  if (!form || !host || !bundleNode) return;

  var bundle;
  try { bundle = JSON.parse(bundleNode.textContent || "{}"); } catch (error) { return; }
  var outfitSelect = form.querySelector("[data-podium-outfit-select]");
  var weaponSelect = form.querySelector("[data-podium-weapon-select]");
  var payloadNode = host.querySelector("[data-podium-payload]");
  var original;
  try { original = JSON.parse(payloadNode ? payloadNode.textContent || "{}" : "{}"); } catch (error) { original = {}; }

  function split(value) {
    var index = String(value || "").indexOf("|");
    return index < 0 ? [String(value || ""), ""] : [value.slice(0, index), value.slice(index + 1)];
  }

  function selectedOutfit(mode, key) {
    if (mode === "auto") return Object.assign({}, bundle.resolved || {});
    if (mode === "preset" && bundle.presets && bundle.presets[key]) {
      return { preset: key, label: bundle.presets[key].label, source: "manual", wearables: (bundle.presets[key].wearables || []).map(function (asset) { return { asset: asset, skin_id: "0" }; }) };
    }
    var captured = (bundle.captured_outfits || []).find(function (item) { return item.key === key; });
    return captured ? Object.assign({}, captured.appearance, { source: "manual" }) : Object.assign({}, bundle.resolved || {});
  }

  function selectedWeapon(mode, key) {
    if (mode === "none") return null;
    if (mode === "auto") return bundle.resolved ? bundle.resolved.weapon || null : null;
    var pair = key.split(":"); var shortname = pair[0]; var skin = pair[1] || "0";
    var item = bundle.weapons && bundle.weapons[shortname];
    return item ? { shortname: shortname, skin_id: skin, asset: item.asset, label: item.label, source: "manual" } : null;
  }

  function update() {
    var outfit = split(outfitSelect.value); var weapon = split(weaponSelect.value);
    form.querySelector("[data-podium-outfit-mode]").value = outfit[0];
    form.querySelector("[data-podium-outfit-key]").value = outfit[1];
    form.querySelector("[data-podium-weapon-mode]").value = weapon[0];
    form.querySelector("[data-podium-weapon-key]").value = weapon[1];
    var appearance = selectedOutfit(outfit[0], outfit[1]); appearance.weapon = selectedWeapon(weapon[0], weapon[1]);
    var leaders = Array.isArray(original.leaders) ? original.leaders.slice(0, 1) : [];
    if (leaders[0]) leaders[0] = Object.assign({}, leaders[0], { appearance: appearance });
    host.dispatchEvent(new CustomEvent("raidlands:podium-preview", { bubbles: true, detail: { board: "players", metric: "kills", leaders: leaders } }));
  }

  outfitSelect.addEventListener("change", update); weaponSelect.addEventListener("change", update);
})();
