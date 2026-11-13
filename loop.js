export function loopRail(rail, tiles, row, motion) {
  if (tiles.length < 2) return;
  const before = tiles.map(tile => tile.cloneNode(true));
  const after = Array.from({length: 3}, () => tiles.map(tile => tile.cloneNode(true))).flat();
  for (const copy of [...before, ...after]) {
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelector('a').tabIndex = -1;
  }
  rail.prepend(...before);
  rail.append(...after);
  rail.classList.add('looping');
  let period = 0;
  let axis = "scrollLeft";
  let savedPhase;
  rail.addEventListener("gallery-before-axis", () => {
    savedPhase = period ? (rail[axis] - period) / period : 0;
  });
  let visible = false;
  let previous = 0;
  let remainder = 0;
  let resumeAfter = 0;
  let touching = false;
  let hovering = false;

  function measure() {
    const nextAxis = rail.closest("#rows").hasAttribute("data-vertical") ? "scrollTop" : "scrollLeft";
    const offset = nextAxis === "scrollTop" ? "offsetTop" : "offsetLeft";
    const next = tiles[0][offset] - before[0][offset];
    if (!next || (next === period && nextAxis === axis)) return;
    const phase = savedPhase ?? (period ? (rail[axis] - period) / period : 0);
    savedPhase = undefined;
    axis = nextAxis;
    period = next;
    rail[axis] = period * (1 + phase);
  }

  function wrap() {
    if (!period || touching || rail.contains(document.activeElement)) return;
    if (rail[axis] < period * .5) rail[axis] += period;
    if (rail[axis] >= period * 1.5) rail[axis] -= period;
  }

  rail.addEventListener('scroll', wrap, {passive: true});
  rail.addEventListener('wheel', () => { resumeAfter = performance.now() + 1300; }, {passive: true});
  rail.addEventListener('pointerenter', event => { hovering = event.pointerType === 'mouse'; });
  rail.addEventListener('pointerleave', () => { hovering = false; });
  rail.addEventListener('touchstart', () => { touching = true; }, {passive: true});
  for (const event of ['touchend', 'touchcancel']) {
    rail.addEventListener(event, () => {
      touching = false;
      resumeAfter = performance.now() + 1300;
    }, {passive: true});
  }
  rail.addEventListener("gallery-axis", measure);
  new ResizeObserver(measure).observe(rail);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(rail);

  function advance(now) {
    const elapsed = previous ? Math.min(now - previous, 50) : 0;
    previous = now;
    if (visible && period && motion.playing && !motion.still && !motion.turning && !hovering && !touching &&
        now >= resumeAfter && !rail.contains(document.activeElement)) {
      remainder += elapsed * (16 + row * 2) * (row % 2 ? -1 : 1) * (axis === "scrollTop" ? -1 : 1) * (motion.reverse ? -1 : 1) / 1000;
      const pixels = Math.trunc(remainder);
      if (pixels) {
        remainder -= pixels;
        rail[axis] += pixels;
      }
    }
    requestAnimationFrame(advance);
  }
  requestAnimationFrame(advance);
}
