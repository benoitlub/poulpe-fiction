(function gardenHublotModule(global) {
  "use strict";

  function esc(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function latest(events, types) {
    return events.find((event) => types.includes(event.type));
  }

  function card(kind, eyebrow, title, detail, actionLabel, selector) {
    const action = actionLabel && selector
      ? `<button class="hublot-action" data-hublot-target="${esc(selector)}">${esc(actionLabel)}</button>`
      : "";
    return `<article class="hublot-card ${esc(kind)}">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h3>${esc(title)}</h3>
      ${detail ? `<p>${esc(detail)}</p>` : ""}
      ${action}
    </article>`;
  }

  function buildView(events) {
    const current = events[0];
    const growing = latest(events, ["seed-spotted", "bag-prepared", "garden-observing", "garden-running", "garden-queued"]);
    const ready = latest(events, ["harvest-returned"]);
    const thorn = latest(events, ["thorn-blocking", "garden-blocked", "garden-failed"]);
    const learned = latest(events, ["graft-consulted", "gesture-learned", "knowledge-kept"]);

    const nowTitle = current?.label || "Le jardin est calme. Gérard l’a décidé.";
    const nowDetail = current?.detail || "Gérard veille sans fabriquer de fausse activité.";

    return `<section class="garden-hublot" aria-labelledby="garden-hublot-title">
      <div class="hublot-head">
        <div>
          <p class="eyebrow">Hublot du Garden</p>
          <h2 id="garden-hublot-title">Ce qui vit maintenant</h2>
        </div>
        <span class="hublot-pulse" aria-hidden="true"></span>
      </div>
      <div class="hublot-now">
        <div class="hublot-gerard" aria-hidden="true">🐙</div>
        <div>
          <strong>${esc(nowTitle)}</strong>
          <p>${esc(nowDetail)}</p>
        </div>
      </div>
      <div class="hublot-grid">
        ${card(
          "growing",
          "🌱 Ce qui pousse",
          growing?.label || "Aucune pousse prioritaire",
          growing?.detail || "Gérard n’arrose rien au hasard.",
          growing ? "Voir la pousse" : "",
          growing ? ".greenhouse, .adventure-urge, .garden-runtime" : ""
        )}
        ${card(
          "ready",
          "🌾 Ce qui est prêt",
          ready?.label || "Aucune récolte prête",
          ready?.detail || "Le Garden ne prétend pas qu’une sortie existe.",
          ready ? "Voir la récolte" : "",
          ready ? ".adventure-return, .activity-echo" : ""
        )}
        ${card(
          "thorn",
          "🌵 L’épine",
          thorn?.label || "Aucune épine urgente",
          thorn?.detail || "Rien ne réclame Benoît pour le moment.",
          thorn ? "Voir le blocage" : "",
          thorn ? ".garden-runtime, .activity-echo" : ""
        )}
        ${card(
          "learned",
          "📚 Ce que Gérard retient",
          learned?.label || "Rien de nouveau à retenir",
          learned?.detail || "Une seule observation ne devient pas automatiquement un apprentissage.",
          learned ? "Voir la trace" : "",
          learned ? ".activity-echo, .adventure-urge" : ""
        )}
      </div>
    </section>`;
  }

  function bindActions(root) {
    root.querySelectorAll("[data-hublot-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.querySelector(button.dataset.hublotTarget || "");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function mount() {
    if (typeof document === "undefined") return;
    const root = document.getElementById("root");
    if (!root || !global.ActivityEcho?.collectEvents) return;
    const events = global.ActivityEcho.collectEvents();
    const html = buildView(events);
    const existing = root.querySelector(".garden-hublot");
    if (existing) existing.outerHTML = html;
    else root.insertAdjacentHTML("afterbegin", html);
    bindActions(root);
  }

  global.GardenHublot = { buildView, mount };

  if (typeof global.render === "function") {
    const baseRender = global.render;
    global.render = function renderWithGardenHublot() {
      baseRender();
      mount();
    };
    mount();
  }
})(globalThis);
