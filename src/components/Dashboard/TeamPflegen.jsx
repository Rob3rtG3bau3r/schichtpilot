// TeamPflegen.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useRollen } from "../../context/RollenContext";
import { ChevronDown, ChevronRight, Info, BarChart2, Pencil } from "lucide-react";
import StatistikModal from "./StatistikModal";
import PflegenModal from "./PflegenModal";
import dayjs from "dayjs";

const TeamPflegen = () => {
  const { rolle, sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  if (rolle === "Employee" || rolle === "Employer") {
    return <div className="text-center text-gray-500">Kein Zugriff auf diese Seite.</div>;
  }

  const [offen, setOffen] = useState(false);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [teams, setTeams] = useState([]);
  const [aktiveTeams, setAktiveTeams] = useState([]);
  const [statistikUser, setStatistikUser] = useState(null);
  const [pflegeUser, setPflegeUser] = useState(null);
  const [infoOffen, setInfoOffen] = useState(false);
  const [loading, setLoading] = useState(false);

  const heute = dayjs().format("YYYY-MM-DD");
  const aktuellesJahr = new Date().getFullYear();

  // Merker: Vorauswahl nur beim ersten vollständigen Laden setzen
  const firstLoadRef = useRef(true);

  // --------- Hilfsfunktionen für Sortierung ---------
  // Extrahiert die erste Zahl in einem String (z. B. "Team 12" -> 12). Gibt null zurück, wenn keine Zahl vorhanden.
  const firstNumber = (s) => {
    if (!s) return null;
    const m = String(s).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };

  // Extrahiert den ersten Buchstaben A-Z (äöü werden via localeCompare korrekt einsortiert)
  const firstLetter = (s) => {
    if (!s) return "";
    const m = String(s).match(/[A-Za-zÄÖÜäöü]/);
    return m ? m[0].toUpperCase() : "";
  };

  // Universelle Team-Sortierung:
  // 1) Wenn beide einen Zahlentreffer haben: nach Zahl (natürliche Sortierung)
  // 2) Sonst nach erstem Buchstaben (A, B, C …)
  // 3) Fallback: voller Stringvergleich (de)
  const sortTeams = (arr) => {
    return [...arr].sort((a, b) => {
      const na = firstNumber(a);
      const nb = firstNumber(b);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1; // Zahlen vor reinen Buchstaben
      if (nb !== null) return 1;

      const la = firstLetter(a);
      const lb = firstLetter(b);
      if (la && lb && la !== lb) return la.localeCompare(lb, "de", { sensitivity: "base" });

      return String(a).localeCompare(String(b), "de", { sensitivity: "base", numeric: true });
    });
  };
  // ---------------------------------------------------

  const ladeTeamdaten = async () => {
    setLoading(true);
    try {
      const { data: users, error: userError } = await supabase
        .from("DB_User")
        .select("user_id, vorname, nachname, position_ingruppe")
        .eq("firma_id", firma)
        .eq("unit_id", unit)
        .eq("user_visible", true);

      if (userError) throw userError;

      const { data: kampfData, error: kampfError } = await supabase
        .from("DB_Kampfliste")
        .select("user, schichtgruppe")
        .eq("firma_id", firma)
        .eq("unit_id", unit)
        .eq("datum", heute);

      if (kampfError) throw kampfError;

      // Teams deduplizieren, Leere entfernen, robust sortieren
      const uniqueTeamsRaw = [...new Set(kampfData.map((k) => (k?.schichtgruppe ?? "").toString().trim()))].filter(Boolean);
      const uniqueTeamsSorted = sortTeams(uniqueTeamsRaw);
      setTeams(uniqueTeamsSorted);

      // Map: user -> tagesaktuelle schichtgruppe
      const gruppenMap = kampfData.reduce((acc, k) => {
        acc[k.user] = (k?.schichtgruppe ?? "—").toString();
        return acc;
      }, {});

      const eigeneGruppe = gruppenMap[userId];

      // Vorauswahl nur beim ersten Laden ODER wenn aktuelle Auswahl leer ist.
      setAktiveTeams((prev) => {
        if (firstLoadRef.current || prev.length === 0) {
          firstLoadRef.current = false;
          if (eigeneGruppe && uniqueTeamsSorted.includes(eigeneGruppe)) {
            return [eigeneGruppe];
          }
          return uniqueTeamsSorted.length ? [uniqueTeamsSorted[0]] : [];
        }
        // Ansonsten Auswahl beibehalten, nur auf existierende Teams beschränken.
        return prev.filter((t) => uniqueTeamsSorted.includes(t));
      });

      // IDs für Stunde/Urlaub-Lookups
      const userIds = users.map((u) => u.user_id);

      const { data: stundenData } = await supabase
        .from("DB_Stunden")
        .select("user_id, jahr, summe_jahr, vorgabe_stunden")
        .in("user_id", userIds)
        .eq("jahr", aktuellesJahr)
        .eq("firma_id", firma)
        .eq("unit_id", unit);

      const { data: urlaubData } = await supabase
        .from("DB_Urlaub")
        .select("user_id, jahr, summe_jahr, urlaub_soll")
        .in("user_id", userIds)
        .eq("jahr", aktuellesJahr)
        .eq("firma_id", firma)
        .eq("unit_id", unit);

      const userListe = users
        .map((u) => {
          const stunden = stundenData?.find((s) => s.user_id === u.user_id);
          const urlaub = urlaubData?.find((r) => r.user_id === u.user_id);

          const abw = (stunden?.summe_jahr ?? 0) - (stunden?.vorgabe_stunden ?? 0);

          return {
            ...u,
            schichtgruppe: gruppenMap[u.user_id] || "—",
            abweichung: abw,
            summe_ist: stunden?.summe_jahr ?? 0,
            summe_soll: stunden?.vorgabe_stunden ?? 0,
            resturlaub: urlaub?.summe_jahr ?? 0,
            urlaub_soll: urlaub?.urlaub_soll ?? 0,
          };
        })
        .sort((a, b) => (a.position_ingruppe || 0) - (b.position_ingruppe || 0));

      setMitarbeiter(userListe);
    } catch (err) {
      console.error("❌ Fehler beim Laden:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ladeTeamdaten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, unit, userId, heute]);

  const handleTeamToggle = (team) => {
    setAktiveTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  if (loading) return <div>Lade Teamdaten...</div>;

  return (
    <div className="rounded-xl shadow-xl px-1 py-4 border border-gray-300 dark:border-gray-700">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setOffen(!offen)}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />} Team Übersicht {aktuellesJahr}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setInfoOffen(true);
          }}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-white"
          title="Informationen"
        >
          <Info size={18} />
        </button>
      </div>

      {offen && (
        <>
          {/* Checkbox-Leiste: "Alle Teams" zuerst, danach sortierte Teams */}
          <div className="mb-4 flex flex-wrap gap-4 text-sm items-center">
            {teams.length > 0 && (
              <label className="flex items-center gap-1 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={aktiveTeams.length === teams.length}
                  onChange={() =>
                    setAktiveTeams((prev) =>
                      prev.length === teams.length ? [] : [...teams]
                    )
                  }
                />
                Alle Teams
              </label>
            )}

            {teams.map((team) => (
              <label key={team} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aktiveTeams.includes(team)}
                  onChange={() => handleTeamToggle(team)}
                />
                {team}
              </label>
            ))}
          </div>

          <div className="space-y-4">
            {mitarbeiter
              .filter((m) => aktiveTeams.includes(m.schichtgruppe))
              .map((m) => (
                <div
                  key={m.user_id}
                  className="bg-white dark:bg-gray-800 p-3 rounded-md shadow flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">
                      {m.vorname} {m.nachname}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                      <span>Gruppe: {m.schichtgruppe}</span>
                      <span>
                        | Std. Jahresende: {Number(m.abweichung ?? 0).toFixed(1)}
                      </span>
                      <span>
                        | Std.: {m.summe_ist} / {m.summe_soll}
                      </span>
                      <span>
                        | Urlaub: {m.resturlaub} / {m.urlaub_soll}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStatistikUser(m)}
                      className="text-green-600 hover:text-green-800"
                      title="Statistiken anzeigen"
                    >
                      <BarChart2 size={18} />
                    </button>
                    <button
                      onClick={() => setPflegeUser(m)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Daten pflegen"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {statistikUser && (
        <StatistikModal user={statistikUser} onClose={() => setStatistikUser(null)} />
      )}

      {pflegeUser && (
        <PflegenModal
          user={pflegeUser}
          onClose={() => setPflegeUser(null)}
          onRefresh={ladeTeamdaten} // Auswahl bleibt dank Logik oben erhalten
        />
      )}

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl w-96 animate-fade-in relative">
            <button
              className="absolute top-2 right-2 text-gray-500"
              onClick={() => setInfoOffen(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2">ℹ Informationen</h2>
            <ul className="text-sm list-disc ml-4 space-y-2">
              <li>Die Teams werden tagesaktuell aus der Kampfliste geladen.</li>
              <li>Die Liste ist nach „Position in Gruppe“ sortiert.</li>
              <li>Über die Checkboxen kannst du Teams filtern oder alle anzeigen.</li>
              <li>Klicke auf das Stift-Symbol, um Stunden/Urlaub zu pflegen.</li>
              <li>Die Jahreswerte zu Stunden &amp; Urlaub stammen aus den Tabellen DB_Stunden und DB_Urlaub.</li>
              <li>Die Team-Reihenfolge ist: erst „Alle Teams“, danach natürliche Sortierung (Zahl → Buchstabe).</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPflegen;
