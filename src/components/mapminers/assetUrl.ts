export function resolveAssetUrl(pathname: string): string {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (typeof window === 'undefined') {
    return `${cleanPath}`;
  }
  return cleanPath;
}
