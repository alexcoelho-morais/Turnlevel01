import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY =
  'BKVSS2H3oGVbJKXVePdGR8R6pB_oTDV-XkP14Q_OnTVh5UU01G_e_9RcFXnDBDQP1o-ev29WksUG5wOJSN2PMxQ'

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

  const [authView, setAuthView] = useState('welcome')
  const [howItWorksTab, setHowItWorksTab] = useState('worker')
  const [signupStep, setSignupStep] = useState(1)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

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

  const [reviewModalApp, setReviewModalApp] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

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
          }
        })
        .catch(() => {})
    }
  }, [session])

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

      setPushEnabled(true)
      setPushStatus('Notificações ativas neste dispositivo ✓')
      alert('Alertas de vagas no raio de 20 km ativados com sucesso!')
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
    setCnpj(prof.cnpj || '')
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

          const query = encodeURIComponent(
            `${rua ? rua + ', ' : ''}${bairro ? bairro + ', ' : ''}${loc}, ${uf}, Brasil`
          )
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          )
          const geoData = await geoRes.json()
          if (Array.isArray(geoData) && geoData[0]) {
            setLatitude(parseFloat(geoData[0].lat))
            setLongitude(parseFloat(geoData[0].lon))
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
      const whatsappE164 = buildWhatsappE164(phoneDdd, phone)

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
        latitude,
        longitude
      }

      await supabase.from('profiles').upsert(profilePayload)

      if (!signUpData.session) {
        setAuthView('verify_email')
        setAuthLoading(false)
        return
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
    const whatsappE164 = buildWhatsappE164(phoneDdd, phone)

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
      latitude: latitude ?? profile?.latitude ?? null,
      longitude: longitude ?? profile?.longitude ?? null
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
      if (filterDay !== '') {
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
        vehicle_required: vehicleRequired,
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
      fetchShifts(cityFilter, dayFilter)
    }
  }

  async function handleApply(shiftId) {
    if (!session) return
    const { error } = await supabase.from('shift_applications').insert([
      { shift_id: shiftId, worker_id: session.user.id }
    ])

    if (error) {
      if (error.code === '23505') alert('Você já se candidatou a este turno.')
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
        await supabase.from('shifts').update({ status: 'filled' }).eq('id', shiftId)
      }
      setSelectedWorkerModal(null)
      fetchApplications(profile)
      fetchShifts(cityFilter, dayFilter)
    }
  }

  async function handleConfirmShiftEndAndOpenReview(app) {
    const isCompany = (profile?.role || role) === 'company'
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

    const isCompany = (profile?.role || role) === 'company'
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
      if (error.code === '23505') alert('Você já avaliou este turno.')
      else alert('Erro ao enviar avaliação: ' + error.message)
    } else {
      alert('Avaliação registrada com sucesso.')
      setReviewModalApp(null)
      fetchAllReviews()
    }
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
                O <strong className="text-white">TurnLevel</strong> conecta empresas com demanda de turnos pontuais a trabalhadores disponíveis na região.
              </p>
              <p>
                A definição de valores, horários, benefícios e condições operacionais do turno é de responsabilidade direta das partes envolvidas.
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
                A localização é utilizada para filtrar turnos próximos e viabilizar alertas de vagas na sua região (raio de até 20 km).
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
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Turnos por Proximidade</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Avaliações Verificadas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Direto no WhatsApp</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Cadastro 100% Gratuito</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime-400" /> Turnos por Proximidade</span>
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
                    Ganhe por turno trabalhado ou complete sua equipe em minutos.
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
                        <div className="text-xs text-neutral-400">Escolha seus dias, veja o valor e candidate-se grátis</div>
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
                        <div className="text-xs text-neutral-400">Publique vagas, veja avaliações e chame no WhatsApp</div>
                      </div>
                    </div>
                    <span className="text-lime-400 text-lg font-bold group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 text-center">
                  <button
                    onClick={() => { setAuthView('login'); setAuthError('') }}
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
                      <p><strong>Filtre turnos pelo dia da semana</strong>, veja a nota da empresa e o valor líquido pago.</p>
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
                      <p><strong>Cadastre sua empresa grátis</strong> e publique o turno informando função, valor, horário e se exige veículo.</p>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <p><strong>Analise o histórico dos candidatos:</strong> veja quantos turnos já concluíram e as avaliações de outras empresas.</p>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#050505] p-3 rounded-2xl border border-neutral-800/70">
                      <span className="w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <p><strong>Aprove e conecte-se no WhatsApp:</strong> ao final do serviço, confirme o encerramento e avalie o profissional.</p>
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
                  <label className="block text-xs text-neutral-400 mb-1">Senha</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3.5 py-3 text-sm text-white transition" />
                </div>

                {authError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{authError}</p>}

                <button type="submit" disabled={authLoading} className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.25)]">
                  {authLoading ? 'A entrar...' : 'Entrar'}
                </button>

                <button type="button" onClick={() => { setAuthView('welcome'); setAuthError('') }} className="w-full text-center text-xs text-neutral-400 hover:text-white pt-2">
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
                <form onSubmit={(e) => { e.preventDefault(); setSignupStep(2) }} className="space-y-4">
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
                <form onSubmit={(e) => { e.preventDefault(); setSignupStep(3) }} className="space-y-3">
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
                        <label className="block text-xs text-neutral-400 mb-1">CNPJ</label>
                        <input type="text" inputMode="numeric" required placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
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

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setSignupStep(1)} className="w-1/3 bg-neutral-800 text-neutral-300 text-sm py-3 rounded-xl">← Voltar</button>
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

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <header className="bg-[#050505]/90 backdrop-blur-md border-b border-neutral-900 sticky top-0 z-10 px-4 py-3.5">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <TurnLevelLogo size="md" />

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

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {loadingProfile ? (
          <p className="text-sm text-neutral-400 text-center py-10">A carregar dados...</p>
        ) : (
          <>
            {activeTab === 'shifts' && (
              <div className="space-y-6">
                {(profile?.role || role) === 'company' && (
                  <section className="bg-[#111111] border border-neutral-800 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-bold text-white">Publicar Novo Turno</h2>
                      <span className="text-[11px] bg-lime-400/10 text-lime-400 border border-lime-400/30 px-2.5 py-0.5 rounded-full font-semibold">Vaga Rápida</span>
                    </div>
                    <form onSubmit={handleCreateShift} className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Função / Cargo</label>
                        <input type="text" required placeholder="Ex: Garçom / Entregador" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Vagas</label>
                        <select value={vacancies} onChange={(e) => setVacancies(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white">
                          {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((v) => <option key={v} value={v}>{v} vagas</option>)}
                        </select>
                      </div>
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
                        <label className="block text-xs text-neutral-400 mb-1">Horário</label>
                        <input type="text" required placeholder="18:00 às 00:00" value={shiftHours} onChange={(e) => setShiftHours(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Valor (R$)</label>
                        <input type="number" inputMode="decimal" step="0.01" required placeholder="120.00" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Data</label>
                        <input type="datetime-local" required value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
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
                        <label className="block text-xs text-neutral-400 mb-1">Exigências / Observações</label>
                        <input type="text" placeholder="Calça preta, CNH em dia..." value={requirements} onChange={(e) => setRequirements(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
                      </div>
                      <button type="submit" className="sm:col-span-2 bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.2)]">
                        + Publicar Vaga Agora
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
                        placeholder="Cidade ou bairro..."
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
                      />
                    </div>
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
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fetchShifts(cityFilter, dayFilter)} className="flex-1 bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-2.5 rounded-xl transition">
                      Buscar Turnos
                    </button>
                    <button onClick={() => { setCityFilter(''); setDayFilter(''); fetchShifts('', '') }} className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium px-4 py-2.5 rounded-xl border border-neutral-800 transition">
                      Limpar
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Turnos Disponíveis</h2>
                    <span className="text-xs font-bold bg-neutral-900 text-lime-400 border border-neutral-800 px-2.5 py-1 rounded-full">
                      {shifts.length} {shifts.length === 1 ? 'vaga' : 'vagas'}
                    </span>
                  </div>

                  {loadingShifts ? (
                    <p className="text-sm text-neutral-400">A procurar turnos...</p>
                  ) : shifts.length === 0 ? (
                    <div className="bg-[#111111] border border-dashed border-neutral-800 rounded-3xl p-8 text-center">
                      <p className="text-sm text-neutral-400">Nenhum turno encontrado com esses filtros.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {shifts.map((shift) => {
                        const applied = applications.some((a) => a.shift_id === shift.id)
                        const compRep = getReputationStats(shift.company?.id)
                        const hasVehicleReq = shift.vehicle_required && shift.vehicle_required !== 'Não exige veículo'

                        return (
                          <div
                            key={shift.id}
                            onClick={() => setSelectedShiftModal(shift)}
                            className="bg-white text-black hover:scale-[1.01] cursor-pointer rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                                  {new Date(shift.shift_date).toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()} • {shift.workload || '6 horas'}
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
                                  R$ {Number(shift.pay_rate).toFixed(2).replace('.', ',')}
                                </span>
                                <span className="text-xs font-semibold text-neutral-500">/ turno</span>
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
                                <p className="text-xs text-neutral-500">Data: {new Date(shift.shift_date).toLocaleDateString('pt-BR')} {shift.shift_hours ? `• ${shift.shift_hours}` : ''}</p>
                              </div>
                            </div>

                            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                              {(profile?.role || role) === 'worker' ? (
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
                                    Ver Detalhes e Candidatar
                                  </button>
                                )
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
                  {(profile?.role || role) === 'company' ? 'Candidatos & Turnos Ativos' : 'Minhas Candidaturas & Turnos'}
                </h2>
                {applications.length === 0 ? (
                  <div className="bg-[#111111] border border-dashed border-neutral-800 rounded-3xl p-8 text-center">
                    <p className="text-sm text-neutral-400">Sem registos no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => {
                      const isAccepted = app.status === 'accepted'
                      const isCompany = (profile?.role || role) === 'company'
                      const companyPhone = app.shift?.company?.phone_ddd && app.shift?.company?.phone ? `55${app.shift.company.phone_ddd}${app.shift.company.phone.replace(/\D/g, '')}` : ''
                      const workerPhone = app.worker?.phone_ddd && app.worker?.phone ? `55${app.worker.phone_ddd}${app.worker.phone.replace(/\D/g, '')}` : ''
                      const workerRep = app.worker ? getReputationStats(app.worker.id) : { avg: null, count: 0 }
                      const alreadyReviewed = allReviews.some((r) => r.application_id === app.id && r.reviewer_id === session.user.id)

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
                                {app.shift?.title} • R$ {Number(app.shift?.pay_rate || 0).toFixed(2).replace('.', ',')}
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
                                  href={`https://wa.me/${workerPhone}?text=Olá%20${encodeURIComponent(app.worker?.full_name || '')},%20sua%20candidatura%20para%20o%20turno%20de%20${encodeURIComponent(app.shift?.title || '')}%20foi%20aceita%20no%20TurnLevel.%20Vamos%20alinhar%20os%20detalhes?`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-3 rounded-2xl transition shadow-sm"
                                >
                                  Chamar Trabalhador no WhatsApp
                                </a>
                              ) : !isCompany && companyPhone ? (
                                <a
                                  href={`https://wa.me/${companyPhone}?text=Olá,%20fui%20aceito(a)%20no%20turno%20de%20${encodeURIComponent(app.shift?.title || '')}%20pela%20empresa%20${encodeURIComponent(app.shift?.company?.full_name || '')}%20no%20TurnLevel.`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full bg-lime-400 hover:bg-lime-300 text-black text-xs font-extrabold py-3 rounded-2xl transition shadow-sm"
                                >
                                  Falar com a Empresa no WhatsApp
                                </a>
                              ) : null}

                              {alreadyReviewed ? (
                                <div className="w-full text-center text-xs font-bold bg-neutral-100 text-neutral-700 py-2.5 rounded-2xl">
                                  ✓ Término confirmado e avaliação enviada
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleConfirmShiftEndAndOpenReview(app)}
                                    className="w-full bg-black hover:bg-neutral-800 text-lime-400 text-xs font-extrabold py-3 rounded-2xl transition"
                                  >
                                    ★ Confirmar Término e Avaliar
                                  </button>
                                  {(isCompany ? workerPhone : companyPhone) && (
                                    <a
                                      href={`https://wa.me/${isCompany ? workerPhone : companyPhone}?text=${encodeURIComponent(
                                        isCompany
                                          ? `Olá ${app.worker?.full_name || ''}! Confirmamos o término do seu turno de ${app.shift?.title || ''} pelo TurnLevel. Acesse o app para confirmar e deixar sua avaliação sobre nossa empresa.`
                                          : `Olá ${app.shift?.company?.full_name || ''}! Finalizei o turno de ${app.shift?.title || ''} pelo TurnLevel. Já confirmei no app, aguardo sua confirmação e avaliação.`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-1.5 w-full bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-bold py-3 rounded-2xl transition"
                                    >
                                      Notificar Término no WhatsApp
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
                {(profile?.role || role) === 'worker' && !pushEnabled && (
                  <section className="bg-[#111111] border border-lime-400/30 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-white">Alertas de Vagas (Raio de 20 km)</h2>
                        <p className="text-xs text-neutral-400">
                          Receba notificações gratuitas no aparelho quando novas vagas surgirem perto de você.
                        </p>
                      </div>
                      <span className="text-[10px] font-extrabold bg-lime-400/15 text-lime-400 border border-lime-400/30 px-2.5 py-1 rounded-full shrink-0">
                        Grátis
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleActivatePushNotifications}
                      disabled={pushLoading}
                      className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.2)]"
                    >
                      {pushLoading ? 'Ativando notificações...' : '🔔 Ativar Notificações de Vagas (20 km)'}
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
                      <span className="text-[11px] text-neutral-400 block">Turnos Concluídos</span>
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
                        {avatarFile ? (
                          <p className="text-[10px] text-lime-400/80 mt-1 truncate max-w-[200px]">✓ {avatarFile.name} pronto</p>
                        ) : (
                          <p className="text-[10px] text-neutral-400 mt-1">Recomendado formato quadrado</p>
                        )}
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
                      {(profile?.role || role) === 'company' ? (
                        <>
                          <div>
                            <label className="block text-xs text-neutral-400 mb-1">CNPJ</label>
                            <input type="text" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white" />
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
                      {compRep.avg ? `★ ${compRep.avg} • ${compRep.count} turnos avaliados` : 'Empresa recém-cadastrada'}
                    </p>
                    <p className="text-xs text-neutral-500">CNPJ: {selectedShiftModal.company?.cnpj || 'Não informado'}</p>
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
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-black text-lg">{selectedShiftModal.title}</h4>
                  <span className="text-[#4d7c0f] font-black text-xl">R$ {Number(selectedShiftModal.pay_rate).toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">Vagas</span>
                    <span className="text-black font-bold">{selectedShiftModal.vacancies || 1}</span>
                  </div>
                  <div className="bg-neutral-100 p-3 rounded-2xl">
                    <span className="text-neutral-500 block">Carga Horária</span>
                    <span className="text-black font-bold">{selectedShiftModal.workload || 'A combinar'}</span>
                  </div>
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
                  <p className="text-neutral-800"><strong>Data:</strong> {new Date(selectedShiftModal.shift_date).toLocaleDateString('pt-BR')} {selectedShiftModal.shift_hours ? `(${selectedShiftModal.shift_hours})` : ''}</p>
                  <p className="text-neutral-800"><strong>Local:</strong> {selectedShiftModal.shift_street ? `${selectedShiftModal.shift_street}, ` : ''}{selectedShiftModal.location}</p>
                  {selectedShiftModal.requirements && <p className="text-neutral-800 pt-1"><strong>Exigências:</strong> {selectedShiftModal.requirements}</p>}
                </div>
              </div>

              {(profile?.role || role) === 'worker' && selectedShiftModal.status === 'open' && (
                <div className="pt-2">
                  {applications.some((a) => a.shift_id === selectedShiftModal.id) ? (
                    <div className="w-full text-center py-3.5 rounded-2xl bg-black text-lime-400 text-xs font-extrabold">
                      Você já se candidatou a este turno ✓
                    </div>
                  ) : (
                    <button onClick={() => handleApply(selectedShiftModal.id)} className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-sm py-3.5 rounded-2xl transition shadow-md">
                      Confirmar Candidatura
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
                      {wRep.avg ? `★ ${wRep.avg} • ${wRep.count} turnos avaliados` : 'Primeiro turno na plataforma'}
                    </p>
                    <p className="text-xs text-neutral-600 font-medium">
                      {selectedWorkerModal.worker.age ? `${selectedWorkerModal.worker.age} anos` : ''} • {selectedWorkerModal.worker.city}/{selectedWorkerModal.worker.state}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedWorkerModal(null)} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-black font-bold flex items-center justify-center">✕</button>
              </div>

              <div className="space-y-2 text-xs bg-neutral-100 p-4 rounded-2xl">
                <p className="text-neutral-800"><strong>CPF:</strong> {selectedWorkerModal.worker.cpf || 'Não informado'}</p>
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

      {reviewModalApp && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setReviewModalApp(null)}>
          <div className="bg-white text-black rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-black text-lg">Avaliar Experiência</h3>
              <button onClick={() => setReviewModalApp(null)} className="w-8 h-8 rounded-full bg-neutral-100 text-black font-bold flex items-center justify-center">✕</button>
            </div>
            <p className="text-xs text-neutral-600">
              Turno: <strong>{reviewModalApp.shift?.title}</strong>. Sua avaliação aparece no histórico público e ajuda a manter a qualidade do TurnLevel.
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

      {renderLegalModal()}

      <nav className="fixed bottom-0 inset-x-0 bg-[#050505]/95 backdrop-blur-md border-t border-neutral-900 px-4 py-2.5 z-20">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-2.5 rounded-2xl text-xs font-extrabold transition ${activeTab === 'shifts' ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.25)]' : 'text-neutral-400 hover:text-white'}`}
          >
            Turnos
          </button>
          <button
            onClick={() => { setActiveTab('applications'); fetchApplications(profile); fetchAllReviews() }}
            className={`py-2.5 rounded-2xl text-xs font-extrabold transition ${activeTab === 'applications' ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.25)]' : 'text-neutral-400 hover:text-white'}`}
          >
            {(profile?.role || role) === 'company' ? 'Candidatos' : 'Candidaturas'}
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
