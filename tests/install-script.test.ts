import { afterEach, describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

type Fixture = ReturnType<typeof createInstallerFixture>

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

  for (const commandName of ["basename", "cat", "chmod", "grep", "mkdir", "tr"]) {
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
    expect(result.stdout).toContain("Verify install: cyberpunk help")
    expect(readFileSync(join(currentFixture.home, ".zshrc"), "utf8")).toBe('export PATH="$HOME/.local/bin:$PATH"\n')
  })

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
    expect(result.stdout).toContain("Add ~/.local/bin to your PATH via ~/.config/fish/config.fish")
    expect(result.stdout).toContain("Run: exec fish")
    expect(result.stdout).toContain("Automatic quarantine removal could not run")
    expect(result.stdout).toContain("xattr -d com.apple.quarantine")
    expect(result.stdout).toContain("Remaining action: install ffmpeg")
  })

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
  })
})
