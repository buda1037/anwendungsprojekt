/* Turmberg Software – the paper plane on the landing page.

   A visitor who stays on the page for 55 seconds gets company: one small
   paper plane glides in from the side and then circles lazily in the sky
   between the hero text and the form. It can be grabbed with the mouse or
   a finger and thrown: a throw that carries it off screen removes it for
   good. No second plane follows.

   No library, no build step. Every plane is a tiny 3D model (three
   triangles) that is rotated, projected and flat-shaded here and drawn as an
   inline SVG. Visitors who prefer reduced motion get no planes at all. */

(() => {
  'use strict';

  const card = document.querySelector('.hero__card');
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- Model ---------- */

  // x points forward, y up, z towards the right wing. One unit is half the
  // plane's length.
  const NOSE = [1, 0, 0];
  const TAIL = [-1, 0, 0];
  const KEEL = [-0.86, -0.42, 0];
  const LEFT = [-1, 0.07, -0.74];
  const RIGHT = [-1, 0.07, 0.74];
  const FACES = [
    { corners: [NOSE, TAIL, LEFT], tone: 1 },
    { corners: [NOSE, TAIL, RIGHT], tone: 1 },
    { corners: [NOSE, TAIL, KEEL], tone: 0.82 },
  ];

  const TILT = 0.6; // the camera looks down at the planes at this angle (rad)
  const LIGHT = unit([-0.35, -0.55, 0.76]); // from the upper left, towards the viewer

  // Colors come from the brand variables in style.css.
  const css = getComputedStyle(document.documentElement);
  const rgb = (name) => {
    const hex = css.getPropertyValue(name).trim();
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  };
  // lit and shade are the fully lit and fully shaded face colors; floor keeps
  // the white paper from getting as dark as its shade color.
  const PAPER = { lit: rgb('--seite'), shade: rgb('--grau'), floor: 0.55 };
  const ACCENT = { lit: rgb('--pfinz-hell'), shade: rgb('--pfinz-dunkel'), floor: 0 };

  /* ---------- Where the planes live ---------- */

  // homes are fractions of the hero card, one per plane: add entries for
  // more planes. On a wide card the plane circles in the open sky between
  // the hero text and the form, above the tower; on a narrow one in the top
  // right corner, clear of the tagline and the form's fields. unit is the
  // model's size in px, orbit the radius of the circles, speed the cruise
  // speed in px per second.
  const LAYOUTS = {
    wide: {
      unit: 26, orbit: 55, speed: 52,
      homes: [[0.47, 0.50]],
    },
    narrow: {
      unit: 17, orbit: 22, speed: 30,
      homes: [[0.88, 0.03]],
    },
  };
  const SIZES = [1, 0.85, 0.8, 1.1, 1.15, 0.9];

  // Seconds on the page until the plane appears. Only time with the page in
  // view counts. To see the plane sooner, add ?plane=SECONDS to the address.
  const preview = parseFloat(new URLSearchParams(location.search).get('plane'));
  const FIRST_DELAY = preview >= 0 ? preview : 55;
  const STAGGER = 0.35; // seconds between planes, if there are several
  const MAX_THROW = 3000; // px per second
  const GLIDE_DRAG = 0.45; // share of speed a thrown plane loses per second
  const SETTLE_SPEED = 120; // a thrown plane slower than this starts circling again
  const BOX = 120; // side of each plane's SVG box, px

  let rect;
  let layout;
  const measure = () => {
    rect = card.getBoundingClientRect();
    layout = rect.width >= 1000 ? LAYOUTS.wide : LAYOUTS.narrow;
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('scroll', measure, { passive: true });
  new ResizeObserver(measure).observe(card);

  const layer = document.createElement('div');
  layer.className = 'flieger';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const planes = layout.homes.map((_, i) => createPlane(i));

  /* ---------- One plane ---------- */

  function createPlane(i) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`);
    const polygons = FACES.map(() => svg.appendChild(svgElement('polygon')));
    // The transparent circle is the grab area: larger than the plane, so a
    // moving plane is easy to catch, also with a finger.
    const grip = svg.appendChild(svgElement('circle'));
    grip.setAttribute('r', 34);
    svg.style.visibility = 'hidden';
    layer.appendChild(svg);

    const plane = {
      i, svg, polygons,
      size: SIZES[i % SIZES.length],
      colors: i % 3 === 1 ? ACCENT : PAPER,
      turn: i % 2 ? 1 : -1, // circling direction
      phase: i * 1.7,
      state: 'waiting', // waiting | circling | held | gliding | gone
      wait: FIRST_DELAY + i * STAGGER,
      home: null, // set when the visitor drops the plane somewhere
      x: 0, y: 0, heading: 0, speed: 0, vx: 0, vy: 0, bank: 0, lift: 0,
      pointer: null, grabX: 0, grabY: 0, trail: [],
    };

    grip.addEventListener('pointerdown', (e) => {
      if (plane.state === 'waiting' || plane.state === 'held') return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      plane.state = 'held';
      plane.pointer = e.pointerId;
      plane.grabX = plane.x - e.clientX;
      plane.grabY = plane.y - e.clientY;
      plane.trail = [[e.timeStamp, e.clientX, e.clientY]];
      svg.classList.add('gegriffen');
    });

    grip.addEventListener('pointermove', (e) => {
      if (plane.state !== 'held' || e.pointerId !== plane.pointer) return;
      plane.x = e.clientX + plane.grabX;
      plane.y = e.clientY + plane.grabY;
      plane.trail.push([e.timeStamp, e.clientX, e.clientY]);
    });

    const release = (e) => {
      if (plane.state !== 'held' || e.pointerId !== plane.pointer) return;
      // The throw is the pointer's average velocity over the last 100 ms.
      // A pointer that rested before letting go leaves no recent samples,
      // and the plane is simply dropped.
      const recent = plane.trail.filter(([time]) => e.timeStamp - time <= 100);
      let vx = 0;
      let vy = 0;
      if (recent.length > 1) {
        const [t0, x0, y0] = recent[0];
        const [t1, x1, y1] = recent[recent.length - 1];
        const seconds = (t1 - t0) / 1000;
        if (seconds > 0) {
          vx = (x1 - x0) / seconds;
          vy = (y1 - y0) / seconds;
        }
      }
      const v = Math.hypot(vx, vy);
      if (v > MAX_THROW) {
        vx *= MAX_THROW / v;
        vy *= MAX_THROW / v;
      }
      plane.vx = vx;
      plane.vy = vy;
      plane.state = 'gliding';
      plane.pointer = null;
      svg.classList.remove('gegriffen');
    };
    grip.addEventListener('pointerup', release);
    grip.addEventListener('pointercancel', release);
    // Keeps a finger that starts on a plane from scrolling the page instead.
    grip.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    return plane;
  }

  function homeOf(plane) {
    const [fx, fy] = plane.home || layout.homes[plane.i % layout.homes.length];
    return [rect.left + fx * rect.width, rect.top + fy * rect.height];
  }

  // Start outside the window, on the side the plane's home is on.
  function enter(plane) {
    const [homeX, homeY] = homeOf(plane);
    const fromLeft = homeX < rect.left + rect.width / 2;
    plane.x = fromLeft ? -BOX / 2 : innerWidth + BOX / 2;
    plane.y = homeY - 30 - Math.random() * 60;
    plane.heading = fromLeft ? 0.2 : Math.PI - 0.2;
    plane.speed = layout.speed * 6;
    plane.bank = 0;
    plane.state = 'circling';
    plane.svg.style.visibility = 'visible';
  }

  /* ---------- Flight ---------- */

  function step(plane, dt, now) {
    const ease = (rate) => 1 - Math.exp(-rate * dt);

    if (plane.state === 'gone') return;
    if (plane.state === 'waiting') {
      plane.wait -= dt;
      if (plane.wait <= 0) enter(plane);
      return;
    }

    plane.lift += ((plane.state === 'held' ? 1 : 0) - plane.lift) * ease(12);

    if (plane.state === 'held') {
      // Point the nose where the hand is moving.
      const trail = plane.trail;
      if (trail.length > 1) {
        const [t0, x0, y0] = trail[Math.max(0, trail.length - 4)];
        const [t1, x1, y1] = trail[trail.length - 1];
        if (t1 > t0 && Math.hypot(x1 - x0, y1 - y0) / (t1 - t0) > 0.08) {
          plane.heading += wrap(Math.atan2(y1 - y0, x1 - x0) - plane.heading) * ease(10);
        }
        if (trail.length > 32) trail.splice(0, trail.length - 32);
      }
      plane.bank += (0 - plane.bank) * ease(6);
      return;
    }

    if (plane.state === 'gliding') {
      const drag = Math.exp(-GLIDE_DRAG * dt);
      plane.vx *= drag;
      plane.vy *= drag;
      plane.x += plane.vx * dt;
      plane.y += plane.vy * dt;
      const v = Math.hypot(plane.vx, plane.vy);
      if (v > 1) plane.heading = Math.atan2(plane.vy, plane.vx);
      plane.bank += (Math.sin(now * 5 + plane.phase) * 0.25 - plane.bank) * ease(8);

      const margin = BOX;
      if (plane.x < -margin || plane.x > innerWidth + margin
          || plane.y < -margin || plane.y > innerHeight + margin) {
        // Thrown away: that was the only one, and it does not come back.
        plane.state = 'gone';
        plane.svg.remove();
      } else if (v < SETTLE_SPEED) {
        // Too slow to leave: circle where it ended up, kept inside the card.
        const inset = 40;
        plane.home = [
          clamp((plane.x - rect.left) / rect.width, inset / rect.width, 1 - inset / rect.width),
          clamp((plane.y - rect.top) / rect.height, inset / rect.height, 1 - inset / rect.height),
        ];
        plane.speed = v;
        plane.state = 'circling';
      }
      return;
    }

    // Circling: steer along a circle around home. Far away the plane heads
    // for home, on the circle it follows the tangent, inside it drifts out.
    const [homeX, homeY] = homeOf(plane);
    const toX = homeX - plane.x;
    const toY = homeY - plane.y;
    const distance = Math.hypot(toX, toY) || 1;
    const orbit = layout.orbit * (0.8 + 0.3 * Math.sin(now * 0.3 + plane.phase));
    const pull = clamp((distance - orbit) / orbit, -1, 2) * 1.2;
    const wantX = (-toY / distance) * plane.turn + (toX / distance) * pull;
    const wantY = (toX / distance) * plane.turn + (toY / distance) * pull;
    const turnRate = clamp(wrap(Math.atan2(wantY, wantX) - plane.heading) * 2.5, -2.2, 2.2);

    plane.heading += turnRate * dt;
    plane.speed += (layout.speed * plane.size - plane.speed) * ease(1.6);
    plane.x += Math.cos(plane.heading) * plane.speed * dt;
    plane.y += Math.sin(plane.heading) * plane.speed * dt;
    // Planes bank into their turns.
    plane.bank += (clamp(turnRate * 0.6, -0.85, 0.85) - plane.bank) * ease(6);
  }

  /* ---------- Drawing ---------- */

  function draw(plane, now) {
    if (plane.state === 'waiting' || plane.state === 'gone') return;

    const size = layout.unit * plane.size * (1 + 0.12 * plane.lift);
    const roll = plane.bank + Math.sin(now * 1.3 + plane.phase) * 0.06;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const ch = Math.cos(plane.heading), sh = Math.sin(plane.heading);
    const ct = Math.cos(TILT), st = Math.sin(TILT);

    const faces = FACES.map((face) => {
      const points = face.corners.map(([x, y, z]) => {
        // Roll about the plane's own axis, turn to its heading in the
        // screen plane, then tilt the whole scene towards the camera.
        const up = y * cr - z * sr;
        const side = y * sr + z * cr;
        const flatX = x * ch - side * sh;
        const flatY = x * sh + side * ch;
        return [flatX * size, (flatY * ct - up * st) * size, (flatY * st + up * ct) * size];
      });
      const [a, b, c] = points;
      let normal = unit(cross(sub(b, a), sub(c, a)));
      if (normal[2] < 0) normal = normal.map((n) => -n); // paper has two sides
      const light = Math.max(0, dot(normal, LIGHT)) * face.tone;
      return { points, light, depth: a[2] + b[2] + c[2] };
    }).sort((p, q) => p.depth - q.depth); // farthest first

    const { lit, shade, floor } = plane.colors;
    faces.forEach((face, k) => {
      const t = floor + (1 - floor) * face.light;
      const color = shade.map((s, n) => Math.round(s + (lit[n] - s) * t));
      plane.polygons[k].setAttribute('points',
        face.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      plane.polygons[k].setAttribute('fill', `rgb(${color})`);
    });

    plane.svg.style.transform =
      `translate3d(${(plane.x - BOX / 2).toFixed(1)}px, ${(plane.y - BOX / 2).toFixed(1)}px, 0)`;
  }

  /* ---------- Loop ---------- */

  let last = performance.now();
  function frame(time) {
    // Capped, so a tab that was in the background does not jump ahead.
    const dt = Math.min((time - last) / 1000, 0.05);
    last = time;
    const now = time / 1000;
    for (const plane of planes) {
      step(plane, dt, now);
      draw(plane, now);
    }
    // Nothing left to move once every plane has been thrown away.
    if (planes.some((plane) => plane.state !== 'gone')) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Helpers ---------- */

  function svgElement(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  // Angle difference folded into -pi..pi.
  function wrap(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
  function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function unit(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }
})();
