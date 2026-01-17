import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';

/* ============ Helpers ============ */

// Alle Tage im Intervall
const enumerateDays = (startISO, endISO) => {
  const out = [];
  let d = dayjs(startISO);
  const end = dayjs(endISO);
  while (d.isSameOrBefore(end, 'day')) {
    out.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return out;
};

// Neuester Kampfliste-Eintrag je Datum
const dedupeKampfliste = (rows) => {
  const map = new Map();
  for (const r of rows || []) {
    const d = dayjs(r?.datum).format('YYYY-MM-DD');
    if (!d) continue;
    const cur = map.get(d);
    const rT = r?.created_at ? new Date(r.created_at).getTime() : -1;
    const cT = cur?.created_at ? new Date(cur.created_at).getTime() : -1;
    if (!cur || rT >= cT) map.set(d, r);
  }
  return map; // Map<date,row>
};

/* ============ Loader ============ */

// 1) Zuweisungen (nur echte Spalten deiner Tabelle)
const loadZuweisungen = async ({ userId, firmaId, unitId }) => {
  const selects = 'user_id, schichtgruppe, von_datum, bis_datum, position_ingruppe, created_at';
  const { data, error } = await supabase
    .from('DB_SchichtZuweisung')
    .select(selects)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .eq('user_id', userId);
  if (error) throw error;

  return (data || []).map((r) => ({
    ...r,
    start: dayjs(r.von_datum).isValid() ? dayjs(r.von_datum).format('YYYY-MM-DD') : null,
    end:   dayjs(r.bis_datum).isValid() ? dayjs(r.bis_datum).format('YYYY-MM-DD')   : null,
    groupName: r.schichtgruppe ?? null,
  }));
};

// 2) SollPlan für relevante Gruppen (per schichtgruppe-Text)
const loadSollPlanForGroups = async ({ firmaId, unitId, startISO, endISO, groupNames }) => {
  const { data, error } = await supabase
    .from('DB_SollPlan')
    .select('datum, schichtgruppe, schichtart_id, dauer, created_at')
    .gte('datum', startISO)
    .lte('datum', endISO)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId);
  if (error) throw error;

  const idx = new Map(); // key = `${date}|${schichtgruppe}` → jüngste Zeile
  for (const r of data || []) {
    const date  = dayjs(r.datum).format('YYYY-MM-DD');
    const gName = r.schichtgruppe ?? null;
    if (!gName || !groupNames.has(String(gName))) continue;

    const k   = `${date}|${String(gName)}`;
    const cur = idx.get(k);
    const rT  = r?.created_at ? new Date(r.created_at).getTime() : -1;
    const cT  = cur?.created_at ? new Date(cur.created_at).getTime() : -1;
    if (!cur || rT >= cT) idx.set(k, r);
  }
  return idx;
};

// 3) Kampfliste (User im Zeitraum) → neuester je Tag (user_id → optionaler Fallback auf user)
// Kampfliste (User im Zeitraum) → neuester Eintrag je Datum
const loadKampflisteForUser = async ({ userId, firmaId, unitId, startISO, endISO }) => {
  const { data, error } = await supabase
    .from('DB_Kampfliste')
    .select('datum, ist_schicht, dauer_ist, created_at') // nur echte Spalten
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .eq('user', userId)                                  // <-- korrektes Feld
    .gte('datum', startISO)
    .lte('datum', endISO);

  if (error) throw error;

  // neuester Eintrag je Tag
  const map = new Map();
  for (const r of (data || [])) {
    const d = dayjs(r.datum).format('YYYY-MM-DD');
    const cur = map.get(d);
    const rt = r?.created_at ? new Date(r.created_at).getTime() : -1;
    const ct = cur?.created_at ? new Date(cur.created_at).getTime() : -1;
    if (!cur || rt >= ct) map.set(d, r);
  }
  return map;
};

/* ============ Stunden ============ */

