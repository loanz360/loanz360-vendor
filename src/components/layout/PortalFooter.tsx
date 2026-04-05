'use client'

import React from 'react'
import { Heart, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram, Youtube } from 'lucide-react'
import Link from 'next/link'

export function PortalFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full relative overflow-hidden mt-auto border-t-2 border-orange-500/30">
      {/* Fintech Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-gray-900 to-black opacity-95"></div>
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px'
        }}
      ></div>

      {/* Animated Network Lines */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4 font-poppins">LOANZ 360</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Your trusted partner in financial solutions. We provide comprehensive loan services to help you achieve your dreams.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 hover:bg-orange-500 hover:border-orange-500 rounded-full flex items-center justify-center transition-all duration-300"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4 text-white" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 hover:bg-orange-500 hover:border-orange-500 rounded-full flex items-center justify-center transition-all duration-300"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4 text-white" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 hover:bg-orange-500 hover:border-orange-500 rounded-full flex items-center justify-center transition-all duration-300"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4 text-white" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 hover:bg-orange-500 hover:border-orange-500 rounded-full flex items-center justify-center transition-all duration-300"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 text-white" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 hover:bg-orange-500 hover:border-orange-500 rounded-full flex items-center justify-center transition-all duration-300"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4 text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-base mb-4 font-poppins">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Our Services
                </Link>
              </li>
              <li>
                <Link href="/loan-calculator" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Loan Calculator
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold text-base mb-4 font-poppins">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/help-center" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/grievance" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  Grievance Redressal
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold text-base mb-4 font-poppins">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-orange-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400 text-sm">
                  123 Financial District, Mumbai, Maharashtra 400001, India
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <a href="tel:+911234567890" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  +91 123 456 7890
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <a href="mailto:support@loanz360.com" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">
                  support@loanz360.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-blue-500/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-xs text-center md:text-left">
              © {currentYear} LOANZ 360. All rights reserved. | Powered by LOANZ 360 Technology
            </p>
            <div className="flex items-center gap-1 text-gray-500 text-xs">
              <span>Made with</span>
              <Heart className="w-3 h-3 text-red-500 fill-red-500" />
              <span>in India</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
