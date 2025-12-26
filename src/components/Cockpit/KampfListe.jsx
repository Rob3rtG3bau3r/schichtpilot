// src/components/Dashboard/KampfListe.jsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import 'dayjs/locale/de';
import { Crown } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';
import QualiModal from '../Cockpit/QualiModal';
import SchichtDienstAendernForm from './SchichtDienstAendernForm';

dayjs.locale('de');

const currentUserId = localStorage.getItem('user_id');

// --- Helper: K/KO maskieren ---
const maskKuerzelForEmployer = (kuerzel, cellUserId, role, me) => {
  if (role === 'Employee' && (kuerzel === 'K' || kuerzel === 'KO') && String(cellUserId) !== String(me)) {
    return '-';
  }
  return kuerzel || '-';
};

// --- Helper: 1..10 → I..X (0 → '–', >10 → 'X') ---
const toRoman = (num) => {
  if (!num || num <= 0) return '–';
  if (num >= 10) return 'X';
  const map = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  return map[num];
};

// --- Helper: Zahlen hübsch formatieren ---
const fmt2 = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : '–';
};

const KampfListe = ({
  jahr,
  monat,
  setPopupOffen,
  setAusgewählterDienst,
  reloadkey,
  sichtbareGruppen,
  setGruppenZähler,
  onRefreshMitarbeiterBedarf,
  dayRefreshDatum, dayRefreshKey,
}) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();
  const istNurLesend = rolle === 'Employee';

  const [eintraege, setEintraege] = useState([]);
  const [tage, setTage] = useState([]); // [{ date, tag, wochentag }]
  const [popupEintrag, setPopupEintrag] = useState(null);
  const heutigesDatum = dayjs().format('YYYY-MM-DD');

  // Globale Auswahl aus dem Kalender (Selection kann bleiben, nur keine Wochenlogik)
  const [selectedDates, setSelectedDates] = useState(new Set());
  useEffect(() => {
    const onSel = (e) => setSelectedDates(new Set(e.detail?.selected || []));
    window.addEventListener('sp:selectedDates', onSel);
    return () => window.removeEventListener('sp:selectedDates', onSel);
  }, []);

  const [qualiModalOffen, setQualiModalOffen] = useState(false);
  const [modalUser, setModalUser] = useState({ id: null, name: '' });

  // Map userId -> betriebsrelevante Quali-Anzahl
  const [qualiCountMap, setQualiCountMap] = useState({});

  // Urlaub & Stunden (gesamt/summe/rest)
  const [urlaubInfoMap, setUrlaubInfoMap] = useState({});
  const [stundenInfoMap, setStundenInfoMap] = useState({});

  // Ausgrauen: Map userId -> [{von, bis}]
  const [ausgrauenByUser, setAusgrauenByUser] = useState(new Map());

  // 🔒 Stabiler Tooltip: Name-Spalte
  const [hoveredUserId, setHoveredUserId] = useState(null);
  const hideTimerRef = useRef(null);
  const showTipFor = (id) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setHoveredUserId(id);
  };
  const scheduleHideTip = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHoveredUserId(null), 120);
  };

  // 🔒 Stabiler Tooltip: Zellen (Datum/Zeit/Kommentar)
  const [hoveredCellKey, setHoveredCellKey] = useState(null); // `${userId}|${datum}`
  const cellHideTimerRef = useRef(null);
  const showCellTip = (key) => {
    if (cellHideTimerRef.current) clearTimeout(cellHideTimerRef.current);
    setHoveredCellKey(key);
  };
  const scheduleHideCellTip = () => {
    if (cellHideTimerRef.current) clearTimeout(cellHideTimerRef.current);
    cellHideTimerRef.current = setTimeout(() => setHoveredCellKey(null), 120);
  };

  // ---- Datum-Prefix (Monatsbasis) ----
  const prefix = `${jahr}-${String(monat + 1).padStart(2, '0')}`;

  // 🔁 Spalten/Tage: immer kompletter Monat
  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const datum = new Date(jahr, monat, tag);
      neueTage.push({
        date: dayjs(datum).format('YYYY-MM-DD'),
        tag,
        wochentag: datum.toLocaleDateString('de-DE', { weekday: 'short' }),
      });
    }
    setTage(neueTage);
  }, [jahr, monat]);

  // --- Quali-Counts laden (gültig am cutoff) ---
  const ladeQualiCounts = async (userIds, firmaId, unitId, cutoffIso) => {
    if (!userIds?.length) return {};
    try {
      const ids = userIds.map(String);

      const { data, error } = await supabase
        .from('DB_Qualifikation')
        .select(`
          user_id,
          quali,
          quali_start,
          quali_endet,
          matrix:DB_Qualifikationsmatrix!inner(
            id,
            quali_kuerzel,
            betriebs_relevant,
            aktiv,
            firma_id,
            unit_id
          )
        `)
        .in('user_id', ids)
        .eq('matrix.firma_id', firmaId)
        .eq('matrix.unit_id', unitId)
        .eq('matrix.betriebs_relevant', true)
        .eq('matrix.aktiv', true);

      if (error) {
        console.error('❌ Quali-Join fehlgeschlagen:', error.message || error);
        return {};
      }

      const cutoff = dayjs(cutoffIso);
      const isValidOn = (row) => {
        const startOk = !row.quali_start || dayjs(row.quali_start).isSameOrBefore(cutoff, 'day');
        const endOk = !row.quali_endet || dayjs(row.quali_endet).isSameOrAfter(cutoff, 'day');
        return startOk && endOk;
      };

      const map = {};
      for (const row of data || []) {
        if (!isValidOn(row)) continue;
        const uid = String(row.user_id);
        map[uid] = (map[uid] || 0) + 1;
      }
      return map;
    } catch (e) {
      console.error('❌ Fehler beim Laden der Quali-Counts:', e);
      return {};
    }
  };

  // --- Prüfen, ob User an date (YYYY-MM-DD) ausgegraut ist ---
  const isGrey = (uid, dateISO) => {
    const arr = ausgrauenByUser.get(String(uid));
    if (!arr || arr.length === 0) return false;
    const d = dayjs(dateISO);
    for (const r of arr) {
      const von = dayjs(r.von);
      const bis = r.bis ? dayjs(r.bis) : null;
      const inRange = d.isSameOrAfter(von, 'day') && (!bis || d.isSameOrBefore(bis, 'day'));
      if (inRange) return true;
    }
    return false;
  };
  // ✅ Nur EINEN Tag nachladen und in die bestehende Tabelle "einpatchen"
  const ladeNurTag = async (dateISO) => {
    try {
      if (!firma || !unit || !dateISO) return;

      const d = String(dateISO).slice(0, 10);

      // 1) Nur diesen Tag aus v_tagesplan
      const selectCols =
        'datum, user_id, ist_schichtart_id, ist_startzeit, ist_endzeit, ' +
        'hat_aenderung, kommentar, ist_created_at, ist_created_by';

      const { data: viewRows, error: vErr } = await supabase
        .from('v_tagesplan')
        .select(selectCols)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('datum', d);

      if (vErr) {
        console.error('❌ Fehler v_tagesplan (Tag):', vErr.message || vErr);
        return;
      }

      const rows = viewRows || [];

      // 2) Schichtarten für diesen Tag (Farben/Kürzel)
      const schichtIds = Array.from(
        new Set(rows.map((r) => r.ist_schichtart_id).filter((x) => x != null))
      );

      let schichtMap = new Map();
      if (schichtIds.length) {
        const { data: schichten, error: sErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, farbe_bg, farbe_text')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('id', schichtIds);

        if (sErr) {
          console.error('❌ Fehler DB_SchichtArt (Tag):', sErr.message || sErr);
        } else {
          schichtMap = new Map((schichten || []).map((s) => [s.id, s]));
        }
      }

      // 3) Userinfos (nur für user_id + created_by aus diesem Tag)
      const userIds = rows.map((r) => r.user_id).filter(Boolean);
      const createdByIds = rows.map((r) => r.ist_created_by).filter(Boolean);
      const alleUserIds = Array.from(new Set([...userIds, ...createdByIds])).map(String);

      let userById = new Map();
      if (alleUserIds.length) {
        const { data: userInfos, error: uErr } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname, rolle')
          .in('user_id', alleUserIds);

        if (uErr) {
          console.error('❌ Fehler DB_User (Tag):', uErr.message || uErr);
        } else {
          userById = new Map((userInfos || []).map((u) => [String(u.user_id), u]));
        }
      }

      // 4) Map für schnelle Updates: uid -> cellData
      const cellByUser = new Map();
      for (const r of rows) {
        const uid = String(r.user_id);

        const s = r.ist_schichtart_id ? schichtMap.get(r.ist_schichtart_id) : null;
        const creatorId = r.ist_created_by ? String(r.ist_created_by) : null;
        const creatorInfo = creatorId ? userById.get(creatorId) : null;

        cellByUser.set(uid, {
          kuerzel: s?.kuerzel || '-',
          bg: s?.farbe_bg || '',
          text: s?.farbe_text || '',
          created_by: creatorId,
          created_by_name: creatorInfo
            ? `${creatorInfo.vorname} ${creatorInfo.nachname} (${creatorInfo.rolle})`
            : 'Unbekannt',
          created_at: r.ist_created_at || null,
          ist_schicht_id: s?.id || null,
          beginn: r.ist_startzeit || '',
          ende: r.ist_endzeit || '',
          aenderung: !!r.hat_aenderung,
          kommentar: r.kommentar || null,
        });
      }

      // 5) PATCH in den bestehenden State:
      //    - Erst diesen Tag bei allen sichtbaren Usern löschen
      //    - Dann für User mit Daten neu setzen
      setEintraege((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;

        return prev.map(([uid, row]) => {
          const userIdStr = String(uid);

          // Kopie row + tage
          const nextRow = { ...row, tage: { ...(row?.tage || {}) } };

          // Tag erstmal leeren
          delete nextRow.tage[d];

          // falls es Daten für diesen user gibt → setzen
          const cell = cellByUser.get(userIdStr);
          if (cell) {
            nextRow.tage[d] = cell;
          }

          return [uid, nextRow];
        });
      });
    } catch (e) {
      console.error('❌ ladeNurTag Exception:', e);
    }
  };

  useEffect(() => {
    const ladeKampfliste = async () => {
      if (!firma || !unit) return;

      const daysInMonth = new Date(jahr, monat + 1, 0).getDate();
      const monthStart = `${prefix}-01`;
      const monthEnd = dayjs(new Date(jahr, monat + 1, 0)).format('YYYY-MM-DD');

      // ---- v_tagesplan laden: immer Monatsansicht in 4 Chunks (gegen 999-Limit) ----
      let viewRows = [];
      const selectCols =
        'datum, user_id, ist_schichtart_id, ist_startzeit, ist_endzeit, ' +
        'hat_aenderung, kommentar, ist_created_at, ist_created_by';

      const q1 = Math.floor(daysInMonth / 4);
      const q2 = Math.floor(daysInMonth / 2);
      const q3 = Math.floor((3 * daysInMonth) / 4);

      const dayToDate = (d) => `${prefix}-${String(d).padStart(2, '0')}`;

      const ranges = [
        [1, q1],
        [q1 + 1, q2],
        [q2 + 1, q3],
        [q3 + 1, daysInMonth],
      ].filter(([a, b]) => a <= b);

      const fetchViewRange = async (startDate, endDate) => {
        const { data, error } = await supabase
          .from('v_tagesplan')
          .select(selectCols)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .gte('datum', startDate)
          .lte('datum', endDate);
        if (error) {
          console.error('❌ Fehler v_tagesplan (Monat):', error.message || error);
          return [];
        }
        return data || [];
      };

      const viewChunks = await Promise.all(
        ranges.map(([a, b]) => fetchViewRange(dayToDate(a), dayToDate(b)))
      );
      viewRows = viewChunks.flat();

      // ---- Schichtarten (Farben/Kürzel) laden ----
      const schichtIds = Array.from(
        new Set((viewRows || []).map((r) => r.ist_schichtart_id).filter((x) => x != null))
      );
      let schichtMap = new Map();
      if (schichtIds.length) {
        const { data: schichten, error: sErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, farbe_bg, farbe_text')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('id', schichtIds);
        if (sErr) {
          console.error('❌ Fehler DB_SchichtArt:', sErr.message || sErr);
        } else {
          schichtMap = new Map((schichten || []).map((s) => [s.id, s]));
        }
      }

      // ---- View → kampfData-Form ----
      const kampfData = (viewRows || [])
        .filter((r) => {
          if (!monthStart || !monthEnd) return true;
          const d = r.datum;
          return d >= monthStart && d <= monthEnd;
        })
        .map((r) => ({
          id: null,
          datum: r.datum,
          created_by: r.ist_created_by || null,
          created_at: r.ist_created_at || null,
          startzeit_ist: r.ist_startzeit || '',
          endzeit_ist: r.ist_endzeit || '',
          user: r.user_id,
          kommentar: r.kommentar || null,
          aenderung: !!r.hat_aenderung,
          ist_schicht: (() => {
            const s = r.ist_schichtart_id ? schichtMap.get(r.ist_schichtart_id) : null;
            return s
              ? { id: s.id, kuerzel: s.kuerzel, farbe_bg: s.farbe_bg, farbe_text: s.farbe_text }
              : { id: null, kuerzel: '-', farbe_bg: '', farbe_text: '' };
          })(),
        }));

      const userIds = kampfData.map((e) => e.user).filter(Boolean);
      const createdByIds = kampfData.map((e) => e.created_by).filter(Boolean);
      const alleUserIds = [...new Set([...userIds, ...createdByIds])].map(String);
      const idsSet = new Set(alleUserIds);
      if (alleUserIds.length === 0) {
        setEintraege([]);
        setGruppenZähler({});
        return;
      }

      // ---- Userinfos ----
      const { data: userInfos, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle')
        .in('user_id', alleUserIds);
      if (userError) {
        console.error('❌ Fehler beim Laden der Userdaten:', userError.message || userError);
        return;
      }
      const userById = new Map((userInfos || []).map((u) => [String(u.user_id), u]));

      // ---- Ausgrauen-Fenster laden (alle, die mit dem Zeitraum überlappen) ----
      const { data: ausRows, error: ausErr } = await supabase
        .from('DB_Ausgrauen')
        .select('user_id, von, bis')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user_id', alleUserIds)
        .lte('von', monthEnd)
        .or(`bis.is.null, bis.gte.${monthStart}`);

      if (ausErr) {
        console.error('❌ Fehler DB_Ausgrauen:', ausErr.message || ausErr);
      }

      const mapAus = new Map();
      for (const uid of alleUserIds) mapAus.set(String(uid), []);
      for (const r of ausRows || []) {
        const uid = String(r.user_id);
        const arr = mapAus.get(uid) || [];
        arr.push({ von: r.von, bis: r.bis || null });
        mapAus.set(uid, arr);
      }
      for (const [uid, arr] of mapAus) {
        arr.sort((a, b) => dayjs(a.von).diff(dayjs(b.von)));
      }
      setAusgrauenByUser(mapAus);

      // ---- Quali-Counts ----
      const cutoffIso = dayjs(monthEnd).endOf('day').toISOString();
      const qualiMap = await ladeQualiCounts(alleUserIds, firma, unit, cutoffIso);
      setQualiCountMap(qualiMap);

      // ---- Urlaub & Stunden ----
      const jahrNum = Number(jahr) || new Date().getFullYear();
      const [urlaubRes, stundenRes] = await Promise.all([
        supabase
          .from('DB_Urlaub')
          .select('user_id, jahr, urlaub_gesamt, summe_jahr')
          .eq('jahr', jahrNum)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', alleUserIds),
        supabase
          .from('DB_Stunden')
          .select('user_id, jahr, stunden_gesamt, summe_jahr, uebernahme_vorjahr')
          .eq('jahr', jahrNum)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', alleUserIds),
      ]);
      if (urlaubRes.error)
        console.error('❌ DB_Urlaub Fehler:', urlaubRes.error.message || urlaubRes.error);

      const urlaubInfo = {};
      for (const r of urlaubRes.data || []) {
        const uid = String(r.user_id);
        if (!idsSet.has(uid)) continue;
        const gesamt = Number(r.urlaub_gesamt) || 0;
        const summe = Number(r.summe_jahr) || 0;
        urlaubInfo[uid] = { summe, gesamt, rest: gesamt - summe };
      }
      setUrlaubInfoMap(urlaubInfo);

      if (stundenRes.error)
        console.error('❌ DB_Stunden Fehler:', stundenRes.error.message || stundenRes.error);
      const stundenInfo = {};
      for (const r of stundenRes.data || []) {
        const uid = String(r.user_id);
        if (!idsSet.has(uid)) continue;
        const gesamt = Number(r.stunden_gesamt) || 0;
        const summeJahr = Number(r.summe_jahr) || 0;
        const uebernahme = Number(r.uebernahme_vorjahr) || 0;
        const istInklVorjahr = summeJahr + uebernahme;
        const rest = istInklVorjahr - gesamt;
        stundenInfo[uid] = { summe: istInklVorjahr, gesamt, rest };
      }
      setStundenInfoMap(stundenInfo);

      // ---- Schichtzuweisungen (für Schichtgruppe/Position) ----
      const { data: zuwRaw, error: zuwErr } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, position_ingruppe, von_datum, bis_datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user_id', alleUserIds)
        .lte('von_datum', monthEnd);
      if (zuwErr) {
        console.error('❌ Fehler beim Laden der Zuweisungen:', zuwErr.message || zuwErr);
      }

      const zuwMonat = (zuwRaw || []).filter(
        (z) => !z.bis_datum || dayjs(z.bis_datum).isSameOrAfter(monthStart, 'day')
      );
      const zuwByUser = new Map();
      for (const z of zuwMonat) {
        const uid = String(z.user_id);
        const arr = zuwByUser.get(uid) || [];
        arr.push(z);
        zuwByUser.set(uid, arr);
      }
      for (const [, arr] of zuwByUser) {
        arr.sort((a, b) => (a.von_datum < b.von_datum ? -1 : 1));
      }

      const getAssnForDate = (uid, datum) => {
        const arr = zuwByUser.get(String(uid)) || [];
        let best = null;
        for (const r of arr) {
          const ok =
            dayjs(r.von_datum).isSameOrBefore(datum, 'day') &&
            (!r.bis_datum || dayjs(r.bis_datum).isSameOrAfter(datum, 'day'));
          if (ok && (!best || r.von_datum > best.von_datum)) best = r;
        }
        return best;
      };

      // ---- Gruppieren: Key = datumIso ----
      const gruppiert = {};
      for (const k of kampfData) {
        const datumIso = k.datum;
        const userIdStr = String(k.user);
        const creatorId = k.created_by ? String(k.created_by) : null;

        const userInfo = userById.get(userIdStr);
        const creatorInfo = creatorId ? userById.get(creatorId) : null;
        if (!userInfo) continue;

        const assnToday = getAssnForDate(userIdStr, heutigesDatum);
        const assnAtCell = assnToday || getAssnForDate(userIdStr, datumIso);
        const rowSchichtgruppe = assnToday?.schichtgruppe || assnAtCell?.schichtgruppe || null;
        const rowPosition = assnToday?.position_ingruppe ?? assnAtCell?.position_ingruppe ?? 999;

        if (!gruppiert[userIdStr]) {
          const greyToday = isGrey(userIdStr, heutigesDatum);
          gruppiert[userIdStr] = {
            schichtgruppe: rowSchichtgruppe,
            position: rowPosition,
            rolle: userInfo.rolle,
            name: `${userInfo.vorname?.charAt(0) || '?'}. ${userInfo.nachname || ''}`,
            vollName: `${userInfo.vorname || ''} ${userInfo.nachname || ''}`,
            tage: {},
            qualiCount: qualiMap[userIdStr] || 0,
            greyToday,
          };
        }

        gruppiert[userIdStr].tage[datumIso] = {
          kuerzel: k.ist_schicht?.kuerzel || '-',
          bg: k.ist_schicht?.farbe_bg || '',
          text: k.ist_schicht?.farbe_text || '',
          created_by: creatorId,
          created_by_name: creatorInfo
            ? `${creatorInfo.vorname} ${creatorInfo.nachname} (${creatorInfo.rolle})`
            : 'Unbekannt',
          created_at: k.created_at || null,
          ist_schicht_id: k.ist_schicht?.id || null,
          beginn: k.startzeit_ist || '',
          ende: k.endzeit_ist || '',
          aenderung: k.aenderung || false,
          kommentar: k.kommentar || null,
        };
      }

      // ---- Gruppenzähler ----
      const zaehler = {};
      for (const [, e] of Object.entries(gruppiert)) {
        if (e.greyToday) continue;
        const gruppe = e.schichtgruppe || 'Unbekannt';
        zaehler[gruppe] = (zaehler[gruppe] || 0) + 1;
      }
      setGruppenZähler(zaehler);

      // Sichtbare Gruppen filtern
      Object.keys(gruppiert).forEach((key) => {
        if (!sichtbareGruppen.includes(gruppiert[key].schichtgruppe)) {
          delete gruppiert[key];
        }
      });

      // Sortierung Gruppe -> Position
      const sortiert = Object.entries(gruppiert).sort(([, a], [, b]) => {
        const schichtSort = (a.schichtgruppe || '').localeCompare(b.schichtgruppe || '');
        return schichtSort !== 0 ? schichtSort : (a.position ?? 999) - (b.position ?? 999);
      });

      setEintraege(sortiert);
    };

    ladeKampfliste();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, unit, jahr, monat, reloadkey, sichtbareGruppen, setGruppenZähler]);
  // ✅ Tages-Refresh (nur ein Datum patchen)
  useEffect(() => {
    if (!firma || !unit) return;
    if (!dayRefreshKey) return;         // nur wenn wirklich getriggert
    if (!dayRefreshDatum) return;

    ladeNurTag(dayRefreshDatum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayRefreshKey]);

  return (
    <div className="bg-gray-200 text-black dark:bg-gray-800 dark:text-white rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 pb-6">
      <div className="w-full" style={{ overflowX: 'visible', overflowY: 'visible' }}>
        <div className="flex min-w-fit relative" style={{ overflow: 'visible' }}>
          {/* linke Namensspalte */}
          <div className="flex flex-col w-[176px] min-w-[176px] flex-shrink-0" style={{ overflow: 'visible' }}>
            {eintraege.map(([userId, e], index) => {
              const vorherige = index > 0 ? eintraege[index - 1][1] : null;
              const neueGruppe = vorherige?.schichtgruppe !== e.schichtgruppe;

              let kroneFarbe = '';
              if (e.rolle === 'Team_Leader') {
                if (e.position === 1) kroneFarbe = 'text-yellow-400';
                else if (e.position === 2) kroneFarbe = 'text-gray-400';
                else kroneFarbe = 'text-amber-600';
              }

              const count = e.qualiCount ?? qualiCountMap[userId] ?? 0;
              const roman = toRoman(count);

              const urlaub = urlaubInfoMap[userId] || { gesamt: null, summe: null, rest: null };
              const stunden = stundenInfoMap[userId] || { gesamt: null, summe: null, rest: null };

              const darfTooltipSehen = rolle !== 'Employee' || String(userId) === String(currentUserId);
              const showTip = darfTooltipSehen && hoveredUserId === userId;

              return (
                <div
                  key={userId}
                  className={`relative h-[20px] flex items-center px-2 border-b truncate rounded-md cursor-default
                    ${index % 2 === 0 ? 'bg-gray-300 dark:bg-gray-700/40' : 'bg-gray-100 dark:bg-gray-700/20'}
                    ${neueGruppe ? 'mt-2' : ''}
                    border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                    ${e.greyToday ? 'opacity-50' : ''} hover:z-[9999]`}
                  style={{ overflow: 'visible' }}
                >
                  <span
                    className="flex-1 relative hover:underline cursor-pointer"
                    onClick={() => {
                      setModalUser({ id: userId, name: e.vollName });
                      setQualiModalOffen(true);
                    }}
                    onMouseEnter={() => showTipFor(userId)}
                    onMouseLeave={scheduleHideTip}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {e.name}

                    {showTip && (
                      <div
                        className="absolute left-full top-1/2 ml-2 -translate-y-1/2 z-[9999]"
                        onMouseEnter={() => showTipFor(userId)}
                        onMouseLeave={scheduleHideTip}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <div className="relative w-[256px] px-3 py-2 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10
                                        bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 font-mono text-xs">
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45
                                          bg-white/95 dark:bg-gray-900/95 ring-1 ring-black/10 dark:ring-white/10" />
                          <div className="font-sans font-semibold mb-1 truncate">{e.vollName}</div>

                          <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 items-baseline">
                            <div className="font-sans text-gray-500 dark:text-gray-400">Urlaub</div>
                            <div className="text-right text-gray-500 dark:text-gray-400">
                              [{fmt2(urlaub.gesamt)} – {fmt2(urlaub.summe)}]
                            </div>
                            <div
                              className={`text-right font-semibold ${
                                (urlaub.rest ?? 0) < 0 ? 'text-red-600' : 'text-emerald-500'
                              }`}
                            >
                              {fmt2(urlaub.rest)}
                            </div>

                            <div className="font-sans text-gray-500 dark:text-gray-400">Stunden</div>
                            <div className="text-right text-gray-500 dark:text-gray-400">
                              [{fmt2(stunden.gesamt)} – {fmt2(stunden.summe)}]
                            </div>
                            <div
                              className={`text-right font-semibold ${
                                (stunden.rest ?? 0) < 0 ? 'text-red-600' : 'text-emerald-500'
                              }`}
                            >
                              {fmt2(stunden.rest)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </span>

                  <span className="ml-1">
                    {e.rolle === 'Team_Leader' ? (
                      <Crown size={14} className={kroneFarbe} title="Team-Leader" />
                    ) : (
                      <span
                        className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-[2px]
                                   text-[10px] leading-none rounded-sm border
                                   bg-white text-gray-800 border-gray-300
                                   dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                        title={`betriebsrelevante Qualifikationen: ${count}`}
                        style={{ fontVariantNumeric: 'normal' }}
                      >
                        {roman}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* rechte Kalenderspalten */}
          <div className="flex flex-col gap-[2px]" style={{ overflow: 'visible' }}>
            {eintraege.map(([userId, e], index) => {
              const vorherige = index > 0 ? eintraege[index - 1][1] : null;
              const neueGruppe = vorherige?.schichtgruppe !== e.schichtgruppe;

              return (
                <div
                  key={userId}
                  className={`flex gap-[2px] ${neueGruppe ? 'mt-2' : ''}`}
                  style={{ overflow: 'visible' }}
                >
                  {tage.map((t) => {
                    const zellenDatum = t.date;
                    const eintragTag = e.tage[zellenDatum];
                    const isSelected = selectedDates.has(zellenDatum);
                    const istHeute = zellenDatum === heutigesDatum;
                    const zelleGrey = isGrey(userId, zellenDatum);

                    return (
                      <div
                        key={zellenDatum}
                        className={`relative group w-[48px] min-w-[48px] h-[18px] text-center border-b flex items-center justify-center rounded cursor-pointer
                          ${istHeute ? 'ring-2 ring-yellow-400' : ''}
                          ${isSelected ? 'ring-1 ring-orange-400 ring-offset-[1px] ring-offset-transparent' : ''}
                          border-gray-300 dark:border-gray-700
                          ${!eintragTag ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : ''}
                          ${zelleGrey ? 'opacity-50' : ''}`}
                        style={{
                          ...(eintragTag ? { backgroundColor: eintragTag.bg, color: eintragTag.text } : {}),
                          overflow: 'visible',
                        }}
                        onMouseEnter={() => {
                          if (eintragTag?.beginn || eintragTag?.ende || eintragTag?.kommentar) {
                            const key = `${userId}|${zellenDatum}`;
                            showCellTip(key);
                          }
                        }}
                        onMouseLeave={scheduleHideCellTip}
                        onClick={async () => {
                          if (istNurLesend) return;

                          const { data: assn } = await supabase
                            .from('DB_SchichtZuweisung')
                            .select('schichtgruppe')
                            .eq('firma_id', firma)
                            .eq('unit_id', unit)
                            .eq('user_id', userId)
                            .lte('von_datum', zellenDatum)
                            .or(`bis_datum.is.null, bis_datum.gte.${zellenDatum}`)
                            .order('von_datum', { ascending: false })
                            .limit(1);

                          const schichtgruppeAtDate =
                            assn && assn.length ? assn[0].schichtgruppe : e.schichtgruppe;

                          const eintragObjekt = {
                            user: userId,
                            name: e.vollName,
                            datum: zellenDatum,
                            soll_schicht: null,
                            ist_schicht: maskKuerzelForEmployer(
                              eintragTag?.kuerzel,
                              userId,
                              rolle,
                              currentUserId
                            ),
                            ist_schicht_id: eintragTag?.ist_schicht_id || null,
                            beginn: eintragTag?.beginn || '',
                            ende: eintragTag?.ende || '',
                            schichtgruppe: schichtgruppeAtDate,
                            created_by: eintragTag?.created_by,
                            created_by_name: eintragTag?.created_by_name,
                            created_at: eintragTag?.created_at,
                            kommentar: eintragTag?.kommentar || '',
                          };

                          setPopupEintrag(eintragObjekt);
                          setAusgewählterDienst(eintragObjekt);
                          setPopupOffen(true);
                        }}
                      >
                        {eintragTag?.aenderung && (
                          <>
                            <div
                              className="absolute top-0 right-0 w-0 h-0"
                              style={{ borderTop: '12px solid white', borderLeft: '12px solid transparent', zIndex: 5 }}
                            />
                            <div
                              className="absolute top-0 right-0 w-0 h-0"
                              style={{
                                borderTop: '10px solid #ed0606f7',
                                borderLeft: '10px solid transparent',
                                zIndex: 10,
                              }}
                            />
                          </>
                        )}

                        {eintragTag?.kommentar && (
                          <>
                            <div
                              className="absolute top-0 left-0 w-0 h-0"
                              style={{ borderTop: '12px solid white', borderRight: '12px solid transparent', zIndex: 5 }}
                            />
                            <div
                              className="absolute top-0 left-0 w-0 h-0"
                              style={{
                                borderTop: '10px solid #d64a04ff',
                                borderRight: '10px solid transparent',
                                zIndex: 10,
                              }}
                            />
                          </>
                        )}

                        {(() => {
                          const key = `${userId}|${zellenDatum}`;
                          const show =
                            hoveredCellKey === key &&
                            (eintragTag?.beginn || eintragTag?.ende || eintragTag?.kommentar);
                          if (!show) return null;
                          const datumLabel = dayjs(zellenDatum).format('dddd DD.MM.YYYY');
                          return (
                            <div
                              className="absolute left-full top-1/2 ml-2 -translate-y-1/2 z-[9999]"
                              onMouseEnter={() => showCellTip(key)}
                              onMouseLeave={scheduleHideCellTip}
                              style={{ pointerEvents: 'auto' }}
                            >
                              <div className="relative w-[260px] px-3 py-2 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10
                                              bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 text-xs">
                                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45
                                                bg-white/95 dark:bg-gray-900/95 ring-1 ring-black/10 dark:ring-white/10" />
                                <div className="text-[11px] text-gray-500 dark:text-gray-200 mb-1">{datumLabel}</div>
                                <div className="text-xs font-sans font-semibold mb-0.5">{e.vollName}</div>
                                {(eintragTag?.beginn || eintragTag?.ende) && (
                                  <div className="font-mono">
                                    {eintragTag?.beginn || '–'} – {eintragTag?.ende || '–'}
                                  </div>
                                )}
                                {eintragTag?.kommentar && (
                                  <div className="mt-1 whitespace-pre-wrap break-words">{eintragTag.kommentar}</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {eintragTag ? (
                          <span className="text-xs font-medium">
                            {maskKuerzelForEmployer(eintragTag.kuerzel, userId, rolle, currentUserId)}
                          </span>
                        ) : (
                          <span className="text-gray-500">–</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <QualiModal
        offen={qualiModalOffen}
        onClose={() => setQualiModalOffen(false)}
        userId={modalUser.id}
        userName={modalUser.name}
      />

      {popupEintrag && !istNurLesend && (
        <SchichtDienstAendernForm
          eintrag={popupEintrag}
          onClose={() => {
            setPopupOffen(false);
            setPopupEintrag(null);
          }}
          onRefresh={() => {
            if (onRefreshMitarbeiterBedarf) onRefreshMitarbeiterBedarf();
          }}
        />
      )}
    </div>
  );
};

export default KampfListe;
