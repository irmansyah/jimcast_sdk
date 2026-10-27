// [sdk] templates/plugin-starter/src/index.ts

/**
 * plugin-starter — a finder-style file browser built ONLY on @jimcast/sdk.
 * It mirrors core's internal `finder.ts` (frontend/application/widget/descriptors/finder.ts):
 *
 *   - three columns (parent | current | children-or-preview) as a `group` of `list`s
 *   - marks (select several rows), hidden-files toggle, Trash with 2-step confirm
 *   - key bindings (remappable via `key_bindings.files`)
 *   - CLI: `jimcast widget command files <command> ...`
 *
 * How it differs from core's finder (all because this runs in a separate process):
 *   - State lives in plugin storage (`ctx.storage`), not in ~/.jimcast/* files.
 *   - Actions are functions: `{ run, then: 'refresh' }` instead of shell strings.
 *   - `owns` is an item-id prefix ("sfm") instead of a predicate.
 *   - Core's cursor-follow live preview and Left/Right column navigation are
 *     hard-wired to core's own `fm:` ids, so here Left/Right are ordinary key
 *     actions, and the preview updates when you press Enter / click a row.
 *
 * Install: package.json needs
 *   "main": "dist/index.js",
 *   "jimcast": { "capabilities": ["shell", "widget-cli", "widget-keys"] }
 * and the widget is opened as a panel: { "kind": "external-component", "id": "starter.files" }
 * (keys only work while the widget is the OPEN panel, not in a slot).
 */

import { createWidget, definePlugin } from "@jimcast/sdk";
import type {
  ExecutionContext,
  WidgetActionWithFn,
  WidgetCliCommand,
  WidgetCliContext,
  WidgetContent,
  WidgetGroupSection,
  WidgetItem,
  WidgetKeyAction,
  WidgetKeyContext,
} from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";

// ── constants ───────────────────────────────────────────────────────────────

/** Every item id this widget renders starts with this: it is the spec's `owns`. */
const OWNS = "sfm";
const ROW = `${OWNS}:`;            // file / folder rows: `sfm:<absolute path>`

const HOME = process.env.HOME ?? "/";
const WINDOW_ROWS = 14;            // side columns show at most this many rows
const ROW_PX = 26;
const COLUMN_HEIGHT = ROW_PX * WINDOW_ROWS + 8;
const FOOTER_H = ROW_PX + 24;      // fixed, so the window never changes height
const CONFIRM_TTL_MS = 30_000;     // a pending Trash confirmation expires

// ── shell / path helpers ────────────────────────────────────────────────────

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const join = (dir: string, name: string) => (dir === "/" ? `/${name}` : `${dir}/${name}`);
const parentOf = (p: string) => (p === "/" ? "/" : p.slice(0, p.lastIndexOf("/")) || "/");
const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const inHome = (p: string) => p === HOME || p.startsWith(HOME + "/");
const rowPath = (id?: string | null) => (id && id.startsWith(ROW) ? id.slice(ROW.length) : null);

function normalizePath(p: string): string {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return "/" + out.join("/");
}

type Kind = "dir" | "file" | null;

async function kindOf(ctx: ExecutionContext, p: string): Promise<Kind> {
  const r = await ctx.exec(`if [ -d ${shq(p)} ]; then echo d; elif [ -e ${shq(p)} ]; then echo f; fi`);
  const o = r.stdout.trim();
  return o === "d" ? "dir" : o === "f" ? "file" : null;
}

interface Entry { name: string; isDir: boolean }

