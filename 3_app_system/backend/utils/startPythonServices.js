/**
 * Auto-start Python sidecar services when the Node backend starts:
 * - forum_content_moderation (port 5001)
 * - sentiment_zeroshot (port 5002)
 *
 * Set AUTO_START_PYTHON_SERVICES=false in .env to disable (e.g. if you run them separately).
 */
const path = require('path');
const { spawn } = require('child_process');

const AUTO_START = process.env.AUTO_START_PYTHON_SERVICES !== 'false';
const PYTHON_DIR = path.join(__dirname, '..', '..', '..', '4_production_deploy', 'python');
const PYTHON_CMDS = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];

const children = [];

function findPythonAndScript(scriptName) {
  const fs = require('fs');
  const scriptPath = path.join(PYTHON_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) return { cmd: null, scriptPath };
  for (const cmd of PYTHON_CMDS) {
    try {
      require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' });
      return { cmd, scriptPath };
    } catch { continue; }
  }
  return { cmd: null, scriptPath };
}

function startOne(name, scriptName) {
  const { cmd, scriptPath } = findPythonAndScript(scriptName);
  if (!cmd) {
    console.warn(`[Python services] Skipping ${name}: Python not found or ${scriptName} missing`);
    return;
  }

  const child = spawn(cmd, [scriptPath], {
    cwd: PYTHON_DIR,
    // inherit stdout; pipe stderr so we can stream it live
    stdio: ['ignore', 'inherit', 'pipe'],
    detached: false,
    shell: false,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',   // disable Python's own output buffering
      PYTHONIOENCODING: 'utf-8',
    },
  });
  children.push(child);

  // Stream stderr line-by-line to Node's stderr immediately (no buffering)
  let buf = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop(); // keep incomplete last line in buffer
    for (const line of lines) {
      if (line.trim()) process.stderr.write(line + '\n');
    }
  });
  child.stderr.on('end', () => {
    if (buf.trim()) process.stderr.write(buf + '\n');
    buf = '';
  });

  child.on('error', (err) => {
    console.warn(`[Python services] ${name} failed to start:`, err.message);
  });
  child.on('exit', (code) => {
    if (code !== 0 && code != null) {
      console.warn(`[Python services] ${name} exited with code ${code}`);
    }
  });

  console.log(`[Python services] Started ${name} (PID ${child.pid})`);
}

function startAll() {
  if (!AUTO_START) {
    console.log('[Python services] Auto-start disabled (AUTO_START_PYTHON_SERVICES=false)');
    return;
  }
  startOne('forum_content_moderation', 'forum_content_moderation.py');
  startOne('sentiment_zeroshot', 'sentiment_zeroshot.py');

  const shutdown = () => {
    for (const c of children) { try { c.kill('SIGTERM'); } catch (_) {} }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

module.exports = { startAll, startOne, findPythonAndScript };
