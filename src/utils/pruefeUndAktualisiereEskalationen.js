import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { supabase } from '../supabaseClient';

dayjs.extend(duration);

const ARBEITSFREI_KUERZEL = ['-', 'U', 'K', 'KO'];

const istArbeitsTag = (kuerzel) => {
  if (!kuerzel) return false;
  return !ARBEITSFREI_KUERZEL.includes(kuerzel);
};

const buildDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  return dayjs(`${dateStr}T${timeStr}`);
};

const formatStunden = (wert) => {
  if (wert == null || Number.isNaN(Number(wert))) return '0,0';
  const rounded = Math.round(Number(wert) * 100) / 100;
  return String(rounded).replace('.', ',');
};

const getSchichtEndeDateTime = (datum, startzeit, endzeit) => {
  const start = buildDateTime(datum, startzeit);
  let ende = buildDateTime(datum, endzeit);

  if (!start || !ende) return null;

  // Beispiel Nacht: 22:00 - 06:00
  // Ende liegt dann am Folgetag.
  if (ende.isBefore(start)) {
    ende = ende.add(1, 'day');
  }

  return ende;
};

const ladeSchichtartenMap = async ({ firmaId, unitId }) => {
  const { data, error } = await supabase
    .from('DB_SchichtArt')
    .select('id, kuerzel, ignoriert_arbeitszeit')
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId);

  if (error) {
    console.error('Fehler ladeSchichtartenMap:', error);
    return new Map();
  }

  return new Map((data || []).map((s) => [s.id, s]));
};

const ladePlanFenster = async ({ userId, firmaId, unitId, von, bis }) => {
  const { data, error } = await supabase
    .from('v_tagesplan')
    .select(`
      datum,
      user_id,
      soll_schichtart_id,
      ist_schichtart_id,
      soll_startzeit,
      soll_endzeit,
      ist_startzeit,
      ist_endzeit,
      soll_dauer,
      ist_dauer,
      hat_aenderung
    `)
    .eq('user_id', userId)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .gte('datum', von)
    .lte('datum', bis)
    .order('datum', { ascending: true });

  if (error) {
    console.error('Fehler ladePlanFenster:', error);
    return [];
  }

  return data || [];
};


// Schneller Randtage-Loader für die Batch-Eskalationsprüfung.
// Ermittelt nur die konkret benötigten Tage direkt aus den Basistabellen.
// Die große View v_tagesplan wird dafür bewusst nicht verwendet.
const ladePlanRandtageDirekt = async ({
  userId,
  firmaId,
  unitId,
  daten,
}) => {
  const eindeutigeDaten = Array.from(
    new Set(
      (daten || [])
        .map((d) => String(d).slice(0, 10))
        .filter(Boolean)
    )
  );

  if (!eindeutigeDaten.length) {
    return {
      plan: [],
      schichtMap: new Map(),
      server: null,
    };
  }

  const { data, error } = await supabase.rpc(
    'sp_lade_plan_randtage',
    {
      p_firma_id: Number(firmaId),
      p_unit_id: Number(unitId),
      p_user_id: userId,
      p_dates: eindeutigeDaten,
    }
  );

  if (error) {
    console.error('sp_lade_plan_randtage fehlgeschlagen:', error);
    throw error;
  }

  const rows = data || [];

  const plan = rows.map((row) => ({
    datum: String(row.datum).slice(0, 10),
    user_id: userId,
    soll_schichtart_id: row.soll_schichtart_id ?? null,
    ist_schichtart_id: row.ist_schichtart_id ?? null,
    soll_startzeit: row.soll_startzeit ?? null,
    soll_endzeit: row.soll_endzeit ?? null,
    ist_startzeit: row.ist_startzeit ?? null,
    ist_endzeit: row.ist_endzeit ?? null,
    soll_dauer: row.soll_dauer ?? null,
    ist_dauer: row.ist_dauer ?? null,
    hat_aenderung: !!row.hat_aenderung,
  }));

  const schichtMap = new Map();

  for (const row of rows) {
    if (row.ist_schichtart_id != null) {
      schichtMap.set(row.ist_schichtart_id, {
        id: row.ist_schichtart_id,
        kuerzel: row.ist_kuerzel || '-',
        ignoriert_arbeitszeit: !!row.ist_ignoriert_arbeitszeit,
      });
    }

    if (
      row.soll_schichtart_id != null &&
      !schichtMap.has(row.soll_schichtart_id)
    ) {
      schichtMap.set(row.soll_schichtart_id, {
        id: row.soll_schichtart_id,
        kuerzel: row.soll_kuerzel || '-',
        ignoriert_arbeitszeit: !!row.soll_ignoriert_arbeitszeit,
      });
    }
  }

  return {
    plan,
    schichtMap,
    server: {
      angefragt: eindeutigeDaten.length,
      erhalten: rows.length,
    },
  };
};

