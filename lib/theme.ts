// Drives color scheme and environment indicators.
// Set NEXT_PUBLIC_ENV=production on the production Vercel project.
// Sandbox project leaves it unset (defaults to sandbox theme).

const isProd = process.env.NEXT_PUBLIC_ENV === "production"

export const theme = {
  isProd,

  // Header bar
  headerBg:   isProd ? "bg-[#00b4a2]"  : "bg-white border-b border-gray-200 shadow-sm",
  headerText: isProd ? "text-white"     : "text-gray-900",
  headerSub:  isProd ? "text-teal-100"  : "text-gray-500",

  // Logo/avatar square
  avatarBg:   isProd ? "bg-[#009688]"  : "bg-purple-700",

  // Buttons
  btnPrimary: isProd
    ? "bg-[#00b4a2] hover:bg-[#009688] text-white"
    : "bg-purple-700 hover:bg-purple-800 text-white",

  // Card hover border
  cardHover: isProd
    ? "hover:border-[#00b4a2] hover:shadow-md"
    : "hover:border-purple-400 hover:shadow-md",

  // Agent open button hover
  agentBtn: isProd
    ? "border-gray-300 text-gray-700 hover:bg-[#e0f7f5] hover:border-[#00b4a2]"
    : "border-gray-300 text-gray-700 hover:bg-purple-50 hover:border-purple-400",

  // Section icons / text accents
  accent: isProd ? "text-[#00b4a2]" : "text-purple-600",

  // Progress stepper active
  stepActive: isProd ? "bg-[#00b4a2] text-white" : "bg-purple-700 text-white",

  // Badges
  badgePrimary: isProd
    ? "bg-[#e0f7f5] text-[#009688] border border-[#00b4a2]"
    : "bg-purple-100 text-purple-700 border border-purple-300",

  // Step badge (Step X of 3)
  stepBadge: isProd
    ? "bg-[#e0f7f5] text-[#009688] border border-[#b2e8e2]"
    : "bg-purple-100 text-purple-700 border border-purple-300",

  // Input focus
  inputFocus: isProd ? "focus:border-[#00b4a2]" : "focus:border-purple-500",

  // Back/ghost button
  ghostBtn: isProd
    ? "text-teal-100 hover:text-white"
    : "text-gray-500 hover:text-gray-900",

  // Instruction bar (step 2)
  instructionBar: isProd
    ? "bg-teal-50 border-b border-[#b2e8e2]"
    : "bg-blue-50 border-b border-blue-200",
  instructionText: isProd ? "text-teal-800" : "text-blue-800",
  instructionIcon: isProd ? "text-[#00b4a2]" : "text-blue-600",
  instructionBack: isProd ? "text-[#00b4a2] hover:text-[#009688]" : "text-blue-600 hover:text-blue-800",

  // Environment banner / indicator
  // Production: no warning banner — "LIVE — PRODUCTION" pill shown in header instead
  // Sandbox: purple warning banner at top
  envBanner: isProd ? null : "bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide",
  envBannerText: "⚠️ SANDBOX ENVIRONMENT — For testing purposes only",
  envHeaderBadge: isProd
    ? "border border-white text-white text-xs font-semibold px-3 py-1 rounded-full"
    : null,
  envHeaderBadgeText: "PRODUCTION",
}
