'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEBOUNCE_MS = 500;

interface DraftEnvelope<T> {
  data: T;
  savedAt: number; // epoch ms
}

/**
 * Formats a timestamp into a human-readable relative time string.
 * e.g., "2 hours ago", "just now", "3 days ago"
 */
function formatDraftAge(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/**
 * Safely reads and parses a draft from localStorage.
 * Returns null if the key does not exist, the data is malformed,
 * or the draft has expired (older than 24 hours).
 */
function readDraft<T>(key: string): DraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const envelope: DraftEnvelope<T> = JSON.parse(raw);

    // Validate shape
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('data' in envelope) ||
      !('savedAt' in envelope) ||
      typeof envelope.savedAt !== 'number'
    ) {
      localStorage.removeItem(key);
      return null;
    }

    // Auto-expire after 24 hours
    if (Date.now() - envelope.savedAt > DRAFT_EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return envelope;
  } catch {
    // Corrupted data — remove it
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage might be unavailable entirely
    }
    return null;
  }
}

/**
 * Safely writes a draft envelope to localStorage.
 */
function writeDraft<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;

  try {
    const envelope: DraftEnvelope<T> = {
      data,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Removes a draft from localStorage.
 */
function removeDraft(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

/**
 * Offline-first form state persistence hook.
 *
 * Saves form state to localStorage under a namespaced key with debouncing.
 * On mount, detects if a draft exists and exposes `hasDraft` so the UI
 * can prompt the user to resume or discard the draft.
 *
 * Drafts auto-expire after 24 hours.
 *
 * @param key - Unique namespace key for this form (e.g., "loan-application-personal")
 * @param initialState - The default/empty state for the form
 *
 * @example
 * ```tsx
 * const { state, setState, hasDraft, draftAge, restoreDraft, discardDraft, clearDraft } =
 *   useFormPersistence('loan-app', { name: '', amount: 0 });
 *
 * // Show resume prompt
 * {hasDraft && (
 *   <div>
 *     <p>You have an unsaved draft from {draftAge}.</p>
 *     <button onClick={restoreDraft}>Resume draft</button>
 *     <button onClick={discardDraft}>Discard</button>
 *   </div>
 * )}
 *
 * // On successful submission
 * clearDraft();
 * ```
 */
export function useFormPersistence<T>(
  key: string,
  initialState: T
): {
  state: T;
  setState: React.Dispatch<React.SetStateAction<T>>;
  hasDraft: boolean;
  draftAge: string | null;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
} {
  const storageKey = `form_draft:${key}`;

  // Read any existing draft on first render only
  const existingDraft = useRef<DraftEnvelope<T> | null>(null);
  const initializedRef = useRef(false);

  if (!initializedRef.current) {
    existingDraft.current = readDraft<T>(storageKey);
    initializedRef.current = true;
  }

  const [state, setState] = useState<T>(initialState);
  const [hasDraft, setHasDraft] = useState<boolean>(existingDraft.current !== null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(
    existingDraft.current?.savedAt ?? null
  );
  const [draftAge, setDraftAge] = useState<string | null>(
    existingDraft.current ? formatDraftAge(existingDraft.current.savedAt) : null
  );

  // Track whether the user has restored (or discarded) the draft.
  // We only persist new state changes AFTER the draft prompt is resolved.
  const draftResolvedRef = useRef(!existingDraft.current);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep draftAge updated every minute while a draft exists
  useEffect(() => {
    if (draftSavedAt === null) {
      setDraftAge(null);
      return;
    }

    setDraftAge(formatDraftAge(draftSavedAt));

    const interval = setInterval(() => {
      // Re-check expiry
      if (Date.now() - draftSavedAt > DRAFT_EXPIRY_MS) {
        removeDraft(storageKey);
        setHasDraft(false);
        setDraftSavedAt(null);
        setDraftAge(null);
      } else {
        setDraftAge(formatDraftAge(draftSavedAt));
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [draftSavedAt, storageKey]);

  // Debounced save: persist state to localStorage when it changes
  useEffect(() => {
    // Don't save until the draft prompt has been resolved
    if (!draftResolvedRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      writeDraft(storageKey, state);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [state, storageKey]);

  /**
   * Restore the saved draft into the form state.
   */
  const restoreDraft = useCallback(() => {
    const draft = existingDraft.current;
    if (draft) {
      setState(draft.data);
    }
    setHasDraft(false);
    setDraftSavedAt(null);
    draftResolvedRef.current = true;
  }, []);

  /**
   * Discard the saved draft and keep using the initial/current state.
   */
  const discardDraft = useCallback(() => {
    removeDraft(storageKey);
    existingDraft.current = null;
    setHasDraft(false);
    setDraftSavedAt(null);
    draftResolvedRef.current = true;
  }, [storageKey]);

  /**
   * Clear the persisted draft (call after successful form submission).
   */
  const clearDraft = useCallback(() => {
    removeDraft(storageKey);
    existingDraft.current = null;
    setHasDraft(false);
    setDraftSavedAt(null);
    draftResolvedRef.current = true;
  }, [storageKey]);

  return {
    state,
    setState,
    hasDraft,
    draftAge,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}
