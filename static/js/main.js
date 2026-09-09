/**
 * Virendra Chavan — Portfolio
 * main.js — All JavaScript orchestration
 *
 * Blocks:
 *  1.  Reduced-motion detection
 *  2.  Preloader
 *  3.  Hero text split + reveal
 *  4.  Three.js hero orb
 *  5.  Lenis smooth scroll
 *  6.  Custom cursor
 *  7.  Navigation behaviour
 *  8.  GSAP ScrollTrigger reveals
 *  9.  Skills row hover
 *  10. Project mockup tilt
 *  11. Magnetic buttons
 *  12. Certifications ticker
 *  13. Contact form
 */

'use strict';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 1 — REDUCED MOTION
   ═══════════════════════════════════════════════════════════════════════════ */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 2 — PRELOADER
   ═══════════════════════════════════════════════════════════════════════════ */
function runPreloader(onComplete) {
  const preloader  = $('#preloader');
  const countEl    = $('#preloader-count');
  const fillEl     = $('#preloader-fill');

  if (!preloader) { onComplete(); return; }

  if (prefersReducedMotion) {
    preloader.style.display = 'none';
    onComplete();
    return;
  }

  let count    = 0;
  let start    = null;
  const total  = 1600; // ms total preloader run

  function tick(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / total, 1);
    // ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    count = Math.floor(eased * 100);

    countEl.textContent = count;
    fillEl.style.width  = count + '%';

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      countEl.textContent = '100';
      fillEl.style.width  = '100%';

      // Fade out preloader
      gsap.to(preloader, {
        opacity: 0,
        duration: 0.55,
        ease: 'power2.in',
        delay: 0.15,
        onComplete: () => {
          preloader.style.display = 'none';
          onComplete();
        }
      });
    }
  }

  requestAnimationFrame(tick);
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 3 — HERO TEXT SPLIT + REVEAL
   ═══════════════════════════════════════════════════════════════════════════ */
function splitNameToChars(el) {
  const lines = $$('.name-line', el);
  lines.forEach(line => {
    const text = line.textContent;
    line.innerHTML = '';
    [...text].forEach(ch => {
      const charWrap  = document.createElement('span');
      const charInner = document.createElement('span');
      charWrap.classList.add('char');
      charInner.classList.add('char-inner');
      charInner.textContent = ch;
      charWrap.appendChild(charInner);
      line.appendChild(charWrap);
    });
  });
}

