import crypto from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const STORAGE_DIR = path.join(PROJECT_ROOT, "storage");
const CONFIG_PATH = path.join(STORAGE_DIR, "app-config.json");
const SECRET_PATH = path.join(STORAGE_DIR, "session-secret.txt");
const COOKIE_NAME = "agent_harbor_session";
const DEFAULT_PORT = Number(process.env.PORT || 4317);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

await fs.mkdir(STORAGE_DIR, { recursive: true });

function nowIso() {
  return new Date().toISOString();
}

function timestampTag() {
  return nowIso().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function defaultConfig() {
  const homeRoot = os.homedir();
  return {
    appName: "Agent Harbor",
    roots: {
      homeRoot,
      mainCodexHome: path.join(homeRoot, ".codex"),
      mainVSCodeExtensionsDir: path.join(homeRoot, ".vscode", "extensions"),
      isolatedProfilesRoot: path.join(homeRoot, ".vscode-isolated"),
      sharedExtensionsDir: path.join(homeRoot, ".vscode-agent-hub", "extensions"),
      sharedSessionsRoot: path.join(homeRoot, ".codex-shared"),
      launcherBinDir: path.join(homeRoot, ".local", "bin"),
      mainVSCodeStateDb: path.join(
        homeRoot,
        ".config",
        "Code",
        "User",
        "globalStorage",
        "state.vscdb",
      ),
    },
    setup: {
      isolatedAccountSlots: 3,
      extensionsMode: "shared",
    },
    auth: null,
  };
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const defaults = defaultConfig();
    return {
      ...defaults,
      ...parsed,
      roots: {
        ...defaults.roots,
        ...(parsed.roots || {}),
      },
      setup: {
        ...defaults.setup,
        ...(parsed.setup || {}),
      },
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      const fresh = defaultConfig();
      await saveConfig(fresh);
      return fresh;
    }
    throw error;
  }
}

