import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados de Autenticação
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('worker')
  const [authMessage, setAuthMessage] = useState('')

  // Estados para Novo Turno (Empresa)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [shiftDate, setShiftDate] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setProfile(null)
    })

    fetchShifts()
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  async function fetchShifts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setShifts(data || [])
    setLoading(false)
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role }
        }
      })
      if (error) setAuthMessage(error.message)
      else setAuthMessage('Conta criada! Se não entrar automaticamente, verifique o seu email ou faça login.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthMessage(error.message)
    }
  }

  async function handleCreateShift(e) {
    e.preventDefault()
    if (!session) return

    const { error } = await supabase.from('shifts').insert([
      {
        company_id: session.user.id,
        title,
        location,
        pay_rate: parseFloat(payRate),
        shift_date: new Date(shiftDate).toISOString()
      }
    ])

    if (error) {
      alert('Erro ao publicar turno: ' + error.message)
    } else {
      setTitle('')
      setLocation('')
      setPayRate('')
      setShiftDate('')
      fetchShifts()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <header className="border-b border-slate-800 pb-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">TurnLevel</h1>
            <p className="text-xs text-slate-400">Conexão direta de turnos flexíveis</p>
          </div>
          
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
                {profile?.full_name || session.user.email} ({profile?.role === 'company' ? 'Empresa' : 'Trabalhador'})
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20"
              >
                Sair
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Online
            </span>
          )}
        </header>

        {/* Formulário de Login / Registo (Aparece se não estiver autenticado) */}
        {!session && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-white mb-4">
              {isSignUp ? 'Criar Conta no TurnLevel' : 'Entrar na Plataforma'}
            </h2>
            
            <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nome Completo ou da Empresa</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Ex: Café Central ou João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tipo de Perfil</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="worker">Quero trabalhar (Trabalhador)</option>
                      <option value="company">Quero contratar turnos (Empresa)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Palavra-passe (mín. 6 caracteres)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="••••••••"
                />
              </div>

              {authMessage && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                  {authMessage}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg transition"
              >
                {isSignUp ? 'Registar' : 'Entrar'}
              </button>
            </form>

            <button
              onClick={() => { setIsSignUp(!isSignUp); setAuthMessage('') }}
              className="w-full text-center text-xs text-slate-400 hover:text-white mt-4"
            >
              {isSignUp ? 'Já tem conta? Faça login' : 'Ainda não tem conta? Crie uma agora'}
            </button>
          </section>
        )}

        {/* Painel da Empresa: Publicar Novo Turno */}
        {session && profile?.role === 'company' && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Publicar Novo Turno</h2>
            <form onSubmit={handleCreateShift} className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                required
                placeholder="Função (ex: Atendente de Balcão)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              />
              <input
                type="text"
                required
                placeholder="Localização / Bairro"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                step="0.01"
                required
                placeholder="Valor do Turno (R$)"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              />
              <input
                type="datetime-local"
                required
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg transition"
              >
                Publicar Vaga de Turno
              </button>
            </form>
          </section>
        )}

        {/* Lista de Turnos Disponíveis */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Turnos Disponíveis</h2>
          
          {loading ? (
            <p className="text-sm text-slate-400">A carregar turnos...</p>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg">
              <p className="text-sm text-slate-400">Ainda não existem turnos publicados.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {shifts.map((shift) => (
                <div key={shift.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-white">{shift.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">📍 {shift.location}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      📅 {new Date(shift.shift_date).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center">
                    <span className="text-emerald-400 font-semibold text-sm">
                      R$ {Number(shift.pay_rate).toFixed(2)}
                    </span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded">
                      {shift.status === 'open' ? 'Disponível' : 'Preenchido'}
                    </span>
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
