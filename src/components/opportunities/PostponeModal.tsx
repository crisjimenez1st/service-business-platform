import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { t } from '../../i18n/es';
import { todayIso } from '../../utils/dates';

interface PostponeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newDate: string) => void;
  currentDueDate?: string;
}

export default function PostponeModal({ open, onClose, onConfirm, currentDueDate }: PostponeModalProps) {
  const [date, setDate] = useState(currentDueDate ?? todayIso());

  function handleConfirm() {
    onConfirm(date);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.opportunities.postponeModalTitle}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t.opportunities.cancel}
          </Button>
          <Button fullWidth onClick={handleConfirm}>
            {t.opportunities.confirm}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-500 mb-4">{t.opportunities.postponeModalSubtitle}</p>
      <label htmlFor="postpone-date" className="block text-sm font-medium text-slate-700 mb-1.5">
        Nueva fecha
      </label>
      <input
        id="postpone-date"
        type="date"
        value={date}
        min={todayIso()}
        onChange={(e) => setDate(e.target.value)}
        className="w-full min-h-11 px-3 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
      />
    </Sheet>
  );
}
