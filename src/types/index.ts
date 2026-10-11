export type Category = 'Illustrations' | 'Paintings' | 'Prints' | 'Original art' | 'Commissions'
export type Artwork = { id?:string; slug:string; title:string; artistSlug:string; category:Category; type:'Original'|'Print'|'Digital'; price:number; image:string; description:string; medium:string; dimensions:string; commission:boolean; demo?:boolean }
export type Artist = { id?:string; slug:string; name:string; location:string; bio:string; portrait:string; discipline:string; featured?:boolean; demo?:boolean }

