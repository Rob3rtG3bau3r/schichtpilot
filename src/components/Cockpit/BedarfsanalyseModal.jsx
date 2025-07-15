import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const BedarfsAnalyseModal = ({ offen, onClose, modalDatum, modalSchicht, fehlendeQualis = [] }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [freieMitarbeiter, setFreieMitarbeiter] = useState([]);

  const [kollidiertAktiv, setKollidiertAktiv] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    if (!offen || !modalDatum || !modalSchicht || !firma || !unit) return;

    const ladeDaten = async () => {
      setMitarbeiter([]);
      setFreieMitarbeiter([]);

      const { data: schichtArt } = await supabase
        .from('DB_SchichtArt')
        .select('id')
        .eq('kuerzel', modalSchicht)
        .eq('firma_id', Number(firma))
        .eq('unit_id', Number(unit))
        .single();

      const { data: freiArt } = await supabase
        .from('DB_SchichtArt')
        .select('id')
        .eq('kuerzel', '-')
        .eq('firma_id', Number(firma))
        .eq('unit_id', Number(unit))
        .single();

      const [dienstData, freiData] = await Promise.all([
        supabase
          .from('DB_Kampfliste')
          .select('user')
          .eq('datum', modalDatum)
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('ist_schicht', schichtArt?.id),
        supabase
          .from('DB_Kampfliste')
          .select('user')
          .eq('datum', modalDatum)
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('ist_schicht', freiArt?.id)
      ]);

      const mitarbeiterMitNamen = await Promise.all(
        (dienstData?.data || []).map(async (eintrag) => {
          const userId = eintrag.user;
          const { data: profil } = await supabase
            .from('DB_User')
            .select('vorname, nachname')
            .eq('user_id', userId)
            .single();
          return {
            vorname: profil?.vorname || '',
            nachname: profil?.nachname || ''
          };
        })
      );
      setMitarbeiter(mitarbeiterMitNamen);

      const getKuerzel = async (userId, datum) => {
        const { data } = await supabase
          .from('DB_Kampfliste')
          .select('ist_schicht(kuerzel)')
          .eq('user', userId)
          .eq('datum', datum)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.ist_schicht?.kuerzel || '-';
      };

const mitVortagNachtrag = await Promise.all(
  (freiData?.data || []).map(async (e) => {
    const userId = e.user;

    // Qualis des Nutzers abrufen
    const { data: userQualis } = await supabase
      .from('DB_Qualifikation')
      .select('quali(id, quali_kuerzel)')
      .eq('user_id', userId);

    // Prüfen, ob mindestens eine passende Quali vorhanden ist
    const nutzerHatPassendeQuali = (userQualis || [])
      .map(q => q?.quali?.quali_kuerzel)
      .filter(Boolean)
      .some(kuerzel => fehlendeQualis.includes(kuerzel));

    console.log('➡️ User:', userId);
    console.log('   Qualis:', userQualis?.map(q => q.quali?.quali_kuerzel));
    console.log('   Fehlende:', fehlendeQualis);
    console.log('   ➕ Passend:', nutzerHatPassendeQuali);

    // Wenn nicht passend → ausblenden
    if (fehlendeQualis.length > 0 && !nutzerHatPassendeQuali) return null;

          const { data: profil } = await supabase
            .from('DB_User')
            .select('vorname, nachname')
            .eq('user_id', userId)
            .single();

          const vorher = await getKuerzel(userId, dayjs(modalDatum).subtract(1, 'day').format('YYYY-MM-DD'));
          const nachher = await getKuerzel(userId, dayjs(modalDatum).add(1, 'day').format('YYYY-MM-DD'));
          const vorvortag = await getKuerzel(userId, dayjs(modalDatum).subtract(2, 'day').format('YYYY-MM-DD'));
          const folgetagplus = await getKuerzel(userId, dayjs(modalDatum).add(2, 'day').format('YYYY-MM-DD'));

          return {
            name: `${profil?.nachname || 'Unbekannt'}, ${profil?.vorname || ''}`,
            vorher,
            heute: '-',
            nachher,
            vorvortag,
            folgetagplus
          };
        })
      );

      setFreieMitarbeiter(mitVortagNachtrag);
    };

    ladeDaten();
  }, [offen, modalDatum, modalSchicht, firma, unit]);

  // Bewertungs-Farbe nach Regelwerk
  const getBewertungsStufe = (f) => {
    const freiOderF = (v) => v === '-' || v === 'F';

    if (modalSchicht === 'F') {
      if ((f.vorher === '-' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
          (f.vorher === 'F' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F')) return 'grün';
      if (f.vorher === '-' && f.vorvortag === 'N') return 'gelb';
    }

    if (modalSchicht === 'N') {
      if ((f.vorher === 'N' && f.nachher === 'N') || (f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === '-')) return 'grün';
      if (f.nachher === '-' && f.folgetagplus === 'F') return 'gelb';
    }

    if (modalSchicht === 'S') {
      if ((f.vorher === '-' && f.vorvortag === 'N') || (f.vorher === '-' && f.nachher === '-')) return 'grün';
    }

    return null;
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 px-4 py-2 rounded-xl w-full max-w-4xl shadow-xl flex flex-col gap-2 relative animate-fade-in"
      >
        <div className="absolute top-3 right-4 flex gap-2 items-center">
        <button onClick={() => setInfoOffen(true)} title="Info">
          <Info size={20} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
        </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        <h2 className="text-xl font-semibold text-center">
          {modalSchicht}-Schicht am {dayjs(modalDatum).format('DD.MM.YYYY')}
        </h2>
<p>❌ Fehlende Qualifikationen: {fehlendeQualis.join(', ')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold mb-2">Mitarbeiter im Dienst</h3>
            <ul className="text-sm list-disc list-inside">
              {mitarbeiter.length > 0
                ? mitarbeiter.map((m, i) => <li key={i}>{m.nachname}, {m.vorname}</li>)
                : <li className="italic">Keine gefunden</li>}
            </ul>
          </div>

          <div>
            <div className="mb-2">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={kollidiertAktiv}
                  onChange={(e) => setKollidiertAktiv(e.target.checked)}
                  className="accent-red-500"
                />
                Kollidiert mit Dienst
              </label>
            </div>

            <table className="w-full text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left">
                  <th className="pl-2 text-left text-sm">Name</th>
                  <th className="px-0 text-[10px]">--</th>
                  <th className="px-0 text-center">-</th>
                  <th className="px-0 text-center text-[10px]">{dayjs(modalDatum).format('DD.MM.YYYY')}</th>
                  <th className="px-0 text-center">+</th>
                  <th className="px-0 text-[10px]">++</th>
                </tr>
              </thead>
              <tbody>
{freieMitarbeiter
  .filter(Boolean) // 🛡️ filtert alle `null`s raus!
  .sort((a, b) => {
    const gewicht = (f) => {
      const b = getBewertungsStufe(f);
      return b === 'grün' ? -3 : b === 'gelb' ? -2 : 0;
    };
    const gA = gewicht(a);
    const gB = gewicht(b);
    if (gA !== gB) return gA - gB;

    const schichtGewicht = (v) => {
      if (modalSchicht === 'F') return v.vorher === 'N' ? 2 : v.vorher === 'S' ? 1 : 0;
      if (modalSchicht === 'N') return v.nachher === 'F' ? 2 : v.nachher === 'S' ? 1 : 0;
      if (modalSchicht === 'S') return (v.vorher === 'N' || v.nachher === 'F') ? 1 : 0;
      return 0;
    };
    return schichtGewicht(a) - schichtGewicht(b);
  })
  .map((f, i) => {
    const bewertung = getBewertungsStufe(f);

    // ⛔ ROT-Kollision prüfen (jetzt mit Fall S)
    const istKollisionRot =
      (modalSchicht === 'F' && f.vorher === 'N') ||
      (modalSchicht === 'N' && f.nachher === 'F') ||
      (modalSchicht === 'S' && f.vorher === 'N' && f.nachher === 'F');

    // ❌ ausblenden, wenn ROT und Checkbox nicht aktiv
    if (!kollidiertAktiv && istKollisionRot) return null;

    // ✅ Hintergrundfarbe
    let rowStyle = '';
    if (bewertung === 'grün') rowStyle = 'bg-green-100 dark:bg-green-900/40';
    else if (bewertung === 'gelb') rowStyle = 'bg-yellow-100 dark:bg-yellow-900/40';
    else {
      if (modalSchicht === 'F') {
        if (f.vorher === 'S') rowStyle = 'bg-amber-100 dark:bg-amber-900/40';
        if (f.vorher === 'N') rowStyle = 'bg-red-100 dark:bg-red-900/40';
      } else if (modalSchicht === 'N') {
        if (f.nachher === 'S') rowStyle = 'bg-amber-100 dark:bg-amber-900/40';
        if (f.nachher === 'F') rowStyle = 'bg-red-100 dark:bg-red-900/40';
      } else if (modalSchicht === 'S') {
        if (f.vorher === 'N' || f.nachher === 'F') rowStyle = 'bg-amber-100 dark:bg-amber-900/40';
      }
    }

    return (
      <tr key={i} className={`text-center ${rowStyle}`}>
        <td className="pl-2 text-left">{f.name}</td>
        <td className="text-[10px] text-gray-500 px-1">{f.vorvortag}</td>
        <td className="text-xs px-2">{f.vorher}</td>
        <td className="text-md font-semibold px-2">
          <span className={
            f.heute === 'F' ? 'text-blue-500' :
            f.heute === 'S' ? 'text-amber-500' :
            f.heute === 'N' ? 'text-purple-500' :
            'text-gray-500'
          }>
            {f.heute}
          </span>
        </td>
        <td className="text-xs px-2">{f.nachher}</td>
        <td className="text-[10px] text-gray-500 px-1">{f.folgetagplus}</td>
      </tr>
    );
  })}

</tbody>
            </table>
          </div>
        </div>

        {infoOffen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center backdrop-blur-sm z-60" onClick={() => setInfoOffen(false)}>
<div
  onClick={(e) => e.stopPropagation()}
  className="relative bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full shadow-xl text-sm text-gray-800 dark:text-gray-100"
>

              <h3 className="text-lg font-semibold mb-2">Regeln zur Anzeige</h3>
<button
  onClick={() => setInfoOffen(false)}
  className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-2xl"
  aria-label="Schließen"
>
  &times;
</button>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="text-green-500 font-semibold">Grün:</span> Sehr gute Kombination (ausreichend Ruhezeiten, Vor- und Nachschichten ideal)</li>
                <li><span className="text-yellow-500 font-semibold">Gelb:</span> Gute Kombination (z. B. frei nach Nacht, frei vor Früh)</li>
                <li><span className="text-amber-500 font-semibold">amber:</span> Warnung, z. B. Schicht am Vortag</li>
                <li><span className="text-red-500 font-semibold">Rot:</span> Kollision, z. B. Nachtschicht direkt vor Frühschicht</li>
                <li>Sortierung: Grün → Gelb → amber → Rot</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BedarfsAnalyseModal;