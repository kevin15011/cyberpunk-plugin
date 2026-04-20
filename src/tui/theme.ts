// src/tui/theme.ts — Cyberpunk ANSI color constants

// ANSI escape helpers
function ansi(code: number): string {
  return `\x1b[${code}m`
}

const RESET = ansi(0)
const BOLD = ansi(1)
const DIM = ansi(2)

function color256(fg: number): string {
  return `\x1b[38;5;${fg}m`
}

function colorRGB(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`
}

// Cyberpunk palette
export const neonPink = color256(201)
export const neonCyan = color256(45)
export const neonGreen = color256(82)
export const neonRed = color256(197)
export const neonYellow = color256(226)
export const neonOrange = color256(208)
export const neonPurple = color256(129)
export const darkBg = color256(233)
export const grayMid = color256(60)
export const grayLight = color256(103)
export const grayBright = color256(146)
export const white = color256(189)

// Style helpers
export function bold(text: string): string {
  return `${BOLD}${text}${RESET}`
}

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`
}

export function styled(text: string, color: string): string {
  return `${color}${text}${RESET}`
}

export function cyan(text: string): string { return styled(text, neonCyan) }
export function green(text: string): string { return styled(text, neonGreen) }
export function red(text: string): string { return styled(text, neonRed) }
export function yellow(text: string): string { return styled(text, neonYellow) }
export function pink(text: string): string { return styled(text, neonPink) }
export function orange(text: string): string { return styled(text, neonOrange) }
export function purple(text: string): string { return styled(text, neonPurple) }
export function gray(text: string): string { return styled(text, grayLight) }
export function bright(text: string): string { return styled(text, grayBright) }

// Banner
export const BANNER = `
${neonCyan}  ╔══════════════════════════════════════════╗
${neonCyan}  ║${neonPink}   ⚡ CYBERPUNK ENVIRONMENT MANAGER ⚡    ${neonCyan}║
${neonCyan}  ╚══════════════════════════════════════════╝${RESET}
`

export function separator(): string {
  return `${grayMid}${"─".repeat(46)}${RESET}`
}
