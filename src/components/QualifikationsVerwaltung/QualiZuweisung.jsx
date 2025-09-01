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
  const [userVisible, setUserVisible] = useState(true);

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
        return {
          ...eintrag,
          qualifikation: details?.qualifikation ?? '❓Unbekannt',
          kuerzel: details?.quali_kuerzel ?? '',
          beschreibung: details?.beschreibung ?? '',
          position: details?.position ?? null,
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
useEffect(() => {
  const ladeUserVisible = async () => {
    if (!user?.user_id) return;

    const { data: userInfo } = await supabase
      .from('DB_User')
      .select('user_visible')
      .eq('user_id', user.user_id)
      .single();

    setUserVisible(userInfo?.user_visible === true);
  };

  ladeUserVisible();
}, [user?.user_id]);
  const handleZuweisen = (q) => {
    const schon = zugewiesen.some((z) => z.quali === q.id);
    if (schon) return;

    setZugewiesen((prev) => [
      ...prev,
      {
        id: `neu-${q.id}`,
        quali: q.id,
        qualifikation: q.qualifikation,
        kuerzel: q.quali_kuerzel,
        beschreibung: q.beschreibung,
        created_at: new Date().toISOString(),
        position: q.position,
      },
    ]);
  };

  const handleEntfernen = async (id) => {
    if (String(id).startsWith('neu-')) {
      setZugewiesen((prev) => prev.filter((q) => q.id !== id));
      return;
    }

    const bestaetigt = window.confirm('Möchtest du diese Qualifikation wirklich entfernen?');
    if (!bestaetigt) return;

    const { error } = await supabase.from('DB_Qualifikation').delete().eq('id', id);

    if (!error) {
      setZugewiesen((prev) => prev.filter((q) => q.id !== id));
      setFeedback('✔️ Qualifikation entfernt!');
      triggerRefresh?.();
      setTimeout(() => setFeedback(''), 2000);
    } else {
      alert('Fehler beim Entfernen!');
    }
  };

  const handleSpeichern = async () => {
    const neuZuweisungen = zugewiesen.filter((q) => String(q.id).startsWith('neu-'));
    if (neuZuweisungen.length === 0) return;

    setButtonDisabled(true);
    setFeedback('Speichern …');

    const eintraege = neuZuweisungen.map((q) => ({
      user_id: user?.user_id,
      quali: q.quali,
      created_at: q.created_at,
    }));

    const { error, data } = await supabase.from('DB_Qualifikation').insert(eintraege).select();

    if (!error) {
      const gespeicherte = data.map((e) => e.quali);
      setZugewiesen((prev) =>
        prev.map((q2) =>
          String(q2.id).startsWith('neu-') && gespeicherte.includes(q2.quali)
            ? { ...q2, id: data.find((d) => d.quali === q2.quali)?.id }
            : q2
        )
      );
      setFeedback('✔️ Erfolgreich gespeichert!');
      triggerRefresh?.();
    } else {
      setFeedback('❌ Fehler beim Speichern!');
    }

    setTimeout(() => {
      setFeedback('');
      setButtonDisabled(false);
    }, 2000);
  };

  const handleVisibleToggle = async (checked) => {
    const { error } = await supabase
      .from('DB_User')
      .update({ user_visible: checked })
      .eq('user_id', user.user_id);

    if (!error) {
      setUserVisible(checked);
      triggerRefresh?.();
    } else {
      alert('Fehler beim Speichern von user_visible!');
      console.error(error);
    }
  };

  return (
    <div className="p-4 shadow-xl rounded-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Qualifikationen zuweisen</h2>
        <Info className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" onClick={() => setInfoOffen(true)} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Linke Seite: Zugewiesen */}
        <div className="col-span-6 p-1 bg-gray-200 dark:bg-gray-800">
          <h3 className="font-semibold text-2xl mb-2">👤 {user?.name || 'Kein Benutzer ausgewählt'}</h3>

          {/* Sichtbarkeit */}
          {user?.user_id && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={userVisible}
                onChange={(e) => handleVisibleToggle(e.target.checked)}
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Mitarbeiter im Einsatzplan anzeigen
              </label>
            </div>
          )}

          <table className="w-full text-sm table-auto mt-4 whitespace-nowrap overflow-auto">
            <thead className="bg-gray-200 dark:bg-gray-700">
              <tr>
                <th className="p-1 text-left">Qualifikation</th>
                <th className="p-1 text-left">Kürzel</th>
                <th className="p-1 text-left">Zugewiesen</th>
                <th className="p-1 text-left">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {zugewiesen.map((eintrag) => (
                <tr
                  key={eintrag.id}
                  onMouseEnter={() => setHoverText(eintrag.beschreibung)}
                  onMouseLeave={() => setHoverText('')}
                >
                  <td className="p-1">{eintrag.qualifikation}</td>
                  <td className="p-1">{eintrag.kuerzel}</td>
                  <td className="p-1">{new Date(eintrag.created_at).toLocaleDateString()}</td>
                  <td className="p-1 text-red-600 text-center">
                    <Trash2 size={16} className="inline cursor-pointer" onClick={() => handleEntfernen(eintrag.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-right">
            <button
              onClick={handleSpeichern}
              disabled={buttonDisabled}
              className={`flex px-4 py-1 rounded text-white ${
                buttonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Qualifikationen speichern
            </button>
            {feedback && <div className="text-sm text-green-600 dark:text-green-400 mt-2">{feedback}</div>}
          </div>
        </div>

        {/* Rechte Seite */}
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
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl  animate-fade-in max-w-xl w-full relative">
            <button onClick={() => setInfoOffen(false)} className="absolute top-2 right-2">
              <X />
            </button>
            <h3 className="text-lg font-semibold mb-4">ℹ️ Informationen zur Qualifikationszuweisung</h3>
            <p className="mb-2">
              👉 Hier kannst du Mitarbeitenden bestimmte Qualifikationen zuweisen. Die linke Liste zeigt bereits
              zugewiesene Qualifikationen, die rechte alle verfügbaren im Betrieb.
            </p>
            <p className="mb-2">
              ✅ Qualifikationen wirken sich auf die Einsatzplanung aus – insbesondere bei der Bedarfsanalyse.
            </p>
            <p className="mb-2">
              ✅ Die Checkbox <strong>„Mitarbeiter im Einsatzplan anzeigen“</strong> dient dazu, Mitarbeitende temporär
              auszublenden (z. B. bei Krankheit oder Urlaub). In der Kampfliste werden sie dann visuell ausgegraut.
            </p>
            <p className="mb-2">
              ⚠️ <strong>Wichtig:</strong> Auch wenn ein Mitarbeiter ausgeblendet ist, werden seine Qualifikationen bei
              Bedarfsauswertungen weiterhin berücksichtigt.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualiZuweisung;

