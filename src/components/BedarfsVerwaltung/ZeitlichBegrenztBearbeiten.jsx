// components/BedarfsVerwaltung/ZeitlichBegrenztBearbeiten.jsx
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { ChevronDown, ChevronRight, Info, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';

const ZeitlichBegrenztBearbeiten = ({ eintrag, refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [daten, setDaten] = useState([]);
  const [eingeklappt, setEingeklappt] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);

  // 🔔 Toast
  const [toast, setToast] = useState({ open: false, text: '', type: 'success' });
  const showToast = (text, type = 'success') => {
    setToast({ open: true, text, type });
    setTimeout(() => setToast((t) => ({ ...t, open: false })), 1600);
  };

  // 🎯 Auto-Vorauswahl, wenn nix über Props kommt (oder nach Anlegen via Event)
  const [automatischEintrag, setAutomatischEintrag] = useState(null);
  const aktiverEintrag = eintrag || automatischEintrag;

  // ✨ Auto-Highlight + Scroll
  const headerRef = useRef(null);
  const [highlight, setHighlight] = useState(false);

  // 🔄 Einträge laden (für aktuellen Zeitraum/Name)
  const ladeEintraege = async (ziel) => {
    if (!firma || !unit || !ziel) return;
    const { data, error } = await supabase
      .from('DB_Bedarf')
      .select('id, anzahl, quali_id, farbe, DB_Qualifikationsmatrix(qualifikation, quali_kuerzel, betriebs_relevant)')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .eq('normalbetrieb', false)
      .eq('von', ziel.von)
      .eq('bis', ziel.bis)
      .eq('namebedarf', ziel.namebedarf);

    if (error) {
      console.error('Fehler beim Laden der Einträge:', error.message);
      showToast('Konnte Einträge nicht laden', 'error');
      setDaten([]);
    } else {
      setDaten(data || []);
    }
  };

  // ▶️ Erstes Laden: falls kein Prop-Eintrag da ist, den nächsten zukünftigen holen
  useEffect(() => {
    const vorauswaehlen = async () => {
      if (!firma || !unit) return;
      if (eintrag) return; // Prop hat Vorrang

      const heute = dayjs().format('YYYY-MM-DD');
      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select('von, bis, namebedarf, farbe')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', false)
        .gte('von', heute)
        .order('von', { ascending: true })
        .limit(1);

      if (!error && data?.length) {
        setAutomatischEintrag(data[0]);
      }
    };
    vorauswaehlen();
  }, [firma, unit, eintrag]);

  // 📡 Auf globales Anlege-Event reagieren (Formular kann das dispatchen)
  // window.dispatchEvent(new CustomEvent('bedarf:new', { detail: { von, bis, namebedarf, farbe } }))
  useEffect(() => {
    const handler = (ev) => {
      const d = ev.detail;
      if (!d) return;
      setAutomatischEintrag({ von: d.von, bis: d.bis, namebedarf: d.namebedarf, farbe: d.farbe });
      showToast('Angelegt – Details geöffnet', 'success');
    };
    window.addEventListener('bedarf:new', handler);
    return () => window.removeEventListener('bedarf:new', handler);
  }, []);

  // 🔁 Daten laden, wenn aktiver Eintrag/Firma/Unit/refreshKey wechselt
  useEffect(() => {
    ladeEintraege(aktiverEintrag);
  }, [firma, unit, aktiverEintrag, refreshKey]);

  // 🪟 Bei Eintragswechsel automatisch aufklappen, scrollen & highlighten
  useEffect(() => {
    if (!aktiverEintrag) return;
    setEingeklappt(false);
    // Scroll sanft zum Header
    requestAnimationFrame(() => {
      headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1500);
    });
  }, [aktiverEintrag]);

  // 🗑️ Löschen + Reload (DB-Wahrheit)
  const handleLöschen = async (id) => {
    const confirm = window.confirm('Soll dieser Eintrag gelöscht werden?');
    if (!confirm) return;

    const { error } = await supabase.from('DB_Bedarf').delete().eq('id', id);
    if (error) {
      console.error('Fehler beim Löschen:', error.message);
      showToast(error.message || 'Löschen fehlgeschlagen', 'error');
      return;
    }

    showToast('Gelöscht', 'success');
    // Neu laden, statt nur lokal zu filtern (damit DB-Status sicher gespiegelt ist)
    ladeEintraege(aktiverEintrag);
  };

  if (!aktiverEintrag) {
    return <p className="text-sm text-gray-500 italic">Kein Eintrag ausgewählt.</p>;
  }

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      {/* Header */}
      <div
        ref={headerRef}
        className={`flex justify-between items-center mb-3 transition-all ${
          highlight ? 'ring-2 ring-blue-400 rounded-lg' : ''
        }`}
      >
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setEingeklappt(!eingeklappt)}
          title={eingeklappt ? 'Aufklappen' : 'Zuklappen'}
        >
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          <h3 className="text-md font-semibold flex items-center gap-2">
            {aktiverEintrag.namebedarf} → {dayjs(aktiverEintrag.von).format('DD.MM.YYYY')} –{' '}
            {dayjs(aktiverEintrag.bis).format('DD.MM.YYYY')}
            <span
              className="inline-block w-20 h-3 rounded-full border border-gray-400"
              style={{ backgroundColor: aktiverEintrag.farbe || '#ccc' }}
            />
            {/* Badge mit Anzahl */}
            <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700">
              {daten.length}
            </span>
          </h3>
        </div>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
          title="Informationen"
        >
          <Info size={20} />
        </button>
      </div>

      {/* Inhalt */}
      {!eingeklappt && (
        <>
          {daten.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Keine Einträge vorhanden.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {daten.map((e) => (
                <li
                  key={e.id}
                  className="bg-gray-100 dark:bg-gray-700 p-2 rounded flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{e.DB_Qualifikationsmatrix?.qualifikation || '–'}</div>
                    <div className="text-xs text-gray-500">{e.DB_Qualifikationsmatrix?.quali_kuerzel}</div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-semibold">{e.anzahl}</span>
                    <span className="text-xs text-gray-500">Personen</span>
                    <button
                      onClick={() => handleLöschen(e.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl animate-fade-in shadow max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Bearbeitung</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Hier siehst du alle Einträge zum gewählten Zeitraum und Namen.</li>
              <li>Du kannst einzelne Bedarfe löschen.</li>
              <li>Die Einträge stammen aus der Tabelle <b>DB_Bedarf</b>.</li>
              <li>Nach Anlegen/Löschen werden die Details automatisch geöffnet und hervorgehoben.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                onClick={() => setInfoOffen(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.open && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded shadow-lg text-sm ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-green-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default ZeitlichBegrenztBearbeiten;
