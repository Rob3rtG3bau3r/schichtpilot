import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

function Ampel({ label, value, color, note }) {
  const bg =
    color === 'green' ? 'bg-green-600' :
    color === 'yellow' ? 'bg-yellow-500' :
    color === 'red' ? 'bg-red-600' :
    'bg-gray-500';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-700 bg-gray-900/40">
      <div className={`w-3 h-3 rounded-full shrink-0 ${bg}`} />

      <div className="text-sm min-w-0">
        <div className="font-medium text-gray-100">{label}</div>
        <div className="text-gray-300 break-words">{value}</div>
        {note && <div className="text-xs text-gray-400">{note}</div>}
      </div>
    </div>
  );
}

function SmallInfoCard({ label, value, note, color = 'gray' }) {
  const border =
    color === 'green' ? 'border-green-800/60' :
    color === 'yellow' ? 'border-yellow-700/60' :
    color === 'red' ? 'border-red-800/70' :
    'border-gray-700';

  return (
    <div className={`p-3 rounded-xl border ${border} bg-gray-900/30`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-100 break-words">{value}</div>
      {note && <div className="text-xs text-gray-500">{note}</div>}
    </div>
  );
}

function StatusBadge({ children, color = 'gray' }) {
  const cls =
    color === 'green' ? 'bg-green-900/50 text-green-100 border-green-700/60' :
    color === 'yellow' ? 'bg-yellow-900/40 text-yellow-100 border-yellow-700/60' :
    color === 'red' ? 'bg-red-900/50 text-red-100 border-red-700/60' :
    'bg-gray-800 text-gray-200 border-gray-700';

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded border text-xs ${cls}`}>
      {children}
    </span>
  );
}

export default function SystemTab() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Hauptwerte
  const [p95ms, setP95ms] = useState(null);
  const [p99ms, setP99ms] = useState(null);
  const [avgMs, setAvgMs] = useState(null);
  const [errRate, setErrRate] = useState(null);
  const [payloadKB, setPayloadKB] = useState(null);
  const [samples, setSamples] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  // Tabellen
  const [byKey, setByKey] = useState([]);
  const [topErrors, setTopErrors] = useState([]);

  // Fehlerarten aus topErrors abgeleitet
  const [errorBuckets, setErrorBuckets] = useState({
    permission: 0,
    auth: 0,
    schema: 0,
    rate429: 0,
    error: 0,
    other: 0,
  });

  // -------------------------------------------------
  // Fehler grob klassifizieren
  // -------------------------------------------------
  const getStatusBucket = (error) => {
    if (!error) return 'ok';

    const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();

    if (text.includes('rate limit') || text.includes('too many')) return '429';
    if (text.includes('permission denied') || text.includes('row-level security')) return 'permission';
    if (text.includes('jwt') || text.includes('auth')) return 'auth';
    if (text.includes('does not exist') || text.includes('column')) return 'schema';

    return 'error';
  };

  // -------------------------------------------------
  // Monitoring-Log schreiben
  // -------------------------------------------------
  const logMonitoring = async ({
    key,
    durationMs,
    statusBucket = 'ok',
    payloadBytes = null,
    page = 'SystemTab',
  }) => {
    try {
      await supabase.rpc('monitor_log_call', {
        p_key: key,
        p_duration_ms: Math.round(durationMs || 0),
        p_status_bucket: statusBucket,
        p_payload_bytes: payloadBytes,
        p_page: page,
        p_client_version: 'web',
      });
    } catch (e) {
      // Monitoring darf die App niemals blockieren
      console.warn('monitor_log_call failed (ignored)', e);
    }
  };

  // -------------------------------------------------
  // Percentile lokal für Live-Ping
  // -------------------------------------------------
  const percentile = (arr, q) => {
    if (!arr.length) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(q * sorted.length) - 1;

    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  };

  // -------------------------------------------------
  // Live-Check: monitor_ping 5x
  // -------------------------------------------------
  const probeNow = async () => {
    setLoading(true);
    setMsg('');

    const N = 5;
    const durations = [];
    let errors = 0;

    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      let statusBucket = 'ok';
      let payloadBytes = null;

      try {
        const { data, error } = await supabase.rpc('monitor_ping');

        if (error) {
          statusBucket = getStatusBucket(error);
          throw error;
        }

        if (data !== undefined) {
          try {
            payloadBytes = new Blob([JSON.stringify(data)]).size;
          } catch {
            payloadBytes = null;
          }
        }
      } catch (e) {
        errors++;
        console.error('monitor_ping failed', e);
      } finally {
        const dur = performance.now() - t0;
        durations.push(Math.max(0, dur));

        await logMonitoring({
          key: 'monitor_ping',
          durationMs: dur,
          statusBucket,
          payloadBytes,
          page: 'SystemTab',
        });
      }
    }

    const p95 = percentile(durations, 0.95);
    const p99 = percentile(durations, 0.99);
    const avg = durations.reduce((sum, x) => sum + x, 0) / durations.length;

    setP95ms(Math.round(p95 ?? 0));
    setP99ms(Math.round(p99 ?? 0));
    setAvgMs(Math.round(avg ?? 0));
    setErrRate(N ? Math.round((errors / N) * 1000) / 10 : 0);
    setSamples(N);
    setLastCheck(new Date());

    setMsg(errors === 0 ? '✅ Ping erfolgreich.' : `⚠️ Ping mit ${errors} Fehler(n).`);
    setLoading(false);
  };

  // -------------------------------------------------
  // Fehlerarten zusammenzählen
  // -------------------------------------------------
  const buildErrorBuckets = (rows) => {
    const next = {
      permission: 0,
      auth: 0,
      schema: 0,
      rate429: 0,
      error: 0,
      other: 0,
    };

    for (const row of rows || []) {
      const bucket = String(row.status_bucket || '').toLowerCase();
      const count = Number(row.errors || 0);

      if (bucket === 'permission') next.permission += count;
      else if (bucket === 'auth') next.auth += count;
      else if (bucket === 'schema') next.schema += count;
      else if (bucket === '429') next.rate429 += count;
      else if (bucket === 'error') next.error += count;
      else next.other += count;
    }

    return next;
  };

  // -------------------------------------------------
  // Monitoring-Protokoll letzte 15 Minuten laden
  // -------------------------------------------------
  const loadFromMonitoring = async () => {
    setLoading(true);
    setMsg('');

    try {
      const { data: currentData, error: currentErr } = await supabase.rpc('monitor_current_15m');

      if (currentErr) throw currentErr;

      const current = Array.isArray(currentData) ? currentData[0] : currentData;

      if (current) {
        setSamples(current.samples ?? 0);
        setP95ms(current.p95_ms ?? null);
        setP99ms(current.p99_ms ?? null);
        setAvgMs(current.avg_ms ?? null);
        setErrRate(current.error_rate_pct ?? 0);
        setPayloadKB(current.avg_payload_kb ?? null);
      } else {
        setSamples(0);
        setP95ms(null);
        setP99ms(null);
        setAvgMs(null);
        setErrRate(null);
        setPayloadKB(null);
      }

      const { data: keys, error: keysErr } = await supabase.rpc('monitor_by_key_15m');
      if (keysErr) throw keysErr;
      setByKey(keys || []);

      const { data: errors, error: errorsErr } = await supabase.rpc('monitor_top_errors_15m');
      if (errorsErr) throw errorsErr;

      setTopErrors(errors || []);
      setErrorBuckets(buildErrorBuckets(errors || []));

      setLastCheck(new Date());
      setMsg('✅ Monitoring-Protokoll geladen.');
    } catch (e) {
      console.error(e);
      setMsg(`❌ Monitoring konnte nicht geladen werden: ${e?.message || 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------
  // Alles einmal: Ping + danach Protokoll laden
  // -------------------------------------------------
  const runFullCheck = async () => {
    await probeNow();

    // kleiner Mini-Wartepunkt, damit die gerade geschriebenen Logs sicher sichtbar sind
    setTimeout(() => {
      loadFromMonitoring();
    }, 250);
  };

  // -------------------------------------------------
  // Farben
  // -------------------------------------------------
  const colorP95 =
    p95ms == null ? 'gray' :
    p95ms < 300 ? 'green' :
    p95ms <= 800 ? 'yellow' :
    'red';

  const colorErr =
    errRate == null ? 'gray' :
    errRate < 0.5 ? 'green' :
    errRate <= 2 ? 'yellow' :
    'red';

  const colorPayload =
    payloadKB == null ? 'gray' :
    payloadKB < 200 ? 'green' :
    payloadKB <= 400 ? 'yellow' :
    'red';

  const colorSamples =
    samples == null ? 'gray' :
    samples > 0 ? 'green' :
    'yellow';

  const totalBucketErrors =
    Number(errorBuckets.permission || 0) +
    Number(errorBuckets.auth || 0) +
    Number(errorBuckets.schema || 0) +
    Number(errorBuckets.rate429 || 0) +
    Number(errorBuckets.error || 0) +
    Number(errorBuckets.other || 0);

  const permissionColor =
    errorBuckets.permission === 0 ? 'green' :
    errorBuckets.permission <= 3 ? 'yellow' :
    'red';

  const authColor =
    errorBuckets.auth === 0 ? 'green' :
    errorBuckets.auth <= 3 ? 'yellow' :
    'red';

  const schemaColor =
    errorBuckets.schema === 0 ? 'green' : 'red';

  const rateColor =
    errorBuckets.rate429 === 0 ? 'green' :
    errorBuckets.rate429 <= 3 ? 'yellow' :
    'red';

  // -------------------------------------------------
  // Formatierung
  // -------------------------------------------------
  const formatDateTime = (value) => {
    if (!value) return '—';

    const d = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  };

  const getRowErrorColor = (bucket) => {
    const b = String(bucket || '').toLowerCase();

    if (b === 'permission') return 'yellow';
    if (b === 'auth') return 'yellow';
    if (b === 'schema') return 'red';
    if (b === '429') return 'yellow';
    if (b === 'error') return 'red';

    return 'gray';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-900/30 p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              System-Monitoring
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Technische Gesundheit: Erreichbarkeit, RPC-Zeiten, Fehlerquote und Fehlerarten.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={probeNow}
              disabled={loading}
              className={`px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Sofortiger Ping mit 5 kleinen RPC-Aufrufen"
            >
              {loading ? 'Prüfe…' : 'Jetzt prüfen'}
            </button>

            <button
              onClick={loadFromMonitoring}
              disabled={loading}
              className={`px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Monitoring der letzten 15 Minuten laden"
            >
              Protokoll laden
            </button>

            <button
              onClick={runFullCheck}
              disabled={loading}
              className={`px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Ping ausführen und danach Protokoll laden"
            >
              Komplett prüfen
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-3 rounded-lg border border-gray-700 bg-gray-950/40 px-3 py-2 text-sm text-gray-200">
            {msg}
          </div>
        )}

        {/* Haupt-Ampeln */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Ampel
            label="p95 RPC-Zeit"
            value={p95ms == null ? '—' : `${p95ms} ms`}
            color={colorP95}
            note="Ziel: < 300 ms"
          />

          <Ampel
            label="Fehlerquote"
            value={errRate == null ? '—' : `${Number(errRate).toFixed(1)} %`}
            color={colorErr}
            note="Ziel: < 0,5 %"
          />

          <Ampel
            label="Ø Payload pro Call"
            value={payloadKB == null ? '—' : `${Number(payloadKB).toFixed(1)} KB`}
            color={colorPayload}
            note="Ziel: < 200 KB"
          />

          <Ampel
            label="Samples"
            value={samples == null ? '—' : samples}
            color={colorSamples}
            note="Messungen letzte 15 Minuten"
          />
        </div>

        {/* Zusatzwerte */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <SmallInfoCard
            label="p99 RPC-Zeit"
            value={p99ms == null ? '—' : `${p99ms} ms`}
            note="Zeigt starke Ausreißer"
          />

          <SmallInfoCard
            label="Ø RPC-Zeit"
            value={avgMs == null ? '—' : `${Number(avgMs).toFixed(0)} ms`}
            note="Durchschnitt"
          />

          <SmallInfoCard
            label="Letzter Check"
            value={formatDateTime(lastCheck)}
            note="Lokale Browserzeit"
          />
        </div>

        {/* Fehlerarten */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-200">
              Fehlerarten letzte 15 Minuten
            </h3>

            <div className="text-xs text-gray-500">
              Gesamt: {totalBucketErrors}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <SmallInfoCard
              label="Permission / RLS"
              value={errorBuckets.permission}
              note="Rechte, Policies, Zugriff"
              color={permissionColor}
            />

            <SmallInfoCard
              label="Auth / JWT"
              value={errorBuckets.auth}
              note="Session, Login, Token"
              color={authColor}
            />

            <SmallInfoCard
              label="Schema"
              value={errorBuckets.schema}
              note="Spalte/Funktion fehlt"
              color={schemaColor}
            />

            <SmallInfoCard
              label="429 / Rate Limit"
              value={errorBuckets.rate429}
              note="Zu viele Anfragen"
              color={rateColor}
            />

            <SmallInfoCard
              label="Sonstige Fehler"
              value={Number(errorBuckets.error || 0) + Number(errorBuckets.other || 0)}
              note="Nicht genauer klassifiziert"
              color={(Number(errorBuckets.error || 0) + Number(errorBuckets.other || 0)) === 0 ? 'green' : 'red'}
            />
          </div>
        </div>

        {/* Top langsame Keys */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            Top langsame Keys letzte 15 Minuten
          </h3>

          {byKey?.length > 0 ? (
            <div className="rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-900/70">
                    <tr className="text-left text-gray-300">
                      <th className="px-3 py-2">Key</th>
                      <th className="px-3 py-2">Samples</th>
                      <th className="px-3 py-2">p95</th>
                      <th className="px-3 py-2">p99</th>
                      <th className="px-3 py-2">Ø</th>
                      <th className="px-3 py-2">Fehler</th>
                      <th className="px-3 py-2">Ø Payload</th>
                    </tr>
                  </thead>

                  <tbody>
                    {byKey.map((row, idx) => (
                      <tr
                        key={`${row.key}-${idx}`}
                        className="border-t border-gray-800 text-gray-200"
                      >
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {row.key}
                        </td>

                        <td className="px-3 py-2">{row.samples}</td>

                        <td className="px-3 py-2">
                          {row.p95_ms ?? '—'} ms
                        </td>

                        <td className="px-3 py-2">
                          {row.p99_ms ?? '—'} ms
                        </td>

                        <td className="px-3 py-2">
                          {row.avg_ms == null ? '—' : `${Number(row.avg_ms).toFixed(0)} ms`}
                        </td>

                        <td className="px-3 py-2">
                          {Number(row.error_rate_pct || 0).toFixed(1)} %
                        </td>

                        <td className="px-3 py-2">
                          {row.avg_payload_kb == null
                            ? '—'
                            : `${Number(row.avg_payload_kb).toFixed(1)} KB`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 rounded-xl border border-gray-700 bg-gray-900/20 p-3">
              Noch keine Key-Daten vorhanden. Klicke auf „Komplett prüfen“ oder lade das Protokoll.
            </div>
          )}
        </div>

        {/* Top Fehler */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            Top Fehler letzte 15 Minuten
          </h3>

          {topErrors?.length > 0 ? (
            <div className="rounded-xl border border-red-900/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-red-950/40">
                    <tr className="text-left text-gray-300">
                      <th className="px-3 py-2">Key</th>
                      <th className="px-3 py-2">Fehlerart</th>
                      <th className="px-3 py-2">Seite</th>
                      <th className="px-3 py-2">Anzahl</th>
                      <th className="px-3 py-2">Zuletzt</th>
                    </tr>
                  </thead>

                  <tbody>
                    {topErrors.map((row, idx) => (
                      <tr
                        key={`${row.key}-${row.status_bucket}-${idx}`}
                        className="border-t border-red-900/40 text-gray-200"
                      >
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {row.key}
                        </td>

                        <td className="px-3 py-2">
                          <StatusBadge color={getRowErrorColor(row.status_bucket)}>
                            {row.status_bucket}
                          </StatusBadge>
                        </td>

                        <td className="px-3 py-2">
                          {row.page || '—'}
                        </td>

                        <td className="px-3 py-2">
                          {row.errors}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDateTime(row.last_seen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 rounded-xl border border-gray-700 bg-gray-900/20 p-3">
              Keine Fehler in den letzten 15 Minuten protokolliert.
            </div>
          )}
        </div>

        <div className="text-[10px] text-gray-500 mt-4">
          Hinweis: Dieses Monitoring zeigt technische Signale. Login-Auswertung, Cleanup-Logs und fachliche Betriebsdaten bleiben in den eigenen Tabs.
        </div>
      </div>
    </div>
  );
}