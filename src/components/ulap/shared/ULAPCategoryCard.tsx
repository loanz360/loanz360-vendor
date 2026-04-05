/**
 * ULAP Category Card - Shared Glassmorphism Card Component
 *
 * A unified, reusable card component for loan category selection.
 * This component is used across all ULAP forms (BA, BP, Customer, Employee portals).
 *
 * Features:
 * - Glassmorphism (frosted glass) design
 * - Solid gradient icons with unique colors per category
 * - Bank/NBFC count badge
 * - 2-3 line descriptions
 * - Smooth animations with Framer Motion
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

// =====================================================
// TYPES
// =====================================================

export interface ULAPCategoryCardProps {
  /** Category ID */
  id: string;
  /** Category name */
  name: string;
  /** Category description */
  description?: string;
  /** Category color (hex) */
  color?: string;
  /** Number of subcategories/loan types */
  subcategoryCount?: number;
  /** Number of banks/NBFCs partnered */
  bankCount?: number;
  /** Click handler */
  onSelect: () => void;
  /** Animation delay for staggered entrance */
  animationDelay?: number;
}

export interface ULAPSubcategoryCardProps {
  /** Subcategory ID */
  id: string;
  /** Subcategory name */
  name: string;
  /** Subcategory description */
  description?: string;
  /** Parent category ID */
  categoryId?: string;
  /** Parent category color */
  categoryColor?: string;
  /** Minimum loan amount */
  minAmount?: number;
  /** Maximum loan amount */
  maxAmount?: number;
  /** Click handler */
  onSelect: () => void;
  /** Animation delay for staggered entrance */
  animationDelay?: number;
}

// =====================================================
// CATEGORY ICONS - Solid SVG icons for each loan type
// =====================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'personal_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  'business_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  'home_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  'mortgage_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'vehicle_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  'machinery_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
    </svg>
  ),
  'professional_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  'nri_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  'educational_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  'institution_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  'working_capital': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  'loan_against_rentals': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  'builder_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'women_professional_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" />
    </svg>
  ),
  'govt_schemes': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

// Default icon for unmapped categories
const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// =====================================================
// CATEGORY COLOR MAPPING - Unique colors per category
// =====================================================

