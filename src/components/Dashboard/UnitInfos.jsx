// src/components/Dashboard/UnitInfos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Info,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const rollenOptionen = [
  'all',
  'Admin_Dev',
  'Planner',
  'Team_Leader',
  'Employee',
];

const sprachOptionen = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'Englisch' },
  { code: 'es', label: 'Spanisch' },
  { code: 'pl', label: 'Polnisch' },
  { code: 'tr', label: 'Türkisch' },
];

const emptyInfo = {
  id: null,
  aktiv: true,
  rollen: ['all'],
  prioritaet: 50,
  rotation_modus: 'rotation',
  darstellung: 'normal',
  anzeige_ab: '',
  anzeige_bis: '',
  texte: [{ sprache: 'de', titel: '', text: '' }],
};

const cls = (...classes) => classes.filter(Boolean).join(' ');

const toInputDateTime = (value) => {
  if (!value) return '';
  return String(value).slice(0, 16);
};

const normalisiereTexte = (texte = []) => {
  const map = new Map();

  map.set('de', {
    sprache: 'de',
    titel: '',
    text: '',
  });

  texte.forEach((item) => {
    map.set(item.sprache, {
      sprache: item.sprache,
      titel: item.titel || '',
      text: item.text || '',
    });
  });

  return Array.from(map.values());
};

const vorbereiteteTexte = (texte = []) => {
  return texte
    .filter((t) => t.text && t.text.trim())
    .map((t) => ({
      sprache: t.sprache,
      titel: t.titel?.trim() || null,
      text: t.text.trim(),
    }));
};

const ersterText = (item) => {
  return (
    item.texte?.find((t) => t.sprache === 'de') ||
    item.texte?.find((t) => t.sprache === 'en') ||
    item.texte?.[0] ||
    null
  );
};

const formatDatum = (value) => {
  if (!value) return '–';

  try {
    return new Date(value).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '–';
  }
};

