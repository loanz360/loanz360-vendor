'use client'
export const dynamic = 'force-dynamic'

import React from 'react'
import { RoleSpecificRegisterForm, getSubRoleOptions } from '@/components/auth/role-specific-register-form'

export default function VendorsRegisterPage() {
  const subRoleOptions = getSubRoleOptions('VENDOR')

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <RoleSpecificRegisterForm
        role="VENDOR"
        roleTitle="Vendor"
        roleDescription="Partner with LOANZ 360 as a service vendor and expand your business opportunities in the financial sector."
        subRoleOptions={subRoleOptions}
      />
    </div>
  )
}