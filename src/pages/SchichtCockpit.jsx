import React, { useState } from 'react';
import KalenderStruktur from '../components/Cockpit/KalenderStruktur';
import Sollplan from '../components/Cockpit/Sollplan';
import CockpitMenue from '../components/Cockpit/CockpitMenue';
import KampfListe from "../components/Cockpit/KampfListe";
import SchichtDienstAendernForm from '../components/Cockpit/SchichtDienstAendernForm';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import MitarbeiterBedarf from '../components/Cockpit/MitarbeiterBedarf';
import dayjs from 'dayjs';

const SchichtCockpit = () => {
  const [gruppenZähler, setGruppenZähler] = useState({});
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [monat, setMonat] = useState(new Date().getMonth());
  const [sollPlanAktiv, setSollPlanAktiv] = useState(false);
  const [popupOffen, setPopupOffen] = useState(false);
  const [ausgewählterDienst, setAusgewählterDienst] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshMitarbeiterKey, setRefreshMitarbeiterKey] = useState(0);
  const [modalDatum, setModalDatum] = useState('');
const [modalSchicht, setModalSchicht] = useState('');
const [modalOffen, setModalOffen] = useState(false);
const [modalMitarbeiter, setModalMitarbeiter] = useState([]);
const [modalFrei, setModalFrei] = useState([]);
  const [sichtbareGruppen, setSichtbareGruppen] = useState([
    'A-Schicht',
    'B-Schicht',
    'C-Schicht',
    'D-Schicht',
    'E-Schicht'
  ]);


  const handlePopup = (dienst) => {
    setAusgewählterDienst(dienst);
    setPopupOffen(true);
  };

  // 🧠 NEU: nur das Formular neu laden für ← / →
  const ladeEintragFürDatum = async (neuesDatum, userId) => {
    const { data, error } = await supabase
      .from('DB_Kampfliste')
      .select(`
        *,
        ist_schicht(id, kuerzel, farbe_bg, farbe_text)
      `)
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
      name: ausgewählterDienst.name,
      datum: neuesDatum,
      ist_schicht: data.ist_schicht?.kuerzel,
      ist_schicht_id: data.ist_schicht?.id,
      beginn: data.startzeit_ist,
      ende: data.endzeit_ist,
      created_by: data.created_by,
      created_by_name: ausgewählterDienst.created_by_name,
      created_at: data.created_at,
      soll_schicht: data.soll_schicht,
      schichtgruppe: data.schichtgruppe
    };

    setAusgewählterDienst(neuerEintrag);
  };

  return (
    <div className="px-6 pb-1 text-white overflow-x-visible overflow-y-visible relative isolate">

      <CockpitMenue
        sollPlanAktiv={sollPlanAktiv}
        setSollPlanAktiv={setSollPlanAktiv}
        sichtbareGruppen={sichtbareGruppen}
        setSichtbareGruppen={setSichtbareGruppen}
        gruppenZähler={gruppenZähler}
      />


      {/* Kalenderstruktur */}
      <KalenderStruktur
        jahr={jahr}
        setJahr={setJahr}
        monat={monat}
        setMonat={setMonat}
      />

      {/* Optionaler Sollplan */}
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
/>
      )}
      {/* Kampfliste zeigt den Arbeitsplan der MA */}
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
      />
      {/* Popup zum Ändern eines Dienstes */}
      <SchichtDienstAendernForm
        offen={popupOffen}
        onClose={() => setPopupOffen(false)}
        eintrag={ausgewählterDienst}
        firma={firma}
        unit={unit}
        aktualisieren={(neuesDatum, userId) => ladeEintragFürDatum(neuesDatum, userId)} // ✅ für ← / →
        reloadListe={() => setReloadKey(prev => prev + 1)} 
        onRefreshMitarbeiterBedarf={() => setRefreshMitarbeiterKey((prev) => prev + 1)}
      />
    </div>
  );
};

export default SchichtCockpit;