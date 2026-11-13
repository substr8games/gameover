import {loopRail} from './loop.js';
import {installIdleExhibit} from "./idle.js";
import {applyThumbnailFrame, thumbnailPath} from './thumbnail.js';

function installLoop(rail, collection, row) {
  const tiles = collection.works.map(work => tile(work, collection));
  rail.append(...tiles);
  loopRail(rail, tiles, row, motion);
  // loopRail duplicates tiles before their images necessarily finish loading;
  // bind framing to every clone as well as each original tile.
  const works = new Map(collection.works.map(work => [work.slug, work]));
  for (const copied of rail.querySelectorAll('a.work')) {
    const item = works.get(copied.getAttribute('href').slice(7));
    if (item) applyThumbnailFrame(copied.querySelector('img'), item);
  }
}

const gallery = document.querySelector('#gallery');
const detail = document.querySelector('#detail');
const rows = document.querySelector('#rows');
const fields = [
  ["ART DIRECTION", 1, "#67df83"],
  ["EPISTEMIC WGT.", 4, "#f2bf41"],
  ["SATURATION", 3, "#ff6337"],
  ["ETIQUETTE", 2, "#ff519f"],
  ["OPEN HOSTILITY", 0, "#b83b46"]
];
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const motion = { playing: !motionPreference.matches };
const pause = document.querySelector("#pause-rows");
const play = document.querySelector("#play-rows");
const rotate = document.querySelector("#rotate-gallery");
document.querySelector(".cylinder-left").addEventListener("click", () => turnColumns(-1));
document.querySelector(".cylinder-right").addEventListener("click", () => turnColumns(1));
rotate.addEventListener("click", () => switchOrientation());

async function switchOrientation(animated = !motionPreference.matches) {
  if (motion.turning) return;
  const vertical = !rows.hasAttribute("data-vertical");
  const angle = vertical ? -45 : 45;
  const rails = [...rows.querySelectorAll(".rail")];
  motion.turning = true;
  let transition;
  try {
    if (animated) rows.setAttribute("data-rotating", "");
    if (animated) {
      transition = swing(rails, 0, angle, 1, 0);
      await transition.finished;
      transition.cancel();
    }
    for (const rail of rails) rail.dispatchEvent(new Event("gallery-before-axis"));
    rows.toggleAttribute("data-vertical", vertical);
    if (!vertical) {
      const sections = [...rows.querySelectorAll(".collection")];
      sections.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
      rows.append(...sections);
    }
    for (const rail of rails) rail.dispatchEvent(new Event("gallery-axis"));
    rotate.setAttribute("aria-pressed", String(vertical));
    rotate.setAttribute("aria-label", vertical ? "Switch to horizontal gallery" : "Switch to vertical gallery");
    if (animated) {
      transition = swing(rails, -angle, 0, 0, 1);
      await transition.finished;
    }
  } finally {
    transition?.cancel();
    rows.removeAttribute("data-rotating");
    motion.turning = false;
  }
}

