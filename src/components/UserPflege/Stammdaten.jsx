'use client';
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { AlertTriangle, Info, CheckCircle, Pencil, Trash2, X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';



const ALLOWED_ROLES = ['Employee', 'Team_Leader', 'Planner'];

const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 shadow-sm ${className}`} {...rest}>{children}</div>
);
const Label = ({ children }) => <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{children}</label>;
const Input = (props) => <input {...props} className={`w-full rounded-xl border px-3 py-2 bg-gray-300/20 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||''}`} />;
const Select = (props) => <select {...props} className={`w-full rounded-xl border px-3 py-2 bg-gray-300/20 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||''}`} />;
const Checkbox = ({ label, checked, onChange, disabled, title }) => (
  <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-60' : ''}`} title={title}>
    <input type="checkbox" className="w-4 h-4" checked={checked} onChange={onChange} disabled={disabled} />
    <span className="text-sm text-gray-800 dark:text-gray-100">{label}</span>
  </label>
);
const Pill = ({ children }) => <span className="inline-flex items-center rounded-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300">{children}</span>;

function wechselText(wechsel){ if(!wechsel) return 'Kein Wechsel vorgesehen'; const d = dayjs(wechsel.datum).format('DD.MM.YYYY'); return `${d} → ${wechsel.schichtgruppe}`; }

const addEq = (q, col, val) => (val === null || val === undefined ? q : q.eq(col, val));


