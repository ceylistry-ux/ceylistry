import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { brand } from './config/brand'
import { useMarketplace } from './context/Marketplace'
import { Header, Footer } from './components/Layout'
import { MarketplaceProvider } from './context/Marketplace'
const HomePage = lazy(() => import('./components/Sections').then(module => ({ default: module.HomePage })))
const { AboutPage, ArtistPage, ArtistsPage, ArtworkPage, ExplorePage, NotFoundPage, SellPage } = {
  AboutPage: lazy(() => import('./components/Pages').then(module => ({ default: module.AboutPage }))),
  ArtistPage: lazy(() => import('./components/Pages').then(module => ({ default: module.ArtistPage }))),
  ArtistsPage: lazy(() => import('./components/Pages').then(module => ({ default: module.ArtistsPage }))),
  ArtworkPage: lazy(() => import('./components/Pages').then(module => ({ default: module.ArtworkPage }))),
  ExplorePage: lazy(() => import('./components/Pages').then(module => ({ default: module.ExplorePage }))),
  NotFoundPage: lazy(() => import('./components/Pages').then(module => ({ default: module.NotFoundPage }))),
  SellPage: lazy(() => import('./components/Pages').then(module => ({ default: module.SellPage }))),
}
const StudioPage = lazy(() => import('./components/StudioPage').then(module => ({ default: module.StudioPage })))
function Seo(){const {pathname}=useLocation();const {artists,artworks}=useMarketplace();useEffect(()=>{const names:Record<string,string>={'/':'', '/explore':'Explore artwork','/artists':'Artists','/sell':'For artists','/studio':'Artist studio','/about':'About'};let title=names[pathname];let description=brand.seo.defaultDescription;if(pathname.startsWith('/artwork/')){const art=artworks.find(item=>item.slug===pathname.split('/')[2]);title=art?`${art.title} · Artwork`: 'Artwork';description=art?.description||description}else if(pathname.startsWith('/artists/')){const artist=artists.find(item=>item.slug===pathname.split('/')[2]);title=artist?`${artist.name} · Artist`:'Artist';description=artist?.bio||description}document.title=title?`${title} · ${brand.name}`:brand.seo.defaultTitle;document.querySelector('meta[name="description"]')?.setAttribute('content',description);document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);document.querySelector('meta[property="og:description"]')?.setAttribute('content',description);},[pathname,artists,artworks]);return null}
export default function App(){return <MarketplaceProvider><Seo/><a className="skip-link" href="#main-content">Skip to content</a><Header/><div id="main-content"><Suspense fallback={<main className="page-shell route-loading" aria-live="polite">Loading Ceylistry…</main>}><Routes><Route path="/" element={<HomePage/>}/><Route path="/explore" element={<ExplorePage/>}/><Route path="/artwork/:slug" element={<ArtworkPage/>}/><Route path="/artists" element={<ArtistsPage/>}/><Route path="/artists/:slug" element={<ArtistPage/>}/><Route path="/sell" element={<SellPage/>}/><Route path="/studio" element={<StudioPage/>}/><Route path="/about" element={<AboutPage/>}/><Route path="*" element={<NotFoundPage/>}/></Routes></Suspense></div><Footer/></MarketplaceProvider>}

