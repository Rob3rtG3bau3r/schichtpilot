// src/bmaLogik/Roehm_BMA_5Schicht_Logik.jsx

const STUFEN = {
  GRUEN: 'grün',
  GELB: 'gelb',
  AMBER: 'amber',
  ROT: 'rot',
};

const URLAUB = 'U';
const BLOCKIERT = ['U', 'K', 'KO'];

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const isUrlaub = (v) => v === URLAUB;
const istBlockiert = (v) => BLOCKIERT.includes(v);

function deckelAufAmber(result, grund) {
  if (!result || result.stufe === STUFEN.ROT) return result;

  return {
    ...result,
    stufe: STUFEN.AMBER,
    gruende: [...(result.gruende || []), grund],
  };
}

export function getBewertungsDetails_Roehm5(f, modalSchicht) {
  const schicht = String(modalSchicht || '').toUpperCase();

  const ruheVorher = n(f?.ruheVorherStunden);
  const ruheNachher = n(f?.ruheNachherStunden);

  const vorher = f?.vorher;
  const heute = f?.heute;
  const nachher = f?.nachher;

const letzteSchichtVorherObj =
  typeof f?.letzteSchichtVorher === 'object'
    ? f.letzteSchichtVorher
    : null;

  const letzteSchichtVorher =
    letzteSchichtVorherObj?.kuerzel ||
    f?.letzteSchichtVorher ||
    f?.letzterDienstVorher?.kuerzel ||
    null;

  const letzteWarNacht =
    letzteSchichtVorherObj?.istNachtDienst === true ||
    letzteSchichtVorher === 'N';

  if (!schicht) {
    return {
      stufe: null,
      gruende: ['Keine Zielschicht übergeben.'],
    };
  }

  if (ruheVorher == null || ruheNachher == null) {
    return {
      stufe: null,
      gruende: ['Ruhezeiten konnten nicht berechnet werden.'],
    };
  }

  // 1. Zieltag ist blockiert
  if (istBlockiert(heute) && heute !== '-') {
    return {
      stufe: STUFEN.ROT,
      gruende: [`Der Zieltag ist bereits mit "${heute}" belegt.`],
    };
  }

  // 2. Urlaub im nächsten relevanten Block vorher/nachher prüfen
  const urlaubBlockVorher =
    isUrlaub(vorher) ||
    f?.urlaubImNaechstenBlockVorher === true ||
    f?.letzterRelevanterEintragVorher?.kuerzel === 'U';

  const urlaubBlockNachher =
    isUrlaub(nachher) ||
    f?.urlaubImNaechstenBlockNachher === true ||
    f?.naechsterRelevanterEintragNachher?.kuerzel === 'U';

  // 3. Echte Kollision: weniger als 11 Stunden Ruhe in eine Richtung
  if (ruheVorher < 11 || ruheNachher < 11) {
    return {
      stufe: STUFEN.ROT,
      gruende: [
        `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
        `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
        'Mindestens eine Ruhezeit liegt unter 11 Stunden.',
      ],
    };
  }

  let result;

  if (schicht === 'F') {
    result = bewerteFrueh({
      ruheVorher,
      ruheNachher,
      letzteSchichtVorher,
      letzteWarNacht,
    });
  } else if (schicht === 'S') {
    result = bewerteSpaet({
      ruheVorher,
      ruheNachher,
    });
  } else if (schicht === 'N') {
    result = bewerteNacht({
      ruheVorher,
      ruheNachher,
      letzteSchichtVorher,
      letzteWarNacht,
    });
  } else {
    result = {
      stufe: STUFEN.AMBER,
      gruende: [`Für "${schicht}" gibt es keine spezielle Bewertungsregel.`],
    };
  }

  // 4. Urlaub im nächsten relevanten Block vorher/nachher = maximal Amber
  if (urlaubBlockVorher || urlaubBlockNachher) {
    const richtung =
      urlaubBlockVorher && urlaubBlockNachher
        ? 'vor und nach'
        : urlaubBlockVorher
          ? 'vor'
          : 'nach';

    result = deckelAufAmber(
      result,
      `Im nächsten relevanten Block ${richtung} dem Zieltag liegt Urlaub. Daher maximal Amber.`
    );
  }

  return result;
}

