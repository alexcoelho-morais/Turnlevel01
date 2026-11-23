import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY =
  'BKVSS2H3oGVbJKXVePdGR8R6pB_oTDV-XkP14Q_OnTVh5UU01G_e_9RcFXnDBDQP1o-ev29WksUG5wOJSN2PMxQ'

const TEST_MASTER_EMAILS = ['turnlevelteste@gmail.com']

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function formatShiftHoursMask(rawValue) {
  const digits = (rawValue || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  if (digits.length <= 6) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)} às ${digits.slice(4)}`
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)} às ${digits.slice(4, 6)}:${digits.slice(6)}`
}

function parseMoneyInput(rawValue) {
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : 0
  let str = String(rawValue || '').trim().replace(/[^\d.,]/g, '')
  if (!str) return 0

  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }

  const parsed = parseFloat(str)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrencyBRL(value) {
  const num = parseMoneyInput(value)
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function maskDocument(doc, type = 'cpf') {
  const digits = (doc || '').replace(/\D/g, '')
  if (!digits) return 'Verificado'
  if (type === 'cnpj' && digits.length === 14) {
    return `**.***.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`
  }
  if (digits.length >= 11) {
    return `***.***.${digits.slice(6, 9)}-**`
  }
  return 'Verificado'
}

function formatCnpjMask(rawValue) {
  const digits = (rawValue || '').replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function isValidCnpj(rawCnpj) {
  const cnpjDigits = (rawCnpj || '').replace(/\D/g, '')
  if (cnpjDigits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpjDigits)) return false

  const calcDigit = (base, weights) => {
    const sum = base
      .split('')
      .reduce((acc, char, idx) => acc + Number(char) * weights[idx], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const digit1 = calcDigit(cnpjDigits.slice(0, 12), weights1)
  if (digit1 !== Number(cnpjDigits[12])) return false

  const digit2 = calcDigit(cnpjDigits.slice(0, 13), weights2)
  return digit2 === Number(cnpjDigits[13])
}

async function geocodeAddressText(street, neighborhood, city, stateUf) {
  try {
    const query = encodeURIComponent(
      `${street ? street + ', ' : ''}${neighborhood ? neighborhood + ', ' : ''}${city || ''}, ${stateUf || ''}, Brasil`
    )
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    )
    const geoData = await geoRes.json()
    if (Array.isArray(geoData) && geoData[0]) {
      return {
        latitude: parseFloat(geoData[0].lat),
        longitude: parseFloat(geoData[0].lon)
      }
    }
  } catch (err) {
    console.error('Erro geocodificação:', err)
  }
  return { latitude: null, longitude: null }
}

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

const WEEK_DAYS = [
  { value: '', label: 'Todos os dias' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' }
]

const AGE_OPTIONS = Array.from({ length: 34 }, (_, i) => i + 17)

function TurnLevelLogo({ size = 'md', animated = false }) {
  const isLg = size === 'lg'
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div className="relative flex items-center justify-center">
        {animated && (
          <>
            <span className="absolute inset-0 rounded-2xl bg-lime-400/40 animate-ping" style={{ animationDuration: '3s' }} />
            <span className="absolute -inset-2 rounded-2xl border border-lime-400/30 animate-pulse" />
          </>
        )}
        <div
          className={`relative ${isLg ? 'w-12 h-12 rounded-2xl' : 'w-8 h-8 rounded-lg'} bg-lime-400 flex items-center justify-center shadow-[0_0_28px_rgba(163,230,53,0.45)] ${animated ? 'animate-float' : ''}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#050505"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLg ? 'w-7 h-7' : 'w-4 h-4'}
          >
            <path d="M5 7h14" />
            <path d="M12 7v11" />
            <path d="M16 14l3 3-3 3" />
          </svg>
        </div>
      </div>
      <span className={`${isLg ? 'text-3xl' : 'text-lg'} font-extrabold tracking-tight text-white`}>
        Turn<span className="text-lime-400">Level</span>
      </span>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState('shifts')

  const [pushLoading, setPushLoading] = useState(false)
  const [pushStatus, setPushStatus] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [showPushPromptModal, setShowPushPromptModal] = useState(false)

  const [authView, setAuthView] = useState('welcome')
  const [howItWorksTab, setHowItWorksTab] = useState('worker')
  const [signupStep, setSignupStep] = useState(1)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [legalModal, setLegalModal] = useState(null)

  const [role, setRole] = useState('worker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneDdd, setPhoneDdd] = useState('62')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  const [cnpj, setCnpj] = useState('')
  const [sector, setSector] = useState('')
  const [cpf, setCpf] = useState('')
  const [age, setAge] = useState('20')
  const [selectedSkills, setSelectedSkills] = useState([])
  const [customSkill, setCustomSkill] = useState('')
  const [maxDistance, setMaxDistance] = useState('Até 10 km')

  const [cep, setCep] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)

  const [shifts, setShifts] = useState([])
  const [applications, setApplications] = useState([])
  const [allReviews, setAllReviews] = useState([])
  const [cityFilter, setCityFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [loadingShifts, setLoadingShifts] = useState(true)

  const [selectedShiftModal, setSelectedShiftModal] = useState(null)
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null)

  const [editingShift, setEditingShift] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const [reviewModalApp, setReviewModalApp] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const [publishType, setPublishType] = useState('shift')

  const [title, setTitle] = useState('')
  const [vacancies, setVacancies] = useState('1')
  const [workload, setWorkload] = useState('6 horas')
  const [shiftHours, setShiftHours] = useState('')
  const [payRate, setPayRate] = useState('')
  const [shiftDate, setShiftDate] = useState('')
  const [transportInfo, setTransportInfo] = useState('Vale-transporte pago')
  const [mealInfo, setMealInfo] = useState('Alimentação no local')
  const [vehicleRequired, setVehicleRequired] = useState('Não exige veículo')
  const [requirements, setRequirements] = useState('')
  const [shiftNeighborhood, setShiftNeighborhood] = useState('')
  const [shiftStreet, setShiftStreet] = useState('')

  const [employmentType, setEmploymentType] = useState('CLT / Efetivo')
  const [workSchedule, setWorkSchedule] = useState('Segunda a Sábado')
  const [salaryPeriod, setSalaryPeriod] = useState('/ mês')

  const isMasterTester = Boolean(
    session?.user?.email &&
      TEST_MASTER_EMAILS.map((e) => e.toLowerCase()).includes(session.user.email.toLowerCase())
  )
  const activeRole = profile?.role || role

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUserData(session.user.id)
      else fetchShifts('', '')
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

  useEffect(() => {
    if (session && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) {
            setPushEnabled(true)
            setPushStatus('Notificações ativas neste dispositivo ✓')
          } else if (Notification.permission === 'default') {
            setShowPushPromptModal(true)
          }
        })
        .catch(() => {})
    }
  }, [session])

  async function handleSwitchMasterRole(nextRole, currentProf = profile) {
    setRole(nextRole)
    const updatedProf = currentProf ? { ...currentProf, role: nextRole } : { id: session?.user?.id, role: nextRole }
    setProfile(updatedProf)
    if (nextRole === 'company') {
      setShiftNeighborhood(updatedProf.neighborhood || neighborhood || '')
      setShiftStreet(updatedProf.address || address || '')
    }
    await fetchApplications(updatedProf)
  }

  async function handleActivatePushNotifications() {
    if (!session?.user?.id) return

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Este navegador não suporta notificações push. No iPhone, adicione o TurnLevel à Tela de Início primeiro.')
      return
    }

    setPushLoading(true)
    setPushStatus('')

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus('Permissão de notificação negada.')
        alert('Ative as notificações nas configurações do aparelho para receber alertas de vagas.')
        setPushLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const existingSub = await registration.pushManager.getSubscription()
      const subscription =
        existingSub ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        }))

      const subJson = subscription.toJSON()
      const endpoint = subJson.endpoint
      const p256dh = subJson.keys?.p256dh
      const auth = subJson.keys?.auth

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Dados da subscrição push incompletos.')
      }

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: session.user.id,
          endpoint,
          p256dh,
          auth
        },
        { onConflict: 'endpoint' }
      )

      if (error) throw error

      // Dispara um push de confirmação imediato para validar o celular na hora
      await supabase.functions.invoke('notify-nearby-workers', {
        body: {
          test_subscription: { endpoint, p256dh, auth }
        }
      }).catch(() => {})

      setPushEnabled(true)
      setShowPushPromptModal(false)
      setPushStatus('Notificações ativas neste dispositivo ✓')
    } catch (err) {
      console.error('Erro ao ativar push:', err)
      setPushStatus('Erro ao ativar notificações.')
      alert('Erro ao ativar notificações: ' + (err.message || 'Tente novamente.'))
    }

    setPushLoading(false)
  }

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
      await Promise.all([
        fetchShifts(initialCity, dayFilter),
        fetchApplications(prof),
        fetchAllReviews()
      ])
    } else {
      await fetchShifts('', '')
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
    setCnpj(prof.cnpj ? formatCnpjMask(prof.cnpj) : '')
    setSector(prof.sector || '')
    setCpf(prof.cpf || '')
    setAge(prof.age ? String(prof.age) : '20')
    setMaxDistance(prof.max_distance || 'Até 10 km')

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
    setLatitude(prof.latitude ?? null)
    setLongitude(prof.longitude ?? null)

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

  function buildWhatsappE164(rawDdd, rawPhone) {
    const cleanPhone = (rawPhone || '').replace(/\D/g, '')
    const cleanDdd = (rawDdd || '62').replace(/\D/g, '')
    return cleanPhone ? `55${cleanDdd}${cleanPhone}` : null
  }

  async function handleCepLookup(rawCep) {
    const clean = rawCep.replace(/\D/g, '')
    setCep(rawCep)
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
        const data = await res.json()
        if (!data.erro) {
          const uf = data.uf || ''
          const loc = data.localidade || ''
          const bairro = data.bairro || ''
          const rua = data.logradouro || ''

          setStateUf(uf)
          setCity(loc)
          setNeighborhood(bairro)
          setAddress(rua)

          const coords = await geocodeAddressText(rua, bairro, loc, uf)
          if (coords.latitude && coords.longitude) {
            setLatitude(coords.latitude)
            setLongitude(coords.longitude)
          }
        }
      } catch (err) {
        console.error('Erro CEP/Geolocalização:', err)
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

  async function handleResetPassword(e) {
    e.preventDefault()
    if (!email) {
      setAuthError('Digite seu e-mail acima para receber o link de recuperação.')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    setResetMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    if (error) {
      setAuthError(error.message)
    } else {
      setResetMessage(`Enviamos um link de redefinição de senha para ${email}.`)
    }
    setAuthLoading(false)
  }

  function handleAdvanceFromStep2(e) {
    e.preventDefault()
    setAuthError('')
    if (role === 'company' && !isValidCnpj(cnpj)) {
      setAuthError('Informe um CNPJ válido (14 dígitos e dígitos verificadores corretos).')
      return
    }
    setSignupStep(3)
  }

  async function handleCompleteSignup(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    if (role === 'company' && !isValidCnpj(cnpj)) {
      setAuthError('CNPJ inválido. Verifique os números informados antes de concluir.')
      setAuthLoading(false)
      return
    }

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
      const whatsappE164 = buildWhatsappE164(phoneDdd, phone)

      let finalLat = latitude
      let finalLon = longitude
      if (!finalLat || !finalLon) {
        const coords = await geocodeAddressText(address, neighborhood, city, stateUf)
        finalLat = coords.latitude
        finalLon = coords.longitude
      }

      const profilePayload = {
        id: userId,
        full_name: fullName,
        role,
        phone_ddd: phoneDdd,
        phone,
        whatsapp_e164: whatsappE164,
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
        address,
        latitude: finalLat,
        longitude: finalLon
      }

      await supabase.from('profiles').upsert(profilePayload)

      if (!signUpData.session) {
        setAuthView('verify_email')
        setAuthLoading(false)
        return
      }

      await loadUserData(userId)
      if (role === 'worker') {
        setShowPushPromptModal(true)
      } else {
        setShowInstallGuide(true)
      }
    }
    setAuthLoading(false)
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    if (!session) return
    const currentRole = activeRole

    if (currentRole === 'company' && !isMasterTester && !isValidCnpj(cnpj)) {
      alert('CNPJ inválido. Digite um CNPJ válido para salvar.')
      return
    }

    setAuthLoading(true)

    const uploadedUrl = await uploadAvatar(session.user.id)
    const finalSkills = buildFinalSkillsString()
    const whatsappE164 = buildWhatsappE164(phoneDdd, phone)

    let finalLat = latitude ?? profile?.latitude ?? null
    let finalLon = longitude ?? profile?.longitude ?? null
    if (!finalLat || !finalLon) {
      const coords = await geocodeAddressText(address, neighborhood, city, stateUf)
      finalLat = coords.latitude
      finalLon = coords.longitude
    }

    const updates = {
      id: session.user.id,
      role: currentRole,
      full_name: fullName,
      phone_ddd: phoneDdd,
      phone,
      whatsapp_e164: whatsappE164,
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
      address,
      latitude: finalLat,
      longitude: finalLon
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

  async function fetchAllReviews() {
    const { data } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviews_reviewer_id_fkey (full_name, role)
      `)
      .order('created_at', { ascending: false })
    setAllReviews(data || [])
  }

  function getReputationStats(userId) {
    const userReviews = allReviews.filter((r) => r.reviewed_id === userId)
    const count = userReviews.length
    if (count === 0) return { avg: null, count: 0, reviews: [] }
    const sum = userReviews.reduce((acc, r) => acc + r.rating, 0)
    return {
      avg: (sum / count).toFixed(1),
      count,
      reviews: userReviews
    }
  }

  async function fetchShifts(filterCity = cityFilter, filterDay = dayFilter) {
    setLoadingShifts(true)
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        company:profiles!shifts_company_id_fkey (
          id, full_name, avatar_url, sector, bio, phone_ddd, phone, city, state, neighborhood, address, cnpj
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      let result = data
      if (filterCity && filterCity.trim() !== '') {
        const term = filterCity.trim().toLowerCase()
        result = result.filter(
          (s) =>
            (s.city && s.city.toLowerCase().includes(term)) ||
            (s.location && s.location.toLowerCase().includes(term)) ||
            (s.shift_neighborhood && s.shift_neighborhood.toLowerCase().includes(term)) ||
            (s.company?.city && s.company.city.toLowerCase().includes(term))
        )
      }
      if (filterDay !== '' && activeTab === 'shifts') {
        result = result.filter((s) => {
          const d = new Date(s.shift_date)
          return String(d.getDay()) === filterDay
        })
      }
      setShifts(result)
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
            company:profiles!shifts_company_id_fkey (id, full_name, city, neighborhood, avatar_url, bio, phone_ddd, phone, sector, cnpj)
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
    if (!session) return

    const isJob = publishType === 'job'
    const bairroFinal = shiftNeighborhood || profile?.neighborhood || neighborhood || ''
    const ruaFinal = shiftStreet || profile?.address || address || ''
    const cidadeFinal = profile?.city || city || 'Cidade'
    const ufFinal = profile?.state || stateUf || ''
    const locationLabel = `${bairroFinal ? bairroFinal + ' - ' : ''}${cidadeFinal}${ufFinal ? '/' + ufFinal : ''}`
    const finalDate = shiftDate ? new Date(shiftDate).toISOString() : new Date().toISOString()

    const numericPayRate = parseMoneyInput(payRate)
    if (numericPayRate <= 0) {
      alert('Informe um valor válido maior que zero.')
      return
    }

    let shiftLat = profile?.latitude ?? latitude ?? null
    let shiftLon = profile?.longitude ?? longitude ?? null
    const geocoded = await geocodeAddressText(ruaFinal, bairroFinal, cidadeFinal, ufFinal)
    if (geocoded.latitude && geocoded.longitude) {
      shiftLat = geocoded.latitude
      shiftLon = geocoded.longitude
    }

    const { error } = await supabase.from('shifts').insert([
      {
        company_id: session.user.id,
        post_type: publishType,
        title,
        vacancies: parseInt(vacancies, 10),
        workload: isJob ? workSchedule : workload,
        shift_hours: shiftHours,
        pay_rate: numericPayRate,
        shift_date: finalDate,
        transport_info: transportInfo,
        meal_info: mealInfo,
        vehicle_required: vehicleRequired,
        employment_type: isJob ? employmentType : null,
        work_schedule: isJob ? workSchedule : null,
        salary_period: isJob ? salaryPeriod : '/ turno',
        requirements,
        description: requirements,
        shift_neighborhood: bairroFinal,
        shift_street: ruaFinal,
        location: locationLabel,
        latitude: shiftLat,
        longitude: shiftLon
      }
    ])

    if (error) {
      alert('Erro ao publicar: ' + error.message)
    } else {
      alert(isJob ? 'Vaga de trabalho publicada com sucesso!' : 'Turno publicado com sucesso!')
      setTitle('')
      setShiftHours('')
      setPayRate('')
      setShiftDate('')
      setRequirements('')
      setActiveTab(isJob ? 'jobs' : 'shifts')
      await fetchShifts(cityFilter, dayFilter)
    }
  }

  function handleOpenEditShift(shift) {
    const localDate = shift.shift_date
      ? new Date(shift.shift_date).toISOString().slice(0, 16)
      : ''

    setEditingShift({
      id: shift.id,
      post_type: shift.post_type || 'shift',
      title: shift.title || '',
      vacancies: String(shift.vacancies || 1),
      workload: shift.workload || '6 horas',
      shift_hours: shift.shift_hours || '',
      pay_rate: shift.pay_rate !== undefined && shift.pay_rate !== null ? String(shift.pay_rate) : '',
      shift_date: localDate,
      transport_info: shift.transport_info || 'Vale-transporte pago',
      meal_info: shift.meal_info || 'Alimentação no local',
      vehicle_required: shift.vehicle_required || 'Não exige veículo',
      employment_type: shift.employment_type || 'CLT / Efetivo',
      work_schedule: shift.work_schedule || 'Segunda a Sábado',
      salary_period: shift.salary_period || (shift.post_type === 'job' ? '/ mês' : '/ turno'),
      shift_neighborhood: shift.shift_neighborhood || '',
      shift_street: shift.shift_street || '',
      requirements: shift.requirements || shift.description || '',
      status: shift.status || 'open'
    })
  }

  async function handleSaveEditShift(e) {
    e.preventDefault()
    if (!editingShift || !session) return
    setSavingEdit(true)

    const isJob = editingShift.post_type === 'job'
    const bairroFinal = editingShift.shift_neighborhood || profile?.neighborhood || neighborhood || ''
    const ruaFinal = editingShift.shift_street || profile?.address || address || ''
    const cidadeFinal = profile?.city || city || 'Cidade'
    const ufFinal = profile?.state || stateUf || ''
    const locationLabel = `${bairroFinal ? bairroFinal + ' - ' : ''}${cidadeFinal}${ufFinal ? '/' + ufFinal : ''}`
    const numericPayRate = parseMoneyInput(editingShift.pay_rate)

    const { data: updatedRows, error } = await supabase
      .from('shifts')
      .update({
        post_type: editingShift.post_type,
        title: editingShift.title,
        vacancies: parseInt(editingShift.vacancies, 10) || 1,
        workload: isJob ? editingShift.work_schedule : editingShift.workload,
        shift_hours: editingShift.shift_hours,
        pay_rate: numericPayRate,
        shift_date: editingShift.shift_date ? new Date(editingShift.shift_date).toISOString() : new Date().toISOString(),
        transport_info: editingShift.transport_info,
        meal_info: editingShift.meal_info,
        vehicle_required: editingShift.vehicle_required,
        employment_type: isJob ? editingShift.employment_type : null,
        work_schedule: isJob ? editingShift.work_schedule : null,
        salary_period: isJob ? editingShift.salary_period : '/ turno',
        shift_neighborhood: bairroFinal,
        shift_street: ruaFinal,
        location: locationLabel,
        requirements: editingShift.requirements,
        description: editingShift.requirements,
        status: editingShift.status
      })
      .eq('id', editingShift.id)
      .eq('company_id', session.user.id)
      .select()

    setSavingEdit(false)

    if (error) {
      alert('Erro ao atualizar: ' + error.message)
    } else if (!updatedRows || updatedRows.length === 0) {
      alert('Nenhuma linha foi atualizada no banco.')
    } else {
      alert('Atualizado com sucesso!')
      setEditingShift(null)
      await fetchShifts(cityFilter, dayFilter)
    }
  }

  async function handleDeleteShift(shiftId) {
    if (!session) return
    const confirmed = window.confirm('Tem certeza que deseja excluir esta publicação permanentemente?')
    if (!confirmed) return

    const { data: deletedRows, error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', shiftId)
      .eq('company_id', session.user.id)
      .select()

    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else if (!deletedRows || deletedRows.length === 0) {
      alert('Não foi possível excluir no banco.')
    } else {
      alert('Excluído com sucesso!')
      await Promise.all([
        fetchShifts(cityFilter, dayFilter),
        fetchApplications(profile)
      ])
    }
  }

  async function handleApply(shiftId) {
    if (!session) return
    const { error } = await supabase.from('shift_applications').insert([
      { shift_id: shiftId, worker_id: session.user.id }
    ])

    if (error) {
      if (error.code === '23505') alert('Você já se candidatou.')
      else alert('Erro: ' + error.message)
    } else {
      alert('Candidatura enviada com sucesso.')
      setSelectedShiftModal(null)
      fetchApplications(profile)
    }
  }

  async function handleApplicationStatus(appId, shiftId, newStatus) {
    const { error } = await supabase.from('shift_applications').update({ status: newStatus }).eq('id', appId)
    if (!error) {
      if (newStatus === 'accepted') {
        const targetShift = shifts.find((s) => s.id === shiftId)
        const totalVacancies = Number(targetShift?.vacancies || 1)
        const { count: acceptedCount } = await supabase
          .from('shift_applications')
          .select('*', { count: 'exact', head: true })
          .eq('shift_id', shiftId)
          .eq('status', 'accepted')

        if ((acceptedCount || 0) >= totalVacancies) {
          await supabase.from('shifts').update({ status: 'filled' }).eq('id', shiftId)
        }
      }
      setSelectedWorkerModal(null)
      fetchApplications(profile)
      fetchShifts(cityFilter, dayFilter)
    }
  }

  async function handleConfirmShiftEndAndOpenReview(app) {
    const isCompany = activeRole === 'company'
    const updates = isCompany
      ? { company_confirmed_end: true, completed_at: new Date().toISOString() }
      : { worker_confirmed_end: true, completed_at: new Date().toISOString() }

    await supabase.from('shift_applications').update(updates).eq('id', app.id)
    await fetchApplications(profile)

    setReviewRating(5)
    setReviewComment('')
    setReviewModalApp(app)
  }

  async function handleSubmitReview(e) {
    e.preventDefault()
    if (!reviewModalApp || !session) return
    setSubmittingReview(true)

    const isCompany = activeRole === 'company'
    const reviewedId = isCompany ? reviewModalApp.worker_id : reviewModalApp.shift?.company_id

    const { error } = await supabase.from('reviews').insert([
      {
        shift_id: reviewModalApp.shift_id,
        application_id: reviewModalApp.id,
        reviewer_id: session.user.id,
        reviewed_id: reviewedId,
        reviewer_role: isCompany ? 'company' : 'worker',
        rating: reviewRating,
        comment: reviewComment.trim()
      }
    ])

    setSubmittingReview(false)
    if (error) {
      if (error.code === '23505') alert('Você já avaliou.')
      else alert('Erro ao enviar avaliação: ' + error.message)
    } else {
      alert('Avaliação registrada com sucesso.')
      setReviewModalApp(null)
      fetchAllReviews()
    }
  }

  const renderPushPromptModal = () => {
    if (!showPushPromptModal || pushEnabled || activeRole !== 'worker') return null
    return (
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShowPushPromptModal(false)}
      >
        <div
          className="bg-[#111111] border border-lime-400/50 text-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-lime-400 text-black px-2.5 py-0.5 rounded-full">
                Aviso de Oportunidades
              </span>
              <h3 className="font-extrabold text-white text-lg mt-2">
                Receber alertas de turnos no raio de 20 km?
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPushPromptModal(false)}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center shrink-0"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Ative as notificações gratuitas agora para ser avisado no celular assim que uma empresa publicar um turno ou vaga perto de você.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowPushPromptModal(false)
                setShowInstallGuide(true)
              }}
              className="w-1/3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs py-3.5 rounded-xl border border-neutral-800 transition"
            >
              Agora não
            </button>
            <button
              type="button"
              disabled={pushLoading}
              onClick={async () => {
                await handleActivatePushNotifications()
                setShowInstallGuide(true)
              }}
              className="w-2/3 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.25)]"
            >
              {pushLoading ? 'Ativando...' : '🔔 Ativar Notificações'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderInstallGuideModal = () => {
    if (!showInstallGuide) return null
    return (
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShowInstallGuide(false)}
      >
        <div
          className="bg-[#111111] border border-lime-400/40 text-white rounded-3xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start gap-2 border-b border-neutral-800 pb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-lime-400 text-black px-2.5 py-0.5 rounded-full">
                Atalho no Celular
              </span>
              <h3 className="font-extrabold text-white text-lg mt-1.5">
                Adicione o TurnLevel na Tela Inicial
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              aria-label="Fechar guia"
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5 text-xs text-neutral-300">
            <div className="bg-[#050505] border border-neutral-800/90 rounded-2xl p-3.5 space-y-1">
              <p className="font-extrabold text-white">No Android (Chrome)</p>
              <p className="text-neutral-400">
                Toque nos <strong className="text-white">3 pontinhos (⋮)</strong> no canto superior e escolha <strong className="text-lime-400">Adicionar à tela inicial</strong> ou <strong className="text-lime-400">Instalar aplicativo</strong>.
              </p>
            </div>

            <div className="bg-[#050505] border border-neutral-800/90 rounded-2xl p-3.5 space-y-1">
              <p className="font-extrabold text-white">No iPhone (Safari)</p>
              <p className="text-neutral-400">
                Toque no botão de <strong className="text-white">Compartilhar</strong> e role até <strong className="text-lime-400">Adicionar à Tela de Início</strong>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowInstallGuide(false)}
            className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3.5 rounded-xl transition"
          >
            Entendi, ir para o app →
          </button>
        </div>
      </div>
    )
  }

  const renderLegalFooter = () => (
    <div className="text-center pb-2 pt-4 relative z-10 space-y-1">
      <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-400">
        <button
          type="button"
          onClick={() => setLegalModal('terms')}
          className="hover:text-lime-400 underline underline-offset-2 transition"
        >
          Termos de Uso
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setLegalModal('privacy')}
          className="hover:text-lime-400 underline underline-offset-2 transition"
        >
          Política de Privacidade
        </button>
      </div>
      <p className="text-[11px] text-neutral-500">TurnLevel © 2026 • Todos os direitos reservados</p>
    </div>
  )

  const renderLegalModal = () => {
    if (!legalModal) return null
    const isTerms = legalModal === 'terms'
    return (
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setLegalModal(null)}
      >
        <div
          className="bg-[#111111] border border-neutral-800 text-white rounded-3xl max-w-md w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
            <h3 className="font-extrabold text-white text-base">
              {isTerms ? 'Termos de Uso' : 'Política de Privacidade'}
            </h3>
            <button
              type="button"
              onClick={() => setLegalModal(null)}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {isTerms ? (
            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <p>
                O <strong className="text-white">TurnLevel</strong> conecta empresas com demanda de turnos pontuais e vagas de trabalho a profissionais disponíveis na região.
              </p>
              <p>
                A definição de valores, salários, horários, benefícios e condições operacionais é de responsabilidade direta das partes envolvidas.
              </p>
              <p>
                Ao usar a plataforma, você concorda em fornecer dados verdadeiros e manter conduta respeitosa nas candidaturas e avaliações após o serviço.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <p>
                Coletamos apenas informações necessárias para o funcionamento do <strong className="text-white">TurnLevel</strong>: dados de perfil, telefone/WhatsApp e localização (CEP, bairro, cidade, coordenadas e raio de deslocamento).
              </p>
              <p>
                A localização é utilizada para filtrar turnos e vagas próximas e viabilizar alertas na sua região (raio de até 20 km).
              </p>
              <p>
                Não vendemos seus dados pessoais a terceiros. Você pode atualizar seus dados na aba Perfil ou solicitar a exclusão da conta pelos canais oficiais.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setLegalModal(null)}
            className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3 rounded-xl transition"
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
        <style>{`
          @keyframes floatSlow {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-7px) rotate(2deg); }
          }
          @keyframes liquidBlob {
            0%, 100% { transform: translate(0px, 0px) scale(1); border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
            33% { transform: translate(25px, -30px) scale(1.1); border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
            66% { transform: translate(-20px, 20px) scale(0.95); border-radius: 50% 60% 30% 60% / 30% 40% 70% 60%; }
          }
          @keyframes marqueeScroll {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          .animate-float { animation: floatSlow 3.5s ease-in-out infinite; }
          .animate-liquid { animation: liquidBlob 10s ease-in-out infinite; }
          .animate-liquid-delay { animation: liquidBlob 13s ease-in-out infinite reverse; }
          .animate-marquee { display: flex; width: max-content; animation: marqueeScroll 18s linear infinite; }
        `}</style>

        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 bg-lime-400/15 blur-3xl animate-liquid" />
        <div className="pointer-events-none absolute top-1/2 -right-28 w-96 h-96 bg-lime-400/10 blur-3xl animate-liquid-delay" />

        <div className="max-w-md w-full mx-auto space-y-5 pt-3 relative z-10">
          <div className="text-center space-y-2">
            <TurnLevelLogo size="lg" animated={true} />
            <p className="text-xs text-neutral-400 font-medium">
              A ponte direta entre quem precisa trabalhar hoje e quem precisa contratar rápido.
            </p>
          </div>

          {authView === 'welcome' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-full bg-[#111111]/90 border border-neutral-800/80 py-2 px-1">
                <div className="animate-marquee gap-6 text-[11px] font-bold text-neutral-300">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Cadastro 100% Gratuito</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Turnos & Vagas Fixas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Avaliações Verificadas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Direto no WhatsApp</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Cadastro 100% Gratuito</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Turnos & Vagas Fixas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Avaliações Verificadas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Direto no WhatsApp</span>
                </div>
              </div>

              <div className="bg-[#111111]/90 backdrop-blur-md border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 bg-lime-400/15 text-lime-400 border border-lime-400/30 px-3 py-1 rounded-full">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Cadastro 100% Gratuito</span>
                  </div>
                  <h1 className="text-xl font-extrabold text-white pt-1 leading-snug">
                    Ganhe por turno trabalhado ou conquiste sua vaga fixa.
                  </h1>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Sem burocracia e sem taxas escondidas. Selecione seu perfil para criar sua conta grátis:
                  </p>
                </div>

                <div className="grid gap-3">
                  <button
                    onClick={() => { setRole('worker'); setAuthView('signup'); setSignupStep(1); setAuthError('') }}
                    className="w-full bg-[#050505] hover:bg-neutral-900 border border-neutral-800 hover:border-lime-400 p-4 rounded-2xl text-left transition-all duration-300 group flex items-center justify-between hover:shadow-[0_0_20px_rgba(163,230,53,0.15)]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-lime-400 text-black flex items-center justify-center font-extrabold group-hover:scale-105 transition-transform">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-5 h-5">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-extrabold text-white group-hover:text-lime-400 transition">Sou Trabalhador</div>
                        <div className="text-xs text-neutral-400">Busque turnos rápidos ou vagas fixas grátis</div>
                      </div>
                    </div>
                    <span className="text-lime-400 text-lg font-bold group-hover:translate-x-1 transition-transform">→</span>
                  </button>

                  <button
                    onClick={() => { setRole('company'); setAuthView('signup'); setSignupStep(1); setAuthError('') }}
                    className="w-full bg-[#050505] hover:bg-neutral-900 border border-neutral-800 hover:border-lime-400 p-4 rounded-2xl text-left transition-all duration-300 group flex items-center justify-between hover:shadow-[0_0_20px_rgba(163,230,53,0.15)]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center font-extrabold group-hover:scale-105 transition-transform">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-5 h-5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-extrabold text-white group-hover:text-lime-400 transition">Sou Empresa</div>
                        <div className="text-xs text-neutral-400">Publique turnos ou vagas de contratação</div>
                      </div>
                    </div>
                    <span className="text-lime-400 text-lg font-bold group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 text-center">
                  <button
                    onClick={() => { setAuthView('login'); setAuthError(''); setResetMessage('') }}
                    className="text-xs text-neutral-400 hover:text-white transition"
                  >
                    Já tem cadastro? <span className="text-lime-400 font-extrabold underline">Entrar na conta</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#111111]/85 backdrop-blur-sm border border-neutral-800/90 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-neutral-300">Como funciona na prática</h2>
                  <div className="flex bg-[#050505] p-1 rounded-xl border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setHowItWorksTab('worker')}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${howItWorksTab === 'worker' ? 'bg-lime-400 text-black' : 'text-neutral-400'}`}
                    >
                      Trabalhador
                    </button>
                    <button
                      type="button"
                      onClick={() => setHowItWorksTab('company')}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${howItWorksTab === 'company' ? 'bg-lime-400 text-black' : 'text-neutral-400'}`}
                    >
                      Empresa
                    </button>
                  </div>
                </div>

                {howItWorksTab === 'worker' ? (
                  <div className="space-y-2.5 text-xs text-neutral-300">
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-lime-400 text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <p><strong>Crie seu perfil grátis</strong> com suas habilidades, bairro e raio de deslocamento.</p>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-lime-400 text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <p><strong>Escolha entre Turnos ou Vagas:</strong> abas separadas para diárias rápidas ou empregos fixos.</p>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-lime-400 text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <p><strong>Trabalhe e construa reputação:</strong> ao ser aceito, combine direto pelo WhatsApp e receba avaliações.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs text-neutral-300">
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <p><strong>Publique Turno ou Vaga:</strong> escolha se precisa cobrir um turno específico ou contratar para vaga fixa.</p>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <p><strong>Analise o histórico dos candidatos:</strong> veja quantos turnos já concluíram e as avaliações de outras empresas.</p>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <p><strong>Aprove e conecte-se no WhatsApp:</strong> combine início, entrevista ou encerramento direto pelo app.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {authView === 'verify_email' && (
            <div className="bg-[#111111]/95 backdrop-blur-md border border-lime-400/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/15 border border-lime-400 text-lime-400 flex items-center justify-center mx-auto text-sm font-extrabold">
                OK
              </div>
              <h2 className="text-lg font-extrabold text-white">Confirme seu e-mail</h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Enviamos um link de ativação para <strong className="text-lime-400">{email}</strong>. Abra sua caixa de entrada ou spam e clique no link para liberar seu acesso.
              </p>
              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition"
              >
                Já confirmei, ir para Login →
              </button>
            </div>
          )}

          {authView === 'login' && (
            <div className="bg-[#111111]/95 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 shadow-2xl">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-bold text-white">Entrar na conta</h2>
                  <button type="button" onClick={() => setAuthView('welcome')} className="text-xs text-neutral-400 hover:text-white">← Voltar</button>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3.5 py-3 text-sm text-white transition" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs text-neutral-400">Senha</label>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-[11px] text-lime-400 hover:underline font-semibold"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3.5 py-3 text-sm text-white transition" />
                </div>

                {authError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{authError}</p>}
                {resetMessage && <p className="text-xs text-lime-400 bg-lime-400/10 border border-lime-400/30 p-3 rounded-xl">{resetMessage}</p>}

                <button type="submit" disabled={authLoading} className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.25)]">
                  {authLoading ? 'A entrar...' : 'Entrar'}
                </button>

                <button type="button" onClick={() => { setAuthView('welcome'); setAuthError(''); setResetMessage('') }} className="w-full text-center text-xs text-neutral-400 hover:text-white pt-2">
                  Ainda não tem conta? <span className="text-lime-400 font-semibold">Criar cadastro grátis</span>
                </button>
              </form>
            </div>
          )}

          {authView === 'signup' && (
            <div className="bg-[#111111]/95 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-white">Cadastro Grátis ({role === 'company' ? 'Empresa' : 'Trabalhador'})</h2>
                  <p className="text-[11px] text-neutral-400">Etapa {signupStep} de 3</p>
                </div>
                <button type="button" onClick={() => setAuthView('welcome')} className="text-xs text-neutral-400 hover:text-white">Cancelar</button>
              </div>

              <div className="flex items-center justify-between mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${signupStep >= step ? 'bg-lime-400 text-black' : 'bg-neutral-800 text-neutral-400'}`}>
                      {step}
                    </div>
                    {step < 3 && <div className={`h-0.5 flex-1 mx-2 ${signupStep > step ? 'bg-lime-400' : 'bg-neutral-800'}`} />}
                  </div>
                ))}
              </div>

              {signupStep === 1 && (
                <form onSubmit={(e) => { e.preventDefault(); setAuthError(''); setSignupStep(2) }} className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Email de acesso</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3.5 py-3 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Senha (mín. 6 dígitos)</label>
                    <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3.5 py-3 text-sm text-white" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setAuthView('welcome')} className="w-1/3 bg-neutral-800 text-neutral-300 text-sm py-3 rounded-xl">← Voltar</button>
                    <button type="submit" className="w-2/3 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3 rounded-xl">Próxima Etapa →</button>
                  </div>
                </form>
              )}

              {signupStep === 2 && (
                <form onSubmit={handleAdvanceFromStep2} className="space-y-3">
                  <div className="flex items-center gap-4 bg-[#050505] p-4 rounded-2xl border border-neutral-800">
                    <div className="relative group cursor-pointer">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-14 h-14 rounded-full object-cover border-2 border-lime-400 shadow-md" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 border border-neutral-700 font-bold">Foto</div>
                      )}
                      <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer text-[10px] text-lime-400 font-extrabold text-center px-1">
                        Alterar
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="hidden" />
                      </label>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white mb-0.5">{role === 'company' ? 'Logotipo da Empresa' : 'Sua Foto de Perfil'}</p>
                      <label className="inline-block text-xs font-extrabold text-lime-400 cursor-pointer hover:underline">
                        Toque para selecionar imagem...
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{role === 'company' ? 'Nome da Empresa' : 'Nome Completo'}</label>
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                  </div>

                  {role === 'company' ? (
                    <>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">CNPJ Válido</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="00.000.000/0001-00"
                          value={cnpj}
                          onChange={(e) => { setCnpj(formatCnpjMask(e.target.value)); setAuthError('') }}
                          className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Telefone / WhatsApp</label>
                        <div className="flex gap-2">
                          <select value={phoneDdd} onChange={(e) => setPhoneDdd(e.target.value)} className="w-24 bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-sm text-white">
                            {BRAZIL_DDDS.map((d) => <option key={d} value={d}>DDD {d}</option>)}
                          </select>
                          <input type="tel" inputMode="numeric" required placeholder="99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Sobre a empresa</label>
                        <textarea rows={2} required placeholder="Ramo de atuação, ambiente..." value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs text-neutral-400 mb-1">CPF</label>
                          <input type="text" inputMode="numeric" required placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Idade</label>
                          <select value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-sm text-white">
                            {AGE_OPTIONS.map((num) => <option key={num} value={num}>{num} anos</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Telefone / WhatsApp</label>
                        <div className="flex gap-2">
                          <select value={phoneDdd} onChange={(e) => setPhoneDdd(e.target.value)} className="w-24 bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-sm text-white">
                            {BRAZIL_DDDS.map((d) => <option key={d} value={d}>DDD {d}</option>)}
                          </select>
                          <input type="tel" inputMode="numeric" required placeholder="99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1.5">Habilidades principais</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {SKILL_OPTIONS.map((skill) => {
                            const active = selectedSkills.includes(skill)
                            return (
                              <button type="button" key={skill} onClick={() => toggleSkill(skill)} className={`text-[11px] px-2.5 py-1 rounded-full border transition ${active ? 'bg-lime-400 border-lime-400 text-black font-extrabold' : 'bg-[#050505] border-neutral-800 text-neutral-400'}`}>
                                {active ? '✓ ' : '+ '}{skill}
                              </button>
                            )
                          })}
                        </div>
                        <input type="text" placeholder="Outra habilidade..." value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2 text-xs text-white" />
                      </div>
                    </>
                  )}

                  {authError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">{authError}</p>}

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => { setAuthError(''); setSignupStep(1) }} className="w-1/3 bg-neutral-800 text-neutral-300 text-sm py-3 rounded-xl">← Voltar</button>
                    <button type="submit" className="w-2/3 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3 rounded-xl">Próxima →</button>
                  </div>
                </form>
              )}

              {signupStep === 3 && (
                <form onSubmit={handleCompleteSignup} className="space-y-3">
                  <h3 className="text-sm font-bold text-white">Localização e Proximidade</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" inputMode="numeric" required placeholder="CEP" maxLength={9} value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                    <input type="text" required placeholder="UF" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} className="bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" required placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                    <input type="text" required placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                  </div>
                  <input type="text" required placeholder="Rua / Número" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />

                  {role === 'worker' && (
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Raio de deslocamento</label>
                      <select value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                        <option value="Até 5 km (Mesmo bairro)">Até 5 km (Mesmo bairro)</option>
                        <option value="Até 10 km">Até 10 km</option>
                        <option value="Até 20 km">Até 20 km</option>
                        <option value="Toda a cidade">Toda a cidade</option>
                      </select>
                    </div>
                  )}

                  {authError && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-xl">{authError}</p>}

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setSignupStep(2)} className="w-1/3 bg-neutral-800 text-neutral-300 text-sm py-3 rounded-xl">← Voltar</button>
                    <button type="submit" disabled={authLoading} className="w-2/3 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3 rounded-xl shadow-lg">
                      {authLoading ? 'A concluir...' : 'Concluir Cadastro ✓'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {renderLegalFooter()}
        {renderLegalModal()}
      </div>
    )
  }

  const myReputation = getReputationStats(session.user.id)
  const myCompletedCount = applications.filter((a) => a.status === 'accepted' && (a.company_confirmed_end || a.worker_confirmed_end)).length

  const isJobsTab = activeTab === 'jobs'
  const filteredListings = shifts.filter((item) => {
    const itemType = item.post_type || 'shift'
    return isJobsTab ? itemType === 'job' : itemType !== 'job'
  })

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <header className="bg-[#050505]/90 backdrop-blur-md border-b border-neutral-900 sticky top-0 z-10 px-4 py-3.5">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
          <TurnLevelLogo size="md" />

          {isMasterTester && (
            <div className="flex items-center bg-[#111111] border border-lime-400/40 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => handleSwitchMasterRole('company')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                  activeRole === 'company' ? 'bg-lime-400 text-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                Teste Empresa
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMasterRole('worker')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                  activeRole === 'worker' ? 'bg-lime-400 text-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                Teste Trabalhador
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight">{profile?.full_name || fullName}</p>
              <p className="text-[11px] text-lime-400 font-medium">
                {myReputation.avg ? `★ ${myReputation.avg} • ` : ''}
                {profile?.city || city || 'Sem cidade'}
              </p>
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border-2 border-lime-400" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-neutral-900 border border-lime-400/50 text-lime-400 flex items-center justify-center font-extrabold text-xs">
                {(profile?.full_name || fullName || 'T')[0].toUpperCase()}
              </div>
            )}
            <button onClick={() => supabase.auth.signOut()} className="text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-3 py-1.5 rounded-xl transition">
              Sair
            </button>
          </div>
        </div>
      </header>

      {isMasterTester && (
        <div className="bg-lime-400/10 border-b border-lime-400/25 px-4 py-1.5 text-center text-[11px] font-bold text-lime-400">
          Conta Mestra Ativa • Visualizando como: {activeRole === 'company' ? 'EMPRESA' : 'TRABALHADOR'}
        </div>
      )}

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {loadingProfile ? (
          <p className="text-sm text-neutral-400 text-center py-10">A carregar dados...</p>
        ) : (
          <>
            {activeRole === 'worker' && !pushEnabled && (
              <div className="bg-[#111111] border border-lime-400/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-white">Alertas de turnos no raio de 20 km</p>
                  <p className="text-[11px] text-neutral-400">Ative para ser avisado assim que surgir vaga perto de você.</p>
                </div>
                <button
                  type="button"
                  onClick={handleActivatePushNotifications}
                  disabled={pushLoading}
                  className="bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition shrink-0"
                >
                  {pushLoading ? 'Ativando...' : '🔔 Ativar'}
                </button>
              </div>
            )}

            {(activeTab === 'shifts' || activeTab === 'jobs') && (
              <div className="space-y-6">
                {activeRole === 'company' && (
                  <section className="bg-[#111111] border border-neutral-800 rounded-3xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-white">O que deseja publicar?</h2>
                        <p className="text-[11px] text-neutral-400">Escolha entre turno pontual ou vaga de trabalho</p>
                      </div>

                      <div className="grid grid-cols-2 bg-[#050505] p-1 rounded-2xl border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setPublishType('shift')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                            publishType === 'shift'
                              ? 'bg-lime-400 text-black shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Contratar Turno
                        </button>
                        <button
                          type="button"
                          onClick={() => setPublishType('job')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                            publishType === 'job'
                              ? 'bg-lime-400 text-black shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Publicar Vaga
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleCreateShift} className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">
                          {publishType === 'job' ? 'Cargo / Vaga Disponível' : 'Função / Cargo do Turno'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={publishType === 'job' ? 'Ex: Atendente / Cozinheiro(a)' : 'Ex: Garçom / Entregador'}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Quantidade de Vagas</label>
                        <select value={vacancies} onChange={(e) => setVacancies(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                          {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((v) => <option key={v} value={v}>{v} {v === 1 ? 'vaga' : 'vagas'}</option>)}
                        </select>
                      </div>

                      {publishType === 'job' ? (
                        <>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Tipo de Contratação</label>
                            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                              <option value="CLT / Efetivo">CLT / Efetivo</option>
                              <option value="Temporário">Temporário</option>
                              <option value="Período de Experiência">Período de Experiência</option>
                              <option value="PJ / Prestador">PJ / Prestador</option>
                              <option value="A combinar">A combinar</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Escala de Trabalho</label>
                            <select value={workSchedule} onChange={(e) => setWorkSchedule(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                              <option value="Segunda a Sexta">Segunda a Sexta</option>
                              <option value="Segunda a Sábado">Segunda a Sábado</option>
                              <option value="Escala 6x1">Escala 6x1</option>
                              <option value="Escala 5x2">Escala 5x2</option>
                              <option value="Escala 12x36">Escala 12x36</option>
                              <option value="Finais de Semana">Finais de Semana</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Horário de Trabalho</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              required
                              placeholder="09:00 às 17:00"
                              value={shiftHours}
                              onChange={(e) => setShiftHours(formatShiftHoursMask(e.target.value))}
                              className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Salário / Remuneração (R$)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                required
                                placeholder="2000 ou 2000,00"
                                value={payRate}
                                onChange={(e) => setPayRate(e.target.value)}
                                className="flex-1 bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                              />
                              <select
                                value={salaryPeriod}
                                onChange={(e) => setSalaryPeriod(e.target.value)}
                                className="w-28 bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-xs font-bold text-white"
                              >
                                <option value="/ mês">/ mês</option>
                                <option value="/ quinzena">/ quinzena</option>
                                <option value="/ semana">/ semana</option>
                                <option value="/ dia">/ dia</option>
                              </select>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Carga Horária</label>
                            <select value={workload} onChange={(e) => setWorkload(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                              <option value="4 horas">4 horas</option>
                              <option value="6 horas">6 horas</option>
                              <option value="8 horas">8 horas</option>
                              <option value="10 horas">10 horas</option>
                              <option value="12 horas (Plantão)">12 horas (Plantão)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Horário do Turno</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              required
                              placeholder="18:00 às 00:00"
                              value={shiftHours}
                              onChange={(e) => setShiftHours(formatShiftHoursMask(e.target.value))}
                              className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Valor do Turno (R$)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              required
                              placeholder="120 ou 120,00"
                              value={payRate}
                              onChange={(e) => setPayRate(e.target.value)}
                              className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Data do Turno</label>
                            <input type="datetime-local" required value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Transporte</label>
                        <select value={transportInfo} onChange={(e) => setTransportInfo(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                          <option value="Vale-transporte pago">Vale-transporte pago</option>
                          <option value="Ajuda de custo transporte">Ajuda de custo transporte</option>
                          <option value="Não fornece transporte">Não fornece transporte</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Alimentação</label>
                        <select value={mealInfo} onChange={(e) => setMealInfo(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                          <option value="Alimentação no local">Alimentação no local</option>
                          <option value="Vale-refeição pago">Vale-refeição pago</option>
                          <option value="Não fornece alimentação">Não fornece alimentação</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-neutral-400 mb-1">Exigência de Veículo (Moto ou Carro)</label>
                        <select value={vehicleRequired} onChange={(e) => setVehicleRequired(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white">
                          <option value="Não exige veículo">Não exige veículo</option>
                          <option value="Moto própria obrigatória">Moto própria obrigatória</option>
                          <option value="Carro próprio obrigatório">Carro próprio obrigatório</option>
                          <option value="Moto ou Carro próprio">Moto ou Carro próprio</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Bairro / Setor</label>
                        <input type="text" required placeholder="Setor Bueno" value={shiftNeighborhood} onChange={(e) => setShiftNeighborhood(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Rua e Número</label>
                        <input type="text" required placeholder="Rua T-30, nº 120" value={shiftStreet} onChange={(e) => setShiftStreet(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-neutral-400 mb-1">
                          {publishType === 'job' ? 'Requisitos, Experiência e Benefícios da Vaga' : 'Exigências / Observações'}
                        </label>
                        <input
                          type="text"
                          required={publishType === 'job'}
                          placeholder={publishType === 'job' ? 'Ex: Experiência na função, ensino médio, disponibilidade...' : 'Calça preta, CNH em dia...'}
                          value={requirements}
                          onChange={(e) => setRequirements(e.target.value)}
                          className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                        />
                      </div>

                      <button type="submit" className="sm:col-span-2 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.2)]">
                        {publishType === 'job' ? '+ Publicar Vaga de Trabalho' : '+ Publicar Turno Agora'}
                      </button>
                    </form>
                  </section>
                )}

                <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex-1 min-w-[160px] flex items-center gap-2 bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0" />
                      <input
                        type="text"
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        placeholder={isJobsTab ? 'Filtrar vagas por cidade ou bairro...' : 'Filtrar turnos por cidade ou bairro...'}
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
                      />
                    </div>
                    {!isJobsTab && (
                      <select
                        value={dayFilter}
                        onChange={(e) => {
                          setDayFilter(e.target.value)
                          fetchShifts(cityFilter, e.target.value)
                        }}
                        className="bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-lime-400"
                      >
                        {WEEK_DAYS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fetchShifts(cityFilter, dayFilter)} className="flex-1 bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-2.5 rounded-xl transition">
                      {isJobsTab ? 'Buscar Vagas' : 'Buscar Turnos'}
                    </button>
                    <button onClick={() => { setCityFilter(''); setDayFilter(''); fetchShifts('', '') }} className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium px-4 py-2.5 rounded-xl border border-neutral-800 transition">
                      Limpar
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">
                      {isJobsTab ? 'Vagas de Trabalho Disponíveis' : 'Turnos Disponíveis'}
                    </h2>
                    <span className="text-xs font-bold bg-neutral-900 text-lime-400 border border-neutral-800 px-2.5 py-1 rounded-full">
                      {filteredListings.length} {filteredListings.length === 1 ? 'opção' : 'opções'}
                    </span>
                  </div>

                  {loadingShifts ? (
                    <p className="text-sm text-neutral-400">
                      {isJobsTab ? 'A procurar vagas...' : 'A procurar turnos...'}
                    </p>
                  ) : filteredListings.length === 0 ? (
                    <div className="bg-[#111111] border border-dashed border-neutral-800 rounded-3xl p-8 text-center">
                      <p className="text-sm text-neutral-400">
                        {isJobsTab
                          ? 'Nenhuma vaga de contratação encontrada com esses filtros.'
                          : 'Nenhum turno encontrado com esses filtros.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {filteredListings.map((shift) => {
                        const applied = applications.some((a) => a.shift_id === shift.id)
                        const compRep = getReputationStats(shift.company?.id)
                        const hasVehicleReq = shift.vehicle_required && shift.vehicle_required !== 'Não exige veículo'
                        const itemIsJob = (shift.post_type || 'shift') === 'job'

                        return (
                          <div
                            key={shift.id}
                            onClick={() => setSelectedShiftModal(shift)}
                            className="bg-white text-black hover:scale-[1.01] cursor-pointer rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                                  {itemIsJob
                                    ? `${shift.employment_type || 'Contratação'} • ${shift.work_schedule || shift.workload || 'Escala a combinar'}`
                                    : `${new Date(shift.shift_date).toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()} • ${shift.workload || '6 horas'}`}
                                </span>
                                {hasVehicleReq && (
                                  <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                                    {shift.vehicle_required}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-extrabold text-black text-xl leading-tight">{shift.title}</h3>

                              <div className="mt-1.5 flex items-baseline gap-1">
                                <span className="text-2xl font-black text-[#4d7c0f] tracking-tight">
                                  R$ {formatCurrencyBRL(shift.pay_rate)}
                                </span>
                                <span className="text-xs font-semibold text-neutral-500">
                                  {itemIsJob ? (shift.salary_period || '/ mês') : '/ turno'}
                                </span>
                              </div>

                              <div className="mt-4 pt-3 border-t border-neutral-200 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {shift.company?.avatar_url ? (
                                      <img src={shift.company.avatar_url} alt="Logo" className="w-6 h-6 rounded-full object-cover border border-neutral-300" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-black text-lime-400 flex items-center justify-center text-[10px] font-bold">
                                        {(shift.company?.full_name || 'E')[0]}
                                      </div>
                                    )}
                                    <p className="text-xs font-bold text-neutral-800">{shift.company?.full_name || 'Empresa'}</p>
                                  </div>
                                  <span className="text-[11px] font-extrabold text-amber-600">
                                    {compRep.avg ? `★ ${compRep.avg} (${compRep.count})` : 'Nova empresa'}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium">Local: {shift.location}</p>
                                {itemIsJob ? (
                                  <p className="text-xs text-neutral-500">
                                    Horário: {shift.shift_hours || 'A combinar'} • {shift.vacancies || 1} {Number(shift.vacancies || 1) === 1 ? 'vaga' : 'vagas'}
                                  </p>
                                ) : (
                                  <p className="text-xs text-neutral-500">
                                    Data: {new Date(shift.shift_date).toLocaleDateString('pt-BR')} {shift.shift_hours ? `• ${shift.shift_hours}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="pt-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                              {activeRole === 'worker' ? (
                                shift.status !== 'open' ? (
                                  <div className="w-full text-center text-xs font-bold bg-neutral-200 text-neutral-600 py-3 rounded-2xl">
                                    Vaga Preenchida
                                  </div>
                                ) : applied ? (
                                  <div className="w-full text-center text-xs font-extrabold bg-black text-lime-400 py-3 rounded-2xl">
                                    Candidatura Enviada ✓
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setSelectedShiftModal(shift)}
                                    className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-2xl transition shadow-sm"
                                  >
                                    {itemIsJob ? 'Ver Vaga e Candidatar' : 'Ver Detalhes e Candidatar'}
                                  </button>
                                )
                              ) : shift.company_id === session.user.id ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditShift(shift)}
                                    className="flex-1 bg-black hover:bg-neutral-800 text-lime-400 text-xs font-extrabold py-2.5 rounded-2xl transition"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteShift(shift.id)}
                                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-extrabold py-2.5 rounded-2xl transition"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              ) : (
                                <div className="w-full text-center text-xs font-bold bg-black text-white py-2.5 rounded-2xl">
                                  Status: {shift.status === 'open' ? 'Aberto' : 'Preenchido'}
                                </div>
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
                <h2 className="text-lg font-bold text-white">
                  {activeRole === 'company' ? 'Candidatos & Turnos Ativos' : 'Minhas Candidaturas'}
                </h2>
                {applications.length === 0 ? (
                  <div className="bg-[#111111] border border-dashed border-neutral-800 rounded-3xl p-8 text-center">
                    <p className="text-sm text-neutral-400">Sem registos no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => {
                      const isAccepted = app.status === 'accepted'
                      const isCompany = activeRole === 'company'
                      const companyPhone = app.shift?.company?.phone_ddd && app.shift?.company?.phone ? `55${app.shift.company.phone_ddd}${app.shift.company.phone.replace(/\D/g, '')}` : ''
                      const workerPhone = app.worker?.phone_ddd && app.worker?.phone ? `55${app.worker.phone_ddd}${app.worker.phone.replace(/\D/g, '')}` : ''
                      const workerRep = app.worker ? getReputationStats(app.worker.id) : { avg: null, count: 0 }
                      const alreadyReviewed = allReviews.some((r) => r.application_id === app.id && r.reviewer_id === session.user.id)
                      const appIsJob = (app.shift?.post_type || 'shift') === 'job'

                      return (
                        <div
                          key={app.id}
                          onClick={() => {
                            if (isCompany && app.worker) {
                              setSelectedWorkerModal(app)
                            }
                          }}
                          className={`bg-white text-black rounded-3xl p-5 space-y-3 shadow-lg ${isCompany ? 'cursor-pointer hover:scale-[1.01] transition' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-xs font-extrabold text-[#4d7c0f] uppercase tracking-wide">
                                {appIsJob ? 'VAGA • ' : 'TURNO • '}
                                {app.shift?.title} • R$ {formatCurrencyBRL(app.shift?.pay_rate || 0)}
                              </span>
                              {isCompany ? (
                                <div className="flex items-center gap-3 mt-2.5">
                                  {app.worker?.avatar_url ? (
                                    <img src={app.worker.avatar_url} alt="Foto" className="w-12 h-12 rounded-full object-cover border-2 border-black" />
                                  ) : (
                                    <div className="w-12 h-12 rounded-full bg-black text-lime-400 flex items-center justify-center text-sm font-extrabold">
                                      {(app.worker?.full_name || 'T')[0]}
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="font-extrabold text-black text-base">
                                      {app.worker?.full_name} {app.worker?.age ? `(${app.worker.age} anos)` : ''}
                                    </h3>
                                    <p className="text-xs font-extrabold text-amber-600">
                                      {workerRep.avg ? `★ ${workerRep.avg} (${workerRep.count} avaliações)` : 'Novo no TurnLevel'}
                                    </p>
                                    <p className="text-xs text-neutral-600 font-medium">{app.worker?.neighborhood}, {app.worker?.city}</p>
                                    <p className="text-[11px] text-neutral-500 underline mt-0.5">Toque para ver histórico e ficha</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1.5">
                                  <h3 className="font-extrabold text-black text-base">{app.shift?.company?.full_name}</h3>
                                  <p className="text-xs text-neutral-600 font-medium">{app.shift?.location}</p>
                                </div>
                              )}
                            </div>

                            <span className={`text-xs px-3 py-1 rounded-full font-extrabold shrink-0 ${isAccepted ? 'bg-black text-lime-400' : app.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-neutral-200 text-neutral-800'}`}>
                              {isAccepted ? 'Aceito ✓' : app.status === 'rejected' ? 'Recusado' : 'Pendente'}
                            </span>
                          </div>

                          {isAccepted && (
                            <div className="pt-2 space-y-2 border-t border-neutral-200" onClick={(e) => e.stopPropagation()}>
                              {isCompany && workerPhone ? (
                                <a
                                  href={`https://wa.me/${workerPhone}?text=Olá%20${encodeURIComponent(app.worker?.full_name || '')},%20sua%20candidatura%20para%20${encodeURIComponent(app.shift?.title || '')}%20foi%20aceita%20no%20TurnLevel.%20Vamos%20alinhar%20os%20detalhes?`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-3 rounded-2xl transition shadow-sm"
                                >
                                  Chamar Trabalhador no WhatsApp
                                </a>
                              ) : !isCompany && companyPhone ? (
                                <a
                                  href={`https://wa.me/${companyPhone}?text=Olá,%20fui%20aceito(a)%20para%20${encodeURIComponent(app.shift?.title || '')}%20pela%20empresa%20${encodeURIComponent(app.shift?.company?.full_name || '')}%20no%20TurnLevel.`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-3 rounded-2xl transition shadow-sm"
                                >
                                  Falar com a Empresa no WhatsApp
                                </a>
                              ) : null}

                              {alreadyReviewed ? (
                                <div className="w-full text-center text-xs font-bold bg-neutral-100 text-neutral-700 py-2.5 rounded-2xl">
                                  ✓ Confirmado e avaliação enviada
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleConfirmShiftEndAndOpenReview(app)}
                                    className="w-full bg-black hover:bg-neutral-800 text-lime-400 text-xs font-extrabold py-3 rounded-2xl transition"
                                  >
                                    ★ Confirmar e Avaliar
                                  </button>
                                  {(isCompany ? workerPhone : companyPhone) && (
                                    <a
                                      href={`https://wa.me/${isCompany ? workerPhone : companyPhone}?text=${encodeURIComponent(
                                        isCompany
                                          ? `Olá ${app.worker?.full_name || ''}! Confirmamos sua participação em ${app.shift?.title || ''} pelo TurnLevel. Acesse o app para deixar sua avaliação.`
                                          : `Olá ${app.shift?.company?.full_name || ''}! Já confirmei no app TurnLevel referente a ${app.shift?.title || ''}.`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-1.5 w-full bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-bold py-3 rounded-2xl transition"
                                    >
                                      Notificar no WhatsApp
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {isCompany && app.status === 'pending' && (
                            <div className="flex gap-2 pt-2 border-t border-neutral-200" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleApplicationStatus(app.id, app.shift.id, 'accepted')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-3 rounded-2xl">
                                Aceitar ✓
                              </button>
                              <button onClick={() => handleApplicationStatus(app.id, app.shift.id, 'rejected')} className="flex-1 bg-neutral-200 hover:bg-red-100 hover:text-red-700 text-neutral-700 text-xs font-bold py-3 rounded-2xl">
                                Recusar
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <section className="bg-[#111111] border border-neutral-800 rounded-3xl p-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">Atalho na Tela Inicial</h2>
                    <p className="text-xs text-neutral-400">Veja como fixar o TurnLevel na tela do celular.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstallGuide(true)}
                    className="bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition shrink-0"
                  >
                    Ver Guia
                  </button>
                </section>

                {activeRole === 'worker' && (
                  <section className="bg-[#111111] border border-lime-400/30 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-white">Alertas de Vagas e Turnos (Raio de 20 km)</h2>
                        <p className="text-xs text-neutral-400">
                          Receba notificações gratuitas no aparelho quando novas oportunidades surgirem perto de você.
                        </p>
                      </div>
                      <span className="text-[10px] font-extrabold bg-lime-400/15 text-lime-400 border border-lime-400/30 px-2.5 py-1 rounded-full shrink-0">
                        {pushEnabled ? 'Ativo' : 'Grátis'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleActivatePushNotifications}
                      disabled={pushLoading}
                      className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.2)]"
                    >
                      {pushLoading
                        ? 'Ativando notificações...'
                        : pushEnabled
                          ? '🔔 Testar / Reativar Notificação no Celular'
                          : '🔔 Ativar Notificações (20 km)'}
                    </button>

                    {pushStatus && (
                      <p className="text-xs font-semibold text-lime-400">{pushStatus}</p>
                    )}
                  </section>
                )}

                <section className="bg-[#111111] border border-neutral-800 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Meu Histórico & Avaliações</h2>
                    <span className="text-xs font-extrabold bg-lime-400 text-black px-3 py-1 rounded-full">
                      {myReputation.avg ? `★ ${myReputation.avg}` : 'Sem notas'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#050505] border border-neutral-800 p-3.5 rounded-2xl">
                      <span className="text-[11px] text-neutral-400 block">Concluídos</span>
                      <span className="text-xl font-black text-white">{Math.max(myCompletedCount, myReputation.count)}</span>
                    </div>
                    <div className="bg-[#050505] border border-neutral-800 p-3.5 rounded-2xl">
                      <span className="text-[11px] text-neutral-400 block">Avaliações Recebidas</span>
                      <span className="text-xl font-black text-lime-400">{myReputation.count}</span>
                    </div>
                  </div>

                  {myReputation.reviews.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-neutral-400 font-semibold">Últimos comentários recebidos:</p>
                      {myReputation.reviews.slice(0, 3).map((rev) => (
                        <div key={rev.id} className="bg-[#050505] border border-neutral-800/80 p-3 rounded-2xl text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">{rev.reviewer?.full_name || 'Usuário'}</span>
                            <span className="text-lime-400 font-extrabold">{'★'.repeat(rev.rating)}</span>
                          </div>
                          {rev.comment && <p className="text-neutral-400">"{rev.comment}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-[#111111] border border-neutral-800 rounded-3xl p-5 space-y-5">
                  <h2 className="text-lg font-bold text-white">Meus Dados Cadastrais</h2>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="flex items-center gap-4 bg-[#050505] p-4 rounded-2xl border border-neutral-800">
                      <div className="relative group cursor-pointer">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-lime-400 shadow-md" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 border border-neutral-700 font-bold">Foto</div>
                        )}
                        <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer text-[10px] text-lime-400 font-extrabold text-center px-1">
                          Alterar
                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="hidden" />
                        </label>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white mb-0.5">Foto de Perfil / Logotipo</p>
                        <label className="inline-block text-xs font-extrabold text-lime-400 cursor-pointer hover:underline">
                          Toque aqui para alterar imagem...
                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} className="hidden" />
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Nome</label>
                        <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Telefone</label>
                        <div className="flex gap-2">
                          <select value={phoneDdd} onChange={(e) => setPhoneDdd(e.target.value)} className="w-24 bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-sm text-white">
                            {BRAZIL_DDDS.map((d) => <option key={d} value={d}>DDD {d}</option>)}
                          </select>
                          <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                        </div>
                      </div>
                      {activeRole === 'company' ? (
                        <>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">CNPJ Válido</label>
                            <input type="text" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(formatCnpjMask(e.target.value))} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                          </div>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Setor</label>
                            <input type="text" value={sector} onChange={(e) => setSector(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-neutral-400 mb-1">Sobre a empresa</label>
                            <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">CPF</label>
                            <input type="text" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                          </div>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">Idade</label>
                            <select value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-sm text-white">
                              {AGE_OPTIONS.map((num) => <option key={num} value={num}>{num} anos</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-neutral-400 mb-1">Distância máxima</label>
                            <select value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                              <option value="Até 5 km (Mesmo bairro)">Até 5 km (Mesmo bairro)</option>
                              <option value="Até 10 km">Até 10 km</option>
                              <option value="Até 20 km">Até 20 km</option>
                              <option value="Toda a cidade">Toda a cidade</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-neutral-400 mb-1.5">Habilidades</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {SKILL_OPTIONS.map((skill) => {
                                const active = selectedSkills.includes(skill)
                                return (
                                  <button type="button" key={skill} onClick={() => toggleSkill(skill)} className={`text-[11px] px-2.5 py-1 rounded-full border transition ${active ? 'bg-lime-400 border-lime-400 text-black font-bold' : 'bg-[#050505] border-neutral-800 text-neutral-400'}`}>
                                    {active ? '✓ ' : '+ '}{skill}
                                  </button>
                                )
                              })}
                            </div>
                            <input type="text" placeholder="Outras..." value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2 text-xs text-white" />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">CEP</label>
                        <input type="text" inputMode="numeric" value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Estado (UF)</label>
                        <input type="text" value={stateUf} onChange={(e) => setStateUf(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Cidade</label>
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Bairro</label>
                        <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-neutral-400 mb-1">Endereço</label>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                    </div>

                    <button type="submit" disabled={authLoading} className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.2)]">
                      {authLoading ? 'A guardar...' : 'Salvar Alterações'}
                    </button>
                  </form>
                </section>

                {renderLegalFooter()}
              </div>
            )}
          </>
        )}
      </main>

      {selectedShiftModal && (() => {
        const compRep = getReputationStats(selectedShiftModal.company?.id)
        const modalIsJob = (selectedShiftModal.post_type || 'shift') === 'job'
        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedShiftModal(null)}>
            <div className="bg-white text-black rounded-3xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {selectedShiftModal.company?.avatar_url ? (
                    <img src={selectedShiftModal.company.avatar_url} alt="Empresa" className="w-12 h-12 rounded-full object-cover border-2 border-black" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-black text-lime-400 flex items-center justify-center font-extrabold">
                      {(selectedShiftModal.company?.full_name || 'E')[0]}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-black text-base">{selectedShiftModal.company?.full_name || 'Empresa'}</h3>
                    <p className="text-xs font-extrabold text-amber-600">
                      {compRep.avg ? `★ ${compRep.avg} • ${compRep.count} avaliações` : 'Empresa recém-cadastrada'}
                    </p>
                    <p className="text-xs text-neutral-500">CNPJ: {maskDocument(selectedShiftModal.company?.cnpj, 'cnpj')}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedShiftModal(null)} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-black font-bold flex items-center justify-center">✕</button>
              </div>

              {selectedShiftModal.company?.bio && (
                <div className="bg-neutral-100 p-3.5 rounded-2xl">
                  <p className="text-[11px] text-neutral-500 font-bold uppercase mb-1">Sobre a empresa</p>
                  <p className="text-xs text-neutral-800">{selectedShiftModal.company.bio}</p>
                </div>
              )}

              {compRep.reviews.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1.5">
                  <p className="text-[11px] font-extrabold text-amber-900 uppercase">Avaliações de Trabalhadores</p>
                  {compRep.reviews.slice(0, 2).map((rev) => (
                    <div key={rev.id} className="text-xs text-neutral-800">
                      <span className="font-bold text-amber-700">{'★'.repeat(rev.rating)}:</span> "{rev.comment || 'Ótima empresa para trabalhar.'}"
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 border-t border-neutral-200 pt-3">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-black text-lime-400 px-2 py-0.5 rounded-full">
                      {modalIsJob ? 'Vaga de Trabalho' : 'Turno Pontual'}
                    </span>
                    <h4 className="font-extrabold text-black text-lg mt-1">{selectedShiftModal.title}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[#4d7c0f] font-black text-xl block">
                      R$ {formatCurrencyBRL(selectedShiftModal.pay_rate)}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-bold">
                      {modalIsJob ? (selectedShiftModal.salary_period || '/ mês') : '/ turno'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">Vagas</span>
                    <span className="text-black font-bold">{selectedShiftModal.vacancies || 1}</span>
                  </div>
                  <div className="bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">{modalIsJob ? 'Contratação' : 'Carga Horária'}</span>
                    <span className="text-black font-bold">
                      {modalIsJob ? (selectedShiftModal.employment_type || 'A combinar') : (selectedShiftModal.workload || 'A combinar')}
                    </span>
                  </div>
                  {modalIsJob && (
                    <div className="col-span-2 bg-neutral-100 p-3 rounded-2xl">
                      <span className="text-neutral-500 block">Escala</span>
                      <span className="text-black font-bold">{selectedShiftModal.work_schedule || selectedShiftModal.workload || 'A combinar'}</span>
                    </div>
                  )}
                  <div className="bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">Transporte</span>
                    <span className="text-black font-bold">{selectedShiftModal.transport_info || 'Não informado'}</span>
                  </div>
                  <div className="bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">Alimentação</span>
                    <span className="text-black font-bold">{selectedShiftModal.meal_info || 'Não informado'}</span>
                  </div>
                  <div className="col-span-2 bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">Veículo</span>
                    <span className="text-black font-bold">{selectedShiftModal.vehicle_required || 'Não exige veículo'}</span>
                  </div>
                </div>

                <div className="bg-neutral-100 p-3.5 rounded-2xl text-xs space-y-1.5">
                  {modalIsJob ? (
                    <p className="text-neutral-800"><strong>Horário:</strong> {selectedShiftModal.shift_hours || 'A combinar'}</p>
                  ) : (
                    <p className="text-neutral-800"><strong>Data:</strong> {new Date(selectedShiftModal.shift_date).toLocaleDateString('pt-BR')} {selectedShiftModal.shift_hours ? `(${selectedShiftModal.shift_hours})` : ''}</p>
                  )}
                  <p className="text-neutral-800"><strong>Local:</strong> {selectedShiftModal.shift_street ? `${selectedShiftModal.shift_street}, ` : ''}{selectedShiftModal.location}</p>
                  {selectedShiftModal.requirements && (
                    <p className="text-neutral-800 pt-1">
                      <strong>{modalIsJob ? 'Requisitos da vaga:' : 'Exigências:'}</strong> {selectedShiftModal.requirements}
                    </p>
                  )}
                </div>
              </div>

              {activeRole === 'worker' && selectedShiftModal.status === 'open' && (
                <div className="pt-2">
                  {applications.some((a) => a.shift_id === selectedShiftModal.id) ? (
                    <div className="w-full text-center py-3.5 rounded-2xl bg-black text-lime-400 text-xs font-extrabold">
                      Você já se candidatou ✓
                    </div>
                  ) : (
                    <button onClick={() => handleApply(selectedShiftModal.id)} className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-2xl transition shadow-md">
                      {modalIsJob ? 'Candidatar-se à Vaga' : 'Confirmar Candidatura'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {selectedWorkerModal && selectedWorkerModal.worker && (() => {
        const wRep = getReputationStats(selectedWorkerModal.worker.id)
        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedWorkerModal(null)}>
            <div className="bg-white text-black rounded-3xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {selectedWorkerModal.worker.avatar_url ? (
                    <img src={selectedWorkerModal.worker.avatar_url} alt="Candidato" className="w-14 h-14 rounded-full object-cover border-2 border-black" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-black text-lime-400 flex items-center justify-center font-extrabold text-lg">
                      {(selectedWorkerModal.worker.full_name || 'T')[0]}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-black text-base">{selectedWorkerModal.worker.full_name}</h3>
                    <p className="text-xs font-extrabold text-amber-600">
                      {wRep.avg ? `★ ${wRep.avg} • ${wRep.count} avaliações` : 'Primeiro registro na plataforma'}
                    </p>
                    <p className="text-xs text-neutral-600 font-medium">
                      {selectedWorkerModal.worker.age ? `${selectedWorkerModal.worker.age} anos` : ''} • {selectedWorkerModal.worker.city}/{selectedWorkerModal.worker.state}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedWorkerModal(null)} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-black font-bold flex items-center justify-center">✕</button>
              </div>

              <div className="space-y-2 text-xs bg-neutral-100 p-4 rounded-2xl">
                <p className="text-neutral-800"><strong>CPF:</strong> {maskDocument(selectedWorkerModal.worker.cpf, 'cpf')}</p>
                <p className="text-neutral-800"><strong>WhatsApp:</strong> ({selectedWorkerModal.worker.phone_ddd || '62'}) {selectedWorkerModal.worker.phone}</p>
                <p className="text-neutral-800"><strong>Bairro:</strong> {selectedWorkerModal.worker.neighborhood} - {selectedWorkerModal.worker.address}</p>
                <p className="text-neutral-800"><strong>Raio:</strong> {selectedWorkerModal.worker.max_distance || 'Não informado'}</p>
                <p className="text-neutral-800"><strong>Habilidades:</strong> {selectedWorkerModal.worker.skills || 'Não especificadas'}</p>
              </div>

              {wRep.reviews.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1.5">
                  <p className="text-[11px] font-extrabold text-amber-900 uppercase">Histórico de Avaliações</p>
                  {wRep.reviews.slice(0, 3).map((rev) => (
                    <div key={rev.id} className="text-xs text-neutral-800">
                      <span className="font-bold text-amber-700">{'★'.repeat(rev.rating)}</span> ({rev.reviewer?.full_name || 'Empresa'}): "{rev.comment || 'Excelente profissional.'}"
                    </div>
                  ))}
                </div>
              )}

              {selectedWorkerModal.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleApplicationStatus(selectedWorkerModal.id, selectedWorkerModal.shift.id, 'accepted')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-2xl">
                    Aceitar Candidato ✓
                  </button>
                  <button onClick={() => handleApplicationStatus(selectedWorkerModal.id, selectedWorkerModal.shift.id, 'rejected')} className="flex-1 bg-neutral-200 hover:bg-red-100 hover:text-red-700 text-neutral-700 text-xs font-bold py-3.5 rounded-2xl">
                    Recusar
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {editingShift && (() => {
        const editIsJob = editingShift.post_type === 'job'
        return (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingShift(null)}
          >
            <div
              className="bg-[#111111] border border-neutral-800 text-white rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                <h3 className="font-extrabold text-white text-base">
                  {editIsJob ? 'Editar Vaga de Trabalho' : 'Editar Turno'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditShift} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    required
                    value={editingShift.title}
                    onChange={(e) => setEditingShift({ ...editingShift, title: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Vagas</label>
                  <select
                    value={editingShift.vacancies}
                    onChange={(e) => setEditingShift({ ...editingShift, vacancies: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((v) => (
                      <option key={v} value={v}>{v} vagas</option>
                    ))}
                  </select>
                </div>

                {editIsJob ? (
                  <>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Tipo de Contratação</label>
                      <select
                        value={editingShift.employment_type}
                        onChange={(e) => setEditingShift({ ...editingShift, employment_type: e.target.value })}
                        className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <option value="CLT / Efetivo">CLT / Efetivo</option>
                        <option value="Temporário">Temporário</option>
                        <option value="Período de Experiência">Período de Experiência</option>
                        <option value="PJ / Prestador">PJ / Prestador</option>
                        <option value="A combinar">A combinar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Escala de Trabalho</label>
                      <select
                        value={editingShift.work_schedule}
                        onChange={(e) => setEditingShift({ ...editingShift, work_schedule: e.target.value })}
                        className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <option value="Segunda a Sexta">Segunda a Sexta</option>
                        <option value="Segunda a Sábado">Segunda a Sábado</option>
                        <option value="Escala 6x1">Escala 6x1</option>
                        <option value="Escala 5x2">Escala 5x2</option>
                        <option value="Escala 12x36">Escala 12x36</option>
                        <option value="Finais de Semana">Finais de Semana</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Horário</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={editingShift.shift_hours}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            shift_hours: formatShiftHoursMask(e.target.value)
                          })
                        }
                        className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Salário (R$)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          placeholder="2000 ou 2000,00"
                          value={editingShift.pay_rate}
                          onChange={(e) => setEditingShift({ ...editingShift, pay_rate: e.target.value })}
                          className="flex-1 bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                        />
                        <select
                          value={editingShift.salary_period}
                          onChange={(e) => setEditingShift({ ...editingShift, salary_period: e.target.value })}
                          className="w-28 bg-[#050505] border border-neutral-800 rounded-xl px-2 py-2.5 text-xs font-bold text-white"
                        >
                          <option value="/ mês">/ mês</option>
                          <option value="/ quinzena">/ quinzena</option>
                          <option value="/ semana">/ semana</option>
                          <option value="/ dia">/ dia</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Carga Horária</label>
                      <select
                        value={editingShift.workload}
                        onChange={(e) => setEditingShift({ ...editingShift, workload: e.target.value })}
                        className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <option value="4 horas">4 horas</option>
                        <option value="6 horas">6 horas</option>
                        <option value="8 horas">8 horas</option>
                        <option value="10 horas">10 horas</option>
                        <option value="12 horas (Plantão)">12 horas (Plantão)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Horário</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={editingShift.shift_hours}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            shift_hours: formatShiftHoursMask(e.target.value)
                          })
                        }
                        className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Valor (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="120 ou 120,00"
                        value={editingShift.pay_rate}
                        onChange={(e) => setEditingShift({ ...editingShift, pay_rate: e.target.value })}
                        className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Data</label>
                      <input
                        type="datetime-local"
                        required
                        value={editingShift.shift_date}
                        onChange={(e) => setEditingShift({ ...editingShift, shift_date: e.target.value })}
                        className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Status</label>
                  <select
                    value={editingShift.status}
                    onChange={(e) => setEditingShift({ ...editingShift, status: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="open">Aberto</option>
                    <option value="filled">Preenchido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Exigência de Veículo</label>
                  <select
                    value={editingShift.vehicle_required}
                    onChange={(e) => setEditingShift({ ...editingShift, vehicle_required: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="Não exige veículo">Não exige veículo</option>
                    <option value="Moto própria obrigatória">Moto própria obrigatória</option>
                    <option value="Carro próprio obrigatório">Carro próprio obrigatório</option>
                    <option value="Moto ou Carro próprio">Moto ou Carro próprio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Bairro / Setor</label>
                  <input
                    type="text"
                    required
                    value={editingShift.shift_neighborhood}
                    onChange={(e) => setEditingShift({ ...editingShift, shift_neighborhood: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Rua e Número</label>
                  <input
                    type="text"
                    required
                    value={editingShift.shift_street}
                    onChange={(e) => setEditingShift({ ...editingShift, shift_street: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Requisitos / Observações</label>
                  <input
                    type="text"
                    value={editingShift.requirements}
                    onChange={(e) => setEditingShift({ ...editingShift, requirements: e.target.value })}
                    className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>

                <div className="sm:col-span-2 flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingShift(null)}
                    className="w-1/3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs py-3 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="w-2/3 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3 rounded-xl transition"
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar Alterações ✓'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {reviewModalApp && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setReviewModalApp(null)}>
          <div className="bg-white text-black rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-black text-lg">Avaliar Experiência</h3>
              <button onClick={() => setReviewModalApp(null)} className="w-8 h-8 rounded-full bg-neutral-100 text-black font-bold flex items-center justify-center">✕</button>
            </div>
            <p className="text-xs text-neutral-600">
              Referência: <strong>{reviewModalApp.shift?.title}</strong>. Sua avaliação aparece no histórico público e ajuda a manter a qualidade do TurnLevel.
            </p>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-2">Nota (1 a 5 estrelas)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className={`flex-1 py-3 rounded-2xl font-extrabold text-base border transition ${reviewRating >= star ? 'bg-lime-400 border-black text-black' : 'bg-neutral-100 border-neutral-200 text-neutral-400'}`}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Comentário (opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Pontualidade, pagamento em dia, ambiente de trabalho..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full bg-neutral-100 border border-neutral-300 rounded-2xl p-3 text-xs text-black outline-none focus:border-black"
                />
              </div>
              <button
                type="submit"
                disabled={submittingReview}
                className="w-full bg-black hover:bg-neutral-800 text-lime-400 font-extrabold text-sm py-3.5 rounded-2xl transition"
              >
                {submittingReview ? 'Enviando...' : 'Enviar Avaliação ✓'}
              </button>
            </form>
          </div>
        </div>
      )}

      {renderPushPromptModal()}
      {renderInstallGuideModal()}
      {renderLegalModal()}

      <nav className="fixed bottom-0 inset-x-0 bg-[#050505]/95 backdrop-blur-md border-t border-neutral-900 px-3 py-2.5 z-20">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1.5">
          <button
            onClick={() => { setActiveTab('shifts'); setPublishType('shift') }}
            className={`py-2.5 rounded-2xl text-xs font-extrabold transition ${activeTab === 'shifts' ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.25)]' : 'text-neutral-400 hover:text-white'}`}
          >
            Turnos
          </button>
          <button
            onClick={() => { setActiveTab('jobs'); setPublishType('job') }}
            className={`py-2.5 rounded-2xl text-xs font-extrabold transition ${activeTab === 'jobs' ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.25)]' : 'text-neutral-400 hover:text-white'}`}
          >
            Vagas
          </button>
          <button
            onClick={() => { setActiveTab('applications'); fetchApplications(profile); fetchAllReviews() }}
            className={`py-2.5 rounded-2xl text-xs font-extrabold transition ${activeTab === 'applications' ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.25)]' : 'text-neutral-400 hover:text-white'}`}
          >
            {activeRole === 'company' ? 'Candidatos' : 'Candidaturas'}
          </button>
          <button
            onClick={() => { setActiveTab('profile'); fetchAllReviews() }}
            className={`py-2.5 rounded-2xl text-xs font-extrabold transition ${activeTab === 'profile' ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.25)]' : 'text-neutral-400 hover:text-white'}`}
          >
            Perfil
          </button>
        </div>
      </nav>
    </div>
  )
}
