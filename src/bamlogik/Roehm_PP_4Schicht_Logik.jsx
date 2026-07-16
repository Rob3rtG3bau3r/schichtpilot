// src/bamLogik/Roehm_PP_4Schicht_Logik.jsx
//
// BAM-Bewertung für das Röhm-PP-4-Schicht-System.
//
// Fachlicher Grundgedanke:
// - Die Stundenlogik bleibt vollständig außerhalb der BAM.
// - Ein freier Tag bleibt in der Kampfliste weiterhin "-".
// - Optional kann die BAM über sollHeute erkennen, ob "-" ein
//   herausgenommener Rhythmusdienst (Verfügungstag) ist.
// - Bewertet werden Ruhezeit, Schichtfolge, Arbeitsserie und Erholungsblöcke.

const STUFEN = {
  GRUEN: 'grün',
  GELB: 'gelb',
  AMBER: 'amber',
  ROT: 'rot',
};

const FREI = '-';
const URLAUB = 'U';
const BLOCKIERT = new Set(['U', 'K', 'KO']);
const STANDARD_SCHICHTEN = new Set(['F', 'S', 'N']);

const STUFEN_RANG = {
  [STUFEN.GRUEN]: 0,
  [STUFEN.GELB]: 1,
  [STUFEN.AMBER]: 2,
  [STUFEN.ROT]: 3,
};

const code = (value) => String(value || FREI).trim().toUpperCase() || FREI;

const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const istBlockiert = (value) => BLOCKIERT.has(code(value));
const istUrlaub = (value) => code(value) === URLAUB;

// Die BAM bekommt für kundenspezifische Dienste bereits berechnete Ruhezeiten.
// Für die Arbeitsserienzählung gelten mindestens F/S/N als Arbeitsdienste.
// Optional kann das Modal arbeitsCodes oder isArbeitsSchichtFn mitgeben.
const istArbeitsdienst = (value, f = {}) => {
  const kuerzel = code(value);

  if (kuerzel === FREI || BLOCKIERT.has(kuerzel)) return false;

  if (typeof f?.isArbeitsSchichtFn === 'function') {
    return !!f.isArbeitsSchichtFn(kuerzel);
  }

  if (Array.isArray(f?.arbeitsCodes) && f.arbeitsCodes.length > 0) {
    return f.arbeitsCodes.map(code).includes(kuerzel);
  }

  return STANDARD_SCHICHTEN.has(kuerzel);
};

function result(stufe, gruende = []) {
  return { stufe, gruende };
}

function deckel(resultat, maximaleStufe, grund) {
  if (!resultat) return result(maximaleStufe, grund ? [grund] : []);

  const aktuell = STUFEN_RANG[resultat.stufe] ?? STUFEN_RANG[STUFEN.AMBER];
  const maximum = STUFEN_RANG[maximaleStufe];

  if (aktuell >= maximum) {
    return grund
      ? { ...resultat, gruende: [...(resultat.gruende || []), grund] }
      : resultat;
  }

  return {
    ...resultat,
    stufe: maximaleStufe,
    gruende: grund
      ? [...(resultat.gruende || []), grund]
      : [...(resultat.gruende || [])],
  };
}

function getLetzteSchichtVorher(f) {
  if (typeof f?.letzteSchichtVorher === 'object') {
    return code(f.letzteSchichtVorher?.kuerzel);
  }

  return code(
    f?.letzteSchichtVorher ||
      f?.letzterDienstVorher?.kuerzel ||
      f?.vorher ||
      FREI
  );
}

function getNaechsteSchichtNachher(f) {
  if (typeof f?.naechsteSchichtNachher === 'object') {
    return code(f.naechsteSchichtNachher?.kuerzel);
  }

  return code(
    f?.naechsteSchichtNachher ||
      f?.naechsterDienstNachher?.kuerzel ||
      f?.nachher ||
      FREI
  );
}

function istNachtOderNachtaehnlich(objekt, fallbackCode) {
  return objekt?.istNachtDienst === true || code(fallbackCode) === 'N';
}

function ermittleVerfuegungstag(f) {
  const heute = code(f?.heute);
  const sollHeute = code(
    f?.sollHeute ||
      f?.urspruenglicheSchicht ||
      f?.rhythmusSchichtHeute ||
      FREI
  );

  const explizit = f?.istVerfuegungstag === true;
  const abgeleitet = heute === FREI && STANDARD_SCHICHTEN.has(sollHeute);

  return {
    istVerfuegungstag: explizit || abgeleitet,
    sollHeute: STANDARD_SCHICHTEN.has(sollHeute) ? sollHeute : null,
  };
}

