'use client';

/**
 * LeadJourneyTimeline Component
 * Visualizes the complete lead lifecycle as a vertical timeline
 * Shows completed, current, and pending steps with animated indicators
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  FileText,
  Share2,
  ClipboardEdit,
  CheckCircle2,
  BarChart3,
  Building2,
  Send,
  ShieldCheck,
  XCircle,
  Clock,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface LeadJourneyTimelineProps {
  lead: {
    lead_number: string;
    customer_name: string;
    form_status: string;
    lead_status: string;
    application_phase: number;
    form_completion_percentage: number;
    created_at: string;
    updated_at: string;
    short_link?: string;
    cam_status?: string;
  };
  className?: string;
}

type StepStatus = 'completed' | 'current' | 'pending';

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: StepStatus;
  timestamp?: string;
}

// =====================================================
// HELPERS
// =====================================================

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Derives the current step index (0-based) and whether the lead
 * reached a terminal state (approved / rejected).
 */
function deriveCurrentStep(lead: LeadJourneyTimelineProps['lead']): {
  currentIndex: number;
  isRejected: boolean;
} {
  const status = lead.lead_status?.toLowerCase() ?? '';
  const formStatus = lead.form_status?.toLowerCase() ?? '';
  const cam = lead.cam_status?.toLowerCase() ?? '';
  const phase = lead.application_phase ?? 1;
  const completion = lead.form_completion_percentage ?? 0;

  // Terminal states
  if (status === 'approved' || status === 'disbursed') {
    return { currentIndex: 8, isRejected: false };
  }
  if (status === 'rejected') {
    return { currentIndex: 8, isRejected: true };
  }

  // Application submitted to bank
  if (status === 'submitted' || status === 'under_review' || status === 'processing') {
    return { currentIndex: 7, isRejected: false };
  }

  // Bank matched
  if (status === 'bank_matched' || status === 'matched') {
    return { currentIndex: 6, isRejected: false };
  }

  // CAM generated
  if (cam === 'generated' || cam === 'completed' || cam === 'done') {
    return { currentIndex: 5, isRejected: false };
  }

  // Phase 2 completed
  if (phase >= 2 && (completion >= 100 || formStatus === 'completed')) {
    return { currentIndex: 4, isRejected: false };
  }

  // Phase 2 in progress
  if (phase >= 2 && completion > 0 && completion < 100) {
    return { currentIndex: 3, isRejected: false };
  }

  // Link shared
  if (lead.short_link) {
    return { currentIndex: 2, isRejected: false };
  }

  // Phase 1 submitted (basic details collected)
  if (phase >= 1 && (formStatus === 'phase1_complete' || formStatus === 'submitted' || completion > 0)) {
    return { currentIndex: 1, isRejected: false };
  }

  // Default: lead just created
  return { currentIndex: 0, isRejected: false };
}

// =====================================================
// STEP DEFINITIONS
// =====================================================

