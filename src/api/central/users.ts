import { client } from '@/api/client'

export interface CentralUser {
  id: number
  name: string
  initials: string
  email: string
  phone: string | null
  locale: string
  is_active: boolean
  /** False until the person has used their access link. */
  has_password: boolean
  last_login_at: string | null
  role: string | null
  two_factor_method: 'none' | 'app' | 'email' | 'sms'
}

export interface UserFilters {
  search?: string
  role?: string
  is_active?: boolean
}

export interface UserList {
  data: CentralUser[]
  meta: { total: number }
}

export type NewUser = Pick<CentralUser, 'name' | 'email' | 'phone' | 'locale'> & { role: string }
export type UserChanges = Partial<Pick<CentralUser, 'name' | 'email' | 'phone' | 'locale' | 'is_active'>>

const one = (response: { data: { data: CentralUser } }) => response.data.data

export const usersApi = {
  list: (filters: UserFilters, page: number, perPage: number) => {
    const params: Record<string, string | number> = { page, per_page: perPage }
    if (filters.search) params['filter[search]'] = filters.search
    if (filters.role) params['filter[role]'] = filters.role
    if (filters.is_active !== undefined) params['filter[is_active]'] = filters.is_active ? 1 : 0

    return client.get<UserList>('/users', { params }).then((response) => response.data)
  },
  create: (user: NewUser) => client.post('/users', user).then(one),
  update: (id: number, changes: UserChanges) => client.put(`/users/${id}`, changes).then(one),
  changeRole: (id: number, role: string) => client.put(`/users/${id}/role`, { role }).then(one),
  sendAccess: (id: number) => client.post(`/users/${id}/access-link`),
  resetSecondFactor: (id: number) => client.post(`/users/${id}/second-factor/reset`).then(one),
}
