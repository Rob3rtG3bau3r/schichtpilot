// src/bmaLogik/index.js
import { getBewertungsStufe_Roehm5 } from './Roehm_BMA_5Schicht_Logik.jsx';
import { getBewertungsStufe_Jokon3 } from './Jokon_BMA_3Schicht_Logik.jsx';

export function resolveBmaLogik(logikKey) {
  switch (String(logikKey || '').toUpperCase()) {
    case 'JOKON_3SCHICHT':
      return getBewertungsStufe_Jokon3;
    case 'ROEHM_5SCHICHT':
    default:
      return getBewertungsStufe_Roehm5;
  }
}
