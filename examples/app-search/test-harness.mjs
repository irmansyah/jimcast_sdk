import { spawn } from "child_process";

const plugin = spawn("node", ["dist/main.js"], {
  stdio: ["pipe", "pipe", "inherit"],
});

plugin.stdin.write(JSON.stringify({
  id: "1",
  command: "executeCommand",
  args: {
    commandId: "app-search.greet",
    projectContext: {
      cwd: process.cwd(),
      repoRoot: null,
      branch: "main",
      remoteName: "origin",
      openPRs: [],
      recentCommits: [],
    },
    envContext: {
      jimcastVersion: "0.1.0",
      platform: "macos",
      pluginVersion: "0.1.0",
    }
  }
}) + "\n");

plugin.stdout.on("data", (data) => {
  console.log("plugin response:", data.toString());
});

setTimeout(() => plugin.kill(), 3000);
