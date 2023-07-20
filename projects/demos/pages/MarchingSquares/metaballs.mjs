"use strict";

// https://stackoverflow.com/q/15931119#comment103223768_53514621
// https://github.com/toji/gl-matrix/pull/345#issuecomment-439709662
// https://github.com/toji/gl-matrix/issues/371
import { vec2 } from "../gl-matrix.mjs";

// REFERENCES
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// https://en.wikipedia.org/wiki/Marching_squares

// SEE ALSO
// https://en.wikipedia.org/wiki/Implicit_surface
// https://en.wikipedia.org/wiki/Isosurface
// http://paulbourke.net/geometry/implicitsurf/index.html
// https://en.wikipedia.org/wiki/Equipotential
// https://wordsandbuttons.online/interactive_explanation_of_marching_cubes_and_dual_contouring.html

// Canvas quirk: lines starting at 0.5 offsets in X for perfectly sharp lines
// since they fall completely within the pixel; (0.5, 0.5) is pixel centre.
// https://developer.mozilla.org/en-US/docs/Web/API/
// Canvas_API/Tutorial/Applying_styles_and_colors#A_lineWidth_example
const canvas = { width: 640, height: 480, offset: 1.5 };

let cellSize = { max: 50, min: 2, current: 11 };
let samples = { rows: 0, cols: 0, data: null };
// Velocity is in pixels / second. Set smaller balls to higher velocities for a
// realistic simulation.
let circles = [ { centre: vec2.fromValues(180, 200),
                  radius: 70,
                  vel: vec2.fromValues(80, 40) },
                { centre: vec2.fromValues(260, 200),
                  radius: 50,
                  vel: vec2.fromValues(-80, 80) },
                { centre: vec2.fromValues(400, 500),
                  radius: 30,
                  vel: vec2.fromValues(-160, 160) }];
let lerp = true, showSamples = false, animate = true;
let grid = false, drawBackground = true;
let sel = { circle: null, lastPt: vec2.create() };

function metaballFn(pt) {
  let value = 0;
  let n = circles.length;
  for (let i = 0; i < n; ++i) {
    let c = circles[i];
    let r2 = c.radius * c.radius;
    let d2 = vec2.sqrDist(c.centre, pt);
    value += r2 / d2;
  }
  return value;
}

function getSampleLoc(idx) {
  const offset = canvas.offset;
  const cellDim = cellSize.current;
  let r = Math.floor(idx / samples.cols);
  let c = idx % samples.cols;
  let pt = vec2.fromValues(offset + (cellDim * c),
                           offset + (cellDim * r));
  return pt;
}

// ticks in the duration (seconds) lapsed since previous call
function update(ticks) {
  let total = samples.rows * samples.cols;

  // alloc memory
  if (!samples.data || (samples.data.length !== total))
    samples.data = new Array(total);
  let data = samples.data;

  for (let i = 0; i < total; ++i)
    data[i] = metaballFn(getSampleLoc(i));

  if (animate)
    animateCircles(ticks);
}

function renderGrid(ctx) {
  ctx.fillStyle = "Black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (grid) {
    ctx.save();
    drawGrid(ctx);
    ctx.restore();
  }
}

function renderContent(ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (showSamples) {
    ctx.save();
    drawSamples(ctx);
    ctx.restore();
  }

  ctx.save();
  marchingSquares(ctx);
  ctx.restore();

  if (!animate) {
    ctx.save();
    drawCircles(ctx);
    ctx.restore();
  }
}

function isPointInCircle(c, pt) {
  let d = vec2.create();
  vec2.sub(d, c.centre, pt);
  let r2 = c.radius * c.radius;
  return (vec2.sqrLen(d) < r2);
}

// given the extremes and a sample, this returns the corresponding ratio
function invLerp(v1, v2, v) {
  return (v - v1) / (v2 - v1);
}

// n is the unit normal vector; v is the arbitrary vector to be reflected.
// The reflection will have the same length as the incident vector.
function reflect(v, n) {
  vec2.negate(v, v);
  let p = vec2.dot(v, n);
  let proj = vec2.create();
  vec2.scale(proj, n, p);
  let perp = vec2.create();
  vec2.sub(perp, v, proj);
  let img = vec2.create();
  vec2.scaleAndAdd(img, v, perp, -2);
  return img;
}

