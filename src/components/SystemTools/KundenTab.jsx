import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { ChevronDown, ChevronRight, RotateCw, ArrowUpDown } from 'lucide-react';
import KundenUnitErstellen from './KundenUnitErstellen';

const fmtDate = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');
const startOfToday = () => dayjs().startOf('day');

const Panel = ({ title, right, children, open=true, setOpen }) => (
  <div className="rounded-2xl border border-gray-600/40 bg-gray-900 text-white mb-3">
    <div className="flex items-center justify-between px-3 py-2 cursor-pointer select-none" onClick={()=>setOpen?.(o=>!o)}>
      <div className="flex items-center gap-2">
        {setOpen ? (open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>) : null}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
    {(setOpen ? open : true) && <div className="px-3 pb-3">{children}</div>}
  </div>
);

const Badge = ({ children, tone='default' }) => {
  const tones = {
    default:'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
    good:'bg-green-200/80 dark:bg-green-800/60 text-green-900 dark:text-green-100',
    bad:'bg-red-200/80 dark:bg-red-800/60 text-red-900 dark:text-red-100',
    info:'bg-blue-200/80 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${tones[tone]}`}>{children}</span>;
};

const SortHeader = ({ label, sortKey, current, setCurrent }) => {
  const active = current.key === sortKey;
  const next = () => setCurrent(s => s.key===sortKey ? {key:sortKey,dir:s.dir==='asc'?'desc':'asc'} : {key:sortKey,dir:'asc'});
  return (
    <button onClick={next} className={`flex items-center gap-1 ${active?'text-white':'text-gray-300'}`}>
      <span>{label}</span><ArrowUpDown size={14} className={active?'':'opacity-60'}/>
      {active && <span className="text-[10px] opacity-70">{current.dir==='asc'?'↑':'↓'}</span>}
    </button>
  );
};


const TriPill = ({ label, state, onClick, title }) => {
  const style = state==='allow' ? 'bg-green-700/60 border-green-500'
              : state==='block' ? 'bg-red-700/60 border-red-500'
              : 'bg-gray-800/60 border-gray-600';
  return (
    <button onClick={onClick} title={title} className={`text-xs px-2 py-1 rounded-full border ${style}`}>{label} {state==='allow'?'✓':state==='block'?'✕':'•'}</button>
  );
};

const SubSectionTitle = ({ children }) => (
  <div className="mt-3 mb-1">
    <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-1.5">
      <div aria-hidden className="h-4 w-1.5 rounded-full bg-indigo-500/80" />
      <h3 className="text-sm font-semibold tracking-wide text-gray-100 uppercase">
        {children}
      </h3>
    </div>
  </div>
);

// --- BAM Logik Optionen (Code-only, keine extra DB) ---
const BAM_LOGIK_OPTIONS = [
  { key: 'ROEHM_5SCHICHT', label: 'Röhm – 5-Schicht (Standard)' },
  { key: 'JOKON_3SCHICHT', label: 'Jokon – 3-Schicht' },
  // später easy erweitern:
  // { key: 'ALPLA_4SCHICHT', label: 'ALPLA – 4-Schicht' },
];
export default function KundenTab() {
  // Shared refs
  const [plaene, setPlaene] = useState([]);
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    (async ()=>{
      const [{ data: planRows }, { data: feat }] = await Promise.all([
        supabase.from('DB_PlanFeatures').select('plan'),
        supabase.from('DB_Features').select('key,active').order('key')
      ]);
      setPlaene(Array.from(new Set((planRows||[]).map(p=>p.plan))).sort());
      setFeatures((feat||[]).filter(f=>f.active));
    })();
  }, []);

  // Firmenliste
  const [firmen, setFirmen] = useState([]);
  const [firmenLoading, setFirmenLoading] = useState(false);
  const [firmaOpen, setFirmaOpen] = useState(true);

  const loadFirmen = async () => {
    setFirmenLoading(true);
    try {
      const { data } = await supabase
      .from('DB_Kunden')
      .select('id,firmenname,created_at,aktiv,inaktiv_at,plan,plan_valid_until,strasse,plz,stadt,telefon,telefon2')
      .order('firmenname', { ascending: true });

      const today = startOfToday();
      const withCounts = await Promise.all((data||[]).map(async f=>{
        const { count } = await supabase
          .from('DB_User')
          .select('user_id', { head:true, count:'exact' })
          .eq('firma_id', f.id)
          .eq('aktiv', true);
        const plan_aktiv = !!f.plan && (!f.plan_valid_until || !today.isAfter(dayjs(f.plan_valid_until)));
        return { ...f, user_count: count||0, plan_aktiv };
      }));
      setFirmen(withCounts);
    } finally {
      setFirmenLoading(false);
    }
  };
  useEffect(()=>{ loadFirmen(); }, []);

  // Suche / Sort / Filter (Firmen)
  const [firmaQuery, setFirmaQuery] = useState('');
  const [filterPlanAktiv, setFilterPlanAktiv] = useState(false);
  const [firmaSort, setFirmaSort] = useState({ key:'firma', dir:'asc' });

  const firmenView = useMemo(()=>{
    const q = firmaQuery.trim().toLowerCase();
    let rows = [...firmen];
    if (q) rows = rows.filter(r => (r.firmenname||'').toLowerCase().includes(q));
    if (filterPlanAktiv) rows = rows.filter(r => r.plan_aktiv===true);
    const key = (r)=>{
      switch (firmaSort.key) {
        case 'id': return Number(r.id)||0;
        case 'user_count': return Number(r.user_count)||0;
        case 'plan': return (r.plan||'').toLowerCase();
        case 'plan_valid_until': return r.plan_valid_until ? dayjs(r.plan_valid_until).valueOf() : 0;
        default: return (r.firmenname||'').toLowerCase();
      }
    };
    rows.sort((a,b)=> (key(a)<key(b)?(firmaSort.dir==='asc'?-1:1):(key(a)>key(b)?(firmaSort.dir==='asc'?1:-1):0)));
    return rows;
  }, [firmen,firmaQuery,filterPlanAktiv,firmaSort]);

  // Firma Details + Units
  const [selFirma, setSelFirma] = useState(null);
  const [firmaEdit, setFirmaEdit] = useState(null);
