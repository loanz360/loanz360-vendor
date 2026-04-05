/**
 * Knowledge Base Components - Main Export
 */

export { KnowledgeBaseMain } from './KnowledgeBaseMain'
export { KnowledgeBaseCategory } from './KnowledgeBaseCategory'
export { KnowledgeBaseGlossary } from './KnowledgeBaseGlossary'
export { KnowledgeBaseFAQDetail } from './KnowledgeBaseFAQDetail'
export { KnowledgeBaseErrorBoundary } from './KnowledgeBaseErrorBoundary'

// Re-export types for convenience
export type {
  KBCategory,
  KBFAQ,
  KBGlossaryTerm,
  KBSearchResult
} from '@/types/knowledge-base'