async function list(ctx: ExecutionContext, dir: string, hidden: boolean): Promise<Entry[]> {
  const r = await ctx.exec(`ls -1p${hidden ? "A" : ""} ${shq(dir)} 2>/dev/null`);
  return r.stdout
    .split("\n")
    .filter((n) => n && (hidden || !n.startsWith(".")))
    .map((n) => ({ name: n.replace(/\/$/, ""), isDir: n.endsWith("/") }))
    .sort((a, b) =>
      a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

// ── state (plugin storage; one key, so reads/writes are a single call) ──────

interface State {
  selected:  string | null;   // the selected entry (null = nothing yet, show $HOME)
  marks:     string[];
  hidden:    boolean;         // show dotfiles
  confirmAt: number | null;   // when "Trash?" was asked (ms), null = not asking
}
const EMPTY: State = { selected: null, marks: [], hidden: false, confirmAt: null };

async function load(ctx: ExecutionContext): Promise<State> {
  try {
    // Storage may hand back the raw string or an already-parsed value.
    const raw: unknown = await ctx.storage.get("state");
    if (typeof raw === "string") return { ...EMPTY, ...JSON.parse(raw) };
    if (raw && typeof raw === "object") return { ...EMPTY, ...(raw as Partial<State>) };
  } catch { /* first run */ }
  return { ...EMPTY };
}
const save = (ctx: ExecutionContext, s: State) => ctx.storage.set("state", JSON.stringify(s));

async function update(ctx: ExecutionContext, fn: (s: State) => void): Promise<State> {
  const s = await load(ctx);
  fn(s);
  await save(ctx, s);
  return s;
}

/** Marks change -> any pending Trash prompt is void (same rule as core's finder). */
const setMarks = (s: State, marks: string[]) => { s.marks = marks; s.confirmAt = null; };

const isConfirming = (s: State) =>
  s.marks.length > 0 && s.confirmAt !== null && Date.now() - s.confirmAt <= CONFIRM_TTL_MS;

// ── actions ─────────────────────────────────────────────────────────────────
// `{ run, then }` is the SDK's "function action that can ask for a refresh".

const act = (run: () => Promise<void>, then: "refresh" | "dismiss" | "refresh|dismiss" = "refresh"): WidgetActionWithFn =>
  ({ run, then });

/** A synthetic item, for ctx.dispatch (CLI and keys). `id` must start with the spec's `owns`. */
const synthetic = (id: string, run: () => Promise<void>): WidgetItem =>
  ({ id: `${OWNS}-act:${id}`, action: act(run) });

const selectAction = (ctx: ExecutionContext, p: string) =>
  act(async () => { await update(ctx, (s) => { s.selected = p; }); });

const toggleMark = (ctx: ExecutionContext, p: string) =>
  act(async () => {
    await update(ctx, (s) =>
      setMarks(s, s.marks.includes(p) ? s.marks.filter((m) => m !== p) : [...s.marks, p]),
    );
  });

const openAction = (ctx: ExecutionContext, p: string) =>
  act(async () => { await ctx.exec(`open ${shq(p)}`); }, "dismiss");

async function firstEntry(ctx: ExecutionContext, dir: string, hidden: boolean): Promise<string | null> {
  const [first] = await list(ctx, dir, hidden);
  return first ? join(dir, first.name) : null;
}

/** Moves the marked items to the Trash via Finder (recoverable, never rm). Needs a fresh confirmation. */
async function trashMarked(ctx: ExecutionContext): Promise<boolean> {
  const s = await load(ctx);
  const ok = isConfirming(s);
  s.confirmAt = null;                        // one use
  if (!ok) { await save(ctx, s); return false; }

  const live: string[] = [];
  for (const p of s.marks) if (await kindOf(ctx, p)) live.push(p);
  if (!live.length) { s.marks = []; await save(ctx, s); return false; }

  const r = await ctx.exec(
    `osascript -e 'on run argv' -e 'repeat with p in argv' ` +
    `-e 'tell application "Finder" to delete (POSIX file (contents of p))' ` +
    `-e 'end repeat' -e 'end run' ${live.map(shq).join(" ")}`,
  );
  if (r.exitCode === 0) s.marks = [];
  await save(ctx, s);
  return r.exitCode === 0;
}

// ── rendering ───────────────────────────────────────────────────────────────

function row(
  ctx: ExecutionContext, path: string, isDir: boolean,
  o: { selected: boolean; active: boolean; marked: boolean },
): WidgetItem {
  const mark = o.marked ? "✓ " : "";
  const white = o.selected && o.active;
  return {
    id: `${ROW}${path}`,
    pinned: true,
    attribute: {
      label1: `${mark}${isDir ? "📁 " : ""}${baseName(path)}`,
      labelRight: isDir ? "›" : undefined,
      color1: white ? "#ffffff" : o.marked ? "yellow" : isDir ? "blue" : "default",
    },
    // Highlighted like Finder: filled blue in the active column, outlined in the previous one.
    style: o.selected
      ? o.active
        ? { background: "blue", borderRadius: 6 }
        : { borderColor: "blue", borderWidth: 1, borderRadius: 6 }
      : undefined,
    // Enter: folder -> select it; file -> open and dismiss. Click on a file toggles its mark.
    action: isDir ? selectAction(ctx, path) : openAction(ctx, path),
    clickAction: isDir ? undefined : toggleMark(ctx, path),
  };
}

const note = (id: string, text: string): WidgetItem =>
  ({ id: `${OWNS}-note:${id}`, pinned: true, attribute: { label1: text, color1: "default", textSize1: 12 } });

function column(
  ctx: ExecutionContext, dir: string, entries: Entry[], selectedPath: string | null,
  active: boolean, navigable: boolean, marks: ReadonlySet<string>,
): WidgetGroupSection {
  // The navigable column renders everything (the cursor scrolls it); side
  // columns have no cursor, so they are windowed around the highlighted row.
  let start = 0;
  let shown = entries;
  if (!navigable) {
    const idx = entries.findIndex((e) => join(dir, e.name) === selectedPath);
    start = idx >= WINDOW_ROWS ? idx - WINDOW_ROWS + 1 : 0;
    shown = entries.slice(start, start + WINDOW_ROWS);
  }

  const datas: WidgetItem[] = shown.map((e) => {
    const p = join(dir, e.name);
    return row(ctx, p, e.isDir, { selected: p === selectedPath, active, marked: marks.has(p) });
  });
  if (!navigable && entries.length > start + WINDOW_ROWS) {
    datas.push(note(`more:${dir}`, `… ${entries.length - start - WINDOW_ROWS} more`));
  }
  if (!datas.length) datas.push(note(`empty:${dir}`, "(empty)"));

  return {
    id: `col:${dir}`, flex: 1, navigable, height: COLUMN_HEIGHT,
    style: { borderRadius: 8, padding: 4 },
    content: { type: "list", datas },
  };
}

async function previewColumn(ctx: ExecutionContext, path: string): Promise<WidgetGroupSection> {
  const info = await ctx.exec(`stat -f%z ${shq(path)} 2>/dev/null; file -b ${shq(path)} 2>/dev/null`);
  const [size = "", kind = "file"] = info.stdout.trim().split("\n");
  const datas: WidgetItem[] = [
    { id: `${OWNS}-pv-name`, pinned: true,
      attribute: { label1: baseName(path), label2: `${kind} · ${size ? `${size} B` : "?"}`, textSize1: 16 } },
    { id: `${OWNS}-pv-open`, pinned: true,
      attribute: { label1: "Open", labelRight: "↵", color1: "blue" }, action: openAction(ctx, path) },
    { id: `${OWNS}-pv-reveal`, pinned: true,
      attribute: { label1: "Reveal in Finder" },
      action: act(async () => { await ctx.exec(`open -R ${shq(path)}`); }, "dismiss") },
  ];
  return {
    id: "preview", flex: 1.2, height: COLUMN_HEIGHT,
    style: { borderRadius: 8, padding: 4 },
    content: { type: "list", datas },
  };
}

function footer(
  ctx: ExecutionContext, count: number, confirming: boolean, labels: Record<string, string>,
): WidgetGroupSection {
  const style = { borderRadius: 8, padding: 4 };
  const withKey = (text: string, id: string) => (labels[id] ? `${text} (${labels[id]})` : text);

  if (count > 0 && confirming) {
    // Order matters: if the cursor index gets clamped into this shorter list it must land on "Cancel".
    return {
      id: "marks", height: FOOTER_H, scrollable: false, navigable: true, style,
      content: { type: "grid-3", datas: [
        { id: `${OWNS}-act:trash-confirm`, pinned: true,
          attribute: { label1: withKey(`Confirm Trash ${count}`, "confirm_delete"), color1: "red" },
          action: act(async () => { await trashMarked(ctx); }) },
        { id: `${OWNS}-act:trash-cancel`, pinned: true,
          attribute: { label1: withKey("Cancel", "cancel_delete"), color1: "blue" },
          action: act(async () => { await update(ctx, (s) => { s.confirmAt = null; }); }) },
      ] },
    };
  }

  const hints = ([["mark", "mark"], ["delete", "delete"], ["clear_marks", "clear"], ["toggle_hidden", "hidden"]] as const)
    .filter(([id]) => labels[id]).map(([id, text]) => `${labels[id]} ${text}`).join(" · ");

  return {
    id: "marks", height: FOOTER_H, scrollable: false, navigable: false, style,
    content: { type: "list", datas: [{
      id: `${OWNS}-hint`, pinned: true,
      attribute: {
        label1: count > 0 ? `✓ ${count} selected` : "Nothing selected",
        color1: count > 0 ? "yellow" : "default", textSize1: 12,
        labelRight: hints || undefined, textSizeRight: 11,
      },
    }] },
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));
const hasFlag = (ctx: WidgetCliContext, f: string) => ctx.args.includes(f);

/** Relative paths resolve against the CALLER's cwd. */
async function existing(ctx: WidgetCliContext, raw: string[]): Promise<string[]> {
  const abs = raw.map((p) => normalizePath(p.startsWith("/") ? p : `${ctx.cwd ?? "/"}/${p}`));
  for (const p of abs) if (!(await kindOf(ctx, p))) throw new Error(`no such file or directory: ${p}`);
  return abs;
}

async function targetsOrSelection(ctx: WidgetCliContext): Promise<string[]> {
  const given = positional(ctx);
  if (given.length) return existing(ctx, given);
  const s = await load(ctx);
  if (!s.selected) throw new Error("nothing is selected — pass a path");
  return [s.selected];
}

const countMarked = async (ctx: ExecutionContext) => `${(await load(ctx)).marks.length} marked`;

const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status", title: "Selected path and marked paths", description: "--json for machine-readable output",
    async run(ctx) {
      const s = await load(ctx);
      if (hasFlag(ctx, "--json")) return { selected: s.selected ?? HOME, marked: s.marks, hidden: s.hidden, confirming: isConfirming(s) };
      return [
        `selected  ${s.selected ?? HOME}`,
        `hidden    ${s.hidden ? "shown" : "hidden"}`,
        s.marks.length ? `marked    ${s.marks.length}` : "marked    (none)",
        ...s.marks.map((m) => `  ${m}`),
        ...(isConfirming(s) ? ["trash     waiting — `trash --yes` or `--cancel`"] : []),
      ].join("\n");
    },
  },
  {
    id: "select", args: ["path"], title: "Select a file or folder (the columns follow)",
    async run(ctx) {
      if (!positional(ctx)[0]) throw new Error("select needs a path");
      const [p] = await existing(ctx, [positional(ctx)[0]]);
      await ctx.dispatch(synthetic("select", async () => { await update(ctx, (s) => { s.selected = p; }); }),
        { focus: { id: `${ROW}${p}` } });
      return `Selected ${p}`;
    },
  },
  {
    id: "up", args: ["[path]"], title: "Select the parent (the Left key)",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existing(ctx, [given]))[0] : (await load(ctx)).selected ?? HOME;
      const t = parentOf(p);
      if (inHome(t)) {
        await ctx.dispatch(synthetic("up", async () => { await update(ctx, (s) => { s.selected = t; }); }),
          { focus: { id: `${ROW}${t}` } });
      }
      return `Selected ${(await load(ctx)).selected ?? HOME}`;
    },
  },
  {
    id: "hidden", title: "Toggle showing hidden files",
    async run(ctx) {
      await ctx.dispatch(synthetic("hidden", async () => { await update(ctx, (s) => { s.hidden = !s.hidden; }); }));
      return (await load(ctx)).hidden ? "Hidden files: shown" : "Hidden files: hidden";
    },
  },
  {
    id: "mark", args: ["[paths...]"], title: "Mark paths (default: the selection). Safe to repeat.",
    async run(ctx) {
      const ps = await targetsOrSelection(ctx);
      await ctx.dispatch(synthetic("mark", async () => {
        await update(ctx, (s) => setMarks(s, [...new Set([...s.marks, ...ps])]));
      }));
      return countMarked(ctx);
    },
  },
  {
    id: "unmark", args: ["[paths...]"], title: "Unmark paths (default: the selection)",
    async run(ctx) {
      const ps = new Set(await targetsOrSelection(ctx));
      await ctx.dispatch(synthetic("unmark", async () => {
        await update(ctx, (s) => setMarks(s, s.marks.filter((m) => !ps.has(m))));
      }));
      return countMarked(ctx);
    },
  },
  {
    id: "clear", title: "Unmark everything",
    async run(ctx) {
      await ctx.dispatch(synthetic("clear", async () => { await update(ctx, (s) => setMarks(s, [])); }));
      return "0 marked";
    },
  },
  {
    id: "trash", args: ["[--yes|--cancel]"], title: "Move the marked items to the Trash",
    description: "Without a flag it only asks (the footer shows Confirm / Cancel). --yes asks and confirms.",
    async run(ctx) {
      if (hasFlag(ctx, "--cancel")) {
        await ctx.dispatch(synthetic("trash-cancel", async () => { await update(ctx, (s) => { s.confirmAt = null; }); }));
        return "Trash cancelled.";
      }
      const s = await load(ctx);
      if (!s.marks.length) throw new Error("nothing is marked — run `mark <path>` first");
      if (!hasFlag(ctx, "--yes")) {
        await ctx.dispatch(synthetic("trash-ask", async () => { await update(ctx, (x) => { x.confirmAt = Date.now(); }); }));
        return `Trash ${s.marks.length} item(s)? Re-run with --yes to confirm, or --cancel.`;
      }
      // Ask + confirm in one action; trashMarked still re-checks the timestamp.
      await ctx.dispatch(synthetic("trash", async () => {
        await update(ctx, (x) => { x.confirmAt = Date.now(); });
        await trashMarked(ctx);
      }));
      if ((await load(ctx)).marks.length) throw new Error("trash failed — the items are still marked");
      return "Moved the marked items to the Trash.";
    },
  },
  {
    id: "launch", args: ["[paths...]"], title: "Open with the default macOS app (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.exec(`open ${shq(p)}`);
      return null;
    },
  },
];

