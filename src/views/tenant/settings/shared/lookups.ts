const ACRONYMS = new Set(['vm', 'vp', 'kam', 'r'])

/** "regional_supervisor" → "Regional supervisor", "vm" → "VM". */
export function roleLabel(name?: string | null): string {
  if (!name) return '—'
  const words = name.split('_').map(word => (ACRONYMS.has(word) ? word.toUpperCase() : word))
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
