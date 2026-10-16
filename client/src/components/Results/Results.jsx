// client/src/components/Results/Results.jsx
import React from 'react';
import { Disclaimer } from './Disclaimer';
import { ClaimCard } from './ClaimCard';
import { SourcePanel } from './SourcePanel';
import './Results.css';

export function Results({ data }) {
  if (!data) return null;

  const { claims = [], sourcePanel = [], nonCheckableReason } = data;

  return (
    <div className="results-container">
      <Disclaimer />

      {nonCheckableReason && (
        <div className="non-checkable-box" role="status">
          <strong>Notice:</strong> {nonCheckableReason}
        </div>
      )}

      {claims.length > 0 && (
        <section className="claims-list-section">
          <h2 className="results-heading">
            Fact-Check Findings ({claims.length} {claims.length === 1 ? 'Claim' : 'Claims'})
          </h2>
          <div className="claims-grid">
            {claims.map((claim, index) => (
              <ClaimCard key={index} claim={claim} index={index} />
            ))}
          </div>
        </section>
      )}

      {sourcePanel.length > 0 && (
        <SourcePanel sources={sourcePanel} />
      )}
    </div>
  );
}
