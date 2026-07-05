// src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import {
  Users,
  BarChart3,
  CalendarCheck,
  Info,
} from 'lucide-react';

import { useRollen } from '../context/RollenContext';
import { supabase } from '../supabaseClient';

import TagesUebersicht from '../components/Dashboard/TagesUebersicht';
import MeineDienste from '../components/Dashboard/MeineDienste';
import AnfragenMitarbeiter from '../components/Dashboard/AnfragenMitarbeiter';
import MeineEingetragenenDienste from '../components/Dashboard/MeineEingetragenenDienste';
import MeineUebersicht from '../components/Dashboard/MeineUebersicht';
import TeamPflegen from '../components/Dashboard/TeamPflegen';
import MitarbeiterEskalation from '../components/Dashboard/MitarbeiterEskalation';
import UnitInfos from '../components/Dashboard/UnitInfos';

const cls = (...classes) => classes.filter(Boolean).join(' ');

const DashboardCard = ({
  title,
  subtitle,
  badge,
  children,
  className = '',
  compact = false,
}) => {
  return (
    <section
      className={cls(
        'rounded-2xl border border-gray-200 dark:border-gray-700/80',
        'bg-white dark:bg-gray-900/60',
        'shadow-sm overflow-visible',
        className
      )}
    >
      {(title || subtitle || badge) && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-800/30">
          <div>
            {title && (
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
                {title}
              </h2>
            )}

            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          {badge && (
            <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900">
              {badge}
            </span>
          )}
        </div>
      )}

      <div className={compact ? 'p-2' : 'p-3'}>
        {children}
      </div>
    </section>
  );
};

