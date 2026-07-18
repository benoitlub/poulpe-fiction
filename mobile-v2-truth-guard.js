(function mobileV2TruthGuard(global) {
  "use strict";

  const adapter = global.PoulpeOctopusAdapter;
  if (!adapter?.dispatch || adapter.__truthGuardInstalled) return;

  const originalDispatch = adapter.dispatch.bind(adapter);
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

  function capabilities(payload) {
    const list = Array.isArray(payload?.requiredCapabilities) ? payload.requiredCapabilities : [];
    const requested = text(record(record(payload?.context).metadata).requestedCapability);
    return [...list.map((item) => String(item).toLowerCase()), requested.toLowerCase()].filter(Boolean);
  }

  function needsVerifiedKnowledge(payload) {
    return capabilities(payload).some((capability) =>
      capability.includes("copy.generate") ||
      capability.includes("landing.generate") ||
      capability.includes("campaign.generate")
    );
  }

  function artifactFrom(result) {
    const output = record(result?.output);
    const artifacts = Array.isArray(output.artifacts) ? output.artifacts.map(record) : [];
    const artifact = artifacts[0] || record(result?.artifact);
    const content = text(artifact.content) || text(artifact.artifact) || text(output.text) || text(result?.content);
    const url = text(artifact.url) || text(artifact.previewUrl) || text(result?.url) || text(result?.preview);
    return content || url ? { content, url } : null;
  }

  function blocked(payload, message, details = {}) {
    return {
      result: {
        status: "blocked",
        operationId: text(payload?.operationId),
        parcelId: text(payload?.parcelId) || text(record(payload?.context).id),
        summary: message,
        obstacle: { code: "verified-knowledge-required", message, ...details },
      },
      bundle: null,
      context: record(payload?.context),
    };
  }

  adapter.dispatch = async function guardedDispatch(payload, options) {
    if (!needsVerifiedKnowledge(payload)) {
      const response = await originalDispatch(payload, options);
      const result = record(record(response).result);
      const status = text(result.status).toLowerCase();
      if (["ready", "completed", "complete", "success", "done"].includes(status) && !artifactFrom(result)) {
        return blocked(payload, "La mission est terminée sans livrable exploitable. Gérard refuse d’afficher une fausse récolte.", { upstreamStatus: status });
      }
      return response;
    }

    const metadata = record(record(payload?.context).metadata);
    const knowledgeSlug = text(metadata.knowledgeSlug);
    if (!knowledgeSlug) {
      return blocked(payload, "Aucun Knowledge Package n’est identifié pour cette parcelle.");
    }

    if (!global.PublisherKnowledge?.load) {
      return blocked(payload, "PublisherKnowledge n’est pas chargé. Aucune rédaction n’est lancée.", { knowledgeSlug });
    }

    let pack;
    try {
      pack = await global.PublisherKnowledge.load(knowledgeSlug);
    } catch (error) {
      return blocked(payload, `Publisher n’a pas pu charger le Knowledge Package « ${knowledgeSlug} ».`, {
        knowledgeSlug,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const verifiedPrompt = text(pack?.prompt);
    if (!pack?.verified || !verifiedPrompt) {
      return blocked(payload, `Publisher ne trouve pas de Knowledge Package vérifié pour « ${knowledgeSlug} ». Aucune rédaction n’est lancée.`, {
        knowledgeSlug,
        source: text(pack?.source) || null,
        diagnostics: pack?.diagnostics || null,
      });
    }

    const guardedPayload = {
      ...payload,
      context: {
        ...record(payload?.context),
        metadata: {
          ...metadata,
          knowledgeSlug,
          knowledgeVerified: true,
          knowledgeSource: text(pack?.source) || "publisher",
          knowledgeFetchedAt: text(pack?.fetchedAt) || new Date().toISOString(),
        },
      },
      prompt: [
        text(payload?.prompt),
        "",
        "=== KNOWLEDGE PACKAGE VÉRIFIÉ — SOURCE DE VÉRITÉ ===",
        verifiedPrompt,
        "=== FIN DU KNOWLEDGE PACKAGE ===",
        "Toute affirmation absente de ce dossier doit être omise ou signalée comme information manquante. N’invente rien.",
      ].filter(Boolean).join("\n"),
    };

    const response = await originalDispatch(guardedPayload, options);
    const result = record(record(response).result);
    const status = text(result.status).toLowerCase();
    if (["ready", "completed", "complete", "success", "done"].includes(status) && !artifactFrom(result)) {
      return blocked(guardedPayload, "La mission est terminée sans livrable exploitable. Gérard refuse d’afficher une fausse récolte.", { upstreamStatus: status, knowledgeSlug });
    }
    return response;
  };

  adapter.__truthGuardInstalled = true;
})(globalThis);
