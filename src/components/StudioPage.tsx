import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LogOut, Pencil, Upload, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { brand } from '../config/brand'

type ArtistRecord = { id: string; name: string; slug: string; location: string; discipline: string; bio: string; status: string }
type ListingRecord = { id: string; title: string; status: string; slug: string; category: string; type: string; price_lkr: number; image_path: string; description: string; medium: string; dimensions: string; commission: boolean }
const artistFields = 'id,name,slug,location,discipline,bio,status'
const listingFields = 'id,title,status,slug,category,type,price_lkr,image_path,description,medium,dimensions,commission'
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function StudioPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [artist, setArtist] = useState<ArtistRecord | null>(null)
  const [listings, setListings] = useState<ListingRecord[]>([])
  const [editingArtist, setEditingArtist] = useState(false)
  const [editingListing, setEditingListing] = useState<ListingRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) { setUser(data.session?.user ?? null); setChecking(false) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setArtist(null); setListings([]); return }
    let active = true
    async function load() {
      if (!supabase) return
      setError('')
      const { data: profile, error: profileError } = await supabase.from('artists').select(artistFields).eq('user_id', user!.id).maybeSingle()
      if (!active) return
      if (profileError) { setError(profileError.message); return }
      setArtist(profile)
      if (!profile) { setListings([]); return }
      const { data, error: listingError } = await supabase.from('artworks').select(listingFields).eq('artist_id', profile.id).order('created_at', { ascending: false })
      if (!active) return
      if (listingError) setError(listingError.message)
      else setListings((data ?? []) as ListingRecord[])
    }
    void load()
    return () => { active = false }
  }, [user])

  async function sendLink(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setSent(false)
    if (!supabase) return
    setBusy(true)
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/studio` } })
    setBusy(false)
    if (authError) setError(authError.message)
    else setSent(true)
  }

  async function saveArtist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase || !user) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const slug = slugify(String(form.get('slug') || name))
    if (!slug) { setError('Add a name that can be used for your profile URL.'); return }
    const values = { slug, name, location: String(form.get('location') || '').trim(), discipline: String(form.get('discipline') || '').trim(), bio: String(form.get('bio') || '').trim() }
    setBusy(true)
    if (artist) {
      const { data, error: updateError } = await supabase.from('artists').update({ ...values, status: 'pending' }).eq('id', artist.id).select(artistFields).single()
      if (updateError) setError(updateError.message)
      else if (data) { setArtist(data); setEditingArtist(false); setMessage(data.status === 'pending' ? 'Your profile changes are submitted for review.' : 'Your profile is up to date.') }
    } else {
      const { data, error: insertError } = await supabase.from('artists').insert({ ...values, user_id: user.id }).select(artistFields).single()
      if (insertError) setError(insertError.message)
      else if (data) {
        const { error: submitError } = await supabase.from('artists').update({ status: 'pending' }).eq('id', data.id)
        if (submitError) { setArtist(data); setError(submitError.message) }
        else { setArtist({ ...data, status: 'pending' }); setMessage('Your artist profile is submitted for review.') }
      }
    }
    setBusy(false)
  }

  async function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase || !user || !artist) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const file = form.get('image')
    if (!editingListing && (!(file instanceof File) || !file.size)) { setError('Choose an artwork image to continue.'); return }
    if (file instanceof File && file.size && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) { setError('Use a JPG, PNG or WebP image up to 10 MB.'); return }
    const title = String(form.get('title') || '').trim()
    let imagePath = editingListing?.image_path ?? ''
    setBusy(true)
    if (file instanceof File && file.size) {
      imagePath = `${user.id}/${crypto.randomUUID()}-${slugify(file.name)}`
      const { error: uploadError } = await supabase.storage.from('artwork-images').upload(imagePath, file, { contentType: file.type, upsert: false })
      if (uploadError) { setError(uploadError.message); setBusy(false); return }
    }
    const values = { slug: editingListing?.slug ?? `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`, title, category: String(form.get('category')), type: String(form.get('type')), price_lkr: Number(form.get('price')), image_path: imagePath, description: String(form.get('description') || '').trim(), medium: String(form.get('medium') || '').trim(), dimensions: String(form.get('dimensions') || '').trim(), commission: form.get('commission') === 'on' }
    const result = editingListing
      ? await supabase.from('artworks').update({ ...values, status: 'pending' }).eq('id', editingListing.id).select(listingFields).single()
      : await supabase.from('artworks').insert({ ...values, artist_id: artist.id }).select(listingFields).single()
    if (result.error) {
      setError(result.error.message)
      if (imagePath && imagePath !== editingListing?.image_path) await supabase.storage.from('artwork-images').remove([imagePath])
    } else if (result.data) {
      let saved = result.data as ListingRecord
      if (!editingListing) {
        const { error: submitError } = await supabase.from('artworks').update({ status: 'pending' }).eq('id', saved.id)
        if (submitError) setError(submitError.message)
        else saved = { ...saved, status: 'pending' }
      }
      setListings(current => editingListing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditingListing(null); formElement.reset(); setMessage(editingListing ? 'Your artwork changes are submitted for review.' : 'Your artwork is submitted for review.')
    }
    setBusy(false)
  }

  if (!supabase) return <main className="page-shell studio-page"><p className="eyebrow">Artist studio</p><h1>Connect is almost ready.</h1><p>Add the Supabase URL and publishable key to your local environment to enable artist sign-in.</p></main>
  if (checking) return <main className="page-shell studio-page"><p>Checking your sign-in…</p></main>
  if (!user) return <main className="page-shell studio-page"><Link to="/sell" className="back-link">← For artists</Link><div className="studio-intro"><p className="eyebrow">Artist studio</p><h1>Make a little room<br/><em>for your work.</em></h1><p>Sign in with a one-time email link to create an artist profile and submit work for review.</p></div><form className="studio-form studio-login" onSubmit={sendLink}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><button className="button button-dark" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'} <ArrowRight size={16}/></button>{sent && <p role="status">Check your inbox for the sign-in link. You can close this tab and return here after signing in.</p>}</form>{error && <p className="studio-error" role="alert">{error}</p>}<p className="demo-note">Artist tools are in pilot. Profiles and artwork are public only after review.</p></main>

  const client = supabase
  return <main className="page-shell studio-page"><div className="studio-top"><div><p className="eyebrow">Artist studio · {brand.name}</p><h1>Your creative <em>space.</em></h1><p>{user.email}</p></div><button className="text-link studio-signout" onClick={() => client.auth.signOut()}><LogOut size={15}/> Sign out</button></div>{message && <p className="studio-success" role="status">{message}</p>}{error && <p className="studio-error" role="alert">{error}</p>}
    {!artist ? <section className="studio-panel"><p className="eyebrow">First, a little introduction</p><h2>Create your artist profile</h2><p>Submitted profiles are reviewed before appearing in the directory.</p><ArtistForm onSubmit={saveArtist} busy={busy}/></section> : <>
      <section className="studio-panel studio-status"><div><p className="eyebrow">Your artist profile</p><h2>{artist.name}</h2><p>Profile review status: <strong className={`status-text status-${artist.status}`}>{artist.status}</strong></p></div><div className="studio-row-actions">{artist.status === 'approved' && <Link to={`/artists/${artist.slug}`} className="text-link">View public profile <ArrowRight size={15}/></Link>}<button className="text-link studio-action" onClick={() => setEditingArtist(value => !value)}>{editingArtist ? <X size={15}/> : <Pencil size={15}/>} {editingArtist ? 'Close editor' : 'Edit profile'}</button></div></section>
      {editingArtist && <section className="studio-panel"><p className="eyebrow">Update your artist details</p><ArtistForm artist={artist} onSubmit={saveArtist} busy={busy}/></section>}
      <section className="studio-panel"><p className="eyebrow">Add to your collection</p><h2>{editingListing ? 'Edit artwork' : 'Submit artwork'}</h2><p>Submissions are reviewed before publication. Upload a JPG, PNG or WebP image up to 10 MB.</p>{editingListing && <button className="text-link studio-action" onClick={() => setEditingListing(null)}><X size={15}/> Cancel editing</button>}<ListingForm key={editingListing?.id ?? 'new-listing'} listing={editingListing} onSubmit={saveListing} busy={busy}/></section>
      <section className="studio-panel"><p className="eyebrow">Your submissions</p><h2>Artwork review</h2>{listings.length ? <ul className="submission-list">{listings.map(item => <li key={item.id}><span>{item.title}</span><span className={`status-pill status-${item.status}`}>{item.status}</span><button className="text-link studio-action" onClick={() => setEditingListing(item)} aria-label={`Edit ${item.title}`}><Pencil size={14}/><span className="edit-label">Edit</span></button></li>)}</ul> : <p>No artwork submissions yet.</p>}</section>
    </>}</main>
}

function ArtistForm({ artist, onSubmit, busy }: { artist?: ArtistRecord; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form className="studio-form" onSubmit={onSubmit}><label>Artist or studio name<input name="name" maxLength={100} required defaultValue={artist?.name}/></label><label>Profile URL<input name="slug" pattern="[a-zA-Z0-9-]+" placeholder="leave blank to use your name" defaultValue={artist?.slug}/></label><label>Location<input name="location" maxLength={120} placeholder="City or region" defaultValue={artist?.location}/></label><label>Creative practice<input name="discipline" maxLength={100} placeholder="Illustration, painting…" defaultValue={artist?.discipline}/></label><label className="form-full">Short biography<textarea name="bio" maxLength={2000} rows={5} required defaultValue={artist?.bio}/></label><button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : artist ? 'Save and submit for review' : 'Create profile and submit'} <ArrowRight size={16}/></button></form>
}

function ListingForm({ listing, onSubmit, busy }: { listing: ListingRecord | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form className="studio-form" onSubmit={onSubmit}><label>Artwork title<input name="title" maxLength={160} required defaultValue={listing?.title}/></label><label>Category<select name="category" required defaultValue={listing?.category ?? 'Illustrations'}><option>Illustrations</option><option>Paintings</option><option>Prints</option><option>Original art</option><option>Commissions</option></select></label><label>Artwork type<select name="type" required defaultValue={listing?.type ?? 'Original'}><option>Original</option><option>Print</option><option>Digital</option></select></label><label>Price (LKR)<input name="price" type="number" min="1" step="1" required defaultValue={listing?.price_lkr}/></label><label>Medium<input name="medium" maxLength={160} placeholder="Watercolour on paper" defaultValue={listing?.medium}/></label><label>Format or dimensions<input name="dimensions" maxLength={120} placeholder="A4 · 21 × 29.7 cm" defaultValue={listing?.dimensions}/></label><label className="form-full">Description<textarea name="description" maxLength={4000} rows={4} required defaultValue={listing?.description}/></label><label className="form-full">Artwork image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!listing}/>{listing && <small>Current image is kept unless you choose a replacement.</small>}</label><label className="check-filter"><input name="commission" type="checkbox" defaultChecked={listing?.commission}/> I’m open to commission enquiries</label><button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : listing ? 'Save and submit for review' : 'Upload and submit for review'} <Upload size={16}/></button></form>
}

