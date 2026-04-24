// ── State ────────────────────────────────────────────────────────────────────
const state = {
  plans: [],
  questions: [],
  profile: {},
  openPlanId: null,    // which plan has view expanded
  viewDay: {},         // planId → active day tab in view mode
  editPlan: null,      // {id, plan: {...}} currently in edit modal
  editDay: "Mon",
  wizardStep: 0,
  wizardAnswers: {},
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(path, opts);
    return res.json();
  } catch (err) {
    console.error("API error:", method, path, err);
    return { error: String(err) };
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (type ? " " + type : "");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3000);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === tab + "-tab"));
  });
});

// ── Render Plans List ─────────────────────────────────────────────────────────
function renderPlans() {
  const container = document.getElementById("plans-list");
  if (!state.plans.length) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No saved plans yet. Use New Plan to generate one.</p>';
    return;
  }
  container.innerHTML = state.plans.map(p => planCardHTML(p)).join("");
  state.plans.forEach(p => bindPlanCard(p));
}

function planCardHTML(p) {
  const isCurrent = p.is_current;
  const badge = isCurrent ? '<span class="current-badge">Current</span>' : "";
  const dateStr = new Date(p.week_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const meta = `${p.gym_days} gym days · ${esc((p.goal || "").replace(/_/g, " "))} · ${p.daily_calorie_target} kcal · ${p.protein_target_g}g protein`;
  const restoreBtn = !isCurrent ? `<button class="btn btn-restore" data-action="restore" data-id="${p.id}">Restore</button>` : "";
  const deleteBtn = !isCurrent ? `<button class="btn btn-delete" data-action="delete" data-id="${p.id}">Delete</button>` : "";
  return `
    <div class="plan-card${isCurrent ? " current" : ""}" id="card-${p.id}">
      <div class="plan-card-header">
        <div>
          <div class="plan-title">Week of ${dateStr}${badge}</div>
          <div class="plan-meta">${meta}</div>
        </div>
        <div class="plan-actions">
          <button class="btn btn-view" data-action="view" data-id="${p.id}">View ▾</button>
          <button class="btn btn-edit" data-action="edit" data-id="${p.id}">Edit</button>
          ${restoreBtn}
          ${deleteBtn}
        </div>
      </div>
      <div class="plan-view" id="view-${p.id}"></div>
    </div>`;
}

function bindPlanCard(p) {
  const card = document.getElementById(`card-${p.id}`);
  if (!card) return;
  card.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (action === "view") toggleView(p.id);
      if (action === "edit") openEdit(p.id);
      if (action === "restore") await restorePlan(p.id);
      if (action === "delete") await deletePlan(p.id);
    });
  });
}

// ── View Mode ─────────────────────────────────────────────────────────────────
async function toggleView(planId) {
  const viewEl = document.getElementById(`view-${planId}`);
  const btn = document.querySelector(`[data-action="view"][data-id="${planId}"]`);
  if (state.openPlanId === planId) {
    viewEl.classList.remove("open");
    btn.textContent = "View ▾";
    state.openPlanId = null;
    return;
  }
  // close previously open
  if (state.openPlanId) {
    document.getElementById(`view-${state.openPlanId}`).classList.remove("open");
    const prev = document.querySelector(`[data-action="view"][data-id="${state.openPlanId}"]`);
    if (prev) prev.textContent = "View ▾";
  }
  state.openPlanId = planId;
  btn.textContent = "Hide ▴";
  const planMeta = state.plans.find(p => p.id === planId);
  const full = await api("GET", `/api/plans/${planId}`);
  if (state.openPlanId !== planId) return;
  if (!state.viewDay[planId]) state.viewDay[planId] = "Mon";
  viewEl.innerHTML = buildViewHTML(planMeta, full, state.viewDay[planId]);
  viewEl.classList.add("open");
  bindDayTabs(viewEl, planId, full, planMeta);
}

