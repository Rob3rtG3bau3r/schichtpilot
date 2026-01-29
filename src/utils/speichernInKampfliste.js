// src/utils/speichernInKampfliste.js
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { supabase } from "../supabaseClient";
import { berechneUndSpeichereStunden, berechneUndSpeichereUrlaub } from "./berechnungen";

dayjs.extend(duration);

// Optional: Tests ohne Recalc via VITE_SP_SKIP_RECALC=1
const PERF_SKIP_RECALC =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_SP_SKIP_RECALC === "1") ||
  false;

/* -------------------------------- Helpers -------------------------------- */

// Rohdauer in Stunden aus Beginn/Ende (mit Nacht-Übergang)
const berechneRohDauerInStunden = (start, ende) => {
  if (!start || !ende) return 0;
  const s = dayjs(`2024-01-01T${start}`);
  let e = dayjs(`2024-01-01T${ende}`);
  if (e.isBefore(s)) e = e.add(1, "day");
  return dayjs.duration(e.diff(s)).asHours();
};

// Robust: Pause als Stunden interpretieren (wenn >5 vermutlich Minuten)
const toHours = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n > 5 ? n / 60 : n;
};

// Schichtgruppe des Users zum Datum ermitteln (aktive Zuweisung [von..bis])
const ermittleSchichtgruppe = async ({ userId, datum, firmaId, unitId, sb }) => {
  const client = sb || supabase;

  const { data, error } = await client
    .from("DB_SchichtZuweisung")
    .select("schichtgruppe, von_datum, bis_datum")
    .eq("user_id", userId)
    .eq("firma_id", firmaId)
    .eq("unit_id", unitId)
    .lte("von_datum", datum)
    .or(`bis_datum.is.null,bis_datum.gte.${datum}`)
    .order("von_datum", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.schichtgruppe;
};

// Soll (Kürzel + Zeiten + Pause) aus DB_SollPlan über Schichtgruppe holen
const ladeSollAusSollPlanFuerUser = async ({ userId, datum, firmaId, unitId, sb }) => {
  const client = sb || supabase;

  const gruppe = await ermittleSchichtgruppe({ userId, datum, firmaId, unitId, sb: client });
  if (!gruppe) return { kuerzel: "-", start: null, ende: null, pause: null, schichtgruppe: null };

  const { data, error } = await client
    .from("DB_SollPlan")
    .select("kuerzel,startzeit,endzeit,pause_dauer")
    .eq("schichtgruppe", gruppe)
    .eq("datum", datum)
    .eq("firma_id", firmaId)
    .eq("unit_id", unitId)
    .maybeSingle();

  if (error || !data) return { kuerzel: "-", start: null, ende: null, pause: null, schichtgruppe: gruppe };

  return {
    kuerzel: data.kuerzel || "-",
    start: data.startzeit || null,
    ende: data.endzeit || null,
    pause: data.pause_dauer ?? null,
    schichtgruppe: gruppe,
  };
};

const istArbeitsTag = (kuerzel) => !["-", "U", "K", "KO"].includes(kuerzel);

/* --------------------------- Main Save Function --------------------------- */

/**
 * Zentrales Kampfliste-Speichern (Verlauf -> Delete -> Insert + Recalc)
 * @param {object} args
 * @returns {Promise<{ ok: boolean, inserted: number, wroteVerlauf: number, deletedDates: number, affectedDates: string[] }>}
 */
export const speichernInKampfliste = async ({
  // Pflicht
  firmaId,
  unitId,
  userId,
  dates, // Array of "YYYY-MM-DD"
  kuerzelNeu,
  createdBy,

  // optional
  kommentar = null,
  schichtgruppe = null,

  // Zeiten/Pause optional (für normale Schichten)
  start = null,
  ende = null,
  pauseHours = 0,

  // Wenn du schon SchichtArt geladen hast (spart Query)
  selectedSchicht = null, // DB_SchichtArt row

  // Regeln
  skipUrlaubOnFreeDay = true,
  allowTimesIfIgnoriert = false,

  // performance/test
  perfSkipRecalc = PERF_SKIP_RECALC,

  // optional: anderer supabase client (tests)
  sb = null,
} = {}) => {

  const client = sb || supabase;

  if (!firmaId || !unitId || !userId || !Array.isArray(dates) || !dates.length || !kuerzelNeu || !createdBy) {
    throw new Error("speichernInKampfliste: Pflichtparameter fehlen.");
  }

  const nowIso = new Date().toISOString();

  // 1) SchichtArt laden (wenn nicht gegeben)
  let schicht = selectedSchicht;
  if (!schicht) {
    const { data, error } = await client
      .from("DB_SchichtArt")
      .select("id, kuerzel, startzeit, endzeit, dauer, pause_aktiv, pause_dauer, ignoriert_arbeitszeit")
      .eq("firma_id", firmaId)
      .eq("unit_id", unitId)
      .eq("kuerzel", kuerzelNeu)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error(`SchichtArt nicht gefunden für Kürzel "${kuerzelNeu}".`);
    schicht = data;
  }

  // 2) Alte Kampfliste-Zeilen für Zeitraum in 1 Query
  const { data: oldRows, error: oldErr } = await client
    .from("DB_Kampfliste")
    .select(
      `
        user, datum, firma_id, unit_id, ist_schicht, soll_schicht,
        startzeit_ist, endzeit_ist, dauer_ist, dauer_soll, kommentar,
        created_at, created_by, schichtgruppe,
        pausen_dauer,
        ist_rel:ist_schicht ( id, kuerzel, startzeit, endzeit )
      `
    )
    .eq("user", userId)
    .eq("firma_id", firmaId)
    .eq("unit_id", unitId)
    .in("datum", dates);

  if (oldErr) throw oldErr;

  const oldByDate = new Map((oldRows ?? []).map((r) => [String(r.datum).slice(0, 10), r]));

  // 3) SollPlan Cache
  const sollCache = new Map();
  const getSoll = async (dateStr) => {
    if (sollCache.has(dateStr)) return sollCache.get(dateStr);
    const v = await ladeSollAusSollPlanFuerUser({ userId, datum: dateStr, firmaId, unitId, sb: client });
    sollCache.set(dateStr, v);
    return v;
  };

  // 4) Recalc Sets (dedup)
  const recalcStundenSet = new Set(); // JSON.stringify({jahr,monat})
  const recalcUrlaubSet = new Set();  // JSON.stringify({jahr})

  // 5) Batches
  const verlaufBatch = [];
  const deleteDates = [];
  const insertBatch = [];

  // Basiszeiten für aenderung-Flag (nur Zeitabweichung vs Standard)
  const basisStart = schicht?.startzeit ?? null;
  const basisEnde = schicht?.endzeit ?? null;

  for (const datumStr of dates) {
    const dObj = dayjs(datumStr);
    const oldRow = oldByDate.get(datumStr) ?? null;
    const oldIstKuerzel = oldRow?.ist_rel?.kuerzel ?? null;

    const sollPlan = await getSoll(datumStr);
    const gruppeFinal = schichtgruppe ?? oldRow?.schichtgruppe ?? sollPlan?.schichtgruppe ?? null;
    const sollK =
      sollPlan?.kuerzel && sollPlan.kuerzel !== "-"
        ? sollPlan.kuerzel
        : oldRow?.soll_schicht ?? null;

    // Regel: Urlaub auf freien Tagen überspringen
    if (skipUrlaubOnFreeDay && (sollK == null || sollK === "-") && kuerzelNeu === "U") {
      continue;
    }

    // Dauer_Soll (nur falls nicht vorhanden)
    let dauerSoll = oldRow?.dauer_soll ?? null;
    if (!dauerSoll && sollPlan?.start && sollPlan?.ende) {
      const s = dayjs(`2024-01-01T${sollPlan.start}`);
      let e = dayjs(`2024-01-01T${sollPlan.ende}`);
      if (e.isBefore(s)) e = e.add(1, "day");
      dauerSoll = dayjs.duration(e.diff(s)).asHours();
    }

    // Start/Ende bestimmen
    let aktuelleStart = start;
    let aktuelleEnde = ende;

    const ignoriert = !!schicht?.ignoriert_arbeitszeit;

    if (ignoriert) {
      // Default wie im Form: Zeiten werden übernommen (alte/soll/schicht)
      if (!allowTimesIfIgnoriert) {
        aktuelleStart = oldRow?.startzeit_ist ?? sollPlan?.start ?? schicht?.startzeit ?? null;
        aktuelleEnde = oldRow?.endzeit_ist ?? sollPlan?.ende ?? schicht?.endzeit ?? null;
      } else {
        // optional: Caller darf explizit Zeiten setzen (falls du’s mal brauchst)
        aktuelleStart = aktuelleStart ?? oldRow?.startzeit_ist ?? sollPlan?.start ?? schicht?.startzeit ?? null;
        aktuelleEnde = aktuelleEnde ?? oldRow?.endzeit_ist ?? sollPlan?.ende ?? schicht?.endzeit ?? null;
      }
    } else {
      // Wenn keine Zeiten übergeben wurden, fallback auf SchichtArt
      aktuelleStart = aktuelleStart ?? schicht?.startzeit ?? null;
      aktuelleEnde = aktuelleEnde ?? schicht?.endzeit ?? null;
    }

    // Dauer + Pause
    let aktuelleDauer = null;
    let aktuellePause = 0;

    if (ignoriert) {
      aktuelleDauer = oldRow?.dauer_ist ?? dauerSoll ?? null;
      aktuellePause = 0;
    } else if (aktuelleStart && aktuelleEnde) {
      const roh = berechneRohDauerInStunden(aktuelleStart, aktuelleEnde);

      // Mindestpause (nur wenn pause_aktiv)
      let minPause = 0;
      if (schicht?.pause_aktiv) {
        if (roh >= 9) minPause = 0.75;
        else if (roh >= 6) minPause = 0.5;
      }

      const pUser = Number(pauseHours) || 0;
      aktuellePause = Math.max(pUser, minPause);
      aktuelleDauer = Math.max(roh - aktuellePause, 0);
    }

    // Recalc flags
    const alterDauerIst = oldRow?.dauer_ist ?? null;
    const jahr = dObj.year();
    const monat = dObj.month() + 1;

    if (!perfSkipRecalc && alterDauerIst !== aktuelleDauer) {
      recalcStundenSet.add(JSON.stringify({ jahr, monat }));
    }

    // Urlaub neu rechnen, wenn alt oder neu U
    if (!perfSkipRecalc && (kuerzelNeu === "U" || oldIstKuerzel === "U")) {
      recalcUrlaubSet.add(JSON.stringify({ jahr }));
    }

    // Verlauf: alten Zustand speichern
    if (oldRow) {
      verlaufBatch.push({
        user: oldRow.user,
        datum: oldRow.datum,
        firma_id: oldRow.firma_id,
        unit_id: oldRow.unit_id,
        ist_schicht: oldRow.ist_schicht,
        soll_schicht: oldRow.soll_schicht,
        startzeit_ist: oldRow.startzeit_ist,
        endzeit_ist: oldRow.endzeit_ist,
        dauer_ist: oldRow.dauer_ist,
        dauer_soll: oldRow.dauer_soll,
        kommentar: oldRow.kommentar,
        pausen_dauer: oldRow.pausen_dauer ?? 0,
        change_on: nowIso,
        created_by: oldRow.created_by,
        change_by: createdBy,
        created_at: oldRow.created_at,
        schichtgruppe: oldRow.schichtgruppe,
      });
    }

    // Delete + Insert
    deleteDates.push(datumStr);

    const hatAenderung =
      ["U", "K", "KO"].includes(kuerzelNeu)
        ? false
        : !((basisStart ?? null) === (aktuelleStart ?? null) && (basisEnde ?? null) === (aktuelleEnde ?? null));

    insertBatch.push({
      user: userId,
      datum: datumStr,
      firma_id: firmaId,
      unit_id: unitId,
      soll_schicht: sollK ?? null,
      ist_schicht: schicht.id,
      startzeit_ist: aktuelleStart ?? null,
      endzeit_ist: aktuelleEnde ?? null,
      dauer_ist: aktuelleDauer ?? null,
      dauer_soll: dauerSoll ?? null,
      pausen_dauer: aktuellePause ?? 0,
      aenderung: hatAenderung,
      created_at: nowIso,
      created_by: createdBy,
      schichtgruppe: gruppeFinal,
      kommentar: kommentar || null,
    });
  }

  // 6) Writes (Reihenfolge: Verlauf -> Delete -> Insert)
  if (verlaufBatch.length) {
    const vr = await client.from("DB_KampflisteVerlauf").insert(verlaufBatch);
    if (vr.error) throw vr.error;
  }

  if (deleteDates.length) {
    const dr = await client
      .from("DB_Kampfliste")
      .delete()
      .eq("user", userId)
      .eq("firma_id", firmaId)
      .eq("unit_id", unitId)
      .in("datum", deleteDates);

    if (dr.error) throw dr.error;
  }

  if (insertBatch.length) {
    const ir = await client.from("DB_Kampfliste").insert(insertBatch);
    if (ir.error) throw ir.error;
  }

  // 7) Recalc
  if (!perfSkipRecalc) {
    for (const k of recalcStundenSet) {
      const { jahr, monat } = JSON.parse(k);
      await berechneUndSpeichereStunden(userId, jahr, monat, firmaId, unitId);
    }
    for (const k of recalcUrlaubSet) {
      const { jahr } = JSON.parse(k);
      await berechneUndSpeichereUrlaub(userId, jahr, firmaId, unitId);
    }
  }

    return {
    ok: true,
    affectedDates: insertBatch.map((x) => x.datum),
    wroteVerlauf: verlaufBatch.length,
    inserted: insertBatch.length,
    deletedDates: deleteDates.length,
  };
};

