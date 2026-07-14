const APP_VERSION = "2.0.0";
const STORAGE_KEY = "einsatz-lageboard-v2-state";
const LEGACY_STORAGE_KEY = "einsatz-lageboard-v1";

const TASKS = {
  MR: "Menschenrettung",
  BK: "Brandbekämpfung",
  BR: "Bereitstellung"
};

const AREAS = {
  KG: "KG",
  EG: "EG",
  "1OG": "1. OG",
  "2OG": "2. OG",
  "3OG": "3. OG"
};

const createInitialState = () => ({
  schemaVersion: 2,
  appVersion: APP_VERSION,
  incident: {
    number: "",
    keyword: "",
    location: "",
    startedAt: null,
    endedAt: null
  },
  teams: [],
  timeline: []
});

let state = loadState();
let currentView = "overview";
let audioContext = null;

const elements = {
  clock: document.querySelector("#live-clock"),
  network: document.querySelector("#network-badge"),
  alertStack: document.querySelector("#alert-stack"),
  navButtons: [...document.querySelectorAll("[data-view]")],
  viewPanels: [...document.querySelectorAll("[data-view-panel]")],
  navTeamCount: document.querySelector("#nav-team-count"),
  navLogCount: document.querySelector("#nav-log-count"),

  incidentNumber: document.querySelector("#incident-number"),
  incidentKeyword: document.querySelector("#incident-keyword"),
  incidentLocation: document.querySelector("#incident-location"),
  incidentTitle: document.querySelector("#incident-title"),
  incidentBadge: document.querySelector("#incident-badge"),
  incidentTimer: document.querySelector("#incident-timer"),
  incidentTimeInfo: document.querySelector("#incident-time-info"),
  incidentAction: document.querySelector("#incident-action"),

  metricTeams: document.querySelector("#metric-teams"),
  metricActive: document.querySelector("#metric-active"),
  metricPa: document.querySelector("#metric-pa"),
  metricAlerts: document.querySelector("#metric-alerts"),

  teamForm: document.querySelector("#team-form"),
  taskCode: document.querySelector("#team-form [name='taskCode']"),
  rescueArea: document.querySelector("#team-form [name='rescueArea']"),
  customArea: document.querySelector("#team-form [name='customArea']"),
  customTask: document.querySelector("#team-form [name='customTask']"),
  rescueAreaField: document.querySelector("#rescue-area-field"),
  customAreaField: document.querySelector("#custom-area-field"),
  customTaskField: document.querySelector("#custom-task-field"),
  teamFilter: document.querySelector("#team-filter"),
  teamListTitle: document.querySelector("#team-list-title"),
  teamList: document.querySelector("#team-list"),
  teamEmpty: document.querySelector("#team-empty"),

  paBoard: document.querySelector("#pa-board"),
  paEmpty: document.querySelector("#pa-empty"),
  paStartDialog: document.querySelector("#pa-start-dialog"),
  paStartForm: document.querySelector("#pa-start-form"),
  paStartTitle: document.querySelector("#pa-start-title"),
  pressureDialog: document.querySelector("#pressure-dialog"),
  pressureForm: document.querySelector("#pressure-form"),
  pressureTitle: document.querySelector("#pressure-title"),
  pressureMemberOne: document.querySelector("#pressure-member-one"),
  pressureMemberTwo: document.querySelector("#pressure-member-two"),

  noteForm: document.querySelector("#note-form"),
  timelineList: document.querySelector("#timeline-list"),
  timelineEmpty: document.querySelector("#timeline-empty"),
  exportTxt: document.querySelector("#export-txt"),
  resetIncident: document.querySelector("#reset-incident"),
  toastRegion: document.querySelector("#toast-region")
};

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.schemaVersion === 2) return normalizeState(stored);

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy?.incident && Array.isArray(legacy.teams)) {
      const migrated = migrateLegacyState(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // A damaged local entry must not prevent the application from starting.
  }
  return createInitialState();
}

function normalizeState(value) {
  const fresh = createInitialState();
  return {
    ...fresh,
    ...value,
    incident: { ...fresh.incident, ...(value.incident || {}) },
    teams: Array.isArray(value.teams) ? value.teams.map(team => ({
      ...team,
      paRuns: Array.isArray(team.paRuns) ? team.paRuns.map(normalizeRun) : []
    })) : [],
    timeline: Array.isArray(value.timeline) ? value.timeline : []
  };
}

function normalizeRun(run) {
  return {
    id: run.id || makeId(),
    startedAt: run.startedAt,
    endedAt: run.endedAt || null,
    expectedMinutes: Number(run.expectedMinutes || 30),
    deviceType: run.deviceType || "Pressluftatmer",
    nominalPressure: Number(run.nominalPressure || 300),
    members: Array.isArray(run.members) ? run.members : [],
    controls: Array.isArray(run.controls) ? run.controls : [],
    targetReachedAt: run.targetReachedAt || null,
    retreatStartedAt: run.retreatStartedAt || null,
    notifications: run.notifications || run.notified || {}
  };
}

