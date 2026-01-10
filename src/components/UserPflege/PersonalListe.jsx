'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const SortIcon = ({ aktiv, richtung }) => {
  if (!aktiv) return <span className="opacity-20">↕</span>;
  return richtung === 'asc' ? <span>▲</span> : <span>▼</span>;
};

const Personalliste = ({ onUserClick, refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle: eigeneRolle } = useRollen();
  const isSuperAdmin = eigeneRolle === 'SuperAdmin';
  const canCsvDownload = ['SuperAdmin', 'Admin_Dev', 'Planner'].includes(eigeneRolle);
  const canCsvUpload   = ['SuperAdmin', 'Admin_Dev'].includes(eigeneRolle);

  const [personen, setPersonen] = useState([]);
  const [suche, setSuche] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [sortierung, setSortierung] = useState({ feld: 'name', richtung: 'asc' });
  const [csvInfo, setCsvInfo] = useState(null); // { type: 'success'|'error'|'info', text: string }
  const fileRef = React.useRef(null);
  const [filterTeam, setFilterTeam] = useState('alle');
  const [filterRolle, setFilterRolle] = useState('alle');
  const [filterWochenstunden, setFilterWochenstunden] = useState(''); // Text

  const handleSortierung = (feld) => {
    setSortierung((aktuell) =>
      aktuell.feld === feld
        ? { feld, richtung: aktuell.richtung === 'asc' ? 'desc' : 'asc' }
        : { feld, richtung: 'asc' }
    );
  };
const safeCsv = (v, forceText = false) => {
  const s = (v ?? '').toString();

  if (forceText && s !== '') {
    // Excel-Text-Formel: ="01234"
    const esc = s.replaceAll('"', '""');
    return `="${esc}"`;
  }

  if (/[",;\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
};


const downloadTelefonCSV = async () => {
  try {
    setCsvInfo({ type: 'info', text: 'CSV wird erstellt…' });

    // Wir nehmen die aktuell geladenen "personen" (aktive & korrekt gefiltert nach Firma/Unit, wenn kein SuperAdmin)
    const rows = (personen || []).map((p) => ({
      user_id: p.user_id,
      vorname: (p.name || '').split(' ').slice(0, -1).join(' ') || '', // falls du es sauber willst: beim Laden vorname/nachname extra speichern (siehe Hinweis unten)
      nachname: (p.name || '').split(' ').slice(-1).join(' ') || '',
      tel_number1: '', // wird gleich aus DB_User nachgeladen
      tel_number2: '',
    }));

    // Besser: direkt DB_User neu holen inkl. Tel (dann ist es 100% korrekt)
    const ids = (personen || []).map((p) => p.user_id);
    if (ids.length === 0) {
      setCsvInfo({ type: 'error', text: 'Keine Personen vorhanden.' });
      return;
    }

    let q = supabase
      .from('DB_User')
      .select('user_id, vorname, nachname, tel_number1, tel_number2, firma_id, unit_id')
      .in('user_id', ids);

    // Sicherheit: Nicht-SuperAdmin darf nur eigene Firma/Unit exportieren
    if (!isSuperAdmin) q = q.eq('firma_id', firma).eq('unit_id', unit);

    const { data, error } = await q;
    if (error) throw error;

    const header = ['user_id', 'vorname', 'nachname', 'tel_number1', 'tel_number2'];

    const lines = [
  header.join(';'),
  ...(data || []).map((r) =>
    [
      safeCsv(r.user_id),
      safeCsv(r.vorname),
      safeCsv(r.nachname),
      safeCsv(r.tel_number1, true), // 👈 als Text erzwingen
      safeCsv(r.tel_number2, true), // 👈 als Text erzwingen
    ].join(';')
  ),
].join('\n');

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `schichtpilot_mitarbeiter_telefonliste_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    setCsvInfo({ type: 'success', text: 'CSV heruntergeladen.' });
  } catch (e) {
    console.error(e);
    setCsvInfo({ type: 'error', text: 'CSV-Download fehlgeschlagen.' });
  }
};

const detectDelimiter = (text) => {
  const firstLine = (text.split(/\r?\n/)[0] || '');
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi >= comma ? ';' : ',';
};

// sehr simples CSV-Parsing (reicht für deine Telefonliste)
const parseCsvSimple = (text) => {
  const delim = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { header: [], rows: [] };

  const splitLine = (line) => {
    // minimaler CSV-Parser: unterstützt Quotes
    const out = [];
    let cur = '';
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // escaped ""
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
        inQ = !inQ;
        continue;
      }
      if (!inQ && ch === delim) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const header = splitLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => {
    const cols = splitLine(l);
    const obj = {};
    header.forEach((h, idx) => (obj[h] = cols[idx] ?? ''));
    return obj;
  });

  return { header, rows };
};

const normalizePhone = (v) => {
  let s = (v ?? '').toString().trim();

  // CSV Parser kann aus ="0171" -> =0171 machen (Quotes weg)
  if (s.startsWith('=')) s = s.slice(1).trim();

  // falls jetzt "0171..." übrig bleibt (oder noch Quotes drum sind)
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);

  // Excel-Text-Formel ORIGINAL (falls Quotes doch erhalten bleiben)
  if (s.startsWith('="') && s.endsWith('"')) s = s.slice(2, -1);

  // Excel Apostroph: '0171... -> 0171...
  if (s.startsWith("'")) s = s.slice(1);

  // doppelte Quotes wieder zurück
  s = s.replaceAll('""', '"');

  // Sonder-Leerzeichen/Tabs -> normales Leerzeichen
  s = s.replace(/[\u00A0\t]/g, ' ').trim();

  return s;
};


const phoneOk = (s) => {
  const v = (s || '').trim();
  if (!v) return true; // leer ok
  return /^[+0-9 ()/.-]{6,25}$/.test(v);
};

const uploadTelefonCSV = async (file) => {
  if (!file) return;

  try {
    setCsvInfo({ type: 'info', text: 'CSV wird geprüft…' });

    const text = await file.text();
    const { header, rows } = parseCsvSimple(text);

    // Header akzeptieren (tel_ oder tele_)
    const hasUserId = header.includes('user_id');
    const col1 = header.includes('tel_number1') ? 'tel_number1' : header.includes('tele_number1') ? 'tele_number1' : null;
    const col2 = header.includes('tel_number2') ? 'tel_number2' : header.includes('tele_number2') ? 'tele_number2' : null;

    if (!hasUserId || !col1 || !col2) {
      setCsvInfo({
        type: 'error',
        text: 'CSV-Header falsch. Benötigt: user_id, tel_number1 (oder tele_number1), tel_number2 (oder tele_number2).',
      });
      return;
    }

    // Filter: nur IDs, die in der aktuellen Liste vorhanden sind (Sicherheitsnetz)
    const allowedIds = new Set((personen || []).map((p) => String(p.user_id)));

    const updates = rows
      .map((r) => {
        const id = (r.user_id || '').trim();
        if (!id || !allowedIds.has(String(id))) return null;

        const t1 = normalizePhone(r[col1]);
        const t2 = normalizePhone(r[col2]);

        if (!phoneOk(t1) || !phoneOk(t2)) return { bad: true, id, t1, t2 };

        return {
          user_id: id,
          tel_number1: t1 || null,
          tel_number2: t2 || null,
        };
      })
      .filter(Boolean);

    const bad = updates.filter((u) => u.bad);
if (bad.length > 0) {
  console.warn('Ungültige Telefonwerte (erste 10):', bad.slice(0, 10));
  setCsvInfo({
    type: 'error',
    text: `Ungültige Telefonnummern in ${bad.length} Zeilen. Erlaubt: Ziffern, +, Leerzeichen, ()-/.`,
  });
  return;
}

    if (updates.length === 0) {
      setCsvInfo({ type: 'error', text: 'Keine gültigen Updates gefunden (IDs müssen in der aktuellen Mitarbeiterliste sein).' });
      return;
    }

    setCsvInfo({ type: 'info', text: `Update läuft… (${updates.length} Datensätze)` });

// Chunked Updates (Supabase update pro User) – robust mit Error-Report
const chunkSize = 50;
let ok = 0;
const failed = []; // [{ user_id, message }]

for (let i = 0; i < updates.length; i += chunkSize) {
  const chunk = updates.slice(i, i + chunkSize);

  const results = await Promise.all(
    chunk.map(async (u) => {
      let q = supabase
        .from('DB_User')
        .update({ tel_number1: u.tel_number1, tel_number2: u.tel_number2 })
        .eq('user_id', u.user_id);

      if (!isSuperAdmin) q = q.eq('firma_id', firma).eq('unit_id', unit);

      const res = await q;
if (res?.error) {
  failed.push({ user_id: u.user_id, message: res.error.message || res.error.details || 'Unbekannter Fehler' });
} else {
  ok += 1;
}
      return res;
    })
  );
}

// Ergebnis melden
if (failed.length > 0) {
  console.warn('CSV Upload: fehlgeschlagen für', failed);
  setCsvInfo({
    type: 'error',
    text: `Update teilweise erfolgreich: ${ok} ok, ${failed.length} abgelehnt. (Console zeigt user_ids + Grund)`,
  });
} else {
  setCsvInfo({ type: 'success', text: `Telefonliste aktualisiert: ${ok} Datensätze.` });
}


    // optional: Liste neu laden
    // -> easiest: trigger über refreshKey vom Parent oder local state
    // wenn du hier kein refresh trigger hast: einfach window.location.reload() vermeiden.
    // Du kannst stattdessen refreshKey im Parent erhöhen.
  } catch (e) {
    console.error(e);
    setCsvInfo({ type: 'error', text: 'CSV-Upload fehlgeschlagen.' });
  } finally {
    if (fileRef.current) fileRef.current.value = '';
  }
};

  useEffect(() => {
    const ladeDaten = async () => {
      if (!isSuperAdmin && (!firma || !unit)) {
        setPersonen([]);
        return;
      }

      // 1) Mitarbeitende laden  (✅ aktiv mit selektieren!)
      let mitarbeiterRes = supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle, aktiv, firma_id, unit_id');

      if (!isSuperAdmin) {
        mitarbeiterRes = mitarbeiterRes.eq('firma_id', firma).eq('unit_id', unit);
      }

      const { data: mitarbeiter, error: errUser } = await mitarbeiterRes;
      if (errUser) {
        console.error('Fehler beim Laden der Mitarbeitenden:', errUser);
        setPersonen([]);
        return;
      }

      const aktive = (mitarbeiter || []).filter((m) => m.aktiv !== false);
      const userIds = aktive.map((m) => m.user_id);
      if (userIds.length === 0) {
        setPersonen([]);
        return;
      }

      const heute = new Date().toISOString().slice(0, 10);

      // 2) HEUTE gültige Qualifikationen
      const { data: qualiRaw, error: errQuali } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali, quali_start, quali_endet')
        .in('user_id', userIds);

      if (errQuali) console.error('Fehler beim Laden der Qualifikationen:', errQuali);

      const qualiHeute = (qualiRaw || []).filter((q) => {
        const s = q.quali_start ? String(q.quali_start).slice(0, 10) : null;
        const e = q.quali_endet ? String(q.quali_endet).slice(0, 10) : null;
        const startOk = !s || s <= heute;
        const endeOk = !e || e >= heute;
        return startOk && endeOk;
      });

      // 3) Matrix (Position/Bezeichnung) nur für benutzte Quali-IDs
      const qualiIds = Array.from(new Set(qualiHeute.map((q) => q.quali)));
      let matrixById = new Map();
      if (qualiIds.length > 0) {
        let matrixRes = supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, position')
          .in('id', qualiIds);

        if (!isSuperAdmin) matrixRes = matrixRes.eq('firma_id', firma).eq('unit_id', unit);

        const { data: matrix, error: errMatrix } = await matrixRes;
        if (errMatrix) {
          console.error('Fehler beim Laden der Qualifikationsmatrix:', errMatrix);
        } else {
          matrixById = new Map(
            (matrix || []).map((m) => [
              m.id,
              { qualifikation: m.qualifikation, position: Number(m.position) || 999 },
            ])
          );
        }
      }

      // 4) Team-Zuweisung für HEUTE
      const { data: zuwRaw, error: errZuw } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, von_datum, bis_datum, firma_id, unit_id')
        .in('user_id', userIds)
        .lte('von_datum', heute);

      if (errZuw) console.error('Fehler beim Laden der Zuweisungen:', errZuw);

      const zuwByUser = new Map(); // user_id -> { schichtgruppe, von_datum }
      (aktive || []).forEach((u) => {
        const rows = (zuwRaw || []).filter(
          (z) =>
            z.user_id === u.user_id &&
            z.firma_id === u.firma_id &&
            z.unit_id === u.unit_id &&
            (!z.bis_datum || z.bis_datum >= heute)
        );
        if (rows.length > 0) {
          const last = rows.reduce(
            (acc, curr) => (!acc || curr.von_datum > acc.von_datum ? curr : acc),
            null
          );
          if (last) zuwByUser.set(u.user_id, { schichtgruppe: last.schichtgruppe, von_datum: last.von_datum });
        }
      });

      // ✅ 4b) Wochenarbeitszeit (heute gültiger Eintrag: letzter gueltig_ab <= heute)
      const { data: waRaw, error: errWA } = await supabase
        .from('DB_WochenArbeitsZeit')
        .select('user_id, gueltig_ab, wochenstunden, firma_id, unit_id')
        .in('user_id', userIds)
        .lte('gueltig_ab', heute);

      if (errWA) console.error('Fehler beim Laden der Wochenarbeitszeit:', errWA);

      const waByUser = new Map(); // user_id -> wochenstunden
      (aktive || []).forEach((u) => {
        const rows = (waRaw || []).filter(
          (w) =>
            w.user_id === u.user_id &&
            w.firma_id === u.firma_id &&
            w.unit_id === u.unit_id
        );
        if (rows.length > 0) {
          const last = rows.reduce(
            (acc, curr) => (!acc || curr.gueltig_ab > acc.gueltig_ab ? curr : acc),
            null
          );
          if (last) waByUser.set(u.user_id, Number(last.wochenstunden));
        }
      });

      // 5) Aggregieren: höchste (positionsbeste) heute gültige Quali + Team + Wochenstunden
      const qualisByUser = new Map();
      qualiHeute.forEach((q) => {
        const arr = qualisByUser.get(q.user_id) || [];
        arr.push(q);
        qualisByUser.set(q.user_id, arr);
      });

      const personenMitDaten = aktive.map((person) => {
        let besteBezeichnung = '–';
        let bestePos = 999;

        const eigene = qualisByUser.get(person.user_id) || [];
        eigene.forEach((q) => {
          const m = matrixById.get(q.quali);
          if (m?.qualifikation && m.position < bestePos) {
            bestePos = m.position;
            besteBezeichnung = m.qualifikation;
          }
        });

        const zuw = zuwByUser.get(person.user_id);
        const aktuelleSchichtgruppe = zuw?.schichtgruppe ?? '–';

        const wochenstunden = waByUser.get(person.user_id);

        return {
          user_id: person.user_id,
          name: `${person.vorname} ${person.nachname}`,
          rolle: person.rolle,
          schichtgruppe: aktuelleSchichtgruppe,
          hoechste_quali: besteBezeichnung,
          wochenstunden: wochenstunden ?? null,
          firma_id: person.firma_id,
          unit_id: person.unit_id,
        };
      });

      setPersonen(personenMitDaten);
    };

    ladeDaten();
  }, [firma, unit, refreshKey, isSuperAdmin]);

  // ✅ Dropdown-Optionen
  const teamOptions = useMemo(() => {
    return Array.from(new Set((personen || []).map((p) => p.schichtgruppe).filter((v) => v && v !== '–')))
      .sort((a, b) => String(a).localeCompare(String(b), 'de'));
  }, [personen]);

  const rollenOptions = useMemo(() => {
    return Array.from(new Set((personen || []).map((p) => p.rolle).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), 'de'));
  }, [personen]);

  // ✅ Suche + Filter + Sort
  const gefiltertePersonen = useMemo(() => {
    const s = (suche || '').toLowerCase().trim();

    // Wochenstunden-Filter: wenn Eingabe da, muss sie Zahl sein
    const rawWs = (filterWochenstunden || '').trim();
    const wsNum = rawWs === '' ? null : Number(rawWs.replace(',', '.'));
    const wsInvalid = rawWs !== '' && Number.isNaN(wsNum);

    // ❗ Ungültig => alles leer
    if (wsInvalid) return [];

    const arr = (personen || []).filter((p) => {
      if (s && !p.name?.toLowerCase().includes(s)) return false;
      if (filterTeam !== 'alle' && p.schichtgruppe !== filterTeam) return false;
      if (filterRolle !== 'alle' && p.rolle !== filterRolle) return false;

      if (wsNum != null) {
        const v = p.wochenstunden;
        if (v == null) return false;
        if (Number(v) !== wsNum) return false; // exakter Match
      }

      return true;
    });

    const { feld, richtung } = sortierung;
    const dir = richtung === 'asc' ? 1 : -1;

    return [...arr].sort((a, b) => {
      if (feld === 'wochenstunden') {
        const av = a.wochenstunden ?? -999999;
        const bv = b.wochenstunden ?? -999999;
        return (av - bv) * dir;
      }

      const aWert =
        feld === 'name'
          ? a.name.split(' ').slice(-1)[0].toLowerCase()
          : (a[feld] || '').toString().toLowerCase();

      const bWert =
        feld === 'name'
          ? b.name.split(' ').slice(-1)[0].toLowerCase()
          : (b[feld] || '').toString().toLowerCase();

      if (aWert < bWert) return -1 * dir;
      if (aWert > bWert) return 1 * dir;
      return 0;
    });
  }, [personen, suche, sortierung, filterTeam, filterRolle, filterWochenstunden]);

  return (
    <div className="p-4 shadow-xl rounded-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2 gap-2">
  <h2 className="text-md font-bold">Mitarbeiterliste{isSuperAdmin ? ' (alle Firmen)' : ''}</h2>
  <div className="flex items-center gap-2">
  {canCsvDownload && (
    <button type="button" onClick={downloadTelefonCSV} className="px-3 py-1 rounded ...">
      CSV Download
    </button>
  )}

  {canCsvUpload && (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => uploadTelefonCSV(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
      >
        CSV Upload
      </button>
    </>
  )}

    <Info
      className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
      onClick={() => setInfoOffen(true)}
    />
  </div>
</div>
{csvInfo && (
  <div
    className={`mb-3 text-sm rounded-lg px-3 py-2 border ${
      csvInfo.type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
        : csvInfo.type === 'error'
        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
        : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
    }`}
  >
    {csvInfo.text}
  </div>
)}


      {/* Suche */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="🔍 Namen suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-full bg-gray-200 dark:bg-gray-800"
        />
      </div>

      {/* ✅ Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-full bg-gray-200 dark:bg-gray-800"
        >
          <option value="alle">Alle Teams</option>
          {teamOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={filterRolle}
          onChange={(e) => setFilterRolle(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-full bg-gray-200 dark:bg-gray-800"
        >
          <option value="alle">Alle Rollen</option>
          {rollenOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <input
          value={filterWochenstunden}
          onChange={(e) => setFilterWochenstunden(e.target.value)}
          placeholder="Wochenstunden (z.B. 37,5)"
          className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-full bg-gray-200 dark:bg-gray-800"
        />
      </div>

      {/* Tabelle */}
      <div className="overflow-auto max-h-[100vh]">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-300 dark:bg-gray-700">
            <tr>
              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('name')}>
                <div className="flex items-center gap-1">
                  Name
                  <SortIcon aktiv={sortierung.feld === 'name'} richtung={sortierung.richtung} />
                </div>
              </th>

              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('rolle')}>
                <div className="flex items-center gap-1">
                  Rolle
                  <SortIcon aktiv={sortierung.feld === 'rolle'} richtung={sortierung.richtung} />
                </div>
              </th>

              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('schichtgruppe')}>
                <div className="flex items-center gap-1">
                  Team
                  <SortIcon aktiv={sortierung.feld === 'schichtgruppe'} richtung={sortierung.richtung} />
                </div>
              </th>

              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('hoechste_quali')}>
                <div className="flex items-center gap-1">
                  Qualifikation
                  <SortIcon aktiv={sortierung.feld === 'hoechste_quali'} richtung={sortierung.richtung} />
                </div>
              </th>

              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('wochenstunden')}>
                <div className="flex items-center justify-end gap-1">
                  WAZ in (h)
                  <SortIcon aktiv={sortierung.feld === 'wochenstunden'} richtung={sortierung.richtung} />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {gefiltertePersonen.map((p) => (
              <tr
                key={p.user_id}
                className="cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700"
                onClick={() => onUserClick?.(p)}
              >
                <td className="py-2 px-2">{p.name}</td>
                <td className="px-2 text-xs">{p.rolle}</td>
                <td className="px-2 text-xs">{p.schichtgruppe}</td>
                <td className="px-2 text-xs">{p.hoechste_quali}</td>
                <td className="px-2 text-xs text-center">
                  {p.wochenstunden == null ? '–' : String(p.wochenstunden).replace('.', ',')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {gefiltertePersonen.length === 0 && (
          <p className="text-sm mt-2">
            Keine Ergebnisse gefunden.
          </p>
        )}
      </div>

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2">Informationen</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Nur aktive User werden angezeigt.</li>
              <li>Als <strong>SuperAdmin</strong> siehst du alle Firmen & Units.</li>
              <li>Qualifikationen zählen nur, wenn sie <b>heute</b> gültig sind (Start ≤ heute, Ende leer/≥ heute).</li>
              <li>Team wird aus <strong>DB_SchichtZuweisung</strong> (gültig heute) ermittelt.</li>
              <li>Wochenstunden kommen aus <strong>DB_WochenArbeitsZeit</strong>: letzter Eintrag mit <code>gueltig_ab ≤ heute</code>.</li>
              <li>Filter „Wochenstunden“: ungültige Eingabe (z.B. Buchstaben) ⇒ Liste bleibt leer.</li>
            </ul>

            <div className="mt-4 text-right">
              <button
                onClick={() => setInfoOffen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personalliste;
