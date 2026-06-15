"use client"

import { useEffect, useState } from "react"
import { UserCircle } from "lucide-react"

export default function UserBadge() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    // Try cookies first
    const getCookie = (n: string) => {
      const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"))
      return m ? decodeURIComponent(m[1]) : null
    }

    const displayName = getCookie("agent_dashboard_user_name")
    if (displayName) { setName(displayName); return }

    const email = getCookie("agent_dashboard_user")
    if (email) {
      setName(email.split("@")[0].split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" "))
      return
    }

    // Fallback: ask the server (cookies may not be readable client-side in some cases)
    fetch("/api/sf-tasks").then(r => r.json()).then(d => {
      if (d.userEmail) {
        setName(d.userEmail.split("@")[0].split(".").map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" "))
      }
    }).catch(() => {})
  }, [])

  if (!name) return null

  return (
    <div className="flex items-center gap-1.5 text-xs opacity-80">
      <UserCircle className="w-3.5 h-3.5" />
      <span className="font-medium">{name}</span>
    </div>
  )
}
