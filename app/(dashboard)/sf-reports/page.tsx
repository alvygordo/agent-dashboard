import { BarChart2 } from "lucide-react"
import { theme } from "@/lib/theme"

export default function SFReportsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
          <BarChart2 className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">SF Reports</h1>
      </div>
      <p className="text-sm text-gray-500 ml-12 mb-8">
        Salesforce reports and dashboards for the renewals team.
      </p>

      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
        <BarChart2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Coming soon</p>
        <p className="text-xs text-gray-400 mt-1">SF report links will appear here.</p>
      </div>
    </div>
  )
}
