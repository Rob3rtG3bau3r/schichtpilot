// MeineDiensteListe.jsx
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
  const [bedarfStatus, setBedarfStatus] = useState({});
  const [urlaubModal, setUrlaubModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });
  const [hilfeModal, setHilfeModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });

  // 💡 WICHTIG: sofort synchron initialisieren (verhindert Flackern)
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

  useEffect(() => {
    if (gespeicherteId && startDatum) {
      ladeDienste();
      ladeBedarfStatus();
    }
  }, [gespeicherteId, startDatum]);

  const ladeDienste = async () => {
    const { data } = await supabase
      .from('DB_Kampfliste')
      .select(`datum, ist_schicht(kuerzel, farbe_bg, farbe_text), startzeit_ist, endzeit_ist, kommentar`)
      .eq('user', gespeicherteId)
      .gte('datum', startDatum.format('YYYY-MM-DD'))
      .lte('datum', startDatum.endOf('month').format('YYYY-MM-DD'))
      .order('datum', { ascending: true });
    if (data) setEintraege(data);
  };

  const ladeBedarfStatus = async () => {
    if (firma && unit && gespeicherteId) {
      const status = await ermittleBedarfUndStatus(
        gespeicherteId, parseInt(firma), parseInt(unit), startDatum.toDate()
      );
      setBedarfStatus(status);
    }
  };

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
    const newYear = parseInt(event.target.value);
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
    <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200 text-sm h-screen flex flex-col overflow-hidden">
      <div className="sticky top-0 z-30 bg-gray-200 dark:bg-gray-800 px-4 pb-1 shadow-md">
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

            {/* ✅ Umschalter wurde entfernt – lebt jetzt in den Einstellungen */}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4" {...swipeHandlers}>
        {kalenderAnsicht ? (
          <RenderKalender
            startDatum={startDatum}
            eintraege={eintraege}
            bedarfStatus={bedarfStatus}
            infoOffenIndex={infoOffenIndex}
            setInfoOffenIndex={setInfoOffenIndex}
            urlaubModal={urlaubModal}
            setUrlaubModal={setUrlaubModal}
            hilfeModal={hilfeModal}
            setHilfeModal={setHilfeModal}
          />
        ) : (
          <RenderListe
            startDatum={startDatum}
            eintraege={eintraege}
            bedarfStatus={bedarfStatus}
            infoOffenIndex={infoOffenIndex}
            setInfoOffenIndex={setInfoOffenIndex}
            urlaubModal={urlaubModal}
            setUrlaubModal={setUrlaubModal}
            hilfeModal={hilfeModal}
            setHilfeModal={setHilfeModal}
            heuteRef={heuteRef}
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
