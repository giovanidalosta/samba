const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let spawnedServerProc = null;

async function ensureServerRunning() {
  const isRunning = await new Promise((resolve) => {
    const req = http.get('http://localhost:3000/', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (isRunning) {
    return;
  }

  const sambaDir = path.resolve(__dirname, '..');
  spawnedServerProc = spawn('node', ['server.js'], {
    cwd: sambaDir,
    stdio: 'ignore',
    detached: false
  });

  // Wait for server to come up
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 100));
    try {
      const res = await fetch('http://localhost:3000/');
      if (res.ok) return;
    } catch (e) {}
  }
  throw new Error('Failed to start server.js on port 3000');
}

function stopSpawnedServer() {
  if (spawnedServerProc) {
    try {
      spawnedServerProc.kill();
    } catch (e) {}
    spawnedServerProc = null;
  }
}

class BrowserSession {
  constructor(browserProc, ws, tmpDir, port) {
    this.browserProc = browserProc;
    this.ws = ws;
    this.tmpDir = tmpDir;
    this.port = port;
    this.msgId = 1;
    this.callbacks = new Map();

    this.ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.method === 'Page.javascriptDialogOpening') {
          this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
          return;
        }
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) {
            reject(new Error(data.error.message || JSON.stringify(data.error)));
          } else {
            resolve(data.result);
          }
        }
      } catch (err) {}
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(fnOrString, ...args) {
    let expression;
    if (typeof fnOrString === 'function') {
      const serializedArgs = JSON.stringify(args);
      expression = `(${fnOrString.toString()})(...${serializedArgs})`;
    } else {
      expression = String(fnOrString);
    }

    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Evaluation failed: ${desc}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    // Wait until document is ready and window.BeatboxStudio is loaded
    await this.waitFor(() => {
      return document.readyState === 'complete' &&
             typeof window.BeatboxStudio === 'object';
    }, 10000);
  }

  async waitFor(predicateFn, timeoutMs = 5000, intervalMs = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const val = await this.evaluate(predicateFn);
        if (val) return val;
      } catch (e) {}
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout after ${timeoutMs}ms waiting for condition: ${predicateFn.toString()}`);
  }

  async waitForSelector(selector, timeoutMs = 5000) {
    return this.waitFor((sel) => !!document.querySelector(sel), timeoutMs, 100);
  }

  async getElementRect(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, left: r.left, top: r.top };
    }, selector);
  }

  async click(selector) {
    const rect = await this.getElementRect(selector);
    if (!rect) {
      // Fallback: evaluate element.click() in browser context
      return this.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Element not found: ${sel}`);
        el.click();
        return true;
      }, selector);
    }
    const x = Math.round(rect.x + rect.width / 2);
    const y = Math.round(rect.y + rect.height / 2);

    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    });
    await new Promise(r => setTimeout(r, 20));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1
    });
  }

  async drag(selector, { dx, dy = 0, steps = 10 }) {
    const rect = await this.getElementRect(selector);
    if (!rect) throw new Error(`Element not found for drag: ${selector}`);

    const startX = Math.round(rect.x + rect.width / 2);
    const startY = Math.round(rect.y + rect.height / 2);

    // Mouse/Pointer down
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y: startY,
      button: 'left',
      clickCount: 1
    });
    await new Promise(r => setTimeout(r, 30));

    // Mouse/Pointer moves
    for (let i = 1; i <= steps; i++) {
      const currentX = Math.round(startX + (dx * i) / steps);
      const currentY = Math.round(startY + (dy * i) / steps);
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: currentX,
        y: currentY,
        button: 'left'
      });
      await new Promise(r => setTimeout(r, 15));
    }

    // Mouse/Pointer up
    const finalX = Math.round(startX + dx);
    const finalY = Math.round(startY + dy);
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: finalX,
      y: finalY,
      button: 'left',
      clickCount: 1
    });
    await new Promise(r => setTimeout(r, 50));
  }

  async dispatchKey(code, key, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode: 0,
      nativeVirtualKeyCode: 0,
      modifiers
    });
    await new Promise(r => setTimeout(r, 20));
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: 0,
      nativeVirtualKeyCode: 0,
      modifiers
    });
  }

  async resetStudioState() {
    return this.evaluate(async () => {
      // Auto-confirm any confirmation prompts
      window.confirm = () => true;
      window.appConfirm = async () => true;
      window.alert = () => {};
      window.appAlert = async () => {};
      window.appPrompt = async (msg, def) => def;

      // Switch to studio tab
      if (typeof window.switchTab === 'function') {
        window.switchTab('tab-beatbox');
      }
      if (window.BeatboxStudio) {
        if (typeof window.BeatboxStudio.stopStudioPlayback === 'function') {
          window.BeatboxStudio.stopStudioPlayback();
        }
        if (typeof window.BeatboxStudio.switchViewMode === 'function') {
          window.BeatboxStudio.switchViewMode('timeline');
        }
        if (typeof window.BeatboxStudio.clearCurrentProjectTracks === 'function') {
          await window.BeatboxStudio.clearCurrentProjectTracks();
        }
        if (typeof window.BeatboxStudio.renderStudioViews === 'function') {
          window.BeatboxStudio.renderStudioViews();
        }
      }
      return true;
    });
  }

  async close() {
    try {
      this.ws.close();
    } catch (e) {}
    try {
      this.browserProc.kill();
    } catch (e) {}
    try {
      fs.rmSync(this.tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

async function launchBrowserOnce() {
  await ensureServerRunning();

  const browserPath = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!browserPath) {
    throw new Error('Neither Chrome nor Edge was found at standard locations.');
  }

  const port = 9300 + Math.floor(Math.random() * 500);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samba-daw-test-'));

  const browserProc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--window-size=1280,800',
    `--user-data-dir=${tmpDir}`,
    'http://localhost:3000/'
  ], { stdio: 'ignore' });

  // Poll for CDP page target
  let pageWsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const pages = await res.json();
        const pageTarget = pages.find(p => p.type === 'page');
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          pageWsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }

  if (!pageWsUrl) {
    browserProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Failed to find page target on CDP port ${port}`);
  }

  const ws = new WebSocket(pageWsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const session = new BrowserSession(browserProc, ws, tmpDir, port);
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('DOM.enable');

  // Navigate to studio tab
  await session.navigate('http://localhost:3000/');
  await session.resetStudioState();

  return session;
}

// A subida do Chrome é a maior fonte de intermitência da suíte: tenta de novo antes de falhar.
async function launchBrowser() {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await launchBrowserOnce(); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

module.exports = {
  launchBrowser,
  ensureServerRunning,
  stopSpawnedServer
};
