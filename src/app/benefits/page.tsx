'use client'

import { Award, ArrowLeft, Crown, Shield, Star, Zap, Gift, TrendingUp, CheckCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function VendorBenefitsPage() {
  const tiers = [
    {
      name: 'Basic',
      icon: Shield,
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30',
      active: false,
      benefits: [
        'Standard service rates',
        'Email support',
        'Basic reporting',
        'Up to 5 active contracts',
      ],
    },
    {
      name: 'Standard',
      icon: Star,
      color: 'text-[#FF6700]',
      bg: 'bg-[#FF6700]/20',
      borderColor: 'border-[#FF6700]/30',
      active: false,
      benefits: [
        'Competitive service rates',
        'Priority email support',
        'Advanced reporting & analytics',
        'Up to 15 active contracts',
        'Monthly performance bonus',
      ],
    },
    {
      name: 'Premium',
      icon: Crown,
      color: 'text-[#FF6700]',
      bg: 'bg-[#FF6700]/20',
      borderColor: 'border-[#FF6700]/30',
      active: false,
      benefits: [
        'Premium service rates',
        '24/7 priority support',
        'Full analytics dashboard',
        'Unlimited active contracts',
        'Quarterly performance bonus',
        'Priority contract allocation',
        'Featured vendor badge',
      ],
    },
    {
      name: 'Elite',
      icon: Award,
      color: 'text-gray-300',
      bg: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30',
      active: false,
      benefits: [
        'Highest service rates',
        'Dedicated account manager',
        'Custom reporting',
        'Unlimited everything',
        'Annual performance bonus',
        'First-priority allocation',
        'Elite vendor badge',
        'Exclusive partner events',
      ],
    },
  ]

  const perks = [
    { icon: Gift, label: 'Referral Bonus', description: 'Earn bonuses for referring new vendors', color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { icon: TrendingUp, label: 'Growth Support', description: 'Training and development resources', color: 'text-green-400', bg: 'bg-green-500/20' },
    { icon: Zap, label: 'Fast Payouts', description: 'Accelerated payment processing', color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { icon: Shield, label: 'Insurance Coverage', description: 'Professional indemnity coverage', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  ]

  return (
    <div className="min-h-screen bg-black font-poppins text-xs">
      {/* Header */}
      <header className="bg-black border-b border-neutral-800 p-6">
        <div className="flex items-center space-x-4">
          <Link href="/vendors">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white font-poppins">Benefits & Tiers</h1>
            <p className="text-gray-400 text-sm mt-1">Explore vendor tiers, rewards, and partnership perks</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Current Tier */}
        <Card className="bg-brand-ash border-[#FF6700]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center">
                  <Lock className="w-7 h-7 text-gray-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Your Current Tier</p>
                  <h2 className="text-white text-lg font-bold">Not Assigned</h2>
                  <p className="text-gray-500 text-xs mt-1">Complete your profile and start services to get tier assignment</p>
                </div>
              </div>
              <Badge variant="closed">Pending</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tier Cards */}
        <div>
          <h2 className="text-white font-semibold text-sm mb-4">Vendor Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <Card key={tier.name} className={`bg-brand-ash ${tier.borderColor}`}>
                <CardContent className="p-5">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-10 h-10 ${tier.bg} rounded-lg flex items-center justify-center`}>
                      <tier.icon className={`w-5 h-5 ${tier.color}`} />
                    </div>
                    <h3 className={`font-bold text-sm ${tier.color}`}>{tier.name}</h3>
                  </div>
                  <ul className="space-y-2">
                    {tier.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <CheckCircle className="w-3.5 h-3.5 text-neutral-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-400 text-xs">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Additional Perks */}
        <div>
          <h2 className="text-white font-semibold text-sm mb-4">Additional Perks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {perks.map((perk) => (
              <Card key={perk.label} className="bg-brand-ash">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 ${perk.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <perk.icon className={`w-5 h-5 ${perk.color}`} />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">{perk.label}</h3>
                  <p className="text-gray-400 text-xs">{perk.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
