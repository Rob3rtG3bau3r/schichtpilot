// src/components/Dashboard/BAM_VerfuegbareMitarbeiter.jsx
import React from 'react';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';

export default function BAM_VerfuegbareMitarbeiter({
  modalDatum,
  modalSchicht,

  kollidiertAktiv,
  setKollidiertAktiv,

  freieMitarbeiter,
  getBewertungsStufe,
  flagsSummary,
  notizByUser,

  onPickUser, // (row) => void  row enthält uid,name,tel1,tel2 ...
}) {
  return (
    <div>
      {/* Kollidiert */}
      <div className="mt-2">
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

      <h2 className="mt-2 px- py-1 bg-gray-900/50"> Verfügbare Mitarbeiter </h2>

      <table className="w-full text-sm border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left">
            <th className="pl-2 text-left text-sm">Name</th>
            <th className="px-0 text-[10px]">---</th>
            <th className="px-0 text-[10px]">--</th>
            <th className="px-0 text-center">-</th>
            <th className="px-0 text-center text-[10px]">{dayjs(modalDatum).format('DD.MM.YYYY')}</th>
            <th className="px-0 text-center">+</th>
            <th className="px-0 text-[10px]">++</th>
            <th className="px-0 text-[10px]">+++</th>
          </tr>
        </thead>

        <tbody>
          {(freieMitarbeiter || [])
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
            .map((f) => {
              const bewertung = getBewertungsStufe(f);
              const istKollisionRot = bewertung === 'rot';
              if (!kollidiertAktiv && istKollisionRot) return null;

              let rowStyle = '';
              if (bewertung === 'grün') rowStyle = 'bg-green-100 dark:bg-green-900/40';
              else if (bewertung === 'gelb') rowStyle = 'bg-yellow-100 dark:bg-yellow-900/40';
              else if (bewertung === 'amber') rowStyle = 'bg-amber-100 dark:bg-amber-900/40 text-red-500 dark:text-red-500';
              else if (bewertung === 'rot') rowStyle = 'bg-red-100 dark:bg-red-900/40';

              const n = notizByUser.get(String(f.uid));
              const opt = flagsSummary(n);

              const tooltip =
                `${f.name}\n` +
                `Tel1: ${f.tel1 || '—'}\n` +
                `Tel2: ${f.tel2 || '—'}\n` +
                (opt ? `Optionen: ${opt}\n` : '') +
                (n ? `Notiz heute: ${n.notiz || '—'}` : '');

              const hasAny =
                !!n &&
                (
                  (n.notiz && String(n.notiz).trim().length > 0) ||
                  n.kann_heute_nicht ||
                  n.kann_keine_frueh ||
                  n.kann_keine_spaet ||
                  n.kann_keine_nacht ||
                  n.kann_nur_frueh ||
                  n.kann_nur_spaet ||
                  n.kann_nur_nacht 
                );

              return (
                <tr key={String(f.uid)} className={`text-center ${rowStyle}`}>
                  <td className="pl-2 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline text-left"
                      title={tooltip}
                      onClick={() => onPickUser(f)}
                    >
                      <span>{f.name}</span>

                      {hasAny ? (
                        <Info
                          size={14}
                          className={n?.kann_heute_nicht ? "text-red-600 opacity-90" : "text-blue-500 opacity-80"}
                          title={opt ? `Gesprächsnotiz: ${opt}` : "Gesprächsnotiz vorhanden"}
                        />
                      ) : null}
                    </button>
                  </td>

                  <td className="text-[10px] text-gray-500 px-1">{f.vor3}</td>
                  <td className="text-[10px] text-gray-500 px-1">{f.vor2}</td>
                  <td className="text-xs px-2">{f.vor1}</td>
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
                  <td className="text-xs px-2">{f.nach1}</td>
                  <td className="text-[10px] text-gray-500 px-1">{f.nach2}</td>
                  <td className="text-[10px] text-gray-500 px-1">{f.nach3}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
