import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { berechneUndSpeichereStunden, berechneUndSpeichereUrlaub } from '../../utils/berechnungen';

const ZurueckSetzenModal = ({ offen, onClose, undoToken, sichtUserName, onAfterUndo, PERF_SKIP_RECALC=false }) => {
  const [loading, setLoading] = useState(false);
  const [cur, setCur] = useState(null);
  const [prev, setPrev] = useState(null);
  const [soll, setSoll] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!offen || !undoToken) return;
    setErr('');
    (async () => {
      // Aktuell
      const { data: curRows, error: curErr } = await supabase
        .from('DB_Kampfliste')
        .select('*, ist_rel:ist_schicht (kuerzel)')
        .eq('user', undoToken.user_id)
        .eq('datum', undoToken.datum)
        .eq('firma_id', undoToken.firma_id)
        .eq('unit_id', undoToken.unit_id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (curErr || !curRows?.length) { setErr('Aktueller Eintrag nicht gefunden.'); return; }
      const current = curRows[0]; setCur(current);

      // Vorher (Verlauf)
      const { data: prevRows, error: prevErr } = await supabase
        .from('DB_KampflisteVerlauf')
        .select('*, ist_rel:ist_schicht (kuerzel)')
        .eq('user', undoToken.user_id)
        .eq('datum', undoToken.datum)
        .eq('firma_id', undoToken.firma_id)
        .eq('unit_id', undoToken.unit_id)
        .lte('change_on', current.created_at)
        .order('change_on', { ascending: false })
        .limit(1);
      if (prevErr) { setErr('Fehler beim Laden des Verlaufs.'); return; }
      if (prevRows?.length) { setPrev(prevRows[0]); setSoll(null); }
      else {
        // Soll (fallback)
        const { data: grp } = await supabase
          .from('DB_SchichtZuweisung')
          .select('schichtgruppe')
          .eq('user_id', undoToken.user_id)
          .eq('firma_id', undoToken.firma_id)
          .eq('unit_id', undoToken.unit_id)
          .lte('von_datum', undoToken.datum)
          .or(`bis_datum.is.null, bis_datum.gte.${undoToken.datum}`)
          .order('von_datum', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!grp?.schichtgruppe) { setPrev(null); setSoll(null); return; }
        const { data: sollRow } = await supabase
          .from('DB_SollPlan')
          .select('kuerzel,startzeit,endzeit')
          .eq('firma_id', undoToken.firma_id)
          .eq('unit_id', undoToken.unit_id)
          .eq('schichtgruppe', grp.schichtgruppe)
          .eq('datum', undoToken.datum)
          .maybeSingle();
        setPrev(null); setSoll(sollRow || null);
      }
    })();
  }, [offen, undoToken]);

  const doUndo = async () => {
    if (!undoToken) return;
    setLoading(true); setErr('');
    const { data, error } = await supabase.rpc('pr_kampfliste_undo', {
      p_user: undoToken.user_id,
      p_datum: undoToken.datum,
      p_firma_id: undoToken.firma_id,
      p_unit_id: undoToken.unit_id,
    });
    if (error) { setErr(error.message || 'Undo fehlgeschlagen.'); setLoading(false); return; }
    try {
      if (!PERF_SKIP_RECALC) {
        const jahr = data?.jahr, monat = data?.monat;
        if (data?.needs_hours && jahr && monat)
          await berechneUndSpeichereStunden(undoToken.user_id, jahr, monat, undoToken.firma_id, undoToken.unit_id);
        if (data?.needs_vac && jahr)
          await berechneUndSpeichereUrlaub(undoToken.user_id, jahr, undoToken.firma_id, undoToken.unit_id);
      }
    } catch (e) { console.error(e); }
    onAfterUndo?.();
    setLoading(false);
    onClose?.();
  };

  if (!offen || !undoToken) return null;
  const curK = cur?.ist_rel?.kuerzel ?? '-';
  const prevK = prev?.ist_rel?.kuerzel ?? (soll?.kuerzel ?? '-');

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl p-5 w-[720px]" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Letzte Änderung zurücksetzen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {sichtUserName} • {dayjs(undoToken.datum).format('dddd, DD.MM.YYYY')} • Nur vom Ersteller, 60s.
        </div>
        {err && <div className="mb-2 text-red-600 text-sm">❌ {err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3">
            <div className="font-semibold mb-2">Aktuell</div>
            <div className="text-sm space-y-1">
              <div><b>Kürzel:</b> {curK}</div>
              <div><b>Zeiten:</b> {cur?.startzeit_ist ?? '–'} – {cur?.endzeit_ist ?? '–'}</div>
              <div><b>Kommentar:</b> {cur?.kommentar ?? '–'}</div>
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="font-semibold mb-2">Vorher</div>
            <div className="text-sm space-y-1">
              <div><b>Kürzel:</b> {prevK}</div>
              <div><b>Zeiten:</b> {(prev?.startzeit_ist ?? soll?.startzeit ?? '–')} – {(prev?.endzeit_ist ?? soll?.endzeit ?? '–')}</div>
              <div><b>Kommentar:</b> {prev?.kommentar ?? '–'}</div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white" onClick={onClose} disabled={loading}>Abbrechen</button>
          <button className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50" onClick={doUndo} disabled={loading}>
            {loading ? 'Setze zurück…' : 'Rückgängig machen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZurueckSetzenModal;
