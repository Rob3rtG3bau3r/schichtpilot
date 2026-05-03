import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';

const fmt = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '-');
const fmtStd = (v) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
};

const normSchicht = (s) => (s ?? '-').toString().trim().toUpperCase();
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const AnfrageAktionModal = ({
  offen,
  onClose,
  datum,
  schicht,
  onSaved,

  // aus MitarbeiterBedarf übergeben:
  eigeneSchicht,
  eigeneSchichtUnterdeckung = false,
  angeklickteSchichtUnterdeckung = false,
  kannAufAngeklickterSchichtHelfen = false,
}) => {
  const rawFirmaId = localStorage.getItem('firma_id');
  const rawUnitId = localStorage.getItem('unit_id');

  const firma_id =
    rawFirmaId && rawFirmaId !== 'null' ? Number(rawFirmaId) : null;

  const unit_id =
    rawUnitId && rawUnitId !== 'null' ? Number(rawUnitId) : null;

    console.log('DEBUG localStorage IDs', {
      rawFirmaId,
      rawUnitId,
      firma_id,
      unit_id,
    });

  const [authUserId, setAuthUserId] = useState(null);
  const [sendingType, setSendingType] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [schichtgruppe, setSchichtgruppe] = useState('');
  const [loadingGruppe, setLoadingGruppe] = useState(false);

  const [urlaubRest, setUrlaubRest] = useState(null);
  const [stundenStand, setStundenStand] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    if (!offen) return;

    const loadAuthUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error('Fehler beim Laden des Auth-Users:', error.message);
        setAuthUserId(null);
        return;
      }

      setAuthUserId(user?.id ?? null);
    };

    loadAuthUser();
  }, [offen]);

  const tagLabel = useMemo(() => {
    if (!datum) return '-';
    const d = dayjs(datum);
    return WOCHENTAGE[d.day()] || '-';
  }, [datum]);

  const angeklickteSchicht = useMemo(() => normSchicht(schicht), [schicht]);
  const eigeneSchichtCode = useMemo(() => normSchicht(eigeneSchicht), [eigeneSchicht]);
  const hatEigenenDienst = useMemo(
    () => ['F', 'S', 'N'].includes(eigeneSchichtCode),
    [eigeneSchichtCode]
  );

  useEffect(() => {
    if (!offen) {
      setSendingType('');
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [offen, datum, schicht]);

  useEffect(() => {
    if (!offen || !authUserId || !firma_id || !unit_id || !datum) return;

    (async () => {
      setLoadingGruppe(true);

      const { data, error } = await supabase
        .from('DB_SchichtZuweisung')
        .select('schichtgruppe, von_datum, bis_datum')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .eq('user_id', authUserId)
        .lte('von_datum', datum)
        .or(`bis_datum.is.null,bis_datum.gte.${datum}`)
        .order('von_datum', { ascending: false })
        .limit(1);

      if (!error && data?.length) {
        setSchichtgruppe(data[0].schichtgruppe || '');
      } else {
        setSchichtgruppe('');
      }

      if (error) {
        console.error('Fehler beim Laden der Schichtgruppe:', error.message);
      }

      setLoadingGruppe(false);
    })();
  }, [offen, authUserId, firma_id, unit_id, datum]);

  useEffect(() => {
    if (!offen || !authUserId || !datum) return;

    (async () => {
      setLoadingInfo(true);
      const jahr = dayjs(datum).year();

      try {
        const [{ data: urlaubData, error: urlaubErr }, { data: stundenData, error: stundenErr }] =
          await Promise.all([
            supabase
              .from('DB_Urlaub')
              .select('urlaub_gesamt, summe_jahr')
              .eq('user_id', authUserId)
              .eq('jahr', jahr)
              .maybeSingle(),
            supabase
              .from('DB_Stunden')
              .select('vorgabe_stunden, summe_jahr, uebernahme_vorjahr')
              .eq('user_id', authUserId)
              .eq('jahr', jahr)
              .maybeSingle(),
          ]);

        if (urlaubErr) {
          console.error('Fehler beim Laden Urlaub:', urlaubErr.message);
        } else {
          const gesamt = Number(urlaubData?.urlaub_gesamt ?? 0);
          const genommen = Number(urlaubData?.summe_jahr ?? 0);
          setUrlaubRest(gesamt - genommen);
        }

        if (stundenErr) {
          console.error('Fehler beim Laden Stunden:', stundenErr.message);
        } else {
          // StundenJahresEnde
            const stundenVorgabe = Number(stundenData?.vorgabe_stunden ?? 0);
            const stundenJahr = Number(stundenData?.summe_jahr ?? 0);
            const uebernahmeVorjahr = Number (stundenData?.uebernahme_vorjahr ?? 0);
            const wert = stundenJahr + uebernahmeVorjahr - stundenVorgabe;

  setStundenStand(wert);
        }
      } finally {
        setLoadingInfo(false);
      }
    })();
  }, [offen, authUserId, datum]);

  useEffect(() => {
    if (!errorMsg && !successMsg) return;
    const t = setTimeout(() => {
      setErrorMsg('');
      setSuccessMsg('');
    }, 4000);
    return () => clearTimeout(t);
  }, [errorMsg, successMsg]);

    const checkDuplicateOpenRequest = async (zielSchicht) => {
      if (!authUserId) throw new Error('Kein Auth-User vorhanden.');

      const windowStartISO = dayjs().subtract(3, 'day').toISOString();
console.log('DEBUG DuplicateCheck', {
  authUserId,
  datum,
  zielSchicht,
  firma_id,
  unit_id,
  windowStartISO,
});
      const { data, error } = await supabase
        .from('DB_AnfrageMA')
        .select('id')
        .eq('created_by', authUserId)
        .eq('datum', datum)
        .eq('schicht', zielSchicht)
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .is('genehmigt', null)
        .gte('created_at', windowStartISO)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    };

  const checkUrlaubVerfuegbar = async () => {
    if (!authUserId) throw new Error('Kein Auth-User vorhanden.');

    const jahr = dayjs(datum).year();

    const { data, error } = await supabase
      .from('DB_Urlaub')
      .select('urlaub_gesamt, summe_jahr')
      .eq('user_id', authUserId)
      .eq('jahr', jahr)
      .maybeSingle();

    if (error) throw error;

    const urlaubGesamt = Number(data?.urlaub_gesamt ?? 0);
    const urlaubGenommen = Number(data?.summe_jahr ?? 0);
    const rest = urlaubGesamt - urlaubGenommen;

    return rest > 0;
  };

  const sendeAntrag = async (art) => {
    if (sendingType) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!authUserId) {
      setErrorMsg('Kein eingeloggter Benutzer gefunden.');
      return;
    }

    const today = dayjs().startOf('day');
    const dSel = dayjs(datum);

    if (dSel.isBefore(today, 'day')) {
      setErrorMsg('Anfragen für vergangene Tage sind nicht möglich.');
      return;
    }

    // Zielschicht bestimmen:
    // Urlaub/FZA -> eigene Schicht
    // Anbieten -> angeklickte Schicht
    const zielSchicht =
      art === 'anbieten' ? angeklickteSchicht : eigeneSchichtCode;

    if ((art === 'urlaub' || art === 'freizeitausgleich') && !hatEigenenDienst) {
      setErrorMsg('Urlaub und Freizeitausgleich sind nur an Tagen mit eigener geplanter Schicht möglich.');
      return;
    }

    if ((art === 'urlaub' || art === 'freizeitausgleich') && eigeneSchichtUnterdeckung) {
      setErrorMsg(
        'Für deine eigene Schicht besteht bereits Unterdeckung. Bitte sprich persönlich mit deinem Team_Leader.'
      );
      return;
    }

    if (art === 'anbieten' && !angeklickteSchichtUnterdeckung) {
      setErrorMsg('Anbieten ist nur möglich, wenn für diese Schicht aktuell Unterdeckung besteht.');
      return;
    }

    if (art === 'anbieten' && !kannAufAngeklickterSchichtHelfen) {
      setErrorMsg('Du kannst auf dieser Schicht aktuell qualifikationsbezogen nicht sinnvoll unterstützen.');
      return;
    }

    if (!['F', 'S', 'N'].includes(zielSchicht)) {
      setErrorMsg('Für diese Aktion konnte keine gültige Schicht ermittelt werden.');
      return;
    }

    setSendingType(art);

    try {
      const duplicateExists = await checkDuplicateOpenRequest(zielSchicht);
      if (duplicateExists) {
        setErrorMsg('In den letzten 3 Tagen wurde bereits ein offener Antrag für diesen Tag und diese Schicht gestellt.');
        setSendingType('');
        return;
      }

      if (art === 'urlaub') {
        const genugUrlaub = await checkUrlaubVerfuegbar();
        if (!genugUrlaub) {
          setErrorMsg('Für dieses Jahr ist kein Resturlaub mehr verfügbar.');
          setSendingType('');
          return;
        }
      }

      let antragText = '';
      if (art === 'urlaub') antragText = 'Urlaub beantragt';
      if (art === 'anbieten') antragText = 'Ich biete mich freiwillig an.';
      if (art === 'freizeitausgleich') antragText = 'Freizeitausgleich beantragt';

      console.log('DEBUG Anfrage', {
        authUserId,
        datum,
        zielSchicht,
        firma_id,
        unit_id,
        schichtgruppe,
      });

      const { error: insErr } = await supabase.from('DB_AnfrageMA').insert({
        created_by: authUserId,
        datum,
        schicht: zielSchicht,
        antrag: antragText,
        genehmigt: null,
        kommentar: '',
        firma_id,
        unit_id,
        anfrage_von: 'WebApp',
        schichtgruppe: schichtgruppe || null,
      });

      if (insErr) throw insErr;

      setSuccessMsg('Antrag gesendet.');
      onSaved?.({ datum, schicht: zielSchicht, antrag: antragText });

      setTimeout(() => {
        onClose?.();
      }, 900);
    } catch (e) {
      console.error(e);
      setErrorMsg('Senden fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setSendingType('');
    }
  };

  const urlaubDisabled =
    !!sendingType ||
    loadingGruppe ||
    !hatEigenenDienst ||
    eigeneSchichtUnterdeckung ||
    !(urlaubRest > 0);

  const fzaDisabled =
    !!sendingType ||
    loadingGruppe ||
    !hatEigenenDienst ||
    eigeneSchichtUnterdeckung;

  const anbietenDisabled =
    !!sendingType ||
    loadingGruppe ||
    !angeklickteSchichtUnterdeckung ||
    !kannAufAngeklickterSchichtHelfen;

  if (!offen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-[560px] max-w-[95%] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Anfrage stellen</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div><b>Tag:</b> {tagLabel}</div>
            <div><b>Datum:</b> {fmt(datum)}</div>
            <div><b>Angeklickte Schicht:</b> {angeklickteSchicht}</div>
            <div><b>Eigene Schicht:</b> {hatEigenenDienst ? eigeneSchichtCode : 'frei / kein Dienst'}</div>
            <div><b>Schichtgruppe:</b> {loadingGruppe ? 'lädt…' : (schichtgruppe || '—')}</div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div><b>Resturlaub:</b> {loadingInfo ? 'lädt…' : `${Math.max(0, Number(urlaubRest ?? 0))} Tage`}</div>
            <div><b>Stundenkonto:</b> {loadingInfo ? 'lädt…' : `${fmtStd(stundenStand)} Std.`}</div>
            <div><b>Eigene Schicht Unterdeckung:</b> {eigeneSchichtUnterdeckung ? 'Ja' : 'Nein'}</div>
            <div><b>Angeklickte Schicht Unterdeckung:</b> {angeklickteSchichtUnterdeckung ? 'Ja' : 'Nein'}</div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <AlertTriangle className="w-4 h-4" /> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle className="w-4 h-4" /> {successMsg}
          </div>
        )}

        <div className="space-y-2 mb-4 text-xs text-gray-600 dark:text-gray-300">
          {!hatEigenenDienst && (
            <div>Urlaub und Freizeitausgleich sind nur an Tagen mit eigener geplanter Schicht möglich.</div>
          )}
          {hatEigenenDienst && eigeneSchichtUnterdeckung && (
            <div>Für deine eigene Schicht besteht bereits Unterdeckung. Bitte sprich persönlich mit deinem Team_Leader.</div>
          )}
          {!(urlaubRest > 0) && (
            <div>Es ist aktuell kein Resturlaub mehr verfügbar.</div>
          )}
          {!angeklickteSchichtUnterdeckung && (
            <div>Anbieten ist nur möglich, wenn für die angeklickte Schicht aktuell eine Unterdeckung besteht.</div>
          )}
          {angeklickteSchichtUnterdeckung && !kannAufAngeklickterSchichtHelfen && (
            <div>Du kannst auf der angeklickten Schicht mit deinen aktuellen Qualifikationen nicht sinnvoll unterstützen.</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <button
            onClick={() => sendeAntrag('urlaub')}
            disabled={urlaubDisabled}
            className="rounded-lg px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sendingType === 'urlaub' ? 'Senden…' : 'Urlaub'}
          </button>

          <button
            onClick={() => sendeAntrag('anbieten')}
            disabled={anbietenDisabled}
            className="rounded-lg px-4 py-3 bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sendingType === 'anbieten' ? 'Senden…' : 'Anbieten'}
          </button>

          <button
            onClick={() => sendeAntrag('freizeitausgleich')}
            disabled={fzaDisabled}
            className="rounded-lg px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sendingType === 'freizeitausgleich' ? 'Senden…' : 'Freizeitausgleich'}
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnfrageAktionModal;