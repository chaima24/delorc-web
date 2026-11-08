import { client } from '@/api/client'

/** Every central setting, by group. Each value is the saved one, or its default. */
export interface Settings {
  labs: { trial_months: number; grace_days: number; export_days: number }
}

/** Send only what changes: `{ labs: { grace_days: 10 } }`. */
export type SettingChanges = { [Group in keyof Settings]?: Partial<Settings[Group]> }

export const settingsApi = {
  get: () => client.get<{ data: Settings }>('/settings').then((response) => response.data.data),
  save: (changes: SettingChanges) => client.put<{ data: Settings }>('/settings', changes).then((response) => response.data.data),
}
