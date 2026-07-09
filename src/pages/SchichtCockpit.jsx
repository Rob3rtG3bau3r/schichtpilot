// src/pages/SchichtCockpit.jsx
import React, { useEffect, useState } from 'react';
import KalenderStruktur from '../components/Cockpit/KalenderStruktur';
import Sollplan from '../components/Cockpit/Sollplan';
import CockpitMenue from '../components/Cockpit/CockpitMenue';
import KampfListe from '../components/Cockpit/KampfListe';
import SchichtDienstAendernForm from '../components/Cockpit/SchichtDienstAendernForm';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import MitarbeiterBedarf from '../components/Cockpit/MitarbeiterBedarf';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import Wochen_KalenderStruktur from '../components/Cockpit/Wochen_KalenderStruktur';
import Wochen_Kampfliste from '../components/Cockpit/Wochen_KampfListe';
import Wochen_MitarbeiterBedarf from '../components/Cockpit/Wochen_MitarbeiterBedarf';

const MobileBlocker = () => (
  <div className="fixed inset-0 z-[9999] lg:hidden bg-gray-900 text-white flex items-center justify-center p-6">
    <div className="max-w-md text-center space-y-4">
      <h1 className="text-xl font-semibold">Nur am Desktop verfügbar</h1>
      <p className="opacity-90">
        Das Cockpit & somit die Schichtplanung sind bewusst nicht für kleine Bildschirme freigegeben.
        Bitte nutze die mobile Ansicht.
      </p>
      <Link
        to="/mobile"
        className="inline-block rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-700"
      >
        Zur mobilen Ansicht
      </Link>
    </div>
  </div>
);

