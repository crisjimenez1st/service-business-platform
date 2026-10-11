import { useCallback, useState } from 'react';
import { getOfficialRate } from '../services/exchangeRateService';
import type { ExchangeRate } from '../utils/exchange';

/** Trae la tasa oficial del BCN bajo demanda y permite escribirla a mano si falla. */
export function useRateInput() {
  const [official, setOfficial] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [today] = useState(() => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10));

  const fetchRate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await getOfficialRate();
    if (r.error) setError(r.error.message);
    else setOfficial(r.data);
    setLoading(false);
  }, []);

  const manualNum = Number(manual.replace(',', '.'));
  const manualValid = manual.trim() !== '' && Number.isFinite(manualNum) && manualNum >= 10 && manualNum <= 200;
  const effective: ExchangeRate | null = manualValid
    ? { rate: manualNum, date: today, source: 'manual' }
    : official;

  return { official, loading, error, manual, setManual, manualValid, effective, fetchRate };
}
