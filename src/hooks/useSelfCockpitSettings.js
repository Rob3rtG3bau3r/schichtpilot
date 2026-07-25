import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';

const DEFAULT_SETTINGS = {
  notizenVisible: true,
  zeitVisible: true,
  abwesenheitenVisible: true,
  abwesenheitIds: [],
  floatingOpen: false,
};

const ERLAUBTE_ROLLEN = [
  'Employee',
  'Team_Leader',
  'Planner',
  'Admin_Dev',
];

const normalizeIds = (value) =>
  Array.isArray(value)
    ? value
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    : [];

const useSelfCockpitSettings = () => {
  const {
    sichtFirma: firma,
    sichtUnit: unit,
    userId,
    rolle,
  } = useRollen();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const persoenlicherBereichVerfuegbar =
    ERLAUBTE_ROLLEN.includes(rolle);

  useEffect(() => {
    let alive = true;

    const laden = async () => {
      if (!userId || !persoenlicherBereichVerfuegbar) {
        if (alive) {
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('DB_UserSettings')
        .select(`
          cockpit_self_notizen_visible,
          cockpit_self_zeit_visible,
          cockpit_self_abwesenheiten_visible,
          cockpit_self_abwesenheit_ids,
          cockpit_self_floating_open
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.error(
          '❌ Fehler beim Laden der persönlichen Cockpit-Einstellungen:',
          error.message || error
        );
      }

      setSettings({
        notizenVisible:
          data?.cockpit_self_notizen_visible ?? true,
        zeitVisible:
          data?.cockpit_self_zeit_visible ?? true,
        abwesenheitenVisible:
          data?.cockpit_self_abwesenheiten_visible ?? true,
        abwesenheitIds:
          normalizeIds(data?.cockpit_self_abwesenheit_ids),
        floatingOpen:
          data?.cockpit_self_floating_open ?? false,
      });

      setLoading(false);
    };

    laden();

    return () => {
      alive = false;
    };
  }, [
    userId,
    rolle,
    firma,
    unit,
    persoenlicherBereichVerfuegbar,
  ]);

  const updateSettings = useCallback(
    async (patch) => {
      if (!userId || !persoenlicherBereichVerfuegbar) {
        return false;
      }

      const next = {
        ...settings,
        ...patch,
      };

      next.abwesenheitIds = normalizeIds(next.abwesenheitIds);
      setSettings(next);

      const { error } = await supabase
        .from('DB_UserSettings')
        .upsert(
          {
            user_id: userId,
            cockpit_self_notizen_visible: next.notizenVisible,
            cockpit_self_zeit_visible: next.zeitVisible,
            cockpit_self_abwesenheiten_visible:
              next.abwesenheitenVisible,
            cockpit_self_abwesenheit_ids:
              next.abwesenheitIds,
            cockpit_self_floating_open:
              !!next.floatingOpen,
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error(
          '❌ Fehler beim Speichern der persönlichen Cockpit-Einstellungen:',
          error.message || error
        );
        return false;
      }

      return true;
    },
    [
      settings,
      userId,
      persoenlicherBereichVerfuegbar,
    ]
  );

  return {
    persoenlicherBereichVerfuegbar,
    settings,
    updateSettings,
    loading,
  };
};

export default useSelfCockpitSettings;
