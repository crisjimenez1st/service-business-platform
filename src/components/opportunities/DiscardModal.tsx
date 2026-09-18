import { Sheet, Button } from '../ui';
import { t } from '../../i18n/es';

interface DiscardModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DiscardModal({ open, onClose, onConfirm }: DiscardModalProps) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.opportunities.discardModalTitle}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t.opportunities.cancel}
          </Button>
          <Button variant="danger" fullWidth onClick={handleConfirm}>
            {t.opportunities.discard}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">{t.opportunities.discardModalSubtitle}</p>
    </Sheet>
  );
}
