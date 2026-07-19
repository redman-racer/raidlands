import type { Leader } from "./policy";
import { leaderboardPodiumMetricValue } from "./policy";
import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh,
  MeshStandardMaterial, Object3D, PlaneGeometry, Shape, Texture, Vector2, Vector3,
} from "three";

export type SignageText = { rank: number; name: string; value: string; label: string };
export type SignageTransform = { position: [number, number, number]; scale: number; yaw: number; pitch: number };
export type IndustrialSignVariant = "category" | "winner" | "side";
export type IndustrialSignDetail = "desktop" | "mobile";
export type IndustrialSignConfig = {
  variant: IndustrialSignVariant;
  detail: IndustrialSignDetail;
  width: number;
  height: number;
  depth: number;
  texture: Texture;
  surface?: IndustrialSignSurfaceTextures;
};
export type IndustrialSignSurfaceTextures = { albedo: Texture; normal: Texture; arm: Texture };
export type IndustrialSignBuildResult = { root: Group; display: Mesh };

export const INDUSTRIAL_SIGN_PROFILES = {
  category: { width: 5.6, height: 1.35, depth: .30 },
  winner: { width: 2.72, height: .78, depth: .26 },
  side: { width: 2.28, height: .64, depth: .20 },
} as const;

export const CATEGORY_SIGN_TRANSFORM = {
  position: [0, 3.78, -6.35] as [number, number, number],
  width: 5.6,
  height: 1.35,
} as const;

export function playerSignageText(leader: Leader | undefined, rank: number, board: string, metric: string): SignageText {
  const isBot = board === "bots";
  const name = String(leader?.display_name || (leader ? (isBot ? "Raidlands Bot" : "Raidlands Player") : "Awaiting contender"));
  const [value, label] = leaderboardPodiumMetricValue(leader || {}, board, metric);
  return { rank, name, value, label };
}

export function fitSignageText(
  text: string,
  maxWidth: number,
  measure: (candidate: string, fontSize: number) => number,
  preferredSize = 54,
  minimumSize = 34,
): { text: string; fontSize: number } {
  const normalized = text.trim() || "Raidlands Player";
  for (let size = preferredSize; size >= minimumSize; size -= 2) {
    if (measure(normalized, size) <= maxWidth) return { text: normalized, fontSize: size };
  }
  let candidate = normalized;
  while (candidate.length > 1 && measure(`${candidate}…`, minimumSize) > maxWidth) candidate = candidate.slice(0, -1);
  return { text: `${candidate.trimEnd()}…`, fontSize: minimumSize };
}

export function playerSignageTransform(rank: number, mobile: boolean, podiumCenterX?: number): SignageTransform {
  const index = Math.max(0, Math.min(2, rank - 1));
  const fallbackX = [0, -4.2, 4.2][index];
  const positions: Array<[number, number, number]> = [
    [podiumCenterX ?? fallbackX, .20, 1.30],
    // Rank two's wider pedestal needs extra front clearance once the side sign
    // is yawed toward center; otherwise the drum breaks through the housing.
    [podiumCenterX ?? fallbackX, .28, 1.28],
    [podiumCenterX ?? fallbackX, .25, 1.13],
  ];
  const scales = mobile ? [1.12, .94, .90] : [1, .82, .77];
  const yaws = [0, .14, -.14];
  const pitches = [-.025, -.018, -.018];
  return { position: positions[index], scale: scales[index], yaw: yaws[index], pitch: pitches[index] };
}

export function industrialSignVariantForRank(rank: number): IndustrialSignVariant {
  return rank === 1 ? "winner" : "side";
}

export function industrialSignDetail(mobile: boolean): IndustrialSignDetail {
  return mobile ? "mobile" : "desktop";
}

function armorShape(width: number, height: number, clip: number): Shape {
  const x = width / 2; const y = height / 2; const shape = new Shape();
  shape.moveTo(-x + clip, y); shape.lineTo(x - clip, y); shape.lineTo(x, y - clip);
  shape.lineTo(x, -y + clip); shape.lineTo(x - clip, -y); shape.lineTo(-x + clip, -y);
  shape.lineTo(-x, -y + clip); shape.lineTo(-x, y - clip); shape.closePath();
  return shape;
}

