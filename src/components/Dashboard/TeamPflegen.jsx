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
  const firstNumber = (s) => {
    if (!s) return null;
    const m = String(s).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };
  const firstLetter = (s) => {
    if (!s) return "";
    const m = String(s).match(/[A-Za-zÄÖÜäöü]/);
    return m ? m[0].toUpperCase() : "";
  };
  const sortTeams = (arr) => {
    return [...arr].sort((a, b) => {
      const na = firstNumber(a);
      const nb = firstNumber(b);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      const la = firstLetter(a);
      const lb = firstLetter(b);
      if (la && lb && la !== lb) return la.localeCompare(lb, "de", { sensitivity: "base" });
      return String(a).localeCompare(String(b), "de", { sensitivity: "base", numeric: true });
    });
  };
  // ---------------------------------------------------

  const ladeTeamdaten = async () => {
    if (!firma || !unit) return;
    setLoading(true);
    try {
      // 1) Sichtbare User
      const { data: users, error: userError } = await supabase
        .from("DB_User")
        .select("user_id, vorname, nachname")
        .eq("firma_id", firma)
        .eq("unit_id", unit)


      if (userError) throw userError;
      const userIds = (users || []).map((u) => u.user_id);

      // 2) Heutige Schichtzuweisungen
      const { data: zuwRaw, error: zuwErr } = await supabase
        .from("DB_SchichtZuweisung")
        .select("user_id, schichtgruppe, position_ingruppe, von_datum, bis_datum")
        .eq("firma_id", firma)
        .eq("unit_id", unit)
        .in("user_id", userIds)
        .lte("von_datum", heute);

      if (zuwErr) throw zuwErr;

      const zuwHeuteMap = new Map();
      (zuwRaw || [])
        .filter((z) => !z.bis_datum || z.bis_datum >= heute)
        .forEach((z) => {
          const prev = zuwHeuteMap.get(z.user_id);
          if (!prev || z.von_datum > prev.von_datum) {
            zuwHeuteMap.set(z.user_id, {
              schichtgruppe: z.schichtgruppe,
              position_ingruppe: z.position_ingruppe ?? 999,
              von_datum: z.von_datum,
              bis_datum: z.bis_datum ?? null,
            });
          }
        });

      // 3) Teams deduplizieren + sortieren
      const uniqueTeamsRaw = Array.from(
        new Set(
          Array.from(zuwHeuteMap.values())
            .map((v) => (v?.schichtgruppe ?? "").toString().trim())
            .filter(Boolean)
        )
      );
      const uniqueTeamsSorted = sortTeams(uniqueTeamsRaw);
      setTeams(uniqueTeamsSorted);

      // 4) Vorauswahl
      const eigeneZuw = zuwHeuteMap.get(userId);
      const eigeneGruppe = eigeneZuw?.schichtgruppe;
      setAktiveTeams((prev) => {
        if (firstLoadRef.current || prev.length === 0) {
          firstLoadRef.current = false;
          if (eigeneGruppe && uniqueTeamsSorted.includes(eigeneGruppe)) {
            return [eigeneGruppe];
          }
          return uniqueTeamsSorted.length ? [uniqueTeamsSorted[0]] : [];
        }
        return prev.filter((t) => uniqueTeamsSorted.includes(t));
      });

      // 5) Stunden & Urlaub laden
      const { data: stundenData } = await supabase
        .from("DB_Stunden")
        .select("user_id, jahr, summe_jahr, vorgabe_stunden, stunden_gesamt, uebernahme_vorjahr")
        .in("user_id", userIds)
        .eq("jahr", aktuellesJahr)
        .eq("firma_id", firma)
        .eq("unit_id", unit);

      const { data: urlaubData } = await supabase
        .from("DB_Urlaub")
        .select("user_id, jahr, summe_jahr, urlaub_gesamt")
        .in("user_id", userIds)
        .eq("jahr", aktuellesJahr)
        .eq("firma_id", firma)
        .eq("unit_id", unit);

              // 5a) Höchste Qualifikation je User (heute gültig)
      const { data: qualiRows, error: qualiErr } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali, quali_start, quali_endet')
        .in('user_id', userIds);
      if (qualiErr) throw qualiErr;

      // nur heute gültige Qualis berücksichtigen
      const heuteISO = heute;
      const gueltigeQualis = (qualiRows || []).filter(q =>
        (!q.quali_start || q.quali_start <= heuteISO) &&
        (!q.quali_endet || q.quali_endet >= heuteISO)
      );

      // benutzte Quali-IDs
      const usedQualiIds = Array.from(
        new Set(gueltigeQualis.map(q => q.quali).filter(Boolean))
      );

      // Matrix: Position + Kürzel holen
      let posById = new Map();
      let kuerzelById = new Map();
      if (usedQualiIds.length) {
        const { data: mtx, error: mtxErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, position, quali_kuerzel')
          .in('id', usedQualiIds)
          .eq('firma_id', firma)
          .eq('unit_id', unit);
        if (mtxErr) throw mtxErr;
        (mtx || []).forEach(r => {
          posById.set(r.id, Number(r.position) || 9999);
          kuerzelById.set(r.id, r.quali_kuerzel || '');
        });
      }

      // Maps: beste (kleinste) Position & zugehöriges Kürzel
      const bestPosByUser = new Map();     // user_id -> kleinste Position
      const bestKuerzelByUser = new Map(); // user_id -> Kürzel der besten

      for (const uid of userIds) {
        const own = gueltigeQualis.filter(q => q.user_id === uid);
        let bestPos = 9999;
        let bestKz  = '';
        for (const q of own) {
          const p = posById.get(q.quali);
          if (p != null && p < bestPos) {
            bestPos = p;
            bestKz  = kuerzelById.get(q.quali) || '';
          }
        }
        bestPosByUser.set(uid, bestPos);
        bestKuerzelByUser.set(uid, bestKz);
      }

      // 6) Merge + Sortierung (primär: höchste Quali, dann Position-in-Gruppe, dann Name)
      const userListe = (users || [])
        .map((u) => {
          const zuw = zuwHeuteMap.get(u.user_id);
          const schichtgruppe = zuw?.schichtgruppe || "—";
          const position = Number(zuw?.position_ingruppe ?? 999);

          const stunden = stundenData?.find((s) => s.user_id === u.user_id);
          const urlaub = urlaubData?.find((r) => r.user_id === u.user_id);

          const summe_jahr = Number(stunden?.summe_jahr ?? 0);
          const uebernahme_vorjahr = Number(stunden?.uebernahme_vorjahr ?? 0);
          const stunden_gesamt = Number(stunden?.stunden_gesamt ?? 0);

          const istInklVorjahr = summe_jahr + uebernahme_vorjahr;
          const restBisJahresende = istInklVorjahr - stunden_gesamt;

          const bestPos = bestPosByUser.get(u.user_id) ?? 9999;
          const bestKz  = bestKuerzelByUser.get(u.user_id) || '';

          return {
            ...u,
            schichtgruppe,
            position_ingruppe: position,
            abweichung: restBisJahresende,
            summe_ist: istInklVorjahr,
            summe_soll: stunden_gesamt,
            resturlaub: urlaub?.summe_jahr ?? 0,
            urlaub_gesamt: urlaub?.urlaub_gesamt ?? 0,
            hoechste_quali_pos: bestPos,
            hoechste_quali_kz: bestKz,
          };
        })
        .sort((a, b) => {
          // 1) beste Quali (kleinere Position = höherwertig)
          if (a.hoechste_quali_pos !== b.hoechste_quali_pos) {
            return a.hoechste_quali_pos - b.hoechste_quali_pos;
          }
          // 2) Position in Gruppe
          const ap = a.position_ingruppe ?? 999;
          const bp = b.position_ingruppe ?? 999;
          if (ap !== bp) return ap - bp;
          // 3) Name
          const an = `${a.nachname || ''} ${a.vorname || ''}`.trim();
          const bn = `${b.nachname || ''} ${b.vorname || ''}`.trim();
          return an.localeCompare(bn, 'de');
        });

      setMitarbeiter(userListe);

    } catch (err) {
      console.error("❌ Fehler beim Laden:", err.message || err);
      setTeams([]);
      setMitarbeiter([]);
      setAktiveTeams([]);
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
          {/* Checkbox-Leiste */}
          <div className="mb-4 flex flex-wrap gap-2 text-sm items-center">
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
                  className="bg-gray-200 dark:bg-gray-900 p-4 rounded-md shadow-xl border border-gray-00 dark:border-gray-600 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">
                      {m.vorname} {m.nachname}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                      <span>Gruppe: {m.schichtgruppe}</span>
                      <span>| Pos.: {m.position_ingruppe ?? "–"}</span>
                      <span>| Std. Jahresende: {Number(m.abweichung ?? 0).toFixed(1)}</span>
                      <span>| Std.: {m.summe_ist} / {m.summe_soll}</span>
                      <span>| Urlaub: {m.resturlaub} / {m.urlaub_gesamt}</span>
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
          onRefresh={ladeTeamdaten}
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
              <li>Die Teams werden tagesaktuell aus <strong>DB_SchichtZuweisung</strong> geladen.</li>
              <li>Die Liste ist nach <strong>Position in Gruppe</strong> (aus der Zuweisung) sortiert.</li>
              <li>Über die Checkboxen kannst du Teams filtern oder alle anzeigen.</li>
              <li>Die Jahreswerte zu Stunden &amp; Urlaub stammen aus den Tabellen DB_Stunden und DB_Urlaub.</li>
              <li><strong>Ist-Stunden</strong> zeigen <code>summe_jahr + uebernahme_vorjahr</code>. <strong>Std. Jahresende</strong> ist <code>stunden_gesamt − (summe_jahr + uebernahme_vorjahr)</code>.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPflegen;