// ── keys ────────────────────────────────────────────────────────────────────

/** Cursor row, else the selection (never $HOME itself). */
async function keyTarget(ctx: WidgetKeyContext): Promise<string | null> {
  return rowPath(ctx.focusedItemId) ?? (await load(ctx)).selected;
}
/** Keep the cursor on the same row after the re-render. */
const keepFocus = (ctx: WidgetKeyContext) =>
  ctx.focusedItemId ? { focus: { id: ctx.focusedItemId } } : undefined;

const KEY_ACTIONS: WidgetKeyAction[] = [
  {
    id: "mark", title: "Mark / unmark the row under the cursor", default: "space",
    async run(ctx) {
      const p = rowPath(ctx.focusedItemId);
      if (!p) return;
      await ctx.dispatch(synthetic("mark", async () => {
        await update(ctx, (s) => setMarks(s, s.marks.includes(p) ? s.marks.filter((m) => m !== p) : [...s.marks, p]));
      }), keepFocus(ctx));
    },
  },
  {
    id: "up_dir", title: "Select the parent folder", default: "left",
    async run(ctx) {
      const p = await keyTarget(ctx);
      if (!p) return;
      const t = parentOf(p);
      if (!inHome(t)) return;
      await ctx.dispatch(synthetic("up", async () => { await update(ctx, (s) => { s.selected = t; }); }),
        { focus: { id: `${ROW}${t}` } });
    },
  },
  {
    id: "enter_dir", title: "Folder: select its first entry. File: select it", default: "right",
    async run(ctx) {
      const p = await keyTarget(ctx);
      if (!p) return;
      const s = await load(ctx);
      const next = (await kindOf(ctx, p)) === "dir" ? (await firstEntry(ctx, p, s.hidden)) ?? p : p;
      await ctx.dispatch(synthetic("enter", async () => { await update(ctx, (x) => { x.selected = next; }); }),
        { focus: { id: `${ROW}${p}`, prefix: `${ROW}${p}/` } });
    },
  },
  {
    id: "toggle_hidden", title: "Show / hide hidden files", default: "shift+h",
    run: (ctx) => ctx.dispatch(synthetic("hidden", async () => { await update(ctx, (s) => { s.hidden = !s.hidden; }); }), keepFocus(ctx)),
  },
  {
    id: "delete", title: "Move to Trash (asks first)", default: "d",
    async run(ctx) {
      const s = await load(ctx);
      const p = s.marks.length ? null : await keyTarget(ctx);
      if (!s.marks.length && !p) return;
      // Nothing marked: mark the row, then ask, in one action (one re-render).
      await ctx.dispatch(synthetic("delete", async () => {
        await update(ctx, (x) => {
          if (p) setMarks(x, [p]);
          x.confirmAt = Date.now();
        });
      }), keepFocus(ctx));
    },
  },
  {
    id: "confirm_delete", title: "Confirm the pending Trash", default: "y",
    async run(ctx) {
      if (!isConfirming(await load(ctx))) return;
      await ctx.dispatch(synthetic("trash-confirm", async () => { await trashMarked(ctx); }));
    },
  },
  {
    id: "cancel_delete", title: "Cancel the pending Trash", default: "n",
    async run(ctx) {
      if (!isConfirming(await load(ctx))) return;
      await ctx.dispatch(synthetic("trash-cancel", async () => { await update(ctx, (s) => { s.confirmAt = null; }); }));
    },
  },
  {
    id: "clear_marks", title: "Unmark everything", default: "u",
    run: (ctx) => ctx.dispatch(synthetic("clear", async () => { await update(ctx, (s) => setMarks(s, [])); }), keepFocus(ctx)),
  },
];

