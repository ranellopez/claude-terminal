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
  chatMessages: [],    // [{role: "user"|"assistant", content: str}]
  chatReady: false,    // true when GymBot signals ready to generate
  chatLoading: false,  // true while waiting for API response
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
    if (tab === "new") renderWizard();
    if (tab === "chat") renderChat();
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

// ── Wizard ────────────────────────────────────────────────────────────────────
function renderWizard() {
  const el = document.getElementById("wizard");
  if (!el) return;

  // Pre-fill from existing profile on first open
  if (Object.keys(state.wizardAnswers).length === 0 && state.profile && state.profile.goal) {
    const p = state.profile;
    state.wizardAnswers = {
      goal: p.goal,
      gym_days: p.gym_days ? p.gym_days.split(",").map(d => d.trim()) : [],
      meal_prep_day: p.meal_prep_day || "",
      fitness_level: p.fitness_level || "",
      equipment: p.equipment ? p.equipment.split(",").map(e => e.trim()) : [],
      dietary_preference: p.dietary_preference || "none",
      allergies: p.allergies || "",
      daily_targets: { calories: p.daily_calorie_target, protein: p.protein_target_g },
    };
  }

  const total = state.questions.length;

  // Summary step after all questions answered
  if (state.wizardStep === total) {
    renderWizardSummary(el);
    return;
  }

  const q = state.questions[state.wizardStep];
  if (!q) return;

  const step = state.wizardStep + 1;
  const pct = Math.round((step / (total + 1)) * 100);
  const ans = state.wizardAnswers[q.key];

  let inputHTML = "";
  if (q.type === "single") {
    inputHTML = `<div class="choices">${(q.options || []).map(opt => {
      const sel = ans === opt.value ? " selected" : "";
      return `<button class="choice${sel}" data-key="${esc(q.key)}" data-val="${esc(opt.value)}">${esc(opt.label)}</button>`;
    }).join("")}</div>`;
  } else if (q.type === "multi") {
    const selected = Array.isArray(ans) ? ans : [];
    inputHTML = `<div class="choices">${(q.options || []).map(opt => {
      const sel = selected.includes(opt.value) ? " selected" : "";
      return `<button class="choice${sel}" data-key="${esc(q.key)}" data-val="${esc(opt.value)}" data-multi="1">${esc(opt.label)}</button>`;
    }).join("")}</div>`;
  } else if (q.type === "text") {
    const val = typeof ans === "string" ? ans : "";
    inputHTML = `<input class="input input-wide" id="wizard-text" value="${esc(val)}" placeholder="${esc(q.placeholder || "")}">`;
  } else if (q.type === "targets") {
    const goal = state.wizardAnswers.goal || "maintain";
    const level = state.wizardAnswers.fitness_level || "beginner";
    const [defCal, defProt] = estimateTargets(goal, level);
    const calVal = (ans && ans.calories) ? ans.calories : defCal;
    const protVal = (ans && ans.protein) ? ans.protein : defProt;
    inputHTML = `<div class="targets-row">
      <div><div class="field-label">Calories (kcal)</div><input class="input input-wide" id="wizard-cal" type="number" value="${calVal}"></div>
      <div><div class="field-label">Protein (g)</div><input class="input input-wide" id="wizard-prot" type="number" value="${protVal}"></div>
    </div>`;
  }

  const isLast = state.wizardStep === total - 1;
  el.innerHTML = `
    <div class="wizard-wrap">
      <div class="progress-header">
        <div class="progress-step-lbl">Question ${step} of ${total}</div>
        <div class="progress-track"><div class="progress-fill cal" style="width:${pct}%"></div></div>
      </div>
      <div class="wizard-card">
        <div class="wizard-q">${esc(q.question)}</div>
        <div class="wizard-why">${esc(q.why)}</div>
        ${inputHTML}
      </div>
      <div class="wizard-nav">
        ${state.wizardStep > 0 ? '<button class="btn btn-back" id="wiz-back">← Back</button>' : ''}
        <button class="btn btn-next" id="wiz-next">${isLast ? "Review →" : "Next →"}</button>
      </div>
    </div>`;

  el.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      if (btn.dataset.multi) {
        if (!Array.isArray(state.wizardAnswers[key])) state.wizardAnswers[key] = [];
        const idx = state.wizardAnswers[key].indexOf(val);
        if (idx >= 0) state.wizardAnswers[key].splice(idx, 1);
        else state.wizardAnswers[key].push(val);
      } else {
        state.wizardAnswers[key] = val;
      }
      renderWizard();
    });
  });

  document.getElementById("wiz-next").addEventListener("click", () => {
    if (q.type === "text") {
      state.wizardAnswers[q.key] = (document.getElementById("wizard-text").value.trim()) || "none";
    } else if (q.type === "targets") {
      state.wizardAnswers[q.key] = {
        calories: parseInt(document.getElementById("wizard-cal").value) || 2000,
        protein: parseInt(document.getElementById("wizard-prot").value) || 150,
      };
    }
    state.wizardStep++;
    renderWizard();
  });

  const backBtn = document.getElementById("wiz-back");
  if (backBtn) backBtn.addEventListener("click", () => { state.wizardStep--; renderWizard(); });
}