/*
 * Marching Squares
 *
 * Sample value ≥ 1 denoted by •
 * Sample value ≤ 1 denoted by +
 *
 * +--+  •--+  +--•  •--•  +--+  •--+  +--•  •--•
 * |0 |  |1 |  |2 |  |3 |  |4 |  |5 |  |6 |  |7 |
 * +--+  +--+  +--+  +--+  +--•  +--•  +--•  +--•
 *
 * +--+  •--+  +--•  •--•  +--+  •--+  +--•  •--•
 * |8 |  |9 |  |10|  |11|  |12|  |13|  |14|  |15|
 * •--+  •--+  •--+  •--+  •--•  •--•  •--•  •--•
 *
 */

function marchingSquares(ctx) {
  let samplesCols = samples.cols;
  // number of squares; spans not stops
  let n = samples.rows - 1;
  let m = samplesCols - 1;
  let data = samples.data;

  ctx.beginPath();
  ctx.strokeStyle = "rgb(0, 255, 0)";
  // decrement one since we want spans and not stops; one more since want to
  // stop before the last and make a square.
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < m; ++j) {
      // this isn’t the square ID but the data offset of its left-top corner
      let offset = i * samplesCols + j;
      let a = data[offset];
      let b = data[offset + 1];
      let d = data[offset + samplesCols];
      let c = data[offset + samplesCols + 1];
      // left-top (1), right-top (2), right-bottom (4), left-bottom (8)
      let b1 = (a >= 1.0) ? 1 : 0;
      let b2 = (b >= 1.0) ? 2 : 0;
      let b3 = (c >= 1.0) ? 4 : 0;
      let b4 = (d >= 1.0) ? 8 : 0;
      let value = b1 | b2 | b3 | b4;
      if (lerp)
        drawSquareLerp(ctx, offset, value, [a, b, c, d]);
      else
        drawSquare(ctx, offset, value);
    }
  }
  ctx.stroke();
}

// expects config to be one of 1, 14, 2, 13, 4, 11, 7 or 8 (one-point or
// three-point corner case)
function calcEndsForCorner(config, s, offset) {
  let origin = getSampleLoc(offset);
  let cellDim = cellSize.current;
  let begin = vec2.create(), end = vec2.create(), t1, t2;
  let X = vec2.fromValues(cellDim, 0), Y = vec2.fromValues(0, cellDim);
  switch (config) {
    // origin is IN; its sample ≥ 1, both right-top and left-bottom are OUT as
    // their samples ≤ 1; do inverse interpolation to find the parameter such
    // that the sample is 1; where the function is satified i.e. the figure’s
    // boundary. However, this isn’t the true boundary but a linear
    // approximation. Use this parameter to get final point given the extremes
    // -- origin and begin/end in each axis.
    case 1:
    case 14:
    {
      let t1 = invLerp(s[0], s[1], 1);
      let t2 = invLerp(s[0], s[3], 1);
      vec2.scaleAndAdd(begin, origin, X, t1);
      vec2.scaleAndAdd(end, origin, Y, t2);
    }
    break;
    case 2:
    case 13:
    {
      origin[0] += cellDim;
      let t1 = invLerp(s[1], s[0], 1);
      let t2 = invLerp(s[1], s[2], 1);
      vec2.scaleAndAdd(begin, origin, X, -t1);
      vec2.scaleAndAdd(end, origin, Y, t2);
    }
    break;
    case 4:
    case 11:
    {
      origin[0] += cellDim, origin[1] += cellDim;
      let t1 = invLerp(s[2], s[3], 1);
      let t2 = invLerp(s[2], s[1], 1);
      vec2.scaleAndAdd(begin, origin, X, -t1);
      vec2.scaleAndAdd(end, origin, Y, -t2);
    }
    break;
    case 7:
    case 8:
    {
      origin[1] += cellDim;
      let t1 = invLerp(s[3], s[2], 1);
      let t2 = invLerp(s[3], s[0], 1);
      vec2.scaleAndAdd(begin, origin, X, t1);
      vec2.scaleAndAdd(end, origin, Y, -t2);
    }
  }
  return [begin, end];
}

