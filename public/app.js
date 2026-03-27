const state = {
  auth: null,
  config: null,
  accountSetup: null,
  homes: [],
  auditLog: null,
  auditActionFilter: "",
  auditQuery: "",
  healthReport: null,
  backupCatalog: null,
  backupCatalogHomeFilter: "",
  backupCatalogKindFilter: "",
  backupCatalogQuery: "",
  backupCatalogSort: "newest",
  cleanupPlan: null,
  sessions: [],
  hideHomesWithoutAuth: false,
  restoreTargetPaths: [],
  restoreTargetPresets: [],
  restoreTargetPresetDraft: "",
  restoreTargetAccountFilter: "",
  restoreTargetQuery: "",
  restoreTargetsInitialized: false,
  cleanupTargetPaths: [],
};

const authPanel = document.querySelector("#auth-panel");
const dashboard = document.querySelector("#dashboard");
const appTitle = document.querySelector("#app-title");
const loginChip = document.querySelector("#login-chip");
const configForm = document.querySelector("#config-form");
const accountGuide = document.querySelector("#account-guide");
const accountSlotsList = document.querySelector("#account-slots-list");
const accountSetupLog = document.querySelector("#account-setup-log");
const auditSummary = document.querySelector("#audit-summary");
const auditList = document.querySelector("#audit-list");
const auditActionFilter = document.querySelector("#audit-action-filter");
const auditQuery = document.querySelector("#audit-query");
const healthSummary = document.querySelector("#health-summary");
const healthLog = document.querySelector("#health-log");
const healthList = document.querySelector("#health-list");
const homesList = document.querySelector("#homes-list");
const toggleNoAuthHomesButton = document.querySelector("#toggle-no-auth-homes-button");
const repairLog = document.querySelector("#repair-log");
const backupsSummary = document.querySelector("#backups-summary");
const backupsList = document.querySelector("#backups-list");
const backupsLog = document.querySelector("#backups-log");
const backupsHomeFilter = document.querySelector("#backups-home-filter");
const backupsKindFilter = document.querySelector("#backups-kind-filter");
const backupsQuery = document.querySelector("#backups-query");
const backupsSort = document.querySelector("#backups-sort");
const cleanupSummary = document.querySelector("#cleanup-summary");
const cleanupList = document.querySelector("#cleanup-list");
const cleanupLog = document.querySelector("#cleanup-log");
const cleanupReduceSlotCountToggle = document.querySelector("#cleanup-reduce-slot-count-toggle");
const restoreTargetsList = document.querySelector("#restore-targets-list");
const sessionsList = document.querySelector("#sessions-list");
const targetHomeSelect = document.querySelector("#target-home-select");
const sourceHomeSelect = document.querySelector("#source-home-select");
const shareSourceHomeSelect = document.querySelector("#share-source-home-select");
const sessionQuery = document.querySelector("#session-query");
const overwriteToggle = document.querySelector("#overwrite-toggle");
const repairResetToggle = document.querySelector("#repair-reset-toggle");
const restoreArchivedToggle = document.querySelector("#restore-archived-toggle");
const shareLog = document.querySelector("#share-log");
const toast = document.querySelector("#toast");
const confirmModal = document.querySelector("#confirm-modal");
const confirmTitle = document.querySelector("#confirm-title");
const confirmMessage = document.querySelector("#confirm-message");
const confirmDetails = document.querySelector("#confirm-details");
const confirmCancelButton = document.querySelector("#confirm-cancel-button");
const confirmSubmitButton = document.querySelector("#confirm-submit-button");
const opsLinks = [...document.querySelectorAll("[data-ops-link]")];
const navSections = [...document.querySelectorAll("[data-nav-section]")];
const opsToggleButton = document.querySelector("#ops-toggle-button");

const confirmState = {
  resolver: null,
};
const SIDEBAR_COLLAPSE_KEY = "agent-harbor-sidebar-collapsed";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, tone = "neutral") {
  toast.textContent = message;
  toast.className = `toast ${tone}`;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.className = "toast hidden";
  }, 3200);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
}

async function runTask(task) {
  try {
    await task();
  } catch (error) {
    showToast(error.message, "warning");
    console.error(error);
  }
}

function closeConfirmation(approved) {
  if (!confirmState.resolver) {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
    return;
  }
  const resolver = confirmState.resolver;
  confirmState.resolver = null;
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
  resolver(Boolean(approved));
}

function openConfirmation({
  title,
  message,
  confirmText = "Continue",
  tone = "accent",
  details = [],
  showCancel = true,
}) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmSubmitButton.textContent = confirmText;
  confirmSubmitButton.className = tone === "warn" ? "warn-button" : "accent-button";
  confirmCancelButton.classList.toggle("hidden", !showCancel);

  if (details.length > 0) {
    confirmDetails.classList.remove("hidden");
    confirmDetails.innerHTML = details.map((detail) => `<p>${escapeHtml(detail)}</p>`).join("");
  } else {
    confirmDetails.classList.add("hidden");
    confirmDetails.innerHTML = "";
  }

  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    confirmState.resolver = resolve;
  });
}

async function confirmAction(options, task) {
  const approved = await openConfirmation(options);
  if (!approved) {
    showToast("Action cancelled.");
    return;
  }
  await task();
}

function setActiveOpsLink(sectionId) {
  opsLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.opsLink === sectionId);
  });
}

function sidebarToggleMarkup(collapsed) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const chevronPath = collapsed ? "M13 9l3 3-3 3" : "M15 9l-3 3 3 3";
  return `
    <span class="ops-toggle-visual" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="4" y="5" width="16" height="14" rx="3"></rect>
        <path d="M9 5v14"></path>
        <path d="${chevronPath}"></path>
      </svg>
    </span>
    <span class="visually-hidden">${label}</span>
  `;
}

function applySidebarCollapse(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  if (!opsToggleButton) {
    return;
  }
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  opsToggleButton.innerHTML = sidebarToggleMarkup(collapsed);
  opsToggleButton.setAttribute("aria-pressed", collapsed ? "true" : "false");
  opsToggleButton.setAttribute("aria-label", label);
  opsToggleButton.setAttribute("title", label);
}

function readSidebarCollapse() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarCollapse(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore storage write failures in restricted contexts
  }
}

function initSidebarCollapse() {
  applySidebarCollapse(readSidebarCollapse());
  if (!opsToggleButton || initSidebarCollapse.bound) {
    return;
  }
  opsToggleButton.addEventListener("click", () => {
    const nextCollapsed = !document.body.classList.contains("sidebar-collapsed");
    applySidebarCollapse(nextCollapsed);
    writeSidebarCollapse(nextCollapsed);
  });
  initSidebarCollapse.bound = true;
}

function initOpsNavigation() {
  if (!opsLinks.length || !navSections.length) {
    return;
  }

  if (!initOpsNavigation.bound) {
    opsLinks.forEach((link) => {
      link.addEventListener("click", () => setActiveOpsLink(link.dataset.opsLink));
    });
    initOpsNavigation.bound = true;
  }

  if (initOpsNavigation.observer) {
    initOpsNavigation.observer.disconnect();
  }

  initOpsNavigation.observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (visible) {
        setActiveOpsLink(visible.target.id);
      }
    },
    {
      rootMargin: "-18% 0px -55% 0px",
      threshold: [0.18, 0.35, 0.6],
    },
  );

  navSections.forEach((section) => {
    initOpsNavigation.observer.observe(section);
  });

  setActiveOpsLink(navSections[0].id);
}

function renderAuthPanel() {
  if (state.auth?.authenticated) {
    authPanel.innerHTML = "";
    authPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loginChip.textContent = `${state.auth.username} online`;
    return;
  }

  authPanel.classList.remove("hidden");
  dashboard.classList.add("hidden");

  if (!state.auth?.configured) {
    authPanel.innerHTML = `
      <div class="panel auth-card">
        <p class="panel-kicker">FIRST BOOT</p>
        <h2>Create Local Admin</h2>
        <p class="muted">This account stays inside Agent Harbor only. It protects the web UI before anyone can inspect or import your sessions.</p>
        <form id="setup-form" class="auth-form">
          <label><span>Username</span><input name="username" type="text" autocomplete="username" required /></label>
          <label><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
          <button class="accent-button" type="submit">Create Admin</button>
        </form>
      </div>
    `;
    document
      .querySelector("#setup-form")
      .addEventListener("submit", (event) => runTask(() => handleSetup(event)));
    return;
  }

  authPanel.innerHTML = `
      <div class="panel auth-card">
        <p class="panel-kicker">AUTH</p>
        <h2>Login</h2>
      <p class="muted">Use your local Agent Harbor admin account.</p>
      <form id="login-form" class="auth-form">
        <label><span>Username</span><input name="username" type="text" autocomplete="username" required /></label>
        <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="accent-button" type="submit">Enter Harbor</button>
      </form>
    </div>
  `;
  document
    .querySelector("#login-form")
    .addEventListener("submit", (event) => runTask(() => handleLogin(event)));
}

async function handleSetup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const username = String(form.get("username") || "").trim();
  await confirmAction(
    {
      title: "Create local admin account?",
      message:
        "Agent Harbor will store this credential locally and use it to protect access to the web UI.",
      confirmText: "Create Admin",
      details: [`Username: ${username || "not set yet"}`],
    },
    async () => {
      await request("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      showToast("Admin account created.", "success");
      await boot();
    },
  );
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(Object.fromEntries(form.entries())),
  });
  showToast("Logged in.", "success");
  await boot();
}

async function handleLogout() {
  await request("/api/auth/logout", { method: "POST", body: "{}" });
  showToast("Logged out.");
  await boot();
}

