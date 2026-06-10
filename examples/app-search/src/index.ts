/**
 * jimcast-plugin-apps
 *
 * Searches macOS .app bundles and CLI tools from common bin directories.
 * Command-only plugin — shows results in the search list, no persistent widget.
 *
 * App behavior:
 * - .app bundles → `open -a "App Name"` (launches or focuses if already running)
 * - CLI binaries → opens in a new terminal via `open -a Terminal`
 */

import { definePlugin, createCommand, execSucceeded } from "@jimcast/sdk";
import type { ExecutionContext, CommandItem } from "@jimcast/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APP_DIRS = [
  "/Applications",
  "/System/Applications",
];

const BIN_DIRS = [
  `/Users/${getUsername()}/nix-profile/bin`,
  "/run/current-system/sw/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
];

function getUsername(): string {
  // HOME=/Users/mane → extract username
  const home = process.env["HOME"] ?? "";
  return home.split("/").pop() ?? "user";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppEntry {
  name: string;
  path: string;
  type: "app" | "cli";
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

async function scanApps(context: ExecutionContext): Promise<AppEntry[]> {
  const entries: AppEntry[] = [];

  for (const dir of APP_DIRS) {
    // Check dir exists
    const check = await context.exec(`test -d ${JSON.stringify(dir)} && echo yes`);
    if (!execSucceeded(check) || !check.stdout.includes("yes")) continue;

    const result = await context.exec(
      `ls ${JSON.stringify(dir)} 2>/dev/null | grep '\\.app$'`
    );
    if (!execSucceeded(result)) continue;

    for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
      const name = line.replace(/\.app$/, "").trim();
      if (name) {
        entries.push({ name, path: `${dir}/${line}`, type: "app" });
      }
    }
  }

  return entries;
}

async function scanBins(context: ExecutionContext): Promise<AppEntry[]> {
  const entries: AppEntry[] = [];

  for (const dir of BIN_DIRS) {
    const check = await context.exec(`test -d ${JSON.stringify(dir)} && echo yes`);
    if (!execSucceeded(check) || !check.stdout.includes("yes")) continue;

    // List only executable files (not directories, not symlinks to dirs)
    const result = await context.exec(
      `find ${JSON.stringify(dir)} -maxdepth 1 -type f -perm +111 -exec basename {} \\; 2>/dev/null`
    );
    if (!execSucceeded(result)) continue;

    for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
      const name = line.trim();
      if (name) {
        entries.push({ name, path: `${dir}/${name}`, type: "cli" });
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Fuzzy filter
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, name: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  // Simple: every char in query appears in order in name
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreMatch(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 70;
  return 50; // fuzzy match
}

// ---------------------------------------------------------------------------
// Command items
// ---------------------------------------------------------------------------

function appToItem(app: AppEntry, context: ExecutionContext): CommandItem {
  if (app.type === "app") {
    return {
      id: `app-${app.name}`,
      title: app.name,
      subtitle: app.path,
      accessory: "app",
      keywords: [app.name.toLowerCase()],
      actions: [
        {
          id: "launch",
          title: "Launch / Focus",
          shortcut: "cmd+return",
          async onAction() {
            const r = await context.exec(`open -a ${JSON.stringify(app.name)}`);
            if (!execSucceeded(r)) {
              await context.showToast(`Failed to open ${app.name}`, {
                style: "failure",
                message: r.stderr.trim(),
              });
            }
          },
        },
        {
          id: "copy-path",
          title: "Copy Path",
          shortcut: "cmd+c",
          async onAction() {
            await context.copyToClipboard(app.path);
            await context.showToast("Path copied", { style: "success", duration: 1500 });
          },
        },
      ],
    };
  }

  // CLI tool
  return {
    id: `cli-${app.name}`,
    title: app.name,
    subtitle: app.path,
    accessory: "cli",
    keywords: [app.name.toLowerCase(), "terminal", "cli", "bin"],
    actions: [
      {
        id: "open-in-terminal",
        title: "Open in Terminal",
        shortcut: "cmd+return",
        async onAction() {
          // Open Terminal and run the command
          const script = `osascript -e 'tell application "Terminal" to do script "${app.name}"'`;
          const r = await context.exec(script);
          if (!execSucceeded(r)) {
            await context.showToast(`Failed to open ${app.name}`, {
              style: "failure",
              message: r.stderr.trim(),
            });
          }
        },
      },
      {
        id: "copy-path",
        title: "Copy Path",
        shortcut: "cmd+c",
        async onAction() {
          await context.copyToClipboard(app.path);
          await context.showToast("Path copied", { style: "success", duration: 1500 });
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Cache — scan once per process lifetime, not on every keystroke
// ---------------------------------------------------------------------------

let cachedEntries: AppEntry[] | null = null;

async function getAllEntries(context: ExecutionContext): Promise<AppEntry[]> {
  if (cachedEntries) return cachedEntries;

  const [apps, bins] = await Promise.all([
    scanApps(context),
    scanBins(context),
  ]);

  // Deduplicate by name (apps take priority over same-named CLI)
  const seen = new Set<string>();
  const all: AppEntry[] = [];

  for (const entry of [...apps, ...bins]) {
    if (!seen.has(entry.name.toLowerCase())) {
      seen.add(entry.name.toLowerCase());
      all.push(entry);
    }
  }

  cachedEntries = all;
  return all;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const searchAppsCommand = createCommand({
  id: "apps.search",
  title: "Search Apps & Tools",
  subtitle: "Launch apps or open CLI tools in Terminal",
  keywords: ["app", "launch", "open", "run", "tool", "bin", "cli", "finder"],

  async execute(context) {
    // Note: rawQuery isn't passed from core yet — for now return all entries
    // sorted alphabetically. Once core passes the search query through args,
    // we can filter here.
    const all = await getAllEntries(context);

    // Sort: apps first, then CLI, alphabetically within each group
    const sorted = [...all].sort((a, b) => {
      if (a.type !== b.type) return a.type === "app" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map(entry => appToItem(entry, context));
  },
});

const searchAppsQueryCommand = createCommand({
  id: "apps.search-query",
  title: "Open App or Tool",
  subtitle: "Type a name to find and launch",
  keywords: ["app", "open", "launch", "find", "search"],

  async execute(context) {
    // Get query from storage if core passed it
    const query = (await context.storage.get("last-query")) ?? "";
    const all = await getAllEntries(context);

    const filtered = query
      ? all
          .filter(e => fuzzyMatch(query, e.name))
          .sort((a, b) => scoreMatch(query, b.name) - scoreMatch(query, a.name))
      : all.sort((a, b) => {
          if (a.type !== b.type) return a.type === "app" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

    if (filtered.length === 0) {
      await context.showToast(`No apps found for "${query}"`, { duration: 2000 });
      return [];
    }

    return filtered.map(entry => appToItem(entry, context));
  },
});

export default definePlugin({
  name: "App Search",
  description: "Search and launch macOS apps and CLI tools",
  // Command-only — no widgets. Results appear in the search list via '>' mode.
  commands: [searchAppsCommand, searchAppsQueryCommand],
});
