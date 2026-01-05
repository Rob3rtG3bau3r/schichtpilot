'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import {
  Search, RefreshCw, Users, X, ArrowRightLeft, ChevronDown, ChevronRight,
  AlertTriangle, Lock
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

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

const triMsgClass = (type) => (
  type === 'ok'
    ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100'
);

/* ---------------- Simple Modal ---------------- */
const Modal = ({ open, title, onClose, children, width = 'w-[760px]' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative ${width} max-w-[95vw] max-h-[90vh] overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl`}>
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

export default function UeberstundenTab({ firma_id, unit_id }) {
  const { me } = useRollen(); // für created_by usw. (uuid)

  const [jahr, setJahr] = useState(dayjs().year());

  // Suche + Filter
  const [search, setSearch] = useState('');
  const [onlyPositiveDiff, setOnlyPositiveDiff] = useState(true);
  const [onlyWithAbzug, setOnlyWithAbzug] = useState(false);

  // Neuer Filter: Rest Vergleich
  const [restCmp, setRestCmp] = useState('NONE'); // NONE | GE | LE | EQ
  const [restX, setRestX] = useState('');

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

  // Sort
  const [sortBy, setSortBy] = useState({ key: 'name', dir: 'asc' });
  const toggleSort = (key) => {
    setSortBy((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  // Abzug vorbereiten Mode
  const [abzugMode, setAbzugMode] = useState(false);

  // Password confirm modal for transfer
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState('');
  const [pwErr, setPwErr] = useState(null);

  // Abzug Modal
  const [abzugOpen, setAbzugOpen] = useState(false);
  const [abzugUser, setAbzugUser] = useState(null); // row
  const [abzugStunden, setAbzugStunden] = useState('');
  const [abzugKommentar, setAbzugKommentar] = useState('');
  const [abzugSaving, setAbzugSaving] = useState(false);

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

  const ueberRowsRaw = useMemo(() => {
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

      // Rest Vergleich
      if (restCmp !== 'NONE') {
        const x = Number(String(restX).replace(',', '.'));
        if (!Number.isFinite(x)) return false;
        if (restCmp === 'GE' && !(r.rest >= x)) return false;
        if (restCmp === 'LE' && !(r.rest <= x)) return false;
        if (restCmp === 'EQ' && !(r.rest === x)) return false;
      }

      return true;
    });
  }, [
    users, stundenByUserYear, abzugByUserYear, jahr,
    search, onlyPositiveDiff, onlyWithAbzug,
    restCmp, restX
  ]);
  // ✅ Ungefilterte Basisliste (wichtig für Übernahme, auch wenn Filter aktiv sind)
  const ueberRowsAll = useMemo(() => {
    return (users || []).map((u) => {
      const userId = u.user_id || u.id;
      const s = stundenByUserYear.get(`${userId}__${jahr}`) || {};

      const vorgabe = Number(s.vorgabe_stunden ?? 0);
      const uebernahme = Number(s.uebernahme_vorjahr ?? 0);
      const summeJahr = Number(s.summe_jahr ?? 0);

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
  }, [users, stundenByUserYear, abzugByUserYear, jahr]);

  // ✅ Schneller Zugriff: rest pro User (ungefiltert!)
  const ueberAllMap = useMemo(() => {
    const m = new Map();
    (ueberRowsAll || []).forEach((r) => m.set(String(r.userId), r));
    return m;
  }, [ueberRowsAll]);

  const ueberRows = useMemo(() => {
    const dir = sortBy.dir === 'asc' ? 1 : -1;
    const key = sortBy.key;

    const getVal = (r) => {
      if (key === 'name') return (r.name || '').toLowerCase();
      return Number(r[key] ?? -Infinity);
    };

    return [...ueberRowsRaw].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [ueberRowsRaw, sortBy]);

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

  /* =========================================================
     TRANSFER -> NEXT YEAR (PASSWORD CONFIRM)
     ========================================================= */

  const requestTransfer = () => {
    if (!selectedIds.size) {
      setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
      return;
    }
    setPwErr(null);
    setPwValue('');
    setPwOpen(true);
  };

  const verifyPassword = async () => {
    setPwErr(null);

    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u?.user?.email;

      if (!email) {
        setPwErr('E-Mail konnte nicht ermittelt werden (Supabase Auth).');
        return false;
      }
      if (!pwValue || pwValue.length < 4) {
        setPwErr('Bitte Passwort eingeben.');
        return false;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: pwValue });
      if (error) {
        setPwErr('Passwort ist nicht korrekt.');
        return false;
      }

      return true;
    } catch (e) {
      setPwErr(e?.message || 'Passwortprüfung fehlgeschlagen.');
      return false;
    }
  };

  const doTransfer = async () => {
    const ok = await verifyPassword();
    if (!ok) return;

    setPwOpen(false);
    setLoading(true);
    setMsg(null);

    try {
      const ids = Array.from(selectedIds);
      const nextY = jahr + 1;

      for (const uid of ids) {
        // ✅ Rest (kann auch negativ sein)
                const row = ueberAllMap.get(String(uid)); // ✅ immer aus ungefilterter Liste
        if (!row) throw new Error(`Kein Datensatz/Row für user_id=${uid} gefunden.`);
        const rest = Number(row.rest ?? 0); // ✅ kann positiv ODER negativ sein


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

  /* =========================================================
     ABZUG MODAL + SAVE
     ========================================================= */

  const openAbzugForRow = (r) => {
    setMsg(null);
    setAbzugUser(r);
    setAbzugStunden('');
    setAbzugKommentar('');
    setAbzugOpen(true);
  };

  const abzugCalc = useMemo(() => {
    if (!abzugUser) return null;

    const summeJahr = Number(abzugUser.summeJahr ?? 0);
    const uebernahme = Number(abzugUser.uebernahme ?? 0);
    const summeZusammen = Number(abzugUser.summeZusammen ?? (summeJahr + uebernahme));

    const bereitsAbzug = Number(abzugUser.abzug ?? 0);
    const neueSummeZusammen = summeZusammen - bereitsAbzug;

    const vorgabe = Number(abzugUser.vorgabe ?? 0);
    const stdJahresende = neueSummeZusammen - vorgabe;

    const v = Number(String(abzugStunden).replace(',', '.'));
    const inputAbzug = Number.isFinite(v) ? v : 0;

    const neuStdJahresende = stdJahresende - inputAbzug;

    return {
      summeJahr,
      uebernahme,
      summeZusammen,
      bereitsAbzug,
      neueSummeZusammen,
      vorgabe,
      stdJahresende,
      inputAbzug,
      neuStdJahresende,
    };
  }, [abzugUser, abzugStunden]);

  const saveAbzug = async () => {
    if (!abzugUser) return;

    const v = Number(String(abzugStunden).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) {
      setMsg({ type: 'err', text: 'Bitte eine gültige Abzug-Stundenanzahl > 0 eingeben.' });
      return;
    }

    setAbzugSaving(true);
    setMsg(null);

    try {
      // datum muss zum ausgewählten Jahr passen -> wir nehmen 31.12.<jahr>
      const datum = dayjs(`${jahr}-12-31`).format('YYYY-MM-DD');

      const { data: authUser } = await supabase.auth.getUser();
      const created_by = authUser?.user?.id || me?.user_id || me?.id || null;

      const { error } = await supabase
        .from(T_ABZUG)
        .insert({
          created_by,
          user_id: abzugUser.userId,
          firma_id,
          unit_id,
          jahr,
          datum,
          stunden: v,
          kommentar: (abzugKommentar || '').trim() || null,
        });

      if (error) throw error;

      setMsg({ type: 'ok', text: `Abzug gespeichert: ${abzugUser.name} (${fmt(v)} Std.)` });
      setAbzugOpen(false);
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Abzug speichern fehlgeschlagen.' });
    } finally {
      setAbzugSaving(false);
    }
  };

  /* ========================================================= */

  const allSelected = ueberRows.length > 0 && ueberRows.every((r) => selectedIds.has(r.userId));

  const restFilterActive = restCmp !== 'NONE';

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

        <div className="flex flex-wrap gap-4 items-center">
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

          {/* Neuer Filter: Rest Vergleich */}
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">
              Nur MA mit
            </div>
            <Select
              value={restCmp}
              onChange={(e) => setRestCmp(e.target.value)}
              className="w-28"
            >
              <option value="NONE">—</option>
              <option value="GE">{'>='}</option>
              <option value="LE">{'<='}</option>
              <option value="EQ">{'='}</option>
            </Select>
            <Input
              className="w-32"
              placeholder="X Std."
              value={restX}
              onChange={(e) => setRestX(e.target.value)}
              disabled={!restFilterActive}
            />
            {restFilterActive && (
              <button
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => { setRestCmp('NONE'); setRestX(''); }}
                type="button"
              >
                reset
              </button>
            )}
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Treffer: <b>{ueberRows.length}</b>
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl border p-2 text-sm ${triMsgClass(msg.type)}`}>
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
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <Btn onClick={() => setAllVisibleSelectedUsers(true)} disabled={!ueberRows.length}>
              <Users className="w-4 h-4" />
              Alle sichtbaren wählen
            </Btn>

            <Btn onClick={clearSelection} disabled={!selectedIds.size}>
              <X className="w-4 h-4" />
              Auswahl leeren
            </Btn>

            <BtnPrimary onClick={requestTransfer} disabled={loading || selectedIds.size === 0}>
              <ArrowRightLeft className="w-4 h-4" />
              Rest → Übernahme nächstes Jahr
            </BtnPrimary>

            {/* Neuer Mode */}
            <Btn
              onClick={() => setAbzugMode((v) => !v)}
              title="z.B. Auszahlung! Diese Stunden werden aus dem System genommen."
              className={abzugMode ? 'border-gray-900 dark:border-gray-100' : ''}
            >
              Stunden Abzug vorbereiten
            </Btn>

            {abzugMode && (
              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Abzug-Modus aktiv: Klick auf einen MA öffnet das Abzug-Modal.
              </div>
            )}
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
                    checked={allSelected}
                    onChange={(e) => setAllVisibleSelectedUsers(e.target.checked)}
                  />
                </th>

                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  Name {sortBy.key === 'name' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('summeJahr')}>
                  Summe Jahr {sortBy.key === 'summeJahr' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('uebernahme')}>
                  Übernahme Vorjahr {sortBy.key === 'uebernahme' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('summeZusammen')}>
                  Summe zusammengefasst {sortBy.key === 'summeZusammen' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('vorgabe')}>
                  Vorgabe {sortBy.key === 'vorgabe' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('jahresende')}>
                  Std. Jahresende {sortBy.key === 'jahresende' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('abzug')}>
                  Abzug {sortBy.key === 'abzug' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('rest')}>
                  Rest {sortBy.key === 'rest' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>

            <tbody>
              {ueberRows.map((r) => (
                <tr
                  key={r.userId}
                  className={`border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 ${abzugMode ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!abzugMode) return;
                    openAbzugForRow(r);
                  }}
                >
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Password Modal */}
      <Modal
        open={pwOpen}
        title="Aktion bestätigen"
        onClose={() => setPwOpen(false)}
        width="w-[520px]"
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Diese Aktion muss mit Ihrem Passwort bestätigt werden.
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="text-xs text-gray-600 dark:text-gray-300">Passwort</div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                type="password"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                placeholder="Passwort eingeben…"
                style={{ paddingLeft: 34 }}
              />
            </div>

            {pwErr && (
              <div className="text-sm text-red-700 dark:text-red-200">
                {pwErr}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Btn onClick={() => setPwOpen(false)}>Abbrechen</Btn>
            <BtnPrimary onClick={doTransfer} disabled={loading}>
              Bestätigen & ausführen
            </BtnPrimary>
          </div>

          <div className="text-[11px] text-gray-600 dark:text-gray-300">
            Hinweis: Es wird kurz gegen Supabase-Login geprüft (Session bleibt bestehen).
          </div>
        </div>
      </Modal>

      {/* Abzug Modal */}
      <Modal
        open={abzugOpen}
        title={`Stunden Abzug vorbereiten – ${abzugUser?.name || ''} (${jahr})`}
        onClose={() => setAbzugOpen(false)}
        width="w-[760px]"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Stunden Abzug (Stunden aus <b>Ausgewähltes Jahr</b>).
          </div>

          {/* Rechnung */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Rechnung</div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-700 dark:text-gray-200">Summe Jahr</div>
              <div className="text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.summeJahr)}</div>

              <div className="text-gray-700 dark:text-gray-200">+ Übernahme Vorjahr</div>
              <div className="text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.uebernahme)}</div>

              <div className="text-gray-700 dark:text-gray-200 font-semibold">= Summe zusammengefasst</div>
              <div className="text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.summeZusammen)}</div>

              <div className="text-gray-700 dark:text-gray-200">- bereits Abzug</div>
              <div className="text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.bereitsAbzug)}</div>

              <div className="text-gray-700 dark:text-gray-200 font-semibold">= neue Summe zusammengefasst</div>
              <div className="text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.neueSummeZusammen)}</div>

              <div className="text-gray-700 dark:text-gray-200">- Vorgabe</div>
              <div className="text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.vorgabe)}</div>

              <div className="text-gray-700 dark:text-gray-200 font-semibold">= Std. Jahresende</div>
              <div className="text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmt(abzugCalc?.stdJahresende)}</div>
            </div>
          </div>

          {/* Eingabe */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Abzug Stunden</div>
              <Input
                value={abzugStunden}
                onChange={(e) => setAbzugStunden(e.target.value)}
                placeholder="z.B. 12,5"
              />
            </div>

            <div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Neu (Std. Jahresende)</div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 tabular-nums">
                {fmt(abzugCalc?.neuStdJahresende)}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Kommentar</div>
            <Input
              value={abzugKommentar}
              onChange={(e) => setAbzugKommentar(e.target.value)}
              placeholder="z.B. Auszahlung 2026"
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Btn onClick={() => setAbzugOpen(false)}>Schließen</Btn>
            <BtnPrimary onClick={saveAbzug} disabled={abzugSaving}>
              Stunden Abzug durchführen
            </BtnPrimary>
          </div>

          <div className="text-[11px] text-gray-600 dark:text-gray-300">
            Speichert in <b>DB_StundenAbzug</b> (jahr={jahr}, datum=31.12.{jahr}).
          </div>
        </div>
      </Modal>
    </div>
  );
}
