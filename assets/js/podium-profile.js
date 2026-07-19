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
  var poseSelect = form.querySelector("[data-podium-pose-select]");
  var payloadNode = host.querySelector("[data-podium-payload]");
  var original;
  try { original = JSON.parse(payloadNode ? payloadNode.textContent || "{}" : "{}"); } catch (error) { original = {}; }
  if (!outfitSelect || !weaponSelect || !poseSelect) return;
  var editor = form.querySelector("[data-podium-pose-editor]");
  var modeToggle = host.querySelector("[data-podium-mode-toggle]");
  var workingBones = {};

  function setInteractionMode(mode) {
    var poseMode = mode === "pose";
    host.dataset.interactionMode = poseMode ? "pose" : "spin";
    if (modeToggle) {
      modeToggle.setAttribute("aria-pressed", poseMode ? "true" : "false");
      var label = modeToggle.querySelector("[data-podium-mode-label]");
      var detail = modeToggle.querySelector("small");
      if (label) label.textContent = poseMode ? "Edit pose" : "Spin character";
      if (detail) detail.textContent = poseMode ? "Switch to character spin" : "Switch to pose editing";
    }
    host.dispatchEvent(new CustomEvent("raidlands:podium-interaction-mode", { bubbles: true, detail: { mode: poseMode ? "pose" : "spin" } }));
  }

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

  function selectedPose(key) {
    var pose = bundle.poses && bundle.poses[key];
    return pose ? { key: key, label: pose.label, bones: JSON.parse(JSON.stringify(pose.bones || {})) } : { key: "default", label: "Raidlands Default", bones: {} };
  }

  function update(poseOverride) {
    var outfit = split(outfitSelect.value); var weapon = split(weaponSelect.value);
    form.querySelector("[data-podium-outfit-mode]").value = outfit[0];
    form.querySelector("[data-podium-outfit-key]").value = outfit[1];
    form.querySelector("[data-podium-weapon-mode]").value = weapon[0];
    form.querySelector("[data-podium-weapon-key]").value = weapon[1];
    form.querySelector("[data-podium-pose-key]").value = poseSelect.value;
    var appearance = selectedOutfit(outfit[0], outfit[1]); appearance.weapon = selectedWeapon(weapon[0], weapon[1]);
    appearance.pose = poseOverride || selectedPose(poseSelect.value);
    var leaders = Array.isArray(original.leaders) ? original.leaders.slice(0, 1) : [];
    if (leaders[0]) leaders[0] = Object.assign({}, leaders[0], { appearance: appearance });
    host.dispatchEvent(new CustomEvent("raidlands:podium-preview", { bubbles: true, detail: { board: "players", metric: "kills", leaders: leaders } }));
  }

  function cloneSelectedBones() {
    workingBones = selectedPose(poseSelect.value).bones;
  }

  function editorPose() {
    return { key: "preview", label: "Unsaved preview", bones: workingBones };
  }

  function previewBones() {
    host.dispatchEvent(new CustomEvent("raidlands:podium-pose-change", { bubbles: true, detail: { bones: workingBones } }));
  }

  function refreshBoneControls() {
    if (!editor) return;
    var bone = editor.querySelector("[data-pose-bone]").value;
    var rotation = workingBones[bone] || { x: 0, y: 0, z: 0 };
    editor.querySelectorAll("[data-pose-axis]").forEach(function (input) {
      var axis = input.getAttribute("data-pose-axis");
      var degrees = Math.round((Number(rotation[axis]) || 0) * 180 / Math.PI);
      input.value = String(degrees);
      var output = editor.querySelector('[data-pose-output="' + axis + '"]');
      if (output) output.textContent = degrees + "°";
    });
  }

  outfitSelect.addEventListener("change", function () { update(editor ? editorPose() : null); });
  weaponSelect.addEventListener("change", function () { update(editor ? editorPose() : null); });
  poseSelect.addEventListener("change", function () { cloneSelectedBones(); refreshBoneControls(); update(); });

  if (modeToggle) {
    modeToggle.addEventListener("click", function () {
      setInteractionMode(host.dataset.interactionMode === "pose" ? "spin" : "pose");
    });
    setInteractionMode("spin");
  }

  if (editor) {
    cloneSelectedBones(); refreshBoneControls();
    var boneSelect = editor.querySelector("[data-pose-bone]");
    var status = editor.querySelector("[data-pose-status]");
    boneSelect.addEventListener("change", refreshBoneControls);
    editor.querySelectorAll("[data-pose-axis]").forEach(function (input) {
      input.addEventListener("input", function () {
        var bone = boneSelect.value; var axis = input.getAttribute("data-pose-axis");
        if (!workingBones[bone]) workingBones[bone] = { x: 0, y: 0, z: 0 };
        workingBones[bone][axis] = Number(input.value) * Math.PI / 180;
        var output = editor.querySelector('[data-pose-output="' + axis + '"]');
        if (output) output.textContent = input.value + "°";
        previewBones();
      });
    });
    editor.querySelector("[data-pose-reset]").addEventListener("click", function () {
      delete workingBones[boneSelect.value]; refreshBoneControls(); previewBones();
    });
    editor.querySelector("[data-pose-save]").addEventListener("click", async function () {
      var button = this; var name = editor.querySelector("[data-pose-name]").value.trim();
      button.disabled = true; status.textContent = "Saving pose…";
      try {
        var response = await fetch(root.dataset.poseApi, {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ csrf: form.querySelector('[name="csrf"]').value, label: name, bones: workingBones })
        });
        var result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "The pose could not be saved.");
        bundle.poses[result.pose.key] = result.pose;
        var option = document.createElement("option"); option.value = result.pose.key; option.textContent = result.pose.label; option.selected = true; poseSelect.append(option);
        editor.querySelector("[data-pose-name]").value = ""; status.textContent = "Pose saved. It is now available to every player.";
        cloneSelectedBones(); update();
      } catch (error) { status.textContent = error && error.message ? error.message : "The pose could not be saved."; }
      finally { button.disabled = false; }
    });
    host.addEventListener("raidlands:podium-bone-select", function (event) {
      var bone = event.detail && event.detail.bone;
      if (!bone || !boneSelect.querySelector('option[value="' + CSS.escape(bone) + '"]')) return;
      boneSelect.value = bone; refreshBoneControls();
      status.textContent = "Editing " + bone.replace(/_/g, " ") + ". Left-drag bends; right-drag rolls.";
    });
    host.addEventListener("raidlands:podium-bone-edit", function (event) {
      var detail = event.detail || {}; var bone = detail.bone; var rotation = detail.rotation;
      if (!bone || !rotation) return;
      workingBones[bone] = { x: Number(rotation.x) || 0, y: Number(rotation.y) || 0, z: Number(rotation.z) || 0 };
      boneSelect.value = bone; refreshBoneControls();
    });
  }
})();
