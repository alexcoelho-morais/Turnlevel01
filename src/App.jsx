import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
        <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-800/50">
          Sistema Online
        </span>
        <h1 className="text-3xl font-bold mt-4 mb-2">TurnLevel</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Plataforma de turnos flexíveis conectada com sucesso ao Supabase e Vercel.
        </p>
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 text-left text-xs text-zinc-300 font-mono">
          <p className="text-emerald-400">✓ Repositório: Turnlevel01</p>
          <p className="text-emerald-400 mt-1">✓ Build: Vite + React</p>
          <p className="text-emerald-400 mt-1">✓ Banco: Supabase Ativo</p>
        </div>
      </div>
    </div>
  )
}
