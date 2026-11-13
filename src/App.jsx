import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Navegação principal ('shifts' | 'applications' | 'profile')
  const [activeTab, setActiveTab] = useState('shifts')

  // Controle de Tela de Login vs Cadastro em Etapas
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [signupStep, setSignupStep] = useState(1) // 1 | 2 | 3
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // Campos de Cadastro / Perfil
  const [role, setRole] = useState('worker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  // Campos Empresa
  const [cnpj, setCnpj] = useState('')
  const [sector, setSector] = useState('')

  // Campos Trabalhador
  const [cpf, setCpf] = useState('')
  const [age, setAge] = useState('')
  const [skills, setSkills] = useState('')

  // Campos Localização
  const [cep, setCep] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [address, setAddress] = useState('')

  // Estados de Turnos e Candidaturas
  const [shifts, setShifts] = useState([])
  const [applications, setApplications] = useState([])
  const [cityFilter, setCityFilter] = useState('')
  const [loadingShifts, setLoadingShifts] = useState(true)

  // Novo Turno (Empresa)
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
        console.error('Erro ao buscar CEP:', err)
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

    if (uploadError) {
      console.error('Erro upload foto:', uploadError.message)
      return avatarPreview || null
    }

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

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)

    if (error) {
      alert('Erro ao salvar perfil: ' + error.message)
    } else {
      alert('Perfil atualizado com sucesso!')
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
      const { data: myShifts } = await supabase
        .from('shifts')
        .select('id')
        .eq('company_id', currentProfile.id)

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
      : `${profile.city || 'Local não informado'}`

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

    if (error) {
      alert('Erro ao publicar turno: ' + error.message)
    } else {
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
      if (error.code === '23505') alert('Você já se candidatou a este turno!')
      else alert('Erro ao candidatar-se: ' + error.message)
    } else {
      alert('Candidatura enviada com sucesso!')
      fetchApplications(profile)
    }
  }

  async function handleApplicationStatus(appId, shiftId, newStatus) {
    const { error } = await supabase
      .from('shift_applications')
      .update({ status: newStatus })
      .eq('id', appId)

    if (!error) {
      if (newStatus === 'accepted') {
        await supabase.from('shifts').update({ status: 'filled' }).eq('id', shiftId)
      }
      fetchApplications(profile)
      fetchShifts(cityFilter)
    }
  }

  // ============================================================================
  // TELA DE AUTENTICAÇÃO (LOGIN + CADASTRO EM 3 ETAPAS)
  // ============================================================================
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
                    placeholder="seu@email.com"
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
                    placeholder="••••••••"
                  />
                </div>

                {authError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg transition"
                >
                  {authLoading ? 'Entrando...' : 'Entrar'}
                </button>

                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setSignupStep(1); setAuthError('') }}
                  className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
                >
                  Não tem conta? <span className="text-emerald-400 font-medium">Criar cadastro completo</span>
                </button>
              </form>
            ) : (
              <div>
                {/* Indicador de Etapas */}
                <div className="flex items-center justify-between mb-6">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          signupStep >= step
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {step}
                      </div>
                      {step < 3 && (
                        <div
                          className={`h-0.5 flex-1 mx-2 ${
                            signupStep > step ? 'bg-emerald-600' : 'bg-slate-800'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* ETAPA 1: TIPO DE PERFIL E ACESSO */}
                {signupStep === 1 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setSignupStep(2)
                    }}
                    className="space-y-4"
                  >
                    <h2 className="text-lg font-semibold text-white">Etapa 1: Tipo de Conta</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('worker')}
                        className={`p-3 rounded-xl border text-left transition ${
                          role === 'worker'
                            ? 'bg-emerald-500/10 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="text-sm font-semibold">Trabalhador</div>
                        <div className="text-[11px] opacity-80 mt-0.5">Busco turnos extras</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('company')}
                        className={`p-3 rounded-xl border text-left transition ${
                          role === 'company'
                            ? 'bg-emerald-500/10 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="text-sm font-semibold">Empresa</div>
                        <div className="text-[11px] opacity-80 mt-0.5">Quero contratar</div>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email de acesso</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white"
                        placeholder="contato@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Senha (mínimo 6 dígitos)</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white"
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg"
                    >
                      Próxima Etapa →
                    </button>
                  </form>
                )}

                {/* ETAPA 2: DADOS PROFISSIONAIS E FOTO */}
                {signupStep === 2 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setSignupStep(3)
                    }}
                    className="space-y-3"
                  >
                    <h2 className="text-lg font-semibold text-white">
                      {role === 'company' ? 'Etapa 2: Dados da Empresa' : 'Etapa 2: Seus Dados'}
                    </h2>

                    {/* Foto de Perfil / Logo */}
                    <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                          Foto
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="block text-xs text-slate-300 font-medium mb-1">
                          {role === 'company' ? 'Logo da Empresa' : 'Sua Foto de Perfil'}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setAvatarFile(file)
                              setAvatarPreview(URL.createObjectURL(file))
                            }
                          }}
                          className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        {role === 'company' ? 'Nome Comercial da Empresa' : 'Nome Completo'}
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder={role === 'company' ? 'Ex: Restaurante Sabor Real' : 'Ex: Carlos Eduardo Silva'}
                      />
                    </div>

                    {role === 'company' ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">CNPJ</label>
                            <input
                              type="text"
                              required
                              value={cnpj}
                              onChange={(e) => setCnpj(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                              placeholder="00.000.000/0001-00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Setor</label>
                            <select
                              required
                              value={sector}
                              onChange={(e) => setSector(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                            >
                              <option value="">Selecione...</option>
                              <option value="Alimentação e Bares">Alimentação e Bares</option>
                              <option value="Varejo e Comércio">Varejo e Comércio</option>
                              <option value="Logística e Estoque">Logística e Estoque</option>
                              <option value="Eventos e Hotelaria">Eventos e Hotelaria</option>
                              <option value="Limpeza e Serviços">Limpeza e Serviços</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Telefone / WhatsApp</label>
                          <input
                            type="text"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="(62) 99999-9999"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Descrição sobre a empresa</label>
                          <textarea
                            rows={2}
                            required
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="Conte brevemente sobre o estabelecimento e ambiente de trabalho..."
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">CPF</label>
                            <input
                              type="text"
                              required
                              value={cpf}
                              onChange={(e) => setCpf(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                              placeholder="000.000.000-00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Idade</label>
                            <input
                              type="number"
                              required
                              min={16}
                              max={90}
                              value={age}
                              onChange={(e) => setAge(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                              placeholder="24"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Telefone / WhatsApp</label>
                          <input
                            type="text"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="(62) 99999-9999"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Funções / Experiência</label>
                          <input
                            type="text"
                            required
                            value={skills}
                            onChange={(e) => setSkills(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="Ex: Garçom, Caixa, Repositor, Cozinha"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSignupStep(1)}
                        className="w-1/3 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg"
                      >
                        ← Voltar
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg"
                      >
                        Próxima Etapa →
                      </button>
                    </div>
                  </form>
                )}

                {/* ETAPA 3: LOCALIZAÇÃO COMPLETA */}
                {signupStep === 3 && (
                  <form onSubmit={handleCompleteSignup} className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">Etapa 3: Localização</h2>
                    <p className="text-xs text-slate-400">
                      Usamos sua cidade e região para conectar turnos próximos.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">CEP</label>
                        <input
                          type="text"
                          required
                          maxLength={9}
                          value={cep}
                          onChange={(e) => handleCepLookup(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-
