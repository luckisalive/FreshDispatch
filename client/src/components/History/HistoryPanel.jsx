// client/src/components/History/HistoryPanel.jsx
import React, { useState } from 'react';
import './HistoryPanel.css';

export function HistoryPanel({ history, onSelectEntry, onDeleteEntry, onClearAll }) {
  const [isOpen, setIsOpen] = useState(true);

  const formatTimestamp = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getVerdictClass = (summary = '') => {
    const lower = summary.toLowerCase();
    if (lower.startsWith('supported')) return 'history-verdict-supported';
    if (lower.startsWith('contradicted')) return 'history-verdict-contradicted';
    if (lower.startsWith('mixed')) return 'history-verdict-mixed';
    if (lower.startsWith('unverified')) return 'history-verdict-unverified';
    if (lower.startsWith('synthesis')) return 'history-verdict-synthesis';
    return 'history-verdict-default';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'link': return '🔗 Link';
      case 'image': return '🖼️ Image';
      case 'question': return '❓ Question';
      default: return '📝 Text';
    }
  };

  return (
    <section className="history-panel-container">
      <div className="history-panel-header">
        <div className="history-title-group" onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0}>
          <span className="history-toggle-icon">{isOpen ? '▼' : '►'}</span>
          <h2 className="history-title">Recent Checks</h2>
          <span className="history-count-badge">{history.length} / 20</span>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            className="history-clear-btn"
            onClick={() => {
              if (window.confirm('Clear all local fact-check history?')) {
                onClearAll();
              }
            }}
            title="Clear all saved checks from browser memory"
          >
            Clear All
          </button>
        )}
      </div>

      {isOpen && (
        <div className="history-body">
          {history.length === 0 ? (
            <div className="history-empty-state">
              <p>No recent checks in this browser. Run a check above and it will be preserved here (up to 20).</p>
            </div>
          ) : (
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.id} className="history-item">
                  <div className="history-item-top">
                    <span className="history-type-tag">{getTypeIcon(item.type)}</span>
                    <span className="history-time">{formatTimestamp(item.timestamp)}</span>
                  </div>

                  <p
                    className="history-query-preview"
                    onClick={() => onSelectEntry(item.data)}
                    title="Click to view full investigation report"
                  >
                    {item.queryPreview}
                  </p>

                  <div className="history-item-bottom">
                    <span className={`history-verdict-pill ${getVerdictClass(item.verdictSummary)}`}>
                      {item.verdictSummary}
                    </span>

                    <div className="history-item-actions">
                      <button
                        type="button"
                        className="history-restore-btn"
                        onClick={() => onSelectEntry(item.data)}
                      >
                        View Report ↗
                      </button>
                      <button
                        type="button"
                        className="history-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEntry(item.id);
                        }}
                        title="Delete this item from history"
                        aria-label="Delete entry"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
