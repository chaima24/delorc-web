/**
 * Downloads rows as an Excel file: one sheet, the keys of the first row as headers.
 * The package loads only on the first export, so pages without one stay light.
 * Example: exportToXlsx([{ Nom: 'Haddad', Rôle: 'VM' }], 'Utilisateurs 2026-11-09', 'Utilisateurs')
 */
export async function exportToXlsx(rows: Record<string, unknown>[], filename: string, sheetName = 'Sheet1'): Promise<void> {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  // Excel allows 31 characters in a sheet name.
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31))
  XLSX.writeFile(book, `${filename}.xlsx`)
}
