/**
 * PLAN DES EXTRAITS ET DE L'ENCHAÎNEMENT DU LOT 5 (données pures, sans React : exécutable sous `tsx` pour les contrôles).
 * Les mots de démonstration (`mots-demo`) sont écrits au débit de ≈ 3,6 mots/s à partir des phrases d'exemple des fiches (standard § I.1) :
 * ce sont des mots PLAUSIBLES calés à l'œil, la voix de la prise n'étant pas leur transcription. Chaque déclencheur d'élément est calé sur son mot.
 * Jetons : `*MOT` = mot fort (plaque ACCENT_1), `#MOT` = chiffre (plaque ACCENT_2) ; la ponctuation finale `. ? !` ajoute une respiration.
 */
export const FPS = 30;
/** Descente de la prise pendant l'appel final : la pile (0,037 → 0,23 H) reste au-dessus du visage (zone Z, haut à 0,12 H + D). */
export const D_APPEL = 0.12;
export type MotDemo = { mot: string; debut: number; fin: number; fort?: boolean; chiffre?: boolean };
export type ChangementD = { i: number; D: number };

/** Écrit les mots en secondes, à partir de `t0` (s), au débit naturel : ≈ 0,07 s + 0,026 s par lettre, respirations après `.`, `?`, `,`. */
export function chronoMots(jetons: string[], t0: number): MotDemo[] {
  let t = t0;
  return jetons.map((j) => {
    const fort = j.startsWith("*");
    const chiffre = j.startsWith("#");
    const brut = j.replace(/^[*#]/, "");
    const mot = brut.replace(/[.,?!]/g, "").replace("…", "");
    const lettres = mot.replace(/\s/g, "").length;
    const dur = 0.07 + 0.026 * lettres + (chiffre ? 0.08 : 0);
    const pause = /[.?!]$/.test(brut) ? 0.2 : /,$/.test(brut) ? 0.08 : 0;
    const m: MotDemo = { mot, debut: Math.round(t * 1e3) / 1e3, fin: Math.round((t + dur) * 1e3) / 1e3, ...(fort ? { fort } : {}), ...(chiffre ? { chiffre } : {}) };
    t += dur + pause;
    return m;
  });
}
export const imageDe = (t: number) => Math.round(t * FPS);

export type Bloc =
  | { t: "etq"; debut: number; fin: number; texte: string; alterne: number; sur?: string }
  | { t: "barre"; debut: number; duree: number; variante: "etiquette" | "pictos"; textes: string[]; iApp: number[]; iBarre: number; resultat?: { texte: string; i: number } }
  | { t: "mot"; debut: number; duree: number; mot: string }
  | { t: "appel"; debut: number; duree: number; motCle: string; lignes: string[]; iLignes: number[]; iMotCle?: number }
  | { t: "dalle"; debut: number; mot: string; suite?: string }
  | { t: "rafale"; debut: number; duree: number; mots: [string, string, string]; ecarts: [number, number] }
  | { t: "duel"; debut: number; duree: number; motA: string; motB: string; iMotB: number; verdict?: { gagnant: "A" | "B"; i: number } }
  | { t: "fin"; debut: number; motCle: string };

export type Plan = {
  id: string;
  /** Instant de la prise (s) à l'image 0 de la composition. */
  s0: number;
  /** Durée (images). */
  duree: number;
  mots: MotDemo[];
  blocs: Bloc[];
  D: ChangementD[];
};

/** Longueurs de référence des éléments (images), reprises des fichiers d'éléments. */
export const DUREES = { dalle: 27, rafale: 52, duel: 66, mot: 48, barre: 54, appel: 105, fin: 42 };

const mot = (mots: MotDemo[], k: number) => mots[k];
const f = (m: MotDemo) => imageDe(m.debut);

/** Cadre un extrait comme le demande la spécification I.2 : 0,3 s (9 i) de prise seule avant le 1ᵉʳ élément, 0,4 s (12 i) après le dernier. */
function cadrer(p: Plan): Plan {
  const finDe = (b: Bloc) => (b.t === "etq" ? b.fin : b.t === "dalle" ? b.debut + DUREES.dalle : b.t === "fin" ? b.debut + DUREES.fin + 14 : b.debut + b.duree);
  const dec = Math.min(...p.blocs.map((b) => b.debut)) - 9;
  const decale = (b: Bloc): Bloc => ({ ...b, debut: b.debut - dec, ...(b.t === "etq" ? { fin: b.fin - dec } : {}) }) as Bloc;
  return {
    ...p,
    s0: Math.round((p.s0 + dec / FPS) * 1e3) / 1e3,
    duree: Math.max(...p.blocs.map(finDe)) + 12 - dec,
    mots: p.mots.map((m) => ({ ...m, debut: Math.round((m.debut - dec / FPS) * 1e3) / 1e3, fin: Math.round((m.fin - dec / FPS) * 1e3) / 1e3 })).filter((m) => m.debut >= 0),
    blocs: p.blocs.map(decale),
    D: p.D.map((c) => ({ ...c, i: c.i - dec })),
  };
}

export function planExtrait(id: string): Plan {
  return cadrer(planExtraitBrut(id));
}

function planExtraitBrut(id: string): Plan {
  const s0 = 1.4;
  switch (id) {
    case "dalle-claquee": {
      const mots = chronoMots(["ALORS", "*STOP.", "À", "LA", "*MAIN.", "VOS", "*CLIENTS", "ATTENDENT."], 0.3);
      return { id, s0, duree: 90, mots, blocs: [{ t: "dalle", debut: f(mot(mots, 1)), mot: "STOP.", suite: "À LA MAIN" }], D: [] };
    }
    case "rafale-trois-mots": {
      const mots = chronoMots(["ON", "FAIT", "TOUT.", "*RELANCE.", "*DEVIS.", "*SIGNÉ.", "ET", "C'EST", "FINI."], 0.3);
      const d = f(mot(mots, 3));
      const ecarts: [number, number] = [f(mot(mots, 4)) - d, f(mot(mots, 5)) - d];
      return { id, s0, duree: 120, mots, blocs: [{ t: "rafale", debut: d, duree: ecarts[1] + 8 + 26, mots: ["RELANCE.", "DEVIS.", "SIGNÉ."], ecarts }], D: [] };
    }
    case "duel-video": {
      const mots = chronoMots(["LE", "*BUREAU", "OU", "LE", "*CHANTIER?", "LE", "*CHANTIER", "*GAGNE."], 0.3);
      const d = f(mot(mots, 1));
      const iB = f(mot(mots, 4)) - d;
      const iV = f(mot(mots, 7)) - d;
      return { id, s0, duree: 135, mots, blocs: [{ t: "duel", debut: d, duree: iV + 24, motA: "LE BUREAU", motB: "LE CHANTIER", iMotB: iB, verdict: { gagnant: "B", i: iV } }], D: [] };
    }
    case "mot-derriere": {
      const mots = chronoMots(["LE", "*TEMPS", "C'EST", "CE", "QUI", "VOUS", "*MANQUE."], 0.3);
      const d = f(mot(mots, 1));
      return { id, s0, duree: 105, mots, blocs: [{ t: "mot", debut: d, duree: DUREES.mot, mot: "TEMPS" }], D: [{ i: d, D: 0.06 }, { i: d + DUREES.mot + 1, D: 0 }] };
    }
    case "element-barre": {
      const mots = chronoMots(["UNE", "*AGENCE", "À", "#2 000", "EUROS", "NON", "*MERCI.", "UNE", "*HEURE", "SUFFIT."], 0.3);
      const d = f(mot(mots, 1));
      const iRes = f(mot(mots, 8)) - d;
      return { id, s0, duree: iRes + 26 + 30, mots, blocs: [{ t: "barre", debut: d, duree: iRes + 26, variante: "etiquette", textes: ["UNE AGENCE", "2 000 €"], iApp: [0, f(mot(mots, 3)) - d], iBarre: f(mot(mots, 5)) - d, resultat: { texte: "1 HEURE", i: iRes } }], D: [{ i: d, D: 0.06 }, { i: d + iRes + 27, D: 0 }] };
    }
    case "element-barre-pictos": {
      const mots = chronoMots(["IL", "AURAIT", "FALLU", "*DIX", "*PERSONNES.", "PLUS", "*BESOIN."], 0.3);
      const d = f(mot(mots, 3));
      const iBarre = f(mot(mots, 5)) - d;
      return { id, s0, duree: 105, mots, blocs: [{ t: "barre", debut: d, duree: iBarre + 5 + 3 + 14 + 3, variante: "pictos", textes: [], iApp: [0], iBarre }], D: [{ i: d, D: 0.06 }, { i: d + iBarre + 26, D: 0 }] };
    }
    case "appel-final-pile": {
      const mots = chronoMots(["*COMMENTEZ", "*RELANCE.", "LE", "*GUIDE,", "LE", "*MODÈLE", "ET", "LA", "*VIDÉO."], 0.3);
      const d = f(mot(mots, 0));
      const iL = [3, 5, 8].map((k) => f(mot(mots, k)) - d);
      const iMotCle = f(mot(mots, 1)) - d;
      return { id, s0, duree: 150, mots, blocs: [{ t: "appel", debut: d, duree: Math.max(105, iL[2] + 40), motCle: "RELANCE", lignes: ["LE GUIDE", "LE MODÈLE", "LA VIDÉO"], iLignes: iL, iMotCle }], D: [{ i: d, D: D_APPEL }, { i: d + Math.max(105, iL[2] + 40) + 1, D: 0 }] };
    }
    case "panneau-fin": {
      const mots = chronoMots(["*COMMENTEZ", "*RELANCE.", "ET", "C'EST", "POUR", "*VOUS."], 0.3);
      const d = Math.max(f(mot(mots, 3)), 40);
      return { id, s0, duree: d + DUREES.fin + 14, mots, blocs: [{ t: "fin", debut: d, motCle: "RELANCE" }], D: [] };
    }
  }
  throw new Error(`extrait inconnu : ${id}`);
}

/** Enchaînement de 15 s : ≥ 5 éléments du lot, 5 premières secondes sans visage couvert, punchs (M5) après 8 s, `EtiquetteTete` génériques entre deux. */
export function planEnchainement(): Plan {
  const pieces: { jetons: string[]; t0: number }[] = [
    { t0: 0.1, jetons: ["SANS", "ME", "*VANTER"] },
    { t0: 0.95, jetons: ["UNE", "*AGENCE", "#2 000", "EUROS", "NON", "*MERCI."] },
    { t0: 2.78, jetons: ["MAIS", "*ATTENTION."] },
    { t0: 3.45, jetons: ["LE", "*TEMPS", "C'EST", "CE", "QUI", "VOUS", "*MANQUE."] },
    { t0: 5.55, jetons: ["*COMMENTEZ", "*RELANCE.", "LE", "*GUIDE", "LE", "*MODÈLE", "ET", "LA", "*VIDÉO."] },
    { t0: 8.1, jetons: ["*STOP.", "À", "LA", "*MAIN."] },
    { t0: 9.05, jetons: ["ET", "*PLUS", "LOIN."] },
    { t0: 9.75, jetons: ["*RELANCE.", "*DEVIS.", "*SIGNÉ."] },
    { t0: 11.5, jetons: ["TOUT", "SEULS."] },
    { t0: 11.85, jetons: ["LE", "*BUREAU", "OU", "LE", "*CHANTIER", "*GAGNE."] },
    { t0: 13.6, jetons: ["*COMMENTEZ", "*RELANCE."] },
  ];
  const parts = pieces.map((p) => chronoMots(p.jetons, p.t0));
  const mots = parts.flat();
  const P = (n: number, k: number) => parts[n][k];
  // Blocs contigus : chaque bloc finit dans l'image où le suivant commence.
  const dEtq0 = 0;
  const dBarre = f(P(1, 0));
  const dEtq1 = dBarre + 54;
  const dMot = f(P(3, 1));
  const dAppel = f(P(4, 0));
  const dDalle = Math.max(240, f(P(5, 0)));
  const dEtq2 = dDalle + DUREES.dalle;
  const dRafale = f(P(7, 0));
  const dEtq3 = dRafale + DUREES.rafale;
  const dDuel = f(P(9, 1));
  const dFin = Math.min(f(P(10, 0)), 450 - DUREES.fin);
  const iB = f(P(9, 4)) - dDuel;
  const iV = f(P(9, 5)) - dDuel;
  const dureeAppel = dDalle - dAppel;
  const blocs: Bloc[] = [
    { t: "etq", debut: dEtq0, fin: dBarre, texte: "SANS ME VANTER…", alterne: 0, sur: "AXION-IA" },
    { t: "barre", debut: dBarre, duree: dEtq1 - dBarre, variante: "etiquette", textes: ["UNE AGENCE", "2 000 €"], iApp: [f(P(1, 1)) - dBarre, f(P(1, 2)) - dBarre], iBarre: f(P(1, 4)) - dBarre },
    { t: "etq", debut: dEtq1, fin: dMot, texte: "MAIS ATTENTION.", alterne: 1 },
    { t: "mot", debut: dMot, duree: dAppel - dMot, mot: "TEMPS" },
    { t: "appel", debut: dAppel, duree: dureeAppel, motCle: "RELANCE", lignes: ["LE GUIDE", "LE MODÈLE", "LA VIDÉO"], iLignes: [3, 5, 8].map((k) => f(P(4, k)) - dAppel), iMotCle: f(P(4, 1)) - dAppel },
    { t: "dalle", debut: dDalle, mot: "STOP.", suite: "À LA MAIN" },
    { t: "etq", debut: dEtq2, fin: dRafale, texte: "ET PLUS LOIN.", alterne: 0 },
    { t: "rafale", debut: dRafale, duree: 52, mots: ["RELANCE.", "DEVIS.", "SIGNÉ."], ecarts: [f(P(7, 1)) - dRafale, f(P(7, 2)) - dRafale] },
    { t: "etq", debut: dEtq3, fin: dDuel, texte: "TOUT SEULS.", alterne: 1 },
    { t: "duel", debut: dDuel, duree: dFin - dDuel, motA: "LE BUREAU", motB: "LE CHANTIER", iMotB: iB, verdict: { gagnant: "B", i: iV } },
    { t: "fin", debut: dFin, motCle: "RELANCE" },
  ];
  return { id: "enchainement", s0: 0, duree: 450, mots, blocs, D: [{ i: 0, D: 0.06 }, { i: dAppel, D: D_APPEL }, { i: dDalle, D: 0.06 }] };
}