function swing(rails, from, to, startOpacity, endOpacity) {
  const bounds = rows.getBoundingClientRect();
  const top = Math.max(0, bounds.top);
  const bottom = Math.min(innerHeight, bounds.bottom);
  if (bottom <= top || !rails.length) return {finished: Promise.resolve(), cancel() {}};

  const viewport = element('div', '', 'rotation-viewport');
  viewport.inert = true;
  viewport.style.inset = top + 'px 0 ' + (innerHeight - bottom) + 'px';
  const stage = element('div', '', 'rotation-stage');
  const size = Math.max(bounds.width, bottom - top);
  const originX = (bounds.left + bounds.right - size) / 2;
  const originY = (top + bottom - size) / 2;
  Object.assign(stage.style, {
    left: originX + 'px',
    top: originY - top + 'px',
    width: size + 'px',
    height: size + 'px'
  });

  const tiles = [];
  for (const rail of rails) {
    for (const tile of rail.children) {
      const box = tile.getBoundingClientRect();
      if (box.right <= originX || box.left >= originX + size ||
          box.bottom <= originY || box.top >= originY + size) continue;
      const source = tile.querySelector('img');
      if (!source) continue;
      const art = element('div', '', 'rotation-art');
      // Keep the framing instead of reverting to the full image during rotation.
      const artImage = source.cloneNode(true);
      artImage.alt = '';
      art.append(artImage);
      const slug = source.closest('a.work')?.getAttribute('href')?.slice(7);
      const cropWork = collectionsForRotation?.get(slug);
      if (cropWork) applyThumbnailFrame(artImage, cropWork);
      Object.assign(art.style, {
        left: box.left - originX + 'px',
        top: box.top - originY + 'px',
        width: box.width + 'px',
        height: box.height + 'px'
      });
      stage.append(art);
      tiles.push(art);
    }
  }

  viewport.append(stage);
  document.body.append(viewport);
  const options = {duration: 550, easing: 'cubic-bezier(.42, 0, .58, 1)', fill: 'both'};
  const animations = [stage.animate([
    {transform: `rotate(${from}deg)`, opacity: startOpacity},
    {transform: `rotate(${to}deg)`, opacity: endOpacity}
  ], options)];
  for (const tile of tiles) animations.push(tile.animate([
    {transform: `rotate(${-from}deg)`}, {transform: `rotate(${-to}deg)`}
  ], options));
  const start = document.timeline.currentTime;
  for (const animation of animations) animation.startTime = start;
  return {
    finished: Promise.all(animations.map(animation => animation.finished)),
    cancel() {
      viewport.remove();
      for (const animation of animations) animation.cancel();
    }
  };
}
function setMotion(playing) {
  motion.playing = playing;
  rows.toggleAttribute("data-paused", !playing);
  pause.setAttribute("aria-pressed", String(!playing));
  play.setAttribute("aria-pressed", String(playing));
}
setMotion(motion.playing);
pause.addEventListener("click", () => setMotion(false));
play.addEventListener("click", () => setMotion(true));
motionPreference.addEventListener("change", event => setMotion(!event.matches));
const itemLinks = new Map();
let collectionsForRotation;
let galleryPosition = 0;
let activeItem = null;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(text, href, className) {
  const node = element('a', text, className);
  node.href = href;
  return node;
}

function image(path, alt) {
  const node = element('img');
  node.src = path;
  node.alt = alt;
  node.loading = 'lazy';
  return node;
}

function gauges(values, overlay = false) {
  const box = element('div', '', overlay ? 'gauges overlay' : 'gauges');
  fields.forEach(([label, index, color]) => {
    const value = values[index];
    const name = element('div', label, 'gauge-label');
    name.append(element('span', value === 20 ? 'MAX' : String(value).padStart(2, '0')));
    const segments = element('div', '', 'segments');
    segments.setAttribute('aria-hidden', 'true');
    for (let n = 0; n < 20; n++) {
      const segment = element("i", "", n < value ? "on" : "");
      if (n < value) segment.style.opacity = n / 19;
      segments.append(segment);
    }
    const row = element('div');
    row.style.setProperty("--meter-color", color);
    row.append(name, segments);
    box.append(row);
  });
  return box;
}

function isFictional(work, collection) {
  return collection.fictional === true || work.kind === 'fictional';
}

function listingType(work, collection) {
  if (isFictional(work, collection)) return 'FICTIONAL LISTING · SOLD OUT';
  if (work.kind === 'merchandise' || (!work.kind && work.previewOptions)) return 'MERCHANDISE';
  if (work.kind === 'artifact') return 'ARTIFACT';
  return 'EXHIBITION';
}

function tile(work, collection) {
  const card = element('div', '', 'tile');
  const open = link('', '#/item/' + work.slug, 'work');
  open.setAttribute('aria-label', 'View ' + work.title);
  const meter = gauges(work.telemetry, true);
  const art = image(thumbnailPath(work), work.title);
  applyThumbnailFrame(art, work);
  open.append(art, meter);
  const caption = element('p', work.title, 'tile-title');
  const fictional = isFictional(work, collection);
  caption.append(element('span', fictional ? 'SOLD OUT' : '↗', fictional ? 'sold-out' : ''));
  card.append(open, caption);
  if (!itemLinks.has(work.slug)) itemLinks.set(work.slug, open);
  return card;
}
function renderGallery(collections) {
  rows.replaceChildren();
  for (const collection of collections) {
    const section = element('section', '', 'collection');
    section.id = collection.id;
    section.dataset.order = rows.childElementCount;
    const head = element('header', '', 'collection-head');
    const heading = element('h2', collection.name);
    heading.id = collection.id + '-heading';
    const rail = element('div', '', 'rail');
    rail.tabIndex = 0;
    rail.setAttribute('role', 'region');
    rail.setAttribute('aria-labelledby', heading.id);
    installLoop(rail, collection, rows.childElementCount);
    head.append(heading);
    section.append(head, rail);
    if (collection.works.length > 1) {
      for (const [direction, symbol] of [["left", "❮"], ["right", "❯"]]) {
        const arrow = element("button", symbol, "row-arrow row-arrow-" + direction);
        arrow.type = "button";
        arrow.setAttribute("aria-label", "Scroll " + collection.name + " " + (direction === "left" ? "backward" : "forward"));
        arrow.addEventListener("click", () => {
          const first = rail.children[0].getBoundingClientRect();
          const second = rail.children[1].getBoundingClientRect();
          const vertical = rows.hasAttribute("data-vertical");
          const step = vertical ? second.top - first.top : second.left - first.left;
          rail.scrollBy({[vertical ? "top" : "left"]: step * (direction === "left" ? -1 : 1)});
        });
        section.append(arrow);
      }
    }
    rows.append(section);
  }
}

