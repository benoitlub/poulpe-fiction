import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, Loader2, Target, Wand2 } from "lucide-react";
import "./styles.css";

const objectives = [
  {
    id: "clients",
    title: "Trouver des clients",
    hint: "2 rendez-vous qualifiés par mois, sans usine à gaz.",
    example: "J'ai une page Facebook avec 3 abonnés et je veux 1 à 2 clients qualifiés par mois.",
  },
  {
    id: "books",
    title: "Faire connaître mes créations",
    hint: "Livres, applis, jeux, contenus : transformer l'existant en campagne.",
    example: "J'ai 6 livres Amazon, 1000 abonnés Instagram et LinkedIn, et je veux créer de l'intérêt.",
  },
  {
    id: "saas",
    title: "Lancer un service ou SaaS",
    hint: "Positionnement, offre, audience, première page, premières actions.",
    example: "Je veux vendre un abonnement qui résout un problème connu.",
  },
  {
    id: "product",
    title: "Vendre un produit digital",
    hint: "Une offre claire, une page utile, une campagne simple.",
    example: "J'ai une formation ou un fichier à vendre, mais pas de système.",
  },
];

const questionSets = {
  clients: [
    "Quel résultat concret voulez-vous obtenir dans les 30 prochains jours ?",
    "Que vendez-vous, à qui, et pour quel montant moyen ?",
    "Quels canaux existent déjà : site, Facebook, Instagram, LinkedIn, Google, bouche-à-oreille ?",
    "Qu'est-ce qui bloque aujourd'hui : visibilité, confiance, offre, suivi, régularité ?",
  ],
  books: [
    "Quelles créations voulez-vous faire connaître en priorité ?",
    "Où avez-vous déjà une audience, même petite ?",
    "Quel ton doit être bien accueilli : sérieux, drôle, intime, étrange, pédagogique ?",
    "Quel résultat serait déjà une victoire dans 30 jours ?",
  ],
  saas: [
    "Quel problème précis votre service résout-il ?",
    "Qui souffre le plus de ce problème aujourd'hui ?",
    "Quelle preuve avez-vous que ces personnes paient ou cherchent une solution ?",
    "Quel abonnement ou offre simple pouvez-vous tester rapidement ?",
  ],
  product: [
    "Quel produit voulez-vous vendre ?",
    "À qui rend-il service concrètement ?",
    "Où ces personnes vous découvrent-elles aujourd'hui ?",
    "Quel premier résultat voulez-vous : ventes, emails, rendez-vous, précommandes ?",
  ],
};

function buildPlan(objective, answers) {
  const first = answers[0] || "un résultat clair";
  const channels = answers[2] || "les canaux existants";
  const block = answers[3] || "le blocage principal";

  return [
    {
      title: "Clarifier l'offre",
      detail: `Transformer l'objectif “${first}” en promesse lisible en 10 secondes.`,
    },
    {
      title: "Choisir le canal prioritaire",
      detail: `Ne pas disperser l'énergie : exploiter d'abord ${channels}.`,
    },
    {
      title: "Créer la première séquence",
      detail: "Préparer 7 contenus, 1 page de destination et 1 message de contact simple.",
    },
    {
      title: "Mesurer sans se noyer",
      detail: `Suivre seulement 3 signaux : vues utiles, réponses, demandes qualifiées. Blocage à traiter : ${block}.`,
    },
  ];
}

function App() {
  const [step, setStep] = useState("objective");
  const [objective, setObjective] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [draft, setDraft] = useState("");

  const selected = objectives.find((item) => item.id === objective);
  const questions = objective ? questionSets[objective] : [];
  const plan = useMemo(() => (selected ? buildPlan(selected, answers) : []), [selected, answers]);

  const chooseObjective = (id) => {
    setObjective(id);
    setQuestionIndex(0);
    setAnswers([]);
    setDraft("");
    setStep("dialogue");
  };

  const submitAnswer = () => {
    if (!draft.trim()) return;
    const nextAnswers = [...answers, draft.trim()];
    setAnswers(nextAnswers);
    setDraft("");

    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setStep("analysis");
      window.setTimeout(() => setStep("plan"), 1400);
    }
  };

  const restart = () => {
    setStep("objective");
    setObjective(null);
    setQuestionIndex(0);
    setAnswers([]);
    setDraft("");
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="brand-row">
          <div className="brand-mark"><Target size={22} /></div>
          <div>
            <p className="eyebrow">Poulpe Fiction · World Adapter Octopus</p>
            <h1>Quel résultat voulez-vous obtenir ?</h1>
          </div>
        </div>

        {step === "objective" && (
          <div className="grid objectives">
            {objectives.map((item) => (
              <button className="objective-card" key={item.id} onClick={() => chooseObjective(item.id)}>
                <span>{item.title}</span>
                <small>{item.hint}</small>
                <em>{item.example}</em>
              </button>
            ))}
          </div>
        )}

        {step === "dialogue" && selected && (
          <div className="dialogue-panel">
            <div className="progress-line">
              <span>Objectif : {selected.title}</span>
              <span>{questionIndex + 1}/{questions.length}</span>
            </div>
            <h2>{questions[questionIndex]}</h2>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Réponse courte, naturelle. Pas besoin de faire joli."
              autoFocus
            />
            <div className="actions">
              <button className="ghost" onClick={restart}>Changer d'objectif</button>
              <button className="primary" onClick={submitAnswer}>Continuer <ArrowRight size={18} /></button>
            </div>
          </div>
        )}

        {step === "analysis" && (
          <div className="analysis-panel">
            <Loader2 className="spin" size={34} />
            <h2>Analyse en cours</h2>
            <p>Le moteur prépare le plan. Le jardin reste derrière le rideau.</p>
            <ul>
              <li><Check size={16} /> Objectif compris</li>
              <li><Check size={16} /> Contexte priorisé</li>
              <li><Check size={16} /> Première mission préparée</li>
            </ul>
          </div>
        )}

        {step === "plan" && selected && (
          <div className="plan-panel">
            <p className="eyebrow">Plan proposé</p>
            <h2>{selected.title}</h2>
            <div className="plan-list">
              {plan.map((item, index) => (
                <article className="plan-item" key={item.title}>
                  <strong>{index + 1}. {item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
            <div className="mission-card">
              <Wand2 size={22} />
              <div>
                <strong>Première mission</strong>
                <p>Rédiger la promesse, les 3 preuves et le premier message de campagne.</p>
              </div>
              <button className="primary">Commencer</button>
            </div>
            <button className="ghost" onClick={restart}>Nouvel objectif</button>
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
