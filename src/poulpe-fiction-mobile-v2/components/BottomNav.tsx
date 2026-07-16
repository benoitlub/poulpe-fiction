import type { Tab } from "../store";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  harvestReady: boolean;
  hublotActive: boolean;
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "gerard", label: "Gérard", icon: "🐙" },
  { id: "hublot", label: "Hublot", icon: "🌙" },
  { id: "harvest", label: "Récolte", icon: "🧺" },
];

export function BottomNav({ active, onChange, harvestReady, hublotActive }: Props) {
  return (
    <nav className="pf-bottomnav" aria-label="Navigation principale">
      {TABS.map((tab) => {
        const hasActivity =
          (tab.id === "harvest" && harvestReady) ||
          (tab.id === "hublot" && hublotActive);
        return (
          <button
            key={tab.id}
            type="button"
            className="pf-tab"
            data-active={active === tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={active === tab.id ? "page" : undefined}
          >
            <span className="pf-tab-icon" aria-hidden="true">
              {tab.icon}{hasActivity ? " •" : ""}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
