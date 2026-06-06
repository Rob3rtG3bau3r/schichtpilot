import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import {
  buildZusatzbedarfTermine,
  getZusatzbedarfStatusClass,
  getZusatzbedarfStatusText,
} from '../utils/zusatzbedarf/buildZusatzbedarfTermine';

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const userHatQualiAmTag = ({ userQualis, userId, qualiId, datum }) => {
  if (!qualiId) return true;

  const tag = dayjs(datum);
  const rows = userQualis.get(String(userId)) || [];

  return rows.some((q) => {
    if (Number(q.quali) !== Number(qualiId)) return false;

    const startOk = !q.quali_start || dayjs(q.quali_start).isSameOrBefore(tag, 'day');
    const endOk = !q.quali_endet || dayjs(q.quali_endet).isSameOrAfter(tag, 'day');

    return startOk && endOk;
  });
};

const buildTooltipText = ({
  item,
  datum,
  schichtart,
  quali,
  eingetragen,
  passendeUserNamen,
}) => {
  const lines = [];

  lines.push(item.name || 'Zusatzbedarf');
  lines.push('');
  lines.push(`Datum: ${dayjs(datum).format('DD.MM.YYYY')}`);
  lines.push(`Kürzel: ${schichtart?.kuerzel || '—'}`);
  lines.push(`Benötigt: ${Number(item.bedarf_delta || 0)} Person(en)`);
  lines.push(`Eingetragen: ${eingetragen} Person(en)`);

  if (quali) {
    lines.push(`Qualifikation: ${quali.quali_kuerzel ? `${quali.quali_kuerzel} · ` : ''}${quali.qualifikation}`);
  } else {
    lines.push('Qualifikation: keine benötigt');
  }

  if (item.beschreibung) {
    lines.push('');
    lines.push(`Beschreibung: ${item.beschreibung}`);
  }

  if (item.hinweis) {
    lines.push(`Hinweis: ${item.hinweis}`);
  }

  if (passendeUserNamen.length > 0) {
    lines.push('');
    lines.push('Eingetragen:');
    passendeUserNamen.forEach((name) => lines.push(`- ${name}`));
  }

  lines.push('');
  lines.push('Keine Arbeitszeit- oder Ruhezeitprüfung.');

  return lines.join('\n');
};

export const useZusatzbedarfStatus = ({
  firma,
  unit,
  tage,
  refreshKey = 0,
}) => {
  const [statusByDate, setStatusByDate] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const monthStart = useMemo(() => {
    if (!tage || tage.length === 0) return null;
    return tage[0];
  }, [tage]);

  const monthEnd = useMemo(() => {
    if (!tage || tage.length === 0) return null;
    return tage[tage.length - 1];
  }, [tage]);

  const ladeZusatzbedarfStatus = useCallback(async () => {
    if (!firma || !unit || !monthStart || !monthEnd || !tage?.length) {
      setStatusByDate({});
      return;
    }

    setLoading(true);
    setErrorText('');

    try {
      // 1) Zusatzbedarf laden
      const { data: sonderRows, error: sonderErr } = await supabase
        .from('DB_Sonderbedarf')
        .select(`
          id,
          name,
          quali_id,
          schichtart_id,
          bedarf_delta,
          freq,
          interval,
          byweekday,
          dtstart,
          until,
          aktiv,
          farbe,
          beschreibung,
          hinweis,
          ist_vorlage,
          anfrage_erlaubt
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true)
        .eq('ist_vorlage', false)
        .lte('dtstart', monthEnd)
        .gte('until', monthStart);

      if (sonderErr) throw sonderErr;

      const aktiveZusatzbedarfe = sonderRows || [];

      if (aktiveZusatzbedarfe.length === 0) {
        setStatusByDate({});
        setLoading(false);
        return;
      }

      const termineByDate = buildZusatzbedarfTermine({
        rows: aktiveZusatzbedarfe,
        tage,
      });

      // 2) Schichtarten laden
      const schichtartIds = [
        ...new Set(aktiveZusatzbedarfe.map((r) => r.schichtart_id).filter(Boolean)),
      ];

      let schichtartMap = {};
      if (schichtartIds.length > 0) {
        const { data: schichtarten, error: schichtErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, beschreibung')
          .in('id', schichtartIds);

        if (schichtErr) throw schichtErr;

        (schichtarten || []).forEach((s) => {
          schichtartMap[String(s.id)] = s;
        });
      }

      // 3) Qualifikationen laden
      const qualiIds = [
        ...new Set(aktiveZusatzbedarfe.map((r) => r.quali_id).filter(Boolean)),
      ];

      let qualiMap = {};
      if (qualiIds.length > 0) {
        const { data: qualis, error: qualiErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, quali_kuerzel')
          .in('id', qualiIds);

        if (qualiErr) throw qualiErr;

        (qualis || []).forEach((q) => {
          qualiMap[String(q.id)] = q;
        });
      }

      // 4) Kampfliste laden: dort zählen wir angenommene/eingetragene Personen
      const { data: kampfRows, error: kampfErr } = await supabase
        .from('DB_Kampfliste')
        .select('datum, user, ist_schicht')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .gte('datum', monthStart)
        .lte('datum', monthEnd)
        .in('ist_schicht', schichtartIds);

      if (kampfErr) throw kampfErr;

      const userIds = [
        ...new Set((kampfRows || []).map((r) => r.user).filter(Boolean)),
      ];

      // 5) Namen laden
      let userNameMap = {};
      if (userIds.length > 0) {
        for (const part of chunkArray(userIds, 150)) {
          const { data: userRows, error: userErr } = await supabase
            .from('DB_User')
            .select('user_id, vorname, nachname')
            .in('user_id', part);

          if (userErr) throw userErr;

          (userRows || []).forEach((u) => {
            const name = [u.vorname, u.nachname].filter(Boolean).join(' ').trim();
            userNameMap[String(u.user_id)] = name || u.nachname || `User ${u.user_id}`;
          });
        }
      }

      // 6) Qualis der eingetragenen User laden
      let userQualis = new Map();

      if (userIds.length > 0 && qualiIds.length > 0) {
        for (const part of chunkArray(userIds, 150)) {
          const { data: qualiRows, error: uqErr } = await supabase
            .from('DB_Qualifikation')
            .select('user_id, quali, quali_start, quali_endet')
            .in('user_id', part)
            .in('quali', qualiIds);

          if (uqErr) throw uqErr;

          (qualiRows || []).forEach((q) => {
            const key = String(q.user_id);
            const arr = userQualis.get(key) || [];
            arr.push(q);
            userQualis.set(key, arr);
          });
        }
      }

      // 7) Kampfliste nach Datum + Schichtart gruppieren
      const kampfByDateAndSchichtart = new Map();

      (kampfRows || []).forEach((r) => {
        const datum = String(r.datum || '').slice(0, 10);
        const key = `${datum}|${r.ist_schicht}`;
        const arr = kampfByDateAndSchichtart.get(key) || [];
        arr.push(r);
        kampfByDateAndSchichtart.set(key, arr);
      });

      // 8) Fertige Anzeigeobjekte bauen
      const next = {};

      for (const datum of tage) {
        const items = termineByDate[datum] || [];
        if (items.length === 0) continue;

        next[datum] = items.map((item) => {
          const key = `${datum}|${item.schichtart_id}`;
          const kampfFuerItem = kampfByDateAndSchichtart.get(key) || [];

          const passendeRows = kampfFuerItem.filter((r) =>
            userHatQualiAmTag({
              userQualis,
              userId: r.user,
              qualiId: item.quali_id,
              datum,
            })
          );

          // Pro Mitarbeiter nur einmal zählen
          const passendeUserIds = [
            ...new Set(passendeRows.map((r) => String(r.user)).filter(Boolean)),
          ];

          const eingetragen = passendeUserIds.length;
          const benoetigt = Number(item.bedarf_delta || 0);

          const schichtart = schichtartMap[String(item.schichtart_id)];
          const quali = item.quali_id ? qualiMap[String(item.quali_id)] : null;

          const passendeUserNamen = passendeUserIds.map(
            (uid) => userNameMap[uid] || `User ${uid}`
          );

          return {
            id: item.id,
            datum,
            name: item.name,
            schichtart_id: item.schichtart_id,
            kuerzel: schichtart?.kuerzel || '—',
            beschreibung: schichtart?.beschreibung || '',
            quali_id: item.quali_id || null,
            qualiName: quali?.qualifikation || null,
            qualiKuerzel: quali?.quali_kuerzel || null,
            benoetigt,
            eingetragen,
            fehlt: Math.max(benoetigt - eingetragen, 0),
            farbe: item.farbe || '#3b82f6',
            anfrageErlaubt: item.anfrage_erlaubt !== false,
            statusClass: getZusatzbedarfStatusClass({ benoetigt, eingetragen }),
            statusText: getZusatzbedarfStatusText({ benoetigt, eingetragen }),
            tooltipText: buildTooltipText({
              item,
              datum,
              schichtart,
              quali,
              eingetragen,
              passendeUserNamen,
            }),
            raw: item,
          };
        });
      }

      setStatusByDate(next);
    } catch (err) {
      console.error('Fehler beim Laden des Zusatzbedarf-Status:', err);
      setErrorText(err?.message || 'Fehler beim Laden des Zusatzbedarfs.');
      setStatusByDate({});
    } finally {
      setLoading(false);
    }
  }, [firma, unit, monthStart, monthEnd, tage, refreshKey]);

  useEffect(() => {
    ladeZusatzbedarfStatus();
  }, [ladeZusatzbedarfStatus]);

  return {
    zusatzbedarfStatus: statusByDate,
    loadingZusatzbedarf: loading,
    errorZusatzbedarf: errorText,
    reloadZusatzbedarfStatus: ladeZusatzbedarfStatus,
  };
};