useEffect(()=> {
  if (!selFirma) { setFirmaEdit(null); return; }
  setFirmaEdit({
    firmenname: selFirma.firmenname || '',
    aktiv: !!selFirma.aktiv,
    inaktiv_at: selFirma.inaktiv_at || null,
    plan: selFirma.plan || '',
    plan_valid_until: selFirma.plan_valid_until || null,
    strasse: selFirma.strasse || '',
    plz: selFirma.plz != null ? String(selFirma.plz) : '',
    stadt: selFirma.stadt || '',
    telefon: selFirma.telefon || '',
    telefon2: selFirma.telefon2 || '',
  });
}, [selFirma]);


  const [orgAdmins, setOrgAdmins] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [showCreateUnit, setShowCreateUnit] = useState(false);

  const loadFirmaDetails = async (firma) => {
    const { data: admins } = await supabase
      .from('DB_User')
      .select('user_id, vorname, nachname, email, rolle, can_see_company_page')
      .eq('firma_id', firma.id)
      .in('rolle', ['Org_Admin','Admin_Dev']);
    setOrgAdmins(admins||[]);

    setUnitsLoading(true);
    const { data: urows } = await supabase
  .from('DB_Unit')
  .select(`
    id,
    unitname,
    created_at,
    anzahl_schichten,
    bundesland,
    unit_aktiv,
    unit_inaktiv_at,
    enabled_features,
    disabled_features,
    preis_monat_basis,
    rabatt_unit_prozent,
    rabatt_unit_fix,
    abrechnung_notiz,
    wochenplanung_aktiv, 
    bam_logik_key
  `)
  .eq('firma', firma.id)
  .order('unitname', { ascending: true });

    const unitsWithCounts = await Promise.all((urows||[]).map(async u=>{
      const { count } = await supabase
        .from('DB_User')
        .select('user_id', { head:true, count:'exact' })
        .eq('unit_id', u.id)
        .eq('aktiv', true);
      return { ...u, user_count: count||0 };
    }));
    setUnits(unitsWithCounts);
    setUnitsLoading(false);
  };

  const saveFirma = async () => {
    if (!selFirma || !firmaEdit) return;
    const payload = {
  firmenname: firmaEdit.firmenname?.trim() || selFirma.firmenname,
  aktiv: firmaEdit.aktiv,
  inaktiv_at: firmaEdit.inaktiv_at || null,
  plan: firmaEdit.plan || null,
  plan_valid_until: firmaEdit.plan_valid_until || null,
  strasse: firmaEdit.strasse || null,
  plz:
    firmaEdit.plz === '' || firmaEdit.plz == null
      ? null
      : Number(firmaEdit.plz),
  stadt: firmaEdit.stadt || null,
  telefon: firmaEdit.telefon || null,
  telefon2: firmaEdit.telefon2 || null,
};

    await supabase.from('DB_Kunden').update(payload).eq('id', selFirma.id);
    await loadFirmen();
    const refreshed = (await supabase
      .from('DB_Kunden')
      .select('id,firmenname,created_at,aktiv,inaktiv_at,plan,plan_valid_until,strasse,plz,stadt,telefon,telefon2')
      .eq('id', selFirma.id).maybeSingle()).data;
    setSelFirma({ ...refreshed, user_count: selFirma.user_count });
  };

const toggleCompanyPageAccess = async (userId, current, adminRow) => {
  if (!userId) {
    console.error('Kein user_id für Admin:', adminRow);
    alert('Für diesen Admin ist in DB_User kein user_id (UUID) hinterlegt. Bitte in Supabase nachtragen.');
    return;
  }

  const next = !current;

  const { error } = await supabase
    .from('DB_User')
    .update({ can_see_company_page: next })
    .eq('user_id', userId);

  if (error) {
    console.error('can_see_company_page update:', error);
    alert('Konnte Recht nicht speichern: ' + error.message);
    return;
  }

  await loadFirmaDetails(selFirma);
};

  // Units – Filter/Sort
  const [unitQuery, setUnitQuery] = useState('');
  const [unitAktivFilter, setUnitAktivFilter] = useState('all'); // all|aktiv|inaktiv
  const [unitBundesland, setUnitBundesland] = useState('all');
  const [unitSort, setUnitSort] = useState({ key:'unitname', dir:'asc' });

  const bundeslandOptions = useMemo(()=>{
    const set = new Set(units.map(u=>u.bundesland).filter(Boolean));
    return ['all', ...Array.from(set).sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}))];
  }, [units]);

  const unitsView = useMemo(()=>{
    const q = unitQuery.trim().toLowerCase();
    let rows = [...units];
    if (q) rows = rows.filter(r => (r.unitname||'').toLowerCase().includes(q));
    if (unitAktivFilter !== 'all') rows = rows.filter(r => !!r.unit_aktiv === (unitAktivFilter==='aktiv'));
    if (unitBundesland !== 'all') rows = rows.filter(r => (r.bundesland||'')===unitBundesland);
    const key=(r)=>{
      switch (unitSort.key) {
        case 'id': return Number(r.id)||0;
        case 'created_at': return r.created_at ? dayjs(r.created_at).valueOf() : 0;
        case 'anzahl_schichten': return Number(r.anzahl_schichten)||0;
        case 'bundesland': return (r.bundesland||'').toLowerCase();
        case 'unit_aktiv': return r.unit_aktiv?1:0;
        case 'user_count': return Number(r.user_count)||0;
        default: return (r.unitname||'').toLowerCase();
      }
    };
    rows.sort((a,b)=> (key(a)<key(b)?(unitSort.dir==='asc'?-1:1):(key(a)>key(b)?(unitSort.dir==='asc'?1:-1):0)));
    return rows;
  }, [units,unitQuery,unitAktivFilter,unitBundesland,unitSort]);

  // Unit Editor
  const [selUnit, setSelUnit] = useState(null);
  const [unitEdit, setUnitEdit] = useState(null);
