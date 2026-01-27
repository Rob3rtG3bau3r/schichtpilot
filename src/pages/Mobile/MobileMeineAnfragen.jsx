import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';

const dateTodayOrFuture = (d) => {
  if (!d) return false;
  const today = dayjs().startOf('day');
  const dd = dayjs(d).startOf('day');
  return dd.isSame(today) || dd.isAfter(today);
};

// 1 = genehmigt, -1 = abgelehnt, 0 = offen (robust gegen alte Werte)
const triStatus = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return v ? 1 : -1;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'ja', 'ok', 'approved', 'genehmigt', '✅'].includes(s)) return 1;
  if (['0', 'false', 'f', 'no', 'n', 'nein', 'abgelehnt', '❌'].includes(s)) return -1;
  return 0;
};

const getSchichtName = (s) =>
  s === 'F' ? 'Frühschicht' : s === 'S' ? 'Spätschicht' : s === 'N' ? 'Nachtschicht' : s || '-';

// ❗ NEU: "Älter als X Tage" bezogen auf Feld "datum" (nicht created_at)
const isOlderThanDaysByDatum = (datum, days = 5) => {
  if (!datum) return false;
  const cutoff = dayjs().startOf('day').subtract(days, 'day'); // z.B. 5 Tage zurück (inkl. cutoff)
  const d = dayjs(datum).startOf('day');
  return d.isBefore(cutoff);
};

