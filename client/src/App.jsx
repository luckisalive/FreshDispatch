import React from 'react';
import { InputForm } from './components/InputForm/InputForm';
import { Results } from './components/Results/Results';
import { HistoryPanel } from './components/History/HistoryPanel';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { ErrorMessage } from './components/common/ErrorMessage';
import { useCheck } from './hooks/useCheck';
import { useHistory } from './hooks/useHistory';
import './App.css';

export default function App() {
  const { loading, error, result, runCheck, clearResult, setResultDirectly } = useCheck();
  const { history, addEntry, deleteEntry, clearAll } = useHistory();

  const handleCheckSubmit = async (type, payload) => {
    const data = await runCheck(type, payload);
    if (data) {
      addEntry(type, payload, data);
    }
  };

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <span className="brand-badge">Editorial Verification Desk</span>
        <h1 className="app-title">FreshDispatch</h1>
        <p className="app-tagline">
          Evidence-based news & claim checker grounded with live web sources
        </p>
      </header>

      <main className="app-main">
        <InputForm onSubmit={handleCheckSubmit} loading={loading} />

        {error && (
          <ErrorMessage message={error} onDismiss={clearResult} />
        )}

        {loading && (
          <LoadingSpinner />
        )}

        {!loading && result && (
          <Results data={result} />
        )}

        <HistoryPanel
          history={history}
          onSelectEntry={setResultDirectly}
          onDeleteEntry={deleteEntry}
          onClearAll={clearAll}
        />
      </main>

      <footer className="app-footer">
        <p>FreshDispatch — AI-in-Web-Development Semester Project</p>
        <p>Zero tracking • No user accounts • Grounded evidence only</p>
      </footer>
    </div>
  );
}
