import { useEffect, useState } from 'react';
import { octopus } from '../lib/octopus-client';

export function EngineStatus() {
  const [status, setStatus] = useState<string>('connexion...');
  const [brief, setBrief] = useState<string>('');

  useEffect(() => {
    octopus.health()
      .then(r => {
        setStatus(`🟢 ${r.status} — ${r.mode}`);
        return octopus.brief();
      })
      .then(r => setBrief(r.brief))
      .catch(() => setStatus('🔴 Moteur hors ligne'));
  }, []);

  return (
    <div style={{ padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
      <h3>🐙 Octopus Engine</h3>
      <p><strong>Statut :</strong> {status}</p>
      {brief && <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{brief}</pre>}
    </div>
  );
}
