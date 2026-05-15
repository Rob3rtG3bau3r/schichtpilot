import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import {
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  XCircle,
} from 'lucide-react';
import { useRollen } from '../../context/RollenContext';
import AnfragenMitarbeiterAnalyseModal from '../Dashboard/AnfragenMitarbeiterAnalyseModal';

const sortIcon = (activeKey, thisKey, dir) => {
  if (activeKey !== thisKey) {
    return <ArrowUpDown className="w-3 h-3 inline-block opacity-60" />;
  }

  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3.5 inline-block" />
    : <ArrowDown className="w-3 h-3.5 inline-block" />;
};

// 1 = genehmigt, -1 = abgelehnt, 0 = offen
// robust gegen 0/1/"true"/"false"/"t"/"f"
const triStatus = (v) => {
  if (
    v === true ||
    v === 1 ||
    v === '1' ||
    v === 'true' ||
    v === 't' ||
    v === 'TRUE' ||
    v === 'T'
  ) {
    return 1;
  }

  if (
    v === false ||
    v === 0 ||
    v === '0' ||
    v === 'false' ||
    v === 'f' ||
    v === 'FALSE' ||
    v === 'F'
  ) {
    return -1;
  }

  return 0;
};

const quelleKurz = (v) => {
  const t = (v || '').toString().trim().toLowerCase();

  if (t === 'mobile') return 'M';
  if (t === 'webapp') return 'W';

  return '-';
};

const istAngebot = (a) => {
  const txt = (a?.antrag || '').toLowerCase();

  return (
    txt.includes('freiwillig') ||
    txt.includes('biete') ||
    txt.includes('einspring') ||
    txt.includes('angeboten')
  );
};

