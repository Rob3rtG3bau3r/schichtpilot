import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';

export const berechneUndSpeichereStunden = async (userId, jahr, monat, firmaId, unitId) => {
  try {
    // Start- und Enddatum korrekt bestimmen
    const startDatum = `${jahr}-${String(monat).padStart(2, '0')}-01`;
    const endDatum = dayjs(startDatum).endOf('month').format('YYYY-MM-DD');

    // Alle Einträge für diesen Monat holen
    const { data, error } = await supabase
      .from('DB_Kampfliste')
      .select('dauer_ist')
      .eq('user', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .gte('datum', startDatum)
      .lte('datum', endDatum);

    if (error) throw error;

    // Summe der Stunden berechnen
    const summeMonat = data.reduce((acc, eintrag) => acc + (eintrag.dauer_ist || 0), 0);

    // Bisherige Stunden für dieses Jahr laden
    const { data: record, error: getError } = await supabase
      .from('DB_Stunden')
      .select('*')
      .eq('user_id', userId)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('jahr', jahr)
      .maybeSingle();

    if (getError) throw getError;

    // Bestehende Monatswerte + aktueller Monat
    const monate = {
      m1: record?.m1 || 0,
      m2: record?.m2 || 0,
      m3: record?.m3 || 0,
      m4: record?.m4 || 0,
      m5: record?.m5 || 0,
      m6: record?.m6 || 0,
      m7: record?.m7 || 0,
      m8: record?.m8 || 0,
      m9: record?.m9 || 0,
      m10: record?.m10 || 0,
      m11: record?.m11 || 0,
      m12: record?.m12 || 0,
    };
    monate[`m${monat}`] = summeMonat;

    // Jahressumme neu berechnen
    const summeJahr = Object.values(monate).reduce((sum, val) => sum + (val || 0), 0);

    // Upsert in DB_Stunden
    const { error: upErr } = await supabase
      .from('DB_Stunden')
      .upsert(
        {
          user_id: userId,
          firma_id: firmaId,
          unit_id: unitId,
          jahr,
          ...monate,
          summe_jahr: summeJahr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,firma_id,unit_id,jahr' }
      );

    if (upErr) throw upErr;

    console.log(`✅ Stunden aktualisiert: Monat ${monat}, ${summeMonat}h, Gesamtjahr ${summeJahr}h`);
  } catch (err) {
    console.error('❌ Fehler bei Stundenberechnung:', err.message);
  }
};


export async function berechneUndSpeichereUrlaub(userId, jahr, firmaId, unitId) {
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

    // Monate zählen (immer bei 0 starten)
    const monate = Array(12).fill(0);
    urlaubstage.forEach(u => {
      const monthIndex = dayjs(u.datum).month(); // 0-basiert
      monate[monthIndex] = (monate[monthIndex] || 0) + 1;
    });

    // Neue Monatsdaten setzen
    const neueMonate = {
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
    };

    // Jahressumme
    const summeJahr = monate.reduce((sum, val) => sum + val, 0);

    // In DB schreiben
    const { error: upErr } = await supabase
      .from('DB_Urlaub')
      .upsert({
        user_id: userId,
        firma_id: firmaId,
        unit_id: unitId,
        jahr,
        ...neueMonate,
        summe_jahr: summeJahr,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,firma_id,unit_id,jahr' });

    if (upErr) throw upErr;
    console.log(`✅ Urlaub aktualisiert: ${summeJahr} Tage`);
  } catch (err) {
    console.error('❌ Fehler bei Urlaubsberechnung:', err.message);
  }
}