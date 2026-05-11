import { afterEach, describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

type Fixture = ReturnType<typeof createInstallerFixture>
const INSTALL_SCRIPT_TEST_TIMEOUT_MS = 30000

function createInstallerFixture(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), `${prefix}-`))
  const home = join(root, "home")
  const binDir = join(root, "bin")

  mkdirSync(home, { recursive: true })
  mkdirSync(binDir, { recursive: true })

  const writeExecutable = (name: string, content: string) => {
    const filePath = join(binDir, name)
    writeFileSync(filePath, content, "utf8")
    chmodSync(filePath, 0o755)
    return filePath
  }

  const writePassThrough = (name: string) => {
    const resolved = Bun.which(name)
    if (!resolved) {
      throw new Error(`missing required system command for test fixture: ${name}`)
    }

    return writeExecutable(name, `#!/bin/sh
exec "${resolved}" "$@"
`)
  }

  for (const commandName of ["basename", "cat", "chmod", "grep", "mkdir", "rm", "tail", "tr", "wc"]) {
    writePassThrough(commandName)
  }

  writeExecutable("curl", `#!/bin/sh
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    out="$2"
    shift 2
    continue
  fi
  shift
done

cat > "$out" <<'EOF'
#!/bin/sh
CONFIG_DIR="\${HOME}/.config/cyberpunk"
CONFIG_FILE="\${CONFIG_DIR}/install-mode.txt"

case "$1" in
  config)
    case "$2" in
      init)
        mkdir -p "\${CONFIG_DIR}"
        exit 0
        ;;
      installMode)
        mkdir -p "\${CONFIG_DIR}"
        if [ -n "$3" ]; then
          printf '%s' "$3" > "\${CONFIG_FILE}"
          exit 0
        fi
        if [ -f "\${CONFIG_FILE}" ]; then
          cat "\${CONFIG_FILE}"
        fi
        exit 0
        ;;
    esac
    ;;
  tui)
    echo "MOCK TUI"
    exit 0
    ;;
  help)
    echo "cyberpunk help"
    exit 0
    ;;
esac

exit 0
EOF

chmod +x "$out"
`)

  return {
    root,
    home,
    binDir,
    cleanup() {
      rmSync(root, { recursive: true, force: true })
    },
    writeExecutable,
  }
}

function installEnv(fixture: Fixture, shellPath: string) {
  return {
    ...process.env,
    HOME: fixture.home,
    SHELL: shellPath,
    PATH: fixture.binDir,
  }
}

function runInstaller(env: Record<string, string | undefined>) {
  const result = Bun.spawnSync(["/bin/bash", "install.sh"], {
    cwd: new URL("..", import.meta.url).pathname,
    env,
    stdout: "pipe",
    stderr: "pipe",
  })

  return {
    exitCode: result.exitCode,
    stdout: Buffer.from(result.stdout).toString("utf8"),
    stderr: Buffer.from(result.stderr).toString("utf8"),
  }
}

let currentFixture: Fixture | null = null

afterEach(() => {
  currentFixture?.cleanup()
  currentFixture = null
})

