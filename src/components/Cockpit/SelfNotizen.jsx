import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock3,
  Edit3,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const FARBEN = {
  neutral:
    'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100',
  blau:
    'bg-blue-100 border-blue-400 text-blue-950 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-200',
  gruen:
    'bg-green-100 border-green-400 text-green-950 dark:bg-green-900/20 dark:border-green-600 dark:text-green-300',
  gelb:
    'bg-yellow-100 border-yellow-400 text-yellow-950 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-100',
  rot:
    'bg-red-100 border-red-400 text-red-950 dark:bg-red-900/20 dark:border-red-600 dark:text-red-200',
};

const FARBAUSWAHL = [
  {
    name: 'neutral',
    label: 'Neutral',
    klasse: 'bg-gray-400 dark:bg-gray-500',
  },
  {
    name: 'blau',
    label: 'Blau',
    klasse: 'bg-blue-400 dark:bg-blue-500',
  },
  {
    name: 'gruen',
    label: 'Grün',
    klasse: 'bg-green-400 dark:bg-green-500',
  },
  {
    name: 'gelb',
    label: 'Gelb',
    klasse: 'bg-yellow-400 dark:bg-yellow-500',
  },
  {
    name: 'rot',
    label: 'Rot',
    klasse: 'bg-red-400 dark:bg-red-500',
  },
];

const notizBreite = (notiz) => {
  const laenge = String(notiz?.text || '').trim().length;

  if (laenge <= 55) return 'md:col-span-1';
  return 'md:col-span-2';
};

