/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "from-navy-900", "to-navy-800", "to-navy-900",
    "bg-navy-800", "bg-navy-900", "bg-navy-950",
    "border-l-indigo-500", "border-l-emerald-500", "border-l-amber-500",
    "border-l-slate-400",  "border-l-red-500",     "border-l-rose-500",
    "bg-indigo-50", "text-indigo-700", "border-indigo-200",
    "bg-rose-50",   "text-rose-700",   "border-rose-200",
    "bg-emerald-50","text-emerald-700","border-emerald-200",
    "bg-amber-50",  "text-amber-700",  "border-amber-200",
    "bg-red-50",    "text-red-700",    "border-red-200",
    "bg-slate-100", "text-slate-600",  "border-slate-200",
    "text-indigo-500","text-emerald-500","text-amber-500",
    "text-slate-500", "text-red-500",    "text-rose-500",
    "bg-indigo-50","bg-emerald-50","bg-amber-50",
    "bg-slate-50", "bg-red-50",    "bg-rose-50",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        navy: {
          800: "#1a1a2e",
          900: "#16213e",
          950: "#0f172a",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        card:      "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        "card-md": "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)",
      },
      animation: {
        "fade-in":  "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};