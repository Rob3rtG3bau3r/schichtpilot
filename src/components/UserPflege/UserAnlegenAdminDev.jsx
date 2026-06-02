'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Mail, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const ERLAUBTE_ROLLEN = ['Employee', 'Team_Leader', 'Planner'];

const genTempPassword = () =>
  (crypto?.randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36)))
    .replace(/-/g, '')
    .slice(0, 12);

const sendeResetLink = async (email) => {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
};

const normalisiere = (wert) =>
  String(wert || '')
    .trim()
    .toLowerCase();

const phoneOk = (wert) => {
  const v = String(wert || '').trim();
  if (!v) return true;
  return /^[+0-9 ()/.-]{6,25}$/.test(v);
};

const emailOk = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const holeDomain = (email) => {
  const parts = String(email || '').trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
};

export default function UserAnlegenAdminDev({ onCreated, onCancel }) {
  const rollen = useRollen() || {};

  const firma = rollen.sichtFirma ?? rollen.firma_id ?? rollen.firmaId ?? null;
  const unit = rollen.sichtUnit ?? rollen.unit_id ?? rollen.unitId ?? null;
  const userId = rollen.userId ?? null;
  const eigeneRolle = rollen.rolle ?? null;

  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [personalNummer, setPersonalNummer] = useState('');
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [rolle, setRolle] = useState('Employee');

  const [adminEmail, setAdminEmail] = useState('');
  const [aktiveUser, setAktiveUser] = useState(0);
  const [maxUser, setMaxUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const [telefonWarnung, setTelefonWarnung] = useState(null);
  const [trotzTelefonWarnungSpeichern, setTrotzTelefonWarnungSpeichern] = useState(false);

  const adminDomain = useMemo(() => holeDomain(adminEmail), [adminEmail]);

  const limitText = useMemo(() => {
    if (maxUser === null || maxUser === undefined || maxUser === '') return `${aktiveUser} / –`;
    return `${aktiveUser} / ${maxUser}`;
  }, [aktiveUser, maxUser]);

  const limitErreicht = useMemo(() => {
    if (maxUser === null || maxUser === undefined || maxUser === '') return false;
    return Number(aktiveUser) >= Number(maxUser);
  }, [aktiveUser, maxUser]);

  const ladeRahmendaten = async () => {
    if (!firma || !unit) return;

    try {
      const { data: adminRow } = await supabase
        .from('DB_User')
        .select('email')
        .eq('user_id', userId)
        .maybeSingle();

      setAdminEmail(adminRow?.email || '');

    const { count, error: countErr } = await supabase
    .from('DB_User')
    .select('user_id', { count: 'exact', head: true })
    .eq('firma_id', firma)
    .eq('unit_id', unit)
    .or('aktiv.eq.true,aktiv.is.null');

      if (countErr) throw countErr;
      setAktiveUser(count || 0);

      const { data: unitRow, error: unitErr } = await supabase
        .from('DB_Unit')
        .select('id, anzahl_ma')
        .eq('id', unit)
        .eq('firma', firma)
        .maybeSingle();

      if (unitErr) throw unitErr;
      setMaxUser(unitRow?.anzahl_ma ?? null);
    } catch (error) {
      console.error('Rahmendaten laden fehlgeschlagen:', error);
      setNotice({
        type: 'error',
        text: 'Aktive Accounts oder Unit-Limit konnten nicht geladen werden.',
      });
    }
  };

  useEffect(() => {
    ladeRahmendaten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, unit, userId]);

  const resetForm = () => {
    setVorname('');
    setNachname('');
    setEmail('');
    setPersonalNummer('');
    setTel1('');
    setTel2('');
    setRolle('Employee');
    setTelefonWarnung(null);
    setTrotzTelefonWarnungSpeichern(false);
  };

  const domainUebernehmen = () => {
    if (!adminDomain) {
      setNotice({
        type: 'warning',
        text: 'Keine Domain vom eigenen Admin-Account gefunden.',
      });
      return;
    }

    const clean = String(email || '').trim();

    if (!clean) {
      setEmail(`@${adminDomain}`);
      return;
    }

    if (clean.includes('@')) {
      const localPart = clean.split('@')[0];
      setEmail(`${localPart}@${adminDomain}`);
      return;
    }

    setEmail(`${clean}@${adminDomain}`);
  };

  const pruefeTelefonDoppelt = async () => {
    const nummern = [tel1.trim(), tel2.trim()].filter(Boolean);
    if (nummern.length === 0) return [];

    const oderFilter = nummern
      .flatMap((nr) => [`tel_number1.eq.${nr}`, `tel_number2.eq.${nr}`])
      .join(',');

    const { data, error } = await supabase
      .from('DB_User')
      .select('user_id, vorname, nachname, tel_number1, tel_number2')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .or(oderFilter);

    if (error) throw error;
    return data || [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice(null);

    if (eigeneRolle !== 'Admin_Dev') {
      setNotice({
        type: 'error',
        text: 'Diese Funktion ist nur für Admin_Dev vorgesehen.',
      });
      return;
    }

    if (!firma || !unit) {
      setNotice({
        type: 'error',
        text: 'Firma oder Unit konnte nicht aus deinem Login-Kontext gelesen werden.',
      });
      return;
    }

    if (!vorname.trim() || !nachname.trim() || !email.trim()) {
      setNotice({
        type: 'warning',
        text: 'Bitte Vorname, Nachname und E-Mail ausfüllen.',
      });
      return;
    }

    if (!emailOk(email)) {
      setNotice({
        type: 'warning',
        text: 'Bitte eine gültige E-Mail-Adresse eingeben.',
      });
      return;
    }

    if (!ERLAUBTE_ROLLEN.includes(rolle)) {
      setNotice({
        type: 'error',
        text: 'Diese Rolle darf hier nicht vergeben werden.',
      });
      return;
    }

    if (!phoneOk(tel1) || !phoneOk(tel2)) {
      setNotice({
        type: 'warning',
        text: 'Telefonnummer bitte nur mit Ziffern, +, Leerzeichen oder ()-/. eingeben.',
      });
      return;
    }

    if (personalNummer.trim().length > 30) {
      setNotice({
        type: 'warning',
        text: 'Die Personalnummer ist zu lang. Bitte maximal 30 Zeichen verwenden.',
      });
      return;
    }

    if (limitErreicht) {
      setNotice({
        type: 'error',
        text: `Das aktive Mitarbeiterlimit ist erreicht (${limitText}). Bitte zuerst einen Mitarbeiter deaktivieren oder das Paket erweitern.`,
      });
      return;
    }

    setLoading(true);

    try {
      // 1) E-Mail global prüfen
      const { data: emailExists, error: emailErr } = await supabase
        .from('DB_User')
        .select('user_id')
        .eq('email', normalisiere(email))
        .maybeSingle();

      if (emailErr) throw emailErr;

      if (emailExists) {
        setNotice({
          type: 'error',
          text: 'Diese E-Mail-Adresse existiert bereits.',
        });
        setLoading(false);
        return;
      }

      // 2) Personalnummer innerhalb Firma/Unit prüfen
      if (personalNummer.trim()) {
        const { data: pnExists, error: pnErr } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname')
        .eq('firma_id', firma)
        .eq('personal_nummer', personalNummer.trim())
        .maybeSingle();

        if (pnErr) throw pnErr;

        if (pnExists) {
          setNotice({
            type: 'error',
            text: `Diese Personalnummer ist bereits vergeben (${pnExists.vorname || ''} ${pnExists.nachname || ''}).`,
          });
          setLoading(false);
          return;
        }
      }

      // 3) Telefon doppelt nur warnen
      if (!trotzTelefonWarnungSpeichern) {
        const telefonTreffer = await pruefeTelefonDoppelt();

        if (telefonTreffer.length > 0) {
          setTelefonWarnung(telefonTreffer);
          setNotice({
            type: 'warning',
            text: 'Mindestens eine Telefonnummer ist bereits bei einem anderen Mitarbeiter hinterlegt. Du kannst trotzdem speichern, wenn das korrekt ist.',
          });
          setLoading(false);
          return;
        }
      }

      // 4) Kurz vor dem Speichern Limit erneut prüfen
        const { count: countJetzt, error: countJetztErr } = await supabase
        .from('DB_User')
        .select('user_id', { count: 'exact', head: true })
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .or('aktiv.eq.true,aktiv.is.null');

      if (countJetztErr) throw countJetztErr;

      if (maxUser !== null && maxUser !== undefined && Number(countJetzt || 0) >= Number(maxUser)) {
        setAktiveUser(countJetzt || 0);
        setNotice({
          type: 'error',
          text: `Das aktive Mitarbeiterlimit ist inzwischen erreicht (${countJetzt || 0} / ${maxUser}).`,
        });
        setLoading(false);
        return;
      }

      // 5) User anlegen
      const passwort = genTempPassword();

      const userPayload = {
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        email: normalisiere(email),
        rolle,
        funktion: 'Mitarbeiter',
        firma_id: firma,
        unit_id: unit,
        aktiv: true,
        erstellt_von: userId,
        personal_nummer: personalNummer.trim() || null,
        tel_number1: tel1.trim() || null,
        tel_number2: tel2.trim() || null,
      };

      const res = await fetch('https://schicht-pilot-backend.vercel.app/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalisiere(email),
          password: passwort,
          userData: userPayload,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || 'Unbekannter Fehler beim Anlegen.');
      }

      // 6) Passwort-Mail senden
      await sendeResetLink(email);

      setNotice({
        type: 'success',
        text: 'Mitarbeiter angelegt. Die Passwort-Mail wurde versendet.',
      });

      resetForm();
      await ladeRahmendaten();

      if (onCreated) onCreated();
    } catch (error) {
      console.error('Mitarbeiter anlegen fehlgeschlagen:', error);
      setNotice({
        type: 'error',
        text: error.message || 'Mitarbeiter konnte nicht angelegt werden.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 shadow-xl p-4 text-gray-900 dark:text-gray-100">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Mitarbeiter hinzufügen</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Aktive Accounts: <strong>{limitText}</strong>
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700"
            title="Abbrechen"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-900 dark:text-blue-100 flex gap-2">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <strong>Hinweis:</strong> Beim Speichern wird der Mitarbeiter angelegt und automatisch eine
          E-Mail zum Passwort-Setzen versendet.
        </div>
      </div>

      {limitErreicht && (
        <div className="mb-4 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200 flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            Das aktive Mitarbeiterlimit ist erreicht. Es können keine weiteren aktiven Mitarbeiter
            angelegt werden.
          </div>
        </div>
      )}

      {notice && (
        <div
          className={[
            'mb-4 rounded-xl border p-3 text-sm flex gap-2',
            notice.type === 'success'
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
              : notice.type === 'error'
              ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200'
              : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200',
          ].join(' ')}
        >
          {notice.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div>{notice.text}</div>
        </div>
      )}

      {telefonWarnung && telefonWarnung.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-100">
          <div className="font-semibold mb-2">Telefonnummer bereits vorhanden:</div>

          <ul className="list-disc pl-5 space-y-1">
            {telefonWarnung.map((u) => (
              <li key={u.user_id}>
                {u.vorname} {u.nachname}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTrotzTelefonWarnungSpeichern(true);
                setTelefonWarnung(null);
                setNotice({
                  type: 'warning',
                  text: 'Telefon-Warnung bestätigt. Bitte erneut auf Speichern klicken.',
                });
              }}
              className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm"
            >
              Trotzdem speichern
            </button>

            <button
              type="button"
              onClick={() => {
                setTelefonWarnung(null);
                setTrotzTelefonWarnungSpeichern(false);
              }}
              className="px-3 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Vorname *</label>
            <input
              value={vorname}
              onChange={(e) => setVorname(e.target.value)}
              disabled={loading || limitErreicht}
              className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
              placeholder="Vorname"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nachname *</label>
            <input
              value={nachname}
              onChange={(e) => setNachname(e.target.value)}
              disabled={loading || limitErreicht}
              className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
              placeholder="Nachname"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">E-Mail *</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setTrotzTelefonWarnungSpeichern(false);
              }}
              disabled={loading || limitErreicht}
              className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
              placeholder="name@firma.de"
            />

            <button
              type="button"
              onClick={domainUebernehmen}
              disabled={loading || limitErreicht || !adminDomain}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-50"
              title={adminDomain ? `Domain @${adminDomain} übernehmen` : 'Keine Admin-Domain gefunden'}
            >
              <Mail size={16} />
              Domain
            </button>
          </div>

          {adminDomain && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Domain vom eigenen Account: @{adminDomain}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Personalnummer optional</label>
          <input
            value={personalNummer}
            onChange={(e) => setPersonalNummer(e.target.value)}
            disabled={loading || limitErreicht}
            className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
            placeholder="z. B. 1001"
          />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Wenn eingetragen, wird geprüft, ob diese Personalnummer in der Unit bereits vorhanden ist.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Telefon 1 optional</label>
            <input
              value={tel1}
              onChange={(e) => {
                setTel1(e.target.value);
                setTrotzTelefonWarnungSpeichern(false);
              }}
              disabled={loading || limitErreicht}
              className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
              placeholder="z. B. 0171..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telefon 2 optional</label>
            <input
              value={tel2}
              onChange={(e) => {
                setTel2(e.target.value);
                setTrotzTelefonWarnungSpeichern(false);
              }}
              disabled={loading || limitErreicht}
              className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
              placeholder="z. B. 02236..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Rolle *</label>
          <select
            value={rolle}
            onChange={(e) => setRolle(e.target.value)}
            disabled={loading || limitErreicht}
            className="w-full rounded-xl border px-3 py-2 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
          >
            {ERLAUBTE_ROLLEN.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Admin-Rollen werden nur durch SchichtPilot/SuperAdmin erstellt.
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="submit"
            disabled={loading || limitErreicht}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 disabled:opacity-50"
          >
            {loading ? 'Speichert...' : 'Mitarbeiter anlegen & Passwort-Mail senden'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="sm:w-48 rounded-xl bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 disabled:opacity-50"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}