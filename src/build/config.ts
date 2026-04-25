// src/build/config.ts — Build platform configuration
//
// Provides target-platform-aware outfile resolution and argument parsing
// for the build script. Keeps Linux/macOS output unchanged while producing
// .exe for Windows targets.

/** Supported target platforms for binary compilation. */
export type BuildTargetPlatform = "linux" | "darwin" | "windows"

const VALID_PLATFORMS: ReadonlySet<BuildTargetPlatform> = new Set(["linux", "darwin", "windows"])

/**
 * Resolve the output filename for the compiled binary.
 *
 * - `windows` produces `./cyberpunk.exe`
 * - `linux`, `darwin`, or undefined produces `./cyberpunk` (unchanged)
 */
export function resolveOutfile(platform?: BuildTargetPlatform): string {
  if (!platform || platform === "linux" || platform === "darwin") {
    return "./cyberpunk"
  }
  if (platform === "windows") {
    return "./cyberpunk.exe"
  }
  // Exhaustive check — unreachable with proper types
  const _exhaustive: never = platform
  throw new Error(`Unknown target platform: ${String(_exhaustive)}`)
}

/**
 * Parse build script arguments.
 *
 * Recognises `--target-platform <linux|darwin|windows>`.
 * Throws on missing or invalid values.
 */
export function parseBuildArgs(argv: readonly string[]): { targetPlatform?: BuildTargetPlatform } {
  const result: { targetPlatform?: BuildTargetPlatform } = {}

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target-platform") {
      const value = argv[i + 1]
      if (!value || !VALID_PLATFORMS.has(value as BuildTargetPlatform)) {
        throw new Error(
          `--target-platform requires one of: ${[...VALID_PLATFORMS].join(", ")}. Got: ${value ?? "(none)"}`
        )
      }
      result.targetPlatform = value as BuildTargetPlatform
      i++
    }
  }

  return result
}
