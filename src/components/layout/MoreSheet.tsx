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

  return (
    <Sheet open={open} onClose={onClose} title={t.nav.more}>
      <div className="grid grid-cols-2 gap-3">
        {secondary.map((item) => (
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
