// src/components/UnitUserStundenPflege/UeberstundenTab.jsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { Search, RefreshCw, Users, X, ArrowRightLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';

dayjs.locale('de');

const T_USERS = 'DB_User';
const T_STUNDEN = 'DB_Stunden';
const T_ABZUG = 'DB_StundenAbzug';

/* ---------------- UI Helpers ---------------- */
const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
    {children}
  </div>
);
const Btn = ({ className = '', children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold
      border border-gray-300 dark:border-gray-700
      bg-gray-100 hover:bg-gray-200 dark:bg-gray-900/40 dark:hover:bg-gray-900/70
      text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);
const BtnPrimary = ({ className = '', children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold
      bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);
const Input = (props) => (
  <input
    {...props}
    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
               px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
               focus:ring-2 focus:ring-gray-400/40"
  />
);
const Select = (props) => (
  <select
    {...props}
    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
               px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
               focus:ring-2 focus:ring-gray-400/40"
  />
);

const fmt = (v, digits = 2) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(digits).replace('.', ',');
};

const buildDisplayName = (u) => {
  if (!u) return '—';
  const vn = (u.vorname || '').trim();
  const nn = (u.nachname || '').trim();
  const s = `${vn} ${nn}`.trim();
  return s || u.email || u.user_id || u.id || '—';
};

const yearOptions = () => {
  const now = dayjs().year();
  return [now - 1, now, now + 1];
};

export default function UeberstundenTab({ firma_id, unit_id }) {
  const [jahr, setJahr] = useState(dayjs().year());

  // Suche + Filter
  const [search, setSearch] = useState('');
  const [onlyPositiveDiff, setOnlyPositiveDiff] = useState(true);
  const [onlyWithAbzug, setOnlyWithAbzug] = useState(false);

  // Daten
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [stundenRows, setStundenRows] = useState([]);
  const [abzugSums, setAbzugSums] = useState([]);

  // Auswahl + Msg
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [msg, setMsg] = useState(null);

  // Bulk Block
  const [bulkOpen, setBulkOpen] = useState(true);

  const stundenByUserYear = useMemo(() => {
    const m = new Map();
    (stundenRows || []).forEach((r) => m.set(`${r.user_id}__${r.jahr}`, r));
    return m;
  }, [stundenRows]);

  const abzugByUserYear = useMemo(() => {
    const m = new Map();
    (abzugSums || []).forEach((r) => m.set(`${r.user_id}__${r.jahr}`, Number(r.sum || 0)));
    return m;
  }, [abzugSums]);

  const loadAll = async () => {
    if (!firma_id || !unit_id) return;
    setLoading(true);
    setMsg(null);

    try {
      // 1) Users
      const { data: uData, error: uErr } = await supabase
        .from(T_USERS)
        .select('user_id, vorname, nachname, personal_nummer, email, rolle, aktiv, firma_id, unit_id')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .order('nachname', { ascending: true })
        .order('vorname', { ascending: true });

      if (uErr) throw uErr;
      setUsers(uData || []);

      // 2) Stunden (jahr + next)
      const yearsToLoad = Array.from(new Set([jahr, jahr + 1]));
      const { data: sData, error: sErr } = await supabase
        .from(T_STUNDEN)
        .select('*')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .in('jahr', yearsToLoad);

      if (sErr) throw sErr;
      setStundenRows(sData || []);

      // 3) Abzug Summen (nur jahr)
      const { data: aData, error: aErr } = await supabase
        .from(T_ABZUG)
        .select('user_id, jahr, stunden')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .eq('jahr', jahr);

      if (aErr) throw aErr;

      const map = new Map();
      (aData || []).forEach((r) => {
        const k = `${r.user_id}__${r.jahr}`;
        map.set(k, (map.get(k) || 0) + Number(r.stunden || 0));
      });

      const sums = Array.from(map.entries()).map(([k, sum]) => {
        const [user_id, j] = k.split('__');
        return { user_id, jahr: Number(j), sum };
      });
      setAbzugSums(sums);

      // Auswahl löschen (damit es clean bleibt)
      setSelectedIds(new Set());
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Fehler beim Laden' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma_id, unit_id, jahr]);

  const ueberRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = (users || []).map((u) => {
      const userId = u.user_id || u.id;

      const s = stundenByUserYear.get(`${userId}__${jahr}`) || {};
      const vorgabe = Number(s.vorgabe_stunden ?? 0);
      const uebernahme = Number(s.uebernahme_vorjahr ?? 0);
      const summeJahr = Number(s.summe_jahr ?? 0);

      // ✅ deine gewünschte Logik
      const summeZusammen = summeJahr + uebernahme;
      const jahresende = summeZusammen - vorgabe;

      const abzug = Number(abzugByUserYear.get(`${userId}__${jahr}`) || 0);
      const rest = jahresende - abzug;

      return {
        u,
        userId,
        name: buildDisplayName(u),
        summeJahr,
        uebernahme,
        summeZusammen,
        vorgabe,
        jahresende,
        abzug,
        rest,
        hasRow: !!s?.id,
      };
    });

    return list.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;

      if (onlyPositiveDiff && r.jahresende <= 0) return false;
      if (onlyWithAbzug && r.abzug <= 0) return false;

      return true;
    });
  }, [users, stundenByUserYear, abzugByUserYear, jahr, search, onlyPositiveDiff, onlyWithAbzug]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const setAllVisibleSelectedUsers = (on) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      ueberRows.forEach((r) => {
        if (on) n.add(r.userId);
        else n.delete(r.userId);
      });
      return n;
    });
  };

  // Übernahme ins nächste Jahr: Rest → uebernahme_vorjahr (next year)
  const bulkTransferToNextYear = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      const nextY = jahr + 1;

      for (const uid of ids) {
        // Rest aus unseren berechneten Rows nehmen (stabil)
        const row = ueberRows.find((r) => String(r.userId) === String(uid));
        const rest = Number(row?.rest ?? 0);

        // Upsert in DB_Stunden next year
        const { data: existing, error: exErr } = await supabase
          .from(T_STUNDEN)
          .select('id')
          .eq('firma_id', firma_id)
          .eq('unit_id', unit_id)
          .eq('jahr', nextY)
          .eq('user_id', uid)
          .maybeSingle();

        if (exErr && exErr.code !== 'PGRST116') throw exErr;

        if (existing?.id) {
          const { error } = await supabase
            .from(T_STUNDEN)
            .update({ uebernahme_vorjahr: rest, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from(T_STUNDEN).insert({
            user_id: uid,
            firma_id,
            unit_id,
            jahr: nextY,
            uebernahme_vorjahr: rest,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        }
      }

      setMsg({ type: 'ok', text: `Übernahme ins nächste Jahr gespeichert (${ids.length} MA).` });
      clearSelection();
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Übernahme fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 items-end">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Jahr</div>
            <Select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
              {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <div className="lg:col-span-2">
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Suche nach Name</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Suche nach Name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-start lg:justify-end">
            <Btn onClick={loadAll} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={onlyPositiveDiff}
              onChange={(e) => setOnlyPositiveDiff(e.target.checked)}
            />
            Nur MA mit positiver Jahresdifferenz
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={onlyWithAbzug}
              onChange={(e) => setOnlyWithAbzug(e.target.checked)}
            />
            Nur MA mit Abzug/Auszahlung
          </label>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Treffer: <b>{ueberRows.length}</b>
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl border p-2 text-sm
            ${msg.type === 'ok'
              ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100'
            }`}
          >
            {msg.text}
          </div>
        )}
      </Card>

      {/* Bulk Actions */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
            onClick={() => setBulkOpen((v) => !v)}
          >
            {bulkOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Aktionen (Auswahl)
          </button>

          <div className="text-xs text-gray-600 dark:text-gray-300">
            Ausgewählt: <span className="font-semibold">{selectedIds.size}</span>
          </div>
        </div>

        {bulkOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={() => setAllVisibleSelectedUsers(true)} disabled={!ueberRows.length}>
              <Users className="w-4 h-4" />
              Alle sichtbaren wählen
            </Btn>

            <Btn onClick={clearSelection} disabled={!selectedIds.size}>
              <X className="w-4 h-4" />
              Auswahl leeren
            </Btn>

            <BtnPrimary onClick={bulkTransferToNextYear} disabled={loading || selectedIds.size === 0}>
              <ArrowRightLeft className="w-4 h-4" />
              Rest → Übernahme nächstes Jahr
            </BtnPrimary>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-900/40">
              <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={ueberRows.length > 0 && ueberRows.every((r) => selectedIds.has(r.userId))}
                    onChange={(e) => setAllVisibleSelectedUsers(e.target.checked)}
                  />
                </th>
                <th className="p-2">Name</th>
                <th className="p-2 text-right">Summe Jahr</th>
                <th className="p-2 text-right">Übernahme Vorjahr</th>
                <th className="p-2 text-right">Summe zusammengefasst</th>
                <th className="p-2 text-right">Vorgabe</th>
                <th className="p-2 text-right">Std. Jahresende</th>
                <th className="p-2 text-right">Abzug</th>
                <th className="p-2 text-right">Rest</th>
              </tr>
            </thead>

            <tbody>
              {ueberRows.map((r) => (
                <tr key={r.userId} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.userId)}
                      onChange={() => toggleSelected(r.userId)}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {r.hasRow ? 'Stunden-Datensatz vorhanden' : 'Kein Datensatz in DB_Stunden (Jahr)'}
                    </div>
                  </td>

                  <td className="p-2 text-right tabular-nums">{fmt(r.summeJahr)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.uebernahme)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.summeZusammen)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.vorgabe)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.jahresende)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.abzug)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.rest)}</td>
                </tr>
              ))}

              {!ueberRows.length && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-600 dark:text-gray-300">
                    Keine Einträge gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
