// Datei: src/components/Mobile/Utils/bedarfsauswertung.js
import dayjs from 'dayjs';
import { supabase } from '../../../supabaseClient';

// Mapping & Helper für Schichtgrenzen
const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { 'Früh': 0, 'Spät': 1, 'Nacht': 2 };

function schichtInnerhalbGrenzen(b, datumISO, schLabel /* 'Früh'|'Spät'|'Nacht' */) {
  // Grenzen gelten nur für zeitlich begrenzte Einträge (normalbetrieb=false)
  if (b.normalbetrieb) return true;

  const startLabel = b.start_schicht || 'Früh';
  const endLabel   = b.end_schicht   || 'Nacht';
  const sIdx = SCH_INDEX[schLabel];
  const startIdx = SCH_INDEX[startLabel];
  const endIdx   = SCH_INDEX[endLabel];

  // Falls genau auf Start-/Endtag, Kantenbehandlung
  const amStart = b.von && datumISO === b.von;
  const amEnde  = b.bis && datumISO === b.bis;

  if (amStart && amEnde) return sIdx >= startIdx && sIdx <= endIdx;
  if (amStart)           return sIdx >= startIdx;
  if (amEnde)            return sIdx <= endIdx;
  return true;
}

function bedarfGiltFuerSchicht(b, datumISO, schKey /* 'F'|'S'|'N' */) {
  // Zeitfenster-Check
  if (b.von && datumISO <  b.von) return false;
  if (b.bis && datumISO >  b.bis) return false;

  const schLabel = SCH_LABEL[schKey]; // 'Früh'|'Spät'|'Nacht'
  if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

  // schichtart=null => ganztägig (gilt für alle Schichten)
  if (b.schichtart == null) return true;
  return b.schichtart === schLabel;
}

/**
 * Ermittelt pro Kalendertag den Bedarf (mit neuen Regeln) und die Belegung,
 * und gibt ein Status-Objekt zurück:
 * {
 *   'YYYY-MM-DD': {
 *     fehlendProSchicht: { F?: true, S?: true, N?: true },
 *     ueber: ['F'|'S'|'N', ...]
 *   },
 *   ...
 * }
 *
 * - Bedarf: DB_Bedarf (betriebsrelevante Qualis), pro Schicht/Tag:
 *   Wenn es "zeitlich begrenzte" Einträge gibt -> nur diese zählen; sonst Normalbetrieb.
 *   schichtart=null => Bedarf gilt für alle Schichten, sonst nur die eine Schicht.
 *   start_schicht/end_schicht begrenzen am Start-/Endtag die Schichtspanne.
 *
 * - Belegung: aus v_tagesplan (unit-weit), auf F/S/N gemappt (via DB_SchichtArt.kuerzel)
 *   und gefiltert auf Nutzer mit einer betriebsrelevanten Quali.
 *
 * - Bewertung:
 *   - Wenn User frei ('-'): fehlendProSchicht[schicht]=true bei Unterdeckung
 *   - Wenn User Dienst in Schicht X: ueber enthält X, falls Überdeckung
 */
