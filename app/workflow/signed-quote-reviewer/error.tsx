"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function SignedQuoteReviewerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-4 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          The Signed Quote Reviewer hit an error. Try reloading — if you just deployed, a hard refresh (Cmd+Shift+R) clears stale scripts.
        </p>
        {error.message && (
          <p className="text-xs text-gray-400 font-mono break-all">{error.message}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={reset} className="cursor-pointer">
            Reload
          </Button>
          <Link href="/workflows">
            <Button className="cursor-pointer">Back to Workflows</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
