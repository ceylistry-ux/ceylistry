import type { Artwork, Artist } from '../types'
import { supabase } from '../lib/supabase'
import { artworks as demoArtworks, artists as demoArtists } from './mockData'

async function signedImage(path: string | null | undefined, fallback: string): Promise<string> {
  if (!path || !supabase) return fallback
  const { data, error } = await supabase.storage.from('artwork-images').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Read approved public marketplace records; the prototype collection remains visible until the first artist is approved. */
export async function getArtists(): Promise<Artist[]> {
  if (!supabase) return demoArtists
  const { data, error } = await supabase.from('artists').select('id,slug,name,location,bio,portrait_path,discipline,featured').eq('status','approved').order('featured',{ascending:false}).order('name')
  if (error) throw error
  if (!data?.length) return []
  return Promise.all(data.map(async row=>({id:row.id,slug:row.slug,name:row.name,location:row.location,bio:row.bio,portrait:await signedImage(row.portrait_path,'/art/portrait-maya.svg'),discipline:row.discipline,featured:row.featured,demo:false})))
}

/** Read approved artworks belonging to approved artist profiles. */
export async function getArtworks(): Promise<Artwork[]> {
  if (!supabase) return demoArtworks
  const { data, error } = await supabase.from('artworks').select('id,slug,title,artist_id,category,type,price_lkr,image_path,description,medium,dimensions,commission,artists!inner(slug,status)').eq('status','approved').eq('artists.status','approved').order('created_at',{ascending:false})
  if (error) throw error
  if (!data?.length) return []
  return Promise.all(data.map(async row=>({id:row.id,slug:row.slug,title:row.title,artistSlug:(row.artists as unknown as {slug:string}).slug,category:row.category,type:row.type,price:Number(row.price_lkr),image:await signedImage(row.image_path,'/art/about-collage.svg'),description:row.description,medium:row.medium,dimensions:row.dimensions,commission:row.commission,demo:false}))) as Promise<Artwork[]>
}

