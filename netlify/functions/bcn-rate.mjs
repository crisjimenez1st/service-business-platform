// Tipo de cambio oficial del Banco Central de Nicaragua (córdobas por dólar).
// Consulta el servicio web público del BCN (SOAP) y devuelve JSON simple.
// Si el día de hoy aún no tiene tasa, prueba los días anteriores.
const ENDPOINT = 'https://servicios.bcn.gob.ni/Tc_Servicio/ServicioTC.asmx';

function managuaToday() {
  // Nicaragua es UTC-6 todo el año.
  return new Date(Date.now() - 6 * 3600 * 1000);
}

async function fetchRate(y, m, d) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RecuperaTC_Dia xmlns="http://servicios.bcn.gob.ni/">
      <Ano>${y}</Ano><Mes>${m}</Mes><Dia>${d}</Dia>
    </RecuperaTC_Dia>
  </soap:Body>
</soap:Envelope>`;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'http://servicios.bcn.gob.ni/RecuperaTC_Dia',
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`BCN ${res.status}`);
  const xml = await res.text();
  const match = xml.match(/<RecuperaTC_DiaResult>\s*([\d.,]+)\s*<\/RecuperaTC_DiaResult>/);
  const rate = match ? Number(match[1].replace(',', '.')) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export default async () => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' };
  try {
    const base = managuaToday();
    for (let back = 0; back < 5; back++) {
      const day = new Date(base.getTime() - back * 86400000);
      const y = day.getUTCFullYear();
      const m = day.getUTCMonth() + 1;
      const d = day.getUTCDate();
      const rate = await fetchRate(y, m, d);
      if (rate) {
        const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return new Response(JSON.stringify({ rate, date, source: 'bcn' }), { status: 200, headers });
      }
    }
    return new Response(JSON.stringify({ error: 'sin_tasa' }), { status: 502, headers: { ...headers, 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(JSON.stringify({ error: 'bcn_no_disponible' }), { status: 502, headers: { ...headers, 'Cache-Control': 'no-store' } });
  }
};
