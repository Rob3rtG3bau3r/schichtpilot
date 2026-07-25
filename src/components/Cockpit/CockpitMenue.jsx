// src/components/Cockpit/CockpitMenue.jsx
import React, { useEffect, useState } from 'react';
import { useRollen } from '../../context/RollenContext';
import { supabase } from '../../supabaseClient';
import { Users } from 'lucide-react';

const CockpitMenue = ({
  sollPlanAktiv,
  setSollPlanAktiv,
  sichtbareGruppen,
  setSichtbareGruppen,
  gruppenZähler,
  ansichtModus,     
  setAnsichtModus,
  wochenAnzahl,     
  setWochenAnzahl,
}) => {
  // 🔹 userId zusätzlich holen
  const { sichtUnit: unit, userId } = useRollen();
  const [schichtgruppen, setSchichtgruppen] = useState([]);
  const [settingsGeladen, setSettingsGeladen] = useState(false);


  // =========================
  // 1) Schichtgruppen laden
  // =========================
  useEffect(() => {
    const ladeSchichtgruppen = async () => {
      if (!unit) return;

      const { data, error } = await supabase
        .from('DB_Unit')
        .select(
          'schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6'
        )
        .eq('id', unit)
        .single();

      if (error) {
        console.error('Fehler beim Laden der Schichtgruppen:', error);
        return;
      }

      const gruppen = [
        data.schichtname1,
        data.schichtname2,
        data.schichtname3,
        data.schichtname4,
        data.schichtname5,
        data.schichtname6,
      ].filter(Boolean);

      setSchichtgruppen(gruppen);
      setSichtbareGruppen(gruppen); // alle aktiv setzen
    };

    ladeSchichtgruppen();
  }, [unit, setSichtbareGruppen]);

// =====================================
// 2) UserSettings beim Start einlesen
// =====================================
useEffect(() => {
  const ladeUserSettings = async () => {
    if (!userId) {
      setSettingsGeladen(true); // trotzdem freigeben
      return;
    }

    const { data, error } = await supabase
      .from('DB_UserSettings')
      .select('cockpit_view_mode, cockpit_week_count')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.warn(
        'UserSettings (Cockpit) nicht gefunden oder Fehler:',
        error.message || error
      );
      // auch bei Fehler: wir sind „fertig“ mit Laden
      setSettingsGeladen(true);
      return;
    }

    // optional: alte Werte "month" -> "monat" mappen
    let mode = data?.cockpit_view_mode;
    if (mode === 'month') mode = 'monat';

    if (mode === 'monat' || mode === 'woche') {
      setAnsichtModus(mode);
    }

    if (typeof data?.cockpit_week_count === 'number' && data.cockpit_week_count >= 1) {
      setWochenAnzahl(data.cockpit_week_count);
    }

    setSettingsGeladen(true);
  };

  ladeUserSettings();
}, [userId, setAnsichtModus, setWochenAnzahl]);

