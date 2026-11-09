/** Saves a file the API sent, like a download link would. */
export function downloadFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
