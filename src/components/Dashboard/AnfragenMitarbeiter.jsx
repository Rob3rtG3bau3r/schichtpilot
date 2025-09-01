import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { Info, ChevronDown, ChevronRight, RefreshCcw } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';

const AnfragenMitarbeiter = () => {
  const { userId, rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [anfragen, setAnfragen] = useState([]);
  const [filter, setFilter] = useState({ offen: true, geschlossen: false, abgelaufen: false });
  const [modalAnfrage, setModalAnfrage] = useState(null);
  const [kommentar, setKommentar] = useState('');
  const [entscheidung, setEntscheidung] = useState(null);
  const [bereichOffen, setBereichOffen] = useState(true);
  const [infoModalOffen, setInfoModalOffen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

useEffect(() => {
  const ladeAnfragen = async () => {
    if (!firma || !unit) return; // Guard

    let query = supabase
      .from('DB_AnfrageMA')
      .select('*, created_by_user:created_by ( vorname, nachname ), verantwortlicher_user:verantwortlicher ( vorname, nachname )')
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    // Employees sehen nur eigene Anfragen
    if (rolle === 'Employee') {
      query = query.eq('created_by', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Fehler beim Laden:', error.message);
      return;
    }

    const gefiltert = (data || [])
      .filter((eintrag) => {
        const istAbgelaufen = dayjs().diff(dayjs(eintrag.created_at), 'day') > 3;
        const istOffen = eintrag.genehmigt === null;
        const istGeschlossen = eintrag.genehmigt !== null;
        return (
          (filter.abgelaufen && istAbgelaufen) ||
          (filter.offen && istOffen && !istAbgelaufen) ||
          (filter.geschlossen && istGeschlossen && !istAbgelaufen)
        );
      })
      .sort((a, b) => {
        if (a.genehmigt === null && b.genehmigt !== null) return -1;
        if (a.genehmigt !== null && b.genehmigt === null) return 1;
        return 0;
      });

    setAnfragen(gefiltert);
  };

  ladeAnfragen();
}, [filter, rolle, firma, unit, userId, refreshKey]);


  const handleSpeichern = async () => {
    if (!modalAnfrage || entscheidung === null) return;

    const { id } = modalAnfrage;
    const { error } = await supabase
      .from('DB_AnfrageMA')
      .update({
        genehmigt: entscheidung,
        kommentar,
        verantwortlicher: userId,
        datum_entscheid: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Speichern:', error.message);
    } else {
      setModalAnfrage(null);
      setEntscheidung(null);
      setKommentar('');
    }
   setRefreshKey(prev => prev + 1); // ⬅️ damit direkt neu geladen wird 
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl p-1 shadow-xl border border-gray-300 dark:border-gray-700">

<div
  onClick={() => setBereichOffen(prev => !prev)}
  role="button"
  tabIndex={0}
  className="w-full flex justify-between items-center py-3 bg-gray-200 dark:bg-gray-800 rounded-xl transition-all"
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setBereichOffen(prev => !prev)}
>
  <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white">
    {bereichOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
    <span>Anfragen <span className="text-blue-600">({anfragen.filter(a => a.genehmigt === null).length})</span></span>
  </div>
  <button
    onClick={(e) => {
      e.stopPropagation();
      setInfoModalOffen(true);
    }}
    title="Mehr Infos"
  >
<Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
  </button>
</div>
      {/* Inhalt */}
      {bereichOffen && (
        <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-b-xl  dark:border-gray-700">
{/* Filter + Refresh */}
<div className="flex justify-between items-center mb-4 text-sm">
  {/* Linke Seite: Checkboxen */}
  <div className="flex gap-4 flex-wrap">
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={filter.offen} onChange={() => setFilter(f => ({ ...f, offen: !f.offen }))} />
      Offen
    </label>
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={filter.geschlossen} onChange={() => setFilter(f => ({ ...f, geschlossen: !f.geschlossen }))} />
      Geschlossen
    </label>
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={filter.abgelaufen} onChange={() => setFilter(f => ({ ...f, abgelaufen: !f.abgelaufen }))} />
      Abgelaufen
    </label>
  </div>

  {/* Rechte Seite: Refresh-Button */}
  <button
    onClick={() => setRefreshKey(prev => prev + 1)}
    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
    title="Neu laden"
  >
    <RefreshCcw className="w-4 h-4" />
    <span className="text-sm">Refresh</span>
  </button>
</div>


          {/* Tabelle */}
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-300 text-left">
                  <th className="p-2">Datum</th>
                  <th>Schicht</th>
                  <th>Von</th>
                  <th>Antrag</th>
                  <th>Erstellt</th>
                  <th>Status</th>
                  <th>Entscheider</th>
                  <th>Entschieden am</th>
                </tr>
              </thead>
              <tbody>
                {anfragen.map((a) => {
                  const istAenderbar = !a.datum_entscheid || dayjs().diff(dayjs(a.datum_entscheid), 'day') <= 1;

                  return (
                    <tr
                      key={a.id}
                      onClick={() => istAenderbar && setModalAnfrage(a)}
                      className={`border-b border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700 ${!istAenderbar ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      title={a.kommentar || ''}
                    >
                      <td className="p-2">{dayjs(a.datum).format('DD.MM.YYYY')}</td>
                      <td>{a.schicht}</td>
                      <td>{a.created_by_user ? `${a.created_by_user.vorname} ${a.created_by_user.nachname}` : '-'}</td>
                      <td>{a.antrag}</td>
                      <td>{dayjs(a.created_at).format('DD.MM.YY HH:mm')}</td>
                      <td>{a.genehmigt === null ? 'Offen' : a.genehmigt ? '✅' : '❌'}</td>
                      <td>{a.verantwortlicher_user ? `${a.verantwortlicher_user.vorname.charAt(0)}. ${a.verantwortlicher_user.nachname}` : '-'}</td>
                      <td>{a.datum_entscheid ? dayjs(a.datum_entscheid).format('DD.MM.YY HH:mm') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAnfrage && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md z-50">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">
              Genehmigung prüfen
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Ich habe überprüft, ob der Kollege am <b>{dayjs(modalAnfrage.datum).format('DD.MM.YYYY')}</b> die <b>{modalAnfrage.schicht}</b> entsprechend <b>{modalAnfrage.antrag}</b> genehmigt bekommt.
            </p>

            <div className="flex gap-4 mb-4">
              <button onClick={() => setEntscheidung(true)} className={`px-4 border border-gray-300 dark:border-gray-600 py-2 rounded ${entscheidung === true ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Ja</button>
              <button onClick={() => setEntscheidung(false)} className={`px-4 border border-gray-300 dark:border-gray-600 py-2 rounded ${entscheidung === false ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Nein</button>
            </div>

            <textarea
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows="3"
              placeholder="Kommentar"
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
            />

            <div className="flex justify-end mt-4 gap-2">
              <button onClick={() => setModalAnfrage(null)} className="px-4 py-2 text-sm text-gray-500">Abbrechen</button>
              <button onClick={handleSpeichern} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModalOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md w-full animate-fade-in">
            <h3 className="text-lg font-semibold mb-4">ℹ️ Informationen</h3>
            <ul className="text-sm list-disc ml-4 space-y-2">
              <li>Anfragen verfallen automatisch nach 3 Tagen.</li>
              <li>Entscheidungen können nur 24h lang geändert werden.</li>
              <li>Alle Aktionen werden mit Uhrzeit protokolliert.</li>
              <li>Teamverantwortliche können die Anträge bearbeiten.</li>
              <li>Mitarbeiter sehen nur ihre eigenen Anträge.</li>
            </ul>
            <div className="text-right mt-4">
              <button onClick={() => setInfoModalOffen(false)} className="text-blue-600 hover:underline">Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnfragenMitarbeiter;
