import React, { useEffect, useState } from 'react';
import { Clock3, Umbrella } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const fmt2 = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '–';
};

const SelfZeitkonto = ({ jahr, refreshKey }) => {
  const {
    sichtFirma: firma,
    sichtUnit: unit,
    userId,
  } = useRollen();

  const [loading, setLoading] = useState(true);
  const [urlaub, setUrlaub] = useState(null);
  const [stunden, setStunden] = useState(null);

  useEffect(() => {
    let alive = true;

    const laden = async () => {
      if (!firma || !unit || !userId || !jahr) return;

      setLoading(true);

      const [urlaubRes, stundenRes, abzugRes] = await Promise.all([
        supabase
          .from('DB_Urlaub')
          .select('urlaub_gesamt, summe_jahr')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('user_id', userId)
          .eq('jahr', Number(jahr))
          .maybeSingle(),

        supabase
          .from('DB_Stunden')
          .select('vorgabe_stunden, summe_jahr, uebernahme_vorjahr')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('user_id', userId)
          .eq('jahr', Number(jahr))
          .maybeSingle(),

        supabase
          .from('DB_StundenAbzug')
          .select('stunden')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('user_id', userId)
          .eq('jahr', Number(jahr)),
      ]);

      if (!alive) return;

      if (urlaubRes.error) {
        console.error(
          '❌ Fehler beim Laden des Urlaubsstands:',
          urlaubRes.error.message || urlaubRes.error
        );
      }

      if (stundenRes.error) {
        console.error(
          '❌ Fehler beim Laden des Stundenstands:',
          stundenRes.error.message || stundenRes.error
        );
      }

      if (abzugRes.error) {
        console.error(
          '❌ Fehler beim Laden des Stundenabzugs:',
          abzugRes.error.message || abzugRes.error
        );
      }

      const urlaubRow = urlaubRes.data;
      if (urlaubRow) {
        const gesamt = Number(urlaubRow.urlaub_gesamt) || 0;
        const genommen = Number(urlaubRow.summe_jahr) || 0;
        setUrlaub({
          gesamt,
          genommen,
          rest: gesamt - genommen,
        });
      } else {
        setUrlaub(null);
      }

      const stundenRow = stundenRes.data;
      if (stundenRow) {
        const vorgabe = Number(stundenRow.vorgabe_stunden) || 0;
        const summeJahr = Number(stundenRow.summe_jahr) || 0;
        const uebernahme =
          Number(stundenRow.uebernahme_vorjahr) || 0;
        const abzug = (abzugRes.data || []).reduce(
          (sum, row) => sum + (Number(row.stunden) || 0),
          0
        );

        const ist = summeJahr - abzug + uebernahme;

        setStunden({
          vorgabe,
          ist,
          saldo: ist - vorgabe,
        });
      } else {
        setStunden(null);
      }

      setLoading(false);
    };

    laden();

    return () => {
      alive = false;
    };
  }, [firma, unit, userId, jahr, refreshKey]);

  return (
    <section className="h-full rounded-xl border border-gray-300 bg-gray-100/80 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/35">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Zeit & Urlaub</h2>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Stand {jahr}
        </p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500">
          Daten werden geladen...
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-300 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-900/45">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              <Clock3 size={15} />
              Stundenkonto
            </div>

            <div
              className={`text-xl font-semibold ${
                (stunden?.saldo ?? 0) < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {stunden
                ? `${stunden.saldo >= 0 ? '+' : ''}${fmt2(
                    stunden.saldo
                  )} Std.`
                : '–'}
            </div>

            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {stunden
                ? `${fmt2(stunden.ist)} / ${fmt2(
                    stunden.vorgabe
                  )} Std.`
                : 'Kein Stundenkonto vorhanden'}
            </div>
          </div>

          <div className="rounded-lg border border-gray-300 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-900/45">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              <Umbrella size={15} />
              Urlaub
            </div>

            <div
              className={`text-xl font-semibold ${
                (urlaub?.rest ?? 0) < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {urlaub ? `${fmt2(urlaub.rest)} Tage` : '–'}
            </div>

            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {urlaub
                ? `${fmt2(urlaub.genommen)} / ${fmt2(
                    urlaub.gesamt
                  )} Tage genommen`
                : 'Kein Urlaubskonto vorhanden'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SelfZeitkonto;
