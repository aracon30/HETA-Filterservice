const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])

export function toFileUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

export function isImageFile(url: string, mimeType?: string | null): boolean {
  if (mimeType?.startsWith('image/')) return true
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] ?? ''
  return IMAGE_EXTS.has(ext)
}

export async function downloadFile(url: string, fileName?: string): Promise<void> {
  const fileUrl = toFileUrl(url)
  try {
    const res = await fetch(`${fileUrl}?download=1`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName || fileUrl.split('/').pop()?.split('?')[0] || 'datei'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    // Fallback: open in new tab
    window.open(fileUrl, '_blank')
  }
}
