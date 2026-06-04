import { tools } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

export default function ToolsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className={`w-5 h-5 ${theme.accent}`} />
          <h1 className="text-xl font-bold text-gray-900">Apps</h1>
        </div>
        <p className="text-sm text-gray-500">External AI tools — Google Gemini Gems and ChatGPT GPTs.</p>

      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.id} className={`bg-white border-gray-200 transition-all ${theme.cardHover}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm text-gray-900">{tool.name}</CardTitle>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
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
    </div>
  )
}