export const ermittleBedarfUndStatus = async (userId, firma, unit, monat) => {
  const startDatum = dayjs(monat).startOf('month');
  const endDatum   = dayjs(monat).endOf('month');
  const start = startDatum.format('YYYY-MM-DD');
  const end   = endDatum.format('YYYY-MM-DD');

  const bedarfMap   = {}; // { datum: { F,S,N } }
  const belegungMap = {}; // { datum: { F,S,N } }
  const statusMap   = {}; // Rückgabe

  // -----------------------------
  // 1) Bedarf laden (mit Feldern + betriebsrelevant via Rel)
  // -----------------------------
  // HINWEIS: Falls eure Relation anders heißt, den Select anpassen.
  // Ziel: Zugriff auf ein Flag "betriebs_relevant" je Bedarfseintrag.
  const { data: bedarfRaw, error: bedarfError } = await supabase
    .from('DB_Bedarf')
    .select(`
      id,
      quali_id,
      anzahl,
      von,
      bis,
      normalbetrieb,
      schichtart,
      start_schicht,
      end_schicht,
      quali:DB_Qualifikationsmatrix!inner(
        id,
        betriebs_relevant
      )
    `)
    .eq('firma_id', firma)
    .eq('unit_id', unit);

  if (bedarfError) {
    console.error('❌ Fehler beim Laden des Bedarfs:', bedarfError.message || bedarfError);
    return {};
  }

  // -----------------------------
  // 2) Bedarf pro Tag + Schicht bilden (neue Regeln)
  // -----------------------------
  for (let tag = startDatum; tag.isSameOrBefore(endDatum, 'day'); tag = tag.add(1, 'day')) {
    const datum = tag.format('YYYY-MM-DD');
    bedarfMap[datum] = { F: 0, S: 0, N: 0 };

    // Kandidaten im Zeitfenster und betriebsrelevant filtern (Tag-agnostisch)
    const imFenster = (bedarfRaw || []).filter((b) => {
      if (!b?.quali?.betriebs_relevant) return false;
      // Zeitfenster wird schichtgenau später geprüft (bedarfGiltFuerSchicht),
      // hier nur grob: mind. irgendeine Relevanz am Tag (lassen wir offen).
      // Wir filtern erst unten pro Schicht exakt.
      return true;
    });

    // pro Schicht anwenden
    (['F', 'S', 'N']).forEach((schKey) => {
      // 1) Nur Bedarfe, die für diese Schicht am Tag gelten
      const tagSchicht = imFenster.filter((b) => bedarfGiltFuerSchicht(b, datum, schKey));

      // 2) Vorrang-Regel: wenn es irgendeinen zeitlich begrenzten Bedarf gibt,
      //    dann zählen NUR diese; sonst die Normalbetriebe.
      const hatZeitlich = tagSchicht.some((b) => b.normalbetrieb === false);
      const wirksam = tagSchicht.filter((b) => b.normalbetrieb === !hatZeitlich);

      // 3) Summe bilden
      const sum = wirksam.reduce((acc, b) => acc + (parseInt(b.anzahl, 10) || 0), 0);
      bedarfMap[datum][schKey] = sum;
    });
  }

  // ---------------------------------------------
  // 3) Belegung unit-weit aus v_tagesplan (ranged)
  // ---------------------------------------------
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

  // 3b) SchichtArt-IDs → Kürzel (F/S/N/…) mappen
  const schichtIds = Array.from(
    new Set(viewRows.map((r) => r.ist_schichtart_id).filter(Boolean))
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
      idToKuerzel = new Map((arts || []).map((a) => [a.id, a.kuerzel]));
    }
  }

  // ---------------------------------------------
  // 4) Nutzer mit betriebsrelevanter Quali herausfiltern
  // ---------------------------------------------
  const userIds = Array.from(new Set(viewRows.map((r) => String(r.user_id))));
  let relevanteUser = new Set();
  if (userIds.length) {
    // HINWEIS: Relation ggf. anpassen, Ziel ist: je user_id mind. eine Quali mit betriebs_relevant=true
    const { data: qualiData, error: qErr } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali(betriebs_relevant)')
      .in('user_id', userIds);

    if (qErr) {
      console.error('❌ DB_Qualifikation:', qErr.message || qErr);
    } else {
      relevanteUser = new Set(
        (qualiData || [])
          .filter((q) => q?.quali?.betriebs_relevant)
          .map((q) => String(q.user_id))
      );
    }
  }

  // ---------------------------------------------
  // 5) Belegung zählen (nur F/S/N & nur relevante User)
  // ---------------------------------------------
  for (const r of viewRows) {
    const datum = dayjs(r.datum).format('YYYY-MM-DD');
    const kuerzel = r.ist_schichtart_id ? idToKuerzel.get(r.ist_schichtart_id) : null;
    const uid = String(r.user_id);

    if (!['F', 'S', 'N'].includes(kuerzel || '')) continue;
    if (!relevanteUser.has(uid)) continue;

    if (!belegungMap[datum]) belegungMap[datum] = { F: 0, S: 0, N: 0 };
    belegungMap[datum][kuerzel] += 1;
  }

  // ---------------------------------------------
  // 6) Eigene Dienste-Map (für Überdeckung nur eigene Schicht bewerten)
  // ---------------------------------------------
  const eigeneMap = {};
  for (const r of viewRows) {
    if (String(r.user_id) !== String(userId)) continue;
    const datum = dayjs(r.datum).format('YYYY-MM-DD');
    const kuerzel = r.ist_schichtart_id ? idToKuerzel.get(r.ist_schichtart_id) : null;
    eigeneMap[datum] = kuerzel || '-';
  }

  // ---------------------------------------------
  // 7) Bewertung je Tag
  // ---------------------------------------------
  for (const tag in bedarfMap) {
    const soll = bedarfMap[tag]; // {F,S,N}
    const ist  = belegungMap[tag] || { F: 0, S: 0, N: 0 };
    const userDienst = eigeneMap[tag] || '-';

    statusMap[tag] = { fehlendProSchicht: {}, ueber: [] };

    (['F', 'S', 'N']).forEach((schicht) => {
      if (userDienst === '-') {
        // frei → Unterdeckung auf allen Schichten anzeigen, wo sie existiert
        if (ist[schicht] < soll[schicht]) statusMap[tag].fehlendProSchicht[schicht] = true;
      } else if (userDienst === schicht) {
        // im Dienst → nur Überdeckung auf eigener Schicht interessiert
        if (ist[schicht] > soll[schicht]) statusMap[tag].ueber.push(schicht);
      }
    });
  }

  return statusMap;
};
