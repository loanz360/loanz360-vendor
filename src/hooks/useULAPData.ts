'use client';

import { useState, useEffect, useCallback } from 'react';

// Types matching the loan-demo page
export interface LoanSubcategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  bankCount: number;
}

export interface LoanCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  icon: string;
  bankCount: number;
  subcategories: LoanSubcategory[];
}

export interface BankInfo {
  id: string;
  name: string;
  logo: string;
  type: 'BANK' | 'NBFC' | 'HFC' | 'FINTECH';
  interestRate: { min: number; max: number };
  processingFee: string;
  maxTenure: string;
  maxAmount: string;
  minAmount: string;
  minIncome: string;
  minAge: number;
  maxAge: number;
  minCibil: number;
  disbursalTime: string;
  foreclosure: string;
  partPayment: string;
  documents: string[];
  features: string[];
}

export interface LoanDetails {
  eligibility: string[];
  documents: string[];
  features: string[];
  minAmount: string;
  maxAmount: string;
  tenure: string;
  interestRange: string;
  additionalInfo?: Record<string, string>;
}

export interface ProfileField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  placeholder: string | null;
  is_required: boolean;
  validation_rules: Record<string, unknown>;
  options: Array<{ value: string; label: string }>;
  display_order: number;
  field_section: string;
  is_base_field: boolean;
}

