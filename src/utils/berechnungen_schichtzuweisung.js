import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';

/**
 * Berechnet Ist-Stunden (dauer_ist) und Soll-Stunden (dauer_soll)
 * und schreibt beide in DB_Stunden.
 */
export const berechneAlleStundenFuerJahr = async (userId, jahr, firmaId, unitId) => {
  try {
    // Alle Einträge des Jahres holen (dauer_ist + dauer_soll)
    const { data, error } = await supabase
      .from('DB_Kampfliste')
      .select('datum, dauer_ist, dauer_soll')
      .eq('user', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .gte('datum', `${jahr}-01-01`)
      .lte('datum', `${jahr}-12-31`);

    if (error) throw error;

    // Monatsweise summieren
    const monateIst = Array(12).fill(0);
    const monateSoll = Array(12).fill(0);

    data.forEach(eintrag => {
      const mIndex = dayjs(eintrag.datum).month(); // 0-basiert
      monateIst[mIndex] += eintrag.dauer_ist || 0;
      monateSoll[mIndex] += eintrag.dauer_soll || 0;
    });

    const summeJahrIst = monateIst.reduce((sum, val) => sum + val, 0);
    const summeJahrSoll = monateSoll.reduce((sum, val) => sum + val, 0);

    // In DB schreiben
    const { error: upErr } = await supabase
      .from('DB_Stunden')
      .upsert({
        user_id: userId,
        firma_id: firmaId,
        unit_id: unitId,
        jahr,
        // Ist-Stunden
        m1: monateIst[0],
        m2: monateIst[1],
        m3: monateIst[2],
        m4: monateIst[3],
        m5: monateIst[4],
        m6: monateIst[5],
        m7: monateIst[6],
        m8: monateIst[7],
        m9: monateIst[8],
        m10: monateIst[9],
        m11: monateIst[10],
        m12: monateIst[11],
        summe_jahr: summeJahrIst,
        // Soll-Stunden
        soll_m1: monateSoll[0],
        soll_m2: monateSoll[1],
        soll_m3: monateSoll[2],
        soll_m4: monateSoll[3],
        soll_m5: monateSoll[4],
        soll_m6: monateSoll[5],
        soll_m7: monateSoll[6],
        soll_m8: monateSoll[7],
        soll_m9: monateSoll[8],
        soll_m10: monateSoll[9],
        soll_m11: monateSoll[10],
        soll_m12: monateSoll[11],
        summe_sollplan: summeJahrSoll,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,firma_id,unit_id,jahr' });

    if (upErr) throw upErr;

    //console.log(`✅ Ist/Soll-Stunden für ${jahr} aktualisiert: ${summeJahrIst}h / ${summeJahrSoll}h`);
  } catch (err) {
    console.error('❌ Fehler bei Stundenberechnung:', err.message);
  }
};

/**
 * Berechnet Urlaubstage für ein Jahr und schreibt sie in DB_Urlaub.
 */
export const berechneAlleUrlaubeFuerJahr = async (userId, jahr, firmaId, unitId) => {
  try {
    const { data: urlaubSchicht, error: uError } = await supabase
      .from('DB_SchichtArt')
      .select('id')
      .eq('kuerzel', 'U')
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .maybeSingle();

    if (uError || !urlaubSchicht) throw new Error('Schichtart "U" nicht gefunden');
    const urlaubId = urlaubSchicht.id;

    // Alle Urlaubstage des Jahres holen
    const { data: urlaubstage, error } = await supabase
      .from('DB_Kampfliste')
      .select('datum')
      .eq('user', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('ist_schicht', urlaubId)
      .gte('datum', `${jahr}-01-01`)
      .lte('datum', `${jahr}-12-31`);

    if (error) throw error;

    // Monate zählen
    const monate = Array(12).fill(0);
    urlaubstage.forEach(u => {
      const monthIndex = dayjs(u.datum).month();
      monate[monthIndex]++;
    });

    const summeJahr = monate.reduce((sum, val) => sum + val, 0);

    // In DB schreiben
    const { error: upErr } = await supabase
      .from('DB_Urlaub')
      .upsert({
        user_id: userId,
        firma_id: firmaId,
        unit_id: unitId,
        jahr,
        m1: monate[0],
        m2: monate[1],
        m3: monate[2],
        m4: monate[3],
        m5: monate[4],
        m6: monate[5],
        m7: monate[6],
        m8: monate[7],
        m9: monate[8],
        m10: monate[9],
        m11: monate[10],
        m12: monate[11],
        summe_jahr: summeJahr,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,firma_id,unit_id,jahr' });

    if (upErr) throw upErr;

    //console.log(`✅ Urlaubstage für ${jahr} aktualisiert: ${summeJahr} Tage`);
  } catch (err) {
    console.error('❌ Fehler bei Urlaubsberechnung:', err.message);
  }
};

/**
 * Führt Stunden- und Urlaubsberechnung für mehrere Jahre aus.
 */
export const berechneFuerJahre = async (userId, firmaId, unitId, startJahr, endJahr) => {
  for (let jahr = startJahr; jahr <= endJahr; jahr++) {
    await berechneAlleStundenFuerJahr(userId, jahr, firmaId, unitId);
    await berechneAlleUrlaubeFuerJahr(userId, jahr, firmaId, unitId);
  }
};