function bindDayTabs(viewEl, planId, full, planMeta) {
  viewEl.querySelectorAll(".day-tab").forEach(t => {
    t.addEventListener("click", () => {
      state.viewDay[planId] = t.dataset.day;
      viewEl.innerHTML = buildViewHTML(planMeta, full, t.dataset.day);
      bindDayTabs(viewEl, planId, full, planMeta);
    });
  });
}

function buildViewHTML(planMeta, full, activeDay) {
  const tabs = DAYS.map(d =>
    `<button class="day-tab${d === activeDay ? " active" : ""}" data-day="${d}">${d}</button>`
  ).join("");
  const dayData = full.plan[activeDay] || {};
  return `
    <div class="stats-bar">
      <div class="stat-box"><div class="stat-val">${planMeta.daily_calorie_target}</div><div class="stat-lbl">Daily kcal target</div></div>
      <div class="stat-box"><div class="stat-val">${planMeta.protein_target_g}g</div><div class="stat-lbl">Protein target</div></div>
      <div class="stat-box"><div class="stat-val">${planMeta.gym_days}/7</div><div class="stat-lbl">Gym days</div></div>
      <div class="stat-box"><div class="stat-val">${planMeta.meal_prep_day || "–"}</div><div class="stat-lbl">Meal prep day</div></div>
    </div>
    <div class="day-tabs-row">${tabs}</div>
    ${buildDayViewHTML(dayData, planMeta)}`;
}

function buildDayViewHTML(day, planMeta) {
  if (!day.type) return "<p style='color:#9ca3af;font-size:13px;'>No data for this day.</p>";
  const calLogged = Object.values(day.meals || {}).reduce((s) => {
    return s + Math.round(planMeta.daily_calorie_target / 4);
  }, 0);
  const protLogged = Object.values(day.meals || {}).reduce((s) => s + Math.round(planMeta.protein_target_g / 4), 0);
  const calPct = Math.min(100, Math.round((calLogged / planMeta.daily_calorie_target) * 100));
  const protPct = Math.min(100, Math.round((protLogged / planMeta.protein_target_g) * 100));

  let activityHTML = "";
  if (day.type === "gym") {
    activityHTML = `
      <div class="section-label">💪 Workout</div>
      ${(day.exercises || []).map(e =>
        `<div class="exercise-row"><span>${esc(e.name)}</span><span class="exercise-sets">${esc(String(e.sets))} sets × ${esc(e.reps)}</span></div>`
      ).join("")}`;
  } else if (day.type === "rest") {
    activityHTML = `
      <div class="section-label">🧘 Rest Activity</div>
      <div style="font-size:14px;padding:4px 0;">${esc(day.activity || "–")}</div>`;
  } else if (day.type === "meal_prep") {
    activityHTML = `
      <div class="section-label">📦 Meal Prep Tasks</div>
      ${(day.prep_tasks || []).map(t => `<div class="prep-task">${esc(t)}</div>`).join("")}`;
  }

  const mealMacros = { breakfast: "450kcal · 30g", lunch: "520kcal · 45g", dinner: "480kcal · 40g", snack: "180kcal · 15g" };
  const mealsHTML = ["breakfast", "lunch", "dinner", "snack"].map(type => {
    const name = esc((day.meals || {})[type] || "–");
    return `<div class="meal-row">
      <span class="meal-type-lbl">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <span style="flex:1">${name}</span>
      <span class="meal-macros">${mealMacros[type]}</span>
    </div>`;
  }).join("");

  return `
    <div class="progress-row">
      <div class="progress-label"><span>Calories: ${calLogged} / ${planMeta.daily_calorie_target} kcal</span><span class="progress-pct">${calPct}%</span></div>
      <div class="progress-track"><div class="progress-fill cal" style="width:${calPct}%"></div></div>
    </div>
    <div class="progress-row">
      <div class="progress-label"><span>Protein: ${protLogged}g / ${planMeta.protein_target_g}g</span><span class="progress-pct">${protPct}%</span></div>
      <div class="progress-track"><div class="progress-fill prot" style="width:${protPct}%"></div></div>
    </div>
    ${activityHTML}
    <div class="section-label">🍽️ Meals</div>
    ${mealsHTML}`;
}

