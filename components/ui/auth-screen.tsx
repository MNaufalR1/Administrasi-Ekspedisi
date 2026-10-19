"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Anchor, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react"

type AuthMode = "signin" | "signup"

type AuthScreenProps = {
  busy: boolean
  error: string
  notice: string
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (name: string, email: string, password: string) => Promise<void>
  onPublicTrack: () => void
}

function positionPupils(
  clientX: number,
  clientY: number,
  eyes: Array<HTMLSpanElement | null>,
  pupils: Array<HTMLSpanElement | null>,
) {
  eyes.forEach((eye, index) => {
    const pupil = pupils[index]
    if (!eye || !pupil) return

    const eyeBounds = eye.getBoundingClientRect()
    const pupilBounds = pupil.getBoundingClientRect()
    const maxX = Math.max(0, (eyeBounds.width - pupilBounds.width) / 2 - 1)
    const maxY = Math.max(0, (eyeBounds.height - pupilBounds.height) / 2 - 1)
    const dx = clientX - (eyeBounds.left + eyeBounds.width / 2)
    const dy = clientY - (eyeBounds.top + eyeBounds.height / 2)
    const normalizedDistance = Math.hypot(dx / (maxX || 1), dy / (maxY || 1))
    const scale = Math.max(1, normalizedDistance)
    const pupilX = (dx / scale / (maxX || 1)) * maxX
    const pupilY = (dy / scale / (maxY || 1)) * maxY

    pupil.style.transform = `translate3d(${pupilX}px, ${pupilY}px, 0)`
  })
}

function CloudMascot({ eyesClosed }: { eyesClosed: boolean }) {
  const eyesRef = useRef<Array<HTMLSpanElement | null>>([])
  const pupilsRef = useRef<Array<HTMLSpanElement | null>>([])
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const eyesClosedRef = useRef(eyesClosed)

  useEffect(() => {
    const updateEyes = (clientX: number, clientY: number, force = false) => {
      const previous = pointerRef.current
      pointerRef.current = { x: clientX, y: clientY }
      if (eyesClosedRef.current || (!force && previous?.x === clientX && previous.y === clientY)) return
      positionPupils(clientX, clientY, eyesRef.current, pupilsRef.current)
    }

    const updatePointer = (clientX: number, clientY: number) => {
      updateEyes(clientX, clientY)
    }

    const trackPointer = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") return
      updatePointer(event.clientX, event.clientY)
    }

    const trackMouse = (event: MouseEvent) => updatePointer(event.clientX, event.clientY)
    const refreshLayout = () => {
      const pointer = pointerRef.current
      if (pointer) updateEyes(pointer.x, pointer.y, true)
    }
    window.addEventListener("pointermove", trackPointer, { passive: true })
    window.addEventListener("mousemove", trackMouse, { passive: true })
    window.addEventListener("resize", refreshLayout)
    window.addEventListener("orientationchange", refreshLayout)

    return () => {
      window.removeEventListener("pointermove", trackPointer)
      window.removeEventListener("mousemove", trackMouse)
      window.removeEventListener("resize", refreshLayout)
      window.removeEventListener("orientationchange", refreshLayout)
    }
  }, [])

  useEffect(() => {
    eyesClosedRef.current = eyesClosed
    if (!eyesClosed && pointerRef.current) {
      const pointer = pointerRef.current
      positionPupils(pointer.x, pointer.y, eyesRef.current, pupilsRef.current)
    }
  }, [eyesClosed])

  return (
    <div className="relative mx-auto h-32 w-52" aria-hidden="true">
      <svg viewBox="0 0 240 140" className="absolute inset-0 h-full w-full drop-shadow-xl">
        <defs>
          <linearGradient id="cloud-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F4FAFF" />
            <stop offset="100%" stopColor="#DCEEFF" />
          </linearGradient>
        </defs>
        <path
          d="M49 112C22 112 10 96 10 75c0-20 15-36 36-38C54 16 74 5 99 8c21 2 35 16 41 35 6-5 14-8 23-8 20 0 36 15 38 34 17 2 29 14 29 31 0 18-14 32-37 32H49Z"
          fill="url(#cloud-fill)"
          stroke="#C7E4FF"
          strokeWidth="2"
        />
        <path d="M24 112h170" stroke="#B8DBFF" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {[0, 1].map((eye) => (
        <span
          key={eye}
          className="absolute top-[52px] flex h-9 w-7 items-center justify-center overflow-hidden rounded-full bg-[#D7ECFF] transition-[height,border-radius] duration-150"
          ref={(element) => { eyesRef.current[eye] = element }}
          style={{
            left: eye === 0 ? 77 : 125,
            height: eyesClosed ? 4 : 30,
            borderRadius: eyesClosed ? 4 : "50%",
          }}
        >
          <span
            ref={(element) => { pupilsRef.current[eye] = element }}
            className="h-3.5 w-3.5 rounded-full bg-slate-900"
            style={{
              transform: eyesClosed ? "scaleY(0)" : undefined,
              opacity: eyesClosed ? 0 : 1,
              transition: eyesClosed ? "transform 180ms ease, opacity 180ms ease" : "transform 55ms ease-out",
            }}
          />
        </span>
      ))}
      <span className="absolute left-[105px] top-[91px] h-1.5 w-4 rounded-full bg-[#9DD1FF]" />
    </div>
  )
}