function fillConfigForm() {
  if (!state.config) return;
  appTitle.textContent = state.config.appName;
  configForm.elements.appName.value = state.config.appName || "";
  configForm.elements.isolatedAccountSlots.value = state.config.setup?.isolatedAccountSlots || 3;
  configForm.elements.extensionsMode.value = state.config.setup?.extensionsMode || "shared";
  configForm.elements.mainCodexHome.value = state.config.roots.mainCodexHome || "";
  configForm.elements.mainVSCodeExtensionsDir.value = state.config.roots.mainVSCodeExtensionsDir || "";
  configForm.elements.isolatedProfilesRoot.value = state.config.roots.isolatedProfilesRoot || "";
  configForm.elements.sharedExtensionsDir.value = state.config.roots.sharedExtensionsDir || "";
  configForm.elements.sharedSessionsRoot.value = state.config.roots.sharedSessionsRoot || "";
  configForm.elements.launcherBinDir.value = state.config.roots.launcherBinDir || "";
  configForm.elements.mainVSCodeStateDb.value = state.config.roots.mainVSCodeStateDb || "";
}

function statusChipTone(status) {
  if (status === "connected") return "success";
  if (status === "awaiting_login") return "warning";
  return "subtle";
}

function healthChipTone(status) {
  if (status === "ok") return "success";
  if (status === "critical") return "critical";
  return "warning";
}

function healthStatusLabel(status) {
  if (status === "ok") return "Healthy";
  if (status === "critical") return "Critical";
  return "Warning";
}

function buttonClassForTone(tone) {
  if (tone === "warn") return "warn-button";
  if (tone === "accent") return "accent-button";
  return "ghost-button";
}

function homeDisplayLabel(home) {
  return home?.displayLabel || home?.alias || home?.label || "unknown";
}

function homeSecondaryLabel(home) {
  return home?.alias ? home.label : "";
}

function slotDisplayLabel(slot) {
  return slot?.displayLabel || slot?.alias || slot?.slotKey || slot?.displayName || "slot";
}

function slotActionLabel(slot) {
  return slot?.actionLabel || slot?.displayName || slotDisplayLabel(slot);
}

async function saveHomeAlias(homeKey, alias) {
  return request("/api/homes/alias", {
    method: "POST",
    body: JSON.stringify({
      homeKey,
      alias,
    }),
  });
}

async function runHealthFixAction(item, fix) {
  const details = [...(fix.details || [])];
  if (fix.code === "repair-home") {
    details.push(
      repairResetToggle.checked
        ? "Reset VS Code openai.chatgpt state: yes"
        : "Reset VS Code openai.chatgpt state: no",
    );
  }

  await confirmAction(
    {
      title: fix.confirmTitle || `Run ${fix.label}?`,
      message: fix.confirmMessage || "Harbor will run the selected health fix action.",
      confirmText: fix.label,
      tone: fix.tone === "warn" ? "warn" : "accent",
      details,
    },
    async () => {
      const result = await request("/api/health/fix", {
        method: "POST",
        body: JSON.stringify({
          action: fix.code,
          homePath: item.path,
          resetOpenAIState: repairResetToggle.checked,
        }),
      });
      healthLog.textContent = (result.operations || []).join("\n");
      showToast(`${fix.label} finished for ${item.label}.`, "success");
      await refreshAccountSetup();
      await refreshHomes();
      await refreshSessions();
    },
  );
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** exponent;
  return `${scaled >= 10 || exponent === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[exponent]}`;
}

function populateFilterSelect(select, options, allLabel, selectedValue = "") {
  if (!select) {
    return "";
  }

  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>`;
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.append(option);
  });

  if (selectedValue && options.includes(selectedValue)) {
    select.value = selectedValue;
    return selectedValue;
  }

  select.value = "";
  return "";
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
}

function compareModifiedAt(left, right) {
  return String(left?.modifiedAt || "").localeCompare(String(right?.modifiedAt || ""));
}

function sortBackupItems(items, sortMode) {
  const sorted = [...items];
  sorted.sort((left, right) => {
    if (sortMode === "oldest") {
      return compareModifiedAt(left, right) || compareText(left.title, right.title);
    }
    if (sortMode === "largest") {
      return Number(right.sizeBytes || 0) - Number(left.sizeBytes || 0) || compareModifiedAt(right, left);
    }
    if (sortMode === "title") {
      return compareText(left.title, right.title) || compareModifiedAt(right, left);
    }
    if (sortMode === "kind") {
      return compareText(left.kind, right.kind) || compareModifiedAt(right, left);
    }
    return compareModifiedAt(right, left) || compareText(left.title, right.title);
  });
  return sorted;
}

function auditSearchText(item) {
  return [
    item.action,
    item.actor,
    item.summary,
    item.targetLabel,
    item.targetPath,
    ...(item.operations || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function backupSearchText(item) {
  return [
    item.title,
    item.homeLabel || "global",
    item.kind,
    item.backupPath,
    item.targetPath,
    ...(item.notes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function appendAccountSetupLog(payload) {
  const lines = [];

  if (payload.binDir) {
    lines.push(`Launcher bin dir: ${payload.binDir}`);
  }

  if (payload.sharedExtensions?.operations?.length) {
    lines.push(...payload.sharedExtensions.operations);
  }

  if (Array.isArray(payload.results)) {
    payload.results.forEach((result) => {
      const operations = result.operations?.length
        ? result.operations.join(" ")
        : "No setup changes were needed.";
      if (result.slot) {
        lines.push(`${slotActionLabel(result.slot)}: ${operations}`);
      } else if (result.slotKey) {
        lines.push(`${result.slotKey}: ${operations}`);
      }
    });
  } else if (payload.slot) {
    lines.push(`${slotActionLabel(payload.slot)}: ${payload.preparedOperations?.join(" ") || "Slot ready."}`);
    if (payload.launch?.command) {
      lines.push(`Launch command: ${payload.launch.command} ${payload.launch.args.join(" ")}`);
    }
    if (payload.nextSteps?.length) {
      lines.push(...payload.nextSteps);
    }
  }

  accountSetupLog.textContent = lines.join("\n");
}

function renderAccountSetup() {
  accountGuide.innerHTML = "";
  accountSlotsList.innerHTML = "";

  if (!state.accountSetup) {
    return;
  }

  const guideSummary = (state.accountSetup.guide || [])
    .slice(0, 3)
    .map((step) => `<p>${escapeHtml(step)}</p>`)
    .join("");
  accountGuide.innerHTML = `
    <div>
      <p class="guide-title">Quick Flow</p>
      <div class="guide-copy">${guideSummary}</div>
    </div>
    <div class="guide-actions">
      <a href="#path-control-section" class="ghost-button guide-link">Review Paths</a>
      <a href="#session-shuttle-section" class="ghost-button guide-link">Open Shuttle</a>
    </div>
  `;

  if (!state.accountSetup.slots?.length) {
    accountSlotsList.innerHTML = `<p class="muted">No account slots configured yet.</p>`;
    return;
  }

  state.accountSetup.slots.forEach((slot) => {
    const card = document.createElement("article");
    card.className = "account-slot-card";
    const accountBits = [
      slot.alias ? slot.slotKey : null,
      slot.account?.email || "Belum login",
      slot.account?.plan ? `plan ${slot.account.plan}` : null,
      slot.account?.accountIdSuffix ? `acct …${slot.account.accountIdSuffix}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    card.innerHTML = `
      <p class="panel-kicker">${slot.displayName}</p>
      <div class="home-head">
        <div>
          <h4>${slotDisplayLabel(slot)}</h4>
          <p class="muted">${accountBits}</p>
        </div>
        <span class="chip ${statusChipTone(slot.status)}">${slot.statusLabel}</span>
      </div>
      <div class="stack compact-stack">
        <p class="path">Home: ${slot.homePath}</p>
        <p class="path">Workspace Root: ${slot.rootPath}/workspace</p>
        <p class="path">Default Launch: ${slot.launchMode === "custom" ? "custom target" : "empty window"}</p>
        ${
          slot.launchTargetPath
            ? `<p class="path">Launch Target: ${slot.launchTargetPath}</p>`
            : `<p class="path">Launch Target: none</p>`
        }
        <p class="path">Extensions: ${slot.extensionsMode} · ${slot.extensionsPath}</p>
        <p class="path">Launcher: ${slot.launcherPath}</p>
        <p class="muted">${slot.sessionCount} thread tersimpan di slot ini.</p>
        ${
          slot.launchValidationMessage
            ? `<p class="muted launch-warning">${slot.launchValidationMessage}</p>`
            : ""
        }
      </div>
      <div class="slot-launch-config">
        <label>
          <span>Account Label</span>
          <input
            data-role="slot-alias"
            type="text"
            placeholder="work, personal, testing"
            value="${escapeHtml(slot.alias || "")}"
          />
        </label>
      </div>
      <div class="slot-launch-config">
        <label>
          <span>Default Launch Mode</span>
          <select data-role="launch-mode">
            <option value="empty" ${slot.launchMode === "empty" ? "selected" : ""}>Empty Window</option>
            <option value="custom" ${slot.launchMode === "custom" ? "selected" : ""}>Custom Workspace / Folder</option>
          </select>
        </label>
        <label>
          <span>Default Launch Target</span>
          <input
            data-role="launch-target"
            type="text"
            placeholder="~/work/project or /path/app.code-workspace"
            value="${escapeHtml(slot.launchTargetPath || "")}"
          />
        </label>
      </div>
      <div class="slot-actions">
        <button class="ghost-button" data-action="save-alias">Save Label</button>
        <button class="ghost-button" data-action="save-launch-settings">Save Launch Settings</button>
        <button class="ghost-button" data-action="prepare">Prepare Slot</button>
        <button class="accent-button" data-action="launch" ${slot.launchMode === "custom" && !slot.launchTargetValid ? "disabled" : ""}>Launch VS Code</button>
      </div>
    `;

    card.querySelector('[data-action="save-alias"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Save label for ${slotActionLabel(slot)}?`,
            message:
              "Harbor will store this human-friendly label and reuse it across account cards, selectors, recovery, health, and session views.",
            confirmText: "Save Label",
            details: [
              `Home key: ${slot.slotKey}`,
              `Label: ${card.querySelector('[data-role=\"slot-alias\"]').value.trim() || "clear label"}`,
            ],
          },
          async () => {
            await saveHomeAlias(slot.slotKey, card.querySelector('[data-role="slot-alias"]').value.trim());
            showToast(`Label updated for ${slotActionLabel(slot)}.`, "success");
            await refreshAccountSetup();
            await refreshHomes();
            await refreshSessions();
          },
        ),
      ),
    );

    card.querySelector('[data-action="save-launch-settings"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Save launch settings for ${slotActionLabel(slot)}?`,
            message:
              "Harbor will store the default launch mode for this slot and validate the custom path if custom mode is selected.",
            confirmText: "Save Launch Settings",
            details: [
              `Mode: ${card.querySelector('[data-role=\"launch-mode\"]').value}`,
              `Target: ${card.querySelector('[data-role=\"launch-target\"]').value.trim() || "none"}`,
            ],
          },
          async () => {
            await request("/api/account-setup/settings", {
              method: "POST",
              body: JSON.stringify({
                slotKey: slot.slotKey,
                launchMode: card.querySelector('[data-role="launch-mode"]').value,
                launchTargetPath: card.querySelector('[data-role="launch-target"]').value.trim(),
              }),
            });
            showToast(
              `Launch settings updated for ${slotActionLabel(slot)}. Reinstall launchers if you also use terminal wrappers.`,
              "success",
            );
            await refreshAccountSetup();
            await refreshHomes();
            await refreshSessions();
          },
        ),
      ),
    );

    card.querySelector('[data-action="prepare"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Prepare ${slotActionLabel(slot)}?`,
            message: "Harbor will create the isolated folders and runtime directories for this account slot.",
            confirmText: "Prepare Slot",
            details: [slot.homePath, slot.launcherPath],
          },
          async () => {
            const result = await request("/api/account-setup/prepare", {
              method: "POST",
              body: JSON.stringify({ slotKey: slot.slotKey }),
            });
            appendAccountSetupLog(result);
            showToast(`${slotActionLabel(slot)} siap dipakai.`, "success");
            await refreshAccountSetup();
            await refreshHomes();
            await refreshSessions();
          },
        ),
      ),
    );

    card.querySelector('[data-action="launch"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Launch ${slotActionLabel(slot)}?`,
            message:
              "Harbor will launch this slot using the saved default launch mode. Save Launch Settings first if you changed the mode or target in the card.",
            confirmText: "Launch VS Code",
            details: [
              `Saved mode: ${slot.launchMode === "custom" ? "custom target" : "empty window"}`,
              `Saved target: ${slot.launchTargetPath || "none"}`,
            ],
          },
          async () => {
            const result = await request("/api/account-setup/launch", {
              method: "POST",
              body: JSON.stringify({ slotKey: slot.slotKey }),
            });
            appendAccountSetupLog(result);
            showToast(`Membuka ${slotActionLabel(slot)} di VS Code.`, "success");
            await refreshAccountSetup();
            await refreshHomes();
          },
        ),
      ),
    );

    accountSlotsList.append(card);
  });
}

