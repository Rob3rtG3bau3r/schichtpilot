// Datei: src/components/Mobile/Utils/bedarfsauswertung.js
import dayjs from 'dayjs';
import { supabase } from '../../../supabaseClient';

export const ermittleBedarfUndStatus = async (userId, firma, unit, monat) => {
  const startDatum = dayjs(monat).startOf('month');
  const endDatum   = dayjs(monat).endOf('month');
  const start = startDatum.format('YYYY-MM-DD');
  const end   = endDatum.format('YYYY-MM-DD');

  const bedarfMap   = {}; // { datum: { F,S,N } }
  const belegungMap = {}; // { datum: { F,S,N } }
  const statusMap   = {}; // Rückgabe

  // 1) Bedarf laden (wie vorher) – nur betriebsrelevante Qualis zählen
  const { data: bedarfRaw, error: bedarfError } = await supabase
    .from('DB_Bedarf')
    .select('quali_id, anzahl, von, bis, normalbetrieb, quali_id(id, betriebs_relevant)')
    .eq('firma_id', firma)
    .eq('unit_id', unit);

  if (bedarfError) {
    console.error('❌ Fehler beim Laden des Bedarfs:', bedarfError.message);
    return {};
  }

  for (let tag = startDatum; tag.isBefore(endDatum.add(1, 'day')); tag = tag.add(1, 'day')) {
    const datum = tag.format('YYYY-MM-DD');
    bedarfMap[datum] = { F: 0, S: 0, N: 0 };

    for (const e of bedarfRaw || []) {
      const giltHeute =
        e.normalbetrieb ||
        (e.von && e.bis && datum >= e.von && datum <= e.bis);

      if (!giltHeute || !e.quali_id?.betriebs_relevant) continue;

      const add = parseInt(e.anzahl, 10) || 0;
      bedarfMap[datum].F += add;
      bedarfMap[datum].S += add;
      bedarfMap[datum].N += add;
    }
  }

  // 2) Belegung unit-weit aus v_tagesplan (NEU) – monatsweise, ggf. in 4 Ranges
  const daysInMonth = startDatum.daysInMonth();
  const dToStr = (d) => startDatum.date(d).format('YYYY-MM-DD');
  const q1 = Math.floor(daysInMonth / 4);
  const q2 = Math.floor(daysInMonth / 2);
  const q3 = Math.floor((3 * daysInMonth) / 4);
  const ranges = [
    [1, q1],
    [q1 + 1, q2],
    [q2 + 1, q3],
    [q3 + 1, daysInMonth],
  ].filter(([a, b]) => a <= b);

  const fetchViewRange = async (a, b) => {
    const { data, error } = await supabase
      .from('v_tagesplan')
      .select('datum, user_id, ist_schichtart_id')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', dToStr(a))
      .lte('datum', dToStr(b));

    if (error) {
      console.error('❌ v_tagesplan:', error.message || error);
      return [];
    }
    return data || [];
  };

  const chunks = await Promise.all(ranges.map(([a, b]) => fetchViewRange(a, b)));
  const viewRows = chunks.flat();

  // 2b) SchichtArt-IDs → Kürzel (F/S/N/…) mappen
  const schichtIds = Array.from(
    new Set(viewRows.map(r => r.ist_schichtart_id).filter(Boolean))
  );
  let idToKuerzel = new Map();
  if (schichtIds.length) {
    const { data: arts, error: artErr } = await supabase
      .from('DB_SchichtArt')
      .select('id, kuerzel')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .in('id', schichtIds);

    if (artErr) {
      console.error('❌ DB_SchichtArt:', artErr.message || artErr);
    } else {
      idToKuerzel = new Map((arts || []).map(a => [a.id, a.kuerzel]));
    }
  }

  // 3) Qualifikationen aller in der View vorkommenden Nutzer laden (betriebsrelevant)
  const userIds = Array.from(new Set(viewRows.map(r => String(r.user_id))));
  let relevanteUser = new Set();
  if (userIds.length) {
    const { data: qualiData, error: qErr } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali(betriebs_relevant)')
      .in('user_id', userIds);

    if (qErr) {
      console.error('❌ DB_Qualifikation:', qErr.message || qErr);
    } else {
      relevanteUser = new Set(
        (qualiData || [])
          .filter(q => q.quali?.betriebs_relevant)
          .map(q => String(q.user_id))
      );
    }
  }

  // 4) Belegung zählen (wie vorher) – aber aus der View + Mappings
  for (const r of viewRows) {
    const datum = dayjs(r.datum).format('YYYY-MM-DD');
    const kuerzel = r.ist_schichtart_id ? idToKuerzel.get(r.ist_schichtart_id) : null;
    const uid = String(r.user_id);

    if (!['F', 'S', 'N'].includes(kuerzel || '')) continue;
    if (!relevanteUser.has(uid)) continue;

    if (!belegungMap[datum]) belegungMap[datum] = { F: 0, S: 0, N: 0 };
    belegungMap[datum][kuerzel] += 1;
  }

  // 4b) Eigene Dienste-Map (für Überdeckung nur auf eigener Schicht prüfen)
  const eigeneMap = {};
  for (const r of viewRows) {
    if (String(r.user_id) !== String(userId)) continue;
    const datum = dayjs(r.datum).format('YYYY-MM-DD');
    const kuerzel = r.ist_schichtart_id ? idToKuerzel.get(r.ist_schichtart_id) : null;
    eigeneMap[datum] = kuerzel || '-';
  }

  // 5) Bewertung je Tag (identisch zu vorher)
  for (const tag in bedarfMap) {
    const soll = bedarfMap[tag];
    const ist  = belegungMap[tag] || { F: 0, S: 0, N: 0 };
    const userDienst = eigeneMap[tag] || '-';

    statusMap[tag] = { fehlendProSchicht: {}, ueber: [] };

    ['F', 'S', 'N'].forEach(schicht => {
      if (userDienst === '-') {
        // frei → Unterdeckung für alle Schichten anzeigen, die fehlen können
        if (ist[schicht] < soll[schicht]) statusMap[tag].fehlendProSchicht[schicht] = true;
      } else if (userDienst === schicht) {
        // eigener Dienst → Überdeckung nur auf eigener Schicht anzeigen
        if (ist[schicht] > soll[schicht]) statusMap[tag].ueber.push(schicht);
      }
    });
  }

  return statusMap;
};