// expects config to be one of 3, 12, 6 or 9 (two-point edge case)
function calcEndsForEdge(config, s, offset) {
  let cellDim = cellSize.current;
  let begin = vec2.create(), end = vec2.create();
  switch(config) {
    case 3:
    case 12:
    {
      let t1 = invLerp(s[0], s[3], 1);
      let t2 = invLerp(s[1], s[2], 1);
      let ob = getSampleLoc(offset);
      let oe = getSampleLoc(offset + 1);
      let Y = vec2.fromValues(0, cellDim);
      vec2.scaleAndAdd(begin, ob, Y, t1);
      vec2.scaleAndAdd(end, oe, Y, t2);
    }
    break;
    case 6:
    case 9:
    {
      let t1 = invLerp(s[1], s[0], 1);
      let t2 = invLerp(s[2], s[3], 1);
      let ob = getSampleLoc(offset + 1);
      let oe = getSampleLoc(offset + samples.cols + 1);
      let X = vec2.fromValues(-cellDim, 0);
      vec2.scaleAndAdd(begin, ob, X, t1);
      vec2.scaleAndAdd(end, oe, X, t2);
    }
    break;
  }
  return [begin, end];
}

function calcEndsForBridge(config, s, offset) {
  let X = vec2.fromValues(cellSize.current, 0);
  let Y = vec2.fromValues(0, cellSize.current);
  let cellDim = cellSize.current;
  let samplesCols = samples.cols;
  let b1 = vec2.create(), b2 = vec2.create();
  let e1 = vec2.create(), e2 = vec2.create();
  switch(config) {
    case 5:
    {
      let t1 = invLerp(s[0], s[1], 1);
      let t2 = invLerp(s[2], s[1], 1);
      let t3 = invLerp(s[0], s[3], 1);
      let t4 = invLerp(s[2], s[3], 1);
      let ob = getSampleLoc(offset);
      let oe = getSampleLoc(offset + samplesCols + 1);
      vec2.scaleAndAdd(b1, ob, X, t1);
      vec2.scaleAndAdd(e1, oe, Y, -t2);
      vec2.scaleAndAdd(b2, ob, Y, t3);
      vec2.scaleAndAdd(e2, oe, X, -t4);
    }
    break;
    case 10:
    {
      let t1 = invLerp(s[1], s[0], 1);
      let t2 = invLerp(s[3], s[0], 1);
      let t3 = invLerp(s[1], s[2], 1);
      let t4 = invLerp(s[3], s[2], 1);
      let ob = getSampleLoc(offset + 1);
      let oe = getSampleLoc(offset + samplesCols);
      vec2.scaleAndAdd(b1, ob, X, -t1);
      vec2.scaleAndAdd(e1, oe, Y, -t2);
      vec2.scaleAndAdd(b2, ob, Y, t3);
      vec2.scaleAndAdd(e2, oe, X, t4);
    }
  }
  return [b1, e1, b2, e2];
}

function drawSquareLerp(ctx, offset, value, s) {
  if ((value === 0) || (value === 15)) return;
  switch (value) {
    case 1:
    case 14:
    case 2:
    case 13:
    case 4:
    case 11:
    case 7:
    case 8:
    {
      let r = calcEndsForCorner(value, s, offset);
      let begin = r[0], end = r[1];
      ctx.moveTo(begin[0], begin[1]);
      ctx.lineTo(end[0], end[1]);
    }
    break;
    case 3:
    case 12:
    case 6:
    case 9:
    {
      let r = calcEndsForEdge(value, s, offset);
      let begin = r[0], end = r[1];
      ctx.moveTo(begin[0], begin[1]);
      ctx.lineTo(end[0], end[1]);
    }
    break;
    case 5:
    case 10:
    {
      let r = calcEndsForBridge(value, s, offset);
      let b1 = r[0], e1 = r[1], b2 = r[2], e2 = r[3];
      ctx.moveTo(b1[0], b1[1]);
      ctx.lineTo(e1[0], e1[1]);
      ctx.moveTo(b2[0], b2[1]);
      ctx.lineTo(e2[0], e2[1]);
    }
    break;
  }
}

