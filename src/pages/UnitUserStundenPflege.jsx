// src/pages/UnitUserStundenPflege.jsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import {
  Search, RefreshCw, Users, Settings, X, Check, Plus, ArrowRightLeft,
  ChevronDown, ChevronRight, Info, Wallet, CalendarClock
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import AenderungscheckTab from '../components/UnitUserStundenPflege/AenderungscheckTab';
import UeberstundenTab from '../components/UnitUserStundenPflege/UeberstundenTab';
import VorgabestundenTab from '../components/UnitUserStundenPflege/VorgabestundenTab';

dayjs.locale('de');

const T_USERS = 'DB_User';
const T_STUNDEN = 'DB_Stunden';
const T_WAZ = 'DB_WochenArbeitsZeit';
const T_ABZUG = 'DB_StundenAbzug';

// RPCs
const RPC_UPSERT_VORGABE = 'sp_upsert_vorgabe_stunden';

const ALLOWED_ROLES = ['Admin_Dev', 'Planner', 'Org_Admin', 'SuperAdmin'];

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

const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[980px] max-w-[95vw] max-h-[90vh] overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/40">
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default function UnitUserStundenPflege() {
  const { rolle, sichtFirma: firma_id, sichtUnit: unit_id, me } = useRollen();

  const roleOk = ALLOWED_ROLES.includes(rolle);

  const [tab, setTab] = useState('ueberstunden'); //ueberstunden | vorgabe | aenderungscheck
  const [jahr, setJahr] = useState(dayjs().year());
  const jahrNext = jahr + 1;

  const [search, setSearch] = useState('');

  // Überstunden Filter
  const [onlyPositiveDiff, setOnlyPositiveDiff] = useState(true);
  const [onlyWithAbzug, setOnlyWithAbzug] = useState(false);

  // Daten
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [stundenRows, setStundenRows] = useState([]);
  const [abzugSums, setAbzugSums] = useState([]);
  const [wazRows, setWazRows] = useState([]);

  // Auswahl
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Msg
  const [msg, setMsg] = useState(null);

  // Bulk-Block auf/zu
  const [bulkModeOpen, setBulkModeOpen] = useState(true);

  // Vorgabe Tab Filter + Sort
  const [onlyWithWAZ, setOnlyWithWAZ] = useState(true); // Standard: nur mit WAZ sichtbar
  const [wazFilter, setWazFilter] = useState('ALL');   // 'ALL' oder Zahl als string

  const [sortBy, setSortBy] = useState({ key: 'name', dir: 'asc' });
  const toggleSort = (key) => {
    setSortBy((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortRows = (rows) => {
    const dir = sortBy.dir === 'asc' ? 1 : -1;
    const key = sortBy.key;

    const get = (r) => {
      if (key === 'name') return (r.name || '').toLowerCase();
      const v = r[key];
      return v == null ? -Infinity : Number(v);
    };

    return [...(rows || [])].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  };

  // Vorgabe: manuelles Setzen
  const [manualVorgabe, setManualVorgabe] = useState('');

  /* ------------------------- Lade Basisdaten ------------------------- */
  const loadAll = async () => {
    if (!unit_id || !firma_id) return;
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

      // 2) Stunden (jahr + jahrNext)
      const yearsToLoad = Array.from(new Set([jahr, jahrNext]));
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

      // 4) WAZ
      const { data: wData, error: wErr } = await supabase
        .from(T_WAZ)
        .select('*')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .order('gueltig_ab', { ascending: true });

      if (wErr) throw wErr;
      setWazRows(wData || []);
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Fehler beim Laden' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleOk) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma_id, unit_id, jahr, roleOk]);

  /* ------------------------- Maps / Lookups ------------------------- */
  const stundenByUserYear = useMemo(() => {
    const m = new Map();
    (stundenRows || []).forEach((r) => {
      m.set(`${r.user_id}__${r.jahr}`, r);
    });
    return m;
  }, [stundenRows]);

  const abzugByUserYear = useMemo(() => {
    const m = new Map();
    (abzugSums || []).forEach((r) => {
      m.set(`${r.user_id}__${r.jahr}`, Number(r.sum || 0));
    });
    return m;
  }, [abzugSums]);

  const wazEffectiveForDate = (user_id, dateStr) => {
    const d = dayjs(dateStr).format('YYYY-MM-DD');
    const list = (wazRows || []).filter((r) => String(r.user_id) === String(user_id));
    if (!list.length) return null;

    const applicable = list
      .filter((r) => dayjs(r.gueltig_ab).format('YYYY-MM-DD') <= d)
      .sort((a, b) => dayjs(b.gueltig_ab).valueOf() - dayjs(a.gueltig_ab).valueOf());

    return applicable[0] || null;
  };

  /* ------------------------- Users (nur Suche + Überstundenfilter) ------------------------- */
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...(users || [])];

    return list.filter((u) => {
      const name = buildDisplayName(u).toLowerCase();
      if (q && !name.includes(q)) return false;

      if (tab === 'ueberstunden') {
        const userId = u.user_id || u.id;
        const s = stundenByUserYear.get(`${userId}__${jahr}`) || {};

        const vorgabe = Number(s?.vorgabe_stunden ?? 0);
        const uebernahme = Number(s?.uebernahme_vorjahr ?? 0);
        const ist = Number(s?.summe_jahr ?? s?.ist_stunden_gesamt ?? s?.stunden_ist ?? 0);
        const stundenGes = (s?.stunden_gesamt != null) ? Number(s?.stunden_gesamt ?? 0) : null;
        const abzug = Number(abzugByUserYear.get(`${userId}__${jahr}`) || 0);

        // Konto: bevorzugt stunden_gesamt, sonst fallback
        const konto = (stundenGes != null) ? stundenGes : (uebernahme + ist - abzug);

        const diff = konto - vorgabe;

        if (onlyPositiveDiff && diff <= 0) return false;
        if (onlyWithAbzug && abzug <= 0) return false;
      }

      return true;
    });
  }, [users, search, tab, jahr, stundenByUserYear, abzugByUserYear, onlyPositiveDiff, onlyWithAbzug]);

  /* ------------------------- Selection ------------------------- */
  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // für Überstunden: wählt sichtbare users
  const setAllVisibleSelectedUsers = (on) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      filteredUsers.forEach((u) => {
        const id = u.user_id || u.id;
        if (on) n.add(id);
        else n.delete(id);
      });
      return n;
    });
  };

  // für Vorgabe: wählt sichtbare ROWS (gefiltert)
  const setAllVisibleSelectedRows = (on, visibleRows) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      (visibleRows || []).forEach((r) => {
        if (on) n.add(r.userId);
        else n.delete(r.userId);
      });
      return n;
    });
  };

  /* ------------------------- Übernahme ins nächste Jahr (Überstunden) ------------------------- */
  const bulkTransferToNextYear = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      const nextY = jahr + 1;

      for (const uid of ids) {
        const s = stundenByUserYear.get(`${uid}__${jahr}`) || {};
        const vorgabe = Number(s?.vorgabe_stunden ?? 0);
        const uebernahme = Number(s?.uebernahme_vorjahr ?? 0);
        const ist = Number(s?.summe_jahr ?? 0);
        const stundenGes = (s?.stunden_gesamt != null) ? Number(s?.stunden_gesamt ?? 0) : null;
        const abzug = Number(abzugByUserYear.get(`${uid}__${jahr}`) || 0);

        const konto = (stundenGes != null) ? stundenGes : (uebernahme + ist - abzug);
        const rest = konto - vorgabe;

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

  /* ------------------------- Vorgabe-Aktionen ------------------------- */
  const bulkCalcNextYearFromWAZ = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const { error } = await supabase.rpc(RPC_UPSERT_VORGABE, {
          p_user_id: uid,
          p_firma_id: firma_id,
          p_unit_id: unit_id,
          p_year: jahrNext,
        });
        if (error) throw error;
      }

      setMsg({ type: 'ok', text: `Vorgabe für ${jahrNext} aus WAZ berechnet (${ids.length} MA).` });
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Berechnung fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkCopyCurrentToNextVorgabe = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const cur = stundenByUserYear.get(`${uid}__${jahr}`) || {};
        const v = Number(cur?.vorgabe_stunden ?? 0);

        const { data: existing, error: exErr } = await supabase
          .from(T_STUNDEN)
          .select('id')
          .eq('firma_id', firma_id)
          .eq('unit_id', unit_id)
          .eq('jahr', jahrNext)
          .eq('user_id', uid)
          .maybeSingle();

        if (exErr && exErr.code !== 'PGRST116') throw exErr;

        if (existing?.id) {
          const { error } = await supabase
            .from(T_STUNDEN)
            .update({ vorgabe_stunden: v, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from(T_STUNDEN).insert({
            user_id: uid,
            firma_id,
            unit_id,
            jahr: jahrNext,
            vorgabe_stunden: v,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        }
      }

      setMsg({ type: 'ok', text: `Vorgabe ${jahr} → ${jahrNext} übernommen (${ids.length} MA).` });
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Übernahme fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkSetManualVorgabeNextYear = async () => {
    const ids = Array.from(selectedIds);
    const v = Number(String(manualVorgabe).replace(',', '.'));

    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
    if (!Number.isFinite(v)) return setMsg({ type: 'err', text: 'Bitte eine gültige Zahl eingeben (z.B. 1680).' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const { data: existing, error: exErr } = await supabase
          .from(T_STUNDEN)
          .select('id')
          .eq('firma_id', firma_id)
          .eq('unit_id', unit_id)
          .eq('jahr', jahrNext)
          .eq('user_id', uid)
          .maybeSingle();

        if (exErr && exErr.code !== 'PGRST116') throw exErr;

        if (existing?.id) {
          const { error } = await supabase
            .from(T_STUNDEN)
            .update({ vorgabe_stunden: v, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from(T_STUNDEN).insert({
            user_id: uid,
            firma_id,
            unit_id,
            jahr: jahrNext,
            vorgabe_stunden: v,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        }
      }

      setMsg({ type: 'ok', text: `Vorgabe ${jahrNext} manuell gesetzt (${ids.length} MA).` });
      setManualVorgabe('');
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Manuelles Setzen fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------- Rows bauen ------------------------- */
  const ueberRows = useMemo(() => {
    return (filteredUsers || []).map((u) => {
      const userId = u.user_id || u.id;

      const s = stundenByUserYear.get(`${userId}__${jahr}`) || {};
      const vorgabe = Number(s.vorgabe_stunden ?? 0);
      const uebernahme = Number(s.uebernahme_vorjahr ?? 0);
      const ist = Number(s.summe_jahr ?? 0);
      const stundenGes = (s.stunden_gesamt != null) ? Number(s.stunden_gesamt ?? 0) : null;
      const abzug = Number(abzugByUserYear.get(`${userId}__${jahr}`) || 0);

      const konto = (stundenGes != null) ? stundenGes : (uebernahme + ist - abzug);
      const diff = konto - vorgabe;

      return {
        u,
        userId,
        name: buildDisplayName(u),
        vorgabe,
        uebernahme,
        ist,
        konto,
        diff,
        abzug,
        rest: diff,
        hasRow: !!s?.id,
      };
    });
  }, [filteredUsers, stundenByUserYear, abzugByUserYear, jahr]);

  const vorgabeRows = useMemo(() => {
    return (filteredUsers || []).map((u) => {
      const userId = u.user_id || u.id;

      const sCur = stundenByUserYear.get(`${userId}__${jahr}`) || {};
      const sNext = stundenByUserYear.get(`${userId}__${jahrNext}`) || {};

      const eff = wazEffectiveForDate(userId, `${jahrNext}-01-01`);
      const waz = eff ? Number(eff.wochenstunden ?? 0) : null;

      return {
        u,
        userId,
        name: buildDisplayName(u),
        nachname: u.nachname,
        vorname: u.vorname,
        personalnummer: u.personal_nummer,
        waz,
        vorgabeAktuell: Number(sCur.vorgabe_stunden ?? 0),
        vorgabeNext: Number(sNext.vorgabe_stunden ?? 0),
        hasNext: !!sNext?.id,
      };
    });
  }, [filteredUsers, stundenByUserYear, jahr, jahrNext, wazRows]);

  const wazOptionsList = useMemo(() => {
    const set = new Set();
    (vorgabeRows || []).forEach((r) => {
      if (r.waz != null) set.add(Number(r.waz));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [vorgabeRows]);

  /* ------------------------- Render ------------------------- */
  if (!roleOk) {
    return (
      <Card className="p-4">
        <div className="text-sm text-gray-700 dark:text-gray-200">Kein Zugriff.</div>
      </Card>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Stunden Pflege</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Unit: {unit_id} · Firma: {firma_id}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
                {yearOptions().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>

            <Btn onClick={loadAll} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </Btn>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setTab('aenderungscheck')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'aenderungscheck'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Änderungscheck
          </button>

          <button
            onClick={() => setTab('ueberstunden')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'ueberstunden'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Überstunden
          </button>

          <button
            onClick={() => setTab('vorgabe')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'vorgabe'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Vorgabestunden
          </button>
        </div>

        {/* Suche + Tab-Filter */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Suche nach Name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          {tab === 'ueberstunden' ? (
            <>
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
            </>
          ) : (
            <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Zieljahr: {jahrNext}
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                WAZ wird zeitanteilig berücksichtigt (inkl. Zukunftsänderungen).
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        {msg && (
          <div className={`mt-3 rounded-xl border p-2 text-sm
            ${msg.type === 'ok'
              ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100'
            }`}
          >
            {msg.text}
          </div>
        )}
      </Card>

      {/* Bulk Actions (nur Standard-Auswahl-Infos) */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
            onClick={() => setBulkModeOpen((v) => !v)}
          >
            {bulkModeOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Aktionen (Auswahl)
          </button>

          <div className="text-xs text-gray-600 dark:text-gray-300">
            Ausgewählt: <span className="font-semibold">{selectedIds.size}</span>
          </div>
        </div>

        {bulkModeOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tab === 'ueberstunden' ? (
              <>
                <Btn onClick={() => setAllVisibleSelectedUsers(true)}>
                  <Users className="w-4 h-4" />
                  Alle sichtbaren wählen
                </Btn>
                <Btn onClick={() => setAllVisibleSelectedUsers(false)}>
                  <X className="w-4 h-4" />
                  Auswahl leeren
                </Btn>

                <BtnPrimary onClick={bulkTransferToNextYear} disabled={loading || selectedIds.size === 0}>
                  <ArrowRightLeft className="w-4 h-4" />
                  Rest → Übernahme nächstes Jahr
                </BtnPrimary>
              </>
            ) : (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                (Im Vorgabe-Tab gibt es eigene Filter & Aktionen direkt über der Tabelle.)
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Tabs */}
      {tab === 'ueberstunden' ? (
  <UeberstundenTab
    rows={ueberRows}
    selectedIds={selectedIds}
    setAllVisibleSelectedUsers={setAllVisibleSelectedUsers}
    toggleSelected={toggleSelected}
    fmt={fmt}
  />
) : tab === 'vorgabe' ? (
  <VorgabestundenTab
    firma_id={firma_id}
    unit_id={unit_id}
    jahr={jahr}
    jahrNext={jahrNext}
    loading={loading}
    setLoading={setLoading}
    msg={msg}
    setMsg={setMsg}
    selectedIds={selectedIds}
    setSelectedIds={setSelectedIds}
    clearSelection={clearSelection}
    setAllVisibleSelected={setAllVisibleSelectedRows}
    toggleSelected={toggleSelected}
    vorgabeRows={vorgabeRows}
    loadAll={loadAll}
    onlyWithWAZ={onlyWithWAZ}
    setOnlyWithWAZ={setOnlyWithWAZ}
    wazFilter={wazFilter}
    setWazFilter={setWazFilter}
    wazOptions={wazOptionsList}
    sortBy={sortBy}
    toggleSort={toggleSort}
    sortRows={sortRows}
    manualVorgabe={manualVorgabe}
    setManualVorgabe={setManualVorgabe}
    bulkCalcNextYearFromWAZ={bulkCalcNextYearFromWAZ}
    bulkCopyCurrentToNextVorgabe={bulkCopyCurrentToNextVorgabe}
    bulkSetManualVorgabeNextYear={bulkSetManualVorgabeNextYear}
  />
) : (
  <AenderungscheckTab
    firma_id={firma_id}
    unit_id={unit_id}
    setMsg={setMsg}
  />
)}
    </div>
  );
}