function renderWizardSummary(el) {
  const a = state.wizardAnswers;
  const gymDays = Array.isArray(a.gym_days) ? a.gym_days : [];
  const equipment = Array.isArray(a.equipment) ? a.equipment : [];
  const targets = a.daily_targets || {};
  const rows = [
    ["Goal", (a.goal || "—").replace(/_/g, " ")],
    ["Gym Days", gymDays.join(", ") || "—"],
    ["Meal Prep Day", a.meal_prep_day || "—"],
    ["Fitness Level", a.fitness_level || "—"],
    ["Equipment", equipment.join(", ") || "—"],
    ["Diet", a.dietary_preference || "—"],
    ["Allergies", a.allergies || "none"],
    ["Calories Target", targets.calories ? `${targets.calories} kcal` : "—"],
    ["Protein Target", targets.protein ? `${targets.protein}g` : "—"],
  ];
  el.innerHTML = `
    <div class="wizard-wrap">
      <div class="progress-header">
        <div class="progress-step-lbl">Review your answers</div>
        <div class="progress-track"><div class="progress-fill cal" style="width:100%"></div></div>
      </div>
      <div class="wizard-card">
        <ul class="summary-list">
          ${rows.map(([k, v]) => `<li class="summary-row"><span class="summary-key">${esc(k)}</span><span class="summary-val">${esc(String(v))}</span></li>`).join("")}
        </ul>
        <button class="btn-generate" id="wiz-generate">Generate Plan ✨</button>
      </div>
      <div class="wizard-nav">
        <button class="btn btn-back" id="wiz-back">← Back</button>
      </div>
    </div>`;
  document.getElementById("wiz-generate").addEventListener("click", generateFromWizard);
  document.getElementById("wiz-back").addEventListener("click", () => { state.wizardStep--; renderWizard(); });
}

function estimateTargets(goal, level) {
  const t = {
    "lose_weight-beginner": [1600, 120], "lose_weight-intermediate": [1800, 140], "lose_weight-advanced": [2000, 160],
    "build_muscle-beginner": [2500, 160], "build_muscle-intermediate": [2800, 180], "build_muscle-advanced": [3200, 200],
    "maintain-beginner": [2000, 130], "maintain-intermediate": [2200, 150], "maintain-advanced": [2500, 160],
    "endurance-beginner": [2200, 140], "endurance-intermediate": [2500, 160], "endurance-advanced": [2800, 170],
  };
  return t[`${goal}-${level}`] || [2000, 150];
}

async function generateFromWizard() {
  const a = state.wizardAnswers;
  const gymDays = Array.isArray(a.gym_days) ? a.gym_days : [];
  const profile = {
    goal: a.goal || "maintain",
    gym_days: gymDays.join(","),
    rest_days: DAYS.filter(d => !gymDays.includes(d)).join(","),
    meal_prep_day: a.meal_prep_day || "Sun",
    fitness_level: a.fitness_level || "beginner",
    equipment: Array.isArray(a.equipment) ? a.equipment.join(",") : (a.equipment || "bodyweight"),
    dietary_preference: a.dietary_preference || "none",
    allergies: a.allergies || "none",
    daily_calorie_target: (a.daily_targets && a.daily_targets.calories) || 2000,
    protein_target_g: (a.daily_targets && a.daily_targets.protein) || 150,
  };
  const genBtn = document.getElementById("wiz-generate");
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = "Generating…"; }
  const res = await api("POST", "/api/plans/generate", profile);
  if (res.ok) {
    toast("Plan generated!", "success");
    state.wizardStep = 0;
    state.wizardAnswers = {};
    document.querySelector('[data-tab="plans"]').click();
    await refreshPlans();
  } else {
    toast("Generation failed: " + (res.detail || res.error || "unknown"));
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = "Generate Plan ✨"; }
  }
}

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

