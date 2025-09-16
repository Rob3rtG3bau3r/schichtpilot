import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function SystemTab() {
  const [loadingStunden, setLoadingStunden] = useState(false);
  const [loadingUrlaub, setLoadingUrlaub]   = useState(false);
  const [msg, setMsg] = useState('');

  const call = async (fn, setter) => {
    setter(true); setMsg('');
    try {
      const { error } = await supabase.rpc(fn);
      if (error) throw error;
      setMsg(`✅ ${fn.replace('_',' ')} erfolgreich!`);
    } catch (e) {
      console.error(e);
      setMsg(`❌ Fehler bei ${fn}`);
    } finally {
      setter(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={()=>call('berechne_stunden', setLoadingStunden)}
          disabled={loadingStunden}
          className={`px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 ${loadingStunden?'opacity-50 cursor-not-allowed':''}`}
        >
          {loadingStunden ? 'Berechne…' : 'Stunden neu berechnen'}
        </button>
        <button
          onClick={()=>call('berechne_urlaub', setLoadingUrlaub)}
          disabled={loadingUrlaub}
          className={`px-3 py-2 rounded bg-green-600 hover:bg-green-700 ${loadingUrlaub?'opacity-50 cursor-not-allowed':''}`}
        >
          {loadingUrlaub ? 'Berechne…' : 'Urlaub neu berechnen'}
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
