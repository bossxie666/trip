import fs from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';
import sharp from 'sharp';

// Captures only the data-free loopback visual laboratory. No member sessions.
const evidence = '/Users/bossxie/Desktop/codex/旅行/visual-evidence';
const round = process.argv[2] || 'round-4';
if (!/^(round-[1-6]|my-trips)$/.test(round)) throw new Error('Use round-1 through round-6 or my-trips');
const output = path.join(evidence, `home-v4-${round}`);
await fs.mkdir(output, { recursive: true });
const pages = await (await fetch('http://127.0.0.1:9234/json/list')).json();
const page = pages.find((item) => item.type === 'page');
if (!page) throw new Error('Isolated visual-lab browser has no page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});
let id = 0;
const pending = new Map();
socket.on('message', (raw) => {
  const result = JSON.parse(raw.toString());
  const handler = pending.get(result.id);
  if (handler) {
    pending.delete(result.id);
    clearTimeout(handler.timeout);
    if (result.error) handler.reject(new Error(result.error.message));
    else handler.resolve(result.result);
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`${method} timed out`));
    }, 20000);
    pending.set(requestId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}
const metrics = [];
try {
  await send('Page.enable');
  for (const [name, width, height] of [['desktop', 1440, 810], ['mobile', 375, 667], ['320', 320, 667], ['390', 390, 667], ['430', 430, 667]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 681 });
    await send('Page.navigate', { url: 'http://localhost:4173/visual-lab/home-v4' });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const check = await send('Runtime.evaluate', {
        expression: `!!document.querySelector('[data-visual-lab="home-v4"]') && [...document.images].every(image => image.complete && image.naturalWidth > 0)`,
        returnByValue: true,
      });
      if (check.result?.value) { ready = true; break; }
    }
    if (!ready) throw new Error(`${name}: page or images did not load`);
    await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
    const result = await send('Runtime.evaluate', {
      expression: `JSON.stringify({url:location.href,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,brokenImages:[...document.images].filter(i=>!i.naturalWidth).length,visibleTripCards:[...document.querySelectorAll('[data-static-trip-preview]')].filter(i=>i.getBoundingClientRect().width>0).length})`,
      returnByValue: true,
    });
    metrics.push({ name, ...JSON.parse(result.result.value) });
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const current = path.join(output, `current-${name}.png`);
    await fs.writeFile(current, Buffer.from(screenshot.data, 'base64'));
    if (name !== 'desktop' && name !== 'mobile') continue;
    const reference = path.join(output, `reference-${name}.png`);
    await fs.copyFile(path.join(evidence, `home-v4-reference-${name}.png`), reference);
    // Explicit alpha: sharp's composite options do not support opacity.
    const { data, info } = await sharp(reference).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let pixel = 3; pixel < data.length; pixel += 4) data[pixel] = 128;
    const overlay = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    await sharp(current).composite([{ input: overlay, blend: 'over' }]).png().toFile(path.join(output, `overlay-${name}.png`));
  }
  await fs.writeFile(path.join(output, 'metrics.json'), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ output, metrics }, null, 2));
} finally {
  socket.close();
}
