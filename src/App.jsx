import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const BRAZIL_DDDS = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]

const SKILL_OPTIONS = [
  'Garçom / Atendimento',
  'Cozinha / Auxiliar',
  'Caixa / Operador',
  'Repositor / Estoque',
  'Limpeza / Serviços Gerais',
  'Barman / Copa',
  'Recepção / Eventos',
  'Entregador / Motoboy',
  'Carga e Descarga',
  'Vendas / Balcão'
]

const AGE_OPTIONS = Array.from({ length: 34 }, (_, i) => i + 17) // 17 a 50

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState('shifts')

  // Controle de Autenticação e Cadastro em Etapas
  const [authMode, setAuthMode] = useState('login')
  const [signupStep, setSignupStep] = useState(1)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // Dados Gerais
  const [role, setRole] = useState('worker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneDdd, setPhoneDdd] = useState('62')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  // Dados Empresa
  const [cnpj, setCnpj] = useState('')
  const [sector, setSector] = useState('')

  // Dados Trabalhador
  const [cpf, setCpf] = useState('')
  const [age, setAge] = useState('20')
  const [selectedSkills, setSelectedSkills] = useState([])
  const [customSkill, setCustomSkill] = useState('')
  const [maxDistance, setMaxDistance] = useState('Até 10 km')

  // Localização Perfil
  const [cep, setCep] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [address, setAddress] = useState('')

  // Turnos e Candidaturas
  const [shifts, setShifts] = useState([])
  const [applications, setApplications] = useState([])
  const [cityFilter, setCityFilter] = useState('')
  const [loadingShifts, setLoadingShifts] = useState(true)

  // Modais de Visualização Detalhada
  const [selectedShiftModal, setSelectedShiftModal] = useState(null)
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null)

  // Formulário de Novo Turno (Empresa)
  const [title, setTitle] = useState('')
  const [vacancies, setVacancies] = useState('1')
  const [workload, setWorkload] = useState('6 horas')
  const [shiftHours, setShiftHours] = useState('')
  const [payRate, setPayRate] = useState('')
  const [shiftDate, setShiftDate] = useState('')
  const [transportInfo, setTransportInfo] = useState('Vale-transporte pago')
  const [mealInfo, setMealInfo] = useState('Alimentação no local')
  const [requirements, setRequirements] = useState('')
  const [shiftNeighborhood, setShiftNeighborhood] = useState('')
  const [shiftStreet, setShiftStreet] = useState('')

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
      // Fallback caso o perfil ainda esteja sendo gravado
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata) {
        setFullName(user.user_metadata.full_name || '')
        setRole(user.user_metadata.role || 'worker')
      }
      await fetchShifts('')
    }
    setLoadingProfile(false)
  }

  function fillProfileForm(prof) {
    setRole(prof.role || 'worker')
    setFullName(prof.full_name || '')
    setPhoneDdd(prof.phone_ddd || '62')
    setPhone(prof.phone || '')
    setBio(prof.bio || '')
    setAvatarPreview(prof.avatar_url || '')
    setCnpj(prof.cnpj || '')
    setSector(prof.sector || '')
    setCpf(prof.cpf || '')
    setAge(prof.age ? String(prof.age) : '20')
    setMaxDistance(prof.max_distance || 'Até 10 km')

    // Separar habilidades marcadas e personalizadas
    if (prof.skills) {
      const all = prof.skills.split(',').map((s) => s.trim()).filter(Boolean)
      const matched = all.filter((s) => SKILL_OPTIONS.includes(s))
      const extra = all.filter((s) => !SKILL_OPTIONS.includes(s))
      setSelectedSkills(matched)
      setCustomSkill(extra.join(', '))
    } else {
      setSelectedSkills([])
      setCustomSkill('')
    }

    setCep(prof.cep || '')
    setStateUf(prof.state || '')
    setCity(prof.city || '')
    setNeighborhood(prof.neighborhood || '')
    setAddress(prof.address || '')

    // Pré-preencher endereço padrão do turno para a empresa
    if (prof.role === 'company') {
      setShiftNeighborhood(prof.neighborhood || '')
      setShiftStreet(prof.address || '')
    }
  }

  function toggleSkill(skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]
    )
  }

  function buildFinalSkillsString() {
    const combined = [...selectedSkills]
    if (customSkill.trim()) {
      combined.push(customSkill.trim())
    }
    return combined.join(', ')
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
      const finalSkills = buildFinalSkillsString()

      const profilePayload = {
        id: userId,
        full_name: fullName,
        role,
        phone_ddd: phoneDdd,
        phone,
        bio,
        avatar_url: uploadedUrl,
        cnpj: role === 'company' ? cnpj : null,
        sector: role === 'company' ? sector : null,
        cpf: role === 'worker' ? cpf : null,
        age: role === 'worker' && age ? parseInt(age, 10) : null,
        skills: role === 'worker' ? finalSkills : null,
        max_distance: role === 'worker' ? maxDistance : null,
        cep,
        state: stateUf,
        city,
        neighborhood,
        address
      }

      const { error: upsertError } = await supabase.from('profiles').upsert(profilePayload)
      if (!upsertError) {
        setProfile(profilePayload)
      }
      await loadUserData(userId)
    }
    setAuthLoading(false)
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    if (!session) return
    setAuthLoading(true)

    const uploadedUrl = await uploadAvatar(session.user.id)
    const finalSkills = buildFinalSkillsString()
    const currentRole = profile?.role || role

    const updates = {
      id: session.user.id,
      role: currentRole,
      full_name: fullName,
      phone_ddd: phoneDdd,
      phone,
      bio,
      avatar_url: uploadedUrl,
      cnpj: currentRole === 'company' ? cnpj : null,
      sector: currentRole === 'company' ? sector : null,
      cpf: currentRole === 'worker' ? cpf : null,
      age: currentRole === 'worker' && age ? parseInt(age, 10) : null,
      skills: currentRole === 'worker' ? finalSkills : null,
      max_distance: currentRole === 'worker' ? maxDistance : null,
      cep,
      state: stateUf,
      city,
      neighborhood,
      address
    }

    const { error } = await supabase.from('profiles').upsert(updates)
    if (error) {
      alert('Erro ao guardar: ' + error.message)
    } else {
      alert('Perfil guardado com sucesso!')
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
          full_name, avatar_url, sector, bio, phone_ddd, phone, city, state, neighborhood, address
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
            (s.shift_neighborhood && s.shift_neighborhood.toLowerCase().includes(term)) ||
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
            *,
            company:profiles!shifts_company_id_fkey (full_name, city, neighborhood, avatar_url, bio, phone_ddd, phone)
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
          shift:shifts (*),
          worker:profiles!shift_applications_worker_id_fkey (*)
        `)
        .in('shift_id', shiftIds)
        .order('created_at', { ascending: false })
      setApplications(data || [])
    }
  }

  async function handleCreateShift(e) {
    e.preventDefault()
    if (!session || !profile) return

    const bairroFinal = shiftNeighborhood || profile.neighborhood || ''
    const ruaFinal = shiftStreet || profile.address || ''
    const locationLabel = `${bairroFinal ? bairroFinal + ' - ' : ''}${profile.city || 'Cidade'}/${profile.state || ''}`

    const { error } = await supabase.from('shifts').insert([
      {
        company_id: session.user.id,
        title,
        vacancies: parseInt(vacancies, 10),
        workload,
        shift_hours: shiftHours,
        pay_rate: parseFloat(payRate),
        shift_date: new Date(shiftDate).toISOString(),
        transport_info: transportInfo,
        meal_info: mealInfo,
        requirements,
        description: requirements,
        shift_neighborhood: bairroFinal,
        shift_street: ruaFinal,
        location: locationLabel
      }
    ])

    if (error) {
      alert('Erro ao publicar turno: ' + error.message)
    } else {
      alert('Turno publicado com sucesso!')
      setTitle('')
      setShiftHours('')
      setPayRate('')
      setShiftDate('')
      setRequirements('')
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
      else alert('Erro: ' + error.message)
    } else {
      alert('Candidatura enviada com sucesso!')
      setSelectedShiftModal(null)
      fetchApplications(profile)
    }
  }

  async function handleApplicationStatus(appId, shiftId, newStatus) {
    const { error } = await supabase.from('shift_applications').update({ status: newStatus }).eq('id', appId)
    if (!error) {
      if (newStatus === 'accepted') {
        await supabase.from('shifts').update({ status: 'filled' }).eq('id', shiftId)
      }
      setSelectedWorkerModal(null)
      fetchApplications(profile)
      fetchShifts(cityFilter)
    }
  }

  // ============================================================================
  // ECRÃ DE LOGIN E CADASTRO EM 3 ETAPAS
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

                {/* ETAPA 1 */}
                {signupStep === 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); setSignupStep(2) }} className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Etapa 1: Tipo de Conta</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setRole('worker')} className={`p-3 rounded-xl border text-left ${role === 'worker' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                        <div className="text-sm font-semibold">Trabalhador</div>
                        <div className="text-[11px] opacity-75">Busco turnos</div>
                      </button>
                      <button type="button" onClick={() => setRole('company')} className={`p-3 rounded-xl border text-left ${role === 'company' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                        <div className="text-sm font-semibold">Empresa</div>
                        <div className="text-[11px] opacity-75">Quero contratar</div>
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

                {/* ETAPA 2 */}
                {signupStep === 2 && (
                  <form onSubmit={(e) => { e.preventDefault(); setSignupStep(3) }} className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">
                      {role === 'company' ? 'Etapa 2: Dados da Empresa' : 'Etapa 2: Seus Dados'}
                    </h2>

                    <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">Foto</div>
                      )}
                      <div className="flex-1">
                        <label className="block text-[11px] text-slate-300 mb-1">
                          {role === 'company' ? 'Logo da Empresa' : 'Sua Foto de Perfil'}
                        </label>
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="text-xs text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{role === 'company' ? 'Nome da Empresa' : 'Nome Completo'}</label>
                      <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>

                    {role === 'company' ? (
                      <>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">CNPJ</label>
                          <input type="text" required placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Telefone / WhatsApp</label>
                          <div className="flex gap-2">
                            <select value={phoneDdd} onChange={(e) => setPhoneDdd(e.target.value)} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-white">
                              {BRAZIL_DDDS.map((d) => <option key={d} value={d}>DDD {d}</option>)}
                            </select>
                            <input type="text" required placeholder="99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Conte sobre sua empresa</label>
                          <textarea rows={3} required placeholder="Fale sobre o ramo de atuação, ambiente e o que fazem..." value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">CPF</label>
                            <input type="text" required placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Idade</label>
                            <select value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-white">
                              {AGE_OPTIONS.map((num) => (
                                <option key={num} value={num}>{num} anos</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Telefone / WhatsApp</label>
                          <div className="flex gap-2">
                            <select value={phoneDdd} onChange={(e) => setPhoneDdd(e.target.value)} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-white">
                              {BRAZIL_DDDS.map((d) => <option key={d} value={d}>DDD {d}</option>)}
                            </select>
                            <input type="text" required placeholder="99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Habilidades (selecione uma ou mais)</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {SKILL_OPTIONS.map((skill) => {
                              const active = selectedSkills.includes(skill)
                              return (
                                <button
                                  type="button"
                                  key={skill}
                                  onClick={() => toggleSkill(skill)}
                                  className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                                    active
                                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-medium'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {active ? '✓ ' : '+ '}{skill}
                                </button>
                              )
                            })}
                          </div>
                          <input
                            type="text"
                            placeholder="Outra habilidade (opcional, escreva aqui...)"
                            value={customSkill}
                            onChange={(e) => setCustomSkill(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setSignupStep(1)} className="w-1/3 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg">← Voltar</button>
                      <button type="submit" className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg">Próxima →</button>
                    </div>
                  </form>
                )}

                {/* ETAPA 3 */}
                {signupStep === 3 && (
                  <form onSubmit={handleCompleteSignup} className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">Etapa 3: Localização</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="CEP" maxLength={9} value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="text" required placeholder="UF" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      <input type="text" required placeholder="Bairro / Setor" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <input type="text" required placeholder="Rua / Número / Quadra" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />

                    {role === 'worker' && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Distância máxima para trabalhar</label>
                        <select value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                          <option value="Até 5 km (Mesmo bairro)">Até 5 km (Mesmo bairro)</option>
                          <option value="Até 10 km">Até 10 km</option>
                          <option value="Até 20 km">Até 20 km</option>
                          <option value="Toda a cidade">Toda a cidade</option>
                        </select>
                      </div>
                    )}

                    {authError && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{authError}</p>}

                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setSignupStep(2)} className="w-1/3 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg">← Voltar</button>
                      <button type="submit" disabled={authLoading} className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg">
                        {authLoading ? 'A concluir...' : 'Concluir Cadastro ✓'}
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

  // ============================================================================
  // PAINEL AUTENTICADO
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                {(profile?.full_name || fullName || 'T')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-white leading-tight">TurnLevel</h1>
              <p className="text-[11px] text-slate-400">
                {profile?.full_name || fullName} • {profile?.city || city || 'Sem cidade'} ({(profile?.role || role) === 'company' ? 'Empresa' : 'Trabalhador'})
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
            {/* ============================================================== */}
            {/* ABA 1: TURNOS                                                  */}
            {/* ============================================================== */}
            {activeTab === 'shifts' && (
              <div className="space-y-6">
                {(profile?.role || role) === 'company' && (
                  <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h2 className="text-base font-semibold text-white mb-4">Publicar Novo Turno</h2>
                    <form onSubmit={handleCreateShift} className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Função / Cargo</label>
                        <input type="text" required placeholder="Ex: Garçom / Auxiliar de Cozinha" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Quantidade de Vagas</label>
                        <select value={vacancies} onChange={(e) => setVacancies(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                          {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((v) => (
                            <option key={v} value={v}>{v} {v === 1 ? 'vaga' : 'vagas'}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Carga Horária</label>
                        <select value={workload} onChange={(e) => setWorkload(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                          <option value="4 horas">4 horas</option>
                          <option value="6 horas">6 horas</option>
                          <option value="8 horas">8 horas</option>
                          <option value="10 horas">10 horas</option>
                          <option value="12 horas (Plantão)">12 horas (Plantão)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Horário (Ex: 18:00 às 00:00)</label>
                        <input type="text" required placeholder="18:00 às 00:00" value={shiftHours} onChange={(e) => setShiftHours(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Valor do Turno (R$)</label>
                        <input type="number" step="0.01" required placeholder="120.00" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Data do Turno</label>
                        <input type="datetime-local" required value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Transporte</label>
                        <select value={transportInfo} onChange={(e) => setTransportInfo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                          <option value="Vale-transporte pago">Vale-transporte pago</option>
                          <option value="Ajuda de custo transporte">Ajuda de custo transporte</option>
                          <option value="Não fornece transporte">Não fornece transporte</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Alimentação</label>
                        <select value={mealInfo} onChange={(e) => setMealInfo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                          <option value="Alimentação no local">Alimentação no local</option>
                          <option value="Vale-refeição pago">Vale-refeição pago</option>
                          <option value="Não fornece alimentação">Não fornece alimentação</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Bairro / Setor do Turno</label>
                        <input type="text" required placeholder="Ex: Setor Bueno" value={shiftNeighborhood} onChange={(e) => setShiftNeighborhood(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Rua e Número</label>
                        <input type="text" required placeholder="Ex: Rua T-30, nº 120" value={shiftStreet} onChange={(e) => setShiftStreet(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">Exigências / Observações</label>
                        <input type="text" placeholder="Ex: Calça preta, sapato fechado, experiência prévia..." value={requirements} onChange={(e) => setRequirements(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>

                      <button type="submit" className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg">
                        + Publicar Vaga Agora
                      </button>
                    </form>
                  </section>
                )}

                <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] text-slate-400 mb-1">Filtrar por cidade ou bairro</label>
                    <input type="text" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} placeholder="Ex: Goiânia, Setor Bueno..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button onClick={() => fetchShifts(cityFilter)} className="bg-emerald-600 text-white text-xs font-medium px-3 py-2 rounded-lg">Filtrar</button>
                    <button onClick={() => { setCityFilter(''); fetchShifts('') }} className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg">Ver Todas</button>
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
                          <div
                            key={shift.id}
                            onClick={() => setSelectedShiftModal(shift)}
                            className="bg-slate-900 hover:border-slate-700 cursor-pointer border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 transition"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800/70">
                                <div className="flex items-center gap-2.5">
                                  {shift.company?.avatar_url ? (
                                    <img src={shift.company.avatar_url} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                      {(shift.company?.full_name || 'E')[0]}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-semibold text-slate-200">{shift.company?.full_name || 'Empresa'}</p>
                                    <p className="text-[11px] text-emerald-400">Toque para ver detalhes</p>
                                  </div>
                                </div>
                                {shift.vacancies && (
                                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                                    {shift.vacancies} {shift.vacancies === 1 ? 'vaga' : 'vagas'}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-semibold text-white text-base">{shift.title}</h3>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {shift.workload && <span className="text-[11px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">⏱ {shift.workload}</span>}
                                {shift.meal_info && <span className="text-[11px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">🍽 {shift.meal_info}</span>}
                              </div>
                              <p className="text-xs text-slate-300 mt-2.5">📍 {shift.location}</p>
                              <p className="text-xs text-slate-400 mt-1">📅 {new Date(shift.shift_date).toLocaleDateString('pt-BR')} {shift.shift_hours ? `• ${shift.shift_hours}` : ''}</p>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                              <span className="text-emerald-400 font-bold text-base">R$ {Number(shift.pay_rate).toFixed(2)}</span>
                              {(profile?.role || role) === 'worker' ? (
                                shift.status !== 'open' ? (
                                  <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg">Preenchido</span>
                                ) : applied ? (
                                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">Candidatado ✓</span>
                                ) : (
                                  <button onClick={() => setSelectedShiftModal(shift)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition">
                                    Ver Vaga
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

            {/* ============================================================== */}
            {/* ABA 2: CANDIDATURAS & GESTÃO DE CANDIDATOS                     */}
            {/* ============================================================== */}
            {activeTab === 'applications' && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  {(profile?.role || role) === 'company' ? 'Candidatos Recebidos' : 'Minhas Candidaturas'}
                </h2>
                {applications.length === 0 ? (
                  <div className="bg-slate-900 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                    <p className="text-sm text-slate-400">Sem registos no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => {
                          if ((profile?.role || role) === 'company' && app.worker) {
                            setSelectedWorkerModal(app)
                          }
                        }}
                        className={`bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 ${(profile?.role || role) === 'company' ? 'cursor-pointer hover:border-slate-700' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs text-emerald-400 font-medium">Turno: {app.shift?.title} (R$ {Number(app.shift?.pay_rate || 0).toFixed(2)})</span>
                            {(profile?.role || role) === 'company' ? (
                              <div className="flex items-center gap-3 mt-2">
                                {app.worker?.avatar_url ? <img src={app.worker.avatar_url} alt="Foto" className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">{(app.worker?.full_name || 'T')[0]}</div>}
                                <div>
                                  <h3 className="font-semibold text-white text-sm">{app.worker?.full_name} {app.worker?.age ? `(${app.worker.age} anos)` : ''}</h3>
                                  <p className="text-xs text-slate-400">📍 {app.worker?.neighborhood}, {app.worker?.city}</p>
                                  <p className="text-[11px] text-emerald-400 mt-0.5">Toque para ver perfil completo do candidato</p>
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
                        {(profile?.role || role) === 'company' && app.status === 'pending' && (
                          <div className="flex gap-2 pt-2 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
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

            {/* ============================================================== */}
            {/* ABA 3: PERFIL COMPLETO (COM TODOS OS DADOS PREENCHIDOS)        */}
            {/* ============================================================== */}
            {activeTab === 'profile' && (
              <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-white mb-4">Meus Dados Cadastrais</h2>
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
                      <label className="block text-xs text-slate-400 mb-1">Telefone / WhatsApp</label>
                      <div className="flex gap-2">
                        <select value={phoneDdd} onChange={(e) => setPhoneDdd(e.target.value)} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-white">
                          {BRAZIL_DDDS.map((d) => <option key={d} value={d}>DDD {d}</option>)}
                        </select>
                        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>
                    </div>

                    {(profile?.role || role) === 'company' ? (
                      <>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">CNPJ</label>
                          <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Setor / Ramo</label>
                          <input type="text" value={sector} onChange={(e) => setSector(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">Sobre a empresa</label>
                          <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">CPF</label>
                          <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Idade</label>
                          <select value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                            {AGE_OPTIONS.map((num) => (
                              <option key={num} value={num}>{num} anos</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">Distância máxima para trabalhar</label>
                          <select value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                            <option value="Até 5 km (Mesmo bairro)">Até 5 km (Mesmo bairro)</option>
                            <option value="Até 10 km">Até 10 km</option>
                            <option value="Até 20 km">Até 20 km</option>
                            <option value="Toda a cidade">Toda a cidade</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-400 mb-1.5">Habilidades</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {SKILL_OPTIONS.map((skill) => {
                              const active = selectedSkills.includes(skill)
                              return (
                                <button
                                  type="button"
                                  key={skill}
                                  onClick={() => toggleSkill(skill)}
                                  className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                                    active
                                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-medium'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {active ? '✓ ' : '+ '}{skill}
                                </button>
                              )
                            })}
                          </div>
                          <input
                            type="text"
                            placeholder="Outras habilidades..."
                            value={customSkill}
                            onChange={(e) => setCustomSkill(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">CEP</label>
                      <input type="text" value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Estado (UF)</label>
                      <input type="text" value={stateUf} onChange={(e) => setStateUf(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Cidade</label>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Bairro / Setor</label>
                      <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Endereço / Rua e Número</label>
                      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
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

      {/* ==================================================================== */}
      {/* MODAL 1: DETALHES DO TURNO E DA EMPRESA                              */}
      {/* ==================================================================== */}
      {selectedShiftModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedShiftModal(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {selectedShiftModal.company?.avatar_url ? (
                  <img src={selectedShiftModal.company.avatar_url} alt="Empresa" className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white">
                    {(selectedShiftModal.company?.full_name || 'E')[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white text-base">{selectedShiftModal.company?.full_name || 'Empresa'}</h3>
                  <p className="text-xs text-slate-400">{selectedShiftModal.company?.city} - {selectedShiftModal.company?.state}</p>
                </div>
              </div>
              <button onClick={() => setSelectedShiftModal(null)} className="text-slate-400 hover:text-white text-lg px-2">✕</button>
            </div>

            {selectedShiftModal.company?.bio && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-[11px] text-slate-400 font-medium mb-1">Sobre a empresa:</p>
                <p className="text-xs text-slate-200">{selectedShiftModal.company.bio}</p>
              </div>
            )}

            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-white text-lg">{selectedShiftModal.title}</h4>
                <span className="text-emerald-400 font-bold text-lg">R$ {Number(selectedShiftModal.pay_rate).toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Vagas:</span>
                  <span className="text-white font-medium">{selectedShiftModal.vacancies || 1}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Carga Horária:</span>
                  <span className="text-white font-medium">{selectedShiftModal.workload || 'A combinar'}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Transporte:</span>
                  <span className="text-white font-medium">{selectedShiftModal.transport_info || 'Não informado'}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Alimentação:</span>
                  <span className="text-white font-medium">{selectedShiftModal.meal_info || 'Não informado'}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                <p className="text-slate-300">📅 <strong>Data e Horário:</strong> {new Date(selectedShiftModal.shift_date).toLocaleDateString('pt-BR')} {selectedShiftModal.shift_hours ? `(${selectedShiftModal.shift_hours})` : ''}</p>
                <p className="text-slate-300">📍 <strong>Local:</strong> {selectedShiftModal.shift_street ? `${selectedShiftModal.shift_street}, ` : ''}{selectedShiftModal.location}</p>
                {selectedShiftModal.requirements && (
                  <p className="text-slate-300 pt-1">📋 <strong>Exigências:</strong> {selectedShiftModal.requirements}</p>
                )}
              </div>
            </div>

            {(profile?.role || role) === 'worker' && selectedShiftModal.status === 'open' && (
              <div className="pt-2">
                {applications.some((a) => a.shift_id === selectedShiftModal.id) ? (
                  <div className="w-full text-center py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                    Você já se candidatou a este turno ✓
                  </div>
                ) : (
                  <button
                    onClick={() => handleApply(selectedShiftModal.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-3 rounded-lg"
                  >
                    Confirmar Candidatura
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PERFIL COMPLETO DO CANDIDATO (PARA EMPRESA VER)             */}
      {/* ==================================================================== */}
      {selectedWorkerModal && selectedWorkerModal.worker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedWorkerModal(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {selectedWorkerModal.worker.avatar_url ? (
                  <img src={selectedWorkerModal.worker.avatar_url} alt="Candidato" className="w-14 h-14 rounded-full object-cover border border-slate-700" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-lg">
                    {(selectedWorkerModal.worker.full_name || 'T')[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white text-base">{selectedWorkerModal.worker.full_name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedWorkerModal.worker.age ? `${selectedWorkerModal.worker.age} anos` : ''} • {selectedWorkerModal.worker.city}/{selectedWorkerModal.worker.state}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedWorkerModal(null)} className="text-slate-400 hover:text-white text-lg px-2">✕</button>
            </div>

            <div className="space-y-2 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <p className="text-slate-300">📞 <strong>WhatsApp / Telefone:</strong> ({selectedWorkerModal.worker.phone_ddd || '62'}) {selectedWorkerModal.worker.phone}</p>
              <p className="text-slate-300">📍 <strong>Bairro / Região:</strong> {selectedWorkerModal.worker.neighborhood} - {selectedWorkerModal.worker.address}</p>
              <p className="text-slate-300">🚗 <strong>Deslocamento:</strong> {selectedWorkerModal.worker.max_distance || 'Não informado'}</p>
              <p className="text-slate-300">🛠 <strong>Habilidades:</strong> {selectedWorkerModal.worker.skills || 'Não especificadas'}</p>
            </div>

            {selectedWorkerModal.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleApplicationStatus(selectedWorkerModal.id, selectedWorkerModal.shift.id, 'accepted')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-3 rounded-lg"
                >
                  Aceitar Candidato ✓
                </button>
                <button
                  onClick={() => handleApplicationStatus(selectedWorkerModal.id, selectedWorkerModal.shift.id, 'rejected')}
                  className="flex-1 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-xs font-medium py-3 rounded-lg"
                >
                  Recusar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 px-4 py-2 z-20">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          <button onClick={() => setActiveTab('shifts')} className={`py-2 rounded-lg text-xs font-medium transition ${activeTab === 'shifts' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
            Turnos
          </button>
          <button onClick={() => { setActiveTab('applications'); fetchApplications(profile) }} className={`py-2 rounded-lg text-xs font-medium transition ${activeTab === 'applications' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
            {(profile?.role || role) === 'company' ? 'Candidatos' : 'Candidaturas'}
          </button>
          <button onClick={() => setActiveTab('profile')} className={`py-2 rounded-lg text-xs font-medium transition ${activeTab === 'profile' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
            Perfil
          </button>
        </div>
      </nav>
    </div>
  )
}
