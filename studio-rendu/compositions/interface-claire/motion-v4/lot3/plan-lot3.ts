/**
 * PLAN DE MONTAGE du lot 3 (données pures, sans React) : un extrait par élément + l'enchaînement de 15 s.
 * Les instants des déclencheurs sont calés sur les mots de `mots-demo.json` (± 3 i). Utilisé par `PlancheLot3.tsx` (rendu) et
 * `verifier-rythme.ts` (densité d'événements, prise seule, immobilité).
 */
import type { CleSt, ClePrise, MotDemo, Muet } from "./commun-lot3";
import { DESCENTE, FPS } from "./commun-lot3";
import motsDemo from "./mots-demo.json";

export type ElementId = "FilEtape" | "Chrono" | "AvisEtoiles" | "EclatChiffre" | "PageWebDefile" | "CarrouselFeuillete" | "JaugePourcentage" | "PileNotifications";
export const ELEMENTS: ElementId[] = ["FilEtape", "Chrono", "AvisEtoiles", "EclatChiffre", "PageWebDefile", "CarrouselFeuillete", "JaugePourcentage", "PileNotifications"];

export type ItemPlan = {
  /** Nom de l'élément (ou « EtiquetteGenerique »). */
  nom: ElementId | "EtiquetteGenerique";
  debut: number;
  duree: number;
  props: Record<string, unknown>;
};
export type Plan = { total: number; items: ItemPlan[]; cles: ClePrise[]; st: CleSt[]; mots: MotDemo[]; depart: number; muets: Muet[] };

const MOTS = motsDemo as unknown as Record<string, MotDemo[]>;
export const motsDe = (id: string): MotDemo[] => MOTS[id];

/** Image (absolue au plan) du `occ`-ième mot `mot`. */
export const fr = (mots: MotDemo[], mot: string, occ = 0): number => {
  const m = mots.filter((w) => w.mot === mot)[occ];
  if (!m) throw new Error(`mot introuvable : ${mot}`);
  return Math.round(m.debut * FPS);
};

/** Durée propre à chaque élément (images), identique à celle des composants. */
export const DUREES: Record<ElementId, number> = {
  FilEtape: 80, Chrono: 56, AvisEtoiles: 60, EclatChiffre: 44, PageWebDefile: 92, CarrouselFeuillete: 88, JaugePourcentage: 66, PileNotifications: 56,
};
const MIN_TOTAL = 96;

/**
 * Gabarits de sous-titres (centre en fraction de H) : M1 0,66 ; M4 (fenêtre sur le visage) 0,78 ; M7 (notifications en bas) 0,075 ;
 * M5 (plein cadre) 0,82 ; M2 (carte haute, prise à D2) « carte » 0,40 une fois D ≥ 0,20, sinon 0,66. La position finale est recalculée à chaque
 * image depuis la descente RÉELLE de la prise (`ySt`), et ne coupe jamais la bande des yeux.
 */