function zaehleArbeitsserieMitZiel(f, zielSchicht) {
  const fenster = [
    code(f?.vor3),
    code(f?.vor2 ?? f?.vorvortag),
    code(f?.vor1 ?? f?.vorher),
    code(zielSchicht),
    code(f?.nach1 ?? f?.nachher),
    code(f?.nach2 ?? f?.folgetagplus),
    code(f?.nach3),
  ];

  const zielIndex = 3;
  let start = zielIndex;
  let ende = zielIndex;

  while (start - 1 >= 0 && istArbeitsdienst(fenster[start - 1], f)) start -= 1;
  while (ende + 1 < fenster.length && istArbeitsdienst(fenster[ende + 1], f)) ende += 1;

  return {
    anzahl: ende - start + 1,
    linksAbgeschnitten: start === 0 && istArbeitsdienst(fenster[0], f),
    rechtsAbgeschnitten:
      ende === fenster.length - 1 && istArbeitsdienst(fenster[fenster.length - 1], f),
  };
}

function wirdFreizeitblockGeteilt(f) {
  const direktVorherFrei = !istArbeitsdienst(f?.vorher ?? f?.vor1, f);
  const direktNachherFrei = !istArbeitsdienst(f?.nachher ?? f?.nach1, f);

  const dienstWeiterVorher =
    istArbeitsdienst(f?.vor2 ?? f?.vorvortag, f) || istArbeitsdienst(f?.vor3, f);
  const dienstWeiterNachher =
    istArbeitsdienst(f?.nach2 ?? f?.folgetagplus, f) || istArbeitsdienst(f?.nach3, f);

  return direktVorherFrei && direktNachherFrei && (dienstWeiterVorher || dienstWeiterNachher);
}