function renderHomes() {
  homesList.innerHTML = "";
  const homes = state.hideHomesWithoutAuth
    ? state.homes.filter((home) => !home.authMissing)
    : state.homes;

  toggleNoAuthHomesButton.textContent = state.hideHomesWithoutAuth ? "Show No-Auth" : "Hide No-Auth";
  toggleNoAuthHomesButton.classList.toggle("active", state.hideHomesWithoutAuth);

  if (homes.length === 0) {
    homesList.innerHTML = `<p class="muted">${
      state.homes.length === 0
        ? "No homes detected for the current path settings."
        : "No homes left after hiding no-auth slots."
    }</p>`;
    return;
  }

  homesList.insertAdjacentHTML(
    "beforeend",
    `<p class="muted">${homes.length}/${state.homes.length} home visible${state.hideHomesWithoutAuth ? " · no-auth homes hidden" : ""}.</p>`,
  );

  homes.forEach((home) => {
    const card = document.createElement("article");
    card.className = "home-card";
    const accountBits = [
      homeSecondaryLabel(home),
      home.account?.email || "No auth.json",
      home.account?.plan ? `plan ${home.account.plan}` : null,
      home.account?.accountIdSuffix ? `acct …${home.account.accountIdSuffix}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    card.innerHTML = `
      <div class="home-head">
        <div>
          <h4>${homeDisplayLabel(home)}</h4>
          <p class="muted">${accountBits}</p>
        </div>
        <span class="chip">${home.sessionCount} threads</span>
      </div>
      <p class="path">${home.path}</p>
      <div class="slot-launch-config">
        <label>
          <span>Home Label</span>
          <input
            data-role="home-alias"
            type="text"
            placeholder="work, personal, staging"
            value="${escapeHtml(home.alias || "")}"
          />
        </label>
      </div>
      <div class="home-actions">
        <button class="ghost-button" data-action="save-alias">Save Label</button>
        <button class="ghost-button" data-action="repair">Repair Home</button>
        ${home.canArchive ? `<button class="warn-button" data-action="archive">Archive No-Auth Slot</button>` : ""}
      </div>
    `;

    card.querySelector('[data-action="save-alias"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Save label for ${homeDisplayLabel(home)}?`,
            message:
              "Harbor will store this label and reuse it across selectors, Health, Recovery, backups, and session views.",
            confirmText: "Save Label",
            details: [
              `Home key: ${home.label}`,
              `Label: ${card.querySelector('[data-role=\"home-alias\"]').value.trim() || "clear label"}`,
            ],
          },
          async () => {
            await saveHomeAlias(home.label, card.querySelector('[data-role="home-alias"]').value.trim());
            showToast(`Label updated for ${homeDisplayLabel(home)}.`, "success");
            await refreshAccountSetup();
            await refreshHomes();
            await refreshSessions();
          },
        ),
      ),
    );

    card.querySelector('[data-action="repair"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Repair ${homeDisplayLabel(home)}?`,
            message:
              "Harbor will detach shared session links and optionally reset the VS Code ChatGPT state for this home.",
            confirmText: "Repair Home",
            tone: "warn",
            details: [
              home.path,
              repairResetToggle.checked
                ? "Reset VS Code openai.chatgpt state: yes"
                : "Reset VS Code openai.chatgpt state: no",
            ],
          },
          async () => {
            const result = await request("/api/repair/home", {
              method: "POST",
              body: JSON.stringify({
                homePath: home.path,
                resetOpenAIState: repairResetToggle.checked,
              }),
            });
            appendRepairLog(result);
            showToast(`Repair finished for ${homeDisplayLabel(home)}.`, "success");
            await refreshHomes();
          },
        ),
      ),
    );

    if (home.canArchive) {
      card.querySelector('[data-action="archive"]').addEventListener("click", () =>
        runTask(() =>
          confirmAction(
            {
              title: `Archive ${homeDisplayLabel(home)}?`,
              message:
                "Harbor will move this isolated slot into an archive folder instead of deleting it.",
              confirmText: "Archive Slot",
              tone: "warn",
              details: [
                home.path,
                home.slotRoot || "slot root unavailable",
                "This slot has no auth.json / account token data.",
                `Current slot count: ${state.config?.setup?.isolatedAccountSlots || "unknown"} (lower it if you do not want this slot recreated later).`,
              ],
            },
            async () => {
              const result = await request("/api/homes/archive", {
                method: "POST",
                body: JSON.stringify({ homePath: home.path }),
              });
              repairLog.textContent = result.operations.join("\n");
              showToast(`${homeDisplayLabel(home)} archived.`, "success");
              await refreshAccountSetup();
              await refreshHomes();
              await refreshSessions();
            },
          ),
        ),
      );
    }

    homesList.append(card);
  });
}