export function planExtrait(id: ElementId, palette: "B" = "B"): Plan {
  const mots = MOTS[id];
  const f = (m: string, o = 0) => fr(mots, m, o);
  let debut = 9, props: Record<string, unknown> = { palette }, cles: ClePrise[] = [];
  let yElem = 0.66, carte: number | undefined;
  const duree = DUREES[id];
  const muetsRel: { mots: string[]; de: number; a: number }[] = [];
  switch (id) {
    case "FilEtape": debut = 9; props = { palette, duree, mots: [0, f("ON") - debut] }; cles = [{ i: debut, D: DESCENTE.D1 }];
      muetsRel.push({ mots: ["ÉTAPE", "FORMAT", "LE"], de: 0, a: 37 }); break;
    case "Chrono": debut = 13; props = { palette, duree, mots: [0, f("DEUX") - debut, f("POUR") - debut] }; cles = [{ i: debut, D: DESCENTE.D1 }];
      muetsRel.push({ mots: ["POUR", "CRÉER", "UN", "AGENT"], de: f("POUR") - debut, a: duree }); break;
    case "AvisEtoiles": debut = 12; props = { palette, duree, mots: [0, f("DEVIENT") - debut, f("NIVEAU") - debut, f("EXPERT") - debut, f("CINQ") - debut, f("CINQ", 1) - debut] }; cles = [{ i: debut, D: DESCENTE.D1 }];
      muetsRel.push({ mots: ["L'AGENT"], de: 0, a: duree }, { mots: ["NIVEAU", "EXPERT"], de: f("NIVEAU") - debut, a: duree }); break;
    case "EclatChiffre": debut = 27; yElem = 0.82; props = { palette, duree, valeur: 45, unite: "MINUTES", precision: "PAR DEVIS", mots: [0, f("MINUTES") - debut, f("PAR") - debut] };
      muetsRel.push({ mots: ["45", "MINUTES", "PAR", "DEVIS"], de: 0, a: duree }); break;
    case "PageWebDefile": debut = 9; yElem = 0.78; props = { palette, duree, mots: [0, f("CONSTRUITE") - debut, f("UNE") - debut, f("TOUT") - debut] };
      muetsRel.push({ mots: ["EN", "UNE", "HEURE"], de: f("UNE") - debut, a: f("TOUT") - debut }, { mots: ["TOUT", "SEUL"], de: f("TOUT") - debut, a: duree }); break;
    case "CarrouselFeuillete": debut = 17; yElem = 0.78; props = { palette, duree, pages: 8, mots: [0, 6, f("À") - debut, f("PRÊT") - debut] };
      muetsRel.push({ mots: ["CARROUSEL", "ENTIER"], de: 6, a: f("À") - debut }, { mots: ["À", "MA", "CHARTE"], de: f("À") - debut, a: f("PRÊT") - debut },
        { mots: ["PRÊT", "PUBLIER"], de: f("PRÊT") - debut, a: duree - 4 }); break;
    case "JaugePourcentage": debut = 9; carte = 0.40; props = { palette, duree, mots: [f("ME") - debut, f("VIDÉO") - debut, f("MONTÉE") - debut, f("CENT") - debut] }; cles = [{ i: debut, D: DESCENTE.D2 }]; break;
    case "PileNotifications": debut = 9; yElem = 0.075; props = { palette, duree, mots: [f("RELANCE") - debut, f("RÉPOND") - debut, f("SIGNÉ") - debut] };
      muetsRel.push({ mots: ["RELANCE"], de: f("RELANCE") - debut, a: duree }, { mots: ["LE", "CLIENT", "RÉPOND"], de: f("RÉPOND") - debut, a: duree }, { mots: ["DEVIS", "SIGNÉ"], de: f("SIGNÉ") - debut, a: duree }); break;
  }
  const fin = debut + duree;
  if (cles.length) cles.push({ i: fin + 1, D: DESCENTE.D0 });
  const total = Math.max(fin + 12, MIN_TOTAL);
  const st: CleSt[] = [{ i: 0, y: 0.66 }, { i: debut, y: yElem, carte }, { i: fin, y: 0.66 }];
  const muets: Muet[] = muetsRel.map((m) => ({ mots: m.mots, i0: debut + m.de, i1: debut + m.a }));
  return { total, items: [{ nom: id, debut, duree, props }], cles, st, mots, depart: 15, muets };
}

