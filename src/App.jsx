import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [location,setLocation] = useState('')
  const [payRate, setPayRate] = useState('')

  useEffect(() => {
    fetchShifts()
  }, [])

  async function fetchShifts() {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setShifts(data || [])
    } catch (error) {
      console.error('Erro ao buscar turnos:', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Cabeçalho */}
        <header className="border-b border-slate-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">TurnLevel</h1>
            <p className="text-sm text-slate-400">Plataforma de turnos flexíveis e conexão laboral</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Sistema Online
          </span>
        </header>

        {/* Lista de Turnos Disponíveis */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Turnos Disponíveis</h2>
          
          {loading ? (
            <p className="text-sm text-slate-400">A carregar turnos da base de dados...</p>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg">
              <p className="text-sm text-slate-400">Ainda não existem turnos publicados.</p>
              <p className="text-xs text-slate-500 mt-1">Assim que as empresas criarem vagas, elas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {shifts.map((shift) => (
                <div key={shift.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-white">{shift.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">📍 {shift.location}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center">
                    <span className="text-emerald-400 font-semibold text-sm">R$ {shift.payRate || '0.00'}</span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded">Disponível</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