const normalisiereTag = (tag, schichtMap) => {
  if (!tag) return null;

  const schichtId = tag.ist_schichtart_id || tag.soll_schichtart_id || null;
  const schicht = schichtId ? schichtMap.get(schichtId) : null;

  return {
    datum: tag.datum,
    schichtId,
    kuerzel: schicht?.kuerzel || '-',
    ignoriertArbeitszeit: !!schicht?.ignoriert_arbeitszeit,
    start: tag.ist_startzeit || tag.soll_startzeit || null,
    ende: tag.ist_endzeit || tag.soll_endzeit || null,
    dauer: tag.ist_dauer ?? tag.soll_dauer ?? null,
  };
};

const findeOffeneEskalation = async ({
  firmaId,
  unitId,
  userId,
  datum,
  typ,
  bezugVonDatum,
  bezugBisDatum,
}) => {
  let query = supabase
    .from('DB_Eskalation')
    .select('id')
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .eq('user_id', userId)
    .eq('datum', datum)
    .eq('typ', typ)
    .eq('status', 'offen')
    .limit(1);

  if (bezugVonDatum) query = query.eq('bezug_von_datum', bezugVonDatum);
  else query = query.is('bezug_von_datum', null);

  if (bezugBisDatum) query = query.eq('bezug_bis_datum', bezugBisDatum);
  else query = query.is('bezug_bis_datum', null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Fehler findeOffeneEskalation:', error);
    return null;
  }

  return data;
};

const speichereOffeneEskalation = async ({
  firmaId,
  unitId,
  userId,
  datum,
  typ,
  hinweis,
  kommentar = null,
  ruhezeitStunden = null,
  dauerStunden = null,
  bezugVonDatum = null,
  bezugBisDatum = null,
  createdBy = null,
}) => {
  const vorhanden = await findeOffeneEskalation({
    firmaId,
    unitId,
    userId,
    datum,
    typ,
    bezugVonDatum,
    bezugBisDatum,
  });

  const payload = {
    firma_id: firmaId,
    unit_id: unitId,
    user_id: userId,
    datum,
    typ,
    status: 'offen',
    hinweis,
    kommentar,
    ruhezeit_stunden: ruhezeitStunden,
    dauer_stunden: dauerStunden,
    bezug_von_datum: bezugVonDatum,
    bezug_bis_datum: bezugBisDatum,
    created_by: createdBy,
    updated_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
    resolved_reason: null,
  };

  if (vorhanden?.id) {
    const { error } = await supabase
      .from('DB_Eskalation')
      .update(payload)
      .eq('id', vorhanden.id);

    if (error) console.error('Fehler update Eskalation:', error);
    return;
  }

  const { error } = await supabase
    .from('DB_Eskalation')
    .insert(payload);

  if (error) console.error('Fehler insert Eskalation:', error);
};

const loeseEskalationenAutomatisch = async ({
  firmaId,
  unitId,
  userId,
  datum,
  typen,
  createdBy,
}) => {
  if (!typen?.length) return;

  const { error } = await supabase
    .from('DB_Eskalation')
    .update({
      status: 'automatisch_geloest',
      resolved_at: new Date().toISOString(),
      resolved_by: createdBy || null,
      resolved_reason: 'Eskalation nach erneuter Prüfung nicht mehr vorhanden.',
      updated_at: new Date().toISOString(),
    })
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .eq('user_id', userId)
    .eq('datum', datum)
    .in('status', ['offen', 'geprueft'])
    .in('typ', typen);

  if (error) {
    console.error('Fehler loeseEskalationenAutomatisch:', error);
  }
};