const AnfragenMitarbeiter = () => {
  const { userId, rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [alleAnfragen, setAlleAnfragen] = useState([]);
  const [activeTab, setActiveTab] = useState('offen'); // 'offen' | 'genehmigt' | 'abgelehnt'
  const [modalAnfrage, setModalAnfrage] = useState(null);
  const [bereichOffen, setBereichOffen] = useState(true);
  const [infoModalOffen, setInfoModalOffen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState({ key: 'datum', dir: 'asc' }); // datum | schicht | created_at | datum_entscheid
  const [zurueckziehenId, setZurueckziehenId] = useState(null);

  useEffect(() => {
    const ladeAnfragen = async () => {
      if (!firma || !unit) return;

      let query = supabase
        .from('DB_AnfrageMA')
        .select(
          `
          *,
          created_by_user:created_by (
            vorname,
            nachname
          ),
          verantwortlicher_user:verantwortlicher (
            vorname,
            nachname
          )
        `
        )
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (rolle === 'Employee') {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Fehler beim Laden:', error.message);
        return;
      }

      setAlleAnfragen(data || []);
    };

    ladeAnfragen();
  }, [rolle, firma, unit, userId, refreshKey]);

  // Zähler nach Normalisierung
  const counts = useMemo(() => {
    let offen = 0;
    let genehmigt = 0;
    let abgelehnt = 0;

    (alleAnfragen || []).forEach((a) => {
      const s = triStatus(a.genehmigt);

      if (s === 1) {
        genehmigt++;
      } else if (s === -1) {
        abgelehnt++;
      } else if (s === 0 && a.datum_entscheid == null) {
        offen++;
      }
    });

    return { offen, genehmigt, abgelehnt };
  }, [alleAnfragen]);

  // Filtern + Sortieren
  const anfragen = useMemo(() => {
    const filtered = (alleAnfragen || []).filter((a) => {
      const s = triStatus(a.genehmigt);

      if (activeTab === 'offen') {
        return s === 0 && a.datum_entscheid == null;
      }

      if (activeTab === 'genehmigt') {
        return s === 1;
      }

      if (activeTab === 'abgelehnt') {
        return s === -1;
      }

      return false;
    });

    const dirMul = sort.dir === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      const getVal = (row) => {
        switch (sort.key) {
          case 'datum':
            return row.datum ? dayjs(row.datum).valueOf() : -Infinity;

          case 'schicht':
            return (row.schicht || '').toString().toLowerCase();

          case 'created_at':
            return row.created_at ? dayjs(row.created_at).valueOf() : -Infinity;

          case 'datum_entscheid':
            return row.datum_entscheid ? dayjs(row.datum_entscheid).valueOf() : -Infinity;

          default:
            return 0;
        }
      };

      const va = getVal(a);
      const vb = getVal(b);

      if (va < vb) return -1 * dirMul;
      if (va > vb) return 1 * dirMul;

      return 0;
    });
  }, [alleAnfragen, activeTab, sort]);

  // Offene Einspring-Angebote pro Datum + Schicht bündeln
const anfragenGebündelt = useMemo(() => {
  const gruppen = new Map();

  for (const a of anfragen || []) {
    const s = triStatus(a.genehmigt);
    const istOffen = s === 0 && a.datum_entscheid == null;

    // Nur offene Angebote bündeln.
    // Urlaub/Frei/Freizeitausgleich bleiben einzelne Einträge.
    if (!istOffen || !istAngebot(a)) {
      gruppen.set(`single_${a.id}`, {
        ...a,
        gruppenAnfragen: [a],
        gruppenAnzahl: 1,
        istGebündelt: false,
      });
      continue;
    }

    const datumKey = a.datum
      ? dayjs(a.datum).format('YYYY-MM-DD')
      : 'kein_datum';

    const schichtKey = (a.schicht || '').trim() || 'keine_schicht';

    const key = `angebot_${datumKey}_${schichtKey}`;

    if (!gruppen.has(key)) {
      gruppen.set(key, {
        ...a,
        gruppenAnfragen: [a],
        gruppenAnzahl: 1,
        istGebündelt: false,
      });
    } else {
      const vorhandeneGruppe = gruppen.get(key);

      const neueGruppe = [...vorhandeneGruppe.gruppenAnfragen, a].sort((x, y) =>
        dayjs(x.created_at).valueOf() - dayjs(y.created_at).valueOf()
      );

      const hauptAnfrage = neueGruppe[0];

      gruppen.set(key, {
        ...hauptAnfrage,
        gruppenAnfragen: neueGruppe,
        gruppenAnzahl: neueGruppe.length,
        istGebündelt: neueGruppe.length > 1,
      });
    }
  }

  return Array.from(gruppen.values());
}, [anfragen]);

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key !== key
        ? { key, dir: 'asc' }
        : { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    );
  };

  const anfrageZurueckziehen = async (e, anfrage) => {
    e.stopPropagation();

    if (!anfrage?.id) return;

    const sicher = window.confirm(
      'Möchtest du diesen Antrag wirklich zurückziehen?\n\nDer Antrag wird nicht gelöscht, sondern als abgelehnt durch dich selbst gespeichert.'
    );

    if (!sicher) return;

    setZurueckziehenId(anfrage.id);

    const { error } = await supabase
      .from('DB_AnfrageMA')
      .update({
        genehmigt: false,
        verantwortlicher: userId,
        datum_entscheid: new Date().toISOString(),
      })
      .eq('id', anfrage.id)
      .eq('created_by', userId)
      .is('datum_entscheid', null);

    setZurueckziehenId(null);

    if (error) {
      console.error('Fehler beim Zurückziehen:', error.message);
      alert('Der Antrag konnte nicht zurückgezogen werden.');
      return;
    }

    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl p-1 border border-gray-300 dark:border-gray-700">
      {/* Kopf */}
      <div
        onClick={() => setBereichOffen((prev) => !prev)}
        role="button"
        tabIndex={0}
        className="w-full flex justify-between items-center py-3 bg-gray-200 dark:bg-gray-800 rounded-xl transition-all"
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') &&
          setBereichOffen((prev) => !prev)
        }
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white">
          {bereichOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span>Anfragen</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInfoModalOffen(true);
            }}
            title="Mehr Infos"
          >
            <Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setRefreshKey((prev) => prev + 1);
            }}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            title="Neu laden"
          >
            <RefreshCcw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Inhalt */}
      {bereichOffen && (
        <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-b-xl">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1.5 rounded-full text-sm ${
                  activeTab === 'offen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200'
                }`}
                onClick={() => setActiveTab('offen')}
              >
                Offen ({counts.offen})
              </button>

              <button
                className={`px-3 py-1.5 rounded-full text-sm ${
                  activeTab === 'genehmigt'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200'
                }`}
                onClick={() => setActiveTab('genehmigt')}
              >
                Genehmigt ({counts.genehmigt})
              </button>

              <button
                className={`px-3 py-1.5 rounded-full text-sm ${
                  activeTab === 'abgelehnt'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200'
                }`}
                onClick={() => setActiveTab('abgelehnt')}
              >
                Abgelehnt ({counts.abgelehnt})
              </button>
            </div>
          </div>

          {/* Tabelle */}
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-300 text-left">
                  <th
                    className="p-2 cursor-pointer select-none"
                    onClick={() => toggleSort('datum')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Datum {sortIcon(sort.key, 'datum', sort.dir)}
                    </span>
                  </th>

                  <th
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort('schicht')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Schicht {sortIcon(sort.key, 'schicht', sort.dir)}
                    </span>
                  </th>

                  <th>Von</th>
                  <th>Antrag</th>

                  <th
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort('created_at')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Erstellt {sortIcon(sort.key, 'created_at', sort.dir)}
                    </span>
                  </th>

                  <th>Status</th>
                  <th>Entscheider</th>

                  <th
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort('datum_entscheid')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Entschieden am{' '}
                      {sortIcon(sort.key, 'datum_entscheid', sort.dir)}
                    </span>
                  </th>

                  <th>Aktion</th>
                </tr>
              </thead>

              <tbody>
                {anfragenGebündelt.map((a) => {
                  const s = triStatus(a.genehmigt);
                  const istOffen = s === 0 && a.datum_entscheid == null;
                  const darfZurueckziehen = istOffen && a.created_by === userId;

                  return (
                    <tr
                      key={a.id}
                      onClick={() => {
                        if (!istOffen) return;

                        // Employee darf nicht entscheiden.
                        // Der eigene Rückzug läuft separat über den Button.
                        if (rolle === 'Employee') return;

                        setModalAnfrage(a);
                      }}
                      className={`border-b border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                        !istOffen
                          ? 'opacity-60 cursor-not-allowed'
                          : rolle === 'Employee'
                            ? 'cursor-default'
                            : 'cursor-pointer'
                      }`}
                      title={a.kommentar || ''}
                    >
                      <td className="p-2 whitespace-nowrap">
                        {a.datum ? dayjs(a.datum).format('DD.MM.YYYY') : '-'}
                      </td>

                      <td>{a.schicht || '-'}</td>

                      <td>
                        {a.created_by_user
                          ? `${a.created_by_user.vorname} ${a.created_by_user.nachname}`
                          : '-'}
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <span>{a.antrag || '-'}</span>

                          {a.istGebündelt && (
                            <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                              {a.gruppenAnzahl} Angebote
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap">
                        {a.created_at
                          ? dayjs(a.created_at).format('DD.MM.YY HH:mm')
                          : '-'}{' '}
                        {quelleKurz(a.anfrage_von)}
                      </td>

                      <td>
                        {s === 0 ? 'Offen' : s === 1 ? '✅' : '❌'}
                      </td>

                      <td>
                        {a.verantwortlicher_user
                          ? `${a.verantwortlicher_user.vorname?.charAt(0) || ''}. ${
                              a.verantwortlicher_user.nachname || ''
                            }`
                          : '-'}
                      </td>

                      <td className="whitespace-nowrap">
                        {a.datum_entscheid
                          ? dayjs(a.datum_entscheid).format('DD.MM.YY HH:mm')
                          : '-'}
                      </td>

                      <td>
                        {darfZurueckziehen ? (
                          <button
                            onClick={(e) => anfrageZurueckziehen(e, a)}
                            disabled={zurueckziehenId === a.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900 disabled:opacity-50"
                            title="Antrag zurückziehen"
                          >
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">
                              {zurueckziehenId === a.id ? '...' : 'Zurückziehen'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {anfragenGebündelt.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-3 text-center text-gray-600 dark:text-gray-300"
                    >
                      Keine Einträge.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analyse Modal nur für Verantwortliche */}
      {modalAnfrage && rolle !== 'Employee' && (
        <AnfragenMitarbeiterAnalyseModal
          offen={!!modalAnfrage}
          anfrage={modalAnfrage}
          gruppenAnfragen={modalAnfrage.gruppenAnfragen || [modalAnfrage]}
          firmaId={firma}
          unitId={unit}
          verantwortlicherUserId={userId}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
          onClose={() => {
            setModalAnfrage(null);
          }}
        />
      )}

      {/* Info Modal */}
      {infoModalOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">
              ℹ️ Informationen zu Mitarbeiter-Anfragen
            </h3>

            <div className="space-y-5 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Grundfunktion</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    In diesem Bereich werden Anfragen von Mitarbeitenden angezeigt.
                  </li>
                  <li>
                    Beispiele sind Anfragen zu freien Tagen, Unterstützung bei
                    Unterbesetzung oder andere schichtbezogene Rückmeldungen.
                  </li>
                  <li>
                    Die Anzeige ist in die Bereiche „Offen“, „Genehmigt“ und
                    „Abgelehnt“ aufgeteilt.
                  </li>
                  <li>
                    Über „Refresh“ können die Daten neu geladen werden.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Offene Anfragen</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    „Offen“ bedeutet: Es gibt noch keine Entscheidung und kein
                    Entscheidungsdatum.
                  </li>
                  <li>
                    Verantwortliche Personen können offene Anfragen anklicken und
                    im Analysefenster bearbeiten.
                  </li>
                  <li>
                    Mitarbeitende können offene Anfragen nicht selbst genehmigen
                    oder ablehnen.
                  </li>
                  <li>
                    Mitarbeitende können jedoch eigene offene Anfragen zurückziehen.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Antrag zurückziehen</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    Ein eigener offener Antrag kann über „Zurückziehen“ beendet
                    werden.
                  </li>
                  <li>
                    Der Antrag wird dabei nicht spurlos gelöscht.
                  </li>
                  <li>
                    Technisch wird der Antrag als abgelehnt gespeichert.
                  </li>
                  <li>
                    Als Entscheider wird der angemeldete Mitarbeiter selbst
                    eingetragen.
                  </li>
                  <li>
                    Das Entscheidungsdatum wird automatisch auf den aktuellen
                    Zeitpunkt gesetzt.
                  </li>
                  <li>
                    Dadurch bleibt nachvollziehbar, dass der Antrag gestellt und
                    anschließend selbst zurückgenommen wurde.
                  </li>
                  <li>
                    Das ist wichtig für Transparenz, Nachvollziehbarkeit und eine
                    saubere Historie.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Genehmigte und abgelehnte Anfragen</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    Genehmigte Anfragen werden mit ✅ angezeigt.
                  </li>
                  <li>
                    Abgelehnte oder zurückgezogene Anfragen werden mit ❌ angezeigt.
                  </li>
                  <li>
                    Bereits entschiedene Anfragen können nicht erneut bearbeitet
                    werden.
                  </li>
                  <li>
                    Der Entscheider und der Zeitpunkt der Entscheidung bleiben
                    sichtbar.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Automatische Regeln</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    Eintragungen, die älter als 3 Tage sind, können automatisch
                    abgelehnt werden.
                  </li>
                  <li>
                    Pro Tag beziehungsweise pro Schicht sollen Anfragen nur in
                    begrenztem Abstand gestellt werden, um Spam oder versehentliche
                    Mehrfachanfragen zu vermeiden.
                  </li>
                  <li>
                    Diese Regeln unterstützen eine übersichtliche und faire
                    Bearbeitung.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Spalten und Kürzel</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    „Datum“ zeigt den betroffenen Tag der Anfrage.
                  </li>
                  <li>
                    „Schicht“ zeigt die betroffene Schicht, zum Beispiel Früh,
                    Spät oder Nacht.
                  </li>
                  <li>
                    „Von“ zeigt, wer die Anfrage gestellt hat.
                  </li>
                  <li>
                    „Antrag“ zeigt die Art oder den Inhalt der Anfrage.
                  </li>
                  <li>
                    In „Erstellt“ zeigt M = Mobile und W = WebApp.
                  </li>
                  <li>
                    „Entscheider“ zeigt, wer die Anfrage bearbeitet oder
                    zurückgezogen hat.
                  </li>
                  <li>
                    „Entschieden am“ zeigt den Zeitpunkt der Entscheidung.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Sortierung</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>
                    Die Tabelle kann per Klick auf die Spaltenüberschriften
                    sortiert werden.
                  </li>
                  <li>
                    Sortierbar sind Datum, Schicht, Erstellt und Entschieden am.
                  </li>
                  <li>
                    Der Standard ist Datum aufsteigend.
                  </li>
                  <li>
                    Ein erneuter Klick auf dieselbe Spalte dreht die Sortierung um.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3">
                <p className="font-semibold mb-1">Hinweis zur Nachvollziehbarkeit</p>
                <p>
                  Anfragen werden bewusst nicht einfach gelöscht. Auch ein
                  zurückgezogener Antrag bleibt als Historie erhalten. So kann
                  später nachvollzogen werden, was beantragt, entschieden oder
                  vom Mitarbeiter selbst zurückgenommen wurde.
                </p>
              </div>
            </div>

            <div className="text-right mt-5">
              <button
                onClick={() => setInfoModalOffen(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnfragenMitarbeiter;