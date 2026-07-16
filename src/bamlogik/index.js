// src/bamLogik/index.js
import { getBewertungsStufe_Roehm5 } from './Roehm_BMA_5Schicht_Logik.jsx';
import { getBewertungsStufe_RoehmPP4 } from './Roehm_PP_4Schicht_Logik.jsx';
import { getBewertungsStufe_Jokon3 } from './Jokon_3Schicht_Logik.jsx';

export function resolveBamLogik(logikKey) {
  switch (String(logikKey || '').trim().toUpperCase()) {
    case 'JOKON_3SCHICHT':
      return getBewertungsStufe_Jokon3;

    case 'ROEHM_PP_4SCHICHT':
      return getBewertungsStufe_RoehmPP4;

    case 'ROEHM_5SCHICHT':
    default:
      return getBewertungsStufe_Roehm5;
  }
}