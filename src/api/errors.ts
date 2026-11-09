import axios from 'axios'

/** Laravel's validation answer: every message, grouped by field. */
export function fieldErrors(error: unknown): Record<string, string> {
  const errors = axios.isAxiosError(error) ? error.response?.data?.errors : undefined

  return Object.fromEntries(
    Object.entries<string[]>(errors ?? {}).map(([field, messages]) => [field, messages[0] ?? '']),
  )
}

/** The API's message, already translated. Null when the API gave none (no network, for example). */
export function errorMessage(error: unknown): string | null {
  const first = Object.values(fieldErrors(error))[0]
  const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined

  return first ?? message ?? null
}
