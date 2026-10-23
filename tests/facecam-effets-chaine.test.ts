/**
 * LOT I — effets spéciaux du lot F3 branchés dans la chaîne face caméra (habillage du lot C/E), tout simulé :
 * effets rendus (opération `composition` sans mode, CRF bas, adresses signées), carte révélée rendue avant la vitre,
 * effet raté retiré (« 1 élément non fait », drapeau « Réessayer »), pas de Look en double (ni sur les effets ni sur
 * les cartes de motion), bruitage de verre de la banque, lumière lue sur la vignette, image de contrôle par effet.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition, PlanScene } from "@/briques/composition/scene";
import { plagesLookBroll } from "@/briques/habillage-facecam/broll";
import { poserCartesPleinEcran } from "@/briques/motion/pose";
import { synthetiserVerre, wavMono16, type EchantillonMainDetaille } from "@/briques/effets-speciaux";
import type { PisteVisage } from "@/briques/realisation/piste";
import type { PassageFacecam } from "@/domaine/facecam";
import { avancerChaine, etatChaineInitial, livraisonChaine, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { entreesAvecLivraison } from "@/moteurs/montage-facecam/raccords";
import { avecAdresses, cadreDesPlans, coupesDesGardes, CRF_EFFETS, imagesControleEffets, lumiereDeLaVignette, MEDIA_VERRE } from "@/moteurs/montage-facecam/effets-chaine";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function commande(o: { lut?: boolean } = {}): CommandeFabrication {
  return {
    videoId: "v-fx",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fx/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: o.lut ? { lut: { id: "lut-will", intensite: 60 } } : { lut: null },
    medias: o.lut ? { "lut-will": { cle: "studio/prod/luts/will.cube", mime: "application/octet-stream" } } : {},
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

function outilsRendu(service?: ServiceRendu): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const simule = creerServiceRenduSimule(() => (t += 6_000));
  const rendu = service ?? simule;
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

/* Passages posés par le monteur (temps du montage ; ancre dans la prise). */
const VITRE: PassageFacecam = { id: "pas-vitre", type: "autre", debutSec: 3, finSec: 4.2, origine: "demande", ancre: { debutPriseSec: 3.4, finPriseSec: 4.6 }, operation: { type: "vitreBrisee", auMot: 20, dureeSec: 1.2, revele: "carte", texteCarte: "Le temps perdu", bruitage: true } } as unknown as PassageFacecam;
const PLI: PassageFacecam = { id: "pas-pli", type: "autre", debutSec: 10, finSec: 11, origine: "demande", ancre: { debutPriseSec: 10.5, finPriseSec: 11.5 }, operation: { type: "transitionEcran", auMot: 40, style: "ecran-plie", dureeSec: null } } as unknown as PassageFacecam;
const MAIN: PassageFacecam = { id: "pas-main", type: "autre", debutSec: 1, finSec: 6, origine: "demande", ancre: { debutPriseSec: 1, finPriseSec: 6 }, operation: { type: "objetMain", debutMot: 5, finMot: 14, objet: "logo-axion", description: "logo" } } as unknown as PassageFacecam;
const CARTE_PLEINE = { id: "pas-carte", debutSec: 5.5, finSec: 8.5, disposition: "plein-ecran" as const, modele: "chiffre" as const, textes: ["30 %"], description: "un chiffre" };

/** Piste `/visages` simulée (source 3840 × 2160) : visage au centre, main ouverte de 2 à 4,5 s dans la prise. */
function piste(avecMain: boolean): PisteVisage {
  const echantillons = Array.from({ length: 300 }, (_, i) => ({ t: i * 0.2, yeuxX: 0.5, yeuxY: 0.35, boite: [0.45, 0.25, 0.1, 0.2] as [number, number, number, number], bouche: 0.2, confiance: 1 }));
  const mains: EchantillonMainDetaille[] = [];
  if (avecMain) for (let t = 1.04; t <= 5.5; t += 0.24) mains.push({ t: +t.toFixed(3), x: 0.53, y: 0.62, ouverte: t >= 2 && t <= 4.5 });
  return { version: 1, largeurSource: 3840, hauteurSource: 2160, imagesParSec: 25, echantillons, mains, visageTrouvePct: 100, luminanceVisage: 120 };
}

