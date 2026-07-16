interface Action {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export function HarvestActions({ actions }: { actions: Action[] }) {
  return (
    <div className="pf-actions-row">
      {actions.map((action) => (
        <button key={action.label} type="button" className={`pf-btn ${action.primary ? "pf-btn-primary" : "pf-btn-soft"}`} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