useEffect(()=> {
  if (!selUnit) { setUnitEdit(null); return; }
  setUnitEdit({
    unit_aktiv: !!selUnit.unit_aktiv,
    unit_inaktiv_at: selUnit.unit_inaktiv_at || null,
    enabled_features: Array.isArray(selUnit.enabled_features) ? [...selUnit.enabled_features] : [],
    disabled_features: Array.isArray(selUnit.disabled_features) ? [...selUnit.disabled_features] : [],
    preis_monat_basis: selUnit.preis_monat_basis ?? '',
    rabatt_unit_prozent: selUnit.rabatt_unit_prozent ?? '',
    rabatt_unit_fix: selUnit.rabatt_unit_fix ?? '',
    abrechnung_notiz: selUnit.abrechnung_notiz || '',
    wochenplanung_aktiv: !!selUnit.wochenplanung_aktiv,
    bam_logik_key: selUnit.bam_logik_key || 'ROEHM_5SCHICHT',
  });
}, [selUnit]);

  const featureStateOf = (key) => {
    if (!unitEdit) return 'inherit';
    if ((unitEdit.enabled_features||[]).includes(key)) return 'allow';
    if ((unitEdit.disabled_features||[]).includes(key)) return 'block';
    return 'inherit';
  };
  const cycleFeature = (key) => {
    if (!unitEdit) return;
    const enabled = new Set(unitEdit.enabled_features||[]);
    const disabled = new Set(unitEdit.disabled_features||[]);
    const inEnabled = enabled.has(key);
    const inDisabled = disabled.has(key);
    let next='inherit';
    if (!inEnabled && !inDisabled) next='allow';
    else if (inEnabled) next='block';
    else if (inDisabled) next='inherit';
    if (next==='inherit'){ enabled.delete(key); disabled.delete(key); }
    if (next==='allow'){ enabled.add(key); disabled.delete(key); }
    if (next==='block'){ disabled.add(key); enabled.delete(key); }
    setUnitEdit({
      ...unitEdit,
      enabled_features: Array.from(enabled),
      disabled_features: Array.from(disabled),
    });
  };
