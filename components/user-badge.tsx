"use client"

import { useEffect, useState } from "react"
import { UserCircle } from "lucide-react"

function nameFromEmail(email: string) {
  return email.split("@")[0].split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
}

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"))
  return match ? decodeURIComponent(match[1]) : null
}

export default function UserBadge() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const email = getCookie("agent_dashboard_user")
    if (email) setName(nameFromEmail(email))
  }, [])

  if (!name) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      <UserCircle className="w-4 h-4 opacity-60" />
      <span className="font-medium">{name}</span>
    </div>
  )
}
