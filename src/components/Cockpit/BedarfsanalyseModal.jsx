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

      // 1) Schichtarten: ID für gesuchte Schicht + Frei ("-")
      const [{ data: schichtArt }, { data: freiArt }] = await Promise.all([
        supabase
          .from('DB_SchichtArt')
          .select('id')
          .eq('kuerzel', modalSchicht)
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .maybeSingle(),
        supabase
          .from('DB_SchichtArt')
          .select('id')
          .eq('kuerzel', '-')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .maybeSingle(),
      ]);

      if (!schichtArt?.id || !freiArt?.id) return;

      // 2) Kampfliste: User im Dienst & freie User am Tag (einmalig)
      const [{ data: rowsDienst }, { data: rowsFrei }] = await Promise.all([
        supabase
          .from('DB_Kampfliste')
          .select('user')
          .eq('datum', modalDatum)
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('ist_schicht', schichtArt.id),
        supabase
          .from('DB_Kampfliste')
          .select('user')
          .eq('datum', modalDatum)
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('ist_schicht', freiArt.id),
      ]);

      const dienstUserIds = (rowsDienst || []).map((r) => r.user);
      const freiUserIds = (rowsFrei || []).map((r) => r.user);
      const alleIds = Array.from(new Set([...dienstUserIds, ...freiUserIds]));

      // 3) User: Namen + Sichtbarkeit für alle
      let userVisibleMap = {};
      let userNameMap = {};
      if (alleIds.length) {
        const { data: userRows } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname, user_visible')
          .in('user_id', alleIds);

        (userRows || []).forEach((u) => {
          userVisibleMap[u.user_id] = (u.user_visible ?? true);
          userNameMap[u.user_id] = {
            vorname: u.vorname || '',
            nachname: u.nachname || '',
            voll: `${u.nachname || 'Unbekannt'}, ${u.vorname || ''}`.trim(),
          };
        });
      }

      // Mitarbeiter im Dienst (unsichtbare ausschließen)
      const imDienst = dienstUserIds
        .filter((uid) => userVisibleMap[uid] !== false)
        .map((uid) => ({
          vorname: userNameMap[uid]?.vorname || '',
          nachname: userNameMap[uid]?.nachname || '',
        }));
      setMitarbeiter(imDienst);

      // Sichtbare "freie" User-IDs
      const sichtbareFrei = freiUserIds.filter((uid) => userVisibleMap[uid] !== false);
      if (sichtbareFrei.length === 0) {
        setFreieMitarbeiter([]);
        return;
      }

      // 4) Matrix: id -> quali_kuerzel (einmalig)
      const { data: matrixRows } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, quali_kuerzel');
      const matrixMap = {};
      (matrixRows || []).forEach((m) => {
        matrixMap[m.id] = m.quali_kuerzel || null;
      });

      // 5) Qualifikationen der freien sichtbaren User (einmalig)
      const { data: qualRows } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali, created_at')
        .in('user_id', sichtbareFrei);

      const tag = dayjs(modalDatum);

      // Map userId -> Set<Kürzel> (nur gültige Qualis am Tag)
      const userKuerzelSet = new Map();
      (qualRows || []).forEach((q) => {
        const kuerzel = matrixMap[q.quali];
        if (!kuerzel) return;
        const ab = q.created_at ? dayjs(q.created_at) : null;
        if (ab && tag.isBefore(ab, 'day')) return; // noch nicht gültig
        if (!userKuerzelSet.has(q.user_id)) userKuerzelSet.set(q.user_id, new Set());
        userKuerzelSet.get(q.user_id).add(kuerzel);
      });

      // Optional: nur Kandidaten, die mind. eine fehlende Quali haben
      const kandidaten = fehlendeQualis.length
        ? sichtbareFrei.filter((uid) => {
            const set = userKuerzelSet.get(uid);
            if (!set) return false;
            return fehlendeQualis.some((k) => set.has(k));
          })
        : sichtbareFrei;

      if (kandidaten.length === 0) {
        setFreieMitarbeiter([]);
        return;
      }

      // 6) Kampfliste für alle Kandidaten gebündelt für T-2..T+2 (1 Query)
      const dates = [
        dayjs(modalDatum).subtract(2, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).subtract(1, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).format('YYYY-MM-DD'),
        dayjs(modalDatum).add(1, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).add(2, 'day').format('YYYY-MM-DD'),
      ];

      const { data: umfeldRows } = await supabase
        .from('DB_Kampfliste')
        .select('user, datum, ist_schicht(kuerzel)')
        .in('user', kandidaten)
        .in('datum', dates);

      // Map userId -> {date -> kuerzel}
      const umfeldMap = new Map();
      (umfeldRows || []).forEach((r) => {
        const u = r.user;
        const d = r.datum;
        const k = r?.ist_schicht?.kuerzel || '-';
        if (!umfeldMap.has(u)) umfeldMap.set(u, {});
        umfeldMap.get(u)[d] = k;
      });

      // Ergebniszeilen für freie Mitarbeiter
      const freieZeilen = kandidaten.map((uid) => {
        const profil = userNameMap[uid] || { voll: 'Unbekannt, ' };
        const m = umfeldMap.get(uid) || {};
        return {
          name: profil.voll,
          vorvortag: m[dates[0]] || '-',
          vorher: m[dates[1]] || '-',
          heute: m[dates[2]] || '-',
          nachher: m[dates[3]] || '-',
          folgetagplus: m[dates[4]] || '-',
        };
      });

      setFreieMitarbeiter(freieZeilen);
    };

    ladeDaten();
  }, [offen, modalDatum, modalSchicht, firma, unit, fehlendeQualis]);

  // ===== Bewertungs-Logik =====
  const getBewertungsStufe = (f) => {
    const frei = (v) => v === '-';
    const freiOderF = (v) => v === '-' || v === 'F';
    const nichtFrei = (v) => v !== '-';

    // FRÜH
    if (modalSchicht === 'F') {
      // Rot (harte Kollisionen / No-Gos)
      if (f.nachher === 'U' || f.vorvortag === 'U' || f.vorher === 'N' || f.vorher === 'U') return 'rot';

      // Grün (beste Kombinationen)
      if (
        (f.vorher === '-' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
        (f.vorher === 'F' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
        // NEU (deine F-Regeln)
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === 'S' && f.folgetagplus === '-') ||
        (f.vorvortag === 'K' && f.vorher === 'K' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'S' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F')
      ) return 'grün';

      // Gelb
      if (f.vorher === '-' && f.vorvortag === 'N') return 'gelb';
      // NEU (deine F-Regeln)
      if (
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'U') ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'S' && f.folgetagplus === 'F')
      ) return 'gelb';

      // Amber
      if (f.vorher === 'S') return 'amber';
      // NEU (deine F-Regeln)
      if (nichtFrei(f.vorvortag) && nichtFrei(f.vorher) && f.nachher === 'F' && f.folgetagplus === 'F') return 'amber';
    }

    // NACHT
    if (modalSchicht === 'N') {
      // Rot (harte No-Gos)
      if (f.vorher === 'U') return 'rot';
      if (['KO', 'K', 'U', 'F'].includes(f.nachher)) return 'rot';
      // N – NEUE REGELN (Rot)
      if (
        (f.vorvortag === 'N' && f.vorher === 'N' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === '-' && f.vorher === '-' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === 'N' && f.vorher === '-' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === 'N' && f.vorher === '-' && nichtFrei(f.nachher) && frei(f.folgetagplus)) // Regel: N,- | nicht- | -
      ) return 'rot';

      // Grün (Top-Kombis)
      if (
        (f.vorher === 'N' && f.nachher === 'N') ||
        (f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === '-') ||
        // N – NEUE REGELN (Grün)
        (f.vorvortag === 'N' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === '-')
      ) return 'grün';

      // Amber
      if (
        f.nachher === 'S' || // bestehend
        // N – NEUE REGELN (Amber)
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'U') ||
        (f.vorvortag === 'U' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === '-')
      ) return 'amber';

      // Gelb
      if (
        (f.nachher === '-' && f.folgetagplus === 'F') || // bestehend
        // N – NEUE REGELN (Gelb)
        (f.vorvortag === 'N' && f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === 'K' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && f.nachher === '-' && nichtFrei(f.folgetagplus))
      ) return 'gelb';
    }

    // SPÄT
    if (modalSchicht === 'S') {
      // Rot
      if (f.vorher === 'U') return 'rot';

      // Amber (bestehende + NEU)
      if (
        // bestehende Amber-Fälle
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === '-') ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === '-' && f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === '-') ||
        (f.vorvortag === '-' && f.vorher === 'N' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === '-') ||
        // S – NEUE REGELN (Amber)
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'U' && f.folgetagplus === 'U') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === 'S' && f.vorher === 'S' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === '-' && nichtFrei(f.vorher) && f.nachher === 'F' && f.folgetagplus === 'F')
      ) return 'amber';

      // Gelb (bestehende + NEU)
      if (
        (f.vorher === '-' && f.vorvortag === 'U') ||
        // S – NEUE REGELN (Gelb)
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'U' && f.folgetagplus === 'F') ||
        (f.nachher === '-' && f.folgetagplus === 'F')
      ) return 'gelb';

      // Grün (bestehende + NEU)
      if (
        (f.vorher === '-' && f.vorvortag === 'N') ||
        (f.vorher === '-' && f.nachher === '-') ||
        // S – NEUE REGELN (Grün)
        (f.vorvortag === 'F' && f.vorher === 'F' && f.nachher === 'S' && f.folgetagplus === 'N')
      ) return 'grün';
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
        <p>❌ Fehlende Qualifikationen: {fehlendeQualis.length ? fehlendeQualis.join(', ') : '—'}</p>

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
                  .filter(Boolean)
                  .sort((a, b) => {
                    const gewicht = (f) => {
                      const st = getBewertungsStufe(f);
                      return st === 'grün' ? -3 : st === 'gelb' ? -2 : st === 'amber' ? -1 : 0;
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

                    const istKollisionRot = bewertung === 'rot';
                    if (!kollidiertAktiv && istKollisionRot) return null;

                    let rowStyle = '';
                    if (bewertung === 'grün') rowStyle = 'bg-green-100 dark:bg-green-900/40';
                    else if (bewertung === 'gelb') rowStyle = 'bg-yellow-100 dark:bg-yellow-900/40';
                    else if (bewertung === 'amber') rowStyle = 'bg-amber-100 dark:bg-amber-900/40 text-red-500 dark:text-red-500';
                    else if (bewertung === 'rot') rowStyle = 'bg-red-100 dark:bg-red-900/40';

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
                <li><span className="bg-green-500">Grün:</span> Sehr gute Kombination</li>
                <li><span className="bg-yellow-500 ">Gelb:</span> Gute Kombination</li>
                <li><span className="bg-amber-500 text-red-500"> Amber & Rote Schrift:</span> Arbeitszeitverstoß</li>
                <li><span className="bg-red-500 ">Rot:</span> Kollision</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BedarfsAnalyseModal;

