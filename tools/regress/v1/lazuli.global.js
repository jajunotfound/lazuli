var Lazuli=(function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t=`
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`,n=`
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform vec2 u_vel;
uniform float u_active; uniform float u_count; uniform float u_size;
uniform float u_soft; uniform float u_pull; uniform float u_grain;
uniform vec3 u_deep; uniform vec3 u_mid; uniform vec3 u_bg;
// Per blob: (center.x in uv, center.y, radius, x-squash) and (orbit f1, f2, amplitude, phase).
uniform vec4 u_blob[6];
uniform vec4 u_orbit[6];

// Fitted to Paper frame 01.
const float FALLOFF = 1.8;   // >1 flattens each blob's top and steepens its edge
const float CORE_LO = 0.525; // field where the core color starts
const float CORE_HI = 1.54;  // field where it's fully core

float hash(float n) { return fract(sin(n) * 43758.5453123); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(dot(i, vec2(1.0, 57.0)));
  float b = hash(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = hash(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0)));
  float d = hash(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);

  // pointer: push away (u_pull > 0) or pull in (u_pull < 0), smear along motion.
  // Displacement scales with d itself, not normalize(d), so it fades to zero at the
  // pointer instead of flipping direction at full strength (a sharp notch). The
  // radial map is r * (1 + k * exp(-r^2/s)); k must stay below 1 or a full pull folds
  // the center inside out. 0.9 peaks at r ~ 0.15, matching the old push there.
  vec2 d = p - m;
  float fall = exp(-dot(d, d) / 0.045) * u_active;
  p += d * fall * 0.9 * u_pull;
  p -= vec2(u_vel.x * aspect, u_vel.y) * fall * 1.6;

  // slow organic wobble on the edges
  float t = u_time;
  p += 0.035 * vec2(noise(p * 3.0 + t * 0.4), noise(p * 3.0 - t * 0.4 + 7.0)) - 0.0175;

  float field = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_count) break;
    vec4 b = u_blob[i];
    vec4 o = u_orbit[i];
    float p1 = o.w;
    float p2 = o.w * 1.3 + 1.7;
    float p3 = o.w * 0.7 + 2.9;
    // Orbits are offset so every blob starts exactly at its layout position (t = 0).
    vec2 c = vec2(b.x * aspect, b.y) + vec2(sin(t * o.x + p1) - sin(p1), cos(t * o.y + p2) - cos(p2)) * o.z;
    float r = b.z * u_size;
    vec2 q = p - c;
    q.x *= b.w * (1.0 + 0.12 * (sin(t * 0.3 + p3) - sin(p3)));
    field += exp(-pow(dot(q, q) / (r * r) + 1e-6, FALLOFF));
  }

  // Softness widens the edge band; past the point where it would tint the ground,
  // only the outer side keeps growing, so high values read as haze.
  float lo = max(0.5 - u_soft * 0.45, 0.0);
  float hi = 0.5 + u_soft * 0.45;
  float e = smoothstep(lo, hi, field);
  float core = smoothstep(CORE_LO, CORE_HI, field);
  vec3 col = mix(u_bg, u_mid, e);
  col = mix(col, u_deep, core);
  col = mix(col, u_bg * 1.02, smoothstep(0.55, 1.0, length(uv - 0.5)) * 0.35);
  float g = hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + fract(t)) - 0.5;
  col += g * u_grain;
  gl_FragColor = vec4(col, 1.0);
}
`;function r(e){let t=Math.imul(Math.round(e*1e3)|0,2654435761)^2246822507;return()=>{t=t+1831565813|0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function i(e){let t=r(e),n=(e,n)=>e+(n-e)*t(),i=()=>t()<.5?-1:1,a=(e,t)=>({f1:n(.3,.8),f2:n(.3,.8),amp:n(e,t),phase:n(0,Math.PI*2)}),o={x:n(.3,.7),y:n(.35,.65),r:n(.22,.32),fx:n(.75,1.35),...a(.04,.09)},s={x:o.x+i()*n(.05,.16),y:o.y+i()*n(.06,.2),r:n(.16,.26),fx:n(.5,1.3),...a(.04,.09)},c=n(0,Math.PI*2),l=n(.18,.3),u=[o,s,{x:o.x+Math.cos(c)*l,y:o.y+Math.sin(c)*l,r:n(.045,.085),fx:n(.9,1.1),...a(.06,.12)}];for(;u.length<6;)u.push({x:n(.2,.8),y:n(.2,.8),r:n(.08,.24),fx:n(.7,1.3),...a(.05,.12)});return u}function a(e){let t=new Float32Array(24),n=new Float32Array(24);return e.forEach((e,r)=>{t.set([e.x,e.y,e.r,e.fx],r*4),n.set([e.f1,e.f2,e.amp,e.phase],r*4)}),{blob:t,orbit:n}}var o=Object.freeze({core:`#1f48a8`,edge:`#4c78d8`,ground:`#ffffff`,count:3,size:100,softness:50,texture:35,speed:.35,cursor:`push`,strength:60,seed:7226165.5}),s={count:[1,6],size:[40,160],softness:[0,100],texture:[0,100],speed:[0,1.5],strength:[0,100]},c=Object.keys(o),l=(e,t,n)=>Math.min(n,Math.max(t,e));function u(e,t){let n=typeof e==`string`?parseFloat(e):e;return typeof n==`number`&&Number.isFinite(n)?n:t}var d=/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;function f(e,t){if(typeof e!=`string`)return t;let n=e.trim().match(d);if(!n)return t;let r=n[1].toLowerCase();return r.length===3&&(r=r.replace(/./g,e=>e+e)),`#`+r}function p(e){let t=parseInt(f(e,`#000000`).slice(1),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function m(e,t=o){let n={...t};return e.core!=null&&(n.core=f(e.core,t.core)),e.edge!=null&&(n.edge=f(e.edge,t.edge)),e.ground!=null&&(n.ground=f(e.ground,t.ground)),e.count!=null&&(n.count=Math.round(l(u(e.count,t.count),...s.count))),e.size!=null&&(n.size=l(u(e.size,t.size),...s.size)),e.softness!=null&&(n.softness=l(u(e.softness,t.softness),...s.softness)),e.texture!=null&&(n.texture=l(u(e.texture,t.texture),...s.texture)),e.speed!=null&&(n.speed=l(u(e.speed,t.speed),...s.speed)),e.strength!=null&&(n.strength=l(u(e.strength,t.strength),...s.strength)),e.seed!=null&&(n.seed=u(e.seed,t.seed)),e.cursor!=null&&(n.cursor=e.cursor===`pull`?`pull`:`push`),n}var h=.91,g=.07,_=.02,v=2.16;function y(e){return{deep:p(e.core),mid:p(e.edge),bg:p(e.ground),count:e.count,size:e.size/100*h,soft:_+e.softness/100*v,grain:e.texture/100*g,pull:(e.cursor===`pull`?-1:1)*(e.strength/100)}}var ee=[`u_res`,`u_time`,`u_mouse`,`u_vel`,`u_active`,`u_count`,`u_size`,`u_soft`,`u_pull`,`u_grain`,`u_deep`,`u_mid`,`u_bg`,`u_blob`,`u_orbit`],b=2,te=.05,ne=1/1e3,re=.05,x=(e,t)=>1-(1-e)**t;function S(){return Math.round(Math.random()*1e8)/10}function C(e,r={}){let o=m(r),s=r.respectReducedMotion??!0,c=!(e instanceof HTMLCanvasElement),l=c?document.createElement(`canvas`):e,u=e.style.position;c&&(l.setAttribute(`aria-hidden`,`true`),Object.assign(l.style,{position:`absolute`,inset:`0`,width:`100%`,height:`100%`,display:`block`,pointerEvents:`none`}),getComputedStyle(e).position===`static`&&(e.style.position=`relative`),e.prepend(l)),l.style.backgroundColor=o.ground;let d=null,f={},p=null,h=null,g=a(i(o.seed)),_=o.seed;function v(){let e={antialias:!1,alpha:!1,depth:!1,stencil:!1,powerPreference:`low-power`};if(d=l.getContext(`webgl2`,e)??l.getContext(`webgl`,e),!d)return!1;let r=w(d,d.VERTEX_SHADER,t),i=w(d,d.FRAGMENT_SHADER,n);if(!r||!i)return!1;if(p=d.createProgram(),d.attachShader(p,r),d.attachShader(p,i),d.linkProgram(p),d.deleteShader(r),d.deleteShader(i),!d.getProgramParameter(p,d.LINK_STATUS))return console.error(`[lazuli] Shader program failed to link:`,d.getProgramInfoLog(p)),!1;d.useProgram(p),h=d.createBuffer(),d.bindBuffer(d.ARRAY_BUFFER,h),d.bufferData(d.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),d.STATIC_DRAW);let a=d.getAttribLocation(p,`a_pos`);d.enableVertexAttribArray(a),d.vertexAttribPointer(a,2,d.FLOAT,!1,0,0),f={};for(let e of ee)f[e]=d.getUniformLocation(p,e);return C(),!0}function C(){if(!d)return;let e=y(o);d.uniform3fv(f.u_deep,e.deep),d.uniform3fv(f.u_mid,e.mid),d.uniform3fv(f.u_bg,e.bg),d.uniform1f(f.u_count,e.count),d.uniform1f(f.u_size,e.size),d.uniform1f(f.u_soft,e.soft),d.uniform1f(f.u_grain,e.grain),d.uniform1f(f.u_pull,e.pull),_!==o.seed&&(g=a(i(o.seed)),_=o.seed),d.uniform4fv(f.u_blob,g.blob),d.uniform4fv(f.u_orbit,g.orbit)}let T=v();T||console.warn(`[lazuli] WebGL is unavailable, so the background shows the ground color only.`);let E=1,D=1;function O(){let e=Math.min(window.devicePixelRatio||1,b),t=Math.max(1,Math.round(l.clientWidth*e)),n=Math.max(1,Math.round(l.clientHeight*e));(t!==E||n!==D)&&(E=t,D=n,l.width=t,l.height=n,G=!0)}let k={x:.5,y:.5},A={x:.5,y:.5},j={x:0,y:0},M=0,N=!1,P=!1;function F(e){let t=l.getBoundingClientRect();if(t.width===0||t.height===0)return!1;let n=(e.clientX-t.left)/t.width,r=(e.clientY-t.top)/t.height,i=n>=0&&n<=1&&r>=0&&r<=1;return(i||P)&&(k.x=n,k.y=1-r,M<.01&&(A.x=k.x,A.y=k.y)),i}let I=e=>{let t=F(e);e.pointerType!==`touch`&&(N=t)},L=e=>{e.pointerType===`touch`&&(P=!1,P=F(e))},R=e=>{e.pointerType===`touch`&&(P=!1)},z=e=>{!e.relatedTarget&&e.pointerType!==`touch`&&(N=!1)};window.addEventListener(`pointermove`,I,{passive:!0}),window.addEventListener(`pointerdown`,L,{passive:!0}),window.addEventListener(`pointerup`,R,{passive:!0}),window.addEventListener(`pointercancel`,R,{passive:!0}),document.addEventListener(`pointerout`,z,{passive:!0});let B=typeof matchMedia==`function`?matchMedia(`(prefers-reduced-motion: reduce)`):null,V=()=>s&&B?.matches?Math.min(o.speed,re):o.speed,H=0,U=0,W=0,G=!0,K=!0,q=!1;function J(e){W=requestAnimationFrame(J);let t=U?Math.min(Math.max((e-U)/1e3,ne),te):1/60;U=e;let n=t*60,r=V();H+=t*r;let i=A.x,a=A.y,o=x(.12,n);A.x+=(k.x-A.x)*o,A.y+=(k.y-A.y)*o;let s=x(.25,n);j.x+=((A.x-i)/n-j.x)*s,j.y+=((A.y-a)/n-j.y)*s,(!Number.isFinite(j.x)||!Number.isFinite(j.y))&&(j.x=j.y=0),M+=((N||P?1:0)-M)*x(.06,n),M<1e-4&&(M=0),!(r===0&&M===0&&Math.abs(j.x)+Math.abs(j.y)<1e-6&&!G)&&ie()}function ie(){d&&(G=!1,d.viewport(0,0,E,D),d.uniform2f(f.u_res,E,D),d.uniform1f(f.u_time,H),d.uniform2f(f.u_mouse,A.x,A.y),d.uniform2f(f.u_vel,j.x,j.y),d.uniform1f(f.u_active,M),d.drawArrays(d.TRIANGLES,0,3))}function Y(){let e=T&&!q&&K&&document.visibilityState!==`hidden`&&d!==null;e&&!W?(U=0,W=requestAnimationFrame(J)):!e&&W&&(cancelAnimationFrame(W),W=0)}let X=typeof ResizeObserver==`function`?new ResizeObserver(O):null;X?.observe(l),X||window.addEventListener(`resize`,O),O();let Z=typeof IntersectionObserver==`function`?new IntersectionObserver(e=>{K=e[e.length-1].isIntersecting,Y()}):null;Z?.observe(l),document.addEventListener(`visibilitychange`,Y);let Q=e=>{e.preventDefault(),d=null,Y()},$=()=>{v()&&(G=!0,Y())};return l.addEventListener(`webglcontextlost`,Q),l.addEventListener(`webglcontextrestored`,$),Y(),{set(e){q||(o=m(e,o),e.respectReducedMotion!==void 0&&(s=e.respectReducedMotion),l.style.backgroundColor=o.ground,C(),G=!0)},shuffle(){let e=S();return this.set({seed:e}),e},get params(){return o},canvas:l,destroy(){q||(q=!0,Y(),window.removeEventListener(`pointermove`,I),window.removeEventListener(`pointerdown`,L),window.removeEventListener(`pointerup`,R),window.removeEventListener(`pointercancel`,R),document.removeEventListener(`pointerout`,z),document.removeEventListener(`visibilitychange`,Y),window.removeEventListener(`resize`,O),X?.disconnect(),Z?.disconnect(),l.removeEventListener(`webglcontextlost`,Q),l.removeEventListener(`webglcontextrestored`,$),d&&(d.deleteBuffer(h),d.deleteProgram(p),d.getExtension(`WEBGL_lose_context`)?.loseContext(),d=null),c&&(l.remove(),e.style.position=u))}}}function w(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.error(`[lazuli] Shader failed to compile:`,e.getShaderInfoLog(r)),e.deleteShader(r),null)}function T(e,t){if(t.has(e))throw TypeError(`Cannot initialize the same private elements twice on an object`)}function E(e,t){T(e,t),t.add(e)}function D(e,t,n){T(e,t),t.set(e,n)}function O(e,t,n){if(typeof e==`function`?e===t:e.has(t))return arguments.length<3?t:n;throw TypeError(`Private element is not present on this object`)}function k(e,t,n){return e.set(O(e,t),n),n}function A(e,t){return e.get(O(e,t))}var j=`lazuli-bg`,M=[...c,`reduced-motion`],N=typeof HTMLElement>`u`?class{}:HTMLElement,P=new WeakMap,F=new WeakMap,I=new WeakSet,L=class extends N{static get observedAttributes(){return M}constructor(){super(),E(this,I),D(this,P,null),D(this,F,void 0);let e=this.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=`
      :host { display: block; position: absolute; inset: 0; z-index: -1; overflow: hidden; }
      :host([hidden]) { display: none; }
      div { position: absolute; inset: 0; }
    `,k(F,this,document.createElement(`div`)),e.append(t,A(F,this))}get instance(){return A(P,this)}connectedCallback(){A(P,this)||k(P,this,C(A(F,this),{...O(I,this,R).call(this),respectReducedMotion:this.getAttribute(`reduced-motion`)!==`ignore`}))}disconnectedCallback(){A(P,this)?.destroy(),k(P,this,null)}attributeChangedCallback(e,t,n){A(P,this)&&(e===`reduced-motion`?A(P,this).set({respectReducedMotion:n!==`ignore`}):n!==null&&A(P,this).set({[e]:n}))}shuffle(){let e=A(P,this)?.shuffle()??0;return this.setAttribute(`seed`,String(e)),e}};function R(){let e={};for(let t of c){let n=this.getAttribute(t);n!==null&&(e[t]=n)}return e}function z(e=j){typeof customElements>`u`||customElements.get(e)||customElements.define(e,class extends L{})}return z(),e.DEFAULTS=o,e.LazuliElement=L,e.PARAM_KEYS=c,e.RANGES=s,e.TAG_NAME=j,e.createLazuli=C,e.defineLazuliElement=z,e.layoutFromSeed=i,e.normalizeHex=f,e.randomSeed=S,e.resolveParams=m,e})({});
//# sourceMappingURL=lazuli.global.js.map