import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';

const PAGE_SIZE = 20;

// --- Mini Tooltip ---
function Tooltip({ children, visible }) {
  return (
    <div
      className={`absolute z-50 left-0 top-full mt-2 w-[340px] rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs shadow-2xl transition-opacity ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      role="tooltip"
    >
      {children}
    </div>
  );
}

// --- Best-effort UA Parser ---
function parseUA(ua) {
  if (!ua) return {};

  const result = {
    browser: null,
    browserVersion: null,
    os: null,
    device: /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop',
    isPWA: /wv/.test(ua) || /; wv\)/.test(ua) ? 'WebView' : 'Browser',
  };

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

  if (/Windows NT 10\.0/.test(ua)) result.os = 'Windows 10/11';
  else if (/Windows NT 6\./.test(ua)) result.os = 'Windows 7/8';
  else if (/Mac OS X ([\d_]+)/.test(ua)) {
    result.os = 'macOS ' + ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, '.');
  } else if (/Android ([\d.]+)/.test(ua)) {
    result.os = 'Android ' + ua.match(/Android ([\d.]+)/)[1];
  } else if (/\(iP(hone|ad|od).*OS ([\d_]+)/.test(ua)) {
    result.os = 'iOS ' + ua.match(/\(iP(?:hone|ad|od).*OS ([\d_]+)/)[1].replace(/_/g, '.');
  } else if (/Linux/.test(ua)) {
    result.os = 'Linux';
  }

  return result;
}

// --- User-ID Tooltip ---
function UserIdCell({ userId, cache, setCache }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const info = cache[userId];

  const fetchInfo = async () => {
    if (!userId || cache[userId]) return;

    try {
      setLoading(true);

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
    <td
      className="px-3 py-2 font-mono text-xs relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
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

// --- User-Agent Tooltip ---
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
    <td
      className="px-3 py-2 relative max-w-[520px] truncate"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      title={ua || ''}
    >
      {ua || '—'}

      <Tooltip visible={open}>
        <div className="space-y-2">
          <div className="font-semibold">Schnellauswertung</div>

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
            <li>Veraltete Browser können UI-Probleme erklären.</li>
            <li>Mobile/iOS kann bei PWA und Caching auffällig sein.</li>
            <li>User-Agent ist nur ein Hinweis und kann manipuliert werden.</li>
          </ul>
        </div>
      </Tooltip>
    </td>
  );
}

function StatCard({ label, value, note, color = 'gray' }) {
  const border =
    color === 'green' ? 'border-green-800/60' :
    color === 'yellow' ? 'border-yellow-700/60' :
    color === 'red' ? 'border-red-800/70' :
    'border-gray-700';

  return (
    <div className={`rounded-xl border ${border} bg-gray-950/30 p-3`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-gray-100">{value}</div>
      {note && <div className="text-xs text-gray-500">{note}</div>}
    </div>
  );
}

export default function LoginTab() {
  const [activeView, setActiveView] = useState('success');

  // Erfolgreiche Login-Logs
  const [logs, setLogs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Loginversuche
  const [attempts, setAttempts] = useState([]);
  const [attemptOffset, setAttemptOffset] = useState(0);
  const [attemptHasMore, setAttemptHasMore] = useState(true);

  const [failedOnly, setFailedOnly] = useState(true);
  const [emailSearch, setEmailSearch] = useState('');

  // Allgemein
  const [loading, setLoading] = useState(false);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptErrorMsg, setAttemptErrorMsg] = useState('');
  const [userInfoCache, setUserInfoCache] = useState({});

  const attemptStats = useMemo(() => {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const last24h = attempts.filter((a) => {
      if (!a.created_at) return false;
      return new Date(a.created_at) >= since24h;
    });

    const failed24h = last24h.filter((a) => !a.success);
    const uniqueFailedEmails = new Set(
      failed24h
        .map((a) => String(a.email || '').trim().toLowerCase())
        .filter(Boolean)
    );

    return {
      loaded: attempts.length,
      failed24h: failed24h.length,
      uniqueFailedEmails: uniqueFailedEmails.size,
    };
  }, [attempts]);

  const loadSuccessLogs = async (reset = false) => {
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

      const safeData = data || [];
      const newData = reset ? safeData : [...logs, ...safeData];

      setLogs(newData);
      setOffset(rangeEnd + 1);
      setHasMore(safeData.length === PAGE_SIZE);
    } catch (e) {
      setErrorMsg(e.message || 'Unbekannter Fehler beim Laden der Login-Logs');
    } finally {
      setLoading(false);
    }
  };

  const loadAttempts = async (reset = false) => {
    try {
      setAttemptLoading(true);
      setAttemptErrorMsg('');

      const rangeStart = reset ? 0 : attemptOffset;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;

      let q = supabase
        .from('DB_LoginAttemptLog')
        .select('id, created_at, email, success, error_code, error_message, user_agent, source, user_id')
        .order('created_at', { ascending: false });

      if (failedOnly) q = q.eq('success', false);

      const cleanSearch = emailSearch.trim().toLowerCase();
      if (cleanSearch) q = q.ilike('email', `%${cleanSearch}%`);

      const { data, error } = await q.range(rangeStart, rangeEnd);

      if (error) throw error;

      const safeData = data || [];
      const newData = reset ? safeData : [...attempts, ...safeData];

      setAttempts(newData);
      setAttemptOffset(rangeEnd + 1);
      setAttemptHasMore(safeData.length === PAGE_SIZE);
    } catch (e) {
      setAttemptErrorMsg(e.message || 'Unbekannter Fehler beim Laden der Loginversuche');
    } finally {
      setAttemptLoading(false);
    }
  };

  useEffect(() => {
    loadSuccessLogs(true);
    loadAttempts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAttemptOffset(0);
    loadAttempts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedOnly]);

  const applyAttemptFilter = () => {
    setAttemptOffset(0);
    loadAttempts(true);
  };

  return (
    <div className="space-y-4">
      {/* Umschalter */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Login-Überwachung</h2>
            <p className="text-xs text-gray-400 mt-1">
              Erfolgreiche Logins und fehlgeschlagene Loginversuche getrennt anzeigen.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('success')}
              className={`px-3 py-1.5 rounded border text-sm ${
                activeView === 'success'
                  ? 'bg-gray-700 border-gray-500 text-white'
                  : 'bg-gray-950 border-gray-700 text-gray-300 hover:bg-gray-800'
              }`}
            >
              Erfolgreiche Logins
            </button>

            <button
              onClick={() => setActiveView('attempts')}
              className={`px-3 py-1.5 rounded border text-sm ${
                activeView === 'attempts'
                  ? 'bg-red-900/50 border-red-700 text-white'
                  : 'bg-gray-950 border-gray-700 text-gray-300 hover:bg-gray-800'
              }`}
            >
              Loginversuche / Fehler
            </button>
          </div>
        </div>
      </div>

      {/* Erfolgreiche Logins */}
      {activeView === 'success' && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">Erfolgreiche Login-Logs</h3>
              <p className="text-xs text-gray-400">
                Daten aus <code>DB_LoginLog</code>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOffset(0);
                  loadSuccessLogs(true);
                }}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                disabled={loading}
              >
                Aktualisieren
              </button>

              <button
                onClick={() => loadSuccessLogs(false)}
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
                      Keine erfolgreichen Login-Logs gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && <div className="mt-3 text-sm text-gray-300">Laden…</div>}
        </div>
      )}

      {/* Loginversuche / Fehler */}
      {activeView === 'attempts' && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-semibold">Loginversuche / Fehler</h3>
              <p className="text-xs text-gray-400">
                Daten aus <code>DB_LoginAttemptLog</code>. Passwörter werden nicht gespeichert.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-red-500"
                  checked={failedOnly}
                  onChange={(e) => setFailedOnly(e.target.checked)}
                />
                nur fehlgeschlagene
              </label>

              <input
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyAttemptFilter();
                }}
                placeholder="E-Mail suchen..."
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              />

              <button
                onClick={applyAttemptFilter}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                disabled={attemptLoading}
              >
                Anwenden
              </button>

              <button
                onClick={() => {
                  setEmailSearch('');
                  setFailedOnly(true);
                  setAttemptOffset(0);
                  setTimeout(() => loadAttempts(true), 0);
                }}
                className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
                disabled={attemptLoading}
              >
                Zurücksetzen
              </button>

              <button
                onClick={() => {
                  setAttemptOffset(0);
                  loadAttempts(true);
                }}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                disabled={attemptLoading}
              >
                Aktualisieren
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <StatCard
              label="Geladene Einträge"
              value={attemptStats.loaded}
              note="Aktuelle Tabellenansicht"
            />

            <StatCard
              label="Fehler letzte 24h"
              value={attemptStats.failed24h}
              note="Nur geladene Einträge"
              color={
                attemptStats.failed24h === 0
                  ? 'green'
                  : attemptStats.failed24h <= 5
                    ? 'yellow'
                    : 'red'
              }
            />

            <StatCard
              label="Betroffene E-Mails 24h"
              value={attemptStats.uniqueFailedEmails}
              note="Eindeutige Mailadressen"
              color={
                attemptStats.uniqueFailedEmails === 0
                  ? 'green'
                  : attemptStats.uniqueFailedEmails <= 3
                    ? 'yellow'
                    : 'red'
              }
            />
          </div>

          {attemptErrorMsg && (
            <div className="mb-3 text-red-400 text-sm">{attemptErrorMsg}</div>
          )}

          <div className="overflow-auto rounded-lg border border-gray-800">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left">Zeit</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">E-Mail</th>
                  <th className="px-3 py-2 text-left">Fehlercode</th>
                  <th className="px-3 py-2 text-left">Fehlermeldung</th>
                  <th className="px-3 py-2 text-left">User-Agent</th>
                  <th className="px-3 py-2 text-left">Quelle</th>
                </tr>
              </thead>

              <tbody>
                {attempts.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-gray-800 ${
                      row.success
                        ? 'bg-green-950/20'
                        : 'bg-red-950/20'
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </td>

                    <td className="px-3 py-2">
                      {row.success ? (
                        <span className="px-2 py-1 rounded bg-green-900/50 text-green-100 text-xs border border-green-700/60">
                          erfolgreich
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-red-900/50 text-red-100 text-xs border border-red-700/60">
                          fehlgeschlagen
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 font-mono text-xs">
                      {row.email || '—'}
                    </td>

                    <td className="px-3 py-2 font-mono text-xs">
                      {row.error_code || '—'}
                    </td>

                    <td className="px-3 py-2 max-w-[360px] whitespace-pre-wrap">
                      {row.error_message || '—'}
                    </td>

                    <UserAgentCell ua={row.user_agent} />

                    <td className="px-3 py-2">
                      {row.source || '—'}
                    </td>
                  </tr>
                ))}

                {!attemptLoading && attempts.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-400" colSpan={7}>
                      Keine Loginversuche gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {attemptLoading && <div className="mt-3 text-sm text-gray-300">Laden…</div>}

          {!attemptLoading && attemptHasMore && attempts.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => loadAttempts(false)}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
              >
                Weitere 20 laden
              </button>
            </div>
          )}

          <div className="text-[10px] text-gray-500 mt-3">
            Hinweis: Fehlgeschlagene Loginversuche werden erst sichtbar, wenn dein Login-Code die RPC{' '}
            <code>log_login_attempt</code> aufruft.
          </div>
        </div>
      )}
    </div>
  );
}