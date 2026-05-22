import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const TYP_LABELS = {
  RUHEZEIT_UNTERSCHRITTEN: 'Ruhezeit unterschritten',
  ARBEITSZEIT_UEBER_10H: 'Arbeitszeit über 10 h',
  ARBEITSZEIT_UEBER_12H: 'Arbeitszeit ab 12 h',
};

const typLabel = (typ) => TYP_LABELS[typ] || String(typ || '-').replaceAll('_', ' ');

const MitarbeiterEskalation = () => {
  const { rolle, userId, sichtFirma: firma, sichtUnit: unit } = useRollen();

  const darfSehen = useMemo(
    () => rolle === 'Employee' || rolle === 'Team_Leader',
    [rolle]
  );

  const [offen, setOffen] = useState(true);
  const [rows, setRows] = useState([]);
  const [namenMap, setNamenMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ladeEskalationen = async () => {
    if (!darfSehen || !userId) return;

    if (rolle === 'Team_Leader' && (!firma || !unit)) return;

    setLoading(true);
    setError('');

    try {
      const von = dayjs().subtract(3, 'day').format('YYYY-MM-DD');

      let query = supabase
        .from('DB_Eskalation')
        .select(`
          id,
          datum,
          typ,
          status,
          hinweis,
          kommentar,
          user_id,
          created_at
        `)
        .eq('status', 'offen')
        .gte('datum', von)
        .order('datum', { ascending: true })
        .order('created_at', { ascending: false });

      if (rolle === 'Employee') {
        query = query.eq('user_id', userId);
      }

      if (rolle === 'Team_Leader') {
        query = query
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit));
      }

      const { data, error: eskErr } = await query;
      if (eskErr) throw eskErr;

      const eskRows = data || [];
      setRows(eskRows);

      const userIds = Array.from(
        new Set(eskRows.map((r) => String(r.user_id)).filter(Boolean))
      );

      const neueMap = new Map();

      if (userIds.length) {
        const { data: userRows, error: userErr } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname')
          .in('user_id', userIds);

        if (userErr) throw userErr;

        (userRows || []).forEach((u) => {
          neueMap.set(
            String(u.user_id),
            `${u.nachname || ''}, ${u.vorname || ''}`.trim()
          );
        });
      }

      setNamenMap(neueMap);
    } catch (e) {
      console.error('MitarbeiterEskalation laden fehlgeschlagen:', e);
      setError(e.message || 'Fehler beim Laden der Eskalationen.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ladeEskalationen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darfSehen, rolle, userId, firma, unit]);

    if (!darfSehen) return null;
    if (!loading && !error && rows.length === 0) return null;

  const titel =
    rolle === 'Team_Leader'
      ? 'Eskalationen im Team'
      : 'Meine Eskalationen';

  return (
    <div className="rounded-2xl shadow-xl border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2"
      >
        <div className="flex items-center gap-2">
          {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <AlertTriangle size={18} className={rows.length ? 'text-red-500' : 'text-gray-400'} />
          <span className="font-semibold">{titel}</span>
          <span className="text-xs opacity-70">heute -3 Tage bis Zukunft</span>
        </div>

        <span
          className={[
            'text-xs px-2 py-0.5 rounded-full',
            rows.length
              ? 'bg-red-600 text-white'
              : 'bg-gray-400/30 text-gray-700 dark:text-gray-200',
          ].join(' ')}
        >
          {rows.length}
        </span>
      </button>

      {offen && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="text-sm opacity-70">Lade Eskalationen…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-400 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm opacity-70">
              Keine offenen Eskalationen im Zeitraum.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left uppercase text-xs opacity-70 border-b border-gray-300 dark:border-gray-700">
                    <th className="py-2 pr-3">Datum</th>
                    {rolle === 'Team_Leader' && <th className="py-2 pr-3">Mitarbeiter</th>}
                    <th className="py-2 pr-3">Typ</th>
                    <th className="py-2 pr-3">Hinweis</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-gray-300/60 dark:border-gray-700/70 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap font-medium">
                        {dayjs(e.datum).format('DD.MM.YYYY')}
                      </td>

                      {rolle === 'Team_Leader' && (
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {namenMap.get(String(e.user_id)) || `User ${e.user_id}`}
                        </td>
                      )}

                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full bg-red-600/10 border border-red-400/30 text-red-700 dark:text-red-200 text-xs">
                          {typLabel(e.typ)}
                        </span>
                      </td>

                      <td className="py-2 pr-3 min-w-[260px]">
                        <div>{e.hinweis || '-'}</div>
                        {e.kommentar && (
                          <div className="mt-1 text-xs opacity-70 italic">
                            Kommentar: {e.kommentar}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MitarbeiterEskalation;