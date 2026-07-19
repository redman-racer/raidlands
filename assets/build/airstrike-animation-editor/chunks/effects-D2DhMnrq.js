import{b3 as K,K as B,y as U,J as I,ar as j,I as G,ai as X,b4 as $,b5 as W,j as Q,P as Z,b as ee,aq as ae,v as te,ap as re}from"./three.module-BIqZKwtq.js";import{E as oe,R as ne,a as ie,S as se,U as le}from"./UnrealBloomPass-DqHemSWc.js";import{J as H,a as E}from"./app-DcQE1WMg.js";import"./preload-helper-PPVm8Dsz.js";import"./GLTFLoader-BHYly08j.js";import"./SkeletonUtils-BCVmgslc.js";class ce extends K{constructor(g){super(g),this.type=B}parse(g){const c=function(e,r){switch(e){case 1:throw new Error("THREE.RGBELoader: Read Error: "+(r||""));case 2:throw new Error("THREE.RGBELoader: Write Error: "+(r||""));case 3:throw new Error("THREE.RGBELoader: Bad File Format: "+(r||""));default:case 4:throw new Error("THREE.RGBELoader: Memory Error: "+(r||""))}},p=function(e,r,n){r=r||1024;let m=e.pos,s=-1,t=0,d="",o=String.fromCharCode.apply(null,new Uint16Array(e.subarray(m,m+128)));for(;0>(s=o.indexOf(`
`))&&t<r&&m<e.byteLength;)d+=o,t+=o.length,m+=128,o+=String.fromCharCode.apply(null,new Uint16Array(e.subarray(m,m+128)));return-1<s?(e.pos+=t+s+1,d+o.slice(0,s)):!1},b=function(e){const r=/^#\?(\S+)/,n=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,i=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,m=/^\s*FORMAT=(\S+)\s*$/,s=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,t={valid:0,string:"",comments:"",programtype:"RGBE",format:"",gamma:1,exposure:1,width:0,height:0};let d,o;for((e.pos>=e.byteLength||!(d=p(e)))&&c(1,"no header found"),(o=d.match(r))||c(3,"bad initial token"),t.valid|=1,t.programtype=o[1],t.string+=d+`
`;d=p(e),d!==!1;){if(t.string+=d+`
`,d.charAt(0)==="#"){t.comments+=d+`
`;continue}if((o=d.match(n))&&(t.gamma=parseFloat(o[1])),(o=d.match(i))&&(t.exposure=parseFloat(o[1])),(o=d.match(m))&&(t.valid|=2,t.format=o[1]),(o=d.match(s))&&(t.valid|=4,t.height=parseInt(o[1],10),t.width=parseInt(o[2],10)),t.valid&2&&t.valid&4)break}return t.valid&2||c(3,"missing format specifier"),t.valid&4||c(3,"missing image size specifier"),t},O=function(e,r,n){const i=r;if(i<8||i>32767||e[0]!==2||e[1]!==2||e[2]&128)return new Uint8Array(e);i!==(e[2]<<8|e[3])&&c(3,"wrong scanline width");const m=new Uint8Array(4*r*n);m.length||c(4,"unable to allocate buffer space");let s=0,t=0;const d=4*i,o=new Uint8Array(4),x=new Uint8Array(d);let k=n;for(;k>0&&t<e.byteLength;){t+4>e.byteLength&&c(1),o[0]=e[t++],o[1]=e[t++],o[2]=e[t++],o[3]=e[t++],(o[0]!=2||o[1]!=2||(o[2]<<8|o[3])!=i)&&c(3,"bad rgbe scanline format");let M=0,f;for(;M<d&&t<e.byteLength;){f=e[t++];const v=f>128;if(v&&(f-=128),(f===0||M+f>d)&&c(3,"bad scanline data"),v){const _=e[t++];for(let V=0;V<f;V++)x[M++]=_}else x.set(e.subarray(t,t+f),M),M+=f,t+=f}const J=i;for(let v=0;v<J;v++){let _=0;m[s]=x[v+_],_+=i,m[s+1]=x[v+_],_+=i,m[s+2]=x[v+_],_+=i,m[s+3]=x[v+_],s+=4}k--}return m},Y=function(e,r,n,i){const m=e[r+3],s=Math.pow(2,m-128)/255;n[i+0]=e[r+0]*s,n[i+1]=e[r+1]*s,n[i+2]=e[r+2]*s,n[i+3]=1},q=function(e,r,n,i){const m=e[r+3],s=Math.pow(2,m-128)/255;n[i+0]=I.toHalfFloat(Math.min(e[r+0]*s,65504)),n[i+1]=I.toHalfFloat(Math.min(e[r+1]*s,65504)),n[i+2]=I.toHalfFloat(Math.min(e[r+2]*s,65504)),n[i+3]=I.toHalfFloat(1)},D=new Uint8Array(g);D.pos=0;const T=b(D),C=T.width,N=T.height,S=O(D.subarray(D.pos),C,N);let L,A,R;switch(this.type){case U:R=S.length/4;const e=new Float32Array(R*4);for(let n=0;n<R;n++)Y(S,n*4,e,n*4);L=e,A=U;break;case B:R=S.length/4;const r=new Uint16Array(R*4);for(let n=0;n<R;n++)q(S,n*4,r,n*4);L=r,A=B;break;default:throw new Error("THREE.RGBELoader: Unsupported type: "+this.type)}return{width:C,height:N,data:L,header:T.string,gamma:T.gamma,exposure:T.exposure,type:A}}setDataType(g){return this.type=g,this}load(g,l,h,y){function w(c,F){switch(c.type){case U:case B:c.colorSpace=j,c.minFilter=G,c.magFilter=G,c.generateMipmaps=!1,c.flipY=!0;break}l&&l(c,F)}return super.load(g,w,h,y)}}const me={uniforms:{tDiffuse:{value:null},tDepth:{value:null},cameraNear:{value:.05},cameraFar:{value:60},cameraProjectionMatrixInverse:{value:null},cameraWorldMatrix:{value:null},fogTime:{value:0},fogDensity:{value:E.volumetricDensity}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
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
        length(point.xz - vec2(${H[0]}, 0.0)),
        min(
          length(point.xz - vec2(${H[1].toFixed(1)}, 0.0)),
          length(point.xz - vec2(${H[2]}, 0.0))
        )
      );
      return 1.0 - smoothstep(${E.podiumInnerRadius.toFixed(1)}, ${E.podiumOuterRadius.toFixed(1)}, distanceToPodium);
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
        float mainBank = 1.0 - smoothstep(${E.fullBankHeight.toFixed(2)}, ${E.bankFadeHeight.toFixed(2)}, point.y);
        float highWisps = (1.0 - smoothstep(${E.wispStartHeight.toFixed(2)}, ${E.wispFadeHeight.toFixed(1)}, point.y))
          * ${E.wispStrength.toFixed(2)};
        float vertical = groundEntry * max(mainBank, highWisps);
        float noiseValue = smoothstep(.27, .82, flowingNoise(point));
        float podiumBoost = podiumFogInfluence(point);
        integratedDensity += horizontal * vertical * (.12 + noiseValue * .88) * (.62 + podiumBoost * 1.25);
      }
      float stepLength = rayLength / float(STEPS);
      float fogAmount = min(${E.volumetricOpacityCeiling.toFixed(2)}, 1.0 - exp(-integratedDensity * stepLength * .075 * fogDensity));
      vec3 fogColor = vec3(.30, .335, .325);
      gl_FragColor = vec4(mix(sceneColor.rgb, fogColor, fogAmount), sceneColor.a);
    }
  `};function ve(a){const g=new ce().parse(a),l=new te(g.data,g.width,g.height);return l.type=g.type,l.colorSpace=j,l.minFilter=G,l.magFilter=G,l.generateMipmaps=!1,l.flipY=!0,l.needsUpdate=!0,l.mapping=re,l}function _e(a){return new ae(a)}function Ee(a){a.compileEquirectangularShader()}function ye(a,g){try{return a.fromEquirectangular(g)}finally{a.dispose()}}function we(a){const{renderer:g,scene:l,camera:h,width:y,height:w,mobile:c,volumetric:F}=a,z=new X(y,w,{depthBuffer:!0}),P=new oe(g,z);P.renderTarget1.depthTexture=new $(y,w,W),P.renderTarget2.depthTexture=new $(y,w,W),P.addPass(new ne(l,h));let u;F&&(u=new ie(me),u.uniforms.cameraNear.value=h.near,u.uniforms.cameraFar.value=h.far,u.uniforms.cameraProjectionMatrixInverse.value=h.projectionMatrixInverse,u.uniforms.cameraWorldMatrix.value=h.matrixWorld,u.enabled=!1,P.addPass(u));let p;c||(p=new se(l,h,y,w),p.kernelRadius=5,p.minDistance=5e-4,p.maxDistance=.045,p.enabled=!1,P.addPass(p));const b=new le(new Q(y,w),.16,.65,1.15);return b.enabled=!1,P.addPass(b),{composer:P,volumetricFogPass:u,ssaoPass:p,bloomPass:b}}function Pe(a){return[a.composer.renderTarget1,a.composer.renderTarget2,a.bloomPass.renderTargetBright,...a.bloomPass.renderTargetsHorizontal,...a.bloomPass.renderTargetsVertical,...a.ssaoPass?[a.ssaoPass.normalRenderTarget,a.ssaoPass.ssaoRenderTarget,a.ssaoPass.blurRenderTarget]:[]]}function Re(a){const g=[...a.volumetricFogPass?[a.volumetricFogPass.material]:[],a.bloomPass.materialHighPassFilter,...a.bloomPass.separableBlurMaterials,a.bloomPass.compositeMaterial,a.bloomPass.blendMaterial,a.bloomPass.basic,...a.ssaoPass?[a.ssaoPass.ssaoMaterial,a.ssaoPass.normalMaterial,a.ssaoPass.blurMaterial,a.ssaoPass.depthRenderMaterial,a.ssaoPass.copyMaterial]:[]],l=new Z(2,2);return{objects:[...new Set(g)].map(h=>new ee(l,h)),dispose:()=>l.dispose()}}export{Ee as compilePodiumEnvironmentShader,we as createPodiumEffects,Re as createPodiumEffectsWarmup,_e as createPodiumEnvironmentGenerator,ve as parsePodiumEnvironment,Pe as podiumEffectsRenderTargets,ye as renderPodiumEnvironment};
//# sourceMappingURL=effects-D2DhMnrq.js.map
