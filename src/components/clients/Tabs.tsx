interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

/** Tabs con scroll horizontal propio — igual estrategia que FilterChips para evitar overflow en móvil. */
export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-slate-200 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          aria-selected={active === tab.key}
          role="tab"
          className={[
            'shrink-0 min-h-11 px-4 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset',
            active === tab.key
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
