import Link from "next/link"
import { workflows, agents } from "@/lib/agents"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Layers } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Sandbox Banner */}
      <div className="bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide">
        ⚠️ SANDBOX ENVIRONMENT — For testing purposes only
      </div>

      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">Agent Dashboard</h1>
            <p className="text-xs text-gray-500">Your central hub for AI agents</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* Workflows */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Layers className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Workflows</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {workflows.map((wf) => (
              <Card key={wf.id} className="bg-white border-gray-200 hover:border-purple-400 hover:shadow-md transition-all">
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
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {wf.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 border border-gray-200">{step.label}</span>
                        {i < wf.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-400" />}
                      </div>
                    ))}
                  </div>
                  {wf.status === "active" ? (
                    <Link href={`/workflow/${wf.id}`}>
                      <Button className="w-full bg-purple-700 hover:bg-purple-800 text-white cursor-pointer">
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
        </section>

        {/* Individual Agents */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Bot className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Individual Agents</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="bg-white border-gray-200 hover:border-purple-400 hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm text-gray-900">{agent.name}</CardTitle>
                    <Badge className={agent.status === "active" ? "bg-green-100 text-green-700 border border-green-300 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                      {agent.status === "active" ? "Active" : "Coming Soon"}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-500 text-xs">{agent.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {agent.status === "active" ? (
                    <a href={agent.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-purple-50 hover:border-purple-400 text-sm cursor-pointer">
                        Open Agent <ArrowRight className="w-3 h-3 ml-2" />
                      </Button>
                    </a>
                  ) : (
                    <Button disabled className="w-full text-sm" variant="secondary">Coming Soon</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