// Alte Schnittstelle bleibt bestehen
export function getBewertungsStufe_Roehm5(f, modalSchicht) {
  return getBewertungsDetails_Roehm5(f, modalSchicht).stufe;
}
function bewerteFrueh({ ruheVorher, ruheNachher, letzteSchichtVorher, letzteWarNacht }) {
  // Sonderregel: Früh nach Nacht oder nachtähnlichem Dienst
  if (letzteWarNacht) {
    if (ruheVorher >= 44 && ruheNachher >= 15) {
      return {
        stufe: STUFEN.GRUEN,
        gruende: [
          `Die letzte Schicht vorher war "${letzteSchichtVorher}" und gilt als Nacht/nachtähnlicher Dienst.`,
          `Zwischen diesem Dienst und Früh liegen ${ruheVorher.toFixed(1)} Std.`,
          `Nach der Früh liegen ${ruheNachher.toFixed(1)} Std.`,
          'Für Grün sind nach Nacht mindestens 44 Std. vor der Früh erfüllt.',
        ],
      };
    }

    return {
      stufe: STUFEN.AMBER,
      gruende: [
        `Die letzte Schicht vorher war "${letzteSchichtVorher}" und gilt als Nacht/nachtähnlicher Dienst.`,
        `Zwischen diesem Dienst und Früh liegen ${ruheVorher.toFixed(1)} Std.`,
        'Für Grün wären nach Nacht mindestens 44 Std. nötig.',
      ],
    };
  }

  if (ruheVorher >= 15 && ruheNachher >= 15) {
    return {
      stufe: STUFEN.GRUEN,
      gruende: [
        `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
        `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
        'Für Früh sind mindestens 15 Std. vorher und nachher erfüllt.',
      ],
    };
  }

  if (ruheVorher >= 12 && ruheNachher >= 12) {
    return {
      stufe: STUFEN.GELB,
      gruende: [
        `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
        `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
        'Für Früh sind mindestens 12 Std. erfüllt, aber nicht beide Seiten erreichen 15 Std.',
      ],
    };
  }

  return {
    stufe: STUFEN.AMBER,
    gruende: [
      `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
      `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
      'Die 11 Std. Ruhezeit sind eingehalten, aber die Frühschicht liegt sehr knapp.',
    ],
  };
}

function bewerteSpaet({ ruheVorher, ruheNachher }) {
  if (ruheVorher >= 14 && ruheNachher >= 14) {
    return {
      stufe: STUFEN.GRUEN,
      gruende: [
        `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
        `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
        'Für Spät sind mindestens 14 Std. vorher und nachher erfüllt.',
      ],
    };
  }

  if (ruheVorher >= 12 && ruheNachher >= 12) {
    return {
      stufe: STUFEN.GELB,
      gruende: [
        `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
        `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
        'Für Spät sind mindestens 12 Std. erfüllt, aber nicht beide Seiten erreichen 14 Std.',
      ],
    };
  }

  return {
    stufe: STUFEN.AMBER,
    gruende: [
      `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
      `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
      'Die 11 Std. Ruhezeit sind eingehalten, aber die Spätschicht liegt sehr knapp.',
    ],
  };
}

function bewerteNacht({ ruheVorher, ruheNachher, letzteSchichtVorher, letzteWarNacht }) {
  if (letzteWarNacht && ruheNachher >= 44) {
    return {
      stufe: STUFEN.GRUEN,
      gruende: [
        `Die vorherige Schicht war "${letzteSchichtVorher}" und gilt als Nacht/nachtähnlicher Dienst.`,
        `Nach der Nacht liegen ${ruheNachher.toFixed(1)} Std. frei.`,
        'Nachtblock mit anschließend mindestens 44 Std. frei ist optimal.',
      ],
    };
  }

  if (ruheVorher >= 24 && ruheNachher >= 44) {
    return {
      stufe: STUFEN.GELB,
      gruende: [
        `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
        `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
        'Vor der Nacht liegt mindestens 24 Std. frei und danach mindestens 44 Std.',
      ],
    };
  }

  return {
    stufe: STUFEN.AMBER,
    gruende: [
      `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
      `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
      'Die Nachtschicht ist möglich, aber nicht optimal.',
    ],
  };
}