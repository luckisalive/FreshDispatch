// client/src/components/common/ErrorMessage.jsx
import React from 'react';

export function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className="error-banner" role="alert">
      <div className="error-content">
        <span className="error-icon" aria-hidden="true">⚠️</span>
        <div className="error-text">
          <strong>Verification Error:</strong> {message}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="error-dismiss-btn"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
