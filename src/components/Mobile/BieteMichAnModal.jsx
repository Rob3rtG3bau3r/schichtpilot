// BieteMichAnModal.jsx
import React from 'react';
import { supabase } from '../../supabaseClient';
import { X } from 'lucide-react';

const BieteMichAnModal = ({ offen, onClose, tag, datum, schicht }) => {
  const user_id = localStorage.getItem('user_id');
  const firma_id = localStorage.getItem('firma_id');
  const unit_id = localStorage.getItem('unit_id');

  const handleAbschicken = async () => {
    await supabase.from('DB_AnfrageMA').insert({
      created_by: user_id,
      datum,
      schicht,
      antrag: 'Ich biete mich freiwillig an',
      genehmigt: null,
      kommentar: '',
      firma_id,
      unit_id,
    });
    onClose();
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center backdrop-blur-sm items-center">
      <div className="bg-white dark:bg-gray-900 border-[4px] border border-gray-300 dark:border-gray-700 p-6 rounded-xl shadow-lg w-[80%] max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">❗ Ich biete mich an für:</h2>
          <button onClick={onClose}><X /></button>
        </div>

        <ul className="text-sm mb-4">
          <li><strong>Tag:</strong> {tag}</li>
          <li><strong>Datum:</strong> {datum}</li>
          <li><strong>Schicht:</strong> {schicht}</li>
        </ul>
        <button onClick={handleAbschicken} className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700">
          Abschicken
        </button>
      </div>
    </div>
  );
};

export default BieteMichAnModal;