function migrateLegacyState(legacy) {
  const migrated = createInitialState();
  migrated.incident = { ...migrated.incident, ...legacy.incident };
  migrated.timeline = (legacy.log || []).map(entry => ({
    id: entry.id || makeId(),
    at: entry.at,
    message: entry.message,
    type: "legacy"
  }));
  migrated.teams = legacy.teams.map(team => {
    const paRuns = [];
    const legacyRuns = [...(team.paHistory || []), ...(team.pa ? [team.pa] : [])];
    legacyRuns.forEach(run => paRuns.push(normalizeRun(run)));
    if (!legacyRuns.length && team.paStartedAt) {
      paRuns.push(normalizeRun({
        startedAt: team.paStartedAt,
        expectedMinutes: 30,
        members: [
          { name: "Geräteträger 1", startPressure: null },
          { name: "Geräteträger 2", startPressure: null }
        ]
      }));
    }
    return {
      id: team.id || makeId(),
      name: team.name || "Trupp",
      assignment: team.assignment || assignmentFromLegacyText(team.task || "Freier Auftrag"),
      status: team.status || "Bereit",
      createdAt: team.createdAt || new Date().toISOString(),
      paRuns
    };
  });
  return migrated;
}

function assignmentFromLegacyText(text) {
  const normalized = String(text).trim();
  for (const [code, label] of Object.entries(TASKS)) {
    if (normalized.includes(code) || normalized.toLowerCase().includes(label.toLowerCase())) {
      return { code, label, areaCode: null, areaLabel: null, display: normalized };
    }
  }
  return { code: "CUSTOM", label: normalized, areaCode: null, areaLabel: null, display: normalized };
}

function saveState() {
  state.appVersion = APP_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addTimeline(message, type = "system", at = new Date().toISOString()) {
  state.timeline.unshift({ id: makeId(), at, message, type });
}

function formatTime(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(new Date(value));
}

function durationParts(start, end = null) {
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((endTime - new Date(start).getTime()) / 1000));
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalSeconds: seconds
  };
}

