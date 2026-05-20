import Link from "next/link"
import { workflows } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Layers } from "lucide-react"

export default function WorkflowsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Layers className={`w-5 h-5 ${theme.accent}`} />
          <h1 className="text-xl font-bold text-gray-900">Workflows</h1>
        </div>
        <p className="text-sm text-gray-500">Multi-step automated workflows that chain agents together.</p>
      </div>

      <div className="grid gap-4">
        {workflows.map((wf) => (
          <Card key={wf.id} className={`bg-white border-gray-200 transition-all ${theme.cardHover}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base text-gray-900">{wf.name}</CardTitle>
                <Badge className={wf.status === "active" ? "bg-green-100 text-green-700 border border-green-300" : "bg-gray-100 text-gray-500"}>
                  {wf.status === "active" ? "Active" : "Coming Soon"}
                </Badge>
              </div>
              <CardDescription className="text-gray-500 text-sm">{wf.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {wf.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 border border-gray-200 whitespace-nowrap">{step.label}</span>
                    {i < wf.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />}
                  </div>
                ))}
              </div>
              {wf.status === "active" ? (
                <Link href={`/workflow/${wf.id}`}>
                  <Button className={`w-full cursor-pointer ${theme.btnPrimary}`}>
                    Start Workflow <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Button disabled className="w-full" variant="secondary">Coming Soon</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
