import { client } from '@/api/client'

/** A lab role. Permissions are names: `visits.show`. */
export interface Role {
  id: number
  name: string
  /** The top role: may do everything, `permissions` stays empty. */
  is_super: boolean
  /** One of the lab's starting roles: keeps its name, cannot be deleted. */
  built_in: boolean
  sees: 'own' | 'reports' | 'everyone'
  is_field: boolean
  /** The kinds of professionals its people visit: doctor, dentiste, pharmacie, wholestore, distributor. */
  visits: string[]
  users_count?: number
  permissions: string[]
  created_at: string | null
  /** On a single role: its active people, by name (first 200). */
  users?: { id: number; name: string }[]
}

/** What `PUT roles/{id}` needs: every field. */
export type RoleFields = Pick<Role, 'name' | 'sees' | 'is_field' | 'visits' | 'permissions'>

/** The permission catalog: area, then resource, then its actions. `{ people: { users: ['show', 'create'] } }` */
export type PermissionCatalog = Record<string, Record<string, string[]>>

const fields = (role: Role): RoleFields => ({ name: role.name, sees: role.sees, is_field: role.is_field, visits: role.visits, permissions: role.permissions })

export const rolesApi = {
  /** Every role at once (a lab has a few): the page searches, filters and sorts them. */
  list: () => client.get<{ data: Role[] }>('/roles').then((response) => response.data.data),
  get: (id: number) => client.get<{ data: Role }>(`/roles/${id}`).then((response) => response.data.data),
  create: (role: RoleFields) => client.post<{ data: Role }>('/roles', role).then((response) => response.data.data),
  /** The API wants every field, so the role's current values fill what does not change. */
  update: (role: Role, changes: Partial<RoleFields>) =>
    client.put<{ data: Role }>(`/roles/${role.id}`, { ...fields(role), ...changes }).then((response) => response.data.data),
  remove: (id: number) => client.delete(`/roles/${id}`),
  permissions: () => client.get<{ data: PermissionCatalog }>('/permissions').then((response) => response.data.data),
}