const SchichtCockpit = () => {
  const [gruppenZähler, setGruppenZähler] = useState({});
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [monat, setMonat] = useState(new Date().getMonth());
    useEffect(() => {
  const raw = sessionStorage.getItem('sp_jump_to_month');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const nextJahr = Number(parsed?.jahr);
      const nextMonat = Number(parsed?.monat);

      if (!Number.isNaN(nextJahr)) setJahr(nextJahr);
      if (!Number.isNaN(nextMonat)) setMonat(nextMonat);
    } catch (err) {
      console.error('Fehler beim Lesen von sp_jump_to_month:', err);
    } finally {
      sessionStorage.removeItem('sp_jump_to_month');
    }
  }, []);

  const [sollPlanAktiv, setSollPlanAktiv] = useState(false);
  const [popupOffen, setPopupOffen] = useState(false);
  const [ausgewählterDienst, setAusgewählterDienst] = useState(null);

  // ✅ Bisherige Keys bleiben (Fallback / kompatibel)
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshMitarbeiterKey, setRefreshMitarbeiterKey] = useState(0);

  // ✅ Tages-/Bereichs-Refresh für die Kampfliste
  // Wichtig: kein reloadKey-Bump, sonst wird die Kampfliste komplett neu gemountet.
  const [dayRefreshRequest, setDayRefreshRequest] = useState({
    dates: [],
    key: 0,
    userId: null,
  });

  const normalizeDates = (value) => {
    const arr = Array.isArray(value) ? value : [value];

    return Array.from(
      new Set(
        arr
          .map((d) => String(d || '').slice(0, 10))
          .filter(Boolean)
      )
    ).sort();
  };

  const bumpRefreshForDates = (dates, userId = null) => {
    const cleanDates = normalizeDates(dates);
    if (!cleanDates.length) return;

    setDayRefreshRequest((prev) => ({
      dates: cleanDates,
      userId: userId || null,
      key: prev.key + 1,
    }));
  };

  const [modalDatum, setModalDatum] = useState('');
  const [modalSchicht, setModalSchicht] = useState('');
  const [modalOffen, setModalOffen] = useState(false);
  const [modalMitarbeiter, setModalMitarbeiter] = useState([]);
  const [modalFrei, setModalFrei] = useState([]);

  // 🔁 Ansicht: Monat oder Woche
  const [ansichtModus, setAnsichtModus] = useState('monat'); // 'monat' | 'woche'
  const [wochenAnzahl, setWochenAnzahl] = useState(1);       // 1–4

  const [sichtbareGruppen, setSichtbareGruppen] = useState([
    'A-Schicht',
    'B-Schicht',
    'C-Schicht',
    'D-Schicht',
    'E-Schicht',
  ]);

  const handlePopup = (dienst) => {
    setAusgewählterDienst(dienst);
    setPopupOffen(true);
  };

  // 🧠 nur das Formular neu laden für ← / →
  const ladeEintragFürDatum = async (neuesDatum, userId) => {
    const { data, error } = await supabase
      .from('DB_Kampfliste')
      .select(
        `
        *,
        ist_schicht(id, kuerzel, farbe_bg, farbe_text)
      `
      )
      .eq('user', userId)
      .eq('datum', neuesDatum)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('❌ Kein Eintrag für neuen Tag gefunden:', error);
      return;
    }

    const neuerEintrag = {
      user: userId,
      name: ausgewählterDienst?.name,
      datum: neuesDatum,
      ist_schicht: data.ist_schicht?.kuerzel,
      ist_schicht_id: data.ist_schicht?.id,
      beginn: data.startzeit_ist,
      ende: data.endzeit_ist,
      created_by: data.created_by,
      created_by_name: ausgewählterDienst?.created_by_name,
      created_at: data.created_at,
      soll_schicht: data.soll_schicht,
      schichtgruppe: data.schichtgruppe,
    };

    setAusgewählterDienst(neuerEintrag);
  };

  const isMonatsAnsicht = ansichtModus === 'monat';
  const isWochenAnsicht = ansichtModus === 'woche';

  const dayRefreshDatum = dayRefreshRequest.dates;
  const dayRefreshKey = dayRefreshRequest.key;
  const dayRefreshUserId = dayRefreshRequest.userId;

  // ✅ Callback, wenn irgendwo gezielt ein Tag/mehrere Tage gespeichert wurden
  // Unterstützt sowohl alte Signatur (datum-String) als auch neue Payloads:
  // { datum }, { dates }, { datum, user_id }, { dates, user_id, macht_schicht }
  const handleSavedForDay = (payload) => {
    const rawDates = Array.isArray(payload?.dates)
      ? payload.dates
      : payload?.datum || payload;

    const dates = normalizeDates(rawDates);
    if (!dates.length) return;

    const machtSchicht = payload?.macht_schicht !== false;

    // Bedarf darf neu rechnen, weil sich durch den Dienst die Besetzung ändern kann.
    setRefreshMitarbeiterKey((p) => p + 1);

    // Kampfliste nur aktualisieren, wenn wirklich ein Dienst geschrieben wurde.
    if (machtSchicht) {
      bumpRefreshForDates(dates, payload?.user_id || null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white">
      <div className="px-6 pb-1 relative isolate">
        <CockpitMenue
          sollPlanAktiv={sollPlanAktiv}
          setSollPlanAktiv={setSollPlanAktiv}
          sichtbareGruppen={sichtbareGruppen}
          setSichtbareGruppen={setSichtbareGruppen}
          gruppenZähler={gruppenZähler}
          ansichtModus={ansichtModus}
          setAnsichtModus={setAnsichtModus}
          wochenAnzahl={wochenAnzahl}
          setWochenAnzahl={setWochenAnzahl}
        />

        <div
          id="sp-hscroll"
          className="overflow-x-auto overflow-y-visible"
          style={{ overscrollBehaviorX: 'contain' }}
        >
          {/* 🔁 MONATSANSICHT */}
          {isMonatsAnsicht && (
            <>
              <KalenderStruktur
                jahr={jahr}
                setJahr={setJahr}
                monat={monat}
                setMonat={setMonat}
              />

              {sollPlanAktiv && (
                <Sollplan
                  jahr={jahr}
                  monat={monat}
                  firma={firma}
                  unit={unit}
                />
              )}

              {firma && unit && (
                <MitarbeiterBedarf
                  firma={firma}
                  unit={unit}
                  jahr={jahr}
                  monat={monat}
                  refreshKey={refreshMitarbeiterKey}
                  dayRefreshDatum={dayRefreshDatum}
                  dayRefreshKey={dayRefreshKey}
                  dayRefreshUserId={dayRefreshUserId}
                  onSavedForDay={handleSavedForDay}
                />
              )}

            <KampfListe
              reloadkey={reloadKey}
              firma={firma}
              unit={unit}
              jahr={jahr}
              monat={monat}
              setPopupOffen={setPopupOffen}
              setAusgewählterDienst={setAusgewählterDienst}
              sichtbareGruppen={sichtbareGruppen}
              setGruppenZähler={setGruppenZähler}

              dayRefreshDatum={dayRefreshDatum}
              dayRefreshKey={dayRefreshKey}
              dayRefreshUserId={dayRefreshUserId}

              onSavedForDay={handleSavedForDay}

              onRefreshMitarbeiterBedarf={() => {
                setRefreshMitarbeiterKey((prev) => prev + 1);
              }}
            />
            </>
          )}

          {/* 🔁 WOCHENANSICHT */}
          {isWochenAnsicht && (
            <>
              <Wochen_KalenderStruktur
                jahr={jahr}
                setJahr={setJahr}
                monat={monat}
                setMonat={setMonat}
                wochenAnzahl={wochenAnzahl}
              />

              {firma && unit && (
                <Wochen_MitarbeiterBedarf
                  firma={firma}
                  unit={unit}
                  jahr={jahr}
                  monat={monat}
                  wochenAnzahl={wochenAnzahl}
                  refreshKey={refreshMitarbeiterKey}

                  // ✅ NEU (optional): Tages-Refresh
                  dayRefreshDatum={dayRefreshDatum}
                  dayRefreshKey={dayRefreshKey}
                  dayRefreshUserId={dayRefreshUserId}
                />
              )}

              <Wochen_Kampfliste
                reloadkey={reloadKey}
                firma={firma}
                unit={unit}
                jahr={jahr}
                monat={monat}
                wochenAnzahl={wochenAnzahl}
                setPopupOffen={setPopupOffen}
                setAusgewählterDienst={setAusgewählterDienst}
                sichtbareGruppen={sichtbareGruppen}
                setGruppenZähler={setGruppenZähler}

                // ✅ NEU (optional): Tages-Refresh
                dayRefreshDatum={dayRefreshDatum}
                dayRefreshKey={dayRefreshKey}
                dayRefreshUserId={dayRefreshUserId}

                onSavedForDay={handleSavedForDay}
              />
            </>
          )}
        </div>

        {/* Popup zum Ändern eines Dienstes */}
        <SchichtDienstAendernForm
          offen={popupOffen}
          onClose={() => setPopupOffen(false)}
          eintrag={ausgewählterDienst}
          firma={firma}
          unit={unit}
          aktualisieren={(neuesDatum, userId) => ladeEintragFürDatum(neuesDatum, userId)}

          // ✅ bisher: Gesamt-Refresh
          reloadListe={() => setReloadKey((prev) => prev + 1)}

          // ✅ bisher: Bedarf-Refresh
          onRefreshMitarbeiterBedarf={() => setRefreshMitarbeiterKey((prev) => prev + 1)}

          // ✅ NEU: Wenn du im Form ein konkretes Datum kennst:
          onSavedForDay={(payload) => handleSavedForDay(payload)}
        />
      </div>

      <MobileBlocker />
    </div>
  );
};

export default SchichtCockpit;
