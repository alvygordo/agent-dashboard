import Link from "next/link"
import { workflows, agents, tools } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Layers, Sparkles } from "lucide-react"
import { ContractAnalyzerCard } from "@/components/contract-analyzer-card"


export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

      {/* Welcome */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to Sales Ops Agent Dashboard!
        </h1>
        <p className="text-gray-500 text-sm">
          Your central hub for AI-powered workflows, agents, and tools. Select a section from the sidebar or browse everything below.
        </p>
      </div>

      {/* Workflows */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Layers className={`w-4 h-4 ${theme.accent}`} />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Workflows</h2>
        </div>
        <div className="grid gap-4">
          {workflows.filter(wf => !wf.sandboxOnly || !theme.isProd).map((wf) => (
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
      </section>

      {/* Individual Agents */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Bot className={`w-4 h-4 ${theme.accent}`} />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Individual Agents</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) =>
            agent.id === "contract-analyzer" ? (
              <ContractAnalyzerCard key={agent.id} />
            ) : (
              <Card key={agent.id} className={`bg-white border-gray-200 transition-all ${theme.cardHover}`}>
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
                      <Button variant="outline" className={`w-full text-sm cursor-pointer ${theme.agentBtn}`}>
                        Open Agent <ArrowRight className="w-3 h-3 ml-2" />
                      </Button>
                    </a>
                  ) : (
                    <Button disabled className="w-full text-sm" variant="secondary">Coming Soon</Button>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      </section>

      {/* Apps */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className={`w-4 h-4 ${theme.accent}`} />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Apps</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Card key={tool.id} className={`bg-white border-gray-200 transition-all ${theme.cardHover}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm text-gray-900">{tool.name}</CardTitle>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    tool.kind === "gem"
                      ? "bg-blue-50 text-blue-600 border-blue-200"
                      : "bg-green-50 text-green-600 border-green-200"
                  }`}>
                    {tool.kind === "gem" ? "Gem" : "GPT"}
                  </span>
                </div>
                <CardDescription className="text-gray-500 text-xs">{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {tool.status === "active" ? (
                  <a href={tool.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className={`w-full text-sm cursor-pointer ${theme.agentBtn}`}>
                      Open {tool.kind === "gem" ? "Gem" : "GPT"} <ArrowRight className="w-3 h-3 ml-2" />
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
  )
}