export const berechneUndSpeichereStunden = async (userId, jahr, monat, firmaId, unitId) => {
  try {
    const startISO = `${jahr}-${String(monat).padStart(2, '0')}-01`;
    const endISO   = dayjs(startISO).endOf('month').format('YYYY-MM-DD');

    // Zuweisungen → relevante Gruppennamen
    const zuweisungen = await loadZuweisungen({ userId, firmaId, unitId });
    const groupNames  = new Set(zuweisungen.map(z => z.groupName).filter(Boolean).map(String));

    // Baseline & Overrides
    const sollIdx = await loadSollPlanForGroups({ firmaId, unitId, startISO, endISO, groupNames });
    const klMap   = await loadKampflisteForUser({ userId, firmaId, unitId, startISO, endISO });

    // Final je Tag: Kampfliste gewinnt, sonst SollPlan (per schichtgruppe)
    let summe = 0;
    for (const date of enumerateDays(startISO, endISO)) {
      const override = klMap.get(date);
      if (override) {
        summe += Number(override.dauer_ist) || 0;
        continue;
      }

      const z = zuweisungen.find(zz =>
        (!zz.start || dayjs(date).isSameOrAfter(zz.start, 'day')) &&
        (!zz.end   || dayjs(date).isSameOrBefore(zz.end, 'day'))
      );
      if (!z || !z.groupName) continue;

      const key  = `${date}|${String(z.groupName)}`;
      const base = sollIdx.get(key);
      if (base) summe += Number(base.dauer) || 0;
    }
    summe = +(+summe).toFixed(2);

    // Upsert in DB_Stunden
    const { data: record, error: getError } = await supabase
      .from('DB_Stunden')
      .select('*')
      .eq('user_id', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('jahr', jahr)
      .maybeSingle();
    if (getError) throw getError;

    const monate = {
      m1: record?.m1 || 0, m2: record?.m2 || 0, m3: record?.m3 || 0, m4: record?.m4 || 0,
      m5: record?.m5 || 0, m6: record?.m6 || 0, m7: record?.m7 || 0, m8: record?.m8 || 0,
      m9: record?.m9 || 0, m10: record?.m10 || 0, m11: record?.m11 || 0, m12: record?.m12 || 0,
    };
    monate[`m${monat}`] = summe;
    const summeJahr = Object.values(monate).reduce((a, b) => a + (Number(b) || 0), 0);

    const { error: upErr } = await supabase
      .from('DB_Stunden')
      .upsert(
        {
          user_id: userId,
          firma_id: firmaId,
          unit_id: unitId,
          jahr,
          ...monate,
          summe_jahr: +(+summeJahr).toFixed(2),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,firma_id,unit_id,jahr' }
      );
    if (upErr) throw upErr;

    //console.log(`✅ Stunden gespeichert: m${monat}=${summe}h, Jahr=${summeJahr}h`);
  } catch (err) {
    console.error('❌ Fehler bei Stundenberechnung:', err?.message || err);
  }
};

/* ============ Urlaub (nur Kampfliste) ============ */

export async function berechneUndSpeichereUrlaub(userId, jahr, firmaId, unitId) {
  try {
    const startISO = `${jahr}-01-01`;
    const endISO   = `${jahr}-12-31`;

    // U-ID besorgen
    const { data: uRow, error: uErr } = await supabase
      .from('DB_SchichtArt')
      .select('id')
      .eq('kuerzel', 'U')
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .maybeSingle();
    if (uErr || !uRow) throw new Error('Schichtart "U" nicht gefunden');
    const urlaubId = Number(uRow.id);

    // Nur Kampfliste zählen (neuester Eintrag pro Tag)
    const klMap = await loadKampflisteForUser({ userId, firmaId, unitId, startISO, endISO });

    const mon = Array(12).fill(0);
    for (const [dateStr, row] of klMap) {
      if (Number(row.ist_schicht) === urlaubId) {
        const mi = dayjs(dateStr).month(); // 0..11
        mon[mi] += 1;
      }
    }

    const payload = {
      m1: mon[0], m2: mon[1], m3: mon[2], m4: mon[3], m5: mon[4], m6: mon[5],
      m7: mon[6], m8: mon[7], m9: mon[8], m10: mon[9], m11: mon[10], m12: mon[11],
    };
    const summeJahr = mon.reduce((a, b) => a + b, 0);

    const { error: upErr } = await supabase
      .from('DB_Urlaub')
      .upsert(
        {
          user_id: userId,
          firma_id: firmaId,
          unit_id: unitId,
          jahr,
          ...payload,
          summe_jahr: summeJahr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,firma_id,unit_id,jahr' }
      );
    if (upErr) throw upErr;

   // console.log(`✅ Urlaub gespeichert: ${summeJahr} Tage`);
  } catch (err) {
    console.error('❌ Fehler bei Urlaubsberechnung:', err?.message || err);
  }
}
