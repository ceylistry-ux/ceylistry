import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LogOut, Upload } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { brand } from '../config/brand'

type ArtistRecord = { id: string; name: string; slug: string; status: string }
type ListingRecord = { id: string; title: string; status: string; slug: string }
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function StudioPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [artist, setArtist] = useState<ArtistRecord | null>(null)
  const [listings, setListings] = useState<ListingRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) { setUser(data.session?.user ?? null); setChecking(false) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setArtist(null); setListings([]); return }
    let active = true
    async function load() {
      if (!supabase) return
      const { data: profile, error: profileError } = await supabase.from('artists').select('id,name,slug,status').eq('user_id', user!.id).maybeSingle()
      if (!active) return
      if (profileError) { setError(profileError.message); return }
      setArtist(profile)
      if (profile) {
        const { data, error: listingError } = await supabase.from('artworks').select('id,title,status,slug').eq('artist_id', profile.id).order('created_at', { ascending: false })
        if (!active) return
        if (listingError) setError(listingError.message)
        else setListings(data ?? [])
      }
    }
    void load()
    return () => { active = false }
  }, [user])

  async function sendLink(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase) return
    setBusy(true)
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/studio` } })
    setBusy(false)
    if (authError) setError(authError.message)
    else setSent(true)
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase || !user) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const slug = slugify(String(form.get('slug') || name))
    setBusy(true)
    const { data, error: insertError } = await supabase.from('artists').insert({ user_id: user.id, slug, name, location: String(form.get('location') || '').trim(), discipline: String(form.get('discipline') || '').trim(), bio: String(form.get('bio') || '').trim() }).select('id,name,slug,status').single()
    if (!insertError && data) {
      const { error: submitError } = await supabase.from('artists').update({ status: 'pending' }).eq('id', data.id)
      if (submitError) setError(submitError.message)
      else { setArtist({ ...data, status: 'pending' }); setMessage('Your artist profile is submitted for review.') }
    } else setError(insertError?.message || 'Could not create artist profile.')
    setBusy(false)
  }

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase || !user || !artist) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const file = form.get('image')
    if (!(file instanceof File) || !file.size) { setError('Choose an artwork image to continue.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Use a JPG, PNG or WebP image up to 10 MB.'); return }
    const title = String(form.get('title') || '').trim()
    const path = `${user.id}/${crypto.randomUUID()}-${slugify(file.name)}`
    setBusy(true)
    const { error: uploadError } = await supabase.storage.from('artwork-images').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) { setError(uploadError.message); setBusy(false); return }
    const values = { artist_id: artist.id, slug: `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`, title, category: String(form.get('category')), type: String(form.get('type')), price_lkr: Number(form.get('price')), image_path: path, description: String(form.get('description') || '').trim(), medium: String(form.get('medium') || '').trim(), dimensions: String(form.get('dimensions') || '').trim(), commission: form.get('commission') === 'on' }
    const { data, error: insertError } = await supabase.from('artworks').insert(values).select('id,title,status,slug').single()
    if (!insertError && data) {
      const { error: submitError } = await supabase.from('artworks').update({ status: 'pending' }).eq('id', data.id)
      if (submitError) setError(submitError.message)
      else { setListings(current => [ { ...data, status: 'pending' }, ...current ]); setMessage('Your artwork is submitted for review.'); formElement.reset() }
    } else setError(insertError?.message || 'Could not create artwork listing.')
    setBusy(false)
  }

  if (!supabase) return <main className="page-shell studio-page"><p className="eyebrow">Artist studio</p><h1>Connect is almost ready.</h1><p>Add the Supabase URL and publishable key to your local environment to enable artist sign-in.</p></main>
  if (checking) return <main className="page-shell studio-page"><p>Checking your sign-in…</p></main>
  if (!user) return <main className="page-shell studio-page"><Link to="/sell" className="back-link">← For artists</Link><div className="studio-intro"><p className="eyebrow">Artist studio</p><h1>Make a little room<br/><em>for your work.</em></h1><p>Sign in with a one-time email link to create an artist profile and submit work for review.</p></div><form className="studio-form studio-login" onSubmit={sendLink}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><button className="button button-dark" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'} <ArrowRight size={16}/></button>{sent && <p role="status">Check your inbox for the sign-in link. You can close this tab and return here after signing in.</p>}</form>{error && <p className="studio-error" role="alert">{error}</p>}<p className="demo-note">Artist tools are in pilot. Profiles and artwork are public only after review.</p></main>

  const client = supabase
  return <main className="page-shell studio-page"><div className="studio-top"><div><p className="eyebrow">Artist studio · {brand.name}</p><h1>Your creative <em>space.</em></h1><p>{user.email}</p></div><button className="text-link studio-signout" onClick={() => client.auth.signOut()}><LogOut size={15}/> Sign out</button></div>{message && <p className="studio-success" role="status">{message}</p>}{error && <p className="studio-error" role="alert">{error}</p>}{!artist ? <section className="studio-panel"><p className="eyebrow">First, a little introduction</p><h2>Create your artist profile</h2><p>Submitted profiles are reviewed before appearing in the directory.</p><form className="studio-form" onSubmit={createProfile}><label>Artist or studio name<input name="name" maxLength={100} required/></label><label>Profile URL<input name="slug" pattern="[a-zA-Z0-9-]+" placeholder="leave blank to use your name"/></label><label>Location<input name="location" maxLength={120} placeholder="City or region"/></label><label>Creative practice<input name="discipline" maxLength={100} placeholder="Illustration, painting…"/></label><label className="form-full">Short biography<textarea name="bio" maxLength={2000} rows={5} required/></label><button className="button button-dark" disabled={busy}>{busy ? 'Submitting…' : 'Create profile and submit'} <ArrowRight size={16}/></button></form></section> : <><section className="studio-panel studio-status"><div><p className="eyebrow">Your artist profile</p><h2>{artist.name}</h2><p>Profile review status: <strong>{artist.status}</strong></p></div>{artist.status === 'approved' && <Link to={`/artists/${artist.slug}`} className="text-link">View public profile <ArrowRight size={15}/></Link>}</section><section className="studio-panel"><p className="eyebrow">Add to your collection</p><h2>Submit artwork</h2><p>Artwork is reviewed before publication. Upload a JPG, PNG or WebP image up to 10 MB.</p><form className="studio-form" onSubmit={createListing}><label>Artwork title<input name="title" maxLength={160} required/></label><label>Category<select name="category" required><option>Illustrations</option><option>Paintings</option><option>Prints</option><option>Original art</option><option>Commissions</option></select></label><label>Artwork type<select name="type" required><option>Original</option><option>Print</option><option>Digital</option></select></label><label>Price (LKR)<input name="price" type="number" min="1" step="1" required/></label><label>Medium<input name="medium" maxLength={160} placeholder="Watercolour on paper"/></label><label>Format or dimensions<input name="dimensions" maxLength={120} placeholder="A4 · 21 × 29.7 cm"/></label><label className="form-full">Description<textarea name="description" maxLength={4000} rows={4} required/></label><label className="form-full">Artwork image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required/></label><label className="check-filter"><input name="commission" type="checkbox"/> I’m open to commission enquiries</label><button className="button button-dark" disabled={busy}>{busy ? 'Submitting…' : 'Upload and submit for review'} <Upload size={16}/></button></form></section><section className="studio-panel"><p className="eyebrow">Your submissions</p><h2>Artwork review</h2>{listings.length ? <ul className="submission-list">{listings.map(item => <li key={item.id}><span>{item.title}</span><span className={`status-pill status-${item.status}`}>{item.status}</span></li>)}</ul> : <p>No artwork submissions yet.</p>}</section></>}</main>
}