function renderHealth() {
  healthSummary.innerHTML = "";
  healthList.innerHTML = "";
  healthLog.textContent = healthLog.textContent || "";

  if (!state.healthReport) {
    healthSummary.innerHTML = `<p class="muted">No health data loaded yet.</p>`;
    return;
  }

  const { summary, generatedAt, checks } = state.healthReport;
  healthSummary.innerHTML = `
    <div class="health-summary-grid">
      <article class="health-summary-card">
        <strong>${summary.total}</strong>
        <span>Total Homes</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.ok}</strong>
        <span>Healthy</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.warning}</strong>
        <span>Warnings</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.critical}</strong>
        <span>Critical</span>
      </article>
    </div>
    <p class="muted">Generated at ${generatedAt}</p>
  `;

  if (!checks.length) {
    healthList.innerHTML = `<p class="muted">No homes available for health inspection.</p>`;
    return;
  }

  checks.forEach((item) => {
    const card = document.createElement("article");
    card.className = "home-card";
    const issuesMarkup =
      item.issues.length > 0
        ? item.issues
            .map(
              (issue) =>
                `<li><span class="chip ${healthChipTone(issue.severity)}">${issue.severity}</span> ${escapeHtml(issue.message)}</li>`,
            )
            .join("")
        : `<li><span class="chip success">ok</span> No actionable issues detected.</li>`;
    const recommendationsMarkup =
      item.recommendations.length > 0
        ? item.recommendations.map((line) => `<li>${escapeHtml(line)}</li>`).join("")
        : `<li>No action needed.</li>`;
    const fixesMarkup =
      item.fixes?.length > 0
        ? item.fixes
            .map(
              (fix) =>
                `<button class="${buttonClassForTone(fix.tone)} compact-button" data-fix-code="${escapeHtml(fix.code)}">${escapeHtml(fix.label)}</button>`,
            )
            .join("")
        : `<p class="muted">No direct auto-fix available for this card.</p>`;

    card.innerHTML = `
      <div class="home-head">
        <div>
          <h4>${escapeHtml(item.label)}</h4>
          <p class="muted">${escapeHtml(item.accountEmail || "No auth.json")} · ${item.sessionCount} threads</p>
        </div>
        <span class="chip ${healthChipTone(item.status)}">${healthStatusLabel(item.status)}</span>
      </div>
      <p class="path">${escapeHtml(item.path)}</p>
      <div class="health-check-grid">
        <p class="path">Extensions: ${escapeHtml(item.checks.extensions.path)} · ${item.checks.extensions.count} folder</p>
        <p class="path">State DB: ${escapeHtml(item.checks.stateDb.path)} · ${item.checks.stateDb.exists ? "present" : "missing"}</p>
        ${
          item.checks.launcher
            ? `<p class="path">Launcher: ${
                item.checks.launcher.wrapperExists && item.checks.launcher.aliasExists ? "installed" : "missing"
              } · ${item.checks.launcher.wrapperSynced && item.checks.launcher.aliasSynced ? "synced" : "needs reinstall"}</p>`
            : `<p class="path">Launcher: n/a</p>`
        }
        ${
          item.checks.launchSettings
            ? `<p class="path">Launch Target: ${item.checks.launchSettings.launchMode === "custom" ? escapeHtml(item.checks.launchSettings.launchTargetPath || "missing") : "empty window"} · ${item.checks.launchSettings.valid ? "valid" : "invalid"}</p>`
            : `<p class="path">Launch Target: n/a</p>`
        }
      </div>
      <div class="health-section-block">
        <p class="panel-kicker">Issues</p>
        <ul class="health-listing">${issuesMarkup}</ul>
      </div>
      <div class="health-section-block">
        <p class="panel-kicker">Recommended Actions</p>
        <ul class="health-listing">${recommendationsMarkup}</ul>
      </div>
      <div class="health-section-block">
        <p class="panel-kicker">Auto Fix</p>
        <div class="home-actions">${fixesMarkup}</div>
      </div>
    `;
    card.querySelectorAll("[data-fix-code]").forEach((button) => {
      const fix = item.fixes.find((entry) => entry.code === button.dataset.fixCode);
      if (!fix) {
        return;
      }
      button.addEventListener("click", () => runTask(() => runHealthFixAction(item, fix)));
    });
    healthList.append(card);
  });
}

function renderAudit() {
  auditSummary.innerHTML = "";
  auditList.innerHTML = "";

  if (!state.auditLog) {
    auditSummary.innerHTML = `<p class="muted">No audit data loaded yet.</p>`;
    return;
  }

  const { summary, generatedAt, items } = state.auditLog;
  const actionOptions = [...new Set(items.map((item) => item.action).filter(Boolean))].sort(compareText);
  state.auditActionFilter = populateFilterSelect(
    auditActionFilter,
    actionOptions,
    "All actions",
    state.auditActionFilter,
  );
  auditQuery.value = state.auditQuery;

  const normalizedQuery = state.auditQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (state.auditActionFilter && item.action !== state.auditActionFilter) {
      return false;
    }
    if (normalizedQuery && !auditSearchText(item).includes(normalizedQuery)) {
      return false;
    }
    return true;
  });

  auditSummary.innerHTML = `
    <div class="health-summary-grid">
      <article class="health-summary-card">
        <strong>${summary.total}</strong>
        <span>Loaded entries</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.actionTypes}</strong>
        <span>Action types</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.actors}</strong>
        <span>Actors</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.today}</strong>
        <span>Entries today</span>
      </article>
    </div>
    <p class="muted">${filteredItems.length}/${items.length} visible entries · Generated at ${generatedAt}</p>
  `;

  if (!items.length) {
    auditList.innerHTML = `<p class="muted">No Harbor audit entries have been recorded yet.</p>`;
    return;
  }

  if (!filteredItems.length) {
    auditList.innerHTML = `<p class="muted">No audit entries matched the current filters.</p>`;
    return;
  }

  filteredItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "home-card";
    const operationsMarkup =
      item.operations?.length > 0
        ? `<ul class="health-listing">${item.operations.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : `<p class="muted">No operation details stored for this entry.</p>`;

    card.innerHTML = `
      <div class="home-head">
        <div>
          <h4>${escapeHtml(item.summary || item.action)}</h4>
          <p class="muted">${escapeHtml(item.action)} · ${escapeHtml(item.actor || "unknown")} · ${escapeHtml(item.timestamp)}</p>
        </div>
        <span class="chip ${item.status === "error" ? "critical" : "success"}">${escapeHtml(item.status || "ok")}</span>
      </div>
      ${item.targetLabel ? `<p class="path">Target: ${escapeHtml(item.targetLabel)}</p>` : ""}
      ${item.targetPath ? `<p class="path">${escapeHtml(item.targetPath)}</p>` : ""}
      <div class="health-section-block">
        <p class="panel-kicker">Operations</p>
        ${operationsMarkup}
      </div>
    `;
    auditList.append(card);
  });
}

function renderBackups() {
  backupsSummary.innerHTML = "";
  backupsList.innerHTML = "";

  if (!state.backupCatalog) {
    backupsSummary.innerHTML = `<p class="muted">No backup catalog loaded yet.</p>`;
    return;
  }

  const { summary, generatedAt, items } = state.backupCatalog;
  const homeOptions = [...new Set(items.map((item) => item.homeLabel || "global"))].sort(compareText);
  const kindOptions = [...new Set(items.map((item) => item.kind).filter(Boolean))].sort(compareText);
  state.backupCatalogHomeFilter = populateFilterSelect(
    backupsHomeFilter,
    homeOptions,
    "All homes",
    state.backupCatalogHomeFilter,
  );
  state.backupCatalogKindFilter = populateFilterSelect(
    backupsKindFilter,
    kindOptions,
    "All kinds",
    state.backupCatalogKindFilter,
  );
  if (backupsQuery) {
    backupsQuery.value = state.backupCatalogQuery;
  }
  if (backupsSort) {
    backupsSort.value = state.backupCatalogSort;
  }

  const normalizedQuery = state.backupCatalogQuery.trim().toLowerCase();
  const filteredItems = sortBackupItems(
    items.filter((item) => {
      if (state.backupCatalogHomeFilter && (item.homeLabel || "global") !== state.backupCatalogHomeFilter) {
        return false;
      }
      if (state.backupCatalogKindFilter && item.kind !== state.backupCatalogKindFilter) {
        return false;
      }
      if (normalizedQuery && !backupSearchText(item).includes(normalizedQuery)) {
        return false;
      }
      return true;
    }),
    state.backupCatalogSort,
  );

  const activeFilterBits = [];
  if (state.backupCatalogHomeFilter) {
    activeFilterBits.push(`home: ${state.backupCatalogHomeFilter}`);
  }
  if (state.backupCatalogKindFilter) {
    activeFilterBits.push(`kind: ${state.backupCatalogKindFilter}`);
  }
  if (normalizedQuery) {
    activeFilterBits.push(`search: “${state.backupCatalogQuery.trim()}”`);
  }

  backupsSummary.innerHTML = `
    <div class="health-summary-grid">
      <article class="health-summary-card">
        <strong>${summary.total}</strong>
        <span>Total restore points</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.files}</strong>
        <span>File / dir backups</span>
      </article>
      <article class="health-summary-card">
        <strong>${summary.slotArchives}</strong>
        <span>Archived slots</span>
      </article>
    </div>
    <p class="muted">${filteredItems.length}/${items.length} visible restore point${items.length === 1 ? "" : "s"} · Generated at ${generatedAt}</p>
    ${
      activeFilterBits.length > 0
        ? `<p class="muted">Active filters: ${escapeHtml(activeFilterBits.join(" · "))}</p>`
        : ""
    }
  `;

  if (!items.length) {
    backupsList.innerHTML = `<p class="muted">No Harbor-managed backup items were found under the configured roots.</p>`;
    return;
  }

  if (!filteredItems.length) {
    backupsList.innerHTML = `<p class="muted">No backup items matched the current filters.</p>`;
    return;
  }

  filteredItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "home-card";
    const notesMarkup =
      item.notes?.length > 0
        ? `<ul class="health-listing">${item.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
        : `<p class="muted">No extra notes.</p>`;

    card.innerHTML = `
      <div class="home-head">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <p class="muted">${escapeHtml(item.homeLabel || "global")} · ${escapeHtml(item.kind)} · ${escapeHtml(item.modifiedAt)}</p>
        </div>
        <span class="chip">${item.isDirectory ? "directory" : formatBytes(item.sizeBytes)}</span>
      </div>
      <p class="path">Backup: ${escapeHtml(item.backupPath)}</p>
      ${item.targetPath ? `<p class="path">Target: ${escapeHtml(item.targetPath)}</p>` : ""}
      <p class="muted">${item.targetExists ? "Current target exists and will be backed up before restore." : "Current target does not exist yet; restore will recreate it."}</p>
      ${notesMarkup}
      <div class="home-actions">
        <button class="accent-button" data-action="restore">Restore This Backup</button>
      </div>
    `;

    card.querySelector('[data-action="restore"]').addEventListener("click", () =>
      runTask(() =>
        confirmAction(
          {
            title: `Restore ${item.title}?`,
            message:
              "Harbor will back up the current target first, then restore this backup item into its original path.",
            confirmText: "Restore Backup",
            tone: "warn",
            details: [
              `Backup: ${item.backupPath}`,
              item.targetPath ? `Target: ${item.targetPath}` : "Target path unavailable",
              item.targetExists
                ? "Current target exists: yes (Harbor will move it aside first)"
                : "Current target exists: no",
              ...(item.notes || []),
            ],
          },
          async () => {
            const result = await request("/api/backups/restore", {
              method: "POST",
              body: JSON.stringify({ backupPath: item.backupPath }),
            });
            backupsLog.textContent = result.operations.join("\n");
            showToast(`${item.title} restored.`, "success");
            await refreshHomes();
            await refreshSessions();
          },
        ),
      ),
    );

    backupsList.append(card);
  });
}

