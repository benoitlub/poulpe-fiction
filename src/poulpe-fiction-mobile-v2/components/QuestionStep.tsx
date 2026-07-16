import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
  canBack: boolean;
  canNext: boolean;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
}

export function QuestionStep({ eyebrow, title, hint, children, canBack, canNext, onBack, onNext, nextLabel = "Continuer" }: Props) {
  return (
    <section className="pf-card" aria-label={title}>
      <div className="pf-q-eyebrow">{eyebrow}</div>
      <h2 className="pf-q-title">{title}</h2>
      {hint ? <p className="pf-q-hint">{hint}</p> : null}
      {children}
      <div className="pf-actions">
        <button type="button" className="pf-btn pf-btn-ghost" onClick={onBack} disabled={!canBack} style={{ visibility: canBack ? "visible" : "hidden" }}>← Retour</button>
        <button type="button" className="pf-btn pf-btn-primary" onClick={onNext} disabled={!canNext}>{nextLabel}</button>
      </div>
    </section>
  );
}