function bewerteSchichtfolge({
  zielSchicht,
  letzteSchicht,
  naechsteSchicht,
  letzteWarNacht,
  naechsteIstNacht,
  ruheVorher,
  ruheNachher,
  verfuegung,
}) {
  const gruende = [
    `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
    `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
  ];

  // Ein freigestellter Rhythmusdienst wird wiederhergestellt.
  if (verfuegung.istVerfuegungstag && verfuegung.sollHeute === zielSchicht) {
    return result(STUFEN.GRUEN, [
      ...gruende,
      `Der freie Tag ersetzt laut Sollplan eine ${zielSchicht}-Schicht.`,
      'Die ursprüngliche Rhythmusschicht wird wiederhergestellt.',
    ]);
  }

  // Verfügungstag wird für eine andere Schicht verwendet.
  if (
    verfuegung.istVerfuegungstag &&
    verfuegung.sollHeute &&
    verfuegung.sollHeute !== zielSchicht
  ) {
    return result(STUFEN.GELB, [
      ...gruende,
      `Laut Sollplan war ursprünglich ${verfuegung.sollHeute} vorgesehen.`,
      `Der Verfügungstag soll stattdessen für ${zielSchicht} genutzt werden.`,
    ]);
  }

  const gleicheSchichtVorher = letzteSchicht === zielSchicht;
  const gleicheSchichtNachher = naechsteSchicht === zielSchicht;

  if (gleicheSchichtVorher || gleicheSchichtNachher) {
    return result(STUFEN.GRUEN, [
      ...gruende,
      `Die Zielschicht ${zielSchicht} schließt an eine gleiche Schicht an.`,
      'Der bestehende Schichtblock wird sinnvoll ergänzt.',
    ]);
  }

  // Nachtblock fortsetzen: positiv, aber Erholung danach muss ausreichend sein.
  if (zielSchicht === 'N' && letzteWarNacht) {
    if (ruheNachher >= 44) {
      return result(STUFEN.GRUEN, [
        ...gruende,
        'Die Nachtschicht setzt einen bestehenden Nachtblock fort.',
        'Nach dem Nachtblock liegen mindestens 44 Stunden frei.',
      ]);
    }

    return result(STUFEN.AMBER, [
      ...gruende,
      'Die Nachtschicht setzt zwar einen Nachtblock fort, danach fehlen aber 44 Stunden Erholung.',
    ]);
  }

  // Früh nach Nacht bleibt auch bei formal ausreichenden 11 Stunden ungünstig.
  if (zielSchicht === 'F' && letzteWarNacht) {
    if (ruheVorher >= 44) {
      return result(STUFEN.GELB, [
        ...gruende,
        'Vor der Frühschicht lag zuletzt eine Nacht-/nachtähnliche Schicht.',
        'Der Abstand von mindestens 44 Stunden macht den Wechsel vertretbar.',
      ]);
    }

    return result(STUFEN.AMBER, [
      ...gruende,
      'Früh nach Nacht ist trotz eingehaltener Mindestruhezeit ungünstig.',
      'Für eine bessere Bewertung wären mindestens 44 Stunden Abstand sinnvoll.',
    ]);
  }

  // Nacht vor einer direkt folgenden Frühschicht ist besonders ungünstig.
  if (zielSchicht === 'N' && naechsteSchicht === 'F') {
    return result(STUFEN.AMBER, [
      ...gruende,
      'Nach der zusätzlichen Nachtschicht folgt eine Frühschicht.',
      'Diese Schichtfolge ist für den Erholungsrhythmus ungünstig.',
    ]);
  }

  // Vorwärtsrotation F -> S -> N ist günstiger als Rückwärtsrotation.
  const vorwaertsVonVorher =
    (letzteSchicht === 'F' && zielSchicht === 'S') ||
    (letzteSchicht === 'S' && zielSchicht === 'N');

  const vorwaertsZuNachher =
    (zielSchicht === 'F' && naechsteSchicht === 'S') ||
    (zielSchicht === 'S' && naechsteSchicht === 'N');

  if (vorwaertsVonVorher || vorwaertsZuNachher) {
    return result(STUFEN.GELB, [
      ...gruende,
      'Die zusätzliche Schicht folgt einer vorwärts gerichteten Rotation.',
    ]);
  }

  const rueckwaertsVonVorher =
    (letzteSchicht === 'N' && zielSchicht === 'S') ||
    (letzteSchicht === 'S' && zielSchicht === 'F');

  const rueckwaertsZuNachher =
    (zielSchicht === 'N' && naechsteSchicht === 'S') ||
    (zielSchicht === 'S' && naechsteSchicht === 'F');

  if (rueckwaertsVonVorher || rueckwaertsZuNachher) {
    return result(STUFEN.AMBER, [
      ...gruende,
      'Die zusätzliche Schicht erzeugt eine rückwärts gerichtete Rotation.',
    ]);
  }

  // Einzelne Nacht außerhalb eines Nachtblocks.
  if (zielSchicht === 'N' && !letzteWarNacht && !naechsteIstNacht) {
    return result(STUFEN.AMBER, [
      ...gruende,
      'Es entsteht eine einzelne Nachtschicht außerhalb eines Nachtblocks.',
    ]);
  }

  // Viel freie Zeit auf beiden Seiten: möglich, aber nicht automatisch optimal,
  // weil der freie Block durch einen Einzel-Einsatz unterbrochen wird.
  if (ruheVorher >= 24 && ruheNachher >= 24) {
    return result(STUFEN.GELB, [
      ...gruende,
      'Der Dienst ist mit ausreichendem Abstand möglich, unterbricht aber einen freien Zeitraum.',
    ]);
  }

  return result(STUFEN.GELB, [
    ...gruende,
    'Die gesetzliche Mindestruhezeit ist erfüllt, die Schichtfolge ist jedoch nicht optimal.',
  ]);
}

