// client/src/hooks/useHistory.js
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'freshdispatch-history';
const MAX_HISTORY_ITEMS = 20;

/**
 * Custom hook to manage client-side check history stored in browser localStorage.
 * Restricts history strictly to the last 20 checks.
 * Never leaks data off-device.
 */
export function useHistory() {
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to parse history from localStorage; initializing empty history.', err);
      return [];
    }
  });

  // Sync to localStorage whenever history changes
  const persistHistory = (newHistory) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (err) {
      console.warn('Failed to save history to localStorage (possible quota limit exceeded):', err);
      // Attempt recovery by trimming older entries
      if (newHistory.length > 1) {
        const trimmed = newHistory.slice(0, Math.floor(newHistory.length / 2));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
          setHistory(trimmed);
        } catch {
          // If still failing, keep in state only
          setHistory(newHistory);
        }
      } else {
        setHistory(newHistory);
      }
    }
  };

  const addEntry = (type, payload, result) => {
    if (!result) return;

    let queryPreview = '';
    if (type === 'image') {
      queryPreview = payload?.name ? `Image: ${payload.name}` : 'Uploaded Screenshot / News Photo';
    } else if (typeof payload === 'string') {
      const trimmed = payload.trim();
      queryPreview = trimmed.length > 90 ? trimmed.substring(0, 90) + '…' : trimmed;
    } else {
      queryPreview = 'Fact-check query';
    }

    let verdictSummary = '';
    if (result.mode === 'question') {
      const count = result.sources?.length || 0;
      verdictSummary = `Synthesis (${count} ${count === 1 ? 'source' : 'sources'})`;
    } else if (result.claims && result.claims.length > 0) {
      const primaryVerdict = result.claims[0].verdict;
      const count = result.claims.length;
      verdictSummary = `${primaryVerdict} (${count} ${count === 1 ? 'claim' : 'claims'})`;
    } else if (result.nonCheckableReason) {
      verdictSummary = 'Non-checkable';
    } else {
      verdictSummary = 'Completed';
    }

    const newEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      type,
      queryPreview,
      verdictSummary,
      data: result,
    };

    const updated = [newEntry, ...history.filter(item => item.id !== newEntry.id)].slice(0, MAX_HISTORY_ITEMS);
    persistHistory(updated);
  };

  const deleteEntry = (id) => {
    const updated = history.filter(item => item.id !== id);
    persistHistory(updated);
  };

  const clearAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to remove history from localStorage:', err);
    }
    setHistory([]);
  };

  return {
    history,
    addEntry,
    deleteEntry,
    clearAll,
  };
}