// ── GymBot Chat ───────────────────────────────────────────────────────────────
function renderChat() {
  const el = document.getElementById("gymbot");
  if (!el) return;

  const messagesHTML = state.chatMessages.map(m => {
    if (m.role === "assistant") {
      return `
        <div class="chat-bubble-wrap-bot">
          <div class="chat-mini-avatar">🤖</div>
          <div>
            <div class="chat-sender">GymBot</div>
            <div class="chat-bubble-bot">${esc(m.content)}</div>
          </div>
        </div>`;
    }
    return `
      <div class="chat-bubble-wrap-user">
        <div>
          <div class="chat-sender" style="text-align:right">You</div>
          <div class="chat-bubble-user">${esc(m.content)}</div>
        </div>
      </div>`;
  }).join("");

  const typingHTML = state.chatLoading ? `
    <div class="chat-bubble-wrap-bot">
      <div class="chat-mini-avatar">🤖</div>
      <div>
        <div class="chat-sender">GymBot</div>
        <div class="chat-bubble-bot chat-typing">GymBot is thinking…</div>
      </div>
    </div>` : "";

  const generateHTML = (state.chatReady && !state.chatLoading) ? `
    <button class="chat-generate-btn" id="chat-gen-btn">Generate my plan ✨</button>` : "";

  const inputDisabled = state.chatLoading || state.chatReady ? "disabled" : "";

  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-header">
        <div class="chat-avatar">🤖</div>
        <div style="flex:1">
          <div class="chat-name">GymBot</div>
          <div class="chat-status">● Ready to build your plan</div>
        </div>
        <button class="btn btn-secondary" id="chat-reset-btn" style="font-size:11px">New chat</button>
      </div>
      <div class="chat-messages" id="chat-messages-list">
        ${messagesHTML}
        ${typingHTML}
        ${generateHTML}
      </div>
      <div class="chat-input-row">
        <input class="input" id="chat-input" placeholder="Message GymBot…"
          style="flex:1;border-radius:20px;padding:9px 16px" ${inputDisabled}>
        <button class="chat-send-btn" id="chat-send-btn" ${inputDisabled}>↑</button>
      </div>
    </div>`;

  // Auto-scroll to bottom
  const msgList = document.getElementById("chat-messages-list");
  if (msgList) msgList.scrollTop = msgList.scrollHeight;

  // Bind send
  const sendBtn = document.getElementById("chat-send-btn");
  const input = document.getElementById("chat-input");
  if (sendBtn && input) {
    const doSend = () => {
      const text = input.value.trim();
      if (!text || state.chatLoading || state.chatReady) return;
      input.value = "";
      sendMessage(text);
    };
    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }

  // Bind reset and generate
  const resetBtn = document.getElementById("chat-reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", resetChat);
  const genBtn = document.getElementById("chat-gen-btn");
  if (genBtn) genBtn.addEventListener("click", generateFromChat);

  // Trigger opening greeting if chat is empty and not already loading
  if (state.chatMessages.length === 0 && !state.chatLoading) initChat();
}

async function initChat() {
  state.chatLoading = true;
  renderChat();
  const res = await api("POST", "/api/chat", { messages: [], profile: state.profile });
  if (res.message) {
    state.chatMessages.push({ role: "assistant", content: res.message });
  } else {
    state.chatMessages.push({ role: "assistant", content: "GymBot is unavailable. Check your ANTHROPIC_API_KEY." });
  }
  state.chatLoading = false;
  renderChat();
}

async function sendMessage(text) {
  state.chatMessages.push({ role: "user", content: text });
  state.chatLoading = true;
  renderChat();
  const res = await api("POST", "/api/chat", { messages: state.chatMessages, profile: state.profile });
  if (res.message) {
    state.chatMessages.push({ role: "assistant", content: res.message });
    if (res.ready) state.chatReady = true;
  } else {
    state.chatMessages.push({ role: "assistant", content: "Something went wrong. Please try again." });
  }
  state.chatLoading = false;
  renderChat();
}

async function generateFromChat() {
  const genBtn = document.getElementById("chat-gen-btn");
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = "Generating…"; }
  const res = await api("POST", "/api/chat/generate", { messages: state.chatMessages, profile: state.profile });
  if (res.ok) {
    toast("Plan generated!", "success");
    resetChat();
    document.querySelector('[data-tab="plans"]').click();
    await refreshPlans();
  } else {
    toast("Generation failed: " + (res.detail || res.error || "unknown"));
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = "Generate my plan ✨"; }
  }
}

function resetChat() {
  state.chatMessages = [];
  state.chatReady = false;
  state.chatLoading = false;
  renderChat();
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
  // Don't pre-render wizard on load — render on first tab click instead
}

init();
