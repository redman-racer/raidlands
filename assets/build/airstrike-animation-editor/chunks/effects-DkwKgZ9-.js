import{b1 as K,K as B,y as U,J as I,ao as j,I as L,v as X,al as Q,am as Z,ad as ee,b2 as $,b3 as W,j as te}from"./three.module-B3wciJAI.js";import{E as ae,R as re,a as oe,S as ne,U as ie}from"./UnrealBloomPass-njCFpqwj.js";import{J as C,a as y}from"./app-Ck-4pSL2.js";import"./preload-helper-PPVm8Dsz.js";import"./GLTFLoader-DuXpmKSc.js";import"./SkeletonUtils-BCVmgslc.js";class se extends K{constructor(d){super(d),this.type=B}parse(d){const l=function(e,a){switch(e){case 1:throw new Error("THREE.RGBELoader: Read Error: "+(a||""));case 2:throw new Error("THREE.RGBELoader: Write Error: "+(a||""));case 3:throw new Error("THREE.RGBELoader: Bad File Format: "+(a||""));default:case 4:throw new Error("THREE.RGBELoader: Memory Error: "+(a||""))}},f=function(e,a,o){a=a||1024;let c=e.pos,s=-1,t=0,m="",r=String.fromCharCode.apply(null,new Uint16Array(e.subarray(c,c+128)));for(;0>(s=r.indexOf(`
`))&&t<a&&c<e.byteLength;)m+=r,t+=r.length,c+=128,r+=String.fromCharCode.apply(null,new Uint16Array(e.subarray(c,c+128)));return-1<s?(e.pos+=t+s+1,m+r.slice(0,s)):!1},D=function(e){const a=/^#\?(\S+)/,o=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,n=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,c=/^\s*FORMAT=(\S+)\s*$/,s=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,t={valid:0,string:"",comments:"",programtype:"RGBE",format:"",gamma:1,exposure:1,width:0,height:0};let m,r;for((e.pos>=e.byteLength||!(m=f(e)))&&l(1,"no header found"),(r=m.match(a))||l(3,"bad initial token"),t.valid|=1,t.programtype=r[1],t.string+=m+`
`;m=f(e),m!==!1;){if(t.string+=m+`
`,m.charAt(0)==="#"){t.comments+=m+`
`;continue}if((r=m.match(o))&&(t.gamma=parseFloat(r[1])),(r=m.match(n))&&(t.exposure=parseFloat(r[1])),(r=m.match(c))&&(t.valid|=2,t.format=r[1]),(r=m.match(s))&&(t.valid|=4,t.height=parseInt(r[1],10),t.width=parseInt(r[2],10)),t.valid&2&&t.valid&4)break}return t.valid&2||l(3,"missing format specifier"),t.valid&4||l(3,"missing image size specifier"),t},O=function(e,a,o){const n=a;if(n<8||n>32767||e[0]!==2||e[1]!==2||e[2]&128)return new Uint8Array(e);n!==(e[2]<<8|e[3])&&l(3,"wrong scanline width");const c=new Uint8Array(4*a*o);c.length||l(4,"unable to allocate buffer space");let s=0,t=0;const m=4*n,r=new Uint8Array(4),x=new Uint8Array(m);let H=o;for(;H>0&&t<e.byteLength;){t+4>e.byteLength&&l(1),r[0]=e[t++],r[1]=e[t++],r[2]=e[t++],r[3]=e[t++],(r[0]!=2||r[1]!=2||(r[2]<<8|r[3])!=n)&&l(3,"bad rgbe scanline format");let S=0,_;for(;S<m&&t<e.byteLength;){_=e[t++];const v=_>128;if(v&&(_-=128),(_===0||S+_>m)&&l(3,"bad scanline data"),v){const E=e[t++];for(let V=0;V<_;V++)x[S++]=E}else x.set(e.subarray(t,t+_),S),S+=_,t+=_}const q=n;for(let v=0;v<q;v++){let E=0;c[s]=x[v+E],E+=n,c[s+1]=x[v+E],E+=n,c[s+2]=x[v+E],E+=n,c[s+3]=x[v+E],s+=4}H--}return c},Y=function(e,a,o,n){const c=e[a+3],s=Math.pow(2,c-128)/255;o[n+0]=e[a+0]*s,o[n+1]=e[a+1]*s,o[n+2]=e[a+2]*s,o[n+3]=1},J=function(e,a,o,n){const c=e[a+3],s=Math.pow(2,c-128)/255;o[n+0]=I.toHalfFloat(Math.min(e[a+0]*s,65504)),o[n+1]=I.toHalfFloat(Math.min(e[a+1]*s,65504)),o[n+2]=I.toHalfFloat(Math.min(e[a+2]*s,65504)),o[n+3]=I.toHalfFloat(1)},b=new Uint8Array(d);b.pos=0;const F=D(b),k=F.width,z=F.height,M=O(b.subarray(b.pos),k,z);let G,A,R;switch(this.type){case U:R=M.length/4;const e=new Float32Array(R*4);for(let o=0;o<R;o++)Y(M,o*4,e,o*4);G=e,A=U;break;case B:R=M.length/4;const a=new Uint16Array(R*4);for(let o=0;o<R;o++)J(M,o*4,a,o*4);G=a,A=B;break;default:throw new Error("THREE.RGBELoader: Unsupported type: "+this.type)}return{width:k,height:z,data:G,header:F.string,gamma:F.gamma,exposure:F.exposure,type:A}}setDataType(d){return this.type=d,this}load(d,g,i,p){function h(l,P){switch(l.type){case U:case B:l.colorSpace=j,l.minFilter=L,l.magFilter=L,l.generateMipmaps=!1,l.flipY=!0;break}g&&g(l,P)}return super.load(d,h,i,p)}}const le={uniforms:{tDiffuse:{value:null},tDepth:{value:null},cameraNear:{value:.05},cameraFar:{value:60},cameraProjectionMatrixInverse:{value:null},cameraWorldMatrix:{value:null},fogTime:{value:0},fogDensity:{value:y.volumetricDensity}},vertexShader:`
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
        length(point.xz - vec2(${C[0]}, 0.0)),
        min(
          length(point.xz - vec2(${C[1].toFixed(1)}, 0.0)),
          length(point.xz - vec2(${C[2]}, 0.0))
        )
      );
      return 1.0 - smoothstep(${y.podiumInnerRadius.toFixed(1)}, ${y.podiumOuterRadius.toFixed(1)}, distanceToPodium);
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
        float mainBank = 1.0 - smoothstep(${y.fullBankHeight.toFixed(2)}, ${y.bankFadeHeight.toFixed(2)}, point.y);
        float highWisps = (1.0 - smoothstep(${y.wispStartHeight.toFixed(2)}, ${y.wispFadeHeight.toFixed(1)}, point.y))
          * ${y.wispStrength.toFixed(2)};
        float vertical = groundEntry * max(mainBank, highWisps);
        float noiseValue = smoothstep(.27, .82, flowingNoise(point));
        float podiumBoost = podiumFogInfluence(point);
        integratedDensity += horizontal * vertical * (.12 + noiseValue * .88) * (.62 + podiumBoost * 1.25);
      }
      float stepLength = rayLength / float(STEPS);
      float fogAmount = min(${y.volumetricOpacityCeiling.toFixed(2)}, 1.0 - exp(-integratedDensity * stepLength * .075 * fogDensity));
      vec3 fogColor = vec3(.30, .335, .325);
      gl_FragColor = vec4(mix(sceneColor.rgb, fogColor, fogAmount), sceneColor.a);
    }
  `};function fe(T,d){const g=new se().parse(d),i=new X(g.data,g.width,g.height);i.type=g.type,i.colorSpace=j,i.minFilter=L,i.magFilter=L,i.generateMipmaps=!1,i.flipY=!0,i.needsUpdate=!0,i.mapping=Q;const p=new Z(T);p.compileEquirectangularShader();const h=p.fromEquirectangular(i);return p.dispose(),{source:i,target:h}}function ue(T){const{renderer:d,scene:g,camera:i,width:p,height:h,mobile:l,volumetric:P}=T,N=new ee(p,h,{depthBuffer:!0}),w=new ae(d,N);w.renderTarget1.depthTexture=new $(p,h,W),w.renderTarget2.depthTexture=new $(p,h,W),w.addPass(new re(g,i));let u;P&&(u=new oe(le),u.uniforms.cameraNear.value=i.near,u.uniforms.cameraFar.value=i.far,u.uniforms.cameraProjectionMatrixInverse.value=i.projectionMatrixInverse,u.uniforms.cameraWorldMatrix.value=i.matrixWorld,u.enabled=!1,w.addPass(u));let f;l||(f=new ne(g,i,p,h),f.kernelRadius=5,f.minDistance=5e-4,f.maxDistance=.045,f.enabled=!1,w.addPass(f));const D=new ie(new te(p,h),.16,.65,1.15);return D.enabled=!1,w.addPass(D),{composer:w,volumetricFogPass:u,ssaoPass:f,bloomPass:D}}export{fe as buildPodiumEnvironment,ue as createPodiumEffects};
//# sourceMappingURL=effects-DkwKgZ9-.js.map
