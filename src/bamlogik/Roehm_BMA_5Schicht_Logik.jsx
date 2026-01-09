// src/bmaLogik/Roehm_BMA_5Schicht_Logik.jsx

export function getBewertungsStufe_Roehm5(f, modalSchicht) {
  const frei = (v) => v === '-';
  const freiOderF = (v) => v === '-' || v === 'F';
  const nichtFrei = (v) => v !== '-';

  // ⚠️ Das ist DEIN bestehender Code – nur ausgelagert.
  if (
    f.vorvortag === 'U' &&
    f.folgetagplus === 'U' &&
    (
      (frei(f.vorher) && frei(f.heute)) ||
      (frei(f.vorher) && frei(f.nachher)) ||
      (frei(f.heute) && frei(f.nachher))
    )
  ) return 'rot';

  if (modalSchicht === 'F') {
    if (f.nachher === 'U' || f.vorvortag === 'U' || f.vorher === 'N' || f.vorher === 'U') return 'rot';

    if (
      (f.vorher === '-' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
      (f.vorher === 'F' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'S') ||
      (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'S') ||
      (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === 'S' && f.folgetagplus === '-') ||
      (f.vorvortag === 'K' && f.vorher === 'K' && f.nachher === '-' && f.folgetagplus === 'S') ||
      (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F') ||
      (f.vorvortag === 'S' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F')
    ) return 'grün';

    if (f.vorher === '-' && f.vorvortag === 'N') return 'gelb';
    if (
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'U') ||
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'S' && f.folgetagplus === 'F')
    ) return 'gelb';

    if (f.vorher === 'S') return 'amber';
    if (nichtFrei(f.vorvortag) && nichtFrei(f.vorher) && f.nachher === 'F' && f.folgetagplus === 'F') return 'amber';
  }

  if (modalSchicht === 'N') {
    if (f.vorher === 'U') return 'rot';
    if (['KO', 'K', 'U', 'F'].includes(f.nachher)) return 'rot';

    if (
      (f.vorvortag === 'N' && f.vorher === 'N' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
      (f.vorvortag === '-' && f.vorher === '-' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
      (f.vorvortag === 'N' && f.vorher === '-' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
      (f.vorvortag === 'N' && f.vorher === '-' && nichtFrei(f.nachher) && frei(f.folgetagplus))
    ) return 'rot';

    if (
      (f.vorher === 'N' && f.nachher === 'N') ||
      (f.vorher === 'N' && frei(f.nachher) && frei(f.folgetagplus)) ||
      (f.vorvortag === 'N' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === '-')
    ) return 'grün';

    if (
      f.nachher === 'S' ||
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'U') ||
      (f.vorvortag === 'U' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === '-')
    ) return 'amber';

    if (
      (frei(f.nachher) && f.folgetagplus === 'F') ||
      (f.vorvortag === 'N' && f.vorher === 'N' && frei(f.nachher) && f.folgetagplus === 'S') ||
      (f.vorvortag === 'K' && f.vorher === 'K' && frei(f.nachher) && f.folgetagplus === 'S') ||
      (f.vorvortag === 'N' && f.vorher === 'N' && frei(f.nachher) && nichtFrei(f.folgetagplus))
    ) return 'gelb';
  }

  if (modalSchicht === 'S') {
    if (f.vorvortag === 'S' && frei(f.vorher) && frei(f.heute) && f.nachher === 'F' && f.folgetagplus === 'F') {
      return 'amber';
    }
    if (f.vorher === 'U') return 'rot';

    if (
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === '-') ||
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F') ||
      (f.vorvortag === '-' && f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === '-') ||
      (f.vorvortag === '-' && f.vorher === 'N' && f.nachher === 'F' && f.folgetagplus === 'F') ||
      (f.vorvortag === 'N' && f.vorher === 'N' && f.nachher === 'F' && f.folgetagplus === 'F') ||
      (f.vorvortag === 'N' && f.vorher === 'N' && frei(f.nachher) && frei(f.folgetagplus)) ||
      (f.vorvortag === '-' && nichtFrei(f.vorher) && f.nachher === 'F' && f.folgetagplus === 'F') ||
      (f.vorvortag === 'S' && f.vorher === 'S' && f.nachher === 'F' && f.folgetagplus === 'F') ||
      (f.vorvortag === '-' && frei(f.vorher) && f.nachher === 'U' && f.folgetagplus === 'U')
    ) return 'amber';

    if (
      (f.vorher === '-' && f.vorvortag === 'U') ||
      (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'U' && f.folgetagplus === 'F') ||
      (frei(f.nachher) && f.folgetagplus === 'F')
    ) return 'gelb';

    if (
      (f.vorher === '-' && f.vorvortag === 'N') ||
      (f.vorher === '-' && frei(f.nachher)) ||
      (f.vorvortag === 'F' && f.vorher === 'F' && f.nachher === 'S' && f.folgetagplus === 'N')
    ) return 'grün';
  }

  return null;
}
