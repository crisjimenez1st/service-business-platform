import { useNavigate } from 'react-router-dom';
import { Sheet } from '../ui';
import { SECONDARY_NAV } from './navConfig';
import { t } from '../../i18n/es';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onClose={onClose} title={t.nav.more}>
      <div className="grid grid-cols-2 gap-3">
        {SECONDARY_NAV.map((item) => (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              onClose();
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 py-5 px-3 text-slate-700 hover:bg-slate-50 active:bg-slate-100 min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <item.icon size={24} className="text-brand-600" />
            <span className="text-sm font-medium text-center">{item.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