async function saveConfig(config) {
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function getSigningSecret() {
  try {
    return (await fs.readFile(SECRET_PATH, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    const secret = crypto.randomBytes(32).toString("hex");
    await fs.writeFile(SECRET_PATH, `${secret}\n`, "utf8");
    return secret;
  }
}

function normalizePath(input) {
  return path.resolve(input.replace(/^~(?=$|\/|\\)/, os.homedir()));
}

function clampSlotCount(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }
  return Math.min(12, Math.max(1, parsed));
}

function sanitizeExtensionsMode(value) {
  return value === "isolated" ? "isolated" : "shared";
}

function shellPathWithHome(targetPath) {
  const normalized = targetPath.replace(/\\/g, "/");
  const homeRoot = os.homedir().replace(/\\/g, "/");
  if (normalized === homeRoot) {
    return "${HOME}";
  }
  if (normalized.startsWith(`${homeRoot}/`)) {
    return `\${HOME}${normalized.slice(homeRoot.length)}`;
  }
  return normalized;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function mainExtensionsSourceDir(config) {
  return normalizePath(
    config.roots.mainVSCodeExtensionsDir || path.join(os.homedir(), ".vscode", "extensions"),
  );
}

async function listSeedableExtensionFolders(targetDir) {
  if (!(await pathExists(targetDir))) {
    return [];
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  return entries
    .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function sanitizeSharedExtensionsMetadata(targetDir) {
  const removed = [];
  for (const fileName of [".obsolete", "extensions.json"]) {
    const filePath = path.join(targetDir, fileName);
    if (await pathExists(filePath)) {
      await fs.rm(filePath, { force: true });
      removed.push(`Removed stale ${fileName} from shared extensions directory.`);
    }
  }
  return removed;
}

async function syncSharedExtensions(config, { force = false } = {}) {
  const sourceDir = mainExtensionsSourceDir(config);
  const targetDir = normalizePath(config.roots.sharedExtensionsDir);

  if (!(await pathExists(sourceDir))) {
    throw new Error(`Main VS Code extensions directory not found: ${sourceDir}`);
  }

  const sourceFolders = await listSeedableExtensionFolders(sourceDir);
  if (sourceFolders.length === 0) {
    throw new Error(`No extension folders found in ${sourceDir}`);
  }

  await fs.mkdir(targetDir, { recursive: true });
  const targetFolders = new Set(await listSeedableExtensionFolders(targetDir));
  let copied = 0;
  let skipped = 0;

  for (const folderName of sourceFolders) {
    if (!force && targetFolders.has(folderName)) {
      skipped += 1;
      continue;
    }

    await fs.cp(path.join(sourceDir, folderName), path.join(targetDir, folderName), {
      recursive: true,
      force: true,
      errorOnExist: false,
      preserveTimestamps: true,
    });
    copied += 1;
  }

  const metadataOperations = await sanitizeSharedExtensionsMetadata(targetDir);
  const operations = [
    `Synced ${copied} extension folder${copied === 1 ? "" : "s"} from ${sourceDir} to ${targetDir}.`,
  ];
  if (skipped > 0) {
    operations.push(`Skipped ${skipped} folder${skipped === 1 ? "" : "s"} that already existed.`);
  }
  operations.push(...metadataOperations);

  return {
    sourceDir,
    targetDir,
    totalSource: sourceFolders.length,
    copied,
    skipped,
    operations,
  };
}

async function maybeSeedSharedExtensions(config) {
  if (sanitizeExtensionsMode(config.setup?.extensionsMode) !== "shared") {
    return null;
  }

  const targetDir = normalizePath(config.roots.sharedExtensionsDir);
  const sourceDir = mainExtensionsSourceDir(config);
  const sourceFolders = await listSeedableExtensionFolders(sourceDir);
  const existingFolders = await listSeedableExtensionFolders(targetDir);
  const missingFolders = sourceFolders.filter((folderName) => !existingFolders.includes(folderName));
  const metadataOperations = await sanitizeSharedExtensionsMetadata(targetDir);

  if (existingFolders.length > 0 && missingFolders.length === 0) {
    return {
      status: "ready",
      sourceDir,
      targetDir,
      totalSource: sourceFolders.length,
      copied: 0,
      skipped: sourceFolders.length,
      operations: [
        `Shared extensions already available (${existingFolders.length} folders).`,
        ...metadataOperations,
      ],
    };
  }

  try {
    const result = await syncSharedExtensions(config);
    return {
      status: "seeded",
      ...result,
    };
  } catch (error) {
    return {
      status: "warning",
      sourceDir: mainExtensionsSourceDir(config),
      targetDir,
      totalSource: 0,
      copied: 0,
      skipped: 0,
      operations: [`Could not seed shared extensions automatically: ${error.message}`],
      warning: error.message,
    };
  }
}

async function discoverHomes(config) {
  const homes = [];
  const mainHome = normalizePath(config.roots.mainCodexHome);
  if (await pathExists(mainHome)) {
    homes.push(await describeHome("main", mainHome, config));
  }

  const isolatedRoot = normalizePath(config.roots.isolatedProfilesRoot);
  if (await pathExists(isolatedRoot)) {
    const entries = await fs.readdir(isolatedRoot, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || !entry.name.startsWith("codex-")) {
        continue;
      }
      const homePath = path.join(isolatedRoot, entry.name, "codex-home");
      if (await pathExists(homePath)) {
        homes.push(await describeHome(entry.name, homePath, config));
      }
    }
  }

  return homes;
}

function isolatedSlotKey(index) {
  return `codex-${index}`;
}

function isolatedSlotPaths(config, slotKey) {
  const isolatedRoot = normalizePath(config.roots.isolatedProfilesRoot);
  const slotRoot = path.join(isolatedRoot, slotKey);
  return {
    slotKey,
    slotRoot,
    workspaceRoot: path.join(slotRoot, "workspace"),
    workspacePath: path.join(slotRoot, "workspace", `${slotKey}.code-workspace`),
    userDataDir: path.join(slotRoot, "user-data"),
    localExtensionsDir: path.join(slotRoot, "extensions"),
    xdgConfigDir: path.join(slotRoot, "xdg", "config"),
    xdgCacheDir: path.join(slotRoot, "xdg", "cache"),
    xdgDataDir: path.join(slotRoot, "xdg", "data"),
    codexHome: path.join(slotRoot, "codex-home"),
    cloudsdkConfigDir: path.join(slotRoot, "cloudsdk"),
  };
}

function extensionsConfigForSlot(config, slotKey) {
  const paths = isolatedSlotPaths(config, slotKey);
  const mode = sanitizeExtensionsMode(config.setup?.extensionsMode);
  const dir =
    mode === "shared"
      ? normalizePath(config.roots.sharedExtensionsDir)
      : paths.localExtensionsDir;
  return {
    mode,
    dir,
  };
}

async function accountSetupSlot(config, order, discoveredHome = null) {
  const slotKey = isolatedSlotKey(order);
  const paths = isolatedSlotPaths(config, slotKey);
  const extensions = extensionsConfigForSlot(config, slotKey);
  const authSummary = discoveredHome?.account || (await loadAuthSummary(paths.codexHome));
  const sessionCount =
    discoveredHome?.sessionCount ??
    (await countIndexEntries(path.join(paths.codexHome, "session_index.jsonl")));
  const prepared = await pathExists(paths.slotRoot);
  const workspaceReady = await pathExists(paths.workspacePath);
  const connected = Boolean(authSummary.email || authSummary.accountIdSuffix);
  const status = connected ? "connected" : prepared ? "awaiting_login" : "not_prepared";
  const statusLabel =
    status === "connected"
      ? `${authSummary.email || "account"} connected`
      : status === "awaiting_login"
        ? "slot ready, waiting for ChatGPT login"
        : "slot not prepared yet";

  return {
    order,
    displayName: `Account ${order}`,
    slotKey,
    status,
    statusLabel,
    prepared,
    workspaceReady,
    connected,
    homePath: paths.codexHome,
    workspacePath: paths.workspacePath,
    rootPath: paths.slotRoot,
    extensionsMode: extensions.mode,
    extensionsPath: extensions.dir,
    launcherPath: path.join(normalizePath(config.roots.launcherBinDir), `code-${slotKey}`),
    account: authSummary,
    sessionCount,
  };
}

async function listAccountSetup(config) {
  const homes = await discoverHomes(config);
  const discovered = new Map(homes.map((home) => [home.label, home]));
  const isolatedAccountSlots = clampSlotCount(config.setup?.isolatedAccountSlots);
  const slots = [];
  for (let index = 1; index <= isolatedAccountSlots; index += 1) {
    slots.push(await accountSetupSlot(config, index, discovered.get(isolatedSlotKey(index)) || null));
  }

  return {
    isolatedAccountSlots,
    guide: [
      "Prepare slot Account 1, Account 2, lalu Account 3 dari panel ini.",
      "Extension binaries boleh shared supaya install sekali saja, tetapi auth/runtime state tiap slot tetap terisolasi.",
      "Kalau launcher codex belum melihat extension dari VS Code utama, jalankan Sync Extensions untuk menyalin binary extension ke shared directory.",
      "Klik Launch VS Code pada satu slot, lalu sign in ke extension ChatGPT/Codex, Claude, Copilot, atau Gemini di window itu.",
      "Selesaikan login browser untuk akun yang sesuai, lalu kembali ke Harbor dan klik Refresh Slots.",
      "Kalau email sudah muncul di card slot, lanjut ke slot berikutnya tanpa pernah share auth state antar slot.",
    ],
    slots,
  };
}

function isolatedArchiveRoot(config) {
  return `${normalizePath(config.roots.isolatedProfilesRoot)}-archive`;
}

async function archiveNoAuthHome(config, { homePath }) {
  const normalizedHomePath = normalizePath(homePath);
  const homes = await discoverHomes(config);
  const home = homes.find((item) => item.path === normalizedHomePath);

  if (!home) {
    throw new Error(`Home not found: ${normalizedHomePath}`);
  }
  if (!home.isIsolatedSlot || !home.slotKey || !home.slotRoot) {
    throw new Error("Only isolated codex slots can be archived.");
  }
  if (!home.authMissing) {
    throw new Error(`${home.label} still has auth data. Refusing to archive as a no-auth slot.`);
  }
  if (!(await pathExists(home.slotRoot))) {
    throw new Error(`Slot root not found: ${home.slotRoot}`);
  }

  const tag = timestampTag();
  const archiveRoot = isolatedArchiveRoot(config);
  const archivedSlotRoot = path.join(archiveRoot, `${home.slotKey}.${tag}`);
  const archiveBinDir = path.join(archiveRoot, "bin");
  const launcherBinDir = normalizePath(config.roots.launcherBinDir);
  const operations = [];

  await fs.mkdir(archiveRoot, { recursive: true });
  await fs.rename(home.slotRoot, archivedSlotRoot);
  operations.push(`Archived ${home.slotRoot} to ${archivedSlotRoot}.`);

  for (const launcherName of [`code-${home.slotKey}`, home.slotKey]) {
    const sourcePath = path.join(launcherBinDir, launcherName);
    if (!(await pathExists(sourcePath))) {
      continue;
    }
    await fs.mkdir(archiveBinDir, { recursive: true });
    const archivedLauncherPath = path.join(archiveBinDir, `${launcherName}.${tag}`);
    await fs.rename(sourcePath, archivedLauncherPath);
    operations.push(`Archived launcher ${sourcePath} to ${archivedLauncherPath}.`);
  }

  const slotOrder = Number.parseInt(home.slotKey.replace("codex-", ""), 10);
  const slotCount = clampSlotCount(config.setup?.isolatedAccountSlots);
  if (Number.isFinite(slotOrder) && slotOrder <= slotCount) {
    operations.push(
      `Config still allows ${slotCount} slot(s); lower isolatedAccountSlots if you do not want ${home.slotKey} recreated later.`,
    );
  }

  return {
    ok: true,
    home: home.label,
    archivedSlotRoot,
    archiveRoot,
    operations,
  };
}

async function ensureDir(targetPath, operations, message) {
  if (!(await pathExists(targetPath))) {
    await fs.mkdir(targetPath, { recursive: true });
    operations.push(message);
  } else {
    await fs.mkdir(targetPath, { recursive: true });
  }
}

async function prepareAccountSlot(config, slotKey) {
  if (!/^codex-\d+$/.test(slotKey)) {
    throw new Error("Invalid slot key.");
  }

  const paths = isolatedSlotPaths(config, slotKey);
  const extensions = extensionsConfigForSlot(config, slotKey);
  const operations = [];

  await ensureDir(paths.slotRoot, operations, `Created ${slotKey} root.`);
  await ensureDir(paths.userDataDir, operations, "Prepared isolated VS Code user-data.");
  await ensureDir(
    extensions.dir,
    operations,
    extensions.mode === "shared"
      ? "Prepared shared extensions directory."
      : "Prepared isolated extensions directory.",
  );
  await ensureDir(paths.workspaceRoot, operations, "Prepared workspace directory.");
  await ensureDir(paths.xdgConfigDir, operations, "Prepared XDG config directory.");
  await ensureDir(paths.xdgCacheDir, operations, "Prepared XDG cache directory.");
  await ensureDir(paths.xdgDataDir, operations, "Prepared XDG data directory.");
  await ensureDir(paths.codexHome, operations, "Prepared CODEX_HOME directory.");
  await ensureDir(paths.cloudsdkConfigDir, operations, "Prepared Cloud SDK config directory.");

  const sharedExtensions = await maybeSeedSharedExtensions(config);
  if (sharedExtensions?.status === "seeded" || sharedExtensions?.status === "warning") {
    operations.push(...sharedExtensions.operations);
  }

  if (!(await pathExists(paths.workspacePath))) {
    const workspace = {
      folders: [],
      settings: {
        "window.title": `${slotKey} · Agent Harbor`,
      },
    };
    await fs.writeFile(paths.workspacePath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
    operations.push("Created default workspace file.");
  }

  const order = Number(slotKey.replace("codex-", ""));
  const slot = await accountSetupSlot(config, order);
  return {
    slot,
    operations: operations.length > 0 ? operations : ["Slot already prepared."],
  };
}

async function prepareAllAccountSlots(config) {
  const isolatedAccountSlots = clampSlotCount(config.setup?.isolatedAccountSlots);
  const results = [];
  for (let index = 1; index <= isolatedAccountSlots; index += 1) {
    results.push(await prepareAccountSlot(config, isolatedSlotKey(index)));
  }
  return {
    ok: true,
    results,
  };
}

function launchPathEnv() {
  const homeRoot = os.homedir();
  return [
    path.join(homeRoot, ".local", "bin"),
    path.join(homeRoot, ".local", "opt", "go-current", "bin"),
    path.join(homeRoot, "go", "bin"),
    process.env.PATH || "",
  ]
    .filter(Boolean)
    .join(":");
}

async function launchAccountSlot(config, slotKey, { dryRun = false } = {}) {
  const prepared = await prepareAccountSlot(config, slotKey);
  const paths = isolatedSlotPaths(config, slotKey);
  const extensions = extensionsConfigForSlot(config, slotKey);
  const args = [
    "--user-data-dir",
    paths.userDataDir,
    "--extensions-dir",
    extensions.dir,
    "--sync",
    "off",
    "--password-store=basic",
    "--new-window",
    paths.workspacePath,
  ];

  if (!dryRun) {
    const child = spawn("code", args, {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        XDG_CONFIG_HOME: paths.xdgConfigDir,
        XDG_CACHE_HOME: paths.xdgCacheDir,
        XDG_DATA_HOME: paths.xdgDataDir,
        CODEX_HOME: paths.codexHome,
        CLOUDSDK_CONFIG: paths.cloudsdkConfigDir,
        PATH: launchPathEnv(),
      },
    });
    child.unref();
  }

  return {
    ok: true,
    slot: prepared.slot,
    preparedOperations: prepared.operations,
    launched: !dryRun,
    extensionsMode: extensions.mode,
    launch: {
      command: "code",
      args,
    },
    nextSteps: [
      `Di window ${prepared.slot.displayName}, buka extension AI yang Anda pakai lalu pilih Sign in.`,
      "Selesaikan browser auth untuk akun yang memang ingin dipasang di slot itu.",
      "Kembali ke Agent Harbor lalu klik Refresh Slots untuk memastikan auth.json sudah terbaca.",
    ],
  };
}

function launcherScriptContent(config, slotKey) {
  const paths = isolatedSlotPaths(config, slotKey);
  const extensions = extensionsConfigForSlot(config, slotKey);
  const comments =
    extensions.mode === "shared"
      ? "# Share extension binaries, but keep user-data, auth, and agent homes isolated."
      : "# Keep extension installs and runtime state fully isolated for this slot.";

  return `#!/usr/bin/env bash
set -euo pipefail

ISOLATED_ROOT="${shellPathWithHome(paths.slotRoot)}"
USER_DATA_DIR="${shellPathWithHome(paths.userDataDir)}"
EXTENSIONS_DIR="${shellPathWithHome(extensions.dir)}"
DEFAULT_WORKSPACE="${shellPathWithHome(paths.workspacePath)}"
XDG_CONFIG_DIR="${shellPathWithHome(paths.xdgConfigDir)}"
XDG_CACHE_DIR="${shellPathWithHome(paths.xdgCacheDir)}"
XDG_DATA_DIR="${shellPathWithHome(paths.xdgDataDir)}"
CODEX_HOME_DIR="${shellPathWithHome(paths.codexHome)}"
CLOUDSDK_CONFIG_DIR="${shellPathWithHome(paths.cloudsdkConfigDir)}"

${comments}
mkdir -p \\
  "\${USER_DATA_DIR}" \\
  "\${EXTENSIONS_DIR}" \\
  "${shellPathWithHome(paths.workspaceRoot)}" \\
  "\${XDG_CONFIG_DIR}" \\
  "\${XDG_CACHE_DIR}" \\
  "\${XDG_DATA_DIR}" \\
  "\${CODEX_HOME_DIR}" \\
  "\${CLOUDSDK_CONFIG_DIR}"

"\${HOME}/.local/bin/codex-detach-shared-sessions" --home "\${CODEX_HOME_DIR}" >/dev/null 2>&1 || true

if [ ! -f "\${DEFAULT_WORKSPACE}" ]; then
  cat > "\${DEFAULT_WORKSPACE}" <<'WS'
{
  "folders": [],
  "settings": {}
}
WS
fi

if [ "$#" -eq 0 ]; then
  set -- "\${DEFAULT_WORKSPACE}"
fi

PATH_WITH_TOOLS="\${HOME}/.local/bin:\${HOME}/.local/opt/go-current/bin:\${HOME}/go/bin:\${PATH}"

exec env \\
  XDG_CONFIG_HOME="\${XDG_CONFIG_DIR}" \\
  XDG_CACHE_HOME="\${XDG_CACHE_DIR}" \\
  XDG_DATA_HOME="\${XDG_DATA_DIR}" \\
  CODEX_HOME="\${CODEX_HOME_DIR}" \\
  CLOUDSDK_CONFIG="\${CLOUDSDK_CONFIG_DIR}" \\
  PATH="\${PATH_WITH_TOOLS}" \\
  code \\
  --user-data-dir "\${USER_DATA_DIR}" \\
  --extensions-dir "\${EXTENSIONS_DIR}" \\
  --sync off \\
  --password-store=basic \\
  --new-window \\
  "$@"
`;
}

function launcherAliasContent(slotKey) {
  return `#!/usr/bin/env bash
set -euo pipefail
exec "\${HOME}/.local/bin/code-${slotKey}" "$@"
`;
}

async function writeExecutableFile(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
  await fs.chmod(targetPath, 0o755);
}

async function backupIfChanged(targetPath, nextContent, operations, tag) {
  if (!(await pathExists(targetPath))) {
    return;
  }
  const current = await fs.readFile(targetPath, "utf8");
  if (current === nextContent) {
    return;
  }
  const backupPath = `${targetPath}.bak.${tag}`;
  await fs.copyFile(targetPath, backupPath);
  operations.push(`Backed up ${path.basename(targetPath)} to ${path.basename(backupPath)}.`);
}

async function installLaunchers(config) {
  const binDir = normalizePath(config.roots.launcherBinDir);
  const slotCount = clampSlotCount(config.setup?.isolatedAccountSlots);
  const tag = timestampTag();
  const results = [];
  const sharedExtensions = await maybeSeedSharedExtensions(config);

  for (let index = 1; index <= slotCount; index += 1) {
    const slotKey = isolatedSlotKey(index);
    await prepareAccountSlot(config, slotKey);

    const wrapperPath = path.join(binDir, `code-${slotKey}`);
    const aliasPath = path.join(binDir, slotKey);
    const wrapperContent = launcherScriptContent(config, slotKey);
    const aliasContent = launcherAliasContent(slotKey);
    const operations = [];

    await backupIfChanged(wrapperPath, wrapperContent, operations, tag);
    await backupIfChanged(aliasPath, aliasContent, operations, tag);
    await writeExecutableFile(wrapperPath, wrapperContent);
    operations.push(`Installed ${path.basename(wrapperPath)}.`);
    await writeExecutableFile(aliasPath, aliasContent);
    operations.push(`Installed ${path.basename(aliasPath)}.`);

    results.push({
      slotKey,
      wrapperPath,
      aliasPath,
      operations,
    });
  }

  return {
    ok: true,
    binDir,
    sharedExtensions,
    results,
  };
}

async function describeHome(label, homePath, config) {
  const authSummary = await loadAuthSummary(homePath);
  const sessionCount = await countIndexEntries(path.join(homePath, "session_index.jsonl"));
  const slotKey = /^codex-\d+$/.test(label) ? label : null;
  const slotPaths = slotKey ? isolatedSlotPaths(config, slotKey) : null;
  const authMissing = !authSummary.email && !authSummary.accountIdSuffix;
  return {
    label,
    path: homePath,
    account: authSummary,
    sessionCount,
    slotKey,
    slotRoot: slotPaths?.slotRoot || null,
    isIsolatedSlot: Boolean(slotKey),
    authMissing,
    canArchive: Boolean(slotKey && authMissing),
    stateDbPath: stateDbForHome({ label, path: homePath }, config),
  };
}

async function loadAuthSummary(homePath) {
  const authPath = path.join(homePath, "auth.json");
  try {
    const raw = JSON.parse(await fs.readFile(authPath, "utf8"));
    const accessToken = raw?.tokens?.access_token;
    const payload = decodeJwtPayload(accessToken);
    const profile = payload["https://api.openai.com/profile"] || {};
    const auth = payload["https://api.openai.com/auth"] || {};
    const accountId = auth.chatgpt_account_id || "";
    return {
      authMode: raw.auth_mode || null,
      email: profile.email || raw.email || null,
      plan: auth.chatgpt_plan_type || null,
      accountIdSuffix: accountId ? accountId.slice(-8) : null,
    };
  } catch {
    return {
      authMode: null,
      email: null,
      plan: null,
      accountIdSuffix: null,
    };
  }
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") {
    return {};
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    const payload = parts[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

async function countIndexEntries(indexPath) {
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  } catch {
    return 0;
  }
}

async function readIndexEntries(homePath) {
  const indexPath = path.join(homePath, "session_index.jsonl");
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          parsed._raw = line;
          return parsed;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function readHistoryEntries(homePath, sessionId) {
  const historyPath = path.join(homePath, "history.jsonl");
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((entry) => entry?.session_id === sessionId);
  } catch {
    return [];
  }
}

async function latestSessionIdFromHistory(homePath) {
  const historyPath = path.join(homePath, "history.jsonl");
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed?.session_id) {
          return parsed.session_id;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function shortenThreadName(text, limit = 72) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) {
    return "(untitled)";
  }
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit - 3).trimEnd()}...`;
}

function isoFromEpoch(tsSeconds) {
  return new Date(Number(tsSeconds) * 1000).toISOString();
}

function padTime(value) {
  return String(value).padStart(2, "0");
}

function relativeSessionPathFromEpoch(tsSeconds, sessionId) {
  const date = new Date(Number(tsSeconds) * 1000);
  const year = date.getFullYear();
  const month = padTime(date.getMonth() + 1);
  const day = padTime(date.getDate());
  const hours = padTime(date.getHours());
  const minutes = padTime(date.getMinutes());
  const seconds = padTime(date.getSeconds());
  return path.join(
    "sessions",
    String(year),
    month,
    day,
    `rollout-${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${sessionId}.jsonl`,
  );
}

async function appendIndexLine(homePath, rawLine) {
  const indexPath = path.join(homePath, "session_index.jsonl");
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.appendFile(indexPath, `${rawLine}\n`, "utf8");
}

async function ensureIndexEntry(homePath, sessionId, threadName, updatedAt) {
  const entries = await readIndexEntries(homePath);
  const existing = entries.find((entry) => entry.id === sessionId);
  if (existing?._raw) {
    return existing._raw;
  }

  const rawLine = JSON.stringify({
    id: sessionId,
    thread_name: threadName,
    updated_at: updatedAt,
  });
  await appendIndexLine(homePath, rawLine);
  return rawLine;
}

async function materializeSessionFromHistory(homePath, sessionId) {
  const historyEntries = await readHistoryEntries(homePath, sessionId);
  if (historyEntries.length === 0) {
    throw new Error(`Session ${sessionId} not found in history.jsonl.`);
  }

  const firstTs = Number(historyEntries[0].ts);
  const sessionTimestamp = isoFromEpoch(firstTs);
  const updatedAt = isoFromEpoch(Number(historyEntries[historyEntries.length - 1].ts));
  const threadName = shortenThreadName(historyEntries[0].text || "");
  const sessionPath = path.join(homePath, relativeSessionPathFromEpoch(firstTs, sessionId));
  const records = [
    {
      timestamp: sessionTimestamp,
      type: "session_meta",
      payload: {
        id: sessionId,
        timestamp: sessionTimestamp,
        cwd: normalizePath(os.homedir()),
        originator: "codex_vscode",
        cli_version: "0.116.0",
        source: "exec",
        model_provider: "openai",
        base_instructions: {
          text:
            "Materialized from history.jsonl because the live session had not yet been flushed into sessions/.",
        },
      },
    },
    {
      timestamp: sessionTimestamp,
      type: "turn_context",
      payload: {
        turn_id: `${sessionId}-bootstrap`,
        cwd: normalizePath(os.homedir()),
        current_date: nowIso().slice(0, 10),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        approval_policy: "never",
        sandbox_policy: { type: "danger-full-access" },
        model: "gpt-5.4",
        personality: "pragmatic",
        collaboration_mode: {
          mode: "default",
          settings: {
            model: "gpt-5.4",
            reasoning_effort: "xhigh",
            developer_instructions: null,
          },
        },
        realtime_active: false,
        effort: "xhigh",
        summary: "none",
        user_instructions:
          "Portable session imported from history.jsonl for continuation across isolated local profiles.",
      },
    },
  ];

  historyEntries.forEach((entry, index) => {
    const turnId = `${sessionId}-turn-${String(index + 1).padStart(2, "0")}`;
    const userTimestamp = isoFromEpoch(Number(entry.ts));
    const message = String(entry.text || "");
    records.push(
      {
        timestamp: userTimestamp,
        type: "event_msg",
        payload: {
          type: "task_started",
          turn_id: turnId,
          model_context_window: 258400,
          collaboration_mode_kind: "default",
        },
      },
      {
        timestamp: userTimestamp,
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: message }],
        },
      },
      {
        timestamp: userTimestamp,
        type: "event_msg",
        payload: {
          type: "user_message",
          message,
          images: [],
          local_images: [],
          text_elements: [],
        },
      },
      {
        timestamp: userTimestamp,
        type: "event_msg",
        payload: {
          type: "task_complete",
          turn_id: turnId,
          last_agent_message: null,
        },
      },
    );
  });

  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(
    sessionPath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
  const indexRaw = await ensureIndexEntry(homePath, sessionId, threadName, updatedAt);
  return {
    sessionFile: sessionPath,
    indexRaw,
    threadName,
    updatedAt,
    materialized: true,
  };
}

async function ensureSessionReady(homePath, sessionId) {
  const sessionFile = await findSessionFile(homePath, sessionId);
  const entries = await readIndexEntries(homePath);
  const sourceEntry = entries.find((entry) => entry.id === sessionId) || null;
  if (sessionFile) {
    if (sourceEntry?._raw) {
      return {
        sessionFile,
        indexRaw: sourceEntry._raw,
        threadName: sourceEntry.thread_name || "(untitled)",
        updatedAt: sourceEntry.updated_at || null,
        materialized: false,
      };
    }

    const historyEntries = await readHistoryEntries(homePath, sessionId);
    if (historyEntries.length > 0) {
      const threadName = shortenThreadName(historyEntries[0].text || "");
      const updatedAt = isoFromEpoch(Number(historyEntries[historyEntries.length - 1].ts));
      const indexRaw = await ensureIndexEntry(homePath, sessionId, threadName, updatedAt);
      return {
        sessionFile,
        indexRaw,
        threadName,
        updatedAt,
        materialized: false,
      };
    }

    return {
      sessionFile,
      indexRaw: null,
      threadName: "(untitled)",
      updatedAt: null,
      materialized: false,
    };
  }

  return materializeSessionFromHistory(homePath, sessionId);
}

async function findSessionFile(homePath, sessionId) {
  const sessionsRoot = path.join(homePath, "sessions");
  if (!(await pathExists(sessionsRoot))) {
    return null;
  }

  const stack = [sessionsRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name.includes(sessionId) && entry.name.endsWith(".jsonl")) {
        return nextPath;
      }
    }
  }
  return null;
}

async function listJsonlFiles(rootPath) {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const files = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(nextPath);
      }
    }
  }
  return files;
}

async function sessionIdFromSessionFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const firstLine = raw
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);
    if (!firstLine) {
      return null;
    }
    const parsed = JSON.parse(firstLine);
    return parsed?.payload?.id || parsed?.id || null;
  } catch {
    return null;
  }
}

async function mapSessionFilesById(rootPath) {
  const files = await listJsonlFiles(rootPath);
  const byId = new Map();
  for (const filePath of files) {
    const sessionId = await sessionIdFromSessionFile(filePath);
    if (sessionId && !byId.has(sessionId)) {
      byId.set(sessionId, filePath);
    }
  }
  return byId;
}

async function restoreSharedEraHistory(
  config,
  { includeArchived = true, dryRun = false, targetPaths = [] } = {},
) {
  const sourceRoot = normalizePath(config.roots.sharedSessionsRoot);
  if (!(await pathExists(sourceRoot))) {
    throw new Error(`Shared sessions root not found: ${sourceRoot}`);
  }

  const allHomes = await discoverHomes(config);
  if (allHomes.length === 0) {
    throw new Error("No target homes detected for history restore.");
  }

  const normalizedTargets = Array.isArray(targetPaths)
    ? targetPaths.map((targetPath) => normalizePath(String(targetPath))).filter(Boolean)
    : [];
  const homes =
    normalizedTargets.length > 0
      ? allHomes.filter((home) => normalizedTargets.includes(normalizePath(home.path)))
      : allHomes;
  if (homes.length === 0) {
    throw new Error("No matching target homes selected for history restore.");
  }

  const sourceEntries = await readIndexEntries(sourceRoot);
  const sourceIndexById = new Map();
  for (const entry of sourceEntries) {
    const sessionId = entry.id || entry.session_id || entry.sessionId;
    if (sessionId && entry._raw && !sourceIndexById.has(sessionId)) {
      sourceIndexById.set(sessionId, entry._raw);
    }
  }

  const sourceSessionsRoot = path.join(sourceRoot, "sessions");
  const sourceSessionFiles = await mapSessionFilesById(sourceSessionsRoot);
  const sourceArchivedRoot = path.join(sourceRoot, "archived_sessions");
  const sourceArchivedFiles = includeArchived ? await listJsonlFiles(sourceArchivedRoot) : [];
  const unresolvedSessionIds = new Set();
  const results = [];
  const tag = timestampTag();

  for (const home of homes) {
    const targetEntries = await readIndexEntries(home.path);
    const targetIds = new Set(
      targetEntries.map((entry) => entry.id || entry.session_id || entry.sessionId).filter(Boolean),
    );

    const missingIds = [...sourceIndexById.keys()].filter((sessionId) => !targetIds.has(sessionId));
    let restoredSessions = 0;
    let restoredArchived = 0;
    const actions = [];
    let wroteBackup = false;

    for (const sessionId of missingIds) {
      const sourceSessionFile = sourceSessionFiles.get(sessionId);
      if (!sourceSessionFile) {
        unresolvedSessionIds.add(sessionId);
        continue;
      }

      if (!dryRun && !wroteBackup) {
        const targetIndexPath = path.join(home.path, "session_index.jsonl");
        if (await pathExists(targetIndexPath)) {
          const backupPath = `${targetIndexPath}.pre-shared-restore.${tag}.bak`;
          await fs.copyFile(targetIndexPath, backupPath);
          actions.push(`Backed up ${path.basename(targetIndexPath)} before shared-era restore.`);
        }
        wroteBackup = true;
      }

      if (!dryRun) {
        const relative = path.relative(sourceSessionsRoot, sourceSessionFile);
        const targetSessionFile = path.join(home.path, "sessions", relative);
        if (!(await pathExists(targetSessionFile))) {
          await copyEntry(sourceSessionFile, targetSessionFile);
        }
        await appendIndexLine(home.path, sourceIndexById.get(sessionId));
      }
      restoredSessions += 1;
    }

    if (includeArchived) {
      for (const sourceArchivedFile of sourceArchivedFiles) {
        const relative = path.relative(sourceArchivedRoot, sourceArchivedFile);
        const targetArchivedFile = path.join(home.path, "archived_sessions", relative);
        if (await pathExists(targetArchivedFile)) {
          continue;
        }
        if (!dryRun) {
          await copyEntry(sourceArchivedFile, targetArchivedFile);
        }
        restoredArchived += 1;
      }
    }

    if (restoredSessions > 0) {
      actions.push(
        `${dryRun ? "Would restore" : "Restored"} ${restoredSessions} shared-era session index entr${restoredSessions === 1 ? "y" : "ies"}.`,
      );
    }
    if (restoredArchived > 0) {
      actions.push(
        `${dryRun ? "Would copy" : "Copied"} ${restoredArchived} archived shared-era session file${restoredArchived === 1 ? "" : "s"}.`,
      );
    }
    if (actions.length === 0) {
      actions.push(`No shared-era history ${dryRun ? "would be" : "were"} needed.`);
    }

    results.push({
      home: home.label,
      path: home.path,
      restoredSessions,
      restoredArchived,
      actions,
    });
  }

  return {
    sourceRoot,
    totalIndexedSessions: sourceEntries.length,
    uniqueIndexedSessions: sourceIndexById.size,
    mappableSourceSessions: sourceSessionFiles.size,
    includeArchived,
    dryRun,
    targetPaths: homes.map((home) => home.path),
    unresolvedSessionIds: [...unresolvedSessionIds].sort(),
    results,
  };
}

async function listSessions(config, { targetPath, sourcePath, query, limit = 120 }) {
  const homes = await discoverHomes(config);
  const target = homes.find((home) => home.path === targetPath) || null;
  const normalizedQuery = (query || "").trim().toLowerCase();
  const items = [];

  for (const home of homes) {
    if (target && home.path === target.path) {
      continue;
    }
    if (sourcePath && home.path !== sourcePath) {
      continue;
    }

    const entries = await readIndexEntries(home.path);
    for (const entry of entries) {
      const sessionId = entry.id;
      const title = entry.thread_name || "(untitled)";
      if (
        normalizedQuery &&
        !title.toLowerCase().includes(normalizedQuery) &&
        !sessionId.toLowerCase().includes(normalizedQuery)
      ) {
        continue;
      }

      items.push({
        id: sessionId,
        title,
        updatedAt: entry.updated_at || null,
        sourceLabel: home.label,
        sourcePath: home.path,
        sourceEmail: home.account.email,
        sourcePlan: home.account.plan,
        existsInTarget: target ? Boolean(await findSessionFile(target.path, sessionId)) : false,
      });
    }
  }

  items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return items.slice(0, limit);
}

function homeByPath(homes, targetPath) {
  return homes.find((home) => home.path === targetPath) || null;
}

async function copySessionArtifacts({
  source,
  target,
  sessionId,
  sessionFile,
  indexRaw,
  overwrite = false,
}) {
  const relativeSessionPath = path.relative(source.path, sessionFile);
  const targetSessionPath = path.join(target.path, relativeSessionPath);
  const operations = [];

  if ((await pathExists(targetSessionPath)) && !overwrite) {
    operations.push(`Session already exists in ${target.label}; skipped main copy.`);
  } else {
    await copyEntry(sessionFile, targetSessionPath);
    operations.push(`Session log copied into ${target.label}.`);
  }

  const sourceSnapshot = path.join(source.path, "shell_snapshots", `${sessionId}.sh`);
  const targetSnapshot = path.join(target.path, "shell_snapshots", `${sessionId}.sh`);
  if (await pathExists(sourceSnapshot)) {
    if ((await pathExists(targetSnapshot)) && !overwrite) {
      operations.push("Shell snapshot already exists; skipped.");
    } else {
      await copyEntry(sourceSnapshot, targetSnapshot);
      operations.push("Shell snapshot copied.");
    }
  }

  const targetEntries = await readIndexEntries(target.path);
  if (!targetEntries.some((entry) => entry.id === sessionId)) {
    if (indexRaw) {
      await appendIndexLine(target.path, indexRaw);
      operations.push("Session index updated.");
    }
  } else {
    operations.push("Session index already contained this thread.");
  }

  return operations;
}

async function importSession(config, { sourcePath, targetPath, sessionId, overwrite = false }) {
  const homes = await discoverHomes(config);
  const source = homeByPath(homes, sourcePath);
  const target = homeByPath(homes, targetPath);
  if (!source || !target) {
    throw new Error("Source or target home not found.");
  }
  if (source.path === target.path) {
    throw new Error("Source and target homes must be different.");
  }

  const ready = await ensureSessionReady(source.path, sessionId);
  const operations = await copySessionArtifacts({
    source,
    target,
    sessionId,
    sessionFile: ready.sessionFile,
    indexRaw: ready.indexRaw,
    overwrite,
  });

  return {
    ok: true,
    operations,
  };
}

async function shareCurrentSession(config, { sourcePath, overwrite = false }) {
  const homes = await discoverHomes(config);
  const source = homeByPath(homes, sourcePath);
  if (!source) {
    throw new Error("Source home not found.");
  }

  const sessionId = await latestSessionIdFromHistory(source.path);
  if (!sessionId) {
    throw new Error(`Could not determine the latest session from ${source.label}.`);
  }

  const ready = await ensureSessionReady(source.path, sessionId);
  const targets = homes.filter((home) => home.path !== source.path);
  if (targets.length === 0) {
    throw new Error("No other homes available for sharing.");
  }

  const results = [];
  for (const target of targets) {
    const operations = await copySessionArtifacts({
      source,
      target,
      sessionId,
      sessionFile: ready.sessionFile,
      indexRaw: ready.indexRaw,
      overwrite,
    });
    results.push({
      targetLabel: target.label,
      targetPath: target.path,
      operations,
    });
  }

  return {
    ok: true,
    sessionId,
    sourceLabel: source.label,
    sourcePath: source.path,
    threadName: ready.threadName,
    materializedFromHistory: ready.materialized,
    results,
  };
}

async function copyEntry(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    await fs.cp(sourcePath, targetPath, { recursive: true, force: true });
  } else {
    await fs.copyFile(sourcePath, targetPath);
  }
}

function stateDbForHome(home, config) {
  if (home.label === "main") {
    return normalizePath(config.roots.mainVSCodeStateDb);
  }
  const profileRoot = path.dirname(home.path);
  return path.join(profileRoot, "user-data", "User", "globalStorage", "state.vscdb");
}

async function latestBackup(homePath, entryName) {
  const entries = await fs.readdir(homePath);
  const matches = entries
    .filter((name) => name.startsWith(`${entryName}.bak`))
    .sort((a, b) => a.localeCompare(b));
  return matches.length > 0 ? path.join(homePath, matches[matches.length - 1]) : null;
}

async function detachSharedForHome(config, home, { resetOpenAIState = true } = {}) {
  const sharedRoot = normalizePath(config.roots.sharedSessionsRoot);
  const actions = [];
  const tag = timestampTag();

  for (const entryName of ["sessions", "archived_sessions", "session_index.jsonl"]) {
    const entryPath = path.join(home.path, entryName);
    let stats;
    try {
      stats = await fs.lstat(entryPath);
    } catch {
      continue;
    }
    if (!stats.isSymbolicLink()) {
      continue;
    }
    const resolved = await fs.realpath(entryPath);
    if (!resolved.startsWith(sharedRoot)) {
      continue;
    }

    const parked = `${entryPath}.shared-link.${tag}`;
    const backup = await latestBackup(home.path, entryName);
    const source = backup || resolved;
    await fs.rename(entryPath, parked);
    await copyEntry(source, entryPath);
    actions.push(`Detached ${entryName} from shared root.`);
  }

  if (resetOpenAIState) {
    const dbPath = stateDbForHome(home, config);
    if (await pathExists(dbPath)) {
      const backupPath = `${dbPath}.pre-openai-reset.${tag}`;
      await fs.copyFile(dbPath, backupPath);
      const removed = await resetOpenAiState(dbPath);
      if (removed) {
        actions.push("Reset VS Code openai.chatgpt state.");
      }
    }
  }

  return {
    home: home.label,
    path: home.path,
    actions,
  };
}

async function resetOpenAiState(dbPath) {
  const script = `
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
cur = con.cursor()
cur.execute("delete from ItemTable where key = 'openai.chatgpt'")
removed = cur.rowcount
con.commit()
con.close()
print(removed)
`.trim();

  const output = await spawnCollect("python3", ["-c", script, dbPath]);
  return Number(String(output.stdout).trim() || "0") > 0;
}

function spawnCollect(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`));
      }
    });
  });
}

