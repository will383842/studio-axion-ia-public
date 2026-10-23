/**
 * FACECAM — LOT F1 « Déclinaisons de format » (4:5, 1:1, 16:9 en plus du 9:16). Tests du périmètre :
 *  - cadrage par format depuis la piste du visage (yeux à 30-38 %, marges de la vitre, mêmes plans que le 9:16) ;
 *  - zones sûres par format ; écran partagé 45/55 (haut / bas en 4:5 et 1:1, côte à côte en 16:9) ; sous-titres ;
 *  - contrôle machine par format (rien de coupé) ;
 *  - 9:16 STRICTEMENT inchangé (chaîne, habillage, résultat, graphe FFmpeg) ;
 *  - chaîne en simulation : UNE passe image pour tous les formats, une piste pré-cadrée par format, habillage et
 *    composition par format ; format ajouté après coup (passe élargie une fois, partagée) ; demandes au monteur.
 * Aucun réseau, aucun appel réel (doubles de simulation).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import { parametresComposition } from "@/briques/composition/parametres";
import { geometrieEcranPartage, type ParametresDemandeComposition } from "@/briques/composition/scene";
import { cssElement, elementDe } from "@/briques/sous-titres/scene";
import { realiser, type PisteVisage } from "@/briques/realisation";
import {
  bandeCouvre,
  comprendreDemandeFormats,
  controlerFormat,
  declinaisonsDemandees,
  dispositionEcranPartage,
  entreesAvecFormats,
  fenetreFormat,
  formatsDemandes,
  formatsDesConsignes,
  ligneEcranPartage,
  lireFormatsFacecam,
  placementPersonne,
  plansDuFormat,
  positionSousTitresFormat,
  rapportRatio,
  rectangleSur,
  renduCarteFormat,
  sourceUtile,
  visagePx,
  zoneSure,
  type RatioDeclinaison,
} from "@/briques/formats-facecam";
import { ZONES_SURES } from "@/briques/motion/jetons";
import { carteDepuisTextes } from "@/briques/motion";
import { argumentsImageFfmpeg, type FichiersImage } from "../studio-rendu/src/composition/image-ffmpeg";
import { avancerChaine, bandeDesPlans, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { resultatChaine } from "@/moteurs/montage-facecam/etapes-chaine";
import { creerMoteurMontageFacecam } from "@/moteurs/montage-facecam";
import { completerAvecDeclinaisons, habillageFacecamRatio } from "@/moteurs/montage-facecam/declinaisons";
import { habillageFacecam, RECETTE_COMPOSITION_FACECAM, type EntreeHabillageFacecam } from "@/moteurs/montage-facecam/habillage";
import type { CarteMonteur } from "@/moteurs/montage-facecam/raccords";

const SOURCE = { largeur: 3840, hauteur: 2160 };
const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function commande(o: { ratios?: string[]; entrees?: Record<string, unknown>; texte?: string } = {}): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: o.ratios ?? ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: o.texte ?? TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: o.entrees ?? {},
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

/** Mots réguliers (un toutes les 0,385 s), quelques mots longs (punch-ins). */
function mots(debut: number, fin: number): MotHorodate[] {
  const m: MotHorodate[] = [];
  for (let t = debut, i = 0; t + 0.3 < fin; t += 0.385, i++) m.push({ mot: i % 7 === 3 ? "transformation" : "et", debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) });
  return m;
}

/** Piste : yeux à `yeuxY` de la hauteur de la source, légèrement à droite ; ovale de 27 % de la hauteur. */
function piste(duree: number, yeuxY = 0.36, yeuxX = 0.52): PisteVisage {
  const echantillons = [];
  for (let t = 0; t <= duree; t += 0.12) echantillons.push({ t: +t.toFixed(2), yeuxX, yeuxY, boite: [yeuxX - 0.055, yeuxY - 0.115, 0.11, 0.27] as [number, number, number, number], bouche: 0.2, confiance: 1 });
  return { version: 1, largeurSource: SOURCE.largeur, hauteurSource: SOURCE.hauteur, imagesParSec: 25, echantillons, visageTrouvePct: 100 };
}

function outilsRendu(): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine, c = commande()): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

const etapes = (f: ReturnType<typeof creerFacecamSimule>) => f.soumises.map((s) => `${s.route}${s.demande.parametres?.etape ? `:${s.demande.parametres.etape}` : ""}`);

