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
})