/** Enchaînement de 15 s (450 images) : 8 éléments du lot 3 + 2 étiquettes génériques. Frontières en images absolues. */
export function planEnchainement(palette: "B" = "B"): Plan {
  const mots = MOTS.enchainement;
  const f = (m: string, o = 0) => fr(mots, m, o);
  const items: ItemPlan[] = [];
  const add = (nom: ItemPlan["nom"], debut: number, duree: number, props: Record<string, unknown>) => items.push({ nom, debut, duree, props: { palette, ...props } });
  add("EtiquetteGenerique", 0, 21, { texte: "MON AGENT VIDÉO", iSortie: 18, incl: -4, y: 150 });
  add("JaugePourcentage", 21, 57, { duree: 57, mots: [f("ME") - 21, f("SORT") - 21, f("MONTAGE") - 21, f("CENT") - 21], ding: true });
  add("AvisEtoiles", 78, 38, { duree: 38, ding: false, mots: [0, 0, f("NIVEAU") - 78, f("EXPERT") - 78, f("CINQ") - 78, f("CINQ", 1) - 78] });
  add("FilEtape", 116, 81, { duree: 81, mots: [0, 37] });
  add("Chrono", 153, 44, { duree: 44, ding: false, mots: [0, f("DEUX") - 153, f("POUR", 1) - 153] });
  add("PageWebDefile", 197, 57, { duree: 57, mots: [0, f("CONSTRUITE") - 197, f("UNE") - 197] });
  add("PileNotifications", 254, 60, { duree: 60, mots: [f("RELANCE") - 254, f("RÉPOND") - 254, f("SIGNÉ") - 254], ding: true });
  add("EclatChiffre", 314, 42, { duree: 42, valeur: 45, unite: "MINUTES", precision: "PAR DEVIS", mots: [0, f("MINUTES", 1) - 314, f("PAR") - 314] });
  add("CarrouselFeuillete", 356, 70, { duree: 70, pages: 7, mots: [0, 6, f("À", 1) - 356, f("PRÊT", 1) - 356] });
  add("EtiquetteGenerique", 426, 24, { texte: "COMMENTEZ RELANCE", iSortie: 21, incl: 3, y: 150, alt: true });
  const cles: ClePrise[] = [
    { i: 0, D: DESCENTE.D1 }, { i: 21, D: DESCENTE.D2 }, { i: 79, D: DESCENTE.D1 },
    { i: 203, D: DESCENTE.D0 }, { i: 320, D: DESCENTE.D1 },
  ];
  const st: CleSt[] = [
    { i: 0, y: 0.66 }, { i: 21, y: 0.66, carte: 0.4 }, { i: 78, y: 0.66 }, { i: 197, y: 0.78 }, { i: 254, y: 0.075 }, { i: 314, y: 0.82 }, { i: 356, y: 0.78 }, { i: 426, y: 0.66 },
  ];
  const muets: Muet[] = [
    { mots: ["MON", "AGENT", "VIDÉO"], i0: 0, i1: 21 },
    { mots: ["NIVEAU", "EXPERT"], i0: 78 + f("NIVEAU") - 78, i1: 116 },
    { mots: ["ÉTAPE", "FORMAT", "LE"], i0: 116, i1: 149 },
    { mots: ["POUR", "CRÉER", "UN", "AGENT"], i0: f("POUR", 1), i1: 194 },
    { mots: ["EN", "UNE", "HEURE"], i0: f("UNE"), i1: 250 },
    { mots: ["RELANCE"], i0: f("RELANCE"), i1: 311 }, { mots: ["LE", "CLIENT", "RÉPOND"], i0: f("RÉPOND"), i1: 311 }, { mots: ["DEVIS", "SIGNÉ"], i0: f("SIGNÉ"), i1: 311 },
    { mots: ["45", "MINUTES", "PAR", "DEVIS"], i0: 314, i1: 356 },
    { mots: ["CARROUSEL", "ENTIER"], i0: 362, i1: 376 }, { mots: ["À", "MA", "CHARTE"], i0: 376, i1: 394 }, { mots: ["PRÊT", "PUBLIER"], i0: f("PRÊT", 1) , i1: 422 },
    { mots: ["COMMENTEZ", "RELANCE"], i0: 426, i1: 450 },
  ];
  return { total: 450, items, cles, st, mots, depart: 0, muets };
}
