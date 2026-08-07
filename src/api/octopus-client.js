const DEFAULT_API_URL = import.meta.env.VITE_PUBLISHER_API_URL || "/api";

export async function executeOctopusMission({ objective, answers }) {
  const operationId = crypto.randomUUID();
  const prompt = [
    `Objectif utilisateur : ${objective}`,
    "Réponses au questionnaire :",
    ...answers.map((answer, index) => `${index + 1}. ${answer}`),
    "",
    "À partir du contexte vérifié disponible dans Publisher, propose un plan d'action concret, priorisé et directement exploitable.",
  ].join("\n");

  const response = await fetch(`${DEFAULT_API_URL.replace(/\/$/, "")}/octopus-adapter/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contract: "octopus-adapter-execution-v1",
      adapterId: "poulpe-fiction",
      mission: {
        operationId,
        title: `Poulpe Fiction — ${objective}`,
        objective: prompt,
        requiredCapabilities: ["copy.generate"],
        authorizedResources: ["publisher", "verified-knowledge"],
        prompt,
        context: {
          id: objective,
          label: objective,
          objective,
          metadata: {
            source: "poulpe-fiction",
            answers,
          },
        },
      },
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.summary || `Octopus API error: ${response.status}`);
  }

  return result;
}