// 🔔 kleine Inline-Notice
function Notice({ type='info', text, onClose }, ref) {
  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200',
    error:   'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
    info:    'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200',
  }[type] || '';
  const Icon = type==='success' ? CheckCircle : type==='error' ? AlertTriangle : Info;
  return (
    <div ref={ref} role="status" aria-live="polite" className={`mb-3 rounded-xl border px-3 py-2 flex items-start gap-2 ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="text-sm flex-1">{text}</div>
      <button type="button" onClick={onClose} aria-label="Meldung schließen" className="text-xs opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}
const NoticeBar = React.forwardRef(Notice);



const Divider = () => <div className="my-2" />; // optional: dünner Abstand, keine Linie nötig

const CollapsibleSection = ({ id, title, tooltip, defaultOpen = true, children }) => {
  const storageKey = `sp_stammdaten_sec_${id}`;
  const [open, setOpen] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? defaultOpen : raw === '1';
  });

  useEffect(() => {
    localStorage.setItem(storageKey, open ? '1' : '0');
  }, [open]);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border-2 border-gray-400 dark:border-gray-700
                   bg-gray-400/40 dark:bg-gray-900/80 px-3 py-1"      >
        <div className="flex items-center gap-5">
          <div aria-hidden className="h-5 w-1.5 rounded-full bg-orange-500/80" />
          <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {tooltip ? <Info className="w-4 h-4 text-gray-500" title={tooltip} /> : null}
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
      </button>

      {open ? <div className="mt-1">{children}</div> : null}
    </div>
  );
};

// Hilfsfunktionen
const todayStr = () => dayjs().format('YYYY-MM-DD');
const within = (d, von, bis) => dayjs(d).isSameOrAfter(von) && (!bis || dayjs(d).isSameOrBefore(bis));
const cmpDate = (a, b) => dayjs(a).diff(dayjs(b));
const fmtNum2 = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(2).replace('.', ',');
};

const calcSegmentHours = (weeklyHours, fromISO, toISO) => {
  const days = dayjs(toISO).diff(dayjs(fromISO), 'day') + 1; // inkl. beide Tage
  const weeks = days / 7;
  return Number(weeklyHours) * weeks;
};

const calcYearHoursFromEntries = (year, entries) => {
  const startYear = dayjs(`${year}-01-01`);
  const endYear = dayjs(`${year}-12-31`);

  const sorted = [...(entries || [])]
    .filter(e => e.gueltig_ab)
    .sort((a,b) => dayjs(a.gueltig_ab).diff(dayjs(b.gueltig_ab)));

  if (sorted.length === 0) return null;

  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i+1];

    const segStart = dayjs(cur.gueltig_ab).isBefore(startYear) ? startYear : dayjs(cur.gueltig_ab);
    const segEnd = next
      ? dayjs(next.gueltig_ab).subtract(1, 'day')
      : endYear;

    if (segEnd.isBefore(segStart)) continue;

    total += calcSegmentHours(cur.wochenstunden, segStart.format('YYYY-MM-DD'), segEnd.format('YYYY-MM-DD'));
  }
  return total;
};

export default function Stammdaten({ userId, onSaved, onCancel }) {
  // Kontext
  const rollen = useRollen() || {};
  const firma = rollen.sichtFirma ?? rollen.firma_id ?? rollen.firmaId ?? null;
  const unit  = rollen.sichtUnit  ?? rollen.unit_id  ?? rollen.unitId  ?? null;

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Editierbar
  const [vorname, setVorname] = useState('');       
  const [nachname, setNachname] = useState('');
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [personalNummer, setPersonalNummer] = useState('');

  const [rolle, setRolle] = useState('Employee');
  const [deaktiviertAb, setDeaktiviertAb] = useState('');

const [jahr, setJahr] = useState(dayjs().year());

const [stundenRow, setStundenRow] = useState(null);
const [urlaubRow, setUrlaubRow] = useState(null);

const [wochenAZ, setWochenAZ] = useState([]); // [{id, gueltig_ab, wochenstunden}]
const [waNewAb, setWaNewAb] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
const [waNewStd, setWaNewStd] = useState('');
const [waPreviewJahresStd, setWaPreviewJahresStd] = useState(null);

  // Aktiv-Status
  const [aktiv, setAktiv] = useState(true);

  // Deaktivierungs-Optionen
  const [willLoeschenKampfliste, setWillLoeschenKampfliste] = useState(false);
  const [loeschDatum, setLoeschDatum] = useState(todayStr());

  // Anzeige
  const [aktuelleSchicht, setAktuelleSchicht] = useState(null);
  const [geplanterWechsel, setGeplanterWechsel] = useState(null);
  const [qualis, setQualis] = useState([]);

  // Ausgrauen: mehrere Zeitfenster
  const [ausgrauen, setAusgrauen] = useState([]); // [{id, von, bis}]
  const [newVon, setNewVon] = useState(todayStr());
  const [newBis, setNewBis] = useState('');
  const [editId, setEditId] = useState(null);
  const [editVon, setEditVon] = useState('');
  const [editBis, setEditBis] = useState('');

  // Notice
  const [notice, setNotice] = useState(null);
  const noticeRef = useRef(null);
  const noticeTimer = useRef(null);
  const showNotice = (type, text, timeoutMs = 3000) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    setTimeout(()=> noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    if (timeoutMs) noticeTimer.current = setTimeout(() => setNotice(null), timeoutMs);
  };

const saveWochenAZ = async () => {
  if (!user) return;

  // 1. des Monats erzwingen (UI-seitig)
  const d = dayjs(waNewAb);
  if (!d.isValid() || d.date() !== 1) {
    showNotice('warning', 'Das Datum muss immer der 1. des Monats sein.', 6000);
    return;
  }

  const std = Number(waNewStd);
  if (!std || Number.isNaN(std) || std <= 0) {
    showNotice('warning', 'Bitte gültige Wochenstunden eingeben (z.B. 37.5).', 6000);
    return;
  }

  const payload = {
    user_id: user.user_id,
    firma_id: (firma ?? user.firma_id) ?? null,
    unit_id: (unit ?? user.unit_id) ?? null,
    gueltig_ab: d.format('YYYY-MM-DD'),
    wochenstunden: std,
    comment: 'Stammdaten: Wochenarbeitszeit'
  };

  const { error } = await supabase.from('DB_WochenArbeitsZeit').insert(payload);
  if (error) {
    // Unique/Trigger Fehler abfangen
    if (String(error.message || '').toLowerCase().includes('duplicate') || String(error.details || '').toLowerCase().includes('duplicate')) {
      showNotice('error', 'Für dieses Datum existiert bereits ein Eintrag. Bitte anderes Datum wählen.', 7000);
    } else if (String(error.message || '').toLowerCase().includes('1. des monats')) {
      showNotice('error', 'Datum muss der 1. des Monats sein.', 7000);
    } else {
      console.error(error);
      showNotice('error', 'Speichern der Wochenarbeitszeit fehlgeschlagen.', 7000);
    }
    return;
  }

  // Reload
  const y = d.year();
  let wQ = supabase
    .from('DB_WochenArbeitsZeit')
    .select('id, gueltig_ab, wochenstunden')
    .eq('user_id', user.user_id)
    .gte('gueltig_ab', `${y}-01-01`)
    .lte('gueltig_ab', `${y}-12-31`)
    .order('gueltig_ab', { ascending: true });

  wQ = addEq(addEq(wQ, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
  const { data } = await wQ;
  setWochenAZ(data || []);

  showNotice('success', 'Wochenarbeitszeit gespeichert.');
};

useEffect(() => {
  const ab = waNewAb;
  const std = Number(waNewStd);
  if (!ab || !std || Number.isNaN(std)) { setWaPreviewJahresStd(null); return; }

  // Preview: bestehende Einträge + neuer Eintrag (falls Datum bereits existiert => ersetzen)
  const year = dayjs(ab).year();
  const merged = [
    ...(wochenAZ || []).filter(e => e.gueltig_ab !== ab),
    { gueltig_ab: ab, wochenstunden: std },
  ].sort((a,b) => dayjs(a.gueltig_ab).diff(dayjs(b.gueltig_ab)));

  setWaPreviewJahresStd(calcYearHoursFromEntries(year, merged));
}, [waNewAb, waNewStd, wochenAZ]);
  // Daten laden
  useEffect(()=>{
    // Reset
    setUser(null);
    setVorname(''); setNachname('');
    setTel1(''); setTel2(''); setPersonalNummer('');
    setRolle('Employee');
    setAktiv(true);
      // Reset Wochenarbeitszeit-Bereich
    setWochenAZ([]);
    setWaNewStd('');
    setWaPreviewJahresStd(null);
    setWaNewAb(dayjs().startOf('month').format('YYYY-MM-DD'));
    setWillLoeschenKampfliste(false);
    setLoeschDatum(todayStr());
    setAktuelleSchicht(null);
    setGeplanterWechsel(null);
    setQualis([]);
    setAusgrauen([]);
    setNewVon(todayStr()); setNewBis('');
    setEditId(null); setEditVon(''); setEditBis('');
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(null);

    if (!userId) return;

    (async ()=>{
      let uQ = supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle, aktiv, inaktiv_at, deaktiviert_ab, funktion, firma_id, unit_id, tel_number1, tel_number2, personal_nummer')
        .eq('user_id', userId);
      uQ = addEq(addEq(uQ, 'firma_id', firma), 'unit_id', unit);

      const { data: u, error: uErr } = await uQ.single();
      if (uErr || !u) { console.error('DB_User:', uErr || 'not found'); return; }

      setUser(u);
      setVorname(u.vorname || '');          
      setNachname(u.nachname || '');
      setTel1(u.tel_number1 || '');
      setTel2(u.tel_number2 || '');
      setPersonalNummer(u.personal_nummer || '');
      setRolle(u.rolle || 'Employee');
      setAktiv(u.aktiv ?? true);
      setDeaktiviertAb(u.deaktiviert_ab || '');

      const heute = todayStr();
// ---- Stunden / Urlaub (aktuelles Jahr) ----
try {
  const y = dayjs().year();
  setJahr(y);

  let sQ = supabase.from('DB_Stunden').select('*').eq('user_id', u.user_id).eq('jahr', y);
  sQ = addEq(addEq(sQ, 'firma_id', firma ?? u.firma_id), 'unit_id', unit ?? u.unit_id);
  const { data: sData } = await sQ.maybeSingle();
  setStundenRow(sData || null);

  let uQ2 = supabase.from('DB_Urlaub').select('*').eq('user_id', u.user_id).eq('jahr', y);
  uQ2 = addEq(addEq(uQ2, 'firma_id', firma ?? u.firma_id), 'unit_id', unit ?? u.unit_id);
  const { data: uData } = await uQ2.maybeSingle();
  setUrlaubRow(uData || null);

  // Wochenarbeitszeit
  let wQ = supabase
    .from('DB_WochenArbeitsZeit')
    .select('id, gueltig_ab, wochenstunden')
    .eq('user_id', u.user_id)
    .gte('gueltig_ab', `${y}-01-01`)
    .lte('gueltig_ab', `${y}-12-31`)
    .order('gueltig_ab', { ascending: true });

  wQ = addEq(addEq(wQ, 'firma_id', firma ?? u.firma_id), 'unit_id', unit ?? u.unit_id);
  const { data: wData } = await wQ;
  setWochenAZ(wData || []);
} catch (e) {
  console.error('Stunden/Urlaub/WochenAZ load:', e);
}

      // Ausgrauen-Fenster laden (alle)
      try {
        let aQ = supabase
          .from('DB_Ausgrauen')
          .select('id, von, bis')
          .eq('user_id', u.user_id);
        aQ = addEq(addEq(aQ, 'firma_id', firma ?? u.firma_id), 'unit_id', unit ?? u.unit_id);

        const { data: aRows, error: aErr } = await aQ;
        if (!aErr && aRows) {
          const sorted = [...aRows].sort((x,y)=>cmpDate(x.von,y.von));
          setAusgrauen(sorted);
        }
      } catch(err) {
        console.error('DB_Ausgrauen load:', err);
      }

      // Schichtzuweisungen
      let zQ = supabase
        .from('DB_SchichtZuweisung')
        .select('von_datum, bis_datum, schichtgruppe, firma_id, unit_id')
        .eq('user_id', u.user_id);
      zQ = addEq(addEq(zQ, 'firma_id', firma ?? u.firma_id), 'unit_id', unit ?? u.unit_id);

      const { data: zData } = await zQ;
      const zuw = (zData || []).filter(z => z.firma_id === u.firma_id && z.unit_id === u.unit_id);

      const heuteGueltig = zuw
        .filter(z => z.von_datum <= heute && (!z.bis_datum || z.bis_datum >= heute))
        .sort((a,b) => a.von_datum < b.von_datum ? 1 : -1);
      const aktuell = heuteGueltig[0] || null;
      setAktuelleSchicht(aktuell?.schichtgruppe || null);

      const zukunft = zuw
        .filter(z => z.von_datum > heute)
        .sort((a,b) => a.von_datum > b.von_datum ? 1 : -1);
      let wechsel = null;
      if (zukunft.length > 0) {
        const firstFuture = zukunft[0];
        wechsel = zukunft.find(z => z.schichtgruppe !== (aktuell?.schichtgruppe || null)) || firstFuture;
      }
      setGeplanterWechsel(wechsel ? { datum: wechsel.von_datum, schichtgruppe: wechsel.schichtgruppe } : null);

      // Qualifikationen
      const { data: qData } = await supabase
        .from('DB_Qualifikation')
        .select('quali, quali_start, quali_endet, created_at')
        .eq('user_id', u.user_id);

      const ids = Array.from(new Set((qData||[]).map(q=>q.quali).filter(v=>v!=null)));
      const byId = new Map();
      if (ids.length>0) {
        let { data: mData } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, quali_kuerzel, qualifikation, aktiv, firma_id, unit_id')
          .in('id', ids);
        if (mData) mData.forEach(m => byId.set(m.id, m));
        else {
          const { data: alt } = await supabase
            .from('DB_QualifikationMatrix')
            .select('id, quali_kuerzel, qualifikation')
            .in('id', ids);
          (alt||[]).forEach(m => byId.set(m.id, m));
        }
      }

      setQualis((qData || []).map(q => {
        const m = byId.get(q.quali);
        const label = m?.qualifikation || m?.quali_kuerzel || `#${q.quali}`;
        const startISO = q.quali_start || q.created_at || null;
        const endISO   = q.quali_endet || null;
        const seit  = startISO ? dayjs(startISO).format('DD.MM.YYYY') : '—';
        const endet = endISO   ? dayjs(endISO).format('DD.MM.YYYY')   : null;
        return { label, seit, endet };
      }));

    })();
  }, [userId, firma, unit]);

  const disabled = loading || !userId;

  // === Ausgrauen CRUD ===
  const validateRange = (von, bis) => {
    if (!von) return 'Bitte „Von“-Datum setzen.';
    if (bis && dayjs(bis).isBefore(dayjs(von))) return '„Bis“ darf nicht vor „Von“ liegen.';
    return null;
  };

  const reloadAusgrauen = async (u = user) => {
    if (!u) return;
    let aQ = supabase
      .from('DB_Ausgrauen')
      .select('id, von, bis')
      .eq('user_id', u.user_id);
    aQ = addEq(addEq(aQ, 'firma_id', firma ?? u.firma_id), 'unit_id', unit ?? u.unit_id);
    const { data } = await aQ;
    setAusgrauen((data || []).sort((x,y)=>cmpDate(x.von,y.von)));
  };

  const addWindow = async () => {
    const err = validateRange(newVon, newBis);
    if (err) { showNotice('warning', err, 6000); return; }
    const payload = {
      user_id: user.user_id,
      firma_id: (firma ?? user.firma_id) ?? null,
      unit_id: unit ?? user.unit_id,
      von: newVon,
      bis: newBis || null,
      comment: 'Stammdaten: neues Ausgrauen-Fenster',
    };
    const res = await supabase.from('DB_Ausgrauen').insert(payload);
    if (res.error) {
      if (String(res.error.message||'').includes('overlap') || String(res.error.details||'').includes('ex_ausgrauen')) {
        showNotice('error', 'Zeitfenster überschneidet sich mit einem bestehenden Eintrag. Bitte anpassen.', 7000);
      } else {
        console.error(res.error);
        showNotice('error', 'Fenster konnte nicht angelegt werden.');
      }
      return;
    }
    setNewVon(todayStr()); setNewBis('');
    await reloadAusgrauen();
    showNotice('success', 'Ausgrauen-Fenster angelegt.');
  };

  const startEdit = (row) => {
    setEditId(row.id);
    setEditVon(row.von);
    setEditBis(row.bis || '');
  };
  const cancelEdit = () => { setEditId(null); setEditVon(''); setEditBis(''); };

  const saveEdit = async () => {
    const err = validateRange(editVon, editBis);
    if (err) { showNotice('warning', err, 6000); return; }
    const res = await supabase.from('DB_Ausgrauen').update({ von: editVon, bis: editBis || null }).eq('id', editId);
    if (res.error) {
      if (String(res.error.message||'').includes('overlap') || String(res.error.details||'').includes('ex_ausgrauen')) {
        showNotice('error', 'Zeitfenster überschneidet sich mit einem bestehenden Eintrag. Bitte anpassen.', 7000);
      } else {
        console.error(res.error);
        showNotice('error', 'Fenster konnte nicht gespeichert werden.');
      }
      return;
    }
    await reloadAusgrauen();
    cancelEdit();
    showNotice('success', 'Ausgrauen-Fenster gespeichert.');
  };

  const deleteWindow = async (id) => {
    const res = await supabase.from('DB_Ausgrauen').delete().eq('id', id);
    if (res.error) {
      console.error(res.error);
      showNotice('error', 'Fenster konnte nicht gelöscht werden.');
      return;
    }
    await reloadAusgrauen();
    showNotice('success', 'Ausgrauen-Fenster gelöscht.');
  };

  // === Speichern Stammdaten (ohne Ausgrauen, da sofort gespeichert) ===
  const save = async ()=>{
    if(!user) return;
    setLoading(true);
    try{
      // ✅ Mini-Check (Telefon-Format) – direkt am Anfang von save()
      const phoneOk = (s) => {
      const v = (s || '').trim();
        if (!v) return true; // leer erlaubt
        return /^[+0-9 ()/.-]{6,25}$/.test(v);
      };

        if (!phoneOk(tel1) || !phoneOk(tel2)) {
          showNotice('warning', 'Telefonnummer bitte nur mit Ziffern, +, Leerzeichen oder ()-/. eingeben.', 6000);
          setLoading(false);
        return;
      }

  // Optional: Personalnummer trimmen, aber NICHT validieren (weil Firmen sehr unterschiedlich)
        if (personalNummer && personalNummer.trim().length > 30) {
          showNotice('warning', 'Personalnummer ist zu lang (max. 30 Zeichen empfohlen).', 6000);
          setLoading(false);
        return;
      }
      if(!aktiv && willLoeschenKampfliste){
        const chosen = dayjs(loeschDatum, 'YYYY-MM-DD');
        if (chosen.isBefore(dayjs().startOf('day'))) {
          showNotice('warning', 'Bitte kein Datum in der Vergangenheit wählen (Dienstplan-Nachvollziehbarkeit).', 6000);
          setLoading(false);
          return;
        }
      }

      const payload = {
        vorname,                 
        nachname,
        tel_number1: tel1?.trim() || null,
        tel_number2: tel2?.trim() || null,
        personal_nummer: personalNummer?.trim() || null,
        rolle,
        aktiv,
        deaktiviert_ab: deaktiviertAb || null,           
        inaktiv_at: !aktiv ? dayjs().toISOString() : null,
      };
      let upd = supabase.from('DB_User').update(payload).eq('user_id', user.user_id);
      upd = addEq(addEq(upd, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
      const { error: updErr } = await upd;
      if (updErr) {
        console.error(updErr);
        showNotice('error', 'Speichern fehlgeschlagen.');
        setLoading(false);
        return;
      }
// === Sofort-Deaktivierung: Zuweisungen kappen (alle aktuellen & zukünftigen) ===
if (!aktiv) {
  const start = dayjs().format('YYYY-MM-DD');                          // ab heute
  const cutoff = dayjs(start).subtract(1, 'day').format('YYYY-MM-DD'); // letzter gültiger Tag

  // optional: deaktiviert_ab auf heute setzen, falls leer (Nachvollziehbarkeit)
  if (!deaktiviertAb) {
    await supabase
      .from('DB_User')
      .update({ deaktiviert_ab: start })
      .eq('user_id', user.user_id);
  }

  // (1) Laufende Zuweisungen bis gestern beenden
  try {
    let updRun = supabase
      .from('DB_SchichtZuweisung')
      .update({ bis_datum: cutoff })
      .eq('user_id', user.user_id)
      .lte('von_datum', start)
      .or(`bis_datum.is.null,bis_datum.gte.${start}`);
    updRun = addEq(addEq(updRun, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
    const { error: updRunErr } = await updRun;
    if (updRunErr) console.error('Zuweisung (laufend) beenden:', updRunErr);
  } catch (e) {
    console.error('Zuweisung (laufend) beenden (Exception):', e);
  }

  // (2) Rein zukünftige Zuweisungen ebenfalls kappen (explizit mit bis_datum = cutoff)
  try {
    let updFut = supabase
      .from('DB_SchichtZuweisung')
      .update({ bis_datum: cutoff })
      .eq('user_id', user.user_id)
      .gte('von_datum', start);
    updFut = addEq(addEq(updFut, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
    const { error: updFutErr } = await updFut;
    if (updFutErr) console.error('Zuweisung (zukünftig) kappen:', updFutErr);
  } catch (e) {
    console.error('Zuweisung (zukünftig) kappen (Exception):', e);
  }
}

      // Folgeaktionen bei geplanter Deaktivierung
        if (deaktiviertAb) {
        const today = dayjs().format('YYYY-MM-DD');
        const start = dayjs(deaktiviertAb).isBefore(dayjs(today)) ? today : deaktiviertAb; // nie rückwirkend
        const cutoff = dayjs(start).subtract(1, 'day').format('YYYY-MM-DD'); // letzter zulässiger Tag
if (start !== deaktiviertAb) {
  showNotice('warning', `Datum lag in der Vergangenheit. Verwende ${dayjs(start).format('DD.MM.YYYY')} als Stichtag.`, 6000);
}
        // 1) DB_Kampfliste: alle zukünftigen Dienste ab start löschen
        try {
          let delK = supabase
            .from('DB_Kampfliste')
            .delete()
            .gte('datum', start)
            .eq('user_id', user.user_id);
          delK = addEq(addEq(delK, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
          const { error: delKErr } = await delK;
          if (delKErr) console.error('Kampfliste löschen:', delKErr);
        } catch(e) {
          console.error('Kampfliste löschen (Exception):', e);
        }

        // 2a) DB_SchichtZuweisung: laufende Zuweisungen sauber beenden
        try {
          let updZu = supabase
            .from('DB_SchichtZuweisung')
            .update({ bis_datum: cutoff })
            .eq('user_id', user.user_id)
            // nur Zuweisungen, die in den Zeitraum ragen
            .lte('von_datum', cutoff)
            .or(`bis_datum.is.null,bis_datum.gte.${start}`);
          updZu = addEq(addEq(updZu, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
          const { error: updZuErr } = await updZu;
          if (updZuErr) console.error('Zuweisung beenden:', updZuErr);
        } catch(e) {
          console.error('Zuweisung beenden (Exception):', e);
        }

        // 2b) DB_SchichtZuweisung: rein zukünftige Zuweisungen ab start entfernen (falls es solche Einträge gibt)
        try {
          let delZu = supabase
            .from('DB_SchichtZuweisung')
            .delete()
            .eq('user_id', user.user_id)
            .gte('von_datum', start);
          delZu = addEq(addEq(delZu, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
          const { error: delZuErr } = await delZu;
          if (delZuErr) console.error('Zuweisung zukünftige löschen:', delZuErr);
        } catch(e) {
          console.error('Zuweisung zukünftige löschen (Exception):', e);
        }
      }

      // Zukünftige Dienste löschen (optional)
      if(!aktiv && willLoeschenKampfliste){
        let del = supabase.from('DB_Kampfliste').delete().gte('datum', loeschDatum).eq('user', user.user_id);
        del = addEq(addEq(del, 'firma_id', firma ?? user.firma_id), 'unit_id', unit ?? user.unit_id);
        let { data: delRows, error: delErr } = await del.select('datum');
        if (delErr) {
          let del2 = supabase.from('DB_Kampfliste').delete().gte('datum', loeschDatum).eq('user_id', user.user_id);
          del2 = addEq(addEq(del2, 'firma_id', (firma ?? user.firma_id)), 'unit_id', (unit ?? user.unit_id));
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

  // Status-Badge
  const StatusBadge = ({ von, bis }) => {
    const d = todayStr();
    let txt = 'Zukünftig', cls = 'border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300';
    if (within(d, von, bis)) { txt = 'Aktiv'; cls = 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'; }
    else if (dayjs(d).isAfter(bis || '9999-12-31')) { txt = 'Abgelaufen'; cls = 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'; }
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${cls}`}>{txt}</span>;
  };

  return (
    <Card className="h-full flex flex-col shadow-xl border border-gray-300 dark:border-gray-700">
      <div className="px-4 pt-4 font-bold text-2xl text-gray-900 dark:text-gray-200">Stammdaten</div>

      {!userId ? (
        <div className="p-6 text-gray-500 dark:text-gray-300">Wähle links eine Person aus.</div>
      ) : !user ? (
        <div className="p-6 text-gray-500 dark:text-gray-300">Lade…</div>
      ) : (
        <div className="p-4 space-y-2">
          {/* BASISDATEN */}

<CollapsibleSection id="basisdaten" title={`Basisdaten${vorname || nachname ? ` – ${vorname} ${nachname}` : ''}`}
 defaultOpen={false}>
  <Divider />

  {/* EIN Grid für alles */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">

    {/* Personalnummer links */}
    <div>
      <Label>Personalnummer</Label>
      <Input
        value={personalNummer}
        onChange={(e) => setPersonalNummer(e.target.value)}
        disabled={disabled}
      />
      <div className="text-xs text-gray-500 mt-1">
        Textfeld, damit führende Nullen &amp; Buchstaben möglich sind.
      </div>
    </div>

    {/* rechte Hälfte als Platzhalter (damit Personalnummer NICHT volle Breite ist) */}
    <div />

    {/* Vorname / Nachname wie gewohnt */}
    <div>
      <Label>Vorname</Label>
      <Input value={vorname} onChange={(e) => setVorname(e.target.value)} disabled={disabled} />
    </div>

    <div>
      <Label>Nachname</Label>
      <Input value={nachname} onChange={(e) => setNachname(e.target.value)} disabled={disabled} />
    </div>

    {/* Telefon 1 / Telefon 2 wie die Namen */}
    <div>
      <Label>Telefon 1</Label>
      <Input value={tel1} onChange={(e) => setTel1(e.target.value)} disabled={disabled} />
    </div>

    <div>
      <Label>Telefon 2</Label>
      <Input value={tel2} onChange={(e) => setTel2(e.target.value)} disabled={disabled} />
    </div>

  </div>
</CollapsibleSection>


          {/* FUNKTION & ROLLE */}
          <CollapsibleSection id="funktion" title="Funktion &amp; Rolle" defaultOpen>
            <Divider />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div>
                <Label>Funktion (nicht änderbar)</Label>
                <Input value={user.funktion || '—'} disabled />
              </div>
              <div>
                <Label>Rolle </Label>
                <Select value={rolle} onChange={e=>setRolle(e.target.value)} disabled={disabled}>
                  {ALLOWED_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
            </div>
          </CollapsibleSection>

          {/* QUALIFIKATIONEN */}
          <CollapsibleSection id="qualifikationen" title="Qualifikationen" defaultOpen>
            <Divider />
            <div className="mt-2">
              <Label>Qualifikationen (seit)</Label>
              <div className="flex flex-wrap gap-2">
                {qualis.length === 0 ? (
                  <span className="text-sm text-gray-500 dark:text-gray-300">Keine Qualifikationen hinterlegt.</span>
                ) : (
                  qualis.map((q, idx) => (
                    <Pill key={idx}>
                      {q.label} · seit {q.seit}{q.endet ? ` · läuft aus ${q.endet}` : ''}
                    </Pill>
                  ))
                )}
              </div>
            </div>
          </CollapsibleSection>
          
          <CollapsibleSection id="stunden_urlaub" title="Stunden und Urlaub" defaultOpen={true}>
  <Divider />

  {/* Anzeige aus DB_Stunden / DB_Urlaub (read-only) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Stunden (Jahr {jahr})</div>
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
        <div className="flex justify-between"><span>Übernahme Vorjahr</span><span className="font-semibold">{fmtNum2(stundenRow?.uebernahme_vorjahr)}</span></div>
        <div className="flex justify-between"><span>Vorgabe Stunden</span><span className="font-semibold">{stundenRow?.vorgabe_stunden ?? '—'}</span></div>
        <div className="flex justify-between"><span>Stunden gesamt</span><span className="font-semibold">{stundenRow?.stunden_gesamt ?? '—'}</span></div>
      </div>
    </div>

    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Urlaub (Jahr {jahr})</div>
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
        <div className="flex justify-between"><span>Übernahme Vorjahr</span><span className="font-semibold">{urlaubRow?.uebernahme_vorjahr ?? '—'}</span></div>
        <div className="flex justify-between"><span>Urlaub Soll</span><span className="font-semibold">{urlaubRow?.urlaub_soll ?? '—'}</span></div>
        <div className="flex justify-between"><span>Urlaub gesamt</span><span className="font-semibold">{urlaubRow?.urlaub_gesamt ?? '—'}</span></div>
      </div>
    </div>
  </div>

  {/* Wochenarbeitszeit (neu) */}
  <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Wochenarbeitszeit</div>
      <span className="text-xs text-gray-500">Datum nur zum 1. des Monats</span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
      <div>
        <Label>Wochenstunden ab</Label>
        <Input
          type="date"
          value={waNewAb}
          onChange={(e) => {
            const v = e.target.value;
            // Komfort: immer auf 1. „snappen“
            const snapped = v ? dayjs(v).startOf('month').format('YYYY-MM-DD') : '';
            setWaNewAb(snapped);
          }}
          disabled={disabled}
        />
      </div>

      <div>
        <Label>Wochenstunden</Label>
        <Input
          value={waNewStd}
          onChange={(e) => setWaNewStd(e.target.value)}
          placeholder="z.B. 37.5"
          disabled={disabled}
        />
      </div>

      <div className="self-end">
        <button
          type="button"
          onClick={saveWochenAZ}
          disabled={disabled}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition
                     bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700"
        >
          Speichern
        </button>
      </div>
    </div>

    <div className="mt-2 text-sm">
      <div className="text-gray-600 dark:text-gray-300">
        Vorschau Jahresstunden (segmentiert):{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {waPreviewJahresStd == null ? '—' : waPreviewJahresStd.toFixed(2).replace('.', ',')}
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Berechnung: Wochenstunden × (Tage im Gültigkeitszeitraum / 7), automatisch bis Jahresende bzw. bis zum nächsten Eintrag.
      </div>
    </div>

    {/* Liste der Einträge */}
    <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-12 text-xs font-semibold bg-gray-300/50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-300 px-3 py-2">
        <div className="col-span-6">Gültig ab</div>
        <div className="col-span-6 text-right">Wochenstunden</div>
      </div>
      {wochenAZ.length === 0 ? (
        <div className="px-3 py-3 text-sm text-gray-500">Keine Einträge vorhanden.</div>
      ) : (
        wochenAZ.map((r) => (
          <div key={r.id} className="grid grid-cols-12 items-center px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-sm">
            <div className="col-span-6">{dayjs(r.gueltig_ab).format('DD.MM.YYYY')}</div>
            <div className="col-span-6 text-right font-semibold">{Number(r.wochenstunden).toString().replace('.', ',')}</div>
          </div>
        ))
      )}
    </div>
  </div>
</CollapsibleSection>


          {/* AKTUELLE SCHICHTGRUPPE & GEPLANTER WECHSEL */}
          <CollapsibleSection id="aktuelleschichtgruppe" title="Aktuelle Schichtgruppe &amp; geplanter Wechsel" defaultOpen>
            <Divider />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div>
                <Label>Aktuelle Schichtgruppe</Label>
                <Input value={aktuelleSchicht || '—'} disabled />
              </div>
              <div>
                <Label>Geplanter Wechsel</Label>
                <Input value={wechselText(geplanterWechsel)} disabled />
              </div>
            </div>
          </CollapsibleSection>


          {/* AUSGRAUEN IN DER PLANUNG */}
          <CollapsibleSection id="ausgraueninderplanung" title="Ausgrauen in der Planung" defaultOpen={false}>
            <Divider />
            {/* Liste */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-2">
              <div className="grid grid-cols-12 text-xs font-semibold bg-gray-300/50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-300 px-3 py-2">
                <div className="col-span-3">Von</div>
                <div className="col-span-3">Bis</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-3 text-right">Aktion</div>
              </div>
              {(ausgrauen.length === 0) ? (
                <div className="px-3 py-3 text-sm text-gray-500">Keine Fenster vorhanden.</div>
              ) : (
                ausgrauen.map(row => (
                  <div key={row.id} className="grid grid-cols-12 items-center px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-sm">
                    {editId === row.id ? (
                      <>
                        <div className="col-span-3">
                          <Input type="date" value={editVon} onChange={e=>setEditVon(e.target.value)} disabled={disabled}/>
                        </div>
                        <div className="col-span-3">
                          <Input type="date" value={editBis} onChange={e=>setEditBis(e.target.value)} disabled={disabled}/>
                          <div className="text-[11px] text-gray-500 mt-0.5">Leer lassen = unbefristet.</div>
                        </div>
                        <div className="col-span-3">
                          <StatusBadge von={editVon || row.von} bis={editBis || null} />
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                                  onClick={saveEdit} disabled={disabled}><Check className="w-3 h-3"/> Speichern</button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600"
                                  onClick={cancelEdit} disabled={disabled}><X className="w-3 h-3"/> Abbrechen</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-3">{dayjs(row.von).format('DD.MM.YYYY')}</div>
                        <div className="col-span-3">{row.bis ? dayjs(row.bis).format('DD.MM.YYYY') : '— (offen)'}</div>
                        <div className="col-span-3"><StatusBadge von={row.von} bis={row.bis} /></div>
                        <div className="col-span-3 flex justify-end gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600"
                                  onClick={()=>startEdit(row)} disabled={disabled}><Pencil className="w-3 h-3"/> Bearbeiten</button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-red-300 text-red-700 dark:border-red-700 dark:text-red-300"
                                  onClick={()=>deleteWindow(row.id)} disabled={disabled}><Trash2 className="w-3 h-3"/> Löschen</button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Neu anlegen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <div>
                <Label>Neu: Von</Label>
                <Input type="date" value={newVon} onChange={e=>setNewVon(e.target.value)} disabled={disabled}/>
              </div>
              <div>
                <Label>Neu: Bis (optional)</Label>
                <Input type="date" value={newBis} onChange={e=>setNewBis(e.target.value)} disabled={disabled}/>
                <div className="text-xs text-gray-500 mt-1">Leer lassen = unbefristet.</div>
              </div>
              <div className="flex items-end">
                <button
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition
                             bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700"
                  onClick={addWindow}
                  disabled={disabled}
                >
                  + Fenster hinzufügen
                </button>
              </div>
            </div>
          </CollapsibleSection>

          {/* MITARBEITER AKTIV */}
          <CollapsibleSection id="mitarbeiteraktiv" title="Mitarbeiter Aktiv" defaultOpen={false}>
            <Divider />
            <div className="space-y-3 mt-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  label="Aktiv"
                  checked={!!aktiv}
                  onChange={e=>setAktiv(e.target.checked)}
                  disabled={disabled}
                  title="Der Mitarbeiter kann deaktiviert werden. Löschung des Zugangs geschieht nach 24 Stunden."
                />
                <div className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                  <Info className="w-4 h-4 mt-0.5" />
                  <span>
                    Sofort deaktivieren über den Schalter <em>Aktiv</em>.<br/>
                    Für eine <strong>geplante</strong> Deaktivierung wähle unten ein Datum – am Stichtag wird der Zugang automatisch inaktiv.
                  </span>
                </div>
              </div>

    {/* Geplante Deaktivierung */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label>Deaktiviert ab (geplant)</Label>
        <Input
          type="date"
          value={deaktiviertAb || ''}
          onChange={e=>{
            const v = e.target.value || '';
            setDeaktiviertAb(v);
            // Komfort: wenn leer, loeschDatum nicht anfassen; wenn gesetzt & loeschDatum leer → übernehmen
            if (v && !loeschDatum) setLoeschDatum(v);
          }}
          disabled={disabled}
        />
        <div className="text-[11px] text-gray-500 mt-0.5">Leer lassen = keine geplante Deaktivierung.</div>
      </div>
      <div className="self-end text-sm">
        {(!aktiv) ? (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 border-red-300 text-red-600 dark:border-red-700 dark:text-red-300">
            Inaktiv (sofort)
          </span>
        ) : deaktiviertAb ? (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
            Geplante Deaktivierung ab {dayjs(deaktiviertAb).format('DD.MM.YYYY')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
            Aktiv
          </span>
        )}
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
                    <div className="mt-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
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
          </CollapsibleSection>

          {/* Buttons + Notice */}
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 pt-2 pb-5">
            <div />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-white transition
                         bg-blue-600 hover:bg-blue-500 dark:hover:bg-blue-700 border border-blue-300 dark:border-blue-700"
              onClick={onCancel}
              disabled={disabled}
            >
              Abbrechen
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition
                         bg-green-700 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
              onClick={save}
              disabled={disabled}
            >
              Speichern &amp; Übernehmen
            </button>

            {notice && (
              <>
                <div />
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
