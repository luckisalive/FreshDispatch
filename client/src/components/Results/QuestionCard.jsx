// client/src/components/Results/QuestionCard.jsx
import React from 'react';
import './Results.css';

export function QuestionCard({ data }) {
  if (!data) return null;

  const {
    query,
    summary,
    keyDates = [],
    conflictingAccounts,
    limitations,
    sources = [],
  } = data;

  return (
    <article className="question-card">
      <header className="question-card-header">
        <div className="question-badge-row">
          <span className="question-badge">Question Mode</span>
          <span className="question-sub-badge">Evidence Synthesis (No Verdict)</span>
        </div>
        {query && (
          <h2 className="question-title">
            <span className="question-mark-icon">Q:</span> {query}
          </h2>
        )}
      </header>

      {/* Summary section */}
      <section className="question-summary-section">
        <h3 className="section-label">Reported Findings & Summary</h3>
        <p className="question-summary-text">{summary}</p>
      </section>

      {/* Key Dates (if extracted) */}
      {keyDates.length > 0 && (
        <section className="key-dates-section">
          <h3 className="section-label">Key Dates & Timeline Mentioned</h3>
          <div className="dates-pill-list">
            {keyDates.map((dateStr, idx) => (
              <span key={idx} className="date-pill">
                📅 {dateStr}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Conflicting Accounts (if any) */}
      {conflictingAccounts && conflictingAccounts.trim().length > 0 && (
        <section className="conflicting-accounts-box">
          <div className="conflicting-header">
            <span className="conflicting-icon">⚠️</span>
            <strong>Conflicting Accounts / Disputed Details:</strong>
          </div>
          <p className="conflicting-text">{conflictingAccounts}</p>
        </section>
      )}

      {/* Limitations */}
      {limitations && (
        <section className="limitations-box">
          <h3 className="limitations-label">Coverage Limitations</h3>
          <p className="limitations-text">{limitations}</p>
        </section>
      )}

      {/* Cited Evidence Sources */}
      {sources.length > 0 && (
        <section className="evidence-section">
          <h3 className="evidence-label">
            Cited Sources & Snippets ({sources.length})
          </h3>
          <ul className="evidence-list">
            {sources.map((item, idx) => (
              <li key={idx} className="evidence-item">
                <div className="evidence-source-header">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="evidence-source-link"
                  >
                    {item.sourceName || 'Web Source'} ↗
                  </a>
                </div>
                <blockquote className="evidence-snippet">
                  <span className="snippet-tag">AI summary supported by this source:</span>
                  <p>{item.aiSummary}</p>
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