function renderCleanupPlan() {
  cleanupSummary.innerHTML = "";
  cleanupList.innerHTML = "";

  if (!state.cleanupPlan) {
    cleanupSummary.innerHTML = `<p class="muted">No cleanup plan loaded yet.</p>`;
    return;
  }

  const { generatedAt, candidateCount, candidateSessionCount, currentSlotCount, suggestedSlotCount, reducibleNow, candidates } =
    state.cleanupPlan;
  const validCandidatePaths = new Set(candidates.map((item) => item.path));
  state.cleanupTargetPaths = state.cleanupTargetPaths.filter((targetPath) => validCandidatePaths.has(targetPath));
  if (state.cleanupTargetPaths.length === 0 && candidates.length > 0) {
    state.cleanupTargetPaths = candidates.map((item) => item.path);
  }

  cleanupSummary.innerHTML = `
    <div class="health-summary-grid">
      <article class="health-summary-card">
        <strong>${candidateCount}</strong>
        <span>Stale slots</span>
      </article>
      <article class="health-summary-card">
        <strong>${candidateSessionCount}</strong>
        <span>Threads parked</span>
      </article>
      <article class="health-summary-card">
        <strong>${currentSlotCount}</strong>
        <span>Configured slots</span>
      </article>
      <article class="health-summary-card">
        <strong>${reducibleNow ? suggestedSlotCount : currentSlotCount}</strong>
        <span>${reducibleNow ? "Suggested slots after cleanup" : "No slot-count reduction needed"}</span>
      </article>
    </div>
    <p class="muted">Generated at ${generatedAt}</p>
  `;

  if (!candidates.length) {
    cleanupList.innerHTML = `<p class="muted">No stale no-auth isolated slots are currently eligible for cleanup.</p>`;
    return;
  }

  const controls = document.createElement("div");
  controls.className = "choice-toolbar";
  controls.innerHTML = `
    <button class="ghost-button compact-button" data-select="all" type="button">Select All</button>
    <button class="ghost-button compact-button" data-select="clear" type="button">Clear All</button>
  `;
  controls.querySelector('[data-select="all"]').addEventListener("click", () => {
    state.cleanupTargetPaths = candidates.map((item) => item.path);
    renderCleanupPlan();
  });
  controls.querySelector('[data-select="clear"]').addEventListener("click", () => {
    state.cleanupTargetPaths = [];
    renderCleanupPlan();
  });
  cleanupList.append(controls);

  const summary = document.createElement("p");
  summary.className = "muted";
  summary.textContent = `${state.cleanupTargetPaths.length} selected · ${candidateCount} stale slot candidate${candidateCount === 1 ? "" : "s"}.`;
  cleanupList.append(summary);

  const grid = document.createElement("div");
  grid.className = "choice-grid";

  candidates.forEach((item) => {
    const checked = state.cleanupTargetPaths.includes(item.path);
    const card = document.createElement("label");
    card.className = `choice-card ${checked ? "selected" : ""}`;
    card.innerHTML = `
      <input type="checkbox" ${checked ? "checked" : ""} />
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <p>${escapeHtml(`${item.sessionCount} thread${item.sessionCount === 1 ? "" : "s"} · ${item.path}`)}</p>
        <p>${escapeHtml(
          item.launcherPaths?.length
            ? `${item.launcherPaths.length} launcher file${item.launcherPaths.length === 1 ? "" : "s"} will be archived too.`
            : "No launcher files found for this slot."
        )}</p>
        <p>${escapeHtml(
          item.isTrailingCandidate
            ? "Trailing stale slot: safe candidate for lowering slot count if selected."
            : "Non-trailing stale slot: slot count may stay unchanged if higher slots are still active."
        )}</p>
      </div>
    `;
    card.querySelector("input").addEventListener("change", (event) => {
      const targetPath = item.path;
      if (event.currentTarget.checked) {
        if (!state.cleanupTargetPaths.includes(targetPath)) {
          state.cleanupTargetPaths.push(targetPath);
        }
      } else {
        state.cleanupTargetPaths = state.cleanupTargetPaths.filter((value) => value !== targetPath);
      }
      renderCleanupPlan();
    });
    grid.append(card);
  });

  cleanupList.append(grid);
}

function populateHomeSelectors() {
  const targetValue = targetHomeSelect.value;
  const sourceValue = sourceHomeSelect.value;
  const shareSourceValue = shareSourceHomeSelect.value;
  targetHomeSelect.innerHTML = "";
  sourceHomeSelect.innerHTML = `<option value="">All sources</option>`;
  shareSourceHomeSelect.innerHTML = "";

  state.homes.forEach((home) => {
    const targetOption = document.createElement("option");
    targetOption.value = home.path;
    targetOption.textContent = `${homeDisplayLabel(home)} · ${home.account?.email || "no auth"}`;
    targetHomeSelect.append(targetOption);

    const sourceOption = document.createElement("option");
    sourceOption.value = home.path;
    sourceOption.textContent = `${homeDisplayLabel(home)} · ${home.account?.email || "no auth"}`;
    sourceHomeSelect.append(sourceOption);

    const shareSourceOption = document.createElement("option");
    shareSourceOption.value = home.path;
    shareSourceOption.textContent = `${homeDisplayLabel(home)} · ${home.account?.email || "no auth"}`;
    shareSourceHomeSelect.append(shareSourceOption);
  });

  if (targetValue && [...targetHomeSelect.options].some((opt) => opt.value === targetValue)) {
    targetHomeSelect.value = targetValue;
  } else if (targetHomeSelect.options.length > 0) {
    targetHomeSelect.selectedIndex = 0;
  }

  if (sourceValue && [...sourceHomeSelect.options].some((opt) => opt.value === sourceValue)) {
    sourceHomeSelect.value = sourceValue;
  }

  if (
    shareSourceValue &&
    [...shareSourceHomeSelect.options].some((opt) => opt.value === shareSourceValue)
  ) {
    shareSourceHomeSelect.value = shareSourceValue;
  } else if (shareSourceHomeSelect.options.length > 0) {
    shareSourceHomeSelect.selectedIndex = 0;
  }
}

function renderSessions() {
  if (state.sessions.length === 0) {
    sessionsList.innerHTML = `<p class="muted">No sessions matched the current filters.</p>`;
    return;
  }

  sessionsList.innerHTML = "";
  state.sessions.forEach((session) => {
    const row = document.createElement("article");
    row.className = "session-card";
    row.innerHTML = `
      <div class="session-meta">
        <div>
          <p class="session-title">${session.title}</p>
          <p class="muted">${session.sourceLabel} · ${session.sourceEmail || "no email"} · ${session.updatedAt || "unknown time"}</p>
          <p class="session-id">${session.id}</p>
        </div>
        <div class="session-actions">
          ${session.existsInTarget ? `<span class="chip warning">already in target</span>` : ""}
          <button class="ghost-button session-preview-button" type="button">Preview</button>
          <button class="accent-button session-import-button" type="button">Import</button>
        </div>
      </div>
    `;
    row.querySelector(".session-preview-button").addEventListener("click", () =>
      runTask(async () => {
        const preview = await fetchSessionPreview(session, targetHomeSelect.value);
        await openConfirmation({
          title: "Session preview",
          message:
            "Read-only preview of the selected session. This does not copy auth state or modify the source home.",
          confirmText: "Close",
          details: buildSessionPreviewDetails(preview),
          showCancel: false,
        });
      }),
    );
    row.querySelector(".session-import-button").addEventListener("click", () =>
      runTask(() =>
        (async () => {
          const targetPath = targetHomeSelect.value;
          if (!targetPath) {
            showToast("Choose a target home first.", "warning");
            return;
          }
          const preview = await fetchSessionPreview(session, targetPath);
          await confirmAction(
            {
              title: "Import session ke target home?",
              message:
                "Session yang dipilih akan disalin ke target home yang aktif tanpa membawa auth state antar akun.",
              confirmText: "Import Session",
              details: [
                ...buildSessionPreviewDetails(preview),
                overwriteToggle.checked
                  ? "Overwrite existing target copy: yes"
                  : "Overwrite existing target copy: no",
              ],
            },
            async () => {
              const result = await request("/api/sessions/import", {
                method: "POST",
                body: JSON.stringify({
                  sourcePath: session.sourcePath,
                  targetPath,
                  sessionId: session.id,
                  overwrite: overwriteToggle.checked,
                }),
              });
              showToast(result.operations.join(" "), "success");
              await refreshHomes();
              await refreshSessions();
            },
          );
        })(),
      ),
    );
    sessionsList.append(row);
  });
}

function buildSessionPreviewDetails(preview) {
  const details = [
    `Session: ${preview.title}`,
    `Source: ${preview.sourceLabel} · ${preview.sourceEmail || "no email"}${preview.sourcePlan ? ` · plan ${preview.sourcePlan}` : ""}`,
    preview.targetLabel
      ? `Target: ${preview.targetLabel}${preview.existsInTarget ? " · already has this session" : ""}`
      : null,
    `Updated: ${preview.updatedAt || "unknown"}`,
    preview.sessionRelativePath
      ? `Session file: ${preview.sessionRelativePath}`
      : preview.availableFromHistoryOnly
        ? "Session file: not flushed yet; Harbor can materialize it from history during import."
        : "Session file: missing in source home.",
    preview.shellSnapshotExists
      ? `Shell snapshot: ${preview.shellSnapshotRelativePath || "available"}`
      : "Shell snapshot: not found",
    `Preview counts: ${preview.userMessageCount} user · ${preview.assistantMessageCount} assistant · ${preview.totalRecords} records`,
    preview.model ? `Model: ${preview.model}` : null,
    preview.cwd ? `CWD: ${preview.cwd}` : null,
    preview.firstPromptSnippet ? `First prompt: ${preview.firstPromptSnippet}` : null,
    preview.lastPromptSnippet && preview.lastPromptSnippet !== preview.firstPromptSnippet
      ? `Last prompt: ${preview.lastPromptSnippet}`
      : null,
    preview.lastAssistantSnippet ? `Last assistant: ${preview.lastAssistantSnippet}` : null,
  ];
  return details.filter(Boolean);
}

