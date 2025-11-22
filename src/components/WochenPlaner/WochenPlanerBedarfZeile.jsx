// src/components/WochenPlaner/WochenPlanerBedarfZeile.jsx
import React from 'react';
import dayjs from 'dayjs';

/**
 * Zeigt oberhalb der Mitarbeitenden pro Woche/Schicht
 * eine kleine Zeile mit 7 Kästchen (Mo–So),
 * die Bedarf vs. Abdeckung anzeigen.
 *
 * - Farbe:
 *   Grau  = kein Bedarf hinterlegt
 *   Grün  = Bedarf vollständig gedeckt
 *   Rot   = Bedarf nicht gedeckt
 *
 * - Text: "X/Y" = X eingesetzte MA in dieser Schicht, Y benötigt
 * - Tooltip: alle Qualifikationen inkl. welchen MA sie abdecken
 *
 * WICHTIG: Jede Person kann (wie im MitarbeiterBedarf) pro Tag/Schicht
 * nur EINE Qualifikation abdecken – auch wenn sie mehrere Qualis besitzt.
 */
const WochenPlanerBedarfZeile = ({
  weekIndex,
  weekStart,
  schichtCode,        // 'F' | 'S' | 'N'
  basePattern,        // Array(7) Basis-Muster z.B. ['F','F','F','F','F','-','-']
  bedarfStatus,       // { F: { 'YYYY-MM-DD': { total, items[] }}, ... }
  mitarbeiterMitInfo, // Liste aller MA mit .user_id und .qualis (Matrix-Einträge)
  zuweisungen,        // Board-Zuweisungen { `${weekIndex}_${schicht}`: [userIds...] }
  boardPlan,          // Overrides aus DB_Kampfliste { userId: { 'YYYY-MM-DD': code } }
}) => {
  const assignedUserIds = zuweisungen[`${weekIndex}_${schichtCode}`] || [];

  const tage = [];

  for (let i = 0; i < 7; i++) {
    const day = weekStart.add(i, 'day');
    const dateStr = day.format('YYYY-MM-DD');

    const bedarf = bedarfStatus[schichtCode]?.[dateStr];
    const baseCode = basePattern[i] || schichtCode;

    // --- aktive User in DIESER Schicht an diesem Tag bestimmen ---
    const aktiveUserIds = assignedUserIds.filter((uid) => {
      const overridesForUser = boardPlan[uid] || {};
      const overrideCode = overridesForUser[dateStr];

      const hasOverride =
        overrideCode !== undefined && overrideCode !== null;

      const finalCode = hasOverride ? overrideCode : baseCode;

      // Urlaub/Krank/Frei/etc. NICHT als aktive Schicht zählen
      return finalCode === schichtCode;
    });

    let colorClass = 'bg-gray-400/40 text-gray-900';
    let label = '';
    const titleLines = [];

    const schichtText =
      schichtCode === 'F'
        ? 'Frühschicht'
        : schichtCode === 'S'
        ? 'Spätschicht'
        : 'Nachtschicht';

    titleLines.push(
      `${day.format('DD.MM.YYYY')} – ${schichtText}`
    );

    // Kein Bedarf → graues Feld, nur Info im Tooltip
    if (!bedarf || !bedarf.items || bedarf.items.length === 0) {
      titleLines.push('Kein definierter Qualifikationsbedarf.');
      tage.push(
        <span
          key={dateStr}
          className={`w-8 h-4 rounded-sm text-[9px] flex items-center justify-center ${colorClass}`}
          title={titleLines.join('\n')}
        >
          {label}
        </span>
      );
      continue;
    }

    const items = bedarf.items || [];

    // --- UserQualiMap: welche Quali-IDs hat welcher User? ---
    const benoetigteQualiIds = [
      ...new Set(items.map((it) => it.quali_id)),
    ];

    const userQualiMap = {};
    for (const uid of aktiveUserIds) {
      const ma = mitarbeiterMitInfo.find((m) => m.user_id === uid);
      if (!ma) continue;
      const qualis = (ma.qualis || [])
        .map((q) => q.id)
        .filter((id) => benoetigteQualiIds.includes(id));
      if (qualis.length > 0) {
        userQualiMap[uid] = qualis;
      }
    }

    // --- User-Reihenfolge wie im MitarbeiterBedarf ---
    const matrixPositions = {};
    items.forEach((b) => {
      matrixPositions[b.quali_id] = b.position ?? 999;
    });

    const userSortMap = Object.entries(userQualiMap).map(
      ([userId, qualis]) => {
        const relevantQualis = qualis.filter(
          (qid) => matrixPositions[qid] !== undefined
        );
        const posSum = relevantQualis.reduce(
          (sum, qid) => sum + (matrixPositions[qid] ?? 999),
          0
        );
        return {
          userId,
          qualis: relevantQualis,
          anzahl: relevantQualis.length,
          posSumme: posSum,
        };
      }
    );

    const userReihenfolge = userSortMap
      .sort(
        (a, b) =>
          a.anzahl - b.anzahl || a.posSumme - b.posSumme
      )
      .map((u) => u.userId);

    // --- Jede Person deckt max. EINE Quali ab ---
    const verwendeteUser = new Set();
    const abdeckung = {};

    for (const b of items) {
      abdeckung[b.quali_id] = [];
      for (const uid of userReihenfolge) {
        if (verwendeteUser.has(uid)) continue; // User schon für andere Quali verbraucht
        const qualisDesUsers = userQualiMap[uid] || [];
        if (qualisDesUsers.includes(b.quali_id)) {
          abdeckung[b.quali_id].push(uid);
          verwendeteUser.add(uid);
          if (abdeckung[b.quali_id].length >= (b.anzahl || 0)) break;
        }
      }
    }

    // --- Auswertung: fehlende Abdeckung / Farbe / Label ---
    let totalMissing = 0;
    const qualiLines = [];

    for (const b of items) {
      const kuerzel = b.kuerzel || '???';
      const needed = Number(b.anzahl || 0);
      const got = (abdeckung[b.quali_id] || []).length;
      const missing = Math.max(0, needed - got);
      totalMissing += missing;

      // Namen für Tooltip
      const namen = (abdeckung[b.quali_id] || []).map((uid) => {
        const ma = mitarbeiterMitInfo.find((m) => m.user_id === uid);
        return ma
          ? `${ma.nachname || ''} ${ma.vorname?.[0] || ''}.`.trim()
          : uid;
      });

      qualiLines.push(
        `• ${kuerzel}: ${got}/${needed}` +
          (namen.length ? `  (${namen.join(', ')})` : '')
      );
    }

    const totalNeeded = items.reduce(
      (sum, it) => sum + Number(it.anzahl || 0),
      0
    );
    const totalActive = aktiveUserIds.length;

    if (totalNeeded === 0) {
      colorClass = 'bg-gray-400/40 text-gray-900';
      label = `${totalActive}`;
    } else if (totalMissing > 0) {
      colorClass = 'bg-red-500 text-white';
      label = `${totalActive}/${totalNeeded}`;
    } else {
      colorClass = 'bg-green-600 text-white';
      label = `${totalActive}/${totalNeeded}`;
    }

    titleLines.push('');
    titleLines.push(
      `Mitarbeitende in dieser Schicht: ${totalActive} · Bedarf insgesamt: ${totalNeeded}`
    );
    if (qualiLines.length) {
      titleLines.push('');
      titleLines.push(...qualiLines);
    }
    if (totalMissing > 0) {
      titleLines.push('');
      titleLines.push(`❌ Es fehlen insgesamt ${totalMissing} Besetzungen.`);
    } else {
      titleLines.push('');
      titleLines.push('✅ Qualifikationsbedarf ist vollständig gedeckt.');
    }

    tage.push(
      <span
        key={dateStr}
        className={`w-8 h-4 rounded-sm text-[9px] flex items-center justify-center ${colorClass}`}
        title={titleLines.join('\n')}
      >
        {label}
      </span>
    );
  }

  return <div className="flex gap-0.5 mb-0.5">{tage}</div>;
};

export default WochenPlanerBedarfZeile;
