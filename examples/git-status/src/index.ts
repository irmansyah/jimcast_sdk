/**
 * Git Status — a realistic Jimcast plugin example.
 *
 * Demonstrates:
 * - Using context.exec() to run shell commands
 * - Parsing command output into CommandItems
 * - Using context.execStreamed() for live output
 * - Working with ProjectContext (openPRs, recentCommits)
 * - Conditional actions based on runtime state
 * - Using execSucceeded() guard
 */

import { definePlugin, createCommand, createCommandGroup, execSucceeded } from "@jimcast/sdk";
import type { CommandItem } from "@jimcast/sdk";

// ---------------------------------------------------------------------------
// Command: List changed files
// ---------------------------------------------------------------------------

const statusCommand = createCommand({
  id: "git-status.changed-files",
  title: "Git: Changed Files",
  subtitle: "List uncommitted changes in the working tree",
  keywords: ["git", "status", "diff", "changes", "modified"],

  async execute(context) {
    const result = await context.exec("git status --short --porcelain");

    if (!execSucceeded(result)) {
      await context.showToast("git status failed", {
        style: "failure",
        message: result.stderr.trim() || "Is this a git repo?",
      });
      return [];
    }

    const lines = result.stdout.trim().split("\n").filter(Boolean);

    if (lines.length === 0) {
      await context.showToast("Working tree is clean", { style: "success" });
      return [];
    }

    return lines.map((line): CommandItem => {
      // Porcelain format: "XY path" or "XY old -> new" for renames
      const statusCode = line.slice(0, 2).trim();
      const filePath = line.slice(3).trim();
      const statusLabel = describeStatus(statusCode);

      return {
        id: `file-${filePath}`,
        title: filePath,
        subtitle: statusLabel,
        accessory: statusCode,
        keywords: [statusCode, filePath.split("/").pop() ?? ""],
        actions: [
          {
            id: "copy-path",
            title: "Copy File Path",
            shortcut: "cmd+c",
            async onAction() {
              await context.copyToClipboard(filePath);
              await context.showToast("Path copied", { style: "success", duration: 1500 });
            },
          },
          {
            id: "stage-file",
            title: "Stage File",
            shortcut: "cmd+s",
            async onAction() {
              const r = await context.exec(`git add -- ${JSON.stringify(filePath)}`);
              if (execSucceeded(r)) {
                await context.showToast(`Staged: ${filePath}`, { style: "success" });
              } else {
                await context.showToast("Stage failed", {
                  style: "failure",
                  message: r.stderr.trim(),
                });
              }
            },
          },
          {
            id: "diff-file",
            title: "Show Diff",
            shortcut: "cmd+d",
            async onAction() {
              const r = await context.exec(`git diff -- ${JSON.stringify(filePath)}`);
              // Output the diff to the panel line-by-line
              for (const line of r.stdout.split("\n")) {
                context.appendOutput(line);
              }
            },
          },
        ],
        preview: {
          type: "markdown",
          content: `**${filePath}**\n\nStatus: \`${statusLabel}\` (\`${statusCode}\`)`,
        },
      };
    });
  },
});

function describeStatus(code: string): string {
  const map: Record<string, string> = {
    M: "Modified",
    A: "Added",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
    U: "Unmerged",
    "?": "Untracked",
    "!": "Ignored",
  };
  return map[code] ?? `Changed (${code})`;
}

// ---------------------------------------------------------------------------
// Command: Open pull requests
// ---------------------------------------------------------------------------