function appendRepairLog(payload) {
  const lines = Array.isArray(payload.results) ? payload.results : [payload];
  const output = lines
    .map((item) => {
      const actions = item.actions?.length ? item.actions.join(" ") : "No changes were needed.";
      return `${item.home}: ${actions}`;
    })
    .join("\n");
  repairLog.textContent = output;
}

function appendSharedHistoryRestoreLog(payload) {
  const lines = [
    `${payload.dryRun ? "Preview" : "Restore"} source shared root: ${payload.sourceRoot}`,
    `Indexed sessions: ${payload.uniqueIndexedSessions}/${payload.totalIndexedSessions}`,
    `Mappable source session files: ${payload.mappableSourceSessions}`,
    `Target homes: ${(payload.results || []).map((item) => item.home).join(", ") || "none"}`,
  ];

  payload.results.forEach((item) => {
    const actions = item.actions?.length ? item.actions.join(" ") : "No changes were needed.";
    lines.push(`${item.home}: ${actions}`);
  });

  if (payload.unresolvedSessionIds?.length) {
    lines.push(
      `Unresolved source session ids (${payload.unresolvedSessionIds.length}): ${payload.unresolvedSessionIds.join(", ")}`,
    );
  }

  repairLog.textContent = lines.join("\n");
}

function syncRestoreTargetSelection() {
  const validPaths = new Set(state.homes.map((home) => home.path));
  state.restoreTargetPaths = state.restoreTargetPaths.filter((targetPath) => validPaths.has(targetPath));
  if (!state.restoreTargetsInitialized && state.restoreTargetPaths.length === 0 && state.homes.length > 0) {
    state.restoreTargetPaths = state.homes.map((home) => home.path);
  }
  state.restoreTargetsInitialized = true;
}

function getSelectedRestoreTargets() {
  syncRestoreTargetSelection();
  return [...state.restoreTargetPaths];
}

function normalizeRestoreTargetAccountKey(home) {
  return home.account?.email?.trim().toLowerCase() || "__missing__";
}

function buildRestoreTargetAccountOptions() {
  const options = [{ value: "", label: "All accounts" }];
  const seen = new Set();

  state.homes.forEach((home) => {
    const value = normalizeRestoreTargetAccountKey(home);
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    options.push({
      value,
      label: value === "__missing__" ? "No auth.json / unknown account" : home.account.email,
    });
  });

  return options;
}

