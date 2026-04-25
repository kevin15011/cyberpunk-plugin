// tests/platform-shell.test.ts — RED: assert detectShell() returns powershell/cmd on Windows, bash/zsh on POSIX.

import { describe, test, expect, beforeEach, afterEach } from "bun:test"

async function importShell() {
  return import(`../src/platform/shell.ts?t=${Date.now()}`)
}

describe("detectShell() on POSIX", () => {
  const savedShell = process.env.SHELL
  const savedComSpec = process.env.COMSPEC
  const savedPath = process.env.PATH

  afterEach(() => {
    if (savedShell === undefined) delete process.env.SHELL; else process.env.SHELL = savedShell
    if (savedComSpec === undefined) delete process.env.COMSPEC; else process.env.COMSPEC = savedComSpec
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath
  })

  test("returns bash when SHELL ends with /bash", async () => {
    process.env.SHELL = "/bin/bash"
    const mod = await importShell()
    const result = mod.detectShell({ kind: "linux", arch: "x64", configRoot: "" })
    expect(result.kind).toBe("bash")
  })

  test("returns zsh when SHELL ends with /zsh", async () => {
    process.env.SHELL = "/bin/zsh"
    const mod = await importShell()
    const result = mod.detectShell({ kind: "darwin", arch: "arm64", configRoot: "" })
    expect(result.kind).toBe("zsh")
  })

  test("returns unknown when SHELL is unset and platform is POSIX", async () => {
    delete process.env.SHELL
    delete process.env.COMSPEC
    const mod = await importShell()
    const result = mod.detectShell({ kind: "linux", arch: "x64", configRoot: "" })
    expect(result.kind).toBe("unknown")
  })

  test("includes executable path when detected from SHELL env", async () => {
    process.env.SHELL = "/bin/zsh"
    const mod = await importShell()
    const result = mod.detectShell({ kind: "darwin", arch: "arm64", configRoot: "" })
    expect(result.executable).toBe("/bin/zsh")
  })
})

describe("detectShell() on Windows", () => {
  const savedComSpec = process.env.COMSPEC
  const savedShell = process.env.SHELL

  afterEach(() => {
    if (savedComSpec === undefined) delete process.env.COMSPEC; else process.env.COMSPEC = savedComSpec
    if (savedShell === undefined) delete process.env.SHELL; else process.env.SHELL = savedShell
  })

  test("returns powershell when COMSPEC contains powershell", async () => {
    process.env.COMSPEC = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    const mod = await importShell()
    const result = mod.detectShell({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result.kind).toBe("powershell")
  })

  test("returns cmd when COMSPEC contains cmd.exe", async () => {
    process.env.COMSPEC = "C:\\Windows\\System32\\cmd.exe"
    const mod = await importShell()
    const result = mod.detectShell({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result.kind).toBe("cmd")
  })

  test("returns cmd as default when COMSPEC is unset on Windows", async () => {
    delete process.env.COMSPEC
    const mod = await importShell()
    const result = mod.detectShell({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result.kind).toBe("cmd")
  })

  test("includes executable path from COMSPEC", async () => {
    process.env.COMSPEC = "C:\\Windows\\System32\\cmd.exe"
    const mod = await importShell()
    const result = mod.detectShell({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result.executable).toBe("C:\\Windows\\System32\\cmd.exe")
  })
})

describe("buildCommand()", () => {
  test("wraps command in shell-appropriate invocation", async () => {
    const mod = await importShell()
    const cmd = mod.buildCommand("echo hello", { kind: "bash", executable: "/bin/bash" })
    expect(cmd).toContain("echo hello")
  })

  test("wraps command for powershell", async () => {
    const mod = await importShell()
    const cmd = mod.buildCommand("Get-Content file.txt", { kind: "powershell", executable: "powershell.exe" })
    expect(cmd).toContain("Get-Content file.txt")
  })

  test("wraps command for cmd", async () => {
    const mod = await importShell()
    const cmd = mod.buildCommand("dir", { kind: "cmd", executable: "cmd.exe" })
    expect(cmd).toContain("dir")
  })

  test("handles unknown shell by returning raw command", async () => {
    const mod = await importShell()
    const cmd = mod.buildCommand("some-command", { kind: "unknown" })
    expect(cmd).toBe("some-command")
  })
})