const loeseEskalationenAutomatischBulk = async ({
  firmaId, unitId, userId, daten, typen, createdBy,
}) => {
  const eindeutigeDaten = Array.from(new Set(
    (daten || []).map((d) => String(d).slice(0, 10)).filter(Boolean)
  ));
  if (!eindeutigeDaten.length || !typen?.length) return;

  const { error } = await supabase
    .from('DB_Eskalation')
    .update({
      status: 'automatisch_geloest',
      resolved_at: new Date().toISOString(),
      resolved_by: createdBy || null,
      resolved_reason: 'Eskalation nach erneuter Prüfung nicht mehr vorhanden.',
      updated_at: new Date().toISOString(),
    })
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .eq('user_id', userId)
    .in('datum', eindeutigeDaten)
    .in('status', ['offen', 'geprueft'])
    .in('typ', typen);

  if (error) console.error('Fehler loeseEskalationenAutomatischBulk:', error);
};

const pruefeRuhezeitZwischenTagen = async ({
  vorher,
  nachher,
  schichtMap,
  firmaId,
  unitId,
  userId,
  createdBy,
}) => {
  const a = normalisiereTag(vorher, schichtMap);
  const b = normalisiereTag(nachher, schichtMap);

  if (!a || !b) return false;

  if (a.ignoriertArbeitszeit || b.ignoriertArbeitszeit) return false;
  if (!istArbeitsTag(a.kuerzel) || !istArbeitsTag(b.kuerzel)) return false;
  if (!a.start || !a.ende || !b.start) return false;

  const endeVorher = getSchichtEndeDateTime(a.datum, a.start, a.ende);
  const startNachher = buildDateTime(b.datum, b.start);

  if (!endeVorher || !startNachher) return false;

  const ruhezeit = dayjs.duration(startNachher.diff(endeVorher)).asHours();

  if (ruhezeit < 11) {
    await speichereOffeneEskalation({
      firmaId,
      unitId,
      userId,
      datum: b.datum,
      typ: 'RUHEZEIT_UNTERSCHRITTEN',
      hinweis: `Ruhezeit unterschritten: nur ${formatStunden(ruhezeit)} h zwischen ${dayjs(
        a.datum
      ).format('DD.MM.YYYY')} (${a.kuerzel}) und ${dayjs(b.datum).format(
        'DD.MM.YYYY'
      )} (${b.kuerzel}).`,
      ruhezeitStunden: ruhezeit,
      bezugVonDatum: a.datum,
      bezugBisDatum: b.datum,
      createdBy,
    });

    return true;
  }

  return false;
};

const pruefeArbeitsdauer = async ({
  tag,
  schichtMap,
  firmaId,
  unitId,
  userId,
  createdBy,
}) => {
  const t = normalisiereTag(tag, schichtMap);
  if (!t) return [];

  if (t.ignoriertArbeitszeit) return [];
  if (!istArbeitsTag(t.kuerzel)) return [];
  if (!t.start || !t.ende) return [];

  const start = buildDateTime(t.datum, t.start);
  const ende = getSchichtEndeDateTime(t.datum, t.start, t.ende);

  if (!start || !ende) return [];

  const dauer = dayjs.duration(ende.diff(start)).asHours();
  const aktiveTypen = [];

if (dauer >= 12) {
  aktiveTypen.push('ARBEITSZEIT_UEBER_12H');

  await speichereOffeneEskalation({
    firmaId,
    unitId,
    userId,
    datum: t.datum,
    typ: 'ARBEITSZEIT_UEBER_12H',
    hinweis: `Arbeitszeit ab 12 h: ${formatStunden(dauer)} h am ${dayjs(
      t.datum
    ).format('DD.MM.YYYY')} (${t.kuerzel}). Betriebsleitung informieren.`,
    dauerStunden: dauer,
    bezugVonDatum: t.datum,
    bezugBisDatum: t.datum,
    createdBy,
  });
} else if (dauer > 10) {
  aktiveTypen.push('ARBEITSZEIT_UEBER_10H');

  await speichereOffeneEskalation({
    firmaId,
    unitId,
    userId,
    datum: t.datum,
    typ: 'ARBEITSZEIT_UEBER_10H',
    hinweis: `Arbeitszeit über 10 h: ${formatStunden(dauer)} h am ${dayjs(
      t.datum
    ).format('DD.MM.YYYY')} (${t.kuerzel}). Bitte prüfen/begründen.`,
    dauerStunden: dauer,
    bezugVonDatum: t.datum,
    bezugBisDatum: t.datum,
    createdBy,
  });
}

  return aktiveTypen;
};

