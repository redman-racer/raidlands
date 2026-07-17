import{am as Q,l as b,y as ee,an as T,ao as R,o as c,V as u,_ as oe,ap as te,b as S,S as N,n as l,s as V,aq as ie,G as U,M as B,ar as ne,k as W,as as ae,f as q,B as le,g as re}from"./three.module-DR2twPMq.js";import{D as se,G as ce,M as ue}from"./meshopt_decoder.module-Bd8JSThf.js";import{u as G}from"./coordinates-DYkAcSL_.js";const _=new Map,O=new Map;function H(e){return e.userData.preserveSharedAsset=!0,e}function We(e){return!!(e&&typeof e=="object"&&e.userData?.preserveSharedAsset===!0)}async function de(e){let o=_.get(e);return o||(o=new Q().loadAsync(e).then(t=>H(t)),_.set(e,o)),o}function me(e,o){const t=O.get(e);if(t)return t;const n=H(o());return n.colorSpace=n.colorSpace||b,O.set(e,n),n}const he={low:{detail:"low",viewSamples:0,lightSamples:0,shadowOctaves:0,useVolumetricClouds:!1,useSpriteClouds:!0},medium:{detail:"medium",viewSamples:32,lightSamples:2,shadowOctaves:2,useVolumetricClouds:!0,useSpriteClouds:!1},max:{detail:"max",viewSamples:56,lightSamples:4,shadowOctaves:4,useVolumetricClouds:!0,useSpriteClouds:!1}};function pe(e,o="low"){return e==="low"||e==="medium"||e==="max"?e:o}function fe(e){return he[e]}function ve(e){const o=Number(e);return Number.isFinite(o)?Math.min(1,Math.max(0,o)):0}const ge={low:{detail:"low",shaderLevel:0,useAtmosphericDisc:!1,useCinematicOptics:!1,lightingResponse:0},medium:{detail:"medium",shaderLevel:1,useAtmosphericDisc:!0,useCinematicOptics:!1,lightingResponse:.55},max:{detail:"max",shaderLevel:2,useAtmosphericDisc:!0,useCinematicOptics:!0,lightingResponse:1}};function ye(e,o="low"){return e==="low"||e==="medium"||e==="max"?e:o}function Ce(e){return ge[e]}const De=.42;function Se(e){const o=e.clone().normalize();return Math.atan2(o.y,-o.x/De)}const A="raidlandsSkyDome";function qe(e,o,t={}){o.toneMapping=ee,o.toneMappingExposure=t.exposure??1.08;const n=t.preset??"terrain",i=pe(t.cloudDetail,"low"),a=ye(t.sunDetail,"low"),s=Math.max(100,Number(t.worldSize)||4500),r=be(n);r.mapping=T,r.colorSpace=b,r.needsUpdate=!0;const m=new R(o),x=m.fromEquirectangular(r).texture;m.dispose();const p=e.userData[A];p&&(e.remove(p),p.geometry.dispose(),p.material.dispose());const g=we(n,i,a,s);e.add(g),e.userData[A]=g,e.background=new c(264210),e.backgroundIntensity=t.backgroundIntensity??(n==="editor"?.82:.96),e.environment=x,e.environmentIntensity=t.environmentIntensity??(n==="editor"?.72:.9),xe(e,{sunDirection:new u(.5,.78,.36).normalize(),sunColor:n==="editor"?new c(16761978):new c(16773583),sunIntensity:n==="editor"?1.78:1.58,cloudCoverage:n==="editor"?.24:.22,timeSeconds:0}),t.skyboxUrl&&de(t.skyboxUrl).then(f=>{f.mapping=T,f.colorSpace=b,f.needsUpdate=!0;const y=new R(o),v=y.fromEquirectangular(f).texture;y.dispose(),e.background=f,e.environment=v},()=>{})}function xe(e,o){const t=e.userData[A],i=t?.material?.uniforms;if(!t||!i)return;o.cameraPosition&&t.position.copy(o.cameraPosition);const a=o.sunDirection.clone().normalize(),s=l.clamp(a.y,-.32,.92),r=l.smoothstep(s,-.08,.5),m=l.smoothstep(s,-.2,-.04)*(1-l.smoothstep(s,.3,.56)),x=o.cloudCoverage===null||o.cloudCoverage===void 0?0:Number(o.cloudCoverage),p=ve(x),g=l.clamp(h(o.cloudOpacity,1),0,1),f=p,y=l.clamp(h(o.atmosphereRayleigh,.25),0,4),v=l.clamp(h(o.atmosphereMie,1.55),0,4),w=l.clamp(h(o.atmosphereBrightness,.95),.05,3),z=l.clamp(h(o.atmosphereContrast,.65),.05,3),D=l.clamp(h(o.atmosphereDirectionality,.75),0,1),C=l.clamp(h(o.fogIntensity,0),0,1),I=l.clamp(h(o.rainIntensity,0),0,1),P=Number(o.sunIntensity),X=l.smoothstep(s,-.055,.018)*l.clamp((Number.isFinite(P)?P:0)/1.7,.18,1.2)*l.lerp(.72,1.28,D)*l.lerp(1,.54,Math.max(C*.65,I*.42)),L=o.sunColor.clone().lerp(new c(16761228),l.lerp(.38,.64,l.clamp(v/4,0,1))),K=new c(462876).lerp(new c(7911142),r).lerp(new c(5327720),m*.32).lerp(new c(5208245),l.clamp(y/4,0,1)*r*.18).multiplyScalar(l.lerp(.72,1.18,w/1.4)),Y=new c(1254195).lerp(new c(14151156),r).lerp(L,m*.22).lerp(new c(16757391),l.clamp(v/4,0,1)*m*.3).lerp(new c(15895416),m*l.clamp(v/4,0,1)*.08).multiplyScalar(l.lerp(.72,1.2,w/1.4)),J=new c(329740).lerp(new c(5991794),r).lerp(L,m*.22).multiplyScalar(l.lerp(.78,1.12,z/1.4));i.uZenithColor.value.copy(K),i.uHorizonColor.value.copy(Y),i.uGroundColor.value.copy(J),i.uSunColor.value.copy(o.sunColor),i.uSunDirection.value.copy(a),i.uCelestialAngle.value=Se(a),i.uDaylight.value=r,i.uCloudCoverage.value=f,i.uCloudPhase.value=Number(o.timeSeconds)||0,i.uSunVisibility.value=X,i.uCloudOpacity.value=g,i.uCloudSize.value=l.clamp(h(o.cloudSize,3.35),.2,8),i.uCloudColoring.value=l.clamp(h(o.cloudColoring,.65),0,1),i.uCloudSharpness.value=l.clamp(h(o.cloudSharpness,1),0,1),i.uCloudAttenuation.value=l.clamp(h(o.cloudAttenuation,.25),0,1),i.uCloudScattering.value=l.clamp(h(o.cloudScattering,.65),0,1),i.uCloudBrightness.value=l.clamp(h(o.cloudBrightness,.55),0,2),i.uAtmosphereRayleigh.value=y,i.uAtmosphereMie.value=v,i.uAtmosphereDirectionality.value=D,i.uRainbowIntensity.value=l.clamp(h(o.rainbowIntensity,0),0,1),i.uFogIntensity.value=C,i.uRainIntensity.value=I,i.uCameraPosition.value.copy(o.cameraPosition||t.position)}function h(e,o){const t=Number(e);return Number.isFinite(t)?t:o}function we(e,o,t,n){const i=fe(o),a=Ce(t),s=new oe({defines:{RAIDLANDS_CLOUD_DETAIL:i.useVolumetricClouds?o==="max"?2:1:0,RAIDLANDS_CLOUD_VIEW_SAMPLES:Math.max(1,i.viewSamples),RAIDLANDS_CLOUD_LIGHT_SAMPLES:Math.max(1,i.lightSamples),RAIDLANDS_SUN_DETAIL:a.shaderLevel},uniforms:{uZenithColor:{value:new c(e==="editor"?1385786:7911142)},uHorizonColor:{value:new c(e==="editor"?8035241:14151156)},uGroundColor:{value:new c(e==="editor"?2168851:5991794)},uSunColor:{value:new c(e==="editor"?16761978:16773583)},uSunDirection:{value:new u(.5,.78,.36).normalize()},uCelestialAngle:{value:0},uDaylight:{value:1},uCloudCoverage:{value:e==="editor"?.24:.32},uCloudPhase:{value:0},uSunVisibility:{value:1},uCloudOpacity:{value:1},uCloudSize:{value:3.35},uCloudColoring:{value:.65},uCloudSharpness:{value:1},uCloudAttenuation:{value:.25},uCloudScattering:{value:.65},uCloudBrightness:{value:.55},uAtmosphereRayleigh:{value:.25},uAtmosphereMie:{value:1.55},uAtmosphereDirectionality:{value:.75},uRainbowIntensity:{value:0},uFogIntensity:{value:0},uRainIntensity:{value:0},uCameraPosition:{value:new u},uWorldSize:{value:n}},vertexShader:`
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
      uniform float uCelestialAngle;
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
        // A flat cloud slab has an infinite intersection at the mathematical
        // horizon. Fade that limit into atmospheric haze so it cannot form a
        // razor-straight band above or below the landscape.
        float cloudHorizonFade = smoothstep(0.008, 0.09, abs(rayDirection.y));
        return vec4(accumulatedColor * cloudHorizonFade, (1.0 - transmittance) * cloudHorizonFade);
#else
        return vec4(0.0);
#endif
      }

      float celestialDisc(vec3 direction, vec3 targetDirection, float angularRadius, float softness) {
        float targetDot = dot(direction, normalize(targetDirection));
        float edge = cos(angularRadius);
        return smoothstep(edge - softness, edge + softness, targetDot);
      }

      vec3 rotateAroundAxis(vec3 direction, vec3 axis, float angle) {
        float cosine = cos(angle);
        float sine = sin(angle);
        return direction * cosine
          + cross(axis, direction) * sine
          + axis * dot(axis, direction) * (1.0 - cosine);
      }

      vec3 celestialCoordinates(vec3 worldDirection) {
        // This pole follows Rust's tilted solar orbit. Moving into this frame
        // makes the stars and recognizable constellations rise and set with
        // the live server sun instead of remaining painted onto the camera.
        vec3 celestialPole = normalize(vec3(0.0, 0.5, -0.8660254));
        vec3 equatorX = vec3(1.0, 0.0, 0.0);
        vec3 equatorZ = normalize(cross(equatorX, celestialPole));
        vec3 unrotated = rotateAroundAxis(worldDirection, celestialPole, -uCelestialAngle);
        return normalize(vec3(
          dot(unrotated, equatorX),
          dot(unrotated, celestialPole),
          dot(unrotated, equatorZ)
        ));
      }

      vec2 celestialUv(vec3 direction) {
        return vec2(
          atan(direction.z, direction.x) / 6.28318530718 + 0.5,
          asin(clamp(direction.y, -1.0, 1.0)) / 3.14159265359 + 0.5
        );
      }

      vec3 stellarTemperature(float temperature) {
        vec3 warmStar = vec3(1.0, 0.72, 0.5);
        vec3 whiteStar = vec3(0.92, 0.96, 1.0);
        vec3 blueStar = vec3(0.58, 0.75, 1.0);
        return temperature < 0.52
          ? mix(warmStar, whiteStar, temperature / 0.52)
          : mix(whiteStar, blueStar, (temperature - 0.52) / 0.48);
      }

      vec3 starLayer(vec2 sphereUv, float scale, float threshold, float seedOffset) {
        vec2 gridPosition = sphereUv * vec2(scale * 2.0, scale);
        vec2 cell = floor(gridPosition);
        vec2 localPosition = fract(gridPosition);
        float population = hash(cell + vec2(17.17 + seedOffset, 43.73 - seedOffset));
        float magnitude = pow(smoothstep(threshold, 1.0, population), 2.35);
        vec2 starPosition = vec2(
          hash(cell + vec2(3.17 + seedOffset, 9.23)),
          hash(cell + vec2(27.61, 5.31 + seedOffset))
        );
        float starDistance = length(localPosition - starPosition);
        float core = 1.0 - smoothstep(0.018, 0.105, starDistance);
        float halo = 1.0 - smoothstep(0.035, 0.28, starDistance);
        float temperature = hash(cell + vec2(71.7 - seedOffset, 19.13 + seedOffset));
        float twinkleSeed = hash(cell + vec2(6.7, 91.1 + seedOffset));
        float twinkle = 0.91 + 0.09 * sin(uCloudPhase * (0.28 + twinkleSeed * 0.34) + twinkleSeed * 6.28318530718);
        return stellarTemperature(temperature) * (core + halo * 0.12) * magnitude * twinkle;
      }

      vec3 proceduralStarField(vec3 celestialDirection) {
        vec2 sphereUv = celestialUv(celestialDirection);
        vec3 fineStars = starLayer(sphereUv, 340.0, 0.952, 13.0);
        vec3 brightStars = starLayer(sphereUv, 145.0, 0.855, 47.0);
        return fineStars * 0.72 + brightStars * 1.18;
      }

      vec3 milkyWayLight(vec3 celestialDirection) {
        vec3 galacticPole = normalize(vec3(0.21, 0.9, -0.38));
        vec3 galacticX = normalize(cross(galacticPole, vec3(0.0, 1.0, 0.001)));
        vec3 galacticZ = normalize(cross(galacticX, galacticPole));
        float latitude = abs(dot(celestialDirection, galacticPole));
        float longitude = atan(dot(celestialDirection, galacticZ), dot(celestialDirection, galacticX));
        float broadBand = exp(-latitude * latitude * 58.0);
        float brightCore = exp(-latitude * latitude * 230.0);
        float structure = cloudNoise(vec2(longitude * 1.24, celestialDirection.y * 5.1) + vec2(18.7, -4.2));
        float dust = noise(vec2(longitude * 3.7, latitude * 27.0) + vec2(-8.3, 12.6));
        float density = broadBand * (0.16 + structure * 0.5) + brightCore * structure * 0.38;
        density *= 1.0 - smoothstep(0.46, 0.82, dust) * (0.28 + brightCore * 0.48);
        vec3 coolMist = mix(vec3(0.2, 0.3, 0.52), vec3(0.62, 0.7, 0.9), structure);
        return coolMist * density * 0.16;
      }

      vec3 equatorialDirection(float rightAscensionDegrees, float declinationDegrees) {
        float rightAscension = radians(rightAscensionDegrees);
        float declination = radians(declinationDegrees);
        float declinationRadius = cos(declination);
        return vec3(
          cos(rightAscension) * declinationRadius,
          sin(declination),
          sin(rightAscension) * declinationRadius
        );
      }

      float constellationStar(vec3 direction, vec3 starDirection) {
        float alignment = max(dot(direction, starDirection), 0.0);
        return pow(alignment, 260000.0) * 1.24 + pow(alignment, 18000.0) * 0.075;
      }

      float constellationSegment(vec3 direction, vec3 startDirection, vec3 endDirection) {
        vec3 segment = endDirection - startDirection;
        float alongSegment = clamp(
          dot(direction - startDirection, segment) / max(dot(segment, segment), 0.000001),
          0.0,
          1.0
        );
        vec3 nearestDirection = normalize(mix(startDirection, endDirection, alongSegment));
        float angularDistance = 1.0 - dot(direction, nearestDirection);
        return 1.0 - smoothstep(0.00000004, 0.0000014, angularDistance);
      }

      vec2 naturalConstellations(vec3 direction) {
        float stars = 0.0;
        float lines = 0.0;

        // Orion: shoulders, belt, and feet.
        vec3 betelgeuse = equatorialDirection(88.79, 7.41);
        vec3 bellatrix = equatorialDirection(81.28, 6.35);
        vec3 mintaka = equatorialDirection(83.0, -0.3);
        vec3 alnilam = equatorialDirection(84.05, -1.2);
        vec3 alnitak = equatorialDirection(85.19, -1.94);
        vec3 rigel = equatorialDirection(78.63, -8.2);
        vec3 saiph = equatorialDirection(86.94, -9.67);
        stars += constellationStar(direction, betelgeuse) + constellationStar(direction, bellatrix);
        stars += constellationStar(direction, mintaka) + constellationStar(direction, alnilam);
        stars += constellationStar(direction, alnitak) + constellationStar(direction, rigel);
        stars += constellationStar(direction, saiph);
#if RAIDLANDS_SUN_DETAIL > 1
        lines += constellationSegment(direction, betelgeuse, bellatrix);
        lines += constellationSegment(direction, betelgeuse, alnilam);
        lines += constellationSegment(direction, bellatrix, mintaka);
        lines += constellationSegment(direction, mintaka, alnilam);
        lines += constellationSegment(direction, alnilam, alnitak);
        lines += constellationSegment(direction, alnilam, rigel);
        lines += constellationSegment(direction, alnitak, saiph);
#endif

        // Ursa Major's Big Dipper.
        vec3 alkaid = equatorialDirection(206.89, 49.31);
        vec3 mizar = equatorialDirection(200.98, 54.93);
        vec3 alioth = equatorialDirection(193.51, 55.96);
        vec3 megrez = equatorialDirection(183.86, 57.03);
        vec3 phecda = equatorialDirection(178.46, 53.69);
        vec3 merak = equatorialDirection(165.93, 56.38);
        vec3 dubhe = equatorialDirection(165.46, 61.75);
        stars += constellationStar(direction, alkaid) + constellationStar(direction, mizar);
        stars += constellationStar(direction, alioth) + constellationStar(direction, megrez);
        stars += constellationStar(direction, phecda) + constellationStar(direction, merak);
        stars += constellationStar(direction, dubhe);
#if RAIDLANDS_SUN_DETAIL > 1
        lines += constellationSegment(direction, alkaid, mizar);
        lines += constellationSegment(direction, mizar, alioth);
        lines += constellationSegment(direction, alioth, megrez);
        lines += constellationSegment(direction, megrez, phecda);
        lines += constellationSegment(direction, phecda, merak);
        lines += constellationSegment(direction, merak, dubhe);
        lines += constellationSegment(direction, dubhe, megrez);
#endif

        // Cassiopeia's quiet northern W.
        vec3 caph = equatorialDirection(2.29, 59.15);
        vec3 schedar = equatorialDirection(10.13, 56.54);
        vec3 gammaCassiopeiae = equatorialDirection(14.18, 60.72);
        vec3 ruchbah = equatorialDirection(21.45, 60.24);
        vec3 segin = equatorialDirection(28.6, 63.67);
        stars += constellationStar(direction, caph) + constellationStar(direction, schedar);
        stars += constellationStar(direction, gammaCassiopeiae) + constellationStar(direction, ruchbah);
        stars += constellationStar(direction, segin);
#if RAIDLANDS_SUN_DETAIL > 1
        lines += constellationSegment(direction, caph, schedar);
        lines += constellationSegment(direction, schedar, gammaCassiopeiae);
        lines += constellationSegment(direction, gammaCassiopeiae, ruchbah);
        lines += constellationSegment(direction, ruchbah, segin);
#endif

        return vec2(stars, clamp(lines, 0.0, 1.0));
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
        float horizon = 1.0 - smoothstep(0.0, 0.34, abs(direction.y));
        vec3 skyColor = direction.y < 0.0
          ? mix(uGroundColor, uHorizonColor, smoothstep(-0.76, 0.0, direction.y))
          : mix(uHorizonColor, uZenithColor, pow(smoothstep(0.0, 1.0, direction.y), 0.72));

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

        float celestialWeatherTransmission = (1.0 - combinedCloudMask)
          * mix(1.0, 0.34, clamp(uFogIntensity * 0.72 + uRainIntensity * 0.58, 0.0, 1.0));
        vec3 moonDirection = normalize(-uSunDirection);
        float moonVisibility = (1.0 - smoothstep(-0.02, 0.34, uSunDirection.y))
          * smoothstep(-0.015, 0.12, moonDirection.y)
          * mix(1.0, celestialWeatherTransmission, 0.9);
        float moonDisc = celestialDisc(direction, moonDirection, 0.032, 0.0016) * moonVisibility;
        float moonGlow = pow(max(dot(direction, moonDirection), 0.0), 44.0) * 0.3 * moonVisibility;
        vec3 moonTangent = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)) + vec3(0.001, 0.0, 0.0));
        vec3 moonBitangent = normalize(cross(moonDirection, moonTangent));
        vec2 moonUv = vec2(dot(direction, moonTangent), dot(direction, moonBitangent)) / 0.032;
        float craterA = 1.0 - smoothstep(0.12, 0.3, length(moonUv - vec2(0.28, 0.18))) * 0.18;
        float craterB = 1.0 - smoothstep(0.1, 0.24, length(moonUv + vec2(0.22, 0.08))) * 0.14;
        float moonShade = clamp(0.72 + dot(moonUv, vec2(-0.2, 0.08)), 0.44, 1.0) * craterA * craterB;
        skyColor += vec3(0.64, 0.72, 0.86) * moonGlow;
        skyColor = mix(skyColor, vec3(0.86, 0.9, 0.98) * moonShade, moonDisc);

        float nightVisibility = 1.0 - smoothstep(-0.16, -0.015, uSunDirection.y);
        float stellarHorizonTransmission = smoothstep(-0.015, 0.17, direction.y);
        float starVisibility = nightVisibility * stellarHorizonTransmission * celestialWeatherTransmission;
        if (starVisibility > 0.001) {
          vec3 celestialDirection = celestialCoordinates(direction);
          vec3 starField = proceduralStarField(celestialDirection);
          skyColor += starField * starVisibility;
#if RAIDLANDS_SUN_DETAIL > 0
          vec3 milkyWay = milkyWayLight(celestialDirection);
          skyColor += milkyWay * starVisibility;
#endif
#if RAIDLANDS_SUN_DETAIL > 1
          vec2 constellations = naturalConstellations(celestialDirection);
          skyColor += vec3(0.76, 0.86, 1.0) * constellations.x * starVisibility * 0.52;
          // On ultra detail these traces read like barely perceptible starlight,
          // not a diagram drawn over the night sky.
          skyColor += vec3(0.32, 0.5, 0.86) * constellations.y * starVisibility * 0.052;
#endif
        }
        skyColor += uHorizonColor * horizon * (0.035 + uDaylight * 0.045);
        // Optical depth is greatest along the horizon. This final veil makes
        // clouds, clear air, the lower hemisphere, and the distant ocean meet
        // at one continuous color instead of exposing the flat-world cutoff.
        float horizonVeil = exp(-abs(direction.y) * 24.0);
        float horizonVeilStrength = horizonVeil
          * mix(0.56, 0.86, uDaylight)
          * mix(0.86, 1.0, clamp(uFogIntensity + uRainIntensity * 0.5, 0.0, 1.0));
        vec3 horizonVeilColor = uHorizonColor * (1.035 + uDaylight * 0.025);
        skyColor = mix(skyColor, horizonVeilColor, horizonVeilStrength);

        gl_FragColor = vec4(max(skyColor, vec3(0.0)), 1.0);
      }
    `,side:te,depthWrite:!1,depthTest:!1,fog:!1});s.customProgramCacheKey=()=>`raidlands-sky-cloud-${o}-sun-${t}-v6`;const r=new S(new N(9e3,48,24),s);return r.name="raidlands-dynamic-sky-dome",r.renderOrder=-1e3,r.frustumCulled=!1,r.userData[A]=s,r}function be(e){return me(`raidlands-sky:${e}`,()=>{const o=document.createElement("canvas");o.width=1024,o.height=512;const t=o.getContext("2d");if(!t){const s=new V(o);return s.colorSpace=ie,s}const n=e==="editor"?{zenith:new c(1120288),horizon:new c(6122352),ground:new c(2168851),sun:new c(16761466)}:{zenith:new c(7911142),horizon:new c(14151156),ground:new c(5991794),sun:new c(16773583)},i=t.createImageData(o.width,o.height);for(let s=0;s<o.height;s+=1){const r=s/(o.height-1),m=1-Math.abs(r*2-1),x=r<.54?n.zenith.clone().lerp(n.horizon,Math.pow(r/.54,.72)):n.horizon.clone().lerp(n.ground,Math.pow((r-.54)/.46,.86));for(let p=0;p<o.width;p+=1){const g=p/(o.width-1),f=Math.hypot((g-.72)*1.55,(r-.46)*2.05),y=Math.hypot((g-.74)*2.8,(r-.58)*4.2),v=Math.max(0,1-f)**2.85,w=Math.max(0,1-y)**2.4,z=Math.max(0,m)**1.72*(e==="editor"?.085:.028),D=x.clone().lerp(n.sun,v*(e==="editor"?.58:.42)+w*(e==="editor"?.18:.12)).offsetHSL(-.012,-.025,z),C=(s*o.width+p)*4;i.data[C]=Math.round(D.r*255),i.data[C+1]=Math.round(D.g*255),i.data[C+2]=Math.round(D.b*255),i.data[C+3]=255}}t.putImageData(i,0,0);const a=new V(o);return a.colorSpace=b,a})}function Ae(e){const o=new Map,t=new Map,n=e.clone();return $(e,n,function(i,a){o.set(a,i),t.set(i,a)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;const a=i,s=o.get(i),r=s.skeleton.bones;a.skeleton=s.skeleton.clone(),a.bindMatrix.copy(s.bindMatrix),a.skeleton.bones=r.map(function(m){return t.get(m)}),a.bind(a.skeleton,a.bindMatrix)}),n}function $(e,o,t){t(e,o);for(let n=0;n<e.children.length;n++)$(e.children[n],o.children[n],t)}const E=new Map,ze=new URL("../../../media/models/draco/",import.meta.url).href,j=new se;j.setDecoderPath(ze);const M=new ce;M.setDRACOLoader(j);M.setMeshoptDecoder(ue);const Me={vehicle:"f15",modelUrl:"/assets/airstrike-animation-editor/models/f15/scene.gltf",prefabLabel:"assets/scripts/entity/misc/f15/f15e.prefab",scale:185e-8,positionCorrection:{x:0,y:0,z:0},rotationCorrection:{x:0,y:0,z:0},bounds:{x:13,y:5.5,z:19.5},proxy:"plane",hardpoints:[{id:"left_rocket",x:-3.1,y:-.7,z:.8},{id:"right_rocket",x:3.1,y:-.7,z:.8}]};function Ge(e,o){return e?.vehicles?.[o]??e?.vehicles?.f15??Me}function ke(e,o){const t=e.trim();if(!t)return"";if(/^(https?:)?\/\//i.test(t)||t.startsWith("data:")||t.startsWith("blob:"))return t;const n=o.endsWith("/")?o:`${o}/`;return t.startsWith("/assets/")?`${n}${t.slice(8)}`:t.startsWith("assets/")?`${n}${t.slice(7)}`:t}function k(e,o=.72){return new re({color:e,metalness:.18,roughness:o})}function d(e,o,t,n,i){const a=new S(new le(t[0],t[1],t[2]),k(i));return a.name=o,a.position.copy(n),e.add(a),a}function Ie(e,o){const t=new B({color:16765286}),n=new N(Math.max(.12,Math.min(o.bounds.x,o.bounds.z)*.018),12,8);for(const i of o.hardpoints){const a=new S(n,t);a.name=`hardpoint:${i.id}`,a.position.copy(G({x:i.x,y:i.y,z:i.z})),e.add(a)}}function Pe(e){const o=new ae(e,7268351);o.name="vehicle-bounds",e.add(o)}function Le(e){e.updateMatrixWorld(!0);const o=new q().setFromObject(e);if(o.isEmpty())return;const t=new u;o.getCenter(t),e.position.sub(t)}function Z(e){e.traverse(o=>{o.userData.preserveSharedVehicleAsset=!0})}async function Te(e){let o=E.get(e);return o||(o=M.loadAsync(e).then(t=>(Le(t.scene),Z(t.scene),t.scene)),E.set(e,o)),o}function Re(e,o=.5){e.updateMatrixWorld(!0);const t=new q().setFromObject(e);if(t.isEmpty())return;const n=Math.min(1,Math.max(0,Number.isFinite(o)?o:.5)),i=t.min.y+(t.max.y-t.min.y)*n;e.position.y-=i}function Ve(e,o){const t=o.bounds.x,n=o.bounds.y,i=o.bounds.z;d(e,"fuselage",[Math.max(t*.12,.55),Math.max(n*.34,.35),i],new u(0,0,0),7044229),d(e,"wings",[t,Math.max(n*.08,.15),Math.max(i*.16,.8)],new u(0,0,-i*.08),9216941),d(e,"tail-wing",[t*.45,Math.max(n*.07,.12),Math.max(i*.11,.5)],new u(0,n*.04,i*.42),9216941),d(e,"tail-fin",[Math.max(t*.055,.15),n*.48,Math.max(i*.11,.45)],new u(0,n*.28,i*.42),7374736);const a=new S(new W(Math.max(t*.08,.32),Math.max(i*.16,.75),18),k(14674412,.55));a.name="nose-direction",a.rotation.x=-Math.PI/2,a.position.z=-i*.58,e.add(a)}function _e(e,o){const t=Math.max(o.bounds.x,1.2),n=Math.max(o.bounds.y,.5);d(e,"drone-body",[t*.42,n*.45,t*.42],new u(0,0,0),7044229),d(e,"drone-arm-x",[t*1.15,n*.08,t*.08],new u(0,0,0),10268599),d(e,"drone-arm-z",[t*.08,n*.08,t*1.15],new u(0,0,0),10268599);const i=new B({color:13363438,transparent:!0,opacity:.42}),a=new ne(t*.18,22);for(const s of[-t*.48,t*.48])for(const r of[-t*.48,t*.48]){const m=new S(a,i);m.name="rotor-disc",m.rotation.x=-Math.PI/2,m.position.set(s,n*.08,r),e.add(m)}}function Oe(e,o){const t=o.bounds.x,n=o.bounds.y,i=o.bounds.z;d(e,"heli-body",[Math.max(t*.24,1.8),Math.max(n*.38,1),Math.max(i*.33,2.8)],new u(0,0,-i*.08),7636107),d(e,"heli-tail",[Math.max(t*.09,.55),Math.max(n*.12,.32),i*.5],new u(0,n*.08,i*.28),9216941),d(e,"heli-tail-rotor",[t*.24,Math.max(n*.06,.16),Math.max(i*.04,.2)],new u(0,n*.16,i*.55),13363438),d(e,"heli-main-rotor-a",[t*.9,Math.max(n*.035,.12),Math.max(i*.035,.12)],new u(0,n*.46,-i*.09),13363438),d(e,"heli-main-rotor-b",[Math.max(t*.035,.12),Math.max(n*.035,.12),i*.55],new u(0,n*.46,-i*.09),13363438);const a=new S(new W(Math.max(t*.08,.4),Math.max(i*.12,.8),18),k(14674412,.55));a.name="heli-nose-direction",a.rotation.x=-Math.PI/2,a.position.z=-i*.33,e.add(a)}function Ee(e,o){const t=Math.max(o.bounds.x,2.8),n=Math.max(o.bounds.y,1.8),i=Math.max(o.bounds.z,4.8),a=3160378;d(e,"ground-hull",[t*.72,n*.4,i*.68],new u(0,n*.04,0),6647914),d(e,"ground-tread-left",[t*.22,n*.28,i*.88],new u(-t*.37,-n*.1,0),a),d(e,"ground-tread-right",[t*.22,n*.28,i*.88],new u(t*.37,-n*.1,0),a),d(e,"ground-turret",[t*.42,n*.25,i*.28],new u(0,n*.3,-i*.04),7832184),d(e,"ground-barrel",[Math.max(t*.08,.18),Math.max(n*.08,.16),i*.5],new u(0,n*.32,-i*.34),3884355)}function Fe(e,o){const t=Math.max(o.bounds.x,18),n=Math.max(o.bounds.y,12),i=Math.max(o.bounds.z,72);d(e,"ship-hull",[t,n*.34,i],new u(0,-n*.08,0),5070177),d(e,"ship-deck",[t*.88,n*.08,i*.82],new u(0,n*.14,0),7962752),d(e,"ship-bridge",[t*.45,n*.36,i*.2],new u(0,n*.36,-i*.2),8358793),d(e,"ship-stack",[t*.18,n*.46,i*.12],new u(0,n*.46,i*.2),3422267)}function F(e,o={}){const t=new U;t.name=`vehicle-proxy:${e.vehicle}`;const n=e.proxy??(e.vehicle==="drone"?"drone":e.vehicle==="attack_heli"||e.vehicle==="chinook"?"helicopter":e.vehicle==="bradley"?"ground":e.vehicle==="cargo_ship"?"ship":"plane");return n==="drone"?_e(t,e):n==="helicopter"?Oe(t,e):n==="ground"?Ee(t,e):n==="ship"?Fe(t,e):Ve(t,e),Ie(t,e),o.showBounds&&Pe(t),t.rotation.set(e.rotationCorrection.x*Math.PI/180,e.rotationCorrection.y*Math.PI/180,e.rotationCorrection.z*Math.PI/180),t}async function He(e,o){const t=ke(e.modelUrl,o);if(!t)return{object:F(e),usedFallback:!0,resolvedUrl:t};try{const n=await Te(t),i=new U;i.name=`vehicle-glb:${e.vehicle}`;const a=Ae(n);Z(a),i.add(a),i.scale.setScalar(e.scale||1),i.rotation.set(e.rotationCorrection.x*Math.PI/180,e.rotationCorrection.y*Math.PI/180,e.rotationCorrection.z*Math.PI/180),Re(i,e.visualOriginY);const s=G(e.positionCorrection);return i.position.add(s),{object:i,usedFallback:!1,resolvedUrl:t}}catch{return{object:F(e),usedFallback:!0,resolvedUrl:t}}}export{qe as a,He as b,F as c,ye as d,Ce as e,me as g,We as i,de as l,Ge as m,pe as p,fe as r,xe as u};
//# sourceMappingURL=vehicle-preview-B2yNC07B.js.map
