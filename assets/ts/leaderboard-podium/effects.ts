import {
  DataTexture, DepthTexture, EquirectangularReflectionMapping, LinearFilter, LinearSRGBColorSpace, PMREMGenerator, Texture, UnsignedIntType,
  Vector2, WebGLRenderer, WebGLRenderTarget, type PerspectiveCamera, type Scene,
} from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { JUNKYARD_ATMOSPHERE, JUNKYARD_PODIUM_CENTERS_X } from "./scene-policy";

const VOLUMETRIC_FOG_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    cameraNear: { value: .05 }, cameraFar: { value: 60 },
    cameraProjectionMatrixInverse: { value: null }, cameraWorldMatrix: { value: null },
    fogTime: { value: 0 }, fogDensity: { value: JUNKYARD_ATMOSPHERE.volumetricDensity },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 cameraProjectionMatrixInverse;
    uniform mat4 cameraWorldMatrix;
    uniform float fogTime;
    uniform float fogDensity;
    varying vec2 vUv;

    float flowingNoise(vec3 point) {
      vec3 p = point * vec3(.48, .82, .48);
      float a = sin(p.x * 1.63 + sin(p.z * 1.17 + fogTime * .09) + p.y * 2.11);
      float b = sin(p.z * 2.03 - p.x * .57 - fogTime * .065) * .52;
      float c = sin(dot(p, vec3(.71, 2.37, 1.13)) + fogTime * .075) * .28;
      float d = sin(p.x * 3.21 + p.z * 2.73 - fogTime * .12) * .16;
      return .5 + .5 * (a + b + c + d) / 1.96;
    }

    float podiumFogInfluence(vec3 point) {
      float distanceToPodium = min(
        length(point.xz - vec2(${JUNKYARD_PODIUM_CENTERS_X[0]}, 0.0)),
        min(
          length(point.xz - vec2(${JUNKYARD_PODIUM_CENTERS_X[1].toFixed(1)}, 0.0)),
          length(point.xz - vec2(${JUNKYARD_PODIUM_CENTERS_X[2]}, 0.0))
        )
      );
      return 1.0 - smoothstep(${JUNKYARD_ATMOSPHERE.podiumInnerRadius.toFixed(1)}, ${JUNKYARD_ATMOSPHERE.podiumOuterRadius.toFixed(1)}, distanceToPodium);
    }

    vec3 worldPositionFromDepth(float depth) {
      vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = cameraProjectionMatrixInverse * clip;
      view /= max(view.w, .00001);
      return (cameraWorldMatrix * view).xyz;
    }

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);
      float depth = texture2D(tDepth, vUv).x;
      if (depth <= .00001) {
        gl_FragColor = sceneColor;
        return;
      }
      vec3 cameraPosition = cameraWorldMatrix[3].xyz;
      vec3 surfacePosition = worldPositionFromDepth(depth);
      vec3 ray = surfacePosition - cameraPosition;
      float rayLength = min(length(ray), 36.0);
      vec3 rayDirection = normalize(ray);
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      float integratedDensity = 0.0;
      const int STEPS = 14;
      for (int index = 0; index < STEPS; index++) {
        float distanceAlongRay = (float(index) + jitter) / float(STEPS) * rayLength;
        vec3 point = cameraPosition + rayDirection * distanceAlongRay;
        float horizontal = (1.0 - smoothstep(14.0, 17.0, abs(point.x)))
          * smoothstep(-17.0, -14.0, point.z) * (1.0 - smoothstep(4.3, 6.0, point.z));
        float groundEntry = smoothstep(-.12, .08, point.y);
        float mainBank = 1.0 - smoothstep(${JUNKYARD_ATMOSPHERE.fullBankHeight.toFixed(2)}, ${JUNKYARD_ATMOSPHERE.bankFadeHeight.toFixed(2)}, point.y);
        float highWisps = (1.0 - smoothstep(${JUNKYARD_ATMOSPHERE.wispStartHeight.toFixed(2)}, ${JUNKYARD_ATMOSPHERE.wispFadeHeight.toFixed(1)}, point.y))
          * ${JUNKYARD_ATMOSPHERE.wispStrength.toFixed(2)};
        float vertical = groundEntry * max(mainBank, highWisps);
        float noiseValue = smoothstep(.27, .82, flowingNoise(point));
        float podiumBoost = podiumFogInfluence(point);
        integratedDensity += horizontal * vertical * (.12 + noiseValue * .88) * (.62 + podiumBoost * 1.25);
      }
      float stepLength = rayLength / float(STEPS);
      float fogAmount = min(${JUNKYARD_ATMOSPHERE.volumetricOpacityCeiling.toFixed(2)}, 1.0 - exp(-integratedDensity * stepLength * .075 * fogDensity));
      vec3 fogColor = vec3(.30, .335, .325);
      gl_FragColor = vec4(mix(sceneColor.rgb, fogColor, fogAmount), sceneColor.a);
    }
  `,
};

export type PodiumEnvironment = { source: Texture; target: WebGLRenderTarget };

export type PodiumEffectsPipeline = {
  composer: EffectComposer;
  volumetricFogPass?: ShaderPass;
  ssaoPass?: SSAOPass;
  bloomPass: UnrealBloomPass;
};

export function buildPodiumEnvironment(renderer: WebGLRenderer, buffer: ArrayBuffer): PodiumEnvironment {
  const data = new RGBELoader().parse(buffer);
  const source = new DataTexture(data.data as unknown as BufferSource, data.width, data.height);
  source.type = data.type;
  source.colorSpace = LinearSRGBColorSpace;
  source.minFilter = LinearFilter;
  source.magFilter = LinearFilter;
  source.generateMipmaps = false;
  source.flipY = true;
  source.needsUpdate = true;
  source.mapping = EquirectangularReflectionMapping;
  const generator = new PMREMGenerator(renderer);
  generator.compileEquirectangularShader();
  const target = generator.fromEquirectangular(source);
  generator.dispose();
  return { source, target };
}

export function createPodiumEffects(input: {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  mobile: boolean;
  volumetric: boolean;
}): PodiumEffectsPipeline {
  const { renderer, scene, camera, width, height, mobile, volumetric } = input;
  const renderTarget = new WebGLRenderTarget(width, height, { depthBuffer: true });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.renderTarget1.depthTexture = new DepthTexture(width, height, UnsignedIntType);
  composer.renderTarget2.depthTexture = new DepthTexture(width, height, UnsignedIntType);
  composer.addPass(new RenderPass(scene, camera));

  let volumetricFogPass: ShaderPass | undefined;
  if (volumetric) {
    volumetricFogPass = new ShaderPass(VOLUMETRIC_FOG_SHADER);
    volumetricFogPass.uniforms.cameraNear.value = camera.near;
    volumetricFogPass.uniforms.cameraFar.value = camera.far;
    volumetricFogPass.uniforms.cameraProjectionMatrixInverse.value = camera.projectionMatrixInverse;
    volumetricFogPass.uniforms.cameraWorldMatrix.value = camera.matrixWorld;
    volumetricFogPass.enabled = false;
    composer.addPass(volumetricFogPass);
  }

  let ssaoPass: SSAOPass | undefined;
  if (!mobile) {
    ssaoPass = new SSAOPass(scene, camera, width, height);
    ssaoPass.kernelRadius = 5;
    ssaoPass.minDistance = .0005;
    ssaoPass.maxDistance = .045;
    ssaoPass.enabled = false;
    composer.addPass(ssaoPass);
  }

  const bloomPass = new UnrealBloomPass(new Vector2(width, height), .16, .65, 1.15);
  bloomPass.enabled = false;
  composer.addPass(bloomPass);
  return { composer, volumetricFogPass, ssaoPass, bloomPass };
}
