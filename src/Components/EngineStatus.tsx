import { useState } from 'react';
import { octopus, planterUneMissionDemo } from '../lib/octopus-client';

export function EngineStatus() {
  const [status, setStatus] = useState<string>('connexion...');
  const [brief, setBrief] = useState<string>('');
  const [mission, setMission] = useState<MissionResponse | null>(null);

  // ... useEffect existant pour health/brief ...

  async function lancerMission() {
    const result = await planterUneMissionDemo();
    setMission(result);
  }

  return (
    <div style={{ padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
      <h3>🐙 Octopus Engine</h3>
      <p><strong>Statut :</strong> {status}</p>
      {brief && <pre style={{ fontSize: 12 }}>{brief}</pre>}
      
      <button onClick={lancerMission} style={{ marginTop: 12, padding: '8px 16px' }}>
        🌱 Planter une Seed (Yaelbali)
      </button>
      
      {mission && (
        <div style={{ marginTop: 12, padding: 8, background: '#f0f0f0', borderRadius: 4 }}>
          <p><strong>Mission :</strong> {mission.operationId}</p>
          <p><strong>Statut :</strong> {mission.status}</p>
          <p><strong>Résumé :</strong> {mission.summary}</p>
        </div>
      )}
    </div>
  );
}
