import {
  BoxGeometry, ColorRepresentation, CylinderGeometry, ExtrudeGeometry, Group, InstancedMesh,
  LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, MeshStandardMaterialParameters, Object3D, Shape, Texture, Vector2,
  Vector3,
} from "three";

export type PedestalRank = 1 | 2 | 3;

export type PedestalTextureInputs = {
  weatheredSteel?: Texture;
  rustMask?: Texture;
  normal?: Texture;
  roughness?: Texture;
  grime?: Texture;
};

export type PedestalConfig = {
  rank: PedestalRank;
  horizontalScale: number;
  verticalScale: number;
  accent: ColorRepresentation;
  segments: number;
  textures?: PedestalTextureInputs;
};

export type PedestalBuildResult = {
  root: Group;
  standingHeight: number;
};

const BASE_STANDING_HEIGHT = 0.63;

export function pedestalConfigForRank(rank: PedestalRank, segments = 48): PedestalConfig {
  const variants: Record<PedestalRank, Omit<PedestalConfig, "rank" | "segments">> = {
    1: { horizontalScale: 1, verticalScale: 1, accent: 0x9a7440 },
    2: { horizontalScale: 0.84, verticalScale: 0.75, accent: 0x88918f },
    3: { horizontalScale: 0.79, verticalScale: 0.69, accent: 0x825038 },
  };
  return { rank, segments: Math.max(32, Math.min(64, Math.round(segments))), ...variants[rank] };
}

export function pedestalRanksForLayout(layout: string): PedestalRank[] {
  return layout === "single" ? [1] : [1, 2, 3];
}

function armorShape(width: number, height: number, clip: number): Shape {
  const x = width / 2; const y = height / 2; const shape = new Shape();
  shape.moveTo(-x + clip, y); shape.lineTo(x - clip, y); shape.lineTo(x, y - clip);
  shape.lineTo(x, -y + clip); shape.lineTo(x - clip, -y); shape.lineTo(-x + clip, -y);
  shape.lineTo(-x, -y + clip); shape.lineTo(-x, y - clip); shape.closePath();
  return shape;
}

function extruded(shape: Shape, depth: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 1 });
  geometry.computeVertexNormals();
  return geometry;
}

function addNumeral(parent: Group, rank: PedestalRank, material: MeshStandardMaterial) {
  const numeral = new Group(); numeral.name = `RankNumeral${rank}`;
  const thickness = 0.045;
  const bars: Record<PedestalRank, Array<[number, number, number, number, number]>> = {
    1: [[0, 0, 0.07, 0.30, 0], [-0.035, 0.12, 0.13, 0.055, -0.42], [0, -0.135, 0.18, 0.045, 0]],
    2: [[0, 0.135, 0.22, 0.05, 0], [0.085, 0.07, 0.05, 0.11, 0], [0, 0, 0.22, 0.05, 0], [-0.085, -0.07, 0.05, 0.11, 0], [0, -0.135, 0.22, 0.05, 0]],
    3: [[0, 0.135, 0.22, 0.05, 0], [0.085, 0.07, 0.05, 0.11, 0], [0, 0, 0.22, 0.05, 0], [0.085, -0.07, 0.05, 0.11, 0], [0, -0.135, 0.22, 0.05, 0]],
  };
  bars[rank].forEach(([x, y, width, height, rotation], index) => {
    const shape = new Shape(); shape.moveTo(-width / 2, -height / 2); shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2); shape.lineTo(-width / 2, height / 2); shape.closePath();
    const mesh = new Mesh(extruded(shape, thickness), material); mesh.name = `NumeralStroke${index + 1}`;
    mesh.position.set(x, y, 0); mesh.rotation.z = rotation; numeral.add(mesh);
  });
  parent.add(numeral);
}

function setShadows(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
  });
}

export function buildIndustrialPedestal(config: PedestalConfig): PedestalBuildResult {
  const root = new Group(); root.name = `PedestalRootRank${config.rank}`;
  const textures = config.textures || {};
  const steelMaps: MeshStandardMaterialParameters = {};
  if (textures.weatheredSteel) steelMaps.map = textures.weatheredSteel;
  if (textures.rustMask) steelMaps.metalnessMap = textures.rustMask;
  if (textures.normal) steelMaps.normalMap = textures.normal;
  if (textures.roughness) steelMaps.roughnessMap = textures.roughness;
  if (textures.grime) steelMaps.aoMap = textures.grime;
  const darkSteel = new MeshStandardMaterial({ color: 0x292826, metalness: 0.86, roughness: 0.64, ...steelMaps });
  const trim = new MeshStandardMaterial({ color: 0x4a4640, metalness: 0.9, roughness: 0.44, ...steelMaps });
  const recess = new MeshStandardMaterial({ color: 0x11100f, metalness: 0.65, roughness: 0.75 });
  const accent = new MeshStandardMaterial({ color: config.accent, metalness: 0.86, roughness: 0.43 });
  const glow = new MeshStandardMaterial({ color: 0x8f2608, emissive: 0xff5a16, emissiveIntensity: 3.2, metalness: 0, roughness: 0.3 });

  const footplate = new Group(); footplate.name = "BottomFootplate";
  const footProfile = [new Vector2(0, 0), new Vector2(1.19, 0), new Vector2(1.23, 0.025), new Vector2(1.23, 0.075), new Vector2(1.19, 0.10), new Vector2(0, 0.10)];
  const foot = new Mesh(new LatheGeometry(footProfile, config.segments), trim); foot.name = "FootplateBody"; footplate.add(foot);
  const bottomBand = new Mesh(new CylinderGeometry(1.205, 1.205, 0.035, config.segments), recess); bottomBand.name = "BottomRecessBand"; bottomBand.position.y = 0.035; footplate.add(bottomBand);
  const lip = new Mesh(new CylinderGeometry(1.205, 1.22, 0.025, config.segments), trim); lip.name = "BottomLip"; lip.position.y = 0.087; footplate.add(lip);
  root.add(footplate);

  const lowerRing = new Mesh(new CylinderGeometry(1.16, 1.16, 0.12, config.segments), trim); lowerRing.name = "LowerArmorRing"; lowerRing.position.y = 0.14; root.add(lowerRing);
  const drum = new Group(); drum.name = "MainDrum";
  const drumBody = new Mesh(new CylinderGeometry(1.02, 1.02, 0.31, config.segments), darkSteel); drumBody.name = "DrumBody"; drumBody.position.y = 0.32; drum.add(drumBody);
  [0.195, 0.445].forEach((y, index) => { const band = new Mesh(new CylinderGeometry(1.035, 1.035, 0.025, config.segments), recess); band.name = `HorizontalBand${index + 1}`; band.position.y = y; drum.add(band); });
  const separatorGeometry = new BoxGeometry(0.035, 0.26, 0.055); const separators = new InstancedMesh(separatorGeometry, recess, 12); separators.name = "VerticalSeparators";
  const matrix = new Matrix4(); const position = new Vector3(); const scale = new Vector3(1, 1, 1);
  for (let index = 0; index < 12; index++) { const angle = index / 12 * Math.PI * 2; const rotation = new Object3D(); rotation.rotation.y = angle; position.set(Math.sin(angle) * 1.04, 0.32, Math.cos(angle) * 1.04); matrix.compose(position, rotation.quaternion, scale); separators.setMatrixAt(index, matrix); }
  drum.add(separators); root.add(drum);

  const braces = new InstancedMesh(new BoxGeometry(0.20, 0.17, 0.34), trim, 6); braces.name = "SupportBraces";
  for (let index = 0; index < 6; index++) { const angle = index / 6 * Math.PI * 2; position.set(Math.sin(angle) * 1.04, 0.16, Math.cos(angle) * 1.04); const rotation = new Object3D(); rotation.rotation.set(-0.12, angle, 0); matrix.compose(position, rotation.quaternion, scale); braces.setMatrixAt(index, matrix); }
  footplate.add(braces);

  const upperRim = new Group(); upperRim.name = "UpperRim";
  const rimBody = new Mesh(new CylinderGeometry(1.12, 1.09, 0.12, config.segments), trim); rimBody.name = "RimBody"; rimBody.position.y = 0.50; upperRim.add(rimBody);
  const rimRecess = new Mesh(new CylinderGeometry(1.095, 1.095, 0.045, config.segments), recess); rimRecess.name = "RimRecess"; rimRecess.position.y = 0.465; upperRim.add(rimRecess);
  const rimTrim = new Mesh(new CylinderGeometry(1.08, 1.10, 0.035, config.segments), trim); rimTrim.name = "UpperTrim"; rimTrim.position.y = 0.565; upperRim.add(rimTrim);
  const housings = new InstancedMesh(new BoxGeometry(0.29, 0.075, 0.055), recess, 8); housings.name = "LightHousings";
  const lights = new InstancedMesh(new BoxGeometry(0.235, 0.032, 0.026), glow, 8); lights.name = "EmissiveLightStrips";
  for (let index = 0; index < 8; index++) { const angle = index / 8 * Math.PI * 2; const rotation = new Object3D(); rotation.rotation.y = angle; position.set(Math.sin(angle) * 1.105, 0.472, Math.cos(angle) * 1.105); matrix.compose(position, rotation.quaternion, scale); housings.setMatrixAt(index, matrix); position.set(Math.sin(angle) * 1.136, 0.472, Math.cos(angle) * 1.136); matrix.compose(position, rotation.quaternion, scale); lights.setMatrixAt(index, matrix); }
  upperRim.add(housings, lights); root.add(upperRim);

  const topDeck = new Group(); topDeck.name = "TopDeck";
  const deck = new Mesh(new CylinderGeometry(0.92, 0.94, 0.07, config.segments), darkSteel); deck.name = "StandingSurface"; deck.position.y = 0.595; topDeck.add(deck);
  const cap = new Mesh(new CylinderGeometry(0.45, 0.45, 0.015, config.segments), trim); cap.name = "TopCenterCap"; cap.position.y = 0.626; topDeck.add(cap);
  const seams = new InstancedMesh(new BoxGeometry(0.018, 0.009, 0.85), recess, 8); seams.name = "RadialSeams";
  for (let index = 0; index < 8; index++) { const angle = index / 8 * Math.PI * 2; const rotation = new Object3D(); rotation.rotation.y = angle; position.set(Math.sin(angle) * 0.47, 0.631, Math.cos(angle) * 0.47); matrix.compose(position, rotation.quaternion, scale); seams.setMatrixAt(index, matrix); }
  topDeck.add(seams); root.add(topDeck);

  const plate = new Group(); plate.name = "RankPlate"; plate.position.set(0, 0.34, 1.08);
  const frame = new Mesh(extruded(armorShape(0.62, 0.52, 0.07), 0.075), trim); frame.name = "OuterFrame"; plate.add(frame);
  const face = new Mesh(extruded(armorShape(0.49, 0.39, 0.045), 0.025), recess); face.name = "InnerPanel"; face.position.z = 0.076; plate.add(face);
  const bolts = new InstancedMesh(new CylinderGeometry(0.025, 0.025, 0.018, 8), accent, 4); bolts.name = "CornerBolts";
  [[-0.23, 0.18], [0.23, 0.18], [-0.23, -0.18], [0.23, -0.18]].forEach(([x, y], index) => { const rotation = new Object3D(); rotation.rotation.x = Math.PI / 2; matrix.compose(new Vector3(x, y, 0.112), rotation.quaternion, scale); bolts.setMatrixAt(index, matrix); }); plate.add(bolts);
  const numeralMount = new Group(); numeralMount.name = "RankNumeral"; numeralMount.position.z = 0.11; addNumeral(numeralMount, config.rank, accent); plate.add(numeralMount); root.add(plate);

  const anchor = new Object3D(); anchor.name = "CharacterAnchor"; anchor.position.y = BASE_STANDING_HEIGHT; root.add(anchor);
  root.scale.set(config.horizontalScale, config.verticalScale, config.horizontalScale);
  setShadows(root);
  lights.castShadow = false; lights.receiveShadow = false;
  return { root, standingHeight: BASE_STANDING_HEIGHT * config.verticalScale };
}
