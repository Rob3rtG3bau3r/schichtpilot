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
  if (['1','true','t','yes','y','ja','ok','approved','genehmigt','✅'].includes(s)) return 1;
  if (['0','false','f','no','n','nein','abgelehnt','❌'].includes(s)) return -1;
  return 0;
};

const getSchichtName = (s) =>
  s === 'F' ? 'Frühschicht' : s === 'S' ? 'Spätschicht' : s === 'N' ? 'Nachtschicht' : s || '-';

const MobileMeineAnfragen = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [filter, setFilter] = useState('ausstehend'); // 'ausstehend' | 'genehmigt' | 'abgelehnt'
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
    ladeAnfragen();
  }, [userId]);

  const gefilterteAnfragen = useMemo(() => {
    const base = (anfragen || []).filter(a => {
      const status = triStatus(a.genehmigt);

      if (filter === 'ausstehend') {
        // Nur heute/ Zukunft und noch nicht beantwortet
        return status === 0 && dateTodayOrFuture(a.datum);
      }
      if (filter === 'genehmigt') return status === 1;
      if (filter === 'abgelehnt') return status === -1;
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
  }, [anfragen, filter]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-200 dark:bg-gray-900">
      {/* Filterauswahl */}
      <div className="flex justify-around py-2 text-sm text-gray-900 dark:text-gray-200 bg-white dark:bg-gray-900 border-b dark:border-gray-600">
        <button
          className={filter === 'ausstehend' ? 'text-blue-600 font-semibold bg-blue-600 bg-opacity-20 py-1 px-2 border border-blue-500 rounded' : ''}
          onClick={() => setFilter('ausstehend')}
        >
          Ausstehende
        </button>
        <button
          className={filter === 'genehmigt' ? 'text-green-600 font-semibold bg-green-600 bg-opacity-20 py-1 px-2 border border-green-500 rounded' : ''}
          onClick={() => setFilter('genehmigt')}
        >
          Genehmigt
        </button>
        <button
          className={filter === 'abgelehnt' ? 'text-red-600 font-semibold bg-red-600 bg-opacity-20 py-1 px-2 border border-red-500 rounded' : ''}
          onClick={() => setFilter('abgelehnt')}
        >
          Abgelehnt
        </button>
      </div>

      {/* Liste */}
      <div className="p-4 space-y-4 overflow-y-auto">
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
              {triStatus(a.genehmigt) === 0
                ? '⏳ Offen'
                : triStatus(a.genehmigt) === 1
                ? '✅ Genehmigt'
                : '❌ Abgelehnt'}
            </div>

            {triStatus(a.genehmigt) === -1 && a.datum_entscheid && (
              <div className="text-xs text-red-500 mt-1">
                Abgelehnt am: {dayjs(a.datum_entscheid).format('DD.MM.YYYY')}
              </div>
            )}

            {a.kommentar && (
              <div className="text-xs text-gray-500 mt-2 italic">
                Kommentar: {a.kommentar}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileMeineAnfragen;