const composition = (o: { soumises: DemandeRendu[] }) => o.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet")!;

describe("lot I · effets spéciaux dans la chaîne (simulée)", () => {
  it("chaque effet est rendu (composition sans mode, CRF bas, adresses signées), posé comme une carte plein écran, avec son image de contrôle ; la carte révélée part avant la vitre", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [], passages: [VITRE, PLI] }), habillage: outils });
    expect(etat.fini).toBe(true);
    expect(etat.sauts).toEqual([]);
    const effets = outils.soumises.filter((d) => /\/effets\/pas-(vitre|pli)\.mp4$/.test(d.sortie.cle));
    expect(effets.map((d) => d.sortie.cle).sort()).toEqual(["facecam/v-fx/ver-1/effets/pas-pli.mp4", "facecam/v-fx/ver-1/effets/pas-vitre.mp4"]);
    for (const d of effets) {
      expect(d.operation).toBe("composition");
      expect((d.parametres as { mode?: string }).mode).toBeUndefined();
      expect(d.parametres).toMatchObject({ composition: "EffetTransition", crf: CRF_EFFETS });
      // Plus aucune référence `entree:` : l'opération sans mode ne les remplace pas, la chaîne donne les adresses.
      expect(JSON.stringify(d.parametres).match(/"entree:[a-z]*"/g)).toBeNull();
      expect(JSON.stringify(d.parametres)).toMatch(/"https:\/\/r2.exemple\/lire\/simulation\/facecam\/[^"]*image-10bits.mp4"/);
    }
    // La carte « Le temps perdu » est soumise AVANT la vitre, et la vitre la lit.
    const iCarte = outils.soumises.findIndex((d) => d.sortie.cle.endsWith("pas-vitre-carte.mp4"));
    const iVitre = outils.soumises.findIndex((d) => d.sortie.cle.endsWith("pas-vitre.mp4"));
    expect(iCarte).toBeGreaterThanOrEqual(0);
    expect(iCarte).toBeLessThan(iVitre);
    expect(JSON.stringify(outils.soumises[iVitre].parametres)).toContain("https://r2.exemple/lire/facecam/v-fx/ver-1/effets/pas-vitre-carte.mp4");
    // Image de contrôle au milieu de chaque effet (opération `image-fixe` existante).
    const controles = outils.soumises.filter((d) => d.operation === "image-fixe");
    expect(controles.map((d) => d.sortie.cle).sort()).toEqual(["facecam/v-fx/ver-1/effets/pas-pli-controle.png", "facecam/v-fx/ver-1/effets/pas-vitre-controle.png"]);
    expect(imagesControleEffets(etat.habillage!.effets).map((x) => x.elementId).sort()).toEqual(["pas-pli", "pas-vitre"]);
    // Composition finale : les deux MP4 posés en cartes plein écran, le verre posé au mot sous la voix.
    const compo = composition(outils);
    expect(Object.values(compo.entrees)).toEqual(expect.arrayContaining(["https://r2.exemple/lire/facecam/v-fx/ver-1/effets/pas-vitre.mp4", "https://r2.exemple/lire/facecam/v-fx/ver-1/effets/pas-pli.mp4", `https://r2.exemple/lire/${MEDIA_VERRE.cle}`]));
    const p = compo.parametres as unknown as ParametresDemandeComposition & { mode: "complet" };
    const plansEffets = p.image.plans.filter((pl) => pl.type === "illustration");
    expect(plansEffets).toHaveLength(2);
    expect(plansEffets.every((pl) => pl.sansLook)).toBe(true);
    const vitre = etat.habillage!.effets!.find((x) => x.id === "pas-vitre")!;
    expect(p.son.bruitages).toEqual([expect.objectContaining({ debutSec: vitre.debutSec, gainDb: -21 })]);
  });

  it("effet raté (rendu en panne) : retiré de la composition, « 1 élément non fait », la vidéo sort quand même", async () => {
    let t = 0;
    const simule = creerServiceRenduSimule(() => (t += 6_000));
    const enPanne: ServiceRendu = {
      soumettre: (d) => simule.soumettre(d),
      etat: async (id): Promise<EtatRendu> => (id.includes("pas-pli") && !id.includes("controle") ? { statut: "echec", erreur: { code: "inconnu", reessayable: false, message: "Panne simulée." } } : simule.etat(id)),
    };
    const outils = outilsRendu(enPanne);
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [], passages: [VITRE, PLI] }), habillage: outils });
    expect(etat.fini).toBe(true);
    expect(etat.sauts.map((s) => s.brique)).toEqual(["Un effet spécial"]);
    expect(etat.habillage!.effets!.find((x) => x.id === "pas-pli")?.statut).toBe("echec");
    const compo = composition(outils);
    expect(Object.values(compo.entrees).some((u) => u.includes("pas-pli"))).toBe(false);
    expect(Object.values(compo.entrees).some((u) => u.endsWith("pas-vitre.mp4"))).toBe(true);
    expect(imagesControleEffets(etat.habillage!.effets).map((x) => x.elementId)).toEqual(["pas-vitre"]);
    expect(livraisonChaine(etat).alertes.some((a) => /1 élément non fait — Un effet spécial/.test(a.message))).toBe(true);
  });

  it("objet dans la main sans main trouvée : aucun rendu, drapeau « Réessayer » recopié dans entrees.facecam ; avec la main : rendu, lumière lue sur la vignette", async () => {
    const outils = outilsRendu();
    const sans = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [], passages: [MAIN] }), habillage: outils, lireJsonGz: async () => piste(false) });
    expect(sans.fini).toBe(true);
    expect(sans.habillage!.effets ?? []).toEqual([]);
    expect(outils.soumises.some((d) => d.sortie.cle.includes("pas-main"))).toBe(false);
    expect(sans.sauts.map((s) => s.brique)).toEqual(["Un effet spécial"]);
    const livree = livraisonChaine(sans).facecam;
    expect(livree.passages?.[0]).toMatchObject({ id: "pas-main", sansDetourage: true, echecsEffet: 1 });
    const entrees = entreesAvecLivraison({ facecam: { coupes: { auto: [], retablies: [] }, passages: [MAIN, { id: "pas-x", type: "zoom", debutSec: 1, finSec: 2 }] } }, livree);
    expect((entrees.facecam as { passages: (PassageFacecam & { sansDetourage?: boolean })[] }).passages.map((p) => [p.id, !!p.sansDetourage])).toEqual([
      ["pas-main", true],
      ["pas-x", false],
    ]);

    // Avec la main : rendu ; la vignette (lumière chaude venant de la droite) règle la lumière de l'objet.
    const outils2 = outilsRendu();
    const vignettes: string[] = [];
    const rvb = new Uint8Array(108 * 192 * 3);
    for (let y = 0; y < 192; y++) for (let x = 0; x < 108; x++) rvb.set(x < 54 ? [60, 50, 40] : [250, 205, 160], (y * 108 + x) * 3);
    const avec = await jusquAuBout({
      facecam: creerFacecamSimule(),
      monteur: async () => ({ cartes: [], passages: [MAIN] }),
      habillage: outils2,
      lireJsonGz: async () => piste(true),
      lireImageRvb: async (cle) => (vignettes.push(cle), { donnees: rvb, largeur: 108, hauteur: 192 }),
    });
    expect(avec.fini).toBe(true);
    expect(avec.sauts).toEqual([]);
    expect(vignettes).toHaveLength(1);
    const d = outils2.soumises.find((x) => x.sortie.cle.endsWith("pas-main.mp4"))!;
    expect(d.parametres).toMatchObject({ composition: "EffetObjetMain", crf: CRF_EFFETS });
    const lumiere = (d.parametres as { proprietes: { lumiere: { directionX: number; teinte: string } } }).proprietes.lumiere;
    expect(lumiere.directionX).toBeGreaterThan(0.3);
    expect(lumiere.teinte).toMatch(/^#FF/);
  });

  it("sans effet demandé : chaîne strictement inchangée (aucune demande d'effet, aucun bruitage)", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [] }), habillage: outils });
    expect(etat.fini).toBe(true);
    expect(etat.habillage!.effets).toBeUndefined();
    expect(etat.monteur).toEqual({ statut: "fait", cartes: [] });
    expect(outils.soumises.some((d) => d.operation === "image-fixe" || d.sortie.cle.includes("/effets/"))).toBe(false);
    expect((composition(outils).parametres as unknown as ParametresDemandeComposition & { mode: "complet" }).son.bruitages).toBeUndefined();
  });
});

describe("lot I · pas de Look en double", () => {
  it("la LUT du Look ne touche ni les effets (déjà avec le Look) ni les cartes de motion (charte exacte)", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [CARTE_PLEINE], passages: [PLI] }), habillage: outils }, commande({ lut: true }));
    expect(etat.fini).toBe(true);
    const p = composition(outils).parametres as unknown as ParametresDemandeComposition & { mode: "complet" };
    expect(p.image.plans.filter((pl) => pl.type === "illustration")).toHaveLength(2);
    expect(composition(outils).entrees["lut-look"]).toBeUndefined();
    expect(JSON.stringify(p.couleurs.luts)).not.toContain("lut-look");
  });

  it("un vrai B-roll garde le Look ; une carte posée par `poserCartesPleinEcran` porte `sansLook`", () => {
    const base: PlanScene = { debutSec: 0, finSec: 10, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.4 } };
    const plans = poserCartesPleinEcran([base], [{ debutSec: 2, finSec: 4, entree: "carte-pe-1" }]);
    expect(plans.find((pl) => pl.type === "illustration")?.sansLook).toBe(true);
    const broll: PlanScene = { ...base, debutSec: 6, finSec: 8, type: "illustration", illustration: { url: "entree:illu-1", video: true } };
    expect(plagesLookBroll([...plans, broll])).toEqual([[6, 8]]);
  });
});

