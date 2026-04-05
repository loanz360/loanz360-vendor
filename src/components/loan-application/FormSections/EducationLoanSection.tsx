/**
 * Education Loan Section Component
 * Course, institution, and admission details for education loans
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumTextarea, PremiumCurrencyInput } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const AcademicCapIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
  </svg>
);

const BuildingLibraryIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
);

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocumentCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <motion.path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3 }}
    />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface EducationLoanSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: unknown) => void;
  className?: string;
}

// =====================================================
// DATA
// =====================================================

const STUDY_LOCATION_OPTIONS = [
  { value: 'india', label: 'India (Domestic)' },
  { value: 'abroad', label: 'Abroad (International)' },
];

const COURSE_LEVEL_OPTIONS = [
  { value: 'undergraduate', label: 'Undergraduate (UG)' },
  { value: 'postgraduate', label: 'Postgraduate (PG)' },
  { value: 'doctorate', label: 'Doctorate (PhD)' },
  { value: 'diploma', label: 'Diploma / Certificate' },
  { value: 'professional', label: 'Professional Course' },
];

const COURSE_TYPE_OPTIONS = [
  { value: 'engineering', label: 'Engineering / Technology' },
  { value: 'medical', label: 'Medical / Healthcare' },
  { value: 'management', label: 'Management / MBA' },
  { value: 'law', label: 'Law / Legal Studies' },
  { value: 'science', label: 'Pure Sciences' },
  { value: 'arts', label: 'Arts / Humanities' },
  { value: 'commerce', label: 'Commerce / Finance' },
  { value: 'design', label: 'Design / Architecture' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'aviation', label: 'Aviation / Pilot Training' },
  { value: 'hospitality', label: 'Hospitality / Hotel Management' },
  { value: 'it', label: 'IT / Computer Science' },
  { value: 'other', label: 'Other' },
];

const ADMISSION_STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Admission Confirmed' },
  { value: 'offer_received', label: 'Offer Letter Received' },
  { value: 'applied', label: 'Applied / Awaiting Result' },
  { value: 'planning', label: 'Planning to Apply' },
];

const POPULAR_COUNTRIES = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'canada', label: 'Canada' },
  { value: 'australia', label: 'Australia' },
  { value: 'germany', label: 'Germany' },
  { value: 'ireland', label: 'Ireland' },
  { value: 'new_zealand', label: 'New Zealand' },
  { value: 'singapore', label: 'Singapore' },
  { value: 'france', label: 'France' },
  { value: 'netherlands', label: 'Netherlands' },
  { value: 'sweden', label: 'Sweden' },
  { value: 'italy', label: 'Italy' },
  { value: 'other', label: 'Other' },
];

const INDIAN_STATES = [
  { value: 'MH', label: 'Maharashtra' },
  { value: 'DL', label: 'Delhi' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'TG', label: 'Telangana' },
  { value: 'WB', label: 'West Bengal' },
  { value: 'KL', label: 'Kerala' },
  { value: 'PB', label: 'Punjab' },
  { value: 'HR', label: 'Haryana' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'other', label: 'Other' },
];

const INSTITUTION_TYPE_OPTIONS = [
  { value: 'iit', label: 'IIT / NIT / IIIT' },
  { value: 'iim', label: 'IIM / Top B-School' },
  { value: 'aiims', label: 'AIIMS / Medical College' },
  { value: 'government', label: 'Government University' },
  { value: 'private', label: 'Private University' },
  { value: 'deemed', label: 'Deemed University' },
  { value: 'autonomous', label: 'Autonomous College' },
  { value: 'foreign', label: 'Foreign University' },
  { value: 'other', label: 'Other' },
];

// =====================================================
// STUDY LOCATION CARD
// =====================================================

interface StudyLocationCardProps {
  type: 'india' | 'abroad';
  isSelected: boolean;
  onClick: () => void;
}

const StudyLocationCard = ({ type, isSelected, onClick }: StudyLocationCardProps) => {
  const isIndia = type === 'india';

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-6 rounded-2xl border-2 text-left transition-all duration-300',
        isSelected
          ? isIndia
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-violet-500 bg-violet-500/10'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center',
          isSelected
            ? isIndia
              ? 'bg-emerald-500'
              : 'bg-violet-500'
            : 'bg-white/10'
        )}>
          {isIndia ? (
            <BuildingLibraryIcon className="w-7 h-7 text-white" />
          ) : (
            <GlobeIcon className="w-7 h-7 text-white" />
          )}
        </div>
        <div>
          <h4 className="text-lg font-semibold text-white">
            {isIndia ? 'Study in India' : 'Study Abroad'}
          </h4>
          <p className="text-sm text-white/60">
            {isIndia
              ? 'Domestic institutions including IITs, IIMs, etc.'
              : 'International universities worldwide'}
          </p>
        </div>
      </div>

      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            'absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center',
            isIndia ? 'bg-emerald-500' : 'bg-violet-500'
          )}
        >
          <CheckIcon className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function EducationLoanSection({
  formData,
  errors,
  onFieldChange,
  className,
}: EducationLoanSectionProps) {
  const [activeSection, setActiveSection] = useState<'course' | 'institution' | 'expenses'>('course');

  const studyLocation = formData.studyLocation as string;
  const isAbroad = studyLocation === 'abroad';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">Course & Institution Details</h3>
        <p className="text-sm text-white/60">
          Provide details about your educational program and the institution you plan to attend.
        </p>
      </div>

      {/* Study Location Selection */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          Where do you plan to study? <span className="text-brand-primary">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StudyLocationCard
            type="india"
            isSelected={studyLocation === 'india'}
            onClick={() => onFieldChange('studyLocation', 'india')}
          />
          <StudyLocationCard
            type="abroad"
            isSelected={studyLocation === 'abroad'}
            onClick={() => onFieldChange('studyLocation', 'abroad')}
          />
        </div>
        {errors.studyLocation && (
          <p className="text-xs text-red-400 mt-2">{errors.studyLocation}</p>
        )}
      </div>

      {/* Section Tabs */}
      {studyLocation && (
        <div className="flex gap-2 p-1 rounded-xl bg-white/[0.03]">
          {(['course', 'institution', 'expenses'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeSection === section
                  ? isAbroad
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
              )}
            >
              {section === 'course' && 'Course Details'}
              {section === 'institution' && 'Institution'}
              {section === 'expenses' && 'Expenses'}
            </button>
          ))}
        </div>
      )}

      {/* Content Sections */}
      <AnimatePresence mode="wait">
        {studyLocation && activeSection === 'course' && (
          <motion.div
            key="course"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Course Details */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  isAbroad
                    ? 'bg-gradient-to-br from-violet-500 to-purple-500'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-500'
                )}>
                  <AcademicCapIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Course Information</h4>
                  <p className="text-xs text-white/50">Details about your program of study</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumSelect
                    label="Course Level"
                    options={COURSE_LEVEL_OPTIONS}
                    value={(formData.courseLevel as string) || ''}
                    onChange={(e) => onFieldChange('courseLevel', e.target.value)}
                    required
                    error={errors.courseLevel}
                  />
                  <PremiumSelect
                    label="Course Type / Stream"
                    options={COURSE_TYPE_OPTIONS}
                    value={(formData.courseType as string) || ''}
                    onChange={(e) => onFieldChange('courseType', e.target.value)}
                    required
                    error={errors.courseType}
                  />
                </div>

                <PremiumInput
                  label="Course / Degree Name"
                  value={(formData.courseName as string) || ''}
                  onChange={(e) => onFieldChange('courseName', e.target.value)}
                  placeholder={isAbroad ? 'e.g., MS in Computer Science' : 'e.g., B.Tech in Computer Science'}
                  required
                  error={errors.courseName}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Specialization (if any)"
                    value={(formData.specialization as string) || ''}
                    onChange={(e) => onFieldChange('specialization', e.target.value)}
                    placeholder="e.g., Machine Learning"
                  />
                  <PremiumInput
                    label="Course Duration (Years)"
                    type="number"
                    value={(formData.courseDuration as string) || ''}
                    onChange={(e) => onFieldChange('courseDuration', e.target.value)}
                    placeholder="e.g., 2"
                    required
                    error={errors.courseDuration}
                  />
                </div>
              </div>
            </div>

            {/* Admission Status */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  'bg-gradient-to-br from-amber-500 to-orange-500'
                )}>
                  <DocumentCheckIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Admission Status</h4>
                  <p className="text-xs text-white/50">Current status of your application</p>
                </div>
              </div>

              <div className="space-y-4">
                <PremiumSelect
                  label="Admission Status"
                  options={ADMISSION_STATUS_OPTIONS}
                  value={(formData.admissionStatus as string) || ''}
                  onChange={(e) => onFieldChange('admissionStatus', e.target.value)}
                  required
                  error={errors.admissionStatus}
                />

                {(formData.admissionStatus === 'confirmed' || formData.admissionStatus === 'offer_received') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <PremiumInput
                      label="Admission / Offer Letter Number"
                      value={(formData.admissionNumber as string) || ''}
                      onChange={(e) => onFieldChange('admissionNumber', e.target.value)}
                      placeholder="Enter reference number"
                    />
                    <PremiumInput
                      label="Course Start Date"
                      type="date"
                      value={(formData.courseStartDate as string) || ''}
                      onChange={(e) => onFieldChange('courseStartDate', e.target.value)}
                      required
                      error={errors.courseStartDate}
                    />
                  </motion.div>
                )}

                {isAbroad && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PremiumInput
                      label="I-20 / CAS Number (if available)"
                      value={(formData.visaDocNumber as string) || ''}
                      onChange={(e) => onFieldChange('visaDocNumber', e.target.value)}
                      placeholder="Enter document number"
                      helperText="I-20 for US, CAS for UK"
                    />
                    <PremiumInput
                      label="Expected Visa Date"
                      type="date"
                      value={(formData.expectedVisaDate as string) || ''}
                      onChange={(e) => onFieldChange('expectedVisaDate', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Institution Section */}
        {studyLocation && activeSection === 'institution' && (
          <motion.div
            key="institution"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  'bg-gradient-to-br from-blue-500 to-indigo-500'
                )}>
                  <BuildingLibraryIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Institution Details</h4>
                  <p className="text-xs text-white/50">Information about the university or college</p>
                </div>
              </div>

              <div className="space-y-4">
                <PremiumInput
                  label="Institution / University Name"
                  value={(formData.institutionName as string) || ''}
                  onChange={(e) => onFieldChange('institutionName', e.target.value)}
                  placeholder={isAbroad ? 'e.g., Stanford University' : 'e.g., IIT Bombay'}
                  required
                  error={errors.institutionName}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isAbroad ? (
                    <PremiumSelect
                      label="Country"
                      options={POPULAR_COUNTRIES}
                      value={(formData.institutionCountry as string) || ''}
                      onChange={(e) => onFieldChange('institutionCountry', e.target.value)}
                      required
                      error={errors.institutionCountry}
                    />
                  ) : (
                    <PremiumSelect
                      label="State"
                      options={INDIAN_STATES}
                      value={(formData.institutionState as string) || ''}
                      onChange={(e) => onFieldChange('institutionState', e.target.value)}
                      required
                      error={errors.institutionState}
                    />
                  )}
                  <PremiumInput
                    label="City"
                    value={(formData.institutionCity as string) || ''}
                    onChange={(e) => onFieldChange('institutionCity', e.target.value)}
                    placeholder={isAbroad ? 'e.g., San Francisco' : 'e.g., Mumbai'}
                    required
                    error={errors.institutionCity}
                  />
                </div>

                {!isAbroad && (
                  <PremiumSelect
                    label="Institution Type"
                    options={INSTITUTION_TYPE_OPTIONS}
                    value={(formData.institutionType as string) || ''}
                    onChange={(e) => onFieldChange('institutionType', e.target.value)}
                    error={errors.institutionType}
                  />
                )}

                {isAbroad && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PremiumInput
                      label="QS World Ranking (if known)"
                      type="number"
                      value={(formData.qsRanking as string) || ''}
                      onChange={(e) => onFieldChange('qsRanking', e.target.value)}
                      placeholder="e.g., 25"
                      helperText="Better rankings may improve loan terms"
                    />
                    <PremiumInput
                      label="University Website"
                      value={(formData.universityWebsite as string) || ''}
                      onChange={(e) => onFieldChange('universityWebsite', e.target.value)}
                      placeholder="https://www.university.edu"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Campus Address */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <PremiumTextarea
                label="Campus Address (Optional)"
                value={(formData.campusAddress as string) || ''}
                onChange={(e) => onFieldChange('campusAddress', e.target.value)}
                placeholder="Enter the full campus address"
                rows={2}
              />
            </div>
          </motion.div>
        )}

        {/* Expenses Section */}
        {studyLocation && activeSection === 'expenses' && (
          <motion.div
            key="expenses"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Tuition Fees */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CurrencyIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Course Fees</h4>
                  <p className="text-xs text-white/50">Total tuition and academic fees</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCurrencyInput
                  label={isAbroad ? 'Tuition Fees (per year in ₹)' : 'Tuition Fees (Total)'}
                  value={(formData.tuitionFees as string) || ''}
                  onChange={(e) => onFieldChange('tuitionFees', e.target.value)}
                  placeholder="e.g., 25,00,000"
                  required
                  error={errors.tuitionFees}
                />
                <PremiumCurrencyInput
                  label="Other Academic Fees"
                  value={(formData.otherAcademicFees as string) || ''}
                  onChange={(e) => onFieldChange('otherAcademicFees', e.target.value)}
                  placeholder="Library, lab, etc."
                  helperText="Lab fees, library, technology fees"
                />
              </div>

              {isAbroad && (
                <PremiumInput
                  label="Fee Currency"
                  value={(formData.feeCurrency as string) || 'USD'}
                  onChange={(e) => onFieldChange('feeCurrency', e.target.value)}
                  placeholder="USD, GBP, EUR, etc."
                  className="mt-4"
                />
              )}
            </div>

            {/* Living Expenses */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <h4 className="text-sm font-medium text-white mb-4">Living Expenses (Estimated)</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCurrencyInput
                  label={isAbroad ? 'Accommodation (per year)' : 'Hostel / Accommodation'}
                  value={(formData.accommodationCost as string) || ''}
                  onChange={(e) => onFieldChange('accommodationCost', e.target.value)}
                  placeholder="e.g., 6,00,000"
                />
                <PremiumCurrencyInput
                  label={isAbroad ? 'Living Expenses (per year)' : 'Food & Living'}
                  value={(formData.livingCost as string) || ''}
                  onChange={(e) => onFieldChange('livingCost', e.target.value)}
                  placeholder="e.g., 4,00,000"
                />
              </div>

              {isAbroad && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <PremiumCurrencyInput
                    label="Travel / Airfare"
                    value={(formData.travelCost as string) || ''}
                    onChange={(e) => onFieldChange('travelCost', e.target.value)}
                    placeholder="e.g., 1,00,000"
                  />
                  <PremiumCurrencyInput
                    label="Health Insurance"
                    value={(formData.healthInsurance as string) || ''}
                    onChange={(e) => onFieldChange('healthInsurance', e.target.value)}
                    placeholder="e.g., 80,000"
                  />
                </div>
              )}
            </div>

            {/* Total & Loan Amount */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-orange-500/10 border border-brand-primary/20">
              <h4 className="text-sm font-medium text-white mb-4">Loan Requirement</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCurrencyInput
                  label="Total Estimated Cost"
                  value={(formData.totalCost as string) || ''}
                  onChange={(e) => onFieldChange('totalCost', e.target.value)}
                  placeholder="e.g., 40,00,000"
                  required
                  error={errors.totalCost}
                />
                <PremiumCurrencyInput
                  label="Self / Family Contribution"
                  value={(formData.selfContribution as string) || ''}
                  onChange={(e) => onFieldChange('selfContribution', e.target.value)}
                  placeholder="e.g., 10,00,000"
                  helperText="Amount you can arrange yourself"
                />
              </div>

              <PremiumCurrencyInput
                label="Loan Amount Required"
                value={(formData.loanAmountRequired as string) || ''}
                onChange={(e) => onFieldChange('loanAmountRequired', e.target.value)}
                placeholder="e.g., 30,00,000"
                required
                className="mt-4"
                error={errors.loanAmountRequired}
              />

              {/* Scholarship Info */}
              <div className="mt-4 p-4 rounded-xl bg-white/[0.02]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={(formData.hasScholarship as boolean) || false}
                      onChange={(e) => onFieldChange('hasScholarship', e.target.checked)}
                      className="sr-only"
                    />
                    <motion.div
                      className={cn(
                        'w-12 h-7 rounded-full transition-colors',
                        formData.hasScholarship ? 'bg-emerald-500' : 'bg-white/20'
                      )}
                    >
                      <motion.div
                        className="w-5 h-5 rounded-full bg-white shadow-lg"
                        animate={{ x: formData.hasScholarship ? 26 : 4, y: 4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </motion.div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">Scholarship / Grant Received</span>
                    <p className="text-xs text-white/50">Have you received any scholarship?</p>
                  </div>
                </label>

                <AnimatePresence>
                  {formData.hasScholarship && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <PremiumCurrencyInput
                        label="Scholarship Amount"
                        value={(formData.scholarshipAmount as string) || ''}
                        onChange={(e) => onFieldChange('scholarshipAmount', e.target.value)}
                        placeholder="e.g., 5,00,000"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default EducationLoanSection;