// ── Restore / Delete ──────────────────────────────────────────────────────────
async function restorePlan(planId) {
  const res = await api("POST", `/api/plans/${planId}/restore`, {});
  if (res.ok) {
    toast("Plan restored as current week!", "success");
    await refreshPlans();
  } else {
    toast("Restore failed");
  }
}

async function deletePlan(planId) {
  const res = await api("DELETE", `/api/plans/${planId}`);
  if (res.ok) {
    toast("Plan deleted");
    await refreshPlans();
  } else {
    toast("Delete failed");
  }
}

async function refreshPlans() {
  state.plans = await api("GET", "/api/plans");
  state.openPlanId = null;
  renderPlans();
}

// ── Placeholders for Task 7 (to be filled in next task) ──────────────────────
function renderWizard() {}

// ── Edit Modal ────────────────────────────────────────────────────────────────
async function openEdit(planId) {
  const full = await api("GET", `/api/plans/${planId}`);
  if (full.error) { toast("Could not load plan"); return; }
  state.editPlan = { id: planId, plan: JSON.parse(JSON.stringify(full.plan)) };
  state.editDay = "Mon";
  renderModal();
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  state.editPlan = null;
}

function renderModal() {
  if (!state.editPlan) return;
  const tabs = DAYS.map(d =>
    `<button class="day-tab${d === state.editDay ? " active" : ""}" data-day="${d}">${d}</button>`
  ).join("");
  document.getElementById("modal-day-tabs").innerHTML = tabs;
  document.getElementById("modal-day-tabs").querySelectorAll(".day-tab").forEach(t => {
    t.addEventListener("click", () => {
      collectEditDay();
      state.editDay = t.dataset.day;
      renderModal();
    });
  });
  document.getElementById("modal-body").innerHTML = buildEditDayHTML(
    state.editPlan.plan[state.editDay] || {}
  );
  bindEditBody();
}

function buildEditDayHTML(day) {
  const planMeta = state.plans.find(p => p.id === state.editPlan.id) || {};
  const kcal = planMeta.daily_calorie_target || 2000;
  const prot = planMeta.protein_target_g || 150;

  let activityHTML = "";
  if (day.type === "gym") {
    const exRows = (day.exercises || []).map((e, i) => `
      <div class="field-row" data-ex="${i}">
        <input class="input input-name ex-name" value="${esc(e.name)}" placeholder="Exercise name">
        <input class="input input-num ex-sets" value="${esc(String(e.sets))}" placeholder="Sets">
        <input class="input input-num ex-reps" value="${esc(e.reps)}" placeholder="Reps">
        <button class="del-btn" data-del-ex="${i}">×</button>
      </div>`).join("");
    activityHTML = `
      <div class="field-group">
        <div class="section-label">💪 Exercises</div>
        <div id="ex-list">${exRows}</div>
        <button class="btn btn-add" id="add-ex-btn">+ Add Exercise</button>
      </div>`;
  } else if (day.type === "rest") {
    activityHTML = `
      <div class="field-group">
        <div class="section-label">🧘 Rest Activity</div>
        <input class="input input-wide" id="rest-activity" value="${esc(day.activity || "")}">
      </div>`;
  } else if (day.type === "meal_prep") {
    const taskRows = (day.prep_tasks || []).map((t, i) => `
      <div class="field-row" data-task="${i}">
        <input class="input input-name task-text" value="${esc(t)}">
        <button class="del-btn" data-del-task="${i}">×</button>
      </div>`).join("");
    activityHTML = `
      <div class="field-group">
        <div class="section-label">📦 Meal Prep Tasks</div>
        <div id="task-list">${taskRows}</div>
        <button class="btn btn-add" id="add-task-btn">+ Add Task</button>
      </div>`;
  }

  const meals = day.meals || {};
  const mealRows = ["breakfast", "lunch", "dinner", "snack"].map(type => `
    <div class="field-row">
      <span class="meal-type-lbl" style="width:75px;flex-shrink:0;font-size:11px;color:#9ca3af;">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <input class="input input-name meal-name" data-meal="${type}" value="${esc(meals[type] || "")}">
    </div>`).join("");

  return `
    <div class="field-group">
      <div class="section-label">📊 Daily Targets</div>
      <div class="targets-row">
        <div>
          <div class="field-label">Calories (kcal)</div>
          <input class="input input-wide" id="edit-kcal" value="${kcal}">
        </div>
        <div>
          <div class="field-label">Protein (g)</div>
          <input class="input input-wide" id="edit-prot" value="${prot}">
        </div>
      </div>
    </div>
    ${activityHTML}
    <div class="field-group">
      <div class="section-label">🍽️ Meals</div>
      ${mealRows}
    </div>`;
}

