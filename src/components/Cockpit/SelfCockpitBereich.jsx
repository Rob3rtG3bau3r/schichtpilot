import React from 'react';
import SelfNotizen from './SelfNotizen';
import SelfZeitkonto from './SelfZeitkonto';
import SelfAbwesenheiten from './SelfAbwesenheiten';

const SelfCockpitBereich = ({
  settings,
  jahr,
  refreshKey,
  selfAnsichtAktiv = false,
}) => {
  const notizenVisible = !!settings?.notizenVisible;
  const zeitVisible =
    selfAnsichtAktiv && !!settings?.zeitVisible;
  const abwesenheitenVisible =
    selfAnsichtAktiv && !!settings?.abwesenheitenVisible;

  const sichtbareBereiche = [
    notizenVisible,
    zeitVisible,
    abwesenheitenVisible,
  ].filter(Boolean).length;

  if (!sichtbareBereiche) return null;

  if (!selfAnsichtAktiv) {
    return (
      <div
        id="sp-private-notizen"
        className="mt-3 scroll-mt-3 xl:max-w-[760px]"
      >
        {notizenVisible && <SelfNotizen />}
      </div>
    );
  }

  return (
    <div
      id="sp-private-notizen"
      className="mt-3 grid scroll-mt-3 grid-cols-1 gap-3 xl:grid-cols-5"
    >
      {notizenVisible && (
        <div className="xl:col-span-2">
          <SelfNotizen />
        </div>
      )}

      {zeitVisible && (
        <div className="xl:col-span-1">
          <SelfZeitkonto
            jahr={jahr}
            refreshKey={refreshKey}
          />
        </div>
      )}

      {abwesenheitenVisible && (
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