const CARTE_LISTE: CarteMonteur = { id: "pas-1", debutSec: 4, finSec: 9, disposition: "moitie-haute", modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], description: "Les trois raisons" };
const CARTE_CHIFFRE: CarteMonteur = { id: "pas-2", debutSec: 14, finSec: 18, disposition: "plein-ecran", modele: "chiffre", textes: ["30 %", "de temps gagné"], description: "30 % de temps gagné" };

/* ------------------------------------------------------------------ */

describe("lot F1 · formats demandés", () => {
  it("9:16 toujours en premier, puis 4:5, 1:1 et 16:9 dans l'ordre, sans doublon ; valeurs inconnues écartées", () => {
    expect(formatsDemandes(["16:9", "1:1", "x", "1:1"])).toEqual(["9:16", "1:1", "16:9"]);
    expect(declinaisonsDemandees(["9:16"])).toEqual([]);
    expect(lireFormatsFacecam({ facecamFormats: { ratios: ["16:9", "9:16", 4] } }).ratios).toEqual(["16:9"]);
    expect(lireFormatsFacecam(undefined).ratios).toEqual([]);
    const e = entreesAvecFormats({ facecam: { a: 1 } }, ["4:5"]);
    expect(e).toEqual({ facecam: { a: 1 }, facecamFormats: { version: 1, ratios: ["4:5"] } });
    // Aucune déclinaison : la clé disparaît (entrées d'une vidéo 9:16 seule, comme avant).
    expect(entreesAvecFormats(e, [])).toEqual({ facecam: { a: 1 } });
  });

  it("« Monteur, fais-moi aussi une version carrée / pour YouTube » : compris sans appel ; une animation carrée reste au monteur", () => {
    expect(comprendreDemandeFormats("Monteur, fais-moi aussi une version carrée")?.ajouter).toEqual(["1:1"]);
    expect(comprendreDemandeFormats("Tu peux me sortir une version pour YouTube ?")?.ajouter).toEqual(["16:9"]);
    expect(comprendreDemandeFormats("une version 4:5 pour le feed")?.ajouter).toEqual(["4:5"]);
    expect(comprendreDemandeFormats("Fais-la dans tous les formats")?.ajouter).toEqual(["4:5", "1:1", "16:9"]);
    expect(comprendreDemandeFormats("Enlève la version horizontale")).toMatchObject({ ajouter: [], retirer: ["16:9"] });
    expect(comprendreDemandeFormats("à 0:32 fais une animation carrée en orange")).toBeNull();
    expect(comprendreDemandeFormats("Mets le titre en 16:9")).toBeNull();
    expect(comprendreDemandeFormats("Plus lent")).toBeNull();
    expect(formatsDesConsignes([{ texte: "Monteur, fais-moi aussi une version carrée" }, { texte: "Monteur, zoom ici" }])).toEqual(["1:1"]);
  });
});

describe("lot F1 · zones sûres par format", () => {
  it("union des réseaux qui publient le format et du plancher de la charte motion (bord par bord)", () => {
    const z45 = zoneSure("4:5");
    expect(z45.haut).toBeGreaterThanOrEqual(ZONES_SURES["4:5"].haut);
    expect(z45.bas).toBeGreaterThanOrEqual(0.12);
    expect(zoneSure("1:1").bas).toBeGreaterThanOrEqual(0.12);
    // 16:9 : la zone de YouTube (bas 12 %, barre de lecture) et le titre sûr (5 % sur les côtés).
    expect(zoneSure("16:9")).toEqual({ haut: 0.06, droite: 0.05, bas: 0.12, gauche: 0.05 });
    // 9:16 : au moins les zones d'aujourd'hui (TikTok, Reels, Shorts).
    expect(zoneSure("9:16").bas).toBeGreaterThanOrEqual(0.3);
    const r = rectangleSur("16:9");
    expect(r).toEqual({ x: 96, y: 65, largeur: 1728, hauteur: 886 });
  });
});

