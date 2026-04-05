import { Metadata } from 'next'
import VendorProfileClient from './page-client'

export const metadata: Metadata = {
  title: 'My Profile | Vendor Portal - LOANZ 360',
  description: 'Manage your vendor profile and business information',
}

export default function VendorProfilePage() {
  return <VendorProfileClient />
}
