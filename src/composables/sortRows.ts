/** Sorts a list already on the page, like `sortBy()` on a collection. `sort` is `name`, or `-name` to reverse. */
export function sortRows<T>(rows: T[], sort: string, values: Record<string, (row: T) => string | number>): T[] {
  const descending = sort.startsWith('-')
  const value = values[sort.replace('-', '')]!

  return [...rows].sort((a, b) => {
    const [first, second] = [value(a), value(b)]
    const order = typeof first === 'string' ? first.localeCompare(String(second)) : first - Number(second)

    return descending ? -order : order
  })
}