function formatDuration(start, end = null) {
  if (!start) return "00:00:00";
  const parts = durationParts(start, end);
  return [parts.hours, parts.minutes, parts.seconds]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

function formatCountdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(Math.abs(milliseconds) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function setView(view) {
  currentView = view;
  elements.navButtons.forEach(button => button.classList.toggle("active", button.dataset.view === view));
  elements.viewPanels.forEach(panel => {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  window.scrollTo?.({ top: 0, behavior: "smooth" });
}

function isIncidentEnded() {
  return Boolean(state.incident.endedAt);
}

function getActiveRun(team) {
  return [...team.paRuns].reverse().find(run => run.startedAt && !run.endedAt) || null;
}

function findTeam(teamId) {
  return state.teams.find(team => team.id === teamId) || null;
}

function findRun(team, runId) {
  return team?.paRuns.find(run => run.id === runId) || null;
}

function getTiming(run) {
  const start = new Date(run.startedAt).getTime();
  const duration = Number(run.expectedMinutes) * 60 * 1000;
  return {
    start,
    oneThird: start + duration / 3,
    twoThirds: start + duration * 2 / 3,
    expectedEnd: start + duration
  };
}

function getControl(run, type) {
  return run.controls.find(control => control.type === type) || null;
}

function getDueState(run) {
  const timing = getTiming(run);
  const now = Date.now();
  return {
    oneThird: now >= timing.oneThird && !getControl(run, "oneThird"),
    twoThirds: now >= timing.twoThirds && !getControl(run, "twoThirds"),
    expectedEnd: now >= timing.expectedEnd
  };
}

function getOpenAlertCount() {
  return state.teams.reduce((count, team) => {
    const run = getActiveRun(team);
    if (!run) return count;
    const due = getDueState(run);
    return count + Number(due.oneThird) + Number(due.twoThirds) + Number(due.expectedEnd);
  }, 0);
}

function getNextCheckpointText(run) {
  const timing = getTiming(run);
  const due = getDueState(run);
  const now = Date.now();
  if (run.retreatStartedAt) return `Rückzug seit ${formatDuration(run.retreatStartedAt)}`;
  if (due.expectedEnd) return `Erwartete Einsatzzeit seit ${formatCountdown(now - timing.expectedEnd)} überschritten`;
  if (due.twoThirds) return `2/3-Kontrolle seit ${formatCountdown(now - timing.twoThirds)} fällig`;
  if (due.oneThird) return `1/3-Kontrolle seit ${formatCountdown(now - timing.oneThird)} fällig`;
  if (!getControl(run, "oneThird")) return `1/3-Kontrolle in ${formatCountdown(timing.oneThird - now)}`;
  if (!getControl(run, "twoThirds")) return `2/3-Kontrolle in ${formatCountdown(timing.twoThirds - now)}`;
  return `Erwartete Einsatzzeit endet in ${formatCountdown(timing.expectedEnd - now)}`;
}

function determineControlType(run) {
  const timing = getTiming(run);
  const now = Date.now();
  if (now >= timing.twoThirds && !getControl(run, "twoThirds")) return "twoThirds";
  if (now >= timing.oneThird && !getControl(run, "oneThird")) return "oneThird";
  return "interim";
}

function renderAll() {
  renderIncident();
  renderMetrics();
  renderTeams();
  renderPaBoard();
  renderTimeline();
  renderGlobalAlerts();
  renderNavigationCounts();
  applyIncidentLock();
  updateLiveValues();
}

function renderIncident() {
  elements.incidentNumber.value = state.incident.number;
  elements.incidentKeyword.value = state.incident.keyword;
  elements.incidentLocation.value = state.incident.location;
  const started = Boolean(state.incident.startedAt);
  const ended = Boolean(state.incident.endedAt);

  elements.incidentTitle.textContent = state.incident.keyword || (started ? "Laufender Einsatz" : "Einsatz vorbereiten");
  elements.incidentBadge.className = `incident-badge ${ended ? "ended" : started ? "running" : "ready"}`;
  elements.incidentBadge.textContent = ended ? "Beendet" : started ? "Läuft" : "Bereit";
  elements.incidentAction.textContent = ended ? "Einsatz beendet" : started ? "Einsatz beenden" : "Einsatz starten";
  elements.incidentAction.className = `action-button ${started && !ended ? "end" : "start"}`;
  elements.incidentAction.disabled = ended;
}

function renderMetrics() {
  elements.metricTeams.textContent = state.teams.length;
  elements.metricActive.textContent = state.teams.filter(team => team.status === "Im Einsatz").length;
  elements.metricPa.textContent = state.teams.filter(team => getActiveRun(team)).length;
  elements.metricAlerts.textContent = getOpenAlertCount();
}

function renderNavigationCounts() {
  elements.navTeamCount.textContent = state.teams.length;
  elements.navLogCount.textContent = state.timeline.length;
}

function syncAssignmentForm() {
  const rescue = elements.taskCode.value === "MR";
  const customTask = elements.taskCode.value === "CUSTOM";
  const customArea = rescue && elements.rescueArea.value === "CUSTOM";

  elements.rescueAreaField.hidden = !rescue;
  elements.customTaskField.hidden = !customTask;
  elements.customAreaField.hidden = !customArea;
  elements.rescueArea.required = rescue;
  elements.customTask.required = customTask;
  elements.customArea.required = customArea;

  if (!rescue) {
    elements.rescueArea.value = "";
    elements.customArea.value = "";
  }
  if (!customArea) elements.customArea.value = "";
  if (!customTask) elements.customTask.value = "";
}

function buildAssignment(formData) {
  const code = String(formData.get("taskCode") || "");
  if (code === "CUSTOM") {
    const label = String(formData.get("customTask") || "").trim();
    return label ? { code, label, areaCode: null, areaLabel: null, display: label } : null;
  }
  if (!TASKS[code]) return null;

  const assignment = {
    code,
    label: TASKS[code],
    areaCode: null,
    areaLabel: null,
    display: `${code} · ${TASKS[code]}`
  };
  if (code === "MR") {
    const areaCode = String(formData.get("rescueArea") || "");
    const areaLabel = areaCode === "CUSTOM"
      ? String(formData.get("customArea") || "").trim()
      : AREAS[areaCode];
    if (!areaLabel) return null;
    assignment.areaCode = areaCode;
    assignment.areaLabel = areaLabel;
    assignment.display += ` · ${areaLabel}`;
  }
  return assignment;
}

function createButton(text, className, handler, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = className;
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function renderTeams() {
  const filter = elements.teamFilter.value;
  const teams = filter === "all" ? state.teams : state.teams.filter(team => team.status === filter);
  elements.teamListTitle.textContent = `${state.teams.length} ${state.teams.length === 1 ? "Trupp" : "Trupps"}`;
  elements.teamList.replaceChildren(...teams.map(createTeamCard));
  elements.teamEmpty.hidden = state.teams.length > 0;
}

function createTeamCard(team) {
  const run = getActiveRun(team);
  const card = document.createElement("article");
  const statusClass = team.status === "Im Einsatz" ? "status-active" : team.status === "Bereit" ? "status-ready" : team.status === "Beendet" ? "status-ended" : "";
  card.className = `team-card ${statusClass}`;

  const header = document.createElement("div");
  header.className = "team-card-header";
  const info = document.createElement("div");
  const name = document.createElement("h3");
  const assignment = document.createElement("p");
  name.className = "team-name";
  assignment.className = "team-assignment";
  name.textContent = team.name;
  assignment.textContent = team.assignment.display;
  info.append(name, assignment);
  const remove = createButton("×", "remove-button", () => removeTeam(team.id), isIncidentEnded());
  remove.title = "Trupp entfernen";
  remove.setAttribute("aria-label", `${team.name} entfernen`);
  header.append(info, remove);

  const meta = document.createElement("div");
  meta.className = "team-meta";
  const statusChip = document.createElement("span");
  statusChip.className = "team-chip";
  statusChip.textContent = team.status;
  meta.append(statusChip);
  if (run) {
    const paChip = document.createElement("span");
    paChip.className = "team-chip pa";
    paChip.textContent = `PA aktiv · ${formatDuration(run.startedAt)}`;
    meta.append(paChip);
  }
  if (team.paRuns.length) {
    const history = document.createElement("span");
    history.className = "team-chip";
    history.textContent = `${team.paRuns.length} PA-${team.paRuns.length === 1 ? "Einsatz" : "Einsätze"}`;
    meta.append(history);
  }

  const actions = document.createElement("div");
  actions.className = "team-card-actions";
  const statusSelect = document.createElement("select");
  statusSelect.setAttribute("aria-label", `Status von ${team.name}`);
  ["Bereit", "Im Einsatz", "Rückmeldung", "Beendet"].forEach(status => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    option.selected = team.status === status;
    statusSelect.append(option);
  });
  statusSelect.disabled = isIncidentEnded();
  statusSelect.addEventListener("change", () => updateTeamStatus(team.id, statusSelect.value));
  actions.append(statusSelect);
  if (run) {
    actions.append(createButton("Zur PA-Überwachung", "secondary-button", () => setView("overview")));
  } else {
    actions.append(createButton("Unter PA vorgehen", "action-button", () => openPaStartDialog(team.id), isIncidentEnded()));
  }

  card.append(header, meta, actions);
  return card;
}

function createStage(label, plannedAt, completedAt, due) {
  const stage = document.createElement("div");
  stage.className = `pa-stage${completedAt ? " complete" : ""}${due && !completedAt ? " due" : ""}`;
  const title = document.createElement("strong");
  const value = document.createElement("span");
  title.textContent = label;
  value.textContent = completedAt ? `✓ ${formatTime(completedAt)}` : formatTime(plannedAt);
  stage.append(title, value);
  return stage;
}

function renderPaBoard() {
  const active = state.teams
    .map(team => ({ team, run: getActiveRun(team) }))
    .filter(entry => entry.run);
  elements.paBoard.replaceChildren(...active.map(({ team, run }) => createPaCard(team, run)));
  elements.paEmpty.hidden = active.length > 0;
}

function createPaCard(team, run) {
  const timing = getTiming(run);
  const due = getDueState(run);
  const oneThird = getControl(run, "oneThird");
  const twoThirds = getControl(run, "twoThirds");
  const card = document.createElement("article");
  card.className = `pa-card${due.oneThird || due.twoThirds || due.expectedEnd ? " due" : ""}`;

  const header = document.createElement("div");
  header.className = "pa-card-header";
  const info = document.createElement("div");
  const name = document.createElement("h3");
  const assignment = document.createElement("p");
  name.textContent = team.name;
  assignment.textContent = team.assignment.display;
  info.append(name, assignment);
  const elapsed = document.createElement("div");
  elapsed.className = "pa-elapsed";
  elapsed.dataset.teamId = team.id;
  elapsed.dataset.runId = run.id;
  elapsed.textContent = formatDuration(run.startedAt);
  header.append(info, elapsed);

  const body = document.createElement("div");
  body.className = "pa-body";
  const next = document.createElement("p");
  next.className = `pa-next${due.oneThird || due.twoThirds || due.expectedEnd ? " due" : ""}`;
  next.dataset.teamId = team.id;
  next.dataset.runId = run.id;
  next.textContent = getNextCheckpointText(run);

  const members = document.createElement("div");
  members.className = "pa-members";
  run.members.forEach((member, index) => {
    const memberCard = document.createElement("div");
    memberCard.className = "pa-member";
    const memberName = document.createElement("strong");
    const memberPressure = document.createElement("span");
    memberName.textContent = member.name || `Geräteträger ${index + 1}`;
    memberPressure.textContent = `Startdruck ${member.startPressure ?? "–"} bar`;
    memberCard.append(memberName, memberPressure);
    members.append(memberCard);
  });

  const stages = document.createElement("div");
  stages.className = "pa-stages";
  stages.append(
    createStage("Beginn", run.startedAt, run.startedAt, false),
    createStage("1/3 Kontrolle", timing.oneThird, oneThird?.at, due.oneThird),
    createStage("2/3 Kontrolle", timing.twoThirds, twoThirds?.at, due.twoThirds),
    createStage("Rückzug", null, run.retreatStartedAt, false)
  );

  const actions = document.createElement("div");
  actions.className = "pa-card-actions";
  const controlType = determineControlType(run);
  const labels = {
    oneThird: "1/3-Kontrolle",
    twoThirds: "2/3-Kontrolle",
    interim: "Zwischenkontrolle"
  };
  actions.append(
    createButton(labels[controlType], "action-button", () => openPressureDialog(team.id, run.id, controlType)),
    createButton("Einsatzziel erreicht", "secondary-button", () => markTarget(team.id, run.id), Boolean(run.targetReachedAt)),
    createButton("Rückzug begonnen", "retreat-button", () => markRetreat(team.id, run.id), Boolean(run.retreatStartedAt)),
    createButton("PA beenden", "end-pa-button", () => endPaRun(team.id, run.id))
  );
  body.append(next, members, stages, actions);
  card.append(header, body);
  return card;
}

function renderTimeline() {
  elements.timelineList.replaceChildren(...state.timeline.map(entry => {
    const item = document.createElement("li");
    item.className = "timeline-item";
    const time = document.createElement("time");
    time.className = "timeline-time";
    time.dateTime = entry.at;
    time.textContent = formatTime(entry.at);
    const rail = document.createElement("span");
    rail.className = "timeline-rail";
    const dot = document.createElement("span");
    dot.className = "timeline-dot";
    rail.append(dot);
    const message = document.createElement("span");
    message.className = "timeline-message";
    message.textContent = entry.message;
    item.append(time, rail, message);
    return item;
  }));
  elements.timelineEmpty.hidden = state.timeline.length > 0;
}

function renderGlobalAlerts() {
  const alerts = [];
  state.teams.forEach(team => {
    const run = getActiveRun(team);
    if (!run) return;
    const due = getDueState(run);
    if (due.expectedEnd) alerts.push(`${team.name}: erwartete Einsatzzeit überschritten`);
    else if (due.twoThirds) alerts.push(`${team.name}: 2/3-Kontrolle fällig`);
    else if (due.oneThird) alerts.push(`${team.name}: 1/3-Kontrolle fällig`);
  });
  elements.alertStack.replaceChildren(...alerts.map(message => {
    const alert = document.createElement("div");
    alert.className = "global-alert";
    const text = document.createElement("span");
    text.textContent = message;
    const button = createButton("Anzeigen", "", () => setView("overview"));
    alert.append(text, button);
    return alert;
  }));
}

function applyIncidentLock() {
  const locked = isIncidentEnded();
  [elements.incidentNumber, elements.incidentKeyword, elements.incidentLocation]
    .forEach(input => { input.disabled = locked; });
  [...elements.teamForm.elements].forEach(control => { control.disabled = locked; });
}

function updateLiveValues() {
  elements.clock.textContent = formatTime(new Date());
  elements.incidentTimer.textContent = state.incident.startedAt
    ? formatDuration(state.incident.startedAt, state.incident.endedAt)
    : "00:00:00";
  elements.incidentTimeInfo.textContent = !state.incident.startedAt
    ? "Noch nicht gestartet"
    : state.incident.endedAt
      ? `Beendet ${formatDateTime(state.incident.endedAt)} · Gesamtdauer ${formatDuration(state.incident.startedAt, state.incident.endedAt)}`
      : `Gestartet ${formatDateTime(state.incident.startedAt)}`;

  document.querySelectorAll(".pa-elapsed").forEach(timer => {
    const team = findTeam(timer.dataset.teamId);
    const run = findRun(team, timer.dataset.runId);
    if (run && !run.endedAt) timer.textContent = formatDuration(run.startedAt);
  });
  document.querySelectorAll(".pa-next").forEach(label => {
    const team = findTeam(label.dataset.teamId);
    const run = findRun(team, label.dataset.runId);
    if (run && !run.endedAt) label.textContent = getNextCheckpointText(run);
  });
}

function updateTeamStatus(teamId, status) {
  const team = findTeam(teamId);
  if (!team || team.status === status || isIncidentEnded()) return;
  team.status = status;
  addTimeline(`${team.name}: Status „${status}“`, "team");
  saveState();
  renderAll();
}

function removeTeam(teamId) {
  const team = findTeam(teamId);
  if (!team || isIncidentEnded()) return;
  if (getActiveRun(team)) {
    showToast("Der Trupp kann während einer aktiven Atemschutzüberwachung nicht entfernt werden.", true);
    return;
  }
  if (!confirm(`${team.name} wirklich entfernen?`)) return;
  state.teams = state.teams.filter(item => item.id !== teamId);
  addTimeline(`${team.name} entfernt`, "team");
  saveState();
  renderAll();
}

function showDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function openPaStartDialog(teamId) {
  const team = findTeam(teamId);
  if (!team || getActiveRun(team) || isIncidentEnded()) return;
  elements.paStartForm.reset();
  elements.paStartForm.elements.teamId.value = team.id;
  elements.paStartForm.elements.pressureOne.value = 300;
  elements.paStartForm.elements.pressureTwo.value = 300;
  elements.paStartForm.elements.nominalPressure.value = 300;
  elements.paStartForm.elements.expectedMinutes.value = 30;
  elements.paStartForm.elements.deviceType.value = "Pressluftatmer";
  elements.paStartTitle.textContent = `${team.name} unter PA`;
  showDialog(elements.paStartDialog);
}

function openPressureDialog(teamId, runId, type) {
  const team = findTeam(teamId);
  const run = findRun(team, runId);
  if (!run || run.endedAt) return;
  const labels = {
    oneThird: "1/3-Kontrolle dokumentieren",
    twoThirds: "2/3-Kontrolle dokumentieren",
    interim: "Zwischenkontrolle dokumentieren"
  };
  const lastControl = run.controls[0];
  elements.pressureForm.reset();
  elements.pressureForm.elements.teamId.value = teamId;
  elements.pressureForm.elements.runId.value = runId;
  elements.pressureForm.elements.controlType.value = type;
  elements.pressureForm.elements.pressureOne.value = lastControl?.pressures?.[0] ?? "";
  elements.pressureForm.elements.pressureTwo.value = lastControl?.pressures?.[1] ?? "";
  elements.pressureTitle.textContent = labels[type];
  elements.pressureMemberOne.textContent = run.members[0]?.name || "Geräteträger 1";
  elements.pressureMemberTwo.textContent = run.members[1]?.name || "Geräteträger 2";
  showDialog(elements.pressureDialog);
}

function markTarget(teamId, runId) {
  const team = findTeam(teamId);
  const run = findRun(team, runId);
  if (!run || run.endedAt || run.targetReachedAt) return;
  run.targetReachedAt = new Date().toISOString();
  addTimeline(`${team.name}: Einsatzziel erreicht`, "pa");
  saveState();
  renderAll();
}

function markRetreat(teamId, runId) {
  const team = findTeam(teamId);
  const run = findRun(team, runId);
  if (!run || run.endedAt || run.retreatStartedAt) return;
  run.retreatStartedAt = new Date().toISOString();
  team.status = "Rückmeldung";
  addTimeline(`${team.name}: Rückzug begonnen`, "pa");
  saveState();
  renderAll();
}

function endPaRun(teamId, runId) {
  const team = findTeam(teamId);
  const run = findRun(team, runId);
  if (!run || run.endedAt) return;
  if (!confirm(`Atemschutzeinsatz von ${team.name} wirklich beenden?`)) return;
  run.endedAt = new Date().toISOString();
  team.status = "Rückmeldung";
  addTimeline(`${team.name}: Atemschutzeinsatz beendet · Dauer ${formatDuration(run.startedAt, run.endedAt)}`, "pa", run.endedAt);
  saveState();
  renderAll();
  showToast("Atemschutzeinsatz beendet und dokumentiert.");
}

function activateAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function playWarning() {
  navigator.vibrate?.([300, 150, 300, 150, 500]);
  if (!audioContext) return;
  [0, .34, .68].forEach(offset => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(.14, audioContext.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + offset + .2);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + offset);
    oscillator.stop(audioContext.currentTime + offset + .22);
  });
}

function processPaNotifications() {
  let changed = false;
  let warn = false;
  const now = Date.now();
  state.teams.forEach(team => {
    const run = getActiveRun(team);
    if (!run) return;
    const timing = getTiming(run);
    const checkpoints = [
      ["oneThird", timing.oneThird, "1/3-Kontrolle fällig · Behälterdrücke beachten"],
      ["twoThirds", timing.twoThirds, "2/3-Kontrolle fällig · Behälterdrücke und Rückweg beurteilen"],
      ["expectedEnd", timing.expectedEnd, "erwartete Einsatzzeit erreicht"]
    ];
    checkpoints.forEach(([key, dueAt, message]) => {
      if (now >= dueAt && !run.notifications[key]) {
        run.notifications[key] = new Date().toISOString();
        addTimeline(`${team.name}: ${message}`, "warning");
        changed = true;
        warn = true;
      }
    });
  });
  if (changed) {
    saveState();
    renderAll();
  }
  if (warn) playWarning();
}

function showToast(message, error = false) {
  const toast = document.createElement("div");
  toast.className = `toast${error ? " error" : ""}`;
  toast.textContent = message;
  elements.toastRegion.append(toast);
  setTimeout(() => toast.remove(), 3500);
}

function updateNetworkState() {
  elements.network.textContent = navigator.onLine ? "Online" : "Offline bereit";
  elements.network.classList.toggle("offline", !navigator.onLine);
}

function buildTextReport() {
  const lines = [];
  const separator = "=".repeat(74);
  const sub = "-".repeat(74);
  const safe = value => String(value || "").trim() || "–";
  lines.push("EINSATZ-LAGEBOARD V2 · EINSATZBERICHT", separator);
  lines.push(`Exportiert:       ${formatDateTime(new Date())}`);
  lines.push(`Einsatznummer:    ${safe(state.incident.number)}`);
  lines.push(`Stichwort:        ${safe(state.incident.keyword)}`);
  lines.push(`Einsatzstelle:    ${safe(state.incident.location)}`);
  lines.push(`Einsatzbeginn:    ${formatDateTime(state.incident.startedAt)}`);
  lines.push(`Einsatzende:      ${formatDateTime(state.incident.endedAt)}`);
  lines.push(`Einsatzdauer:     ${state.incident.startedAt ? formatDuration(state.incident.startedAt, state.incident.endedAt) : "–"}${state.incident.startedAt && !state.incident.endedAt ? " · läuft noch" : ""}`, "");

  lines.push("TRUPPS UND AUFTRÄGE", separator);
  if (!state.teams.length) lines.push("Keine Trupps erfasst.");
  state.teams.forEach(team => {
    lines.push(`${team.name} · Status: ${team.status}`);
    lines.push(`Auftrag: ${team.assignment.code === "CUSTOM" ? "Freier Auftrag" : team.assignment.code} · ${team.assignment.label}`);
    if (team.assignment.areaLabel) lines.push(`Bereich: ${team.assignment.areaLabel}`);
    if (!team.paRuns.length) lines.push("Kein Atemschutzeinsatz dokumentiert.");
    team.paRuns.forEach((run, index) => {
      const timing = getTiming(run);
      lines.push(`PA-Einsatz ${index + 1}:`);
      lines.push(`  Geräteart:                ${run.deviceType}`);
      lines.push(`  Nennfülldruck:            ${run.nominalPressure} bar`);
      run.members.forEach((member, memberIndex) => {
        lines.push(`  Geräteträger ${memberIndex + 1}:           ${safe(member.name)} · Startdruck ${member.startPressure ?? "–"} bar`);
      });
      lines.push(`  Luft angeschlossen:       ${formatDateTime(run.startedAt)}`);
      lines.push(`  Erwartete Einsatzzeit:    ${run.expectedMinutes} Minuten`);
      lines.push(`  Geplante 1/3-Kontrolle:   ${formatTime(timing.oneThird)}`);
      lines.push(`  Geplante 2/3-Kontrolle:   ${formatTime(timing.twoThirds)}`);
      [...run.controls].reverse().forEach(control => {
        const labels = { oneThird: "1/3-Kontrolle", twoThirds: "2/3-Kontrolle", interim: "Zwischenkontrolle" };
        lines.push(`  ${labels[control.type] || "Kontrolle"}: ${formatTime(control.at)} · ${control.pressures[0]} / ${control.pressures[1]} bar${control.note ? ` · ${control.note}` : ""}`);
      });
      lines.push(`  Einsatzziel erreicht:     ${formatDateTime(run.targetReachedAt)}`);
      lines.push(`  Rückzug begonnen:         ${formatDateTime(run.retreatStartedAt)}`);
      lines.push(`  Atemschutz beendet:       ${formatDateTime(run.endedAt)}`);
      lines.push(`  Atemschutzeinsatzzeit:    ${formatDuration(run.startedAt, run.endedAt)}${run.endedAt ? "" : " · läuft noch"}`);
    });
    lines.push(sub);
  });

  lines.push("EINSATZCHRONIK", separator);
  if (!state.timeline.length) lines.push("Keine Einträge.");
  [...state.timeline].reverse().forEach(entry => {
    lines.push(`${formatDateTime(entry.at)}  ${entry.message}`);
  });
  lines.push("", separator);
  lines.push("Hinweis: Die Zeitüberwachung unterstützt die Atemschutzüberwachung. Behälterdruck, Luftverbrauch, Rückweg und Einsatzlage sind unabhängig davon fortlaufend zu beurteilen.");
  return lines.join("\r\n");
}

elements.navButtons.forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll("[data-go-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.goView)));

[elements.incidentNumber, elements.incidentKeyword, elements.incidentLocation].forEach((input, index) => {
  const keys = ["number", "keyword", "location"];
  input.addEventListener("input", () => {
    state.incident[keys[index]] = input.value;
    saveState();
    if (keys[index] === "keyword") elements.incidentTitle.textContent = input.value || (state.incident.startedAt ? "Laufender Einsatz" : "Einsatz vorbereiten");
  });
});

elements.incidentAction.addEventListener("click", async () => {
  if (!state.incident.startedAt) {
    state.incident.startedAt = new Date().toISOString();
    addTimeline(`Einsatz gestartet${state.incident.keyword ? ` · ${state.incident.keyword}` : ""}`, "incident", state.incident.startedAt);
    navigator.storage?.persist?.();
    showToast("Einsatz gestartet. Die Daten werden lokal gespeichert.");
  } else if (!state.incident.endedAt) {
    const activeTeams = state.teams.filter(team => getActiveRun(team));
    if (activeTeams.length) {
      showToast(`Einsatz kann nicht beendet werden. Unter PA aktiv: ${activeTeams.map(team => team.name).join(", ")}.`, true);
      return;
    }
    if (!confirm("Einsatz wirklich beenden? Die Gesamtdauer wird jetzt gestoppt.")) return;
    state.incident.endedAt = new Date().toISOString();
    addTimeline(`Einsatz beendet · Gesamtdauer ${formatDuration(state.incident.startedAt, state.incident.endedAt)}`, "incident", state.incident.endedAt);
    showToast("Einsatz beendet und vollständig dokumentiert.");
  }
  saveState();
  renderAll();
});

elements.taskCode.addEventListener("change", syncAssignmentForm);
elements.rescueArea.addEventListener("change", syncAssignmentForm);
elements.teamForm.addEventListener("reset", () => setTimeout(syncAssignmentForm));
elements.teamForm.addEventListener("submit", event => {
  event.preventDefault();
  if (isIncidentEnded()) return;
  const data = new FormData(elements.teamForm);
  const name = String(data.get("teamName") || "").trim();
  const assignment = buildAssignment(data);
  if (!name || !assignment) {
    showToast("Bitte Trupp und Auftrag vollständig angeben.", true);
    return;
  }
  state.teams.push({
    id: makeId(),
    name,
    assignment,
    status: "Bereit",
    createdAt: new Date().toISOString(),
    paRuns: []
  });
  addTimeline(`${name} erfasst · Auftrag: ${assignment.display}`, "team");
  saveState();
  elements.teamForm.reset();
  syncAssignmentForm();
  renderAll();
  showToast(`${name} wurde hinzugefügt.`);
});

elements.teamFilter.addEventListener("change", renderTeams);

elements.paStartForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(elements.paStartForm);
  const team = findTeam(String(data.get("teamId")));
  if (!team || getActiveRun(team) || isIncidentEnded()) return;
  const nominalPressure = Number(data.get("nominalPressure"));
  const pressures = [Number(data.get("pressureOne")), Number(data.get("pressureTwo"))];
  if (pressures.some(pressure => pressure < nominalPressure * .9)) {
    showToast("Mindestens ein Startdruck liegt unter 90 % des Nennfülldrucks. Das Gerät ist nach FwDV 7 grundsätzlich nicht einsatzbereit.", true);
    return;
  }
  const run = {
    id: makeId(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    expectedMinutes: Number(data.get("expectedMinutes")),
    deviceType: String(data.get("deviceType") || "").trim(),
    nominalPressure,
    members: [
      { name: String(data.get("memberOne") || "").trim(), startPressure: pressures[0] },
      { name: String(data.get("memberTwo") || "").trim(), startPressure: pressures[1] }
    ],
    controls: [],
    targetReachedAt: null,
    retreatStartedAt: null,
    notifications: {}
  };
  team.paRuns.push(run);
  team.status = "Im Einsatz";
  addTimeline(`${team.name}: Luft angeschlossen · PA-Überwachung gestartet · erwartete Einsatzzeit ${run.expectedMinutes} Minuten`, "pa", run.startedAt);
  activateAudio();
  saveState();
  closeDialog(elements.paStartDialog);
  setView("overview");
  renderAll();
  showToast("Atemschutzüberwachung gestartet.");
});

elements.pressureForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(elements.pressureForm);
  const team = findTeam(String(data.get("teamId")));
  const run = findRun(team, String(data.get("runId")));
  if (!run || run.endedAt) return;
  const control = {
    id: makeId(),
    type: String(data.get("controlType")),
    at: new Date().toISOString(),
    pressures: [Number(data.get("pressureOne")), Number(data.get("pressureTwo"))],
    note: String(data.get("note") || "").trim()
  };
  run.controls.unshift(control);
  const labels = { oneThird: "1/3-Kontrolle", twoThirds: "2/3-Kontrolle", interim: "Zwischenkontrolle" };
  addTimeline(`${team.name}: ${labels[control.type]} · ${control.pressures[0]} / ${control.pressures[1]} bar${control.note ? ` · ${control.note}` : ""}`, "pa", control.at);
  saveState();
  closeDialog(elements.pressureDialog);
  renderAll();
  showToast("Behälterdruckkontrolle gespeichert.");
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => closeDialog(document.querySelector(`#${button.dataset.closeDialog}`)));
});

