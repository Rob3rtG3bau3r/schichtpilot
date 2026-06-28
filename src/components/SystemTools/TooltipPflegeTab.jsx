import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Lightbulb,
  Info,
  Save,
  Plus,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';

const rollenOptionen = [
  'all',
  'SuperAdmin',
  'Org_Admin',
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

const emptyTooltip = {
  id: null,
  key: '',
  aktiv: true,
  quelle: 'schichtpilot',
  firma_id: '',
  unit_id: '',
  rollen: ['all'],
  gueltig_von: '',
  gueltig_bis: '',
  prioritaet: 50,
  texte: [
    { sprache: 'de', titel: '', text: '' },
    { sprache: 'en', titel: '', text: '' },
  ],
};

const emptyInfo = {
  id: null,
  aktiv: true,
  quelle: 'schichtpilot',
  firma_id: '',
  unit_id: '',
  rollen: ['all'],
  prioritaet: 50,
  rotation_modus: 'rotation',
  anzeige_ab: '',
  anzeige_bis: '',
  texte: [
    { sprache: 'de', titel: '', text: '' },
  ],
};

const cls = (...classes) => classes.filter(Boolean).join(' ');

const toInputDate = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const toInputDateTime = (value) => {
  if (!value) return '';
  return String(value).slice(0, 16);
};

const normalisiereTexte = (texte = [], fallback = []) => {
  const map = new Map();

  fallback.forEach((item) => {
    map.set(item.sprache, {
      sprache: item.sprache,
      titel: '',
      text: '',
    });
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

export default function TooltipPflegeTab() {
  const [modus, setModus] = useState('tooltip');

  const [tooltips, setTooltips] = useState([]);
  const [infos, setInfos] = useState([]);

  const [kunden, setKunden] = useState([]);
  const [units, setUnits] = useState([]);

  const [formTooltip, setFormTooltip] = useState(emptyTooltip);
  const [formInfo, setFormInfo] = useState(emptyInfo);

  const [meldung, setMeldung] = useState('');
  const [lade, setLade] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ladeDaten();
  }, []);

  const gefilterteTooltipUnits = useMemo(() => {
    if (!formTooltip.firma_id) return [];
    return units.filter((u) => String(u.firma) === String(formTooltip.firma_id));
  }, [units, formTooltip.firma_id]);

  const gefilterteInfoUnits = useMemo(() => {
    if (!formInfo.firma_id) return [];
    return units.filter((u) => String(u.firma) === String(formInfo.firma_id));
  }, [units, formInfo.firma_id]);

  const ladeDaten = async () => {
    setLade(true);
    setMeldung('');

    const [
      tooltipResult,
      infoResult,
      kundenResult,
      unitResult,
    ] = await Promise.all([
      supabase
        .from('DB_ToolTipp')
        .select(`
          *,
          texte:DB_ToolTipp_Text(*)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('DB_ToolInfo')
        .select(`
          *,
          texte:DB_ToolInfo_Text(*)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('DB_Kunden')
        .select('id, firmenname')
        .order('firmenname', { ascending: true }),

      supabase
        .from('DB_Unit')
        .select('id, unitname, firma')
        .order('unitname', { ascending: true }),
    ]);

    if (tooltipResult.error) setMeldung(`Fehler ToolTipps: ${tooltipResult.error.message}`);
    if (infoResult.error) setMeldung(`Fehler ToolInfos: ${infoResult.error.message}`);

    setTooltips(tooltipResult.data || []);
    setInfos(infoResult.data || []);
    setKunden(kundenResult.data || []);
    setUnits(unitResult.data || []);

    setLade(false);
  };

  const toggleRolle = (rolle, form, setter) => {
    let next = form.rollen || [];

    if (rolle === 'all') {
      next = ['all'];
    } else {
      next = next.filter((r) => r !== 'all');

      if (next.includes(rolle)) {
        next = next.filter((r) => r !== rolle);
      } else {
        next = [...next, rolle];
      }

      if (next.length === 0) next = ['all'];
    }

    setter({ ...form, rollen: next });
  };

  const updateText = (form, setter, sprache, feld, value) => {
    const texte = (form.texte || []).map((t) =>
      t.sprache === sprache ? { ...t, [feld]: value } : t
    );

    setter({ ...form, texte });
  };

  const addSprache = (form, setter, sprache) => {
    if (!sprache) return;
    if ((form.texte || []).some((t) => t.sprache === sprache)) return;

    setter({
      ...form,
      texte: [
        ...(form.texte || []),
        { sprache, titel: '', text: '' },
      ],
    });
  };

  const removeSprache = (form, setter, sprache) => {
    const texte = (form.texte || []).filter((t) => t.sprache !== sprache);

    setter({
      ...form,
      texte: texte.length > 0 ? texte : [{ sprache: 'de', titel: '', text: '' }],
    });
  };

  const selectTooltip = (item) => {
    setMeldung('');

    setFormTooltip({
      id: item.id,
      key: item.key || '',
      aktiv: item.aktiv ?? true,
      quelle: item.quelle || 'schichtpilot',
      firma_id: item.firma_id || '',
      unit_id: item.unit_id || '',
      rollen: item.rollen || ['all'],
      gueltig_von: toInputDate(item.gueltig_von),
      gueltig_bis: toInputDate(item.gueltig_bis),
      prioritaet: item.prioritaet ?? 50,
      texte: normalisiereTexte(item.texte, [
        { sprache: 'de' },
        { sprache: 'en' },
      ]),
    });
  };

  const selectInfo = (item) => {
    setMeldung('');

    setFormInfo({
      id: item.id,
      aktiv: item.aktiv ?? true,
      quelle: item.quelle || 'schichtpilot',
      firma_id: item.firma_id || '',
      unit_id: item.unit_id || '',
      rollen: item.rollen || ['all'],
      prioritaet: item.prioritaet ?? 50,
      rotation_modus: item.rotation_modus || 'rotation',
      anzeige_ab: toInputDateTime(item.anzeige_ab),
      anzeige_bis: toInputDateTime(item.anzeige_bis),
      texte: normalisiereTexte(item.texte, [
        { sprache: 'de' },
      ]),
    });
  };

  const validiereZeitraumInfo = () => {
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
      return 'Bei "immer anzeigen" sind maximal 14 Tage erlaubt.';
    }

    if (formInfo.rotation_modus !== 'immer' && diffTage > 28) {
      return 'Bei Rotation sind maximal 28 Tage erlaubt.';
    }

    return null;
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

  const speichernTooltip = async () => {
    setMeldung('');

    if (!formTooltip.key.trim()) {
      setMeldung('Bitte einen eindeutigen Key eintragen.');
      return;
    }

    const textRowsPrepared = vorbereiteteTexte(formTooltip.texte);

    if (textRowsPrepared.length === 0) {
      setMeldung('Bitte mindestens eine Sprachvariante eintragen.');
      return;
    }

    setSaving(true);

    const payload = {
      key: formTooltip.key.trim(),
      aktiv: formTooltip.aktiv,
      quelle: formTooltip.quelle,
      firma_id: formTooltip.firma_id ? Number(formTooltip.firma_id) : null,
      unit_id: formTooltip.unit_id ? Number(formTooltip.unit_id) : null,
      rollen: formTooltip.rollen,
      gueltig_von: formTooltip.gueltig_von || null,
      gueltig_bis: formTooltip.gueltig_bis || null,
      prioritaet: Number(formTooltip.prioritaet || 50),
    };

    let tooltipId = formTooltip.id;

    if (tooltipId) {
      const { error } = await supabase
        .from('DB_ToolTipp')
        .update(payload)
        .eq('id', tooltipId);

      if (error) {
        setSaving(false);
        setMeldung(`Fehler: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('DB_ToolTipp')
        .insert(payload)
        .select('id')
        .single();

      if (error) {
        setSaving(false);
        setMeldung(`Fehler: ${error.message}`);
        return;
      }

      tooltipId = data.id;
    }

    const { error: deleteError } = await supabase
      .from('DB_ToolTipp_Text')
      .delete()
      .eq('tooltip_id', tooltipId);

    if (deleteError) {
      setSaving(false);
      setMeldung(`Fehler beim Aktualisieren der Texte: ${deleteError.message}`);
      return;
    }

    const textRows = textRowsPrepared.map((t) => ({
      tooltip_id: tooltipId,
      ...t,
    }));

    const { error: textError } = await supabase
      .from('DB_ToolTipp_Text')
      .insert(textRows);

    if (textError) {
      setSaving(false);
      setMeldung(`Fehler Texte: ${textError.message}`);
      return;
    }

    setSaving(false);
    setMeldung('ToolTipp gespeichert ✅');
    setFormTooltip(emptyTooltip);
    ladeDaten();
  };

  const speichernInfo = async () => {
    setMeldung('');

    const zeitraumFehler = validiereZeitraumInfo();
    if (zeitraumFehler) {
      setMeldung(zeitraumFehler);
      return;
    }

    const textRowsPrepared = vorbereiteteTexte(formInfo.texte);

    if (textRowsPrepared.length === 0) {
      setMeldung('Bitte mindestens eine Sprachvariante eintragen.');
      return;
    }

    setSaving(true);

    const payload = {
      aktiv: formInfo.aktiv,
      quelle: formInfo.quelle,
      firma_id: formInfo.firma_id ? Number(formInfo.firma_id) : null,
      unit_id: formInfo.unit_id ? Number(formInfo.unit_id) : null,
      rollen: formInfo.rollen,
      prioritaet: Number(formInfo.prioritaet || 50),
      rotation_modus: formInfo.rotation_modus,
      anzeige_ab: formInfo.anzeige_ab,
      anzeige_bis: formInfo.anzeige_bis,
    };

    let infoId = formInfo.id;

    if (infoId) {
      const { error } = await supabase
        .from('DB_ToolInfo')
        .update(payload)
        .eq('id', infoId);

      if (error) {
        setSaving(false);
        setMeldung(`Fehler: ${error.message}`);
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
        setMeldung(`Fehler: ${error.message}`);
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
    setMeldung('ToolInfo gespeichert ✅');
    setFormInfo(emptyInfo);
    ladeDaten();
  };

  const renderRollenSelector = (form, setter) => (
    <div>
      <label className="block text-xs text-gray-400 mb-1">
        Verfügbar für Rollen
      </label>

      <div className="flex flex-wrap gap-2">
        {rollenOptionen.map((rolle) => (
          <button
            key={rolle}
            type="button"
            onClick={() => toggleRolle(rolle, form, setter)}
            className={cls(
              'px-2 py-1 rounded text-xs border transition',
              form.rollen?.includes(rolle)
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            )}
          >
            {rolle}
          </button>
        ))}
      </div>
    </div>
  );

  const renderScopeSelector = (form, setter, filteredUnits) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Firma
        </label>

        <select
          value={form.firma_id}
          onChange={(e) =>
            setter({
              ...form,
              firma_id: e.target.value,
              unit_id: '',
            })
          }
          className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
        >
          <option value="">Alle Firmen / global</option>
          {kunden.map((kunde) => (
            <option key={kunde.id} value={kunde.id}>
              {kunde.firmenname}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Unit
        </label>

        <select
          value={form.unit_id}
          onChange={(e) =>
            setter({
              ...form,
              unit_id: e.target.value,
            })
          }
          disabled={!form.firma_id}
          className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">
            {form.firma_id ? 'Alle Units der Firma' : 'Erst Firma wählen'}
          </option>

          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unitname}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderSprachEditor = (form, setter, hint) => {
    const vorhandeneSprachen = form.texte?.map((t) => t.sprache) || [];
    const naechsteSprache = sprachOptionen.find((s) => !vorhandeneSprachen.includes(s.code));

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Sprachvarianten
            </label>
            {hint && (
              <p className="text-[11px] text-gray-500">
                {hint}
              </p>
            )}
          </div>

          {naechsteSprache && (
            <button
              type="button"
              onClick={() => addSprache(form, setter, naechsteSprache.code)}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs border border-gray-700"
            >
              <Plus size={13} className="inline -mt-0.5 mr-1" />
              {naechsteSprache.label}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {(form.texte || []).map((sprachText) => {
            const label = sprachOptionen.find((s) => s.code === sprachText.sprache)?.label || sprachText.sprache;

            const previewGreeting =
                sprachText.sprache === 'en'
                ? 'Hello [Name],'
                : sprachText.sprache === 'es'
                    ? 'Hola [Name],'
                    : sprachText.sprache === 'pl'
                    ? 'Cześć [Name],'
                    : sprachText.sprache === 'tr'
                        ? 'Merhaba [Name],'
                        : 'Hallo [Name],';

            const textPlaceholder =
                sprachText.sprache === 'en'
                ? 'did you know that you can view your working hours and vacation history as a chart in the overview?'
                : sprachText.sprache === 'es'
                    ? '¿sabías que puedes ver el historial de tus horas y vacaciones como gráfico en la vista general?'
                    : sprachText.sprache === 'pl'
                    ? 'czy wiesz, że w przeglądzie możesz zobaczyć historię swoich godzin i urlopu jako wykres?'
                    : sprachText.sprache === 'tr'
                        ? 'genel bakışta çalışma saatlerini ve izin geçmişini grafik olarak görebileceğini biliyor muydun?'
                        : 'wusstest du, dass du dir in der Übersicht den Verlauf deiner Stunden und deines Urlaubs als Chart anschauen kannst?';

            return (
              <div
                key={sprachText.sprache}
                className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">
                    {label}
                    <span className="ml-2 text-[11px] text-gray-500">
                      {sprachText.sprache}
                    </span>
                  </h4>

                  {(form.texte || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSprache(form, setter, sprachText.sprache)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                    <div>
                    <label className="block text-xs text-gray-400 mb-1">
                        Titel
                    </label>

                    <input
                        value={sprachText.titel}
                        onChange={(e) =>
                        updateText(form, setter, sprachText.sprache, 'titel', e.target.value)
                        }
                        className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                        placeholder="z.B. Übersicht"
                    />
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                    <div className="text-xs text-gray-400 mb-1">
                        Vorschau im Layout
                    </div>

                    <div className="text-sm font-semibold text-gray-100">
                    {previewGreeting}
                    </div>

                    <textarea
                        value={sprachText.text}
                        onChange={(e) =>
                        updateText(form, setter, sprachText.sprache, 'text', e.target.value)
                        }
                        className="mt-2 w-full min-h-[120px] rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                        placeholder={textPlaceholder}
                    />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const ItemStatus = ({ aktiv }) => (
    <span className={aktiv ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
      {aktiv ? 'aktiv' : 'inaktiv'}
    </span>
  );

  const ScopeLabel = ({ item }) => {
    const kunde = kunden.find((k) => String(k.id) === String(item.firma_id));
    const unit = units.find((u) => String(u.id) === String(item.unit_id));

    if (item.unit_id) return <span>{kunde?.firmenname || 'Firma'} / {unit?.unitname || 'Unit'}</span>;
    if (item.firma_id) return <span>{kunde?.firmenname || 'Firma'} / alle Units</span>;
    return <span>global</span>;
  };

  const ersterText = (item) => {
    return item.texte?.find((t) => t.sprache === 'de')
      || item.texte?.find((t) => t.sprache === 'en')
      || item.texte?.[0]
      || null;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold">Tooltip Pflege</h2>
            <p className="text-sm text-gray-400">
              Tipps und zeitlich begrenzte Informationen für den Begrüßungsbereich im Layout.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModus('tooltip')}
              className={cls(
                'px-3 py-2 rounded text-sm border border-gray-700',
                modus === 'tooltip'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              )}
            >
              <Lightbulb size={16} className="inline -mt-0.5 mr-1" />
              ToolTipps
            </button>

            <button
              onClick={() => setModus('info')}
              className={cls(
                'px-3 py-2 rounded text-sm border border-gray-700',
                modus === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              )}
            >
              <Info size={16} className="inline -mt-0.5 mr-1" />
              ToolInfos
            </button>

            <button
              onClick={ladeDaten}
              className="px-3 py-2 rounded text-sm border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
            >
              <RefreshCw size={16} className="inline -mt-0.5 mr-1" />
              Aktualisieren
            </button>
          </div>
        </div>

        {meldung && (
          <div className="mb-4 rounded border border-blue-500 bg-blue-950 text-blue-100 px-3 py-2 text-sm">
            {meldung}
          </div>
        )}

        {modus === 'tooltip' && (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-700 bg-gray-950 p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  {formTooltip.id ? 'ToolTipp bearbeiten' : 'Neuen ToolTipp erstellen'}
                </h3>

                <button
                  onClick={() => {
                    setFormTooltip(emptyTooltip);
                    setMeldung('');
                  }}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                >
                  <Plus size={14} className="inline -mt-0.5 mr-1" />
                  Neu
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Key
                </label>

                <input
                  value={formTooltip.key}
                  onChange={(e) => setFormTooltip({ ...formTooltip, key: e.target.value })}
                  className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  placeholder="employee_dashboard_charts"
                />

                <p className="text-[11px] text-gray-500 mt-1">
                  Eindeutiger technischer Name. Später hilfreich für Suche, Pflege und Updates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Quelle
                  </label>

                  <select
                    value={formTooltip.quelle}
                    onChange={(e) => setFormTooltip({ ...formTooltip, quelle: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="schichtpilot">SchichtPilot</option>
                    <option value="unit">Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Priorität
                  </label>

                  <input
                    type="number"
                    value={formTooltip.prioritaet}
                    onChange={(e) => setFormTooltip({ ...formTooltip, prioritaet: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Status
                  </label>

                  <button
                    type="button"
                    onClick={() => setFormTooltip({ ...formTooltip, aktiv: !formTooltip.aktiv })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-left"
                  >
                    {formTooltip.aktiv ? (
                      <>
                        <ToggleRight className="inline mr-1 text-emerald-400" />
                        Aktiv
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="inline mr-1 text-red-400" />
                        Inaktiv
                      </>
                    )}
                  </button>
                </div>
              </div>

              {renderScopeSelector(formTooltip, setFormTooltip, gefilterteTooltipUnits)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Gültig von
                  </label>

                  <input
                    type="date"
                    value={formTooltip.gueltig_von}
                    onChange={(e) => setFormTooltip({ ...formTooltip, gueltig_von: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Gültig bis
                  </label>

                  <input
                    type="date"
                    value={formTooltip.gueltig_bis}
                    onChange={(e) => setFormTooltip({ ...formTooltip, gueltig_bis: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {renderRollenSelector(formTooltip, setFormTooltip)}

              {renderSprachEditor(
                formTooltip,
                setFormTooltip,
                'Bei SchichtPilot-Tipps ist Deutsch + Englisch sinnvoll. Pflicht ist aber nur mindestens eine Sprache.'
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={speichernTooltip}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  <Save size={16} className="inline -mt-0.5 mr-1" />
                  {saving ? 'Speichert...' : 'ToolTipp speichern'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-950 p-4">
              <h3 className="font-semibold mb-3">Vorhandene ToolTipps</h3>

              {lade && <div className="text-sm text-gray-400">Lade...</div>}

              {!lade && tooltips.length === 0 && (
                <div className="text-sm text-gray-400">
                  Noch keine ToolTipps vorhanden.
                </div>
              )}

              <div className="space-y-2">
                {tooltips.map((item) => {
                  const text = ersterText(item);

                  return (
                    <button
                      key={item.id}
                      onClick={() => selectTooltip(item)}
                      className={cls(
                        'w-full text-left rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 px-3 py-2',
                        formTooltip.id === item.id && 'ring-1 ring-blue-500'
                      )}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="font-semibold text-sm truncate">
                          {text?.titel || item.key}
                        </div>
                        <ItemStatus aktiv={item.aktiv} />
                      </div>

                      <div className="text-xs text-gray-400 truncate mt-1">
                        {text?.text || 'Kein Text'}
                      </div>

                      <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Key: {item.key}</span>
                        <span>Rollen: {(item.rollen || []).join(', ')}</span>
                        <span>Scope: <ScopeLabel item={item} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {modus === 'info' && (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-700 bg-gray-950 p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  {formInfo.id ? 'ToolInfo bearbeiten' : 'Neue ToolInfo erstellen'}
                </h3>

                <button
                  onClick={() => {
                    setFormInfo(emptyInfo);
                    setMeldung('');
                  }}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                >
                  <Plus size={14} className="inline -mt-0.5 mr-1" />
                  Neu
                </button>
              </div>

              {renderScopeSelector(formInfo, setFormInfo, gefilterteInfoUnits)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Anzeige ab
                  </label>

                  <input
                    type="datetime-local"
                    value={formInfo.anzeige_ab}
                    onChange={(e) => setFormInfo({ ...formInfo, anzeige_ab: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Anzeige bis
                  </label>

                  <input
                    type="datetime-local"
                    value={formInfo.anzeige_bis}
                    onChange={(e) => setFormInfo({ ...formInfo, anzeige_bis: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Quelle
                  </label>

                  <select
                    value={formInfo.quelle}
                    onChange={(e) => setFormInfo({ ...formInfo, quelle: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="schichtpilot">SchichtPilot</option>
                    <option value="unit">Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Rotation
                  </label>

                  <select
                    value={formInfo.rotation_modus}
                    onChange={(e) => setFormInfo({ ...formInfo, rotation_modus: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="immer">Immer</option>
                    <option value="rotation">Rotation</option>
                    <option value="jedes_2_mal">Jedes 2. Mal</option>
                    <option value="jedes_3_mal">Jedes 3. Mal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Priorität
                  </label>

                  <input
                    type="number"
                    value={formInfo.prioritaet}
                    onChange={(e) => setFormInfo({ ...formInfo, prioritaet: e.target.value })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Status
                  </label>

                  <button
                    type="button"
                    onClick={() => setFormInfo({ ...formInfo, aktiv: !formInfo.aktiv })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-left"
                  >
                    {formInfo.aktiv ? (
                      <>
                        <ToggleRight className="inline mr-1 text-emerald-400" />
                        Aktiv
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="inline mr-1 text-red-400" />
                        Inaktiv
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-400">
                <strong className="text-gray-300">Zeitraum-Regel:</strong>{' '}
                Immer anzeigen maximal 14 Tage. Rotation / jedes 2. / jedes 3. Mal maximal 28 Tage.
              </div>

              {renderRollenSelector(formInfo, setFormInfo)}

              {renderSprachEditor(
                formInfo,
                setFormInfo,
                'ToolInfos dürfen einsprachig sein. Später kann pro Firma/Unit gezielt entschieden werden, welche Sprachen gepflegt werden.'
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={speichernInfo}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  <Save size={16} className="inline -mt-0.5 mr-1" />
                  {saving ? 'Speichert...' : 'ToolInfo speichern'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-950 p-4">
              <h3 className="font-semibold mb-3">Vorhandene ToolInfos</h3>

              {lade && <div className="text-sm text-gray-400">Lade...</div>}

              {!lade && infos.length === 0 && (
                <div className="text-sm text-gray-400">
                  Noch keine ToolInfos vorhanden.
                </div>
              )}

              <div className="space-y-2">
                {infos.map((item) => {
                  const text = ersterText(item);

                  return (
                    <button
                      key={item.id}
                      onClick={() => selectInfo(item)}
                      className={cls(
                        'w-full text-left rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 px-3 py-2',
                        formInfo.id === item.id && 'ring-1 ring-blue-500'
                      )}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="font-semibold text-sm truncate">
                          {text?.titel || 'ToolInfo'}
                        </div>
                        <ItemStatus aktiv={item.aktiv} />
                      </div>

                      <div className="text-xs text-gray-400 truncate mt-1">
                        {text?.text || 'Kein Text'}
                      </div>

                      <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          {item.anzeige_ab
                            ? new Date(item.anzeige_ab).toLocaleString('de-DE')
                            : '–'}{' '}
                          –{' '}
                          {item.anzeige_bis
                            ? new Date(item.anzeige_bis).toLocaleString('de-DE')
                            : '–'}
                        </span>
                        <span>Rotation: {item.rotation_modus}</span>
                        <span>Rollen: {(item.rollen || []).join(', ')}</span>
                        <span>Scope: <ScopeLabel item={item} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}