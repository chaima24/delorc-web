import { client } from '@/api/client'

/** Studio › Champs du compte rendu (docs/api/visit-report-fields.md): which report fields are required, optional or hidden. */

export type FieldValue = 'required' | 'optional' | 'hidden'
/** A field's value for every field of the report, as the forms receive it. */
export type ReportFieldValues = Record<string, FieldValue>
/** kind → field → value; only the cells that were set. */
export type FieldCells = Record<string, Record<string, FieldValue>>

export interface VisitFieldGrid {
  kinds: string[]
  fields: { key: string; group: string; not_for?: string[] }[]
  /** "All roles". A missing cell is optional. */
  base: FieldCells
  /** One tab per field role, with the kinds it visits. A missing cell follows the base. */
  roles: { id: number; name: string; kinds: string[]; own: FieldCells; own_count: number }[]
}

const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchVisitFieldGrid = () => data<VisitFieldGrid>(client.get('/visit-field-rules'))
/** One cell; `value: null` = inherit (a role), and the grid comes back whole. */
export const saveVisitFieldCell = (cell: { role_id: number | null; kind: string; field: string; value: FieldValue | null }) =>
  data<VisitFieldGrid>(client.put('/visit-field-rules', cell))
