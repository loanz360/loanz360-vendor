'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { Home, Users, TrendingUp, MessageSquare, BarChart3 } from 'lucide-react'

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/employees/cro' },
  { icon: Users, label: 'Contacts', path: '/employees/cro/ai-crm/contacts' },
  { icon: TrendingUp, label: 'Leads', path: '/employees/cro/ai-crm/leads' },
  { icon: MessageSquare, label: 'Chat', path: '/employees/cro/chat' },
  { icon: BarChart3, label: 'More', path: '/employees/cro/performance' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = useCallback(
    (itemPath: string) => {
      if (itemPath === '/employees/cro') {
        return pathname === '/employees/cro' || pathname === '/employees/cro/'
      }
      return pathname.startsWith(itemPath)
    },
    [pathname]
  )

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path)
    },
    [router]
  )

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      {/* Glass-morphism background */}
      <div className="bg-gray-900/95 backdrop-blur-xl border-t border-white/10">
        <div
          className="flex items-center justify-around px-2 pt-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path)
            const Icon = item.icon

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`
                  flex flex-col items-center justify-center gap-0.5
                  min-w-[3.5rem] py-1.5 px-1 rounded-xl
                  transition-all duration-200 ease-out
                  active:scale-90
                  ${
                    active
                      ? 'text-[#FF6700]'
                      : 'text-gray-400 hover:text-gray-300'
                  }
                `}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {/* Active indicator dot */}
                <div className="relative">
                  <Icon
                    className={`
                      w-5 h-5 transition-all duration-200
                      ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}
                    `}
                  />
                  {active && (
                    <span
                      className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#FF6700]"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span
                  className={`
                    text-[10px] leading-tight font-medium transition-all duration-200
                    ${active ? 'font-semibold' : ''}
                  `}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