const UnitInfos = () => {
  const {
    rolle,
    sichtFirma: firma,
    sichtUnit: unit,
  } = useRollen();

  const darfPflegen = ['Admin_Dev', 'Planner'].includes(rolle);

  
  const [infos, setInfos] = useState([]);
  const [formInfo, setFormInfo] = useState(emptyInfo);

  const [meldung, setMeldung] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suche, setSuche] = useState('');
  const [filterStatus, setFilterStatus] = useState('aktiv'); // aktiv | alle | inaktiv
  const [filterRotation, setFilterRotation] = useState('all');

  const aktiveInfos = useMemo(
    () => infos.filter((i) => i.aktiv),
    [infos]
  );

  const gefilterteInfos = useMemo(() => {
    const needle = suche.trim().toLowerCase();

    return (infos || []).filter((item) => {
      if (filterStatus === 'aktiv' && !item.aktiv) return false;
      if (filterStatus === 'inaktiv' && item.aktiv) return false;

      if (filterRotation !== 'all' && item.rotation_modus !== filterRotation) {
        return false;
      }

      if (!needle) return true;

      const texte = item.texte || [];

      return texte.some((t) => {
        return (
          String(t.titel || '').toLowerCase().includes(needle) ||
          String(t.text || '').toLowerCase().includes(needle) ||
          String(t.sprache || '').toLowerCase().includes(needle)
        );
      });
    });
  }, [infos, suche, filterStatus, filterRotation]);

  const ladeInfos = async () => {
    if (!firma || !unit || !darfPflegen) return;

    setLoading(true);
    setMeldung('');

    const { data, error } = await supabase
      .from('DB_ToolInfo')
      .select(`
        *,
        texte:DB_ToolInfo_Text(*)
      `)
      .eq('firma_id', Number(firma))
      .eq('unit_id', Number(unit))
      .order('created_at', { ascending: false });

    if (error) {
      setMeldung(`Fehler beim Laden: ${error.message}`);
      setInfos([]);
    } else {
      setInfos(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    ladeInfos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, unit, darfPflegen]);

  const toggleRolle = (rolleName) => {
    let next = formInfo.rollen || [];

    if (rolleName === 'all') {
      next = ['all'];
    } else {
      next = next.filter((r) => r !== 'all');

      if (next.includes(rolleName)) {
        next = next.filter((r) => r !== rolleName);
      } else {
        next = [...next, rolleName];
      }

      if (next.length === 0) next = ['all'];
    }

    setFormInfo({
      ...formInfo,
      rollen: next,
    });
  };

  const updateText = (sprache, feld, value) => {
    const texte = (formInfo.texte || []).map((t) =>
      t.sprache === sprache ? { ...t, [feld]: value } : t
    );

    setFormInfo({
      ...formInfo,
      texte,
    });
  };

  const addSprache = (sprache) => {
    if (!sprache) return;

    if ((formInfo.texte || []).some((t) => t.sprache === sprache)) return;

    setFormInfo({
      ...formInfo,
      texte: [
        ...(formInfo.texte || []),
        {
          sprache,
          titel: '',
          text: '',
        },
      ],
    });
  };

  const removeSprache = (sprache) => {
    const texte = (formInfo.texte || []).filter((t) => t.sprache !== sprache);

    setFormInfo({
      ...formInfo,
      texte: texte.length > 0
        ? texte
        : [{ sprache: 'de', titel: '', text: '' }],
    });
  };

  const selectInfo = (item) => {
    setMeldung('');

    setFormInfo({
      id: item.id,
      aktiv: item.aktiv ?? true,
      rollen: item.rollen || ['all'],
      prioritaet: item.prioritaet ?? 50,
      rotation_modus: item.rotation_modus || 'rotation',
      darstellung: item.darstellung || 'normal',
      anzeige_ab: toInputDateTime(item.anzeige_ab),
      anzeige_bis: toInputDateTime(item.anzeige_bis),
      texte: normalisiereTexte(item.texte || []),
    });

    setOffen(true);
  };

  const neueInfo = () => {
    setFormInfo(emptyInfo);
    setMeldung('');
    setOffen(true);
  };

  const validiereZeitraum = () => {
    if (!formInfo.anzeige_ab || !formInfo.anzeige_bis) {
      return 'Bitte Anzeige ab und Anzeige bis eintragen.';
    }

    const start = new Date(formInfo.anzeige_ab);
    const ende = new Date(formInfo.anzeige_bis);

    if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime())) {
      return 'Bitte gültige Datumswerte eintragen.';
    }

    if (ende <= start) {
      return 'Anzeige bis muss nach Anzeige ab liegen.';
    }

    const diffTage = (ende - start) / (1000 * 60 * 60 * 24);

    if (formInfo.rotation_modus === 'immer' && diffTage > 14) {
      return 'Bei "Immer" sind maximal 14 Tage erlaubt.';
    }

    if (formInfo.rotation_modus !== 'immer' && diffTage > 28) {
      return 'Bei Rotation sind maximal 28 Tage erlaubt.';
    }

    return null;
  };

  const pruefeImmerKonflikt = async () => {
    if (formInfo.rotation_modus !== 'immer' || !formInfo.aktiv) {
      return null;
    }

    let query = supabase
      .from('DB_ToolInfo')
      .select('id')
      .eq('aktiv', true)
      .eq('rotation_modus', 'immer')
      .eq('firma_id', Number(firma))
      .eq('unit_id', Number(unit))
      .limit(1);

    if (formInfo.id) {
      query = query.neq('id', formInfo.id);
    }

    const { data, error } = await query;

    if (error) {
      return `Fehler bei der Immer-Prüfung: ${error.message}`;
    }

    if (data && data.length > 0) {
      setFilterStatus('aktiv');
      setFilterRotation('immer');
      setSuche('');
      return 'Es gibt bereits eine aktive ToolInfo mit "Immer" für diese Unit.';
    }

    return null;
  };

  const speichern = async () => {
    if (!darfPflegen || !firma || !unit) return;

    setMeldung('');

    const zeitraumFehler = validiereZeitraum();
    if (zeitraumFehler) {
      setMeldung(zeitraumFehler);
      return;
    }

    const textRowsPrepared = vorbereiteteTexte(formInfo.texte);

    if (textRowsPrepared.length === 0) {
      setMeldung('Bitte mindestens einen Text eintragen.');
      return;
    }

    const immerKonflikt = await pruefeImmerKonflikt();
    if (immerKonflikt) {
      setMeldung(immerKonflikt);
      return;
    }

    setSaving(true);

    const payload = {
      aktiv: formInfo.aktiv,
      quelle: 'unit',
      firma_id: Number(firma),
      unit_id: Number(unit),
      rollen: formInfo.rollen,
      prioritaet: Number(formInfo.prioritaet || 50),
      rotation_modus: formInfo.rotation_modus,
      darstellung: formInfo.darstellung || 'normal',
      anzeige_ab: formInfo.anzeige_ab,
      anzeige_bis: formInfo.anzeige_bis,
    };

    let infoId = formInfo.id;

    if (infoId) {
      const { error } = await supabase
        .from('DB_ToolInfo')
        .update(payload)
        .eq('id', infoId)
        .eq('firma_id', Number(firma))
        .eq('unit_id', Number(unit));

      if (error) {
        setSaving(false);
        setMeldung(`Fehler beim Speichern: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('DB_ToolInfo')
        .insert(payload)
        .select('id')
        .single();

      if (error) {
        setSaving(false);
        setMeldung(`Fehler beim Speichern: ${error.message}`);
        return;
      }

      infoId = data.id;
    }

    const { error: deleteError } = await supabase
      .from('DB_ToolInfo_Text')
      .delete()
      .eq('toolinfo_id', infoId);

    if (deleteError) {
      setSaving(false);
      setMeldung(`Fehler beim Aktualisieren der Texte: ${deleteError.message}`);
      return;
    }

    const textRows = textRowsPrepared.map((t) => ({
      toolinfo_id: infoId,
      ...t,
    }));

    const { error: textError } = await supabase
      .from('DB_ToolInfo_Text')
      .insert(textRows);

    if (textError) {
      setSaving(false);
      setMeldung(`Fehler Texte: ${textError.message}`);
      return;
    }

    setSaving(false);
    setMeldung('Unit-Info gespeichert ✅');
    setFormInfo(emptyInfo);
    await ladeInfos();
  };

  const vorhandeneSprachen = formInfo.texte?.map((t) => t.sprache) || [];
  const naechsteSprache = sprachOptionen.find(
    (s) => !vorhandeneSprachen.includes(s.code)
  );

  if (!darfPflegen) return null;

  return (
    <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">


      {offen && (
        <div className="p-3 space-y-3">
          {meldung && (
            <div className="rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 px-3 py-2 text-sm">
              {meldung}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* Formular */}
            <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                </div>

                <button
                  type="button"
                  onClick={neueInfo}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Plus size={13} className="inline -mt-0.5 mr-1" />
                  Neu Info
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Anzeige ab
                  </label>
                  <input
                    type="datetime-local"
                    value={formInfo.anzeige_ab}
                    onChange={(e) =>
                      setFormInfo({ ...formInfo, anzeige_ab: e.target.value })
                    }
                    className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Anzeige bis
                  </label>
                  <input
                    type="datetime-local"
                    value={formInfo.anzeige_bis}
                    onChange={(e) =>
                      setFormInfo({ ...formInfo, anzeige_bis: e.target.value })
                    }
                    className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Rotation
                  </label>
                  <select
                    value={formInfo.rotation_modus}
                    onChange={(e) =>
                      setFormInfo({ ...formInfo, rotation_modus: e.target.value })
                    }
                    className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="immer">Immer</option>
                    <option value="rotation">Rotation</option>
                    <option value="jedes_2_mal">Jedes 2. Mal</option>
                    <option value="jedes_3_mal">Jedes 3. Mal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Darstellung
                  </label>
                  <select
                    value={formInfo.darstellung}
                    onChange={(e) =>
                      setFormInfo({ ...formInfo, darstellung: e.target.value })
                    }
                    className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="hinweis">Hinweis</option>
                    <option value="warnung">Warnung</option>
                    <option value="kritisch">Kritisch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Priorität
                  </label>
                  <input
                    type="number"
                    value={formInfo.prioritaet}
                    onChange={(e) =>
                      setFormInfo({ ...formInfo, prioritaet: e.target.value })
                    }
                    className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormInfo({ ...formInfo, aktiv: !formInfo.aktiv })
                    }
                    className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm text-left"
                  >
                    {formInfo.aktiv ? (
                      <>
                        <ToggleRight className="inline mr-1 text-emerald-500" />
                        Aktiv
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="inline mr-1 text-red-500" />
                        Inaktiv
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-800/60 px-3 py-2 text-xs text-blue-900 dark:text-gray-400">
                <strong className="text-gray-700 dark:text-gray-200">
                  Regel:
                </strong>{' '}
                „Immer“ maximal 14 Tage und nur einmal aktiv pro Unit. Rotation maximal 28 Tage.
              </div>

              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Sichtbar für Rollen
                </label>

                <div className="flex flex-wrap gap-2">
                  {rollenOptionen.map((rolleName) => (
                    <button
                      key={rolleName}
                      type="button"
                      onClick={() => toggleRolle(rolleName)}
                      className={cls(
                        'px-2 py-1 rounded-lg text-xs border transition',
                        formInfo.rollen?.includes(rolleName)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {rolleName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs text-gray-600 dark:text-gray-400">
                    Texte
                  </label>

                  {naechsteSprache && (
                    <button
                      type="button"
                      onClick={() => addSprache(naechsteSprache.code)}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Plus size={13} className="inline -mt-0.5 mr-1" />
                      {naechsteSprache.label}
                    </button>
                  )}
                </div>

                {(formInfo.texte || []).map((sprachText) => {
                  const label =
                    sprachOptionen.find((s) => s.code === sprachText.sprache)?.label ||
                    sprachText.sprache;

                  return (
                    <div
                      key={sprachText.sprache}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {label}
                          <span className="ml-2 text-[11px] text-gray-400">
                            {sprachText.sprache}
                          </span>
                        </div>

                        {(formInfo.texte || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSprache(sprachText.sprache)}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>

                      <input
                        value={sprachText.titel}
                        onChange={(e) =>
                          updateText(sprachText.sprache, 'titel', e.target.value)
                        }
                        className="w-full rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
                        placeholder="Titel, z.B. Wartung"
                      />

                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Vorschau
                        </div>

                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Hallo [Name],
                        </div>

                        <textarea
                          value={sprachText.text}
                          onChange={(e) =>
                            updateText(sprachText.sprache, 'text', e.target.value)
                          }
                          className="w-full min-h-[90px] rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
                          placeholder="kurzer Hinweis für den Begrüßungsbereich..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={speichern}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  <Save size={16} className="inline -mt-0.5 mr-1" />
                  {saving ? 'Speichert...' : 'Unit-Info speichern'}
                </button>
              </div>
            </div>

            {/* Liste */}
            <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 p-3 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Vorhandene Unit-Infos
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {gefilterteInfos.length} von {infos.length} Einträgen
                  </p>
                </div>

                <button
                  type="button"
                  onClick={ladeInfos}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <RefreshCw size={13} className="inline -mt-0.5 mr-1" />
                  Aktualisieren
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  className="rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                  placeholder="Suche..."
                />

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                >
                  <option value="aktiv">Aktiv</option>
                  <option value="alle">Alle</option>
                  <option value="inaktiv">Inaktiv</option>
                </select>

                <select
                  value={filterRotation}
                  onChange={(e) => setFilterRotation(e.target.value)}
                  className="rounded-lg bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 px-3 py-2 text-sm"
                >
                  <option value="all">Alle Rotationen</option>
                  <option value="immer">Immer</option>
                  <option value="rotation">Rotation</option>
                  <option value="jedes_2_mal">Jedes 2. Mal</option>
                  <option value="jedes_3_mal">Jedes 3. Mal</option>
                </select>
              </div>

              {loading && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Lade Unit-Infos...
                </div>
              )}

              {!loading && gefilterteInfos.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-4 text-sm text-gray-600 dark:text-gray-400">
                  Keine passenden Unit-Infos gefunden.
                </div>
              )}

              <div className="space-y-2">
                {gefilterteInfos.map((item) => {
                  const text = ersterText(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectInfo(item)}
                      className={cls(
                        'w-full text-left rounded-xl border px-3 py-2 transition',
                        formInfo.id === item.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:bg-blue-50 dark:hover:bg-gray-800'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                            {text?.titel || 'Unit-Info'}
                          </div>

                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                            {text?.text || 'Kein Text'}
                          </div>
                        </div>

                        <span
                          className={cls(
                            'shrink-0 text-[11px]',
                            item.aktiv ? 'text-emerald-500' : 'text-red-500'
                          )}
                        >
                          {item.aktiv ? 'aktiv' : 'inaktiv'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 dark:text-gray-400 mt-2">
                        <span>
                          {formatDatum(item.anzeige_ab)} – {formatDatum(item.anzeige_bis)}
                        </span>
                        <span>Rotation: {item.rotation_modus}</span>
                        <span>Darstellung: {item.darstellung || 'normal'}</span>
                        <span>Rollen: {(item.rollen || []).join(', ')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitInfos;