import Sidebar from "@/components/sidebar"
import UserBadge from "@/components/user-badge"
import { Bot } from "lucide-react"
import { theme } from "@/lib/theme"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">

      {/* Top banner */}
      {!theme.isProd && (
        <div className="shrink-0 bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide">
          ⚠️ SANDBOX ENVIRONMENT — For testing purposes only
        </div>
      )}
      <div className={`shrink-0 ${theme.headerBg}`}>
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-semibold ${theme.headerText}`}>Agent Dashboard</h1>
              <p className={`text-xs ${theme.headerSub}`}>Sales Ops · Core Renewals</p>
            </div>
          </div>
          <div className={`flex items-center gap-4 ${theme.headerSub}`}>
            <UserBadge />
            {theme.isProd && (
              <span className={theme.envHeaderBadge!}>{theme.envHeaderBadgeText}</span>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar + content */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-gray-50 overflow-y-auto">
          {children}
        </main>
      </div>

    </div>
  )
}