const openPRsCommand = createCommand({
  id: "git-status.open-prs",
  title: "Git: Open Pull Requests",
  subtitle: "Browse open PRs on the current repo",
  keywords: ["pr", "pull request", "review", "github", "gitlab"],

  async execute(context) {
    const { openPRs } = context.project;

    if (openPRs.length === 0) {
      await context.showToast("No open pull requests", { duration: 2000 });
      return [];
    }

    return openPRs.map((pr): CommandItem => ({
      id: `pr-${pr.number}`,
      title: `#${pr.number} ${pr.title}`,
      subtitle: `${pr.author} · ${pr.state}`,
      accessory: formatRelativeDate(pr.updatedAt),
      keywords: [String(pr.number), pr.author, pr.state],
      actions: [
        {
          id: "open-pr",
          title: "Open in Browser",
          shortcut: "cmd+return",
          async onAction() {
            await context.openUrl(pr.url);
          },
        },
        {
          id: "copy-pr-url",
          title: "Copy PR URL",
          shortcut: "cmd+c",
          async onAction() {
            await context.copyToClipboard(pr.url);
            await context.showToast("PR URL copied", { style: "success", duration: 1500 });
          },
        },
        {
          id: "checkout-pr",
          title: "Checkout PR Branch",
          shortcut: "cmd+b",
          async onAction() {
            const r = await context.exec(`gh pr checkout ${pr.number}`);
            if (execSucceeded(r)) {
              await context.showToast(`Checked out PR #${pr.number}`, { style: "success" });
            } else {
              await context.showToast("Checkout failed", {
                style: "failure",
                message: r.stderr.trim(),
              });
            }
          },
        },
      ],
      preview: {
        type: "markdown",
        content: [
          `## PR #${pr.number}: ${pr.title}`,
          ``,
          `| Field | Value |`,
          `|-------|-------|`,
          `| Author | ${pr.author} |`,
          `| State | ${pr.state} |`,
          `| Updated | ${new Date(pr.updatedAt).toLocaleString()} |`,
          `| URL | [Open](${pr.url}) |`,
        ].join("\n"),
      },
    }));
  },
});

// ---------------------------------------------------------------------------
// Command: Recent commits
// ---------------------------------------------------------------------------

const recentCommitsCommand = createCommand({
  id: "git-status.recent-commits",
  title: "Git: Recent Commits",
  subtitle: "Browse the last 20 commits on this branch",
  keywords: ["log", "history", "commits", "sha"],

  async execute(context) {
    const { recentCommits, branch } = context.project;

    if (recentCommits.length === 0) {
      await context.showToast("No commits found");
      return [];
    }

    return recentCommits.map((commit): CommandItem => ({
      id: `commit-${commit.sha}`,
      title: commit.message,
      subtitle: `${commit.author} · ${commit.shortSha}`,
      accessory: formatRelativeDate(commit.date),
      keywords: [commit.shortSha, commit.sha, commit.author],
      actions: [
        {
          id: "copy-sha",
          title: "Copy Full SHA",
          shortcut: "cmd+c",
          async onAction() {
            await context.copyToClipboard(commit.sha);
            await context.showToast("SHA copied", { style: "success", duration: 1500 });
          },
        },
        {
          id: "copy-short-sha",
          title: "Copy Short SHA",
          shortcut: "cmd+shift+c",
          async onAction() {
            await context.copyToClipboard(commit.shortSha);
            await context.showToast("Short SHA copied", { style: "success", duration: 1500 });
          },
        },
        {
          id: "show-diff",
          title: "Show Commit Diff",
          async onAction() {
            const r = await context.exec(`git show --stat ${commit.sha}`);
            for (const line of r.stdout.split("\n")) {
              context.appendOutput(line);
            }
          },
        },
      ],
      preview: {
        type: "markdown",
        content: [
          `## ${commit.message}`,
          ``,
          `- **SHA:** \`${commit.sha}\``,
          `- **Author:** ${commit.author}`,
          `- **Date:** ${new Date(commit.date).toLocaleString()}`,
          `- **Branch:** ${branch ?? "unknown"}`,
        ].join("\n"),
      },
    }));
  },
});

// ---------------------------------------------------------------------------
// Command: Run build with streamed output
// ---------------------------------------------------------------------------

const buildCommand = createCommand({
  id: "git-status.run-build",
  title: "Git: Run Build",
  subtitle: "Runs npm run build with live output",
  keywords: ["build", "compile", "npm", "run"],

  async execute(context) {
    await context.showToast("Starting build…");

    const result = await context.execStreamed("npm run build", {
      timeoutMs: 120_000, // 2 minutes
      onLine(line) {
        context.appendOutput(line);
      },
      onStderrLine(line) {
        context.appendOutput(`[stderr] ${line}`);
      },
    });

    if (execSucceeded(result)) {
      await context.showToast("Build succeeded", { style: "success" });
    } else {
      await context.showToast("Build failed", {
        style: "failure",
        message: `Exit code ${result.exitCode}`,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Plugin manifest
// ---------------------------------------------------------------------------

const workingTreeGroup = createCommandGroup({
  title: "Working Tree",
  commands: [statusCommand, buildCommand],
});

const remoteGroup = createCommandGroup({
  title: "Remote",
  commands: [openPRsCommand, recentCommitsCommand],
});

export default definePlugin({
  name: "Git Status",
  description: "Browse git status, open PRs, and recent commits from the command bar",
  commands: [workingTreeGroup, remoteGroup],
});
