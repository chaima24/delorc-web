import type { HcpImportField, HcpImportProblem, HcpImportRow } from '@/api/tenant/hcps'

/**
 * A Delego field a file column can go to. `first_name` / `last_name` are joined into the name
 * (old exports had them apart), `gps` is "lat,lng" in one cell.
 */
export type ImportTarget = HcpImportField | 'first_name' | 'last_name' | 'gps'

/** In the order shown in the "Delego field" lists and in the template. */
export const IMPORT_TARGETS: ImportTarget[] = [
  'name', 'first_name', 'last_name', 'type', 'gender', 'speciality', 'hco', 'since', 'wilaya', 'commune', 'address',
  'gps', 'latitude', 'longitude', 'phone', 'email', 'fax', 'contacted_by', 'status', 'one_key_id', 'wkp_id',
]

/** Needed to add a new professional (an update only needs the OneKey ID). */
export const NEEDED_FOR_NEW: ImportTarget[] = ['name', 'type', 'commune', 'one_key_id', 'wkp_id']

/** The template's columns. */
export const TEMPLATE_TARGETS: ImportTarget[] = [
  'name', 'type', 'gender', 'speciality', 'hco', 'since', 'wilaya', 'commune', 'address', 'gps', 'phone', 'email', 'fax', 'one_key_id', 'wkp_id',
]

/** Column names seen in lab files (French, English, Arabic, old exports), compared without case or accents. */
const ALIASES: Record<ImportTarget, string[]> = {
  name: ['name', 'nom complet', 'full name', 'nom et prenom', 'nom prenom', 'raison sociale', 'الاسم', 'الاسم الكامل'],
  first_name: ['first name', 'firstname', 'prenom', 'الاسم الأول'],
  last_name: ['last name', 'lastname', 'nom de famille', 'اللقب'],
  type: ['type', 'categorie', 'category', 'النوع'],
  gender: ['gender', 'genre', 'sexe', 'civilite', 'الجنس'],
  speciality: ['speciality', 'specialty', 'specialite', 'specialty 1 vod c', 'التخصص'],
  hco: ['organisation', 'organization', 'hco', 'structure', 'etablissement', 'wkp name', 'lieu d exercice', 'المؤسسة'],
  since: ['since', 'depuis', 'start date', 'date debut', 'منذ'],
  wilaya: ['wilaya', 'state', 'الولاية'],
  commune: ['commune', 'city', 'ville', 'البلدية'],
  address: ['address', 'adresse', 'العنوان'],
  gps: ['gps', 'coordinates', 'coordonnees', 'position'],
  latitude: ['latitude', 'lat', 'خط العرض'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'خط الطول'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'mobile c', 'portable', 'الهاتف'],
  email: ['email', 'e mail', 'mail', 'courriel', 'personemail', 'البريد الإلكتروني'],
  fax: ['fax', 'الفاكس'],
  contacted_by: ['contacted by', 'contact par', 'prefers', 'prefere', 'يفضل التواصل عبر'],
  status: ['status', 'statut', 'etat', 'is active', 'الحالة'],
  one_key_id: ['onekey', 'one key', 'onekey id', 'one key id', 'code onekey', 'id onekey', 'معرف onekey'],
  wkp_id: ['wkp', 'wkp id', 'id wkp', 'معرف wkp'],
}

/** Lower case, no accents, punctuation as spaces: "Code_Onekey" = "code onekey". */
export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s'’`\-_.,()/]+/g, ' ')
    .trim()
}

/**
 * The field each column goes to, guessed from its name (or from the field's label in the viewer's
 * language, so the template always matches). A bare "Nom" is the last name when a first-name column exists.
 */
export function autoMatch(headers: string[], label: (target: ImportTarget) => string): (ImportTarget | null)[] {
  const keys = headers.map(normalize)
  const hasFirstName = keys.some(key => ALIASES.first_name.map(normalize).includes(key))
  const used = new Set<ImportTarget>()

  return keys.map(key => {
    if (!key) return null
    let match = IMPORT_TARGETS.find(target => normalize(label(target)) === key || ALIASES[target].map(normalize).includes(key)) ?? null
    if (!match && key === 'nom') match = hasFirstName ? 'last_name' : 'name'
    if (!match || used.has(match)) return null
    used.add(match)
    return match
  })
}

const text = (cell: unknown) => (cell === null || cell === undefined ? '' : String(cell).trim())

/** One row for the API from a file line: joins first + last name, splits "lat,lng". */
export function buildRow(cells: unknown[], mapping: (ImportTarget | null)[], line: number): HcpImportRow {
  const row: HcpImportRow = { row: line }
  const parts: Partial<Record<ImportTarget, string>> = {}
  mapping.forEach((target, index) => {
    if (target) parts[target] = text(cells[index])
  })
  for (const [target, value] of Object.entries(parts) as [ImportTarget, string][]) {
    if (target === 'first_name' || target === 'last_name' || target === 'gps') continue
    row[target] = value
  }
  if (!parts.name && (parts.first_name || parts.last_name)) row.name = [parts.first_name, parts.last_name].filter(Boolean).join(' ')
  if (parts.gps) {
    // "36.7431,3.0412" or "36,7431 ; 3,0412" or "36.7431 3.0412"
    const numbers = parts.gps.match(/-?\d+(?:[.,]\d+)?/g) ?? []
    const [lat, lng] = numbers.length === 2 ? numbers : parts.gps.split(/[;,\s]+/)
    row.latitude = lat?.replace(',', '.') ?? ''
    row.longitude = lng?.replace(',', '.') ?? ''
  }
  return row
}

/** Same OneKey ID, phone or e-mail on several lines of the file: every line after the first is a problem. */
export function fileDuplicates(rows: HcpImportRow[]): Map<number, HcpImportProblem[]> {
  const problems = new Map<number, HcpImportProblem[]>()
  const keys: [HcpImportField, (value: string) => string][] = [
    ['one_key_id', value => value.trim()],
    ['phone', value => value.replace(/[\s.-]/g, '')],
    ['email', value => value.trim().toLowerCase()],
  ]
  for (const [field, key] of keys) {
    const first = new Map<string, number>()
    for (const row of rows) {
      const value = key(row[field] ?? '')
      if (!value) continue
      const seen = first.get(value)
      if (seen === undefined) first.set(value, row.row)
      else problems.set(row.row, [...(problems.get(row.row) ?? []), { field, code: 'duplicate', value, other: String(seen) }])
    }
  }
  return problems
}

/** Splits a list into batches of `size`. */
export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