function revealHero() {
  if (prefersReducedMotion) {
    // Show everything instantly
    $$('.char-inner').forEach(c => { c.style.transform = 'none'; c.style.opacity = '1'; });
    const nav = $('#nav');
    if (nav) { nav.classList.add('visible'); }
    return;
  }

  const tl = gsap.timeline();

  // Kicker fade-in
  tl.to('#hero .hero-kicker', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0);

  // Name chars slide up from mask
  tl.to('.hero-name .char-inner', {
    y: '0%',
    opacity: 1,
    duration: 0.75,
    stagger: 0.035,
    ease: 'power3.out',
  }, 0.1);

  // Red rule draws under name
  tl.fromTo('#hero-rule-el',
    { width: 0 },
    { width: '100%', duration: 0.6, ease: 'power2.out' },
    0.6
  );

  // Subhead + meta + avail fade in
  tl.fromTo('#hero-subhead-el', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.55);
  tl.fromTo('#hero-meta-el',    { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.7);
  tl.fromTo('#hero-avail-el',   { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.8);

  // Scroll cue
  tl.fromTo('#scroll-cue', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 1.1);

  // Nav slides in
  tl.call(() => {
    const nav = $('#nav');
    if (nav) nav.classList.add('visible');
  }, null, 0.9);

  // Trigger orb scale-in
  tl.call(() => {
    if (window._orbScaleIn) window._orbScaleIn();
  }, null, 0.5);
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 4 — THREE.JS HERO ORB
   ═══════════════════════════════════════════════════════════════════════════ */
function initOrb() {
  const canvas = $('#hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  /* --- Vertex shader (Classic Perlin noise for vertex displacement) --- */
  const vertexShader = `
    uniform float uTime;
    uniform float uAmplitude;
    uniform vec2  uMouse;

    /* Classic 3D Perlin noise — Morgan McGuire */
    vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 permute(vec4 x)  { return mod289v4(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float cnoise(vec3 P) {
      vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod289v3(Pi0); Pi1 = mod289v3(Pi1);
      vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
      vec4 iy = vec4(Pi0.yy,Pi1.yy);
      vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
      vec4 ixy = permute(permute(ix)+iy);
      vec4 ixy0 = permute(ixy+iz0); vec4 ixy1 = permute(ixy+iz1);
      vec4 gx0 = ixy0*(1.0/7.0); vec4 gy0 = fract(floor(gx0)*(1.0/7.0))-0.5;
      gx0 = fract(gx0); vec4 gz0 = vec4(0.5)-abs(gx0)-abs(gy0);
      vec4 sz0 = step(gz0,vec4(0.0));
      gx0 -= sz0*(step(0.0,gx0)-0.5); gy0 -= sz0*(step(0.0,gy0)-0.5);
      vec4 gx1 = ixy1*(1.0/7.0); vec4 gy1 = fract(floor(gx1)*(1.0/7.0))-0.5;
      gx1 = fract(gx1); vec4 gz1 = vec4(0.5)-abs(gx1)-abs(gy1);
      vec4 sz1 = step(gz1,vec4(0.0));
      gx1 -= sz1*(step(0.0,gx1)-0.5); gy1 -= sz1*(step(0.0,gy1)-0.5);
      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
      vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
      g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
      g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
      float n000=dot(g000,Pf0);
      float n100=dot(g100,vec3(Pf1.x,Pf0.yz));
      float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z));
      float n110=dot(g110,vec3(Pf1.xy,Pf0.z));
      float n001=dot(g001,vec3(Pf0.xy,Pf1.z));
      float n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
      float n011=dot(g011,vec3(Pf0.x,Pf1.yz));
      float n111=dot(g111,Pf1);
      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
      vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
      float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
      return 2.2 * n_xyz;
    }

    void main() {
      vec3 pos    = position;
      float noise = cnoise(pos * 0.75 + uTime * 0.14);
      float amp   = uAmplitude + sin(uTime * 0.45) * 0.045; /* breathing */
      pos += normal * noise * amp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    void main() {
      gl_FragColor = vec4(0.894, 0.0, 0.169, 0.85); /* #E4002B at 85% */
    }
  `;

  /* --- Scene setup --- */
  const scene    = new THREE.Scene();
  const w        = canvas.offsetWidth;
  const h        = canvas.offsetHeight;
  const camera   = new THREE.PerspectiveCamera(58, w / h, 0.1, 100);
  camera.position.set(0, 0, 4.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  /* --- Geometry --- */
  const detail   = window.innerWidth < 768 ? 3 : 5;
  const geometry = new THREE.IcosahedronGeometry(1.6, detail);

  const material = new THREE.ShaderMaterial({
    wireframe: true,
    uniforms: {
      uTime:      { value: 0 },
      uAmplitude: { value: 0.22 },
      uMouse:     { value: new THREE.Vector2(0, 0) },
    },
    vertexShader,
    fragmentShader,
  });

  const orb = new THREE.Mesh(geometry, material);
  orb.scale.setScalar(0);
  scene.add(orb);

  /* --- Position orb to the right of text --- */
  orb.position.set(3.2, 0, 0);

  /* --- Mouse state --- */
  let mouseTargetX = 0, mouseTargetY = 0;
  let mouseLerpX   = 0, mouseLerpY   = 0;
  let autoRotY     = 0;
  let tiltX        = 0, tiltY = 0;

  if (!prefersReducedMotion) {
    window.addEventListener('mousemove', e => {
      mouseTargetX = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseTargetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  /* --- Elastic scale-in callback (called from hero reveal) --- */
  window._orbScaleIn = () => {
    if (prefersReducedMotion) { orb.scale.setScalar(1); return; }
    gsap.to(orb.scale, {
      x: 1, y: 1, z: 1,
      duration: 1.4,
      ease: 'elastic.out(1, 0.55)',
    });
  };

  /* --- Resize --- */
  window.addEventListener('resize', () => {
    const nw = canvas.offsetWidth;
    const nh = canvas.offsetHeight;
    renderer.setSize(nw, nh);
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();

    // Reposition orb based on viewport
    orb.position.x = window.innerWidth < 768 ? 0 : 3.2;
    if (window.innerWidth < 768) orb.position.y = -1.2;
    else orb.position.y = 0;
  });

  // Mobile: centre the orb and lower it
  if (window.innerWidth < 768) {
    orb.position.set(0, -1.2, 0);
  }

  /* --- Animation loop --- */
  let rafId;
  function animate(ts) {
    rafId = requestAnimationFrame(animate);
    const t = ts * 0.001;

    // Lerp mouse
    mouseLerpX += (mouseTargetX - mouseLerpX) * 0.06;
    mouseLerpY += (mouseTargetY - mouseLerpY) * 0.06;

    // Tilt (max ±8° = ±0.14 rad)
    tiltX += (mouseLerpY * 0.14 - tiltX) * 0.06;
    tiltY += (mouseLerpX * 0.14 - tiltY) * 0.06;

    autoRotY += 0.0025;

    orb.rotation.x = tiltX;
    orb.rotation.y = autoRotY + tiltY;

    material.uniforms.uTime.value = t;
    material.uniforms.uMouse.value.set(mouseLerpX, mouseLerpY);

    renderer.render(scene, camera);
  }

  /* --- Start only when hero is visible --- */
  const heroSection = $('#hero');
  const visObs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!rafId) animate(0);
    } else {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }, { threshold: 0.01 });

  if (heroSection) visObs.observe(heroSection);
  else animate(0);

  /* --- Fade scroll cue on first scroll --- */
  const scrollCue = $('#scroll-cue');
  if (scrollCue) {
    window.addEventListener('scroll', () => {
      scrollCue.style.opacity = '0';
    }, { once: true, passive: true });
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 5 — LENIS SMOOTH SCROLL
   ═══════════════════════════════════════════════════════════════════════════ */
let lenis;
function initLenis() {
  if (prefersReducedMotion || typeof Lenis === 'undefined') return;

  lenis = new Lenis({ lerp: 0.10, smoothWheel: true });

  // Sync Lenis with GSAP ticker
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Keep ScrollTrigger in sync
  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 6 — CUSTOM CURSOR
   ═══════════════════════════════════════════════════════════════════════════ */
function initCursor() {
  if (prefersReducedMotion) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const dot  = $('#cursor-dot');
  const ring = $('#cursor-ring');
  if (!dot || !ring) return;

  // Add label span to ring
  const labelEl = document.createElement('span');
  labelEl.className = 'cursor-label';
  ring.appendChild(labelEl);

  let dotX = -100, dotY = -100;
  let ringX = -100, ringY = -100;

  document.addEventListener('mousemove', e => {
    dotX = e.clientX;
    dotY = e.clientY;

    // Invert cursor on light-background sections
    // elementsFromPoint returns ALL elements at this coordinate (including the
    // cursor dot/ring on top). Skip any cursor element, then check the rest.
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let isDark = false;
    for (const el of elements) {
      if (el.id === 'cursor-dot' || el.id === 'cursor-ring') continue;
      if (el.classList.contains('section-white') || el.classList.contains('section-paper')) {
        isDark = true;
        break;
      }
      if (el.classList.contains('section-black') || el.tagName === 'BODY') {
        break; // definitely on a dark section, stop looking
      }
    }
    if (isDark) {
      dot.classList.add('cursor-dark');
      ring.classList.add('cursor-dark');
    } else {
      dot.classList.remove('cursor-dark');
      ring.classList.remove('cursor-dark');
    }

  }, { passive: true });

  document.body.style.cursor = 'none';

  // Cursor targets
  $$('[data-cursor]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      ring.classList.add('expanded');
      labelEl.textContent = el.dataset.cursor || '';
    });
    el.addEventListener('mouseleave', () => {
      ring.classList.remove('expanded');
      labelEl.textContent = '';
    });
  });

  function tick() {
    dot.style.transform  = `translate(${dotX}px, ${dotY}px)`;
    ringX = lerp(ringX, dotX, 0.12);
    ringY = lerp(ringY, dotY, 0.12);
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 7 — NAVIGATION BEHAVIOUR
   ═══════════════════════════════════════════════════════════════════════════ */
function initNav() {
  const nav  = $('#nav');
  const hero = $('#hero');
  if (!nav || !hero) return;

  const obs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      nav.classList.remove('scrolled');
    } else {
      nav.classList.add('scrolled');
    }
  }, { threshold: 0.05 });

  obs.observe(hero);
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 8 — GSAP SCROLLTRIGGER REVEALS
   ═══════════════════════════════════════════════════════════════════════════ */
function initScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  if (prefersReducedMotion) {
    // Just ensure everything is visible
    $$('.about-text-wrap').forEach(el => el.style.clipPath = 'none');
    $$('.spread-grid').forEach(el => { el.style.opacity='1'; el.style.transform='none'; });
    $$('.contact-headline').forEach(el => el.style.clipPath = 'none');
    return;
  }

  /* — About: clip-path wipe left→right — */
  ScrollTrigger.create({
    trigger: '#about',
    start: 'top 75%',
    once: true,
    onEnter: () => {
      gsap.to('.about-text-wrap', {
        clipPath: 'inset(0 0% 0 0)',
        duration: 1.1,
        ease: 'power3.out',
      });
      // Drop-cap scales in a beat after paragraph starts
      gsap.to('.drop-cap', {
        scale: 1,
        opacity: 1,
        duration: 0.9,
        ease: 'back.out(1.7)',
        delay: 0.35,
      });
    }
  });

  /* — Skills rows: stagger slide-in — */
  gsap.to('.skill-row', {
    opacity: 1,
    y: 0,
    duration: 0.55,
    stagger: 0.07,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#skills',
      start: 'top 70%',
      once: true,
    }
  });

  /* — Section title kinetic: letter-spacing breathes as it passes viewport centre — */
  $$('.section-title-large').forEach(el => {
    gsap.fromTo(el,
      { letterSpacing: '-0.02em' },
      {
        letterSpacing: '0.02em',
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: 1.2,
        }
      }
    );
  });

  /* — Experience headline — */
  gsap.from('#exp-headline', {
    opacity: 0,
    y: 40,
    duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: { trigger: '#experience', start: 'top 70%', once: true }
  });

  /* — Experience pull-stats: count up — */
  $$('.stat-num').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    let started  = false;

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        if (started) return;
        started = true;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2.2,
          ease: 'power2.out',
          onUpdate() {
            el.textContent = Math.round(obj.val) + suffix;
          },
          onComplete() {
            el.textContent = target + suffix;
          }
        });
      }
    });
  });

  /* — Project spreads: perspective fold-open — */
  $$('.spread-grid').forEach(grid => {
    const isLeft = grid.classList.contains('spread-grid-left');
    gsap.to(grid, {
      opacity: 1,
      rotateY: 0,
      translateZ: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: grid,
        start: 'top 72%',
        once: true,
      }
    });
  });

  /* — Education: fade in columns — */
  gsap.from('.edu-card', {
    opacity: 0,
    y: 36,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out',
    scrollTrigger: { trigger: '#education', start: 'top 75%', once: true }
  });

  /* — Work teaser: stagger rows — */
  gsap.from('.work-item', {
    opacity: 0,
    y: 28,
    duration: 0.65,
    stagger: 0.15,
    ease: 'power3.out',
    scrollTrigger: { trigger: '#work', start: 'top 72%', once: true }
  });

  /* — Contact headline: clip from bottom — */
  ScrollTrigger.create({
    trigger: '#contact',
    start: 'top 70%',
    once: true,
    onEnter: () => {
      gsap.to('.contact-headline', {
        clipPath: 'inset(0 0 0 0)',
        duration: 1.0,
        ease: 'power3.out',
      });
      gsap.from('.contact-sub', {
        opacity: 0,
        y: 20,
        duration: 0.7,
        delay: 0.3,
        ease: 'power3.out',
      });
    }
  });

  /* — Contact form: fade in — */
  gsap.from('.contact-form-wrap', {
    opacity: 0,
    y: 30,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: { trigger: '#contact', start: 'top 65%', once: true, delay: 0.2 }
  });

  /* — Contact details: stagger — */
  gsap.from('.contact-details > *', {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.12,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.contact-details', start: 'top 85%', once: true }
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 9 — SKILLS ROW HOVER
   ═══════════════════════════════════════════════════════════════════════════ */
function initSkillsHover() {
  $$('[data-skill-row]').forEach(row => {
    const num = $('.skill-num', row);

    row.addEventListener('mouseenter', () => {
      if (num) num.style.color = 'var(--color-red)';
    });

    row.addEventListener('mouseleave', () => {
      if (num) num.style.color = '';
    });

    // Keyboard-accessible
    row.addEventListener('focus', () => {
      if (num) num.style.color = 'var(--color-red)';
    });
    row.addEventListener('blur', () => {
      if (num) num.style.color = '';
    });
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 10 — PROJECT MOCKUP TILT
   ═══════════════════════════════════════════════════════════════════════════ */
function initTilt() {
  if (prefersReducedMotion) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  $$('[data-tilt]').forEach(el => {
    const glare = $('.tilt-glare', el);

    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const rx   = ((e.clientY - cy) / (rect.height / 2)) * -8;
      const ry   = ((e.clientX - cx) / (rect.width  / 2)) * 8;

      gsap.set(el, {
        rotateX: rx,
        rotateY: ry,
        transformPerspective: 900,
      });

      if (glare) {
        const px = ((e.clientX - rect.left) / rect.width)  * 100;
        const py = ((e.clientY - rect.top)  / rect.height) * 100;
        glare.style.backgroundImage =
          `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.11) 0%, transparent 65%)`;
      }
    });

    el.addEventListener('mouseleave', () => {
      gsap.to(el, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.65,
        ease: 'power2.out',
        transformPerspective: 900,
      });
      if (glare) {
        glare.style.backgroundImage =
          'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.09) 0%, transparent 65%)';
      }
    });
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 11 — MAGNETIC BUTTONS
   ═══════════════════════════════════════════════════════════════════════════ */
function initMagnetic() {
  if (prefersReducedMotion) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (typeof gsap === 'undefined') return;

  $$('.btn-magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dx   = e.clientX - cx;
      const dy   = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxD = 70;

      if (dist < maxD) {
        const f = (maxD - dist) / maxD;
        gsap.to(btn, {
          x: dx * f * 0.45,
          y: dy * f * 0.45,
          duration: 0.35,
          ease: 'power2.out',
        });
      }
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        x: 0, y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.35)',
      });
    });
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 12 — CERTIFICATIONS TICKER
   ═══════════════════════════════════════════════════════════════════════════ */
function initTicker() {
  const wrap  = $('#ticker-wrap');
  const track = $('#ticker-track');
  if (!wrap || !track) return;

  // Pause/resume on hover is handled via CSS animation-play-state
  // (already done in CSS with ticker-track:hover)
  // Duplicate content for seamless loop — already duplicated in HTML
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK 13 — CONTACT FORM
   ═══════════════════════════════════════════════════════════════════════════ */
function initContactForm() {
  const form     = $('#contact-form');
  const btnSend  = $('#btn-send');
  const btnText  = $('#btn-send-text');
  const errEl    = $('#form-error');
  const successEl = $('#form-success');

  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name    = $('#field-name',    form).value.trim();
    const email   = $('#field-email',   form).value.trim();
    const subject = $('#field-subject', form).value.trim();
    const message = $('#field-message', form).value.trim();

    // Client-side validation
    if (!name || !email || !subject || !message) {
      showError('Please fill in all fields.');
      return;
    }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    // Loading state
    btnSend.disabled = true;
    if (btnText) btnText.textContent = 'Sending…';
    hideError();

    try {
      const res = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await res.json();

      if (data.status === 'ok') {
        form.hidden = true;
        successEl.hidden = false;
        if (!prefersReducedMotion) {
          gsap.from(successEl, { opacity: 0, y: 20, duration: 0.6, ease: 'power3.out' });
        }
      } else {
        showError(data.detail || 'Something went wrong. Please try again.');
        resetBtn();
      }
    } catch (err) {
      showError('Network error. Please check your connection and try again.');
      resetBtn();
    }
  });

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function hideError() {
    errEl.hidden = true;
    errEl.textContent = '';
  }

  function resetBtn() {
    btnSend.disabled = false;
    if (btnText) btnText.textContent = 'Send message';
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   INIT — Sequence everything
   ═══════════════════════════════════════════════════════════════════════════ */
function init() {
  // Split name text before anything renders
  const heroNameEl = $('#hero-name-el');
  if (heroNameEl && !prefersReducedMotion) splitNameToChars(heroNameEl);

  // Init orb early (it starts paused until hero is visible)
  initOrb();

  // Init nav observer
  initNav();

  // Persistent interactions (no dependency on preloader)
  initSkillsHover();
  initTicker();
  initContactForm();

  // Preloader → hero reveal → everything else
  runPreloader(() => {
    // Lenis must start after preloader (page is now scrollable)
    initLenis();

    // Hero reveal animation
    revealHero();

    // Init scroll-driven animations
    // Small delay to let Lenis/GSAP settle
    setTimeout(() => {
      initScrollAnimations();
      initTilt();
      initMagnetic();
      initCursor();
    }, 120);
  });
}

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
