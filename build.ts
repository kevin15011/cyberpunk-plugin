import { build, spawn } from "bun"
import { parseBuildArgs, resolveOutfile } from "./src/build/config"

const { targetPlatform } = parseBuildArgs(process.argv.slice(2))
const outfile = resolveOutfile(targetPlatform)

// Build and compile to standalone binary
const result = await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
})

if (!result.success) {
  console.error("Build failed:")
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

// Use bun compile to create standalone binary
const proc = spawn([
  "bun", "build", "--compile", "./dist/index.js", "--outfile", outfile
], {
  stdout: "inherit",
  stderr: "inherit",
})

const exitCode = await proc.exited
if (exitCode === 0) {
  console.log(`Binary built: ${outfile}`)
} else {
  console.error("Compile failed")
  process.exit(1)
}
