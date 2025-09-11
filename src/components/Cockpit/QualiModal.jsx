import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { ShieldCheck, Info } from 'lucide-react';

const QualiModal = ({ offen, onClose, userId, userName }) => {
  const [qualis, setQualis] = useState([]);
  const [nurRelevant, setNurRelevant] = useState(false);

  useEffect(() => {
    const ladeQualifikationen = async () => {
      if (!userId) return;

      // 1) User-Qualis (mit Zuweisungszeitpunkt)
      const { data: zuweisungen, error: errorZuweisung } = await supabase
        .from('DB_Qualifikation')
        .select('quali, created_at')
        .eq('user_id', userId);

      if (errorZuweisung) {
        console.error('❌ Fehler beim Laden der User-Qualifikationen:', errorZuweisung);
        setQualis([]);
        return;
      }
      if (!zuweisungen?.length) {
        setQualis([]);
        return;
      }

      const qualiIds = zuweisungen.map((z) => z.quali);

      // 2) Matrix-Details (inkl. betriebs_relevant & Kürzel)
      const { data: matrix, error: errorMatrix } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation, beschreibung, position, quali_kuerzel, betriebs_relevant')
        .in('id', qualiIds);

      if (errorMatrix) {
        console.error('❌ Fehler beim Laden der Quali-Matrix:', errorMatrix);
        setQualis([]);
        return;
      }

      // 3) Mappen + sortieren: zuerst betriebsrelevant, dann Position
      const kombiniert = zuweisungen.map((z) => {
        const m = matrix.find((mm) => mm.id === z.quali);
        return m
          ? {
              id: m.id,
              qualifikation: m.qualifikation,
              quali_kuerzel: m.quali_kuerzel,
              position: m.position,
              betriebs_relevant: !!m.betriebs_relevant,
              created_at: z.created_at,
            }
          : null;
      }).filter(Boolean);

      kombiniert.sort((a, b) => {
        if (a.betriebs_relevant !== b.betriebs_relevant) return a.betriebs_relevant ? -1 : 1;
        const ap = a.position ?? 9999;
        const bp = b.position ?? 9999;
        return ap - bp;
      });

      setQualis(kombiniert);
    };

    if (offen) ladeQualifikationen();
  }, [offen, userId]);

  if (!offen) return null;

  const sichtbare = nurRelevant ? qualis.filter(q => q.betriebs_relevant) : qualis;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-left pl-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-200 dark:bg-gray-900 text-black dark:text-white border border-gray-700 p-4 rounded-xl max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-lg font-semibold">
            Qualifikationen von {userName}
          </h2>
          <label className="text-sm inline-flex items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={nurRelevant}
              onChange={(e) => setNurRelevant(e.target.checked)}
              className="accent-emerald-600"
            />
            Nur betriebsrelevant
          </label>
        </div>

        {sichtbare.length === 0 ? (
          <p className="text-sm italic text-gray-500">
            Keine Qualifikationen vorhanden
          </p>
        ) : (
          <ul className="space-y-2">
            {sichtbare.map((q) => {
              const isRel = q.betriebs_relevant;
              return (
                <li
                  key={q.id}
                  className={[
                    "rounded-lg border p-3 flex items-start gap-3",
                    isRel
                      ? "bg-gray-300 dark:bg-gray-500/30 border-gray-500 dark:border-gray-500 shadow-[inset_4px_0_0] shadow-gray-500"
                      : "bg-gray-300/40 dark:bg-gray-500/30 border-gray-400 dark:border-gray-700 shadow-[inset_4px_0_0] shadow-gray-400"
                  ].join(" ")}
                  title={q.beschreibung || ""}
                >
                  <div className="mt-0.5">
                    {isRel ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Info className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold">
                        {q.qualifikation || 'Unbekannt'}
                      </span>
                      {q.quali_kuerzel && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                          {q.quali_kuerzel}
                        </span>
                      )}
                      {isRel && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                          Betriebsrelevant
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      seit {dayjs(q.created_at).locale('de').format('MMMM YYYY')}
                      {typeof q.position === 'number' && (
                        <> • Priorität {q.position}</>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="text-right mt-6">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default QualiModal;
