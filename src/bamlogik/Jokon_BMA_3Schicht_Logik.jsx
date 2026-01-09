// src/bmaLogik/Jokon_BMA_3Schicht_Logik.jsx

export function getBewertungsStufe_Jokon3(f, modalSchicht) {
  // Beispiel: deutlich "einfacher" – bitte später an Jokon anpassen
  // Idee: Rot, wenn direkte harte Konflikte (z.B. N -> F)
  if (modalSchicht === 'F' && f.vorher === 'N') return 'rot';
  if (modalSchicht === 'N' && f.nachher === 'F') return 'rot';

  // Grün, wenn rund um den Tag frei (klassischer "guter Move")
  const frei = (v) => v === '-';
  if (frei(f.vorher) && frei(f.heute) && frei(f.nachher)) return 'grün';

  // Gelb, wenn teilweise frei
  if (frei(f.vorher) || frei(f.nachher)) return 'gelb';

  // Amber als "geht so"
  return 'amber';
}
