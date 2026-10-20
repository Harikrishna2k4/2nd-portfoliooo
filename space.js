/* Subtle space background: twinkling stars, a few faint drifting planets,
 * tiny asteroids and the occasional shooting star.
 * The whole field also shifts / tilts very slightly as the cursor moves.
 * Draws on a fixed canvas behind everything. The existing page gradient
 * (body::before / body::after in style.css) is not touched.
 */
(function () {
  'use strict';

  var canvas = document.createElement('canvas');
  canvas.id = 'space';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1;
  var stars = [], planets = [], asteroids = [], comet = null;
  var nextComet = 0;

  /* ---- cursor parallax (all values are tiny on purpose) ---- */
  var PARALLAX = 1.8;          // overall strength multiplier; 0 turns it off
  var TILT = 0.014;            // rotation = TILT * PARALLAX radians (~1.4 deg max)
  var targetX = 0, targetY = 0;    // where the cursor wants the field (-1..1)
  var mx = 0, my = 0;              // smoothed values actually used

  var PALETTE = [
    [154, 168, 255],
    [190, 160, 255],
    [120, 200, 230],
    [230, 180, 140]
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function sign() { return Math.random() < 0.5 ? -1 : 1; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var starCount = Math.max(60, Math.min(160, Math.round(W * H / 9000)));
    stars = [];
    for (var i = 0; i < starCount; i++) {
      var r = rand(0.3, 1.2);
      stars.push({
        x: rand(0, W), y: rand(0, H),
        r: r,
        a: rand(0.2, 0.65),
        tw: rand(0.5, 1.8),          // twinkle speed
        ph: rand(0, Math.PI * 2),
        vx: rand(3, 9) * sign(),     // px per second drift
        vy: rand(-3, 3),
        depth: r * 6                 // bigger stars shift a little more
      });
    }

    planets = [];
    for (var p = 0; p < 3; p++) {
      planets.push({
        x: rand(0, W), y: rand(0, H),
        r: rand(16, 38),
        c: PALETTE[p % PALETTE.length],
        ring: p === 1,
        vx: rand(6, 14) * sign(),
        vy: rand(-3, 3),
        depth: 16
      });
    }

    asteroids = [];
    for (var k = 0; k < 9; k++) {
      var n = 6 + Math.floor(Math.random() * 3);
      var shape = [];
      for (var s = 0; s < n; s++) shape.push(rand(0.65, 1.15));
      asteroids.push({
        x: rand(0, W), y: rand(0, H),
        r: rand(2, 5),
        shape: shape,
        rot: rand(0, Math.PI * 2),
        spin: rand(-0.6, 0.6),
        vx: rand(10, 22) * sign(),
        vy: rand(-6, 6),
        depth: 10
      });
    }
  }

  function wrap(o, margin) {
    if (o.x > W + margin) o.x = -margin;
    else if (o.x < -margin) o.x = W + margin;
    if (o.y > H + margin) o.y = -margin;
    else if (o.y < -margin) o.y = H + margin;
  }

  function spawnComet() {
    var ang = rand(20, 35) * Math.PI / 180;
    var speed = rand(550, 800);
    comet = {
      x: rand(W * 0.4, W * 1.0),
      y: rand(-20, H * 0.3),
      vx: -Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0,
      max: rand(0.9, 1.4)
    };
  }

  function drawStars(t) {
    ctx.fillStyle = '#fff';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = s.a * (0.6 + 0.4 * Math.sin(t * s.tw + s.ph));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x + mx * s.depth, s.y + my * s.depth, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanets() {
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var x = p.x + mx * p.depth;
      var y = p.y + my * p.depth;
      var g = ctx.createRadialGradient(x - p.r * 0.35, y - p.r * 0.35, p.r * 0.1, x, y, p.r);
      g.addColorStop(0, rgba(p.c, 0.55));
      g.addColorStop(1, rgba(p.c, 0.04));
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();

      if (p.ring) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.4);
        ctx.scale(1, 0.3);
        ctx.globalAlpha = 0.38;
        ctx.strokeStyle = rgba(p.c, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 1.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawAsteroids() {
    ctx.fillStyle = 'rgba(190, 196, 210, 0.33)';
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      var n = a.shape.length;
      var cx = a.x + mx * a.depth;
      var cy = a.y + my * a.depth;
      ctx.beginPath();
      for (var s = 0; s < n; s++) {
        var ang = a.rot + (s / n) * Math.PI * 2;
        var rr = a.r * a.shape[s];
        var px = cx + Math.cos(ang) * rr;
        var py = cy + Math.sin(ang) * rr;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawComet() {
    if (!comet) return;
    var k = comet.life / comet.max;
    var alpha = Math.sin(Math.min(1, k) * Math.PI) * 0.65;  // fade in and out
    var len = 120;
    var mag = Math.sqrt(comet.vx * comet.vx + comet.vy * comet.vy);
    var tx = comet.x - (comet.vx / mag) * len;
    var ty = comet.y - (comet.vy / mag) * len;
    var g = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
    g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(comet.x, comet.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  function render(t) {
    ctx.clearRect(0, 0, W, H);

    // very slight tilt of the whole field around the screen centre
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(mx * TILT * PARALLAX);
    ctx.translate(-W / 2, -H / 2);

    drawStars(t);
    drawPlanets();
    drawAsteroids();
    drawComet();

    ctx.restore();
  }

  var last = 0;
  function frame(ts) {
    var t = ts / 1000;
    var dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;

    // ease the parallax toward the cursor so it never snaps
    var k = 1 - Math.exp(-dt * 2.5);
    mx += (targetX - mx) * k;
    my += (targetY - my) * k;

    var i, o;
    for (i = 0; i < stars.length; i++) {
      o = stars[i]; o.x += o.vx * dt; o.y += o.vy * dt; wrap(o, 4);
    }
    for (i = 0; i < planets.length; i++) {
      o = planets[i]; o.x += o.vx * dt; o.y += o.vy * dt; wrap(o, o.r * 2);
    }
    for (i = 0; i < asteroids.length; i++) {
      o = asteroids[i]; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.spin * dt; wrap(o, 10);
    }

    if (comet) {
      comet.x += comet.vx * dt;
      comet.y += comet.vy * dt;
      comet.life += dt;
      if (comet.life >= comet.max) { comet = null; nextComet = t + rand(6, 12); }
    } else if (t >= nextComet) {
      spawnComet();
    }

    render(t);
    requestAnimationFrame(frame);
  }

  build();
  window.addEventListener('resize', function () {
    build();
    if (reduceMotion) render(0);
  });

  if (reduceMotion) {
    render(0);                 // static starfield only, no parallax
  } else {
    window.addEventListener('pointermove', function (e) {
      // field moves slightly OPPOSITE to the cursor
      targetX = -((e.clientX / W) - 0.5) * 2 * PARALLAX;
      targetY = -((e.clientY / H) - 0.5) * 2 * PARALLAX;
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () {
      targetX = 0;
      targetY = 0;
    });

    nextComet = performance.now() / 1000 + rand(3, 7);
    requestAnimationFrame(frame);
  }
})();