// ── the widget ──────────────────────────────────────────────────────────────

export const filesWidget = createWidget({
  id: "starter.files",          // "starter" must match this plugin's folder / package name
  section: { title: "Files", titleShow: true, navigationActive: true, querySearchActive: false },
  cli:  { owns: OWNS, commands: CLI_COMMANDS },   // spec id = "files"
  keys: { owns: OWNS, actions: KEY_ACTIONS },     // key_bindings.files

  async render(ctx): Promise<WidgetContent> {
    const [st, labels] = await Promise.all([load(ctx), ctx.keyLabels("files")]);

    // Drop marks whose files are gone (display only; actions re-check).
    const marks = new Set<string>();
    for (const m of st.marks) if (await kindOf(ctx, m)) marks.add(m);

    const sel = st.selected && inHome(st.selected) && (await kindOf(ctx, st.selected)) ? st.selected : HOME;
    const selKind: Kind = sel === HOME ? "dir" : await kindOf(ctx, sel);

    const sections: WidgetGroupSection[] = [];
    let cwd: string;

    if (sel === HOME) {
      // Nothing selected yet: a single column of $HOME.
      cwd = HOME;
      sections.push(column(ctx, HOME, await list(ctx, HOME, st.hidden), null, true, true, marks));
    } else {
      const center = parentOf(sel);
      cwd = center;
      const [left, mid, right] = await Promise.all([
        center !== HOME ? list(ctx, parentOf(center), st.hidden) : Promise.resolve(null),
        list(ctx, center, st.hidden),
        selKind === "dir" ? list(ctx, sel, st.hidden) : Promise.resolve(null),
      ]);
      if (left) sections.push(column(ctx, parentOf(center), left, center, false, false, marks));
      sections.push(column(ctx, center, mid, sel, true, true, marks));
      if (right) sections.push(column(ctx, sel, right, null, false, false, marks));
      else sections.push(await previewColumn(ctx, sel));
    }

    const shown = cwd === HOME ? "~" : cwd.startsWith(HOME + "/") ? "~" + cwd.slice(HOME.length) : cwd;
    const cwdItem: WidgetItem = {
      id: `${OWNS}-cwd`,
      attribute: { label1: `📁 ${shown}`, color1: "blue", textSize1: 12, labelRight: cwd === "/" ? undefined : "↑ up" },
      action: cwd === "/" ? undefined : selectAction(ctx, parentOf(cwd)),
    };

    return {
      type: "group", direction: "column", gap: 6,
      sections: [
        { id: "cwd", navigable: true, style: { borderRadius: 8, padding: 4 }, content: { type: "list", datas: [cwdItem] } },
        { id: "columns", content: { type: "group", direction: "row", gap: 6, sections } },
        footer(ctx, marks.size, marks.size > 0 && isConfirming({ ...st, marks: [...marks] }), labels),
      ],
    };
  },
});

export const plugin = definePlugin({
  name: "starter",
  description: "Finder-style file browser: columns, marks, keys and CLI.",
  commands: [],
  widgets: [filesWidget],
});

bootstrapPlugin(plugin);
