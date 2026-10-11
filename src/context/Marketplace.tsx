import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Artwork, Artist } from '../types'
import { artworks as demoArtworks, artists as demoArtists } from '../data/mockData'
import { getArtists, getArtworks } from '../data/marketplace'

type MarketplaceState = { artists: Artist[]; artworks: Artwork[]; loading: boolean; error: string | null }
const MarketplaceContext = createContext<MarketplaceState>({artists:demoArtists,artworks:demoArtworks,loading:false,error:null})

export function MarketplaceProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<MarketplaceState>({artists:demoArtists,artworks:demoArtworks,loading:true,error:null})
  useEffect(()=>{let active=true;Promise.all([getArtists(),getArtworks()]).then(([artists,artworks])=>{if(active){const useDemo=artists.length===0&&artworks.length===0;setState({artists:useDemo?demoArtists:artists,artworks:useDemo?demoArtworks:artworks,loading:false,error:null})}}).catch(error=>{if(active)setState({artists:demoArtists,artworks:demoArtworks,loading:false,error:error instanceof Error?error.message:'Could not load marketplace content'})});return()=>{active=false}},[])
  return <MarketplaceContext.Provider value={state}>{children}</MarketplaceContext.Provider>
}

export function useMarketplace(){return useContext(MarketplaceContext)}

