import React from 'react';

const InfoModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-fade-in bg-white dark:bg-gray-900 text-black dark:text-white rounded-xl p-6 w-[90%] max-w-lg shadow-2xl relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-white"
        >
          ❌
        </button>
        <h2 className="text-xl font-semibold mb-4">ℹ️ Hinweise</h2>
        <ul className="space-y-2 text-sm list-disc pl-5">
          <li>👁 Passwortanzeige kann aktiviert werden.</li>
          <li>📧 Mail-Adresse muss eindeutig sein.</li>
          <li>🏢 Firma & Unit bleiben nach dem Speichern erhalten.</li>
          <li>🔁 Formular wird nach dem Speichern zurückgesetzt.</li>
          <li>📤 Änderungen werden automatisch gespeichert.</li>
          <li>🔎 Filter und Sortierung sind in der Tabelle möglich.</li>
        </ul>
      </div>
    </div>
  );
};

export default InfoModal;

