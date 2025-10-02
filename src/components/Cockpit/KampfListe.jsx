// src/components/Dashboard/KampfListe.jsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
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
}) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();
  const istNurLesend = rolle === 'Employee';

  const [eintraege, setEintraege] = useState([]);
  const [tage, setTage] = useState([]);
  const [popupEintrag, setPopupEintrag] = useState(null);
  const heutigesDatum = dayjs().format('YYYY-MM-DD');

  const [qualiModalOffen, setQualiModalOffen] = useState(false);
  const [modalUser, setModalUser] = useState({ id: null, name: '' });

  // Map userId -> betriebsrelevante Quali-Anzahl
  const [qualiCountMap, setQualiCountMap] = useState({});

  // Urlaub & Stunden (gesamt/summe/rest)
  const [urlaubInfoMap, setUrlaubInfoMap] = useState({});
  const [stundenInfoMap, setStundenInfoMap] = useState({});

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

  // ---- (2) Datum-Strings & Labels einmal erzeugen (useMemo) ----
  const prefix = `${jahr}-${String(monat + 1).padStart(2, '0')}`;

  const dateStrByTag = React.useMemo(() => {
    const days = new Date(jahr, monat + 1, 0).getDate();
    const arr = Array.from({ length: days + 1 });
    for (let d = 1; d <= days; d++) {
      arr[d] = `${prefix}-${String(d).padStart(2, '0')}`;
    }
    return arr;
  }, [jahr, monat, prefix]);

  const dateLabelByTag = React.useMemo(() => {
    const days = new Date(jahr, monat + 1, 0).getDate();
    const arr = Array.from({ length: days + 1 });
    for (let d = 1; d <= days; d++) {
      arr[d] = dayjs(dateStrByTag[d]).format('dddd DD.MM.YYYY');
    }
    return arr;
  }, [jahr, monat, dateStrByTag]);

  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const datum = new Date(jahr, monat, tag);
      const wochentag = datum.toLocaleDateString('de-DE', { weekday: 'short' });
      neueTage.push({ tag, wochentag });
    }
    setTage(neueTage);
  }, [jahr, monat]);

  useEffect(() => {
    const ladeKampfliste = async () => {
      if (!firma || !unit) return;

      const daysInMonth = new Date(jahr, monat + 1, 0).getDate();
      const datumsliste = dateStrByTag.slice(1, daysInMonth + 1);

      // Zeitraum für die Zuweisungen dieses Monats
      const monthStart = `${prefix}-01`;
      const monthEnd = dayjs(new Date(jahr, monat + 1, 0)).format('YYYY-MM-DD');

      const ladeKampflisteBatchweise = async () => {
        let alleEintraege = [];
        const batchSize = 1000;
        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabase
            .from('DB_Kampfliste')
            .select(
              'id, datum, created_by, created_at, startzeit_ist, endzeit_ist, user, kommentar, aenderung, ist_schicht(id, kuerzel, farbe_bg, farbe_text)'
            )
            .in('datum', datumsliste)
            .eq('firma_id', firma)
            .eq('unit_id', unit)
            .order('created_at', { ascending: false })
            .range(i * batchSize, (i + 1) * batchSize - 1);

          if (error) {
            console.error(`❌ Fehler in Batch ${i}:`, error.message || error);
            continue;
          }
          alleEintraege = [...alleEintraege, ...data];
          if (data.length < batchSize) break;
        }
        return alleEintraege;
      };

      let kampfData = await ladeKampflisteBatchweise();

      const userIds = kampfData.map((e) => e.user).filter(Boolean);
      const createdByIds = kampfData.map((e) => e.created_by).filter(Boolean);
      const alleUserIds = [...new Set([...userIds, ...createdByIds])].map(String);
      const idsSet = new Set(alleUserIds);

      if (alleUserIds.length === 0) return;

      // --- Userinfos laden ---
      const { data: userInfos, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle, user_visible')
        .in('user_id', alleUserIds);

      if (userError) {
        console.error('❌ Fehler beim Laden der Userdaten:', userError.message || userError);
        return;
      }

      // O(1) Lookup
      const userById = new Map((userInfos || []).map((u) => [String(u.user_id), u]));

      // --- Quali-Counts laden (gültig bis inklusive Monatsende) ---
      const cutoffIso = dayjs(new Date(jahr, monat + 1, 0)).endOf('day').toISOString();
      const qualiMap = await ladeQualiCounts(alleUserIds, firma, unit, cutoffIso);
      setQualiCountMap(qualiMap);

      // --- Urlaub & Stunden laden ---
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
          .select('user_id, jahr, stunden_gesamt, summe_jahr')
          .eq('jahr', jahrNum)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', alleUserIds),
      ]);

      if (urlaubRes.error) console.error('❌ DB_Urlaub Fehler:', urlaubRes.error.message || urlaubRes.error);
      if (stundenRes.error) console.error('❌ DB_Stunden Fehler:', stundenRes.error.message || stundenRes.error);

      const urlaubInfo = {};
      for (const r of urlaubRes.data || []) {
        const uid = String(r.user_id);
        if (!idsSet.has(uid)) continue;
        const gesamt = Number(r.urlaub_gesamt) || 0;
        const summe = Number(r.summe_jahr) || 0;
        urlaubInfo[uid] = { summe, gesamt, rest: gesamt - summe };
      }
      setUrlaubInfoMap(urlaubInfo);

      const stundenInfo = {};
      for (const r of stundenRes.data || []) {
        const uid = String(r.user_id);
        if (!idsSet.has(uid)) continue;
        const gesamt = Number(r.stunden_gesamt) || 0;
        const summe = Number(r.summe_jahr) || 0;
        stundenInfo[uid] = { summe, gesamt, rest: summe - gesamt };
      }
      setStundenInfoMap(stundenInfo);

      // --- NEU: Schichtzuweisungen für den Monat laden (Quelle für Schicht & Position) ---
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

      // Nur Zuweisungen, die den Monat berühren
      const zuwMonat = (zuwRaw || []).filter(
        (z) => !z.bis_datum || dayjs(z.bis_datum).isSameOrAfter(monthStart, 'day')
      );

      // Map: user_id -> Array von Intervallen
      const zuwByUser = new Map();
      for (const z of zuwMonat) {
        const uid = String(z.user_id);
        const arr = zuwByUser.get(uid) || [];
        arr.push(z);
        zuwByUser.set(uid, arr);
      }
      // pro User nach Startdatum sortieren
      for (const [uid, arr] of zuwByUser) {
        arr.sort((a, b) => (a.von_datum < b.von_datum ? -1 : 1));
      }

      // Helper: Zuweisung (Schichtgruppe & Position) am Datum ermitteln
      const getAssnForDate = (uid, datum) => {
        const arr = zuwByUser.get(String(uid)) || [];
        let best = null;
        for (const r of arr) {
          const ok =
            dayjs(r.von_datum).isSameOrBefore(datum, 'day') &&
            (!r.bis_datum || dayjs(r.bis_datum).isSameOrAfter(datum, 'day'));
          if (ok && (!best || r.von_datum > best.von_datum)) {
            best = r;
          }
        }
        return best; // {schichtgruppe, position_ingruppe, ...} | null
      };

      // --- Gruppieren ---
      const gruppiert = {};

      for (const k of kampfData) {
        const tag = dayjs(k.datum).date();
        const userId = String(k.user);
        const creatorId = String(k.created_by);

        const userInfo = userById.get(userId);
        const creatorInfo = userById.get(creatorId);
        if (!userInfo) continue;

        // 👉 NEU: Schicht & Position aus Zuweisung (heute als Leitwert; wenn nicht vorhanden, am Zellen-Datum)
        const assnToday = getAssnForDate(userId, heutigesDatum);
        const assnAtCell = assnToday || getAssnForDate(userId, k.datum);
        const rowSchichtgruppe = assnToday?.schichtgruppe || assnAtCell?.schichtgruppe || null;
        const rowPosition = assnToday?.position_ingruppe ?? assnAtCell?.position_ingruppe ?? 999;

        if (!gruppiert[userId]) {
          gruppiert[userId] = {
            schichtgruppe: rowSchichtgruppe,
            position: rowPosition,
            rolle: userInfo.rolle,
            user_visible: userInfo.user_visible || false,
            name: `${userInfo.vorname?.charAt(0) || '?'}. ${userInfo.nachname || ''}`,
            vollName: `${userInfo.vorname || ''} ${userInfo.nachname || ''}`,
            tage: {},
            qualiCount: qualiMap[userId] || 0,
          };
        }

        gruppiert[userId].tage[tag] = {
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

      // Zähler pro Schichtgruppe (auf Basis "heute" / Leitwert)
      const zaehler = {};
      for (const [, e] of Object.entries(gruppiert)) {
        const gruppe = e.schichtgruppe || 'Unbekannt';
        zaehler[gruppe] = (zaehler[gruppe] || 0) + 1;
      }
      setGruppenZähler(zaehler);

      // Nur sichtbare Gruppen behalten (ebenfalls Leitwert)
      Object.keys(gruppiert).forEach((key) => {
        if (!sichtbareGruppen.includes(gruppiert[key].schichtgruppe)) {
          delete gruppiert[key];
        }
      });

      // Sortierung nach Schichtgruppe, dann Positionswert
      const sortiert = Object.entries(gruppiert).sort(([, a], [, b]) => {
        const schichtSort = (a.schichtgruppe || '').localeCompare(b.schichtgruppe || '');
        return schichtSort !== 0 ? schichtSort : (a.position ?? 999) - (b.position ?? 999);
      });

      setEintraege(sortiert);

      // 🔁 Helper für Zell-Klick: wir brauchen die Gruppe am Zellen-Datum
      // Merken als Closure:
      getSchichtgruppeFor = (uid, datum) => (getAssnForDate(uid, datum)?.schichtgruppe || null);
    };

    // kleiner Trick: Function-Ref im Scope behalten
    var getSchichtgruppeFor = (uid, datum) => null;

    ladeKampfliste();
  }, [firma, unit, jahr, monat, reloadkey, sichtbareGruppen, dateStrByTag, setGruppenZähler]);

  // --- Quali-Counts laden (gültig bis einschließlich cutoff) ---
  const ladeQualiCounts = async (userIds, firmaId, unitId, cutoffIso) => {
    if (!userIds?.length) return {};
    try {
      const ids = userIds.map(String);

      const { data, error } = await supabase
        .from('DB_Qualifikation')
        .select(
          `
          user_id,
          quali,
          created_at,
          matrix:DB_Qualifikationsmatrix!inner(
            id,
            quali_kuerzel,
            betriebs_relevant,
            aktiv,
            firma_id,
            unit_id
          )
        `
        )
        .in('user_id', ids)
        .eq('matrix.firma_id', firmaId)
        .eq('matrix.unit_id', unitId)
        .eq('matrix.betriebs_relevant', true)
        .eq('matrix.aktiv', true)
        .lte('created_at', cutoffIso);

      if (error) {
        console.error('❌ Quali-Join fehlgeschlagen:', error.message || error);
        return {};
      }

      const map = {};
      for (const row of data || []) {
        const uid = String(row.user_id);
        map[uid] = (map[uid] || 0) + 1;
      }
      return map;
    } catch (e) {
      console.error('❌ Fehler beim Laden der Quali-Counts:', e);
      return {};
    }
  };

  return (
    <div className="bg-gray-200 text-black dark:bg-gray-800 dark:text-white rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 pb-6">
      {/* nur horizontal scrollen; Y soll sichtbar bleiben */}
      <div className="w-full" style={{ overflowX: 'visible', overflowY: 'visible' }}>
        <div className="flex min-w-fit relative" style={{ overflow: 'visible' }}>
          {/* --- linke Namensspalte --- */}
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

              const darfTooltipSehen =
                rolle !== 'Employee' || String(userId) === String(currentUserId);

              const showTip = darfTooltipSehen && hoveredUserId === userId;

              return (
                <div
                  key={userId}
                  className={`relative h-[20px] flex items-center px-2 border-b truncate rounded-md cursor-default
                    ${index % 2 === 0 ? 'bg-gray-300 dark:bg-gray-700/40' : 'bg-gray-100 dark:bg-gray-700/20'}
                    ${neueGruppe ? 'mt-2' : ''}
                    border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                    ${!e.user_visible ? 'opacity-50' : ''} hover:z-[9999]`}
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

                    {/* Tooltip (seitlich) */}
                    {showTip && (
                      <div
                        className="absolute left-full top-1/2 ml-2 -translate-y-1/2 z-[9999]"
                        onMouseEnter={() => showTipFor(userId)}
                        onMouseLeave={scheduleHideTip}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <div className="relative w-[256px] px-3 py-2 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10
                                        bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 font-mono text-xs">
                          {/* Pfeil */}
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45
                                          bg-white/95 dark:bg-gray-900/95 ring-1 ring-black/10 dark:ring-white/10" />
                          <div className="font-sans font-semibold mb-1 truncate">{e.vollName}</div>

                          <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 items-baseline">
                            {/* Urlaub */}
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

                            {/* Stunden */}
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

                  {/* Rechts vom Namen: Team_Leader = Krone, sonst römisches Badge */}
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

          {/* --- rechte Kalenderspalten --- */}
          <div className="flex flex-col gap-[2px]" style={{ overflow: 'visible' }}>
            {eintraege.map(([userId, e], index) => {
              const vorherige = index > 0 ? eintraege[index - 1][1] : null;
              const neueGruppe = vorherige?.schichtgruppe !== e.schichtgruppe;

              return (
                <div
                  key={userId}
                  className={`flex gap-[2px] ${neueGruppe ? 'mt-2' : ''} ${!e.user_visible ? 'opacity-50' : ''}`}
                  style={{ overflow: 'visible' }}
                >
                  {tage.map((t) => {
                    const eintragTag = e.tage[t.tag];
                    const zellenDatum = dateStrByTag[t.tag];
                    const istHeute = zellenDatum === heutigesDatum;

                    return (
                      <div
                        key={t.tag}
                        className={`relative group w-[48px] min-w-[48px] h-[18px] text-center border-b flex items-center justify-center rounded cursor-pointer
                          ${istHeute ? 'ring-2 ring-yellow-400' : ''}
                          border-gray-300 dark:border-gray-700
                          ${!eintragTag ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : ''}`}
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

                          // 👉 Schichtgruppe am Zellen-Datum aus DB_SchichtZuweisung holen
                          const { data: assn, error: assnErr } = await supabase
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
                            !assnErr && assn && assn.length ? assn[0].schichtgruppe : e.schichtgruppe;

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
                            schichtgruppe: schichtgruppeAtDate, // 🆕 aus neuer DB
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
                              style={{ borderTop: '13px solid white', borderLeft: '13px solid transparent', zIndex: 5 }}
                            />
                            <div
                              className="absolute top-0 right-0 w-0 h-0"
                              style={{
                                borderTop: '10px solid #ed0606f7',
                                borderLeft: '10px solid transparent',
                                zIndex: 10,
                              }}
                              title="Geändert"
                            />
                          </>
                        )}

                        {eintragTag?.kommentar && (
                          <>
                            <div
                              className="absolute top-0 left-0 w-0 h-0"
                              style={{ borderTop: '13px solid white', borderRight: '13px solid transparent', zIndex: 5 }}
                            />
                            <div
                              className="absolute top-0 left-0 w-0 h-0"
                              style={{
                                borderTop: '10px solid #d64a04ff',
                                borderRight: '10px solid transparent',
                                zIndex: 10,
                              }}
                              title="Kommentar vorhanden"
                            />
                          </>
                        )}

                        {/* Notice-Tooltip seitlich mit Datum/Zeit/Kommentar */}
                        {(() => {
                          const key = `${userId}|${zellenDatum}`;
                          const show =
                            hoveredCellKey === key &&
                            (eintragTag?.beginn || eintragTag?.ende || eintragTag?.kommentar);
                          if (!show) return null;
                          const datumLabel = dateLabelByTag[t.tag];
                          return (
                            <div
                              className="absolute left-full top-1/2 ml-2 -translate-y-1/2 z-[9999]"
                              onMouseEnter={() => showCellTip(key)}
                              onMouseLeave={scheduleHideCellTip}
                              style={{ pointerEvents: 'auto' }}
                            >
                              <div
                                className="relative w-[260px] px-3 py-2 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10
                                              bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 text-xs"
                              >
                                {/* Pfeil */}
                                <div
                                  className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45
                                                bg-white/95 dark:bg-gray-900/95 ring-1 ring-black/10 dark:ring-white/10"
                                />
                                {/* Header: Datum */}
                                <div className="font-sans font-semibold mb-1">{datumLabel}</div>
                                {/* Zeiten */}
                                {(eintragTag?.beginn || eintragTag?.ende) && (
                                  <div className="font-mono">
                                    {eintragTag?.beginn || '–'} – {eintragTag?.ende || '–'}
                                  </div>
                                )}
                                {/* Kommentar */}
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
