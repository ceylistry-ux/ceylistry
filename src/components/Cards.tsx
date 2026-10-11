import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { artistFor } from '../data/mockData'
import type { Artwork, Artist } from '../types'
import { Reveal } from './Motion'
import { useMarketplace } from '../context/Marketplace'
export function ArtCard({art,index=0}:{art:Artwork;index?:number}){const {artists}=useMarketplace();const artist=artists.find(item=>item.slug===art.artistSlug)||artistFor(art.artistSlug);const artistName=artist?.name||'Independent artist';return <Reveal className="art-card" delay={(index%4)*.07}><Link to={`/artwork/${art.slug}`} className="art-image-wrap"><img src={art.image} alt={`${art.title}, a ${art.category.toLowerCase()} by ${artistName}`} loading="lazy"/><span className="art-type">{art.type}</span><span className="image-arrow" aria-hidden="true"><ArrowUpRight size={18}/></span></Link><div className="art-meta"><div><Link to={`/artwork/${art.slug}`} className="art-title">{art.title}</Link>{artist&&<Link to={`/artists/${artist.slug}`} className="art-artist">by {artist.name}</Link>}</div><span className="art-price">LKR {art.price.toLocaleString()}</span></div></Reveal>}
export function ArtistCard({artist}:{artist:Artist}){return <Link to={`/artists/${artist.slug}`} className="artist-card"><img src={artist.portrait} alt={`Illustrated portrait of ${artist.name}`} loading="lazy"/><span className="artist-card-copy"><strong>{artist.name}</strong><span>{artist.discipline} · {artist.location.split(',')[0]}</span></span><ArrowUpRight size={18}/></Link>}

