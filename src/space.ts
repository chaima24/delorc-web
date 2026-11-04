/**
 * Where the app is running, read from the browser address:
 * localhost is the central console, {lab}.localhost is a lab.
 */
export function resolveSpace(hostname: string, centralDomain: string) {
  const isCentral = hostname === centralDomain

  return { isCentral, labId: isCentral ? null : (hostname.split('.')[0] ?? null) }
}

export const space = resolveSpace(window.location.hostname, import.meta.env.VITE_CENTRAL_DOMAIN)

/** The API lives on the same host: the lab comes from the subdomain, as in the API. */
export function apiBaseUrl(location: Pick<Location, 'protocol' | 'hostname'>, port?: string, isCentral = space.isCentral) {
  const host = port ? `${location.hostname}:${port}` : location.hostname

  return `${location.protocol}//${host}/api/v1${isCentral ? '/central' : ''}`
}