function renderOptions(slug) {
  const panel = element('section', '', 'product-options');
  const status = element('p');
  status.setAttribute('aria-live', 'polite');
  panel.append(element('h2', 'Garment options'), status);
  const configuredOrigin = document.querySelector('meta[name="fulfillment-origin"]').content.trim();
  if (configuredOrigin === 'disabled') {
    status.textContent = 'Ordering is not available yet.';
    return panel;
  }
  const origin = configuredOrigin || location.origin;
  const endpoint = new URL('/api/artwork/' + encodeURIComponent(slug) + '/options', origin);
  status.textContent = 'Checking available garment options…';
  fetch(endpoint, {signal: AbortSignal.timeout(8000)})
    .then(response => {
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.json();
    })
    .then(({artwork, options}) => {
      if (artwork !== slug || !Array.isArray(options)) throw new Error('Invalid catalog response');
      if (!options.length) {
        status.textContent = 'No garment options are currently configured.';
        return;
      }
      const list = element('ul');
      for (const option of options) {
        const description = [option.garment, option.color, option.size].filter(Boolean).join(' · ');
        if (description) list.append(element('li', description));
      }
      status.textContent = 'Garment options preview · Ordering is not available yet.';
      if (list.childElementCount) panel.append(list);
    })
    .catch(() => {
      status.textContent = 'Live garment options are unavailable right now.';
    });
  return panel;
}
function renderDetail(work, collection, collections) {
  const back = link('← Return to exhibition', '#', 'back');
  const layout = element('div', '', 'detail-layout');
  const media = element('div', '', 'detail-media');
  media.append(image(work.front, work.title + (work.back || work.detail ? ' — front' : '')));
  if (work.back) media.append(image(work.back, work.title + ' — back'));
  if (work.detail) media.append(image(work.detail, work.title + ' — detail'));
  const copy = element('div', '', 'detail-copy');
  const title = element('h1', work.title);
  title.tabIndex = -1;
  copy.append(element('p', collection.name + ' / ' + listingType(work, collection), 'kicker'), title);
  for (const paragraph of work.lore ?? []) copy.append(element('p', paragraph));
  if (work.specs) copy.append(element('h2', 'Specifications'), element('p', work.specs, 'specifications'));
  if (work.spoiler) {
    const spoiler = element('details', '', 'spoiler');
    spoiler.append(element('summary', 'Spoiler'), element('p', work.spoiler));
    copy.append(spoiler);
  }
  if (isFictional(work, collection)) copy.append(element('p', 'SOLD OUT · Fictional exhibition item.', 'kicker'));
  copy.append(element('h2', 'Curatorial telemetry'), gauges(work.telemetry));
  if (work.previewOptions && !isFictional(work, collection) && (!work.kind || work.kind === 'merchandise')) copy.append(renderOptions(work.slug));
  const related = (work.related ?? []).map(slug => {
    for (const group of collections) {
      const match = group.works.find(item => item.slug === slug);
      if (match) return match;
    }
    return null;
  }).filter(Boolean);
  if (related.length) {
    const section = element('section', '', 'related-artwork');
    section.append(element('h2', 'Related artwork'));
    const list = element('ul');
    for (const item of related) {
      const row = element('li');
      row.append(link(item.title, '#/item/' + item.slug));
      list.append(row);
    }
    section.append(list);
    copy.append(section);
  }
  layout.append(media, copy);
  detail.replaceChildren(back, layout);
  gallery.hidden = true;
  detail.hidden = false;
  window.scrollTo(0, 0);
  title.focus({preventScroll: true});
}
function route(collections) {
  const slug = location.hash.startsWith('#/item/') ? location.hash.slice(7) : '';
  if (slug) {
    const collection = collections.find(row => row.works.some(work => work.slug === slug));
    if (collection) {
      activeItem = slug;
      renderDetail(collection.works.find(work => work.slug === slug), collection, collections);
      return;
    }
    gallery.hidden = true;
    detail.hidden = false;
    detail.replaceChildren(element('h1', 'Exhibit unavailable'), link('← Return to exhibition', '#', 'back'));
    return;
  }
  gallery.hidden = false;
  detail.hidden = true;
  if (activeItem) {
    window.scrollTo(0, galleryPosition);
    itemLinks.get(activeItem)?.focus({preventScroll: true});
    activeItem = null;
    return;
  }
  const section = document.getElementById(location.hash.slice(1));
  if (section) section.scrollIntoView();
}

