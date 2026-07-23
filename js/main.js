/* =========================================================
   Nómadas Profesionales — Bodas — main.js
   1) Fondo animado "Silk" (WebGL puro, sin librerías externas)
   2) Menú mobile
   3) Acordeón de preguntas frecuentes
   4) Reveal al hacer scroll
   ========================================================= */

/* ---------- 1) SILK BACKGROUND (hero) ---------- */
(function silkBackground() {
  const canvas = document.getElementById("silk-canvas");
  if (!canvas) return;

  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return; // navegador sin WebGL: el hero queda con el color de fondo sólido

  // ---- Parámetros (equivalentes a los props del componente Silk) ----
  const params = {
    speed: 5,
    scale: 1,
    color: [0x7b / 255, 0x74 / 255, 0x81 / 255], // #7B7481
    noiseIntensity: 1.5,
    rotation: 0,
  };

  const vertexSrc = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uNoise;
    uniform float uRotation;
    uniform vec3 uColor;
    uniform vec2 uResolution;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        v += amp * noise(p);
        p *= 2.02;
        amp *= 0.55;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / uResolution.y;
      uv -= 0.5;
      uv.x *= aspect;

      float s = sin(uRotation);
      float c = cos(uRotation);
      uv = mat2(c, -s, s, c) * uv;

      uv *= max(uScale, 0.001);

      float t = uTime * uSpeed * 0.05;

      vec2 flow = uv * 2.2;
      float n1 = fbm(flow + vec2(t * 0.9, -t * 0.6));
      float n2 = fbm(flow * 1.6 - vec2(-t * 0.5, t * 0.8));

      float waveA = sin((uv.x * 5.0 + uv.y * 2.0) + n1 * uNoise * 3.0 + t * 2.2);
      float waveB = sin((uv.y * 6.0 - uv.x * 1.5) + n2 * uNoise * 3.0 - t * 1.6);

      float pattern = 0.5 + 0.25 * waveA + 0.25 * waveB;
      pattern = smoothstep(0.15, 0.95, pattern);

      float sheen = pow(pattern, 2.2) * 0.5;

      vec3 base = uColor * (0.55 + pattern * 0.55);
      vec3 col = base + sheen * 0.25;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compile(gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // Triángulo que cubre toda la pantalla
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const aPosition = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, "uTime");
  const uSpeed = gl.getUniformLocation(program, "uSpeed");
  const uScale = gl.getUniformLocation(program, "uScale");
  const uNoise = gl.getUniformLocation(program, "uNoise");
  const uRotation = gl.getUniformLocation(program, "uRotation");
  const uColor = gl.getUniformLocation(program, "uColor");
  const uResolution = gl.getUniformLocation(program, "uResolution");

  gl.uniform1f(uSpeed, params.speed);
  gl.uniform1f(uScale, params.scale);
  gl.uniform1f(uNoise, params.noiseIntensity);
  gl.uniform1f(uRotation, params.rotation);
  gl.uniform3f(uColor, params.color[0], params.color[1], params.color[2]);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let start = performance.now();

  function frame(now) {
    const elapsed = (now - start) / 1000;
    gl.uniform1f(uTime, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- 2) MENÚ MOBILE ---------- */
(function mobileNav() {
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("is-open"))
  );
})();

/* ---------- 3) ACORDEÓN FAQ ---------- */
(function accordion() {
  document.querySelectorAll(".acc-item").forEach((item) => {
    const trigger = item.querySelector(".acc-trigger");
    const panel = item.querySelector(".acc-panel");
    if (!trigger || !panel) return;

    trigger.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      document.querySelectorAll(".acc-item").forEach((other) => {
        other.classList.remove("is-open");
        other.querySelector(".acc-panel").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("is-open");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  });
})();

/* ---------- 4) REVEAL AL HACER SCROLL ---------- */
(function reveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !items.length) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => io.observe(el));
})();
