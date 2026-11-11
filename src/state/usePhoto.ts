import { useEffect, useState } from 'react'
import { repository } from '../storage'

/** Small in-memory cache so lists don't re-read the same photos from IndexedDB. */
const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

export function loadPhoto(id: string): Promise<string | null> {
  if (cache.has(id)) return Promise.resolve(cache.get(id)!)
  let p = pending.get(id)
  if (!p) {
    p = repository
      .getPhoto(id)
      .then((ph) => ph?.dataUrl ?? null)
      .catch(() => null)
      .then((v) => {
        cache.set(id, v)
        pending.delete(id)
        return v
      })
    pending.set(id, p)
  }
  return p
}

export function primePhoto(id: string, dataUrl: string) {
  cache.set(id, dataUrl)
}

export function usePhoto(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (id ? cache.get(id) ?? null : null))
  useEffect(() => {
    let alive = true
    if (!id) {
      setUrl(null)
      return
    }
    if (cache.has(id)) {
      setUrl(cache.get(id)!)
      return
    }
    loadPhoto(id).then((v) => alive && setUrl(v))
    return () => {
      alive = false
    }
  }, [id])
  return url
}

/** Downscale an image file to a JPEG data URL (longest side `max` px). */
export async function compressImage(file: File, max = 1280, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.')
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is over 25 MB. Choose a smaller one.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That image couldn’t be read. Try a JPEG or PNG.')
  })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}