function armorGeometry(width: number, height: number, depth: number, clip: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(armorShape(width, height, clip), {
    depth, bevelEnabled: true, bevelSegments: 1, bevelSize: Math.min(.035, depth * .16),
    bevelThickness: Math.min(.025, depth * .12), curveSegments: 1,
  });
  geometry.center(); geometry.computeVertexNormals(); return geometry;
}

function setSignShadows(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Mesh; if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
  });
}

/** Builds a self-contained, rank-aware industrial housing around a live display texture. */
export function buildIndustrialSign(config: IndustrialSignConfig): IndustrialSignBuildResult {
  const { width, height, depth, variant, detail, texture, surface } = config;
  const root = new Group(); root.name = `IndustrialSign_${variant}`;
  const category = variant === "category"; const winner = variant === "winner"; const desktop = detail === "desktop";
  // Oxidized, soot-coated steel should catch broad highlights without mirroring the HDR arena.
  const pbrMaps = surface ? {
    map: surface.albedo, normalMap: surface.normal, normalScale: new Vector2(.72, .72),
    aoMap: surface.arm, aoMapIntensity: .8, roughnessMap: surface.arm, metalnessMap: surface.arm,
  } : {};
  const shell = new MeshStandardMaterial({ color: 0x8e8278, metalness: .48, roughness: .86, ...pbrMaps });
  const trim = new MeshStandardMaterial({ color: 0x9a664b, metalness: .52, roughness: .76, ...pbrMaps });
  const rust = new MeshStandardMaterial({ color: 0x8b5234, metalness: .22, roughness: .92, ...pbrMaps });
  const recess = new MeshStandardMaterial({ color: 0x070706, metalness: .18, roughness: .96 });
  const fastener = new MeshStandardMaterial({ color: 0x6f6256, metalness: .72, roughness: .62 });
  const glow = new MeshStandardMaterial({ color: 0xff6a1b, emissive: 0xff4b0b, emissiveIntensity: 4.2, metalness: 0, roughness: .24 });
  const screenMaterial = new MeshStandardMaterial({
    map: texture, emissiveMap: texture, emissive: 0xfff4e8, emissiveIntensity: 1.28,
    metalness: .05, roughness: .64,
  });

  const shellWidth = width + (category ? .66 : winner ? .56 : .42);
  const shellHeight = height + (category ? .50 : winner ? .50 : .38);
  const body = new Mesh(armorGeometry(shellWidth, shellHeight, depth, category ? .18 : .12), shell);
  body.name = "ArmoredShell"; body.position.z = -depth * .30; root.add(body);
  const back = new Mesh(armorGeometry(shellWidth * .94, shellHeight * .90, depth * .48, category ? .15 : .1), recess);
  back.name = "RearArmor"; back.position.z = -depth * .87; root.add(back);

  const bezel = new Mesh(armorGeometry(width + .24, height + .23, depth * .30, .08), trim);
  bezel.name = "RaisedBezel"; bezel.position.z = depth * .38; root.add(bezel);
  const well = new Mesh(armorGeometry(width + .08, height + .08, depth * .18, .045), recess);
  well.name = "DisplayWell"; well.position.z = depth * .50; root.add(well);
  const display = new Mesh(new PlaneGeometry(width, height), screenMaterial);
  // Leave a deliberate air gap above the well; near-coplanar faces disappear at arena camera distances.
  display.name = "LiveDisplay"; display.position.z = depth * .82; display.castShadow = false; root.add(display);

  const railDepth = depth + .13; const railHeight = category ? .12 : .085;
  const topRail = new BoxGeometry(shellWidth * .91, railHeight, railDepth);
  for (const y of [-shellHeight / 2 + railHeight * .34, shellHeight / 2 - railHeight * .34]) {
    const rail = new Mesh(topRail, trim); rail.name = "ReinforcementRail"; rail.position.set(0, y, -.01); root.add(rail);
  }
  const sideRail = new BoxGeometry(category ? .14 : .11, shellHeight * .73, railDepth);
  for (const x of [-shellWidth / 2 + .08, shellWidth / 2 - .08]) {
    const rail = new Mesh(sideRail, rust); rail.name = "SideArmor"; rail.position.set(x, 0, 0); root.add(rail);
  }

  const boltCount = desktop ? (category ? 12 : 8) : 4;
  const bolts = new InstancedMesh(new CylinderGeometry(.035, .035, .026, 8), fastener, boltCount);
  bolts.name = "FrameBolts"; const matrix = new Matrix4(); const rotation = new Object3D(); rotation.rotation.x = Math.PI / 2;
  for (let index = 0; index < boltCount; index += 1) {
    const column = index % 2; const row = Math.floor(index / 2); const rows = boltCount / 2;
    const x = (column ? 1 : -1) * (shellWidth / 2 - .14);
    const y = rows === 1 ? 0 : shellHeight * (.39 - row * .78 / Math.max(1, rows - 1));
    matrix.compose(new Vector3(x, y, depth * .63), rotation.quaternion, new Vector3(1, 1, 1)); bolts.setMatrixAt(index, matrix);
  }
  root.add(bolts);

  const lightWidth = category ? 1.04 : winner ? .54 : .34;
  const lightY = -shellHeight / 2 + (category ? .12 : .105);
  const lightXs = category ? [-width * .34, width * .34] : winner ? [-width * .28, width * .28] : [0];
  lightXs.forEach((x, index) => {
    const housing = new Mesh(new BoxGeometry(lightWidth + .16, .13, depth + .10), recess);
    housing.name = `LightHousing${index + 1}`; housing.position.set(x, lightY, depth * .20); root.add(housing);
    const lens = new Mesh(new BoxGeometry(lightWidth, .045, .035), glow);
    lens.name = `EmissiveLens${index + 1}`; lens.position.set(x, lightY, depth * .76); lens.castShadow = false; lens.receiveShadow = false; root.add(lens);
  });

  if (category) {
    for (const x of [-shellWidth / 2 - .10, shellWidth / 2 + .10]) {
      const mount = new Mesh(armorGeometry(.42, .52, depth + .06, .08), trim); mount.name = "CornerMount"; mount.position.set(x, 0, -.03); root.add(mount);
    }
    const upperBrace = new Mesh(new BoxGeometry(width * .62, .12, depth + .18), shell);
    upperBrace.name = "UpperBrace"; upperBrace.position.set(0, shellHeight / 2 + .10, -.05); root.add(upperBrace);
  } else {
    const lowerArmor = new Mesh(armorGeometry(shellWidth * (winner ? .82 : .68), .20, depth + .08, .055), rust);
    lowerArmor.name = "LowerArmor"; lowerArmor.position.set(0, -shellHeight / 2 - .075, -.02); root.add(lowerArmor);
    if (winner) {
      for (const x of [-shellWidth * .42, shellWidth * .42]) {
        const foot = new Mesh(armorGeometry(.36, .27, depth + .06, .06), shell); foot.name = "ConsoleFoot";
        foot.position.set(x, -shellHeight / 2 - .16, -.08); root.add(foot);
      }
    }
  }

  if (desktop) {
    const ventCount = category ? 9 : winner ? 6 : 4;
    const vents = new InstancedMesh(new BoxGeometry(.19, .035, .025), recess, ventCount); vents.name = "LowerVents";
    for (let index = 0; index < ventCount; index += 1) {
      const x = (index - (ventCount - 1) / 2) * .25;
      matrix.compose(new Vector3(x, shellHeight / 2 - .085, depth * .72), new Object3D().quaternion, new Vector3(1, 1, 1)); vents.setMatrixAt(index, matrix);
    }
    root.add(vents);
  }
  setSignShadows(root); display.castShadow = false; return { root, display };
}
