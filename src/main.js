const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pidusage = require('pidusage');

let mainWindow;
const running = new Map();
const logs = new Map();
const MAX_LOG_LINES = 600;

function configPath() {
  return path.join(app.getPath('userData'), 'projects.json');
}

function loadProjects() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(projects, null, 2), 'utf8');
  return projects;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function pushLog(id, text, stream = 'stdout') {
  const clean = String(text).replace(/\r/g, '').split('\n').filter(Boolean);
  if (!logs.has(id)) logs.set(id, []);
  const bucket = logs.get(id);

  for (const line of clean) {
    const entry = {
      line,
      stream,
      time: new Date().toISOString()
    };
    bucket.push(entry);
    send('process-log', { id, ...entry });
  }

  if (bucket.length > MAX_LOG_LINES) {
    bucket.splice(0, bucket.length - MAX_LOG_LINES);
  }
}

function detectProject(folder) {
  const result = {
    folder,
    name: path.basename(folder),
    runtime: 'custom',
    command: '',
    args: [],
    installCommand: ''
  };

  const packageFile = path.join(folder, 'package.json');
  if (fs.existsSync(packageFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      result.name = pkg.name || result.name;
      result.runtime = 'node';
      result.installCommand = 'npm install';

      if (pkg.scripts && pkg.scripts.start) {
        result.command = 'npm';
        result.args = ['start'];
      } else if (pkg.main) {
        result.command = 'node';
        result.args = [pkg.main];
      } else if (fs.existsSync(path.join(folder, 'index.js'))) {
        result.command = 'node';
        result.args = ['index.js'];
      }
      return result;
    } catch {
      // Fall through to other detection rules.
    }
  }

  const pythonCandidates = ['main.py', 'bot.py', 'app.py'];
  const pythonEntry = pythonCandidates.find(file => fs.existsSync(path.join(folder, file)));
  if (pythonEntry) {
    result.runtime = 'python';
    result.command = process.platform === 'win32' ? 'python' : 'python3';
    result.args = [pythonEntry];
    result.installCommand = fs.existsSync(path.join(folder, 'requirements.txt'))
      ? `${result.command} -m pip install -r requirements.txt`
      : '';
  }

  return result;
}

function normalizeCommand(command) {
  if (process.platform !== 'win32') return command;
  const cmd = String(command || '').toLowerCase();
  if (['npm', 'npx', 'pnpm', 'yarn'].includes(cmd)) return `${command}.cmd`;
  return command;
}

function parseCommandLine(value) {
  const input = String(value || '').trim();
  if (!input) return { command: '', args: [] };

  const tokens = [];
  let current = '';
  let quote = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);

  return { command: tokens.shift() || '', args: tokens };
}

function runProject(project) {
  if (!project || !project.id) throw new Error('Invalid project.');
  if (running.has(project.id)) return { ok: true, alreadyRunning: true };
  if (!project.path || !fs.existsSync(project.path)) throw new Error('Project folder was not found.');

  const command = normalizeCommand(project.command);
  if (!command) throw new Error('Set a start command first.');

  const child = spawn(command, Array.isArray(project.args) ? project.args : [], {
    cwd: project.path,
    env: process.env,
    windowsHide: true,
    shell: false,
    detached: process.platform !== 'win32'
  });

  const state = {
    child,
    project,
    startedAt: Date.now(),
    stopping: false,
    restartTimer: null
  };
  running.set(project.id, state);
  logs.set(project.id, []);

  pushLog(project.id, `Started ${project.name || 'project'} with PID ${child.pid}.`, 'system');
  send('process-status', { id: project.id, status: 'running', pid: child.pid, startedAt: state.startedAt });

  child.stdout?.on('data', chunk => pushLog(project.id, chunk.toString(), 'stdout'));
  child.stderr?.on('data', chunk => pushLog(project.id, chunk.toString(), 'stderr'));

  child.on('error', error => {
    pushLog(project.id, error.message, 'stderr');
  });

  child.on('exit', (code, signal) => {
    const lastState = running.get(project.id);
    running.delete(project.id);
    pushLog(project.id, `Process exited with code ${code ?? 'none'}${signal ? ` (${signal})` : ''}.`, 'system');
    send('process-status', { id: project.id, status: 'stopped', code, signal });

    if (lastState && !lastState.stopping && project.autoRestart) {
      pushLog(project.id, 'Auto restart is enabled. Restarting in 2 seconds.', 'system');
      const timer = setTimeout(() => {
        try {
          runProject(project);
        } catch (error) {
          pushLog(project.id, error.message, 'stderr');
        }
      }, 2000);
      lastState.restartTimer = timer;
    }
  });

  return { ok: true, pid: child.pid, startedAt: state.startedAt };
}