function sanitizeConfig(config) {
  return {
    appName: config.appName,
    roots: config.roots,
    setup: {
      isolatedAccountSlots: clampSlotCount(config.setup?.isolatedAccountSlots),
      extensionsMode: sanitizeExtensionsMode(config.setup?.extensionsMode),
    },
    authConfigured: Boolean(config.auth),
  };
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        return acc;
      }
      acc[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

function createSignedToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySignedToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [encoded, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (signature !== expected) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && payload.exp > Date.now()) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function jsonResponse(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(body);
}

function textResponse(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 1_000_000) {
      throw new Error("Request body too large.");
    }
  }
  return body ? JSON.parse(body) : {};
}

function requiredAuth(handler) {
  return async (context) => {
    if (!context.config.auth) {
      return jsonResponse(context.response, 403, { error: "Create an admin account first." });
    }
    if (!context.session) {
      return jsonResponse(context.response, 401, { error: "Please log in." });
    }
    return handler(context);
  };
}

async function serveStatic(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const resolved = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return textResponse(response, 403, "Forbidden");
  }
  try {
    const content = await fs.readFile(resolved);
    const extension = path.extname(resolved);
    const mimeType = MIME_TYPES[extension] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": content.length,
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return textResponse(response, 404, "Not found");
    }
    return textResponse(response, 500, "Internal server error");
  }
}

