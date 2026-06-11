const STORAGE_KEY = "exchangeTrackerData.v1";

const defaultGoals = {
  starch: 6,
  protein: 6,
  fat: 4,
  dairy: 3,
  fruit: 2,
  veg: 2
};

const categories = [
  { key: "starch", label: "Starch" },
  { key: "protein", label: "Protein" },
  { key: "fat", label: "Fat" },
  { key: "dairy", label: "Dairy" },
  { key: "fruit", label: "Fruit" },
  { key: "veg", label: "Veg" }
];

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function niceDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function blankDay() {
  return {
    starch: 0,
    protein: 0,
    fat: 0,
    dairy: 0,
    fruit: 0,
    veg: 0,
    drinks: 0,
    weight: "",
    notes: ""
  };
}

function loadState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (state && state.days && state.goals) return state;
  } catch (e) {}
  return { goals: { ...defaultGoals }, days: {} };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureToday(state) {
  const today = localDateKey();
  if (!state.days[today]) state.days[today] = blankDay();
  return state.days[today];
}

function getToday() {
  const state = loadState();
  const day = ensureToday(state);
  saveState(state);
  return { state, day, todayKey: localDateKey() };
}

function formatNumber(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function changeCategory(key, amount) {
  const { state, day } = getToday();
  day[key] = Math.max(0, Number(day[key] || 0) + amount);
  saveState(state);
  render();
}

function changeDrinks(amount) {
  const { state, day } = getToday();
  day.drinks = Math.max(0, Number(day.drinks || 0) + amount);
  saveState(state);
  render();
}

function saveDetails() {
  const { state, day } = getToday();
  day.weight = document.getElementById("weightInput").value;
  day.notes = document.getElementById("notesInput").value;
  saveState(state);
}

function renderTracker() {
  const { state, day } = getToday();
  const rows = document.getElementById("trackerRows");

  rows.innerHTML = "";

  for (const cat of categories) {
    const row = document.createElement("div");
    row.className = "tracker-row";
    row.innerHTML = `
      <div>
        <div class="cat-name">${cat.label}</div>
        <div class="cat-value">${formatNumber(day[cat.key])} / ${formatNumber(state.goals[cat.key])}</div>
      </div>
      <div class="controls">
        <button aria-label="decrease ${cat.label}">−</button>
        <button aria-label="increase ${cat.label}">+</button>
      </div>
    `;
    row.querySelectorAll("button")[0].addEventListener("click", () => changeCategory(cat.key, -1));
    row.querySelectorAll("button")[1].addEventListener("click", () => changeCategory(cat.key, 1));
    rows.appendChild(row);
  }

  const drinkRow = document.createElement("div");
  drinkRow.className = "tracker-row";
  drinkRow.innerHTML = `
    <div>
      <div class="cat-name">Drinks</div>
      <div class="cat-value">${formatNumber(day.drinks)} / 0</div>
    </div>
    <div class="controls">
      <button aria-label="decrease drinks">−</button>
      <button aria-label="increase drinks">+</button>
    </div>
  `;
  drinkRow.querySelectorAll("button")[0].addEventListener("click", () => changeDrinks(-1));
  drinkRow.querySelectorAll("button")[1].addEventListener("click", () => changeDrinks(1));
  rows.appendChild(drinkRow);

  document.getElementById("weightInput").value = day.weight || "";
  document.getElementById("notesInput").value = day.notes || "";
}

function renderHistory() {
  const state = loadState();
  const history = document.getElementById("historyList");
  const keys = Object.keys(state.days).sort().reverse();

  if (!keys.length) {
    history.innerHTML = "<p>No history yet.</p>";
    return;
  }

  history.innerHTML = keys.map(k => {
    const d = state.days[k];
    const exchanges = categories
      .map(c => `${c.label} ${formatNumber(d[c.key])}`)
      .join(", ");

    const note = d.notes ? `<br>Notes: ${escapeHtml(d.notes)}` : "";

    return `
      <div class="history-day">
        <div class="history-date">${niceDate(k)}</div>
        <div class="history-details">
          ${exchanges}<br>
          Drinks ${formatNumber(d.drinks)}, Weight ${d.weight || "-"}${note}
        </div>
      </div>
    `;
  }).join("");
}

function renderGoals() {
  const state = loadState();
  const goalInputs = document.getElementById("goalInputs");
  goalInputs.innerHTML = "";

  for (const cat of categories) {
    const row = document.createElement("div");
    row.className = "goal-row";
    row.innerHTML = `
      <label for="goal-${cat.key}">${cat.label}</label>
      <input id="goal-${cat.key}" type="number" step="1" min="0" value="${state.goals[cat.key]}" />
    `;
    goalInputs.appendChild(row);
  }
}

function saveGoals() {
  const state = loadState();
  for (const cat of categories) {
    const input = document.getElementById(`goal-${cat.key}`);
    state.goals[cat.key] = Number(input.value || 0);
  }
  saveState(state);
  render();
}

function showPanel(name) {
  document.getElementById("historyPanel").classList.toggle("hidden", name !== "history");
  document.getElementById("settingsPanel").classList.toggle("hidden", name !== "settings");
  if (name === "history") renderHistory();
  if (name === "settings") renderGoals();
}

function exportData() {
  const state = loadState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `exchange-tracker-backup-${localDateKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.days || !imported.goals) throw new Error("Bad file");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      render();
      alert("Imported.");
    } catch (e) {
      alert("That file did not look like tracker data.");
    }
  };
  reader.readAsText(file);
}

function resetToday() {
  if (!confirm("Reset today's entry?")) return;
  const state = loadState();
  state.days[localDateKey()] = blankDay();
  saveState(state);
  render();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

function render() {
  document.getElementById("dateLabel").textContent = niceDate(localDateKey());
  renderTracker();
  renderHistory();
}

document.getElementById("saveDetailsBtn").addEventListener("click", saveDetails);
document.getElementById("historyBtn").addEventListener("click", () => showPanel("history"));
document.getElementById("settingsBtn").addEventListener("click", () => showPanel("settings"));
document.getElementById("todayBtn").addEventListener("click", () => showPanel("today"));
document.getElementById("saveGoalsBtn").addEventListener("click", saveGoals);
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("importInput").addEventListener("change", e => {
  if (e.target.files[0]) importData(e.target.files[0]);
});
document.getElementById("resetTodayBtn").addEventListener("click", resetToday);

render();
