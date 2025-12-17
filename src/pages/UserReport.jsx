// src/pages/UserReport.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import { Calendar, RefreshCw, Info, AlertTriangle } from 'lucide-react';

import UserReportPersonalliste from '../components/UserReport/UserReportPersonalliste';
import UserReportDetailansicht from '../components/UserReport/UserReportDetailansicht';

const currentYear = dayjs().year();

const yearsAround = (center, span = 3) => {
  const ys = [];
  for (let y = center - span; y <= center + span; y++) ys.push(y);
  return ys;
};

const monate = [
  { value: 1, label: 'Januar' },
  { value: 2, label: 'Februar' },
  { value: 3, label: 'März' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Dezember' },
];

const fmt = (v, digits = 2) =>
  v == null ? '—' : Number(v).toFixed(digits).replace('.', ',');

const UserReport = () => {
  const { sichtFirma: firmaId, sichtUnit: unitId } = useRollen();

  const [year, setYear] = useState(currentYear);

  // Modus: 'jahr' = komplettes Jahr, 'monat' = ein Monat, 'bereich' = von/bis
  const [modus, setModus] = useState('jahr');

  // Bereich
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  // Einzelmonat
  const [singleMonth, setSingleMonth] = useState(dayjs().month() + 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [rows, setRows] = useState([]);        // v_mitarbeiter_monat_stats
  const [yearRows, setYearRows] = useState([]); // ➕ NEU: v_mitarbeiter_jahr_stats
  const [userList, setUserList] = useState([]); // DB_User
  const [stundenData, setStundenData] = useState([]); // DB_Stunden
  const [urlaubData, setUrlaubData] = useState([]);   // DB_Urlaub

  const [sortKey, setSortKey] = useState('planQuote');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [nameFilter, setNameFilter] = useState('');

  // ----------------- Daten laden -----------------
  const loadData = async () => {
    if (!firmaId || !unitId || !year) return;
    setLoading(true);
    setError(null);
    setSelectedUserId(null);

    try {
      // 1) User-Liste
      const { data: users, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, firma_id, unit_id, aktiv')
        .eq('firma_id', firmaId)
        .eq('unit_id', unitId)
        .eq('aktiv', true);

      if (userError) {
        console.error('Fehler beim Laden der UserList:', userError);
        setUserList([]);
      } else {
        setUserList(users || []);
      }

      // 2) Monats-Stats für das Jahr
      const { data, error } = await supabase
        .from('v_mitarbeiter_monat_stats')
        .select('*')
        .eq('firma_id', firmaId)
        .eq('unit_id', unitId)
        .eq('jahr', year)
        .limit(2000);

      if (error) {
        console.error('Fehler beim Laden des UserReports (Monate):', error);
        setError(error.message || 'Fehler beim Laden der Daten.');
        setRows([]);
      } else {
        setRows(data || []);
      }

      // ➕ 2b) Jahres-Stats aus v_mitarbeiter_jahr_stats
      const { data: jahrStats, error: jahrError } = await supabase
        .from('v_mitarbeiter_jahr_stats')
        .select('*')
        .eq('firma_id', firmaId)
        .eq('unit_id', unitId)
        .eq('jahr', year);

      if (jahrError) {
        console.error('Fehler beim Laden des UserReports (Jahr):', jahrError);
        setYearRows([]);
      } else {
        setYearRows(jahrStats || []);
      }

     // 3) Stunden aus DB_Stunden
const { data: stunden, error: stundenError } = await supabase
  .from('DB_Stunden')
  .select(
    'user_id, jahr, ' +
      'm1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12, ' +
      'summe_jahr, stunden_gesamt, uebernahme_vorjahr'
  )
  .eq('firma_id', firmaId)
  .eq('unit_id', unitId)
  .eq('jahr', year);


      if (stundenError) {
        console.error('Fehler beim Laden DB_Stunden:', stundenError);
        setStundenData([]);
      } else {
        setStundenData(stunden || []);
      }

      // 4) Urlaub aus DB_Urlaub
const { data: urlaub, error: urlaubError } = await supabase
  .from('DB_Urlaub')
  .select(
    'user_id, jahr, ' +
      'm1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12, ' +
      'summe_jahr, urlaub_gesamt, uebernahme_vorjahr'
  )
  .eq('firma_id', firmaId)
  .eq('unit_id', unitId)
  .eq('jahr', year);


      if (urlaubError) {
        console.error('Fehler beim Laden DB_Urlaub:', urlaubError);
        setUrlaubData([]);
      } else {
        setUrlaubData(urlaub || []);
      }
    } catch (e) {
      console.error('UserReport loadData exception:', e);
      setError('Unerwarteter Fehler beim Laden der Daten.');
      setRows([]);
      setYearRows([]);       // ➕ NEU
      setUserList([]);
      setStundenData([]);
      setUrlaubData([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (firmaId && unitId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaId, unitId, year]);

  // effektiver Monatsbereich abhängig vom Modus
  const [effStartMonth, effEndMonth] = useMemo(() => {
    if (modus === 'jahr') {
      return [1, 12];
    }
    if (modus === 'monat') {
      return [singleMonth, singleMonth];
    }
    // 'bereich'
    return [startMonth, endMonth];
  }, [modus, startMonth, endMonth, singleMonth]);

  const isFullYear = useMemo(
    () => effStartMonth === 1 && effEndMonth === 12,
    [effStartMonth, effEndMonth]
  );

  // ----------------- Aggregation je Mitarbeiter -----------------
  const userStats = useMemo(() => {
    const statsMap = new Map();

    const ensureBase = (
      userId,
      vorname = null,
      nachname = null,
      schichtgruppe = null
    ) => {
      if (!statsMap.has(userId)) {
        statsMap.set(userId, {
          userId,
          vorname,
          nachname,
          schichtgruppe,

          // Wochenenden / Feiertage
          sumSamstag: 0,
          sumSamstagFrei: 0,
          sumSonntag: 0,
          sumSonntagFrei: 0,
          sumFeiertag: 0,
          sumFeiertagFrei: 0,

          // Kurzfrist
          kLt1: 0,
          k1_3: 0,
          k4_6: 0,
          kGte7: 0,

          // F/S/N
          cF: 0,
          hF: 0,
          cFfrei: 0,
          hFfrei: 0,
          cS: 0,
          hS: 0,
          cSfrei: 0,
          hSfrei: 0,
          cN: 0,
          hN: 0,
          cNfrei: 0,
          hNfrei: 0,

          // Planerfüllung
          planTageGesamt: 0,
          planTageFehler: 0,

          // Krank
          krankGesamt: 0,
          krankK: 0,
          krankKO: 0,
        });
      }
      const obj = statsMap.get(userId);
      if (vorname != null && obj.vorname == null) obj.vorname = vorname;
      if (nachname != null && obj.nachname == null) obj.nachname = nachname;
      if (schichtgruppe != null && obj.schichtgruppe == null)
        obj.schichtgruppe = schichtgruppe;
      return obj;
    };

    // 🔁 Hilfsfunktion: eine Stats-Zeile (Monat oder Jahr) aufaddieren
    const applyStatsRow = (u, r) => {
      // Wochenenden / Feiertage
      u.sumSamstag += Number(r.samstag_stunden || 0);
      u.sumSamstagFrei += Number(r.samstag_stunden_frei || 0);
      u.sumSonntag += Number(r.sonntag_stunden || 0);
      u.sumSonntagFrei += Number(r.sonntag_stunden_frei || 0);
      u.sumFeiertag += Number(r.feiertag_stunden || 0);
      u.sumFeiertagFrei += Number(r.feiertag_stunden_frei || 0);

      // Kurzfrist
      u.kLt1 += Number(r.anz_kurzfrist_lt1 || 0);
      u.k1_3 += Number(r.anz_kurzfrist_1_3 || 0);
      u.k4_6 += Number(r.anz_kurzfrist_4_6 || 0);
      u.kGte7 += Number(r.anz_kurzfrist_gte7 || 0);

      // F
      u.cF += Number(r.count_f || 0);
      u.hF += Number(r.stunden_f || 0);
      u.cFfrei += Number(r.count_f_soll_frei || 0);
      u.hFfrei += Number(r.stunden_f_soll_frei || 0);

      // S
      u.cS += Number(r.count_s || 0);
      u.hS += Number(r.stunden_s || 0);
      u.cSfrei += Number(r.count_s_soll_frei || 0);
      u.hSfrei += Number(r.stunden_s_soll_frei || 0);

      // N
      u.cN += Number(r.count_n || 0);
      u.hN += Number(r.stunden_n || 0);
      u.cNfrei += Number(r.count_n_soll_frei || 0);
      u.hNfrei += Number(r.stunden_n_soll_frei || 0);

      // Planerfüllung
      u.planTageGesamt += Number(r.tage_gesamt || 0);
      u.planTageFehler += Number(r.tage_planabweichung_relevant || 0);

      // Krank
      u.krankK += Number(r.krank_k_tage || 0);
      u.krankKO += Number(r.krank_ko_tage || 0);
      u.krankGesamt += Number(r.krank_gesamt_tage || 0);
    };

    // Maps für Stunden & Urlaub
    const stundenMap = new Map();
    for (const s of stundenData || []) {
      stundenMap.set(s.user_id, s);
    }

    const urlaubMap = new Map();
    for (const u of urlaubData || []) {
      urlaubMap.set(u.user_id, u);
    }

    // 1) Stats aus View: je nach Modus Jahr oder Monate
    if (modus === 'jahr' && yearRows && yearRows.length > 0) {
      // 👉 Jahrmodus: direkt aus v_mitarbeiter_jahr_stats aggregieren
      for (const r of yearRows) {
        if (!r.user_id) continue;
        const u = ensureBase(r.user_id, r.vorname, r.nachname, r.schichtgruppe);
        applyStatsRow(u, r);
      }
    } else {
      // 👉 Monats- / Bereichsmodus: aus v_mitarbeiter_monat_stats + Monatsfilter
      for (const r of rows || []) {
        if (!r.user_id) continue;
        if (r.monat < effStartMonth || r.monat > effEndMonth) continue;

        const u = ensureBase(r.user_id, r.vorname, r.nachname, r.schichtgruppe);
        applyStatsRow(u, r);
      }
    }

    // 3) Ergebnisliste mit User-Liste, Planquote, Stunden & Urlaub
    const result = [];

    const buildStundenUrlaub = (userId, base) => {
  const stRow = stundenMap.get(userId);
  const urRow = urlaubMap.get(userId);

  // 🔢 Jahreswerte aus DB_Stunden
  const stundenSummeJahr = Number(stRow?.summe_jahr || 0);
  const stundenGesamt = Number(stRow?.stunden_gesamt || 0);
  const stundenUebernahme = Number(stRow?.uebernahme_vorjahr || 0);

  // 🔢 Jahreswerte aus DB_Urlaub
  const urlaubSummeJahr = Number(urRow?.summe_jahr || 0);
  const urlaubGesamt = Number(urRow?.urlaub_gesamt || 0);
  const urlaubUebernahme = Number(urRow?.uebernahme_vorjahr || 0);

  // 🔢 Ist-Stunden / Ist-Urlaub für den gewählten Zeitraum
  let stundenIst = 0;
  let stundenSoll = null;

if (stRow) {
  if (isFullYear) {
    // ✅ Jahres-Ist = Summe Jahr + Übernahme Vorjahr
    stundenIst = stundenSummeJahr + stundenUebernahme;

    // Soll bleibt die Jahresvorgabe
    stundenSoll = stundenGesamt;
  } else {
    let sum = 0;
    for (let m = effStartMonth; m <= effEndMonth; m++) {
      const key = `m${m}`;
      sum += Number(stRow[key] || 0);
    }
    // ✅ Bereich/Monat: NUR die Monatsstunden (keine Übernahme)
    stundenIst = sum;
  }
}

  const stundenText =
    isFullYear && stundenSoll != null
      ? `${fmt(stundenIst)} / ${fmt(stundenSoll)}`
      : fmt(stundenIst);

  let urlaubIst = 0;
  let urlaubSoll = null;

  if (urRow) {
    if (isFullYear) {
      urlaubIst = urlaubSummeJahr;
      urlaubSoll = urlaubGesamt;
    } else {
      let sum = 0;
      for (let m = effStartMonth; m <= effEndMonth; m++) {
        const key = `m${m}`;
        sum += Number(urRow[key] || 0);
      }
      urlaubIst = sum;
    }
  }

  const urlaubText =
    isFullYear && urlaubSoll != null
      ? `${fmt(urlaubIst)} / ${fmt(urlaubSoll)}`
      : fmt(urlaubIst);

  const kurzfristTotal =
    (base.kLt1 || 0) +
    (base.k1_3 || 0) +
    (base.k4_6 || 0);

  // 📊 Monatswerte (m1–m12) – für Detailansicht im Monats-/Bereichsmodus
  const stundenMonate = {};
  if (stRow) {
    for (let m = 1; m <= 12; m++) {
      const key = `m${m}`;
      stundenMonate[m] = Number(stRow[key] || 0);
    }
  }

  const urlaubMonate = {};
  if (urRow) {
    for (let m = 1; m <= 12; m++) {
      const key = `m${m}`;
      urlaubMonate[m] = Number(urRow[key] || 0);
    }
  }

  return {
    stundenIst,
    stundenSoll,
    stundenText,
    urlaubIst,
    urlaubSoll,
    urlaubText,
    kurzfristTotal,

    // 🔁 für Detailansicht
    stundenMonate,
    urlaubMonate,
    stundenSummeJahr,
    stundenGesamt,
    stundenUebernahme,
    urlaubSummeJahr,
    urlaubGesamt,
    urlaubUebernahme,
  };
};

    if (userList && userList.length > 0) {
      for (const usr of userList) {
        const base = ensureBase(usr.user_id, usr.vorname, usr.nachname, null);

        let planQuote = null;
        if (base.planTageGesamt > 0) {
          const korrekt = base.planTageGesamt - base.planTageFehler;
          planQuote = (korrekt / base.planTageGesamt) * 100;
        }

        const extra = buildStundenUrlaub(usr.user_id, base);

        result.push({
          ...base,
          planQuote,
          ...extra,
        });
      }
    } else {
      for (const base of statsMap.values()) {
        let planQuote = null;
        if (base.planTageGesamt > 0) {
          const korrekt = base.planTageGesamt - base.planTageFehler;
          planQuote = (korrekt / base.planTageGesamt) * 100;
        }
        const extra = buildStundenUrlaub(base.userId, base);
        result.push({ ...base, planQuote, ...extra });
      }
    }

    return result;
  }, [
    rows,
    yearRows,        // ➕ NEU
    modus,           // ➕ NEU
    userList,
    stundenData,
    urlaubData,
    effStartMonth,
    effEndMonth,
    isFullYear,
  ]);

  // ----------------- Sortierung + Filter -----------------
  const sortedStats = useMemo(() => {
    const lowerSearch = nameFilter.trim().toLowerCase();
    let base = [...userStats];

    if (lowerSearch) {
      base = base.filter((u) => {
        const name = `${u.nachname || ''} ${u.vorname || ''}`.toLowerCase();
        return name.includes(lowerSearch);
      });
    }

    // 👉 User ohne Gruppen-Zuweisung ausblenden
    base = base.filter((u) => u.schichtgruppe);

    const arr = [...base];
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      const val = (x) => {
        switch (sortKey) {
          case 'name':
            return `${x.nachname || ''} ${x.vorname || ''}`.toLowerCase();
          case 'gruppe':
            return (x.schichtgruppe || '').toLowerCase();

          // Stunden / Urlaub
          case 'stunden':
            return Number(x.stundenIst || 0);
          case 'urlaub':
            return Number(x.urlaubIst || 0);

          // Nacht / So / Feiertag
          case 'nacht_std':
            return Number(x.hN || 0);
          case 'sonntag':
            return Number(x.sumSonntag || 0);
          case 'feiertag':
            return Number(x.sumFeiertag || 0);

          // Krank / Plan / Kurzfristigkeit
          case 'krank':
            return Number(x.krankGesamt || 0);
          case 'planQuote':
            return x.planQuote ?? -9999;
          case 'kurzfrist':
            return Number(x.kurzfristTotal || 0);

          default:
            return 0;
        }
      };

      const va = val(a);
      const vb = val(b);

      if (typeof va === 'string' || typeof vb === 'string') {
        if (va > vb) return dir;
        if (va < vb) return -dir;
        return 0;
      }
      return (va - vb) * dir;
    });

    return arr;
  }, [userStats, sortKey, sortDir, nameFilter]);

  const selectedUser = useMemo(
    () => sortedStats.find((u) => u.userId === selectedUserId) || null,
    [sortedStats, selectedUserId]
  );

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (!firmaId || !unitId) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">
              Bitte zuerst eine Firma und Unit auswählen.
            </p>
            <p className="text-xs opacity-80">
              Der Mitarbeiter-Report benötigt den aktuellen Kontext aus dem
              Rollen-Panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:py-1 space-y-4">
      {/* Filter-Panel */}
      <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-900/20 px-4 py-3 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Zeitraum wählen</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <Info className="w-3 h-3" />
            <span>
              Planerfüllung bezieht sich immer auf den gewählten Zeitraum
              (nur geänderte Tage im selben Jahr, ohne K/KO/U).
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          {/* Jahr */}
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-gray-600 dark:text-gray-300">Jahr</label>
            <select
              className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-300/20 dark:bg-gray-800 px-2 py-1 text-xs hover:bg-gray-300 hover:dark:bg-gray-700/50"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearsAround(currentYear, 3).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Modus-Auswahl */}
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-gray-600 dark:text-gray-300">
              Zeitraum-Modus
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModus('jahr')}
                className={`px-2 py-1 rounded-lg border text-[11px] ${
                  modus === 'jahr'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-300 hover:dark:bg-gray-700'
                }`}
              >
                Jahr gesamt
              </button>
              <button
                type="button"
                onClick={() => setModus('monat')}
                className={`px-2 py-1 rounded-lg border text-[11px] ${
                  modus === 'monat'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-300 hover:dark:bg-gray-700'
                }`}
              >
                Einzelner Monat
              </button>
              <button
                type="button"
                onClick={() => setModus('bereich')}
                className={`px-2 py-1 rounded-lg border text-[11px] ${
                  modus === 'bereich'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-300 hover:dark:bg-gray-700'
                }`}
              >
                Monatsbereich
              </button>
            </div>
          </div>

          {/* Einzelmonat */}
          {modus === 'monat' && (
            <div className="flex flex-col gap-1 text-xs">
              <label className="text-gray-600 dark:text-gray-300">Monat</label>
              <select
                className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-300/20 dark:bg-gray-800 px-2 py-1 text-xs"
                value={singleMonth}
                onChange={(e) => setSingleMonth(Number(e.target.value))}
              >
                {monate.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bereich: Von/Bis */}
          {modus === 'bereich' && (
            <>
              <div className="flex flex-col gap-1 text-xs">
                <label className="text-gray-600 dark:text-gray-300">
                  Von Monat
                </label>
                <select
                  className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-300/20 dark:bg-gray-800 px-2 py-1 text-xs hover:bg-gray-300 hover:dark:bg-gray-700"
                  value={startMonth}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStartMonth(v);
                    if (v > endMonth) setEndMonth(v);
                  }}
                >
                  {monate.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <label className="text-gray-600 dark:text-gray-300">
                  Bis Monat
                </label>
                <select
                  className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-300/20 dark:bg-gray-800 px-2 py-1 text-xs hover:bg-gray-300 hover:dark:bg-gray-700"
                  value={endMonth}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setEndMonth(v);
                    if (v < startMonth) setStartMonth(v);
                  }}
                >
                  {monate.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Name-Filter */}
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-gray-600 dark:text-gray-300">
              Mitarbeiter filtern
            </label>
            <input
              type="text"
              className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-300/20 dark:bg-gray-800 px-2 py-1 text-xs hover:bg-gray-300 hover:dark:bg-gray-700"
              placeholder="Name eingeben…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-400/40 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 bg-gray-300/50 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Neu laden
          </button>

          <div className="flex-1" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-xs text-red-800 dark:text-red-100">
          {error}
        </div>
      )}

      {/* Tabelle + Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        <UserReportPersonalliste
          loading={loading}
          stats={sortedStats}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          sortKey={sortKey}
          sortDir={sortDir}
          toggleSort={toggleSort}
        />
        <UserReportDetailansicht
  selectedUser={selectedUser}
  modus={modus}
  effStartMonth={effStartMonth}
  effEndMonth={effEndMonth}
  isFullYear={isFullYear}
/>
      </div>
    </div>
  );
};

export default UserReport;
