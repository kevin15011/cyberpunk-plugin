import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8")

describe("README release install polish docs", () => {
  test("install docs mention shell-aware guidance and install summary verification", () => {
    expect(readme).toContain("shell-aware PATH guidance")
    expect(readme).toContain("verification summary")
    expect(readme).toContain("cyberpunk help")
  })

  test("macOS docs mention automatic quarantine removal and manual fallback", () => {
    expect(readme).toContain("attempts to remove the quarantine attribute automatically")
    expect(readme).toContain("xattr -d com.apple.quarantine ~/.local/bin/cyberpunk")
  })

  test("release docs explain checksum verification", () => {
    expect(readme).toContain("## Verifying downloads")
    expect(readme).toContain("sha256sum -c checksums.txt")
    expect(readme).toContain("checksums.txt")
  })

  test("5.6: macOS docs reflect audited support status with explicit deferrals", () => {
    // Audited support statement
    expect(readme).toContain("verified upgrade integrity")
    expect(readme).toContain("Verified upgrade path")
    expect(readme).toContain("Signing and notarization deferred")

    // Explicit deferral language
    expect(readme).toContain("deferred to a future release")

    // Doctor diagnostics reference
    expect(readme).toContain("cyberpunk doctor")
  })

  test("5.6: upgrade hardening docs describe checksum, smoke test, and quarantine steps", () => {
    expect(readme).toContain("Upgrade integrity verification")
    expect(readme).toContain("Checksum verification")
    expect(readme).toContain("Smoke test")
    expect(readme).toContain("Quarantine handling")
    expect(readme).toContain("Atomic replacement")
    expect(readme).toContain("existing binary is left unchanged")
  })
})