function drawSquare(ctx, offset, value) {
  let origin, cellDim, cellDim_2;
  if ((value !== 0) && (value !== 15)) {
    origin = getSampleLoc(offset);
    cellDim = cellSize.current;
    cellDim_2 = cellSize.current * 0.5;
  }

  // case 0 and 15 needs no drawing
  switch (value) {
    // corner cut (8 cases; 4 one point, 4 three points)
    case 1:
    case 14:
    {
      ctx.moveTo(origin[0] + cellDim_2, origin[1]);
      ctx.lineTo(origin[0],             origin[1] + cellDim_2);
    }
    break;
    case 2:
    case 13:
    {
      ctx.moveTo(origin[0] + cellDim_2, origin[1]);
      ctx.lineTo(origin[0] + cellDim,   origin[1] + cellDim_2);
    }
    break;
    case 4:
    case 11:
    {
      ctx.moveTo(origin[0] + cellDim,   origin[1] + cellDim_2);
      ctx.lineTo(origin[0] + cellDim_2, origin[1] + cellDim);
    }
    break;
    case 8:
    case 7:
    {
      ctx.moveTo(origin[0],             origin[1] + cellDim_2);
      ctx.lineTo(origin[0] + cellDim_2, origin[1] + cellDim);
    }
    break;
    // bisector (4 cases; 2 horizontal, 2 vertical)
    case 3:
    case 12:
    {
      ctx.moveTo(origin[0],           origin[1] + cellDim_2);
      ctx.lineTo(origin[0] + cellDim, origin[1]+ cellDim_2);
    }
    break;
    case 6:
    case 9:
    {
      ctx.moveTo(origin[0] + cellDim_2, origin[1]);
      ctx.lineTo(origin[0] + cellDim_2, origin[1] + cellDim);
    }
    break;
    // double cut (2 cases; one left to right, one right to left)
    case 5:
    {
      ctx.moveTo(origin[0] + cellDim_2, origin[1]);
      ctx.lineTo(origin[0] + cellDim,   origin[1] + cellDim_2);
      ctx.moveTo(origin[0],             origin[1] + cellDim_2);
      ctx.lineTo(origin[0] + cellDim_2, origin[1] + cellDim);
    }
    break;
    case 10:
    {
      ctx.moveTo(origin[0] + cellDim_2, origin[1]);
      ctx.lineTo(origin[0],             origin[1] + cellDim_2);
      ctx.moveTo(origin[0] + cellDim,   origin[1] + cellDim_2);
      ctx.lineTo(origin[0] + cellDim_2, origin[1] + cellDim);
    }
  }
}

function drawGrid(ctx) {
  let curCellSize = cellSize.current;
  // cells spans and not stops; their count + 1 is needed to fully draw
  // the squares
  let offset = canvas.offset;
  let totalOffset = 2 * offset;
  let canvasW = canvas.width;
  let canvasH = canvas.height;
  let i = Math.floor((canvasW - totalOffset) / curCellSize);
  let j = Math.floor((canvasH - totalOffset) / curCellSize);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  // horizontals
  while (i >= 0) {
    ctx.moveTo(offset + (i * curCellSize), 0);
    ctx.lineTo(offset + (i * curCellSize), canvasH);
    --i;
  }
  // verticals
  while (j >= 0) {
    ctx.moveTo(0, offset + (j * curCellSize));
    ctx.lineTo(canvasW, offset + (j * curCellSize));
    --j;
  }

  ctx.stroke();
}

function drawSamples(ctx) {
  // in Firefox 58.0.2 omitting this beginPath made the renderer crawl
  ctx.beginPath();
  ctx.fillStyle = "rgb(0, 255, 0)";
  let n = samples.rows * samples.cols;
  for (let i = 0; i < n; ++i) {
    if (samples.data[i] >= 1) {
      let pt = getSampleLoc(i);
      ctx.rect(pt[0] - 2, pt[1] - 2, 4, 4);
    }
  }
  ctx.fill();
}

function drawCircles(ctx) {
  ctx.strokeStyle = "Red";
  ctx.beginPath();
  let n = circles.length;
  for (let idx = 0; idx < n; ++idx) {
    let c = circles[idx];
    ctx.moveTo(c.centre[0] + c.radius, c.centre[1]);
    ctx.arc(c.centre[0], c.centre[1], c.radius, 0, 2 * Math.PI, false);
  }
  ctx.stroke();
}

function animateCircles(ticks) {
  let n = circles.length;
  for (let i = 0; i < n; ++i) {
    let c = circles[i];
    // don’t animate if handled by user
    if (sel.circle !== c) {
      let vt = vec2.create();
      vec2.scale(vt, c.vel, ticks);
      vec2.add(c.centre, c.centre, vt);
    }
  }

  // check for collisions
  for (let i = 0; i < n; ++i) {
    let c = circles[i];
    // hit left wall
    if (c.centre[0] < c.radius) {
      c.centre[0] = c.radius;
      c.vel = reflect(c.vel, vec2.fromValues(1, 0));
    }
    // hit right wall
    else if (c.centre[0] + c.radius > canvas.width) {
      c.centre[0] = canvas.width - c.radius;
      c.vel = reflect(c.vel, vec2.fromValues(-1, 0));
    }

    // hit top wall; this shouldn’t be an else-if
    if (c.centre[1] < c.radius) {
      c.centre[1] = c.radius;
      c.vel = reflect(c.vel, vec2.fromValues(0, 1));
    }
    // hit bottom wall
    else if (c.centre[1] + c.radius > canvas.height) {
      c.centre[1] = canvas.height - c.radius;
      c.vel = reflect(c.vel, vec2.fromValues(0, -1));
    }
  }
}

