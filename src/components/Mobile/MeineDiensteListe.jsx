// MeineDiensteListe.jsx
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { ArrowLeft, Calendar, CalendarDays, Plus, Minus, Settings, X } from 'lucide-react';
import { ermittleBedarfUndStatus } from './Utils/bedarfsauswertung';
import UrlaubsModal from './UrlaubsModal';
import BieteMichAnModal from './BieteMichAnModal';



const monate = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const wochenTagKurz = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const MeineDiensteListe = () => {
  const gespeicherteId = localStorage.getItem('user_id');
  const firma = localStorage.getItem('firma_id');
  const unit = localStorage.getItem('unit_id');

  const [eintraege, setEintraege] = useState([]);
  const [startDatum, setStartDatum] = useState(dayjs().startOf('month'));
  const [infoOffenIndex, setInfoOffenIndex] = useState(null);
  const [infoOffenGlobal, setInfoOffenGlobal] = useState(false);
  const [bedarfStatus, setBedarfStatus] = useState({});
  const [urlaubModal, setUrlaubModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });
  const [hilfeModal, setHilfeModal] = useState({ offen: false, tag: '', datum: '', schicht: '' });

  const scrollRef = useRef(null);
  const heuteRef = useRef(null);

  const ladeDienste = async () => {
    if (!gespeicherteId) return;
    const { data } = await supabase
      .from('DB_Kampfliste')
      .select(`datum, ist_schicht(kuerzel, farbe_bg), startzeit_ist, endzeit_ist, kommentar`)
      .eq('user', gespeicherteId)
      .gte('datum', dayjs(startDatum).format('YYYY-MM-DD'))
      .lte('datum', dayjs(startDatum).endOf('month').format('YYYY-MM-DD'))
      .order('datum', { ascending: true });
    if (data) {
      setEintraege(data);
setTimeout(() => {
  if (heuteRef.current && scrollRef.current) {
const offsetTop = heuteRef.current.offsetTop;
const korrekterOffset = offsetTop - scrollRef.current.offsetTop - 10; // Abstand zur fixierten Leiste
scrollRef.current.scrollTo({ top: korrekterOffset, behavior: 'smooth' });
  }
}, 100);
    }
  };

  const ladeBedarfStatus = async () => {
    if (firma && unit && gespeicherteId) {
      const status = await ermittleBedarfUndStatus(gespeicherteId, parseInt(firma), parseInt(unit), startDatum.toDate());
           // console.log('📦 BedarfStatus aus ermittleBedarfUndStatus:', status["2025-07-15"]);
      setBedarfStatus(status);
    }
  };
  useEffect(() => {
    ladeDienste();
    ladeBedarfStatus();
  }, [gespeicherteId, startDatum]);

  const zurueckZuHeute = () => setStartDatum(dayjs().startOf('month'));

  const changeMonth = (event) => {
    const selected = event.target.value;
    const monthIndex = monate.indexOf(selected);
    if (monthIndex >= 0) {
      setStartDatum(dayjs().set('month', monthIndex).startOf('month'));
    }
  };

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
            <button onClick={() => setStartDatum((prev) => dayjs(prev).add(1, 'month').startOf('month'))}><Calendar className="w-5 h-5" /></button>
            <button onClick={() => setStartDatum((prev) => dayjs(prev).add(1, 'year').startOf('month'))}><CalendarDays className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-6 overflow-x-hidden">
        <div className="space-y-3">
          {Array.from({ length: startDatum.daysInMonth() }, (_, idx) => {
            const datum = startDatum.date(idx + 1).format('YYYY-MM-DD');
            const eintrag = eintraege.find(e => dayjs(e.datum).format('YYYY-MM-DD') === datum);
            const tag = datum;
            const woTag = dayjs(datum).day();
            const istHeute = tag === dayjs().format('YYYY-MM-DD');
            const istVergangenheit = dayjs(datum).isBefore(dayjs(), 'day');
            const tagStil = woTag === 0 ? 'text-red-500 font-bold' : woTag === 6 ? 'text-orange-500 font-bold' : '';
            const kuerzel = eintrag?.ist_schicht?.kuerzel || '-';
            const farbe = eintrag?.ist_schicht?.farbe_bg || '#999';
            const start = eintrag?.startzeit_ist ? dayjs(`2000-01-01T${eintrag.startzeit_ist}`) : null;
            let ende = eintrag?.endzeit_ist ? dayjs(`2000-01-01T${eintrag.endzeit_ist}`) : null;
            if (start && ende && ende.isBefore(start)) ende = ende.add(1, 'day');
            const dauerMin = start && ende ? ende.diff(start, 'minute') : 0;
            const stunden = Math.floor(dauerMin / 60);
            const minuten = dauerMin % 60;
            const status = bedarfStatus[tag];
//console.log('📊 Status für Tag', tag, status?.fehlendProSchicht);
            return (
              <div key={idx} ref={istHeute ? heuteRef : null} className={`bg-white dark:bg-gray-700 rounded-lg shadow p-3 border-2 ${istHeute ? 'border-blue-500' : 'border-transparent'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={tagStil}>{wochenTagKurz[woTag]}</span>
                    <span>{dayjs(datum).format('DD.MM.YYYY')}</span>
                    <span className="text-white text-xs px-2 py-1 rounded" style={{ backgroundColor: farbe }}>{kuerzel}</span>
                    <span className="text-xs px-2 py-1 rounded text-white" style={{ backgroundColor: farbe }}>
                      {start && ende ? `${start.format('HH:mm')} - ${ende.format('HH:mm')}` : '–'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {bedarfStatus?.[tag]?.ueber?.length > 0 && kuerzel !== '-' && (
                      <button className="text-green-600" title="Überdeckung – Urlaub möglich">🌿</button>
                    )}
{bedarfStatus?.[tag]?.fehlendProSchicht &&
  Object.values(bedarfStatus[tag].fehlendProSchicht).some((wert) => wert === true)
 && (
    <button
  className="text-red-600 animate-pulse"
  title="Unterbesetzung anzeigen"
  onClick={() => setInfoOffenIndex(idx)}
>❗</button>

)}
                    <button onClick={() => setInfoOffenIndex(infoOffenIndex === idx ? null : idx)} title={infoOffenIndex === idx ? 'Details schließen' : 'Details anzeigen'}>
                      {infoOffenIndex === idx ? (
                        <Minus className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Plus className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  </div>
                </div>

                {infoOffenIndex === idx && (
                  <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
                    <div><strong>Datum:</strong> {dayjs(datum).format('DD.MM.YYYY')}</div>
                    <div><strong>Von-Bis:</strong> {start?.format('HH:mm')} - {ende?.format('HH:mm')}</div>
                    <div><strong>Dauer:</strong> {dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}</div>
                    {eintrag?.kommentar && <div><strong>Kommentar:</strong> {eintrag.kommentar}</div>}
                    {kuerzel === '-' && status?.kannHelfen?.length > 0 && (
                      <div className="mt-2 text-yellow-500 text-xs">
                        Du kannst bei {status.kannHelfen.map(k => k.kuerzel).join(', ')} aushelfen.
                      </div>
                    )}
{status?.fehlendProSchicht && (
  <>
    {['F', 'S', 'N'].some(k => status.fehlendProSchicht[k]) && !istVergangenheit && (
      <div className="mt-2 text-red-600 text-sm">
        <div className=" text-xs font-semibold mb-2">Unterbesetzung ❗</div>

        {[{ name: 'Früh', key: 'F' }, { name: 'Spät', key: 'S' }, { name: 'Nacht', key: 'N' }].map(({ name, key }) => {
          const fehlt = status.fehlendProSchicht[key];
          if (!fehlt) return null;

          const anzahl =
            Array.isArray(fehlt) ? fehlt.length
            : typeof fehlt === 'number' ? fehlt
            : typeof fehlt === 'boolean' && fehlt ? 1
            : 0;

          return (
<div
  key={key}
  className="cursor-pointer bg-gray-200 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded p-2 shadow-md mb-1 hover:bg-red-100 dark:hover:bg-red-900"
  onClick={() =>
    setHilfeModal({
      offen: true,
      tag: wochenTagKurz[woTag],
      datum: datum,
      schicht: key
    })
  }
>
  <span className="font-medium">{name}:</span>{' '}
  {anzahl > 0 ? `Fehlt ${anzahl} Person(en)` : 'keine Unterbesetzung'}
</div>
          );
        })}
      </div>
    )}

    {/* 🌿 Urlaub nur wenn keine Unterbesetzung in eigener Schicht */}
    {kuerzel !== '-' &&
    !istVergangenheit &&
      status?.ueber?.includes(kuerzel) &&
      !status?.fehlendProSchicht?.[kuerzel] && (
        <div className="mt-2 border-2 border-green-300 bg-white dark:bg-gray-900 text-green-700 px-3 py-1 rounded-md shadow-sm text-xs">
          🌿 <button
  onClick={() => setUrlaubModal({
    offen: true,
    tag: wochenTagKurz[woTag],
    datum: datum,
    schicht: kuerzel
  })}
  className="font-semibold underline text-green-700"
>
  Ich würde gerne Urlaub nehmen
</button>
        </div>
      )}
  </>
)}
                    <div className="text-right mt-2">
                      <button onClick={() => setInfoOffenIndex(null)} className="text-blue-600 hover:underline">Schließen</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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