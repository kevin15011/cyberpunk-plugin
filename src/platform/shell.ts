// src/platform/shell.ts — ShellInfo detection and command execution descriptors

import { execSync } from "child_process"
import type { PlatformInfo, ShellInfo } from "../domain/environment"
import { detectEnvironment } from "./detect"

/**
 * Check if a command is available on PATH.
 * Uses `where` on Windows, `which` on POSIX — never uses raw `which` on Windows.
 */
export function isCommandOnPath(command: string): boolean {
  const env = detectEnvironment()
  const lookupCmd = env === "windows"
    ? `where ${command}`
    : `which ${command} 2>/dev/null`
  try {
    execSync(lookupCmd, { encoding: "utf8", stdio: "pipe", env: { ...process.env as Record<string, string> } })
    return true
  } catch {
    return false
  }
}

/**
 * Detect the current shell based on platform and environment variables.
 *
 * Windows: checks COMSPEC for powershell or cmd.exe
 * POSIX: checks SHELL for bash, zsh, etc.
 */
export function detectShell(platform: PlatformInfo): ShellInfo {
  if (platform.kind === "windows") {
    const comspec = process.env.COMSPEC || ""
    const lower = comspec.toLowerCase()

    if (lower.includes("powershell") || lower.includes("pwsh")) {
      return { kind: "powershell", executable: comspec }
    }
    if (lower.includes("cmd")) {
      return { kind: "cmd", executable: comspec }
    }

    // Default Windows shell fallback
    return { kind: "cmd" }
  }

  // POSIX: linux, darwin, wsl
  const shell = process.env.SHELL || ""

  if (shell.endsWith("/bash") || shell.includes("/bash")) {
    return { kind: "bash", executable: shell }
  }
  if (shell.endsWith("/zsh") || shell.includes("/zsh")) {
    return { kind: "zsh", executable: shell }
  }

  if (shell) {
    // Unknown shell but SHELL is set — extract the shell name
    return { kind: "unknown", executable: shell }
  }

  return { kind: "unknown" }
}

/**
 * Build a command descriptor appropriate for the given shell.
 * Wraps the raw command in the shell invocation pattern.
 */
export function buildCommand(command: string, shell: ShellInfo): string {
  switch (shell.kind) {
    case "bash":
    case "zsh":
      return shell.executable
        ? `${shell.executable} -c ${quoteArg(command)}`
        : command
    case "powershell":
      return shell.executable
        ? `${shell.executable} -Command ${quoteArg(command)}`
        : `powershell -Command ${quoteArg(command)}`
    case "cmd":
      return shell.executable
        ? `${shell.executable} /c ${quoteArg(command)}`
        : `cmd /c ${quoteArg(command)}`
    case "unknown":
      return command
  }
}

/**
 * Quote a command argument for the current platform.
 * Uses single quotes on POSIX, double quotes on Windows.
 */
function quoteArg(arg: string): string {
  return `"${arg}"`
}
