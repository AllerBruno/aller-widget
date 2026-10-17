(()=>{var _=[[10,18,2],[26,46,5],[101,163,13],[163,230,53]].map(a=>a.map(e=>e/255)),h=32,x=1.6,R=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`,T=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_pixelRatio;
uniform vec3 u_colors[4];
uniform vec3 u_seed1;
uniform vec3 u_seed2;

const float TAU = 6.28318530;
const float SCALE = 0.4, TURB_AMP = 0.6, TURB_FREQ = 0.1, WAVE_FREQ = 2.4;
const float DITHER = 0.2, EXPOSURE = 1.1, CONTRAST = 1.1;
const int TURB_ITER = 4;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(0.4545)); }
vec3 linearToOklab(vec3 c) {
  float l = pow(max(0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b, 0.0), 1.0/3.0);
  float m = pow(max(0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b, 0.0), 1.0/3.0);
  float s = pow(max(0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b, 0.0), 1.0/3.0);
  return vec3(0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
              1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
              0.0259040371*l + 0.7827717662*m - 0.8086757660*s);
}
vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774*c.y + 0.2158037573*c.z;
  float m = c.x - 0.1055613458*c.y - 0.0638541728*c.z;
  float s = c.x - 0.0894841775*c.y - 1.2914855480*c.z;
  l = l*l*l; m = m*m*m; s = s*s*s;
  return vec3( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
              -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
              -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
}
// Blend two Oklab colours through LCh, taking the short way round the hue circle
vec3 mixLch(vec3 a, vec3 b, float t) {
  vec3 p = vec3(a.x, length(a.yz), atan(a.z, a.y));
  vec3 q = vec3(b.x, length(b.yz), atan(b.z, b.y));
  if (p.y < 0.05) p.z = q.z;
  if (q.y < 0.05) q.z = p.z;
  float dh = q.z - p.z;
  if (dh > 3.14159265) dh -= TAU;
  if (dh < -3.14159265) dh += TAU;
  float h = p.z + dh * t, C = mix(p.y, q.y, t);
  return vec3(mix(p.x, q.x, t), C * cos(h), C * sin(h));
}
vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  int i = min(int(floor(t)), 2);
  return oklabToLinear(mixLch(linearToOklab(toLinear(u_colors[i])), linearToOklab(toLinear(u_colors[i + 1])), t - float(i)));
}
// Interleaved gradient noise: an even, fine dither that hides banding
float ign(vec2 uv) { return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715)))); }
vec3 gamutMap(vec3 rgb) {
  if (min(rgb.r, min(rgb.g, rgb.b)) >= 0.0 && max(rgb.r, max(rgb.g, rgb.b)) <= 1.0) return rgb;
  vec3 lab = linearToOklab(max(rgb, 0.0));
  float L = clamp(lab.x, 0.0, 1.0), C = length(lab.yz), h = atan(lab.z, lab.y);
  float maxC = 0.4 * (1.0 - pow(abs(2.0 * L - 1.0), 2.0)), knee = maxC * 0.7;
  if (C > knee) C = knee + (maxC - knee) * tanh((C - knee) / (maxC - knee + 0.001));
  return clamp(oklabToLinear(vec3(L, C * cos(h), C * sin(h))), 0.0, 1.0);
}

void main() {
  vec2 frag = v_uv * u_resolution;
  vec2 p = (frag * 2.0 - u_resolution) / u_resolution.y;
  float ang = ${(h*2.3999632).toFixed(6)};
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  vec2 phase = (u_seed2.xy - 0.5) * TAU;
  float t = u_time * 0.3 * ${x.toFixed(2)};
  float freq = 1.0 / TURB_FREQ;

  float total = 0.0, weights = 0.0;
  for (float i = 0.0; i < 4.0; i++) {
    float e = i / 4.0;
    vec2 q = p * SCALE;
    float a = phase.x, d = phase.y;
    for (int j = 2; j < TURB_ITER; j++) {
      float fj = float(j);
      q += TURB_AMP * sin(q.yx / freq * fj + t + vec2(a, d) + u_seed1.xy * fj) / fj;
      a += cos(fj + d * 1.2 + q.x * 2.0 - t + u_seed2.z);
      d += sin(fj * q.y + a + u_seed1.z + t + u_seed2.y);
    }
    float v = 0.5 + 0.5 * sin(length(q.yx + vec2(a, d) * 0.2) * WAVE_FREQ + i * i + u_seed1.x);
    float w = smoothstep(0.0, 0.5, e) * smoothstep(1.0, 0.5, e);
    total += v * w;
    weights += w;
  }
  float val = clamp((total / weights - 0.3) / 0.4, 0.0, 1.0);
  val = clamp(val + (ign(floor(frag / u_pixelRatio)) - 0.5) * DITHER, 0.0, 1.0);

  vec3 lab = linearToOklab(palette(val) * EXPOSURE);
  lab.x = clamp((lab.x - 0.5) * CONTRAST + 0.5, 0.0, 1.0);
  fragColor = vec4(toSrgb(gamutMap(oklabToLinear(lab))), 1.0);
}`;function g(a){let e=new Float32Array(3),n=new Uint32Array(e.buffer);e[0]=a,e[1]=a*1.5+7.31,e[2]=a*2.7+13.37;let t=Array.from(n),l=(o,c)=>Math.imul(o,c)>>>0,r=()=>{t[0]=t[0]+l(t[1],t[2])>>>0,t[1]=t[1]+l(t[2],t[0])>>>0,t[2]=t[2]+l(t[0],t[1])>>>0};for(let o=0;o<3;o++)t[o]=l(t[o],1664525)+1013904223>>>0;r();for(let o=0;o<3;o++)t[o]=(t[o]^t[o]>>>16)>>>0;return r(),t.map(o=>o/4294967295)}function A(a){let e=a.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"low-power"});if(!e)return null;let n=(o,c)=>{let s=e.createShader(o);return e.shaderSource(s,c),e.compileShader(s),s},t=e.createProgram();if(e.attachShader(t,n(e.VERTEX_SHADER,R)),e.attachShader(t,n(e.FRAGMENT_SHADER,T)),e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS))return null;e.useProgram(t),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);let l=e.getAttribLocation(t,"a_pos");e.enableVertexAttribArray(l),e.vertexAttribPointer(l,2,e.FLOAT,!1,0,0);let r=o=>e.getUniformLocation(t,o);return e.uniform3fv(r("u_colors"),_.flat()),e.uniform3fv(r("u_seed1"),g(h)),e.uniform3fv(r("u_seed2"),g(h+100)),{gl:e,time:r("u_time"),resolution:r("u_resolution"),pixelRatio:r("u_pixelRatio")}}function b(a){let e=window.matchMedia("(prefers-reduced-motion: reduce)").matches,n,t=0,l=!1,r=Math.random()*100,o=performance.now(),c=i=>{if(!n)return;let{gl:f}=n,v=Math.min(window.devicePixelRatio||1,2),u=Math.max(1,Math.round(a.clientWidth*v)),m=Math.max(1,Math.round(a.clientHeight*v));(a.width!==u||a.height!==m)&&(a.width=u,a.height=m,f.viewport(0,0,u,m)),f.uniform2f(n.resolution,u,m),f.uniform1f(n.pixelRatio,v),f.uniform1f(n.time,r+(i-o)/1e3),f.drawArrays(f.TRIANGLES,0,3)},s=i=>{c(i),t=requestAnimationFrame(s)},d=()=>{let i=l&&!document.hidden;i&&n===void 0&&(n=A(a),n&&(a.dataset.ready="")),cancelAnimationFrame(t),t=0,!(!i||!n)&&(e?c(performance.now()):t=requestAnimationFrame(s))},p=new IntersectionObserver(([i])=>{l=i.isIntersecting,d()});return p.observe(a),document.addEventListener("visibilitychange",d),()=>{var i;p.disconnect(),document.removeEventListener("visibilitychange",d),cancelAnimationFrame(t),(i=n==null?void 0:n.gl.getExtension("WEBGL_lose_context"))==null||i.loseContext()}}window.mountShaderFill=b;})();
