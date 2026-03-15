// src/pages/SchichtCockpit.jsx
import React, { useEffect, useMemo, useState } from 'react';
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

  // ✅ NEU: Tages-Refresh (nur bestimmter Tag)
  // { "2025-12-20": 3, "2025-12-21": 1, ... }
  const [refreshByDate, setRefreshByDate] = useState({});

  const bumpRefreshForDate = (datum) => {
    const d = String(datum || '').slice(0, 10);
    if (!d) return;

    setRefreshByDate((prev) => ({
      ...prev,
      [d]: (prev[d] || 0) + 1,
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

  // ✅ “aktueller Tages-Key” für das Datum, das zuletzt “betroffen” war
  // Wenn du später aus BedarfsAnalyseModal ein datum reingibst: bumpRefreshForDate(datum)
  const dayRefreshKey = useMemo(() => {
    const d = String(modalDatum || '').slice(0, 10);
    return d ? (refreshByDate[d] || 0) : 0;
  }, [refreshByDate, modalDatum]);

  // ✅ Callback, wenn irgendwo “am Tag” gespeichert wurde (z.B. BedarfsAnalyseModal)
  const handleSavedForDay = ({ datum }) => {
    bumpRefreshForDate(datum);

    // Fallback: wenn Kinder noch nicht “tagesweise” können -> trotzdem alles refreshen
    setReloadKey((p) => p + 1);
    setRefreshMitarbeiterKey((p) => p + 1);
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
                  dayRefreshDatum={modalDatum}
                  dayRefreshKey={dayRefreshKey}
                  onSavedForDay={handleSavedForDay}
                />
              )}

              <KampfListe
                key={reloadKey}
                reloadkey={reloadKey}
                firma={firma}
                unit={unit}
                jahr={jahr}
                monat={monat}
                setPopupOffen={setPopupOffen}
                setAusgewählterDienst={setAusgewählterDienst}
                sichtbareGruppen={sichtbareGruppen}
                setGruppenZähler={setGruppenZähler}

                // ✅ NEU (optional): Tages-Refresh
                dayRefreshDatum={modalDatum}
                dayRefreshKey={dayRefreshKey}

                // ✅ wenn KampfListe irgendwo am Tag speichert, kann sie das nutzen
                onSavedForDay={handleSavedForDay}
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
                  dayRefreshDatum={modalDatum}
                  dayRefreshKey={dayRefreshKey}
                />
              )}

              <Wochen_Kampfliste
                key={reloadKey}
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
                dayRefreshDatum={modalDatum}
                dayRefreshKey={dayRefreshKey}

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
          onSavedForDay={(datum) => {
            bumpRefreshForDate(datum);
            // fallback:
            setReloadKey((p) => p + 1);
            setRefreshMitarbeiterKey((p) => p + 1);
          }}
        />
      </div>

      <MobileBlocker />
    </div>
  );
};

export default SchichtCockpit;
