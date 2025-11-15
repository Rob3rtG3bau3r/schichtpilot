// src/components/SystemTools/RechnungEditor.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { RotateCw, PlusCircle, Trash2 } from 'lucide-react';

const fmtDate = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const Panel = ({ title, right, children }) => (
  <div className="rounded-2xl border border-gray-600/40 bg-gray-900 text-white mb-3">
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/60">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-200">
        {title}
      </h2>
      <div className="flex items-center gap-2 text-xs">{right}</div>
    </div>
    <div className="px-3 py-3">
      {children}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    entwurf: 'bg-gray-600 text-gray-50',
    offen: 'bg-yellow-500/80 text-black',
    bezahlt: 'bg-green-600/90 text-white',
    storniert: 'bg-red-700/80 text-white',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] ${map[status] || 'bg-gray-700 text-gray-100'}`}>
      {status || '—'}
    </span>
  );
};

// Hilfsfunktion: erkennt die spezielle Jahresrabatt-Position
const isJahresrabattPos = (p) =>
  p &&
  (p.einheit === 'Rabatt') &&
  (p.beschreibung || '').toLowerCase().startsWith('jahresrabatt');

export default function RechnungEditor({ rechnung, firmenMap, onUpdated }) {
  const [header, setHeader] = useState({
    id: null,
    firma_id: null,
    rechnungsnummer: '',
    periode_von: '',
    periode_bis: '',
    faellig_am: '',
    status: 'entwurf',
    bemerkung_intern: '',
    bemerkung_kunde: '',
    steuersatz: 19,
  });

  const [rechnungsart, setRechnungsart] = useState('monat'); // 'monat' | 'jahr'
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState([]);
  const [positions, setPositions] = useState([]);
  const [statusInfo, setStatusInfo] = useState(null); // {type:'success'|'error', text:string}

  // ---- Initial laden, wenn eine Rechnung ausgewählt wird -------------------
  useEffect(() => {
    setStatusInfo(null);

    if (!rechnung) {
      setHeader({
        id: null,
        firma_id: null,
        rechnungsnummer: '',
        periode_von: '',
        periode_bis: '',
        faellig_am: '',
        status: 'entwurf',
        bemerkung_intern: '',
        bemerkung_kunde: '',
        steuersatz: 19,
      });
      setUnits([]);
      setPositions([]);
      setRechnungsart('monat');
      return;
    }

    setHeader({
      id: rechnung.id,
      firma_id: rechnung.firma_id,
      rechnungsnummer: rechnung.rechnungsnummer || '',
      periode_von: rechnung.periode_von || '',
      periode_bis: rechnung.periode_bis || '',
      faellig_am: rechnung.faellig_am || '',
      status: rechnung.status || 'entwurf',
      bemerkung_intern: rechnung.bemerkung_intern || '',
      bemerkung_kunde: rechnung.bemerkung_kunde || '',
      steuersatz: rechnung.steuersatz ?? 19,
    });

    setRechnungsart('monat'); // Start: Monatsrechnung, Logik übernehmen wir über den Select
    loadUnitsAndPositions(rechnung.firma_id, rechnung.id, 'monat');
  }, [rechnung]);

  // ---- Jahresrabatt automatisch anwenden / entfernen ----------------------
  const applyJahresrabatt = (posList, art) => {
    const arr = [...(posList || [])];
    const existingIndex = arr.findIndex(isJahresrabattPos);

    // Wenn keine Jahresrechnung: Rabattposition ggf. entfernen
    if (art !== 'jahr') {
      if (existingIndex !== -1) {
        arr.splice(existingIndex, 1);
      }
      return arr.map((p, i) => ({ ...p, sort_order: i + 1 }));
    }

    // Jahresrechnung: 10 % Rabatt über alle Positionen außer Rabatt selbst
    const baseSum = arr
      .filter((p, idx) => idx !== existingIndex)
      .reduce(
        (sum, p) =>
          sum + (p.gesamt_netto != null ? Number(p.gesamt_netto) : 0),
        0
      );

    const rabattWert = -baseSum * 0.1; // -10 %

    if (existingIndex !== -1) {
      arr[existingIndex] = {
        ...arr[existingIndex],
        menge: 1,
        einheit: 'Rabatt',
        beschreibung: 'Jahresrabatt 10 %',
        einzelpreis: rabattWert,
        gesamt_netto: rabattWert,
        rabatt_prozent: 10,
        rabatt_betrag: Math.abs(rabattWert),
      };
    } else {
      arr.push({
        id: null,
        isNew: true,
        rechnung_id: header.id || null,
        unit_id: null,
        beschreibung: 'Jahresrabatt 10 %',
        menge: 1,
        einheit: 'Rabatt',
        einzelpreis: rabattWert,
        rabatt_prozent: 10,
        rabatt_betrag: Math.abs(rabattWert),
        gesamt_netto: rabattWert,
        sort_order: arr.length + 1,
      });
    }

    return arr.map((p, i) => ({ ...p, sort_order: i + 1 }));
  };

  // Wrapper, damit alle Änderungen an Positionen den Jahresrabatt berücksichtigen
  const updatePositions = (updater) => {
    setPositions((prev) => {
      const base =
        typeof updater === 'function' ? updater(prev) : updater;
      return applyJahresrabatt(base, rechnungsart);
    });
  };

  // ---- Units + vorhandene Positionen laden ---------------------------------
  const loadUnitsAndPositions = async (firmaId, rechnungId, art = rechnungsart) => {
    if (!firmaId) {
      setUnits([]);
      setPositions([]);
      return;
    }
    setLoading(true);
    try {
      const [{ data: unitRows, error: uErr }, { data: posRows, error: pErr }] =
        await Promise.all([
          supabase
            .from('DB_Unit')
            .select(`
              id,
              unitname,
              preis_monat_basis,
              rabatt_unit_prozent,
              rabatt_unit_fix,
              abrechnung_notiz
            `)
            .eq('firma', firmaId)
            .order('unitname'),
          rechnungId
            ? supabase
                .from('DB_RechnungPosition')
                .select('*')
                .eq('rechnung_id', rechnungId)
                .order('sort_order', { ascending: true })
            : { data: [], error: null },
        ]);

      if (uErr) throw uErr;
      if (pErr) throw pErr;

      setUnits(unitRows || []);
      const basePositions = (posRows || []).map((p) => ({
        ...p,
        isNew: false,
      }));
      setPositions(applyJahresrabatt(basePositions, art));
    } catch (e) {
      console.error('Fehler beim Laden von Units/Positionen:', e);
      setStatusInfo({
        type: 'error',
        text: 'Fehler beim Laden von Units/Positionen (siehe Konsole).',
      });
    } finally {
      setLoading(false);
    }
  };

  // ---- Rechner: Summe Netto / Steuer / Brutto ------------------------------
  const summeNetto = useMemo(
    () =>
      positions.reduce(
        (sum, p) => sum + (p.gesamt_netto != null ? Number(p.gesamt_netto) : 0),
        0
      ),
    [positions]
  );

  const steuerBetrag = useMemo(
    () => summeNetto * (Number(header.steuersatz || 0) / 100),
    [summeNetto, header.steuersatz]
  );

  const summeBrutto = useMemo(
    () => summeNetto + steuerBetrag,
    [summeNetto, steuerBetrag]
  );

  // ---- Auto-Rechnungsnummer ------------------------------------------------
  const generateRechnungsnummer = async () => {
    const heute = dayjs().format('YYYY-MM-DD');
    const { count, error } = await supabase
      .from('DB_Rechnung')
      .select('id', { head: true, count: 'exact' })
      .gte('created_at', `${heute}T00:00:00`)
      .lt('created_at', `${heute}T23:59:59`);
    if (error) {
      console.error('Fehler beim Zählen der Tagesrechnungen:', error);
      // Fallback
      return `SP-${dayjs().format('YYYYMMDD')}-010`;
    }
    const nummerIndex = (count || 0) + 10; // Start bei 10
    const suffix = String(nummerIndex).padStart(3, '0');
    return `SP-${dayjs().format('YYYYMMDD')}-${suffix}`;
  };

  // ---- Position aus Unit übernehmen ----------------------------------------
  const uebernehmeUnitAlsPosition = (u) => {
    const basis = Number(u.preis_monat_basis || 0);
    const rabattProzent = Number(u.rabatt_unit_prozent || 0);
    const rabattFix = Number(u.rabatt_unit_fix || 0);
    const rabattProzentBetrag = (basis * rabattProzent) / 100;
    const netto = basis - rabattProzentBetrag - rabattFix;

    const neuePos = {
      id: null,
      isNew: true,
      rechnung_id: header.id || null,
      unit_id: u.id,
      beschreibung: `${u.unitname} – Monat ${dayjs(
        header.periode_von || new Date()
      ).format('MM/YYYY')}`,
      menge: 1,
      einheit: 'Monat',
      einzelpreis: netto,
      rabatt_prozent: rabattProzent || null,
      rabatt_betrag: (rabattProzentBetrag + rabattFix) || null,
      gesamt_netto: netto,
      sort_order: positions.length + 1,
    };

    updatePositions((prev) => [...prev, neuePos]);
  };

  // ---- Freie Position hinzufügen -------------------------------------------
  const addFreiePosition = () => {
    const neuePos = {
      id: null,
      isNew: true,
      rechnung_id: header.id || null,
      unit_id: null,
      beschreibung: 'Individuelle Position',
      menge: 1,
      einheit: 'Stück',
      einzelpreis: 0,
      rabatt_prozent: null,
      rabatt_betrag: null,
      gesamt_netto: 0,
      sort_order: positions.length + 1,
    };
    updatePositions((prev) => [...prev, neuePos]);
  };

  const updateFreiePosition = (index, patch) => {
    updatePositions((prev) => {
      const copy = [...prev];
      const p = { ...copy[index], ...patch };

      const menge = Number(p.menge || 0);
      const preis = Number(p.einzelpreis || 0);
      p.gesamt_netto = menge * preis;

      copy[index] = p;
      return copy;
    });
  };

  const removePosition = (index) => {
    updatePositions((prev) => prev.filter((_, i) => i !== index));
  };

  // ---- Speichern -----------------------------------------------------------
  const handleSave = async () => {
    setStatusInfo(null);

    if (!header.firma_id) {
      setStatusInfo({
        type: 'error',
        text: 'Bitte zuerst eine Firma auswählen.',
      });
      return;
    }
    if (!header.periode_von || !header.periode_bis) {
      setStatusInfo({
        type: 'error',
        text: 'Bitte Leistungszeitraum (von/bis) angeben.',
      });
      return;
    }

    setLoading(true);
    try {
      let rechnungsnummer = header.rechnungsnummer;
      if (!rechnungsnummer || rechnungsnummer.trim() === '') {
        rechnungsnummer = await generateRechnungsnummer();
      }

      const payload = {
        firma_id: header.firma_id,
        rechnungsnummer,
        periode_von: header.periode_von || null,
        periode_bis: header.periode_bis || null,
        faellig_am: header.faellig_am || null,
        status: header.status || 'entwurf',
        bemerkung_intern: header.bemerkung_intern || null,
        bemerkung_kunde: header.bemerkung_kunde || null,
        betrag_netto: summeNetto,
        steuersatz: Number(header.steuersatz || 0),
        steuer_betrag: steuerBetrag,
        betrag_brutto: summeBrutto,
      };

      let rechnungId = header.id;

      if (rechnungId) {
        const { error } = await supabase
          .from('DB_Rechnung')
          .update(payload)
          .eq('id', rechnungId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('DB_Rechnung')
          .insert([{ ...payload }])
          .select()
          .maybeSingle();
        if (error) throw error;
        rechnungId = data.id;
        setHeader((h) => ({ ...h, id: rechnungId, rechnungsnummer }));
      }

      // Positionen speichern
      const { error: delErr } = await supabase
        .from('DB_RechnungPosition')
        .delete()
        .eq('rechnung_id', rechnungId);
      if (delErr) throw delErr;

      if (positions.length > 0) {
        const rows = positions.map((p, idx) => ({
          rechnung_id: rechnungId,
          unit_id: p.unit_id || null,
          beschreibung: p.beschreibung,
          menge: Number(p.menge || 0),
          einheit: p.einheit || 'Stück',
          einzelpreis: Number(p.einzelpreis || 0),
          rabatt_prozent:
            p.rabatt_prozent != null ? Number(p.rabatt_prozent) : null,
          rabatt_betrag:
            p.rabatt_betrag != null ? Number(p.rabatt_betrag) : null,
          gesamt_netto: Number(p.gesamt_netto || 0),
          sort_order: idx + 1,
        }));

        const { error: insErr } = await supabase
          .from('DB_RechnungPosition')
          .insert(rows);
        if (insErr) throw insErr;
      }

      if (onUpdated) onUpdated();

      setStatusInfo({
        type: 'success',
        text: `Gespeichert ${dayjs().format('HH:mm:ss')}`,
      });
      setTimeout(() => {
        setStatusInfo((prev) =>
          prev && prev.type === 'success' ? null : prev
        );
      }, 4000);
    } catch (e) {
      console.error('Fehler beim Speichern der Rechnung:', e);
      setStatusInfo({
        type: 'error',
        text: 'Fehler beim Speichern (Details in der Konsole).',
      });
    } finally {
      setLoading(false);
    }
  };

  // ---- UI ------------------------------------------------------------------
  const firmaName = header.firma_id ? firmenMap[header.firma_id] : '';

  return (
    <div className="space-y-3">
      {/* RECHNUNGSKOPF */}
<Panel
  title="Rechnung"
  right={
    <>
      {statusInfo && (
        <span
          className={
            statusInfo.type === 'error'
              ? 'text-red-400'
              : 'text-green-400'
          }
        >
          {statusInfo.text}
        </span>
      )}

      {/* 🔽 NEU: Status änderbar machen */}
      <select
        className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-700 mr-1"
        value={header.status}
        onChange={(e) =>
          setHeader((h) => ({ ...h, status: e.target.value }))
        }
      >
        <option value="entwurf">entwurf</option>
        <option value="offen">offen</option>
        <option value="bezahlt">bezahlt</option>
        <option value="storniert">storniert</option>
      </select>

      {/* optional weiter als Badge anzeigen */}
      <StatusBadge status={header.status} />

      <button
        onClick={handleSave}
        disabled={loading}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-xs disabled:opacity-50"
      >
        <RotateCw size={14} />
        Speichern
      </button>
    </>
  }
>

        {/* Zeile 1: Nummer / Firma / Fällig / Art */}
        <div className="grid grid-cols-12 gap-2 text-sm mb-2">
          <div className="col-span-12 md:col-span-3">
            <div className="text-xs opacity-70 mb-1">Rechnungsnummer</div>
            <input
              type="text"
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={header.rechnungsnummer}
              onChange={(e) =>
                setHeader((h) => ({ ...h, rechnungsnummer: e.target.value }))
              }
              placeholder="leer lassen = automatisch"
            />
          </div>
          <div className="col-span-12 md:col-span-5">
            <div className="text-xs opacity-70 mb-1">Firma</div>
            <input
              type="text"
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={firmaName}
              disabled
            />
          </div>
          <div className="col-span-12 md:col-span-2">
            <div className="text-xs opacity-70 mb-1">Fällig am</div>
            <input
              type="date"
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={header.faellig_am || ''}
              onChange={(e) =>
                setHeader((h) => ({ ...h, faellig_am: e.target.value || '' }))
              }
            />
          </div>
          <div className="col-span-12 md:col-span-2">
            <div className="text-xs opacity-70 mb-1">Rechnungsart</div>
            <select
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={rechnungsart}
              onChange={(e) => {
                const art = e.target.value;
                setRechnungsart(art);
                setPositions((prev) => applyJahresrabatt(prev, art));
              }}
            >
              <option value="monat">Monatsrechnung</option>
              <option value="jahr">Jahresrechnung (10 % Rabatt)</option>
            </select>
          </div>
        </div>

        {/* Zeile 2: Leistungszeitraum + Steuersatz */}
        <div className="grid grid-cols-12 gap-2 text-sm mb-3">
          <div className="col-span-12 md:col-span-3">
            <div className="text-xs opacity-70 mb-1">Leistungszeitraum von</div>
            <input
              type="date"
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={header.periode_von || ''}
              onChange={(e) =>
                setHeader((h) => ({ ...h, periode_von: e.target.value || '' }))
              }
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <div className="text-xs opacity-70 mb-1">Leistungszeitraum bis</div>
            <input
              type="date"
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={header.periode_bis || ''}
              onChange={(e) =>
                setHeader((h) => ({ ...h, periode_bis: e.target.value || '' }))
              }
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <div className="text-xs opacity-70 mb-1">Steuersatz (%)</div>
            <select
              className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={header.steuersatz}
              onChange={(e) =>
                setHeader((h) => ({ ...h, steuersatz: Number(e.target.value) }))
              }
            >
              <option value={0}>0 %</option>
              <option value={7}>7 %</option>
              <option value={19}>19 %</option>
            </select>
          </div>
        </div>

        {/* Summenblock */}
        <div className="grid grid-cols-12 gap-2 text-xs border-t border-gray-700 pt-2">
          <div className="col-span-12 md:col-span-8 text-gray-400">
            Jahresrechnung: 10 % Rabatt werden als eigene Position „Jahresrabatt
            10 %“ in der Liste unten geführt.
          </div>
          <div className="col-span-12 md:col-span-4 text-right space-y-0.5">
            <div>
              <span className="mr-2">Summe netto:</span>
              <span className="font-semibold">
                {summeNetto.toFixed(2)} €
              </span>
            </div>
            <div>
              <span className="mr-2">
                Steuer ({header.steuersatz || 0}%):
              </span>
              <span className="font-semibold">
                {steuerBetrag.toFixed(2)} €
              </span>
            </div>
            <div>
              <span className="mr-2">Summe brutto:</span>
              <span className="font-semibold">
                {summeBrutto.toFixed(2)} €
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* UNIT-PREISE ALS POSITION ÜBERNEHMEN */}
      <Panel
        title="Unit-Preise der Firma (als Position übernehmen)"
        right={
          <button
            onClick={() =>
              header.firma_id &&
              loadUnitsAndPositions(header.firma_id, header.id, rechnungsart)
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-600 text-xs hover:bg-gray-700"
          >
            <RotateCw size={14} />
            Neu laden
          </button>
        }
      >
        {loading && units.length === 0 ? (
          <div className="text-sm text-gray-300">Lade Units…</div>
        ) : units.length === 0 ? (
          <div className="text-sm text-gray-400">
            Für diese Firma sind keine Units hinterlegt.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full">
              <thead className="text-[11px] uppercase text-gray-400 border-b border-gray-700/60">
                <tr>
                  <th className="py-1 pr-3 text-left">Unit</th>
                  <th className="py-1 pr-3 text-right">Basis €</th>
                  <th className="py-1 pr-3 text-right">Rabatt %</th>
                  <th className="py-1 pr-3 text-right">Rabatt €</th>
                  <th className="py-1 pr-3 text-right">Effektiv €</th>
                  <th className="py-1 pr-3 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const basis = Number(u.preis_monat_basis || 0);
                  const rabattProzent = Number(u.rabatt_unit_prozent || 0);
                  const rabattFix = Number(u.rabatt_unit_fix || 0);
                  const rabattProzentBetrag = (basis * rabattProzent) / 100;
                  const netto = basis - rabattProzentBetrag - rabattFix;

                  return (
                    <tr key={u.id} className="border-b border-gray-800/60">
                      <td className="py-1 pr-3">{u.unitname}</td>
                      <td className="py-1 pr-3 text-right">
                        {basis ? basis.toFixed(2) + ' €' : '—'}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {rabattProzent ? rabattProzent.toFixed(1) + ' %' : '—'}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {rabattFix || rabattProzentBetrag
                          ? (rabattProzentBetrag + rabattFix).toFixed(2) + ' €'
                          : '—'}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {netto.toFixed(2)} €
                      </td>
                      <td className="py-1 pr-3 text-right">
                        <button
                          className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-[11px]"
                          onClick={() => uebernehmeUnitAlsPosition(u)}
                        >
                          Als Position übernehmen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-1 text-[11px] text-gray-400">
              Standard-Beschreibung: <code>Unitname – Monat MM/YYYY</code>
            </div>
          </div>
        )}
      </Panel>

      {/* RECHNUNGSPOSITIONEN */}
      <Panel
        title="Rechnungspositionen"
        right={
          <button
            onClick={addFreiePosition}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-600 text-xs hover:bg-gray-700"
          >
            <PlusCircle size={14} />
            Freie Position
          </button>
        }
      >
        <div className="overflow-x-auto text-xs">
          <table className="min-w-full">
            <thead className="text-[11px] uppercase text-gray-400 border-b border-gray-700/60">
              <tr>
                <th className="py-1 pr-2 text-left w-10">Pos</th>
                <th className="py-1 pr-2 text-left">Beschreibung</th>
                <th className="py-1 pr-2 text-right w-20">Menge</th>
                <th className="py-1 pr-2 text-left w-24">Einheit</th>
                <th className="py-1 pr-2 text-right w-24">Einzel €</th>
                <th className="py-1 pr-2 text-right w-24">Gesamt €</th>
                <th className="py-1 pr-2 text-right w-20">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, idx) => {
                const rabattPos = isJahresrabattPos(p);
                const isFree = p.id == null && !rabattPos; // freie Pos = editierbar

                return (
                  <tr key={idx} className="border-b border-gray-800/60">
                    <td className="py-1 pr-2 text-left">{idx + 1}</td>
                    <td className="py-1 pr-2">
                      {isFree ? (
                        <input
                          type="text"
                          className="w-full px-1 py-0.5 rounded bg-gray-800 border border-gray-700"
                          value={p.beschreibung || ''}
                          onChange={(e) =>
                            updateFreiePosition(idx, {
                              beschreibung: e.target.value,
                            })
                          }
                        />
                      ) : (
                        p.beschreibung
                      )}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {isFree ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-right"
                          value={p.menge}
                          onChange={(e) =>
                            updateFreiePosition(idx, { menge: e.target.value })
                          }
                        />
                      ) : (
                        p.menge
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {isFree ? (
                        <input
                          type="text"
                          className="w-full px-1 py-0.5 rounded bg-gray-800 border border-gray-700"
                          value={p.einheit || ''}
                          onChange={(e) =>
                            updateFreiePosition(idx, { einheit: e.target.value })
                          }
                        />
                      ) : (
                        p.einheit || ''
                      )}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {isFree ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-right"
                          value={p.einzelpreis}
                          onChange={(e) =>
                            updateFreiePosition(idx, {
                              einzelpreis: e.target.value,
                            })
                          }
                        />
                      ) : (
                        (p.einzelpreis != null
                          ? Number(p.einzelpreis).toFixed(2)
                          : '0.00') + ' €'
                      )}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {(p.gesamt_netto != null
                        ? Number(p.gesamt_netto).toFixed(2)
                        : '0.00') + ' €'}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <button
                        className="px-1.5 py-0.5 rounded bg-red-700/80 hover:bg-red-800 text-[11px] inline-flex items-center gap-1"
                        onClick={() => removePosition(idx)}
                      >
                        <Trash2 size={12} />
                        Entfernen
                      </button>
                    </td>
                  </tr>
                );
              })}
              {positions.length === 0 && (
                <tr>
                  <td className="py-2 text-gray-400 text-center" colSpan={7}>
                    Noch keine Positionen. Du kannst oben Unit-Preise übernehmen oder
                    eine freie Position anlegen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-[11px] text-gray-400">
          Jahresrechnung: Der 10 %-Rabatt wird automatisch als eigene Position
          geführt und in die Summen eingerechnet. Weitere Rabatte kannst du über
          freie Positionen (z. B. „Sonderrabatt“) abbilden.
        </div>
      </Panel>
    </div>
  );
}
