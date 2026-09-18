import { Card, Badge } from '../ui';
import type { Equipment } from '../../types';
import { formatDate } from '../../utils/dates';

interface EquipmentCardProps {
  equipment: Equipment;
}

const TYPE_LABELS: Record<Equipment['type'], string> = {
  camera: 'Cámara',
  dvr: 'DVR',
  nvr: 'NVR',
  hdd: 'Disco duro',
  ups: 'UPS',
  cable: 'Cableado',
  other: 'Otro',
};

export default function EquipmentCard({ equipment }: EquipmentCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <Badge tone="neutral">{TYPE_LABELS[equipment.type]}</Badge>
          <h3 className="font-semibold text-slate-900 mt-1.5">
            {equipment.brand} {equipment.model}
          </h3>
        </div>
        <span className="text-sm text-slate-500 shrink-0">×{equipment.quantity}</span>
      </div>
      <div className="text-sm text-slate-500 space-y-0.5">
        {equipment.serialNumber && <p>Serial: {equipment.serialNumber}</p>}
        <p>Instalado: {formatDate(equipment.installedDate)}</p>
        <p>Garantía: {equipment.warrantyMonths} meses</p>
        <p>Mantenimiento: cada {equipment.maintenanceIntervalMonths} meses</p>
      </div>
    </Card>
  );
}
