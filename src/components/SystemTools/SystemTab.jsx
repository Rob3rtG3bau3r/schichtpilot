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
      <div className={`w-3 h-3 rounded-full ${bg}`} />
      <div className="text-sm">
        <div className="font-medium text-gray-100">{label}</div>
        <div className="text-gray-300">{value}</div>
        {note && <div className="text-xs text-gray-400">{note}</div>}
      </div>
    </div>
  );
}

export default function SystemTab() {
  // Bestehende Aktionen
  const [loadingStunden, setLoadingStunden] = useState(false);
  const [loadingUrlaub, setLoadingUrlaub]   = useState(false);
  const [msg, setMsg] = useState('');

  // Monitoring-States
  const [mLoading, setMLoading]   = useState(false);
  const [p95ms, setP95ms]         = useState(null);
  const [errRate, setErrRate]     = useState(null);
  const [payloadKB, setPayloadKB] = useState(null);
  const [samples, setSamples]     = useState(null);
  const [byKey, setByKey]         = useState([]);

  // -------------------------------------------------
  // RPC-Wrapper mit leichtem Telemetrie-Logging (1:10)
  // -------------------------------------------------
  const call = async (fn, setter) => {
    setter(true); setMsg('');
    const t0 = performance.now();
    let status = 'ok';
    let payloadBytes = null;

    try {
      const { data, error } = await supabase.rpc(fn);
      if (error) { status = '5xx'; throw error; }
      if (data !== undefined) {
        try { payloadBytes = new Blob([JSON.stringify(data)]).size; } catch {}
      }
      setMsg(`✅ ${fn.replace('_',' ')} erfolgreich!`);
    } catch (e) {
      console.error(e);
      setMsg(`❌ Fehler bei ${fn}`);
    } finally {
      const dur = Math.round(performance.now() - t0);

      // sehr leichtgewichtig: nur jede 10. Messung loggen
      if (Math.random() < 0.1) {
        try {
          await supabase.rpc('monitor_log_call', {
            p_key: fn,
            p_duration_ms: dur,
            p_status_bucket: status,       // 'ok' | '5xx' (429 kannst du später setzen, falls du sie abfängst)
            p_payload_bytes: payloadBytes, // kann null sein
            p_page: 'SystemTab',
            p_client_version: 'web'
          });
        } catch (e) {
          // Telemetrie-Fehler niemals stören
          console.warn('monitor_log_call failed (ignored)', e);
        }
      }
      setter(false);
    }
  };

  // --------------------------
  // Live-Check (Ping) on demand
  // --------------------------
  const percentile = (arr, q) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const idx = Math.floor((s.length - 1) * q);
    return s[idx];
  };

  const probeNow = async () => {
    setMLoading(true);
    const N = 5; // klein & schnell
    const durations = [];
    let errors = 0;
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      try {
        const { error } = await supabase.rpc('monitor_ping'); // winziger Call (now())
        if (error) throw error;
      } catch {
        errors++;
      } finally {
        durations.push(Math.max(0, performance.now() - t0));
      }
    }
    const p95 = percentile(durations, 0.95);
    setP95ms(Math.round(p95 ?? 0));
    setErrRate(N ? Math.round((errors / N) * 1000) / 10 : 0); // 0.0–100.0 %
    // Payload bleibt hier ungesetzt (nur Phase „Aus Protokoll laden“ liefert das)
    setMLoading(false);
  };

  // ---------------------------------------------
  // Aus Protokoll laden (15-Minuten-Rollup-Views)
  // ---------------------------------------------
  const loadFromViews = async () => {
    setMLoading(true);
    try {
      const { data: cur, error: e1 } = await supabase
        .from('v_monitor_current_15m')
        .select('*')
        .single();
      if (e1 && e1.code !== 'PGRST116') { // PGRST116 = no rows
        console.error(e1);
      }

      if (cur) {
        setP95ms(cur.p95_ms ?? null);
        setErrRate(cur.error_rate_pct ?? null);
        setPayloadKB(cur.avg_payload_kb ?? null);
        setSamples(cur.samples ?? null);
      } else {
        setSamples(0);
      }

      const { data: keys, error: e2 } = await supabase
        .from('v_monitor_by_key_15m')
        .select('*')
        .limit(6);
      if (e2) console.error(e2);
      setByKey(keys || []);
    } finally {
      setMLoading(false);
    }
  };

  // Ampel-Farben nach deinen Schwellen
  const colorP95   = p95ms == null ? 'gray' : (p95ms < 300 ? 'green' : p95ms <= 800 ? 'yellow' : 'red');
  const colorErr   = errRate == null ? 'gray' : (errRate < 0.5 ? 'green' : errRate <= 2 ? 'yellow' : 'red');
  const colorPayld = payloadKB == null ? 'gray' : (payloadKB < 200 ? 'green' : payloadKB <= 400 ? 'yellow' : 'red');

  return (
    <div className="space-y-6">
      {/* Aktionen */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => call('berechne_stunden', setLoadingStunden)}
          disabled={loadingStunden}
          className={`px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 ${loadingStunden ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loadingStunden ? 'Berechne…' : 'Stunden neu berechnen'}
        </button>

        <button
          onClick={() => call('berechne_urlaub', setLoadingUrlaub)}
          disabled={loadingUrlaub}
          className={`px-3 py-2 rounded bg-green-600 hover:bg-green-700 ${loadingUrlaub ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loadingUrlaub ? 'Berechne…' : 'Urlaub neu berechnen'}
        </button>
      </div>
      {msg && <p className="text-sm text-gray-200">{msg}</p>}

      {/* Monitoring */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200">Monitoring</h3>
          <div className="flex gap-2">
            <button
              onClick={probeNow}
              disabled={mLoading}
              className={`px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 ${mLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Sofortiger Ping (5x)"
            >
              {mLoading ? 'Prüfe…' : 'Jetzt prüfen'}
            </button>
            <button
              onClick={loadFromViews}
              disabled={mLoading}
              className={`px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 ${mLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Letzte 15 Minuten laden"
            >
              Aus Protokoll laden
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Ampel
            label="p95 RPC-Zeit"
            value={p95ms == null ? '—' : `${p95ms} ms`}
            color={colorP95}
            note="Ziel: < 300 ms"
          />
          <Ampel
            label="Fehlerquote (429/5xx)"
            value={errRate == null ? '—' : `${Number(errRate).toFixed(1)} %`}
            color={colorErr}
            note="Ziel: < 0,5 %"
          />
          <Ampel
            label="Payload/Monat"
            value={payloadKB == null ? '— (View)' : `${Number(payloadKB).toFixed(1)} KB`}
            color={colorPayld}
            note="Ziel: < 200 KB"
          />
        </div>

        {samples != null && (
          <div className="text-xs text-gray-400 mt-1">
            Samples (15 Min): {samples}
          </div>
        )}

        {/* Breakdown pro Key (optional, top 6) */}
        {byKey?.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-3 py-2 text-sm font-semibold bg-gray-800 text-gray-100">
              Top-Keys (letzte 15 Min)
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-900/60">
                  <tr className="text-left text-gray-300">
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Samples</th>
                    <th className="px-3 py-2">p95 (ms)</th>
                    <th className="px-3 py-2">p99 (ms)</th>
                    <th className="px-3 py-2">Fehler (%)</th>
                    <th className="px-3 py-2">Ø Payload (KB)</th>
                  </tr>
                </thead>
                <tbody>
                  {byKey.map((row, idx) => (
                    <tr key={`${row.key}-${idx}`} className="border-t border-gray-800 text-gray-200">
                      <td className="px-3 py-2 font-mono">{row.key}</td>
                      <td className="px-3 py-2">{row.samples}</td>
                      <td className="px-3 py-2">{row.p95_ms}</td>
                      <td className="px-3 py-2">{row.p99_ms}</td>
                      <td className="px-3 py-2">{Number(row.error_rate_pct || 0).toFixed(1)}</td>
                      <td className="px-3 py-2">{Number(row.avg_payload_kb || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
