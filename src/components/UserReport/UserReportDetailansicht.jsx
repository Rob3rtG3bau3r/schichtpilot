// src/components/UserReport/UserReportDetailansicht.jsx
import React from 'react';

const fmt = (v, digits = 2) =>
  v == null ? '—' : Number(v).toFixed(digits).replace('.', ',');

const MONATE = [
  null,
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

const StatLine = ({ label, value }) => (
  <div className="flex items-center justify-between text-[11px] text-gray-800 dark:text-gray-200">
    <span>{label}</span>
    <span className="font-medium">{fmt(value)}</span>
  </div>
);

const FsnRow = ({ label, c, h, cf, hf }) => (
  <tr>
    <td className="py-0.5">{label}</td>
    <td className="py-0.5 text-right">{c || 0}</td>
    <td className="py-0.5 text-right">{fmt(h)}</td>
    <td className="py-0.5 text-right">{cf || 0}</td>
    <td className="py-0.5 text-right">{fmt(hf)}</td>
  </tr>
);

const UserReportDetailansicht = ({
  selectedUser,
  modus,
  effStartMonth,
  effEndMonth,
  isFullYear,
}) => {
  const krankK = selectedUser?.krankK || 0;
  const krankKO = selectedUser?.krankKO || 0;
  const krankGesamt = krankK + krankKO;

  const stundenMonate = selectedUser?.stundenMonate || {};
  const urlaubMonate = selectedUser?.urlaubMonate || {};

  const stundenSummeJahr = selectedUser?.stundenSummeJahr || 0;
  const stundenGesamt = selectedUser?.stundenGesamt || 0;
  const stundenUebernahme = selectedUser?.stundenUebernahme || 0;

  const urlaubSummeJahr = selectedUser?.urlaubSummeJahr || 0;
  const urlaubGesamt = selectedUser?.urlaubGesamt || 0;
  const urlaubUebernahme = selectedUser?.urlaubUebernahme || 0;

  const istStundenJahr = stundenSummeJahr + stundenUebernahme;
  const restStundenJahresende = stundenGesamt - stundenSummeJahr - stundenUebernahme;
  const diffStunden = istStundenJahr - stundenGesamt;

  const urlaubUebrig = urlaubGesamt + urlaubUebernahme - urlaubSummeJahr;

  const diffClass = (v) => {
  if (v > 0)
    return "text-emerald-600 dark:text-emerald-300 bg-emerald-300/50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700";
  if (v < 0)
    return "text-red-800 dark:text-red-200 bg-red-500/40 dark:bg-red-900/40 border border-red-500 dark:border-red-700";
  return "text-gray-800 dark:text-gray-400 bg-gray-300 dark:bg-gray-800 border border-gray-400 dark:border-gray-600";
};

const urlaubDiffClass = (v) => {
  if (v > 0)
    return "text-emerald-600 dark:text-emerald-300 bg-emerald-300/50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700";
  if (v < 0)
    return "text-red-800 dark:text-red-200 bg-red-500/40 dark:bg-red-900/40 border border-red-500 dark:border-red-700";
  return "text-gray-800 dark:text-gray-400 bg-gray-300 dark:bg-gray-800 border border-gray-400 dark:border-gray-600";
};

  // Monate, die im aktuellen Modus relevant sind
  const monthsInRange = [];
  if (effStartMonth && effEndMonth) {
    for (let m = effStartMonth; m <= effEndMonth; m++) {
      monthsInRange.push(m);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl flex flex-col">
      <div className="px-4 py-2 border-b border-gray-400 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Detailansicht
        </h2>
      </div>

      {!selectedUser ? (
        <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
          Bitte in der Tabelle links einen Mitarbeiter auswählen.
        </div>
      ) : (
        <div className="p-4 space-y-3 text-[11px]">
          {/* Kopfbereich */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {`${selectedUser.nachname || ''} ${
                selectedUser.vorname || ''
              }`.trim() || 'Mitarbeiter'}
            </p>
            <p className="text-[11px] text-gray-800 dark:text-gray-400">
              Schichtgruppe:{' '}
              <span className="font-medium">
                {selectedUser.schichtgruppe || '—'}
              </span>
            </p>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              Planerfüllung:{' '}
              {selectedUser.planQuote == null
                ? '—'
                : `${fmt(selectedUser.planQuote, 1)} % (${
                    selectedUser.planTageGesamt
                  } Tage, ${selectedUser.planTageFehler} Abweichungen)`}
            </p>
          </div>
     {/* Kurzfristige Einträge */}
          <div className="border rounded-xl bg-red-600/20 dark:bg-red-600/10 border-gray-400 dark:border-gray-700 p-2 space-y-1">
            <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
              Kurzfristige Einträge 'Jahresplanung ausgeschlossen'
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <StatLine label="< 1 Tag" value={selectedUser.kLt1} />
              <StatLine label="1–3 Tage" value={selectedUser.k1_3} />
              <StatLine label="4–6 Tage" value={selectedUser.k4_6} />
              <StatLine label="≥ 7 Tage" value={selectedUser.kGte7} />
            </div>
          </div>
{/* 🔹 Krank-Block */}
<div className="border rounded-xl border-gray-400 dark:border-gray-700 p-2 space-y-1">
  <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
    Kranktage (K / KO)
  </p>

  <div className="space-y-1">
    {/* Einzelwerte */}
    <StatLine label="K (mit Attest)" value={krankK} />
    <StatLine label="KO (ohne Attest)" value={krankKO} />

    {/* Trennlinie */}
    <div className="border-t border-gray-400 dark:border-gray-700 my-1" />

    {/* Gesamt – neutral hervorgehoben */}
    <div className="flex items-center justify-between text-[11px] font-semibold">
      <span>Krank gesamt</span>
      <span className="px-2 py-0.5 rounded-full bg-gray-300 dark:bg-gray-800 border border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-200">
        {fmt(krankGesamt)}
      </span>
    </div>
  </div>
</div>

    {/* Stunden Block */}
<div className="border rounded-xl border-gray-400 dark:border-gray-700 p-2 space-y-2">
  <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
    Stunden
  </p>

  {modus === 'jahr' && isFullYear ? (
    <div className="space-y-1">
      <StatLine label="Stunden im Jahr" value={stundenSummeJahr} />
      <StatLine label="Stunden aus Vorjahr" value={stundenUebernahme} />

      {/* Trennlinie */}
      <div className="border-t border-gray-400 dark:border-gray-700 my-1" />

      <StatLine label="Ist-Stunden (Jahr)" value={istStundenJahr} />
      <StatLine label="Vorgabe Jahresstunden" value={stundenGesamt} />

      {/* Zweite Trennlinie */}
      <div className="border-t border-gray-400 dark:border-gray-700 my-1" />

      {/* Ergebnis: Differenz */}
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span>Stunden Jahresende (Differenz)</span>
        <span className={`px-2 py-0.5 rounded-full ${diffClass(diffStunden)}`}>
          {fmt(diffStunden)}
        </span>
      </div>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="text-left font-medium pb-1">Monat</th>
            <th className="text-right font-medium pb-1">Ist-Stunden</th>
          </tr>
        </thead>
        <tbody>
          {monthsInRange.map((m) => (
            <tr key={m}>
              <td className="py-0.5">{MONATE[m]}</td>
              <td className="py-0.5 text-right">{fmt(stundenMonate[m])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

{/* Urlaub Block */}
<div className="border rounded-xl border-gray-400 dark:border-gray-700 p-2 space-y-2">
  <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
    Urlaub
  </p>

  {modus === 'jahr' && isFullYear ? (
    <div className="space-y-1">

      <StatLine label="Urlaub (Jahr)" value={urlaubSummeJahr} />
      <StatLine label="Vorgabe Jahresurlaub" value={urlaubGesamt} />
      <StatLine label="Urlaub aus Vorjahr" value={urlaubUebernahme} />

      {/* Linie vor dem Ergebnis */}
      <div className="border-t border-gray-400 dark:border-gray-700 my-1" />

      {/* Hervorgehobenes Ergebnis: Urlaub übrig (inkl. Vorjahr) */}
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span>Urlaub übrig (inkl. Vorjahr)</span>
        <span className={`px-2 py-0.5 rounded-full ${urlaubDiffClass(urlaubUebrig)}`}>
          {fmt(urlaubUebrig)}
        </span>
      </div>

    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="text-left font-medium pb-1">Monat</th>
            <th className="text-right font-medium pb-1">Ist-Urlaubstage</th>
          </tr>
        </thead>
        <tbody>
          {monthsInRange.map((m) => (
            <tr key={m}>
              <td className="py-0.5">{MONATE[m]}</td>
              <td className="py-0.5 text-right">{fmt(urlaubMonate[m])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

          {/* Wochenend- & Feiertagsstunden */}
          <div className="border rounded-xl border-gray-400 dark:border-gray-700 p-2 space-y-1">
            <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
              Wochenend- & Feiertagsstunden
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <StatLine
                label="Samstag (gesamt)"
                value={selectedUser.sumSamstag}
              />
              <StatLine
                label="Samstag (auf frei)"
                value={selectedUser.sumSamstagFrei}
              />
              <StatLine
                label="Sonntag (gesamt)"
                value={selectedUser.sumSonntag}
              />
              <StatLine
                label="Sonntag (auf frei)"
                value={selectedUser.sumSonntagFrei}
              />
              <StatLine
                label="Feiertag (gesamt)"
                value={selectedUser.sumFeiertag}
              />
              <StatLine
                label="Feiertag (auf frei)"
                value={selectedUser.sumFeiertagFrei}
              />
            </div>
          </div>

          {/* F / S / N */}
          <div className="border rounded-xl border-gray-400 dark:border-gray-700 p-2 space-y-1">
            <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
              F / S / N – Tage &amp; Stunden
            </p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400">
                  <th className="text-left font-medium pb-1">Schicht</th>
                  <th className="text-right font-medium pb-1">Tage</th>
                  <th className="text-right font-medium pb-1">Stunden</th>
                  <th className="text-right font-medium pb-1">
                    Tage (auf frei)
                  </th>
                  <th className="text-right font-medium pb-1">
                    Std (auf frei)
                  </th>
                </tr>
              </thead>
              <tbody>
                <FsnRow
                  label="Früh (F)"
                  c={selectedUser.cF}
                  h={selectedUser.hF}
                  cf={selectedUser.cFfrei}
                  hf={selectedUser.hFfrei}
                />
                <FsnRow
                  label="Spät (S)"
                  c={selectedUser.cS}
                  h={selectedUser.hS}
                  cf={selectedUser.cSfrei}
                  hf={selectedUser.hSfrei}
                />
                <FsnRow
                  label="Nacht (N)"
                  c={selectedUser.cN}
                  h={selectedUser.hN}
                  cf={selectedUser.cNfrei}
                  hf={selectedUser.hNfrei}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserReportDetailansicht;
