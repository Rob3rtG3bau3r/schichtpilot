// src/pages/UserReport.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import {
  Calendar,
  ArrowUpDown,
  RefreshCw,
  Info,
  AlertTriangle,
} from 'lucide-react';

const currentYear = dayjs().year();

const yearsAround = (center, span = 3) => {
  const ys = [];
  for (let y = center - span; y <= center + span; y++) ys.push(y);
  return ys;
};

const fmt = (v, digits = 2) =>
  v == null ? '—' : Number(v).toFixed(digits).replace('.', ',');

const UserReport = () => {
  const { sichtFirma: firmaId, sichtUnit: unitId } = useRollen();

  const [year, setYear] = useState(currentYear);
  const [von, setVon] = useState(dayjs().startOf('year').format('YYYY-MM-DD'));
  const [bis, setBis] = useState(dayjs().endOf('year').format('YYYY-MM-DD'));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]); // rohe Zeilen aus v_mitarbeiter_tag_enriched

  const [sortKey, setSortKey] = useState('planQuote');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  const [selectedUserId, setSelectedUserId] = useState(null);

  // Wenn Jahr geändert wird, Zeitraum automatisch auf ganzes Jahr setzen
  useEffect(() => {
    const start = dayjs().year(year).startOf('year').format('YYYY-MM-DD');
    const end = dayjs().year(year).endOf('year').format('YYYY-MM-DD');
    setVon(start);
    setBis(end);
  }, [year]);

  const loadData = async () => {
    if (!firmaId || !unitId || !von || !bis) return;
    setLoading(true);
    setError(null);
    setSelectedUserId(null);

    const { data, error } = await supabase
      .from('v_mitarbeiter_tag_enriched')
      .select('*')
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .gte('datum', von)
      .lte('datum', bis);

    if (error) {
      console.error('Fehler beim Laden des UserReports:', error);
      setError(error.message || 'Fehler beim Laden der Daten.');
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  // initiales Laden + Reload bei Änderungen von Firma/Unit/Zeitraum
  useEffect(() => {
    if (firmaId && unitId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaId, unitId, von, bis]);

  // Aggregation je Mitarbeiter
  const userStats = useMemo(() => {
    const map = new Map();

    for (const r of rows) {
      const key = r.user_id;
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          userId: key,
          vorname: r.vorname,
          nachname: r.nachname,
          schichtgruppe: r.schichtgruppe,
          // Basis
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
          // Kürzel-Stats (für Detailansicht)
          kuerzelMap: new Map(),
        });
      }

      const u = map.get(key);

      const samstag = Number(r.samstag_stunden || 0);
      const samstagFrei = Number(r.samstag_stunden_frei || 0);
      const sonntag = Number(r.sonntag_stunden || 0);
      const sonntagFrei = Number(r.sonntag_stunden_frei || 0);
      const feiertag = Number(r.feiertag_stunden || 0);
      const feiertagFrei = Number(r.feiertag_stunden_frei || 0);
      const stundenNetto = Number(r.tages_stunden_netto || 0);

      u.sumSamstag += samstag;
      u.sumSamstagFrei += samstagFrei;
      u.sumSonntag += sonntag;
      u.sumSonntagFrei += sonntagFrei;
      u.sumFeiertag += feiertag;
      u.sumFeiertagFrei += feiertagFrei;

      // Kurzfristigkeit
      switch (r.kurzfrist_kategorie) {
        case '<1':
          u.kLt1 += 1;
          break;
        case '1-3':
          u.k1_3 += 1;
          break;
        case '4-6':
          u.k4_6 += 1;
          break;
        case '>=7':
          u.kGte7 += 1;
          break;
        default:
          break;
      }

      // F/S/N
      const k = r.ist_kuerzel;
      const sollFrei = !!r.is_soll_frei;

      if (k === 'F') {
        u.cF += 1;
        u.hF += stundenNetto;
        if (sollFrei) {
          u.cFfrei += 1;
          u.hFfrei += stundenNetto;
        }
      } else if (k === 'S') {
        u.cS += 1;
        u.hS += stundenNetto;
        if (sollFrei) {
          u.cSfrei += 1;
          u.hSfrei += stundenNetto;
        }
      } else if (k === 'N') {
        u.cN += 1;
        u.hN += stundenNetto;
        if (sollFrei) {
          u.cNfrei += 1;
          u.hNfrei += stundenNetto;
        }
      }

      // Planerfüllung
      if (r.soll_kuerzel != null) {
        u.planTageGesamt += 1;
      }
      const jahrAend = r.jahr_aenderung;
      const datumYear = dayjs(r.datum).year();
      if (r.plan_abweichung_relevant && jahrAend === datumYear) {
        u.planTageFehler += 1;
      }

      // Kürzel-Map
      if (k) {
        const km = u.kuerzelMap;
        if (!km.has(k)) {
          km.set(k, { tage: 0, stunden: 0 });
        }
        const entry = km.get(k);
        entry.tage += 1;
        entry.stunden += stundenNetto;
      }
    }

    // In Array umwandeln + Planquote berechnen
    const result = Array.from(map.values()).map((u) => {
      let planQuote = null;
      if (u.planTageGesamt > 0) {
        const fehler = u.planTageFehler;
        const korrekt = u.planTageGesamt - fehler;
        planQuote = (korrekt / u.planTageGesamt) * 100;
      }
      return { ...u, planQuote };
    });

    return result;
  }, [rows]);

  // sortiertes Array
  const sortedStats = useMemo(() => {
    const arr = [...userStats];
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      const getVal = (x) => {
        switch (sortKey) {
          case 'name':
            return `${x.nachname || ''} ${x.vorname || ''}`.toLowerCase();
          case 'samstag':
            return x.sumSamstag;
          case 'sonntag':
            return x.sumSonntag;
          case 'feiertag':
            return x.sumFeiertag;
          case 'planQuote':
            return x.planQuote ?? -9999;
          case 'kLt1':
            return x.kLt1;
          default:
            return 0;
        }
      };

      const va = getVal(a);
      const vb = getVal(b);

      if (typeof va === 'string' || typeof vb === 'string') {
        return va > vb ? dir : va < vb ? -dir : 0;
      }
      return (va - vb) * dir;
    });
    return arr;
  }, [userStats, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const selectedUser = useMemo(
    () => sortedStats.find((u) => u.userId === selectedUserId) || null,
    [sortedStats, selectedUserId]
  );

  const selectedUserKuerzel = useMemo(() => {
    if (!selectedUser) return [];
    return Array.from(selectedUser.kuerzelMap.entries())
      .map(([kuerzel, v]) => ({
        kuerzel,
        tage: v.tage,
        stunden: v.stunden,
      }))
      .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel));
  }, [selectedUser]);

  // --- Render ---

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
    <div className="p-4 md:p-6 space-y-4">
      {/* Kopfbereich */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Mitarbeiter-Report
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Auswertung der Dienste pro Mitarbeiter – Samstage, Sonntage,
            Feiertage, Kurzfristigkeit und Planerfüllung.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-400/40 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Neu laden
        </button>
      </div>

      {/* Filter-Panel */}
      <div className="rounded-2xl border border-gray-300/70 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Zeitraum wählen</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <Info className="w-3 h-3" />
            <span>
              Planerfüllungsquote berücksichtigt nur geänderte Tage im selben
              Jahr (ohne K/KO/U).
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-gray-600 dark:text-gray-300">
              Jahr (Schnellauswahl)
            </label>
            <select
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
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

          <div className="flex flex-col gap-1 text-xs">
            <label className="text-gray-600 dark:text-gray-300">Von</label>
            <input
              type="date"
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
              value={von}
              onChange={(e) => setVon(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <label className="text-gray-600 dark:text-gray-300">Bis</label>
            <input
              type="date"
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>

          <div className="flex-1" />

          <div className="text-right text-[11px] text-gray-500 dark:text-gray-400">
            {rows.length > 0 && (
              <span>
                Ausgewertete Tage: <b>{rows.length}</b>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fehleranzeige */}
      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-xs text-red-800 dark:text-red-100">
          {error}
        </div>
      )}

      {/* Hauptbereich: Tabelle + Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Tabelle */}
        <div className="xl:col-span-2 rounded-2xl border border-gray-300/70 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm flex flex-col">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Übersicht nach Mitarbeiter
            </h2>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Klick auf eine Zeile für Details
            </span>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead className="bg-gray-50 dark:bg-gray-800/70 sticky top-0 z-10">
                <tr>
                  <Th
                    label="Mitarbeiter"
                    sortKey="name"
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="px-2 py-1 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    Gruppe
                  </th>
                  <Th
                    label="Plan %"
                    sortKey="planQuote"
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <Th
                    label="Sa Std"
                    sortKey="samstag"
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                    Sa Std (frei)
                  </th>
                  <Th
                    label="So Std"
                    sortKey="sonntag"
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                    So Std (frei)
                  </th>
                  <Th
                    label="Feiertag Std"
                    sortKey="feiertag"
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="px-2 py-1 text-center font-semibold text-gray-600 dark:text-gray-300">
                    &lt;1
                  </th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-600 dark:text-gray-300">
                    1–3
                  </th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-600 dark:text-gray-300">
                    4–6
                  </th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-600 dark:text-gray-300">
                    ≥7
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
                    >
                      Daten werden geladen …
                    </td>
                  </tr>
                ) : sortedStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
                    >
                      Keine Daten im ausgewählten Zeitraum.
                    </td>
                  </tr>
                ) : (
                  sortedStats.map((u) => {
                    const name = `${u.nachname || ''} ${u.vorname || ''}`.trim();
                    const selected = selectedUserId === u.userId;
                    return (
                      <tr
                        key={u.userId}
                        onClick={() =>
                          setSelectedUserId(
                            selected ? null : u.userId
                          )
                        }
                        className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/60 ${
                          selected
                            ? 'bg-indigo-50/80 dark:bg-indigo-900/40'
                            : ''
                        }`}
                      >
                        <td className="px-2 py-1 whitespace-nowrap text-[11px]">
                          {name || '—'}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-[11px] text-gray-600 dark:text-gray-300">
                          {u.schichtgruppe || '—'}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {u.planQuote == null
                            ? '—'
                            : `${fmt(u.planQuote, 1)} %`}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmt(u.sumSamstag)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600 dark:text-gray-300">
                          {fmt(u.sumSamstagFrei)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmt(u.sumSonntag)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600 dark:text-gray-300">
                          {fmt(u.sumSonntagFrei)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmt(u.sumFeiertag)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {u.kLt1 || ''}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {u.k1_3 || ''}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {u.k4_6 || ''}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {u.kGte7 || ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailpanel für ausgewählten Mitarbeiter */}
        <div className="rounded-2xl border border-gray-300/70 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm flex flex-col">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Detailansicht
            </h2>
          </div>

          {!selectedUser ? (
            <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
              Bitte in der Tabelle links einen Mitarbeiter auswählen.
            </div>
          ) : (
            <div className="p-4 space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {`${selectedUser.nachname || ''} ${
                    selectedUser.vorname || ''
                  }`.trim() || 'Mitarbeiter'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Schichtgruppe:{' '}
                  <span className="font-medium">
                    {selectedUser.schichtgruppe || '—'}
                  </span>
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Planerfüllung:{' '}
                  {selectedUser.planQuote == null
                    ? '—'
                    : `${fmt(selectedUser.planQuote, 1)} % (${selectedUser.planTageGesamt} Tage, ${selectedUser.planTageFehler} Abweichungen)`}
                </p>
              </div>

              <div className="border rounded-xl border-gray-200 dark:border-gray-700 p-2 space-y-1">
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
                  Wochenend- & Feiertagsstunden
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <StatLine
                    label="Samstag (gesamt)"
                    value={selectedUser.sumSamstag}
                  />
                  <StatLine
                    label="Samstag (auf frei)"
                    value={selectedUser.sumSamstagFrei}
                  />
                  <StatLine
                    label="Sonntag (gesamt)"
                    value={selectedUser.sumSonntag}
                  />
                  <StatLine
                    label="Sonntag (auf frei)"
                    value={selectedUser.sumSonntagFrei}
                  />
                  <StatLine
                    label="Feiertag (gesamt)"
                    value={selectedUser.sumFeiertag}
                  />
                  <StatLine
                    label="Feiertag (auf frei)"
                    value={selectedUser.sumFeiertagFrei}
                  />
                </div>
              </div>

              <div className="border rounded-xl border-gray-200 dark:border-gray-700 p-2 space-y-1">
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
                  Kurzfristige Einträge
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <StatLine label="&lt; 1 Tag" value={selectedUser.kLt1} />
                  <StatLine label="1–3 Tage" value={selectedUser.k1_3} />
                  <StatLine label="4–6 Tage" value={selectedUser.k4_6} />
                  <StatLine label="≥ 7 Tage" value={selectedUser.kGte7} />
                </div>
              </div>

              <div className="border rounded-xl border-gray-200 dark:border-gray-700 p-2 space-y-1">
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
                  F / S / N – Tage & Stunden
                </p>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="text-left font-medium pb-1">Schicht</th>
                      <th className="text-right font-medium pb-1">Tage</th>
                      <th className="text-right font-medium pb-1">
                        Stunden
                      </th>
                      <th className="text-right font-medium pb-1">
                        Tage (auf frei)
                      </th>
                      <th className="text-right font-medium pb-1">
                        Std (auf frei)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <FsnRow
                      label="Früh (F)"
                      c={selectedUser.cF}
                      h={selectedUser.hF}
                      cf={selectedUser.cFfrei}
                      hf={selectedUser.hFfrei}
                    />
                    <FsnRow
                      label="Spät (S)"
                      c={selectedUser.cS}
                      h={selectedUser.hS}
                      cf={selectedUser.cSfrei}
                      hf={selectedUser.hSfrei}
                    />
                    <FsnRow
                      label="Nacht (N)"
                      c={selectedUser.cN}
                      h={selectedUser.hN}
                      cf={selectedUser.cNfrei}
                      hf={selectedUser.hNfrei}
                    />
                  </tbody>
                </table>
              </div>

              <div className="border rounded-xl border-gray-200 dark:border-gray-700 p-2 space-y-1">
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
                  Kürzel-Übersicht im Zeitraum
                </p>
                {selectedUserKuerzel.length === 0 ? (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Keine Einträge.
                  </p>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-400">
                        <th className="text-left font-medium pb-1">Kürzel</th>
                        <th className="text-right font-medium pb-1">Tage</th>
                        <th className="text-right font-medium pb-1">
                          Stunden
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserKuerzel.map((k) => (
                        <tr key={k.kuerzel}>
                          <td className="py-0.5">{k.kuerzel}</td>
                          <td className="py-0.5 text-right">{k.tage}</td>
                          <td className="py-0.5 text-right">
                            {fmt(k.stunden)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Hilfs-Komponenten
const Th = ({ label, sortKey, current, dir, onClick }) => {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className="px-2 py-1 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${
            active ? 'opacity-100' : 'opacity-40'
          }`}
        />
        {active && (
          <span className="text-[9px] uppercase text-gray-400 dark:text-gray-500">
            {dir === 'asc' ? 'auf' : 'ab'}
          </span>
        )}
      </span>
    </th>
  );
};

const StatLine = ({ label, value }) => (
  <div className="flex items-center justify-between text-[11px] text-gray-700 dark:text-gray-200">
    <span>{label}</span>
    <span className="font-medium">{fmt(value)}</span>
  </div>
);

const FsnRow = ({ label, c, h, cf, hf }) => (
  <tr>
    <td className="py-0.5">{label}</td>
    <td className="py-0.5 text-right">{c || 0}</td>
    <td className="py-0.5 text-right">{fmt(h)}</td>
    <td className="py-0.5 text-right">{cf || 0}</td>
    <td className="py-0.5 text-right">{fmt(hf)}</td>
  </tr>
);

export default UserReport;