function getVisibleRestoreTargets() {
  const accountFilter = state.restoreTargetAccountFilter;
  const query = state.restoreTargetQuery.trim().toLowerCase();

  return state.homes.filter((home) => {
    if (accountFilter && normalizeRestoreTargetAccountKey(home) !== accountFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      home.label,
      home.alias,
      home.account?.email,
      home.path,
      home.account?.plan,
      home.account?.accountIdSuffix,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function setRestoreTargetSelection(paths, selected) {
  const updates = new Set(state.restoreTargetPaths);
  paths.forEach((targetPath) => {
    if (selected) {
      updates.add(targetPath);
    } else {
      updates.delete(targetPath);
    }
  });
  state.restoreTargetPaths = [...updates];
}

function renderRestoreTargets() {
  restoreTargetsList.innerHTML = "";
  syncRestoreTargetSelection();

  if (state.homes.length === 0) {
    restoreTargetsList.innerHTML = `<p class="muted">No homes available for shared-history restore.</p>`;
    return;
  }

  const visibleHomes = getVisibleRestoreTargets();
  const selectedCount = state.restoreTargetPaths.length;
  const accountOptions = buildRestoreTargetAccountOptions();

  const presetPanel = document.createElement("div");
  presetPanel.className = "restore-filter-panel";
  presetPanel.innerHTML = `
    <div class="choice-toolbar">
      <label class="filter-field">
        <span>Save current target set as preset</span>
        <input
          data-target-preset="name"
          type="text"
          placeholder="example: all codex slots"
          value="${escapeHtml(state.restoreTargetPresetDraft)}"
        />
      </label>
      <div class="tag-row">
        <button type="button" class="accent-button compact-button" data-target-preset="save">Save Preset</button>
      </div>
    </div>
  `;
  const presetNameInput = presetPanel.querySelector('[data-target-preset="name"]');
  const presetSaveButton = presetPanel.querySelector('[data-target-preset="save"]');
  const currentPresetMatch = () => {
    const name = presetNameInput.value.trim();
    if (!name) {
      return null;
    }
    return (
      state.restoreTargetPresets.find((preset) => preset.name.toLowerCase() === name.toLowerCase()) ||
      null
    );
  };
  const syncPresetSaveButton = () => {
    presetSaveButton.textContent = currentPresetMatch() ? "Update Preset" : "Save Preset";
  };
  syncPresetSaveButton();
  presetNameInput.addEventListener("input", () => {
    state.restoreTargetPresetDraft = presetNameInput.value;
    syncPresetSaveButton();
  });
  presetSaveButton.addEventListener("click", () =>
    runTask(async () => {
      const name = presetNameInput.value.trim();
      const matchingPreset = currentPresetMatch();
      if (!name) {
        showToast("Preset name is required.", "warning");
        return;
      }
      const targetPaths = getSelectedRestoreTargets();
      if (!targetPaths.length) {
        showToast("Select at least one target home first.", "warning");
        return;
      }

      const savePreset = async () => {
        const result = await request("/api/history/restore-target-presets", {
          method: "POST",
          body: JSON.stringify({
            presetId: matchingPreset?.id || "",
            name,
            targetPaths,
          }),
        });
        state.restoreTargetPresetDraft = result.preset.name;
        showToast(
          result.mode === "updated"
            ? `Preset ${result.preset.name} updated.`
            : `Preset ${result.preset.name} saved.`,
          "success",
        );
        await refreshHomes();
      };

      if (matchingPreset) {
        await confirmAction(
          {
            title: `Update preset ${matchingPreset.name}?`,
            message:
              "Harbor will overwrite the saved target set for this preset with the homes currently selected in Recovery.",
            confirmText: "Update Preset",
            details: [
              `Preset: ${matchingPreset.name}`,
              `Selected homes: ${targetPaths.length}`,
            ],
          },
          savePreset,
        );
        return;
      }

      await savePreset();
    }),
  );
  restoreTargetsList.append(presetPanel);

  const savedPresetsPanel = document.createElement("div");
  savedPresetsPanel.className = "stack compact-stack";
  if (state.restoreTargetPresets.length === 0) {
    savedPresetsPanel.innerHTML = `<p class="muted">No saved target presets yet.</p>`;
  } else {
    state.restoreTargetPresets.forEach((preset) => {
      const resolvedLabels = preset.resolvedHomes
        .slice(0, 3)
        .map((home) => home.displayLabel || home.label)
        .join(", ");
      const extraResolved = preset.resolvedHomes.length > 3
        ? ` +${preset.resolvedHomes.length - 3} more`
        : "";
      const card = document.createElement("article");
      card.className = "home-card";
      card.innerHTML = `
        <div class="home-head">
          <div>
            <h4>${escapeHtml(preset.name)}</h4>
            <p class="muted">${preset.resolvedCount}/${preset.targetCount} target${preset.targetCount === 1 ? "" : "s"} currently available${
              preset.missingCount ? ` · ${preset.missingCount} missing` : ""
            }</p>
          </div>
          <span class="chip">${preset.targetCount} saved</span>
        </div>
        <p class="path">${
          resolvedLabels
            ? `${escapeHtml(resolvedLabels)}${escapeHtml(extraResolved)}`
            : "No current homes match this preset."
        }</p>
        ${
          preset.missingTargetPaths.length
            ? `<p class="muted">Missing paths: ${escapeHtml(preset.missingTargetPaths.join(", "))}</p>`
            : ""
        }
        <div class="home-actions">
          <button class="ghost-button" data-preset-action="apply" ${
            preset.resolvedTargetPaths.length === 0 ? "disabled" : ""
          }>Apply Preset</button>
          <button class="warn-button" data-preset-action="delete">Delete Preset</button>
        </div>
      `;

      card.querySelector('[data-preset-action="apply"]').addEventListener("click", () => {
        state.restoreTargetPaths = [...preset.resolvedTargetPaths];
        state.restoreTargetPresetDraft = preset.name;
        renderRestoreTargets();
        showToast(
          preset.missingCount
            ? `Applied ${preset.name}. ${preset.missingCount} saved path${preset.missingCount === 1 ? "" : "s"} are currently missing.`
            : `Applied ${preset.name}.`,
          preset.missingCount ? "warning" : "success",
        );
      });

      card.querySelector('[data-preset-action="delete"]').addEventListener("click", () =>
        runTask(() =>
          confirmAction(
            {
              title: `Delete preset ${preset.name}?`,
              message: "Harbor will remove this saved target set from the local config.",
              confirmText: "Delete Preset",
              tone: "warn",
              details: [
                `Saved targets: ${preset.targetCount}`,
                preset.missingCount
                  ? `Missing paths right now: ${preset.missingCount}`
                  : "All saved paths still resolve to known homes.",
              ],
            },
            async () => {
              const result = await request("/api/history/restore-target-presets", {
                method: "DELETE",
                body: JSON.stringify({ presetId: preset.id }),
              });
              if (
                state.restoreTargetPresetDraft.trim().toLowerCase() ===
                preset.name.toLowerCase()
              ) {
                state.restoreTargetPresetDraft = "";
              }
              repairLog.textContent = result.operations.join("\n");
              showToast(`${preset.name} deleted.`, "success");
              await refreshHomes();
            },
          ),
        ),
      );

      savedPresetsPanel.append(card);
    });
  }
  restoreTargetsList.append(savedPresetsPanel);

  const filterPanel = document.createElement("div");
  filterPanel.className = "restore-filter-panel";
  filterPanel.innerHTML = `
    <div class="choice-toolbar">
      <label class="filter-field">
        <span>Filter by account</span>
        <select data-target-filter="account">
          ${accountOptions
            .map(
              (option) =>
                `<option value="${escapeHtml(option.value)}" ${option.value === state.restoreTargetAccountFilter ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="filter-field">
        <span>Search target</span>
        <input
          data-target-filter="query"
          type="search"
          placeholder="slot, email, or path"
          value="${escapeHtml(state.restoreTargetQuery)}"
        />
      </label>
    </div>
    <p class="muted">${selectedCount} selected · ${visibleHomes.length}/${state.homes.length} visible</p>
  `;
  filterPanel
    .querySelector('[data-target-filter="account"]')
    .addEventListener("change", (event) => {
      state.restoreTargetAccountFilter = event.currentTarget.value;
      renderRestoreTargets();
    });
  const queryInput = filterPanel.querySelector('[data-target-filter="query"]');
  queryInput.addEventListener(
    "input",
    debounce(() => {
      state.restoreTargetQuery = queryInput.value;
      renderRestoreTargets();
    }, 120),
  );
  restoreTargetsList.append(filterPanel);

  const controls = document.createElement("div");
  controls.className = "tag-row";
  controls.innerHTML = `
    <button type="button" class="ghost-button compact-button" data-target-action="all">Select All</button>
    <button type="button" class="ghost-button compact-button" data-target-action="none">Clear</button>
    <button type="button" class="ghost-button compact-button" data-target-action="visible">Select Visible</button>
    <button type="button" class="ghost-button compact-button" data-target-action="hidden">Clear Visible</button>
  `;
  controls.querySelector('[data-target-action="all"]').addEventListener("click", () => {
    state.restoreTargetPaths = state.homes.map((home) => home.path);
    renderRestoreTargets();
  });
  controls.querySelector('[data-target-action="none"]').addEventListener("click", () => {
    state.restoreTargetPaths = [];
    renderRestoreTargets();
  });
  controls.querySelector('[data-target-action="visible"]').addEventListener("click", () => {
    setRestoreTargetSelection(
      visibleHomes.map((home) => home.path),
      true,
    );
    renderRestoreTargets();
  });
  controls.querySelector('[data-target-action="hidden"]').addEventListener("click", () => {
    setRestoreTargetSelection(
      visibleHomes.map((home) => home.path),
      false,
    );
    renderRestoreTargets();
  });
  restoreTargetsList.append(controls);

  if (visibleHomes.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "muted";
    emptyState.textContent = "No homes matched the current account filter.";
    restoreTargetsList.append(emptyState);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "choice-grid";

  visibleHomes.forEach((home) => {
    const option = document.createElement("label");
    option.className = "choice-card";
    const checked = state.restoreTargetPaths.includes(home.path);
    if (checked) {
      option.classList.add("selected");
    }
    option.innerHTML = `
      <input type="checkbox" data-home-path="${escapeHtml(home.path)}" ${checked ? "checked" : ""} />
      <div>
        <strong>${escapeHtml(homeDisplayLabel(home))}</strong>
        ${home.alias ? `<p class="muted">${escapeHtml(home.label)}</p>` : ""}
        <p>${escapeHtml(home.account?.email || "no auth")} · ${home.sessionCount} threads</p>
        <p class="path">${escapeHtml(home.path)}</p>
      </div>
    `;
    option.querySelector("input").addEventListener("change", (event) => {
      const targetPath = event.currentTarget.dataset.homePath;
      if (event.currentTarget.checked) {
        if (!state.restoreTargetPaths.includes(targetPath)) {
          state.restoreTargetPaths.push(targetPath);
        }
      } else {
        state.restoreTargetPaths = state.restoreTargetPaths.filter((item) => item !== targetPath);
      }
      option.classList.toggle("selected", event.currentTarget.checked);
      const summary = restoreTargetsList.querySelector(".restore-filter-panel .muted");
      if (summary) {
        summary.textContent = `${state.restoreTargetPaths.length} selected · ${visibleHomes.length}/${state.homes.length} visible`;
      }
    });
    grid.append(option);
  });

  restoreTargetsList.append(grid);
}

function buildSharedHistoryPreviewDetails(preview) {
  const details = [
    `Source: ${preview.sourceRoot}`,
    `Targets: ${(preview.results || []).map((item) => item.home).join(", ") || "none"}`,
    `Indexed sessions: ${preview.uniqueIndexedSessions}/${preview.totalIndexedSessions}`,
    `Mappable session files: ${preview.mappableSourceSessions}`,
  ];

  preview.results?.forEach((item) => {
    details.push(
      `${item.home}: ${item.restoredSessions} session, ${item.restoredArchived} archived file${item.restoredArchived === 1 ? "" : "s"}`,
    );
  });

  if (preview.unresolvedSessionIds?.length) {
    details.push(`Unresolved source ids: ${preview.unresolvedSessionIds.length}`);
  }
  return details;
}

function appendShareLog(payload) {
  const header = [
    `Session ${payload.sessionId}`,
    payload.threadName ? `title: ${payload.threadName}` : null,
    payload.materializedFromHistory ? "source was materialized from history.jsonl first" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [header];
  payload.results.forEach((item) => {
    const actions = item.operations?.length ? item.operations.join(" ") : "No changes were needed.";
    lines.push(`${item.targetLabel}: ${actions}`);
  });
  shareLog.textContent = lines.join("\n");
}

async function refreshConfig() {
  state.config = await request("/api/config");
  fillConfigForm();
}

async function refreshAccountSetup() {
  state.accountSetup = await request("/api/account-setup");
  renderAccountSetup();
}

async function refreshHomes() {
  const [homesData, presetsData] = await Promise.all([
    request("/api/homes"),
    request("/api/history/restore-target-presets"),
  ]);
  state.homes = homesData.homes;
  state.restoreTargetPresets = presetsData.presets || [];
  renderHomes();
  renderRestoreTargets();
  populateHomeSelectors();
  await refreshHealth();
  await refreshBackups();
  await refreshCleanupPlan();
  await refreshAudit();
}

async function refreshHealth() {
  state.healthReport = await request("/api/health");
  renderHealth();
}

async function refreshBackups() {
  state.backupCatalog = await request("/api/backups");
  renderBackups();
}

async function refreshCleanupPlan() {
  state.cleanupPlan = await request("/api/cleanup/stale-slots");
  renderCleanupPlan();
}

async function refreshAudit() {
  state.auditLog = await request("/api/audit?limit=200");
  renderAudit();
}

async function refreshSessions() {
  const targetPath = targetHomeSelect.value;
  const sourcePath = sourceHomeSelect.value;
  const query = sessionQuery.value.trim();
  const params = new URLSearchParams();
  if (targetPath) params.set("targetPath", targetPath);
  if (sourcePath) params.set("sourcePath", sourcePath);
  if (query) params.set("query", query);
  const data = await request(`/api/sessions?${params.toString()}`);
  state.sessions = data.sessions;
  renderSessions();
}

async function fetchSessionPreview(session, targetPath = "") {
  const params = new URLSearchParams({
    sourcePath: session.sourcePath,
    sessionId: session.id,
  });
  if (targetPath) {
    params.set("targetPath", targetPath);
  }
  const data = await request(`/api/sessions/preview?${params.toString()}`);
  return data.preview;
}

async function boot() {
  state.auth = await request("/api/auth/status");
  renderAuthPanel();
  if (!state.auth.authenticated) {
    return;
  }
  initSidebarCollapse();
  await refreshConfig();
  await refreshAccountSetup();
  await refreshHomes();
  await refreshSessions();
  initOpsNavigation();
}

confirmCancelButton.addEventListener("click", () => closeConfirmation(false));
confirmSubmitButton.addEventListener("click", () => closeConfirmation(true));
confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmation(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !confirmModal.classList.contains("hidden")) {
    closeConfirmation(false);
  }
});

document.querySelector("#logout-button").addEventListener("click", () => runTask(handleLogout));
document.querySelector("#save-config-button").addEventListener("click", () =>
  runTask(() =>
    confirmAction(
      {
        title: "Save path settings?",
        message:
          "Agent Harbor will update the runtime config, refresh the detected homes, and re-evaluate the account slot layout.",
        confirmText: "Save Paths",
        details: [
          `App name: ${configForm.elements.appName.value || "Agent Harbor"}`,
          `Slots: ${configForm.elements.isolatedAccountSlots.value || "3"}`,
          `Extensions mode: ${configForm.elements.extensionsMode.value}`,
        ],
      },
      async () => {
        const payload = {
          appName: configForm.elements.appName.value,
          setup: {
            isolatedAccountSlots: Number(configForm.elements.isolatedAccountSlots.value || 3),
            extensionsMode: configForm.elements.extensionsMode.value,
          },
          roots: {
            mainCodexHome: configForm.elements.mainCodexHome.value,
            mainVSCodeExtensionsDir: configForm.elements.mainVSCodeExtensionsDir.value,
            isolatedProfilesRoot: configForm.elements.isolatedProfilesRoot.value,
            sharedExtensionsDir: configForm.elements.sharedExtensionsDir.value,
            sharedSessionsRoot: configForm.elements.sharedSessionsRoot.value,
            launcherBinDir: configForm.elements.launcherBinDir.value,
            mainVSCodeStateDb: configForm.elements.mainVSCodeStateDb.value,
          },
        };
        await request("/api/config", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Path settings saved.", "success");
        await refreshConfig();
        await refreshAccountSetup();
        await refreshHomes();
        await refreshSessions();
      },
    ),
  ),
);

document.querySelector("#refresh-account-setup-button").addEventListener("click", () =>
  runTask(refreshAccountSetup),
);
document.querySelector("#prepare-all-slots-button").addEventListener("click", () =>
  runTask(() =>
    confirmAction(
      {
        title: "Prepare all account slots?",
        message:
          "Harbor will create or refresh every isolated slot defined in the current config, including runtime folders but without forcing a default workspace file.",
        confirmText: "Prepare All",
        details: [
          `Total slots: ${state.config?.setup?.isolatedAccountSlots || 0}`,
          "Custom launch targets will be validated before launcher regeneration continues.",
        ],
      },
      async () => {
        const result = await request("/api/account-setup/prepare", {
          method: "POST",
          body: "{}",
        });
        appendAccountSetupLog(result);
        showToast("Semua slot akun sudah disiapkan.", "success");
        await refreshAccountSetup();
        await refreshHomes();
        await refreshSessions();
      },
    ),
  ),
);
document.querySelector("#install-launchers-button").addEventListener("click", () =>
  runTask(() =>
    confirmAction(
      {
        title: "Install or update launchers?",
        message:
          "Launcher scripts di folder bin akan ditulis ulang supaya sinkron dengan config Agent Harbor saat ini.",
        confirmText: "Install Launchers",
        details: [
          `Bin dir: ${configForm.elements.launcherBinDir.value}`,
          `Extensions mode: ${configForm.elements.extensionsMode.value}`,
        ],
      },
      async () => {
        const result = await request("/api/launchers/install", {
          method: "POST",
          body: "{}",
        });
        appendAccountSetupLog(result);
        showToast("Launcher scripts updated.", "success");
        await refreshAccountSetup();
      },
    ),
  ),
);
document.querySelector("#sync-extensions-button").addEventListener("click", () =>
  runTask(() =>
    confirmAction(
      {
        title: "Sync shared extensions from main VS Code?",
        message:
          "Harbor akan menyalin extension yang terpasang di VS Code utama ke shared extensions directory yang dipakai launcher codex.",
        confirmText: "Sync Extensions",
        details: [
          `Source: ${configForm.elements.mainVSCodeExtensionsDir.value}`,
          `Target: ${configForm.elements.sharedExtensionsDir.value}`,
        ],
      },
      async () => {
        const result = await request("/api/extensions/sync", {
          method: "POST",
          body: JSON.stringify({ force: false }),
        });
        appendAccountSetupLog(result);
        showToast("Shared extensions synced.", "success");
        await refreshAccountSetup();
      },
    ),
  ),
);
toggleNoAuthHomesButton.addEventListener("click", () => {
  state.hideHomesWithoutAuth = !state.hideHomesWithoutAuth;
  renderHomes();
});
document.querySelector("#refresh-health-button").addEventListener("click", () => runTask(refreshHealth));
document.querySelector("#refresh-backups-button").addEventListener("click", () => runTask(refreshBackups));
document.querySelector("#refresh-audit-button").addEventListener("click", () => runTask(refreshAudit));
document.querySelector("#refresh-cleanup-button").addEventListener("click", () => runTask(refreshCleanupPlan));
document.querySelector("#refresh-homes-button").addEventListener("click", () => runTask(refreshHomes));
auditActionFilter.addEventListener("change", () => {
  state.auditActionFilter = auditActionFilter.value;
  renderAudit();
});
auditQuery.addEventListener(
  "input",
  debounce(() => {
    state.auditQuery = auditQuery.value;
    renderAudit();
  }, 120),
);
backupsHomeFilter.addEventListener("change", () => {
  state.backupCatalogHomeFilter = backupsHomeFilter.value;
  renderBackups();
});
backupsKindFilter.addEventListener("change", () => {
  state.backupCatalogKindFilter = backupsKindFilter.value;
  renderBackups();
});
backupsQuery.addEventListener("input", () => {
  state.backupCatalogQuery = backupsQuery.value;
  renderBackups();
});
backupsSort.addEventListener("change", () => {
  state.backupCatalogSort = backupsSort.value;
  renderBackups();
});
document.querySelector("#refresh-sessions-button").addEventListener("click", () =>
  runTask(refreshSessions),
);
document.querySelector("#share-current-button").addEventListener("click", () =>
  runTask(() =>
    confirmAction(
      {
        title: "Share current session to all homes?",
        message:
          "Harbor akan mengambil session terbaru dari source home yang dipilih lalu broadcast ke semua home lain secara aman.",
        confirmText: "Share Session",
        details: [
          `Source: ${shareSourceHomeSelect.selectedOptions[0]?.textContent || "not selected"}`,
          overwriteToggle.checked ? "Overwrite existing target copy: yes" : "Overwrite existing target copy: no",
        ],
      },
      async () => {
        const sourcePath = shareSourceHomeSelect.value;
        if (!sourcePath) {
          showToast("Choose a source home first.", "warning");
          return;
        }
        const result = await request("/api/sessions/share-current", {
          method: "POST",
          body: JSON.stringify({
            sourcePath,
            overwrite: overwriteToggle.checked,
          }),
        });
        appendShareLog(result);
        showToast(`Shared ${result.sessionId} from ${result.sourceLabel}.`, "success");
        await refreshHomes();
        await refreshSessions();
      },
    ),
  ),
);
document.querySelector("#repair-all-button").addEventListener("click", () =>
  runTask(() =>
    confirmAction(
      {
        title: "Run repair sweep for all homes?",
        message:
          "Harbor akan memeriksa semua home yang terdeteksi, melepas shared session link, dan mengembalikan storage lokal per akun.",
        confirmText: "Repair All Homes",
        tone: "warn",
        details: [
          repairResetToggle.checked
            ? "Reset VS Code openai.chatgpt state: yes"
            : "Reset VS Code openai.chatgpt state: no",
        ],
      },
      async () => {
        const result = await request("/api/repair/all", {
          method: "POST",
          body: JSON.stringify({
            resetOpenAIState: repairResetToggle.checked,
          }),
        });
        appendRepairLog(result);
        showToast("Repair sweep finished.", "success");
        await refreshHomes();
      },
    ),
  ),
);
document.querySelector("#run-cleanup-button").addEventListener("click", () =>
  runTask(async () => {
    if (!state.cleanupTargetPaths.length) {
      showToast("Choose at least one stale slot candidate.", "warning");
      return;
    }
    const selectedItems = (state.cleanupPlan?.candidates || []).filter((item) =>
      state.cleanupTargetPaths.includes(item.path),
    );
    await confirmAction(
      {
        title: "Archive selected stale slots?",
        message:
          "Harbor will move each selected no-auth slot into the isolated archive root instead of deleting it.",
        confirmText: "Archive Selected Slots",
        tone: "warn",
        details: [
          `Selected slots: ${selectedItems.map((item) => item.label).join(", ")}`,
          `Selected thread count: ${selectedItems.reduce((sum, item) => sum + Number(item.sessionCount || 0), 0)}`,
          cleanupReduceSlotCountToggle.checked
            ? `Auto-lower slot count when possible: yes${state.cleanupPlan?.reducibleNow ? ` (current ${state.cleanupPlan.currentSlotCount} → suggested ${state.cleanupPlan.suggestedSlotCount})` : ""}`
            : "Auto-lower slot count when possible: no",
        ],
      },
      async () => {
        const result = await request("/api/cleanup/stale-slots", {
          method: "POST",
          body: JSON.stringify({
            homePaths: state.cleanupTargetPaths,
            reduceSlotCount: cleanupReduceSlotCountToggle.checked,
          }),
        });
        cleanupLog.textContent = [
          ...result.operations,
          ...result.results.flatMap((item) => item.operations || []),
        ].join("\n");
        showToast(`Archived ${result.cleanedCount} stale slot${result.cleanedCount === 1 ? "" : "s"}.`, "success");
        await refreshConfig();
        await refreshAccountSetup();
        await refreshHomes();
        await refreshSessions();
      },
    );
  }),
);
document.querySelector("#preview-shared-history-button").addEventListener("click", () =>
  runTask(async () => {
    const targetPaths = getSelectedRestoreTargets();
    if (!targetPaths.length) {
      showToast("Choose at least one target home.", "warning");
      return;
    }
    const result = await request("/api/history/restore-shared", {
      method: "POST",
      body: JSON.stringify({
        dryRun: true,
        includeArchived: restoreArchivedToggle.checked,
        targetPaths,
      }),
    });
    appendSharedHistoryRestoreLog(result);
    showToast("Shared-history preview ready.", "success");
  }),
);
document.querySelector("#restore-shared-history-button").addEventListener("click", () =>
  runTask(async () => {
    const targetPaths = getSelectedRestoreTargets();
    if (!targetPaths.length) {
      showToast("Choose at least one target home.", "warning");
      return;
    }

    const preview = await request("/api/history/restore-shared", {
      method: "POST",
      body: JSON.stringify({
        dryRun: true,
        includeArchived: restoreArchivedToggle.checked,
        targetPaths,
      }),
    });
    appendSharedHistoryRestoreLog(preview);

    await confirmAction(
      {
        title: "Restore shared-era history into selected homes?",
        message:
          "Harbor akan membaca backup history dari shared sessions root lama, lalu merge session yang belum ada ke home lokal yang Anda pilih.",
        confirmText: "Restore History",
        details: buildSharedHistoryPreviewDetails(preview),
      },
      async () => {
        const result = await request("/api/history/restore-shared", {
          method: "POST",
          body: JSON.stringify({
            includeArchived: restoreArchivedToggle.checked,
            targetPaths,
          }),
        });
        appendSharedHistoryRestoreLog(result);
        showToast("Shared-era history restored.", "success");
        await refreshHomes();
        await refreshSessions();
      },
    );
  }),
);
targetHomeSelect.addEventListener("change", () => runTask(refreshSessions));
sourceHomeSelect.addEventListener("change", () => runTask(refreshSessions));
sessionQuery.addEventListener("input", debounce(() => runTask(refreshSessions), 220));

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

boot().catch((error) => {
  showToast(error.message, "warning");
  console.error(error);
});
