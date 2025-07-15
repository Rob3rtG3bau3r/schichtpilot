// UrlaubsModal.jsx
import React from 'react';
import { supabase } from '../../supabaseClient';
import { X } from 'lucide-react';

const UrlaubsModal = ({ offen, onClose, tag, datum, schicht }) => {
  const user_id = localStorage.getItem('user_id');
  const firma_id = localStorage.getItem('firma_id');
  const unit_id = localStorage.getItem('unit_id');

  const handleAbschicken = async () => {
    await supabase.from('DB_AnfrageMA').insert({
      created_by: user_id,
      datum,
      schicht,
      antrag: 'Urlaub beantragt',
      genehmigt: null,
      kommentar: '',
      firma_id: firma_id,
      unit_id: unit_id,
    });
    onClose(); // Modal schließen
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 backdrop-blur-sm flex justify-center items-center">
      <div className="bg-white dark:bg-gray-900 p-6 border-[4px] border border-gray-300 dark:border-gray-700 rounded-xl shadow-lg w-[80%] max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🌿 Frei beantragen</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <p className="text-sm mb-4">Ich würde gerne Urlaub nehmen für:</p>
        <ul className="text-sm mb-4">
          <li><strong>Tag:</strong> {tag}</li>
          <li><strong>Datum:</strong> {datum}</li>
          <li><strong>Schicht:</strong> {schicht}</li>
        </ul>
        <button onClick={handleAbschicken} className="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">
          Abschicken
        </button>
      </div>
    </div>
  );
};

export default UrlaubsModal;