describe("install.sh release polish", () => {
  test("uses shell-aware PATH guidance, avoids duplicate export messaging, and prints verification summary", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-linux")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Linux
else
  echo x86_64
fi
`)
    currentFixture.writeExecutable("ffplay", "#!/bin/sh\nexit 0\n")

    writeFileSync(join(currentFixture.home, ".zshrc"), 'export PATH="$HOME/.local/bin:$PATH"\n', "utf8")

    const result = runInstaller(installEnv(currentFixture, "/bin/zsh"))

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("PATH export already exists in ~/.zshrc")
    expect(result.stdout).toContain("Run: source ~/.zshrc")
    expect(result.stdout).toContain("Installed binary: " + join(currentFixture.home, ".local", "bin", "cyberpunk"))
    expect(result.stdout).toContain("Verify install now: " + join(currentFixture.home, ".local", "bin", "cyberpunk") + " help")
    expect(result.stdout).toContain("Verify after PATH reload: cyberpunk help")
    expect(readFileSync(join(currentFixture.home, ".zshrc"), "utf8")).toBe('export PATH="$HOME/.local/bin:$PATH"\n')
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("surfaces ffmpeg follow-up guidance and macOS quarantine fallback in the install summary", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-macos")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Darwin
else
  echo arm64
fi
`)

    const fishConfigDir = join(currentFixture.home, ".config", "fish")
    mkdirSync(fishConfigDir, { recursive: true })
    writeFileSync(join(fishConfigDir, "config.fish"), "# fish config\n", "utf8")

    const result = runInstaller(installEnv(currentFixture, "/usr/local/bin/fish"))

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("ffmpeg is still required for sound generation features")
    expect(result.stdout).toContain("brew install ffmpeg")
    expect(result.stdout).toContain("Added ~/.local/bin to ~/.config/fish/config.fish")
    expect(result.stdout).toContain("Run: exec fish")
    expect(result.stdout).toContain("Automatic quarantine removal could not run")
    expect(result.stdout).toContain("xattr -d com.apple.quarantine")
    expect(result.stdout).toContain("Remaining action: install ffmpeg")
    expect(result.stdout).toContain("Verify install now: " + join(currentFixture.home, ".local", "bin", "cyberpunk") + " help")
    expect(readFileSync(join(fishConfigDir, "config.fish"), "utf8")).toContain("fish_add_path ~/.local/bin")
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("adds PATH export to zsh profile when ~/.local/bin is missing", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-zsh-path")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Darwin
else
  echo arm64
fi
`)
    currentFixture.writeExecutable("ffplay", "#!/bin/sh\nexit 0\n")

    const result = runInstaller(installEnv(currentFixture, "/bin/zsh"))

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Added ~/.local/bin to ~/.zshrc")
    expect(result.stdout).toContain("Run: source ~/.zshrc")
    expect(result.stdout).toContain("Verify install now: " + join(currentFixture.home, ".local", "bin", "cyberpunk") + " help")
    expect(result.stdout).toContain("Verify after PATH reload: cyberpunk help")
    expect(readFileSync(join(currentFixture.home, ".zshrc"), "utf8")).toContain('export PATH="$HOME/.local/bin:$PATH"')
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("fails early on unsupported macOS Intel with source-build guidance", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-macos-intel")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Darwin
else
  echo x86_64
fi
`)

    const result = runInstaller(installEnv(currentFixture, "/bin/zsh"))

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain("macOS Intel is no longer provided as a pre-built binary target")
    expect(result.stdout).toContain("Please build Cyberpunk from source on this machine")
    expect(result.stdout).toContain("bun install && bun run build")
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("appends PATH on its own line when profile has no trailing newline", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-no-newline")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Linux
else
  echo x86_64
fi
`)
    currentFixture.writeExecutable("ffplay", "#!/bin/sh\nexit 0\n")

    // Write .zshrc WITHOUT a trailing newline
    writeFileSync(join(currentFixture.home, ".zshrc"), "alias ll='ls -la'", "utf8")

    const result = runInstaller(installEnv(currentFixture, "/bin/zsh"))

    expect(result.exitCode).toBe(0)
    const contents = readFileSync(join(currentFixture.home, ".zshrc"), "utf8")
    // The original content must remain intact on its own line
    expect(contents).toContain("alias ll='ls -la'\n")
    // The PATH export must be on its own line (not concatenated onto the alias line)
    expect(contents).toContain('\nexport PATH="$HOME/.local/bin:$PATH"')
    // Exactly one PATH export line should be present
    const pathLines = contents.split("\n").filter(line => line.includes('export PATH="$HOME/.local/bin:$PATH"'))
    expect(pathLines.length).toBe(1)
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("does not duplicate PATH when unquoted variant already exists in profile", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-unquoted")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Linux
else
  echo x86_64
fi
`)
    currentFixture.writeExecutable("ffplay", "#!/bin/sh\nexit 0\n")

    // Write .zshrc with an unquoted variant of the PATH export
    writeFileSync(join(currentFixture.home, ".zshrc"), 'export PATH=$HOME/.local/bin:$PATH\n', "utf8")

    const result = runInstaller(installEnv(currentFixture, "/bin/zsh"))

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("PATH export already exists in ~/.zshrc")
    const contents = readFileSync(join(currentFixture.home, ".zshrc"), "utf8")
    // Should NOT have appended a duplicate PATH line
    const pathLines = contents.split("\n").filter(line =>
      line.includes('export PATH=') && line.includes('.local/bin')
    )
    expect(pathLines.length).toBe(1)
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("maps bash shell to ~/.bashrc and appends PATH there", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-bash")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Linux
else
  echo x86_64
fi
`)
    currentFixture.writeExecutable("ffplay", "#!/bin/sh\nexit 0\n")

    const result = runInstaller(installEnv(currentFixture, "/bin/bash"))

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("~/.bashrc")
    expect(result.stdout).toContain("Run: source ~/.bashrc")
    const bashrc = readFileSync(join(currentFixture.home, ".bashrc"), "utf8")
    expect(bashrc).toContain('export PATH="$HOME/.local/bin:$PATH"')
    // Exactly one PATH export line
    const pathLines = bashrc.split("\n").filter(line => line.includes('export PATH="$HOME/.local/bin:$PATH"'))
    expect(pathLines.length).toBe(1)
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)

  test("appends exactly one PATH line to a new profile", () => {
    currentFixture = createInstallerFixture("cyberpunk-install-single-append")
    currentFixture.writeExecutable("uname", `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo Linux
else
  echo x86_64
fi
`)
    currentFixture.writeExecutable("ffplay", "#!/bin/sh\nexit 0\n")

    // No .zshrc file exists at all — it will be created from scratch
    const result = runInstaller(installEnv(currentFixture, "/bin/zsh"))

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Added ~/.local/bin to ~/.zshrc")
    const contents = readFileSync(join(currentFixture.home, ".zshrc"), "utf8")
    const pathLines = contents.split("\n").filter(line => line.includes('export PATH="$HOME/.local/bin:$PATH"'))
    expect(pathLines.length).toBe(1)
  }, INSTALL_SCRIPT_TEST_TIMEOUT_MS)
})
