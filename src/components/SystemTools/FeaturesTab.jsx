import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { ChevronDown, ChevronRight, ListChecks, Save, Plus, ArrowUpDown } from 'lucide-react';

const fmtDate = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const Panel = ({ title, right, children, open, setOpen }) => (
  <div className="rounded-2xl border border-gray-600/40 bg-gray-900 text-white">
    <div className="flex items-center justify-between px-3 py-2 cursor-pointer select-none" onClick={() => setOpen?.((o) => !o)}>
      <div className="flex items-center gap-2">
        {open !== undefined ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
    {(open === undefined || open) && <div className="px-3 pb-3">{children}</div>}
  </div>
);

const Badge = ({ children, tone = 'default', className = '' }) => {
  const tones = {
    default: 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
    warn: 'bg-amber-200/80 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

const SortHeader = ({ label, sortKey, current, setCurrent }) => {
  const active = current.key === sortKey;
  const dir = active ? current.dir : null;
  const next = () => setCurrent((s) => (s.key === sortKey ? { key: sortKey, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: sortKey, dir: 'asc' }));
  return (
    <button onClick={next} className={`flex items-center gap-1 ${active ? 'text-white' : 'text-gray-300'}`} title="sortieren">
      <span>{label}</span>
      <ArrowUpDown size={14} className={active ? '' : 'opacity-60'} />
      {active && <span className="text-[10px] opacity-70">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
};

const FeaturesTab = () => {
  const [features, setFeatures] = useState([]);
  const [plaene, setPlaene] = useState([]);
  const [selPlan, setSelPlan] = useState('');
  const [planMap, setPlanMap] = useState({}); // feature_key -> enabled

  const loadFeatureAndPlans = async () => {
    const [{ data: feat }, { data: planRows }] = await Promise.all([
      supabase.from('DB_Features').select('key,beschreibung,active,created_at').order('key', { ascending: true }),
      supabase.from('DB_PlanFeatures').select('plan'),
    ]);
    setFeatures(feat || []);
    setPlaene(Array.from(new Set((planRows || []).map((p) => p.plan))).sort());
  };
  useEffect(() => { loadFeatureAndPlans(); }, []);

  const loadPlanMap = async (plan) => {
    if (!plan) { setPlanMap({}); return; }
    const { data } = await supabase.from('DB_PlanFeatures').select('feature_key,enabled').eq('plan', plan);
    const map = {};
    (data || []).forEach((r) => { map[r.feature_key] = !!r.enabled; });
    setPlanMap(map);
  };
  useEffect(() => { if (selPlan) loadPlanMap(selPlan); }, [selPlan]);

  // Feature Suche/Sort
  const [featQuery, setFeatQuery] = useState('');
  const [featSort, setFeatSort] = useState({ key: 'key', dir: 'asc' });
  const featuresView = useMemo(() => {
    const q = featQuery.trim().toLowerCase();
    let rows = [...features];
    if (q) rows = rows.filter((r) => r.key.toLowerCase().includes(q) || (r.beschreibung || '').toLowerCase().includes(q));
    const get = (r) => {
      switch (featSort.key) {
        case 'active': return r.active ? 1 : 0;
        case 'created_at': return r.created_at ? dayjs(r.created_at).valueOf() : 0;
        case 'key':
        default: return r.key.toLowerCase();
      }
    };
    rows.sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av < bv) return featSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return featSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [features, featQuery, featSort]);

  // Feature-CRUD
  const [newFeat, setNewFeat] = useState({ key: '', beschreibung: '', active: true });

  const addFeature = async () => {
    if (!newFeat.key.trim()) return;
    try {
      const payload = { key: newFeat.key.trim(), beschreibung: newFeat.beschreibung || null, active: !!newFeat.active };
      const { error } = await supabase.from('DB_Features').insert(payload);
      if (error) throw error;
      setNewFeat({ key: '', beschreibung: '', active: true });
      await loadFeatureAndPlans();
    } catch (e) {
      console.error(e);
    }
  };

  const updateFeature = async (row) => {
    try {
      const payload = { beschreibung: row.beschreibung || null, active: !!row.active };
      const { error } = await supabase.from('DB_Features').update(payload).eq('key', row.key);
      if (error) throw error;
      await loadFeatureAndPlans();
    } catch (e) {
      console.error(e);
    }
  };

  // Plan-Zuordnung
  const togglePlanFeature = (key) => setPlanMap((m) => ({ ...m, [key]: !m[key] }));
  const setAllPlan = (value) => {
    const next = {};
    features.forEach((f) => { next[f.key] = !!value; });
    setPlanMap(next);
  };
  const savePlanMap = async () => {
    if (!selPlan) return;
    const rows = features.map((f) => ({ plan: selPlan, feature_key: f.key, enabled: !!planMap[f.key] }));
    const { error } = await supabase.from('DB_PlanFeatures').upsert(rows, { onConflict: 'plan,feature_key' });
    if (error) console.error(error);
    await loadPlanMap(selPlan);
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Feature-Katalog */}
      <div className="col-span-12 lg:col-span-6 space-y-3">
        <Panel title="Feature-Katalog (DB_Features)">
          {/* Neu anlegen */}
          <div className="mb-3 grid grid-cols-12 gap-2 text-sm">
            <div className="col-span-4">
              <label className="block text-xs opacity-70 mb-1">Key</label>
              <input
                value={newFeat.key}
                onChange={(e) => setNewFeat((s) => ({ ...s, key: e.target.value }))}
                placeholder="z.B. tagesuebersicht"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
              />
            </div>
            <div className="col-span-6">
              <label className="block text-xs opacity-70 mb-1">Beschreibung</label>
              <input
                value={newFeat.beschreibung}
                onChange={(e) => setNewFeat((s) => ({ ...s, beschreibung: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs opacity-70 mb-1">Aktiv</label>
              <div className="h-[30px] flex items-center">
                <input
                  type="checkbox"
                  checked={newFeat.active}
                  onChange={(e) => setNewFeat((s) => ({ ...s, active: e.target.checked }))}
                />
              </div>
            </div>
            <div className="col-span-12">
              <button className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-sm" onClick={addFeature}>
                <Plus size={14} className="inline -mt-0.5 mr-1" /> Feature anlegen
              </button>
            </div>
          </div>

          {/* Suche/Sort */}
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <input
              type="text"
              placeholder="Suche Key/Beschreibung…"
              className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
              value={featQuery}
              onChange={(e) => setFeatQuery(e.target.value)}
            />
            <div className="flex items-center gap-3 text-xs">
              <SortHeader label="Key" sortKey="key" current={featSort} setCurrent={setFeatSort} />
              <SortHeader label="Aktiv" sortKey="active" current={featSort} setCurrent={setFeatSort} />
              <SortHeader label="Angelegt" sortKey="created_at" current={featSort} setCurrent={setFeatSort} />
            </div>
          </div>

          {/* Liste */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase opacity-70">
                  <th className="py-1 pr-3">Key</th>
                  <th className="py-1 pr-3">Beschreibung</th>
                  <th className="py-1 pr-3">Aktiv</th>
                  <th className="py-1 pr-3">Angelegt</th>
                  <th className="py-1 pr-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {featuresView.map((f) => (
                  <tr key={f.key} className="border-t border-gray-700/50">
                    <td className="py-1 pr-3 font-mono">{f.key}</td>
                    <td className="py-1 pr-3">
                      <input
                        value={f.beschreibung || ''}
                        onChange={(e) => setFeatures((rows) => rows.map((r) => (r.key === f.key ? { ...r, beschreibung: e.target.value } : r)))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        type="checkbox"
                        checked={!!f.active}
                        onChange={(e) => setFeatures((rows) => rows.map((r) => (r.key === f.key ? { ...r, active: e.target.checked } : r)))}
                      />
                    </td>
                    <td className="py-1 pr-3">{fmtDate(f.created_at)}</td>
                    <td className="py-1 pr-3">
                      <button
                        className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-700 mr-1"
                        onClick={() => updateFeature(f)}
                        title="speichern"
                      >
                        <Save size={14} className="inline -mt-0.5 mr-1" />
                        Speichern
                      </button>
                    </td>
                  </tr>
                ))}
                {featuresView.length === 0 && (
                  <tr><td className="py-2 text-gray-400" colSpan={5}>Keine Features.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Plan-Zuordnung */}
      <div className="col-span-12 lg:col-span-6 space-y-3">
        <Panel title="Paket-Zuordnung (DB_PlanFeatures)" right={<ListChecks size={16} />}>
          <div className="flex flex-wrap items-end gap-2 mb-2">
            <div>
              <label className="block text-xs opacity-70 mb-1">Plan auswählen</label>
              <select
                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
                value={selPlan}
                onChange={(e) => setSelPlan(e.target.value)}
              >
                <option value="">— Plan wählen —</option>
                {plaene.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded bg-gray-800 border border-gray-600 hover:bg-gray-700 text-sm" onClick={() => setAllPlan(true)} disabled={!selPlan}>
                Alle an
              </button>
              <button className="px-3 py-1.5 rounded bg-gray-800 border border-gray-600 hover:bg-gray-700 text-sm" onClick={() => setAllPlan(false)} disabled={!selPlan}>
                Alle aus
              </button>
              <button className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-sm" onClick={savePlanMap} disabled={!selPlan}>
                <Save size={14} className="inline -mt-0.5 mr-1" />
                Zuordnung speichern
              </button>
            </div>
          </div>

          {!selPlan ? (
            <div className="text-sm opacity-70">Bitte zuerst einen Plan auswählen.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {features.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm bg-gray-800/60 border border-gray-700 rounded px-2 py-1">
                  <input type="checkbox" checked={!!planMap[f.key]} onChange={() => togglePlanFeature(f.key)} />
                  <span className="font-mono">{f.key}</span>
                  {!f.active && <Badge tone="warn" className="ml-auto">global inaktiv</Badge>}
                </label>
              ))}
              {features.length === 0 && <div className="text-gray-400 col-span-2">Keine Features vorhanden.</div>}
            </div>
          )}
        </Panel>

        <Panel title="Hinweise">
          <ul className="list-disc ml-5 text-sm space-y-1">
            <li><b>Global inaktiv</b> in DB_Features überschreibt alles (Plan/Overrides).</li>
            <li>Plan-Zuordnung speichert per <i>upsert</i> auf <code>(plan, feature_key)</code>.</li>
            <li>Unit-Overrides in DB_Unit: <b>disabled_features</b> hat Vorrang vor <b>enabled_features</b>, danach Plan.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
};

export default FeaturesTab;