describe("lot F1 · cadrage par format depuis la piste du visage", () => {
  const duree = 40;
  const p = piste(duree);
  const plan916 = realiser({ gardes: [{ debutSec: 0, finSec: 12 }, { debutSec: 13, finSec: 26 }, { debutSec: 27, finSec: duree }], mots: mots(0, duree), piste: p, source: SOURCE });

  for (const ratio of ["4:5", "1:1", "16:9"] as const) {
    it(`${ratio} : mêmes bornes et mêmes tailles que le 9:16, yeux à 30-38 %, fenêtre au bon rapport, jamais au bord de la vitre`, () => {
      const plans = plansDuFormat(ratio, plan916.plans, SOURCE, p);
      const utile = sourceUtile(SOURCE);
      expect(plans.map((x) => [x.debutSec, x.finSec, x.taille, x.ouverture])).toEqual(plan916.plans.map((x) => [x.debutSec, x.finSec, x.taille, x.ouverture]));
      for (const x of plans) {
        expect(x.yeuxHauteur).toBeGreaterThanOrEqual(0.3 - 1e-3);
        expect(x.yeuxHauteur).toBeLessThanOrEqual(0.38 + 1e-3);
        expect(Math.abs(x.cadre.largeur / x.cadre.hauteur - rapportRatio(ratio))).toBeLessThan(0.01);
        expect(x.cadre.x).toBeGreaterThanOrEqual(utile.x);
        expect(x.cadre.y).toBeGreaterThanOrEqual(utile.y);
        expect(x.cadre.x + x.cadre.largeur).toBeLessThanOrEqual(utile.x + utile.largeur);
        expect(x.cadre.y + x.cadre.hauteur).toBeLessThanOrEqual(utile.y + utile.hauteur);
        // Visage centré en largeur (en 16:9 la fenêtre est presque toute la source : bornée, il reste à ±3 %), entier.
        expect(Math.abs(x.yeuxLargeur - 0.5)).toBeLessThan(0.03);
        expect(x.visage[1]).toBeGreaterThan(0);
        expect(x.visage[1] + x.visage[3]).toBeLessThan(1);
        // Pas plus agrandi que le 9:16 serré (2160 / 1,3 → 1920).
        expect(x.agrandissement).toBeLessThanOrEqual(1.16 + 1e-3);
      }
      // Zone morte : visage immobile → même cadre pour une même taille.
      const parTaille = new Map<number, string>();
      for (const x of plans) {
        const k = JSON.stringify(x.cadre);
        if (parTaille.has(x.taille)) expect(parTaille.get(x.taille)).toBe(k);
        else parTaille.set(x.taille, k);
      }
      expect(controlerFormat({ ratio, plans, sousTitres: { centrePct: positionSousTitresFormat(ratio, 50) } }).defauts.filter((d) => d.type.startsWith("visage") || d.type === "yeux-hors-bande")).toEqual([]);
    });
  }

  it("16:9 : yeux hauts dans la source (40 %) → la fenêtre se resserre juste assez pour les ramener dans la bande", () => {
    const f = fenetreFormat("16:9", 100, { yeuxX: 0.5, yeuxY: 0.45 }, SOURCE);
    expect(f.yeuxHauteur).toBeGreaterThanOrEqual(0.3);
    expect(f.yeuxHauteur).toBeLessThanOrEqual(0.38);
    // Resserrée par rapport à la plus grande fenêtre 16:9 de la source utile (3532 × 1987).
    expect(f.cadre.hauteur).toBeLessThan(sourceUtile(SOURCE).hauteur);
    expect(f.agrandissement).toBeLessThanOrEqual(1.16 + 1e-3);
  });

  it("la bande de la passe image couvre toutes les fenêtres ; une bande 9:16 seule ne couvre pas le 16:9", () => {
    const b916 = bandeDesPlans(plan916.plans, SOURCE);
    const p169 = plansDuFormat("16:9", plan916.plans, SOURCE, p);
    expect(bandeCouvre(b916, plan916.plans.map((x) => x.cadre))).toBe(true);
    expect(bandeCouvre(b916, p169.map((x) => x.cadre))).toBe(false);
  });

  it("sans piste (visages ratés) : le visage est déduit du cadre 9:16, les yeux restent dans la bande", () => {
    const plans = plansDuFormat("1:1", plan916.plans, SOURCE, null);
    for (const x of plans) expect(x.yeuxHauteur).toBeGreaterThanOrEqual(0.3 - 1e-3);
  });
});