elements.noteForm.addEventListener("submit", event => {
  event.preventDefault();
  const note = String(new FormData(elements.noteForm).get("note") || "").trim();
  if (!note) return;
  addTimeline(note, "manual");
  saveState();
  elements.noteForm.reset();
  renderAll();
});

elements.exportTxt.addEventListener("click", () => {
  const blob = new Blob(["\ufeff", buildTextReport()], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  const number = state.incident.number.trim().replace(/[^a-z0-9_-]+/gi, "-") || "einsatz";
  link.href = URL.createObjectURL(blob);
  link.download = `${number}-einsatzbericht-v2.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

elements.resetIncident.addEventListener("click", () => {
  const activeTeams = state.teams.filter(team => getActiveRun(team));
  if (activeTeams.length) {
    showToast("Daten können während einer aktiven Atemschutzüberwachung nicht gelöscht werden.", true);
    return;
  }
  if (!confirm("Wirklich alle lokalen Einsatzdaten löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
  state = createInitialState();
  saveState();
  elements.teamFilter.value = "all";
  setView("overview");
  renderAll();
  showToast("Alle Einsatzdaten wurden gelöscht.");
});

window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js?v=2.0.0").then(registration => registration.update()).catch(() => {
      showToast("Offline-Modus konnte nicht aktiviert werden.", true);
    });
  });
}

syncAssignmentForm();
updateNetworkState();
renderAll();
processPaNotifications();
setInterval(() => {
  updateLiveValues();
  processPaNotifications();
}, 1000);
