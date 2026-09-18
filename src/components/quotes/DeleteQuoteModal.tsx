import { Sheet, Button } from '../ui';
import { t } from '../../i18n/es';

interface DeleteQuoteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Mismo patrón que DiscardModal (Oportunidades) — confirmación simple antes de una acción irreversible. */
export default function DeleteQuoteModal({ open, onClose, onConfirm }: DeleteQuoteModalProps) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.quotes.deleteConfirmTitle}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t.opportunities.cancel}
          </Button>
          <Button variant="danger" fullWidth onClick={handleConfirm}>
            {t.quotes.delete}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">{t.quotes.deleteConfirmMessage}</p>
    </Sheet>
  );
}
