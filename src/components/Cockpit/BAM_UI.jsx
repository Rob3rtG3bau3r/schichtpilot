// src/components/Dashboard/BAM_UI.jsx
import React from 'react';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';

export const BAM_UI = ({
  offen,
  onClose,
  onInfo,
  title,
  children,
}) => {
  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 px-4 py-2 rounded-xl w-full max-w-4xl shadow-xl flex flex-col gap-2 relative animate-fade-in"
      >
        <div className="absolute top-3 right-4 flex gap-2 items-center">
          <button onClick={onInfo} title="Info">
            <Info size={20} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        <h2 className="text-xl font-semibold text-center">
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
};

export const BAM_InfoModal = ({ offen, onClose }) => {
  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center backdrop-blur-sm z-60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full shadow-xl text-sm text-gray-800 dark:text-gray-100"
      >
        <h3 className="text-lg font-semibold mb-2">Regeln zur Anzeige</h3>
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-2xl"
          aria-label="Schließen"
        >
          &times;
        </button>

        <ul className="list-disc list-inside space-y-1">
          <li><span className="bg-green-500 px-1 rounded text-white">Grün</span>: Sehr gute Kombination</li>
          <li><span className="bg-yellow-500 px-1 rounded text-black">Gelb</span>: Gute Kombination</li>
          <li><span className="bg-amber-500 px-1 rounded text-red-600">Amber</span>: Arbeitszeitverstoß</li>
          <li><span className="bg-red-500 px-1 rounded text-white">Rot</span>: Kollision</li>
        </ul>
      </div>
    </div>
  );
};
