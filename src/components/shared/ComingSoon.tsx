'use client';
import { usePathname } from 'next/navigation';
export default function ComingSoon() {
  const pathname = usePathname();
  const pageName = pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Page';
  return (<div className="flex items-center justify-center min-h-[60vh]"><div className="text-center max-w-md"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/10 flex items-center justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6700" strokeWidth="1.5"><path d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg></div><h2 className="text-xl font-bold mb-2 capitalize">{pageName}</h2><p className="text-sm text-zinc-400">This module is under development and will be available soon.</p></div></div>);
}
