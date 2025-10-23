// QualiZuweisung.jsx
import React, { useState, useEffect } from 'react';
import { Info, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const QualiZuweisung = ({ user, triggerRefresh }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [zugewiesen, setZugewiesen] = useState([]);
  const [alleQualis, setAlleQualis] = useState([]);
  const [hoverText, setHoverText] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(false);

  // --- Helpers ---
  const todayYYYYMMDD = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const toYYYYMMDD = (val, fallbackToday = true) => {
    if (!val) return fallbackToday ? todayYYYYMMDD() : '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const sameDateOrEmpty = (a, b) => {
    const aa = a || ''; const bb = b || '';
    return aa === bb;
  };

  useEffect(() => {
    const ladeQualifikationen = async () => {
      if (!firma || !unit || !user?.user_id) return;

      const { data: matrix } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('*')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true)
        .order('position', { ascending: true });

      const { data: zugewiesenData } = await supabase
        .from('DB_Qualifikation')
        .select('*')
        .eq('user_id', user.user_id);

      if (matrix) setAlleQualis(matrix);

      if (zugewiesenData && matrix) {
        const mitDetails = zugewiesenData.map((eintrag) => {
          const details = matrix.find((m) => m.id === eintrag.quali);
          const start = toYYYYMMDD(eintrag.quali_start, true);
          const ende  = eintrag.quali_endet ? toYYYYMMDD(eintrag.quali_endet, false) : '';
          return {
            ...eintrag,
            qualifikation: details?.qualifikation ?? '❓Unbekannt',
            kuerzel: details?.quali_kuerzel ?? '',
            beschreibung: details?.beschreibung ?? '',
            position: details?.position ?? null,
            quali_start: start,           // type="date" friendly
            quali_endet: ende,            // '' bedeutet unbefristet
            _origStart: start,
            _origEnd: ende,
            _changed: false,
          };
        });

        setZugewiesen(
          mitDetails.sort((a, b) => {
            if (a.position == null && b.position == null) return 0;
            if (a.position == null) return 1;
            if (b.position == null) return -1;
            return a.position - b.position;
          })
        );
      }
    };

    ladeQualifikationen();
  }, [firma, unit, user?.user_id]);

  const handleZuweisen = (q) => {
    const schon = zugewiesen.some((z) => z.quali === q.id);
    if (schon) return;

    const start = todayYYYYMMDD();
    setZugewiesen((prev) => [
      ...prev,
      {
        id: `neu-${q.id}`,
        quali: q.id,
        qualifikation: q.qualifikation,
        kuerzel: q.quali_kuerzel,
        beschreibung: q.beschreibung,
        position: q.position,
        quali_start: start,
        quali_endet: '', // unbefristet
        _origStart: start,
        _origEnd: '',
        _changed: false,
      },
    ]);
  };

  const handleEntfernen = async (id) => {
    if (String(id).startsWith('neu-')) {
      setZugewiesen((prev) => prev.filter((q) => q.id !== id));
      return;
    }

    const bestaetigt = window.confirm(
      'Willst du diese Qualifikation wirklich löschen?\nDas kann NICHT rückgängig gemacht werden.'
    );
    if (!bestaetigt) return;

    const { error } = await supabase.from('DB_Qualifikation').delete().eq('id', id);

    if (!error) {
      setZugewiesen((prev) => prev.filter((q) => q.id !== id));
      setFeedback('✔️ Qualifikation gelöscht.');
      triggerRefresh?.();
      setTimeout(() => setFeedback(''), 1800);
    } else {
      alert('Fehler beim Löschen!');
    }
  };

  const markChanged = (e, newStart, newEnd) => ({
    ...e,
    quali_start: newStart,
    quali_endet: newEnd,
    _changed: !(sameDateOrEmpty(newStart, e._origStart) && sameDateOrEmpty(newEnd, e._origEnd)),
  });

  const handleStartChange = (id, value) => {
    setZugewiesen((prev) =>
      prev.map((e) => (e.id === id ? markChanged(e, value, e.quali_endet) : e))
    );
  };

  const handleEndChange = (id, value) => {
    // leeres Feld => unbefristet
    const norm = value?.trim() ? value : '';
    setZugewiesen((prev) =>
      prev.map((e) => (e.id === id ? markChanged(e, e.quali_start, norm) : e))
    );
  };

  const handleSpeichern = async () => {
    const neu = zugewiesen.filter((q) => String(q.id).startsWith('neu-'));
    const changed = zugewiesen.filter((q) => !String(q.id).startsWith('neu-') && q._changed);

    if (neu.length === 0 && changed.length === 0) return;

    setButtonDisabled(true);
    setFeedback('Speichern …');

    // 1) Neue Einträge
    if (neu.length > 0) {
      const rows = neu.map((q) => ({
        user_id: user?.user_id,
        quali: q.quali,
        quali_start: q.quali_start,                   // 'YYYY-MM-DD'
        quali_endet: q.quali_endet || null,          // '' -> NULL (unbefristet)
      }));

      const { error, data } = await supabase
        .from('DB_Qualifikation')
        .insert(rows)
        .select();

      if (error) {
        setFeedback('❌ Fehler beim Speichern neuer Qualifikationen!');
        setTimeout(() => { setFeedback(''); setButtonDisabled(false); }, 2000);
        return;
      }

      if (data) {
        setZugewiesen((prev) =>
          prev.map((e) =>
            String(e.id).startsWith('neu-')
              ? (() => {
                  const match = data.find((d) => d.quali === e.quali);
                  if (!match) return e;
                  const start = toYYYYMMDD(match.quali_start, true);
                  const end = match.quali_endet ? toYYYYMMDD(match.quali_endet, false) : '';
                  return {
                    ...e,
                    id: match.id,
                    _origStart: start,
                    _origEnd: end,
                    _changed: false,
                  };
                })()
              : e
          )
        );
      }
    }

    // 2) Änderungen bestehender Einträge
    if (changed.length > 0) {
      for (const e of changed) {
        // Validierung clientseitig: End >= Start (falls gesetzt)
        if (e.quali_endet && e.quali_endet < e.quali_start) {
          setFeedback('❌ Enddatum darf nicht vor dem Startdatum liegen.');
          setTimeout(() => { setFeedback(''); setButtonDisabled(false); }, 2000);
          return;
        }

        const { error: upErr } = await supabase
          .from('DB_Qualifikation')
          .update({
            quali_start: e.quali_start,
            quali_endet: e.quali_endet || null,
          })
          .eq('id', e.id);

        if (upErr) {
          setFeedback('❌ Fehler beim Aktualisieren!');
          setTimeout(() => { setFeedback(''); setButtonDisabled(false); }, 2000);
          return;
        }
      }

      // Flags zurücksetzen
      setZugewiesen((prev) =>
        prev.map((e) =>
          e._changed
            ? { ...e, _changed: false, _origStart: e.quali_start, _origEnd: e.quali_endet }
            : e
        )
      );
    }

    setFeedback('✔️ Erfolgreich gespeichert!');
    triggerRefresh?.();
    setTimeout(() => { setFeedback(''); setButtonDisabled(false); }, 1200);
  };

  return (
    <div className="p-4 shadow-xl rounded-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Qualifikationen zuweisen</h2>
        <Info
          className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Linke Seite: Zugewiesen */}
        <div className="col-span-6 p-1 bg-gray-200 dark:bg-gray-800">
          <h3 className="font-semibold text-2xl mb-2">👤 {user?.name || 'Kein Benutzer ausgewählt'}</h3>

          <table className="w-full text-sm table-auto mt-4 whitespace-nowrap overflow-auto">
            <thead className="bg-gray-200 dark:bg-gray-700">
              <tr>
                <th className="p-1 text-left">Qualifikation</th>
                <th className="p-1 text-left">Kürzel</th>
                <th className="p-1 text-left">Zugewiesen am</th>
                <th className="p-1 text-left">Zuweisung endet</th>
                <th className="p-1 text-left">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {zugewiesen.map((e) => (
                <tr
                  key={e.id}
                  onMouseEnter={() => setHoverText(e.beschreibung)}
                  onMouseLeave={() => setHoverText('')}
                  className={e._changed ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                >
                  <td className="p-1">{e.qualifikation}</td>
                  <td className="p-1">{e.kuerzel}</td>
                  <td className="p-1">
                    <input
                      type="date"
                      value={e.quali_start || todayYYYYMMDD()}
                      onChange={(ev) => handleStartChange(e.id, ev.target.value)}
                      className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="date"
                      value={e.quali_endet || ''}  // '' = unbefristet
                      onChange={(ev) => handleEndChange(e.id, ev.target.value)}
                      placeholder="—"
                      className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                    />
                  </td>
                  <td className="p-1 text-red-600 text-center">
                    <Trash2
                      size={16}
                      className="inline cursor-pointer"
                      title="Qualifikation dauerhaft löschen"
                      onClick={() => handleEntfernen(e.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-right">
            <button
              onClick={handleSpeichern}
              disabled={buttonDisabled}
              className={`px-4 py-1 rounded text-white ${
                buttonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Qualifikationen speichern
            </button>
            {feedback && <div className="text-sm text-green-600 dark:text-green-400 mt-2">{feedback}</div>}
          </div>
        </div>

        {/* Rechte Seite: verfügbare Qualifikationen */}
        <div className="col-span-6 p-4 rounded bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow rounded-xl">
          <h3 className="font-semibold text-sm mb-2">🧩 Verfügbare Qualifikationen</h3>
          <table className="w-full text-sm table-auto">
            <thead className="bg-gray-200 dark:bg-gray-700">
              <tr>
                <th className="p-1 text-left">Qualifikation</th>
                <th className="p-1 text-left">Kürzel</th>
                <th className="p-1 text-left">Schwerpunkt</th>
                <th className="p-1 text-left">Betrieb</th>
              </tr>
            </thead>
            <tbody>
              {alleQualis.map((q) => {
                const schon = zugewiesen.some((z) => z.quali === q.id);
                return (
                  <tr
                    key={q.id}
                    onClick={() => handleZuweisen(q)}
                    onMouseEnter={() => setHoverText(q.beschreibung)}
                    onMouseLeave={() => setHoverText('')}
                    className={`cursor-pointer ${
                      schon ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-gray-700'
                    }`}
                    title={schon ? 'Bereits zugewiesen' : 'Zuweisen'}
                  >
                    <td className="p-1">{q.qualifikation}</td>
                    <td className="p-1">{q.quali_kuerzel}</td>
                    <td className="p-1">{q.schwerpunkt}</td>
                    <td className="p-1">{q.betriebs_relevant ? '✔️' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hoverText && (
            <div className="mt-4 text-sm italic text-gray-500 dark:text-gray-300">
              💡 {hoverText}
            </div>
          )}
        </div>
      </div>

      {/* InfoModal */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl max-w-xl w-full relative">
            <button onClick={() => setInfoOffen(false)} className="absolute top-2 right-2">
              <X />
            </button>
            <h3 className="text-lg font-semibold mb-4">ℹ️ Informationen zur Qualifikationszuweisung</h3>
            <p className="mb-2">
              👉 Du kannst pro Qualifikation einen <b>Start</b> und optional ein <b>Ende</b> setzen.
              Leeres Enddatum bedeutet <b>unbefristet</b>.
            </p>
            <p className="mb-2">
              ✅ Änderungen wirken sich auf die Planung und Bedarfsanalyse aus.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualiZuweisung;
