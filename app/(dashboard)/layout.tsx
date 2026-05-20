import Sidebar from "@/components/sidebar"
import { theme } from "@/lib/theme"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {!theme.isProd && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide">
          ⚠️ SANDBOX ENVIRONMENT — For testing purposes only
        </div>
      )}
      <div className={!theme.isProd ? "flex flex-1 pt-10" : "flex flex-1"}>
        <Sidebar />
        <main className="flex-1 bg-gray-50 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
