import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { Crown, User } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';
import QualiModal from '../Cockpit/QualiModal';
import SchichtDienstAendernForm from './SchichtDienstAendernForm';

const KampfListe = ({
  jahr,
  monat,
  setPopupOffen,
  setAusgewählterDienst,
  reloadkey,
  sichtbareGruppen,
  setGruppenZähler,
  onRefreshMitarbeiterBedarf, 
}) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();
  const istNurLesend = rolle === 'Employee';
  const [eintraege, setEintraege] = useState([]);
  const [tage, setTage] = useState([]);
  const [popupEintrag, setPopupEintrag] = useState(null);
  const heutigesDatum = dayjs().format('YYYY-MM-DD');
  const [qualiModalOffen, setQualiModalOffen] = useState(false);
  const [modalUser, setModalUser] = useState({ id: null, name: '' });
  const [refreshMitarbeiterKey, setRefreshMitarbeiterKey] = useState(0);

  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];

    for (let tag = 1; tag <= tageImMonat; tag++) {
      const datum = new Date(jahr, monat, tag);
      const wochentag = datum.toLocaleDateString('de-DE', { weekday: 'short' });
      neueTage.push({ tag, wochentag });
    }

    setTage(neueTage);
  }, [jahr, monat]);

  useEffect(() => {
    const ladeKampfliste = async () => {
      if (!firma || !unit) return;

      const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
      const datumsliste = [];
      for (let tag = 1; tag <= tageImMonat; tag++) {
        const tagString = `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
        datumsliste.push(tagString);
      }

      const ladeKampflisteBatchweise = async () => {
        let alleEintraege = [];
        const batchSize = 1000;

        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabase
            .from('DB_Kampfliste')
            .select('id, datum, created_by, created_at, startzeit_ist, endzeit_ist, user, schichtgruppe, kommentar, aenderung, ist_schicht(id, kuerzel, farbe_bg, farbe_text)')
            .in('datum', datumsliste)
            .eq('firma_id', firma)
            .eq('unit_id', unit)
            .order('created_at', { ascending: false })
            .range(i * batchSize, (i + 1) * batchSize - 1);

          if (error) {
            console.error(`❌ Fehler in Batch ${i}:`, error.message || error);
            continue;
          }

          alleEintraege = [...alleEintraege, ...data];

          if (data.length < batchSize) break;
        }

        return alleEintraege;
      };

      let kampfData = await ladeKampflisteBatchweise();

      const userIds = kampfData.map(e => e.user).filter(Boolean);
      const createdByIds = kampfData.map(e => e.created_by).filter(Boolean);
      const alleUserIds = [...new Set([...userIds, ...createdByIds])];

      if (alleUserIds.length === 0) return;

      const { data: userInfos, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle, position_ingruppe, user_visible')
        .in('user_id', alleUserIds);

      if (userError) {
        console.error('❌ Fehler beim Laden der Userdaten:', userError.message || userError);
        return;
      }

      const gruppiert = {};

      for (const eintrag of kampfData) {
        const tag = dayjs(eintrag.datum).date();
        const userId = String(eintrag.user);
        const creatorId = String(eintrag.created_by);

        const userInfo = userInfos.find(u => u.user_id === userId);
        const creatorInfo = userInfos.find(u => u.user_id === creatorId);

        if (!userInfo) continue;

        if (!gruppiert[userId]) {
  gruppiert[userId] = {
    schichtgruppe: eintrag.schichtgruppe,
    position: userInfo.position_ingruppe || 999,
    rolle: userInfo.rolle,
    user_visible: userInfo.user_visible || false, // 👈 NEU
    name: `${userInfo.vorname?.charAt(0) || '?'}. ${userInfo.nachname || ''}`,
    vollName: `${userInfo.vorname || ''} ${userInfo.nachname || ''}`,
    tage: {},
  };
}


        gruppiert[userId].tage[tag] = {
          kuerzel: eintrag.ist_schicht?.kuerzel || '-',
          bg: eintrag.ist_schicht?.farbe_bg || '',
          text: eintrag.ist_schicht?.farbe_text || '',
          created_by: creatorId,
          created_by_name: creatorInfo
            ? `${creatorInfo.vorname} ${creatorInfo.nachname} (${creatorInfo.rolle})`
            : 'Unbekannt',
          created_at: eintrag.created_at || null,
          ist_schicht_id: eintrag.ist_schicht?.id || null,
          beginn: eintrag.startzeit_ist || '',
          ende: eintrag.endzeit_ist || '',
          aenderung: eintrag.aenderung || false,
          kommentar: eintrag.kommentar || null,
        };
      }

      const zaehler = {};
      for (const [, eintrag] of Object.entries(gruppiert)) {
        const gruppe = eintrag.schichtgruppe || 'Unbekannt';
        zaehler[gruppe] = (zaehler[gruppe] || 0) + 1;
      }
      setGruppenZähler(zaehler);

      Object.keys(gruppiert).forEach((key) => {
        if (!sichtbareGruppen.includes(gruppiert[key].schichtgruppe)) {
          delete gruppiert[key];
        }
      });

      const sortiert = Object.entries(gruppiert).sort(([, a], [, b]) => {
        const schichtSort = (a.schichtgruppe || '').localeCompare(b.schichtgruppe || '');
        return schichtSort !== 0 ? schichtSort : a.position - b.position;
      });

      setEintraege(sortiert);
    };

    ladeKampfliste();
  }, [firma, unit, jahr, monat, reloadkey, sichtbareGruppen]);

  return (
    <div className="bg-gray-00 text-black dark:bg-gray-800 dark:text-white rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 pb-6">
      <div className="overflow-x-auto w-full">
        <div className="flex min-w-fit">
          <div className="flex flex-col w-[176px] min-w-[176px] flex-shrink-0">
            {eintraege.map(([userId, eintrag], index) => {
              const vorherige = index > 0 ? eintraege[index - 1][1] : null;
              const neueGruppe = vorherige?.schichtgruppe !== eintrag.schichtgruppe;

              let kroneFarbe = '';
              if (eintrag.rolle === 'Team_Leader') {
                if (eintrag.position === 1) kroneFarbe = 'text-yellow-400';
                else if (eintrag.position === 2) kroneFarbe = 'text-gray-400';
                else kroneFarbe = 'text-amber-600';
              }

              return (
                <div
                  key={userId}
className={`h-[20px] flex items-center px-2 border-b truncate rounded-md cursor-default
  ${index % 2 === 0 ? 'bg-gray-300 dark:bg-gray-700/40' : 'bg-gray-100 dark:bg-gray-700/20'}
  ${neueGruppe ? 'mt-2' : ''}
  border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
  ${!eintrag.user_visible ? 'opacity-50' : ''}`}
                  title={eintrag.vollName}
                >
                  <span
  className="flex-1 hover:underline cursor-pointer"
  onClick={() => {
    setModalUser({ id: userId, name: eintrag.vollName });
    setQualiModalOffen(true);
  }}
>
  {eintrag.name}
</span>
                  <span className="ml-1">
                    {eintrag.rolle === 'Team_Leader' ? (
                      <Crown size={14} className={kroneFarbe} />
                    ) : (
                      <User size={14} className="text-gray-400" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-[2px]">
            {eintraege.map(([userId, eintrag], index) => {
              const vorherige = index > 0 ? eintraege[index - 1][1] : null;
              const neueGruppe = vorherige?.schichtgruppe !== eintrag.schichtgruppe;

              return (
                <div
  key={userId}
  className={`flex gap-[2px] ${neueGruppe ? 'mt-2' : ''} ${!eintrag.user_visible ? 'opacity-20' : ''}`}
>

                  {tage.map((t) => {
                    const eintragTag = eintrag.tage[t.tag];
                    const zellenDatum = `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(t.tag).padStart(2, '0')}`;
                    const istHeute = zellenDatum === heutigesDatum;

                    return (
                      <div
                        key={t.tag}
                        className={`relative group w-[48px] min-w-[48px] h-[18px] text-center border-b flex items-center justify-center rounded cursor-pointer
                          ${istHeute ? 'ring-2 ring-yellow-400' : ''}
                          border-gray-300 dark:border-gray-700`}
                        style={{
                          backgroundColor: eintragTag?.bg || (document.documentElement.classList.contains('dark') ? '#333' : '#eee'),
                          color: eintragTag?.text || (document.documentElement.classList.contains('dark') ? '#ccc' : '#333'),
                        }}
                        onClick={() => {
                          if (istNurLesend) return;
                          const eintragObjekt = {                            
                            user: userId,
                            name: eintrag.vollName,
                            datum: zellenDatum,
                            soll_schicht: null,
                            ist_schicht: eintragTag?.kuerzel,
                            ist_schicht_id: eintragTag?.ist_schicht_id || null,
                            beginn: eintragTag?.beginn || '',
                            ende: eintragTag?.ende || '',
                            schichtgruppe: eintrag.schichtgruppe,
                            created_by: eintragTag?.created_by,
                            created_by_name: eintragTag?.created_by_name,
                            created_at: eintragTag?.created_at,
                            kommentar: eintragTag?.kommentar || '',
                          };

                          setPopupEintrag(eintragObjekt);
                          setAusgewählterDienst(eintragObjekt);
                          setPopupOffen(true);
                        }}
                      >
                       {eintragTag?.aenderung && (
  <>
    {/* Weißes Dreieck unten als Rahmen */}
    <div
      className="absolute top-0 right-0 w-0 h-0"
      style={{
        borderTop: '13px solid white',
        borderLeft: '13px solid transparent',
        zIndex: 5,
      }}
    />
    {/* Kleineres farbiges Dreieck oben drauf */}
    <div
      className="absolute top-0 right-0 w-0 h-0"
      style={{
        borderTop: '10px solid #facc15', // Tailwind yellow-400
        borderLeft: '10px solid transparent',
        zIndex: 10,
      }}
      title="Geändert"
    />
  </>
)}

{eintragTag?.kommentar && (
  <>
    {/* Weißes Dreieck als Hintergrund/Umrandung */}
    <div
      className="absolute top-0 left-0 w-0 h-0"
      style={{
        borderTop: '13px solid white',
        borderRight: '13px solid transparent',
        zIndex: 5,
      }}
    />
    {/* Kleineres farbiges Dreieck oben drauf */}
    <div
      className="absolute top-0 left-0 w-0 h-0"
      style={{
        borderTop: '10px solid red', // Tailwind sky-400
        borderRight: '10px solid transparent',
        zIndex: 10,
      }}
      title="Kommentar vorhanden"
    />
  </>
)}

                        {eintragTag?.beginn && eintragTag?.ende && (
                          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white dark:text-black bg-black dark:bg-white rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20 pointer-events-none text-left shadow-lg border dark:border-gray-400">
                            <div>{eintragTag.beginn} – {eintragTag.ende}</div>
                            {eintragTag.kommentar && (
                              <div className="mt-1 max-w-[200px] break-words">{eintragTag.kommentar}</div>
                            )}
                          </div>
                        )}
                        {eintragTag ? (
                          <span className="text-xs font-medium">{eintragTag.kuerzel}</span>
                        ) : (
                          <span className="text-gray-500">–</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    <QualiModal
  offen={qualiModalOffen}
  onClose={() => setQualiModalOffen(false)}
  userId={modalUser.id}
  userName={modalUser.name}
/>  
{popupEintrag && !istNurLesend && (
  <SchichtDienstAendernForm
    eintrag={popupEintrag}
    onClose={() => {
      setPopupOffen(false);
      setPopupEintrag(null);
    }}
    onRefresh={() => {
      if (onRefreshMitarbeiterBedarf) onRefreshMitarbeiterBedarf();
    }}
  />
)}

    </div>
    
  );
};

export default KampfListe;