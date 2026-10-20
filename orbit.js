/* Orbiting social icons around the profile picture.
 * - On load the icons spiral out from behind the avatar, circle it, and settle
 *   into evenly spaced positions.
 * - After that each icon floats gently (CSS animation on the inner link).
 */
(function () {
  'use strict';

  var orbit = document.querySelector('.orbit');
  if (!orbit) return;

  var items = Array.prototype.slice.call(orbit.querySelectorAll('.orbit-item'));
  var count = items.length;
  if (!count) return;

  var START_ANGLE = -90;            // first icon sits at the top
  var STEP = 360 / count;           // even spacing
  var TURNS = 1.5;                  // how many times they circle before settling
  var DURATION = 2600;              // ms
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var radius = 0;
  var progress = 0;                 // 0 -> 1 during intro, stays 1 afterwards

  // Outward direction of each icon (used by the CSS float so every icon
  // moves along its own radius and all stay equally far from the photo).
  items.forEach(function (el, i) {
    var a = (START_ANGLE + i * STEP) * Math.PI / 180;
    el.style.setProperty('--ux', Math.cos(a).toFixed(4));
    el.style.setProperty('--uy', Math.sin(a).toFixed(4));
  });

  function measure() {
    var iconSize = items[0].offsetWidth;
    radius = orbit.clientWidth / 2 - iconSize / 2;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function place() {
    var eased = easeOutCubic(progress);
    var spin = (1 - eased) * TURNS * 360;   // extra rotation that unwinds to 0
    var r = radius;                         // radius is FIXED: icons only rotate, never move in/out
    var opacity = Math.min(1, progress * 5).toFixed(2);

    items.forEach(function (el, i) {
      var angle = (START_ANGLE + i * STEP + spin) * Math.PI / 180;
      var x = Math.cos(angle) * r;
      var y = Math.sin(angle) * r;
      el.style.transform =
        'translate(-50%, -50%) translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
      el.style.opacity = opacity;
    });
  }

  function startFloating() {
    orbit.classList.add('is-settled');
  }

  function run() {
    measure();

    if (reduceMotion) {
      progress = 1;
      place();
      startFloating();
      return;
    }

    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      progress = Math.min(1, (ts - t0) / DURATION);
      place();
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        startFloating();
      }
    }
    place();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function () {
    measure();
    place();
  });

  // Wait for the avatar so the layout is stable before animating.
  var avatar = orbit.querySelector('.avatar');
  if (avatar && !avatar.complete) {
    avatar.addEventListener('load', run, { once: true });
    avatar.addEventListener('error', run, { once: true });
  } else {
    run();
  }
})();