async function router(request, response) {
  const config = await loadConfig();
  const secret = await getSigningSecret();
  const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);
  const cookies = parseCookies(request);
  const verifiedSession = verifySignedToken(cookies[COOKIE_NAME], secret);
  const session = config.auth ? verifiedSession : null;
  const context = {
    request,
    response,
    config,
    secret,
    session,
    pathname,
    searchParams,
  };

  try {
    if (pathname === "/api/auth/status" && request.method === "GET") {
      return jsonResponse(response, 200, {
        configured: Boolean(config.auth),
        authenticated: Boolean(session),
        username: session?.username || null,
        appName: config.appName,
      });
    }

    if (pathname === "/api/auth/setup" && request.method === "POST") {
      if (config.auth) {
        return jsonResponse(response, 409, { error: "Admin account already exists." });
      }
      const body = await readJsonBody(request);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!username || password.length < 8) {
        return jsonResponse(response, 400, {
          error: "Username is required and password must be at least 8 characters.",
        });
      }
      config.auth = {
        username,
        passwordHash: createPasswordHash(password),
        createdAt: nowIso(),
      };
      await saveConfig(config);
      const token = createSignedToken(
        { username, exp: Date.now() + 1000 * 60 * 60 * 12 },
        secret,
      );
      return jsonResponse(
        response,
        200,
        { ok: true, username },
        { "Set-Cookie": sessionCookie(token) },
      );
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      if (!config.auth) {
        return jsonResponse(response, 403, { error: "Run setup first." });
      }
      const body = await readJsonBody(request);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (
        username !== config.auth.username ||
        !verifyPassword(password, config.auth.passwordHash)
      ) {
        return jsonResponse(response, 401, { error: "Invalid credentials." });
      }
      const token = createSignedToken(
        { username, exp: Date.now() + 1000 * 60 * 60 * 12 },
        secret,
      );
      return jsonResponse(
        response,
        200,
        { ok: true, username },
        { "Set-Cookie": sessionCookie(token) },
      );
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      return jsonResponse(
        response,
        200,
        { ok: true },
        { "Set-Cookie": clearSessionCookie() },
      );
    }

    if (pathname === "/api/config" && request.method === "GET") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) =>
        jsonResponse(innerResponse, 200, sanitizeConfig(innerConfig))
      )(context);
    }

    if (pathname === "/api/config" && request.method === "PUT") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        innerConfig.appName = String(body.appName || innerConfig.appName || "Agent Harbor").trim();
        innerConfig.roots = {
          ...innerConfig.roots,
          ...Object.fromEntries(
            Object.entries(body.roots || {}).map(([key, value]) => [key, normalizePath(String(value))]),
          ),
        };
        innerConfig.setup = {
          ...innerConfig.setup,
          isolatedAccountSlots: clampSlotCount(
            body.setup?.isolatedAccountSlots ?? innerConfig.setup?.isolatedAccountSlots,
          ),
          extensionsMode: sanitizeExtensionsMode(
            body.setup?.extensionsMode ?? innerConfig.setup?.extensionsMode,
          ),
        };
        await saveConfig(innerConfig);
        return jsonResponse(innerResponse, 200, sanitizeConfig(innerConfig));
      })(context);
    }

    if (pathname === "/api/account-setup" && request.method === "GET") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const payload = await listAccountSetup(innerConfig);
        return jsonResponse(innerResponse, 200, payload);
      })(context);
    }

    if (pathname === "/api/account-setup/prepare" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const slotKey = String(body.slotKey || "").trim();
        if (!slotKey) {
          const payload = await prepareAllAccountSlots(innerConfig);
          return jsonResponse(innerResponse, 200, payload);
        }
        const result = await prepareAccountSlot(innerConfig, slotKey);
        return jsonResponse(innerResponse, 200, {
          ok: true,
          results: [result],
        });
      })(context);
    }

    if (pathname === "/api/account-setup/launch" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const slotKey = String(body.slotKey || "").trim();
        if (!slotKey) {
          return jsonResponse(innerResponse, 400, { error: "slotKey is required." });
        }
        const result = await launchAccountSlot(innerConfig, slotKey, {
          dryRun: Boolean(body.dryRun),
        });
        return jsonResponse(innerResponse, 200, result);
      })(context);
    }

    if (pathname === "/api/launchers/install" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const result = await installLaunchers(innerConfig);
        return jsonResponse(innerResponse, 200, result);
      })(context);
    }

    if (pathname === "/api/extensions/sync" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const result = await syncSharedExtensions(innerConfig, {
          force: Boolean(body.force),
        });
        return jsonResponse(innerResponse, 200, {
          ok: true,
          sharedExtensions: result,
        });
      })(context);
    }

    if (pathname === "/api/homes" && request.method === "GET") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const homes = await discoverHomes(innerConfig);
        return jsonResponse(innerResponse, 200, { homes });
      })(context);
    }

    if (pathname === "/api/homes/archive" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const result = await archiveNoAuthHome(innerConfig, {
          homePath: String(body.homePath || ""),
        });
        return jsonResponse(innerResponse, 200, result);
      })(context);
    }

    if (pathname === "/api/sessions" && request.method === "GET") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig, searchParams: params }) => {
        const sessions = await listSessions(innerConfig, {
          targetPath: params.get("targetPath") || "",
          sourcePath: params.get("sourcePath") || "",
          query: params.get("query") || "",
          limit: Number(params.get("limit") || 120),
        });
        return jsonResponse(innerResponse, 200, { sessions });
      })(context);
    }

    if (pathname === "/api/sessions/import" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const result = await importSession(innerConfig, {
          sourcePath: String(body.sourcePath || ""),
          targetPath: String(body.targetPath || ""),
          sessionId: String(body.sessionId || ""),
          overwrite: Boolean(body.overwrite),
        });
        return jsonResponse(innerResponse, 200, result);
      })(context);
    }

    if (pathname === "/api/sessions/share-current" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const result = await shareCurrentSession(innerConfig, {
          sourcePath: String(body.sourcePath || ""),
          overwrite: Boolean(body.overwrite),
        });
        return jsonResponse(innerResponse, 200, result);
      })(context);
    }

    if (pathname === "/api/repair/home" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const homes = await discoverHomes(innerConfig);
        const home = homeByPath(homes, String(body.homePath || ""));
        if (!home) {
          return jsonResponse(innerResponse, 404, { error: "Home not found." });
        }
        const result = await detachSharedForHome(innerConfig, home, {
          resetOpenAIState: body.resetOpenAIState !== false,
        });
        return jsonResponse(innerResponse, 200, result);
      })(context);
    }

    if (pathname === "/api/repair/all" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const homes = await discoverHomes(innerConfig);
        const results = [];
        for (const home of homes) {
          results.push(
            await detachSharedForHome(innerConfig, home, {
              resetOpenAIState: body.resetOpenAIState !== false,
            }),
          );
        }
        return jsonResponse(innerResponse, 200, { results });
      })(context);
    }

    if (pathname === "/api/history/restore-shared" && request.method === "POST") {
      return requiredAuth(async ({ response: innerResponse, config: innerConfig }) => {
        const body = await readJsonBody(request);
        const result = await restoreSharedEraHistory(innerConfig, {
          includeArchived: body.includeArchived !== false,
          dryRun: Boolean(body.dryRun),
          targetPaths: Array.isArray(body.targetPaths) ? body.targetPaths : [],
        });
        return jsonResponse(innerResponse, 200, {
          ok: true,
          ...result,
        });
      })(context);
    }

    if (pathname.startsWith("/api/")) {
      return jsonResponse(response, 404, { error: "API route not found." });
    }

    return serveStatic(pathname, response);
  } catch (error) {
    console.error(`[${nowIso()}]`, error);
    return jsonResponse(response, 500, { error: error.message || "Unexpected error." });
  }
}

const server = http.createServer((request, response) => {
  router(request, response);
});

server.listen(DEFAULT_PORT, "127.0.0.1", () => {
  console.log(`Agent Harbor running on http://127.0.0.1:${DEFAULT_PORT}`);
});
