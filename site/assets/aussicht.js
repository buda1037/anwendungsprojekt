/* Turmberg Software – the view from the Turmberg, behind the hero text.

   Looking west over Karlsruhe and the Rhine plain: sky and clouds, the hills
   on the horizon, the plain with its towns, foliage in the foreground. The
   light follows the real position of the sun over the Turmberg, so the page
   shows a day sky by day, a sunset in the evening and the lit city at night.

   Nothing here is a photo or a video. To still read as out-of-focus footage
   rather than a drawing, the view avoids drawn shapes: clouds, fields and
   towns come from noise and are laid out in perspective, lights are lens
   bokeh, and the stylesheet blurs the result and puts film grain on top.

   Preview any time of day with ?zeit=HH:MM in the address, e.g. ?zeit=21:30.
   Visitors who prefer reduced motion get the same view as a still. */

(() => {
  'use strict';

  const card = document.querySelector('.hero__card');
  if (!card) return;
  const text = card.querySelector('.hero__content');

  const PLACE = { lat: 48.997, lon: 8.479 }; // Turmberg, Karlsruhe-Durlach
  const BLEED = 24; // px the canvases extend past the card, so the blur has no soft edge
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const preview = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get('zeit') || '');
  function clock() {
    const date = new Date();
    if (preview) date.setHours(+preview[1], +preview[2], 0, 0);
    return date;
  }

  /* ---------- Light ---------- */

  // One entry per sun elevation (degrees above the horizon), from deep night
  // to full day; the light in between is blended. top..hor are the sky from
  // zenith to horizon, glow the light around the sun's place on the horizon,
  // hills the ranges on the horizon, far/near the plain, cloudLit/cloudShade
  // the thin edges and thick cores of clouds. The text sits on upper/mid, so those stay fairly dark.
  const SKIES = [
    { sun: -18, top: [7, 10, 22], upper: [10, 15, 32], mid: [15, 21, 42], low: [24, 28, 52], hor: [36, 36, 60],
      glow: [70, 70, 110], glowA: 0, hills: [14, 17, 34], far: [20, 24, 46], near: [6, 9, 18],
      cloudLit: [40, 46, 72], cloudShade: [9, 12, 26], cloudA: 0.7, foliage: [4, 7, 12] },
    { sun: -6, top: [16, 24, 52], upper: [32, 44, 84], mid: [80, 84, 122], low: [190, 136, 122], hor: [232, 152, 100],
      glow: [244, 150, 96], glowA: 0.5, hills: [60, 52, 82], far: [44, 46, 80], near: [9, 14, 28],
      cloudLit: [176, 112, 112], cloudShade: [30, 34, 64], cloudA: 0.85, foliage: [8, 13, 18] },
    { sun: 0, top: [34, 60, 110], upper: [62, 92, 142], mid: [118, 116, 142], low: [228, 170, 124], hor: [252, 166, 92],
      glow: [255, 176, 100], glowA: 0.7, hills: [98, 84, 102], far: [88, 88, 110], near: [22, 34, 40],
      cloudLit: [255, 176, 128], cloudShade: [66, 62, 92], cloudA: 0.9, foliage: [12, 20, 20] },
    { sun: 6, top: [38, 76, 138], upper: [54, 94, 156], mid: [82, 114, 162], low: [220, 196, 164], hor: [244, 208, 160],
      glow: [255, 224, 176], glowA: 0.45, hills: [122, 130, 148], far: [126, 140, 150], near: [42, 70, 56],
      cloudLit: [255, 232, 204], cloudShade: [116, 122, 148], cloudA: 0.9, foliage: [20, 36, 28] },
    { sun: 20, top: [30, 72, 144], upper: [44, 92, 166], mid: [68, 118, 182], low: [150, 186, 220], hor: [188, 208, 226],
      glow: [255, 255, 244], glowA: 0.2, hills: [104, 132, 164], far: [134, 158, 174], near: [54, 90, 64],
      cloudLit: [250, 252, 255], cloudShade: [160, 176, 200], cloudA: 0.9, foliage: [26, 48, 34] },
  ];
  const SODIUM = [255, 176, 96]; // street lighting
  const WARM = [255, 222, 170];
  const COOL = [215, 230, 255];
  const RED = [255, 70, 50];

  function skyFor(elevation) {
    const last = SKIES.length - 1;
    if (elevation <= SKIES[0].sun) return SKIES[0];
    if (elevation >= SKIES[last].sun) return SKIES[last];
    const i = SKIES.findIndex((entry) => entry.sun > elevation);
    const a = SKIES[i - 1];
    const b = SKIES[i];
    const t = (elevation - a.sun) / (b.sun - a.sun);
    const blended = {};
    for (const key of Object.keys(a)) {
      blended[key] = Array.isArray(a[key]) ? mix(a[key], b[key], t) : a[key] + (b[key] - a[key]) * t;
    }
    return blended;
  }

  // Where the sun stands: elevation above the horizon and azimuth clockwise
  // from north, both in degrees. Low-precision almanac formulas, good to a
  // fraction of a degree.
  function sunPosition(date, lat, lon) {
    const rad = Math.PI / 180;
    const days = date.getTime() / 86400000 - 10957.5; // since 1 Jan 2000, 12:00 UTC
    const anomaly = (357.528 + 0.9856003 * days) * rad;
    const longitude = (280.46 + 0.9856474 * days + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * rad;
    const tilt = (23.439 - 0.0000004 * days) * rad;
    const ascension = Math.atan2(Math.cos(tilt) * Math.sin(longitude), Math.cos(longitude));
    const declination = Math.asin(Math.sin(tilt) * Math.sin(longitude));
    const siderealHours = 18.697374558 + 24.06570982441908 * days;
    const hourAngle = (siderealHours * 15 + lon) * rad - ascension;
    const phi = lat * rad;
    const elevation = Math.asin(Math.sin(phi) * Math.sin(declination)
      + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle));
    const fromSouth = Math.atan2(Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi));
    return { elevation: elevation / rad, azimuth: ((fromSouth / rad + 180) % 360 + 360) % 360 };
  }

  /* ---------- Noise: the raw material for everything organic ---------- */

  // Smooth random values on a grid that repeats after `period` cells.
  function lattice(seed, period) {
    const next = seeded(seed);
    const values = Float32Array.from({ length: period * period }, next);
    const wrap = (n) => ((n % period) + period) % period;
    return (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const fx = x - xi;
      const fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const x0 = wrap(xi), x1 = wrap(xi + 1), y0 = wrap(yi), y1 = wrap(yi + 1);
      const a = values[y0 * period + x0], b = values[y0 * period + x1];
      const c = values[y1 * period + x0], d = values[y1 * period + x1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }

  // Several layers of that noise, each finer and fainter: cloud-like detail.
  function fractal(noise, x, y, octaves) {
    let sum = 0;
    let weight = 0.5;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      sum += weight * noise(x, y);
      total += weight;
      x *= 2;
      y *= 2;
      weight *= 0.5;
    }
    return sum / total;
  }

  // A square, seamlessly repeating white image whose transparency is alphaAt(u, v).
  const TILE = 256;
  function tile(alphaAt) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = (y * TILE + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] = 255 * clamp(alphaAt(x / TILE, y / TILE), 0, 1);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  // Maps of the sky and the plain seen from straight above. They are laid
  // out in perspective when painted, row by row.
  const cloudNoise = lattice(3, 6);
  const cloudCover = (u, v) => fractal(cloudNoise, u * 6, v * 6, 5);
  const cloudTile = tile((u, v) => smooth(0.47, 0.62, cloudCover(u, v))); // where there is cloud at all
  const coreTile = tile((u, v) => smooth(0.58, 0.8, cloudCover(u, v)) * 0.9); // where it is thick
  const landNoise = lattice(5, 8);
  const forestTile = tile((u, v) => smooth(0.5, 0.64, fractal(landNoise, u * 8, v * 8, 4)));
  const fieldTile = tile((u, v) => smooth(0.54, 0.7, fractal(landNoise, u * 8 + 3.3, v * 8 + 1.7, 4)));
  const ridgeNoise = lattice(11, 64);

  /* ---------- Lights ---------- */

  const random = seeded(7);
  const pick = (from, to) => from + random() * (to - from);
  const list = (length, make) => Array.from({ length }, (_, i) => make(i));

  // The plain in perspective: `depth` is the distance from the viewer (1 at
  // the foot of the hill, 12.5 at the horizon), `level` how far down the
  // ground that lies on screen (0 at the horizon, 1 at the bottom edge).
  const levelAt = (depth) => (1 / depth - 0.08) / 0.92;
  const depthAt = (level) => 1 / (0.08 + 0.92 * level);

  // Towns: lights are kept where a noise map says "built up", plus the city
  // in the middle distance. Most lights end up near the horizon, as they do
  // in a real view, because that is where most of the plain is.
  const townNoise = lattice(17, 32);
  const lights = [];
  for (let tries = 0; tries < 9000 && lights.length < 760; tries++) {
    const x = pick(-0.05, 1.05);
    const level = Math.pow(random(), 2.1);
    const depth = depthAt(level);
    const across = (x - 0.5) * depth;
    const city = 0.3 * Math.exp(-(Math.pow((across - 0.3) / 2.6, 2) + Math.pow((depth - 6) / 2.4, 2)));
    const builtUp = fractal(townNoise, across * 0.9 + 9, depth * 0.9, 3) + city;
    if (builtUp < 0.5 + random() * 0.14 || (depth < 2.4 && random() < 0.6)) continue;
    const kind = random();
    const bright = Math.pow(random(), 3); // a few bright ones, many faint ones
    lights.push({
      x, level,
      color: kind < 0.58 ? SODIUM : kind < 0.84 ? WARM : kind < 0.97 ? COOL : RED,
      strength: 0.16 + 0.6 * bright,
      radius: pick(2.4, 4.2) + (bright > 0.6 ? 1.6 : 0),
      phase: pick(0, 6.3), rate: pick(0.4, 2.2),
    });
  }

  // An avenue running away from the viewer, its lamps closing up towards
  // the horizon, and the motorway crossing in front of the city.
  const avenueX = (depth) => 0.5 + (0.42 / depth) * 0.9;
  const lamps = list(34, (i) => ({ depth: 1.9 + i * 0.3 }));
  const avenueCars = list(9, (i) => ({ at: random(), speed: pick(0.035, 0.06) * (i % 2 ? 1 : -1) }));
  const motorway = (x) => 0.2 + 0.035 * Math.sin(x * 3 + 0.5);
  const motorwayCars = list(18, (i) => ({ at: random(), speed: pick(0.02, 0.04) * (i % 2 ? 1 : -1) }));
  // Red warning lights on masts and wind turbines, blinking slowly.
  const beacons = list(7, () => ({ x: pick(0.05, 0.95), level: pick(0, 0.035), phase: pick(0, 6.3) }));
  const stars = list(110, () => ({ x: random(), y: random() * 0.9, strength: Math.pow(random(), 2.5), phase: pick(0, 6.3), rate: pick(0.5, 2) }));

  /* ---------- Canvases ---------- */

  // The scene is painted small and scaled up by the stylesheet. Lights get
  // their own, finer canvas with less blur, so they keep the round, defined
  // look of out-of-focus lights in a lens.
  const scene = layer('aussicht');
  const glints = layer('aussicht aussicht--lichter');
  const grain = document.createElement('div');
  grain.className = 'aussicht__korn';
  grain.setAttribute('aria-hidden', 'true');
  card.prepend(scene.canvas, glints.canvas, grain);

  function layer(className) {
    const canvas = document.createElement('canvas');
    if (className) {
      canvas.className = className;
      canvas.setAttribute('aria-hidden', 'true');
    }
    return { canvas, ctx: canvas.getContext('2d') };
  }

  // Film grain: a small tile of random greys, blended over the view.
  {
    const speckle = layer();
    speckle.canvas.width = speckle.canvas.height = 128;
    const image = speckle.ctx.createImageData(128, 128);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 128 + (random() - 0.5) * 150;
      image.data[i + 3] = 255;
    }
    speckle.ctx.putImageData(image, 0, 0);
    grain.style.backgroundImage = `url(${speckle.canvas.toDataURL()})`;
  }

  // Painted once per change of light or size, then reused every frame.
  const backdrop = layer(); // sky, sun and moon, hills, plain
  const foliage = layer(); // leaves in the lower corners
  const clouds = layer();
  const cores = layer();
  const cloudPattern = clouds.ctx.createPattern(cloudTile, 'repeat');
  const corePattern = cores.ctx.createPattern(coreTile, 'repeat');

  const SCENE_SCALE = 3; // CSS px per canvas px
  const GLINT_SCALE = 2;
  const CLOUD_SCALE = 6;
  let width = 0; // of the view in CSS px, bleed included
  let height = 0;
  let horizon = 0; // y of the horizon
  let ground = 0; // height of the plain below it
  let textBox = null; // where the hero text sits
  let sun = sunPosition(clock(), PLACE.lat, PLACE.lon);
  let sky = skyFor(sun.elevation);
  let now = 0; // time of the latest frame, in seconds

  function measure() {
    const box = card.getBoundingClientRect();
    width = box.width + 2 * BLEED;
    height = box.height + 2 * BLEED;
    ground = clamp(0.36 * height, 150, 400);
    horizon = height - ground;
    size(scene.canvas, width / SCENE_SCALE, height / SCENE_SCALE);
    size(backdrop.canvas, width / SCENE_SCALE, height / SCENE_SCALE);
    size(glints.canvas, width / GLINT_SCALE, height / GLINT_SCALE);
    size(clouds.canvas, width / CLOUD_SCALE, horizon / CLOUD_SCALE);
    size(cores.canvas, width / CLOUD_SCALE, horizon / CLOUD_SCALE);
    size(foliage.canvas, width / CLOUD_SCALE, Math.min(0.34 * height, 230) / CLOUD_SCALE);
    textBox = null;
    if (text) {
      const t = text.getBoundingClientRect();
      textBox = {
        x: t.left + t.width / 2 - box.left + BLEED,
        y: t.top + t.height / 2 - box.top + BLEED,
        w: t.width,
        h: t.height,
      };
    }
    paintBackdrop();
    paintFoliage();
    draw(now); // resizing emptied the canvases; do not wait for the next frame
  }

  function size(canvas, w, h) {
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
  }

  /* ---------- Painting ---------- */

  const nightAmount = () => smooth(-4, -12, sun.elevation); // stars and moon
  const litAmount = () => smooth(3, -5, sun.elevation); // lights in the plain
  const groundY = (level) => horizon + 8 + level * (ground - 8);

  function paintBackdrop() {
    const ctx = backdrop.ctx;
    const w = width;
    ctx.setTransform(1 / SCENE_SCALE, 0, 0, 1 / SCENE_SCALE, 0, 0); // paint in CSS px
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    const air = ctx.createLinearGradient(0, 0, 0, horizon);
    air.addColorStop(0, rgba(sky.top));
    air.addColorStop(0.35, rgba(sky.upper));
    air.addColorStop(0.66, rgba(sky.mid));
    air.addColorStop(0.9, rgba(sky.low));
    air.addColorStop(1, rgba(sky.hor));
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, w, horizon + 2);

    const night = nightAmount();
    const lit = litAmount();
    if (night > 0) {
      // The moon keeps its place in the upper right; only the sun is tracked.
      disc(ctx, w * 0.87, horizon * 0.2, 90, [190, 204, 255], 0.2 * night);
      disc(ctx, w * 0.87, horizon * 0.2, 15, [250, 248, 235], night, 0.75);
    }

    // The view is 110 degrees wide and centered on west, so the sun enters
    // from the left in the afternoon and sets inside the frame.
    const sunX = (0.5 + (sun.azimuth - 270) / 110) * w;
    const sunY = horizon - (sun.elevation / 50) * horizon * 0.92;
    const sunInView = sunX > -0.2 * w && sunX < 1.2 * w;
    if (sky.glowA > 0) {
      const centerX = sunInView ? clamp(sunX, 0.1 * w, 0.9 * w) : w / 2;
      ctx.save();
      ctx.translate(centerX, horizon);
      ctx.scale(1, 0.4 * horizon / (0.8 * w));
      disc(ctx, 0, 0, 0.8 * w, sky.glow, sky.glowA * (sunInView ? 1 : 0.55));
      ctx.restore();
    }
    if (sunInView && sun.elevation > -4) {
      const color = mix([255, 252, 236], [255, 196, 130], smooth(14, 0, sun.elevation));
      // Where the sun passes behind the text it dims to a glow, so white
      // type never sits on a white disc.
      const clear = textBox
        ? smooth(1, 1.8, Math.hypot((sunX - textBox.x) / (textBox.w * 0.7), (sunY - textBox.y) / (textBox.h * 1.2)))
        : 1;
      disc(ctx, sunX, sunY, 220, color, 0.22 + 0.2 * clear);
      disc(ctx, sunX, sunY, 60, color, 0.3 * clear);
      disc(ctx, sunX, sunY, 20, [255, 255, 250], 0.15 + 0.85 * clear, 0.7);
    }
    if (lit > 0) {
      // The glow a city throws into the haze above it.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(w * 0.56, horizon);
      ctx.scale(1, 0.2 * horizon / (0.42 * w));
      disc(ctx, 0, 0, 0.42 * w, [255, 160, 96], 0.2 * lit);
      ctx.restore();
    }

    // Four ranges of hills, each a little nearer, darker and clearer than
    // the one behind it: distance shows as haze.
    for (let range = 0; range < 4; range++) {
      const base = horizon + range * 3;
      const rise = 12 + range * 7;
      ctx.fillStyle = rgba(mix(sky.hor, sky.hills, 0.45 + 0.18 * range));
      ctx.beginPath();
      ctx.moveTo(0, base + 40);
      for (let x = 0; x <= w + 6; x += 6) {
        const profile = fractal(ridgeNoise, (x / w) * (3 + range) + range * 7.3, range * 3.1, 4);
        ctx.lineTo(x, base - Math.pow(profile, 1.6) * rise * 1.8);
      }
      ctx.lineTo(w, base + 40);
      ctx.closePath();
      ctx.fill();
    }

    // The plain: lighter and hazier towards the horizon, with forest and
    // fields laid over it in perspective.
    const top = horizon + 9;
    const land = ctx.createLinearGradient(0, top, 0, height);
    land.addColorStop(0, rgba(sky.far));
    land.addColorStop(1, rgba(sky.near));
    ctx.fillStyle = land;
    ctx.fillRect(0, top, w, height - top);
    const day = 1 - lit;
    flatten(ctx, forestTile, mix(sky.near, [0, 0, 0], 0.45), 0.25 + 0.45 * day, top);
    flatten(ctx, fieldTile, mix(sky.far, [255, 244, 214], 0.35), 0.3 * day, top);
    if (day > 0) {
      // Towns by day: pale roofs where the lights are at night.
      ctx.fillStyle = rgba([232, 228, 218]);
      for (const light of lights) {
        ctx.globalAlpha = day * 0.22 * (0.4 + light.strength);
        ctx.fillRect(light.x * w - 3, groundY(light.level) - 2, 6 + 8 * light.level, 3 + 4 * light.level);
      }
      ctx.globalAlpha = 1;
    }
    const haze = ctx.createLinearGradient(0, horizon + 14, 0, horizon + ground * 0.45);
    haze.addColorStop(0, rgba(sky.hor, 0.4));
    haze.addColorStop(1, rgba(sky.hor, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon + 14, w, ground * 0.45);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Lays a top-down map onto the plain: every screen row shows the map at
  // that row's distance, shrunk towards the horizon like real ground.
  function flatten(ctx, map, color, alpha, top) {
    if (alpha <= 0) return;
    const sheet = layer();
    const rows = Math.max(1, Math.round((height - top) / SCENE_SCALE));
    const w = Math.round(width / SCENE_SCALE);
    size(sheet.canvas, w, rows);
    const pattern = sheet.ctx.createPattern(map, 'repeat');
    sheet.ctx.fillStyle = pattern;
    for (let row = 0; row < rows; row++) {
      const level = (row + 0.5) / rows;
      const depth = depthAt(level);
      const zoom = w / (depth * 70);
      pattern.setTransform({ a: zoom, b: 0, c: 0, d: 1, e: w / 2, f: row - depth * 42 });
      sheet.ctx.globalAlpha = smooth(0, 0.2, level); // lost in haze at the horizon
      sheet.ctx.fillRect(0, row, w, 1);
    }
    tint(sheet.ctx, color, w, rows);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sheet.canvas, 0, top, width, height - top);
    ctx.globalAlpha = 1;
  }

  // Fills whatever is painted on a canvas with one color, keeping its shape.
  function tint(ctx, color, w, h) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(color);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Branches reaching in from the lower corners. Painted very small, so the
  // scaling alone blurs them more than the distance: near things are the
  // most out of focus.
  function paintFoliage() {
    const { canvas, ctx } = foliage;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rgba(sky.foliage);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x++) {
      const u = x / w;
      const corner = Math.max(smooth(0.3, 0, u), smooth(0.7, 1, u)); // tall at both edges, none in the middle
      const crowns = 0.55 + 0.9 * fractal(ridgeNoise, u * 26, 40.5, 3);
      ctx.lineTo(x, h - h * Math.pow(corner, 1.3) * crowns * 0.85);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // Clouds: the sky map in perspective, as a ceiling. Rows near the horizon
  // show the map from far away, so clouds there are small, flat and slow,
  // while those overhead are large and drift visibly.
  function paintClouds(time) {
    const w = clouds.canvas.width;
    const rows = clouds.canvas.height;
    const drift = still ? 0 : time * 1.3; // in map pixels
    for (const sheet of [clouds, cores]) {
      sheet.ctx.globalCompositeOperation = 'source-over';
      sheet.ctx.clearRect(0, 0, w, rows);
      sheet.ctx.fillStyle = sheet === clouds ? cloudPattern : corePattern;
    }
    for (let row = 0; row < rows; row++) {
      const y = (row + 0.5) / rows; // 0 overhead, 1 at the horizon
      const depth = 1 / (1.12 - y);
      const zoom = w / (depth * 110);
      const place = { a: zoom, b: 0, c: 0, d: 1, e: w / 2 - drift * zoom, f: row - depth * 30 - drift * 0.2 };
      cloudPattern.setTransform(place);
      corePattern.setTransform(place);
      clouds.ctx.globalAlpha = cores.ctx.globalAlpha = 1 - smooth(0.62, 0.9, y);
      clouds.ctx.fillRect(0, row, w, 1);
      cores.ctx.fillRect(0, row, w, 1);
    }
    // Thin edges catch the light, thick cores stay in shade.
    tint(clouds.ctx, sky.cloudLit, w, rows);
    tint(cores.ctx, sky.cloudShade, w, rows);
    clouds.ctx.globalCompositeOperation = 'source-atop';
    clouds.ctx.drawImage(cores.canvas, 0, 0);
    if (textBox) {
      // Clouds thin out behind the text, so white type never sits on them.
      clouds.ctx.globalCompositeOperation = 'destination-out';
      clouds.ctx.save();
      clouds.ctx.translate(textBox.x / CLOUD_SCALE, textBox.y / CLOUD_SCALE);
      clouds.ctx.scale(1, Math.max(0.25, (textBox.h * 1.5) / textBox.w));
      disc(clouds.ctx, 0, 0, (textBox.w * 0.78) / CLOUD_SCALE, [0, 0, 0], 0.72, 0.55);
      clouds.ctx.restore();
    }
    clouds.ctx.globalCompositeOperation = 'source-over';
  }

  function draw(time) {
    const sway = still ? 0 : Math.sin(time * 0.07); // a slow drift, as if filmed by hand
    const ctx = scene.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(backdrop.canvas, 0, 0);

    ctx.setTransform(1 / SCENE_SCALE, 0, 0, 1 / SCENE_SCALE, 0, 0); // paint in CSS px
    paintClouds(time);
    ctx.globalAlpha = sky.cloudA;
    ctx.drawImage(clouds.canvas, 0, 0, width, horizon);
    ctx.globalAlpha = 1;

    const leaves = foliage.canvas.height * CLOUD_SCALE;
    ctx.drawImage(foliage.canvas, sway * 10 - 12, height - leaves - BLEED + 6, width + 24, leaves);

    // A soft shade behind the text and in the corners, as a lens would give.
    if (textBox) {
      ctx.save();
      ctx.translate(textBox.x, textBox.y);
      ctx.scale(1, Math.max(0.2, (textBox.h * 1.5) / textBox.w));
      disc(ctx, 0, 0, textBox.w * 0.8, [8, 12, 30], 0.42, 0.55);
      ctx.restore();
    }
    const corners = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45,
      width / 2, height / 2, Math.hypot(width, height) * 0.6);
    corners.addColorStop(0, 'rgba(4,6,18,0)');
    corners.addColorStop(1, 'rgba(4,6,18,0.42)');
    ctx.fillStyle = corners;
    ctx.fillRect(0, 0, width, height);

    drawLights(time);

    // The whole picture moves a few pixels, the grain changes like sensor noise.
    scene.canvas.style.transform = glints.canvas.style.transform = `translate3d(${(sway * 5).toFixed(2)}px, 0, 0)`;
    if (!still) grain.style.backgroundPosition = `${Math.floor(random() * 128)}px ${Math.floor(random() * 128)}px`;
  }

  function drawLights(time) {
    const ctx = glints.ctx;
    const night = nightAmount();
    const lit = litAmount();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, glints.canvas.width, glints.canvas.height);
    if (night <= 0 && lit <= 0) return;
    ctx.setTransform(1 / GLINT_SCALE, 0, 0, 1 / GLINT_SCALE, 0, 0); // paint in CSS px
    ctx.globalCompositeOperation = 'lighter'; // light adds up where discs overlap
    const flicker = (rate, phase, depth) => (still ? 1 : 1 - depth + depth * Math.sin(time * rate + phase));

    ctx.fillStyle = '#fff';
    for (const star of stars) {
      spot(ctx, star.x * width, star.y * horizon, 1.6, night * (0.1 + 0.5 * star.strength) * flicker(star.rate, star.phase, 0.3));
    }
    if (lit <= 0) return;

    for (const light of lights) {
      ctx.fillStyle = rgba(light.color);
      spot(ctx, light.x * width, groundY(light.level), light.radius, lit * light.strength * flicker(light.rate, light.phase, 0.14));
    }
    ctx.fillStyle = rgba(SODIUM);
    for (const lamp of lamps) {
      spot(ctx, avenueX(lamp.depth) * width, groundY(levelAt(lamp.depth)), 1.6 + 4 / lamp.depth, lit * 0.55);
    }
    // Traffic: headlights towards the viewer, tail lights away.
    for (const car of avenueCars) {
      const along = (((car.at + (still ? 0 : time * car.speed * 0.25)) % 1) + 1) % 1;
      const depth = 1.8 + along * 9;
      ctx.fillStyle = rgba(car.speed < 0 ? COOL : RED);
      spot(ctx, avenueX(depth) * width + (car.speed < 0 ? -5 : 5) / depth, groundY(levelAt(depth)), 1.4 + 4.5 / depth, lit * 0.8);
    }
    for (const car of motorwayCars) {
      const x = (((car.at + (still ? 0 : time * car.speed)) % 1.2) + 1.2) % 1.2 - 0.1;
      ctx.fillStyle = rgba(car.speed > 0 ? COOL : RED);
      spot(ctx, x * width, groundY(motorway(x)) + (car.speed > 0 ? 3 : -3), 3, lit * 0.75);
    }
    ctx.fillStyle = rgba(RED);
    for (const beacon of beacons) {
      const blink = still ? 1 : smooth(0.2, 0.8, Math.sin(time * 1.9 + beacon.phase));
      spot(ctx, beacon.x * width, groundY(beacon.level) - 10, 2.6, lit * blink * 0.9);
    }
  }

  // An out-of-focus point of light: a flat round disc.
  function spot(ctx, x, y, radius, alpha) {
    if (alpha <= 0.004) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 6.2832);
    ctx.fill();
  }

  // A soft round glow that fades to nothing at its edge; core is the share
  // of the radius that stays solid.
  function disc(ctx, x, y, radius, color, alpha, core = 0) {
    const glow = ctx.createRadialGradient(x, y, radius * core, x, y, radius);
    glow.addColorStop(0, rgba(color, alpha));
    glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  /* ---------- Running ---------- */

  measure();
  addEventListener('resize', measure);
  const watcher = new ResizeObserver(measure);
  watcher.observe(card);
  if (text) watcher.observe(text);

  setInterval(() => {
    sun = sunPosition(clock(), PLACE.lat, PLACE.lon);
    sky = skyFor(sun.elevation);
    paintBackdrop();
    paintFoliage();
    if (still) draw(now);
  }, 30000);

  if (!still) {
    // Every second frame is plenty for something this soft.
    let count = 0;
    const frame = (time) => {
      now = time / 1000;
      if (count++ % 2 === 0) draw(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Helpers ---------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  // 0 at from, 1 at to, eased in between; from may be larger than to.
  function smooth(from, to, value) {
    const t = clamp((value - from) / (to - from), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function mix(a, b, t) {
    return a.map((value, i) => value + (b[i] - value) * t);
  }
  function rgba(color, alpha = 1) {
    return `rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${alpha})`;
  }
  // Small repeatable random number generator (mulberry32).
  function seeded(seed) {
    let state = seed;
    return () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
