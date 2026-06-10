import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { X, Send, Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

  const ZusatzbedarfAnfrageModal = ({
    offen,
    onClose,
    item,
    firmaId,
    unitId,
    onSaved,
  }) => {
    const { userId } = useRollen();

    const [kommentar, setKommentar] = useState('');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [hatSchonAnfrage, setHatSchonAnfrage] = useState(false);
    const [savingAlle, setSavingAlle] = useState(false);
    const [checking, setChecking] = useState(false);

    const datum = item?.datum || null;

    const istVergangenheit = useMemo(() => {
      if (!datum) return false;
      return dayjs(datum).isBefore(dayjs().startOf('day'), 'day');
    }, [datum]);

    const istVollOderMehr = useMemo(() => {
      const benoetigt = Number(item?.benoetigt || 0);
      const eingetragen = Number(item?.eingetragen || 0);
      return benoetigt > 0 && eingetragen >= benoetigt;
    }, [item]);

    useEffect(() => {
      if (!offen) {
        setKommentar('');
        setFeedback('');
        setHatSchonAnfrage(false);
        return;
      }

      const pruefeBestehendeAnfrage = async () => {
        if (!userId || !item?.id || !datum) return;

        setChecking(true);

        const { data, error } = await supabase
          .from('DB_AnfrageMA')
          .select('id, genehmigt, created_at')
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId)
          .eq('created_by', userId)
          .eq('anfrage_typ', 'zusatzbedarf')
          .eq('sonderbedarf_id', item.id)
          .eq('sonderbedarf_datum', datum)
          .maybeSingle();

        setChecking(false);

        if (error) {
          console.error('Fehler beim Prüfen vorhandener Zusatzbedarf-Anfrage:', error.message);
          return;
        }

        setHatSchonAnfrage(!!data);
      };

      pruefeBestehendeAnfrage();
    }, [offen, userId, item, datum, firmaId, unitId]);

    const ermittleAlleZusatzbedarfTage = () => {
      const row = item?.raw || item;

      const start = row?.dtstart || item?.datum || datum;
      const ende = row?.until || row?.dtstart || item?.datum || datum;

      if (!start || !ende) return [];

      const freq = row?.freq || 'once';
      const interval = Number(row?.interval || 1);
      const byweekday = Array.isArray(row?.byweekday) ? row.byweekday.map(Number) : [];

      const heute = dayjs().startOf('day');
      const startDay = dayjs(start).startOf('day');
      const endDay = dayjs(ende).startOf('day');

      const tage = [];
      let d = startDay;

      while (d.isSameOrBefore(endDay, 'day')) {
        const nichtVergangenheit = d.isSameOrAfter(heute, 'day');

        let gilt = false;

        if (freq === 'once') {
          gilt = true;
        }

        if (freq === 'daily') {
          const diff = d.diff(startDay, 'day');
          gilt = diff >= 0 && diff % interval === 0;
        }

        if (freq === 'weekly') {
          const diffWeeks = d.startOf('week').diff(startDay.startOf('week'), 'week');

          // unterstützt beides:
          // 0-6 = dayjs: So=0, Mo=1 ...
          // 1-7 = ISO: Mo=1 ... So=7
          const dayjsWochentag = d.day();
          const isoWochentag = dayjsWochentag === 0 ? 7 : dayjsWochentag;

          const wochentagPasst =
            byweekday.length === 0 ||
            byweekday.includes(dayjsWochentag) ||
            byweekday.includes(isoWochentag);

          gilt = diffWeeks >= 0 && diffWeeks % interval === 0 && wochentagPasst;
        }

        if (freq === 'monthly') {
          const diffMonths = d.diff(startDay, 'month');
          gilt =
            diffMonths >= 0 &&
            diffMonths % interval === 0 &&
            d.date() === startDay.date();
        }

        if (nichtVergangenheit && gilt) {
          tage.push(d.format('YYYY-MM-DD'));
        }

        d = d.add(1, 'day');
      }

      return [...new Set(tage)];
    };
const bauePayloadFuerDatum = (zielDatum) => ({
  created_at: new Date().toISOString(),
  created_by: userId,

  firma_id: firmaId,
  unit_id: unitId,

  datum: zielDatum,
  schicht: item.kuerzel || null,

  antrag: `Anmeldung Zusatzbedarf: ${item.name || item.kuerzel || 'Zusatzbedarf'}`,
  kommentar: kommentar.trim() || null,

  genehmigt: null,
  verantwortlicher: null,
  datum_entscheid: null,
  entscheider: null,

  antwort_gesehen: false,
  anfrage_von: 'Mitarbeiter',
  schichtgruppe: null,

  anfrage_typ: 'zusatzbedarf',
  sonderbedarf_id: item.id,
  sonderbedarf_datum: zielDatum,
  sonderbedarf_schichtart_id: item.schichtart_id,
});
  const handleAnmelden = async () => {
    setFeedback('');

    if (!userId) {
      setFeedback('Kein eingeloggter Benutzer gefunden.');
      return;
    }

    if (!item?.id || !datum) {
      setFeedback('Zusatzbedarf oder Datum fehlt.');
      return;
    }

    if (istVergangenheit) {
      setFeedback('Für vergangene Zusatzbedarfe ist keine Anmeldung möglich.');
      return;
    }

    if (hatSchonAnfrage) {
      setFeedback('Du hast dich für diesen Zusatzbedarf bereits angemeldet.');
      return;
    }

    setSaving(true);

    const payload = bauePayloadFuerDatum(datum);

    const { error } = await supabase
      .from('DB_AnfrageMA')
      .insert(payload);

    setSaving(false);

    if (error) {
      console.error('Fehler beim Speichern der Zusatzbedarf-Anfrage:', error.message);
      setFeedback(`Fehler beim Speichern: ${error.message}`);
      return;
    }

    setFeedback('Deine Anmeldung wurde gespeichert.');
    setHatSchonAnfrage(true);
    onSaved?.();

    setTimeout(() => {
      onClose?.();
    }, 900);
  };

const handleAnmeldenAlleTage = async () => {
  setFeedback('');

  if (!userId) {
    setFeedback('Kein eingeloggter Benutzer gefunden.');
    return;
  }

  if (!item?.id) {
    setFeedback('Zusatzbedarf fehlt.');
    return;
  }

  const alleTage = ermittleAlleZusatzbedarfTage();

  if (!alleTage.length) {
    setFeedback('Für diesen Zusatzbedarf wurden keine zukünftigen Tage gefunden.');
    return;
  }

  setSavingAlle(true);

  try {
    const { data: vorhandene, error: checkErr } = await supabase
      .from('DB_AnfrageMA')
      .select('id, sonderbedarf_datum')
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('created_by', userId)
      .eq('anfrage_typ', 'zusatzbedarf')
      .eq('sonderbedarf_id', item.id)
      .in('sonderbedarf_datum', alleTage);

    if (checkErr) throw checkErr;

    const vorhandeneTage = new Set(
      (vorhandene || [])
        .map((r) => dayjs(r.sonderbedarf_datum).format('YYYY-MM-DD'))
        .filter(Boolean)
    );

    const neueTage = alleTage.filter((d) => !vorhandeneTage.has(d));

    if (!neueTage.length) {
      setFeedback('Du bist bereits für alle passenden Tage angemeldet.');
      setSavingAlle(false);
      return;
    }

    const payloads = neueTage.map((zielDatum) => bauePayloadFuerDatum(zielDatum));

    const { error: insertErr } = await supabase
      .from('DB_AnfrageMA')
      .insert(payloads);

    if (insertErr) throw insertErr;

    setFeedback(
      `Anmeldung für ${neueTage.length} Tag${neueTage.length === 1 ? '' : 'e'} gespeichert.`
    );

    setHatSchonAnfrage(true);
    onSaved?.();

    setTimeout(() => {
      onClose?.();
    }, 1200);
  } catch (error) {
    console.error('Fehler beim Speichern aller Zusatzbedarf-Anfragen:', error.message);
    setFeedback(`Fehler beim Speichern: ${error.message}`);
  } finally {
    setSavingAlle(false);
  }
};

  if (!offen || !item) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-bold">
              Zusatzbedarf anmelden
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {dayjs(datum).format('DD.MM.YYYY')} · {item.kuerzel || '—'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
            <div className="font-semibold text-base">
              {item.name || 'Zusatzbedarf'}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2">
                <div className="text-gray-500 dark:text-gray-400">Benötigt</div>
                <div className="font-bold">{item.benoetigt} Person(en)</div>
              </div>

              <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2">
                <div className="text-gray-500 dark:text-gray-400">Eingetragen</div>
                <div className="font-bold">{item.eingetragen} Person(en)</div>
              </div>
            </div>

            <div className="mt-3 text-xs space-y-1">
              {item.qualiName ? (
                <div>
                  <span className="font-semibold">Qualifikation: </span>
                  {item.qualiKuerzel ? `${item.qualiKuerzel} · ` : ''}
                  {item.qualiName}
                </div>
              ) : (
                <div>
                  <span className="font-semibold">Qualifikation: </span>
                  keine benötigt
                </div>
              )}

              {item.raw?.beschreibung && (
                <div>
                  <span className="font-semibold">Beschreibung: </span>
                  {item.raw.beschreibung}
                </div>
              )}

              {item.raw?.hinweis && (
                <div>
                  <span className="font-semibold">Hinweis: </span>
                  {item.raw.hinweis}
                </div>
              )}
            </div>
          </div>

          {istVollOderMehr && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-xs text-emerald-800 dark:text-emerald-100">
              Dieser Zusatzbedarf ist aktuell vollzählig oder überbesetzt. Eine Anmeldung kann trotzdem gespeichert werden, falls der Planer zusätzliche Personen berücksichtigen möchte.
            </div>
          )}

          <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-900 dark:text-yellow-100 flex gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div>
              Zusatzbedarf prüft aktuell keine Arbeitszeit und keine Ruhezeit. Nach Annahme wird der Eintrag in der Kampfliste sichtbar.
            </div>
          </div>

          {hatSchonAnfrage && (
            <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-800 dark:text-blue-100">
              Du hast dich für diesen Zusatzbedarf bereits angemeldet.
            </div>
          )}

          {istVergangenheit && (
            <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-100">
              Dieser Zusatzbedarf liegt in der Vergangenheit. Eine Anmeldung ist nicht mehr möglich.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Kommentar optional
            </label>
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              rows={3}
              disabled={saving || savingAlle || istVergangenheit}
              placeholder="Optionaler Hinweis an die Planung"
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 disabled:opacity-60"
            />
          </div>

          {feedback && (
            <div
              className={`rounded-xl px-3 py-2 text-sm ${
                feedback.includes('Fehler') || feedback.includes('nicht') || feedback.includes('Kein')
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-700'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700'
              }`}
            >
              {feedback}
            </div>
          )}
        </div>

<div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
  <div className="flex gap-2">
    <button
      type="button"
      onClick={onClose}
      disabled={saving || savingAlle}
      className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-60"
    >
      Schließen
    </button>

    <button
      type="button"
      onClick={handleAnmelden}
      disabled={saving || savingAlle || checking || hatSchonAnfrage || istVergangenheit}
      className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white flex items-center justify-center gap-2"
    >
      <Send size={16} />
      {checking
        ? 'Prüfen…'
        : saving
          ? 'Speichern…'
          : hatSchonAnfrage
            ? 'Bereits angemeldet'
            : 'Für diesen Tag anmelden'}
    </button>
  </div>

  <button
    type="button"
    onClick={handleAnmeldenAlleTage}
    disabled={saving || savingAlle || checking || istVergangenheit}
    className="w-full px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white flex items-center justify-center gap-2"
  >
    <Send size={16} />
    {savingAlle ? 'Speichern…' : 'Für alle Tage anmelden'}
  </button>
</div>
      </div>
    </div>
  );
};

export default ZusatzbedarfAnfrageModal;