function bindEditBody() {
  const day = state.editPlan.plan[state.editDay];

  const addExBtn = document.getElementById("add-ex-btn");
  if (addExBtn) {
    addExBtn.addEventListener("click", () => {
      collectEditDay();
      const d = state.editPlan.plan[state.editDay];
      d.exercises.push({ name: "", sets: 3, reps: "10-12" });
      renderModal();
    });
  }

  document.querySelectorAll("[data-del-ex]").forEach(btn => {
    btn.addEventListener("click", () => {
      collectEditDay();
      const i = parseInt(btn.dataset.delEx);
      state.editPlan.plan[state.editDay].exercises.splice(i, 1);
      renderModal();
    });
  });

  const addTaskBtn = document.getElementById("add-task-btn");
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", () => {
      collectEditDay();
      state.editPlan.plan[state.editDay].prep_tasks.push("");
      renderModal();
    });
  }

  document.querySelectorAll("[data-del-task]").forEach(btn => {
    btn.addEventListener("click", () => {
      collectEditDay();
      const i = parseInt(btn.dataset.delTask);
      state.editPlan.plan[state.editDay].prep_tasks.splice(i, 1);
      renderModal();
    });
  });
}

function collectEditDay() {
  const day = state.editPlan.plan[state.editDay];
  if (!day) return;

  document.querySelectorAll(".meal-name").forEach(input => {
    day.meals[input.dataset.meal] = input.value;
  });

  if (day.type === "gym") {
    document.querySelectorAll("[data-ex]").forEach(row => {
      const i = parseInt(row.dataset.ex);
      if (day.exercises[i]) {
        day.exercises[i].name = row.querySelector(".ex-name").value;
        day.exercises[i].sets = parseInt(row.querySelector(".ex-sets").value) || 3;
        day.exercises[i].reps = row.querySelector(".ex-reps").value;
      }
    });
  }

  const restInput = document.getElementById("rest-activity");
  if (restInput) day.activity = restInput.value;

  if (day.type === "meal_prep") {
    document.querySelectorAll(".task-text").forEach((input, i) => {
      if (day.prep_tasks[i] !== undefined) day.prep_tasks[i] = input.value;
    });
  }
}

async function saveEdit() {
  collectEditDay();
  const res = await api("PUT", `/api/plans/${state.editPlan.id}`, { plan: state.editPlan.plan });
  if (res.ok) {
    toast("Changes saved!", "success");
    const savedId = state.editPlan.id;
    closeModal();
    await refreshPlans();
    if (state.openPlanId === savedId) {
      await toggleView(savedId);
    }
  } else {
    toast("Save failed: " + (res.error || "unknown error"));
  }
}

// Modal button listeners
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
document.getElementById("modal-save").addEventListener("click", saveEdit);
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  [state.plans, state.questions, state.profile] = await Promise.all([
    api("GET", "/api/plans"),
    api("GET", "/api/questions"),
    api("GET", "/api/profile"),
  ]);
  renderPlans();
  renderWizard();
}

init();
