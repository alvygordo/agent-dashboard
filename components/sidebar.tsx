"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Layers, Bot, Sparkles, CheckSquare, ClipboardList, BookOpen } from "lucide-react"
import { theme } from "@/lib/theme"

const navItems = [
  { href: "/",          label: "Home",        icon: Home },
  { href: "/workflows", label: "Workflows",   icon: Layers },
  { href: "/agents",    label: "Agents",      icon: Bot },
  { href: "/tools",     label: "GPTs & Gems", icon: Sparkles },
  { href: "/tasks",     label: "Tasks",       icon: CheckSquare },
  { href: "/nnr",       label: "NNR Tracker", icon: ClipboardList },
  { href: "/kb",        label: "Knowledge Base", icon: BookOpen, sandboxOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()

  const activeLink = theme.isProd
    ? "bg-[#009688] text-white"
    : "bg-purple-700 text-white"

  const hoverLink = theme.isProd
    ? "text-gray-600 hover:bg-[#e0f7f5] hover:text-[#009688]"
    : "text-gray-600 hover:bg-purple-50 hover:text-purple-700"

  const sidebarBg = "bg-white border-r border-gray-200"

  return (
    <aside className={`w-52 shrink-0 min-h-screen flex flex-col ${sidebarBg}`}>

      {/* Nav label */}
      <div className="px-4 py-4 border-b border-gray-200">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Navigation</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, sandboxOnly }: { href: string; label: string; icon: React.ElementType; sandboxOnly?: boolean }) => {
          if (sandboxOnly && theme.isProd) return null
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? activeLink : hoverLink
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Env badge at bottom */}
      <div className="px-4 py-4 border-t border-gray-200">
        {theme.isProd ? (
          <span className="block text-center text-xs font-semibold bg-[#e0f7f5] text-[#009688] border border-[#b2e8e2] rounded-full px-3 py-1">
            PRODUCTION
          </span>
        ) : (
          <span className="block text-center text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-300 rounded-full px-3 py-1">
            SANDBOX
          </span>
        )}
      </div>

    </aside>
  )
}
