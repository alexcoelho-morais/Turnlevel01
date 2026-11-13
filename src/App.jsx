import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState('shifts')

  const [authMode, setAuthMode] = useState('login')
  const [signupStep, setSignupStep] = useState(1)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [role, setRole] = useState('worker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  const [cnpj, setCnpj] = useState('')
  const [sector, setSector] = useState('')
  const [cpf, setCpf] = useState('')
  const [age, setAge] = useState('')
  const [skills, setSkills] = useState('')

  const [cep, setCep] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [address, setAddress] = useState('')

  const [shifts, setShifts] = useState([])
  const [applications, setApplications] = useState([])
  const [cityFilter, setCityFilter] = useState('')
  const [loadingShifts, setLoadingShifts] = useState(true)

  const [title, setTitle] = useState('')
  const [shiftDesc, setShiftDesc] = useState('')
  const [payRate, setPayRate] = useState('')
  const [shiftDate, setShiftDate] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUserData(session.user.id)
      else fetchShifts('')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUserData(session.user.id)
      else {
        setProfile(null)
        setApplications([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserData(userId) {
    setLoadingProfile(true)
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (prof) {
      setProfile(prof)
      fillProfileForm(prof)
      const initialCity = prof.city || ''
      setCityFilter(initialCity)
      await fetchShifts(initialCity)
      await fetchApplications(prof)
    } else {
      await fetchShifts('')
    }
    setLoadingProfile(false)
  }

  function fillProfileForm(prof) {
    setRole(prof.role || 'worker')
    setFullName(prof.full_name || '')
    setPhone(prof.phone || '')
    setBio(prof.bio || '')
    setAvatarPreview(prof.avatar_url || '')
    setCnpj(prof.cnpj || '')
    setSector(prof.sector || '')
    setCpf(prof.cpf || '')
    setAge(prof.age ? String(prof.age) : '')
    setSkills(prof.skills || '')
    setCep(prof.cep || '')
    setStateUf(prof.state || '')
    setCity(prof.city || '')
    setNeighborhood(prof.neighborhood || '')
    setAddress(prof.address || '')
  }

  async function handleCepLookup(rawCep) {
    const clean = rawCep.replace(/\D/g, '')
    setCep(rawCep)
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setStateUf(data.uf || '')
          setCity(data.localidade || '')
          setNeighborhood(data.bairro || '')
          setAddress(data.logradouro || '')
        }
      } catch (err) {
        console.error('Erro CEP:', err)
      }
    }
  }

  async function uploadAvatar(userId) {
    if (!avatarFile) return avatarPreview || null
    const fileExt = avatarFile.name.split('.').pop()
    const filePath = `${userId}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true })

    if (uploadError) return avatarPreview || null

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    return data.publicUrl
  }

  async function handleLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  async function handleCompleteSignup(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    })

    if (signUpError) {
      setAuthError(signUpError.message)
      setAuthLoading(false)
      return
    }

    const userId = signUpData?.user?.id
    if (userId) {
      const uploadedUrl = await uploadAvatar(userId)
      const profilePayload = {
        id: userId,
        full_name: fullName,
        role,
        phone,
        bio,
        avatar_url: uploadedUrl,
        cnpj: role === 'company' ? cnpj : null,
        sector: role === 'company' ? sector : null,
        cpf: role === 'worker' ? cpf : null,
        age: role === 'worker' && age ? parseInt(age, 10) : null,
        skills: role === 'worker' ? skills : null,
        cep,
        state: stateUf,
        city,
        neighborhood,
        address
      }

      await supabase.from('profiles').upsert(profilePayload)
      await loadUserData(userId)
    }
    setAuthLoading(false)
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    if (!session) return
    setAuthLoading(true)

    const uploadedUrl = await uploadAvatar(session.user.id)
    const updates = {
      full_name: fullName,
      phone,
      bio,
      avatar_url: uploadedUrl,
      cnpj: profile?.role === 'company' ? cnpj : null,
      sector: profile?.role === 'company' ? sector : null,
      cpf: profile?.role === 'worker' ? cpf : null,
      age: profile?.role === 'worker' && age ? parseInt(age, 10) : null,
      skills: profile?.role === 'worker' ? skills : null,
      cep,
      state: stateUf,
      city,
      neighborhood,
      address
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id)
    if (error) alert('Erro: ' + error.message)
    else {
      alert('Perfil atualizado!')
      await loadUserData(session.user.id)
    }
    setAuthLoading(false)
  }

  async function fetchShifts(filterCity = cityFilter) {
    setLoadingShifts(true)
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        company:profiles!shifts_company_id_fkey (
          full_name, avatar_url, sector, city, state, neighborhood, address
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      if (filterCity && filterCity.trim() !== '') {
        const term = filterCity.trim().toLowerCase()
        const filtered = data.filter(
          (s) =>
            (s.city && s.city.toLowerCase().includes(term)) ||
            (s.location && s.location.toLowerCase().includes(term)) ||
            (s.company?.city && s.company.city.toLowerCase().includes(term))
        )
        setShifts(filtered)
      } else {
        setShifts(data)
      }
    }
    setLoadingShifts(false)
  }

  async function fetchApplications(currentProfile = profile) {
    if (!currentProfile) return

    if (currentProfile.role === 'worker') {
      const { data } = await supabase
        .from('shift_applications')
        .select(`
          *,
          shift:shifts (
            id, title, location, pay_rate, shift_date,
            company:profiles!shifts_company_id_fkey (full_name, city, neighborhood, avatar_url)
          )
        `)
        .eq('worker_id', currentProfile.id)
        .order('created_at', { ascending: false })
      setApplications(data || [])
    } else {
      const { data: myShifts } = await supabase.from('shifts').select('id').eq('company_id', currentProfile.id)
      const shiftIds = (myShifts || []).map((s) => s.id)
      if (shiftIds.length === 0) {
        setApplications([])
        return
      }

      const { data } = await supabase
        .from('shift_applications')
        .select(`
          *,
          shift:shifts (id, title, pay_rate, shift_date, location),
          worker:profiles!shift_applications_worker_id_fkey (
            id, full_name, age, phone, skills, city, neighborhood, avatar_url, bio
          )
        `)
        .in('shift_id', shiftIds)
        .order('created_at', { ascending: false })
      setApplications(data || [])
    }
  }

  async function handleCreateShift(e) {
    e.preventDefault()
    if (!session || !profile) return

    const locationLabel = profile.neighborhood
      ? `${profile.neighborhood}, ${profile.city || ''} - ${profile.state || ''}`
      : `${profile.city || 'Local'}`

    const { error } = await supabase.from('shifts').insert([
      {
        company_id: session.user.id,
        title,
        description: shiftDesc,
        location: locationLabel,
        pay_rate: parseFloat(payRate),
        shift_date: new Date(shiftDate).toISOString()
      }
    ])

    if (error) alert('Erro: ' + error.message)
    else {
      setTitle('')
      setShiftDesc('')
      setPayRate('')
      setShiftDate('')
      fetchShifts(cityFilter)
    }
  }

  async function handleApply(shiftId) {
    if (!session) return
    const { error } = await supabase.from('shift_applications').insert([
      { shift_id: shiftId, worker_id: session.user.id }
    ])

    if (error) {
      if (error.code === '23505') alert('Já se candidatou a este turno!')
      else alert('Erro: ' + error.message)
    } else {
      alert('Candidatura enviada!')
      fetchApplications(profile)
    }
  }

  async function handleApplicationStatus(appId, shiftId, newStatus) {
    const { error } = await supabase.from('shift_applications').update({ status: newStatus }).eq('id', appId)
    if (!error) {
      if (newStatus === 'accepted') {
        await supabase.from('shifts').update({ status: 'filled' }).eq('id', shiftId)
      }
      fetchApplications(profile)
      fetchShifts(cityFilter)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center p-4">
        <div className="max-w-md w-full mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">TurnLevel</h1>
            <p className="text-xs text-slate-400 mt-1">Turnos flexíveis por proximidade</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Entrar na conta</h2>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white"
                  />
                </div>

                {authError && <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg">{authError}</p>}

                <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg">
                  {authLoading ? 'A entrar...' : 'Entrar'}
                </button>

                <button type="button" onClick={() => { setAuthMode('signup'); setSignupStep(1); setAuthError('') }} className="w-full text-center text-xs text-slate-400 hover:text-white pt-2">
                  Não tem conta? <span className="text-emerald-400 font-medium">Criar cadastro</span>
                </button>
              </form>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${signupStep >= step ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {step}
                      </div>
                      {step < 3 && <div className={`h-0.5 flex-1 mx-2 ${signupStep > step ? 'bg-emerald-600' : 'bg-slate-800'}`} />}
                    </div>
                  ))}
                </div>

                {signupStep === 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); setSignupStep(2) }} className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Etapa 1: Tipo de Conta</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setRole('worker')} className={`p-3 rounded-xl border text-left ${role === 'worker' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                        <div className="text-sm font-semibold">Trabalhador</div>
                      </button>
                      <button type="button" onClick={() => setRole('company')} className={`p-3 rounded-xl border text-left ${role === 'company' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                        <div className="text-sm font-semibold">Empresa</div>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Senha (mín. 6 dígitos)</label>
                      <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" />
                    </div>

                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg">
                      Próxima Etapa →
                    </button>
                  </form>
                )}

                {signupStep === 2 && (
                  <form onSubmit={(e) => { e.preventDefault(); setSignupStep(3) }} className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">Etapa 2: Dados</h2>
                    <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                      {avatarPreview ? <img src={avatarPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">Foto</div>}
                      <div className="flex-1">
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="text-xs text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{role === 'company' ? 'Nome da Empresa' : 'Nome Completo'}</label>
                      <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>

                    {role === 'company' ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" required placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                          <input type="text" required placeholder="Setor" value={sector} onChange={(e) => setSector(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <input type="text" required placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        <textarea rows={2} required placeholder="Descrição" value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" required placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                          <input type="number" required placeholder="Idade" value={age} onChange={(e) => setAge(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <input type="text" required placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        <input type="text" required placeholder="Habilidades (ex: Garçom, Caixa)" value={skills} onChange={(e) => setSkills(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setSignupStep(1)} className="w-1/3 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg">← Voltar</button>
                      <button type="submit" className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg">Próxima →</button>
                    </div>
                  </form>
                )}

                {signupStep === 3 && (
                  <form onSubmit={handleCompleteSignup} className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">Etapa 3: Localização</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="CEP" maxLength={9} value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="text" required placeholder="UF" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="text" required placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <input type="text" required placeholder="Endereço / Rua e Número" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />

                    {authError && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{authError}</p>}

                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setSignupStep(2)} className="w-1/3 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg">← Voltar</button>
                      <button type="submit" disabled={authLoading} className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg">
                        {authLoading ? 'A concluir...' : 'Concluir ✓'}
                      </button>
                    </div>
                  </form>
                )}

                <button type="button" onClick={() => setAuthMode('login')} className="w-full text-center text-xs text-slate-400 hover:text-white mt-4">
                  Já possui conta? Voltar ao login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                {(profile?.full_name || 'T')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-white leading-tight">TurnLevel</h1>
              <p className="text-[11px] text-slate-400">
                {profile?.full_name} • {profile?.city || 'Sem cidade'} ({profile?.role === 'company' ? 'Empresa' : 'Trabalhador'})
              </p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-xs bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 px-3 py-1.5 rounded-lg transition">
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {loadingProfile ? (
          <p className="text-sm text-slate-400 text-center py-10">A carregar dados...</p>
        ) : (
          <>
            {activeTab === 'shifts' && (
              <div className="space-y-6">
                {profile?.role === 'company' && (
                  <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h2 className="text-base font-semibold text-white mb-3">Publicar Novo Turno</h2>
                    <form onSubmit={handleCreateShift} className="grid gap-3 sm:grid-cols-2">
                      <input type="text" required placeholder="Função (ex: Garçom)" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="number" step="0.01" required placeholder="Valor (R$)" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="datetime-local" required value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="text" placeholder="Requisitos (opcional)" value={shiftDesc} onChange={(e) => setShiftDesc(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <button type="submit" className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg">
                        + Publicar Vaga
                      </button>
                    </form>
                  </section>
                )}

                <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] text-slate-400 mb-1">Filtrar por cidade ou bairro</label>
                    <input type="text" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} placeholder="Ex: Goiânia..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button onClick={() => fetchShifts(cityFilter)} className="bg-emerald-600 text-white text-xs font-medium px-3 py-2 rounded-lg">Filtrar</button>
                    <button onClick={() => { setCityFilter(''); fetchShifts('') }} className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg">Todas</button>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-white">Turnos Disponíveis ({shifts.length})</h2>
                  {loadingShifts ? (
                    <p className="text-sm text-slate-400">A procurar turnos...</p>
                  ) : shifts.length === 0 ? (
                    <div className="bg-slate-900 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                      <p className="text-sm text-slate-400">Nenhum turno encontrado.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {shifts.map((shift) => {
                        const applied = applications.some((a) => a.shift_id === shift.id)
                        return (
                          <div key={shift.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-800/70">
                                {shift.company?.avatar_url ? (
                                  <img src={shift.company.avatar_url} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {(shift.company?.full_name || 'E')[0]}
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-semibold text-slate-200">{shift.company?.full_name || 'Empresa'}</p>
                                  <p className="text-[11px] text-slate-400">{shift.company?.sector || 'Serviços'}</p>
                                </div>
                              </div>
                              <h3 className="font-semibold text-white text-base">{shift.title}</h3>
                              {shift.description && <p className="text-xs text-slate-400 mt-1">{shift.description}</p>}
                              <p className="text-xs text-slate-300 mt-2">📍 {shift.location}</p>
                              <p className="text-xs text-slate-400 mt-1">📅 {new Date(shift.shift_date).toLocaleString('pt-BR')}</p>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                              <span className="text-emerald-400 font-bold text-base">R$ {Number(shift.pay_rate).toFixed(2)}</span>
                              {profile?.role === 'worker' ? (
                                shift.status !== 'open' ? (
                                  <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg">Preenchido</span>
                                ) : applied ? (
                                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">Candidatado ✓</span>
                                ) : (
                                  <button onClick={() => handleApply(shift.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition">
                                    Candidatar-se
                                  </button>
                                )
                              ) : (
                                <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded">{shift.status === 'open' ? 'Aberto' : 'Preenchido'}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'applications' && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  {profile?.role === 'company' ? 'Candidatos Recebidos' : 'Minhas Candidaturas'}
                </h2>
                {applications.length === 0 ? (
                  <div className="bg-slate-900 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                    <p className="text-sm text-slate-400">Sem registos no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <div key={app.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs text-emerald-400 font-medium">Turno: {app.shift?.title} (R$ {Number(app.shift?.pay_rate || 0).toFixed(2)})</span>
                            {profile?.role === 'company' ? (
                              <div className="flex items-center gap-3 mt-2">
                                {app.worker?.avatar_url ? <img src={app.worker.avatar_url} alt="Foto" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">{(app.worker?.full_name || 'T')[0]}</div>}
                                <div>
                                  <h3 className="font-semibold text-white text-sm">{app.worker?.full_name} {app.worker?.age ? `(${app.worker.age} anos)` : ''}</h3>
                                  <p className="text-xs text-slate-400">📍 {app.worker?.neighborhood}, {app.worker?.city} • 📞 {app.worker?.phone}</p>
                                  {app.worker?.skills && <p className="text-xs text-slate-300 mt-1">🛠 {app.worker.skills}</p>}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1">
                                <h3 className="font-semibold text-white text-sm">{app.shift?.company?.full_name}</h3>
                                <p className="text-xs text-slate-400">📍 {app.shift?.location}</p>
                              </div>
                            )}
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${app.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {app.status === 'accepted' ? 'Aceito' : app.status === 'rejected' ? 'Recusado' : 'Pendente'}
                          </span>
                        </div>
                        {profile?.role === 'company' && app.status === 'pending' && (
                          <div className="flex gap-2 pt-2 border-t border-slate-800">
                            <button onClick={() => handleApplicationStatus(app.id, app.shift.id, 'accepted')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2 rounded-lg">Aceitar</button>
                            <button onClick={() => handleApplicationStatus(app.id, app.shift.id, 'rejected')} className="flex-1 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-xs font-medium py-2 rounded-lg">Recusar</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'profile' && (
              <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-white mb-4">Editar Perfil</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-sm text-slate-400">Foto</div>}
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Alterar Foto / Logo</label>
                      <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="text-xs text-slate-400" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nome</label>
                      <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Telefone</label>
                      <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    {profile?.role === 'company' ? (
                      <>
                        <input type="text" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        <input type="text" placeholder="Setor" value={sector} onChange={(e) => setSector(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </>
                    ) : (
                      <>
                        <input type="text" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        <input type="number" placeholder="Idade" value={age} onChange={(e) => setAge(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        <input type="text" placeholder="Habilidades" value={skills} onChange={(e) => setSkills(e.target.value)} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </>
                    )}
                    <textarea rows={2} placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    <input type="text" placeholder="CEP" value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    <input type="text" placeholder="UF" value={stateUf} onChange={(e) => setStateUf(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    <input type="text" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    <input type="text" placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    <input type="text" placeholder="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>

                  <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg">
                    {authLoading ? 'A guardar...' : 'Salvar Alterações'}
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 px-4 py-2 z-20">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          <button onClick={() => setActiveTab('shifts')} className={`py-2 rounded-lg text-xs font-medium transition ${activeTab === 'shifts' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
            Turnos
          </button>
          <button onClick={() => { setActiveTab('applications'); fetchApplications(profile) }} className={`py-2 rounded-lg text-xs font-medium transition ${activeTab === 'applications' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
            {profile?.role === 'company' ? 'Candidatos' : 'Candidaturas'}
          </button>
          <button onClick={() => setActiveTab('profile')} className={`py-2 rounded-lg text-xs font-medium transition ${activeTab === 'profile' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
            Perfil
          </button>
        </div>
      </nav>
    </div>
  )
}
