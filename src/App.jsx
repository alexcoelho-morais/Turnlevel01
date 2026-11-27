import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY =
  'BKVSS2H3oGVbJKXVePdGR8R6pB_oTDV-XkP14Q_OnTVh5UU01G_e_9RcFXnDBDQP1o-ev29WksUG5wOJSN2PMxQ'

const MP_PUBLIC_KEY = 'APP_USR-74337540-492c-428d-8723-3d07a6935197'

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
  const [buyingPass, setBuyingPass] = useState(false)

  // Estados do Checkout Escuro Integrado (Pix + Cartão)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutMethod, setCheckoutMethod] = useState('pix') // 'pix' | 'card'
  const [pixData, setPixData] = useState(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [checkingPassStatus, setCheckingPassStatus] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardCpf, setCardCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const mpInstanceRef = useRef(null)

  const [pushLoading, setPushLoading] = useState(false)
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

  const hasActivePass = Boolean(
    isMasterTester ||
      (profile?.passe_expira_em && new Date(profile.passe_expira_em) > new Date())
  )

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
    if (!session?.user?.id) return
    const handleReturnFocus = () => {
      if (document.visibilityState === 'visible') {
        loadUserData(session.user.id)
      }
    }
    window.addEventListener('focus', handleReturnFocus)
    document.addEventListener('visibilitychange', handleReturnFocus)
    return () => {
      window.removeEventListener('focus', handleReturnFocus)
      document.removeEventListener('visibilitychange', handleReturnFocus)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub && Notification.permission === 'granted') {
            setPushEnabled(true)
          } else {
            setPushEnabled(false)
            if (Notification.permission === 'default') {
              setShowPushPromptModal(true)
            }
          }
        })
        .catch(() => {})
    }
  }, [session])

  // Carrega o SDK JS do Mercado Pago para tokenização de cartão
  useEffect(() => {
    if (!showCheckoutModal) return
    if (window.MercadoPago) {
      if (!mpInstanceRef.current) {
        mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
      }
      return
    }
    const existingScript = document.querySelector('script[src="https://sdk.mercadopago.com/js/v2"]')
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => {
      if (window.MercadoPago && !mpInstanceRef.current) {
        mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
      }
    }
    document.body.appendChild(script)
  }, [showCheckoutModal])

  function handleOpenPassCheckout() {
    if (!session?.user?.id) return
    setCheckoutError('')
    setPixData(null)
    setPixCopied(false)
    setCheckoutMethod('pix')
    setCardHolderName(profile?.full_name || fullName || '')
    setCardCpf(profile?.cpf || cpf || '')
    setShowCheckoutModal(true)
  }

  async function handleGeneratePixPass() {
    if (!session?.user?.id || buyingPass) return
    setBuyingPass(true)
    setCheckoutError('')
    setPixCopied(false)

    try {
      const { data, error } = await supabase.functions.invoke('passe-mercado-pago', {
        body: {
          payment_method_id: 'pix',
          payer: {
            email: session.user.email || 'cliente@turnlevel.app'
          }
        }
      })

      if (error) {
        setCheckoutError(error.message || 'Não foi possível gerar o Pix agora.')
        setBuyingPass(false)
        return
      }

      if (data?.erro) {
        setCheckoutError(typeof data.erro === 'string' ? data.erro : 'Falha ao gerar código Pix.')
        setBuyingPass(false)
        return
      }

      setPixData({
        payment_id: data.payment_id,
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        ticket_url: data.ticket_url
      })
    } catch (err) {
      console.error('Erro ao gerar Pix:', err)
      setCheckoutError('Erro inesperado ao gerar código Pix.')
    }

    setBuyingPass(false)
  }

  async function handleCheckPassActivation() {
    if (!session?.user?.id) return
    setCheckingPassStatus(true)
    await loadUserData(session.user.id)
    setCheckingPassStatus(false)
  }

  async function handlePayWithCard(e) {
    e.preventDefault()
    if (!session?.user?.id || buyingPass) return
    setBuyingPass(true)
    setCheckoutError('')

    try {
      const cleanNumber = cardNumber.replace(/\D/g, '')
      const cleanCpf = cardCpf.replace(/\D/g, '')
      const expiryParts = cardExpiry.split('/')
      const expMonth = (expiryParts[0] || '').replace(/\D/g, '').padStart(2, '0')
      const rawYear = (expiryParts[1] || '').replace(/\D/g, '')
      const expYear = rawYear.length === 2 ? `20${rawYear}` : rawYear
      const cleanCvv = cardCvv.replace(/\D/g, '')

      if (cleanNumber.length < 13 || expMonth.length !== 2 || expYear.length !== 4 || cleanCvv.length < 3) {
        setCheckoutError('Preencha número do cartão, validade (MM/AA), CVV e nome do titular corretamente.')
        setBuyingPass(false)
        return
      }

      if (!window.MercadoPago) {
        setCheckoutError('Carregando módulo seguro do cartão... tente novamente em 2 segundos.')
        setBuyingPass(false)
        return
      }

      const mp = mpInstanceRef.current || new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
      mpInstanceRef.current = mp

      const cardToken = await mp.createCardToken({
        cardNumber: cleanNumber,
        cardholderName: cardHolderName.trim() || fullName || 'Titular',
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYear,
        securityCode: cleanCvv,
        identification: cleanCpf
          ? {
              type: 'CPF',
              number: cleanCpf
            }
          : undefined
      })

      if (!cardToken?.id) {
        setCheckoutError('Não foi possível validar os dados do cartão. Confira os números digitados.')
        setBuyingPass(false)
        return
      }

      const bin = cleanNumber.slice(0, 6)
      let paymentMethodId = 'credit_card'
      try {
        const pmInfo = await mp.getPaymentMethods({ bin })
        const detected = pmInfo?.results?.[0]?.id
        if (detected) paymentMethodId = detected
      } catch {
        // mantém fallback
      }

      const { data, error } = await supabase.functions.invoke('passe-mercado-pago', {
        body: {
          payment_method_id: paymentMethodId,
          token: cardToken.id,
          installments: 1,
          payer: {
            email: session.user.email || 'cliente@turnlevel.app',
            identification: cleanCpf
              ? {
                  type: 'CPF',
                  number: cleanCpf
                }
              : undefined
          }
        }
      })

      if (error || data?.erro) {
        setCheckoutError(data?.erro || error?.message || 'Pagamento com cartão não autorizado.')
        setBuyingPass(false)
        return
      }

      if (data?.status === 'approved') {
        await loadUserData(session.user.id)
        setShowCheckoutModal(false)
        alert('Passe de 7 dias ativado com sucesso! Candidaturas liberadas.')
      } else {
        setCheckoutError(`Status do pagamento: ${data?.status || 'em análise'}. Assim que aprovado, o passe será liberado.`)
        await loadUserData(session.user.id)
      }
    } catch (err) {
      console.error('Erro pagamento cartão:', err)
      setCheckoutError(err?.message || 'Erro ao processar pagamento com cartão.')
    }

    setBuyingPass(false)
  }

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

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Ative as notificações nas configurações do aparelho para receber alertas.')
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

      await supabase.functions.invoke('notify-nearby-workers', {
        body: {
          test_subscription: { endpoint, p256dh, auth }
        }
      }).catch(() => {})

      setPushEnabled(true)
      setShowPushPromptModal(false)
    } catch (err) {
      console.error('Erro ao ativar push:', err)
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
      setShowPushPromptModal(true)
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
    if (!hasActivePass) {
      handleOpenPassCheckout()
      return
    }
    const targetShift = shifts.find((s) => s.id === shiftId) || selectedShiftModal

    const { error } = await supabase.from('shift_applications').insert([
      { shift_id: shiftId, worker_id: session.user.id }
    ])

    if (error) {
      if (error.code === '23505') alert('Você já se candidatou.')
      else alert('Erro: ' + error.message)
    } else {
      if (targetShift?.company_id) {
        const workerName = profile?.full_name || fullName || 'Um trabalhador'
        const isJob = (targetShift.post_type || 'shift') === 'job'
        await supabase.functions.invoke('notify-nearby-workers', {
          body: {
            direct_user_id: targetShift.company_id,
            title: isJob ? 'Novo candidato na sua vaga!' : 'Novo candidato no seu turno!',
            body: `${workerName} se candidatou para "${targetShift.title}". Abra a aba Candidatos para responder.`
          }
        }).catch(() => {})
      }

      alert('Candidatura enviada com sucesso.')
      setSelectedShiftModal(null)
      fetchApplications(profile)
    }
  }

  async function handleApplicationStatus(appId, shiftId, newStatus) {
    const targetApp = applications.find((a) => a.id === appId) || selectedWorkerModal
    const targetShift = shifts.find((s) => s.id === shiftId) || targetApp?.shift

    const { error } = await supabase.from('shift_applications').update({ status: newStatus }).eq('id', appId)
    if (!error) {
      if (newStatus === 'accepted') {
        if (targetApp?.worker_id) {
          const compName = profile?.full_name || fullName || 'A empresa'
          await supabase.functions.invoke('notify-nearby-workers', {
            body: {
              direct_user_id: targetApp.worker_id,
              title: 'Candidatura Aceita! ✓',
              body: `${compName} aceitou sua candidatura para "${targetShift?.title || 'a oportunidade'}". Entre no app para falar no WhatsApp!`
            }
          }).catch(() => {})
        }

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
      await Promise.all([
        fetchApplications(profile),
        fetchShifts(cityFilter, dayFilter)
      ])
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

  const renderPassCard = () => {
    if (activeRole !== 'worker') return null

    if (hasActivePass) {
      const validLabel = profile?.passe_expira_em
        ? `Válido até ${new Date(profile.passe_expira_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : 'Passe liberado'
      return (
        <div className="bg-[#111111] border border-lime-400/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-lime-400 text-black px-2 py-0.5 rounded-full">
              Passe 7 Dias Ativo
            </span>
            <p className="text-xs font-bold text-white mt-1.5">Candidaturas liberadas</p>
            <p className="text-[11px] text-lime-400">{validLabel}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-[#111111] border border-lime-400/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-lime-400 text-black px-2.5 py-0.5 rounded-full">
            Passe de 7 Dias • R$ 9,47
          </span>
          <p className="text-xs font-extrabold text-white pt-0.5">
            Ative seu passe para candidatar-se a turnos e vagas
          </p>
          <p className="text-[11px] text-neutral-400">
            Cadastro e perfil continuam gratuitos. O passe vale por 7 dias após aprovação.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenPassCheckout}
          className="bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs px-4 py-3 rounded-xl transition shrink-0 shadow-[0_0_20px_rgba(163,230,53,0.25)]"
        >
          Ativar Passe 7 Dias — R$ 9,47
        </button>
      </div>
    )
  }

  // Modal Escuro de Checkout Integrado (Pix + Cartão)
  const renderDarkCheckoutModal = () => {
    if (!showCheckoutModal) return null

    return (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={() => setShowCheckoutModal(false)}
      >
        <div
          className="bg-[#111111] border border-lime-400/50 text-white rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-[0_0_50px_rgba(163,230,53,0.12)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-lime-400 text-black px-2.5 py-0.5 rounded-full">
                Checkout TurnLevel • R$ 9,47
              </span>
              <h3 className="font-extrabold text-white text-base mt-1.5">
                Passe de 7 Dias de Candidaturas
              </h3>
              <p className="text-[11px] text-neutral-400">
                Pague com Pix ou Cartão sem sair do aplicativo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Seletor Pix vs Cartão */}
          <div className="grid grid-cols-2 bg-[#050505] p-1 rounded-2xl border border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setCheckoutMethod('pix')
                setCheckoutError('')
              }}
              className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                checkoutMethod === 'pix'
                  ? 'bg-lime-400 text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Pix Instantâneo
            </button>
            <button
              type="button"
              onClick={() => {
                setCheckoutMethod('card')
                setCheckoutError('')
              }}
              className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                checkoutMethod === 'card'
                  ? 'bg-lime-400 text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Cartão de Crédito
            </button>
          </div>

          {checkoutError && (
            <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs p-3 rounded-2xl">
              {checkoutError}
            </div>
          )}

          {checkoutMethod === 'pix' ? (
            <div className="space-y-3.5">
              {!pixData ? (
                <div className="bg-[#050505] border border-neutral-800 rounded-2xl p-4 space-y-3 text-center">
                  <p className="text-xs text-neutral-300">
                    Gere seu código Pix de <strong className="text-lime-400">R$ 9,47</strong> para liberar 7 dias de candidaturas ilimitadas.
                  </p>
                  <button
                    type="button"
                    disabled={buyingPass}
                    onClick={handleGeneratePixPass}
                    className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.25)]"
                  >
                    {buyingPass ? 'Gerando Pix...' : 'Gerar Código Pix — R$ 9,47'}
                  </button>
                </div>
              ) : (
                <div className="bg-[#050505] border border-lime-400/35 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-lime-400">Código Pix Gerado</span>
                    <span className="text-xs font-bold text-white">R$ 9,47</span>
                  </div>

                  {pixData.qr_code_base64 && (
                    <div className="flex justify-center py-1">
                      <img
                        src={`data:image/png;base64,${pixData.qr_code_base64}`}
                        alt="QR Code Pix"
                        className="w-40 h-40 rounded-2xl bg-white p-2"
                      />
                    </div>
                  )}

                  {pixData.qr_code && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] text-neutral-400">Pix Copia e Cola</label>
                      <div className="bg-[#111111] border border-neutral-800 rounded-xl p-2.5 text-[11px] text-neutral-200 break-all font-mono">
                        {pixData.qr_code}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(pixData.qr_code)
                            setPixCopied(true)
                          } catch {
                            setPixCopied(false)
                          }
                        }}
                        className="w-full bg-neutral-900 hover:bg-neutral-800 border border-lime-400/40 text-lime-400 font-extrabold text-xs py-2.5 rounded-xl transition"
                      >
                        {pixCopied ? '✓ Código Pix Copiado!' : 'Copiar Código Pix'}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={checkingPassStatus}
                    onClick={handleCheckPassActivation}
                    className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3 rounded-xl transition"
                  >
                    {checkingPassStatus ? 'Verificando...' : 'Já paguei • Atualizar Status do Passe'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handlePayWithCard} className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Nome no Cartão</label>
                <input
                  type="text"
                  required
                  placeholder="Como está impresso no cartão"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">CPF do Titular</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cardCpf}
                  onChange={(e) => setCardCpf(e.target.value)}
                  className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Número do Cartão</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Validade (MM/AA)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="12/28"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                      const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
                      setCardExpiry(formatted)
                    }}
                    className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Código CVV</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="123"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full bg-[#050505] border border-neutral-800 focus:border-lime-400 outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={buyingPass}
                className="w-full bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs py-3.5 rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.25)] mt-1"
              >
                {buyingPass ? 'Processando Cartão...' : 'Pagar R$ 9,47 com Cartão'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  const renderPushPromptModal = () => {
    if (!showPushPromptModal || pushEnabled) return null
    const isCompany = activeRole === 'company'
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
                Aviso em Tempo Real
              </span>
              <h3 className="font-extrabold text-white text-lg mt-2">
                {isCompany
                  ? 'Receber alertas quando alguém se candidatar?'
                  : 'Receber alertas de turnos no raio de 20 km?'}
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
            {isCompany
              ? 'Ative as notificações gratuitas para ser avisado no celular assim que um trabalhador se candidatar aos seus turnos ou vagas.'
              : 'Ative as notificações gratuitas agora para ser avisado no celular assim que surgir uma vaga perto de você ou quando sua candidatura for aceita.'}
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
    const matchesTab = isJobsTab ? itemType === 'job' : itemType !== 'job'
    const isOpen = (item.status || 'open') === 'open'
    return matchesTab && isOpen
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
            {!pushEnabled && (
              <div className="bg-[#111111] border border-lime-400/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-white">
                    {activeRole === 'company'
                      ? 'Alertas de novos candidatos'
                      : 'Alertas de turnos no raio de 20 km'}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {activeRole === 'company'
                      ? 'Ative para ser avisado quando alguém se candidatar.'
                      : 'Ative para ser avisado assim que surgir vaga perto de você.'}
                  </p>
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
                {renderPassCard()}

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
                                className="