interface ULAPDataState {
  categories: LoanCategory[];
  banks: BankInfo[];
  loanDetails: Record<string, LoanDetails>;
  bankRates: Record<string, BankInfo[]>;
  profileFields: {
    applicant: ProfileField[];
    coapplicant: ProfileField[];
    loan: ProfileField[];
    other: ProfileField[];
  };
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// Default category images (using Unsplash)
const CATEGORY_IMAGES: Record<string, string> = {
  'personal-loans': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=250&fit=crop',
  'business-loans': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=250&fit=crop',
  'home-loans': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=250&fit=crop',
  'mortgage-lap': 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=400&h=250&fit=crop',
  'vehicle-loans': 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=250&fit=crop',
  'professional-loans': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop',
  'loan-against-securities': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=250&fit=crop',
  'education-loans': 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=250&fit=crop',
  'gold-loans': 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=250&fit=crop',
  'government-schemes': 'https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=400&h=250&fit=crop',
  'rural-agri-loans': 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&h=250&fit=crop',
  'nri-loans': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=250&fit=crop',
  'overdraft-facility': 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=250&fit=crop',
  'senior-citizen-loans': 'https://images.unsplash.com/photo-1447069387593-a5de0862481e?w=400&h=250&fit=crop',
};

// Default subcategory image
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=250&fit=crop';

export function useULAPData(subcategoryId?: string) {
  const [state, setState] = useState<ULAPDataState>({
    categories: [],
    banks: [],
    loanDetails: {},
    bankRates: {},
    profileFields: {
      applicant: [],
      coapplicant: [],
      loan: [],
      other: [],
    },
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch main ULAP data
      const ulapResponse = await fetch('/api/ulap');
      const ulapData = await ulapResponse.json();

      if (!ulapResponse.ok) {
        throw new Error(ulapData.error || 'Failed to fetch ULAP data');
      }

      // Transform categories
      const categories: LoanCategory[] = (ulapData.categories || []).map((cat: Record<string, unknown>) => {
        const subcategories = (cat.subcategories || []) as Array<Record<string, unknown>>;
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          image: cat.image_url || CATEGORY_IMAGES[cat.slug as string] || DEFAULT_IMAGE,
          description: cat.description || '',
          icon: cat.icon || '💰',
          bankCount: subcategories.reduce((sum: number, sub: Record<string, unknown>) => {
            const rates = ulapData.bankRates?.[sub.id as string] || [];
            return sum + (rates.length || 15);
          }, 0),
          subcategories: subcategories.map((sub: Record<string, unknown>) => ({
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            image: sub.image_url || DEFAULT_IMAGE,
            description: sub.description || '',
            bankCount: (ulapData.bankRates?.[sub.id as string] || []).length || 15,
          })),
        };
      });

      // Transform banks
      const banks: BankInfo[] = (ulapData.banks || []).map((bank: Record<string, unknown>) => ({
        id: bank.id,
        name: bank.name,
        logo: bank.logo_url || `https://logo.clearbit.com/${(bank.name as string).toLowerCase().replace(/\s+/g, '')}.com`,
        type: bank.type || 'BANK',
        interestRate: { min: 10.5, max: 21.0 },
        processingFee: 'Up to 2.5%',
        maxTenure: '5 Years',
        maxAmount: '₹50 Lakh',
        minAmount: '₹50,000',
        minIncome: '₹25,000/month',
        minAge: 21,
        maxAge: 60,
        minCibil: 700,
        disbursalTime: '24-48 hours',
        foreclosure: 'As per bank policy',
        partPayment: 'As per bank policy',
        documents: ['PAN Card', 'Aadhaar', 'Salary Slips', 'Bank Statement'],
        features: ['Quick approval', 'Flexible tenure', 'Online tracking'],
      }));

      // Transform loan details
      const loanDetails: Record<string, LoanDetails> = {};
      Object.entries(ulapData.loanDetails || {}).forEach(([subId, details]: [string, unknown]) => {
        const d = details as Record<string, unknown>;
        loanDetails[subId] = {
          eligibility: (d.eligibility || []) as string[],
          documents: (d.documents || []) as string[],
          features: (d.features || []) as string[],
          minAmount: (d.min_amount || '₹50,000') as string,
          maxAmount: (d.max_amount || '₹50 Lakh') as string,
          tenure: (d.tenure || 'Up to 5 Years') as string,
          interestRange: (d.interest_range || '10.5% - 21%') as string,
          additionalInfo: (d.additional_info || {}) as Record<string, string>,
        };
      });

      // Transform bank rates per subcategory
      const bankRates: Record<string, BankInfo[]> = {};
      Object.entries(ulapData.bankRates || {}).forEach(([subId, rates]: [string, unknown]) => {
        bankRates[subId] = ((rates || []) as Array<Record<string, unknown>>).map((rate: Record<string, unknown>) => {
          const bank = rate.bank as Record<string, unknown> || {};
          return {
            id: rate.id as string,
            name: (bank.name || 'Unknown Bank') as string,
            logo: (bank.logo_url || `https://logo.clearbit.com/bank.com`) as string,
            type: (bank.type || 'BANK') as 'BANK' | 'NBFC' | 'HFC' | 'FINTECH',
            interestRate: {
              min: (rate.interest_rate_min || 10.5) as number,
              max: (rate.interest_rate_max || 21.0) as number,
            },
            processingFee: (rate.processing_fee || 'Up to 2.5%') as string,
            maxTenure: (rate.max_tenure || '5 Years') as string,
            maxAmount: (rate.max_amount || '₹50 Lakh') as string,
            minAmount: '₹50,000',
            minIncome: '₹25,000/month',
            minAge: 21,
            maxAge: 60,
            minCibil: 700,
            disbursalTime: '24-48 hours',
            foreclosure: 'As per bank policy',
            partPayment: 'As per bank policy',
            documents: ['PAN Card', 'Aadhaar', 'Income Proof', 'Bank Statement'],
            features: ['Quick approval', 'Flexible tenure', 'Online tracking'],
          };
        });
      });

      // Fetch profile fields if subcategory provided
      let profileFields = state.profileFields;
      if (subcategoryId) {
        const fieldsResponse = await fetch(`/api/ulap/profile-fields?subcategory_id=${subcategoryId}`);
        const fieldsData = await fieldsResponse.json();
        if (fieldsResponse.ok && fieldsData.fields) {
          profileFields = fieldsData.fields;
        }
      } else {
        // Fetch base fields only
        const fieldsResponse = await fetch('/api/ulap/profile-fields');
        const fieldsData = await fieldsResponse.json();
        if (fieldsResponse.ok && fieldsData.fields) {
          profileFields = fieldsData.fields;
        }
      }

      setState({
        categories,
        banks,
        loanDetails,
        bankRates,
        profileFields,
        loading: false,
        error: null,
        lastUpdated: ulapData.lastUpdated || new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching ULAP data:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      }));
    }
  }, [subcategoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// Hook for submitting leads
export function useSubmitLead() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLead = async (data: {
    category_id: string;
    subcategory_id: string;
    applicant_data: Record<string, unknown>;
    coapplicant_data?: Record<string, unknown>;
    selected_banks?: string[];
    created_by_type: string;
    created_by_id?: string;
    created_by_name?: string;
    created_by_mobile?: string;
    otp_verified?: boolean;
    generate_link?: boolean;
  }) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/ulap/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit lead');
      }

      setSubmitting(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit lead';
      setError(errorMessage);
      setSubmitting(false);
      throw err;
    }
  };

  return { submitLead, submitting, error };
}

// Hook for OTP operations
export function useOTP() {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOTP = async (mobile: string, leadId?: string) => {
    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/ulap/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: mobile, lead_id: leadId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send OTP');
      }

      setSending(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send OTP';
      setError(errorMessage);
      setSending(false);
      throw err;
    }
  };

  const verifyOTP = async (mobile: string, otp: string, leadId?: string) => {
    setVerifying(true);
    setError(null);

    try {
      const response = await fetch('/api/ulap/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: mobile, otp_code: otp, lead_id: leadId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Invalid OTP');
      }

      setVerifying(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid OTP';
      setError(errorMessage);
      setVerifying(false);
      throw err;
    }
  };

  return { sendOTP, verifyOTP, sending, verifying, error, clearError: () => setError(null) };
}
