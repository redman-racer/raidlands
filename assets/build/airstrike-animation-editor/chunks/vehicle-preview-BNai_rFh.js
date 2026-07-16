import{ah as Y,l as b,v as Q,ai as L,aj as T,o as c,V as d,J as X,ak as oo,b as S,S as F,n as l,s as R,al as eo,G as N,M as O,am as to,k as U,an as io,f as G,B as no,g as ao}from"./three.module-CEWrT8PT.js";import{G as lo}from"./GLTFLoader-D0ZIrkdQ.js";import{u as W}from"./coordinates-DLgoRkFr.js";const V=new Map,B=new Map;function H(o){return o.userData.preserveSharedAsset=!0,o}function Vo(o){return!!(o&&typeof o=="object"&&o.userData?.preserveSharedAsset===!0)}async function ro(o){let e=V.get(o);return e||(e=new Y().loadAsync(o).then(t=>H(t)),V.set(o,e)),e}function so(o,e){const t=B.get(o);if(t)return t;const n=H(e());return n.colorSpace=n.colorSpace||b,B.set(o,n),n}const co={low:{detail:"low",viewSamples:0,lightSamples:0,shadowOctaves:0,useVolumetricClouds:!1,useSpriteClouds:!0},medium:{detail:"medium",viewSamples:32,lightSamples:2,shadowOctaves:2,useVolumetricClouds:!0,useSpriteClouds:!1},max:{detail:"max",viewSamples:56,lightSamples:4,shadowOctaves:4,useVolumetricClouds:!0,useSpriteClouds:!1}};function uo(o,e="low"){return o==="low"||o==="medium"||o==="max"?o:e}function mo(o){return co[o]}function ho(o){const e=Number(o);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}const po={low:{detail:"low",shaderLevel:0,useAtmosphericDisc:!1,useCinematicOptics:!1,lightingResponse:0},medium:{detail:"medium",shaderLevel:1,useAtmosphericDisc:!0,useCinematicOptics:!1,lightingResponse:.55},max:{detail:"max",shaderLevel:2,useAtmosphericDisc:!0,useCinematicOptics:!0,lightingResponse:1}};function fo(o,e="low"){return o==="low"||o==="medium"||o==="max"?o:e}function vo(o){return po[o]}const M="raidlandsSkyDome";function Bo(o,e,t={}){e.toneMapping=Q,e.toneMappingExposure=t.exposure??1.08;const n=t.preset??"terrain",i=uo(t.cloudDetail,"low"),a=fo(t.sunDetail,"low"),s=Math.max(100,Number(t.worldSize)||4500),r=xo(n);r.mapping=L,r.colorSpace=b,r.needsUpdate=!0;const u=new T(e),D=u.fromEquirectangular(r).texture;u.dispose();const p=o.userData[M];p&&(o.remove(p),p.geometry.dispose(),p.material.dispose());const y=Co(n,i,a,s);o.add(y),o.userData[M]=y,o.background=new c(264210),o.backgroundIntensity=t.backgroundIntensity??(n==="editor"?.82:.96),o.environment=D,o.environmentIntensity=t.environmentIntensity??(n==="editor"?.72:.9),yo(o,{sunDirection:new d(.5,.78,.36).normalize(),sunColor:n==="editor"?new c(16761978):new c(16773583),sunIntensity:n==="editor"?1.78:1.58,cloudCoverage:n==="editor"?.24:.22,timeSeconds:0}),t.skyboxUrl&&ro(t.skyboxUrl).then(f=>{f.mapping=L,f.colorSpace=b,f.needsUpdate=!0;const C=new T(e),v=C.fromEquirectangular(f).texture;C.dispose(),o.background=f,o.environment=v},()=>{})}function yo(o,e){const t=o.userData[M],i=t?.material?.uniforms;if(!t||!i)return;e.cameraPosition&&t.position.copy(e.cameraPosition);const a=e.sunDirection.clone().normalize(),s=l.clamp(a.y,-.32,.92),r=l.smoothstep(s,-.08,.5),u=l.smoothstep(s,-.2,-.04)*(1-l.smoothstep(s,.3,.56)),D=e.cloudCoverage===null||e.cloudCoverage===void 0?0:Number(e.cloudCoverage),p=ho(D),y=l.clamp(m(e.cloudOpacity,1),0,1),f=p,C=l.clamp(m(e.atmosphereRayleigh,.25),0,4),v=l.clamp(m(e.atmosphereMie,1.55),0,4),w=l.clamp(m(e.atmosphereBrightness,.95),.05,3),A=l.clamp(m(e.atmosphereContrast,.65),.05,3),g=l.clamp(m(e.atmosphereDirectionality,.75),0,1),x=l.clamp(m(e.fogIntensity,0),0,1),I=l.clamp(m(e.rainIntensity,0),0,1),P=Number(e.sunIntensity),q=l.smoothstep(s,-.055,.018)*l.clamp((Number.isFinite(P)?P:0)/1.7,.18,1.2)*l.lerp(.72,1.28,g)*l.lerp(1,.54,Math.max(x*.65,I*.42)),k=e.sunColor.clone().lerp(new c(16761228),l.lerp(.38,.64,l.clamp(v/4,0,1))),Z=new c(462876).lerp(new c(7911142),r).lerp(new c(5327720),u*.32).lerp(new c(5208245),l.clamp(C/4,0,1)*r*.18).multiplyScalar(l.lerp(.72,1.18,w/1.4)),K=new c(1254195).lerp(new c(14151156),r).lerp(k,u*.22).lerp(new c(16757391),l.clamp(v/4,0,1)*u*.3).lerp(new c(15895416),u*l.clamp(v/4,0,1)*.08).multiplyScalar(l.lerp(.72,1.2,w/1.4)),J=new c(329740).lerp(new c(5991794),r).lerp(k,u*.22).multiplyScalar(l.lerp(.78,1.12,A/1.4));i.uZenithColor.value.copy(Z),i.uHorizonColor.value.copy(K),i.uGroundColor.value.copy(J),i.uSunColor.value.copy(e.sunColor),i.uSunDirection.value.copy(a),i.uDaylight.value=r,i.uCloudCoverage.value=f,i.uCloudPhase.value=Number(e.timeSeconds)||0,i.uSunVisibility.value=q,i.uCloudOpacity.value=y,i.uCloudSize.value=l.clamp(m(e.cloudSize,3.35),.2,8),i.uCloudColoring.value=l.clamp(m(e.cloudColoring,.65),0,1),i.uCloudSharpness.value=l.clamp(m(e.cloudSharpness,1),0,1),i.uCloudAttenuation.value=l.clamp(m(e.cloudAttenuation,.25),0,1),i.uCloudScattering.value=l.clamp(m(e.cloudScattering,.65),0,1),i.uCloudBrightness.value=l.clamp(m(e.cloudBrightness,.55),0,2),i.uAtmosphereRayleigh.value=C,i.uAtmosphereMie.value=v,i.uAtmosphereDirectionality.value=g,i.uRainbowIntensity.value=l.clamp(m(e.rainbowIntensity,0),0,1),i.uFogIntensity.value=x,i.uRainIntensity.value=I,i.uCameraPosition.value.copy(e.cameraPosition||t.position)}function m(o,e){const t=Number(o);return Number.isFinite(t)?t:e}function Co(o,e,t,n){const i=mo(e),a=vo(t),s=new X({defines:{RAIDLANDS_CLOUD_DETAIL:i.useVolumetricClouds?e==="max"?2:1:0,RAIDLANDS_CLOUD_VIEW_SAMPLES:Math.max(1,i.viewSamples),RAIDLANDS_CLOUD_LIGHT_SAMPLES:Math.max(1,i.lightSamples),RAIDLANDS_SUN_DETAIL:a.shaderLevel},uniforms:{uZenithColor:{value:new c(o==="editor"?1385786:7911142)},uHorizonColor:{value:new c(o==="editor"?8035241:14151156)},uGroundColor:{value:new c(o==="editor"?2168851:5991794)},uSunColor:{value:new c(o==="editor"?16761978:16773583)},uSunDirection:{value:new d(.5,.78,.36).normalize()},uDaylight:{value:1},uCloudCoverage:{value:o==="editor"?.24:.32},uCloudPhase:{value:0},uSunVisibility:{value:1},uCloudOpacity:{value:1},uCloudSize:{value:3.35},uCloudColoring:{value:.65},uCloudSharpness:{value:1},uCloudAttenuation:{value:.25},uCloudScattering:{value:.65},uCloudBrightness:{value:.55},uAtmosphereRayleigh:{value:.25},uAtmosphereMie:{value:1.55},uAtmosphereDirectionality:{value:.75},uRainbowIntensity:{value:0},uFogIntensity:{value:0},uRainIntensity:{value:0},uCameraPosition:{value:new d},uWorldSize:{value:n}},vertexShader:`
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      varying vec3 vDirection;

      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;
      uniform float uDaylight;
      uniform float uCloudCoverage;
      uniform float uCloudPhase;
      uniform float uSunVisibility;
      uniform float uCloudOpacity;
      uniform float uCloudSize;
      uniform float uCloudColoring;
      uniform float uCloudSharpness;
      uniform float uCloudAttenuation;
      uniform float uCloudScattering;
      uniform float uCloudBrightness;
      uniform float uAtmosphereRayleigh;
      uniform float uAtmosphereMie;
      uniform float uAtmosphereDirectionality;
      uniform float uRainbowIntensity;
      uniform float uFogIntensity;
      uniform float uRainIntensity;
      uniform vec3 uCameraPosition;
      uniform float uWorldSize;

      float hash(vec2 position) {
        return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 position) {
        vec2 cell = floor(position);
        vec2 local = fract(position);
        local = local * local * (3.0 - 2.0 * local);
        float lower = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x);
        float upper = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x);
        return mix(lower, upper, local.y);
      }

      float cloudNoise(vec2 position) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise(position) * amplitude;
          position = position * 2.03 + vec2(11.7, 4.3);
          amplitude *= 0.5;
        }
        return value;
      }

      float hash3(vec3 position) {
        return fract(sin(dot(position, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float noise3(vec3 position) {
        vec3 cell = floor(position);
        vec3 local = fract(position);
        local = local * local * (3.0 - 2.0 * local);
        float lowerA = mix(hash3(cell), hash3(cell + vec3(1.0, 0.0, 0.0)), local.x);
        float lowerB = mix(hash3(cell + vec3(0.0, 1.0, 0.0)), hash3(cell + vec3(1.0, 1.0, 0.0)), local.x);
        float upperA = mix(hash3(cell + vec3(0.0, 0.0, 1.0)), hash3(cell + vec3(1.0, 0.0, 1.0)), local.x);
        float upperB = mix(hash3(cell + vec3(0.0, 1.0, 1.0)), hash3(cell + vec3(1.0, 1.0, 1.0)), local.x);
        return mix(mix(lowerA, lowerB, local.y), mix(upperA, upperB, local.y), local.z);
      }

      float cloudVolumeNoise(vec3 position) {
        float value = noise3(position) * 0.56;
        value += noise3(position * 2.03 + vec3(7.1, 3.7, 11.3)) * 0.28;
        value += noise3(position * 4.11 + vec3(-5.4, 9.2, 2.8)) * 0.12;
#if RAIDLANDS_CLOUD_DETAIL > 1
        value += noise3(position * 8.23 + vec3(13.7, -4.1, 8.6)) * 0.06;
#endif
        return value;
      }

      float cloudDensityAt(vec3 worldPosition, float cloudBase, float cloudTop, float cloudCoverage) {
        float layerHeight = max(cloudTop - cloudBase, 1.0);
        float heightFraction = (worldPosition.y - cloudBase) / layerHeight;
        float verticalShape = smoothstep(0.0, 0.16, heightFraction)
          * (1.0 - smoothstep(0.66, 1.0, heightFraction));
        float sizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
        float cloudScale = uWorldSize * mix(0.035, 0.13, sizeFraction);
        vec3 samplePosition = vec3(
          worldPosition.x / cloudScale + uCloudPhase * 0.0032,
          heightFraction * mix(2.8, 1.65, sizeFraction),
          worldPosition.z / cloudScale + uCloudPhase * 0.00135
        );
        float field = cloudVolumeNoise(samplePosition);
        float threshold = mix(0.82, 0.27, sqrt(clamp(cloudCoverage, 0.0, 1.0)));
        float edge = mix(0.085, 0.018, clamp(uCloudSharpness, 0.0, 1.0));
        float density = smoothstep(threshold - edge, threshold + edge, field) * verticalShape;
#if RAIDLANDS_CLOUD_DETAIL > 1
        float erosion = noise3(samplePosition * 5.7 + vec3(4.2, -7.6, 2.1));
        density *= smoothstep(0.08, 0.72, density + erosion * 0.22);
#endif
        return density * smoothstep(0.005, 0.04, cloudCoverage) * clamp(uCloudOpacity, 0.0, 1.0);
      }

      vec4 raymarchCloudVolume(vec3 rayDirection, float cloudCoverage, float daylight) {
#if RAIDLANDS_CLOUD_DETAIL > 0
        if (cloudCoverage <= 0.001 || abs(rayDirection.y) <= 0.004) {
          return vec4(0.0);
        }
        float sizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
        float cloudBase = uWorldSize * (0.115 - uRainIntensity * 0.016);
        float cloudTop = cloudBase + uWorldSize * mix(0.055, 0.105, sizeFraction);
        float baseDistance = (cloudBase - uCameraPosition.y) / rayDirection.y;
        float topDistance = (cloudTop - uCameraPosition.y) / rayDirection.y;
        float enterDistance = max(0.0, min(baseDistance, topDistance));
        float exitDistance = min(uWorldSize * 2.4, max(baseDistance, topDistance));
        if (exitDistance <= enterDistance) {
          return vec4(0.0);
        }
        float stepLength = (exitDistance - enterDistance) / float(RAIDLANDS_CLOUD_VIEW_SAMPLES);
        float transmittance = 1.0;
        vec3 accumulatedColor = vec3(0.0);
        float jitter = hash(gl_FragCoord.xy + vec2(uCloudPhase * 0.07));
        vec3 sunDirection = normalize(uSunDirection);

        for (int sampleIndex = 0; sampleIndex < RAIDLANDS_CLOUD_VIEW_SAMPLES; sampleIndex += 1) {
          float sampleDistance = enterDistance + (float(sampleIndex) + jitter) * stepLength;
          vec3 samplePosition = uCameraPosition + rayDirection * sampleDistance;
          float density = cloudDensityAt(samplePosition, cloudBase, cloudTop, cloudCoverage);
          if (density > 0.002) {
            float lightTransmittance = 1.0;
            float lightStep = (cloudTop - cloudBase) * 0.16 / float(RAIDLANDS_CLOUD_LIGHT_SAMPLES);
            for (int lightIndex = 0; lightIndex < RAIDLANDS_CLOUD_LIGHT_SAMPLES; lightIndex += 1) {
              vec3 lightPosition = samplePosition + sunDirection * lightStep * (float(lightIndex) + 1.0);
              lightTransmittance *= exp(-cloudDensityAt(lightPosition, cloudBase, cloudTop, cloudCoverage)
                * mix(0.72, 1.48, clamp(uCloudAttenuation, 0.0, 1.0)));
            }
            float viewSun = clamp(dot(rayDirection, sunDirection), -1.0, 1.0);
            float forwardScatter = pow(max(viewSun, 0.0), mix(3.0, 11.0, clamp(uCloudScattering, 0.0, 1.0)));
            float powder = 1.0 - exp(-density * 2.4);
            vec3 ambientCloud = mix(vec3(0.16, 0.19, 0.24), vec3(0.7, 0.79, 0.86), daylight);
            vec3 sunCloud = mix(vec3(1.0), uSunColor, clamp(uCloudColoring, 0.0, 1.0));
            vec3 sampleColor = ambientCloud * mix(0.42, 1.2, clamp(uCloudBrightness, 0.0, 2.0) * 0.5);
            sampleColor += sunCloud * lightTransmittance
              * (0.22 + powder * 0.5 + forwardScatter * mix(0.25, 1.05, uCloudScattering))
              * mix(0.2, 1.0, daylight);
            sampleColor = mix(sampleColor, vec3(0.045, 0.052, 0.07), uRainIntensity * density * 0.58);
            float extinction = 1.0 - exp(-density * stepLength / max(uWorldSize * 0.022, 1.0));
            accumulatedColor += transmittance * sampleColor * extinction;
            transmittance *= 1.0 - extinction;
            if (transmittance < 0.02) {
              break;
            }
          }
        }
        return vec4(accumulatedColor, 1.0 - transmittance);
#else
        return vec4(0.0);
#endif
      }

      float celestialDisc(vec3 direction, vec3 targetDirection, float angularRadius, float softness) {
        float targetDot = dot(direction, normalize(targetDirection));
        float edge = cos(angularRadius);
        return smoothstep(edge - softness, edge + softness, targetDot);
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
        float horizon = 1.0 - smoothstep(0.0, 0.34, abs(direction.y));
        vec3 skyColor = direction.y < 0.0
          ? mix(uGroundColor, uHorizonColor, smoothstep(0.0, 0.42, height))
          : mix(uHorizonColor, uZenithColor, smoothstep(0.44, 1.0, height));

        float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
        float lowSun = 1.0 - smoothstep(-0.08, 0.42, uSunDirection.y);
        float mie = clamp(uAtmosphereMie * 0.25, 0.0, 1.0);
        float rayleigh = clamp(uAtmosphereRayleigh * 0.25, 0.0, 1.0);
        float cloudWeather = clamp(
          uCloudCoverage * mix(0.42, 0.7, uCloudAttenuation) + uRainIntensity * 0.48 + uFogIntensity * 0.42,
          0.0,
          0.92
        );
        float clearAtmosphere = 1.0 - cloudWeather;
        float directionality = mix(0.72, 1.34, clamp(uAtmosphereDirectionality, 0.0, 1.0));
        float sunDisc = celestialDisc(direction, uSunDirection, 0.03, 0.000022) * uSunVisibility;
        float sunCore = celestialDisc(direction, uSunDirection, 0.0255, 0.000014) * uSunVisibility;
#if RAIDLANDS_SUN_DETAIL > 0
        float solarElevation = smoothstep(-0.065, 0.28, uSunDirection.y);
        float opticalAirMass = 1.0 / max(0.12, uSunDirection.y + 0.18);
        float aerosolExtinction = exp(-opticalAirMass * (0.035 + mie * 0.16 + uFogIntensity * 0.2));
        float atmosphericVisibility = mix(0.48, 1.0, solarElevation) * mix(0.74, 1.0, aerosolExtinction);
        float limbCoordinate = clamp((sunDot - cos(0.03)) / max(0.000001, 1.0 - cos(0.03)), 0.0, 1.0);
        float limbDarkening = 0.64 + 0.36 * sqrt(limbCoordinate);
        sunDisc *= atmosphericVisibility;
        sunCore *= limbDarkening * atmosphericVisibility;
#endif
        float sunOuter = max(sunDisc - sunCore, 0.0);
        float sunGlow = pow(sunDot, mix(9.0, 15.0, directionality * 0.5))
          * (0.16 + lowSun * mix(0.32, 0.58, mie)) * uSunVisibility;
        float sunHalo = pow(sunDot, mix(28.0, 56.0, directionality * 0.5))
          * (0.2 + lowSun * mix(0.42, 0.76, mie)) * uSunVisibility;
        vec3 horizonSunDirection = normalize(vec3(uSunDirection.x, 0.075, uSunDirection.z));
        float horizonSunDot = max(dot(direction, horizonSunDirection), 0.0);
        float twilightVisibility = smoothstep(-0.2, -0.04, uSunDirection.y);
        float twilightUpperFade = 1.0 - smoothstep(0.3, 0.56, uSunDirection.y);
        float horizonScatter = pow(horizonSunDot, mix(3.0, 7.0, directionality * 0.5))
          * horizon * lowSun * clearAtmosphere * twilightVisibility;
        float horizonNear = exp(-abs(direction.y) * mix(13.0, 21.0, mie));
        float horizonWide = exp(-abs(direction.y) * mix(4.0, 8.0, rayleigh));
        float twilight = twilightVisibility * twilightUpperFade * horizon;
        vec3 orangeScatter = mix(uSunColor, vec3(1.0, 0.34, 0.18), 0.58 + mie * 0.24);
        vec3 peachScatter = mix(vec3(1.0, 0.34, 0.2), vec3(1.0, 0.7, 0.48), uDaylight);
        skyColor += orangeScatter * (sunOuter * 1.18 + sunHalo * 0.82 + sunGlow * 0.56) * clearAtmosphere;
        skyColor += peachScatter * horizonScatter * (horizonNear * (0.2 + mie * 0.34) + horizonWide * 0.12);
        skyColor += vec3(0.92, 0.17, 0.1) * horizonScatter * horizonNear * mie * 0.18;
        skyColor += peachScatter * twilight * (horizonNear * 0.1 + horizonWide * 0.045) * clearAtmosphere;
#if RAIDLANDS_SUN_DETAIL > 0
        float aureoleNear = pow(sunDot, mix(74.0, 118.0, directionality * 0.5));
        float aureoleWide = pow(sunDot, mix(4.5, 8.5, directionality * 0.5));
        float weatherTransmission = mix(0.18, 1.0, clearAtmosphere);
        vec3 aureoleColor = mix(uSunColor, orangeScatter, lowSun * 0.72);
        skyColor += aureoleColor
          * (aureoleNear * (0.18 + mie * 0.28) + aureoleWide * (0.014 + mie * 0.035))
          * uSunVisibility * weatherTransmission;
#endif
#if RAIDLANDS_SUN_DETAIL > 1
        float coronaInner = pow(sunDot, 210.0) * 0.25;
        float coronaMiddle = pow(sunDot, 82.0) * 0.12;
        float coronaOuter = pow(sunDot, 18.0) * 0.032;
        float cameraOpticsVisibility = uSunVisibility * smoothstep(-0.03, 0.09, uSunDirection.y)
          * mix(0.08, 1.0, clearAtmosphere);
        vec3 opticalTangent = normalize(cross(normalize(uSunDirection), vec3(0.0, 1.0, 0.001)));
        vec3 opticalBitangent = normalize(cross(normalize(uSunDirection), opticalTangent));
        float opticalAngle = atan(dot(direction, opticalBitangent), dot(direction, opticalTangent));
        float diffraction = pow(abs(cos(opticalAngle * 2.0)), 18.0) * pow(sunDot, 92.0) * 0.055;
        float lensRadius = acos(clamp(sunDot, 0.0, 1.0));
        float ghostA = 1.0 - smoothstep(0.002, 0.008, abs(lensRadius - 0.072));
        float ghostB = 1.0 - smoothstep(0.002, 0.006, abs(lensRadius - 0.112));
        vec3 cinematicGlow = mix(uSunColor, vec3(1.0, 0.72, 0.48), lowSun * 0.7);
        skyColor += cinematicGlow * (coronaInner + coronaMiddle + coronaOuter + diffraction) * cameraOpticsVisibility;
        skyColor += vec3(1.0, 0.54, 0.3) * ghostA * 0.014 * cameraOpticsVisibility;
        skyColor += vec3(0.34, 0.58, 1.0) * ghostB * 0.008 * cameraOpticsVisibility;
#endif

        vec2 cloudPosition = direction.xz / max(direction.y + 0.34, 0.38);
        float cloudSizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
        cloudPosition = cloudPosition * mix(3.1, 1.55, cloudSizeFraction)
          + vec2(uCloudPhase * 0.0018, uCloudPhase * 0.0007);
        float clouds = cloudNoise(cloudPosition);
        float broadClouds = cloudNoise(cloudPosition * 0.42 + vec2(3.7, -2.1));
        float cloudDetail = cloudNoise(cloudPosition * 2.18 + vec2(-5.2, 4.6));
        float cloudCoverage = clamp(uCloudCoverage, 0.0, 1.0);
        float cloudAlpha = smoothstep(0.005, 0.04, cloudCoverage);
        float cloudThreshold = mix(0.82, 0.27, sqrt(cloudCoverage));
        float cloudWave = 0.5 + 0.5 * sin(cloudPosition.x * 0.54 + sin(cloudPosition.y * 1.04) + clouds * 3.8);
        float cloudBand = 0.5 + 0.5 * sin(
          cloudPosition.x * 0.31 + cloudPosition.y * 0.22 + sin(cloudPosition.y * 0.64) * 1.9
        );
        float cloudField = clamp(clouds * 0.45 + broadClouds * 0.3 + cloudDetail * 0.11 + cloudWave * 0.075 + cloudBand * 0.065, 0.0, 1.0);
        float cloudEdge = mix(0.08, 0.018, clamp(uCloudSharpness, 0.0, 1.0));
        float cloudMask = smoothstep(cloudThreshold - cloudEdge, cloudThreshold + cloudEdge, cloudField)
          * cloudAlpha
          * clamp(uCloudOpacity, 0.0, 1.0)
          * smoothstep(-0.08, 0.12, direction.y)
          * (0.82 + height * 0.18);
        float cloudInterior = smoothstep(cloudThreshold + cloudEdge * 0.2, cloudThreshold + cloudEdge * 2.4, cloudField);
        float stormBase = smoothstep(cloudThreshold - cloudEdge * 1.8, cloudThreshold + cloudEdge * 0.5, broadClouds)
          * cloudMask * uRainIntensity;
        float cloudRim = clamp(cloudMask - cloudInterior * cloudMask, 0.0, 1.0);
        float cloudSunFacing = pow(max(dot(direction, normalize(uSunDirection)), 0.0), 3.0);
        float cloudTwilight = lowSun * twilightVisibility * twilightUpperFade;
        vec3 cloudColor = mix(vec3(0.18, 0.22, 0.28), vec3(0.82, 0.9, 0.96), uDaylight)
          * mix(0.76, 1.32, clamp(uCloudBrightness, 0.0, 2.0) * 0.5);
        float cloudUnderside = cloudInterior * (0.28 + cloudCoverage * 0.34)
          * mix(0.62, 1.0, clamp(uCloudAttenuation, 0.0, 1.0));
        cloudColor = mix(cloudColor, vec3(0.065, 0.07, 0.085), cloudUnderside * (0.42 + uRainIntensity * 0.38));
        cloudColor = mix(cloudColor, vec3(0.035, 0.045, 0.065), stormBase * (0.34 + cloudDetail * 0.28));
        vec3 warmCloudEdge = mix(vec3(1.0), mix(uSunColor, vec3(1.0, 0.38, 0.2), 0.48 + mie * 0.28), uCloudColoring);
        cloudColor = mix(
          cloudColor,
          warmCloudEdge,
          (cloudRim * 0.82 + cloudMask * cloudSunFacing * 0.18)
            * cloudTwilight * (0.28 + cloudSunFacing * 0.68) * mix(0.58, 1.0, uCloudScattering)
        );
        float distantCloudMask = cloudMask * (0.12 + cloudCoverage * 0.7 + uRainIntensity * 0.12);
#if RAIDLANDS_CLOUD_DETAIL > 0
        distantCloudMask *= 1.0 - smoothstep(0.08, 0.5, direction.y);
#endif
        skyColor = mix(skyColor, cloudColor, distantCloudMask);
        vec4 volumeCloud = raymarchCloudVolume(direction, cloudCoverage, uDaylight);
        skyColor = skyColor * (1.0 - volumeCloud.a) + volumeCloud.rgb;
        float combinedCloudMask = max(distantCloudMask, volumeCloud.a);
        float sunTransmission = max(0.72, 1.0 - combinedCloudMask * mix(0.72, 0.98, cloudInterior));
        skyColor = mix(
          skyColor,
          vec3(1.0),
          clamp(sunCore * sunTransmission * mix(0.86, 1.0, clearAtmosphere), 0.0, 1.0)
        );

        float rainbowBand = (1.0 - smoothstep(0.0, 0.012, abs(length(direction.xz - vec2(0.08, -0.24)) - 0.64)))
          * smoothstep(0.08, 0.54, direction.y)
          * smoothstep(0.1, 0.62, cloudCoverage)
          * clamp(uRainbowIntensity, 0.0, 1.0);
        vec3 rainbowColor = vec3(
          0.8 + 0.2 * sin(direction.x * 12.0),
          0.55 + 0.35 * sin(direction.x * 12.0 + 2.1),
          0.72 + 0.25 * sin(direction.x * 12.0 + 4.2)
        );
        skyColor = mix(skyColor, rainbowColor, rainbowBand * 0.32);

        vec3 moonDirection = normalize(vec3(-uSunDirection.x, max(-uSunDirection.y, 0.18), -uSunDirection.z));
        float moonVisibility = (1.0 - smoothstep(-0.02, 0.34, uSunDirection.y)) * smoothstep(0.02, 0.24, moonDirection.y);
        float moonDisc = celestialDisc(direction, moonDirection, 0.032, 0.0016) * moonVisibility;
        float moonGlow = pow(max(dot(direction, moonDirection), 0.0), 44.0) * 0.34 * moonVisibility;
        vec3 moonTangent = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)) + vec3(0.001, 0.0, 0.0));
        vec3 moonBitangent = normalize(cross(moonDirection, moonTangent));
        vec2 moonUv = vec2(dot(direction, moonTangent), dot(direction, moonBitangent)) / 0.032;
        float craterA = 1.0 - smoothstep(0.12, 0.3, length(moonUv - vec2(0.28, 0.18))) * 0.18;
        float craterB = 1.0 - smoothstep(0.1, 0.24, length(moonUv + vec2(0.22, 0.08))) * 0.14;
        float moonShade = clamp(0.72 + dot(moonUv, vec2(-0.2, 0.08)), 0.44, 1.0) * craterA * craterB;
        skyColor += vec3(0.64, 0.72, 0.86) * moonGlow;
        skyColor = mix(skyColor, vec3(0.86, 0.9, 0.98) * moonShade, moonDisc);

        float starVisibility = (1.0 - smoothstep(-0.12, -0.02, uSunDirection.y)) * smoothstep(0.12, 0.6, direction.y);
        float starA = step(0.9948, hash(direction.xz * 180.0 + direction.y * 23.0));
        float starB = step(0.9982, hash(direction.zx * 320.0 + direction.y * 67.0));
        float starTwinkle = 0.72 + 0.28 * sin(uCloudPhase * 0.55 + hash(direction.xz * 36.0) * 6.28318);
        float stars = (starA * 0.62 + starB * 1.15) * starVisibility * starTwinkle;
        skyColor += vec3(0.62, 0.76, 1.0) * stars;
        skyColor += uHorizonColor * horizon * (0.06 + uDaylight * 0.08);

        gl_FragColor = vec4(max(skyColor, vec3(0.0)), 1.0);
      }
    `,side:oo,depthWrite:!1,depthTest:!1,fog:!1});s.customProgramCacheKey=()=>`raidlands-sky-cloud-${e}-sun-${t}-v4`;const r=new S(new F(9e3,48,24),s);return r.name="raidlands-dynamic-sky-dome",r.renderOrder=-1e3,r.frustumCulled=!1,r.userData[M]=s,r}function xo(o){return so(`raidlands-sky:${o}`,()=>{const e=document.createElement("canvas");e.width=1024,e.height=512;const t=e.getContext("2d");if(!t){const s=new R(e);return s.colorSpace=eo,s}const n=o==="editor"?{zenith:new c(1120288),horizon:new c(6122352),ground:new c(2168851),sun:new c(16761466)}:{zenith:new c(7911142),horizon:new c(14151156),ground:new c(5991794),sun:new c(16773583)},i=t.createImageData(e.width,e.height);for(let s=0;s<e.height;s+=1){const r=s/(e.height-1),u=1-Math.abs(r*2-1),D=r<.54?n.zenith.clone().lerp(n.horizon,Math.pow(r/.54,.72)):n.horizon.clone().lerp(n.ground,Math.pow((r-.54)/.46,.86));for(let p=0;p<e.width;p+=1){const y=p/(e.width-1),f=Math.hypot((y-.72)*1.55,(r-.46)*2.05),C=Math.hypot((y-.74)*2.8,(r-.58)*4.2),v=Math.max(0,1-f)**2.85,w=Math.max(0,1-C)**2.4,A=Math.max(0,u)**1.72*(o==="editor"?.085:.028),g=D.clone().lerp(n.sun,v*(o==="editor"?.58:.42)+w*(o==="editor"?.18:.12)).offsetHSL(-.012,-.025,A),x=(s*e.width+p)*4;i.data[x]=Math.round(g.r*255),i.data[x+1]=Math.round(g.g*255),i.data[x+2]=Math.round(g.b*255),i.data[x+3]=255}}t.putImageData(i,0,0);const a=new R(e);return a.colorSpace=b,a})}function go(o){const e=new Map,t=new Map,n=o.clone();return $(o,n,function(i,a){e.set(a,i),t.set(i,a)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;const a=i,s=e.get(i),r=s.skeleton.bones;a.skeleton=s.skeleton.clone(),a.bindMatrix.copy(s.bindMatrix),a.skeleton.bones=r.map(function(u){return t.get(u)}),a.bind(a.skeleton,a.bindMatrix)}),n}function $(o,e,t){t(o,e);for(let n=0;n<o.children.length;n++)$(o.children[n],e.children[n],t)}const E=new Map,So={vehicle:"f15",modelUrl:"/assets/airstrike-animation-editor/models/f15/scene.gltf",prefabLabel:"assets/scripts/entity/misc/f15/f15e.prefab",scale:185e-8,positionCorrection:{x:0,y:0,z:0},rotationCorrection:{x:0,y:0,z:0},bounds:{x:13,y:5.5,z:19.5},proxy:"plane",hardpoints:[{id:"left_rocket",x:-3.1,y:-.7,z:.8},{id:"right_rocket",x:3.1,y:-.7,z:.8}]};function Eo(o,e){return o?.vehicles?.[e]??o?.vehicles?.f15??So}function Do(o,e){const t=o.trim();if(!t)return"";if(/^(https?:)?\/\//i.test(t)||t.startsWith("data:")||t.startsWith("blob:"))return t;const n=e.endsWith("/")?e:`${e}/`;return t.startsWith("/assets/")?`${n}${t.slice(8)}`:t.startsWith("assets/")?`${n}${t.slice(7)}`:t}function z(o,e=.72){return new ao({color:o,metalness:.18,roughness:e})}function h(o,e,t,n,i){const a=new S(new no(t[0],t[1],t[2]),z(i));return a.name=e,a.position.copy(n),o.add(a),a}function wo(o,e){const t=new O({color:16765286}),n=new F(Math.max(.12,Math.min(e.bounds.x,e.bounds.z)*.018),12,8);for(const i of e.hardpoints){const a=new S(n,t);a.name=`hardpoint:${i.id}`,a.position.copy(W({x:i.x,y:i.y,z:i.z})),o.add(a)}}function bo(o){const e=new io(o,7268351);e.name="vehicle-bounds",o.add(e)}function Mo(o){o.updateMatrixWorld(!0);const e=new G().setFromObject(o);if(e.isEmpty())return;const t=new d;e.getCenter(t),o.position.sub(t)}function j(o){o.traverse(e=>{e.userData.preserveSharedVehicleAsset=!0})}async function Ao(o){let e=E.get(o);return e||(e=new lo().loadAsync(o).then(t=>(Mo(t.scene),j(t.scene),t.scene)),E.set(o,e)),e}function zo(o,e=.5){o.updateMatrixWorld(!0);const t=new G().setFromObject(o);if(t.isEmpty())return;const n=Math.min(1,Math.max(0,Number.isFinite(e)?e:.5)),i=t.min.y+(t.max.y-t.min.y)*n;o.position.y-=i}function Io(o,e){const t=e.bounds.x,n=e.bounds.y,i=e.bounds.z;h(o,"fuselage",[Math.max(t*.12,.55),Math.max(n*.34,.35),i],new d(0,0,0),7044229),h(o,"wings",[t,Math.max(n*.08,.15),Math.max(i*.16,.8)],new d(0,0,-i*.08),9216941),h(o,"tail-wing",[t*.45,Math.max(n*.07,.12),Math.max(i*.11,.5)],new d(0,n*.04,i*.42),9216941),h(o,"tail-fin",[Math.max(t*.055,.15),n*.48,Math.max(i*.11,.45)],new d(0,n*.28,i*.42),7374736);const a=new S(new U(Math.max(t*.08,.32),Math.max(i*.16,.75),18),z(14674412,.55));a.name="nose-direction",a.rotation.x=-Math.PI/2,a.position.z=-i*.58,o.add(a)}function Po(o,e){const t=Math.max(e.bounds.x,1.2),n=Math.max(e.bounds.y,.5);h(o,"drone-body",[t*.42,n*.45,t*.42],new d(0,0,0),7044229),h(o,"drone-arm-x",[t*1.15,n*.08,t*.08],new d(0,0,0),10268599),h(o,"drone-arm-z",[t*.08,n*.08,t*1.15],new d(0,0,0),10268599);const i=new O({color:13363438,transparent:!0,opacity:.42}),a=new to(t*.18,22);for(const s of[-t*.48,t*.48])for(const r of[-t*.48,t*.48]){const u=new S(a,i);u.name="rotor-disc",u.rotation.x=-Math.PI/2,u.position.set(s,n*.08,r),o.add(u)}}function ko(o,e){const t=e.bounds.x,n=e.bounds.y,i=e.bounds.z;h(o,"heli-body",[Math.max(t*.24,1.8),Math.max(n*.38,1),Math.max(i*.33,2.8)],new d(0,0,-i*.08),7636107),h(o,"heli-tail",[Math.max(t*.09,.55),Math.max(n*.12,.32),i*.5],new d(0,n*.08,i*.28),9216941),h(o,"heli-tail-rotor",[t*.24,Math.max(n*.06,.16),Math.max(i*.04,.2)],new d(0,n*.16,i*.55),13363438),h(o,"heli-main-rotor-a",[t*.9,Math.max(n*.035,.12),Math.max(i*.035,.12)],new d(0,n*.46,-i*.09),13363438),h(o,"heli-main-rotor-b",[Math.max(t*.035,.12),Math.max(n*.035,.12),i*.55],new d(0,n*.46,-i*.09),13363438);const a=new S(new U(Math.max(t*.08,.4),Math.max(i*.12,.8),18),z(14674412,.55));a.name="heli-nose-direction",a.rotation.x=-Math.PI/2,a.position.z=-i*.33,o.add(a)}function _(o,e={}){const t=new N;t.name=`vehicle-proxy:${o.vehicle}`;const n=o.proxy??(o.vehicle==="drone"?"drone":o.vehicle==="attack_heli"?"helicopter":"plane");return n==="drone"?Po(t,o):n==="helicopter"?ko(t,o):Io(t,o),wo(t,o),e.showBounds&&bo(t),t.rotation.set(o.rotationCorrection.x*Math.PI/180,o.rotationCorrection.y*Math.PI/180,o.rotationCorrection.z*Math.PI/180),t}async function _o(o,e){const t=Do(o.modelUrl,e);if(!t)return{object:_(o),usedFallback:!0,resolvedUrl:t};try{const n=await Ao(t),i=new N;i.name=`vehicle-glb:${o.vehicle}`;const a=go(n);j(a),i.add(a),i.scale.setScalar(o.scale||1),i.rotation.set(o.rotationCorrection.x*Math.PI/180,o.rotationCorrection.y*Math.PI/180,o.rotationCorrection.z*Math.PI/180),zo(i,o.visualOriginY);const s=W(o.positionCorrection);return i.position.add(s),{object:i,usedFallback:!1,resolvedUrl:t}}catch{return{object:_(o),usedFallback:!0,resolvedUrl:t}}}export{Bo as a,_o as b,_ as c,fo as d,vo as e,so as g,Vo as i,ro as l,Eo as m,uo as p,mo as r,yo as u};
//# sourceMappingURL=vehicle-preview-BNai_rFh.js.map
