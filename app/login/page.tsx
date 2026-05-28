'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { theme } from '@/lib/theme'
import { Bot } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className={`${theme.headerBg} px-6 py-5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className={`font-semibold text-base leading-tight ${theme.headerText}`}>Agent Dashboard</p>
            <p className={`text-xs leading-tight ${theme.headerSub}`}>Sales Ops · Core Renewals</p>
          </div>
        </div>
        {theme.isProd && (
          <span className={theme.envHeaderBadge!}>{theme.envHeaderBadgeText}</span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm w-full max-w-sm p-10 space-y-6 text-center">
          <div className={`w-16 h-16 rounded-full ${theme.avatarBg} flex items-center justify-center mx-auto`}>
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agent Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Sales Ops · Core Renewals</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              Salesforce login failed. Please try again.
            </div>
          )}

          <a
            href="/api/auth/salesforce"
            className={`w-full flex items-center justify-center text-white font-semibold py-4 rounded-2xl text-base ${theme.btnPrimary}`}
          >
            {error ? 'Try Again' : 'Login with Salesforce'}
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