const MobileMeineAnfragen = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [nachrichten, setNachrichten] = useState([]);
  const [filter, setFilter] = useState('ausstehend'); // 'nachrichten' | 'ausstehend' | 'genehmigt' | 'abgelehnt'
  const [showOlder, setShowOlder] = useState(false); // ✅ NEU: Ältere Genehmigt/Abgelehnt anzeigen
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    const ladeAnfragen = async () => {
      const { data, error } = await supabase
        .from('DB_AnfrageMA')
        .select('*')
        .eq('created_by', userId);

      if (error) {
        console.error('Fehler beim Laden:', error.message);
        return;
      }
      setAnfragen(data || []);
    };

    const ladeNachrichten = async () => {
      const { data, error } = await supabase
        .from('db_pushinbox')
        .select('id, created_at, title, message, typ, context, read_at')
        .eq('recipient_user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('DB_PushInbox Fehler beim Laden:', error.message);
        return;
      }
      setNachrichten(data || []);
    };

    if (userId) {
      ladeAnfragen();
      ladeNachrichten();
    }
  }, [userId]);

  // ✅ NEU: Beim Tabwechsel "Älteres nachladen" zurücksetzen
  useEffect(() => {
    setShowOlder(false);
  }, [filter]);

  // ✅ Nachrichten: Beim Öffnen des Tabs als gelesen markieren
  useEffect(() => {
    if (!userId) return;
    if (filter !== 'nachrichten') return;
    if (!nachrichten || nachrichten.length === 0) return;

    const ungelesen = (nachrichten || []).filter((n) => !n.read_at);
    if (ungelesen.length === 0) return;

    const markAsRead = async () => {
      const ids = ungelesen.map((n) => n.id);
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('db_pushinbox')
        .update({ read_at: now })
        .in('id', ids);

      if (error) {
        console.error('Fehler beim read_at setzen:', error.message);
        return;
      }

      // lokal updaten, damit "neu" sofort verschwindet
      setNachrichten((prev) =>
        (prev || []).map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n))
      );

      // Layout-Badge aktualisieren
      window.dispatchEvent(new CustomEvent('schichtpilot:nachrichten_gelesen'));
    };

    markAsRead();
  }, [filter, nachrichten, userId]);

  // ✅ Anfragen: Beim Öffnen von Genehmigt/Abgelehnt als gesehen markieren
  useEffect(() => {
    if (!userId) return;
    if (filter === 'nachrichten') return;

    const markiere = async () => {
      let zuMarkieren = [];

      if (filter === 'genehmigt') {
        zuMarkieren = (anfragen || []).filter((a) => a.genehmigt === true && a.antwort_gesehen === false);
      }

      if (filter === 'abgelehnt') {
        zuMarkieren = (anfragen || []).filter((a) => a.genehmigt === false && a.antwort_gesehen === false);
      }

      if (zuMarkieren.length === 0) return;

      const ids = zuMarkieren.map((a) => a.id);

      const { error } = await supabase
        .from('DB_AnfrageMA')
        .update({ antwort_gesehen: true })
        .in('id', ids);

      if (error) {
        console.error('Fehler beim Markieren:', error.message);
        return;
      }

      // Lokal sofort updaten
      setAnfragen((prev) => (prev || []).map((a) => (ids.includes(a.id) ? { ...a, antwort_gesehen: true } : a)));

      // Badge im Layout aktualisieren
      window.dispatchEvent(new CustomEvent('schichtpilot:anfragen_gelesen', { detail: { ids } }));
    };

    markiere();
  }, [filter, userId, anfragen]);

  const gefilterteAnfragen = useMemo(() => {
    if (filter === 'nachrichten') return [];

    const base = (anfragen || []).filter((a) => {
      const status = triStatus(a.genehmigt);

      if (filter === 'ausstehend') {
        return status === 0 && dateTodayOrFuture(a.datum);
      }

      if (filter === 'genehmigt') {
        if (status !== 1) return false;
        // ✅ NEU: ältere nach datum (> 5 Tage vorbei) ausblenden, außer showOlder
        if (!showOlder && isOlderThanDaysByDatum(a.datum, 5)) return false;
        return true;
      }

      if (filter === 'abgelehnt') {
        if (status !== -1) return false;
        // ✅ NEU
        if (!showOlder && isOlderThanDaysByDatum(a.datum, 5)) return false;
        return true;
      }

      return true;
    });

    // Sortieren: Datum ↑, dann Schicht (F,S,N)
    const order = { F: 1, S: 2, N: 3 };
    return base.sort((a, b) => {
      const dA = dayjs(a.datum);
      const dB = dayjs(b.datum);
      if (!dA.isSame(dB, 'day')) return dA.valueOf() - dB.valueOf();
      const oA = order[a.schicht] ?? 99;
      const oB = order[b.schicht] ?? 99;
      return oA - oB;
    });
  }, [anfragen, filter, showOlder]);

  const neueNachrichtenCount = useMemo(() => {
    return (nachrichten || []).filter((n) => !n.read_at).length;
  }, [nachrichten]);

  const counts = useMemo(() => {
    const list = anfragen || [];
    const c = { ausstehend: 0, genehmigt: 0, abgelehnt: 0 };

    list.forEach((a) => {
      const status = triStatus(a.genehmigt);
      if (status === 0 && dateTodayOrFuture(a.datum)) c.ausstehend++;
      else if (status === 1) c.genehmigt++;
      else if (status === -1) c.abgelehnt++;
    });

    return c;
  }, [anfragen]);

  // ✅ NEU: Wie viele "ältere" existieren (für Button)
  const olderCount = useMemo(() => {
    if (!(filter === 'genehmigt' || filter === 'abgelehnt')) return 0;

    return (anfragen || []).filter((a) => {
      const status = triStatus(a.genehmigt);
      if (filter === 'genehmigt' && status !== 1) return false;
      if (filter === 'abgelehnt' && status !== -1) return false;
      return isOlderThanDaysByDatum(a.datum, 5);
    }).length;
  }, [anfragen, filter]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-200 dark:bg-gray-900">
      {/* Filterauswahl */}
      <div className="flex justify-around py-2 text-xs text-gray-900 dark:text-gray-200 bg-white dark:bg-gray-900 border-b dark:border-gray-600">
        <button
          className={
            filter === 'nachrichten'
              ? 'text-gray-900 dark:text-gray-200 font-semibold bg-gray-600 bg-opacity-20 py-1 px-2 border border-gray-500 rounded'
              : ''
          }
          onClick={() => setFilter('nachrichten')}
        >
          Nachrichten {neueNachrichtenCount > 0 ? `(${neueNachrichtenCount})` : ''}
        </button>

        <button
          className={
            filter === 'ausstehend'
              ? 'text-blue-600 font-semibold bg-blue-600 bg-opacity-20 py-1 px-2 border border-blue-500 rounded'
              : ''
          }
          onClick={() => setFilter('ausstehend')}
        >
          Ausstehende {counts.ausstehend ? `(${counts.ausstehend})` : ''}
        </button>

        <button
          className={
            filter === 'genehmigt'
              ? 'text-green-600 font-semibold bg-green-600 bg-opacity-20 py-1 px-2 border border-green-500 rounded'
              : ''
          }
          onClick={() => setFilter('genehmigt')}
        >
          Genehmigt {counts.genehmigt ? `(${counts.genehmigt})` : ''}
        </button>

        <button
          className={
            filter === 'abgelehnt'
              ? 'text-red-600 font-semibold bg-red-600 bg-opacity-20 py-1 px-2 border border-red-500 rounded'
              : ''
          }
          onClick={() => setFilter('abgelehnt')}
        >
          Abgelehnt {counts.abgelehnt ? `(${counts.abgelehnt})` : ''}
        </button>
      </div>

      {/* Liste */}
      <div className="p-4 space-y-4 overflow-y-auto">
        {/* ✅ NACHRICHTEN */}
        {filter === 'nachrichten' && (
          <>
            {nachrichten.length === 0 && (
              <p className="text-gray-500 dark:text-gray-300 text-sm">Keine Nachrichten vorhanden.</p>
            )}

            {nachrichten.map((n) => (
              <div
                key={n.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-300 dark:border-gray-600"
              >
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                  {n.created_at ? dayjs(n.created_at).format('DD.MM.YYYY HH:mm') : '-'}
                  {n.read_at ? (
                    <span className="ml-2 text-green-600">✓ gelesen</span>
                  ) : (
                    <span className="ml-2 text-yellow-500">• neu</span>
                  )}
                </div>

                <div className="text-sm text-gray-900 dark:text-white mb-1">
                  <b>{n.title || 'SchichtPilot'}</b>
                </div>

                <div className="text-sm text-gray-800 dark:text-gray-200">{n.message}</div>
              </div>
            ))}
          </>
        )}

        {/* ✅ ANFRAGEN */}
        {filter !== 'nachrichten' && (
          <>
            {gefilterteAnfragen.length === 0 && (
              <p className="text-gray-500 dark:text-gray-300 text-sm">Keine Anfragen vorhanden.</p>
            )}

            {gefilterteAnfragen.map((a) => (
              <div
                key={a.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-300 dark:border-gray-600"
              >
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {a.datum ? dayjs(a.datum).format('DD.MM.YYYY') : '-'} –{' '}
                  <span className="font-semibold">{getSchichtName(a.schicht)}</span>
                </div>

                <div className="text-sm text-gray-800 dark:text-white mb-1">
                  Antrag: <b>{a.antrag || '-'}</b>
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-400">
                  Status:{' '}
                  {triStatus(a.genehmigt) === 0 ? '⏳ Offen' : triStatus(a.genehmigt) === 1 ? '✅ Genehmigt' : '❌ Abgelehnt'}
                </div>

                {triStatus(a.genehmigt) === -1 && a.datum_entscheid && (
                  <div className="text-xs text-red-500 mt-1">
                    Abgelehnt am: {dayjs(a.datum_entscheid).format('DD.MM.YYYY')}
                  </div>
                )}

                {a.kommentar && (
                  <div className="text-xs text-gray-500 mt-2 italic">Kommentar: {a.kommentar}</div>
                )}
              </div>
            ))}

            {/* ✅ NEU: Älteres nachladen Button (nur Genehmigt/Abgelehnt) */}
            {(filter === 'genehmigt' || filter === 'abgelehnt') && !showOlder && olderCount > 0 && (
              <button
                onClick={() => setShowOlder(true)}
                className="w-full py-2 rounded-xl border border-gray-400 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800"
              >
                Älteres nachladen ({olderCount})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MobileMeineAnfragen;
