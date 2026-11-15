/**
 * Filet G3-12 : G3-01, G3-05, D4-F2 et les fiches E de la démo le gardent vert ; un instantané ne se régénère pas sans accord écrit du relecteur.
 *
 * Fige, sans rien corriger, ce que la démo facecam produit aujourd'hui pour 4:5, 9:16, 1:1 et 16:9 : mise en page,
 * tailles, propriétés de la composition (sans style, puis avec un style de sous-titres), groupes de sous-titres et constantes.
 * Aucun rendu, aucun réseau, aucune date ni identifiant aléatoire.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { etatDemoInitial, groupesSousTitres, proprietesDemo, type EtatDemo } from "./chaine";
import type { EntreesDemo } from "./entrees";
import { DUREE_CARTE_FIN_MS, FPS_DEMO, miseEnPageDemo, RATIO_MAITRE_DEMO, TAILLES_DEMO, type RatioDemo } from "./mise-en-page";
import { ID_COMPOSITION_DEMO_FACECAM } from "./proprietes";

const RATIOS: RatioDemo[] = ["4:5", "9:16", "1:1", "16:9"];
const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics. Je clique sur nouveau devis puis je choisis le client et voilà le devis est prêt.";
const motsDe = (texte: string, depuisSec = 0, pas = 0.4): MotHorodate[] => texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(depuisSec + i * pas).toFixed(3), finSec: +(depuisSec + i * pas + 0.33).toFixed(3) }));

/** Arrondit tous les nombres à 2 décimales (instantané stable). */
const arrondi = (v: unknown): unknown => {
  if (typeof v === "number") return Math.round(v * 100) / 100;
  if (Array.isArray(v)) return v.map(arrondi);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arrondi(x)]));
  return v;
};

const etat = (): EtatDemo => ({
  ...etatDemoInitial(),
  mots: motsDe(PHRASE),
  dureeSec: 12.5,
  calage: "aligneur",
  synchro: { mode: "audio", decalageSec: 0.4 },
  plan: {
    version: "plan-scenes-1",
    scenes: [
      { id: "zoom", version: 1, mots: { premier: 0, dernier: 0 }, debutMs: 0, finMs: 4000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "zoom-camera", parametres: { cible: { x: 70, y: 30 }, facteur: 1.8, moment: 0.1, titreFenetre: "Axion" } },
      { id: "clic", version: 1, mots: { premier: 0, dernier: 0 }, debutMs: 4000, finMs: 8000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "curseur", parametres: { trajet: [{ x: 10, y: 10 }, { x: 62, y: 44 }], clic: true, partDeplacement: 0.5 } },
    ],
  } as never,
});

const entrees = (): EntreesDemo => ({
  facecam: { cle: "rush/face.mp4", dureeSec: 12.5, largeur: 1080, hauteur: 1920 },
  ecran: { cle: "rush/ecran.mp4", dureeSec: 12.5, largeur: 1920, hauteur: 1080 },
  partieFacecam: "entier",
  partieEcran: "entier",
  synchro: { mode: "audio" },
  consignes: [
    { type: "zoom", debutMs: 8500, finMs: 10500, x: 40, y: 50, facteur: 1.5 },
    { type: "legende", debutMs: 1000, finMs: 3000, texte: "Nouveau devis" },
  ],
  cadrageVisage: { x: 50, y: 40 },
  carteFin: { titre: "Axion IA", sousTitre: "axion-ia.com" },
  remarques: [],
});

describe("Filet G3-12 : démo facecam, propriétés figées en 4:5, 9:16, 1:1, 16:9", () => {
  it("constantes de la démo", () => {
    expect({ RATIO_MAITRE_DEMO, FPS_DEMO, DUREE_CARTE_FIN_MS, ID_COMPOSITION_DEMO_FACECAM, TAILLES_DEMO }).toMatchSnapshot();
  });

  it.each(RATIOS)("mise en page %s", (ratio) => {
    expect(arrondi(miseEnPageDemo(ratio))).toMatchSnapshot();
  });

  it("groupes de sous-titres", () => {
    expect(arrondi(groupesSousTitres(motsDe(PHRASE)))).toMatchSnapshot();
    expect(groupesSousTitres([])).toEqual([]);
  });

  it.each(RATIOS)("propriétés %s sans style", (ratio) => {
    expect(arrondi(proprietesDemo(etat(), entrees(), ratio))).toMatchSnapshot();
  });

  it.each(RATIOS)("propriétés %s avec un style de sous-titres", (ratio) => {
    expect(arrondi(proprietesDemo(etat(), entrees(), ratio, { prononciations: [] }))).toMatchSnapshot();
  });
});
