const STORAGE_KEY = "einsatz-lageboard-v1";

const emptyState = () => ({
  incident: { number: "", keyword: "", location: "", startedAt: null },
  teams: [],
  log: []
});

let state = loadState();

const elements = {
  number: document.querySelector("#incident-number"),
  keyword: document.querySelector("#incident-keyword"),
  location: document.querySelector("#incident-location"),
  start: document.querySelector("#start-incident"),
  runtime: document.querySelector("#incident-runtime"),
  clock: document.querySelector("#clock"),
  connection: document.querySelector("#connection"),
  teamForm: document.querySelector("#team-form"),
  teamList: document.querySelector("#team-list"),
  teamEmpty: document.querySelector("#team-empty"),
  teamCount: document.querySelector("#team-count"),
  activeCount: document.querySelector("#active-count"),
  paCount: document.querySelector("#pa-count"),
  logForm: document.querySelector("#log-form"),
  logList: document.querySelector("#log-list"),
  logEmpty: document.querySelector("#log-empty"),
  export: document.querySelector("#export-data"),
  reset: document.querySelector("#reset-data")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved?.incident && Array.isArray(saved.teams) && Array.isArray(saved.log) ? saved : emptyState();
  } catch {
    return emptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function addLog(message, at = new Date().toISOString()) {
  state.log.unshift({ id: makeId(), at, message });
}

function formatTime(value) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(new Date(value));
}

function formatDuration(startedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map(value => String(value).padStart(2, "0")).join(":");
}

function createTeamCard(team) {
  const card = document.createElement("article");
  card.className = `team-card${team.status === "Im Einsatz" ? " active" : ""}${team.paStartedAt ? " pa" : ""}`;
  card.dataset.id = team.id;

  const info = document.createElement("div");
  const name = document.createElement("p");
  const task = document.createElement("p");
  name.className = "team-name";
  task.className = "team-task";
  name.textContent = team.name;
  task.textContent = team.task;
  info.append(name, task);

  const status = document.createElement("select");
  status.setAttribute("aria-label", `Status von ${team.name}`);
  ["Bereit", "Im Einsatz", "Rückmeldung", "Beendet"].forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = team.status === value;
    status.append(option);
  });
  status.addEventListener("change", () => updateTeamStatus(team.id, status.value));

  const meta = document.createElement("div");
  meta.className = "team-meta";
  const added = document.createElement("span");
  added.textContent = `Angelegt: ${formatTime(team.createdAt)}`;
  const paLabel = document.createElement("label");
  paLabel.className = "pa-control";
  const pa = document.createElement("input");
  pa.type = "checkbox";
  pa.checked = Boolean(team.paStartedAt);
  pa.addEventListener("change", () => togglePa(team.id, pa.checked));
  const paText = document.createElement("span");
  paText.textContent = team.paStartedAt ? `PA ${formatDuration(team.paStartedAt)}` : "unter PA";
  paLabel.append(pa, paText);
  meta.append(added, paLabel);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-button";
  remove.setAttribute("aria-label", `${team.name} entfernen`);
  remove.title = "Trupp entfernen";
  remove.textContent = "×";
  remove.addEventListener("click", () => removeTeam(team.id));

  card.append(info, status, meta, remove);
  return card;
}

function render() {
  elements.number.value = state.incident.number;
  elements.keyword.value = state.incident.keyword;
  elements.location.value = state.incident.location;
  elements.start.textContent = state.incident.startedAt ? "Einsatz läuft" : "Einsatz starten";
  elements.start.disabled = Boolean(state.incident.startedAt);

  elements.teamList.replaceChildren(...state.teams.map(createTeamCard));
  elements.teamEmpty.hidden = state.teams.length > 0;
  elements.teamCount.textContent = state.teams.length;
  elements.activeCount.textContent = state.teams.filter(team => team.status === "Im Einsatz").length;
  elements.paCount.textContent = state.teams.filter(team => team.paStartedAt).length;

  elements.logList.replaceChildren(...state.log.map(entry => {
    const item = document.createElement("li");
    const time = document.createElement("span");
    const message = document.createElement("span");
    time.className = "log-time";
    time.textContent = formatTime(entry.at);
    message.textContent = entry.message;
    item.append(time, message);
    return item;
  }));
  elements.logEmpty.hidden = state.log.length > 0;
  updateTimers();
}

function updateTimers() {
  elements.clock.textContent = formatTime(new Date());
  elements.runtime.textContent = state.incident.startedAt
    ? `Laufzeit ${formatDuration(state.incident.startedAt)}`
    : "Noch nicht gestartet";

  document.querySelectorAll(".team-card").forEach(card => {
    const team = state.teams.find(item => item.id === card.dataset.id);
    const label = card.querySelector(".pa-control span");
    if (team?.paStartedAt && label) label.textContent = `PA ${formatDuration(team.paStartedAt)}`;
  });
}

function updateTeamStatus(id, status) {
  const team = state.teams.find(item => item.id === id);
  if (!team || team.status === status) return;
  team.status = status;
  addLog(`${team.name}: Status „${status}“`);
  saveState();
  render();
}

function togglePa(id, enabled) {
  const team = state.teams.find(item => item.id === id);
  if (!team) return;
  team.paStartedAt = enabled ? new Date().toISOString() : null;
  addLog(`${team.name}: Atemschutz ${enabled ? "begonnen" : "beendet"}`);
  saveState();
  render();
}

function removeTeam(id) {
  const team = state.teams.find(item => item.id === id);
  if (!team || !confirm(`${team.name} wirklich entfernen?`)) return;
  state.teams = state.teams.filter(item => item.id !== id);
  addLog(`${team.name} entfernt`);
  saveState();
  render();
}

function updateConnection() {
  const online = navigator.onLine;
  elements.connection.textContent = online ? "Online" : "Offline bereit";
  elements.connection.classList.toggle("offline", !online);
}

[elements.number, elements.keyword, elements.location].forEach((input, index) => {
  const keys = ["number", "keyword", "location"];
  input.addEventListener("input", () => {
    state.incident[keys[index]] = input.value;
    saveState();
  });
});

elements.start.addEventListener("click", () => {
  if (state.incident.startedAt) return;
  state.incident.startedAt = new Date().toISOString();
  addLog(`Einsatz gestartet${state.incident.keyword ? ` · ${state.incident.keyword}` : ""}`, state.incident.startedAt);
  saveState();
  render();
});

elements.teamForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(elements.teamForm);
  const name = String(data.get("name") ?? "").trim();
  const task = String(data.get("task") ?? "").trim();
  if (!name || !task) return;
  state.teams.push({
    id: makeId(), name, task, status: "Bereit", paStartedAt: null, createdAt: new Date().toISOString()
  });
  addLog(`${name} angelegt · Auftrag: ${task}`);
  saveState();
  elements.teamForm.reset();
  render();
});

elements.logForm.addEventListener("submit", event => {
  event.preventDefault();
  const input = elements.logForm.elements.message;
  const message = input.value.trim();
  if (!message) return;
  addLog(message);
  saveState();
  elements.logForm.reset();
  render();
});

elements.export.addEventListener("click", () => {
  const exportData = { exportedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const number = state.incident.number.trim().replace(/[^a-z0-9_-]+/gi, "-") || "einsatz";
  link.href = URL.createObjectURL(blob);
  link.download = `${number}-lageboard.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

elements.reset.addEventListener("click", () => {
  if (!confirm("Alle lokalen Einsatzdaten löschen und einen neuen Einsatz anlegen?")) return;
  state = emptyState();
  saveState();
  render();
});

window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

render();
updateConnection();
setInterval(updateTimers, 1000);
