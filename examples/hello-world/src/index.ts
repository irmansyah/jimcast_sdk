/**
 * Hello World — a minimal Jimcast plugin.
 *
 * Demonstrates:
 * - definePlugin / createCommand basics
 * - Returning CommandItems from execute()
 * - Attaching actions to items
 * - Using context.showToast
 * - Using context.copyToClipboard
 * - createWidget for persistent UI slots
 */
import { definePlugin, createCommand, createWidget } from "@jimcast/sdk";

const helloCommand = createCommand({
  id: "hello-world.greet",
  title: "Say Hello",
  subtitle: "Choose a greeting style",
  keywords: ["hi", "greet", "welcome"],
  async execute(context) {
    const branch = context.project.branch ?? "unknown";
    return [
      {
        id: "toast-greeting",
        title: "Show a toast greeting",
        subtitle: "Pops up a brief notification",
        accessory: "toast",
        actions: [
          {
            id: "show-toast",
            title: "Show Greeting",
            shortcut: "cmd+return",
            async onAction() {
              await context.showToast(`Hello from Jimcast! You're on branch: ${branch}`, {
                style: "success",
              });
            },
          },
        ],
      },
      {
        id: "copy-greeting",
        title: "Copy greeting to clipboard",
        subtitle: "Copies a hello message you can paste anywhere",
        accessory: "clipboard",
        actions: [
          {
            id: "copy",
            title: "Copy to Clipboard",
            shortcut: "cmd+c",
            async onAction() {
              await context.copyToClipboard(`Hello from Jimcast! Branch: ${branch}`);
              await context.showToast("Copied!", { style: "success", duration: 1500 });
            },
          },
        ],
      },
    ];
  },
});

const projectInfoCommand = createCommand({
  id: "hello-world.project-info",
  title: "Show Project Info",
  subtitle: "Displays info about the current project",
  keywords: ["info", "project", "repo", "branch"],
  async execute(context) {
    const { project } = context;
    return [
      {
        id: "cwd",
        title: project.cwd,
        subtitle: "Working directory",
        accessory: "path",
        preview: {
          type: "markdown",
          content: `## Project Info\n\n- **CWD:** \`${project.cwd}\`\n- **Branch:** \`${project.branch ?? "none"}\`\n- **Remote:** \`${project.remoteName ?? "none"}\`\n- **Open PRs:** ${project.openPRs.length}`,
        },
        actions: [
          {
            id: "copy-path",
            title: "Copy Path",
            async onAction() {
              await context.copyToClipboard(project.cwd);
              await context.showToast("Path copied", { style: "success" });
            },
          },
        ],
      },
      ...(project.branch ? [
        {
          id: "branch",
          title: project.branch,
          subtitle: "Current branch",
          accessory: "branch",
          actions: [
            {
              id: "copy-branch",
              title: "Copy Branch Name",
              async onAction() {
                await context.copyToClipboard(project.branch!);
                await context.showToast("Branch name copied", { style: "success" });
              },
            },
          ] as const,
        },
      ] : []),
    ];
  },
});

const branchWidget = createWidget({
  id: "hello-world.branch-widget",
  defaultSlot: "top",
  async render(context) {
    const { project } = context;
    return {
      type: "rows",
      rows: [
        {
          label: "branch",
          value: project.branch ?? "none",
          valueColor: project.branch ? "green" : "default",
        },
        {
          label: "cwd",
          value: project.cwd,
        },
        {
          label: "open PRs",
          value: String(project.openPRs.length),
          valueColor: project.openPRs.length > 0 ? "yellow" : "default",
        },
      ],
    };
  },
});

export default definePlugin({
  name: "Hello World",
  description: "A minimal example plugin showing the Jimcast SDK basics",
  commands: [helloCommand, projectInfoCommand],
  widgets: [branchWidget],
});
