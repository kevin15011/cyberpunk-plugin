import { build, spawn } from "bun"
import { readFileSync, writeFileSync } from "fs"
import { parseBuildArgs, resolveOutfile } from "./src/build/config"

const { targetPlatform } = parseBuildArgs(process.argv.slice(2))
const outfile = resolveOutfile(targetPlatform)
const packageVersion = JSON.parse(readFileSync("./package.json", "utf8")).version

writeFileSync("./src/version.ts", `// src/version.ts — compile-time application version embedded into standalone binaries\n\nexport const APP_VERSION = ${JSON.stringify(packageVersion)}\n`, "utf8")

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
