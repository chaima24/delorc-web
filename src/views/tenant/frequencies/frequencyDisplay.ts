import type { FrequencyCell, FrequencyGrid, FrequencyGridRef } from '@/api/tenant/frequencies'

/** The kinds a grid line can be (HCP types). Doctors without a listed speciality use "all the others". */
export const LINE_KINDS = ['pharmacie', 'wholestore', 'distributor', 'dentiste', 'doctor']

/** A line of the grid being read or edited. */
export interface GridLine {
  key: string
  speciality: { id: number; name: string } | null
  hcp_type: string | null
}

export const OTHER_LINE: GridLine = { key: 'other', speciality: null, hcp_type: null }

export function lineKey(specialityId: number | null, hcpType: string | null): string {
  return specialityId ? `s:${specialityId}` : hcpType ? `k:${hcpType}` : 'other'
}

/** Specialities (A→Z), then kinds, then "all the others" last. */
export function sortLines(lines: GridLine[]): GridLine[] {
  const rank = (line: GridLine) => line.speciality ? 0 : line.hcp_type ? 1 : 2
  return [...lines].sort((a, b) => rank(a) - rank(b)
    || (a.speciality?.name ?? '').localeCompare(b.speciality?.name ?? '')
    || LINE_KINDS.indexOf(a.hcp_type ?? '') - LINE_KINDS.indexOf(b.hcp_type ?? ''))
}

/** line key → segment id → visits. */
export type GridValues = Record<string, Record<number, number>>

export function valuesOf(cells: FrequencyCell[]): GridValues {
  const values: GridValues = {}
  for (const cell of cells) {
    const key = cell.line ?? lineKey(cell.speciality_id, cell.hcp_type)
    values[key] ??= {}
    values[key][cell.segmentation_id] = cell.frequency
  }
  return values
}

/** Every cell of every line (an empty cell is sent as 0). */
export function cellsOf(lines: GridLine[], values: GridValues, segmentIds: number[]): FrequencyCell[] {
  return lines.flatMap(line => segmentIds.map(segmentationId => ({
    speciality_id: line.speciality?.id ?? null,
    hcp_type: line.speciality ? null : line.hcp_type,
    segmentation_id: segmentationId,
    frequency: values[line.key]?.[segmentationId] ?? 0,
  })))
}

/** The lines a new grid starts with: a line per kind the role visits (doctors aside) and "all the others". */
export function startingLines(visits: string[] = []): GridLine[] {
  return [
    ...LINE_KINDS.filter(kind => kind !== 'doctor' && visits.includes(kind)).map(kind => ({ key: `k:${kind}`, speciality: null, hcp_type: kind })),
    OTHER_LINE,
  ]
}

export const refOf = (grid: Pick<FrequencyGrid, 'role_id' | 'team_id' | 'start_date'>): FrequencyGridRef =>
  ({ role_id: grid.role_id, team_id: grid.team_id, start_date: grid.start_date })
