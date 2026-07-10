function f(e) {
  if (!Number.isFinite(e))
    throw new TypeError(`Canonical JSON cannot encode non-finite number ${String(e)}.`);
  const n = Math.round((e + Number.EPSILON) * 1e6) / 1e6;
  return Object.is(n, -0) ? 0 : n;
}
function De(e, n) {
  return e < n ? -1 : e > n ? 1 : 0;
}
function ie(e, n = "$root") {
  if (e === null || typeof e == "string" || typeof e == "boolean")
    return e;
  if (typeof e == "number")
    return f(e);
  if (Array.isArray(e))
    return e.map((t, o) => {
      if (t === void 0)
        throw new TypeError(`Canonical JSON cannot encode undefined at ${n}[${o}].`);
      return ie(t, `${n}[${o}]`);
    });
  if (typeof e == "object" && e !== null) {
    const t = e, o = {};
    for (const a of Object.keys(t).sort(De))
      t[a] !== void 0 && (o[a] = ie(t[a], `${n}.${a}`));
    return o;
  }
  throw new TypeError(`Canonical JSON cannot encode ${typeof e} at ${n}.`);
}
function ge(e) {
  return JSON.stringify(ie(e));
}
const F = 1e-9, Oe = Math.PI / 180, k = { x: 0, y: 1, z: 0 }, N = { x: 0, y: 0, z: 1 };
function E(e = 0, n = 0, t = 0) {
  return { x: e, y: n, z: t };
}
function A(e, n) {
  return E(e.x + n.x, e.y + n.y, e.z + n.z);
}
function L(e, n) {
  return E(e.x - n.x, e.y - n.y, e.z - n.z);
}
function b(e, n) {
  return E(e.x * n, e.y * n, e.z * n);
}
function _e(e, n) {
  return e.x * n.x + e.y * n.y + e.z * n.z;
}
function q(e, n) {
  return E(
    e.y * n.z - e.z * n.y,
    e.z * n.x - e.x * n.z,
    e.x * n.y - e.y * n.x
  );
}
function W(e) {
  return _e(e, e);
}
function Y(e, n = N) {
  const t = W(e);
  return t <= F ? e !== n ? Y(n, N) : { ...N } : b(e, 1 / Math.sqrt(t));
}
function Me(e, n, t) {
  return A(e, b(L(n, e), t));
}
function w(e) {
  return E(e.X, e.Y, e.Z);
}
function R(e = 0, n = 0, t = 0, o = 1) {
  return { x: e, y: n, z: t, w: o };
}
function se(e, n) {
  return e.x * n.x + e.y * n.y + e.z * n.z + e.w * n.w;
}
function pe(e) {
  return R(-e.x, -e.y, -e.z, -e.w);
}
function _(e) {
  const n = se(e, e);
  if (n <= F)
    return R();
  const t = 1 / Math.sqrt(n);
  return R(e.x * t, e.y * t, e.z * t, e.w * t);
}
function Z(e, n) {
  return R(
    e.w * n.x + e.x * n.w + e.y * n.z - e.z * n.y,
    e.w * n.y - e.x * n.z + e.y * n.w + e.z * n.x,
    e.w * n.z + e.x * n.y - e.y * n.x + e.z * n.w,
    e.w * n.w - e.x * n.x - e.y * n.y - e.z * n.z
  );
}
function ne(e, n) {
  const t = n * Oe * 0.5, o = Math.sin(t);
  return R(e.x * o, e.y * o, e.z * o, Math.cos(t));
}
function Ie(e, n, t) {
  const o = ne({ x: 1, y: 0, z: 0 }, e), a = ne({ x: 0, y: 1, z: 0 }, n), r = ne({ x: 0, y: 0, z: 1 }, t);
  return _(Z(Z(a, o), r));
}
function Ee(e, n, t, o, a, r, m, c, l) {
  const i = e + a + l;
  if (i > 0) {
    const d = Math.sqrt(i + 1) * 2;
    return _(R((c - r) / d, (t - m) / d, (o - n) / d, d / 4));
  }
  if (e > a && e > l) {
    const d = Math.sqrt(1 + e - a - l) * 2;
    return _(R(d / 4, (n + o) / d, (t + m) / d, (c - r) / d));
  }
  if (a > l) {
    const d = Math.sqrt(1 + a - e - l) * 2;
    return _(R((n + o) / d, d / 4, (r + c) / d, (t - m) / d));
  }
  const s = Math.sqrt(1 + l - e - a) * 2;
  return _(R((t + m) / s, (r + c) / s, s / 4, (o - n) / s));
}
function Re(e, n = k, t = N) {
  const o = Y(e, t);
  let a = q(n, o);
  if (W(a) <= F) {
    const m = Math.abs(o.y) > 0.999 ? N : k;
    a = q(m, o);
  }
  W(a) <= F && (a = q({ x: 1, y: 0, z: 0 }, o)), a = Y(a, { x: 1, y: 0, z: 0 });
  const r = Y(q(o, a), k);
  return Ee(
    a.x,
    r.x,
    o.x,
    a.y,
    r.y,
    o.y,
    a.z,
    r.z,
    o.z
  );
}
function tt(e, n) {
  const t = _(e), o = R(n.x, n.y, n.z, 0), a = R(-t.x, -t.y, -t.z, t.w), r = Z(Z(t, o), a);
  return E(r.x, r.y, r.z);
}
function nt(e) {
  return E(e.x, e.y, -e.z);
}
function ot(e) {
  return E(e.x, e.y, -e.z);
}
function at(e) {
  return _(R(-e.x, -e.y, e.z, e.w));
}
function rt(e) {
  return _(R(-e.x, -e.y, e.z, e.w));
}
function $e(e, n, t) {
  const o = _(e);
  let a = _(n), r = se(o, a);
  if (r < 0 && (a = pe(a), r = -r), r > 0.9995)
    return _(
      R(
        o.x + (a.x - o.x) * t,
        o.y + (a.y - o.y) * t,
        o.z + (a.z - o.z) * t,
        o.w + (a.w - o.w) * t
      )
    );
  const m = Math.acos(Math.min(1, Math.max(-1, r))), c = Math.sin(m), l = Math.sin((1 - t) * m) / c, i = Math.sin(t * m) / c;
  return _(
    R(
      o.x * l + a.x * i,
      o.y * l + a.y * i,
      o.z * l + a.z * i,
      o.w * l + a.w * i
    )
  );
}
function Ce(e, n) {
  if (n <= e[0].Time)
    return 0;
  const t = e.length - 2;
  if (n >= e[e.length - 1].Time)
    return t;
  let o = 0, a = t;
  for (; o <= a; ) {
    const r = Math.floor((o + a) / 2), m = e[r].Time, c = e[r + 1].Time;
    if (n < m)
      a = r - 1;
    else if (n > c)
      o = r + 1;
    else
      return r;
  }
  return Math.max(0, Math.min(t, o));
}
function le(e, n) {
  const t = e.length - 1;
  if (n <= 0) {
    const a = e[1].Time - e[0].Time;
    return b(L(w(e[1]), w(e[0])), 1 / a);
  }
  if (n >= t) {
    const a = e[t].Time - e[t - 1].Time;
    return b(L(w(e[t]), w(e[t - 1])), 1 / a);
  }
  const o = e[n + 1].Time - e[n - 1].Time;
  return b(L(w(e[n + 1]), w(e[n - 1])), 1 / o);
}
function ze(e) {
  return e * e * (3 - 2 * e);
}
function Ae(e, n) {
  const t = e.Waypoints, o = Math.min(e.DurationSeconds, Math.max(0, n)), a = Ce(t, o), r = t[a], m = t[a + 1], c = m.Time - r.Time, l = c <= F ? 0 : (o - r.Time) / c, i = Math.min(1, Math.max(0, l)), s = w(r), d = w(m);
  let M, T, g = i;
  if (e.StopAtWaypoints) {
    g = ze(i), M = Me(s, d, g);
    const x = c <= F ? 0 : 6 * i * (1 - i) / c;
    T = b(L(d, s), x);
  } else {
    const x = le(t, a), C = le(t, a + 1), D = i * i, I = D * i;
    M = A(
      A(b(s, 2 * I - 3 * D + 1), b(x, (I - 2 * D + i) * c)),
      A(b(d, -2 * I + 3 * D), b(C, (I - D) * c))
    ), T = A(
      A(b(s, (6 * D - 6 * i) / c), b(x, 3 * D - 4 * i + 1)),
      A(b(d, (-6 * D + 6 * i) / c), b(C, 3 * D - 2 * i))
    );
  }
  if (W(T) <= F) {
    const x = a + (i >= 1 ? 1 : 0);
    if (x > 0 && x < t.length - 1) {
      const C = w(t[x - 1]), D = w(t[x + 1]);
      T = L(D, C);
    }
  }
  W(T) <= F && (T = L(d, s));
  const P = E(
    r.RotationX + (m.RotationX - r.RotationX) * g,
    r.RotationY + (m.RotationY - r.RotationY) * g,
    r.RotationZ + (m.RotationZ - r.RotationZ) * g
  ), O = Re(T, k, N), U = Ie(P.x, P.y, P.z), $ = _(Z(O, U));
  return { position: M, tangent: Y(T, N), rotation: $, euler: P };
}
function we(e) {
  const n = E(e.x, 0, e.z), t = Y(n, N), o = Y(q(k, t), { x: 1, y: 0, z: 0 });
  return { forward: t, right: o, rotation: Re(t, k, N) };
}
function it(e, n, t) {
  const o = we(t), a = A(
    n,
    A(b(o.right, e.X), A(b(k, e.Y), b(o.forward, e.Z)))
  ), r = R(e.Qx, e.Qy, e.Qz, e.Qw);
  return { position: a, rotation: _(Z(o.rotation, r)) };
}
function st(e, n) {
  const t = e.Frames, o = Math.min(e.DurationSeconds, Math.max(0, n));
  if (o <= t[0].Time)
    return { ...t[0] };
  const a = t.length - 1;
  if (o >= t[a].Time)
    return { ...t[a] };
  let r = 0, m = a - 1;
  for (; r <= m; ) {
    const g = Math.floor((r + m) / 2);
    if (t[g + 1].Time < o)
      r = g + 1;
    else if (t[g].Time > o)
      m = g - 1;
    else {
      r = g;
      break;
    }
  }
  const c = Math.min(a - 1, Math.max(0, r)), l = t[c], i = t[c + 1], s = i.Time - l.Time, d = s <= F ? 0 : (o - l.Time) / s, M = Me(E(l.X, l.Y, l.Z), E(i.X, i.Y, i.Z), d), T = $e(
    R(l.Qx, l.Qy, l.Qz, l.Qw),
    R(i.Qx, i.Qy, i.Qz, i.Qw),
    d
  );
  return {
    Time: o,
    X: M.x,
    Y: M.y,
    Z: M.z,
    Qx: T.x,
    Qy: T.y,
    Qz: T.z,
    Qw: T.w
  };
}
const G = 1, ve = 2, Fe = "raidlands-airanim-1", Ne = "unity-target-relative-local-v1", Ue = 30, Ve = [
  "drone",
  "cargo_plane",
  "f15",
  "a10",
  "attack_heli"
], de = [
  "bee_grenade",
  "bee_catapult_bomb",
  "beancan",
  "f1_grenade",
  "smoke",
  "flashbang",
  "he_40mm",
  "molotov",
  "firebomb",
  "propane_bomb",
  "hv_rocket",
  "rocket",
  "incendiary_rocket",
  "mortar_he_payload",
  "mortar_frag_payload",
  "bradley_longbarrel_burst",
  "homing_missile",
  "mlrs_rocket"
];
class ke extends Error {
  issues;
  constructor(n) {
    super(n.map((t) => `${t.path}: ${t.message}`).join(`
`)), this.name = "SourceValidationError", this.issues = n;
  }
}
const p = {
  Payload: "",
  Count: 1,
  CarrierOffsetX: 0,
  CarrierOffsetY: 0,
  CarrierOffsetZ: 0,
  TargetOffsetX: 0,
  TargetOffsetY: 0,
  TargetOffsetZ: 0,
  SpreadRadius: -1,
  LaunchSpeed: -1,
  FuseSeconds: -1,
  DamageScale: 1,
  VehicleDamageScale: -1,
  SplashRadius: -1,
  ImpactRadius: -1,
  MaxTrackingSeconds: -1,
  MaxTrackingDistance: -1,
  DamageScales: {}
}, ce = /^[a-z0-9][a-z0-9._-]{0,99}$/, oe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, Le = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, me = 120, ue = 256, fe = 80, X = 200;
function u(e, n, t, o) {
  e.push({ path: n, code: t, message: o });
}
function v(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function y(e, n, t, o, a) {
  return typeof e != "number" || !Number.isFinite(e) ? (u(t, n, "finite_number", "Must be a finite number."), !1) : (o !== void 0 && e < o && u(t, n, "minimum", `Must be at least ${o}.`), a !== void 0 && e > a && u(t, n, "maximum", `Must be at most ${a}.`), !0);
}
function J(e, n, t, o, a) {
  return y(e, n, t, o, a) ? (Number.isInteger(e) || u(t, n, "integer", "Must be an integer."), !0) : !1;
}
function ae(e, n, t, o) {
  if (!v(e)) {
    u(t, n, "object", "Must be an object.");
    return;
  }
  const a = e.Payload;
  if (typeof a != "string" || !o && !de.includes(a) ? u(t, `${n}.Payload`, "supported_payload", "Must be a supported payload identifier.") : a !== "" && !de.includes(a) && u(t, `${n}.Payload`, "supported_payload", "Must be empty or a supported payload identifier."), J(e.Count, `${n}.Count`, t, 1, X), y(e.CarrierOffsetX, `${n}.CarrierOffsetX`, t, -250, 250), y(e.CarrierOffsetY, `${n}.CarrierOffsetY`, t, -250, 250), y(e.CarrierOffsetZ, `${n}.CarrierOffsetZ`, t, -250, 250), y(e.TargetOffsetX, `${n}.TargetOffsetX`, t, -500, 500), y(e.TargetOffsetY, `${n}.TargetOffsetY`, t, -500, 500), y(e.TargetOffsetZ, `${n}.TargetOffsetZ`, t, -500, 500), y(e.SpreadRadius, `${n}.SpreadRadius`, t, -1, 250), y(e.LaunchSpeed, `${n}.LaunchSpeed`, t, -1, 350), y(e.FuseSeconds, `${n}.FuseSeconds`, t, -1, 120), y(e.DamageScale, `${n}.DamageScale`, t, 0, 10), y(e.VehicleDamageScale, `${n}.VehicleDamageScale`, t, -1, 10), y(e.SplashRadius, `${n}.SplashRadius`, t, -1, 100), y(e.ImpactRadius, `${n}.ImpactRadius`, t, -1, 100), y(e.MaxTrackingSeconds, `${n}.MaxTrackingSeconds`, t, -1, 120), y(e.MaxTrackingDistance, `${n}.MaxTrackingDistance`, t, -1, 2500), !v(e.DamageScales))
    u(t, `${n}.DamageScales`, "object", "Must be an object.");
  else
    for (const [r, m] of Object.entries(e.DamageScales))
      Le.test(r) || u(t, `${n}.DamageScales.${r}`, "safe_key", "Damage-scale key is not safe."), y(m, `${n}.DamageScales.${r}`, t, 0, 10);
}
function Ye(e, n, t, o, a) {
  if (!v(e)) {
    u(o, t, "object", "Must be an object.");
    return;
  }
  if (e.EditorSourceSchemaVersion !== G && u(o, `${t}.EditorSourceSchemaVersion`, "schema_version", "Must be editor source schema version 1."), typeof e.ProfileKey != "string" || !ce.test(e.ProfileKey) ? u(o, `${t}.ProfileKey`, "safe_profile_key", "Must match ^[a-z0-9][a-z0-9._-]{0,99}$.") : e.ProfileKey !== n && u(o, `${t}.ProfileKey`, "profile_key_mismatch", `Must equal containing profile key '${n}'.`), (typeof e.DisplayName != "string" || e.DisplayName.trim() === "" || e.DisplayName.length > 160) && u(o, `${t}.DisplayName`, "display_name", "Must be a non-empty string of at most 160 characters."), (typeof e.Vehicle != "string" || !Ve.includes(e.Vehicle)) && u(o, `${t}.Vehicle`, "supported_vehicle", "Must be a supported vehicle identifier."), y(e.DurationSeconds, `${t}.DurationSeconds`, o, 0.5, me), y(e.FirstPayloadDelaySeconds, `${t}.FirstPayloadDelaySeconds`, o, 0, me), y(e.RotationSmoothTimeSeconds, `${t}.RotationSmoothTimeSeconds`, o, 0.02, 2), y(e.MinimumTerrainClearance, `${t}.MinimumTerrainClearance`, o, 0, 250), typeof e.StopAtWaypoints != "boolean" && u(o, `${t}.StopAtWaypoints`, "boolean", "Must be boolean."), e.PositionInterpolation !== "time_hermite" && u(o, `${t}.PositionInterpolation`, "interpolation", "Only time_hermite is currently supported."), e.RotationMode !== "follow_path_plus_offset" && u(o, `${t}.RotationMode`, "rotation_mode", "Only follow_path_plus_offset is currently supported."), !Array.isArray(e.Waypoints))
    u(o, `${t}.Waypoints`, "array", "Must be an array.");
  else {
    (e.Waypoints.length < 2 || e.Waypoints.length > ue) && u(o, `${t}.Waypoints`, "waypoint_count", `Must contain between 2 and ${ue} waypoints.`);
    const m = /* @__PURE__ */ new Set();
    let c = -1 / 0;
    for (const [l, i] of e.Waypoints.entries()) {
      const s = `${t}.Waypoints[${l}]`;
      if (!v(i)) {
        u(o, s, "object", "Must be an object.");
        continue;
      }
      typeof i.Id != "string" || !oe.test(i.Id) ? u(o, `${s}.Id`, "stable_id", "Must be a safe stable waypoint ID.") : m.has(i.Id) ? u(o, `${s}.Id`, "duplicate_id", "Waypoint ID must be unique.") : m.add(i.Id), y(i.Time, `${s}.Time`, o, 0, Number(e.DurationSeconds)) && (l === 0 && Math.abs(i.Time) > 1e-6 && u(o, `${s}.Time`, "first_waypoint_zero", "First waypoint time must be zero."), i.Time <= c + 1e-6 && u(o, `${s}.Time`, "unique_sorted_time", "Waypoint times must be strictly increasing."), c = i.Time), y(i.X, `${s}.X`, o, -2e3, 2e3), y(i.Y, `${s}.Y`, o, -100, 1e3), y(i.Z, `${s}.Z`, o, -3e3, 3e3), y(i.RotationX, `${s}.RotationX`, o, -1e5, 1e5), y(i.RotationY, `${s}.RotationY`, o, -1e5, 1e5), y(i.RotationZ, `${s}.RotationZ`, o, -1e5, 1e5);
    }
  }
  if (!v(e.ReleaseSource)) {
    u(o, `${t}.ReleaseSource`, "object", "Must be an object.");
    return;
  }
  const r = e.ReleaseSource;
  if (r.Mode === "manual") {
    if (!Array.isArray(r.Events))
      u(o, `${t}.ReleaseSource.Events`, "array", "Must be an array.");
    else {
      r.Events.length > fe && u(o, `${t}.ReleaseSource.Events`, "event_count", `Must not exceed ${fe} source events.`), r.Events.length === 0 && r.LegacyDynamic !== !0 && u(o, `${t}.ReleaseSource.Events`, "empty_manual_schedule", "An empty manual schedule must be marked LegacyDynamic.");
      let m = 0, c = -1 / 0;
      const l = /* @__PURE__ */ new Set();
      for (const [i, s] of r.Events.entries()) {
        const d = `${t}.ReleaseSource.Events[${i}]`;
        ae(s, d, o, !1), v(s) && (typeof s.Id != "string" || !oe.test(s.Id) ? u(o, `${d}.Id`, "stable_id", "Must be a safe stable release-event ID.") : l.has(s.Id) ? u(o, `${d}.Id`, "duplicate_id", "Release-event ID must be unique.") : l.add(s.Id), y(s.Time, `${d}.Time`, o, 0, Number(e.DurationSeconds)) && (s.Time < c && u(o, `${d}.Time`, "sorted_time", "Manual release events must be sorted by time."), c = s.Time), typeof s.Count == "number" && Number.isFinite(s.Count) && (m += s.Count));
      }
      if (m > X && u(o, `${t}.ReleaseSource.Events`, "compiled_unit_count", `Materialized releases must not exceed ${X} units.`), r.Events.length > 0 && typeof e.FirstPayloadDelaySeconds == "number") {
        const i = Math.min(...r.Events.map((s) => Number(v(s) ? s.Time : 1 / 0)));
        Number.isFinite(i) && Math.abs(e.FirstPayloadDelaySeconds - i) > 1e-6 && u(o, `${t}.FirstPayloadDelaySeconds`, "first_release_sync", "Must equal the earliest manual release event time.");
      }
    }
    r.MaximumUnits !== void 0 && J(r.MaximumUnits, `${t}.ReleaseSource.MaximumUnits`, o, 0, X), r.FallbackIntervalSeconds !== void 0 && y(r.FallbackIntervalSeconds, `${t}.ReleaseSource.FallbackIntervalSeconds`, o, 0.01, 30), r.Template !== void 0 && ae(r.Template, `${t}.ReleaseSource.Template`, o, !0);
  } else if (r.Mode === "repeated") {
    if (y(r.StartTime, `${t}.ReleaseSource.StartTime`, o, 0, Number(e.DurationSeconds)), y(r.IntervalSeconds, `${t}.ReleaseSource.IntervalSeconds`, o, 0.01, 30), J(r.UnitsPerRelease, `${t}.ReleaseSource.UnitsPerRelease`, o, 1, X), J(
      r.MaximumUnits,
      `${t}.ReleaseSource.MaximumUnits`,
      o,
      r.LegacyDynamic === !0 ? 0 : 1,
      X
    ), ae(r.Template, `${t}.ReleaseSource.Template`, o, !1), !Array.isArray(r.HardpointSequence))
      u(o, `${t}.ReleaseSource.HardpointSequence`, "array", "Must be an array.");
    else {
      const m = Xe(e, a);
      r.HardpointSequence.forEach((c, l) => {
        typeof c != "string" || !oe.test(c) ? u(o, `${t}.ReleaseSource.HardpointSequence[${l}]`, "stable_id", "Must be a safe hardpoint ID.") : m.has(c) || u(o, `${t}.ReleaseSource.HardpointSequence[${l}]`, "unknown_hardpoint", `Unknown hardpoint '${c}'.`);
      });
    }
    typeof e.FirstPayloadDelaySeconds == "number" && typeof r.StartTime == "number" && Math.abs(e.FirstPayloadDelaySeconds - r.StartTime) > 1e-6 && u(o, `${t}.FirstPayloadDelaySeconds`, "first_release_sync", "Must equal repeated StartTime.");
  } else
    u(o, `${t}.ReleaseSource.Mode`, "release_mode", "Must be manual or repeated.");
}
function Xe(e, n) {
  const t = /* @__PURE__ */ new Set();
  for (const o of n?.vehicles?.[e.Vehicle]?.hardpoints ?? [])
    t.add(o.id);
  for (const o of e.EditorMetadata?.VehiclePreviewOverrides?.Hardpoints ?? [])
    t.add(o.Id);
  return t;
}
function Ze(e, n) {
  const t = [];
  if (!v(e))
    return [{ path: "$root", code: "object", message: "Source bundle must be an object." }];
  if (e.EditorSourceSchemaVersion !== G && u(t, "EditorSourceSchemaVersion", "schema_version", "Must be editor source schema version 1."), typeof e.AllowDangerousPayloadPreview != "boolean" && u(t, "AllowDangerousPayloadPreview", "boolean", "Must be boolean."), !v(e.Profiles))
    return u(t, "Profiles", "object", "Must be an object keyed by profile ID."), t;
  const o = Object.entries(e.Profiles);
  o.length > 500 && u(t, "Profiles", "profile_count", "Must not contain more than 500 profiles.");
  for (const [a, r] of o)
    ce.test(a) || u(t, `Profiles.${a}`, "safe_profile_key", "Profile map key is not safe."), Ye(r, a, `Profiles.${a}`, t, n);
  return t;
}
function He(e, n) {
  const t = Ze(e, n);
  if (t.length > 0)
    throw new ke(t);
}
function re(e) {
  return {
    Payload: e.Payload,
    Count: e.Count,
    CarrierOffsetX: e.CarrierOffsetX,
    CarrierOffsetY: e.CarrierOffsetY,
    CarrierOffsetZ: e.CarrierOffsetZ,
    TargetOffsetX: e.TargetOffsetX,
    TargetOffsetY: e.TargetOffsetY,
    TargetOffsetZ: e.TargetOffsetZ,
    SpreadRadius: e.SpreadRadius,
    LaunchSpeed: e.LaunchSpeed,
    FuseSeconds: e.FuseSeconds,
    DamageScale: e.DamageScale,
    VehicleDamageScale: e.VehicleDamageScale,
    SplashRadius: e.SplashRadius,
    ImpactRadius: e.ImpactRadius,
    MaxTrackingSeconds: e.MaxTrackingSeconds,
    MaxTrackingDistance: e.MaxTrackingDistance,
    DamageScales: { ...e.DamageScales }
  };
}
function je(e) {
  return e.ReleaseSource.Mode === "manual" ? e.ReleaseSource.Events.map((n, t) => ({ event: n, sourceIndex: t })).sort(
    (n, t) => n.event.Time - t.event.Time || n.sourceIndex - t.sourceIndex
  ) : [];
}
function V(e, n, t) {
  return {
    Time: f(n),
    Payload: e.Payload,
    Index: t,
    Count: e.Count,
    CarrierOffsetX: f(e.CarrierOffsetX),
    CarrierOffsetY: f(e.CarrierOffsetY),
    CarrierOffsetZ: f(e.CarrierOffsetZ),
    TargetOffsetX: f(e.TargetOffsetX),
    TargetOffsetY: f(e.TargetOffsetY),
    TargetOffsetZ: f(e.TargetOffsetZ),
    SpreadRadius: f(e.SpreadRadius),
    LaunchSpeed: f(e.LaunchSpeed),
    FuseSeconds: f(e.FuseSeconds),
    DamageScale: f(e.DamageScale),
    VehicleDamageScale: f(e.VehicleDamageScale),
    SplashRadius: f(e.SplashRadius),
    ImpactRadius: f(e.ImpactRadius),
    MaxTrackingSeconds: f(e.MaxTrackingSeconds),
    MaxTrackingDistance: f(e.MaxTrackingDistance),
    DamageScales: Object.fromEntries(
      Object.entries(e.DamageScales).sort(([o], [a]) => o < a ? -1 : o > a ? 1 : 0).map(([o, a]) => [o, f(a)])
    )
  };
}
function qe(e, n) {
  const t = /* @__PURE__ */ new Map();
  for (const o of n?.vehicles?.[e.Vehicle]?.hardpoints ?? [])
    t.set(o.id, { ...o });
  for (const o of e.EditorMetadata.VehiclePreviewOverrides.Hardpoints ?? [])
    t.set(o.Id, { id: o.Id, x: o.X, y: o.Y, z: o.Z });
  return t;
}
function We(e, n) {
  const t = e.ReleaseSource;
  if (t.Mode === "manual") {
    const i = je(e), s = re(t.Template ?? p), d = i.map(({ event: P }, O) => V(P, P.Time, O + 1));
    if (t.LegacyDynamic === !0 && t.Events.length === 0)
      return {
        legacyMode: "manual",
        legacyMaximumUnits: t.MaximumUnits ?? 0,
        legacyIntervalSeconds: t.FallbackIntervalSeconds ?? 0.5,
        legacyTemplate: V(s, 0, 0),
        legacyEvents: d,
        resolvedHardpointOffsets: {}
      };
    const M = t.MaximumUnits && t.MaximumUnits > 0 ? t.MaximumUnits : Number.POSITIVE_INFINITY, T = [];
    let g = 1;
    for (const { event: P } of i)
      for (let O = 0; O < P.Count && T.length < M; O += 1)
        T.push(V({ ...P, Count: 1 }, P.Time, g)), g += 1;
    return {
      legacyMode: "manual",
      legacyMaximumUnits: t.MaximumUnits ?? T.length,
      legacyIntervalSeconds: t.FallbackIntervalSeconds ?? 0.5,
      legacyTemplate: V(s, 0, 0),
      legacyEvents: d,
      compiledEvents: T,
      resolvedHardpointOffsets: {}
    };
  }
  const o = re(t.Template);
  o.Count = t.UnitsPerRelease;
  const a = qe(e, n), r = {};
  for (const i of t.HardpointSequence) {
    const s = a.get(i);
    s && (r[i] = { X: s.x, Y: s.y, Z: s.z });
  }
  if (t.LegacyDynamic === !0 && t.MaximumUnits === 0)
    return {
      legacyMode: "generated",
      legacyMaximumUnits: 0,
      legacyIntervalSeconds: t.IntervalSeconds,
      legacyTemplate: V(o, t.StartTime, 0),
      legacyEvents: [],
      resolvedHardpointOffsets: r
    };
  const m = [];
  let c = 0, l = 0;
  for (; c < t.MaximumUnits; ) {
    const i = t.StartTime + l * t.IntervalSeconds;
    if (i > e.DurationSeconds + 1e-9)
      break;
    const s = Math.min(t.UnitsPerRelease, t.MaximumUnits - c);
    for (let d = 0; d < s; d += 1) {
      const M = re(o);
      if (M.Count = 1, t.HardpointSequence.length > 0) {
        const T = t.HardpointSequence[c % t.HardpointSequence.length], g = a.get(T);
        M.CarrierOffsetX += g.x, M.CarrierOffsetY += g.y, M.CarrierOffsetZ += g.z;
      }
      m.push(V(M, i, c + 1)), c += 1;
    }
    l += 1;
  }
  return {
    legacyMode: "generated",
    legacyMaximumUnits: t.MaximumUnits,
    legacyIntervalSeconds: t.IntervalSeconds,
    legacyTemplate: V(o, t.StartTime, 0),
    legacyEvents: [],
    compiledEvents: m,
    resolvedHardpointOffsets: r
  };
}
const Qe = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function z(e, n) {
  return e >>> n | e << 32 - n;
}
function he(e) {
  const n = typeof e == "string" ? new TextEncoder().encode(e) : e, t = n.length * 8, o = Math.ceil((n.length + 9) / 64) * 64, a = new Uint8Array(o);
  a.set(n), a[n.length] = 128;
  const r = new DataView(a.buffer), m = Math.floor(t / 4294967296), c = t >>> 0;
  r.setUint32(o - 8, m, !1), r.setUint32(o - 4, c, !1);
  let l = 1779033703, i = 3144134277, s = 1013904242, d = 2773480762, M = 1359893119, T = 2600822924, g = 528734635, P = 1541459225;
  const O = new Uint32Array(64);
  for (let U = 0; U < a.length; U += 64) {
    for (let h = 0; h < 16; h += 1)
      O[h] = r.getUint32(U + h * 4, !1);
    for (let h = 16; h < 64; h += 1) {
      const H = O[h - 15], j = O[h - 2], B = z(H, 7) ^ z(H, 18) ^ H >>> 3, te = z(j, 17) ^ z(j, 19) ^ j >>> 10;
      O[h] = O[h - 16] + B + O[h - 7] + te >>> 0;
    }
    let $ = l, x = i, C = s, D = d, I = M, Q = T, K = g, ee = P;
    for (let h = 0; h < 64; h += 1) {
      const H = z(I, 6) ^ z(I, 11) ^ z(I, 25), j = I & Q ^ ~I & K, B = ee + H + j + Qe[h] + O[h] >>> 0, te = z($, 2) ^ z($, 13) ^ z($, 22), Pe = $ & x ^ $ & C ^ x & C, xe = te + Pe >>> 0;
      ee = K, K = Q, Q = I, I = D + B >>> 0, D = C, C = x, x = $, $ = B + xe >>> 0;
    }
    l = l + $ >>> 0, i = i + x >>> 0, s = s + C >>> 0, d = d + D >>> 0, M = M + I >>> 0, T = T + Q >>> 0, g = g + K >>> 0, P = P + ee >>> 0;
  }
  return [l, i, s, d, M, T, g, P].map((U) => U.toString(16).padStart(8, "0")).join("");
}
const Se = 6e3, ye = 20 * 1024 * 1024;
function Ke(e, n) {
  const t = e.ReleaseSource, o = t.Mode === "manual" ? {
    Mode: t.Mode,
    LegacyDynamic: t.LegacyDynamic === !0,
    MaximumUnits: t.MaximumUnits ?? null,
    FallbackIntervalSeconds: t.FallbackIntervalSeconds ?? null,
    Template: t.Template ?? null,
    Events: t.Events.map(({ Id: a, ...r }) => r)
  } : {
    Mode: t.Mode,
    LegacyDynamic: t.LegacyDynamic === !0,
    StartTime: t.StartTime,
    IntervalSeconds: t.IntervalSeconds,
    UnitsPerRelease: t.UnitsPerRelease,
    MaximumUnits: t.MaximumUnits,
    Template: t.Template,
    HardpointSequence: t.HardpointSequence,
    ResolvedHardpointOffsets: n
  };
  return {
    ProfileKey: e.ProfileKey,
    Vehicle: e.Vehicle,
    DurationSeconds: e.DurationSeconds,
    FirstPayloadDelaySeconds: e.FirstPayloadDelaySeconds,
    RotationSmoothTimeSeconds: e.RotationSmoothTimeSeconds,
    StopAtWaypoints: e.StopAtWaypoints,
    MinimumTerrainClearance: e.MinimumTerrainClearance,
    PositionInterpolation: e.PositionInterpolation,
    RotationMode: e.RotationMode,
    Waypoints: e.Waypoints.map(({ Id: a, ...r }) => r),
    ReleaseSource: o
  };
}
function Be(e, n) {
  const t = e.DurationSeconds, o = Math.floor(t * n + 1e-9), a = [];
  let r;
  const m = (c) => {
    const l = Ae(e, c);
    let i = l.rotation;
    r && se(r, i) < 0 && (i = pe(i)), r = i, a.push({
      Time: f(c),
      X: f(l.position.x),
      Y: f(l.position.y),
      Z: f(l.position.z),
      Qx: f(i.x),
      Qy: f(i.y),
      Qz: f(i.z),
      Qw: f(i.w)
    });
  };
  for (let c = 0; c <= o; c += 1) {
    const l = c / n;
    l <= t + 1e-9 && m(Math.min(l, t));
  }
  if (Math.abs(a[a.length - 1].Time - t) > 1e-6 ? m(t) : a[a.length - 1].Time = f(t), a.length > Se)
    throw new RangeError(`Compiled frame count ${a.length} exceeds ${Se}.`);
  return a;
}
function Je(e, n) {
  const t = We(e, n.vehicleMetadata), o = he(ge(Ke(e, t.resolvedHardpointOffsets))), a = Be(e, n.sampleRateHz), r = e.ReleaseSource.Mode === "manual" && e.ReleaseSource.Events.length > 0 ? Math.min(...e.ReleaseSource.Events.map((c) => c.Time)) : e.ReleaseSource.Mode === "repeated" ? e.ReleaseSource.StartTime : e.FirstPayloadDelaySeconds;
  return { profile: {
    Vehicle: e.Vehicle,
    DurationSeconds: f(e.DurationSeconds),
    FirstPayloadDelaySeconds: f(r),
    PayloadReleaseMode: t.legacyMode,
    MaxPayloadCount: t.legacyMaximumUnits,
    PayloadReleaseIntervalSeconds: f(t.legacyIntervalSeconds),
    ReleaseTemplate: t.legacyTemplate,
    RotationSmoothTimeSeconds: f(e.RotationSmoothTimeSeconds),
    StopAtWaypoints: e.StopAtWaypoints,
    MinimumTerrainClearance: f(e.MinimumTerrainClearance),
    Waypoints: e.Waypoints.map((c) => ({
      Time: f(c.Time),
      X: f(c.X),
      Y: f(c.Y),
      Z: f(c.Z),
      RotationX: f(c.RotationX),
      RotationY: f(c.RotationY),
      RotationZ: f(c.RotationZ)
    })),
    PayloadEvents: t.legacyEvents,
    CompiledTrack: {
      CompilerVersion: n.compilerVersion,
      SourceHash: o,
      CoordinateSystem: Ne,
      SampleRateHz: n.sampleRateHz,
      SampleIntervalSeconds: f(1 / n.sampleRateHz),
      DurationSeconds: f(e.DurationSeconds),
      Frames: a
    },
    ...t.compiledEvents === void 0 ? {} : { CompiledReleaseEvents: t.compiledEvents }
  }, sourceHash: o };
}
function ct(e, n) {
  He(e, n.vehicleMetadata);
  const t = n.compilerVersion ?? Fe, o = n.sampleRateHz ?? Ue;
  if (!Number.isInteger(n.publishedRevision) || n.publishedRevision < 1)
    throw new RangeError("publishedRevision must be a positive integer.");
  if (!Number.isFinite(o) || o <= 0 || o > 120)
    throw new RangeError("sampleRateHz must be finite and between 1 and 120.");
  const a = {}, r = {};
  for (const i of Object.keys(e.Profiles).sort()) {
    const s = Je(e.Profiles[i], {
      publishedRevision: n.publishedRevision,
      compilerVersion: t,
      sampleRateHz: o,
      vehicleMetadata: n.vehicleMetadata
    });
    a[i] = s.profile, r[i] = s.sourceHash;
  }
  const m = {
    SchemaVersion: ve,
    CompilerVersion: t,
    PublishedRevision: n.publishedRevision,
    AllowDangerousPayloadPreview: e.AllowDangerousPayloadPreview,
    Profiles: a
  }, c = ge(m), l = new TextEncoder().encode(c).length;
  if (l > ye)
    throw new RangeError(`Canonical runtime bundle is ${l} bytes; maximum is ${ye}.`);
  return { bundle: m, canonicalJson: c, sha256: he(c), sourceHashes: r };
}
function S(e, n) {
  return typeof e == "number" && Number.isFinite(e) ? e : n;
}
function be(e, n) {
  return typeof e == "number" && Number.isInteger(e) ? e : n;
}
function Te(e) {
  const n = e ?? {};
  return {
    Payload: typeof n.Payload == "string" ? n.Payload.trim().toLowerCase() : p.Payload,
    Count: Math.max(1, be(n.Count, p.Count)),
    CarrierOffsetX: S(n.CarrierOffsetX, p.CarrierOffsetX),
    CarrierOffsetY: S(n.CarrierOffsetY, p.CarrierOffsetY),
    CarrierOffsetZ: S(n.CarrierOffsetZ, p.CarrierOffsetZ),
    TargetOffsetX: S(n.TargetOffsetX, p.TargetOffsetX),
    TargetOffsetY: S(n.TargetOffsetY, p.TargetOffsetY),
    TargetOffsetZ: S(n.TargetOffsetZ, p.TargetOffsetZ),
    SpreadRadius: S(n.SpreadRadius, p.SpreadRadius),
    LaunchSpeed: S(n.LaunchSpeed, p.LaunchSpeed),
    FuseSeconds: S(n.FuseSeconds, p.FuseSeconds),
    DamageScale: S(n.DamageScale, p.DamageScale),
    VehicleDamageScale: S(n.VehicleDamageScale, p.VehicleDamageScale),
    SplashRadius: S(n.SplashRadius, p.SplashRadius),
    ImpactRadius: S(n.ImpactRadius, p.ImpactRadius),
    MaxTrackingSeconds: S(n.MaxTrackingSeconds, p.MaxTrackingSeconds),
    MaxTrackingDistance: S(n.MaxTrackingDistance, p.MaxTrackingDistance),
    DamageScales: n.DamageScales && typeof n.DamageScales == "object" && !Array.isArray(n.DamageScales) ? Object.fromEntries(
      Object.entries(n.DamageScales).filter((t) => Number.isFinite(t[1]))
    ) : {}
  };
}
function Ge(e) {
  return e.split(/[._-]+/).filter(Boolean).map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(" ");
}
function et(e, n) {
  const t = S(n.DurationSeconds, 8), a = (Array.isArray(n.PayloadEvents) ? n.PayloadEvents : []).map((s, d) => ({
    Id: `event_${String(d + 1).padStart(3, "0")}`,
    Time: S(s?.Time, 0),
    ...Te(s)
  })).sort((s, d) => s.Time - d.Time), r = S(n.FirstPayloadDelaySeconds, 3.5), m = a.length > 0 ? a[0].Time : r, c = Math.max(0, be(n.MaxPayloadCount, 0)), l = Te(n.ReleaseTemplate), i = String(n.PayloadReleaseMode ?? "manual").toLowerCase() === "generated";
  return {
    EditorSourceSchemaVersion: G,
    ProfileKey: e,
    DisplayName: Ge(e),
    Vehicle: typeof n.Vehicle == "string" ? n.Vehicle.trim().toLowerCase() : "f15",
    DurationSeconds: t,
    FirstPayloadDelaySeconds: i ? S(n.ReleaseTemplate?.Time, 0) > 0 ? S(n.ReleaseTemplate?.Time, r) : r : m,
    RotationSmoothTimeSeconds: S(n.RotationSmoothTimeSeconds, 0.12),
    StopAtWaypoints: n.StopAtWaypoints !== !1,
    MinimumTerrainClearance: S(n.MinimumTerrainClearance, n.Vehicle === "drone" ? 12 : 55),
    PositionInterpolation: "time_hermite",
    RotationMode: "follow_path_plus_offset",
    Waypoints: (Array.isArray(n.Waypoints) ? n.Waypoints : []).map((s, d) => ({
      Id: `waypoint_${String(d + 1).padStart(3, "0")}`,
      Time: S(s?.Time, d === 0 ? 0 : t),
      X: S(s?.X, 0),
      Y: S(s?.Y, 0),
      Z: S(s?.Z, 0),
      RotationX: S(s?.RotationX, 0),
      RotationY: S(s?.RotationY, 0),
      RotationZ: S(s?.RotationZ, 0)
    })),
    ReleaseSource: i ? {
      Mode: "repeated",
      StartTime: S(n.ReleaseTemplate?.Time, 0) > 0 ? S(n.ReleaseTemplate?.Time, r) : r,
      IntervalSeconds: S(n.PayloadReleaseIntervalSeconds, 0.5),
      UnitsPerRelease: l.Count,
      MaximumUnits: c,
      Template: l,
      HardpointSequence: [],
      ...c === 0 ? { LegacyDynamic: !0 } : {}
    } : {
      Mode: "manual",
      Events: a,
      MaximumUnits: c,
      FallbackIntervalSeconds: S(n.PayloadReleaseIntervalSeconds, 0.5),
      Template: l,
      ...a.length === 0 ? { LegacyDynamic: !0 } : {}
    },
    EditorMetadata: {
      Notes: "Imported from Rust VisualProfiles schema 1.",
      Tags: ["server-import"],
      VehiclePreviewOverrides: {}
    }
  };
}
function lt(e) {
  if (!e || typeof e != "object" || !e.Profiles || typeof e.Profiles != "object")
    throw new TypeError("Schema-1 VisualProfiles file must contain a Profiles object.");
  const n = {};
  for (const t of Object.keys(e.Profiles).sort()) {
    if (!ce.test(t))
      throw new TypeError(`Schema-1 profile key '${t}' is not safe.`);
    const o = e.Profiles[t];
    if (!o || typeof o != "object")
      throw new TypeError(`Schema-1 profile '${t}' must be an object.`);
    n[t] = et(t, o);
  }
  return {
    EditorSourceSchemaVersion: G,
    AllowDangerousPayloadPreview: e.AllowDangerousPayloadPreview === !0,
    Profiles: n
  };
}
export {
  Fe as DEFAULT_COMPILER_VERSION,
  p as DEFAULT_PAYLOAD_EVENT,
  Ue as DEFAULT_SAMPLE_RATE_HZ,
  G as EDITOR_SOURCE_SCHEMA_VERSION,
  ce as PROFILE_KEY_PATTERN,
  Ne as RUNTIME_COORDINATE_SYSTEM,
  ve as RUNTIME_SCHEMA_VERSION,
  de as SUPPORTED_PAYLOADS,
  Ve as SUPPORTED_VEHICLES,
  ke as SourceValidationError,
  A as add,
  He as assertValidSourceBundle,
  ge as canonicalJson,
  re as clonePayloadFields,
  We as compileReleaseSchedule,
  ct as compileSourceBundle,
  Je as compileSourceProfile,
  we as createWorldBasis,
  q as cross,
  _e as dot,
  st as evaluateCompiledTrack,
  Ae as evaluateSourcePose,
  lt as importSchema1Runtime,
  Me as lerpVector,
  it as localFrameToWorld,
  Re as lookRotation,
  W as magnitudeSquared,
  Z as multiplyQuaternion,
  pe as negateQuaternion,
  ie as normalizeCanonicalValue,
  _ as normalizeQuaternion,
  Y as normalizeVector,
  f as quantizeCanonicalNumber,
  R as quaternion,
  se as quaternionDot,
  tt as rotateVector,
  b as scale,
  he as sha256Hex,
  $e as slerpQuaternion,
  L as subtract,
  rt as threeQuaternionToUnity,
  ot as threeVectorToUnity,
  Ie as unityEulerQuaternion,
  at as unityQuaternionToThree,
  nt as unityVectorToThree,
  Ze as validateSourceBundle,
  E as vector,
  w as waypointPosition
};
//# sourceMappingURL=airstrike-animation-compiler.js.map
