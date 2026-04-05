/**
 * Gold Loan Section Component
 * Gold ornament details and valuation for gold loans
 */

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency} from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumCurrencyInput, PremiumTextarea } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const GoldIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const ScaleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface GoldItem {
  id: string;
  itemType: string;
  description: string;
  grossWeight: string;
  netWeight: string;
  purity: string;
  quantity: string;
}

interface GoldLoanSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: unknown) => void;
  className?: string;
}

// =====================================================
// DATA
// =====================================================

const GOLD_ITEM_TYPES = [
  { value: 'necklace', label: 'Necklace / Chain' },
  { value: 'bangle', label: 'Bangle / Bracelet' },
  { value: 'earring', label: 'Earrings' },
  { value: 'ring', label: 'Ring' },
  { value: 'pendant', label: 'Pendant' },
  { value: 'mangalsutra', label: 'Mangalsutra' },
  { value: 'coin', label: 'Gold Coin' },
  { value: 'bar', label: 'Gold Bar / Biscuit' },
  { value: 'anklet', label: 'Anklet / Payal' },
  { value: 'nose_pin', label: 'Nose Pin / Ring' },
  { value: 'waist_belt', label: 'Waist Belt / Kamarband' },
  { value: 'other', label: 'Other Ornament' },
];

const GOLD_PURITY_OPTIONS = [
  { value: '24k', label: '24K (99.9% Pure)' },
  { value: '22k', label: '22K (91.6% Pure)' },
  { value: '18k', label: '18K (75% Pure)' },
  { value: '14k', label: '14K (58.3% Pure)' },
];

const LOAN_PURPOSE_OPTIONS = [
  { value: 'business', label: 'Business Needs' },
  { value: 'medical', label: 'Medical Emergency' },
  { value: 'education', label: 'Education' },
  { value: 'wedding', label: 'Wedding / Ceremony' },
  { value: 'home_renovation', label: 'Home Renovation' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'personal', label: 'Personal Needs' },
  { value: 'debt_repayment', label: 'Debt Repayment' },
];

