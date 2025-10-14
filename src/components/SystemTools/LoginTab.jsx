// src/components/SystemTools/LoginTab.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';

const PAGE_SIZE = 20;

// --- Mini Tooltip ---
function Tooltip({ children, visible }) {
  return (
    <div
      className={`absolute z-50 left-0 top-full mt-2 w-[320px] rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs shadow-2xl transition-opacity ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      role="tooltip"
    >
      {children}
    </div>
  );
}

// --- Best-effort UA Parser (keine externen Libs) ---
function parseUA(ua) {
  if (!ua) return {};
  const result = {
    browser: null,
    browserVersion: null,
    os: null,
    device: /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop',
    isPWA: /wv/.test(ua) || /; wv\)/.test(ua) ? 'WebView' : 'Browser',
  };

  // Browser
  const m =
    ua.match(/Edg\/([\d.]+)/) ||
    ua.match(/Chrome\/([\d.]+)/) ||
    ua.match(/Firefox\/([\d.]+)/) ||
    ua.match(/Version\/([\d.]+).*Safari/) ||
    ua.match(/Safari\/([\d.]+)/);
  if (m) {
    if (/Edg\//.test(ua)) result.browser = 'Edge';
    else if (/Chrome\//.test(ua)) result.browser = 'Chrome';
    else if (/Firefox\//.test(ua)) result.browser = 'Firefox';
    else if (/Version\/.*Safari/.test(ua)) result.browser = 'Safari';
    else if (/Safari\//.test(ua)) result.browser = 'Safari';
    result.browserVersion = m[1];
  }

  // OS
  if (/Windows NT 10\.0/.test(ua)) result.os = 'Windows 10/11';
  else if (/Windows NT 6\./.test(ua)) result.os = 'Windows 7/8';
  else if (/Mac OS X ([\d_]+)/.test(ua)) result.os = 'macOS ' + ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, '.');
  else if (/Android ([\d.]+)/.test(ua)) result.os = 'Android ' + ua.match(/Android ([\d.]+)/)[1];
  else if (/\(iP(hone|ad|od).*OS ([\d_]+)/.test(ua)) result.os = 'iOS ' + ua.match(/\(iP(?:hone|ad|od).*OS ([\d_]+)/)[1].replace(/_/g, '.');
  else if (/Linux/.test(ua)) result.os = 'Linux';

  return result;
}

// --- Zellen mit Tooltip: USER-ID ---
function UserIdCell({ userId, cache, setCache }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const info = cache[userId];

  const fetchInfo = async () => {
    if (!userId || cache[userId]) return;
    try {
      setLoading(true);
      // 1) DB_User
      const { data: userRow, error: errUser } = await supabase
        .from('DB_User')
        .select('user_id, nachname, vorname, firma_id, unit_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (errUser) throw errUser;

      let firmenname = null;
      let unitname = null;

      if (userRow?.firma_id) {
        const { data: firma, error: errFirma } = await supabase
          .from('DB_Kunden')
          .select('firmenname')
          .eq('id', userRow.firma_id)
          .limit(1)
          .maybeSingle();
        if (errFirma) throw errFirma;
        firmenname = firma?.firmenname ?? null;
      }

      if (userRow?.unit_id) {
        const { data: unit, error: errUnit } = await supabase
          .from('DB_Unit')
          .select('unitname')
          .eq('id', userRow.unit_id)
          .limit(1)
          .maybeSingle();
        if (errUnit) throw errUnit;
        unitname = unit?.unitname ?? null;
      }

      setCache((prev) => ({
        ...prev,
        [userId]: {
          nachname: userRow?.nachname ?? null,
          vorname: userRow?.vorname ?? null,
          firma_id: userRow?.firma_id ?? null,
          unit_id: userRow?.unit_id ?? null,
          firmenname,
          unitname,
        },
      }));
    } catch (e) {
      // Fehler im Tooltip anzeigen
      setCache((prev) => ({
        ...prev,
        [userId]: { error: e.message || 'Fehler beim Laden der Nutzerinfo' },
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = () => {
    timerRef.current = setTimeout(() => {
      setOpen(true);
      fetchInfo();
    }, 400);
  };
  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <td className="px-3 py-2 font-mono text-xs relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {userId || '—'}
      <Tooltip visible={open}>
        {!userId ? (
          <div>Keine User-ID vorhanden.</div>
        ) : loading && !info ? (
          <div className="text-gray-300">Lade Nutzerinfos…</div>
        ) : info?.error ? (
          <div className="text-red-400">Fehler: {info.error}</div>
        ) : info ? (
          <div className="space-y-1">
            <div>
              <span className="text-gray-400">Name: </span>
              <b>{[info.vorname, info.nachname].filter(Boolean).join(' ') || '–'}</b>
            </div>
            <div>
              <span className="text-gray-400">Firma: </span>
              <b>{info.firmenname || (info.firma_id ? `#${info.firma_id}` : '–')}</b>
            </div>
            <div>
              <span className="text-gray-400">Unit: </span>
              <b>{info.unitname || (info.unit_id ? `#${info.unit_id}` : '–')}</b>
            </div>
            <div className="text-[10px] text-gray-500 pt-1">
              Daten aus <code>DB_User</code>, <code>DB_Kunden</code>, <code>DB_Unit</code>.
            </div>
          </div>
        ) : (
          <div className="text-gray-300">Keine Daten gefunden.</div>
        )}
      </Tooltip>
    </td>
  );
}

