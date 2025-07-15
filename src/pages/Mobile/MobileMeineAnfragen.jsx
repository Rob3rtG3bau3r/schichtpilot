import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';

const MobileMeineAnfragen = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [filter, setFilter] = useState('bevorstehend');
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

  const gefilterteAnfragen = anfragen
    .filter((a) => {
      const istZukunft = dayjs(a.datum).isSameOrAfter(dayjs(), 'day');
      if (filter === 'bevorstehend') {
        return istZukunft;
      }
      if (filter === 'genehmigt') {
        return a.genehmigt === true;
      }
      if (filter === 'abgelehnt') {
        return a.genehmigt === false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = dayjs(a.datum);
      const dateB = dayjs(b.datum);
      if (!dateA.isSame(dateB, 'day')) {
        return dateA.diff(dateB);
      }
      const schichtReihenfolge = { F: 1, S: 2, N: 3 };
      const ordA = schichtReihenfolge[a.schicht] || 99;
      const ordB = schichtReihenfolge[b.schicht] || 99;
      return ordA - ordB;
    });

  const getSchichtName = (s) =>
    s === 'F' ? 'Frühschicht' : s === 'S' ? 'Spätschicht' : s === 'N' ? 'Nachtschicht' : s;

  return (
    <div className="flex flex-col min-h-screen bg-gray-200 dark:bg-gray-700">
      {/* Filterauswahl */}
      <div className="flex justify-around py-2 text-sm text-gray-900 dark:text-gray-200 bg-white dark:bg-gray-800 border-b dark:border-gray-600">
        <button
          className={filter === 'bevorstehend' ? 'text-blue-600 font-semibold bg-blue-600 bg-opacity-20 py-1 px-2 border border-blue-500 rounded' : ''}
          onClick={() => setFilter('bevorstehend')}
        >
          Bevorstehend
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
              {dayjs(a.datum).format('DD.MM.YYYY')} –{' '}
              <span className="font-semibold">{getSchichtName(a.schicht)}</span>
            </div>

            <div className="text-sm text-gray-800 dark:text-white mb-1">
              Antrag: <b>{a.antrag}</b>
            </div>

            <div className="text-sm text-gray-700 dark:text-gray-400">
              Status:{' '}
              {a.genehmigt === null
                ? '⏳ Offen'
                : a.genehmigt
                ? '✅ Genehmigt'
                : '❌ Abgelehnt'}
            </div>

            {a.genehmigt === false && a.datum_entscheid && (
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