const BereichButton = ({ active, icon: Icon, label, hint, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        'group flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all',
        'min-h-[58px]',
        active
          ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
          : 'border-blue-300 bg-blue-200/70 text-blue-950 hover:border-blue-500 hover:bg-blue-200/80 dark:border-blue-800/50 dark:bg-blue-950/20 dark:text-gray-200 dark:hover:bg-blue-900/30'
      )}
    >
      {Icon && (
        <span
          className={cls(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
            active
              ? 'bg-white/15 text-white'
              : 'bg-blue-200/80 text-blue-700 group-hover:bg-blue-300/70 group-hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:group-hover:text-blue-200'
          )}
        >
          <Icon size={16} />
        </span>
      )}

      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">
          {label}
        </span>

        {hint && (
          <span
            className={cls(
              'block text-[11px] leading-tight truncate mt-0.5',
              active ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  );
};

const Dashboard = () => {
  const { rolle, userId, sichtUnit: unit } = useRollen();

  const [istInKampfliste, setIstInKampfliste] = useState(false);
  const [tagesuebersichtAktiv, setTagesuebersichtAktiv] = useState(false);
  const [aktiverBereich, setAktiverBereich] = useState(null);

const bereichRef = useRef(null);

  const darfTeamPflegenSehen = ['Team_Leader', 'Planner', 'Admin_Dev'].includes(rolle);

  // 1) Heutige Kampfliste prüfen
  useEffect(() => {
    const checkKampfliste = async () => {
      try {
        if (!rolle || !userId || !unit) return;

        const heute = dayjs().format('YYYY-MM-DD');

        const { data, error } = await supabase
          .from('DB_Kampfliste')
          .select('id')
          .eq('unit_id', unit)
          .eq('user', userId)
          .eq('datum', heute)
          .maybeSingle();

        if (error) throw error;

        setIstInKampfliste(!!data);
      } catch (err) {
        console.error('Fehler bei Kampfliste-Prüfung:', err?.message || err);
        setIstInKampfliste(false);
      }
    };

    checkKampfliste();
  }, [rolle, userId, unit]);

  // 2) Feature-Check Tagesübersicht
  useEffect(() => {
    const checkTagesFeature = async () => {
      try {
        if (!unit) {
          setTagesuebersichtAktiv(false);
          return;
        }

        const { data, error } = await supabase.rpc('tagesuebersicht_enabled', {
          p_unit_id: unit,
        });

        if (error) throw error;

        setTagesuebersichtAktiv(!!data);
      } catch (err) {
        console.error('Feature-Check Tagesübersicht:', err?.message || err);
        setTagesuebersichtAktiv(false);
      }
    };

    checkTagesFeature();
  }, [unit]);

  // MeineDienste: Employee/Team_Leader immer; Planner/Admin_Dev nur wenn heute gebucht
  const darfMeineDiensteSehen =
    rolle === 'Employee' ||
    rolle === 'Team_Leader' ||
    ((rolle === 'Planner' || rolle === 'Admin_Dev') && istInKampfliste);

  // MeineUebersicht: Employee/Team_Leader oder wenn heute gebucht
  const darfUebersichtSehen =
    rolle === 'Employee' || rolle === 'Team_Leader' || istInKampfliste;

  // Tagesübersicht nur für Planner/Admin_Dev UND wenn Feature aktiv ist
  const darfTagesuebersichtSehen =
    (rolle === 'Planner' || rolle === 'Admin_Dev') &&
    tagesuebersichtAktiv === true;

  const darfEigeneEintraegeSehen = ['Planner', 'Admin_Dev'].includes(rolle);

  const bereiche = useMemo(() => {
    const items = [];

    if (darfTeamPflegenSehen) {
      items.push({
        key: 'team',
        label: 'Team',
        hint: 'Team und Statistiken',
        icon: Users,
      });
    }

    if (darfUebersichtSehen) {
      items.push({
        key: 'uebersicht',
        label: 'Meine Übersicht',
        //hint: 'Stunden und Urlaub',
        icon: BarChart3,
      });
    }

    if (darfEigeneEintraegeSehen) {
      items.push({
        key: 'eintraege',
        label: 'Eigene Einträge',
       // hint: 'Dienste außerhalb der Gruppe',
        icon: CalendarCheck,
      });
    }

    // Platzhalter für später: Unit-Infos
    if (['Planner', 'Admin_Dev'].includes(rolle)) {
      items.push({
        key: 'unitinfos',
        label: 'Unit-Infos',
        //hint: 'Hinweise verwalten',
        icon: Info,
      });
    }

    return items;
  }, [darfTeamPflegenSehen, darfUebersichtSehen, darfEigeneEintraegeSehen, rolle]);

  useEffect(() => {
    if (!aktiverBereich && bereiche.length > 0) {
      setAktiverBereich(bereiche[0].key);
    }

    if (aktiverBereich && !bereiche.some((b) => b.key === aktiverBereich)) {
      setAktiverBereich(bereiche[0]?.key || null);
    }
  }, [bereiche, aktiverBereich]);

  const openBereich = (key) => {
    setAktiverBereich(key);

    window.setTimeout(() => {
      bereichRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 60);
  };

  const renderAktiverBereich = () => {
    if (aktiverBereich === 'team') {
      return <TeamPflegen />;
    }

    if (aktiverBereich === 'uebersicht') {
      return darfUebersichtSehen ? <MeineUebersicht /> : null;
    }

    if (aktiverBereich === 'eintraege') {
      return <MeineEingetragenenDienste />;
    }

if (aktiverBereich === 'unitinfos') {
  return <UnitInfos />;
}

    return null;
  };

  const aktiverBereichMeta = bereiche.find((b) => b.key === aktiverBereich);

  return (
  <div className="p-1">
    <div className="grid grid-cols-12 gap-3">
        {/* Linke Spalte bleibt fest wie bisher */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-3">
          <DashboardCard
            title="Heute"
            compact
            subtitle={
              darfTagesuebersichtSehen
                ? 'Aktuelle Tagesübersicht deiner Unit'
                : 'Deine Dienste und persönlichen Tagesinformationen'
            }
            badge={dayjs().format('DD.MM.YYYY')}
          >
            <div className="space-y-2">
              {darfTagesuebersichtSehen && <TagesUebersicht />}

              {darfMeineDiensteSehen && <MeineDienste />}

              {!darfTagesuebersichtSehen && !darfMeineDiensteSehen && (
                <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  Für heute liegen keine eigenen Dienste oder Tagesinformationen vor.
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Rechte Spalte: wichtige Aufgaben immer sichtbar + steuerbarer Detailbereich */}
        <div className="col-span-12 md:col-span-8 flex flex-col gap-3">
          <DashboardCard
            title="Aufgaben"
            compact
            subtitle="Anfragen und Eskalationen bleiben immer direkt sichtbar"
          >
            <div className="space-y-2">
              <AnfragenMitarbeiter />
              <MitarbeiterEskalation />
            </div>
          </DashboardCard>

        {bereiche.length > 0 && (
          <div ref={bereichRef} className="scroll-mt-4">
            <DashboardCard
              title="Dashboard-Bereiche"
              compact
              //subtitle="Öffne zusätzliche Bereiche, ohne die wichtigsten Aufgaben zu verlieren"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {bereiche.map((bereich) => (
                  <BereichButton
                    key={bereich.key}
                    active={aktiverBereich === bereich.key}
                    icon={bereich.icon}
                    label={bereich.label}
                    hint={bereich.hint}
                    onClick={() => openBereich(bereich.key)}
                  />
                ))}
              </div>
               </DashboardCard>
              </div>
            )}

          {aktiverBereich && (
            <div>
              <DashboardCard
                title={aktiverBereichMeta?.label}
                subtitle={aktiverBereichMeta?.hint}
              >
                {renderAktiverBereich()}
              </DashboardCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;