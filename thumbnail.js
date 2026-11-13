// Shared GRIFT / GAME_OVER square-thumbnail framing. No derivative files are created.
// x and y are normalized positions within the available crop travel (0 = left/top,
// 0.5 = centered, 1 = right/bottom); zoom multiplies a cover-sized image.
const frames = new WeakMap();
const sources = new Set(['front', 'back', 'detail']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function thumbnailSettings(work) {
  const saved = work?.thumbnail ?? {};
  const source = sources.has(saved.source) && work[saved.source] ? saved.source : 'front';
  return {
    source,
    zoom: Number.isFinite(saved.zoom) ? clamp(saved.zoom, 1, 6) : 1,
    x: Number.isFinite(saved.x) ? clamp(saved.x, 0, 1) : 0.5,
    y: Number.isFinite(saved.y) ? clamp(saved.y, 0, 1) : 0.5
  };
}

export function thumbnailPath(work) {
  return work[thumbnailSettings(work).source] || work.front;
}

// Frame dimensions are percentages, so they remain exact when galleries resize,
// switch orientation, or duplicate tiles for continuous looping.
function layout(image, crop) {
  if (!image.naturalWidth || !image.naturalHeight) {
    Object.assign(image.style, {
      width: '100%', height: '100%', left: '0%', top: '0%',
      objectFit: 'cover', objectPosition: 'center'
    });
    return;
  }
  const ratio = image.naturalWidth / image.naturalHeight;
  const width = Math.max(1, ratio) * crop.zoom;
  const height = Math.max(1, 1 / ratio) * crop.zoom;
  Object.assign(image.style, {
    width: (width * 100) + '%',
    height: (height * 100) + '%',
    left: ((1 - width) * crop.x * 100) + '%',
    top: ((1 - height) * crop.y * 100) + '%',
    objectFit: 'fill', objectPosition: 'center'
  });
}

export function applyThumbnailFrame(image, work) {
  let frame = frames.get(image);
  if (!frame) {
    frame = {crop: thumbnailSettings(work)};
    frames.set(image, frame);
    image.addEventListener('load', () => layout(image, frame.crop));
  } else {
    frame.crop = thumbnailSettings(work);
  }
  image.classList.add('thumbnail-image');
  image.style.position = 'absolute';
  image.style.display = 'block';
  image.style.maxWidth = 'none';
  layout(image, frame.crop);
  return image;
}
