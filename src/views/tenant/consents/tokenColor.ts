/** A `dl-*` token as `#rrggbb`, for drawings that need a hex colour (the QR code, the signature line). */
export function tokenHex(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--dl-${name}`).trim()
  return `#${value.split(/\s+/).map(part => Number(part).toString(16).padStart(2, '0')).join('')}`
}
