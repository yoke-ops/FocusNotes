import { useEffect, useState, type CSSProperties } from 'react'
import './glassBackdrop.css'

export function GlassBackdrop({ blur }: { blur: number }) {
  const [wallpaper, setWallpaper] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const update = () => {
      void window.focusDesktop?.glassWallpaper?.().then((image) => {
        if (alive) setWallpaper(image)
      }).catch(() => undefined)
    }
    update()
    window.addEventListener('focus', update)
    return () => {
      alive = false
      window.removeEventListener('focus', update)
    }
  }, [])
  return <div aria-hidden="true" className="glass-backdrop" style={{
    '--glass-blur': `${blur}px`,
    backgroundImage: wallpaper ? `url("${wallpaper}")` : undefined,
  } as CSSProperties} />
}
