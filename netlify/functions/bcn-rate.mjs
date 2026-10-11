// Tipo de cambio oficial del Banco Central de Nicaragua (córdobas por dólar).
// Consulta el servicio web público del BCN (SOAP) y devuelve JSON simple.
// Si el día de hoy aún no tiene tasa, prueba los días anteriores.
import https from 'node:https';
import { constants } from 'node:crypto';

const ENDPOINT = 'https://servicios.bcn.gob.ni/Tc_Servicio/ServicioTC.asmx';

// El servidor del BCN usa un TLS antiguo que Node rechaza por defecto
// (ERR_SSL_UNSUPPORTED_PROTOCOL). Se relaja SOLO para esta consulta de un
// dato público (el tipo de cambio); no se envía ningún dato sensible.
function post(body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://servicios.bcn.gob.ni/RecuperaTC_Dia',
          'Content-Length': Buffer.byteLength(body),
        },
        minVersion: 'TLSv1',
        ciphers: 'DEFAULT@SECLEVEL=0',
        secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

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
  const res = await post(body);
  const xml = res.text;
  if (res.status < 200 || res.status >= 300) throw new Error(`BCN ${res.status}: ${xml.replace(/\s+/g, ' ').slice(0, 300)}`);
  const match = xml.match(/<RecuperaTC_DiaResult>\s*([\d.,]+)\s*<\/RecuperaTC_DiaResult>/);
  const rate = match ? Number(match[1].replace(',', '.')) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export default async (req) => {
  const debug = new URL(req.url).searchParams.has('debug');
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
  } catch (err) {
    // ?debug=1 muestra la causa para diagnosticar (solo texto del error, sin datos sensibles).
    const detail = debug ? { detail: String(err && err.message), cause: String((err && (err.code || (err.cause && err.cause.code))) || '') } : {};
    return new Response(JSON.stringify({ error: 'bcn_no_disponible', ...detail }), { status: 502, headers: { ...headers, 'Cache-Control': 'no-store' } });
  }
};