// --- Zellen mit Tooltip: USER-AGENT ---
function UserAgentCell({ ua }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const parsed = useMemo(() => parseUA(ua), [ua]);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setOpen(true), 300);
  };
  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <td className="px-3 py-2 relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {ua || '—'}
      <Tooltip visible={open}>
        <div className="space-y-2">
          <div className="font-semibold">Was du hier siehst</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <b>Browser & Version:</b> z. B. Chrome, Edge, Firefox, Safari.
            </li>
            <li>
              <b>OS/Plattform:</b> Windows, macOS, Android, iOS, Linux.
            </li>
            <li>
              <b>Device:</b> Desktop vs. Mobile; evtl. Hinweise auf WebView/PWA.
            </li>
          </ul>

          <div className="font-semibold pt-1">Schnellauswertung</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-gray-400">Browser:</div>
            <div>{parsed.browser ? `${parsed.browser} ${parsed.browserVersion ?? ''}` : '–'}</div>
            <div className="text-gray-400">OS:</div>
            <div>{parsed.os || '–'}</div>
            <div className="text-gray-400">Gerät:</div>
            <div>{parsed.device || '–'}</div>
            <div className="text-gray-400">Modus:</div>
            <div>{parsed.isPWA || '–'}</div>
          </div>

          <div className="font-semibold pt-1">Worauf achten?</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <b>Veraltete Browser</b> (sehr alte Versionen) → können UI-Bugs erklären.
            </li>
            <li>
              <b>Mobile + iOS</b>: Safari-Eigenheiten (PWA, Caching, Date-Picker).
            </li>
            <li>
              <b>WebView/„wv“</b> in UA → App-Container; kann Cookies/Storage einschränken.
            </li>
            <li>
              <b>Ungewohnte OS/Standorte</b> → ggf. Security-Check (falscher Login?).
            </li>
          </ul>

          <div className="text-[10px] text-gray-500 pt-1">
            Hinweis: Parsing ist „best-effort“. User-Agent-Strings sind inkonsistent und manipulierbar.
          </div>
        </div>
      </Tooltip>
    </td>
  );
}

export default function LoginTab() {
  const [logs, setLogs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userInfoCache, setUserInfoCache] = useState({}); // user_id -> info

  const load = async (reset = false) => {
    try {
      setLoading(true);
      setErrorMsg('');

      const rangeStart = reset ? 0 : offset;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('DB_LoginLog')
        .select('id, login_time, user_id, user_agent')
        .order('login_time', { ascending: false })
        .range(rangeStart, rangeEnd);

      if (error) throw error;

      const newData = reset ? data : [...logs, ...data];
      setLogs(newData);
      setOffset(rangeEnd + 1);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (e) {
      setErrorMsg(e.message || 'Unbekannter Fehler beim Laden der Login-Logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Login-Logs (je 20)</h2>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
            disabled={loading}
          >
            Aktualisieren
          </button>
          <button
            onClick={() => load(false)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            disabled={loading || !hasMore}
          >
            Mehr laden
          </button>
        </div>
      </div>

      {errorMsg && <div className="mb-3 text-red-400 text-sm">{errorMsg}</div>}

      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Zeit</th>
              <th className="px-3 py-2 text-left">User ID</th>
              <th className="px-3 py-2 text-left">User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="odd:bg-gray-900 even:bg-gray-850">
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.login_time ? new Date(row.login_time).toLocaleString() : '—'}
                </td>

                <UserIdCell
                  userId={row.user_id}
                  cache={userInfoCache}
                  setCache={setUserInfoCache}
                />

                <UserAgentCell ua={row.user_agent} />
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={3}>
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <div className="mt-3 text-sm text-gray-300">Laden…</div>}
      {!loading && hasMore && logs.length > 0 && (
        <div className="mt-3">
          <button onClick={() => load(false)} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">
            Weitere 20 laden
          </button>
        </div>
      )}
    </div>
  );
}