function stopProject(id) {
  const state = running.get(id);
  if (!state) return Promise.resolve({ ok: true, alreadyStopped: true });

  state.stopping = true;
  if (state.restartTimer) clearTimeout(state.restartTimer);

  return new Promise(resolve => {
    const finish = () => {
      running.delete(id);
      send('process-status', { id, status: 'stopped' });
      resolve({ ok: true });
    };

    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(state.child.pid), '/T', '/F'], () => finish());
    } else {
      try {
        process.kill(-state.child.pid, 'SIGTERM');
      } catch {
        try { state.child.kill('SIGTERM'); } catch {}
      }
      setTimeout(finish, 350);
    }
  });
}

async function installDependencies(project) {
  if (!project?.path || !project.installCommand) throw new Error('No install command is set.');
  const parsed = parseCommandLine(project.installCommand);
  if (!parsed.command) throw new Error('Install command is empty.');

  return new Promise((resolve, reject) => {
    pushLog(project.id, `Running: ${project.installCommand}`, 'system');
    const child = spawn(normalizeCommand(parsed.command), parsed.args, {
      cwd: project.path,
      windowsHide: true,
      shell: false,
      env: process.env
    });

    child.stdout?.on('data', chunk => pushLog(project.id, chunk.toString(), 'stdout'));
    child.stderr?.on('data', chunk => pushLog(project.id, chunk.toString(), 'stderr'));
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error(`Install command exited with code ${code}.`));
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#0b0d10',
    show: false,
    title: 'BotDock',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('projects:list', () => {
    const projects = loadProjects();
    return projects.map(project => ({
      ...project,
      running: running.has(project.id),
      pid: running.get(project.id)?.child.pid || null
    }));
  });

  ipcMain.handle('projects:pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    return detectProject(result.filePaths[0]);
  });

  ipcMain.handle('projects:save', (_event, project) => {
    const projects = loadProjects();
    const next = {
      id: project.id || crypto.randomUUID(),
      name: String(project.name || path.basename(project.path || '') || 'Project'),
      path: String(project.path || ''),
      runtime: String(project.runtime || 'custom'),
      command: String(project.command || ''),
      args: Array.isArray(project.args) ? project.args.map(String) : [],
      installCommand: String(project.installCommand || ''),
      autoRestart: Boolean(project.autoRestart)
    };
    const index = projects.findIndex(item => item.id === next.id);
    if (index >= 0) projects[index] = next;
    else projects.push(next);
    saveProjects(projects);
    return next;
  });

  ipcMain.handle('projects:remove', async (_event, id) => {
    await stopProject(id);
    saveProjects(loadProjects().filter(project => project.id !== id));
    logs.delete(id);
    return { ok: true };
  });

  ipcMain.handle('process:start', (_event, project) => runProject(project));
  ipcMain.handle('process:stop', (_event, id) => stopProject(id));
  ipcMain.handle('process:restart', async (_event, project) => {
    await stopProject(project.id);
    return runProject(project);
  });
  ipcMain.handle('process:logs', (_event, id) => logs.get(id) || []);
  ipcMain.handle('process:install', (_event, project) => installDependencies(project));

  ipcMain.handle('project:open-folder', (_event, folder) => shell.openPath(folder));

  ipcMain.handle('env:read', (_event, folder) => {
    const file = path.join(folder, '.env');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  });

  ipcMain.handle('env:write', (_event, folder, content) => {
    fs.writeFileSync(path.join(folder, '.env'), String(content || ''), 'utf8');
    return { ok: true };
  });

  setInterval(async () => {
    for (const [id, state] of running.entries()) {
      try {
        const stat = await pidusage(state.child.pid);
        send('process-stats', {
          id,
          cpu: Number(stat.cpu || 0),
          memory: Number(stat.memory || 0),
          uptime: Date.now() - state.startedAt
        });
      } catch {
        // The process can exit between status checks.
      }
    }
  }, 2000).unref();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  for (const [id] of running) stopProject(id);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
