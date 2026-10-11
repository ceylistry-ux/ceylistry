import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/enquiry.css'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

export function EnquiryForm({ artistId, artworkId, artistName }: { artistId: string; artworkId?: string; artistName: string }) {
  const captchaRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const tokenRef = useRef('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!siteKey) return
    const render = () => {
      if (!window.turnstile || !captchaRef.current || widgetId.current) return
      widgetId.current = window.turnstile.render(captchaRef.current, {
        sitekey: siteKey,
        callback: token => { tokenRef.current = token; setCaptchaReady(true) },
        'expired-callback': () => { tokenRef.current = ''; setCaptchaReady(false) },
        'error-callback': () => { tokenRef.current = ''; setCaptchaReady(false) },
      })
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (existing) {
      if (window.turnstile) render()
      else existing.addEventListener('load', render, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.turnstile = 'true'
      script.addEventListener('load', render, { once: true })
      document.head.append(script)
    }
    return () => { if (widgetId.current) window.turnstile?.remove(widgetId.current) }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setBusy(true); setError(''); setMessage('')
    const form = new FormData(formElement)
    try {
      const { error: submitError } = await supabase!.functions.invoke('submit-enquiry', {
        body: { artistId, artworkId: artworkId || null, name: form.get('name'), email: form.get('email'), message: form.get('message'), captchaToken: tokenRef.current },
      })
      if (submitError) throw submitError
      setMessage(`Your note has been sent to ${artistName}.`)
      formElement.reset()
    } catch {
      setError('We couldn’t send that just now. Please try again in a moment.')
    } finally {
      setBusy(false)
      if (widgetId.current) window.turnstile?.reset(widgetId.current)
      tokenRef.current = ''; setCaptchaReady(false)
    }
  }

  return <section className="enquiry-panel" aria-labelledby="enquiry-title">
    <p className="eyebrow">A note for the artist</p><h2 id="enquiry-title">Ask about this work.</h2>
    <p>Send a private enquiry to {artistName}. This is not a purchase request.</p>
    {!siteKey || !supabase ? <div className="enquiry-setup">Enquiries are being set up and aren’t available yet.</div> : <form className="studio-form enquiry-form" onSubmit={submit}>
      <label>Your name<input name="name" autoComplete="name" required maxLength={120}/></label>
      <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label className="form-full">Message<textarea name="message" required minLength={10} maxLength={4000} rows={4}/></label>
      <div className="form-full"><div ref={captchaRef} aria-label="Spam protection verification"/></div>
      {error && <p className="studio-error" role="alert">{error}</p>}{message && <p className="studio-success" role="status">{message}</p>}
      <button className="button button-dark" type="submit" disabled={busy || !captchaReady}>{busy ? 'Sending…' : 'Send enquiry'} <Send size={15}/></button>
      <small className="enquiry-privacy">Your details are shared only with the artist and are not shown publicly.</small>
    </form>}
  </section>
}