describe("lot F1 · écran partagé 45/55 et sous-titres par format", () => {
  it("4:5 et 1:1 : carte en haut (45 %), Will en bas (55 %) ; 16:9 : carte à gauche 864 px, Will à droite 1 056 px", () => {
    expect(dispositionEcranPartage("9:16")).toEqual({ type: "haut", hauteurCarte: 960, hauteurPersonne: 960 });
    expect(dispositionEcranPartage("4:5")).toEqual({ type: "haut", hauteurCarte: 608, hauteurPersonne: 742 });
    expect(dispositionEcranPartage("1:1")).toEqual({ type: "haut", hauteurCarte: 486, hauteurPersonne: 594 });
    expect(dispositionEcranPartage("16:9")).toEqual({ type: "gauche", largeurCarte: 864, largeurPersonne: 1056 });
    // 16:9 : la carte est une carte motion 4:5 plein écran (même rapport 0,8 que 864 × 1080), plein écran compris.
    expect(renduCarteFormat("16:9", "moitie-haute")).toEqual({ ratioMotion: "4:5", dispositionMotion: "plein-ecran", posee: "ecran-partage" });
    expect(renduCarteFormat("16:9", "plein-ecran").posee).toBe("ecran-partage");
    expect(renduCarteFormat("4:5", "moitie-haute")).toEqual({ ratioMotion: "4:5", dispositionMotion: "moitie-haute", posee: "ecran-partage" });
  });

  it("placement de la personne : yeux à 37,5 % de sa partie (haut / bas) ; visage à 40 % de sa colonne, depuis le bord extérieur (16:9)", () => {
    const p45 = placementPersonne("4:5", { yeuxX: 540, yeuxY: 459 }) as { sourceY: number };
    expect((459 - p45.sourceY) / 742).toBeCloseTo(0.375, 2);
    const p169 = placementPersonne("16:9", { yeuxX: 960, yeuxY: 367 }) as { sourceX: number };
    const xFinal = 960 - p169.sourceX + 864;
    expect((1920 - xFinal) / 1056).toBeCloseTo(0.4, 2);
  });

  it("sous-titres : sous la bouche dans les bornes du format, jamais dans la zone sûre du bas ; jonction ou colonne pendant un écran partagé", () => {
    expect(positionSousTitresFormat("4:5", 50)).toBe(59);
    expect(positionSousTitresFormat("16:9", 80)).toBe(82);
    expect(positionSousTitresFormat("1:1", 30)).toBe(55);
    expect(ligneEcranPartage("1:1", 60)).toEqual({ centrePct: 45 });
    expect(ligneEcranPartage("16:9", 70)).toEqual({ centrePct: 70, colonne: { gauchePx: 917, largeurPx: 950 } });
  });

  it("contrôle machine : visage coupé, ligne dans la zone de l'interface, ligne sur la bouche, tout est signalé", () => {
    const plan = { debutSec: 0, finSec: 3, priseDebutSec: 0, priseFinSec: 3, taille: 100 as const, cadre: { x: 0, y: 0, largeur: 100, hauteur: 100 }, ouverture: "debut" as const, ratio: "16:9" as const, yeuxHauteur: 0.34, yeuxLargeur: 0.03, visage: [-0.02, 0.2, 0.1, 0.3] as [number, number, number, number], agrandissement: 1 };
    const c = controlerFormat({ ratio: "16:9", plans: [plan], sousTitres: { centrePct: 92 } });
    expect(c.ok).toBe(false);
    expect(c.defauts.map((d) => d.type).sort()).toEqual(["sous-titres-hors-zone", "visage-coupe"]);
    expect(c.alertes.every((a) => a.message.startsWith("16:9 : "))).toBe(true);
    const bouche = controlerFormat({ ratio: "16:9", plans: [{ ...plan, yeuxLargeur: 0.5, visage: [0.45, 0.2, 0.1, 0.3] }], sousTitres: { centrePct: 40 } });
    expect(bouche.defauts.map((d) => d.type)).toEqual(["sous-titres-sur-visage"]);
  });
});

