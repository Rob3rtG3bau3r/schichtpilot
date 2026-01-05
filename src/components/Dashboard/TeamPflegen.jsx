// TeamPflegen.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useRollen } from "../../context/RollenContext";
import { ChevronDown, ChevronRight, Info, BarChart2, Calendar } from "lucide-react";
import StatistikModal from "./StatistikModal";
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
  const [infoOffen, setInfoOffen] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- Jahr / Stichtag ---
  const realYear = dayjs().year();
  const minYear = realYear - 1;
  const maxYear = realYear + 1;

  const [viewYear, setViewYear] = useState(realYear);

  // Stichtag als Datum (für Team-Zuweisung). Standard: heute.
  const [stichtag, setStichtag] = useState(() => dayjs().format("YYYY-MM-DD"));

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

  // Wenn das Jahr geändert wird: Stichtag in dieses Jahr "mitziehen"
  useEffect(() => {
    const d = dayjs(stichtag);
    if (!d.isValid()) return;

    const moved = d.year(viewYear);

    // Falls 29.02 -> Zieljahr kein Schaltjahr: auf 28.02
    const safe = moved.isValid() ? moved : dayjs(`${viewYear}-02-28`);

    setStichtag(safe.format("YYYY-MM-DD"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear]);

  const ladeTeamdaten = async () => {
    if (!firma || !unit) return;

    const stichtagISO = stichtag;      // für Zuweisung + Quali-Gültigkeit
    const aktuellesJahr = viewYear;    // für Stunden/Urlaub/Abzug

    setLoading(true);
    try {
      // 1) Sichtbare User
      const { data: users, error: userError } = await supabase
        .from("DB_User")
        .select("user_id, vorname, nachname")
        .eq("firma_id", firma)
        .eq("unit_id", unit);

      if (userError) throw userError;

      const userIds = (users || []).map((u) => u.user_id);
      if (!userIds.length) {
        setTeams([]);
        setMitarbeiter([]);
        setAktiveTeams([]);
        return;
      }

      // 2) Schichtzuweisungen zum Stichtag
      const { data: zuwRaw, error: zuwErr } = await supabase
        .from("DB_SchichtZuweisung")
        .select("user_id, schichtgruppe, position_ingruppe, von_datum, bis_datum")
        .eq("firma_id", firma)
        .eq("unit_id", unit)
        .in("user_id", userIds)
        .lte("von_datum", stichtagISO);

      if (zuwErr) throw zuwErr;

      const zuwHeuteMap = new Map();
      (zuwRaw || [])
        .filter((z) => !z.bis_datum || z.bis_datum >= stichtagISO)
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

      // 4) Vorauswahl (nur beim ersten vollständigen Laden)
      const eigeneZuw = zuwHeuteMap.get(userId);
      const eigeneGruppe = eigeneZuw?.schichtgruppe;

      setAktiveTeams((prev) => {
        if (firstLoadRef.current || prev.length === 0) {
          firstLoadRef.current = false;
          if (eigeneGruppe && uniqueTeamsSorted.includes(eigeneGruppe)) return [eigeneGruppe];
          return uniqueTeamsSorted.length ? [uniqueTeamsSorted[0]] : [];
        }
        return prev.filter((t) => uniqueTeamsSorted.includes(t));
      });

      // 5) Stunden & Urlaub für viewYear laden
      const { data: stundenData } = await supabase
        .from("DB_Stunden")
        .select("user_id, jahr, summe_jahr, vorgabe_stunden, uebernahme_vorjahr")
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

      // 5b) ✅ Abzüge (Summe pro Jahr & User) aus DB_StundenAbzug.stunden
      const { data: abzugRows, error: abzugErr } = await supabase
        .from("DB_StundenAbzug")
        .select("user_id, jahr, stunden")
        .in("user_id", userIds)
        .eq("jahr", aktuellesJahr)
        .eq("firma_id", firma)
        .eq("unit_id", unit);

      if (abzugErr) throw abzugErr;

      const abzugSumByUser = new Map(); // user_id -> summe Abzug
      (abzugRows || []).forEach((r) => {
        const uid = r.user_id;
        const val = Number(r.stunden ?? 0);
        abzugSumByUser.set(uid, (abzugSumByUser.get(uid) || 0) + (Number.isFinite(val) ? val : 0));
      });

      // 5c) Höchste Qualifikation je User (zum Stichtag gültig)
      const { data: qualiRows, error: qualiErr } = await supabase
        .from("DB_Qualifikation")
        .select("user_id, quali, quali_start, quali_endet")
        .in("user_id", userIds);

      if (qualiErr) throw qualiErr;

      const gueltigeQualis = (qualiRows || []).filter((q) => {
        const startOk = !q.quali_start || q.quali_start <= stichtagISO;
        const endOk = !q.quali_endet || q.quali_endet >= stichtagISO;
        return startOk && endOk;
      });

      const usedQualiIds = Array.from(new Set(gueltigeQualis.map((q) => q.quali).filter(Boolean)));

      let posById = new Map();
      let kuerzelById = new Map();

      if (usedQualiIds.length) {
        const { data: mtx, error: mtxErr } = await supabase
          .from("DB_Qualifikationsmatrix")
          .select("id, position, quali_kuerzel")
          .in("id", usedQualiIds)
          .eq("firma_id", firma)
          .eq("unit_id", unit);

        if (mtxErr) throw mtxErr;

        (mtx || []).forEach((r) => {
          posById.set(r.id, Number(r.position) || 9999);
          kuerzelById.set(r.id, r.quali_kuerzel || "");
        });
      }

      const bestPosByUser = new Map();
      const bestKuerzelByUser = new Map();

      for (const uid of userIds) {
        const own = gueltigeQualis.filter((q) => q.user_id === uid);
        let bestPos = 9999;
        let bestKz = "";
        for (const q of own) {
          const p = posById.get(q.quali);
          if (p != null && p < bestPos) {
            bestPos = p;
            bestKz = kuerzelById.get(q.quali) || "";
          }
        }
        bestPosByUser.set(uid, bestPos);
        bestKuerzelByUser.set(uid, bestKz);
      }

      // 6) Merge + Sortierung
      const userListe = (users || [])
        .map((u) => {
          const zuw = zuwHeuteMap.get(u.user_id);
          const schichtgruppe = zuw?.schichtgruppe || "—";
          const position = Number(zuw?.position_ingruppe ?? 999);

          const stunden = stundenData?.find((s) => s.user_id === u.user_id);
          const urlaub = urlaubData?.find((r) => r.user_id === u.user_id);

          const summe_jahr_raw = Number(stunden?.summe_jahr ?? 0);
          const abzugSumme = Number(abzugSumByUser.get(u.user_id) ?? 0);

          // ✅ Wunsch: Abzug von summe_jahr abziehen
          const summe_jahr_effektiv = summe_jahr_raw - abzugSumme;

          const uebernahme_vorjahr = Number(stunden?.uebernahme_vorjahr ?? 0);
          const vorgabe_stunden = Number(stunden?.vorgabe_stunden ?? 0);

          // Ist inkl Vorjahr basiert auf "effektiv" (nach Abzug)
          const istInklVorjahr = summe_jahr_effektiv + uebernahme_vorjahr;

          // Std. Jahresende = Ist - Soll
          const restBisJahresende = istInklVorjahr - vorgabe_stunden;

          const bestPos = bestPosByUser.get(u.user_id) ?? 9999;
          const bestKz = bestKuerzelByUser.get(u.user_id) || "";

          return {
            ...u,
            schichtgruppe,
            position_ingruppe: position,

            abzug_stunden: abzugSumme,
            summe_jahr_raw,
            summe_jahr_effektiv,

            abweichung: restBisJahresende,
            summe_ist: istInklVorjahr,
            summe_soll: vorgabe_stunden,

            resturlaub: Number(urlaub?.summe_jahr ?? 0),
            urlaub_gesamt: Number(urlaub?.urlaub_gesamt ?? 0),

            hoechste_quali_pos: bestPos,
            hoechste_quali_kz: bestKz,
          };
        })
        .sort((a, b) => {
          if (a.hoechste_quali_pos !== b.hoechste_quali_pos) return a.hoechste_quali_pos - b.hoechste_quali_pos;

          const ap = a.position_ingruppe ?? 999;
          const bp = b.position_ingruppe ?? 999;
          if (ap !== bp) return ap - bp;

          const an = `${a.nachname || ""} ${a.vorname || ""}`.trim();
          const bn = `${b.nachname || ""} ${b.vorname || ""}`.trim();
          return an.localeCompare(bn, "de");
        });

      setMitarbeiter(userListe);
    } catch (err) {
      console.error("❌ Fehler beim Laden:", err?.message || err);
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
  }, [firma, unit, userId, stichtag, viewYear]);

  const handleTeamToggle = (team) => {
    setAktiveTeams((prev) => (prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]));
  };

  const decYear = () => setViewYear((y) => Math.max(minYear, y - 1));
  const incYear = () => setViewYear((y) => Math.min(maxYear, y + 1));

  if (loading) return <div>Lade Teamdaten...</div>;

  return (
    <div className="rounded-xl shadow-xl px-1 py-4 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setOffen(!offen)}>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />} Team Übersicht {viewYear}
        </h3>

        <div className="flex items-center gap-2">
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
      </div>

      {offen && (
        <>
          {/* Jahr + Stichtag */}
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 ${
                  viewYear <= minYear ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                disabled={viewYear <= minYear}
                onClick={(e) => {
                  e.stopPropagation();
                  decYear();
                }}
                title="1 Jahr zurück"
              >
                −1 Jahr
              </button>

              <div className="px-3 py-1 rounded-xl bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-semibold">
                {viewYear}
              </div>

              <button
                className={`px-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 ${
                  viewYear >= maxYear ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                disabled={viewYear >= maxYear}
                onClick={(e) => {
                  e.stopPropagation();
                  incYear();
                }}
                title="1 Jahr vor"
              >
                +1 Jahr
              </button>
            </div>

            <label className="flex items-center gap-2">
              <Calendar size={16} className="opacity-70" />
              <span className="text-gray-600 dark:text-gray-300">Stichtag:</span>
              <input
                type="date"
                value={stichtag}
                onChange={(e) => setStichtag(e.target.value)}
                className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
              />
            </label>

            <button
              className="px-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                setViewYear(realYear);
                setStichtag(dayjs().format("YYYY-MM-DD"));
                firstLoadRef.current = true;
              }}
              title="Zurück auf heute"
            >
              Heute
            </button>
          </div>

          {/* Checkbox-Leiste */}
          <div className="mb-4 flex flex-wrap gap-2 text-sm items-center">
            {teams.length > 0 && (
              <label className="flex items-center gap-1 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={aktiveTeams.length === teams.length}
                  onChange={() => setAktiveTeams((prev) => (prev.length === teams.length ? [] : [...teams]))}
                />
                Alle Teams
              </label>
            )}

            {teams.map((team) => (
              <label key={team} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={aktiveTeams.includes(team)} onChange={() => handleTeamToggle(team)} />
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
                  className="bg-gray-300/20 dark:bg-gray-900/20 p-4 rounded-md shadow-xl border border-gray-300 dark:border-gray-700 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">
                      {m.vorname} {m.nachname}
                    </div>

                    <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                      <span>Quali: {m.hoechste_quali_kz || "–"}</span>
                      <span>| Gruppe: {m.schichtgruppe}</span>
                      <span>| Pos.: {m.position_ingruppe ?? "–"}</span>
                      <span>| Abzug: {Number(m.abzug_stunden ?? 0).toFixed(1)}</span>
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
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {statistikUser && <StatistikModal user={statistikUser} onClose={() => setStatistikUser(null)} />}

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl w-96 animate-fade-in relative">
            <button className="absolute top-2 right-2 text-gray-500" onClick={() => setInfoOffen(false)}>
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2">ℹ Informationen</h2>
            <ul className="text-sm list-disc ml-4 space-y-2">
              <li>
                Teams werden stichtagsbezogen aus <strong>DB_SchichtZuweisung</strong> geladen (Stichtag oben).
              </li>
              <li>
                Sortierung: <strong>höchste Qualifikation</strong>, dann <strong>Position in Gruppe</strong>.
              </li>
              <li>
                Jahreswerte stammen aus <strong>DB_Stunden</strong>, <strong>DB_StundenAbzug</strong> und{" "}
                <strong>DB_Urlaub</strong>.
              </li>
              <li>
                <strong>Abzug</strong> ist die Jahressumme aus <code>DB_StundenAbzug.stunden</code> und wird von{" "}
                <code>summe_jahr</code> abgezogen.
              </li>
              <li>
                <strong>Ist-Stunden</strong> = <code>(summe_jahr − abzug) + uebernahme_vorjahr</code> ·{" "}
                <strong>Std. Jahresende</strong> = <code>Ist − vorgabe_stunden</code>.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPflegen;