const saveUnit = async () => {
  if (!selUnit || !unitEdit) return;

  const toNumOrNull = (v) =>
    v === '' || v === null || v === undefined ? null : Number(v);

  const payload = {
    unit_aktiv: unitEdit.unit_aktiv,
    unit_inaktiv_at: unitEdit.unit_inaktiv_at || null,
    enabled_features: unitEdit.enabled_features,
    disabled_features: unitEdit.disabled_features,
    preis_monat_basis: toNumOrNull(unitEdit.preis_monat_basis),
    rabatt_unit_prozent: toNumOrNull(unitEdit.rabatt_unit_prozent),
    rabatt_unit_fix: toNumOrNull(unitEdit.rabatt_unit_fix),
    abrechnung_notiz: unitEdit.abrechnung_notiz || null,
    wochenplanung_aktiv: !!unitEdit.wochenplanung_aktiv,
    bam_logik_key: unitEdit.bam_logik_key || 'ROEHM_5SCHICHT',
  };

  await supabase.from('DB_Unit').update(payload).eq('id', selUnit.id);
  await loadFirmaDetails(selFirma);
  const updated = (await supabase
    .from('DB_Unit')
    .select(`
      id,
      unitname,
      created_at,
      anzahl_schichten,
      bundesland,
      unit_aktiv,
      unit_inaktiv_at,
      enabled_features,
      disabled_features,
      preis_monat_basis,
      rabatt_unit_prozent,
      rabatt_unit_fix,
      abrechnung_notiz,
      wochenplanung_aktiv,
      bam_logik_key  
    `)
    .eq('id', selUnit.id).maybeSingle()).data;
  setSelUnit(updated);
};

  return (
    <div>
      <Panel
        title="Kunden (DB_Kunden)"
        right={
          <button className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-700 flex items-center gap-1" onClick={loadFirmen}>
            <RotateCw size={14}/> Aktualisieren
          </button>
        }
        open={firmaOpen}
        setOpen={setFirmaOpen}
      >
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <input
            type="text"
            placeholder="Suche nach Firmenname…"
            className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
            value={firmaQuery}
            onChange={(e)=>setFirmaQuery(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filterPlanAktiv} onChange={e=>setFilterPlanAktiv(e.target.checked)} />
            <span>nur Plan aktiv</span>
          </label>
        </div>

        {firmenLoading ? (
          <div className="text-sm opacity-80">Lade Firmen…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase opacity-70">
                  <th className="py-1 pr-3"><SortHeader label="Firma" sortKey="firma" current={firmaSort} setCurrent={setFirmaSort}/></th>
                  <th className="py-1 pr-3"><SortHeader label="ID" sortKey="id" current={firmaSort} setCurrent={setFirmaSort}/></th>
                  <th className="py-1 pr-3">Erstellt</th>
                  <th className="py-1 pr-3">Aktiv</th>
                  <th className="py-1 pr-3">Inaktiv ab</th>
                  <th className="py-1 pr-3"><SortHeader label="User (aktiv)" sortKey="user_count" current={firmaSort} setCurrent={setFirmaSort}/></th>
                  <th className="py-1 pr-3"><SortHeader label="Plan" sortKey="plan" current={firmaSort} setCurrent={setFirmaSort}/></th>
                  <th className="py-1 pr-3"><SortHeader label="Plan gültig bis" sortKey="plan_valid_until" current={firmaSort} setCurrent={setFirmaSort}/></th>
                  <th className="py-1 pr-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {firmenView.map(f=>(
                  <tr key={f.id} className="border-t border-gray-700/50">
                    <td className="py-1 pr-3">{f.firmenname}</td>
                    <td className="py-1 pr-3">{f.id}</td>
                    <td className="py-1 pr-3">{fmtDate(f.created_at)}</td>
                    <td className="py-1 pr-3">{f.aktiv ? <Badge tone="good">aktiv</Badge> : <Badge tone="bad">inaktiv</Badge>}</td>
                    <td className="py-1 pr-3">{fmtDate(f.inaktiv_at)}</td>
                    <td className="py-1 pr-3">{f.user_count}</td>
                    <td className="py-1 pr-3">{f.plan || '—'}</td>
                    <td className="py-1 pr-3">{fmtDate(f.plan_valid_until)}</td>
                    <td className="py-1 pr-3">
                      <button
                        className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-700"
                        onClick={async ()=>{ setSelFirma(f); setSelUnit(null); await loadFirmaDetails(f); }}
                      >
                        Öffnen
                      </button>
                    </td>
                  </tr>
                ))}
                {firmenView.length===0 && <tr><td className="py-2 text-gray-400" colSpan={9}>Keine Firmen gefunden.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selFirma && firmaEdit && (
        <div className="grid grid-cols-12 gap-3">
          {/* Stammdaten */}
          <div className="col-span-12 lg:col-span-5">
            <Panel title={`Stammdaten: ${selFirma.firmenname}`}>
  {/* BASIS */}
  <SubSectionTitle>Basisdaten</SubSectionTitle>
  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
    <div>
      <div className="text-xs opacity-70">ID</div>
      <div>{selFirma.id}</div>
    </div>
    <div>
      <div className="text-xs opacity-70">Erstellt</div>
      <div>{fmtDate(selFirma.created_at)}</div>
    </div>
  </div>

  {/* FIRMENDATEN (Name) */}
  <SubSectionTitle>Firmendaten</SubSectionTitle>
  <div className="grid grid-cols-1 gap-2 text-sm mt-2">
    <div>
      <div className="text-xs opacity-70">Firmenname</div>
      <input
        type="text"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.firmenname}
        onChange={e=>setFirmaEdit({ ...firmaEdit, firmenname: e.target.value })}
      />
    </div>
  </div>

  {/* ADRESSE & KONTAKT */}
  <SubSectionTitle>Adresse & Kontakt</SubSectionTitle>
  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
    <div className="col-span-2">
      <div className="text-xs opacity-70">Straße</div>
      <input
        type="text"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.strasse}
        onChange={e=>setFirmaEdit({ ...firmaEdit, strasse: e.target.value })}
      />
    </div>
    <div>
      <div className="text-xs opacity-70">PLZ</div>
      <input
        type="text"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.plz}
        onChange={e=>setFirmaEdit({ ...firmaEdit, plz: e.target.value })}
      />
    </div>
    <div>
      <div className="text-xs opacity-70">Stadt</div>
      <input
        type="text"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.stadt}
        onChange={e=>setFirmaEdit({ ...firmaEdit, stadt: e.target.value })}
      />
    </div>
    <div>
      <div className="text-xs opacity-70">Telefon 1</div>
      <input
        type="text"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.telefon}
        onChange={e=>setFirmaEdit({ ...firmaEdit, telefon: e.target.value })}
      />
    </div>
    <div>
      <div className="text-xs opacity-70">Telefon 2</div>
      <input
        type="text"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.telefon2}
        onChange={e=>setFirmaEdit({ ...firmaEdit, telefon2: e.target.value })}
      />
    </div>
  </div>

  {/* FIRMA-STATUS */}
  <SubSectionTitle>Firma-Status</SubSectionTitle>
  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
    <div className="col-span-2 flex items-center gap-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!firmaEdit.aktiv}
          onChange={e=>setFirmaEdit({ ...firmaEdit, aktiv: e.target.checked })}
        />
        <span>Firma aktiv</span>
      </label>
      {!firmaEdit.aktiv && (
        <Badge tone="bad">inaktiv</Badge>
      )}
    </div>
    <div>
      <div className="text-xs opacity-70">Inaktiv ab</div>
      <input
        type="date"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.inaktiv_at || ''}
        onChange={e=>setFirmaEdit({ ...firmaEdit, inaktiv_at: e.target.value || null })}
      />
    </div>
  </div>

  {/* PLAN / VERTRAG */}
  <SubSectionTitle>Plan / Vertrag</SubSectionTitle>
  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
    <div>
      <div className="text-xs opacity-70">Plan</div>
      <select
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.plan || ''}
        onChange={e=>setFirmaEdit({ ...firmaEdit, plan: e.target.value || null })}
      >
        <option value="">— kein Plan —</option>
        {plaene.map(p=>(
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
    <div>
      <div className="text-xs opacity-70">Plan gültig bis</div>
      <input
        type="date"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
        value={firmaEdit.plan_valid_until || ''}
        onChange={e=>setFirmaEdit({ ...firmaEdit, plan_valid_until: e.target.value || null })}
      />
    </div>
    <div className="col-span-2 flex justify-end mt-2">
      <button
        className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700"
        onClick={saveFirma}
      >
        Firma speichern
      </button>
    </div>
  </div>

  {/* ADMINS & RECHTE – bleibt wie gehabt */}
              <SubSectionTitle>Admins & Unternehmensrechte</SubSectionTitle>
              <div className="mt-2">
                <div className="text-xs opacity-70 mb-1">
                  Hier kannst du Admins das Recht geben, die Unternehmensseite zu sehen.
                </div>
                <ul className="text-sm space-y-1">
                  {orgAdmins.map((a,i)=>(
                    <li key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge>{a.rolle || '—'}</Badge>
                        <span>{a.vorname} {a.nachname}</span>
                        <span className="opacity-70">• {a.email}</span>
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={!!a.can_see_company_page}
                          onChange={() => toggleCompanyPageAccess(a.user_id, !!a.can_see_company_page, a)}
                        />
                        <span>Unternehmensseite</span>
                      </label>
                    </li>
                  ))}
                  {orgAdmins.length===0 && (
                    <li className="text-gray-400">keine Admins gefunden</li>
                  )}
                </ul>
              </div>
            </Panel>

          </div>

                    {/* Units + Editor */}
          <div className="col-span-12 lg:col-span-7">
            <Panel
              title={`Units von ${selFirma.firmenname}`}
              //right={<Badge tone="default">{units.length} Units</Badge>}
              right={
      <div className="flex items-center gap-2">
        <Badge tone="default">{units.length} Units</Badge>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowCreateUnit(true)}
        >
          + Unit erstellen
        </button>
      </div>
    }
  >
              {/* SECTION: Unit-Liste / Übersicht */}
              <SubSectionTitle>Unit-Übersicht</SubSectionTitle>

              <div className="flex flex-wrap gap-2 items-center mb-2 mt-2 text-sm">
                <input
                  type="text"
                  placeholder="Filter Name…"
                  className="px-2 py-1 rounded bg-gray-800 border border-gray-700"
                  value={unitQuery}
                  onChange={(e)=>setUnitQuery(e.target.value)}
                />
                <select
                  className="px-2 py-1 rounded bg-gray-800 border border-gray-700"
                  value={unitAktivFilter}
                  onChange={(e)=>setUnitAktivFilter(e.target.value)}
                >
                  <option value="all">Alle</option>
                  <option value="aktiv">Aktiv</option>
                  <option value="inaktiv">Inaktiv</option>
                </select>
                <select
                  className="px-2 py-1 rounded bg-gray-800 border border-gray-700"
                  value={unitBundesland}
                  onChange={(e)=>setUnitBundesland(e.target.value)}
                >
                  {bundeslandOptions.map(b=><option key={b} value={b}>{b==='all'?'Alle Bundesländer':b}</option>)}
                </select>
              </div>

              {unitsLoading ? (
                <div className="text-sm opacity-80">Lade Units…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase opacity-70">
                        <th className="py-1 pr-3"><SortHeader label="Unit" sortKey="unitname" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3"><SortHeader label="ID" sortKey="id" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3"><SortHeader label="Erstellt" sortKey="created_at" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3"><SortHeader label="Schichten" sortKey="anzahl_schichten" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3"><SortHeader label="Bundesland" sortKey="bundesland" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3"><SortHeader label="Aktiv" sortKey="unit_aktiv" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3"><SortHeader label="User (aktiv)" sortKey="user_count" current={unitSort} setCurrent={setUnitSort}/></th>
                        <th className="py-1 pr-3">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitsView.map(u=>(
                        <tr key={u.id} className="border-t border-gray-700/50">
                          <td className="py-1 pr-3">{u.unitname}</td>
                          <td className="py-1 pr-3">{u.id}</td>
                          <td className="py-1 pr-3">{fmtDate(u.created_at)}</td>
                          <td className="py-1 pr-3">{u.anzahl_schichten ?? '—'}</td>
                          <td className="py-1 pr-3">{u.bundesland ?? '—'}</td>
                          <td className="py-1 pr-3">{u.unit_aktiv ? <Badge tone="good">aktiv</Badge> : <Badge tone="bad">inaktiv</Badge>}</td>
                          <td className="py-1 pr-3">{u.user_count}</td>
                          <td className="py-1 pr-3">
                            <button
                              className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-700"
                              onClick={()=>setSelUnit(u)}
                            >
                              Öffnen
                            </button>
                          </td>
                        </tr>
                      ))}
                      {unitsView.length===0 && (
                        <tr>
                          <td className="py-2 text-gray-400" colSpan={8}>Keine Units nach Filter.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SECTION: Unit-Details / Editor */}
             {selUnit && unitEdit && (
  <div className="mt-3 text-sm border-t border-gray-700 pt-3 space-y-4">
    {/* --- SECTION: Unit-Status --- */}
    <div>
      <SubSectionTitle>Unit-Status</SubSectionTitle>
      <div className="grid grid-cols-12 gap-3 mt-2">
        <div className="col-span-12 md:col-span-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={unitEdit.unit_aktiv}
              onChange={e =>
                setUnitEdit(s => ({ ...s, unit_aktiv: e.target.checked }))
              }
            />
            <span>Unit aktiv</span>
          </label>

          <div className="mt-2">
            <label className="block text-xs opacity-70 mb-1">
              inaktiv_ab (Datum/Zeit)
            </label>
            <input
              type="datetime-local"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
              value={
                unitEdit.unit_inaktiv_at
                  ? dayjs(unitEdit.unit_inaktiv_at).format('YYYY-MM-DDTHH:mm')
                  : ''
              }
              onChange={e =>
                setUnitEdit(s => ({
                  ...s,
                  unit_inaktiv_at: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                }))
              }
            />
          </div>
        </div>
      </div>
    </div>

    {/* --- SECTION: Features --- */}
    <div>
      <SubSectionTitle>Features (Allow / Block / Inherit)</SubSectionTitle>

      <div className="mt-2 flex flex-wrap gap-2">
        {features.map(f => {
          const state = featureStateOf(f.key);
          const title =
            state === 'allow'
              ? 'Explizit freigeschaltet'
              : state === 'block'
              ? 'Explizit gesperrt'
              : 'Vom Plan erben';
          return (
            <TriPill
              key={f.key}
              label={f.key}
              state={state}
              onClick={() => cycleFeature(f.key)}
              title={title}
            />
          );
        })}
        {features.length === 0 && (
          <span className="text-gray-400">Keine aktiven Features gefunden.</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs uppercase opacity-70 mb-1">enabled_features</div>
          <div className="flex flex-wrap gap-1">
            {(unitEdit.enabled_features || []).map(k => (
              <Badge key={`e-${k}`} tone="good">
                {k}
              </Badge>
            ))}
            {(unitEdit.enabled_features || []).length === 0 && (
              <span className="text-gray-400">—</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase opacity-70 mb-1">disabled_features</div>
          <div className="flex flex-wrap gap-1">
            {(unitEdit.disabled_features || []).map(k => (
              <Badge key={`d-${k}`} tone="bad">
                {k}
              </Badge>
            ))}
            {(unitEdit.disabled_features || []).length === 0 && (
              <span className="text-gray-400">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
{/* --- BedarfsModal-Logik --- */}
<div>
  <SubSectionTitle>Bedarfsanalysemodal Logik</SubSectionTitle>

  <div className="mt-2 grid grid-cols-12 gap-3 items-end">
    <div className="col-span-12 md:col-span-7">
      <div className="text-xs opacity-70 mb-1">bam_logik_key</div>

      <select
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
        value={unitEdit.bam_logik_key || 'ROEHM_5SCHICHT'}
        onChange={(e) =>
          setUnitEdit((s) => ({ ...s, bam_logik_key: e.target.value }))
        }
      >
        {BAM_LOGIK_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>

    <div className="col-span-12 md:col-span-5">
      <div className="text-xs opacity-70 mb-1">Aktueller Key</div>
      <Badge tone="info">{unitEdit.bam_logik_key || 'ROEHM_5SCHICHT'}</Badge>
    </div>
  </div>

  <p className="mt-2 text-xs text-gray-400">
    Dieser Key wird in DB_Unit gespeichert und bestimmt, welche Bewertungslogik im BedarfsAnalyseModal genutzt wird.
  </p>
</div>

    {/* --- SECTION: Wochen-Planung Flag --- */}
    <div>
      <SubSectionTitle>Wochen-Planung</SubSectionTitle>

      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!unitEdit.wochenplanung_aktiv}
            onChange={e =>
              setUnitEdit(s => ({
                ...s,
                wochenplanung_aktiv: e.target.checked,
              }))
            }
          />
          <span>WochenPlanung für diese Unit aktiv</span>
        </label>
      </div>

      <p className="mt-1 text-xs text-gray-400">
        Wenn aktiv, ist der Wochenplaner in der Navigation für diese Unit sichtbar.
      </p>
    </div>

    {/* --- SECTION: Abrechnung / Preise --- */}
    <div>
      <SubSectionTitle>Abrechnung / Preise</SubSectionTitle>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs opacity-70 mb-1">Monatspreis (Basis) in €</div>
          <input
            type="number"
            step="0.01"
            className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
            value={unitEdit.preis_monat_basis}
            onChange={e =>
              setUnitEdit(s => ({
                ...s,
                preis_monat_basis: e.target.value,
              }))
            }
          />
        </div>
        <div>
          <div className="text-xs opacity-70 mb-1">Rabatt Unit (%)</div>
          <input
            type="number"
            step="0.1"
            className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
            value={unitEdit.rabatt_unit_prozent}
            onChange={e =>
              setUnitEdit(s => ({
                ...s,
                rabatt_unit_prozent: e.target.value,
              }))
            }
          />
        </div>
        <div>
          <div className="text-xs opacity-70 mb-1">Rabatt Unit (fix in €)</div>
          <input
            type="number"
            step="0.01"
            className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
            value={unitEdit.rabatt_unit_fix}
            onChange={e =>
              setUnitEdit(s => ({
                ...s,
                rabatt_unit_fix: e.target.value,
              }))
            }
          />
        </div>
        <div>
          <div className="text-xs opacity-70 mb-1">Abrechnungs-Notiz</div>
          <textarea
            rows={3}
            className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
            value={unitEdit.abrechnung_notiz}
            onChange={e =>
              setUnitEdit(s => ({
                ...s,
                abrechnung_notiz: e.target.value,
              }))
            }
          />
        </div>
      </div>

      {(() => {
        const basis = Number(unitEdit.preis_monat_basis || 0);
        const rabattProzent = Number(unitEdit.rabatt_unit_prozent || 0);
        const rabattFix = Number(unitEdit.rabatt_unit_fix || 0);
        const nachProzent = basis - (basis * rabattProzent) / 100;
        const eff = Math.max(0, nachProzent - rabattFix);

        if (!basis && !rabattProzent && !rabattFix) return null;

        return (
          <div className="mt-2 text-xs text-gray-300">
            Effektiver Monatspreis:{' '}
            <span className="font-semibold">{eff.toFixed(2)} €</span>
          </div>
        );
      })()}

      <div className="mt-3 flex justify-end">
        <button
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-xs"
          onClick={saveUnit}
        >
          Unit speichern
        </button>
      </div>
    </div>
  </div>
)}
  {/* ... deine Unit-Tabelle & Unit-Editor bleiben wie sie sind ... */}

  {showCreateUnit && (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">
            Neue Unit für {selFirma.firmenname}
          </h4>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-800"
            onClick={() => setShowCreateUnit(false)}
          >
            Schließen
          </button>
        </div>

<KundenUnitErstellen
  firmaId={selFirma.id}
  onCreated={async (newUnit) => {
    setShowCreateUnit(false);
    await loadFirmaDetails(selFirma);
    setSelUnit(newUnit);
  }}
/>

      </div>
    </div>
  )}

</Panel>
          </div>

        </div>
      )}
    </div>
  );
}
