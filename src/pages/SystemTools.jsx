import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SystemTools = () => {
  const [loadingStunden, setLoadingStunden] = useState(false);
  const [loadingUrlaub, setLoadingUrlaub] = useState(false);
  const [message, setMessage] = useState('');

  const handleStunden = async () => {
    setLoadingStunden(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('berechne_stunden'); // NEUE FUNCTION
      if (error) throw error;
      setMessage('✅ Stunden erfolgreich berechnet!');
    } catch (err) {
      console.error('Fehler (Stunden):', err);
      setMessage('❌ Fehler bei der Stunden-Berechnung!');
    } finally {
      setLoadingStunden(false);
    }
  };

  const handleUrlaub = async () => {
    setLoadingUrlaub(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('berechne_urlaub'); // NEUE FUNCTION
      if (error) throw error;
      setMessage('✅ Urlaub erfolgreich berechnet!');
    } catch (err) {
      console.error('Fehler (Urlaub):', err);
      setMessage('❌ Fehler bei der Urlaubs-Berechnung!');
    } finally {
      setLoadingUrlaub(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">System-Tools (Admin)</h1>

      <div className="flex flex-col gap-4 max-w-sm">
        <button
          onClick={handleStunden}
          disabled={loadingStunden}
          className={`px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition ${
            loadingStunden ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loadingStunden ? 'Berechne...' : 'Stunden neu berechnen'}
        </button>

        <button
          onClick={handleUrlaub}
          disabled={loadingUrlaub}
          className={`px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition ${
            loadingUrlaub ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loadingUrlaub ? 'Berechne...' : 'Urlaub neu berechnen'}
        </button>
      </div>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  );
};

export default SystemTools;


