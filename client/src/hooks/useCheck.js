// client/src/hooks/useCheck.js
import { useState } from 'react';
import { checkContent } from '../utils/api';

export function useCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const runCheck = async (type, payload) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await checkContent(type, payload);
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message || 'An error occurred while verifying content.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return {
    loading,
    error,
    result,
    runCheck,
    clearResult,
  };
}