// =====================================
// 3) Änderungen zurück in DB schreiben
// =====================================
useEffect(() => {
  const speichereUserSettings = async () => {
    if (!userId) return;
    if (!ansichtModus) return;
    if (!settingsGeladen) return; // WICHTIG: erst speichern, wenn geladen

    const payload = {
      user_id: userId,
      cockpit_view_mode: ansichtModus,
      cockpit_week_count: wochenAnzahl ?? 1,
    };

    const { error } = await supabase
      .from('DB_UserSettings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.error(
        '❌ Fehler beim Speichern der Cockpit-UserSettings:',
        error.message || error
      );
    }
  };

  speichereUserSettings();
}, [userId, ansichtModus, wochenAnzahl, settingsGeladen]);

  const totalUserCount = Object.values(gruppenZähler || {}).reduce(
    (sum, val) => sum + val,
    0
  );

  const isMonatsAnsicht = ansichtModus === 'monat';
  const isWochenAnsicht = ansichtModus === 'woche';

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded-md mb-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Ansicht + Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs mr-1">Ansicht:</span>

          <button
            type="button"
            onClick={() => setAnsichtModus('monat')}
            className={`px-3 py-1 rounded-md border text-xs
              ${
                isMonatsAnsicht
                  ? 'bg-gray-300 dark:bg-gray-900 border-gray-400 text-gray-900 dark:text-gray-100'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-500 text-gray-800 dark:text-gray-200'
              }
            `}
          >
            Monatsansicht
          </button>

          <button
            type="button"
            onClick={() => setAnsichtModus('woche')}
            className={`px-3 py-1 rounded-md border text-xs
              ${
                isWochenAnsicht
                  ? 'bg-gray-300 dark:bg-gray-900 border-gray-400 text-gray-900 dark:text-gray-100'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-500 text-gray-800 dark:text-gray-200'
              }
            `}
          >
            Wochenansicht
          </button>
        </div>

        {/* Wochen-Menü (nur in Wochenansicht) */}
        {isWochenAnsicht && (
          <div className="flex flex-wrap items-center gap-2 ml-4">
            <div className="flex items-center gap-1 text-xs">
              <span>Zeitraum:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWochenAnzahl(w)}
                    className={`px-2 py-[3px] rounded-md border text-xs min-w-[28px] text-center
                      ${
                        wochenAnzahl === w
                          ? 'bg-blue-500 text-white border-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-800 dark:text-gray-200'
                      }
                    `}
                  >
                    {w} W
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full px-3 py-[3px]">
              <Users size={14} />
              <span>Aktive User:</span>
              <span className="font-semibold ml-1">{totalUserCount}</span>
            </div>
          </div>
        )}

        {/* Monats-Menü (nur in Monatsansicht) */}
        {isMonatsAnsicht && (
          <div className="flex flex-wrap items-center gap-2 ml-4">
            {/* Sollplan-Checkbox */}
            <div className="flex items-center mr-3">
              <input
                id="sollplan-toggle"
                type="checkbox"
                checked={sollPlanAktiv}
                onChange={(e) => setSollPlanAktiv(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="sollplan-toggle" className="text-xs md:text-sm">
                SollPlan anzeigen
              </label>
            </div>

            {/* Alle Schichten */}
            {Object.keys(gruppenZähler || {}).length > 0 && (
              <label
                className={`flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer border text-xs
                  ${
                    sichtbareGruppen.length === Object.keys(gruppenZähler).length
                      ? 'bg-gray-300 dark:bg-gray-900 border-gray-400 text-gray-900 dark:text-gray-100'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-800 dark:text-gray-200'
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={sichtbareGruppen.length === Object.keys(gruppenZähler).length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSichtbareGruppen(Object.keys(gruppenZähler));
                    } else {
                      setSichtbareGruppen([]);
                    }
                  }}
                  className="accent-gray-500"
                />
                <span>Alle Schichten</span>
                <span className="ml-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-2 py-[1px] flex items-center gap-1">
                  <Users size={12} />
                  {totalUserCount}
                </span>
              </label>
            )}

            {/* Einzelne Gruppen */}
            {Object.keys(gruppenZähler || {})
              .sort()
              .map((gruppe) => {
                const aktiv = sichtbareGruppen.includes(gruppe);
                const zaehler = gruppenZähler?.[gruppe] ?? 0;

                return (
                  <label
                    key={gruppe}
                    className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer border text-xs
                      ${
                        aktiv
                          ? 'bg-gray-300 dark:bg-gray-900 border-gray-400 text-gray-900 dark:text-gray-100'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-800 dark:text-gray-200'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={aktiv}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSichtbareGruppen((prev) => [...prev, gruppe]);
                        } else {
                          setSichtbareGruppen((prev) => prev.filter((g) => g !== gruppe));
                        }
                      }}
                      className="accent-gray-500"
                    />
                    <span>{gruppe}</span>
                    <span className="flex items-center gap-1 ml-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-2 py-[1px]">
                      <Users size={12} />
                      {zaehler}
                    </span>
                  </label>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CockpitMenue;