export const CATEGORY_COLORS: Record<string, string> = {
  'personal_loans': '#3B82F6',      // Blue
  'business_loans': '#8B5CF6',      // Purple
  'home_loans': '#10B981',          // Emerald
  'mortgage_loans': '#F59E0B',      // Amber
  'vehicle_loans': '#EF4444',       // Red
  'machinery_loans': '#6366F1',     // Indigo
  'professional_loans': '#EC4899',  // Pink
  'nri_loans': '#14B8A6',           // Teal
  'educational_loans': '#06B6D4',   // Cyan
  'institution_loans': '#A855F7',   // Violet
  'working_capital': '#F97316',     // Orange
  'loan_against_rentals': '#84CC16', // Lime
  'builder_loans': '#0EA5E9',       // Sky Blue
  'women_professional_loans': '#D946EF', // Fuchsia
  'govt_schemes': '#22C55E',        // Green
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Get icon for a category by ID */
export const getCategoryIcon = (categoryId: string): React.ReactNode => {
  return CATEGORY_ICONS[categoryId] || DEFAULT_ICON;
};

/** Get color for a category by ID */
export const getCategoryColor = (categoryId: string, fallbackColor?: string): string => {
  return CATEGORY_COLORS[categoryId] || fallbackColor || '#f97316';
};

// =====================================================
// CATEGORY CARD COMPONENT - Glassmorphism Design
// =====================================================

export const ULAPCategoryCard: React.FC<ULAPCategoryCardProps> = ({
  id,
  name,
  description,
  color: providedColor,
  subcategoryCount = 0,
  bankCount = 0,
  onSelect,
  animationDelay = 0,
}) => {
  const color = providedColor || getCategoryColor(id);

  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-2xl overflow-hidden text-left w-full h-full flex flex-col min-h-[280px]"
    >
      {/* Glassmorphism background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `linear-gradient(145deg, rgba(30,30,35,0.9) 0%, rgba(20,20,25,0.95) 100%)`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />

      {/* Subtle color tint overlay */}
      <div
        className="absolute inset-0 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"
        style={{
          background: `linear-gradient(145deg, ${color}15 0%, transparent 60%)`,
        }}
      />

      {/* Animated border glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{
          boxShadow: `inset 0 0 0 1.5px ${color}60, 0 0 40px ${color}15, 0 8px 32px rgba(0,0,0,0.4)`,
        }}
      />

      {/* Default subtle border */}
      <div className="absolute inset-0 rounded-2xl border border-white/10 group-hover:border-transparent transition-colors duration-300" />

      {/* Content */}
      <div className="relative p-5 flex flex-col h-full z-10">
        {/* Icon Container with solid gradient background */}
        <div className="relative mb-4">
          <motion.div
            className="w-14 h-14 rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
              boxShadow: `0 4px 20px ${color}40`,
            }}
            whileHover={{ scale: 1.1, rotate: [0, -3, 3, 0] }}
            transition={{ duration: 0.4 }}
          >
            {/* Inner glow */}
            <div
              className="absolute inset-0 rounded-xl opacity-50"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${color}80 0%, transparent 60%)`,
              }}
            />
            <div className="w-7 h-7 text-white relative z-10 drop-shadow-lg">
              {getCategoryIcon(id)}
            </div>
          </motion.div>

          {/* Bank/NBFC count badge - top right */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full text-[11px] font-bold text-white flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              boxShadow: `0 2px 10px ${color}50`,
            }}
          >
            {bankCount > 0 ? bankCount : subcategoryCount}
          </motion.div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg text-white group-hover:text-opacity-100 transition-colors leading-tight mb-2">
          {name}
        </h3>

        {/* Description - 2-3 lines */}
        <p className="text-sm text-white/60 leading-relaxed line-clamp-3 flex-1 mb-4">
          {description || `Explore ${name} options from multiple banks and NBFCs with competitive rates.`}
        </p>

        {/* Bottom section */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/5">
          <span className="text-xs text-white/40 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {subcategoryCount} loan types
          </span>
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: `${color}20`,
              color: color,
            }}
            whileHover={{ x: 4, background: `${color}30` }}
          >
            Explore
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
};

// =====================================================
// SUBCATEGORY CARD COMPONENT - Glassmorphism Design
// =====================================================

export const ULAPSubcategoryCard: React.FC<ULAPSubcategoryCardProps> = ({
  id,
  name,
  description,
  categoryId,
  categoryColor,
  minAmount,
  maxAmount,
  onSelect,
  animationDelay = 0,
}) => {
  const color = categoryColor || (categoryId ? getCategoryColor(categoryId) : '#f97316');

  const formatAmount = (amount?: number) => {
    if (!amount) return '';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-xl overflow-hidden text-left w-full h-full flex flex-col min-h-[180px]"
    >
      {/* Glassmorphism background */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: `linear-gradient(145deg, rgba(28,28,32,0.95) 0%, rgba(18,18,22,0.98) 100%)`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      />

      {/* Subtle color tint */}
      <div
        className="absolute inset-0 rounded-xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"
        style={{
          background: `linear-gradient(145deg, ${color}20 0%, transparent 50%)`,
        }}
      />

      {/* Hover glow border */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"
        style={{
          boxShadow: `inset 0 0 0 1px ${color}50, 0 0 30px ${color}10`,
        }}
      />

      {/* Default border */}
      <div className="absolute inset-0 rounded-xl border border-white/10 group-hover:border-transparent transition-colors duration-300" />

      <div className="relative p-4 flex flex-col h-full z-10">
        {/* Top row: Icon + Title */}
        <div className="flex items-start gap-3 mb-3">
          <motion.div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
              boxShadow: `0 3px 15px ${color}35`,
            }}
            whileHover={{ scale: 1.1, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {/* Inner glow */}
            <div
              className="absolute inset-0 rounded-lg opacity-40"
              style={{
                background: `radial-gradient(circle at 30% 30%, white 0%, transparent 60%)`,
              }}
            />
            <div className="w-5 h-5 text-white relative z-10 drop-shadow">
              {categoryId ? getCategoryIcon(categoryId) : DEFAULT_ICON}
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-white group-hover:text-white transition-colors leading-tight line-clamp-2">
              {name}
            </h3>
            {(minAmount || maxAmount) && (
              <p className="text-xs mt-1 font-medium" style={{ color: `${color}` }}>
                {formatAmount(minAmount)} - {formatAmount(maxAmount)}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-white/50 leading-relaxed line-clamp-2 flex-1">
          {description || `Apply for ${name}`}
        </p>

        {/* Apply Button */}
        <div className="flex items-center justify-end pt-3 mt-auto">
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-md"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              color: '#fff',
              boxShadow: `0 2px 10px ${color}30`,
            }}
            whileHover={{ scale: 1.05, boxShadow: `0 4px 15px ${color}40` }}
            whileTap={{ scale: 0.95 }}
          >
            Apply Now
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
};

export default ULAPCategoryCard;