export function getBewertungsDetails_RoehmPP4(f, modalSchicht) {
  const zielSchicht = code(modalSchicht);
  const heute = code(f?.heute);
  const ruheVorher = numberOrNull(f?.ruheVorherStunden);
  const ruheNachher = numberOrNull(f?.ruheNachherStunden);

  if (!STANDARD_SCHICHTEN.has(zielSchicht)) {
    return result(null, ['Keine gültige Zielschicht F, S oder N übergeben.']);
  }

  if (ruheVorher == null || ruheNachher == null) {
    return result(null, ['Ruhezeiten konnten nicht berechnet werden.']);
  }

  if (istBlockiert(heute)) {
    return result(STUFEN.ROT, [`Der Zieltag ist bereits mit "${heute}" belegt.`]);
  }

  if (heute !== FREI && heute !== zielSchicht) {
    return result(STUFEN.ROT, [
      `Der Zieltag ist bereits mit "${heute}" belegt.`,
      'Eine zusätzliche Belegung ist nicht möglich.',
    ]);
  }

  if (ruheVorher < 11 || ruheNachher < 11) {
    return result(STUFEN.ROT, [
      `Ruhezeit vorher: ${ruheVorher.toFixed(1)} Std.`,
      `Ruhezeit nachher: ${ruheNachher.toFixed(1)} Std.`,
      'Mindestens eine Ruhezeit liegt unter 11 Stunden.',
    ]);
  }

  const letzteSchicht = getLetzteSchichtVorher(f);
  const naechsteSchicht = getNaechsteSchichtNachher(f);

  const letzteWarNacht = istNachtOderNachtaehnlich(
    typeof f?.letzteSchichtVorher === 'object' ? f.letzteSchichtVorher : null,
    letzteSchicht
  );

  const naechsteIstNacht = istNachtOderNachtaehnlich(
    typeof f?.naechsteSchichtNachher === 'object' ? f.naechsteSchichtNachher : null,
    naechsteSchicht
  );

  const verfuegung = ermittleVerfuegungstag(f);

  let resultat = bewerteSchichtfolge({
    zielSchicht,
    letzteSchicht,
    naechsteSchicht,
    letzteWarNacht,
    naechsteIstNacht,
    ruheVorher,
    ruheNachher,
    verfuegung,
  });

  const arbeitsserie = zaehleArbeitsserieMitZiel(f, zielSchicht);

  if (arbeitsserie.anzahl >= 7) {
    resultat = deckel(
      resultat,
      STUFEN.ROT,
      `Durch den Einsatz entstehen mindestens ${arbeitsserie.anzahl} Arbeitstage am Stück.`
    );
  } else if (arbeitsserie.anzahl === 6) {
    resultat = deckel(
      resultat,
      STUFEN.AMBER,
      'Durch den Einsatz entstehen 6 Arbeitstage am Stück.'
    );
  } else if (arbeitsserie.anzahl === 5) {
    resultat = deckel(
      resultat,
      STUFEN.GELB,
      'Durch den Einsatz entstehen 5 Arbeitstage am Stück.'
    );
  } else {
    resultat = {
      ...resultat,
      gruende: [
        ...(resultat.gruende || []),
        `Arbeitsserie nach Einsatz: ${arbeitsserie.anzahl} Tage.`,
      ],
    };
  }

  if (arbeitsserie.linksAbgeschnitten || arbeitsserie.rechtsAbgeschnitten) {
    resultat = {
      ...resultat,
      gruende: [
        ...(resultat.gruende || []),
        'Die Arbeitsserie reicht möglicherweise über das sichtbare ±3-Tage-Fenster hinaus.',
      ],
    };
  }

  if (wirdFreizeitblockGeteilt(f) && !verfuegung.istVerfuegungstag) {
    resultat = deckel(
      resultat,
      STUFEN.GELB,
      'Der zusätzliche Dienst teilt einen zusammenhängenden Freizeitblock.'
    );
  }

  const urlaubBlockVorher =
    istUrlaub(f?.vorher) ||
    f?.urlaubImNaechstenBlockVorher === true ||
    code(f?.letzterRelevanterEintragVorher?.kuerzel) === URLAUB;

  const urlaubBlockNachher =
    istUrlaub(f?.nachher) ||
    f?.urlaubImNaechstenBlockNachher === true ||
    code(f?.naechsterRelevanterEintragNachher?.kuerzel) === URLAUB;

  if (urlaubBlockVorher || urlaubBlockNachher) {
    const richtung =
      urlaubBlockVorher && urlaubBlockNachher
        ? 'vor und nach'
        : urlaubBlockVorher
          ? 'vor'
          : 'nach';

    resultat = deckel(
      resultat,
      STUFEN.AMBER,
      `Im nächsten relevanten Block ${richtung} dem Zieltag liegt Urlaub. Daher maximal Amber.`
    );
  }

  return resultat;
}

// Gleiche Schnittstelle wie bei der bestehenden Röhm-5-Schicht-Logik.
export function getBewertungsStufe_RoehmPP4(f, modalSchicht) {
  return getBewertungsDetails_RoehmPP4(f, modalSchicht).stufe;
}

export default getBewertungsStufe_RoehmPP4;
