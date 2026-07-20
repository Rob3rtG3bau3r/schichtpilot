// src/components/Dashboard/MeineDiensteListe.jsx
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { ArrowLeft } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { ermittleBedarfUndStatus } from './Utils/bedarfsauswertung';
import UrlaubsModal from './UrlaubsModal';
import BieteMichAnModal from './BieteMichAnModal';
import RenderKalender from './RenderKalender';
import RenderListe from './RenderListe';

const monate = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];

export default function MeineDiensteListe() {
  const gespeicherteId = localStorage.getItem('user_id');
  const firma = localStorage.getItem('firma_id');
  const unit = localStorage.getItem('unit_id');

  const [eintraege, setEintraege] = useState([]);
  const [startDatum, setStartDatum] = useState(dayjs().startOf('month'));
  const [infoOffenIndex, setInfoOffenIndex] = useState(null);

  // Bedarf: wir halten ein "raw" + ein gepatchtes Objekt (für ausgegraute Tage)
  const [bedarfStatusRaw, setBedarfStatusRaw] = useState({});
  const [bedarfStatus, setBedarfStatus] = useState({});

  const [urlaubModal, setUrlaubModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });
  const [hilfeModal, setHilfeModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });
  const [feierMap, setFeierMap] = useState({});

  // Ausgrauen-Tage des Users im Monat (Set mit 'YYYY-MM-DD')
  const [ausgegrautTage, setAusgegrautTage] = useState(new Set());

  // 💡 sofort synchron initialisieren (verhindert Flackern)
  const initialAnsicht = (localStorage.getItem('mobile_kalender') ?? 'kalender') === 'kalender';
  const [kalenderAnsicht, setKalenderAnsicht] = useState(initialAnsicht);

  const [jahr, setJahr] = useState(dayjs().year());
  const scrollRef = useRef(null);
  const heuteRef = useRef(null);

  const aktuellesJahr = dayjs().year();
  const aktuelleJahre = [aktuellesJahr - 1, aktuellesJahr, aktuellesJahr + 1];

  // Reagiere live auf Änderungen aus dem Einstellungsmenü
  useEffect(() => {
    const onPrefChange = (e) => {
      if (e.detail?.key === 'mobile_kalender') {
        setKalenderAnsicht(e.detail.value === 'kalender');
      }
    };
    window.addEventListener('schichtpilot:prefchange', onPrefChange);
    return () => window.removeEventListener('schichtpilot:prefchange', onPrefChange);
  }, []);

  // Initial & bei Wechsel Monat/User alles laden
  useEffect(() => {
    if (!gespeicherteId || !startDatum) return;
    ladeDienste();
    ladeFeiertageUndFerien();
    ladeAusgrauenTage();     // ⬅️ wichtig: erst Ausgrauen, dann Bedarf (nächster Effekt patched)
  }, [gespeicherteId, startDatum]);

  // Bedarf separat laden (und immer neu patchen, wenn Ausgrau-Set sich ändert)
  useEffect(() => {
    if (!gespeicherteId || !firma || !unit || !startDatum) return;
    (async () => {
      const raw = await ermittleBedarfUndStatus(
        String(gespeicherteId), parseInt(firma, 10), parseInt(unit, 10), startDatum.toDate()
      );
      setBedarfStatusRaw(raw || {});
    })();
  }, [gespeicherteId, startDatum, firma, unit]);

  // Patch: ausgegraute Tage neutralisieren (keine Anwesenheit/kein Dienst)
  useEffect(() => {
    const patched = { ...(bedarfStatusRaw || {}) };
    if (ausgegrautTage && ausgegrautTage.size > 0) {
      Object.keys(patched).forEach((d) => {
        if (ausgegrautTage.has(d)) {
          // neutral/kein Dienst
          const current = patched[d] || {};
          patched[d] = {
            ...current,
            istAnwesend: false,
            // häufige Felder; wir setzen defensiv:
            kuerzel: '-',                // falls UI kuerzel nutzt
            ist_schicht: null,           // falls Objekt erwartet
            ist_schicht_id: null,
          };
        }
      });
    }
    setBedarfStatus(patched);
  }, [bedarfStatusRaw, ausgegrautTage]);

  // ===== Loader =====

  const ladeDienste = async () => {
    if (!gespeicherteId || !firma || !unit || !startDatum) {
      setEintraege([]);
      return;
    }

    const monthStartObj = startDatum.startOf('month');
const monthEndObj   = startDatum.endOf('month');

// Montag-Start wie im Kalender
const firstDay = monthStartObj.day(); // 0=So..6=Sa
const offset = firstDay === 0 ? 6 : firstDay - 1;

const gridStart = monthStartObj.subtract(offset, 'day');

// Sonntag-Ende wie im Kalender
const endDay = monthEndObj.day(); // 0=So..6=Sa
const trailing = endDay === 0 ? 0 : (7 - endDay);
const gridEnd = monthEndObj.add(trailing, 'day');

const from = gridStart.format('YYYY-MM-DD');
const to   = gridEnd.format('YYYY-MM-DD');

    const loadStart =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    const { data: monatsRows, error: monatsError } = await supabase.rpc(
      'sp_lade_kampfliste_monat',
      {
        p_firma_id: Number(firma),
        p_unit_id: Number(unit),
        p_von: from,
        p_bis: to,
        p_user_id: String(gespeicherteId),
      }
    );

    if (monatsError) {
      console.error(
        '❌ sp_lade_kampfliste_monat (mobil):',
        monatsError.message || monatsError
      );
      setEintraege([]);
      return;
    }

    const mapped = (monatsRows || []).map((r) => ({
      datum: String(r.datum).slice(0, 10),
      ist_schicht_id: r.ist_schichtart_id || null,
      ist_schicht: r.ist_schichtart_id
        ? {
            id: r.ist_schichtart_id,
            kuerzel: r.ist_kuerzel || '-',
            farbe_bg: r.ist_farbe_bg || '',
            farbe_text: r.ist_farbe_text || '',
          }
        : null,
      startzeit_ist: r.ist_startzeit || null,
      endzeit_ist: r.ist_endzeit || null,
      pausen_dauer: r.ist_pausen_dauer ?? null,
      kommentar: r.kommentar || null,
      aenderung: !!r.hat_aenderung,
      created_at: r.ist_created_at || null,
      created_by: r.ist_created_by || null,
    }));

    setEintraege(mapped);

    const loadEnd =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    console.log('[SP Detail] Mobile Meine Dienste', {
      rpc_und_mapping_ms: Math.round((loadEnd - loadStart) * 10) / 10,
      zeilen: mapped.length,
      von: from,
      bis: to,
    });
  };

  const ladeAusgrauenTage = async () => {
    if (!gespeicherteId || !firma || !unit || !startDatum) {
      setAusgegrautTage(new Set());
      return;
    }
    const monthStart = startDatum.startOf('month').format('YYYY-MM-DD');
    const monthEnd   = startDatum.endOf('month').format('YYYY-MM-DD');

    const { data: ausRows, error } = await supabase
      .from('DB_Ausgrauen')
      .select('von, bis')
      .eq('firma_id', Number(firma))
      .eq('unit_id', Number(unit))
      .eq('user_id', String(gespeicherteId))
      .lte('von', monthEnd)
      .or(`bis.is.null, bis.gte.${monthStart}`);

    if (error) {
      console.error('❌ DB_Ausgrauen (mobil):', error.message || error);
      setAusgegrautTage(new Set());
      return;
    }

    const set = new Set();
    for (const r of (ausRows || [])) {
      let d = dayjs(r.von);
      const last = r.bis ? dayjs(r.bis) : dayjs(monthEnd);
      // Sicherheitslimit
      for (let i = 0; i < 1000 && !d.isAfter(last, 'day'); i++) {
        const ds = d.format('YYYY-MM-DD');
        if (ds >= monthStart && ds <= monthEnd) set.add(ds);
        d = d.add(1, 'day');
      }
    }
    setAusgegrautTage(set);
  };

  const ladeFeiertageUndFerien = async () => {
    if (!startDatum) {
      setFeierMap({});
      return;
    }

    const monthStart = startDatum.startOf('month').format('YYYY-MM-DD');
    const monthEnd   = startDatum.endOf('month').format('YYYY-MM-DD');

    // NEU: Land + Bundesland (aus localStorage oder später besser aus DB_Unit)
    const land = (localStorage.getItem('land') || '').trim();
    const bundesland = (localStorage.getItem('bundesland') || '').trim();

    if (!land) {
      setFeierMap({});
      return;
    }

    const { data, error } = await supabase
      .from('DB_FeiertageundFerien')
      .select('id, von, bis, name, typ, farbe, land, bundesland, ist_bundesweit')
      .eq('land', land)
      // bundesweit ODER exakt Bundesland
      .or(`ist_bundesweit.eq.true,bundesland.eq.${bundesland}`)
      // Overlap: von <= monthEnd AND (bis is null OR bis >= monthStart)
      .lte('von', monthEnd)
      .or(`bis.is.null,bis.gte.${monthStart}`);

    if (error) {
      console.error('❌ Feiertage/Ferien (mobil):', error.message || error);
      setFeierMap({});
      return;
    }

    const defaultColor = (typ) => {
      const t = (typ || '').toLowerCase();
      if (t.includes('feiertag')) return '#ef4444'; // rot
      if (t.includes('ferien'))   return '#10b981'; // grün (oder was du willst)
      return '#10b981';
    };

    // Map pro Tag: mehrere Einträge möglich
    const map = {};
    const startBound = dayjs(monthStart);
    const endBound   = dayjs(monthEnd);

    for (const row of (data || [])) {
      const typ = (row.typ || '').toLowerCase();
      const color = row.farbe || defaultColor(row.typ);

      const von = dayjs(row.von);
      const bis = row.bis ? dayjs(row.bis) : von;

      let cur = von.isBefore(startBound, 'day') ? startBound : von;
      const last = bis.isAfter(endBound, 'day') ? endBound : bis;

      for (let i = 0; i < 500 && (cur.isSame(last, 'day') || cur.isBefore(last, 'day')); i++) {
        const dIso = cur.format('YYYY-MM-DD');
        if (!map[dIso]) map[dIso] = [];
        map[dIso].push({
          id: row.id,
          name: row.name,
          typ: row.typ,
          farbe: color,
          ist_bundesweit: !!row.ist_bundesweit,
          bundesland: row.bundesland || null,
        });
        cur = cur.add(1, 'day');
      }
    }

    setFeierMap(map);
  };

  // ===== UI-Actions / Navigation =====

  const zurueckZuHeute = () => {
    const heute = dayjs();
    setJahr(heute.year());
    setStartDatum(heute.startOf('month'));
    setInfoOffenIndex(null);
  };

  const changeMonth = (event) => {
    const newMonthIndex = monate.indexOf(event.target.value);
    if (newMonthIndex >= 0) {
      const neuesDatum = startDatum.set('month', newMonthIndex).startOf('month');
      setStartDatum(neuesDatum);
      setJahr(neuesDatum.year());
      setInfoOffenIndex(null);
    }
  };

  const changeYear = (event) => {
    const newYear = parseInt(event.target.value, 10);
    if (!isNaN(newYear)) {
      const neuesDatum = startDatum.set('year', newYear).startOf('month');
      setJahr(newYear);
      setStartDatum(neuesDatum);
      setInfoOffenIndex(null);
    }
  };

  const changeMonthRel = (delta) => {
    setStartDatum(prev => {
      const neu = prev.add(delta, 'month').startOf('month');
      setJahr(neu.year());
      return neu;
    });
    setInfoOffenIndex(null);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => changeMonthRel(1),
    onSwipedRight: () => changeMonthRel(-1),
    trackMouse: true,
    delta: 40,
    preventScrollOnSwipe: true,
  });

  if (!startDatum || typeof startDatum.daysInMonth !== 'function') {
    return <div className="p-4 text-red-500">Lade Kalender...</div>;
  }

  return (
    <div className="bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-200 text-sm h-screen flex flex-col overflow-hidden">
      <div className="sticky top-0 z-30 bg-gray-200 dark:bg-gray-900 px-4 pb-1 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={zurueckZuHeute}><ArrowLeft className="w-5 h-5" /></button>
            <select
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 text-sm"
              value={monate[startDatum.month()]} onChange={changeMonth}>
              {monate.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
            </select>
            <select
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 text-sm"
              value={jahr} onChange={changeYear}>
              {aktuelleJahre.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Fallback-Buttons für Monat +/- bleiben */}
            <button
              onClick={() => changeMonthRel(-1)}
              className="ml-2 bg-gray-600 text-white px-2 py-1 rounded text-xs"
              title="Vorheriger Monat"
            >◀︎</button>
            <button
              onClick={() => changeMonthRel(1)}
              className="bg-gray-600 text-white  px-2 py-1 rounded text-xs"
              title="Nächster Monat"
            >▶︎</button>

            {/* Umschalter lebt in den Einstellungen */}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4" {...swipeHandlers}>
        {kalenderAnsicht ? (
          <RenderKalender
            startDatum={startDatum}
            eintraege={eintraege}
            bedarfStatus={bedarfStatus}
            feierMap={feierMap}
            infoOffenIndex={infoOffenIndex}
            setInfoOffenIndex={setInfoOffenIndex}
            urlaubModal={urlaubModal}
            setUrlaubModal={setUrlaubModal}
            hilfeModal={hilfeModal}
            setHilfeModal={setHilfeModal}
            ausgegrautTage={ausgegrautTage}   // ⬅️ wichtig: fürs Blocken von Aktionen
          />
        ) : (
          <RenderListe
            startDatum={startDatum}
            eintraege={eintraege}
            bedarfStatus={bedarfStatus}
            feierMap={feierMap}
            infoOffenIndex={infoOffenIndex}
            setInfoOffenIndex={setInfoOffenIndex}
            urlaubModal={urlaubModal}
            setUrlaubModal={setUrlaubModal}
            hilfeModal={hilfeModal}
            setHilfeModal={setHilfeModal}
            heuteRef={heuteRef}
            ausgegrautTage={ausgegrautTage}   // ⬅️ ebenso hier
          />
        )}
      </div>

      <UrlaubsModal
        offen={urlaubModal.offen}
        tag={urlaubModal.tag}
        datum={urlaubModal.datum}
        schicht={urlaubModal.schicht}
        onClose={() => setUrlaubModal({ ...urlaubModal, offen: false })}
      />
      <BieteMichAnModal
        offen={hilfeModal.offen}
        tag={hilfeModal.tag}
        datum={hilfeModal.datum}
        schicht={hilfeModal.schicht}
        onClose={() => setHilfeModal({ ...hilfeModal, offen: false })}
      />
    </div>
  );
}
