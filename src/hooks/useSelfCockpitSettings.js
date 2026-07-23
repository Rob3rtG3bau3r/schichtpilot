import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';

const DEFAULT_SETTINGS = {
  notizenVisible: true,
  zeitVisible: true,
  abwesenheitenVisible: true,
  abwesenheitIds: [],
};

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

  const [employeeSichtbarkeit, setEmployeeSichtbarkeit] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const laden = async () => {
      setLoading(true);

      if (!userId || !unit) {
        if (alive) {
          setEmployeeSichtbarkeit(null);
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
        }
        return;
      }

      const [unitRes, settingsRes] = await Promise.all([
        supabase
          .from('DB_Unit')
          .select('employee_sichtbarkeit')
          .eq('id', unit)
          .maybeSingle(),

        supabase
          .from('DB_UserSettings')
          .select(`
            cockpit_self_notizen_visible,
            cockpit_self_zeit_visible,
            cockpit_self_abwesenheiten_visible,
            cockpit_self_abwesenheit_ids
          `)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (!alive) return;

      if (unitRes.error) {
        console.error(
          '❌ Fehler beim Laden der Employee-Sichtbarkeit:',
          unitRes.error.message || unitRes.error
        );
      }

      if (settingsRes.error) {
        console.error(
          '❌ Fehler beim Laden der Self-Cockpit-Einstellungen:',
          settingsRes.error.message || settingsRes.error
        );
      }

      setEmployeeSichtbarkeit(
        unitRes.data?.employee_sichtbarkeit || 'unit'
      );

      const row = settingsRes.data;

      setSettings({
        notizenVisible:
          row?.cockpit_self_notizen_visible ?? true,
        zeitVisible:
          row?.cockpit_self_zeit_visible ?? true,
        abwesenheitenVisible:
          row?.cockpit_self_abwesenheiten_visible ?? true,
        abwesenheitIds:
          normalizeIds(row?.cockpit_self_abwesenheit_ids),
      });

      setLoading(false);
    };

    laden();

    return () => {
      alive = false;
    };
  }, [userId, unit, firma]);

  const updateSettings = useCallback(
    async (patch) => {
      if (!userId) return false;

      const next = {
        ...settings,
        ...patch,
      };

      next.abwesenheitIds = normalizeIds(next.abwesenheitIds);
      setSettings(next);

      const payload = {
        user_id: userId,
        cockpit_self_notizen_visible: next.notizenVisible,
        cockpit_self_zeit_visible: next.zeitVisible,
        cockpit_self_abwesenheiten_visible:
          next.abwesenheitenVisible,
        cockpit_self_abwesenheit_ids: next.abwesenheitIds,
      };

      const { error } = await supabase
        .from('DB_UserSettings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.error(
          '❌ Fehler beim Speichern der Self-Cockpit-Einstellungen:',
          error.message || error
        );
        return false;
      }

      return true;
    },
    [settings, userId]
  );

  return {
    selfAnsichtAktiv:
      rolle === 'Employee' &&
      employeeSichtbarkeit === 'self',
    settings,
    updateSettings,
    loading,
  };
};

export default useSelfCockpitSettings;
