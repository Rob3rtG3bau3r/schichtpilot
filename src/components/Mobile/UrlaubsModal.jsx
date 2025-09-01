import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, CheckCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { erstelleDatenschutzPDF } from '../../utils/DatenschutzPDF';

const UrlaubsModal = ({ offen, onClose, tag, datum, schicht }) => {
  const user_id = localStorage.getItem('user_id');
  const firma_id = localStorage.getItem('firma_id');
  const unit_id = localStorage.getItem('unit_id');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [einwilligung, setEinwilligung] = useState(false);

  // ✅ 1. Prüfen, ob User bereits zugestimmt hat
  useEffect(() => {
    const ladeEinwilligung = async () => {
      if (!user_id) return;

      const { data, error } = await supabase
        .from('DB_User')
        .select('consent_anfragema')
        .eq('user_id', user_id)
        .single();

      if (error) {
        console.error('Fehler beim Laden der Einwilligung:', error);
        return;
      }

      setEinwilligung(data?.consent_anfragema === true);
    };

    ladeEinwilligung();
  }, [user_id]);

  // ✅ 2. Einwilligung speichern
  const handleEinwilligungSpeichern = async () => {
    const { error } = await supabase
      .from('DB_User')
      .update({
        consent_anfragema: true,
        consent_anfragema_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (error) {
      console.error('Fehler beim Speichern der Einwilligung:', error);
      alert('Einwilligung konnte nicht gespeichert werden.');
      return;
    }

    setEinwilligung(true);
  };

  // ✅ 3. Antrag abschicken
  const handleAbschicken = async () => {
    if (isSubmitting || success) return;

    if (!einwilligung) {
      alert('Bitte bestätigen Sie zuerst die Datenschutzhinweise.');
      return;
    }

    setIsSubmitting(true);

    try {
      const heute = dayjs().startOf('day');
      const ausgewaehlt = dayjs(datum);

      if (ausgewaehlt.isBefore(heute, 'day')) {
        alert('Anfragen für vergangene Tage sind nicht möglich.');
        setIsSubmitting(false);
        return;
      }

      // 3-Tage-Regel: Abfrage über created_at
      const now = dayjs();
      const windowStartISO = now.subtract(3, 'day').toISOString();
      const schichtCode = (schicht ?? '-').toString().trim().toUpperCase();

      const { error: checkErr, count } = await supabase
        .from('DB_AnfrageMA')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user_id)
        .eq('datum', datum)
        .gte('created_at', windowStartISO)
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id);

      if (checkErr) {
        console.error('Check-Fehler:', checkErr);
        alert('Konnte bestehende Anträge nicht prüfen. Bitte später erneut versuchen.');
        setIsSubmitting(false);
        return;
      }

      if ((count ?? 0) > 0) {
        alert('Du hast in den letzten 3 Tagen bereits einen Antrag für diesen Tag gestellt.');
        setIsSubmitting(false);
        return;
      }

      // ✅ Antrag eintragen
      const { error: insertError } = await supabase.from('DB_AnfrageMA').insert({
        created_by: user_id,
        datum,
        schicht: schichtCode,
        antrag: 'Urlaub beantragt',
        genehmigt: null,
        kommentar: '',
        firma_id,
        unit_id,
      });

      if (insertError) {
        console.error('Insert-Fehler:', insertError);
        alert('Fehler beim Abschicken der Anfrage.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
      alert('Unerwarteter Fehler. Bitte später erneut versuchen.');
      setIsSubmitting(false);
    }
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 backdrop-blur-sm flex justify-center items-center">
      <div className="bg-white dark:bg-gray-900 p-6 border-[4px] border-gray-300 dark:border-gray-700 rounded-xl shadow-lg w-[80%] max-w-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🌿 Frei beantragen</h2>
          <button onClick={onClose}><X /></button>
        </div>

        {/* Erfolgsmeldung */}
        {success && (
          <div
            className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
            aria-live="polite"
          >
            <CheckCircle className="w-4 h-4" />
            Antrag gesendet
          </div>
        )}

        {/* Infos */}
        <p className="text-sm mb-4">Ich würde gerne Urlaub nehmen für:</p>
        <ul className="text-sm mb-4">
          <li><strong>Tag:</strong> {tag}</li>
          <li><strong>Datum:</strong> {datum}</li>
          <li><strong>Schicht:</strong> {schicht}</li>
        </ul>

        {/* Einwilligung */}
        {!einwilligung && (
          <div className="mb-4 text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-300 dark:border-gray-700">
            <p className="mb-2">
              Um diesen Antrag zu stellen, lesen Sie bitte unsere Datenschutzerklärung und bestätigen Sie Ihr Einverständnis.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={erstelleDatenschutzPDF}
                className="text-blue-600 underline text-xs hover:text-blue-800"
              >
                📄 Datenschutzerklärung als PDF öffnen
              </button>
              <button
                onClick={handleEinwilligungSpeichern}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-xs"
              >
                Ich habe die Datenschutzerklärung gelesen und verstanden
              </button>
            </div>
          </div>
        )}

        {/* Submit-Button */}
        <button
          onClick={handleAbschicken}
          disabled={isSubmitting || success}
          className="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sende…' : 'Abschicken'}
        </button>
      </div>
    </div>
  );
};

export default UrlaubsModal;

