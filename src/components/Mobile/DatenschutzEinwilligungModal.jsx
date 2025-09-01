import React from "react";
import { X } from "lucide-react";

const DatenschutzEinwilligungModal = ({ offen, onClose, onAccept }) => {
  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 backdrop-blur-sm flex justify-center items-center">
      <div className="bg-white dark:bg-gray-900 p-6 border border-gray-300 dark:border-gray-700 rounded-xl shadow-lg w-[90%] max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Datenschutzeinwilligung</h2>
          <button onClick={onClose}><X /></button>
        </div>

        <p className="text-sm mb-4">
          Um Anfragen stellen zu können, benötigen wir deine Einwilligung zur
          Verarbeitung deiner Angaben gemäß unserer Datenschutzerklärung.
        </p>
        <p className="text-sm mb-4">
          Du kannst diese Einwilligung jederzeit über die Einstellungen widerrufen.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onAccept}
            className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Einwilligung erteilen
          </button>
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatenschutzEinwilligungModal;
