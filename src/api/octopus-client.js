const DEFAULT_API_URL = import.meta.env.VITE_PUBLISHER_API_URL || "http://localhost:3000/api";

export async function executeOctopusMission({ objective, answers }) {
  const response = await fetch(`${DEFAULT_API_URL}/octopus-adapter/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      missionId: crypto.randomUUID(),
      capability: "publisher.plan",
      context: {
        id: objective,
        metadata: {
          source: "poulpe-fiction",
        },
      },
      input: {
        objective,
        answers,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Octopus API error: ${response.status}`);
  }

  return response.json();
}
