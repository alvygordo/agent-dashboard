import { agents } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot } from "lucide-react"

export default function AgentsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className={`w-5 h-5 ${theme.accent}`} />
          <h1 className="text-xl font-bold text-gray-900">Individual Agents</h1>
        </div>
        <p className="text-sm text-gray-500">Standalone AI agents you can open and use directly.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
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
        ))}
      </div>
    </div>
  )
}
