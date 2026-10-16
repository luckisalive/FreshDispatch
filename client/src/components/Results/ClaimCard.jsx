// client/src/components/Results/ClaimCard.jsx
import React from 'react';

function isSafeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ClaimCard({ claim, index }) {
  if (!claim) return null;

  const {
    claimText = '',
    verdict = 'Unverified',
    confidence = 'low',
    explanation = '',
    evidence = [],
    limitations = '',
  } = claim;

  const verdictLower = verdict.toLowerCase();
  const cardAccentClass = `claim-card verdict-accent-${verdictLower}`;
  const verdictBadgeClass = `verdict-badge verdict-${verdictLower}`;

  return (
    <article className={cardAccentClass}>
      <header className="claim-header">
        <div className="claim-header-left">
          <span className="claim-number">Claim {index + 1}</span>
        </div>
        <div className="claim-badges">
          <span className={verdictBadgeClass}>
            <span className="verdict-dot" aria-hidden="true" />
            <span>{verdict}</span>
          </span>
          <span className="confidence-badge">Confidence: {confidence}</span>
        </div>
      </header>

      <h3 className="claim-text">"{claimText}"</h3>

      <div className="claim-section">
        <h4 className="section-label">Reasoning & Verdict Analysis</h4>
        <p className="explanation-text">{explanation}</p>
      </div>

      <div className="claim-section">
        <h4 className="section-label">Retrieved Evidence ({evidence.length})</h4>
        {evidence.length === 0 ? (
          <p className="no-evidence-note">No external sources confirmed or refuted this claim.</p>
        ) : (
          <ul className="evidence-list">
            {evidence.map((item, i) => (
              <li key={i} className="evidence-item">
                <div className="evidence-source-line">
                  <div className="evidence-source-title">
                    <span className="citation-pill">[{i + 1}]</span>
                    <strong className="evidence-source-name">{item.sourceName}</strong>
                  </div>
                  {isSafeUrl(item.url) && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-link"
                    >
                      Primary Source ↗
                    </a>
                  )}
                </div>
                <div className="evidence-summary-container">
                  <span className="ai-summary-label">AI summary supported by this source:</span>
                  <p className="evidence-summary-text">{item.aiSummary}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {limitations && (
        <div className="claim-limitations">
          <strong>Stated Limitations:</strong> {limitations}
        </div>
      )}
    </article>
  );
}
