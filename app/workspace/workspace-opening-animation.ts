const inkBlue = [16, 25, 43];
const slateBlue = [112, 122, 149];
const paper = [247, 240, 211];
const sweepMs = 2800;
const frameIntervalMs = 1000 / 30;

function layer(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  return { canvas, context };
}

function makeBlueprint(color: ImageData) {
  const { width, height, data } = color;
  const { canvas, context } = layer(width, height);
  const blueprint = context.createImageData(width, height);
  const luminance = new Float32Array(width * height);

  for (let i = 0; i < luminance.length; i++) {
    const pixel = i * 4;
    luminance[i] = data[pixel] * .21 + data[pixel + 1] * .72 + data[pixel + 2] * .07;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const p = index * 4;
      const dx = luminance[y * width + Math.min(x + 1, width - 1)] - luminance[y * width + Math.max(x - 1, 0)];
      const dy = luminance[Math.min(y + 1, height - 1) * width + x] - luminance[Math.max(y - 1, 0) * width + x];
      const edge = Math.min(1, Math.max(0, Math.hypot(dx, dy) - 21) / 100);
      const grid = x % 12 === 0 || y % 12 === 0 ? 1 : 0;
      const wash = luminance[index] * .044;
      blueprint.data[p] = 18 + wash + grid * 9 + edge * 56;
      blueprint.data[p + 1] = 30 + wash + grid * 16 + edge * 102;
      blueprint.data[p + 2] = 57 + wash + grid * 24 + edge * 128;
      blueprint.data[p + 3] = 255;
    }
  }
  context.putImageData(blueprint, 0, 0);
  return { canvas, pixels: blueprint.data };
}

function makeLens(height: number) {
  const centerY = height / 2;
  const radius = Math.floor(height * .44);
  const width = radius * 2;
  const { canvas, context } = layer(width, height);
  const frame = context.createImageData(width, height);
  const offsetX = new Int16Array(width * height);
  const sampleY = new Uint16Array(width * height);
  const shine = new Int8Array(width * height);

  for (let y = 0; y < height; y++) {
    const dy = y + .5 - centerY;
    for (let x = 0; x < width; x++) {
      const dx = x + .5 - radius;
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      const index = y * width + x;
      const edge = (distance / radius) ** 4;
      const bend = .78 + .26 * edge;
      offsetX[index] = Math.round(dx * bend);
      sampleY[index] = Math.max(0, Math.min(height - 1, Math.round(centerY + dy * bend)));
      shine[index] = Math.round(29 * Math.max(0, 1 - Math.hypot((dx + 44) / 100, (y - 30) / 44)) - 12 * edge);
      frame.data[index * 4 + 3] = Math.min(255, (radius - distance) * 255);
    }
  }
  return { canvas, context, frame, offsetX, sampleY, shine, centerY, radius };
}

function backdrop(progress: number) {
  const from = progress < .5 ? inkBlue : slateBlue;
  const to = progress < .5 ? slateBlue : paper;
  const amount = progress < .5 ? progress * 2 : (progress - .5) * 2;
  return `rgb(${from.map((color, i) => Math.round(color + (to[i] - color) * amount)).join(', ')})`;
}

export function playOpening(screen: HTMLElement, track: HTMLElement, canvas: HTMLCanvasElement, artwork: HTMLImageElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  const { width, height } = canvas;
  const color = layer(width, height);
  color.context.drawImage(artwork, 0, 0, width, height);
  const colorPixels = color.context.getImageData(0, 0, width, height);
  const blueprint = makeBlueprint(colorPixels);
  const lens = makeLens(height);
  const fringe = [1, 3, 0, 4, 1, 2];
  const visibleWidth = Math.min(width, height * track.clientWidth / Math.max(1, track.clientHeight));
  const leftEdge = (width - visibleWidth) / 2;

  const paint = (progress: number) => {
    const scanX = Math.round(leftEdge + visibleWidth * progress);
    const lensX = Math.max(leftEdge + lens.radius, Math.min(leftEdge + visibleWidth - lens.radius, scanX));
    const coloredWidth = Math.min(width, scanX);
    context.drawImage(blueprint.canvas, 0, 0);
    if (coloredWidth > 0) context.drawImage(color.canvas, 0, 0, coloredWidth, height, 0, 0, coloredWidth, height);
    for (let y = 0; y < height; y += 2) {
      const band = Math.min(width - scanX, fringe[(y / 2) % fringe.length]);
      if (band > 0) context.drawImage(color.canvas, scanX, y, band, 2, scanX, y, band, 2);
    }

    const { frame, offsetX, sampleY, shine, radius, centerY } = lens;
    for (let i = 0; i < offsetX.length; i++) {
      const p = i * 4;
      if (!frame.data[p + 3]) continue;
      const sourceX = Math.max(0, Math.min(width - 1, Math.round(lensX) + offsetX[i]));
      const source = (sampleY[i] * width + sourceX) * 4;
      const pixels = sourceX < scanX ? colorPixels.data : blueprint.pixels;
      frame.data[p] = pixels[source] * 1.04 + shine[i];
      frame.data[p + 1] = pixels[source + 1] * 1.06 + shine[i] + 3;
      frame.data[p + 2] = pixels[source + 2] * 1.08 + shine[i] + 7;
    }
    lens.context.putImageData(frame, 0, 0);
    context.drawImage(lens.canvas, lensX - radius, 0);

    const rim = context.createLinearGradient(lensX - radius, 0, lensX + radius, height);
    rim.addColorStop(0, '#eef9ffcc');
    rim.addColorStop(.48, '#d4eaff91');
    rim.addColorStop(1, '#16233f88');
    context.strokeStyle = rim;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(lensX, centerY, radius - .6, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = '#f3faff78';
    context.beginPath();
    context.arc(lensX, centerY, radius - 5, Math.PI * 1.22, Math.PI * 1.48);
    context.stroke();
    screen.style.backgroundColor = backdrop(progress);
    screen.toggleAttribute('data-animating', progress < .57);
  };

  paint(0);
  track.dataset.visible = 'true';

  const start = performance.now();
  let lastPaint = start;
  let frame = 0;
  function tick(now: number) {
    const elapsed = Math.min(1, (now - start) / sweepMs);
    if (now - lastPaint >= frameIntervalMs || elapsed === 1) {
      paint(1 - (1 - elapsed) ** 1.4);
      lastPaint = now;
    }
    if (elapsed < 1) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
