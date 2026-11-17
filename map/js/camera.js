// The camera is an SVG viewBox: { x, y, w, h } in map coordinates. Pure: no DOM.

/**
 * The viewBox that shows `target` as large as possible inside the part of the
 * screen that is not covered by the top bar or the panel.
 * `viewport` is the SVG size in pixels. `free` is that uncovered part, as
 * fractions of the viewport: { x, y, w, h } each from 0 to 1.
 * `fitRect({x:0,y:0,w:100,h:100}, {w:800,h:400}, {x:0,y:0,w:0.5,h:1})`
 */
export function fitRect(target, viewport, free) {
  const scale = Math.min(
    (free.w * viewport.w) / target.w,
    (free.h * viewport.h) / target.h,
  );
  const w = viewport.w / scale;
  const h = viewport.h / scale;
  return {
    x: target.x + target.w / 2 - (free.x + free.w / 2) * w,
    y: target.y + target.h / 2 - (free.y + free.h / 2) * h,
    w,
    h,
  };
}

/** Grow a box about its centre. Used to pull the camera back from the map. */
export function scaleBox(box, factor) {
  const w = box.w * factor;
  const h = box.h * factor;
  return { x: box.x - (w - box.w) / 2, y: box.y - (h - box.h) / 2, w, h };
}

export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The box part way (t from 0 to 1) between two boxes. Size changes by a
 * constant ratio and position follows size, so it reads as a zoom towards one
 * fixed point and not as a slide.
 */
export function mixBox(from, to, t) {
  const w = from.w * (to.w / from.w) ** t;
  const sameSize = Math.abs(to.w - from.w) < 1e-6;
  const k = sameSize ? t : (w - from.w) / (to.w - from.w);
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    w,
    h: from.h + (to.h - from.h) * k,
  };
}