export default function AuthScreen({
  busy,
  error,
  notice,
  onSignIn,
  onSignUp,
  onPublicTrack,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function switchMode(nextMode: AuthMode) {
    if (nextMode === "signup") {
      setEmail("")
      setPassword("")
      setShowPassword(false)
    }
    setMode(nextMode)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "signup") {
      await onSignUp(name.trim(), email.trim(), password)
      return
    }

    await onSignIn(email.trim(), password)
  }

  return (
    <main className="auth-shell">
      <div className="auth-decoration" aria-hidden="true" />
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-brand">
            <span className="auth-brand-mark">
              <Image src="/company-logo.svg" alt="" width={42} height={42} />
            </span>
            <span>
              <strong>Lautan Sejati</strong>
              <small>Trans Cargo</small>
            </span>
          </div>

          <div className="auth-brand-copy">
            <span className="auth-eyebrow"><Anchor size={14} /> LOGISTIK &amp; EKSPEDISI</span>
            <h1>Setiap perjalanan, terkelola dengan baik.</h1>
            <p>Masuk ke portal operasional untuk memantau pengiriman dan informasi bisnis Anda.</p>
          </div>

          <div className="auth-route-art" aria-hidden="true">
            <span className="route-line" />
            <span className="route-point route-point-start" />
            <span className="route-point route-point-end" />
            <span className="route-ship"><Anchor size={22} /></span>
            <span className="route-label route-label-start">JAKARTA</span>
            <span className="route-label route-label-end">NUSANTARA</span>
          </div>
          <p className="auth-brand-footer">CV. Lautan Sejati Trans Cargo</p>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-heading">
              {mode === "signup" && <CloudMascot eyesClosed={isTyping} />}
              <p className="auth-eyebrow auth-card-eyebrow">
                {mode === "signin" ? "SELAMAT DATANG KEMBALI" : "MULAI BERSAMA KAMI"}
              </p>
              <h2>{mode === "signin" ? "Masuk ke akun Anda" : "Buat akun baru"}</h2>
              <p className="auth-subtitle">
                {mode === "signin"
                  ? "Gunakan email dan kata sandi yang terdaftar."
                  : "Akun baru akan mendapat akses Staf Keuangan."}
              </p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Jenis autentikasi">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "auth-tab auth-tab-active" : "auth-tab"}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "auth-tab auth-tab-active" : "auth-tab"}
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} autoComplete={mode === "signup" ? "off" : "on"}>
              {mode === "signup" && (
                <label className="auth-field">
                  <span>Nama lengkap</span>
                  <span className="auth-input-wrap">
                    <UserRound size={17} />
                    <input
                      autoComplete={mode === "signup" ? "off" : "name"}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nama Anda"
                      required
                    />
                  </span>
                </label>
              )}

              <label className="auth-field">
                <span>Email</span>
                <span className="auth-input-wrap">
                  <Mail size={17} />
                  <input
                    type="email"
                    name={mode === "signup" ? "signup-email" : "email"}
                    autoComplete={mode === "signup" ? "off" : "email"}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@perusahaan.com"
                    required
                  />
                </span>
              </label>

              <div className="auth-field">
                <span>Kata sandi</span>
                <span className="auth-input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    type={showPassword ? "text" : "password"}
                    name={mode === "signup" ? "signup-new-password" : "current-password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    placeholder="Minimal 8 karakter"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    aria-pressed={showPassword}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </div>

              {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
              {notice && <p className="auth-message auth-message-notice" role="status">{notice}</p>}

              <button type="submit" className="auth-submit" disabled={busy}>
                <span>{busy ? "Memproses..." : mode === "signin" ? "Masuk" : "Buat akun"}</span>
                {!busy && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="auth-switch">
              {mode === "signin" ? "Belum punya akun?" : "Sudah terdaftar?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Daftar sekarang" : "Masuk"}
              </button>
            </p>

            <button type="button" className="auth-track-link" onClick={onPublicTrack}>
              Lacak pengiriman tanpa masuk
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
