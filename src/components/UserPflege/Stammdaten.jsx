'use client';
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';

const ALLOWED_ROLES = ['Employee', 'Team_Leader', 'Planner'];

const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`} {...rest}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{children}</div>
);
const Label = ({ children }) => <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{children}</label>;
const Input = (props) => <input {...props} className={`w-full rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||''}`} />;
const Select = (props) => <select {...props} className={`w-full rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||''}`} />;
const Checkbox = ({ label, checked, onChange, disabled }) => (
  <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-60' : ''}`}>
    <input type="checkbox" className="w-4 h-4" checked={checked} onChange={onChange} disabled={disabled} />
    <span className="text-sm text-gray-800 dark:text-gray-100">{label}</span>
  </label>
);
const Pill = ({ children }) => <span className="inline-flex items-center rounded-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300">{children}</span>;

function wechselText(wechsel){ if(!wechsel) return 'Kein Wechsel vorgesehen'; const d = dayjs(wechsel.datum).format('DD.MM.YYYY'); return `${d} → ${wechsel.schichtgruppe}`; }

// helper: eq nur anwenden, wenn val vorhanden
const addEq = (q, col, val) => (val === null || val === undefined ? q : q.eq(col, val));

// 🔔 kleine Inline-Notice
function Notice({ type='info', text, onClose }, ref) {
  const styles = {
    success: 'bg-gray-500/30 dark:gray-500/50 text-gray-900 dark:text-gray-100',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200',
    error:   'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
    info:    'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200',
  }[type] || '';
  const Icon = type==='success' ? CheckCircle : type==='error' ? AlertTriangle : Info;
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={`mb-3 rounded-xl border px-3 py-2 flex items-start gap-2 ${styles}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="text-sm flex-1">{text}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Meldung schließen"
        className="text-xs opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
const NoticeBar = React.forwardRef(Notice);

export default function Stammdaten({ userId, onSaved, onCancel }) {
  // === WICHTIG: robuste Kontext-Keys ===
  const rollen = useRollen() || {};
  const firma = rollen.sichtFirma ?? rollen.firma_id ?? rollen.firmaId ?? null;
  const unit  = rollen.sichtUnit  ?? rollen.unit_id  ?? rollen.unitId  ?? null;

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Editierbar
  const [nachname, setNachname] = useState('');
  const [rolle, setRolle] = useState('Employee');
  const [ausgrauen, setAusgrauen] = useState(false);   // 1:1 user_visible
  const [aktiv, setAktiv] = useState(true);

  // Deaktivierungs-Optionen
  const [willLoeschenKampfliste, setWillLoeschenKampfliste] = useState(false);
  const [loeschDatum, setLoeschDatum] = useState(dayjs().format('YYYY-MM-DD'));

  // Anzeige
  const [aktuelleSchicht, setAktuelleSchicht] = useState(null);
  const [geplanterWechsel, setGeplanterWechsel] = useState(null);
  const [qualis, setQualis] = useState([]); // {label, seit}

  // 🔔 Notice-State
  const [notice, setNotice] = useState(null); // { type: 'success'|'warning'|'error'|'info', text: string }
  const noticeRef = useRef(null);
  const noticeTimer = useRef(null);
  const showNotice = (type, text, timeoutMs = 3000) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    // sanft zum Bereich scrollen
    setTimeout(()=> noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    if (timeoutMs) {
      noticeTimer.current = setTimeout(() => setNotice(null), timeoutMs);
    }
  };

  useEffect(()=>{
    // Reset bei neuer Auswahl
    setUser(null); setNachname(''); setRolle('Employee'); setAusgrauen(false); setAktiv(true);
    setWillLoeschenKampfliste(false); setLoeschDatum(dayjs().format('YYYY-MM-DD'));
    setAktuelleSchicht(null); setGeplanterWechsel(null); setQualis([]);
    setNotice(null);

    if (!userId) return;

    (async ()=>{
      // === DB_User: nur filtern, wenn firma/unit vorhanden ===
      let uQ = supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle, user_visible, aktiv, inaktiv_at, funktion, firma_id, unit_id')
        .eq('user_id', userId);
      uQ = addEq(addEq(uQ, 'firma_id', firma), 'unit_id', unit);

      const { data: u, error: uErr } = await uQ.single();
      if (uErr || !u) { console.error('DB_User:', uErr || 'not found'); return; }

      setUser(u);
      setNachname(u.nachname || '');
      setRolle(u.rolle || 'Employee');
      setAusgrauen(!u.user_visible);
      setAktiv(u.aktiv ?? true);

      const heute = dayjs().format('YYYY-MM-DD');

      // === Kampfliste: versuche 'user', falle auf 'user_id' zurück, jeweils mit optionalen Filtern ===
      const loadK = async (cmp /* 'lte' | 'gte' */) => {
        const asc = cmp === 'gte';
        // Versuch A: Spalte 'user'
        let qA = supabase.from('DB_Kampfliste').select('datum, schichtgruppe, user')[cmp]('datum', heute).eq('user', u.user_id).order('datum', { ascending: asc });
        qA = addEq(addEq(qA, 'firma_id', firma), 'unit_id', unit);
        let { data, error } = await qA;
        if (!error && data && data.length) return data;
        // Versuch B: Spalte 'user_id'
        let qB = supabase.from('DB_Kampfliste').select('datum, schichtgruppe, user_id')[cmp]('datum', heute).eq('user_id', u.user_id).order('datum', { ascending: asc });
        qB = addEq(addEq(qB, 'firma_id', firma), 'unit_id', unit);
        const { data: d2 } = await qB;
        return d2 || [];
      };

      const past = await loadK('lte');
      const future = await loadK('gte');

      if (past && past.length>0) setAktuelleSchicht(past[past.length-1]?.schichtgruppe || past[0]?.schichtgruppe || null);
      else if (future && future.length>0) setAktuelleSchicht(future[0].schichtgruppe || null);
      else setAktuelleSchicht(null);

      if (future && future.length>0) {
        const first = future[0];
        const wechsel = future.find(k => k.schichtgruppe && k.schichtgruppe !== first.schichtgruppe);
        setGeplanterWechsel(wechsel ? { datum: wechsel.datum, schichtgruppe: wechsel.schichtgruppe } : null);
      } else setGeplanterWechsel(null);

      // === Qualifikationen: Zuweisungen + Matrix (robust) ===
      const { data: qData } = await supabase
        .from('DB_Qualifikation')
        .select('quali, created_at')
        .eq('user_id', u.user_id);

      const ids = Array.from(new Set((qData||[]).map(q=>q.quali).filter(v=>v!=null)));
      const byId = new Map();
      if (ids.length>0) {
        // Primär: DB_Qualifikationsmatrix
        let { data: mData, error: mErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, quali_kuerzel, qualifikation, aktiv, firma_id, unit_id')
          .in('id', ids);
        if (!mErr && mData) {
          mData.forEach(m => byId.set(m.id, m));
        } else {
          // Fallback: DB_QualifikationMatrix (falls anders benannt)
          const { data: alt } = await supabase
            .from('DB_QualifikationMatrix')
            .select('id, quali_kuerzel, qualifikation')
            .in('id', ids);
          (alt||[]).forEach(m => byId.set(m.id, m));
        }
      }

      setQualis((qData||[]).map(q=>{
        const m = byId.get(q.quali);
        const label = m?.qualifikation ||m?.quali_kuerzel || `#${q.quali}`;
        return { label, seit: q.created_at ? dayjs(q.created_at).format('DD.MM.YYYY') : '—' };
      }));
    })();
  }, [userId, firma, unit]);

  const disabled = loading || !userId;

  const save = async ()=>{
    if(!user) return;
    setLoading(true);
    try{
      if(!aktiv && willLoeschenKampfliste){
        const chosen = dayjs(loeschDatum, 'YYYY-MM-DD');
        if (chosen.isBefore(dayjs().startOf('day'))) {
          showNotice('warning', 'Bitte kein Datum in der Vergangenheit wählen (Dienstplan-Nachvollziehbarkeit).', 6000);
          setLoading(false);
          return;
        }
      }

      // User speichern (nur vorhandene Firma/Unit filtern)
      const payload = {
        nachname,
        rolle,
        user_visible: !ausgrauen, // invertiert speichern
        aktiv,
        inaktiv_at: !aktiv ? dayjs().toISOString() : null,
      };
      let upd = supabase.from('DB_User').update(payload).eq('user_id', user.user_id);
      upd = addEq(addEq(upd, 'firma_id', firma), 'unit_id', unit);
      const { error: updErr } = await upd;
      if (updErr) {
        console.error(updErr);
        showNotice('error', 'Speichern fehlgeschlagen.');
        setLoading(false);
        return;
      }

      // Zukünftige Dienste löschen (optional)
      if(!aktiv && willLoeschenKampfliste){
        let del = supabase.from('DB_Kampfliste').delete().gte('datum', loeschDatum);
        // robust: versuche 'user', sonst 'user_id'
        del = del.eq('user', user.user_id);
        del = addEq(addEq(del, 'firma_id', firma), 'unit_id', unit);
        let { data: delRows, error: delErr } = await del.select('datum');
        if (delErr) {
          // fallback user_id
          let del2 = supabase.from('DB_Kampfliste').delete().gte('datum', loeschDatum).eq('user_id', user.user_id);
          del2 = addEq(addEq(del2, 'firma_id', firma), 'unit_id', unit);
          const res2 = await del2.select('datum');
          delRows = res2.data; delErr = res2.error;
        }

        if (delErr) {
          console.error(delErr);
          showNotice('warning', 'Aktualisiert, aber zukünftige Dienste konnten nicht entfernt werden.', 6000);
        } else {
          const cnt = (delRows||[]).length;
          showNotice('success', `Gespeichert. Ab ${dayjs(loeschDatum).format('DD.MM.YYYY')} ${cnt>0?`wurden ${cnt} zukünftige Dienste entfernt.`:'waren keine zukünftigen Dienste vorhanden.'}`);
        }
      } else {
        showNotice('success', 'Gespeichert.');
      }

      onSaved && onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-xl border border-gray-300">
      <div className="px-4 pt-4 font-bold text-lg text-gray-900 dark:text-gray-200 ">Stammdaten</div>

      {!userId ? (
        <div className="p-6 text-gray-500 dark:text-gray-300">Wähle links eine Person aus.</div>
      ) : !user ? (
        <div className="p-6 text-gray-500 dark:text-gray-300">Lade…</div>
      ) : (
        <div className="p-4 space-y-6">
          {/* Namen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Vorname (nicht änderbar)</Label>
              <Input value={user.vorname || ''} disabled />
            </div>
            <div>
              <Label>Nachname (änderbar)</Label>
              <Input value={nachname} onChange={e=>setNachname(e.target.value)} disabled={disabled}/>
            </div>
          </div>

          {/* Funktion / Rolle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Funktion (nicht änderbar)</Label>
              <Input value={user.funktion || '—'} disabled />
            </div>
            <div>
              <Label>Rolle (änderbar)</Label>
              <Select value={rolle} onChange={e=>setRolle(e.target.value)} disabled={disabled}>
                {ALLOWED_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          </div>

          {/* Ausgrauen / Aktiv */}
          <div className="space-y-3">
            <Checkbox label="Ausgrauen in der Planung" checked={!!ausgrauen} onChange={e=>setAusgrauen(e.target.checked)} disabled={disabled} />
            <div className="flex items-start gap-2">
              <Checkbox label="Aktiv" checked={!!aktiv} onChange={e=>setAktiv(e.target.checked)} disabled={disabled} />
              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                <Info className="w-4 h-4 mt-0.5" />
                <span>Wenn <em>Aktiv</em> deaktiviert ist, werden die <strong>Login-Daten in 24&nbsp;Std.</strong> automatisch gelöscht.</span>
              </div>
            </div>

            {!aktiv && (
              <div className="mt-2 p-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700">
                <div className="mb-2 text-red-700 dark:text-red-300 text-sm">
                  <strong>Achtung:</strong> Der Benutzerzugang wird innerhalb der nächsten <strong>24 Stunden</strong> dauerhaft deaktiviert (Login-Daten werden gelöscht).
                </div>
                <Checkbox
                  label="Sollen Dienste vom User gelöscht werden?"
                  checked={!!willLoeschenKampfliste}
                  onChange={e=>setWillLoeschenKampfliste(e.target.checked)}
                  disabled={disabled}
                />
                {willLoeschenKampfliste && (
                  <div className="mt-3 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Ab wann zukünftige Dienste entfernen?</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Datum (Standard: heute)</Label>
                        <Input type="date" value={loeschDatum} onChange={e=>setLoeschDatum(e.target.value)} disabled={disabled}/>
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300 self-end">
                        Bitte <strong>nicht</strong> rückwirkend löschen, damit der Dienstplan nachvollziehbar bleibt.
                      </div>
                    </div>
                    {dayjs(loeschDatum).isBefore(dayjs().startOf('day')) && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">Achtung: Das gewählte Datum liegt in der Vergangenheit. Bitte anpassen.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schichtgruppe & Wechsel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Aktuelle Schichtgruppe</Label>
              <Input value={aktuelleSchicht || '—'} disabled />
            </div>
            <div>
              <Label>Geplanter Wechsel</Label>
              <Input value={wechselText(geplanterWechsel)} disabled />
            </div>
          </div>

          {/* Qualifikationen */}
          <div>
            <Label>Qualifikationen (seit)</Label>
            <div className="flex flex-wrap gap-2">
              {qualis.length === 0 ? (
                <span className="text-sm text-gray-500 dark:text-gray-300">Keine Qualifikationen hinterlegt.</span>
              ) : (
                qualis.map((q, idx) => (<Pill key={idx}>{q.label} · seit {q.seit}</Pill>))
              )}
            </div>
          </div>



{/* Buttons + Notice als Grid */}
<div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 pt-2 pb-5">
  {/* Spalte 1 = Spacer */}
  <div />

  {/* Spalte 2 = Abbrechen */}
  <button
    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-white transition
               bg-blue-600 hover:bg-blue-500 dark:hover:bg-blue-700 border border-blue-300 dark:border-blue-700"
    onClick={onCancel}
    disabled={disabled}
  >
    Abbrechen
  </button>

  {/* Spalte 3 = Speichern */}
  <button
    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition
               bg-green-700 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
    onClick={save}
    disabled={disabled}
  >
    Speichern &amp; Übernehmen
  </button>

  {/* Zeile 2: Notice nimmt die beiden Button-Spalten ein → gleiche Breite wie beide Buttons zusammen */}
  {notice && (
    <>
      <div /> {/* Spacer unter Spalte 1 */}
      <div className="col-span-2">
        <NoticeBar
          ref={noticeRef}
          type={notice.type}
          text={notice.text}
          onClose={() => setNotice(null)}
        />
      </div>
    </>
  )}
</div>
        </div>
      )}
    </Card>
  );
}
