// client/src/components/Results/SourcePanel.jsx
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

export function SourcePanel({ sources = [] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <section className="source-panel">
      <header className="source-panel-header">
        <h3 className="source-panel-title">Cited Sources & Publishers ({sources.length})</h3>
        <p className="source-credibility-note">
          Journalistic sourcing manifest. Inspect primary publishers directly.
        </p>
      </header>

      <ul className="source-list">
        {sources.map((src, index) => (
          <li key={index} className="source-item">
            <div className="source-item-left">
              <span className="citation-pill">[{index + 1}]</span>
              <span className="source-name">{src.title}</span>
            </div>
            {isSafeUrl(src.url) && (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-redirect-link"
              >
                External Document ↗
              </a>
            )}
          </li>
        ))}
      </ul>

      <footer className="source-panel-footer">
        <small>Sourced via live search grounding. Hyperlinks redirect through search verification indices.</small>
      </footer>
    </section>
  );
}
