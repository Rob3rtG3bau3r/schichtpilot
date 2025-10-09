import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Info } from 'lucide-react';
// ⬇️ nutzt deine bestehende Monatsfunktion
import { berechneUndSpeichereStunden } from '../../utils/berechnungen';

dayjs.extend(isSameOrBefore);

const SchichtzuweisungFormular = ({
  selectedUser,
  firma,
  unit,
  onTeamSelect,
  onRefresh,
  setIsLoading,
  isLoading,
  className,
  datumStart,
  setDatumStart
}) => {
  const [team, setTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [datumEnde, setDatumEnde] = useState('');
  const [maxDatumEnde, setMaxDatumEnde] = useState('');
  const [kundenCheckInfo, setKundenCheckInfo] = useState(null);
  const [modalOffen, setModalOffen] = useState(false);

  // Fortschritt für Recalc
  const [gesamtAnzahl, setGesamtAnzahl] = useState(0);
  const [aktuellerFortschritt, setAktuellerFortschritt] = useState(0);

  const [endet, setEndet] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('success'); // 'success' | 'error' | 'info'
  const showFeedback = (text, tone = 'success', ms = 1500) => {
    setFeedbackTone(tone);
    setFeedback(text);
    if (ms) setTimeout(() => setFeedback(''), ms);
  };

  // Schichtwechsel-Entscheidung (inline)
  const [wechselInfo, setWechselInfo] = useState(null); // { prevGroup, newGroup, startDate, prevId }
  const [decisionBusy, setDecisionBusy] = useState(false);

  /* --------------------------- Laden der Teams --------------------------- */
  useEffect(() => {
    const ladeTeams = async () => {
      if (!firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_Unit')
        .select('schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
        .eq('firma', firma)
        .eq('id', unit)
        .single();

    if (error || !data) {
        setTeams([]);
        return;
      }

      const gruppen = [
        data.schichtname1,
        data.schichtname2,
        data.schichtname3,
        data.schichtname4,
        data.schichtname5,
        data.schichtname6,
      ].filter(Boolean);
      setTeams(gruppen);
    };
    ladeTeams();
  }, [firma, unit]);

  /* -------------------- MaxDatumEnde des Teams für SollPlan ------------------- */
  useEffect(() => {
    const fetchMaxDatum = async () => {
      if (!team || !firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_SollPlan')
        .select('datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('schichtgruppe', team)
        .order('datum', { ascending: false })
        .limit(1);

      if (error || !data?.[0]) {
        setMaxDatumEnde('');
        return;
      }

      const reinesDatum = data[0].datum?.slice(0, 10);
      setMaxDatumEnde(reinesDatum);
    };

    fetchMaxDatum();
  }, [team, firma, unit]);

  // Helper: Array in Batches
  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  /* ---------------- Kampfliste -> Verlauf kopieren und löschen ---------------- */
  const moveFutureKampflisteToVerlaufAndDelete = async (userId, firmaId, unitId, startDate) => {
    const { data: future, error: fErr } = await supabase
      .from('DB_Kampfliste')
      .select('*')
      .eq('user', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .gte('datum', startDate);

    if (fErr) throw fErr;
    if (!future || future.length === 0) return { moved: 0, deleted: 0 };

    const allowed = [
      'created_at','created_by','user','firma_id','unit_id','datum','schichtgruppe',
      'soll_schicht','ist_schicht','kommentar','startzeit_ist','endzeit_ist',
      'dauer_ist','dauer_soll'
    ];
    const nowIso = new Date().toISOString();
    const verlaufRows = future.map(row => {
      const r = {};
      for (const k of allowed) if (row[k] !== undefined) r[k] = row[k];
      r.change_on = nowIso;
      return r;
    });

    for (const part of chunk(verlaufRows, 500)) {
      const { error: insErr } = await supabase.from('DB_KampflisteVerlauf').insert(part);
      if (insErr) throw insErr;
    }

    const ids = future.map(x => x.id).filter(Boolean);
    for (const part of chunk(ids, 500)) {
      const { error: delErr } = await supabase.from('DB_Kampfliste').delete().in('id', part);
      if (delErr) throw delErr;
    }

    return { moved: verlaufRows.length, deleted: ids.length };
  };

  /* -------------------------- Stunden-Recalc -------------------------- */
  const monthsInRange = (vonISO, bisISO) => {
    const list = [];
    let cur = dayjs(vonISO).startOf('month');
    const end = dayjs(bisISO).startOf('month');
    while (cur.isSameOrBefore(end, 'month')) {
      list.push({ jahr: cur.year(), monat: cur.month() + 1 });
      cur = cur.add(1, 'month');
    }
    return list;
  };

  // 🔁 NEU: soll_m1..12 = m1..12 + summe_sollplan angleichen (pro Jahr)
  const syncSollToIstForYear = async (userId, firmaId, unitId, jahr) => {
    const { data, error } = await supabase
      .from('DB_Stunden')
      .select('m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12')
      .eq('user_id', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('jahr', jahr)
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    const m1  = data.m1  ?? 0,  m2  = data.m2  ?? 0,  m3  = data.m3  ?? 0,  m4  = data.m4  ?? 0;
    const m5  = data.m5  ?? 0,  m6  = data.m6  ?? 0,  m7  = data.m7  ?? 0,  m8  = data.m8  ?? 0;
    const m9  = data.m9  ?? 0,  m10 = data.m10 ?? 0,  m11 = data.m11 ?? 0,  m12 = data.m12 ?? 0;
    const sumSoll = m1+m2+m3+m4+m5+m6+m7+m8+m9+m10+m11+m12;

    await supabase
      .from('DB_Stunden')
      .update({
        soll_m1: m1,  soll_m2: m2,  soll_m3: m3,  soll_m4: m4,
        soll_m5: m5,  soll_m6: m6,  soll_m7: m7,  soll_m8: m8,
        soll_m9: m9,  soll_m10: m10, soll_m11: m11, soll_m12: m12,
        summe_sollplan: sumSoll
      })
      .eq('user_id', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('jahr', jahr);
  };

  // Für jeden Monat DB_Stunden neu berechnen; danach soll_* spiegeln
  const recalcStundenForRange = async (userId, firmaId, unitId, vonISO, bisISO) => {
    const monate = monthsInRange(vonISO, bisISO);
    setGesamtAnzahl(monate.length);
    setAktuellerFortschritt(0);

    for (let i = 0; i < monate.length; i++) {
      const { jahr, monat } = monate[i];
      try {
        await berechneUndSpeichereStunden(userId, jahr, monat, firmaId, unitId);
      } catch (e) {
        console.warn(`Recalc DB_Stunden fehlgeschlagen: ${jahr}-${String(monat).padStart(2, '0')}`, e?.message || e);
      } finally {
        setAktuellerFortschritt(i + 1);
      }
    }

    // ➕ NEU: für alle betroffenen Jahre soll_* = m_* setzen
    const jahre = Array.from(new Set(monate.map(m => m.jahr)));
    for (const jahr of jahre) {
      try {
        await syncSollToIstForYear(userId, firmaId, unitId, jahr);
      } catch (e) {
        console.warn(`Soll-Spiegelung fehlgeschlagen für ${jahr}:`, e?.message || e);
      }
    }
  };

  /* --------------- Finalisieren nach Entscheidung 'delete'|'keep' --------------- */
  const finalizeSave = async (opt) => {
    if (!wechselInfo) return;
    setDecisionBusy(true);

    const { prevGroup, newGroup, startDate, prevId } = wechselInfo;
    const userId = selectedUser.user_id;

    try {
      let futureMsg = '';

      if (opt === 'delete') {
        const { moved, deleted } = await moveFutureKampflisteToVerlaufAndDelete(userId, firma, unit, startDate);
        futureMsg = ` | Kampfliste: ${deleted} Einträge gelöscht (Verlauf: ${moved})`;
      }

      if (prevId) {
        const bisVortag = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
        const { error: updErr } = await supabase
          .from('DB_SchichtZuweisung')
          .update({ bis_datum: bisVortag })
          .eq('id', prevId);
        if (updErr) throw updErr;
      }

      const { error: insertError } = await supabase.from('DB_SchichtZuweisung').insert({
        user_id: userId,
        schichtgruppe: newGroup,
        von_datum: startDate,
        bis_datum: endet ? datumEnde : null,
        position_ingruppe: 99,
        firma_id: firma,
        unit_id: unit,
        created_at: new Date().toISOString(),
        created_by: localStorage.getItem('user_id') || null,
      });
      if (insertError) throw insertError;

      // Recalc + Soll-Spiegelung
      const effVon = startDate;
      const effBis = (endet && datumEnde) ? datumEnde : (maxDatumEnde || startDate);
      setIsLoading(true);
      showFeedback('🔄 Berechne Stunden …', 'info', 0);
      await recalcStundenForRange(userId, firma, unit, effVon, effBis);
      showFeedback('✅ Schichtgruppe zugewiesen, Stunden neu berechnet & Soll übernommen!' + futureMsg, 'success', 2000);

      setWechselInfo(null);
      onRefresh?.();
    } catch (e) {
      showFeedback('❌ Fehler: ' + (e?.message || String(e)), 'error', 2500);
    } finally {
      setDecisionBusy(false);
      setIsLoading(false);
    }
  };

  /* -------------------------- Submit ohne Wechsel -------------------------- */
  const handleSubmit = async () => {
    setIsLoading(true);

    if (!selectedUser || !team || !datumStart) {
      showFeedback('Bitte Team und Startdatum auswählen!', 'error', 2000);
      setIsLoading(false);
      return;
    }

    if (endet && datumEnde && dayjs(datumEnde).isBefore(datumStart, 'day')) {
      showFeedback('Enddatum darf nicht vor dem Startdatum liegen.', 'error', 2000);
      setIsLoading(false);
      return;
    }

    const userId = selectedUser.user_id;
    const startDate = dayjs(datumStart).format('YYYY-MM-DD');

    try {
      const { data: activeAssn, error: assnErr } = await supabase
        .from('DB_SchichtZuweisung')
        .select('id, schichtgruppe, von_datum, bis_datum')
        .eq('user_id', userId)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .lte('von_datum', startDate)
        .or(`bis_datum.is.null, bis_datum.gte.${startDate}`)
        .order('von_datum', { ascending: false })
        .limit(1);

      if (assnErr) throw assnErr;

      const prev = activeAssn && activeAssn.length ? activeAssn[0] : null;
      const schichtWechsel = !!(prev && prev.schichtgruppe !== team);

      if (schichtWechsel) {
        setWechselInfo({
          prevGroup: prev.schichtgruppe,
          newGroup: team,
          startDate,
          prevId: prev.id
        });
        showFeedback('', 'info', 0);
        setIsLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('DB_SchichtZuweisung').insert({
        user_id: userId,
        schichtgruppe: team,
        von_datum: startDate,
        bis_datum: endet ? datumEnde : null,
        position_ingruppe: 99,
        firma_id: firma,
        unit_id: unit,
        created_at: new Date().toISOString(),
        created_by: localStorage.getItem('user_id') || null,
      });
      if (insertError) throw insertError;

      // Recalc + Soll-Spiegelung
      const effVon = startDate;
      const effBis = (endet && datumEnde) ? datumEnde : (maxDatumEnde || startDate);
      showFeedback('🔄 Berechne Stunden …', 'info', 0);
      await recalcStundenForRange(userId, firma, unit, effVon, effBis);

      showFeedback('✅ Schichtgruppe zugewiesen, Stunden neu berechnet & Soll übernommen!', 'success', 2000);
      onRefresh?.();
    } catch (error) {
      showFeedback('❌ Fehler: ' + (error?.message || String(error)), 'error', 2500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Team zuweisen</h2>
        <button onClick={() => setModalOffen(true)} title="Info">
          <Info size={20} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
        </button>
      </div>

      {kundenCheckInfo && (
        <div className="bg-gray-100 dark:bg-gray-800 text-sm rounded p-2 mb-2">
          <p><strong>Unternehmen:</strong></p>
          <p>{kundenCheckInfo.db}</p>
        </div>
      )}

      <label className="block mb-2">Zugewiesenes Team</label>
      <select
        value={team}
        onChange={(e) => {
          setTeam(e.target.value);
          onTeamSelect?.(e.target.value);
        }}
        className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
      >
        <option value="">Team wählen</option>
        {teams.map((t, i) => (
          <option key={i} value={t}>{t}</option>
        ))}
      </select>

      <label className="block mb-2">Zuweisung ab</label>
      <input
        type="date"
        value={datumStart}
        onChange={(e) => setDatumStart(e.target.value)}
        className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
      />

      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          id="endet"
          checked={endet}
          onChange={(e) => {
            setEndet(e.target.checked);
            if (!e.target.checked) setDatumEnde('');
          }}
          className="mr-2"
        />
        <label htmlFor="endet">Zuweisung endet (z.B. MA verlässt das Unternehmen)</label>
      </div>

      {endet && (
        <>
          <label className="block mb-2">Zuweisung bis</label>
          <input
            type="date"
            value={datumEnde}
            onChange={(e) => setDatumEnde(e.target.value)}
            max={maxDatumEnde || undefined}
            min={datumStart || undefined}
            className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
          />
        </>
      )}

      {selectedUser && (
        <p className="mb-4">
          Mitarbeiter: <strong>{selectedUser.nachname}, {selectedUser.vorname}</strong>
        </p>
      )}

      {/* Inline-Entscheidung bei Schichtwechsel */}
      {wechselInfo && (
        <div className="mb-3 p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200">
          <div className="text-sm mb-2">
            <strong>Schichtwechsel erkannt:</strong> von <em>{wechselInfo.prevGroup}</em> zu <em>{wechselInfo.newGroup}</em> ab {dayjs(wechselInfo.startDate).format('DD.MM.YYYY')}.
            <br />
            Wie sollen <em>zukünftige</em> Kampflisten-Einträge ab diesem Datum behandelt werden?
          </div>
          <div className="flex gap-2">
            <button
              disabled={decisionBusy}
              onClick={() => finalizeSave('delete')}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60"
              title="Einträge werden vor dem Löschen in den Verlauf kopiert"
            >
              Ab Datum löschen (mit Verlauf)
            </button>
            <button
              disabled={decisionBusy}
              onClick={() => finalizeSave('keep')}
              className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-700 text-white text-sm disabled:opacity-60"
            >
              Beibehalten
            </button>
            <button
              disabled={decisionBusy}
              onClick={() => { setWechselInfo(null); setIsLoading(false); }}
              className="ml-auto px-3 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isLoading || !!wechselInfo}
        className={`px-4 py-2 rounded w-full flex items-center justify-center gap-2 text-white ${
          (isLoading || !!wechselInfo) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isLoading && (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isLoading ? 'Mitarbeiter wird zugewiesen' : 'Zuweisung durchführen'}
      </button>

      {/* Fortschritt für Recalc */}
      {(gesamtAnzahl > 0) && (
        <div className="mt-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Stunden-Neuberechnung: {aktuellerFortschritt} / {gesamtAnzahl} Monate
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 transition-all"
              style={{ width: `${(aktuellerFortschritt / gesamtAnzahl) * 100}%` }}
            />
          </div>
        </div>
      )}

      <h2 className="text-xs p-2 text-gray-600 dark:text-gray-500">Das Zuweisen eines Teams kann zeitintensiv sein.</h2>

      {feedback && (
        <div
          className={`mt-2 text-sm text-center ${
            feedbackTone === 'error'
              ? 'text-red-600 dark:text-red-400'
              : feedbackTone === 'info'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-green-600 dark:text-green-400'
          }`}
        >
          {feedback}
        </div>
      )}

      {modalOffen && (
        <div
          className="fixed inset-0 bg-black backdrop-blur-sm bg-opacity-50 z-50 flex items-center justify-center"
          onClick={() => setModalOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-6 max-w-sm shadow-lg animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">Information zur Zuweisung</h2>
            <p className="text-sm mb-4">
              Auswahl Team, Zeitraum, Prüfung auf Schichtwechsel und optionales Aufräumen zukünftiger Kampflisten (mit Verlauf).
              Nach dem Speichern werden automatisch die <b>DB_Stunden</b> neu berechnet und die <b>SOLL-Monate</b> an die <b>IST-Monate</b> angeglichen.
            </p>
            <button
              onClick={() => setModalOffen(false)}
              className="mt-2 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchichtzuweisungFormular;