describe("lot F1 · composition commune (ajouts facultatifs)", () => {
  const base = { plans: [{ ordre: 1, debutSec: 0, finSec: 10, texte: "", segmentId: "facecam", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "face" }], segments: [], dureeSec: 10, audioCle: "m.mov", pistesDouble: { face: "m.mov" }, pistesDepuisLook: true, sourcePreCadree: true, source10bits: true } as const;

  it("16:9 pré-cadré : image 1920 × 1080, écran partagé côte à côte porté par le plan, lettre des sous-titres à l'échelle 0,9", () => {
    const p = parametresComposition(commande(), { ...base, ratio: "16:9", ecransPartages: [{ debutSec: 2, finSec: 6, carteCle: "carte.mp4", sourceY: 0, cote: "gauche", largeurCarte: 864, sourceX: 300, ligne: { centrePct: 70, colonne: { gauchePx: 917, largeurPx: 950 } } }], echelleSousTitres: 0.9 } as never, RECETTE_COMPOSITION_FACECAM);
    expect([p.image.largeur, p.image.hauteur]).toEqual([1920, 1080]);
    const ep = p.image.plans.find((x) => x.ecranPartage)!.ecranPartage!;
    expect(ep).toMatchObject({ cote: "gauche", largeurCarte: 864, sourceX: 300 });
    expect(geometrieEcranPartage(ep, 1)).toEqual({ decalagePersonne: 0, hautCarte: 0, decalagePersonneX: 564, gaucheCarte: 0 });
    // Graphe FFmpeg : la personne glisse vers la droite, la carte (rendue 1080 × 1350) est réduite à 864 × 1080.
    const f: FichiersImage = { doubles: { principal: { fichier: "m.mov", video: true } }, illustrations: {}, luts: [], son: "s.wav", cartes: { "carte-ep-1": "carte.mp4" } };
    const g = argumentsImageFfmpeg(p.image, { grainPct: 0, grainTaillePx: 1, vignettePct: 0 }, f, 10, "sortie.mov").join(" ");
    expect(g).toContain("scale=864:1080:flags=lanczos");
    expect(g).toMatch(/overlay=x='564\*\(1-pow/);
    expect(g).toMatch(/overlay=x='-864\+864\*\(1-pow/);
  });

  it("sous-titres dans la colonne de Will (côte à côte) : largeur bornée et ligne posée dans la colonne", () => {
    const d = { largeur: 1920, hauteur: 1080, segments: [], base: "karaoke", couleurs: { texte: "#F6EEE0", accent: "#C65A2E", contour: "#16120F" }, largeurMaxPx: 1612, positions: { milieuPct: 70, hautPct: 15, basPct: 80 }, echelleTexte: 0.9, passagesJonction: [{ debutSec: 0, finSec: 5, centrePct: 70, colonne: { gauchePx: 917, largeurPx: 950 } }] } as never;
    const s = { id: "g1", debutSec: 1, finSec: 2, mots: [{ mot: "Former", debutSec: 1, finSec: 1.4 }, { mot: "l'équipe", debutSec: 1.4, finSec: 2 }] } as never;
    const el = elementDe(d, s, 1.5);
    expect(el.colonne).toEqual({ gauchePx: 917, largeurPx: 950 });
    expect(el.yPx).toBeCloseTo(756, 0);
    const css = cssElement(el, d, "Poppins");
    expect(css.conteneur).toMatchObject({ left: 917, width: 950 });
    expect(css.conteneur.right).toBeUndefined();
  });
});

describe("lot F1 · le 9:16 reste STRICTEMENT inchangé", () => {
  it("habillage : `habillageFacecamRatio(entrée, \"9:16\")` rend exactement `habillageFacecam(entrée)`", () => {
    const e: EntreeHabillageFacecam = { pisteMonteeCle: "facecam/v/ver/montage.mov", dureeSec: 30, mots: mots(0, 30), coupesSec: [8.2, 17.4], visage: { yeuxPct: 33, bouchePct: 45 }, prefixeCartes: "facecam/v/ver/cartes" };
    const { ratio, ...h } = habillageFacecamRatio(e, "9:16");
    expect(ratio).toBe("9:16");
    expect(h).toEqual(habillageFacecam(e));
    expect(h.entree.echelleSousTitres).toBeUndefined();
  });

  it("chaîne 9:16 seule : mêmes travaux, même bande, aucun état de déclinaison ; résultat : sorties et note identiques", async () => {
    const facecam = creerFacecamSimule();
    const etat = await jusquAuBout({ facecam });
    expect(etat.fini).toBe(true);
    expect(etapes(facecam)).toEqual(["transcrire", "visages", "son", "image:passe", "image:cadrage"]);
    expect(etat.declinaisons).toBeUndefined();
    const passe = facecam.soumises.find((s) => s.demande.parametres?.etape === "passe")!.demande;
    expect(passe.parametres?.bande).toEqual(bandeDesPlans(etat.plans!, SOURCE));
    const cadrage = facecam.soumises.find((s) => s.demande.parametres?.etape === "cadrage")!.demande;
    expect(cadrage.parametres?.sortie).toEqual({ largeur: 1080, hauteur: 1920 });
    const avant = resultatChaine(commande(), etat, false);
    const apres = completerAvecDeclinaisons(avant, etat);
    expect(apres.sorties).toEqual(avant.sorties);
    expect(apres.noteQualite).toEqual(avant.noteQualite);
    const { repriseFormats, ...reste } = apres.projetMontage;
    expect(reste).toEqual(avant.projetMontage);
    expect(repriseFormats).toBeTruthy();
  });

  it("écran partagé vertical : géométrie et graphe FFmpeg d'avant (aucune nouvelle clé)", () => {
    expect(geometrieEcranPartage({ hauteurHaut: 960, sourceY: 300 }, 1)).toEqual({ decalagePersonne: 660, hautCarte: 0 });
  });
});

describe("lot F1 · chaîne avec des déclinaisons (simulation)", () => {
  it("UNE passe image (sa bande couvre tous les formats), une piste pré-cadrée par format, une sortie par format", async () => {
    const facecam = creerFacecamSimule();
    const c = commande({ ratios: ["9:16", "4:5", "16:9"] });
    const etat = await jusquAuBout({ facecam }, c);
    expect(etat.fini).toBe(true);
    expect(etapes(facecam)).toEqual(["transcrire", "visages", "son", "image:passe", "image:cadrage", "image:cadrage", "image:cadrage"]);
    const passes = facecam.soumises.filter((s) => s.demande.parametres?.etape === "passe");
    expect(passes).toHaveLength(1);
    const bande = passes[0].demande.parametres!.bande as { x: number; largeur: number };
    for (const r of ["4:5", "16:9"] as RatioDeclinaison[]) expect(bandeCouvre(bande, etat.declinaisons!.plans[r]!.map((p) => p.cadre))).toBe(true);
    const cadrages = facecam.soumises.filter((s) => s.demande.parametres?.etape === "cadrage").map((s) => s.demande.parametres!.sortie);
    expect(cadrages).toEqual([{ largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1350 }, { largeur: 1920, hauteur: 1080 }]);
    // La piste de chaque format est recadrée dans la MÊME passe image (aucune passe refaite par format).
    const sources = new Set(facecam.soumises.filter((s) => s.demande.parametres?.etape === "cadrage").map((s) => s.demande.source));
    expect(sources.size).toBe(1);
    const r = completerAvecDeclinaisons(resultatChaine(c, etat, false), etat);
    expect(r.sorties.map((s) => [s.ratio, s.resolution])).toEqual([["9:16", "1080x1920"], ["4:5", "1080x1350"], ["16:9", "1920x1080"]]);
  });

  it("« Monteur, fais-moi aussi une version carrée », dit pendant le tournage : la version carrée est faite avec la vidéo", async () => {
    const facecam = creerFacecamSimule();
    const texte = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Monteur, fais-moi aussi une version carrée. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux.";
    const etat = await jusquAuBout({ facecam }, commande({ texte }));
    expect(etat.fini).toBe(true);
    expect(etat.coupes!.consignes.map((x) => x.texte)).toEqual(["fais-moi aussi une version carrée."]);
    expect(etat.declinaisons?.ratios).toEqual(["1:1"]);
    expect(etat.declinaisons?.cadrages["1:1"]?.statut).toBe("termine");
  });

  it("formats gardés dans les entrées (`facecamFormats`) : refaits d'office par une nouvelle version", async () => {
    const facecam = creerFacecamSimule();
    const etat = await jusquAuBout({ facecam }, commande({ entrees: { facecamFormats: { version: 1, ratios: ["1:1"] } } }));
    expect(etat.declinaisons?.ratios).toEqual(["1:1"]);
    expect(etat.declinaisons?.cadrages["1:1"]?.statut).toBe("termine");
  });

  it("habillage et composition finale de chaque format : mêmes cartes, mises en page pour le format, cartes identiques rendues une fois", async () => {
    const facecam = creerFacecamSimule();
    const outils = outilsRendu();
    const c = commande({ ratios: ["9:16", "4:5", "16:9"] });
    const etat = await jusquAuBout({ facecam, monteur: async () => ({ cartes: [CARTE_LISTE, CARTE_CHIFFRE] }), habillage: outils }, c);
    expect(etat.fini).toBe(true);
    const d = etat.declinaisons!;
    expect(d.habillages?.["4:5"]?.sortie).toBeTruthy();
    expect(d.habillages?.["16:9"]?.sortie).toBeTruthy();
    const compos = outils.soumises.filter((x) => (x.parametres as { mode?: string }).mode === "complet").map((x) => x.parametres as unknown as ParametresDemandeComposition & { mode: "complet" });
    expect(compos.map((x) => x.ratio).sort()).toEqual(["16:9", "4:5", "9:16"]);
    const c169 = compos.find((x) => x.ratio === "16:9")!;
    expect([c169.image.largeur, c169.image.hauteur]).toEqual([1920, 1080]);
    // En 16:9 les deux cartes (moitié haute et plein écran) deviennent des écrans partagés côte à côte.
    const cotes = c169.image.plans.filter((p) => p.ecranPartage).map((p) => p.ecranPartage!.cote);
    expect(cotes.length).toBeGreaterThanOrEqual(2);
    expect(cotes.every((x) => x === "gauche")).toBe(true);
    expect(c169.texte.sousTitres?.echelleTexte).toBe(0.9);
    const c45 = compos.find((x) => x.ratio === "4:5")!;
    expect(c45.image.plans.find((p) => p.ecranPartage)!.ecranPartage!.hauteurHaut).toBe(608);
    // La carte chiffre « 4:5 plein écran » sert au 4:5 et au 16:9 : rendue une seule fois.
    const cartes = outils.soumises.filter((x) => !(x.parametres as { mode?: string }).mode).map((x) => x.sortie.cle);
    expect(new Set(cartes).size).toBe(cartes.length);
    expect(cartes.filter((k) => k.includes("pas-2-4x5.mp4"))).toHaveLength(1);
    const r = completerAvecDeclinaisons(resultatChaine(c, etat, false), etat);
    const s169 = r.sorties.find((s) => s.ratio === "16:9")!;
    expect(s169.fichierCle).toBe(d.habillages!["16:9"]!.sortie!.fichierCle);
    expect(s169.rapportQualite.verifie.sousTitres).toBe(true);
  });
});

describe("lot F1 · format ajouté après coup (« Ce format », pastilles)", () => {
  it("la passe faite pour le 9:16 ne couvre pas le 16:9 : UNE passe élargie, partagée par les formats ajoutés de la version, puis la piste du format", async () => {
    const facecam = creerFacecamSimule();
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam }) });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "t-9", versionId: "ver-9", titre: "Essai" });
    let resultat;
    for (let i = 0; i < 40 && travail.statut !== "termine"; i++) ({ travail, resultat } = await moteur.avancer(travail, c, Date.now()));
    expect(travail.statut).toBe("termine");
    const parent = { versionId: "ver-9", projetMontage: resultat!.projetMontage, pistes: [] };
    const avant = facecam.soumises.length;

    const ajoute = async (ratio: "16:9" | "1:1", id: string) => {
      const cr = { ...c, ratios: [ratio] } as CommandeFabrication;
      let t = await moteur.reexporter({ commande: cr, contexte: { travailId: id, versionId: "ver-9", titre: "Nouveau format" }, cible: { ratio }, parent });
      expect(t.parametres?.chaine).toBeTruthy();
      let r;
      for (let i = 0; i < 20 && t.statut !== "termine" && t.statut !== "echec"; i++) ({ travail: t, resultat: r } = await moteur.avancer(t, cr, Date.now()));
      return { t, r };
    };
    const a = await ajoute("16:9", "t-10");
    expect(a.t.statut).toBe("termine");
    expect(a.r!.sorties.map((s) => [s.ratio, s.resolution])).toEqual([["16:9", "1920x1080"]]);
    const b = await ajoute("1:1", "t-11");
    expect(b.r!.sorties.map((s) => s.ratio)).toEqual(["1:1"]);
    const nouvelles = facecam.soumises.slice(avant);
    // Ni transcription, ni son, ni visages refaits ; la passe élargie n'est calculée qu'une fois pour les deux formats.
    expect(nouvelles.map((s) => s.demande.parametres?.etape)).toEqual(["passe", "cadrage", "cadrage"]);
    expect(nouvelles[0].demande.idTravail).toBe("ver-9-passe-formats");
    const bande = nouvelles[0].demande.parametres!.bande as { x: number; largeur: number };
    const plans9 = (resultat!.projetMontage.repriseFormats as { plans: Parameters<typeof plansDuFormat>[1] }).plans;
    for (const r of ["4:5", "1:1", "16:9"] as const) expect(bandeCouvre(bande, plansDuFormat(r, plans9, SOURCE).map((p) => p.cadre))).toBe(true);
    expect(nouvelles.slice(1).map((s) => s.demande.parametres!.sortie)).toEqual([{ largeur: 1920, hauteur: 1080 }, { largeur: 1080, hauteur: 1080 }]);
  });

  it("10/10 · progression honnête : la passe élargie en cours fait avancer le travail (plus « 1 % · encore 0 s »)", async () => {
    const base = creerFacecamSimule();
    let passeEnCours = true;
    const facecam = { ...base, suivre: (async (route, id) => (id.includes("passe-formats") && passeEnCours ? { statut: "en_cours", progression: 40 } : base.suivre(route, id))) as typeof base.suivre };
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam }) });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "t-20", versionId: "ver-20", titre: "Essai" });
    let resultat;
    for (let i = 0; i < 40 && travail.statut !== "termine"; i++) ({ travail, resultat } = await moteur.avancer(travail, c, Date.now()));
    const cr = { ...c, ratios: ["16:9"] } as CommandeFabrication;
    const maintenant = Date.now();
    let t = await moteur.reexporter({ commande: cr, contexte: { travailId: "t-21", versionId: "ver-20", titre: "Nouveau format", maintenant }, cible: { ratio: "16:9" }, parent: { versionId: "ver-20", projetMontage: resultat!.projetMontage, pistes: [] } });
    const estimation = t.parametres?.estimation as { passeElargie: boolean; totalSec: number };
    expect(estimation.passeElargie).toBe(true);
    // Annoncé d'emblée : la durée de la passe image (et plus 3 s).
    expect(Date.parse(t.finEstimee!) - maintenant).toBeGreaterThanOrEqual(estimation.totalSec * 1000);
    ({ travail: t } = await moteur.avancer(t, cr, maintenant + 1_000));
    ({ travail: t } = await moteur.avancer(t, cr, maintenant + 60_000));
    expect(t.statut).toBe("en_cours");
    expect(t.progression).toBeGreaterThan(10);
    expect(Date.parse(t.finEstimee!)).toBeGreaterThan(maintenant + 60_000 + 30_000);
    passeEnCours = false;
    for (let i = 0; i < 20 && t.statut !== "termine"; i++) ({ travail: t } = await moteur.avancer(t, cr, maintenant + 120_000));
    expect(t.statut).toBe("termine");
    expect(t.progression).toBe(100);
  });

  it("sans chaîne réelle (squelette) : le format ajouté reste celui d'avant (aucune reprise)", async () => {
    const moteur = creerMoteurMontageFacecam({ chaine: () => null });
    const t = await moteur.reexporter({ commande: commande({ ratios: ["4:5"] }), contexte: { travailId: "t-x", versionId: "ver-x", titre: "x" }, cible: { ratio: "4:5" } });
    expect(t.parametres).toEqual({ ratio: "4:5" });
  });
});

