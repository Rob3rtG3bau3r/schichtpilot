// MeineDiensteListe.jsx
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { ArrowLeft } from 'lucide-react';
import { ermittleBedarfUndStatus } from './Utils/bedarfsauswertung';
import UrlaubsModal from './UrlaubsModal';
import BieteMichAnModal from './BieteMichAnModal';
import RenderKalender from './RenderKalender';
import RenderListe from './RenderListe';

const monate = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const MeineDiensteListe = () => {
  const gespeicherteId = localStorage.getItem('user_id');
  const firma = localStorage.getItem('firma_id');
  const unit = localStorage.getItem('unit_id');

  const [eintraege, setEintraege] = useState([]);
  const [startDatum, setStartDatum] = useState(dayjs().startOf('month'));
  const [infoOffenIndex, setInfoOffenIndex] = useState(null);
  const [bedarfStatus, setBedarfStatus] = useState({});
  const [urlaubModal, setUrlaubModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });
  const [hilfeModal, setHilfeModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });
  const [kalenderAnsicht, setKalenderAnsicht] = useState(false);
  const [jahr, setJahr] = useState(dayjs().year());

  const scrollRef = useRef(null);
  const heuteRef = useRef(null);

  const aktuellesJahr = dayjs().year();
  const aktuelleJahre = [aktuellesJahr - 1, aktuellesJahr, aktuellesJahr + 1];

  useEffect(() => {
    ladeUserEinstellungen();
  }, []);

  useEffect(() => {
    if (gespeicherteId && startDatum) {
      ladeDienste();
      ladeBedarfStatus();
    }
  }, [gespeicherteId, startDatum]);

  const ladeUserEinstellungen = async () => {
    if (!gespeicherteId) return;
    const { data, error } = await supabase
      .from('DB_User')
      .select('mobile_kalender')
      .eq('user_id', gespeicherteId)
      .single();
    if (!error && data) setKalenderAnsicht(data.mobile_kalender === 'kalender');
  };

  const speichereAnsicht = async (istKalender) => {
    if (!gespeicherteId) return;
    await supabase
      .from('DB_User')
      .update({ mobile_kalender: istKalender ? 'kalender' : 'liste' })
      .eq('user_id', gespeicherteId);
  };

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
        gespeicherteId,
        parseInt(firma),
        parseInt(unit),
        startDatum.toDate()
      );
      setBedarfStatus(status);
    }
  };

  const zurueckZuHeute = () => {
    const heute = dayjs();
    setJahr(heute.year());
    setStartDatum(heute.startOf('month'));
  };

  const changeMonth = (event) => {
    const newMonthIndex = monate.indexOf(event.target.value);
    if (newMonthIndex >= 0) {
      const neuesDatum = startDatum.set('month', newMonthIndex).startOf('month');
      setStartDatum(neuesDatum);
    }
  };

  const changeYear = (event) => {
    const newYear = parseInt(event.target.value);
    if (!isNaN(newYear)) {
      const neuesDatum = startDatum.set('year', newYear).startOf('month');
      setJahr(newYear);
      setStartDatum(neuesDatum);
    }
  };

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
            <button
              onClick={() => {
                const neueAnsicht = !kalenderAnsicht;
                setKalenderAnsicht(neueAnsicht);
                speichereAnsicht(neueAnsicht);
              }}
              className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-sm"
            >
              {kalenderAnsicht ? 'Liste' : 'Kalender'}
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4">
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
};

export default MeineDiensteListe;