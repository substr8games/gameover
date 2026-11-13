const idleDelay = 30_000;
const sceneDuration = 60_000;
const slideDuration = 8_000;

export function installIdleExhibit({gallery, rows, motion, motionPreference, switchOrientation, collections}) {
  const artwork = [...new Set(collections.flatMap(collection =>
    collection.works.flatMap(work => [work.front, work.back].filter(Boolean))
  ))];
  const slideshow = document.createElement('div');
  slideshow.className = 'idle-slideshow';
  slideshow.hidden = true;
  slideshow.inert = true;
  document.body.append(slideshow);

  let timeout;
  let snapshot;
  let scene = 0;
  let transition;
  let slides;
  let fades;
  let ghostTimer;
  let ghostCursor;
  let ghostExhibit;
  let ghostTarget;
  const originalTiles = new Map();
  let fadingTile;
  let fadeSession;
  let lastImage;
  let waking = false;

  function arm() {
    clearTimeout(timeout);
    if (snapshot || waking || document.hidden || gallery.hidden || motionPreference.matches || !motion.playing) return;
    timeout = setTimeout(begin, idleDelay);
  }

  function begin() {
    if (document.hidden || gallery.hidden || motionPreference.matches || !motion.playing) return;
    if (motion.turning) return arm();
    const columns = [...rows.children];
    snapshot = {
      vertical: rows.hasAttribute('data-vertical'),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      reverse: motion.reverse,
      columns: columns.map(column => {
        const rail = column.querySelector('.rail');
        return {column, rail, left: rail.scrollLeft, top: rail.scrollTop};
      })
    };
    scene = 0;
    gallery.classList.add('idle-exhibit');
    rows.scrollIntoView({block: 'start', behavior: 'instant'});
    timeout = setTimeout(advance, sceneDuration);
  }

  async function advance() {
    if (!snapshot) return;
    if (scene === 0) {
      transition = switchOrientation();
      try {
        await transition;
      } finally {
        transition = null;
      }
    } else if (scene === 1) {
      motion.reverse = !motion.reverse;
    } else if (scene === 2 && artwork.length) {
      slideshow.hidden = false;
      showSlide();
      slides = setInterval(showSlide, slideDuration);
    } else if (scene === 3) {
      stopSlides();
      startFades();
    } else if (scene === 4) {
      stopFades();
      startGhost();
    } else {
      stopGhost();
      scene = -1;
    }
    scene++;
    if (snapshot && !waking) timeout = setTimeout(advance, sceneDuration);
  }

  function showSlide() {
    const choices = artwork.filter(src => src !== lastImage);
    lastImage = choices[Math.floor(Math.random() * choices.length)] ?? artwork[0];
    const frame = document.createElement('img');
    frame.src = lastImage;
    frame.alt = '';
    const previous = slideshow.lastElementChild;
    frame.decode().catch(() => {}).then(() => {
      if (slideshow.hidden || frame.getAttribute('src') !== lastImage) return;
      slideshow.append(frame);
      const fade = frame.animate([{opacity: 0}, {opacity: 1}], {duration: 1200, fill: 'both'});
      fade.finished.then(() => previous?.remove()).catch(() => {});
    });
  }

  function startFades() {
    motion.still = true;
    rows.classList.add("idle-fades");
    const session = {};
    fadeSession = session;
    fades = setInterval(async () => {
      const previous = fadingTile;
      if (previous) {
        if (!previous.ready) return;
        if (previous.replacement) previous.image.src = previous.replacement;
        previous.tile.classList.remove("idle-faded");
      }
      const choices = visibleTiles().filter(tile => tile !== previous?.tile);
      const tile = choices[Math.floor(Math.random() * choices.length)];
      fadingTile = undefined;
      if (!tile) return;

      const image = tile.querySelector("img");
      const current = image.getAttribute("src");
      const alternatives = artwork.filter(src => src !== current);
      const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
      if (!replacement) return;
      if (!originalTiles.has(image)) originalTiles.set(image, current);
      tile.classList.add("idle-faded");
      const swap = {tile, image, replacement, ready: false};
      fadingTile = swap;
      const preload = new Image();
      preload.src = replacement;
      try {
        await preload.decode();
      } catch {
        swap.replacement = undefined;
      }
      if (fadeSession === session) swap.ready = true;
    }, 3500);
  }

  function stopFades() {
    clearInterval(fades);
    fadeSession = undefined;
    fadingTile?.tile.classList.remove("idle-faded");
    fadingTile = undefined;
    for (const [image, src] of originalTiles) image.src = src;
    originalTiles.clear();
    rows.classList.remove("idle-fades");
    motion.still = false;
  }

  function visibleTiles() {
    const visible = [];
    for (const rail of rows.querySelectorAll('.rail')) {
      const bounds = rail.getBoundingClientRect();
      for (const tile of rail.children) {
        const box = tile.getBoundingClientRect();
        const width = Math.min(innerWidth, bounds.right, box.right) - Math.max(0, bounds.left, box.left);
        const height = Math.min(innerHeight, bounds.bottom, box.bottom) - Math.max(0, bounds.top, box.top);
        if (width > 12 && height > 12) visible.push(tile);
      }
    }
    return visible;
  }

  function startGhost() {
    motion.still = true;
    ghostCursor = document.createElement('div');
    ghostCursor.className = 'ghost-cursor';
    ghostCursor.inert = true;
    document.body.append(ghostCursor);
    ghostTimer = setTimeout(() => browse(true), 800);
  }

  function browse(openExhibit) {
    const visible = visibleTiles().filter(tile => tile !== ghostTarget);
    ghostTarget?.removeAttribute('data-telemetry');
    ghostTarget = (openExhibit && visible.find(tile => tile.querySelector('.work').hash === '#/item/submit')) ||
      visible[Math.floor(Math.random() * visible.length)];
    if (!ghostTarget) return;
    const box = ghostTarget.getBoundingClientRect();
    const rail = ghostTarget.parentElement.getBoundingClientRect();
    const x = (Math.max(0, rail.left, box.left) + Math.min(innerWidth, rail.right, box.right)) / 2;
    const y = (Math.max(0, rail.top, box.top) + Math.min(innerHeight, rail.bottom, box.bottom)) / 2;
    ghostCursor.style.transform = `translate(${x}px, ${y}px)`;
    ghostTimer = setTimeout(() => {
      ghostTarget.setAttribute('data-telemetry', '');
      ghostTimer = setTimeout(openExhibit ? openGhostExhibit : () => browse(false), 4200);
    }, 1600);
  }

  function openGhostExhibit() {
    const source = ghostTarget.querySelector('img');
    ghostExhibit = document.createElement('div');
    ghostExhibit.className = 'ghost-exhibit';
    ghostExhibit.inert = true;
    const image = document.createElement('img');
    image.src = source.currentSrc || source.src;
    image.alt = '';
    const title = document.createElement('p');
    title.textContent = source.alt;
    ghostExhibit.append(image, title);
    document.body.append(ghostExhibit);
    ghostTimer = setTimeout(() => {
      ghostExhibit.remove();
      ghostExhibit = undefined;
      browse(false);
    }, 6500);
  }

  function stopGhost() {
    clearTimeout(ghostTimer);
    ghostTarget?.removeAttribute('data-telemetry');
    ghostCursor?.remove();
    ghostExhibit?.remove();
    ghostTarget = undefined;
    ghostCursor = undefined;
    ghostExhibit = undefined;
    motion.still = false;
  }

  function stopSlides() {
    clearInterval(slides);
    slideshow.hidden = true;
    slideshow.replaceChildren();
    lastImage = undefined;
  }

  async function wake() {
    if (!snapshot) return arm();
    if (waking) return;
    waking = true;
    clearTimeout(timeout);
    stopSlides();
    stopFades();
    stopGhost();
    const state = snapshot;
    try {
      if (transition) await transition;
      if (rows.hasAttribute('data-vertical') !== state.vertical) await switchOrientation(false);
      rows.append(...state.columns.map(({column}) => column));
      for (const {rail, left, top} of state.columns) rail.scrollTo({left, top, behavior: 'instant'});
      motion.reverse = state.reverse;
      gallery.classList.remove('idle-exhibit');
      window.scrollTo({left: state.scrollX, top: state.scrollY, behavior: 'instant'});
    } finally {
      snapshot = undefined;
      waking = false;
      arm();
    }
  }

  for (const event of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'hashchange']) {
    window.addEventListener(event, wake, {passive: true});
  }
  document.addEventListener('visibilitychange', wake);
  motionPreference.addEventListener('change', wake);
  document.querySelectorAll('#pause-rows, #play-rows').forEach(button => button.addEventListener('click', arm));
  arm();
}
