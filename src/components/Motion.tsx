import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
export function Reveal({children,className='',delay=0}:{children:ReactNode;className?:string;delay?:number}) {
 const reduce=useReducedMotion()
 return <motion.div className={className} initial={reduce?false:{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.15}} transition={{duration:reduce?0:.55,delay:reduce?0:delay,ease:[.22,1,.36,1]}}>{children}</motion.div>
}

