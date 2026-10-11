import { useNavigate } from 'react-router-dom';
import { Sheet } from '../ui';
import { useNavItems } from '../../hooks/useNavItems';
import { t } from '../../i18n/es';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const navigate = useNavigate();
  const { secondary } = useNavItems();
  // Agrupa por sección conservando el orden; sin grupos (servicios técnicos) queda una sola lista.
  const groups: [string, typeof secondary][] = [];
  for (const item of secondary) {
    const key = item.group ?? '';
    const found = groups.find(([g]) => g === key);
    if (found) found[1].push(item);
    else groups.push([key, [item]]);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t.nav.more}>
      <div className="space-y-5">
        {groups.map(([group, items]) => (
          <section key={group}>
            {group && <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{group}</h3>}
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-white py-5 px-3 text-slate-700 hover:bg-flow-lilac active:bg-[#e2deff] min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <item.icon size={24} className="text-brand-600" />
                  <span className="text-sm font-medium text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
