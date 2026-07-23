import React from 'react';
import SelfNotizen from './SelfNotizen';
import SelfZeitkonto from './SelfZeitkonto';
import SelfAbwesenheiten from './SelfAbwesenheiten';

const SelfCockpitBereich = ({
  settings,
  jahr,
  refreshKey,
}) => {
  const sichtbareBereiche = [
    settings?.notizenVisible,
    settings?.zeitVisible,
    settings?.abwesenheitenVisible,
  ].filter(Boolean).length;

  if (!sichtbareBereiche) return null;

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
      {settings?.notizenVisible && (
        <div className="xl:col-span-2">
          <SelfNotizen />
        </div>
      )}

      {settings?.zeitVisible && (
        <div className="xl:col-span-1">
          <SelfZeitkonto
            jahr={jahr}
            refreshKey={refreshKey}
          />
        </div>
      )}

      {settings?.abwesenheitenVisible && (
        <div className="xl:col-span-2">
          <SelfAbwesenheiten
            schichtartIds={settings?.abwesenheitIds || []}
            refreshKey={refreshKey}
          />
        </div>
      )}
    </div>
  );
};

export default SelfCockpitBereich;