function init2DCanvas(canvas) {
  let ctx;
  try {
    ctx = canvas.getContext("2d");
  }
  catch (e) {
    alert("Unable to initialize Canvas. Your browser may not support it.");
  }
  return ctx;
}

function start() {
  // https://developer.mozilla.org/en-US/docs/Web/API/
  // Canvas_API/Tutorial/Optimizing_canvas
  let canvasContent = document.getElementById("canvasContent");
  let canvasGrid = document.getElementById("canvasGrid");
  let ctxContent = init2DCanvas(canvasContent);
  let ctxGrid = init2DCanvas(canvasGrid);

  canvasContent.addEventListener("mousedown", onMouseDown);
  canvasContent.addEventListener("mousemove", onMouseMove);
  canvasContent.addEventListener("mouseup", onMouseUp);

  let slider = document.getElementById("gridResolution");
  slider.addEventListener("input", changeResolution);
  changeResolution({target: slider});

  document.getElementById("chkLerp").checked = lerp;
  document.getElementById("chkSamples").checked = showSamples;
  document.getElementById("chkGrid").checked = grid;
  document.getElementById("chkAnimate").checked = animate;

  let lblFps = document.getElementById("lblFps");

  let loop = function(timestamp) {
               let ticks = (timestamp - lastTime) * 0.001;
               let pr = window.devicePixelRatio;
               update(ticks);
               lblFps.textContent = Math.round(1 / ticks);
               lastTime = timestamp;
               if (drawBackground) {
                 renderGrid(ctxGrid);
                 drawBackground = false;
               }
               renderContent(ctxContent);
               window.requestAnimationFrame(loop);
             };
  let lastTime = performance.now();
  window.requestAnimationFrame(loop);
}

function onMouseDown(e) {
  let pt = getCursorPosition(e, e.target);
  let n = circles.length;
  for (let i = 0; i < n; ++i) {
    if (isPointInCircle(circles[i], pt)) {
      sel.circle = circles[i];
      sel.lastPt = pt;
      break;
    }
  }
}

function onMouseMove(e) {
  let pt = getCursorPosition(e, e.target);
  if (sel.circle) {
    let d = vec2.create();
    vec2.sub(d, pt, sel.lastPt);
    vec2.add(sel.circle.centre, sel.circle.centre, d);
    sel.lastPt = pt;
  }
}

function onMouseUp(e) {
  sel.circle = null;
}

function flipSampleView() {
  showSamples = !showSamples;
}

function flipLerp() {
  lerp = !lerp;
}

function flipGridView() {
  grid = !grid;
  drawBackground = true;
}

function flipAnimation() {
  animate = !animate;
}

function getCursorPosition(event, element) {
  let rect = element.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;
  return vec2.fromValues(x, y);
}

function changeResolution(e) {
  let slider = e.target;
  let resolution = parseInt(slider.value, 10);
  let percent = resolution / 100.0;
  // cranking up the resolution brings down the cell size
  let cellDim = (cellSize.max * (1 - percent)) + (cellSize.min * percent);
  let totalOffset = canvas.offset * 2;
  // add one since we want stops and not spans i.e. cell corners not cells
  let cols = Math.ceil((canvas.width - totalOffset) / cellDim) + 1;
  let rows = Math.ceil((canvas.height - totalOffset) / cellDim) + 1;

  // update states
  cellSize.current = cellDim;
  samples.cols = cols;
  samples.rows = rows;
  drawBackground = true;

  // getting labels associated with a input element
  // https://stackoverflow.com/q/285522/183120
  // It’s unsupported by Edge though.
  if (slider.labels)
    slider.labels[1].textContent = cols + " × " + rows;
  else
  {
    let label = document.getElementById("resText");
    label.textContent = cols + " × " + rows;
  }
}

// hook-up events to functions
// https://stackoverflow.com/q/44590393/183120
window.onload = start;
document.getElementById("chkAnimate").addEventListener("change", flipAnimation);
document.getElementById("chkSamples").addEventListener("change",
                                                       flipSampleView);
document.getElementById("chkLerp").addEventListener("change", flipLerp);
document.getElementById("chkGrid").addEventListener("change", flipGridView);
