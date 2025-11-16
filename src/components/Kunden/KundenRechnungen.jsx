import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';

const StatusBadge = ({ status }) => {
  const map = {
    offen: 'bg-yellow-500/80 text-black',
    bezahlt: 'bg-green-600/90 text-white',
    storniert: 'bg-red-700/80 text-white',
    entwurf: 'bg-gray-600 text-gray-50',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] ${
        map[status] || 'bg-gray-700 text-gray-50'
      }`}
    >
      {status || '—'}
    </span>
  );
};

const fmt = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

export default function KundenRechnungen() {
  const { sichtFirma } = useRollen();
  const [rechnungen, setRechnungen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [positionen, setPositionen] = useState([]);
  const [posLoading, setPosLoading] = useState(false);
  const [info, setInfo] = useState(null); // kleine Textmeldung

  // Rechnungen laden
  useEffect(() => {
    if (!sichtFirma) return;
    (async () => {
      setLoading(true);
      setInfo(null);
      try {
        const { data, error } = await supabase
          .from('DB_Rechnung')
          .select(
            'id, rechnungsnummer, created_at, periode_von, periode_bis, faellig_am, status, betrag_brutto'
          )
          .eq('firma_id', sichtFirma)
          .neq('status', 'entwurf')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Rechnungen laden:', error);
          setInfo('Fehler beim Laden der Rechnungen.');
        } else {
          setRechnungen(data || []);
          if ((data || []).length === 0) {
            setInfo('Noch keine sichtbaren Rechnungen vorhanden.');
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sichtFirma]);

  // Einzelrechnung laden
  const ladePositionen = async (rechnung) => {
    setSelected(rechnung);
    setPositionen([]);
    if (!rechnung) return;
    setPosLoading(true);
    try {
      const { data, error } = await supabase
        .from('DB_RechnungPosition')
        .select('id, beschreibung, menge, einheit, einzelpreis, gesamt_netto')
        .eq('rechnung_id', rechnung.id)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Rechnungspositionen laden:', error);
      } else {
        setPositionen(data || []);
      }
    } finally {
      setPosLoading(false);
    }
  };

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Rechnungen</h3>
      </div>

      {loading ? (
        <div className="text-gray-400">Lade Rechnungen…</div>
      ) : rechnungen.length === 0 ? (
        <div className="text-gray-400">{info || 'Keine Rechnungen gefunden.'}</div>
      ) : (
        <div className="overflow-x-auto mb-2">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-[11px] opacity-70 border-b border-gray-700">
                <th className="py-1 pr-2">Datum</th>
                <th className="py-1 pr-2">Rechnungsnr.</th>
                <th className="py-1 pr-2">Zeitraum</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2 text-right">Summe brutto</th>
              </tr>
            </thead>
            <tbody>
              {rechnungen.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800/60 ${
                    selected?.id === r.id ? 'bg-gray-800/80' : ''
                  }`}
                  onClick={() => ladePositionen(r)}
                >
                  <td className="py-1 pr-2">{fmt(r.created_at)}</td>
                  <td className="py-1 pr-2">{r.rechnungsnummer || '—'}</td>
                  <td className="py-1 pr-2">
                    {fmt(r.periode_von)} – {fmt(r.periode_bis)}
                  </td>
                  <td className="py-1 pr-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {(Number(r.betrag_brutto || 0)).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailansicht */}
      {selected && (
        <div className="mt-2 border-t border-gray-800 pt-2">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-xs uppercase opacity-70">Rechnung</div>
              <div className="text-sm font-semibold">
                {selected.rechnungsnummer || '—'}
              </div>
            </div>
            <div className="text-xs text-right">
              <div>
                Zeitraum: {fmt(selected.periode_von)} – {fmt(selected.periode_bis)}
              </div>
              <div>Fällig am: {fmt(selected.faellig_am)}</div>
            </div>
          </div>

          {posLoading ? (
            <div className="text-gray-400 text-sm">Lade Positionen…</div>
          ) : positionen.length === 0 ? (
            <div className="text-gray-400 text-sm">
              Keine Positionen gefunden (oder Entwurf).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left uppercase text-[11px] opacity-70 border-b border-gray-700">
                    <th className="py-1 pr-2 w-8">Pos</th>
                    <th className="py-1 pr-2">Beschreibung</th>
                    <th className="py-1 pr-2 text-right w-16">Menge</th>
                    <th className="py-1 pr-2 w-20">Einheit</th>
                    <th className="py-1 pr-2 text-right w-20">Einzel €</th>
                    <th className="py-1 pr-2 text-right w-24">Gesamt €</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map((p, idx) => (
                    <tr key={p.id || idx} className="border-b border-gray-800">
                      <td className="py-1 pr-2">{idx + 1}</td>
                      <td className="py-1 pr-2">{p.beschreibung}</td>
                      <td className="py-1 pr-2 text-right">{p.menge}</td>
                      <td className="py-1 pr-2">{p.einheit}</td>
                      <td className="py-1 pr-2 text-right">
                        {(Number(p.einzelpreis || 0)).toFixed(2)} €
                      </td>
                      <td className="py-1 pr-2 text-right">
                        {(Number(p.gesamt_netto || 0)).toFixed(2)} €
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
}
