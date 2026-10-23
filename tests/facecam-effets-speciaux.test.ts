/**
 * FACECAM — LOT F3 « Effets spéciaux à la demande » (L11b reporté après la v1). Tests gardés : schéma des
 * opérations ; ancrage de l'objet sur la main (piste simulée) ; repli sans main (« Effet non réussi — Réessayer »).
 * Plus : jamais automatique, garde-fous (durée, un effet fort à la fois), version simple, catalogue, géométrie des
 * transitions (déterminisme, visage dégagé). Modules PURS : aucun dépôt, aucun réseau, aucun appel Claude.
 */
import { describe, expect, it } from "vitest";
import {
  analyserMain,
  bornerDureeTransition,
  calendrierVitre,
  couvertureVisageVitre,
  dessinTransition,
  estimerLumiere,
  genererEclats,
  imagesObjetSurVisage,
  airePolygone,
  pointHorsVisage,
  posesObjetMain,
  preparerObjetMain,
  preparerTransition,
  separerMains,
  type BoitePx,
  type EchantillonMainDetaille,
  type ParametresTransition,
} from "@/briques/effets-speciaux";
import type { EchantillonVisage } from "@/briques/realisation/piste";
import { entreesFacecamVides } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";
import { preparerEffetsFacecam, type PassageEffet } from "@/moteurs/montage-facecam/effets-speciaux";
import { exemplesModelesEtendus } from "@/moteurs/montage-facecam/monteur/catalogue-motion-etendu";
import {
  appliquerOperations,
  CATALOGUE_MONTEUR,
  catalogueDisponible,
  STYLE_CARTE_MONTEUR,
  exemplesDemandes,
  LIBELLE_EFFET_RATE,
  lireReponseMonteur,
  motsPourMonteur,
  operationsParRegles,
  reessayerEffet,
  reglagesMonteurVides,
  resumeOperation,
  schemaOperationFacecam,
  TYPES_OPERATION_FACECAM,
  type EtatMonteur,
  type OperationFacecam,
  type PassageMonteur,
} from "@/moteurs/montage-facecam/monteur";

const L = 1080;
const H = 1920;

/* ------------------------------------------------------------------ */
/* Données simulées                                                    */
/* ------------------------------------------------------------------ */

/** 60 mots, un toutes les 0,5 s à partir de 1 s. */
const MOTS: MotHorodate[] = Array.from({ length: 60 }, (_, i) => ({ mot: `mot${i}`, debutSec: 1 + i * 0.5, finSec: 1.4 + i * 0.5 }));

function etatDepart(): EtatMonteur {
  return { facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() };
}

let n = 0;
const ctx = (origine: "auto" | "demande" = "demande", consigneId?: string) => ({
  mots: motsPourMonteur(MOTS, []),
  dureePriseSec: 32,
  origine,
  consigneId,
  nouvelId: (p: string) => `${p}-${++n}`,
});

/** Visage immobile au centre-haut (source = image de sortie : cadre plein). */
const VISAGE: EchantillonVisage[] = Array.from({ length: 80 }, (_, i) => ({ t: i * 0.08, yeuxX: 0.5, yeuxY: 0.32, boite: [0.36, 0.23, 0.28, 0.2], bouche: 0.2, confiance: 1 }));
const BOITE_VISAGE_PX: BoitePx = [0.36 * L, 0.23 * H, 0.28 * L, 0.2 * H];
const CADRE = { x: 0, y: 0, largeur: 1, hauteur: 1 };

/** Vraie trajectoire de la paume (normalisée) : la main décrit une boucle lente en bas à droite. */
const vraie = (t: number) => ({ x: 0.66 + 0.04 * Math.sin(t * 1.3), y: 0.64 + 0.03 * Math.cos(t * 1.1) });

/**
 * Piste « MediaPipe » simulée : une image sur 6 (0,24 s), bruit de détection ±0,5 %, main ouverte de `ouvre` à
 * `ferme`, fermée autour, absente hors de [present0, present1]. Une seconde main (gauche, fermée) est mêlée.
 */
function pisteMain(o: { ouvre: number; ferme: number; present0?: number; present1?: number; raterA?: number; autreMain?: boolean; trajectoire?: (t: number) => { x: number; y: number } }): EchantillonMainDetaille[] {
  const r: EchantillonMainDetaille[] = [];
  const traj = o.trajectoire ?? vraie;
  for (let k = 0; k * 0.24 <= 8; k++) {
    const t = +(0.04 + k * 0.24).toFixed(3);
    if (t < (o.present0 ?? 0) || t > (o.present1 ?? 99)) continue;
    const p = traj(t);
    const bruit = (s: number) => (Math.sin(k * 12.9898 + s) * 43758.5453) % 1;
    const rate = o.raterA !== undefined && Math.abs(t - o.raterA) < 0.13;
    r.push({ t, x: p.x + bruit(1) * 0.005, y: p.y + bruit(2) * 0.005, ouverte: t >= o.ouvre && t <= o.ferme && !rate });
    if (o.autreMain) r.push({ t, x: 0.25 + bruit(3) * 0.004, y: 0.7, ouverte: false });
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Schéma des opérations                                               */
/* ------------------------------------------------------------------ */

describe("Schéma des opérations : les effets spéciaux s'ajoutent au vocabulaire du monteur", () => {
  it("les 3 opérations sont validées, en FIN de liste (l'ordre des opérations existantes ne change pas)", () => {
    expect(TYPES_OPERATION_FACECAM.slice(0, 16)).toEqual(["ajouterCarte", "zoom", "ecranPartage", "miseEnPage", "couleurs", "son", "masquerPersonne", "texteDerriere", "vitesse", "arretImage", "titre", "generique", "couper", "retablir", "retirer", "remettre"]);
    // Lot K : l'effet réaliste par IA (payant) s'ajoute après les 3 effets, toujours en fin de liste.
    // Test en prod du 11/10 : le titre de couverture (sans montage) s'ajoute ensuite, toujours en fin de liste.
    expect(TYPES_OPERATION_FACECAM.slice(16)).toEqual(["objetMain", "vitreBrisee", "transitionEcran", "effetRealisteIA", "changerTitreCouverture"]);
    expect(schemaOperationFacecam.safeParse({ type: "objetMain", debutMot: 4, finMot: 9, objet: "logo-axion", description: "logo 3D dans ma main" }).success).toBe(true);
    expect(schemaOperationFacecam.safeParse({ type: "vitreBrisee", auMot: 12, dureeSec: null, revele: "plan-suivant", texteCarte: null, bruitage: true }).success).toBe(true);
    expect(schemaOperationFacecam.safeParse({ type: "transitionEcran", auMot: 3, style: "ecran-plie", dureeSec: 1 }).success).toBe(true);
    // Objet inconnu, style inconnu : refusés par le schéma strict.
    expect(schemaOperationFacecam.safeParse({ type: "objetMain", debutMot: 4, finMot: 9, objet: "voiture", description: "" }).success).toBe(false);
    expect(schemaOperationFacecam.safeParse({ type: "transitionEcran", auMot: 3, style: "fondu", dureeSec: 1 }).success).toBe(false);
  });

  it("relecture tolérante : un effet aux champs oubliés est réparé, un effet sans mot est écarté, les autres opérations restent", () => {
    const lu = lireReponseMonteur({
      reponse: "C'est fait.",
      operations: [
        { type: "vitreBrisee", auMot: 7 },
        { type: "objetMain", debutMot: 2, objet: "un téléphone" },
        { type: "transitionEcran", style: "pliage" },
        { type: "zoom", debutMot: 1, finMot: 2, style: "punch-in", cible: "visage" },
      ],
      consignes: [{ consigneId: "k1", comprise: true, resume: "Vitre", operations: [0] }],
    })!;
    expect(lu.operations.map((o) => o.type)).toEqual(["vitreBrisee", "objetMain", "zoom"]);
    expect(lu.operations[0]).toEqual({ type: "vitreBrisee", auMot: 7, dureeSec: null, revele: "plan-suivant", texteCarte: null, bruitage: true });
    expect(lu.operations[1]).toMatchObject({ type: "objetMain", debutMot: 2, finMot: 2, objet: "telephone" });
    expect(lu.ecartees).toHaveLength(1);
    expect(lu.consignes[0].operations).toEqual([0]);
  });
});

/* ------------------------------------------------------------------ */
/* À la demande seulement, garde-fous                                  */
/* ------------------------------------------------------------------ */

const vitre = (auMot: number, dureeSec: number | null = null): OperationFacecam => ({ type: "vitreBrisee", auMot, dureeSec, revele: "plan-suivant", texteCarte: null, bruitage: true });

describe("Effets spéciaux : jamais automatiques, garde-fous de montage", () => {
  it("une proposition automatique est écartée avec une phrase ; à la demande, le passage est posé avec son ancre", () => {
    const auto = appliquerOperations(etatDepart(), [vitre(10)], ctx("auto"));
    expect(auto.refusees).toEqual([0]);
    expect(auto.etat.facecam.passages).toHaveLength(0);
    expect(auto.alertes[0]).toMatch(/que si vous le demandez/);
    const demande = appliquerOperations(etatDepart(), [vitre(10), { type: "objetMain", debutMot: 20, finMot: 22, objet: "logo-axion", description: "logo" }], ctx("demande", "k1"));
    expect(demande.refusees).toEqual([]);
    const [v, m] = demande.etat.facecam.passages as PassageMonteur[];
    expect(v).toMatchObject({ type: "autre", debutSec: 6, finSec: 7.2, consigneId: "k1", texte: "Vitre qui se brise" });
    expect(v.operation).toMatchObject({ type: "vitreBrisee", dureeSec: 1.2 });
    // La main est cherchée sur 4 s au moins (elle s'ouvre souvent après le mot).
    expect(m.ancre).toEqual({ debutPriseSec: 11, finPriseSec: 15 });
    expect(resumeOperation(m.operation)).toBe("Logo Axion en 3D dans votre main");
  });

  it("durée bornée à 0,6-1,5 s ; 4 s entre deux transitions ; 3 au plus par vidéo ; un seul effet fort à la fois", () => {
    const r = appliquerOperations(etatDepart(), [vitre(2, 0.2), vitre(4), { type: "transitionEcran", auMot: 12, style: "zoom-traversant", dureeSec: 4 }, vitre(30), vitre(50)], ctx());
    const durees = (r.etat.facecam.passages as PassageMonteur[]).map((p) => (p.operation as { dureeSec: number }).dureeSec);
    expect(durees).toEqual([0.6, 1.5, 1.2]);
    expect(r.refusees).toEqual([1, 4]);
    expect(r.alertes.join(" ")).toMatch(/4 s d'écart/);
    expect(r.alertes.join(" ")).toMatch(/3 transitions/);
    // Un « cache-moi » en cours : la transition passe juste après s'il finit tout près, sinon elle est écartée. V6 : le
    // « cache-moi » n'est plus posé (pas encore rendu, refusé) ; celui d'une ancienne version reste respecté.
    expect(appliquerOperations(etatDepart(), [{ type: "masquerPersonne", debutMot: 10, finMot: 11 }], ctx()).refusees).toEqual([0]);
    const etatAvecCache = (finMot: number): EtatMonteur => {
      const e = etatDepart();
      const fin = MOTS[finMot].finSec;
      e.facecam.passages = [{ id: "pas-cache", type: "autre", debutSec: MOTS[10].debutSec, finSec: fin, origine: "demande", ancre: { debutPriseSec: MOTS[10].debutSec, finPriseSec: fin }, operation: { type: "masquerPersonne", debutMot: 10, finMot }, detourage: true } as PassageMonteur];
      return e;
    };
    const avecCache = appliquerOperations(etatAvecCache(11), [vitre(10)], ctx());
    const [cache, v] = avecCache.etat.facecam.passages;
    expect(v.debutSec).toBeCloseTo(cache.finSec + 0.2, 3);
    const long = appliquerOperations(etatAvecCache(20), [vitre(11)], ctx());
    expect(long.refusees).toEqual([0]);
    // L'objet dans la main n'est jamais posé sous une carte plein écran.
    const sousCarte = appliquerOperations(etatDepart(), [{ type: "ajouterCarte", debutMot: 10, finMot: 16, modele: "chiffre", textes: ["32 %"], html: null, disposition: "plein-ecran", description: "chiffre", animationGardeeId: null }, { type: "objetMain", debutMot: 11, finMot: 12, objet: "cube", description: "" }], ctx());
    expect(sousCarte.refusees).toEqual([1]);
  });

  it("version simple (sans Claude) : les phrases de Will deviennent le bon effet, « zoom à travers l'écran » n'est pas un zoom", () => {
    const ops = (texte: string) => operationsParRegles({ id: "k", texte, origine: "voix", ancre: { debutMot: 5, finMot: 8 } })!;
    expect(ops("Monteur, fais apparaître un logo 3D dans ma main")).toEqual([{ type: "objetMain", debutMot: 5, finMot: 8, objet: "logo-axion", description: "Monteur, fais apparaître un logo 3D dans ma main" }]);
    expect(ops("Monteur, mets un téléphone dans ma main")[0]).toMatchObject({ type: "objetMain", objet: "telephone" });
    expect(ops("Monteur, brise l'écran comme une vitre quand je dis stop")[0]).toMatchObject({ type: "vitreBrisee", auMot: 5, revele: "plan-suivant", bruitage: true });
    expect(ops("Monteur, casse l'écran et révèle la carte « Le temps perdu », sans bruitage")[0]).toMatchObject({ type: "vitreBrisee", revele: "carte", texteCarte: "Le temps perdu", bruitage: false });
    expect(ops("Monteur, fais un zoom à travers l'écran")[0]).toMatchObject({ type: "transitionEcran", style: "zoom-traversant" });
    expect(ops("Monteur, plie l'écran ici")[0]).toMatchObject({ type: "transitionEcran", style: "ecran-plie" });
    // Les consignes habituelles ne changent pas.
    expect(ops("Monteur, zoome ici")[0]).toMatchObject({ type: "zoom" });
  });

  it("chaque effet est dans le catalogue « Que puis-je demander ? » (les 8 exemples d'avant restent en tête)", () => {
    const exemples = exemplesDemandes();
    // Lot C2 : l'exemple du style des animations suit celui de la carte (intégration F3 + C2, mission H) ; les 8
    // exemples d'avant restent en tête, les 3 effets ferment la liste (lot F3).
    // V6 : seules les familles RENDUES sont proposées (les 7 premières du catalogue le sont toutes).
    const avant = catalogueDisponible().slice(0, 7).map((e) => e.exemples[0]);
    avant.splice(1, 0, STYLE_CARTE_MONTEUR.exemple);
    // Mission L : 3 exemples des modèles 7 à 13 s'insèrent juste après la carte et son style, sans chasser aucune famille.
    expect(exemples.slice(2, 5)).toEqual(exemplesModelesEtendus(3));
    expect([...exemples.slice(0, 2), ...exemples.slice(5, 11)]).toEqual(avant);
    expect(exemples).toHaveLength(14);
    // Sans les modèles 7 à 13 : la liste d'avant, à l'identique.
    expect(exemplesDemandes(8, { modelesEtendus: false }).slice(0, 8)).toEqual(avant);
    expect(exemplesDemandes(8, { modelesEtendus: false })).toHaveLength(11);
    expect(exemples[0]).toBe(CATALOGUE_MONTEUR[0].exemples[0]);
    expect(exemples.slice(-3)).toEqual(CATALOGUE_MONTEUR.slice(-3).map((e) => e.exemples[0]));
    for (const type of ["objetMain", "vitreBrisee", "transitionEcran"]) {
      const entree = CATALOGUE_MONTEUR.find((e) => e.type === type)!;
      expect(entree.regle).toMatch(/À LA DEMANDE SEULEMENT/);
      expect(exemples).toContain(entree.exemples[0]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Ancrage sur la main (piste simulée)                                 */
/* ------------------------------------------------------------------ */

describe("Ancrage de l'objet sur la main (piste MediaPipe simulée)", () => {
  it("deux mains mêlées sont séparées ; la main ouverte est trouvée, un raté isolé ne la ferme pas", () => {
    const mains = pisteMain({ ouvre: 1.5, ferme: 4.5, raterA: 3.0, autreMain: true });
    expect(separerMains(mains)).toHaveLength(2);
    const a = analyserMain(mains, 1, 7);
    expect(a.trouvee).toBe(true);
    if (!a.trouvee) return;
    expect(a.debutSec).toBeGreaterThan(1.3);
    expect(a.debutSec).toBeLessThan(1.7);
    expect(a.finSec).toBeGreaterThan(4.3);
    expect(a.finSec).toBeLessThan(4.7);
    // La main droite (en bas à droite), pas la main gauche fermée.
    expect(a.echantillons.every((e) => e.x > 0.5)).toBe(true);
  });

  it("l'objet suit la paume sans retard, apparaît à l'ouverture (éclat) et disparaît à la fermeture ; rendu déterministe", () => {
    const main = analyserMain(pisteMain({ ouvre: 1.5, ferme: 4.5 }), 1, 7);
    if (!main.trouvee) throw new Error("main introuvable");
    const instants = Array.from({ length: 150 }, (_, i) => 1 + i / 25);
    const entree = { main, instantsPrise: instants, cadre: CADRE, largeur: L, hauteur: H, fps: 25, visage: VISAGE, objet: "logo-axion" as const, graine: 3 };
    const poses = posesObjetMain(entree);
    expect(posesObjetMain(entree)).toEqual(poses);
    // Paume suivie à moins de 1,5 % de la largeur, et plus près de la vraie position « maintenant » qu'il y a 0,1 s.
    let ecartMaintenant = 0;
    let ecartRetard = 0;
    instants.forEach((t, i) => {
      if (t < 1.8 || t > 4.2) return;
      const v = vraie(t);
      const r = vraie(t - 0.1);
      const e = Math.hypot(poses[i].paumeX - v.x * L, poses[i].paumeY - v.y * H);
      expect(e).toBeLessThan(0.015 * L);
      ecartMaintenant += e;
      ecartRetard += Math.hypot(poses[i].paumeX - r.x * L, poses[i].paumeY - r.y * H);
    });
    expect(ecartMaintenant).toBeLessThan(ecartRetard);
    // Objet au-dessus de la paume, à la taille de la main (d'après le visage : 0,62 × sa largeur × 1,2).
    const milieu = poses[instants.findIndex((t) => t >= 3)];
    expect(milieu.y).toBeLessThan(milieu.paumeY);
    expect(milieu.taille).toBeCloseTo(0.28 * L * 0.62 * 1.2, 0);
    // Invisible avant l'ouverture et après la fermeture ; éclat au début ; disparition à la fin.
    const a = (t: number) => poses[instants.findIndex((x) => x >= t - 1e-9)];
    expect(a(1.2).visible).toBe(0);
    expect(a(1.45).eclat).toBe(-1);
    expect(a(main.debutSec + 0.1).eclat).toBeGreaterThan(0);
    expect(a(main.debutSec + 0.8).visible).toBeGreaterThan(0.95);
    expect(a(main.finSec - 0.1).fuite).toBeGreaterThan(0);
    expect(a(main.finSec + 0.2).visible).toBe(0);
  });

  it("le visage n'est jamais caché : la main qui monte près du menton fait écarter l'objet", () => {
    // La main passe juste sous le visage, au milieu.
    const pres = (t: number) => ({ x: 0.52 + 0.02 * Math.sin(t), y: 0.5 });
    const main = analyserMain(pisteMain({ ouvre: 1, ferme: 5, trajectoire: pres }), 0.5, 6);
    if (!main.trouvee) throw new Error("main introuvable");
    const instants = Array.from({ length: 125 }, (_, i) => 0.8 + i / 25);
    const poses = posesObjetMain({ main, instantsPrise: instants, cadre: CADRE, largeur: L, hauteur: H, fps: 25, visage: VISAGE, objet: "telephone" });
    expect(poses.some((p) => p.ecarte)).toBe(true);
    expect(imagesObjetSurVisage(poses, instants, VISAGE, CADRE, L, H)).toEqual([]);
  });

  it("préparation du rendu : opération `composition` existante, poses image par image sur l'intervalle monté, lumière mesurée", () => {
    const r = preparerObjetMain({
      objet: "piece",
      debutPriseSec: 1,
      finPriseSec: 7,
      mains: pisteMain({ ouvre: 1.5, ferme: 4.5 }),
      visage: VISAGE,
      priseVersMontee: (s) => s - 0.5,
      monteeVersPrise: (s) => s + 0.5,
      cadre: CADRE,
      largeur: L,
      hauteur: H,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parametres.composition).toBe("EffetObjetMain");
    const p = r.parametres.proprietes as { images: number; poses: unknown[]; source: string; debutSourceImage: number; fps: number };
    expect(p.fps).toBe(25);
    expect(p.poses).toHaveLength(p.images);
    expect(p.source).toBe("entree:piste");
    expect(p.debutSourceImage).toBe(Math.round(r.debutSec * 25));
    // Lumière lue sur l'image : visage éclairé par la droite, lumière chaude.
    const rvb = new Uint8Array(100 * 100 * 3);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) rvb.set(x < 50 ? [70, 55, 45] : [240, 200, 160], (y * 100 + x) * 3);
    const lum = estimerLumiere(rvb, 100, 100);
    expect(lum.directionX).toBeGreaterThan(0.5);
    expect(lum.teinte).toMatch(/^#FF/);
  });
});

/* ------------------------------------------------------------------ */
/* Repli sans main                                                     */
/* ------------------------------------------------------------------ */

describe("Repli sans main : la vidéo sort sans l'effet, avec « Effet non réussi — Réessayer »", () => {
  const passageMain = (): PassageEffet => ({
    id: "pas-main",
    type: "autre",
    debutSec: 1,
    finSec: 5,
    origine: "demande",
    ancre: { debutPriseSec: 1, finPriseSec: 5 },
    operation: { type: "objetMain", debutMot: 0, finMot: 8, objet: "logo-axion", description: "logo" },
  });
  const entree = (mains: EchantillonMainDetaille[], passages = [passageMain()]) => ({
    passages,
    piste: { version: 1 as const, largeurSource: L, hauteurSource: H, imagesParSec: 25, echantillons: VISAGE, mains, visageTrouvePct: 100 },
    coupes: [],
    cadre: CADRE,
    largeur: L,
    hauteur: H,
    pisteMonteeCle: "videos/v1/montage.mov",
    prefixe: "videos/v1/effets",
  });

  it("aucune main : pas de rendu, passage marqué, décision « Réessayer » ; main trop brève : idem", () => {
    for (const mains of [[], pisteMain({ ouvre: 2, ferme: 2.5 })]) {
      const r = preparerEffetsFacecam(entree(mains));
      expect(r.rendus).toEqual([]);
      expect(r.decisions).toEqual([{ passageId: "pas-main", livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer" }]);
      expect(r.passages[0]).toMatchObject({ sansDetourage: true, echecsEffet: 1 });
    }
    expect(analyserMain([], 0, 5)).toEqual({ trouvee: false, raison: "aucune-main", ouverteSec: 0 });
    expect(analyserMain(pisteMain({ ouvre: 2, ferme: 2.5 }), 0, 5)).toMatchObject({ trouvee: false, raison: "main-trop-courte" });
  });

  it("« Réessayer » : le passage est réanalysé avec un seuil assoupli (0,5 s), et l'effet passe", () => {
    const mains = pisteMain({ ouvre: 2, ferme: 2.7 }); // 3 échantillons ouverts : 0,72 s
    const rate = preparerEffetsFacecam(entree(mains));
    expect(rate.rendus).toHaveLength(0);
    // Tant que Will n'a pas touché « Réessayer », rien n'est relancé.
    expect(preparerEffetsFacecam(entree(mains, rate.passages as PassageEffet[])).rendus).toHaveLength(0);
    const reessai = reessayerEffet(rate.passages as PassageMonteur[], "pas-main");
    const r = preparerEffetsFacecam(entree(mains, reessai as PassageEffet[]));
    expect(r.rendus).toHaveLength(1);
    expect(r.rendus[0]).toMatchObject({ passageId: "pas-main", cle: "videos/v1/effets/pas-main.mp4", entrees: { piste: "videos/v1/montage.mov" } });
    expect(r.decisions[0].livre).toBe("avec-effet");
  });

  it("vitre qui révèle une carte : la carte titre est rendue d'abord, le bruitage de verre est posé au mot", () => {
    const passage: PassageEffet = { id: "pas-v", type: "autre", debutSec: 6.02, finSec: 7.2, origine: "demande", ancre: { debutPriseSec: 6.02, finPriseSec: 7.2 }, operation: { type: "vitreBrisee", auMot: 10, dureeSec: 1.2, revele: "carte", texteCarte: "Le temps perdu", bruitage: true } };
    const r = preparerEffetsFacecam({ ...entree([], [passage]), raccordsSec: [6.4] });
    expect(r.rendus).toHaveLength(1);
    const rendu = r.rendus[0];
    // Calée sur le raccord tout proche (le vrai « plan suivant »).
    expect(rendu.debutSec).toBeCloseTo(6.4, 5);
    expect(rendu.carteARendre).toMatchObject({ cle: "videos/v1/effets/pas-v-carte.mp4", carte: { modele: "titre", donnees: { titre: "Le temps perdu" } } });
    expect(rendu.entrees).toEqual({ piste: "videos/v1/montage.mov", carte: "videos/v1/effets/pas-v-carte.mp4" });
    expect(r.bruitages).toEqual([{ passageId: "pas-v", nom: "verre", monteeSec: rendu.debutSec }]);
  });
});

/* ------------------------------------------------------------------ */
/* Géométrie des transitions                                           */
/* ------------------------------------------------------------------ */

describe("Transitions : vitre, pli, zoom traversant", () => {
  const visage: BoitePx = BOITE_VISAGE_PX;
  const p = (style: "vitre-brisee" | "ecran-plie" | "zoom-traversant"): ParametresTransition => ({ largeur: L, hauteur: H, dureeSec: bornerDureeTransition(null, style), point: pointHorsVisage(L, H, visage, undefined, style), visageApres: visage, graine: 7 });

  it("durées bornées, point d'impact toujours hors du visage", () => {
    expect([bornerDureeTransition(0.1, "vitre-brisee"), bornerDureeTransition(9, "ecran-plie"), bornerDureeTransition(null, "zoom-traversant")]).toEqual([0.6, 1.5, 1]);
    for (const style of ["vitre-brisee", "ecran-plie", "zoom-traversant"] as const) {
      const pt = p(style).point;
      const dedans = pt.x > visage[0] && pt.x < visage[0] + visage[2] && pt.y > visage[1] && pt.y < visage[1] + visage[3];
      expect(dedans).toBe(false);
    }
    // Un point souhaité sur le visage est refusé.
    const surVisage = pointHorsVisage(L, H, visage, { x: visage[0] + 10, y: visage[1] + 10 });
    expect(surVisage.y).toBeGreaterThan(visage[1] + visage[3]);
  });

  it("les éclats couvrent toute l'image sans recouvrement, de façon déterministe", () => {
    const e = genererEclats(p("vitre-brisee"));
    expect(genererEclats(p("vitre-brisee"))).toEqual(e);
    expect(e.length).toBeGreaterThan(60);
    const aire = e.reduce((s, x) => s + airePolygone(x.polygone), 0);
    expect(aire / (L * H)).toBeGreaterThan(0.995);
    expect(aire / (L * H)).toBeLessThan(1.005);
  });

  it("vitre : fissures d'abord, puis éclats ; le visage révélé se dégage ; plus rien à la fin", () => {
    const pv = p("vitre-brisee");
    const eclats = genererEclats(pv);
    const debut = dessinTransition("vitre-brisee", pv, calendrierVitre(pv.dureeSec).fissure * 0.5, eclats);
    expect(debut.some((d) => d.type === "fissures")).toBe(true);
    expect(debut.some((d) => d.type === "triangle")).toBe(false);
    const milieu = dessinTransition("vitre-brisee", pv, pv.dureeSec * 0.5, eclats);
    expect(milieu.some((d) => d.type === "triangle")).toBe(true);
    expect(couvertureVisageVitre(pv, eclats, pv.dureeSec * 0.75)).toBeLessThan(0.15);
    expect(couvertureVisageVitre(pv, eclats, pv.dureeSec * 0.95)).toBeLessThan(0.05);
    expect(dessinTransition("vitre-brisee", pv, pv.dureeSec, eclats)).toEqual([]);
  });

  it("pli et zoom : géométrie finie et déterministe, rien après la durée", () => {
    for (const style of ["ecran-plie", "zoom-traversant"] as const) {
      const pp = p(style);
      const a = dessinTransition(style, pp, pp.dureeSec * 0.4);
      expect(a.length).toBeGreaterThan(0);
      expect(dessinTransition(style, pp, pp.dureeSec * 0.4)).toEqual(a);
      expect(JSON.stringify(a)).not.toMatch(/NaN|null/);
      expect(dessinTransition(style, pp, pp.dureeSec + 0.01)).toEqual([]);
    }
  });

  it("préparation : composition `EffetTransition`, durée exacte, image figée = dernière image avant le mot", () => {
    const r = preparerTransition({ style: "vitre-brisee", auSec: 10.02, largeur: L, hauteur: H, visage });
    expect(r.parametres.composition).toBe("EffetTransition");
    const pr = r.parametres.proprietes as { images: number; avant: { debutImage: number }; apres: { debutImage: number; source: string } };
    expect(pr.images).toBe(30);
    expect(r.finSec - r.debutSec).toBeCloseTo(1.2, 5);
    expect(pr.avant.debutImage).toBe(pr.apres.debutImage - 1);
    expect(pr.apres.source).toBe("entree:piste");
  });
});

describe("Bruitage de verre", () => {
  it("WAV mono 16 bits valide, déterministe", async () => {
    const { synthetiserVerre, wavMono16 } = await import("@/briques/effets-speciaux");
    const a = wavMono16(synthetiserVerre(8000, 0.5), 8000);
    expect(new TextDecoder().decode(a.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(a.slice(8, 16))).toBe("WAVEfmt ");
    expect(new TextDecoder().decode(a.slice(36, 40))).toBe("data");
    expect(a.length).toBe(44 + 4000 * 2);
    expect(wavMono16(synthetiserVerre(8000, 0.5), 8000)).toEqual(a);
  });
});
