'use client'

import React, { useState, useEffect } from 'react'
import { HeaderLogo, FooterLogo } from '@/components/ui/logo'
import {
  Home,
  Briefcase,
  Users,
  Building2,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)

  // Hero carousel slides
  const slides = [
    {
      title: 'Your Financial Partner',
      subtitle: 'For Every Dream',
      description: 'Empowering your financial journey with tailored loan solutions',
      gradient: 'from-orange-500 via-red-500 to-pink-500'
    },
    {
      title: 'Fast Approvals',
      subtitle: 'Quick Disbursals',
      description: 'Get your loan approved in minutes, not days',
      gradient: 'from-blue-500 via-purple-500 to-pink-500'
    },
    {
      title: 'Competitive Rates',
      subtitle: 'Flexible Terms',
      description: 'Best interest rates with customized repayment options',
      gradient: 'from-green-500 via-teal-500 to-blue-500'
    }
  ]

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  // Handle scroll for header transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed Transparent Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-black/90 backdrop-blur-md shadow-lg shadow-orange-500/10'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex-shrink-0">
              <HeaderLogo />
            </div>

            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#home" className="text-white hover:text-orange-500 transition-colors font-medium">
                Home
              </a>
              <a href="#services" className="text-white hover:text-orange-500 transition-colors font-medium">
                Services
              </a>
              <a href="#about" className="text-white hover:text-orange-500 transition-colors font-medium">
                About
              </a>
              <a href="#login" className="text-white hover:text-orange-500 transition-colors font-medium">
                Login
              </a>
              <a
                href="#register"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full transition-all duration-300 font-semibold shadow-lg shadow-orange-500/50"
              >
                Register
              </a>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-white p-2"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-orange-500/20">
            <div className="px-4 py-6 space-y-4">
              <a
                href="#home"
                className="block text-white hover:text-orange-500 transition-colors font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </a>
              <a
                href="#services"
                className="block text-white hover:text-orange-500 transition-colors font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Services
              </a>
              <a
                href="#about"
                className="block text-white hover:text-orange-500 transition-colors font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </a>
              <a
                href="#login"
                className="block text-white hover:text-orange-500 transition-colors font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </a>
              <a
                href="#register"
                className="block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full transition-all duration-300 font-semibold text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Register
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section with Carousel */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
          </div>
        </div>

        {/* Carousel Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <div className="transition-all duration-700 ease-in-out">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 font-poppins">
              <span className={`bg-gradient-to-r ${slides[currentSlide].gradient} bg-clip-text text-transparent animate-gradient`}>
                {slides[currentSlide].title}
              </span>
            </h1>
            <h2 className="text-3xl md:text-5xl font-semibold mb-8 font-poppins">
              {slides[currentSlide].subtitle}
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              {slides[currentSlide].description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="#register"
                className="group bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-lg shadow-orange-500/50 hover:shadow-orange-500/80 hover:scale-105 flex items-center gap-2"
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#services"
                className="border-2 border-white hover:bg-white hover:text-black text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Carousel Controls */}
          <div className="flex items-center justify-center gap-4 mt-16">
            <button
              onClick={prevSlide}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    currentSlide === index
                      ? 'bg-orange-500 w-8'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={nextSlide}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-gradient-to-b from-black via-gray-900 to-black relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 font-poppins">
              <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                Our Services
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Comprehensive financial solutions tailored to your needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Service Card 1 */}
            <div className="group bg-gradient-to-br from-gray-900 to-black border border-orange-500/20 rounded-2xl p-8 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20 hover:scale-105">
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                <Shield className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3 font-poppins">Secure Platform</h3>
              <p className="text-gray-400">Bank-grade security for all your financial transactions</p>
            </div>

            {/* Service Card 2 */}
            <div className="group bg-gradient-to-br from-gray-900 to-black border border-orange-500/20 rounded-2xl p-8 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20 hover:scale-105">
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3 font-poppins">Quick Processing</h3>
              <p className="text-gray-400">Get approved in minutes with instant disbursals</p>
            </div>

            {/* Service Card 3 */}
            <div className="group bg-gradient-to-br from-gray-900 to-black border border-orange-500/20 rounded-2xl p-8 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20 hover:scale-105">
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3 font-poppins">Best Rates</h3>
              <p className="text-gray-400">Competitive interest rates with flexible terms</p>
            </div>

            {/* Service Card 4 */}
            <div className="group bg-gradient-to-br from-gray-900 to-black border border-orange-500/20 rounded-2xl p-8 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20 hover:scale-105">
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                <CheckCircle className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3 font-poppins">Easy Process</h3>
              <p className="text-gray-400">Simple documentation with minimal paperwork</p>
            </div>
          </div>
        </div>
      </section>

      {/* Login Section */}
      <section id="login" className="py-24 bg-black relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 font-poppins">
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                Login to Your Account
              </span>
            </h2>
            <p className="text-xl text-gray-400">Access your portal</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Customer Login */}
            <a
              href="/customers/auth/login"
              className="group bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 hover:border-orange-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 text-center"
            >
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:bg-orange-500/20 transition-colors">
                <Home className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2 font-poppins">Customer</h3>
              <p className="text-gray-400 text-sm mb-4">Apply for loans & manage applications</p>
              <div className="text-orange-500 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                Login <ArrowRight className="w-4 h-4" />
              </div>
            </a>

            {/* Partner Login */}
            <a
              href="/partners/auth/login"
              className="group bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 hover:border-orange-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 text-center"
            >
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:bg-orange-500/20 transition-colors">
                <Briefcase className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2 font-poppins">Partner</h3>
              <p className="text-gray-400 text-sm mb-4">Manage your business & clients</p>
              <div className="text-orange-500 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                Login <ArrowRight className="w-4 h-4" />
              </div>
            </a>

            {/* Employee Login */}
            <a
              href="/employees/auth/login"
              className="group bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 hover:border-orange-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 text-center"
            >
              <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:bg-orange-500/20 transition-colors">
                <Users className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2 font-poppins">Employee</h3>
              <p className="text-gray-400 text-sm mb-4">Access your work portal</p>
              <div className="text-orange-500 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                Login <ArrowRight className="w-4 h-4" />
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Register Section */}
      <section id="register" className="py-24 bg-gradient-to-b from-black via-gray-900 to-black relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 font-poppins">
              <span className="bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">
                Create New Account
              </span>
            </h2>
            <p className="text-xl text-gray-400">Join us today and start your journey</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Customer Register */}
            <a
              href="/customers/auth/register"
              className="group bg-gradient-to-br from-gray-900 to-black border-2 border-green-500/30 hover:border-green-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/30 hover:scale-105 text-center"
            >
              <div className="bg-green-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:bg-green-500/20 transition-colors">
                <Home className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2 font-poppins">Register as Customer</h3>
              <p className="text-gray-400 text-sm mb-4">Get instant access to loan services</p>
              <div className="text-green-500 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                Sign Up <ArrowRight className="w-4 h-4" />
              </div>
            </a>

            {/* Partner Register */}
            <a
              href="/partners/auth/register"
              className="group bg-gradient-to-br from-gray-900 to-black border-2 border-green-500/30 hover:border-green-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/30 hover:scale-105 text-center"
            >
              <div className="bg-green-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:bg-green-500/20 transition-colors">
                <Briefcase className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2 font-poppins">Register as Partner</h3>
              <p className="text-gray-400 text-sm mb-4">Become our business partner</p>
              <div className="text-green-500 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                Sign Up <ArrowRight className="w-4 h-4" />
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-orange-500/20 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Company Info */}
            <div className="md:col-span-1">
              <FooterLogo />
              <p className="mt-4 text-gray-400 text-sm leading-relaxed">
                Empowering your financial journey with trusted loan solutions and exceptional service.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold mb-4 font-poppins">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#home" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                    Home
                  </a>
                </li>
                <li>
                  <a href="#services" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#about" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#login" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                    Login
                  </a>
                </li>
                <li>
                  <a href="#register" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                    Register
                  </a>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="font-semibold mb-4 font-poppins">Our Services</h3>
              <ul className="space-y-2">
                <li className="text-gray-400 text-sm">Personal Loans</li>
                <li className="text-gray-400 text-sm">Business Loans</li>
                <li className="text-gray-400 text-sm">Home Loans</li>
                <li className="text-gray-400 text-sm">Vehicle Loans</li>
                <li className="text-gray-400 text-sm">Education Loans</li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-4 font-poppins">Contact Us</h3>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">support@loanz360.com</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">+1 (800) 360-LOAN</span>
                </li>
                <li className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">123 Financial Street, Business District</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="text-gray-400 text-sm">
                © {new Date().getFullYear()} Loanz360. All rights reserved.
              </div>
              <div className="flex space-x-6">
                <a href="#privacy" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                  Privacy Policy
                </a>
                <a href="#terms" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                  Terms of Service
                </a>
                <a href="#security" className="text-gray-400 hover:text-orange-500 transition-colors text-sm">
                  Security
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        @keyframes gradient {
          0%, 100% {
            background-size: 200% 200%;
            background-position: left center;
          }
          50% {
            background-size: 200% 200%;
            background-position: right center;
          }
        }

        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  )
}