function buildSteps(
  lead: LeadJourneyTimelineProps['lead'],
  currentIndex: number,
  isRejected: boolean,
): TimelineStep[] {
  const stepDefs: {
    id: string;
    title: string;
    descFn: () => string;
    icon: LucideIcon;
  }[] = [
    {
      id: 'created',
      title: 'Lead Created',
      descFn: () => `Lead #${lead.lead_number} for ${lead.customer_name}`,
      icon: UserPlus,
    },
    {
      id: 'phase1',
      title: 'Phase 1 Submitted',
      descFn: () => 'Basic details collected',
      icon: FileText,
    },
    {
      id: 'link_shared',
      title: 'Link Shared',
      descFn: () =>
        lead.short_link
          ? `Shared via WhatsApp / QR / Copy`
          : 'Share link to customer',
      icon: Share2,
    },
    {
      id: 'phase2_progress',
      title: 'Phase 2 In Progress',
      descFn: () =>
        `Customer filling documents — ${lead.form_completion_percentage ?? 0}% done`,
      icon: ClipboardEdit,
    },
    {
      id: 'phase2_done',
      title: 'Phase 2 Completed',
      descFn: () => 'All documents uploaded',
      icon: CheckCircle2,
    },
    {
      id: 'cam',
      title: 'CAM Generated',
      descFn: () => 'Credit analysis report generated',
      icon: BarChart3,
    },
    {
      id: 'bank_matched',
      title: 'Bank Matched',
      descFn: () => 'Eligible banks identified',
      icon: Building2,
    },
    {
      id: 'submitted',
      title: 'Application Submitted',
      descFn: () => 'Application sent to bank',
      icon: Send,
    },
    {
      id: 'final',
      title: isRejected ? 'Rejected' : 'Approved',
      descFn: () =>
        isRejected ? 'Application was not approved' : 'Loan approved by bank',
      icon: isRejected ? XCircle : ShieldCheck,
    },
  ];

  return stepDefs.map((def, i) => {
    let status: StepStatus = 'pending';
    if (i < currentIndex) status = 'completed';
    else if (i === currentIndex) status = 'current';

    // Timestamps: created_at for first step, updated_at for current, none for future
    let timestamp: string | undefined;
    if (i === 0) timestamp = lead.created_at;
    else if (i === currentIndex) timestamp = lead.updated_at;
    else if (i < currentIndex) timestamp = undefined; // no exact ts available

    return {
      id: def.id,
      title: def.title,
      description: def.descFn(),
      icon: def.icon,
      status,
      timestamp,
    };
  });
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function StepIcon({ step }: { step: TimelineStep }) {
  const Icon = step.icon;

  if (step.status === 'completed') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500">
        <Check className="h-4 w-4 text-emerald-400" />
      </div>
    );
  }

  if (step.status === 'current') {
    return (
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6700]/20 ring-2 ring-[#FF6700]">
        {/* Pulsing ring */}
        <span className="absolute inset-0 animate-ping rounded-full bg-[#FF6700]/30" />
        <Icon className="relative z-10 h-4 w-4 text-[#FF6700]" />
      </div>
    );
  }

  // pending
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 ring-2 ring-neutral-700">
      <Icon className="h-4 w-4 text-neutral-500" />
    </div>
  );
}

function TimelineStepRow({
  step,
  index,
  isLast,
}: {
  step: TimelineStep;
  index: number;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
      className="relative flex gap-4"
    >
      {/* Vertical connector line */}
      <div className="flex flex-col items-center">
        <StepIcon step={step} />
        {!isLast && (
          <div
            className={`mt-1 w-0.5 flex-1 ${
              step.status === 'completed'
                ? 'bg-emerald-500/50'
                : step.status === 'current'
                  ? 'bg-gradient-to-b from-[#FF6700]/60 to-neutral-700'
                  : 'bg-neutral-700'
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-8 ${isLast ? 'pb-0' : ''}`}>
        <p
          className={`text-sm font-semibold leading-tight ${
            step.status === 'completed'
              ? 'text-emerald-400'
              : step.status === 'current'
                ? 'text-[#FF6700]'
                : 'text-neutral-500'
          }`}
        >
          {step.title}
        </p>
        <p
          className={`mt-0.5 text-xs ${
            step.status === 'pending' ? 'text-neutral-600' : 'text-neutral-400'
          }`}
        >
          {step.description}
        </p>
        {step.timestamp && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
            <Clock className="h-3 w-3" />
            {formatDate(step.timestamp)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function LeadJourneyTimeline({
  lead,
  className = '',
}: LeadJourneyTimelineProps) {
  const { currentIndex, isRejected } = useMemo(() => deriveCurrentStep(lead), [lead]);
  const steps = useMemo(
    () => buildSteps(lead, currentIndex, isRejected),
    [lead, currentIndex, isRejected],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 backdrop-blur ${className}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Lead Journey</h3>
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
          {lead.lead_number}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex flex-col">
        {steps.map((step, i) => (
          <TimelineStepRow
            key={step.id}
            step={step}
            index={i}
            isLast={i === steps.length - 1}
          />
        ))}
      </div>
    </motion.div>
  );
}