// Gold rate per gram (approximate - would be fetched from API in production)
const GOLD_RATE_22K = 5800; // ₹ per gram

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const generateId = () => `gold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const calculateGoldValue = (weight: number, purity: string): number => {
  const purityMultiplier: Record<string, number> = {
    '24k': 1.0,
    '22k': 0.916,
    '18k': 0.75,
    '14k': 0.583,
  };
  return Math.round(weight * GOLD_RATE_22K * (purityMultiplier[purity] || 0.916));
};

// =====================================================
// GOLD ITEM CARD
// =====================================================

interface GoldItemCardProps {
  item: GoldItem;
  index: number;
  onUpdate: (item: GoldItem) => void;
  onDelete: () => void;
  errors: Record<string, string>;
}

const GoldItemCard = ({ item, index, onUpdate, onDelete, errors }: GoldItemCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateField = (field: keyof GoldItem, value: string) => {
    onUpdate({ ...item, [field]: value });
  };

  const estimatedValue = useMemo(() => {
    const weight = parseFloat(item.netWeight) || 0;
    return calculateGoldValue(weight, item.purity);
  }, [item.netWeight, item.purity]);

  const itemLabel = GOLD_ITEM_TYPES.find(t => t.value === item.itemType)?.label || `Item ${index + 1}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="rounded-2xl bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border border-amber-500/20 overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
            <GoldIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">{itemLabel}</h4>
            {item.netWeight && (
              <p className="text-xs text-white/50">{item.netWeight}g • {item.purity || '22K'}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {estimatedValue > 0 && (
            <div className="text-right mr-2">
              <p className="text-xs text-white/40">Est. Value</p>
              <p className="text-sm font-semibold text-amber-400">{formatCurrency(estimatedValue)}</p>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
          >
            <TrashIcon className="w-5 h-5" />
          </motion.button>

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-5 h-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4 border-t border-amber-500/10">
              {/* Item Type & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumSelect
                  label="Item Type"
                  options={GOLD_ITEM_TYPES}
                  value={item.itemType}
                  onChange={(e) => updateField('itemType', e.target.value)}
                  required
                  error={errors[`goldItems.${index}.itemType`]}
                />
                <PremiumInput
                  label="Description"
                  value={item.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="e.g., Traditional design, with stones"
                />
              </div>

              {/* Weight & Purity */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PremiumInput
                  label="Gross Weight (g)"
                  type="number"
                  value={item.grossWeight}
                  onChange={(e) => updateField('grossWeight', e.target.value)}
                  placeholder="e.g., 25"
                  required
                  error={errors[`goldItems.${index}.grossWeight`]}
                />
                <PremiumInput
                  label="Net Weight (g)"
                  type="number"
                  value={item.netWeight}
                  onChange={(e) => updateField('netWeight', e.target.value)}
                  placeholder="e.g., 22"
                  required
                  helperText="Weight excluding stones"
                  error={errors[`goldItems.${index}.netWeight`]}
                />
                <PremiumSelect
                  label="Purity"
                  options={GOLD_PURITY_OPTIONS}
                  value={item.purity}
                  onChange={(e) => updateField('purity', e.target.value)}
                  required
                  error={errors[`goldItems.${index}.purity`]}
                />
                <PremiumInput
                  label="Quantity"
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                  placeholder="e.g., 1"
                  error={errors[`goldItems.${index}.quantity`]}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =====================================================
// SUMMARY CARD
// =====================================================

interface SummaryCardProps {
  items: GoldItem[];
}

const SummaryCard = ({ items }: SummaryCardProps) => {
  const summary = useMemo(() => {
    let totalGrossWeight = 0;
    let totalNetWeight = 0;
    let totalValue = 0;

    items.forEach(item => {
      const gross = parseFloat(item.grossWeight) || 0;
      const net = parseFloat(item.netWeight) || 0;
      const qty = parseInt(item.quantity) || 1;

      totalGrossWeight += gross * qty;
      totalNetWeight += net * qty;
      totalValue += calculateGoldValue(net * qty, item.purity);
    });

    // LTV is typically 75% for gold loans
    const maxLoanAmount = Math.round(totalValue * 0.75);

    return { totalGrossWeight, totalNetWeight, totalValue, maxLoanAmount, itemCount: items.length };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">Gold Valuation Summary</h4>
          <p className="text-xs text-white/50">Based on current gold rates</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Total Items</p>
          <p className="text-xl font-bold text-white">{summary.itemCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Net Weight</p>
          <p className="text-xl font-bold text-white">{summary.totalNetWeight.toFixed(1)}g</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Estimated Value</p>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(summary.totalValue)}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Max Loan (75%)</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(summary.maxLoanAmount)}</p>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-xl bg-white/5">
        <p className="text-xs text-white/50">
          * Estimated values are based on current market rates ({formatCurrency(GOLD_RATE_22K)}/g for 22K).
          Final valuation will be done by the lender's appraiser.
        </p>
      </div>
    </motion.div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function GoldLoanSection({
  formData,
  errors,
  onFieldChange,
  className,
}: GoldLoanSectionProps) {
  const goldItems = (formData.goldItems as GoldItem[]) || [];

  const handleAddItem = () => {
    const newItem: GoldItem = {
      id: generateId(),
      itemType: '',
      description: '',
      grossWeight: '',
      netWeight: '',
      purity: '22k',
      quantity: '1',
    };
    onFieldChange('goldItems', [...goldItems, newItem]);
  };

  const handleUpdateItem = (index: number, updated: GoldItem) => {
    const updatedList = [...goldItems];
    updatedList[index] = updated;
    onFieldChange('goldItems', updatedList);
  };

  const handleDeleteItem = (index: number) => {
    const updatedList = goldItems.filter((_, i) => i !== index);
    onFieldChange('goldItems', updatedList);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">Gold Ornament Details</h3>
        <p className="text-sm text-white/60">
          Provide details of the gold ornaments you wish to pledge as collateral for the loan.
        </p>
      </div>

      {/* Loan Purpose */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
        <PremiumSelect
          label="Loan Purpose"
          options={LOAN_PURPOSE_OPTIONS}
          value={(formData.goldLoanPurpose as string) || ''}
          onChange={(e) => onFieldChange('goldLoanPurpose', e.target.value)}
          required
          error={errors.goldLoanPurpose}
        />
      </div>

      {/* Summary Card */}
      <SummaryCard items={goldItems} />

      {/* Gold Items List */}
      <AnimatePresence mode="popLayout">
        {goldItems.map((item, index) => (
          <GoldItemCard
            key={item.id}
            item={item}
            index={index}
            onUpdate={(updated) => handleUpdateItem(index, updated)}
            onDelete={() => handleDeleteItem(index)}
            errors={errors}
          />
        ))}
      </AnimatePresence>

      {/* Add Item Button */}
      <motion.button
        onClick={handleAddItem}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full p-4 rounded-2xl border-2 border-dashed border-amber-500/30 hover:border-amber-500/50
                   bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-300 group"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center
                        group-hover:bg-amber-500/30 transition-colors">
            <PlusIcon className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">
            Add Gold Item
          </span>
        </div>
      </motion.button>

      {/* No Items Message */}
      {goldItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center"
        >
          <GoldIcon className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/50">No gold items added yet</p>
          <p className="text-xs text-white/30 mt-1">Click the button above to add your gold ornaments</p>
        </motion.div>
      )}

      {/* Gold Rate Info */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScaleIcon className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/50">Current Gold Rate (22K)</span>
          </div>
          <span className="text-sm font-medium text-amber-400">{formatCurrency(GOLD_RATE_22K)}/gram</span>
        </div>
        <p className="text-xs text-white/40 mt-2">
          Rates are indicative. Actual valuation will be done by certified appraisers.
          Loan amount is typically 75% of the appraised gold value.
        </p>
      </div>

      {/* Required Loan Amount */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-orange-500/10 border border-brand-primary/20">
        <PremiumCurrencyInput
          label="Required Loan Amount"
          value={(formData.requiredGoldLoanAmount as string) || ''}
          onChange={(e) => onFieldChange('requiredGoldLoanAmount', e.target.value)}
          placeholder="e.g., 2,00,000"
          required
          helperText="Based on your gold value, you can get up to 75% as loan"
          error={errors.requiredGoldLoanAmount}
        />
      </div>
    </motion.div>
  );
}

export default GoldLoanSection;