try {
  const response = await fetch('catalog.json');
  if (!response.ok) throw new Error('Catalog unavailable');
  const {collections: entries} = await response.json();
  // Once any real work is published, starter placeholders never appear again.
  const hasRealWork = entries.some(group => group.works.some(work => work.placeholder !== true));
  const collections = entries.map(group => ({
    ...group,
    works: hasRealWork ? group.works.filter(work => work.placeholder !== true) : group.works
  })).filter(group => group.works.length > 0);
  collectionsForRotation = new Map(collections.flatMap(group => group.works.map(work => [work.slug, work])));
  renderGallery(collections);
  installIdleExhibit({gallery, rows, motion, motionPreference, switchOrientation, collections});
  route(collections);
  gallery.addEventListener("click", event => {
    const work = event.target.closest("a.work");
    if (work) {
      galleryPosition = window.scrollY;
      if (work.tabIndex === 0) itemLinks.set(work.hash.slice(7), work);
    }
  });
  addEventListener('hashchange', () => route(collections));
} catch {
  rows.replaceChildren(element('p', 'The exhibition catalog is unavailable.', 'status'));
}

async function turnColumns(direction) {
  if (motion.turning || !rows.hasAttribute('data-vertical')) return;
  const columns = [...rows.querySelectorAll('.collection')];
  if (columns.length < 2) return;

  const moving = direction > 0 ? columns[0] : columns.at(-1);
  const positions = new Map(columns.map(column => [column, column.getBoundingClientRect()]));
  const strip = rows.getBoundingClientRect();
  const step = positions.get(columns[1]).left - positions.get(columns[0]).left;
  const scroll = new Map(columns.map(column => [column, column.querySelector('.rail').scrollTop]));
  const animated = !motionPreference.matches;
  let ghost;
  const animations = [];
  motion.turning = true;
  try {
    if (animated) {
      const box = positions.get(moving);
      if (box.left < strip.right && box.right > strip.left) {
        ghost = moving.cloneNode(true);
        ghost.inert = true;
        ghost.removeAttribute('id');
        for (const node of ghost.querySelectorAll('[id]')) node.removeAttribute('id');
        ghost.classList.add('column-ghost');
        ghost.style.left = box.left - strip.left + 'px';
        ghost.style.top = box.top - strip.top + 'px';
        ghost.style.width = box.width + 'px';
        rows.append(ghost);
        ghost.querySelector('.rail').scrollTop = scroll.get(moving);
      }
    }
    if (direction > 0) rows.append(moving);
    else rows.prepend(moving);
    for (const [column, top] of scroll) column.querySelector('.rail').scrollTop = top;
    if (!animated) return;

    const options = {duration: 520, easing: "cubic-bezier(.42, 0, .58, 1)", fill: "both"};
    const offsets = columns.map(column => column === moving ? direction * step :
      positions.get(column).left - column.getBoundingClientRect().left);
    for (const [index, column] of columns.entries()) {
      animations.push(column.animate([
        {transform: `translateX(${offsets[index]}px)`}, {transform: "translateX(0px)"}
      ], options));
    }
    if (ghost) animations.push(ghost.animate([
      {transform: 'none'}, {transform: `translateX(${-direction * step}px)`}
    ], options));
    const start = document.timeline.currentTime;
    for (const animation of animations) animation.startTime = start;
    await Promise.all(animations.map(animation => animation.finished));
  } finally {
    ghost?.remove();
    for (const animation of animations) animation.cancel();
    motion.turning = false;
  }
}
