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
    .eq('status', 'offen')
    .in('typ', typen);

  if (error) {
    console.error('Fehler loeseEskalationenAutomatisch:', error);
  }
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
      hinweis: `Arbeitszeit über 12 h: ${formatStunden(dauer)} h am ${dayjs(
        t.datum
      ).format('DD.MM.YYYY')} (${t.kuerzel}).`,
      dauerStunden: dauer,
      bezugVonDatum: t.datum,
      bezugBisDatum: t.datum,
      createdBy,
    });
  } else if (dauer >= 10) {
    aktiveTypen.push('ARBEITSZEIT_UEBER_10H');

    await speichereOffeneEskalation({
      firmaId,
      unitId,
      userId,
      datum: t.datum,
      typ: 'ARBEITSZEIT_UEBER_10H',
      hinweis: `Arbeitszeit über 10 h: ${formatStunden(dauer)} h am ${dayjs(
        t.datum
      ).format('DD.MM.YYYY')} (${t.kuerzel}).`,
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