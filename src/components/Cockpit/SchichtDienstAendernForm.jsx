import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react'; 
import { berechneUndSpeichereStunden, berechneUndSpeichereUrlaub } from '../../utils/berechnungen';

dayjs.extend(duration);

const SchichtDienstAendernForm = ({ offen, onClose, eintrag, aktualisieren, reloadListe, onRefresh, onRefreshMitarbeiterBedarf }) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();  // ⬅️ Rolle ergänzt
  const [schichtarten, setSchichtarten] = useState([]);
  const [auswahl, setAuswahl] = useState({ kuerzel: '', start: '', ende: '', ignoriertarbeitszeit: false });
  const [sollKuerzel, setSollKuerzel] = useState('');
  const [kommentar, setKommentar] = useState('');
  const [erstellerName, setErstellerName] = useState('Unbekannt');
  const [saveMessage, setSaveMessage] = useState('');
  const [mehrereTage, setMehrereTage] = useState(false);
  const [tageAnzahl, setTageAnzahl] = useState(1);
  const [enddatum, setEnddatum] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [verlaufDaten, setVerlaufDaten] = useState([]);
  const [loading, setLoading] = useState(false); 

  useEffect(() => {
    const ladeSchichtarten = async () => {
      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('*')
        .eq('firma_id', firma)
        .eq('unit_id', unit);
      if (error) console.error(error);
      else {
        const sortiert = data.sort((a, b) => {
          if (a.sollplan_relevant && !b.sollplan_relevant) return -1;
          if (!a.sollplan_relevant && b.sollplan_relevant) return 1;
          return a.kuerzel.localeCompare(b.kuerzel);
        });
        setSchichtarten(sortiert);
      }
    };

    if (offen) ladeSchichtarten();
  }, [offen, firma, unit]);

  useEffect(() => {
    if (eintrag && schichtarten.length > 0) {
      const schicht = schichtarten.find(s => s.kuerzel === eintrag.ist_schicht);
      const ignoriert = schicht?.ignoriert_arbeitszeit || false;
      setMehrereTage(false);
      setEnddatum('');
      setAuswahl({
        kuerzel: eintrag.ist_schicht || '',
        start: eintrag.beginn || '06:00',
        ende: eintrag.ende || '14:00',
        ignoriertarbeitszeit: ignoriert
      });
      const holeSollSchicht = async () => {
        const { data: sollEintrag, error } = await supabase
          .from('DB_Kampfliste')
          .select('soll_schicht')
          .eq('user', eintrag.user)
          .eq('datum', eintrag.datum)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .maybeSingle();

        if (error) {
          console.warn('⚠️ Konnte Soll-Schicht nicht laden:', error.message);
          setSollKuerzel('-');
        } else {
          setSollKuerzel(sollEintrag?.soll_schicht || '-');
        }
      };
      holeSollSchicht();
      setKommentar(eintrag.kommentar || '');
    }
  }, [eintrag, schichtarten]);

  const handleSchichtwahl = (kuerzel, start, ende, ignoriertArbeitszeit) => {
    setAuswahl(prev => ({
      ...prev,
      kuerzel,
      ignoriertarbeitszeit: ignoriertArbeitszeit,
      ...(ignoriertArbeitszeit ? {} : { start, ende })
    }));
  };

  const berechneDauer = () => {
    const start = dayjs(`2024-01-01T${auswahl.start}`);
    const ende = dayjs(`2024-01-01T${auswahl.ende}`);
    const diff = ende.diff(start, 'minute');
    const stunden = diff < 0 ? (1440 + diff) / 60 : diff / 60;
    return stunden;
  };

  const dauer = berechneDauer();
  let dauerFarbe = 'bg-green-700';
  let hinweistext = '';
  if (dauer >= 12) {
    dauerFarbe = 'bg-red-700';
    hinweistext = 'Betriebsleitung und Betriebsrat sind zu informieren.';
  } else if (dauer >= 10) {
    dauerFarbe = 'bg-orange-600';
    hinweistext = 'Max. 10 h nach §3 ArbZG, Ausnahme: §7';
  }

  // ⬇️ SPERR-LOGIK: Datum vs. Rolle (Team_Leader > 3 Tage alt gesperrt, Planner > 365 Tage alt gesperrt)
  const diffTage = eintrag ? dayjs().startOf('day').diff(dayjs(eintrag.datum), 'day') : 0;
