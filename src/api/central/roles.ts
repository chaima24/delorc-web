import { client } from '@/api/client'

export interface Role {
  id: number
  name: string
  /** The owner role: everything. `permissions` stays empty. */
  is_super: boolean
  users_count: number
  permissions: string[]
  created_at: string
}

/** area → resource → actions */
export type PermissionCatalog = Record<string, Record<string, string[]>>

export interface RoleChanges {
  name: string
  permissions: string[]
}

const one = (response: { data: { data: Role } }) => response.data.data

export const rolesApi = {
  list: () => client.get<{ data: Role[] }>('/roles').then((response) => response.data.data),
  get: (id: number | string) => client.get('/roles/' + id).then(one),
  create: (role: RoleChanges) => client.post('/roles', role).then(one),
  update: (id: number, role: RoleChanges) => client.put(`/roles/${id}`, role).then(one),
  remove: (id: number) => client.delete(`/roles/${id}`),
  catalog: () => client.get<{ data: PermissionCatalog }>('/permissions').then((response) => response.data.data),
}