const formatZeitpunkt = (value) => {
  if (!value) return '–';

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const wurdeBearbeitet = (notiz) => {
  if (!notiz?.created_at || !notiz?.updated_at) return false;

  return (
    Math.abs(
      new Date(notiz.updated_at).getTime() -
        new Date(notiz.created_at).getTime()
    ) > 1000
  );
};

const SelfNotizen = () => {
  const { userId } = useRollen();

  const [notizen, setNotizen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOffen, setEditorOffen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [inhalt, setInhalt] = useState('');
  const [farbe, setFarbe] = useState('neutral');
  const [speichert, setSpeichert] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const sortierteNotizen = useMemo(
    () =>
      [...notizen].sort((a, b) => {
        if (a.angepinnt !== b.angepinnt) {
          return a.angepinnt ? -1 : 1;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      }),
    [notizen]
  );

  const ladeNotizen = async () => {
    if (!userId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('DB_PrivateNotiz')
      .select('id, text, farbe, angepinnt, created_at, updated_at')
      .order('angepinnt', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        '❌ Fehler beim Laden privater Notizen:',
        error.message || error
      );
    } else {
      setNotizen(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    ladeNotizen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const editorSchliessen = () => {
    setEditorOffen(false);
    setEditingId(null);
    setInhalt('');
    setFarbe('neutral');
  };

  const neueNotiz = () => {
    setEditingId(null);
    setInhalt('');
    setFarbe('neutral');
    setEditorOffen(true);
  };

  const bearbeiten = (notiz) => {
    setEditingId(notiz.id);
    setInhalt(notiz.text || '');
    setFarbe(notiz.farbe || 'neutral');
    setEditorOffen(true);
  };

  const speichern = async () => {
    const clean = inhalt.trim();
    if (!userId || !clean || speichert) return;

    setSpeichert(true);

    if (editingId) {
      const { data, error } = await supabase
        .from('DB_PrivateNotiz')
        .update({
          text: clean,
          farbe,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .select('id, text, farbe, angepinnt, created_at, updated_at')
        .single();

      if (error) {
        console.error(
          '❌ Fehler beim Bearbeiten der Notiz:',
          error.message || error
        );
      } else {
        setNotizen((prev) =>
          prev.map((item) => (item.id === data.id ? data : item))
        );
        editorSchliessen();
      }
    } else {
      const { data, error } = await supabase
        .from('DB_PrivateNotiz')
        .insert({
          user_id: userId,
          text: clean,
          farbe,
          angepinnt: false,
        })
        .select('id, text, farbe, angepinnt, created_at, updated_at')
        .single();

      if (error) {
        console.error(
          '❌ Fehler beim Erstellen der Notiz:',
          error.message || error
        );
      } else {
        setNotizen((prev) => [data, ...prev]);
        editorSchliessen();
      }
    }

    setSpeichert(false);
  };

  const pinUmschalten = async (notiz) => {
    const next = !notiz.angepinnt;

    const { error } = await supabase
      .from('DB_PrivateNotiz')
      .update({
        angepinnt: next,
      })
      .eq('id', notiz.id);

    if (error) {
      console.error(
        '❌ Fehler beim Anpinnen der Notiz:',
        error.message || error
      );
      return;
    }

    setNotizen((prev) =>
      prev.map((item) =>
        item.id === notiz.id
          ? { ...item, angepinnt: next }
          : item
      )
    );
  };

  const loeschen = async (notiz) => {
    const { error } = await supabase
      .from('DB_PrivateNotiz')
      .delete()
      .eq('id', notiz.id);

    if (error) {
      console.error(
        '❌ Fehler beim Löschen der Notiz:',
        error.message || error
      );
      return;
    }

    setNotizen((prev) =>
      prev.filter((item) => item.id !== notiz.id)
    );
    setDeleteConfirmId(null);
  };

  return (
    <section className="h-full rounded-xl border border-gray-300 bg-gray-100/80 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/35">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Private Notizen</h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Nur für dich sichtbar
          </p>
        </div>

        <button
          type="button"
          onClick={neueNotiz}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <Plus size={14} />
          Notiz
        </button>
      </div>

      {editorOffen && (
        <div className="mb-3 rounded-lg border border-gray-300 bg-white/80 p-2 dark:border-gray-600 dark:bg-gray-800/80">
          <textarea
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            placeholder="Was möchtest du dir merken?"
            rows={4}
            maxLength={1000}
            autoFocus
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {FARBAUSWAHL.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setFarbe(option.name)}
                  title={option.label}
                  aria-label={`Notizfarbe ${option.label}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                    farbe === option.name
                      ? 'scale-110 border-gray-900 ring-2 ring-gray-400 ring-offset-1 dark:border-white dark:ring-gray-500 dark:ring-offset-gray-800'
                      : 'border-white/80 hover:scale-105 dark:border-gray-700'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${option.klasse}`}
                  >
                    {farbe === option.name && (
                      <Check size={12} className="text-white drop-shadow" />
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={editorSchliessen}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <X size={14} />
                Abbrechen
              </button>

              <button
                type="button"
                onClick={speichern}
                disabled={!inhalt.trim() || speichert}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={14} />
                {speichert ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pr-1" style={{ maxHeight: 420, overflowY: 'auto', scrollbarGutter: 'stable' }}>
        {loading && (
          <div className="py-8 text-center text-xs text-gray-500">
            Notizen werden geladen...
          </div>
        )}

        {!loading && !sortierteNotizen.length && (
          <div className="rounded-lg border border-dashed border-gray-300 px-3 py-8 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Noch keine private Notiz vorhanden.
          </div>
        )}

        {!loading && !!sortierteNotizen.length && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:auto-rows-min">
            {sortierteNotizen.map((notiz) => (
            <article
              key={notiz.id}
              className={`min-w-0 rounded-lg border p-3 shadow-sm ${
                notizBreite(notiz)
              } ${FARBEN[notiz.farbe] || FARBEN.neutral}`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
                  {notiz.text}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => pinUmschalten(notiz)}
                    title={
                      notiz.angepinnt
                        ? 'Nicht mehr anpinnen'
                        : 'Oben anpinnen'
                    }
                    className="rounded p-1 text-current opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    {notiz.angepinnt ? (
                      <PinOff size={14} />
                    ) : (
                      <Pin size={14} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => bearbeiten(notiz)}
                    title="Notiz bearbeiten"
                    className="rounded p-1 text-current opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <Edit3 size={14} />
                  </button>

                  {deleteConfirmId === notiz.id ? (
                    <div className="flex items-center gap-1 rounded-md bg-white/70 p-1 text-[10px] shadow-sm dark:bg-gray-900/60">
                      <span className="px-1 font-medium">Löschen?</span>
                      <button
                        type="button"
                        onClick={() => loeschen(notiz)}
                        className="rounded bg-red-600 px-1.5 py-0.5 text-white hover:bg-red-700"
                      >
                        Ja
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded px-1.5 py-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        Nein
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(notiz.id)}
                      title="Notiz löschen"
                      className="rounded p-1 text-current opacity-60 hover:bg-red-200/70 hover:text-red-800 hover:opacity-100 dark:hover:bg-red-950/50 dark:hover:text-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-current/15 pt-2 text-[10px] opacity-75">
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={11} />
                  {wurdeBearbeitet(notiz) ? 'Bearbeitet' : 'Erstellt'}:{' '}
                  {formatZeitpunkt(
                    wurdeBearbeitet(notiz)
                      ? notiz.updated_at
                      : notiz.created_at
                  )}
                </span>

                {notiz.angepinnt && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Pin size={11} />
                    Angepinnt
                  </span>
                )}
              </div>
            </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SelfNotizen;
