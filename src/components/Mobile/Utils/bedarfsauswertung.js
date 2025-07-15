// Datei: bedarfsauswertung.js
import dayjs from 'dayjs';
import { supabase } from '../../../supabaseClient';

export const ermittleBedarfUndStatus = async (userId, firma, unit, monat) => {
  const startDatum = dayjs(monat).startOf('month');
  const endDatum = dayjs(monat).endOf('month');
  const start = startDatum.format('YYYY-MM-DD');
  const end = endDatum.format('YYYY-MM-DD');

  const bedarfMap = {}; // { datum: { F: anzahl, S: anzahl, N: anzahl } }
  const belegungMap = {}; // { datum: { F: anzahl, S: anzahl, N: anzahl } }
  const statusMap = {}; // Rueckgabe

  // 1. Lade Bedarf (nur betriebsrelevante)
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

    for (const eintrag of bedarfRaw) {
      const giltHeute = eintrag.normalbetrieb || (eintrag.von && eintrag.bis && datum >= eintrag.von && datum <= eintrag.bis);
      if (!giltHeute || !eintrag.quali_id?.betriebs_relevant) continue;

      bedarfMap[datum].F += parseInt(eintrag.anzahl);
      bedarfMap[datum].S += parseInt(eintrag.anzahl);
      bedarfMap[datum].N += parseInt(eintrag.anzahl);
    }
  }

  // 2. Lade Kampfliste gebatcht (alle User)
  const alleEintraege = [];
  let from = 0;
  let limit = 1000;
  while (true) {
    const { data: kampfBatch, error } = await supabase
      .from('DB_Kampfliste')
      .select('user, datum, ist_schicht(kuerzel)')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', start)
      .lte('datum', end)
      .range(from, from + limit - 1);

    if (error) {
      console.error('❌ Fehler beim Laden der Kampfliste:', error.message);
      return {};
    }
    if (!kampfBatch.length) break;
    alleEintraege.push(...kampfBatch);
    from += limit;
  }

  // 3. Lade Qualifikationen aller Nutzer
  const userIds = [...new Set(alleEintraege.map(e => e.user))];
  const { data: qualiData } = await supabase
    .from('DB_Qualifikation')
    .select('user_id, quali(betriebs_relevant)')
    .in('user_id', userIds);

  const relevanteUser = new Set(
    qualiData.filter(q => q.quali?.betriebs_relevant).map(q => q.user_id)
  );

  for (const eintrag of alleEintraege) {
    const datum = dayjs(eintrag.datum).format('YYYY-MM-DD');
    const schicht = eintrag.ist_schicht?.kuerzel;
    const user = eintrag.user;
    if (!['F', 'S', 'N'].includes(schicht)) continue;
    if (!relevanteUser.has(user)) continue;

    if (!belegungMap[datum]) belegungMap[datum] = { F: 0, S: 0, N: 0 };
    belegungMap[datum][schicht]++;
  }

  // 4. Hol für den eigenen User seine Einträge
  const eigene = alleEintraege.filter(e => e.user === userId);
  const eigeneMap = {};
  eigene.forEach(e => {
    eigeneMap[dayjs(e.datum).format('YYYY-MM-DD')] = e.ist_schicht?.kuerzel || '-';
  });

  // 5. Bewertung je Tag
  for (const tag in bedarfMap) {
    const soll = bedarfMap[tag];
    const ist = belegungMap[tag] || { F: 0, S: 0, N: 0 };
    const userDienst = eigeneMap[tag] || '-';

    statusMap[tag] = { fehlendProSchicht: {}, ueber: [] };

    ['F', 'S', 'N'].forEach(schicht => {
      if (userDienst === '-') {
        // frei → Unterdeckung prüfen
        if (ist[schicht] < soll[schicht]) statusMap[tag].fehlendProSchicht[schicht] = true;
      } else if (userDienst === schicht) {
        // Dienst → Überdeckung prüfen
        if (ist[schicht] > soll[schicht]) statusMap[tag].ueber.push(schicht);
      }
    });
  }

  // Nur für Debug: 15.07.2025 zeigen
  //const testTag = '2025-07-15';
  //console.log(`📅 Bedarf am ${testTag}:`, bedarfMap[testTag]);
  //console.log(`👥 Belegung am ${testTag}:`, belegungMap[testTag]);

  return statusMap;
};