it("lot F1 · contrôle d'un habillage de format : la personne en bas reste entière, la ligne à la jonction ne touche pas le visage", () => {
  const p = piste(30);
  const plans916 = realiser({ gardes: [{ debutSec: 0, finSec: 30 }], mots: mots(0, 30), piste: p, source: SOURCE }).plans;
  for (const ratio of ["4:5", "1:1", "16:9"] as const) {
    const plansFormat = plansDuFormat(ratio, plans916, SOURCE, p);
    const h = habillageFacecamRatio({ pisteMonteeCle: `montage-${ratio}.mov`, dureeSec: 30, mots: mots(0, 30), prefixeCartes: "cartes", cartes: [{ id: "c1", debutSec: 4, finSec: 9, disposition: "moitie-haute", carte: carteDepuisTextes("liste", ["Trois raisons", "Gagner du temps", "Former l'équipe"])! }], plansFormat }, ratio);
    expect(h.entree.ratio).toBe(ratio);
    expect(h.entree.ecransPartages).toHaveLength(1);
    expect(h.controle?.defauts).toEqual([]);
    const v = visagePx(plansFormat[0]);
    expect(v.yeuxY / (ratio === "16:9" ? 1080 : ratio === "1:1" ? 1080 : 1350)).toBeGreaterThan(0.29);
  }
});
