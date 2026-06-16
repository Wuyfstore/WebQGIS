import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

function normalize(value) {
  return value.replaceAll("\\", "/").toLowerCase();
}

function listDevProcesses() {
  if (!isWindows) {
    const result = spawnSync("ps", ["-eo", "pid=,ppid=,args="], {
      encoding: "utf8"
    });
    if (result.error) {
      return [];
    }
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
        return match
          ? { pid: Number(match[1]), parentPid: Number(match[2]), commandLine: match[3] }
          : null;
      })
      .filter(Boolean);
  }

  const command = [
    "Get-CimInstance Win32_Process",
    "| Select-Object ProcessId,ParentProcessId,CommandLine",
    "| ConvertTo-Json -Depth 3"
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8"
  });
  if (result.error || !result.stdout.trim()) {
    return [];
  }
  const parsed = JSON.parse(result.stdout);
  return (Array.isArray(parsed) ? parsed : [parsed])
    .filter((item) => item?.CommandLine)
    .map((item) => ({
      pid: Number(item.ProcessId),
      parentPid: Number(item.ParentProcessId),
      commandLine: String(item.CommandLine)
    }));
}

function isProjectDevProcess(processInfo) {
  const command = normalize(processInfo.commandLine);
  const root = normalize(rootDir);
  if (!command.includes(root)) {
    return false;
  }
  return [
    "npm-run-all",
    "vite/bin/vite.js",
    "tsx/dist/cli.mjs\" watch src/main.ts",
    "tsx/dist/cli.mjs watch src/main.ts",
    "npm-cli.js\" --workspace apps/api run dev",
    "npm-cli.js --workspace apps/api run dev",
    "npm-cli.js\" --workspace apps/web run dev",
    "npm-cli.js --workspace apps/web run dev"
  ].some((needle) => command.includes(needle));
}

function collectProcessTree(processes, rootPids) {
  const selected = new Set(rootPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const processInfo of processes) {
      if (!selected.has(processInfo.pid) && selected.has(processInfo.parentPid)) {
        selected.add(processInfo.pid);
        changed = true;
      }
    }
  }
  return selected;
}

function stopProcesses(pids) {
  const currentPid = process.pid;
  for (const pid of [...pids].filter((value) => value !== currentPid).sort((a, b) => b - a)) {
    const result = isWindows
      ? spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8" })
      : spawnSync("kill", ["-TERM", String(pid)], { encoding: "utf8" });
    if (result.status === 0) {
      console.log(`[dev] stopped stale WebQGIS dev process ${pid}`);
    }
  }
}

const processes = listDevProcesses();
const staleRoots = processes
  .filter(isProjectDevProcess)
  .map((item) => item.pid);
const staleTree = collectProcessTree(processes, staleRoots);
if (staleTree.size > 0) {
  stopProcesses(staleTree);
}

const runner = isWindows ? "cmd.exe" : "npm-run-all";
const args = isWindows
  ? ["/d", "/s", "/c", "npm-run-all --parallel dev:*"]
  : ["--parallel", "dev:*"];
const child = spawn(runner, args, {
  cwd: rootDir,
  stdio: "inherit",
  shell: false
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
