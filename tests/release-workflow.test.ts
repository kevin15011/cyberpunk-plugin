import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")

const binaryJobs = [
  {
    job: "build",
    binary: "cyberpunk-linux-x64",
    checksumArtifact: "checksums-linux-x64",
  },
  {
    job: "build-linux-arm64",
    binary: "cyberpunk-linux-arm64",
    checksumArtifact: "checksums-linux-arm64",
  },
  {
    job: "build-darwin-arm64",
    binary: "cyberpunk-darwin-arm64",
    checksumArtifact: "checksums-darwin-arm64",
  },
]

function getJobBlock(jobName: string) {
  const match = workflow.match(new RegExp(`(^  ${jobName}:\\n[\\s\\S]*?)(?=^  [a-z0-9-]+:\\n|(?![\\s\\S]))`, "m"))

  expect(match, `job block not found: ${jobName}`).toBeTruthy()

  return match?.[1] ?? ""
}

describe("release workflow hardening", () => {
  test("every produced binary is smoke tested before checksum generation and release upload", () => {
    for (const { job, binary, checksumArtifact } of binaryJobs) {
      const jobBlock = getJobBlock(job)

      expect(jobBlock).toContain("- name: Smoke test binary")
      expect(jobBlock).toContain(`./${binary} help`)
      expect(jobBlock).toContain(`sha256sum ./${binary} >> checksums.txt`)
      expect(jobBlock).toContain(`name: ${checksumArtifact}`)
      expect(jobBlock).toContain(`artifacts: ./${binary}`)

      expect(jobBlock.indexOf("- name: Smoke test binary")).toBeLessThan(jobBlock.indexOf(`sha256sum ./${binary} >> checksums.txt`))
      expect(jobBlock.indexOf(`sha256sum ./${binary} >> checksums.txt`)).toBeLessThan(jobBlock.indexOf(`artifacts: ./${binary}`))
    }
  })

  test("checksum publication depends on all smoke-gated binary jobs completing", () => {
    const checksumsJob = getJobBlock("checksums")

    expect(checksumsJob).toContain("- build")
    expect(checksumsJob).toContain("- build-linux-arm64")
    expect(checksumsJob).toContain("- build-darwin-arm64")
    expect(checksumsJob).toContain("actions/download-artifact@v5")
    expect(checksumsJob).toContain("cat ./checksums/**/*.txt > ./checksums.txt")
    expect(checksumsJob).toContain("artifacts: ./checksums.txt")
  })
})