const speichernGesperrt =
  (rolle === 'Team_Leader' && diffTage > 3) ||
  ((rolle === 'Planner' || rolle === 'Admin_Dev') && diffTage > 365);
  
  const handleSpeichern = async (schliessenDanach = false) => {
    // Sicherheitsnetz: Falls Button doch klickbar war, hier hart abbrechen
    if (speichernGesperrt) return;

    setLoading(true);

    // Firma und Unit fixieren (SnapShot)
    const aktuelleFirma = firma;
    const aktuelleUnit = unit;

    const schichtDef = schichtarten.find(s => s.kuerzel === auswahl.kuerzel);
    const now = new Date().toISOString();
    const { data: authUser } = await supabase.auth.getUser();
    const createdBy = authUser?.user?.id;

    if (!createdBy) {
      console.error('❌ Kein eingeloggter Benutzer gefunden!');
      setLoading(false);
      return;
    }

    const startDatum = dayjs(eintrag.datum);
    const endDatum = (mehrereTage && enddatum) ? dayjs(enddatum) : startDatum;

    for (let datum = startDatum; datum.isSameOrBefore(endDatum); datum = datum.add(1, 'day')) {
      const datumStr = datum.format('YYYY-MM-DD');
      let aktuelleStart = auswahl.start;
      let aktuelleEnde = auswahl.ende;

      const { data: sollEintrag } = await supabase
        .from('DB_Kampfliste')
        .select('soll_schicht, startzeit_ist, endzeit_ist, dauer_soll, dauer_ist')
        .eq('user', eintrag.user)
        .eq('datum', datumStr)
        .eq('firma_id', aktuelleFirma)
        .eq('unit_id', aktuelleUnit)
        .maybeSingle();

      const soll = sollEintrag?.soll_schicht;
      const dauerSoll = sollEintrag?.dauer_soll || null;

      if ((soll === null || soll === '-') && auswahl.kuerzel === 'U') {
        console.log(`⏩ ${datumStr} wird übersprungen (Frei-Tag & Kürzel = U)`);
        continue;
      }

      if (schichtDef?.ignoriert_arbeitszeit) {
        aktuelleStart = sollEintrag?.startzeit_ist ?? null;
        aktuelleEnde = sollEintrag?.endzeit_ist ?? null;
      }

      const startZeit = dayjs(`2024-01-01T${aktuelleStart}`);
      let endeZeit = dayjs(`2024-01-01T${aktuelleEnde}`);
      if (endeZeit.isBefore(startZeit)) {
        endeZeit = endeZeit.add(1, 'day');
      }
      const aktuelleDauer = aktuelleStart && aktuelleEnde
        ? dayjs.duration(endeZeit.diff(startZeit)).asHours()
        : null;

      const alterDauerIst = sollEintrag?.dauer_ist || null;
      const jahr = datum.year();
      const neuerMonat = datum.month() + 1;

      if (alterDauerIst !== aktuelleDauer) {
        await berechneUndSpeichereStunden(eintrag.user, jahr, neuerMonat, aktuelleFirma, aktuelleUnit);
      }

      await supabase
        .from('DB_Kampfliste')
        .delete()
        .eq('user', eintrag.user)
        .eq('datum', datumStr)
        .eq('firma_id', aktuelleFirma)
        .eq('unit_id', aktuelleUnit);

      await supabase.from('DB_Kampfliste').insert({
        user: eintrag.user,
        datum: datumStr,
        firma_id: aktuelleFirma,
        unit_id: aktuelleUnit,
        soll_schicht: soll,
        ist_schicht: schichtDef?.id,
        startzeit_ist: aktuelleStart,
        endzeit_ist: aktuelleEnde,
        dauer_ist: aktuelleDauer,
        dauer_soll: dauerSoll,
        aenderung: (['U', 'K', 'KO'].includes(auswahl.kuerzel))
          ? false
          : !(schichtDef?.startzeit === aktuelleStart && schichtDef?.endzeit === aktuelleEnde),
        created_at: now,
        created_by: createdBy,
        schichtgruppe: eintrag.schichtgruppe,
        kommentar
      });

      if (auswahl.kuerzel === 'U' || eintrag.ist_schicht === 'U') {
        await berechneUndSpeichereUrlaub(eintrag.user, jahr, aktuelleFirma, aktuelleUnit);
      }

      await supabase.from('DB_KampflisteVerlauf').insert({
        user: eintrag.user,
        datum: datumStr,
        firma_id: aktuelleFirma,
        unit_id: aktuelleUnit,
        ist_schicht: schichtDef?.id || null,
        soll_schicht: soll,
        startzeit_ist: aktuelleStart,
        endzeit_ist: aktuelleEnde,
        dauer_ist: aktuelleDauer,
        dauer_soll: dauerSoll,
        kommentar,
        change_on: now,
        created_by: createdBy,
        created_at: eintrag.created_at || now,
        schichtgruppe: eintrag.schichtgruppe
      });
    }

    setSaveMessage(`${startDatum.format('DD.MM.YYYY')} Erfolgreich gespeichert`);
    setTimeout(() => setSaveMessage(''), 1500);
    setKommentar('');
    aktualisieren?.(eintrag.datum, eintrag.user);
    if (reloadListe) reloadListe();
    if (onRefreshMitarbeiterBedarf) onRefreshMitarbeiterBedarf();
    if (schliessenDanach) onClose();
    setLoading(false);
  };

  const ladeVerlauf = async () => {
    const { data, error } = await supabase
      .from('DB_KampflisteVerlauf')
      .select(`
        id,
        datum,
        ist_schicht,
        soll_schicht,
        startzeit_ist,
        endzeit_ist,
        kommentar,
        change_on,
        created_by,
        ist_schicht_rel:ist_schicht (kuerzel),
        user_rel:created_by (user_id, vorname, nachname)
      `)
      .eq('user', eintrag.user)
      .eq('datum', eintrag.datum)
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .order('change_on', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Fehler beim Laden des Verlaufs:', error);
      return;
    }
    setVerlaufDaten(data || []);
    setVerlaufOffen(true);
  };

  if (!offen || !eintrag) return null;
  const farbeAktuelleSchicht = schichtarten.find(s => s.kuerzel === auswahl.kuerzel);

  const ladeNeuenTag = (richtung) => {
    const neuesDatum = dayjs(eintrag.datum)[richtung](1, 'day').format('YYYY-MM-DD');
    aktualisieren(neuesDatum, eintrag.user);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white text-gray-800 dark:bg-gray-900 dark:text-white border border-gray-500 p-6 rounded-xl w-[700px] shadow-lg relative">
        <button
          onClick={() => setInfoOffen(true)}
          className="absolute top-2 right-2 text-blue-500 hover:text-blue-700"
          title="Infos zum Modul"
        >
          <Info size={22} />
        </button>
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Dienst ändern – {eintrag.name}</h2>
          {saveMessage && (
            <div className="text-green-600 text-left text-xs font-medium">
              ✅ {saveMessage}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => ladeNeuenTag('subtract')}
                className="text-xl hover:text-blue-500"
                title="Einen Tag zurück"
              >
                ←
              </button>
              <h2 className="text-lg font-bold">{dayjs(eintrag.datum).format('DD.MM.YYYY')}</h2>
              <button
                onClick={() => ladeNeuenTag('add')}
                className="text-xl hover:text-blue-500"
                title="Einen Tag vor"
              >
                →
              </button>
            </div>
            {mehrereTage && (
              <input
                type="date"
                value={enddatum}
                onChange={e => setEnddatum(e.target.value)}
                min={eintrag.datum}
                className="ml-4 p-1 rounded bg-gray-100 dark:bg-gray-700 text-center text-sm"
              />
            )}
            <label className="flex items-center gap-1 text-sm ml-4">
              <input
                type="checkbox"
                checked={mehrereTage}
                onChange={() => {
                  const aktiviert = !mehrereTage;
                  setMehrereTage(aktiviert);
                  if (aktiviert && eintrag?.datum) {
                    const folgetag = dayjs(eintrag.datum).add(1, 'day').format('YYYY-MM-DD');
                    setEnddatum(folgetag);
                  }
                }}
              />
              Über mehrere Tage
            </label>
          </div>
          <div className="flex gap-80 items-center">
            <div className="text-sm text-center">
              <div>Ist-Schicht:</div>
              <div
                className="text-lg font-bold"
                style={{
                  color: farbeAktuelleSchicht?.farbe_text,
                  backgroundColor: farbeAktuelleSchicht?.farbe_bg,
                  padding: '4px 8px',
                  borderRadius: '8px'
                }}
              >
                {auswahl.kuerzel}
              </div>
            </div>
            <div className="text-sm text-center text-gray-400">
              <div>Soll-Schicht:</div>
              <div className="text-sm font-semibold">{sollKuerzel}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-2 items-end">
          <div>
            <label className="block mb-1">Beginn</label>
            <input
              type="time"
              value={auswahl.start}
              onChange={e => setAuswahl({ ...auswahl, start: e.target.value })}
              disabled={auswahl.ignoriertarbeitszeit}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            />
          </div>
          <div>
            <label className="block mb-1">Ende</label>
            <input
              type="time"
              value={auswahl.ende}
              onChange={e => setAuswahl({ ...auswahl, ende: e.target.value })}
              disabled={auswahl.ignoriertarbeitszeit}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            />
          </div>
          <div>
            <label className="block mb-1">Dauer</label>
            <div className={`p-2 rounded text-center text-white ${dauerFarbe}`}>{dauer.toFixed(1)} h</div>
          </div>
        </div>
        <div className="text-right text-sm text-yellow-500 mb-3 min-h-[1.5rem]">{hinweistext}</div>
        <div className="mb-3">
          <label className="block mb-2 text-sm">Schichtart wählen</label>
          <div className="grid grid-cols-4 gap-2">
            {schichtarten.map((s) => (
              <div
                key={s.id}
                className={`rounded p-2 cursor-pointer border text-sm flex justify-between items-center text-center ${auswahl.kuerzel === s.kuerzel ? 'ring-2 ring-white' : ''}`}
                style={{ backgroundColor: s.farbe_bg, color: s.farbe_text }}
                onClick={() => handleSchichtwahl(s.kuerzel, s.startzeit, s.endzeit, s.ignoriert_arbeitszeit)}
                title={s.beschreibung}
              >
                <span className="font-semibold mr-1">{s.kuerzel}</span>
                <span className="text-xs">{s.startzeit} - {s.endzeit}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block mb-1">Kommentar (optional)</label>
          <textarea
            maxLength={150}
            rows={2}
            value={kommentar}
            onChange={e => setKommentar(e.target.value)}
            className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            placeholder="Kommentar max. 150 Zeichen"
          />
        </div>
        <div className="flex justify-between items-start mt-6 gap-3 text-sm text-gray-500 dark:text-gray-400">
          <div>
            <p><strong>Erstellt am:</strong> {eintrag.created_at ? dayjs(eintrag.created_at).format('DD.MM.YYYY HH:mm') : 'Unbekannt'}</p>
            <button
              onClick={ladeVerlauf}
              className="text-xs underline text-blue-400 hover:text-blue-200 mt-1"
            >
              Änderungsverlauf anzeigen
            </button>
          </div>

          <div className="flex gap-3 mt-1 items-center">
            {loading && (
              <div className="w-5 h-5 border-2 border-t-transparent border-blue-400 rounded-full animate-spin"></div>
            )}
            <button
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition"
              disabled={loading}
            >
              Schließen
            </button>
            <button
              onClick={() => handleSpeichern(false)}
              disabled={loading || speichernGesperrt}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition ${(loading || speichernGesperrt) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Speichern
            </button>
            <button
              onClick={() => handleSpeichern(true)}
              disabled={loading || speichernGesperrt}
              className={`bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded transition ${(loading || speichernGesperrt) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Speichern & Schließen
            </button>
          </div>
        </div>
      </div>

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl p-6 w-[500px] relative">
            <h2 className="text-lg font-bold mb-3">Infos zu diesem Modul</h2>
            <ul className="text-sm list-disc pl-5 space-y-2">
              <li>Du kannst einzelne Dienste für Mitarbeiter ändern.</li>
              <li>Schichtzeiten und Schichtarten sind anpassbar.</li>
              <li>Die Dauer der Schicht wird automatisch berechnet.</li>
              <li>Wenn eine Schicht die Arbeitszeit überschreitet, erfolgt ein Hinweis.</li>
              <li>Urlaub oder andere mehrtägige Dienste kannst du über mehrere Tage eintragen.</li>
              <li>Das System berücksichtigt automatisch die Arbeitszeit-Regelung bei Urlaub.</li>
              <li>Kommentare zu Änderungen kannst du optional hinzufügen.</li>
              <li>Der komplette Änderungsverlauf wird dokumentiert.</li>
              <li>Mit ← / → kannst du zwischen Tagen blättern.</li> 
            </ul>
            <button
              onClick={() => setInfoOffen(false)}
              className="absolute top-2 right-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {verlaufOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl p-6 w-[800px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-3">Letzte Änderungen für {eintrag.name}</h3>
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-left">
                  <th className="p-2">Kürzel</th>
                  <th>Von</th>
                  <th>Bis</th>
                  <th>Kommentar</th>
                  <th>Geändert am</th>
                  <th>Erstellt von</th>
                </tr>
              </thead>
              <tbody>
                {verlaufDaten.map((v) => (
                  <tr key={v.id}>
                    <td className="p-2">{v.ist_schicht_rel?.kuerzel || '-'}</td>
                    <td>{v.startzeit_ist}</td>
                    <td>{v.endzeit_ist}</td>
                    <td>{v.kommentar || '-'}</td>
                    <td>{dayjs(v.change_on).format('DD.MM.YYYY HH:mm')}</td>
                    <td>
                      {v.user_rel
                        ? `${v.user_rel.vorname || ''} ${v.user_rel.nachname || ''}`.trim()
                        : v.created_by || 'Unbekannt'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-4">
              <button
                onClick={() => setVerlaufOffen(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded"
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

export default SchichtDienstAendernForm;