export const pruefeUndAktualisiereEskalationen = async ({
  userId,
  firmaId,
  unitId,
  datum,
  createdBy,
}) => {
  if (!userId || !firmaId || !unitId || !datum) return;

  const start = dayjs(datum).subtract(2, 'day').format('YYYY-MM-DD');
  const ende = dayjs(datum).add(2, 'day').format('YYYY-MM-DD');

  const [plan, schichtMap] = await Promise.all([
    ladePlanFenster({
      userId,
      firmaId,
      unitId,
      von: start,
      bis: ende,
    }),
    ladeSchichtartenMap({
      firmaId,
      unitId,
    }),
  ]);

  const byDate = new Map(plan.map((p) => [p.datum, p]));

  const pruefTage = [
    dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD'),
    dayjs(datum).format('YYYY-MM-DD'),
    dayjs(datum).add(1, 'day').format('YYYY-MM-DD'),
  ];

  const alleTypen = [
    'RUHEZEIT_UNTERSCHRITTEN',
    'ARBEITSZEIT_UEBER_10H',
    'ARBEITSZEIT_UEBER_12H',
  ];

  for (const pruefDatum of pruefTage) {
    const vortag = dayjs(pruefDatum).subtract(1, 'day').format('YYYY-MM-DD');

    const aktiveTypen = [];

    const ruhezeitVorhanden = await pruefeRuhezeitZwischenTagen({
      vorher: byDate.get(vortag),
      nachher: byDate.get(pruefDatum),
      schichtMap,
      firmaId,
      unitId,
      userId,
      createdBy,
    });

    if (ruhezeitVorhanden) {
      aktiveTypen.push('RUHEZEIT_UNTERSCHRITTEN');
    }

    const dauerTypen = await pruefeArbeitsdauer({
      tag: byDate.get(pruefDatum),
      schichtMap,
      firmaId,
      unitId,
      userId,
      createdBy,
    });

    aktiveTypen.push(...dauerTypen);

    const nichtMehrAktiv = alleTypen.filter((typ) => !aktiveTypen.includes(typ));

    await loeseEskalationenAutomatisch({
      firmaId,
      unitId,
      userId,
      datum: pruefDatum,
      typen: nichtMehrAktiv,
      createdBy,
    });
  }
};
export const pruefeUndAktualisiereEskalationenBatchSave = async ({
  userId,
  firmaId,
  unitId,
  createdBy,
  savedRows = [],
  kuerzelNeu = null,
  ignoriertArbeitszeit = false,
}) => {
  if (!userId || !firmaId || !unitId || !Array.isArray(savedRows) || !savedRows.length) return;

  const perfStart =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const now = () =>
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  const rows = savedRows
    .map((row) => ({ ...row, datum: String(row.datum).slice(0, 10) }))
    .filter((row) => row.datum)
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));

  if (!rows.length) return;

  const dates = rows.map((row) => row.datum);
  const ersterTag = dates[0];
  const letzterTag = dates[dates.length - 1];
  const tagVorErstem = dayjs(ersterTag).subtract(1, 'day').format('YYYY-MM-DD');
  const tagNachLetztem = dayjs(letzterTag).add(1, 'day').format('YYYY-MM-DD');
  const arbeitszeitTypen = ['ARBEITSZEIT_UEBER_10H', 'ARBEITSZEIT_UEBER_12H'];
  const istArbeitszeitRelevant = !ignoriertArbeitszeit && istArbeitsTag(kuerzelNeu);

  const tVorbereitung = now();

  // U/K/KO/Frei: keine Arbeits- oder Ruhezeitprüfung nötig.
  if (!istArbeitszeitRelevant) {
    const tBulkStart = now();

    await Promise.all([
      loeseEskalationenAutomatischBulk({
        firmaId, unitId, userId, daten: dates, typen: arbeitszeitTypen, createdBy,
      }),
      loeseEskalationenAutomatischBulk({
        firmaId, unitId, userId, daten: [...dates, tagNachLetztem],
        typen: ['RUHEZEIT_UNTERSCHRITTEN'], createdBy,
      }),
    ]);

    const tEnde = now();

    console.log('[SP Detail] Eskalationen ohne Arbeitszeit', {
      vorbereitung_ms: Math.round((tVorbereitung - perfStart) * 10) / 10,
      bulkUpdates_ms: Math.round((tEnde - tBulkStart) * 10) / 10,
      gesamt_ms: Math.round((tEnde - perfStart) * 10) / 10,
    });

    return;
  }

  const ueber10Rows = [];
  const normaleRows = [];
  for (const row of rows) {
    const dauer = Number(row.dauer_ist);
    if (Number.isFinite(dauer) && dauer > 10) ueber10Rows.push(row);
    else normaleRows.push(row);
  }

  const jobs = [];
  if (normaleRows.length) {
    jobs.push(loeseEskalationenAutomatischBulk({
      firmaId, unitId, userId, daten: normaleRows.map((r) => r.datum),
      typen: arbeitszeitTypen, createdBy,
    }));
  }

  for (const row of ueber10Rows) {
    const dauer = Number(row.dauer_ist);
    const typ = dauer >= 12 ? 'ARBEITSZEIT_UEBER_12H' : 'ARBEITSZEIT_UEBER_10H';
    const gegenTyp = dauer >= 12 ? 'ARBEITSZEIT_UEBER_10H' : 'ARBEITSZEIT_UEBER_12H';

    jobs.push(speichereOffeneEskalation({
      firmaId, unitId, userId, datum: row.datum, typ,
      hinweis: dauer >= 12
        ? `Arbeitszeit ab 12 h: ${formatStunden(dauer)} h am ${dayjs(row.datum).format('DD.MM.YYYY')} (${kuerzelNeu}). Betriebsleitung informieren.`
        : `Arbeitszeit über 10 h: ${formatStunden(dauer)} h am ${dayjs(row.datum).format('DD.MM.YYYY')} (${kuerzelNeu}). Bitte prüfen/begründen.`,
      dauerStunden: dauer, bezugVonDatum: row.datum, bezugBisDatum: row.datum, createdBy,
    }));

    jobs.push(loeseEskalationenAutomatisch({
      firmaId, unitId, userId, datum: row.datum, typen: [gegenTyp], createdBy,
    }));
  }

  const tArbeitszeitStart = now();
  await Promise.all(jobs);
  const tArbeitszeitEnde = now();

  const tPlanStart = now();
  const {
    plan,
    schichtMap,
    server: randtageServer,
  } = await ladePlanRandtageDirekt({
    userId,
    firmaId,
    unitId,
    daten: [
      tagVorErstem,
      ersterTag,
      letzterTag,
      tagNachLetztem,
    ],
  });
  const tPlanEnde = now();

  const byDate = new Map((plan || []).map((p) => [p.datum, p]));

  const tGrenzenStart = now();
  const [linksAktiv, rechtsAktiv] = await Promise.all([
    pruefeRuhezeitZwischenTagen({
      vorher: byDate.get(tagVorErstem), nachher: byDate.get(ersterTag),
      schichtMap, firmaId, unitId, userId, createdBy,
    }),
    pruefeRuhezeitZwischenTagen({
      vorher: byDate.get(letzterTag), nachher: byDate.get(tagNachLetztem),
      schichtMap, firmaId, unitId, userId, createdBy,
    }),
  ]);
  const tGrenzenEnde = now();

  const tCleanupStart = now();
  await loeseEskalationenAutomatischBulk({
    firmaId, unitId, userId,
    daten: [
      ...rows.slice(1).map((r) => r.datum),
      ...(!linksAktiv ? [ersterTag] : []),
      ...(!rechtsAktiv ? [tagNachLetztem] : []),
    ],
    typen: ['RUHEZEIT_UNTERSCHRITTEN'],
    createdBy,
  });
  const tEnde = now();

  console.log('[SP Detail] Eskalationsprüfung intern', {
    tage: rows.length,
    langeDienste: ueber10Rows.length,
    vorbereitung_ms: Math.round((tVorbereitung - perfStart) * 10) / 10,
    arbeitszeitUpdates_ms: Math.round((tArbeitszeitEnde - tArbeitszeitStart) * 10) / 10,
    randtageDirekt_ms: Math.round((tPlanEnde - tPlanStart) * 10) / 10,
    randtageServer,
    ruhezeitGrenzen_ms: Math.round((tGrenzenEnde - tGrenzenStart) * 10) / 10,
    cleanup_ms: Math.round((tEnde - tCleanupStart) * 10) / 10,
    gesamt_ms: Math.round((tEnde - perfStart) * 10) / 10,
  });
};

