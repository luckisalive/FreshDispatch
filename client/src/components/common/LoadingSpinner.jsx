// client/src/components/common/LoadingSpinner.jsx
import React from 'react';

export function LoadingSpinner({ message = 'Analyzing content and retrieving web evidence...' }) {
  return (
    <div className="loading-container" role="status" aria-live="polite">
      <div className="spinner"></div>
      <p className="loading-message">{message}</p>
      <p className="loading-subtext">Evaluating factual claims using live search grounding</p>
    </div>
  );
}