describe("lot I · utilitaires", () => {
  it("coupes actives depuis les gardes, cadre de chaque plan, références remplacées", () => {
    expect(coupesDesGardes([{ debutSec: 1, finSec: 4 }, { debutSec: 6, finSec: 9 }], 10)).toEqual([
      { debutSec: 0, finSec: 1 },
      { debutSec: 4, finSec: 6 },
      { debutSec: 9, finSec: 10 },
    ]);
    const plan = (debutSec: number, finSec: number, x: number) => ({ debutSec, finSec, priseDebutSec: debutSec, priseFinSec: finSec, taille: "large", cadre: { x, y: 0, largeur: 1216, hauteur: 2160 }, ouverture: "debut", yeuxHauteur: 0.33 }) as never;
    const cadre = cadreDesPlans([plan(0, 5, 1312), plan(5, 9, 1000)], { largeur: 3840, hauteur: 2160 }) as (s: number) => { x: number; largeur: number };
    expect(cadre(2).x).toBeCloseTo(1312 / 3840, 6);
    expect(cadre(6).x).toBeCloseTo(1000 / 3840, 6);
    expect(cadre(20).x).toBeCloseTo(1000 / 3840, 6);
    expect(cadre(2).largeur).toBeCloseTo(1216 / 3840, 6);
    expect(avecAdresses({ a: "entree:piste", b: ["entree:carte", "x"], c: 3, d: "entree:inconnue" }, { piste: "https://p", carte: "https://c" })).toEqual({ a: "https://p", b: ["https://c", "x"], c: 3, d: "entree:inconnue" });
  });

  it("lumière : vignette absente ou visage introuvable → repli (undefined)", () => {
    expect(lumiereDeLaVignette(null, piste(false), [], { x: 0, y: 0, largeur: 1, hauteur: 1 })).toBeUndefined();
    expect(lumiereDeLaVignette({ donnees: new Uint8Array(30), largeur: 10, hauteur: 10 }, null, [], { x: 0, y: 0, largeur: 1, hauteur: 1 })).toBeUndefined();
  });

  it("son de verre : WAV valide (bloc « data »), déposé dans la banque avec le manifeste", () => {
    const wav = wavMono16(synthetiserVerre(48000, 0.2));
    expect(String.fromCharCode(...wav.slice(36, 40))).toBe("data");
    const racine = resolve(__dirname, "..");
    expect(existsSync(join(racine, "public", "bruitages", "verre-1.wav"))).toBe(true);
    const manifeste = JSON.parse(readFileSync(join(racine, "public", "bruitages", "manifeste.json"), "utf8")) as { sons: { fichier: string; dureeSec: number; creteDb: number }[] };
    const verre = manifeste.sons.find((s) => s.fichier === "verre-1.wav")!;
    expect(verre.dureeSec).toBeCloseTo(MEDIA_VERRE.dureeSec, 3);
    expect(verre.creteDb).toBeLessThanOrEqual(-3 + 1e-6);
  });
});
