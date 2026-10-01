const state = {
  projects: [],
  activeId: null,
  logs: new Map(),
  stats: new Map(),
  status: new Map(),
  pendingProject: null
};

const $ = selector => document.querySelector(selector);
const projectList = $('#projectList');
const projectCount = $('#projectCount');
const emptySide = $('#emptySide');
const welcome = $('#welcome');
const projectView = $('#projectView');
const consoleOutput = $('#consoleOutput');
const toast = $('#toast');

function activeProject() {
  return state.projects.find(project => project.id === state.activeId) || null;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function splitCommand(value) {
  const input = String(value || '').trim();
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
    if (char === '"' || char === "'") { quote = char; continue; }
    if (/\s/.test(char)) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return { command: tokens.shift() || '', args: tokens };
}

function commandString(project) {
  return [project.command, ...(project.args || [])]
    .map(token => /\s/.test(token) ? `"${token}"` : token)
    .join(' ')
    .trim();
}

function formatMemory(bytes) {
  return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(ms) {
  const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

function renderProjectList() {
  projectList.innerHTML = '';
  projectCount.textContent = String(state.projects.length);
  emptySide.hidden = state.projects.length > 0;

  for (const project of state.projects) {
    const button = document.createElement('button');
    const running = state.status.get(project.id)?.status === 'running' || project.running;
    button.className = `project-item${project.id === state.activeId ? ' active' : ''}${running ? ' running' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <span class="mini-dot"></span>
      <span><strong></strong><small></small></span>
    `;
    button.querySelector('strong').textContent = project.name;
    button.querySelector('small').textContent = project.runtime || 'custom';
    button.addEventListener('click', () => selectProject(project.id));
    projectList.appendChild(button);
  }
}

async function selectProject(id) {
  state.activeId = id;
  renderProjectList();
  const project = activeProject();
  if (!project) {
    welcome.hidden = false;
    projectView.hidden = true;
    return;
  }

  welcome.hidden = true;
  projectView.hidden = false;
  $('#projectName').textContent = project.name;
  $('#projectPath').textContent = project.path;
  $('#nameInput').value = project.name;
  $('#commandInput').value = commandString(project);
  $('#installInput').value = project.installCommand || '';
  $('#autoRestartInput').checked = Boolean(project.autoRestart);

  const existingLogs = await window.botdock.logs(project.id);
  state.logs.set(project.id, existingLogs);
  renderConsole();
  updateStatusUi();

  if (document.querySelector('.tab.active')?.dataset.tab === 'environment') {
    loadEnv();
  }
}

function updateStatusUi() {
  const project = activeProject();
  if (!project) return;
  const status = state.status.get(project.id) || { status: project.running ? 'running' : 'stopped', pid: project.pid };
  const running = status.status === 'running';
  $('#statusDot').classList.toggle('running', running);
  $('#statusText').textContent = running ? 'Running' : 'Stopped';
  $('#pidValue').textContent = status.pid || '-';
  $('#startButton').disabled = running;
  $('#restartButton').disabled = !running;
  $('#stopButton').disabled = !running;
  renderProjectList();
}

function renderConsole() {
  const project = activeProject();
  if (!project) return;
  const entries = state.logs.get(project.id) || [];
  consoleOutput.textContent = entries.map(entry => {
    const time = new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const prefix = entry.stream === 'stderr' ? 'ERR' : entry.stream === 'system' ? 'SYS' : 'OUT';
    return `[${time}] ${prefix}  ${entry.line}`;
  }).join('\n');
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

async function refreshProjects() {
  state.projects = await window.botdock.listProjects();
  for (const project of state.projects) {
    state.status.set(project.id, { status: project.running ? 'running' : 'stopped', pid: project.pid });
  }
  if (state.activeId && !state.projects.some(project => project.id === state.activeId)) state.activeId = null;
  renderProjectList();
  if (state.activeId) await selectProject(state.activeId);
}

async function openAddDialog() {
  const detected = await window.botdock.pickFolder();
  if (!detected) return;
  state.pendingProject = detected;
  $('#dialogName').value = detected.name;
  $('#dialogPath').value = detected.folder;
  $('#dialogCommand').value = [detected.command, ...(detected.args || [])].join(' ').trim();
  $('#dialogInstall').value = detected.installCommand || '';
  $('#projectDialog').showModal();
}

async function savePendingProject(event) {
  event.preventDefault();
  if (!state.pendingProject) return;
  const parsed = splitCommand($('#dialogCommand').value);
  if (!parsed.command) {
    showToast('Set a start command first.');
    return;
  }
  const saved = await window.botdock.saveProject({
    name: $('#dialogName').value.trim() || state.pendingProject.name,
    path: state.pendingProject.folder,
    runtime: state.pendingProject.runtime,
    command: parsed.command,
    args: parsed.args,
    installCommand: $('#dialogInstall').value.trim(),
    autoRestart: false
  });
  $('#projectDialog').close();
  state.pendingProject = null;
  await refreshProjects();
  await selectProject(saved.id);
}

async function loadEnv() {
  const project = activeProject();
  if (!project) return;
  try {
    $('#envEditor').value = await window.botdock.readEnv(project.path);
  } catch (error) {
    showToast(error.message || 'Could not read .env.');
  }
}

$('#addProject').addEventListener('click', openAddDialog);
$('#welcomeAdd').addEventListener('click', openAddDialog);
$('#projectDialogForm').addEventListener('submit', savePendingProject);

$('#startButton').addEventListener('click', async () => {
  const project = activeProject();
  if (!project) return;
  try { await window.botdock.start(project); } catch (error) { showToast(error.message); }
});

$('#stopButton').addEventListener('click', async () => {
  const project = activeProject();
  if (!project) return;
  try { await window.botdock.stop(project.id); } catch (error) { showToast(error.message); }
});

$('#restartButton').addEventListener('click', async () => {
  const project = activeProject();
  if (!project) return;
  try { await window.botdock.restart(project); } catch (error) { showToast(error.message); }
});

$('#installButton').addEventListener('click', async () => {
  const project = activeProject();
  if (!project) return;
  try {
    $('#installButton').disabled = true;
    await window.botdock.install(project);
    showToast('Install command finished.');
  } catch (error) {
    showToast(error.message || 'Install command failed.');
  } finally {
    $('#installButton').disabled = false;
  }
});

$('#openFolder').addEventListener('click', () => {
  const project = activeProject();
  if (project) window.botdock.openFolder(project.path);
});

$('#removeProject').addEventListener('click', async () => {
  const project = activeProject();
  if (!project) return;
  if (!confirm(`Remove ${project.name} from BotDock? The project files will not be deleted.`)) return;
  await window.botdock.removeProject(project.id);
  state.activeId = null;
  await refreshProjects();
  welcome.hidden = false;
  projectView.hidden = true;
});

$('#settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const project = activeProject();
  if (!project) return;
  const parsed = splitCommand($('#commandInput').value);
  if (!parsed.command) return showToast('Start command cannot be empty.');

  const saved = await window.botdock.saveProject({
    ...project,
    name: $('#nameInput').value.trim() || project.name,
    command: parsed.command,
    args: parsed.args,
    installCommand: $('#installInput').value.trim(),
    autoRestart: $('#autoRestartInput').checked
  });
  state.projects = state.projects.map(item => item.id === saved.id ? saved : item);
  renderProjectList();
  $('#projectName').textContent = saved.name;
  showToast('Settings saved.');
});

$('#saveEnv').addEventListener('click', async () => {
  const project = activeProject();
  if (!project) return;
  try {
    await window.botdock.writeEnv(project.path, $('#envEditor').value);
    showToast('.env saved locally.');
  } catch (error) {
    showToast(error.message || 'Could not save .env.');
  }
});

$('#clearLogs').addEventListener('click', () => {
  const project = activeProject();
  if (!project) return;
  state.logs.set(project.id, []);
  renderConsole();
});

$('#copyLogs').addEventListener('click', async () => {
  await navigator.clipboard.writeText(consoleOutput.textContent || '');
  showToast('Logs copied.');
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab.dataset.tab));
    if (tab.dataset.tab === 'environment') loadEnv();
  });
});

window.botdock.onLog(entry => {
  if (!state.logs.has(entry.id)) state.logs.set(entry.id, []);
  const bucket = state.logs.get(entry.id);
  bucket.push(entry);
  if (bucket.length > 600) bucket.splice(0, bucket.length - 600);
  if (entry.id === state.activeId) renderConsole();
});

window.botdock.onStatus(data => {
  state.status.set(data.id, data);
  const project = state.projects.find(item => item.id === data.id);
  if (project) {
    project.running = data.status === 'running';
    project.pid = data.pid || null;
  }
  if (data.id === state.activeId) updateStatusUi();
  else renderProjectList();
});

window.botdock.onStats(data => {
  state.stats.set(data.id, data);
  if (data.id !== state.activeId) return;
  $('#cpuValue').textContent = `${data.cpu.toFixed(1)}%`;
  $('#memoryValue').textContent = formatMemory(data.memory);
  $('#uptimeValue').textContent = formatUptime(data.uptime);
});

refreshProjects();
