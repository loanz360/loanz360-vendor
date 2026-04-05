'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Lock,
  Eye,
  FileCheck,
  Sparkles,
  Building2,
  CheckCircle2
} from 'lucide-react'

interface TrustItem {
  icon: React.ElementType
  title: string
  description: string
}

const trustItems: TrustItem[] = [
  {
    icon: Lock,
    title: '256-bit AES Encryption',
    description: 'Same encryption used by banks and military'
  },
  {
    icon: Building2,
    title: 'RBI Regulated',
    description: 'We follow all Reserve Bank of India guidelines'
  },
  {
    icon: Eye,
    title: 'Zero Data Selling',
    description: 'We NEVER share or sell your personal information'
  },
  {
    icon: FileCheck,
    title: 'GDPR & IT Act Compliant',
    description: 'Your right to privacy is protected by law'
  }
]

const certifications = [
  'ISO 27001',
  'SOC 2 Type II (Coming)',
  'PCI DSS Ready'
]

export default function TrustSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="mt-8 rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Your Data is Absolutely Safe</h3>
      </div>

      {/* Trust Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {trustItems.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800/50"
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">{item.title}</h4>
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Coming Soon Feature */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.1 }}
        className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-5"
      >
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-purple-300">Coming Soon: End-to-End Encryption</h4>
          <p className="text-xs text-gray-400 mt-0.5">Where only YOU hold the decryption keys</p>
        </div>
      </motion.div>

      {/* Certifications */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-500">Certifications:</span>
        {certifications.map((cert, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 1.2 + index * 0.1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800/50 border border-gray-700/50"
          >
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span className="text-xs text-gray-300">{cert}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
