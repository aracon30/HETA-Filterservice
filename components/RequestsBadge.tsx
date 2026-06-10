'use client'

import { useEffect, useState } from 'react'

export default function RequestsBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/requests/unread')
        .then(r => r.json())
        .then(data => setCount(data.count ?? 0))
        .catch(() => {})
    }

    fetchCount()
    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}
