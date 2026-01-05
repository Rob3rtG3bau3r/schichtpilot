'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import {
  Search, RefreshCw, Download, ChevronDown, ChevronRight, X, Pencil, Save, Lock
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

dayjs.locale('de');

const T_USERS = 'DB_User';
const T_ABZUG = 'DB_StundenAbzug';
const T_ABZUG_VERLAUF = 'DB_StundenAbzugVerlauf';

/* ---------------- UI Helpers (wie bei dir) ---------------- */
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

const Input = ({ className = '', ...props }) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
      px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
      focus:ring-2 focus:ring-gray-400/40 ${className}`}
  />
);

const Select = ({ className = '', ...props }) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
      px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
      focus:ring-2 focus:ring-gray-400/40 ${className}`}
  />
);

const triMsgClass = (type) => (
  type === 'ok'
    ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100'
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

/* ---------------- CSV helper ---------------- */
const toCsv = (rows, sep = ';') => {
  const esc = (v) => {
    const s = (v == null ? '' : String(v));
    const needs = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(sep);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };
  return rows.map((r) => r.map(esc).join(sep)).join('\r\n');
};

export default function AbzugstundenTab({ firma_id, unit_id }) {
  const { me } = useRollen();

  const [jahr, setJahr] = useState(dayjs().year());
  const [search, setSearch] = useState('');

  // Filter
  const [onlyWithAbzug, setOnlyWithAbzug] = useState(true);
  const [showVerlauf, setShowVerlauf] = useState(true);
  const [showSummiert, setShowSummiert] = useState(false);

  // Data
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [users, setUsers] = useState([]);
  const [abzugRows, setAbzugRows] = useState([]);
  const [verlaufRows, setVerlaufRows] = useState([]);

  // Accordion
  const [accOpen, setAccOpen] = useState(true);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editStunden, setEditStunden] = useState('');
  const [editAddKommentar, setEditAddKommentar] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Passwort confirm (wie bei dir)
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState('');
  const [pwErr, setPwErr] = useState(null);

  const loadAll = async () => {
    if (!firma_id || !unit_id) return;
    setLoading(true);
    setMsg(null);

    try {
      // Users
      const { data: uData, error: uErr } = await supabase
        .from(T_USERS)
        .select('user_id, vorname, nachname, email, rolle, aktiv, firma_id, unit_id')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .order('nachname', { ascending: true })
        .order('vorname', { ascending: true });
      if (uErr) throw uErr;
      setUsers(uData || []);

      // Abzug rows (Jahr)
      const { data: aData, error: aErr } = await supabase
        .from(T_ABZUG)
        .select('id, created_at, created_by, user_id, firma_id, unit_id, jahr, datum, stunden, kommentar')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .eq('jahr', jahr)
        .order('datum', { ascending: false })
        .order('created_at', { ascending: false });

      if (aErr) throw aErr;
      setAbzugRows(aData || []);

      // Verlauf rows (Jahr)
      // Achtung: kann groß werden. Wir holen erstmal alles vom Jahr.
      const { data: vData, error: vErr } = await supabase
        .from(T_ABZUG_VERLAUF)
        .select('id, abzug_id, firma_id, unit_id, jahr, user_id, changed_at, changed_by, old_stunden, new_stunden, old_kommentar, new_kommentar, append_text')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .eq('jahr', jahr)
        .order('changed_at', { ascending: false });

      if (vErr) throw vErr;
      setVerlaufRows(vData || []);
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

  const usersMap = useMemo(() => {
    const m = new Map();
    (users || []).forEach((u) => m.set(String(u.user_id || u.id), u));
    return m;
  }, [users]);

  const verlaufByAbzugId = useMemo(() => {
    const m = new Map();
    (verlaufRows || []).forEach((v) => {
      const k = String(v.abzug_id);
      const arr = m.get(k) || [];
      arr.push(v);
      m.set(k, arr);
    });
    return m;
  }, [verlaufRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (abzugRows || []).filter((r) => {
      const u = usersMap.get(String(r.user_id));
      const name = buildDisplayName(u).toLowerCase();

      if (q && !name.includes(q)) return false;
      if (onlyWithAbzug && !(Number(r.stunden || 0) !== 0)) return false;

      return true;
    });
  }, [abzugRows, usersMap, search, onlyWithAbzug]);

  const groupedSummed = useMemo(() => {
    const m = new Map();

    for (const r of filteredRows) {
      const k = String(r.user_id);
      const prev = m.get(k) || { user_id: r.user_id, sum: 0, rows: [] };
      prev.sum += Number(r.stunden || 0);
      prev.rows.push(r);
      m.set(k, prev);
    }

    const arr = Array.from(m.values()).map((g) => {
      const u = usersMap.get(String(g.user_id));
      return { ...g, name: buildDisplayName(u) };
    });

    arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    return arr;
  }, [filteredRows, usersMap]);

  const openEdit = (row) => {
    setMsg(null);
    setEditRow(row);
    setEditStunden(String(row?.stunden ?? ''));
    setEditAddKommentar('');
    setEditOpen(true);
  };

  /* ---------------- Passwort Check ---------------- */
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

  const requestSaveEdit = () => {
    setPwErr(null);
    setPwValue('');
    setPwOpen(true);
  };

  /* ---------------- Save Edit (Update + Kommentar nur append) ---------------- */
  const saveEdit = async () => {
    if (!editRow) return;

    const newVal = Number(String(editStunden).replace(',', '.'));
    if (!Number.isFinite(newVal)) {
      setMsg({ type: 'err', text: 'Bitte eine gültige Stunden-Zahl eingeben.' });
      return;
    }

    setEditSaving(true);
    setMsg(null);

    try {
      // aktuellen Datensatz holen (damit Kommentar wirklich appended wird)
      const { data: cur, error: curErr } = await supabase
        .from(T_ABZUG)
        .select('id, stunden, kommentar')
        .eq('id', editRow.id)
        .maybeSingle();

      if (curErr) throw curErr;
      if (!cur?.id) throw new Error('Datensatz nicht gefunden.');

      const oldVal = Number(cur.stunden || 0);

      const now = dayjs().format('DD.MM.YYYY HH:mm');
      const { data: authUser } = await supabase.auth.getUser();
      const changer = authUser?.user?.id || me?.user_id || me?.id || 'unknown';

      // Kommentar nur append
      const extra = (editAddKommentar || '').trim();
      const line1 = `[${now}] Änderung durch ${changer}: ${fmt(oldVal)} → ${fmt(newVal)} Std.`;
      const line2 = extra ? `Kommentar: ${extra}` : null;

      const oldKom = (cur.kommentar || '').trim();
      const appended = [oldKom, line1, line2].filter(Boolean).join('\n');

      // Update -> Trigger schreibt automatisch DB_StundenAbzugVerlauf
      const { error: upErr } = await supabase
        .from(T_ABZUG)
        .update({
          stunden: newVal,
          kommentar: appended,
        })
        .eq('id', editRow.id);

      if (upErr) throw upErr;

      setMsg({ type: 'ok', text: 'Abzug geändert (Verlauf wurde automatisch gespeichert).' });
      setEditOpen(false);
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Änderung fehlgeschlagen.' });
    } finally {
      setEditSaving(false);
    }
  };

  const doSaveEditWithPw = async () => {
    const ok = await verifyPassword();
    if (!ok) return;
    setPwOpen(false);
    await saveEdit();
  };

  /* ---------------- CSV Export ---------------- */
  const downloadCsv = () => {
    const rows = [];

    if (showSummiert) {
      rows.push(['Jahr', 'user_id', 'Name', 'Abzug (Summe Std.)', 'Anzahl Abzug-Einträge']);
      groupedSummed.forEach((g) => {
        rows.push([String(jahr), String(g.user_id), g.name, String(g.sum).replace('.', ','), String(g.rows.length)]);

        if (showVerlauf) {
          // Verlauf je Abzug-Eintrag mitschreiben
          g.rows.forEach((r) => {
            rows.push(['', '', `  - Abzug ID ${r.id}`, String(Number(r.stunden || 0)).replace('.', ','), `${dayjs(r.datum).format('DD.MM.YYYY')}`]);

            const hist = (verlaufByAbzugId.get(String(r.id)) || []);
            hist.forEach((h) => {
              rows.push([
                '', '', `    Verlauf ${h.id}`,
                `${String(Number(h.old_stunden || 0)).replace('.', ',')} -> ${String(Number(h.new_stunden || 0)).replace('.', ',')}`,
                dayjs(h.changed_at).format('DD.MM.YYYY HH:mm')
              ]);
            });
          });
        }
      });
    } else {
      rows.push(['Jahr', 'Datum', 'created_at', 'Abzug-ID', 'user_id', 'Name', 'Stunden', 'Kommentar', 'Verlauf (count)']);

      filteredRows.forEach((r) => {
        const u = usersMap.get(String(r.user_id));
        const name = buildDisplayName(u);
        const hist = verlaufByAbzugId.get(String(r.id)) || [];

        rows.push([
          String(r.jahr),
          r.datum ? dayjs(r.datum).format('DD.MM.YYYY') : '',
          r.created_at ? dayjs(r.created_at).format('DD.MM.YYYY HH:mm') : '',
          String(r.id),
          String(r.user_id),
          name,
          String(Number(r.stunden || 0)).replace('.', ','),
          r.kommentar || '',
          String(hist.length),
        ]);

        if (showVerlauf && hist.length) {
          hist.forEach((h) => {
            rows.push([
              '', '', '', `Verlauf ${h.id}`, '', '',
              `${String(Number(h.old_stunden || 0)).replace('.', ',')} -> ${String(Number(h.new_stunden || 0)).replace('.', ',')}`,
              (h.append_text || '').trim(),
              dayjs(h.changed_at).format('DD.MM.YYYY HH:mm'),
            ]);
          });
        }
      });
    }

    const csv = toCsv(rows, ';');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `stundenabzug_${firma_id}_${unit_id}_${jahr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
            <Btn onClick={downloadCsv} disabled={loading}>
              <Download className="w-4 h-4" />
              CSV
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={onlyWithAbzug}
              onChange={(e) => setOnlyWithAbzug(e.target.checked)}
            />
            Nur MA mit Abzug
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={showVerlauf}
              onChange={(e) => setShowVerlauf(e.target.checked)}
            />
            Anzeigen mit Verlauf
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={showSummiert}
              onChange={(e) => setShowSummiert(e.target.checked)}
            />
            Anzeigen summiert
          </label>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            {showSummiert
              ? <>Mitarbeiter: <b>{groupedSummed.length}</b></>
              : <>Einträge: <b>{filteredRows.length}</b></>}
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl border p-2 text-sm ${triMsgClass(msg.type)}`}>
            {msg.text}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-3">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
          onClick={() => setAccOpen((v) => !v)}
        >
          {accOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Stunden-Abzug Übersicht
        </button>

        {accOpen && (
          <div className="mt-3">
            {showSummiert ? (
              <div className="space-y-2">
                {groupedSummed.map((g) => (
                  <div key={String(g.user_id)} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{g.name}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Abzug-Einträge: {g.rows.length}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                          {fmt(g.sum)} Std.
                        </div>
                      </div>
                    </div>

                    {/* Detail-Liste */}
                    <div className="overflow-auto">
                      <table className="min-w-[1100px] w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-900/40">
                          <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                            <th className="p-2">Datum</th>
                            <th className="p-2">Erstellt</th>
                            <th className="p-2 text-right">Stunden</th>
                            <th className="p-2">Kommentar</th>
                            <th className="p-2 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r) => {
                            const hist = verlaufByAbzugId.get(String(r.id)) || [];
                            return (
                              <React.Fragment key={r.id}>
                                <tr className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                                  <td className="p-2">{r.datum ? dayjs(r.datum).format('DD.MM.YYYY') : '—'}</td>
                                  <td className="p-2">{r.created_at ? dayjs(r.created_at).format('DD.MM.YYYY HH:mm') : '—'}</td>
                                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.stunden)}</td>
                                  <td className="p-2">
                                    <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                      {r.kommentar || '—'}
                                    </div>
                                  </td>
                                  <td className="p-2 text-right">
                                    <Btn
                                      className="px-2 py-1"
                                      onClick={() => openEdit(r)}
                                      title="Abzug ändern (Kommentar wird erweitert, Verlauf automatisch gespeichert)"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Btn>
                                  </td>
                                </tr>

                                {showVerlauf && hist.length > 0 && (
                                  <tr className="border-t border-gray-200 dark:border-gray-700">
                                    <td colSpan={5} className="p-2 bg-gray-50 dark:bg-gray-900/20">
                                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                        Verlauf ({hist.length})
                                      </div>
                                      <div className="overflow-auto">
                                        <table className="min-w-[1000px] w-full text-xs">
                                          <thead className="text-gray-600 dark:text-gray-300">
                                            <tr className="text-left">
                                              <th className="p-1">Geändert</th>
                                              <th className="p-1">Alt → Neu</th>
                                              <th className="p-1">Append</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {hist.map((h) => (
                                              <tr key={h.id} className="border-t border-gray-200 dark:border-gray-700">
                                                <td className="p-1">{dayjs(h.changed_at).format('DD.MM.YYYY HH:mm')}</td>
                                                <td className="p-1 tabular-nums">
                                                  {fmt(h.old_stunden)} → {fmt(h.new_stunden)}
                                                </td>
                                                <td className="p-1 whitespace-pre-wrap">
                                                  {(h.append_text || '').trim() || '—'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {!g.rows.length && (
                            <tr><td colSpan={5} className="p-4 text-center text-gray-600 dark:text-gray-300">Keine Einträge.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {!groupedSummed.length && (
                  <div className="p-4 text-center text-gray-600 dark:text-gray-300">
                    Keine Einträge gefunden.
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-900/40">
                    <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                      <th className="p-2">Name</th>
                      <th className="p-2">Datum</th>
                      <th className="p-2">Erstellt</th>
                      <th className="p-2 text-right">Stunden</th>
                      <th className="p-2">Kommentar</th>
                      <th className="p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const u = usersMap.get(String(r.user_id));
                      const name = buildDisplayName(u);
                      const hist = verlaufByAbzugId.get(String(r.id)) || [];

                      return (
                        <React.Fragment key={r.id}>
                          <tr className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                            <td className="p-2 font-semibold text-gray-900 dark:text-gray-100">{name}</td>
                            <td className="p-2">{r.datum ? dayjs(r.datum).format('DD.MM.YYYY') : '—'}</td>
                            <td className="p-2">{r.created_at ? dayjs(r.created_at).format('DD.MM.YYYY HH:mm') : '—'}</td>
                            <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.stunden)}</td>
                            <td className="p-2">
                              <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                {r.kommentar || '—'}
                              </div>
                            </td>
                            <td className="p-2 text-right">
                              <Btn className="px-2 py-1" onClick={() => openEdit(r)}>
                                <Pencil className="w-4 h-4" />
                              </Btn>
                            </td>
                          </tr>

                          {showVerlauf && hist.length > 0 && (
                            <tr className="border-t border-gray-200 dark:border-gray-700">
                              <td colSpan={6} className="p-2 bg-gray-50 dark:bg-gray-900/20">
                                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                  Verlauf ({hist.length})
                                </div>
                                <div className="overflow-auto">
                                  <table className="min-w-[1000px] w-full text-xs">
                                    <thead className="text-gray-600 dark:text-gray-300">
                                      <tr className="text-left">
                                        <th className="p-1">Geändert</th>
                                        <th className="p-1">Alt → Neu</th>
                                        <th className="p-1">Append</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {hist.map((h) => (
                                        <tr key={h.id} className="border-t border-gray-200 dark:border-gray-700">
                                          <td className="p-1">{dayjs(h.changed_at).format('DD.MM.YYYY HH:mm')}</td>
                                          <td className="p-1 tabular-nums">{fmt(h.old_stunden)} → {fmt(h.new_stunden)}</td>
                                          <td className="p-1 whitespace-pre-wrap">{(h.append_text || '').trim() || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {!filteredRows.length && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-600 dark:text-gray-300">
                          Keine Einträge gefunden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        title={`Abzug ändern – ${(() => {
          const u = usersMap.get(String(editRow?.user_id));
          return buildDisplayName(u);
        })()} (${jahr})`}
        onClose={() => setEditOpen(false)}
        width="w-[760px]"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Kommentar ist <b>nicht löschbar</b> – Änderungen werden automatisch angehängt.
            <br />
            Der Verlauf wird zusätzlich in <b>{T_ABZUG_VERLAUF}</b> protokolliert.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Neue Abzug-Stunden</div>
              <Input
                value={editStunden}
                onChange={(e) => setEditStunden(e.target.value)}
                placeholder="z.B. 12,5"
              />
            </div>
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Datum</div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {editRow?.datum ? dayjs(editRow.datum).format('DD.MM.YYYY') : '—'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Optionaler Zusatz-Kommentar (wird angehängt)</div>
            <Input
              value={editAddKommentar}
              onChange={(e) => setEditAddKommentar(e.target.value)}
              placeholder="z.B. Korrektur nach Rücksprache"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Aktueller Kommentar</div>
            <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
              {editRow?.kommentar || '—'}
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Btn onClick={() => setEditOpen(false)}>Schließen</Btn>
            <BtnPrimary onClick={requestSaveEdit} disabled={editSaving}>
              <Save className="w-4 h-4" />
              Speichern
            </BtnPrimary>
          </div>
        </div>
      </Modal>

      {/* Passwort Modal */}
      <Modal
        open={pwOpen}
        title="Änderung bestätigen"
        onClose={() => setPwOpen(false)}
        width="w-[520px]"
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Diese Änderung muss mit Ihrem Passwort bestätigt werden.
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
            <BtnPrimary onClick={doSaveEditWithPw} disabled={editSaving}>
              Bestätigen & speichern
            </BtnPrimary>
          </div>

          <div className="text-[11px] text-gray-600 dark:text-gray-300">
            Hinweis: Es wird kurz gegen Supabase-Login geprüft (Session bleibt bestehen).
          </div>
        </div>
      </Modal>
    </div>
  );
}
