/* =====================================================================
   LiveKit Startups hero — shader runtime
   Extracted from the designer's shader tool (shader-tool-startups.html,
   preset "Default — LiveKit Startups"). Editor UI removed; the render
   pipeline, GLSL, and preset values are unchanged.

   Pipeline (effects are filters, run bottom-up on the text layer):
     text (stroke-only wordmark) -> Refract (travelling band, ribbed)
                                 -> Gradient Tint (cyan -> blue)
                                 -> Chroma Flow (mouse-driven colour)
   ===================================================================== */
(function () {
  "use strict";

  // ---------------- preset (verbatim from buildInitialProject) ----------------
  const PRESET = {
    loopSeconds: 10,
    text: {
      text: "STARTUPS",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 500,
      fontSize: 300,
      letterSpacing: 2,
      strokeColor: "#6E757A",
      strokeWeight: 4,
      // layer box, % of canvas. Tool default is 80x26 on 16:9; the hero canvas
      // is 4:1 so the same texture aspect is preserved with a centred box.
      box: { x: 7.05, y: 7.05, w: 85.9, h: 85.9 },
    },
    refract: {
      profile: 0,            // ribbed
      angle: 70, frequency: 18, strength: 1.1, softness: 0.3, aberration: 0.55,
      ribDrift: 0.2, sweepMode: 1, bandWidth: 0.3, bandSoftness: 0.65, bandSpeed: 0.1,
      glow: 0.45, glowColor: "#1FD5F9", glowSpread: 2.5, amount: 1.0,
    },
    tint: {
      stops: [{ pos: 15, color: "#1FD5F9" }, { pos: 85, color: "#002CF2" }],
      angle: 0, amount: 0.18, mode: 0,   // tint
    },
    flow: {
      up: "#1FD5F9", down: "#002CF2", left: "#0A259F", right: "#88E5FB",
      radius: 0.45, intensity: 0.9, momentum: 30, mode: 0,   // add
    },
  };

  // ---------------- GLSL (verbatim) ----------------
  const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv=a_pos*0.5+0.5; gl_Position=vec4(a_pos,0.0,1.0); }`;

  const RECT_GLSL = `
uniform vec2 u_resolution; uniform vec4 u_rect; uniform float u_rotation; uniform float u_cornerRadius;
float rectCoverage(vec2 uv, out vec2 localUV){
  vec2 center = u_rect.xy + u_rect.zw*0.5;
  vec2 p = (uv-center)*u_resolution;
  float rad = radians(-u_rotation); float c=cos(rad), s=sin(rad);
  vec2 pr = vec2(p.x*c-p.y*s, p.x*s+p.y*c);
  vec2 halfSize = u_rect.zw*0.5*u_resolution;
  localUV = (pr/max(halfSize,vec2(0.0001)))*0.5+0.5;
  vec2 q = abs(pr) - halfSize + vec2(u_cornerRadius);
  float dist = length(max(q,0.0)) + min(max(q.x,q.y),0.0) - u_cornerRadius;
  return 1.0-smoothstep(-1.0,1.0,dist);
}`;

  const FRAG_IMAGE = `precision highp float; varying vec2 v_uv;` + RECT_GLSL + `
uniform sampler2D u_tex; uniform int u_objectFit; uniform vec2 u_texSize;
void main(){
  vec2 lu; float cov=rectCoverage(v_uv,lu); vec2 uv=lu;
  if (u_objectFit==1 || u_objectFit==2){
    float rectAR=(u_rect.z*u_resolution.x)/max(u_rect.w*u_resolution.y,0.0001);
    float texAR=u_texSize.x/max(u_texSize.y,0.0001); vec2 scale=vec2(1.0);
    if ((u_objectFit==1 && texAR>rectAR)||(u_objectFit==2 && texAR<rectAR)) scale=vec2(rectAR/texAR,1.0);
    else scale=vec2(1.0, texAR/rectAR);
    uv=(uv-0.5)*scale+0.5;
  }
  vec4 t=texture2D(u_tex, vec2(uv.x,1.0-uv.y));
  float inb=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
  gl_FragColor=vec4(t.rgb, t.a*cov*inb);
}`;

  const FRAG_REFRACT = `precision highp float; varying vec2 v_uv;
uniform sampler2D u_src; uniform vec2 u_resolution; uniform float u_time;
uniform int u_profile;
uniform float u_angle, u_frequency, u_strength, u_softness, u_aberration, u_ribDrift;
uniform int u_sweepMode;
uniform float u_bandWidth, u_bandSoftness, u_bandSpeed;
uniform float u_glow, u_glowSpread; uniform vec3 u_glowColor;
uniform float u_amount;
const float TAU = 6.28318530718;
float ribDisplace(float t, int p){
  if (p==0) return t*2.0-1.0;
  if (p==1) return sin(t*TAU);
  if (p==2) return (t<0.5) ? (t*4.0-1.0) : (3.0-t*4.0);
  return sin(t*TAU)*0.6 + sin(t*2.0*TAU)*0.4;
}
void main(){
  vec2 uv = v_uv;
  float aspect = u_resolution.x/u_resolution.y;
  float a = radians(u_angle);
  vec2 dir  = vec2(cos(a), sin(a));
  vec2 perp = vec2(-dir.y, dir.x);
  float acrossPos = dot(uv*vec2(aspect,1.0), perp);
  float coord = acrossPos * u_frequency + u_time * u_ribDrift;
  float t = fract(coord);
  float d = ribDisplace(t, u_profile);
  float taper = mix(1.0, smoothstep(0.0, 1.0, sin(t*3.14159265)), u_softness);
  d *= taper;
  float env = 1.0;
  if (u_sweepMode == 1) {
    float pos = fract(u_time * u_bandSpeed);
    float centre = pos * (1.0 + u_bandWidth) - u_bandWidth*0.5;
    float d2 = abs(uv.x - centre);
    float half_ = max(u_bandWidth*0.5, 0.001);
    float inner = half_ * (1.0 - u_bandSoftness);
    env = 1.0 - smoothstep(inner, half_, d2);
    env = clamp(env, 0.0, 1.0);
  }
  float amt = clamp(u_amount, 0.0, 1.0);
  vec2 off = perp * d * u_strength * 0.012 * env * amt;
  float ab = u_aberration * 0.008 * env * amt;
  vec4 sr = texture2D(u_src, uv + off + perp*ab);
  vec4 sg = texture2D(u_src, uv + off);
  vec4 sb = texture2D(u_src, uv + off - perp*ab);
  float ar=sr.a, ag=sg.a, abv=sb.a;
  float alpha = max(max(ar,ag),abv);
  vec3 col = vec3(sr.r*ar, sg.g*ag, sb.b*abv) / max(alpha, 0.0001);
  float g = pow(clamp(abs(d)*env, 0.0, 1.0), max(u_glowSpread, 0.001));
  col += u_glowColor * g * u_glow * amt;
  gl_FragColor = vec4(col, alpha);
}`;

  const FRAG_TINT = `precision highp float; varying vec2 v_uv;
uniform sampler2D u_src;
uniform vec3 u_stopColors[6]; uniform float u_stopPos[6]; uniform int u_stopCount;
uniform float u_angle, u_amount; uniform int u_mode;
void main(){
  vec4 s = texture2D(u_src, v_uv);
  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float t = clamp(dot(v_uv - 0.5, dir) + 0.5, 0.0, 1.0);
  vec3 g = u_stopColors[0];
  for (int i=0;i<5;i++){
    if (i+1 < u_stopCount){
      float p0=u_stopPos[i], p1=u_stopPos[i+1];
      if (t >= p0) g = mix(u_stopColors[i], u_stopColors[i+1], clamp((t-p0)/max(p1-p0,0.0001),0.0,1.0));
    }
  }
  vec3 outc;
  if (u_mode==0)      outc = mix(s.rgb, g, u_amount);
  else if (u_mode==1) outc = mix(s.rgb, s.rgb*g, u_amount);
  else if (u_mode==2) outc = s.rgb + g*u_amount;
  else                outc = g;
  gl_FragColor = vec4(outc, s.a);
}`;

  const FRAG_FLOW = `precision highp float; varying vec2 v_uv;
uniform sampler2D u_src; uniform vec2 u_resolution; uniform vec2 u_mouse;
uniform vec3 u_up,u_down,u_left,u_right;
uniform float u_radius,u_intensity; uniform int u_mode;
void main(){
  vec4 s = texture2D(u_src, v_uv);
  float aspect = u_resolution.x/u_resolution.y;
  vec2 v = (v_uv - u_mouse) * vec2(aspect,1.0);
  float dist = length(v);
  float fall = 1.0 - smoothstep(0.0, max(u_radius,0.0001), dist);
  vec2 n = v / max(dist, 0.0001);
  vec3 c = u_right*max(n.x,0.0) + u_left*max(-n.x,0.0) + u_up*max(n.y,0.0) + u_down*max(-n.y,0.0);
  vec3 outc = (u_mode==0) ? s.rgb + c*fall*u_intensity : mix(s.rgb, c, clamp(fall*u_intensity,0.0,1.0));
  gl_FragColor = vec4(outc, s.a);
}`;

  // Final present: premultiply so the transparent canvas composites over the page.
  const FRAG_PRESENT = `precision highp float; varying vec2 v_uv; uniform sampler2D u_tex;
void main(){ vec4 c=texture2D(u_tex,v_uv); gl_FragColor=vec4(clamp(c.rgb,0.0,1.0)*c.a, c.a); }`;

  // ---------------- boot ----------------
  function init(canvas) {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return false;

    const hexToRgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error("shader:", gl.getShaderInfoLog(s)); return null; } return s; };
    const program = (fs) => { const p = gl.createProgram(); const v = compile(gl.VERTEX_SHADER, VERT), f = compile(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null; gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error("link:", gl.getProgramInfoLog(p)); return null; } return p; };

    const progImage = program(FRAG_IMAGE), progRefract = program(FRAG_REFRACT),
      progTint = program(FRAG_TINT), progFlow = program(FRAG_FLOW), progPresent = program(FRAG_PRESENT);
    if (!progImage || !progRefract || !progTint || !progFlow || !progPresent) return false;

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const use = (prog) => { gl.useProgram(prog); const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); };
    const U = (prog, name) => gl.getUniformLocation(prog, name);

    // ---- render targets (three ping-pong buffers at canvas size) ----
    function createRT() {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      return { tex, fbo, w: 0, h: 0 };
    }
    const rts = [createRT(), createRT(), createRT()];
    function sizeRT(rt, w, h) {
      if (rt.w === w && rt.h === h) return;
      rt.w = w; rt.h = h;
      gl.bindTexture(gl.TEXTURE_2D, rt.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function target(rt, w, h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null); gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    function bindSrc(prog, tex) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U(prog, "u_src"), 0);
    }

    // ---- text texture (generateTextTexture, run once; ink-centred) ----
    const T = PRESET.text;
    function textTexture() {
      const w = 2048, h = 512;
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
      try { ctx.letterSpacing = T.letterSpacing + "px"; } catch (e) {}
      ctx.lineJoin = "round"; ctx.miterLimit = 2;
      let x = w / 2, y = h / 2;
      const m = ctx.measureText(T.text);
      if (m && typeof m.actualBoundingBoxAscent === "number" && typeof m.actualBoundingBoxLeft === "number") {
        y = h / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
        x = w / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      } else { ctx.textBaseline = "middle"; }
      ctx.lineWidth = T.strokeWeight; ctx.strokeStyle = T.strokeColor; ctx.strokeText(T.text, x, y);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      return { tex, w, h };
    }
    const wordmark = textTexture();

    // ---- mouse (window-level, resolved against the canvas rect; smoothed by momentum) ----
    const mouse = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5 };
    window.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1.0 - (e.clientY - r.top) / r.height;
    }, { passive: true });

    // ---- sizing ----
    let W = 0, H = 0;
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (w === W && h === H) return;
      W = w; H = h; canvas.width = w; canvas.height = h;
      rts.forEach(rt => sizeRT(rt, w, h));
    }
    window.addEventListener("resize", resize, { passive: true });

    // ---- frame ----
    const R = PRESET.refract, G = PRESET.tint, F = PRESET.flow;
    const stopCols = new Float32Array(18), stopPos = new Float32Array(6);
    G.stops.forEach((s, i) => { const c = hexToRgb(s.color); stopCols.set(c, i * 3); stopPos[i] = s.pos / 100; });
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let time = 0, last = performance.now(), visible = true;
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; }) : null;
    if (io) io.observe(canvas);

    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (!reduceMotion) time = (time + dt) % PRESET.loopSeconds;
      if (!visible) return;
      resize();

      const s = 1 / (F.momentum * 0.5 + 1);
      mouse.x += (mouse.tx - mouse.x) * s;
      mouse.y += (mouse.ty - mouse.y) * s;

      // 1. text layer -> rts[0]
      target(rts[0], W, H);
      use(progImage);
      const b = T.box;
      gl.uniform4f(U(progImage, "u_rect"), b.x / 100, 1 - b.y / 100 - b.h / 100, b.w / 100, b.h / 100);
      gl.uniform1f(U(progImage, "u_rotation"), 0); gl.uniform1f(U(progImage, "u_cornerRadius"), 0);
      gl.uniform2f(U(progImage, "u_resolution"), W, H);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, wordmark.tex); gl.uniform1i(U(progImage, "u_tex"), 0);
      gl.uniform2f(U(progImage, "u_texSize"), wordmark.w, wordmark.h);
      gl.uniform1i(U(progImage, "u_objectFit"), 1);   // fit
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 2. refract -> rts[1]
      target(rts[1], W, H);
      use(progRefract); bindSrc(progRefract, rts[0].tex);
      gl.uniform2f(U(progRefract, "u_resolution"), W, H);
      gl.uniform1f(U(progRefract, "u_time"), time);
      gl.uniform1i(U(progRefract, "u_profile"), R.profile);
      gl.uniform1f(U(progRefract, "u_angle"), R.angle); gl.uniform1f(U(progRefract, "u_frequency"), R.frequency);
      gl.uniform1f(U(progRefract, "u_strength"), R.strength); gl.uniform1f(U(progRefract, "u_softness"), R.softness);
      gl.uniform1f(U(progRefract, "u_aberration"), R.aberration); gl.uniform1f(U(progRefract, "u_ribDrift"), R.ribDrift);
      gl.uniform1i(U(progRefract, "u_sweepMode"), R.sweepMode);
      gl.uniform1f(U(progRefract, "u_bandWidth"), R.bandWidth); gl.uniform1f(U(progRefract, "u_bandSoftness"), R.bandSoftness);
      gl.uniform1f(U(progRefract, "u_bandSpeed"), R.bandSpeed);
      gl.uniform1f(U(progRefract, "u_glow"), R.glow); gl.uniform1f(U(progRefract, "u_glowSpread"), R.glowSpread);
      gl.uniform3fv(U(progRefract, "u_glowColor"), hexToRgb(R.glowColor));
      gl.uniform1f(U(progRefract, "u_amount"), R.amount);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 3. gradient tint -> rts[2]
      target(rts[2], W, H);
      use(progTint); bindSrc(progTint, rts[1].tex);
      gl.uniform3fv(U(progTint, "u_stopColors"), stopCols); gl.uniform1fv(U(progTint, "u_stopPos"), stopPos);
      gl.uniform1i(U(progTint, "u_stopCount"), G.stops.length);
      gl.uniform1f(U(progTint, "u_angle"), G.angle); gl.uniform1f(U(progTint, "u_amount"), G.amount);
      gl.uniform1i(U(progTint, "u_mode"), G.mode);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 4. chroma flow -> rts[0]
      target(rts[0], W, H);
      use(progFlow); bindSrc(progFlow, rts[2].tex);
      gl.uniform2f(U(progFlow, "u_resolution"), W, H);
      gl.uniform2f(U(progFlow, "u_mouse"), mouse.x, mouse.y);
      gl.uniform3fv(U(progFlow, "u_up"), hexToRgb(F.up)); gl.uniform3fv(U(progFlow, "u_down"), hexToRgb(F.down));
      gl.uniform3fv(U(progFlow, "u_left"), hexToRgb(F.left)); gl.uniform3fv(U(progFlow, "u_right"), hexToRgb(F.right));
      gl.uniform1f(U(progFlow, "u_radius"), F.radius); gl.uniform1f(U(progFlow, "u_intensity"), F.intensity);
      gl.uniform1i(U(progFlow, "u_mode"), F.mode);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 5. present (premultiplied, over the page background)
      target(null, W, H);
      use(progPresent);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rts[0].tex); gl.uniform1i(U(progPresent, "u_tex"), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    resize();
    requestAnimationFrame(frame);
    return true;
  }

  function boot() {
    const canvas = document.getElementById("hero-shader");
    if (!canvas) return;
    let ok = false;
    try { ok = init(canvas); } catch (e) { console.error("hero shader:", e); }
    if (ok) canvas.parentElement.classList.add("shader-on");
    else canvas.remove();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
