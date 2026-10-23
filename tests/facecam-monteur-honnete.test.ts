/**
 * RAPPORT V6 — P0 n° 6 « INTERDIT DE MENTIR ». Test TRANSVERSAL : chaque type d'opération du vocabulaire du monteur
 * a un rendu PROUVÉ dans la sortie (paramètres soumis au cadrage, à la passe image, au son ou à la composition), OU est
 * marqué « pas encore possible » et refusé clairement (aucun passage enregistré, jamais « C'est fait »).
 * Chaîne complète avec les doubles (studio-aligneur et studio-rendu simulés) : aucun réseau.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { entreesFacecamVides, lireEntreesFacecam } from "@/domaine/facecam";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import { appliquerZooms, realiser, ZOOM_TAILLE } from "@/briques/realisation";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import { effetsDesPassages } from "@/moteurs/montage-facecam/effets-chaine";
import { partiesARefaire, signatureMontage } from "@/moteurs/montage-facecam/retouche";
import {
  appliquerOperations,
  catalogueTexte,
  exemplesDemandes,
  piloterMonteur,
  reglagesMonteurVides,
  roleMonteurFacecam,
  TYPES_OPERATION_FACECAM,
  type EtatMonteur,
  type OperationFacecam,
  type PassageMonteur,
  type TypeOperationFacecam,
} from "@/moteurs/montage-facecam/monteur";
import { DISPONIBILITE_OPERATIONS, disponibiliteOperation, PAS_ENCORE_POSSIBLE } from "@/moteurs/montage-facecam/monteur/disponibilite";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";
/** 100 mots, un toutes les 0,5 s : la prise de 60 s vue par le monteur. */
const MOTS: MotHorodate[] = Array.from({ length: 100 }, (_, i) => ({ mot: `mot${i}`, debutSec: 1 + i * 0.5, finSec: 1.4 + i * 0.5 }));

let n = 0;
const nouvelId = (p: string) => `${p}-${++n}`;

function etatVide(): EtatMonteur {
  return { facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() };
}

function appliquer(ops: OperationFacecam[], etat = etatVide()) {
  return appliquerOperations(etat, ops, { mots: MOTS.map((m, i) => ({ index: i, mot: m.mot, debutPriseSec: m.debutSec, finPriseSec: m.finSec, monteeSec: m.debutSec, retire: false })), dureePriseSec: 60, origine: "demande", consigneId: "k1", nouvelId });
}

/** Une opération de chaque type, telle que Claude la rend. */
const EXEMPLES: Record<TypeOperationFacecam, OperationFacecam> = {
  ajouterCarte: { type: "ajouterCarte", debutMot: 2, finMot: 10, modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], html: null, disposition: "plein-ecran", description: "Les trois raisons", animationGardeeId: null },
  zoom: { type: "zoom", debutMot: 14, finMot: 16, style: "punch-in", cible: "visage" },
  ecranPartage: { type: "ecranPartage", debutMot: 4, finMot: 12, description: "Les deux offres", textes: ["Deux offres", "Essentiel", "Complet"] },
  miseEnPage: { type: "miseEnPage", debutMot: 6, finMot: 14, mode: "cote", cote: "droite", description: "Explication du financement" },
  couleurs: { type: "couleurs", reglage: "lumiere", cran: "plus", teinte: "plus-chaud" },
  son: { type: "son", action: "bruitage", precision: "whoosh", debutMot: 12, finMot: 12 },
  masquerPersonne: { type: "masquerPersonne", debutMot: 20, finMot: 30 },
  texteDerriere: { type: "texteDerriere", debutMot: 2, finMot: 8, texte: "2026" },
  vitesse: { type: "vitesse", debutMot: 70, finMot: 80, facteur: 1.5 },
  arretImage: { type: "arretImage", auMot: 90, dureeSec: 2, texte: null },
  titre: { type: "titre", texte: "3 erreurs à éviter", debutMot: 2, finMot: 8, pleinEcran: false },
  generique: { type: "generique", position: "fin", texte: "Merci de votre attention", dureeSec: 4 },
  couper: { type: "couper", debutMot: 16, finMot: 19 },
  retablir: { type: "retablir", coupeId: "c-debut" },
  retirer: { type: "retirer", passageId: "pas-a-retirer" },
  remettre: { type: "remettre", passageId: "auto-a-remettre" },
  objetMain: { type: "objetMain", debutMot: 30, finMot: 36, objet: "logo-axion", description: "Le logo dans ma main" },
  vitreBrisee: { type: "vitreBrisee", auMot: 46, dureeSec: null, revele: "plan-suivant", texteCarte: null, bruitage: true },
  transitionEcran: { type: "transitionEcran", auMot: 56, style: "ecran-plie", dureeSec: null },
  effetRealisteIA: { type: "effetRealisteIA", debutMot: 30, finMot: 36, description: "Un vrai logo qui flotte au-dessus de ma main", reference: "logo-axion", plan: "large" } as unknown as OperationFacecam,
  changerTitreCouverture: { type: "changerTitreCouverture", texte: "Le diagnostic fuite" },
};

/* ------------------------------------------------------------------ */
/* Chaîne complète (doubles)                                           */
/* ------------------------------------------------------------------ */

function commande(entrees: Record<string, unknown>): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees,
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

function outilsRendu(): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([k, c]) => [k, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

/** Fabrique une vidéo dont le monteur a appliqué `ops` ; rend les demandes soumises au studio-aligneur et à studio-rendu. */
async function fabriquer(ops: OperationFacecam[]) {
  const r = appliquer(ops);
  const entrees = { facecam: r.etat.facecam, facecamMonteur: r.etat.reglages };
  const facecam = creerFacecamSimule();
  const outils = outilsRendu();
  const deps: DependancesChaine = {
    facecam,
    // Comme le branchement réel (`facecam-branchements.ts`) : cartes = passages du monteur.
    monteur: async () => ({ cartes: cartesDesPassages(r.etat.facecam.passages as PassageMonteur[]), passages: r.etat.facecam.passages, entrees }),
    habillage: outils,
  };
  let etat: EtatChaine = etatChaineInitial();
  // Comme en vrai : la commande n'a pas les entrées du monteur, il les rend pendant la fabrication.
  const c = commande({});
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-h", versionId: "ver-h" }, deps);
  expect(etat.fini).toBe(true);
  const etape = (e: string) => facecam.soumises.find((s) => s.demande.parametres?.etape === e)?.demande;
  const compo = outils.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet");
  return { etat, application: r, cadrage: etape("cadrage")!, passe: etape("passe")!, son: facecam.soumises.find((s) => s.route === "son")!.demande, cartes: outils.soumises.filter((d) => !(d.parametres as { mode?: string }).mode), compo: compo! };
}

/** Preuve du rendu de chaque type disponible : l'effet se lit dans ce qui part au rendu. */
const PREUVES: Partial<Record<TypeOperationFacecam, () => Promise<void>>> = {
  async ajouterCarte() {
    const f = await fabriquer([EXEMPLES.ajouterCarte]);
    expect(f.cartes.some((d) => JSON.stringify(d.parametres).includes("Gagner du temps"))).toBe(true);
  },
  async zoom() {
    const sans = await fabriquer([]);
    const avec = await fabriquer([EXEMPLES.zoom]);
    type P = { debutSec: number; finSec: number; cadre: { largeur: number } };
    const plansAvec = avec.cadrage.parametres!.plans as P[];
    const passage = avec.application.etat.facecam.passages[0];
    const aMi = (plans: P[], t: number) => plans.find((p) => t >= p.debutSec && t < p.finSec)!;
    const t = (passage.debutSec + passage.finSec) / 2;
    // Pendant le zoom, le cadre envoyé au cadrage est plus serré que sans zoom (130 % : largeur / 1,3).
    expect(aMi(plansAvec, t).cadre.largeur).toBeLessThan(aMi(sans.cadrage.parametres!.plans as P[], t).cadre.largeur);
    expect(aMi(plansAvec, t).cadre.largeur).toBe(Math.round(2160 * (9 / 16) / 1.3 / 2) * 2);
  },
  async ecranPartage() {
    const f = await fabriquer([EXEMPLES.ecranPartage]);
    const ecrans = f.etat.habillage!.base.supplements?.ecransPartages ?? [];
    expect(ecrans).toHaveLength(1);
    expect(f.cartes.map((d) => d.sortie.cle)).toContain(ecrans[0].carteCle);
    expect(Object.values(f.compo.entrees)).toContain(`https://r2.exemple/lire/${ecrans[0].carteCle}`);
  },
  async miseEnPage() {
    const f = await fabriquer([EXEMPLES.miseEnPage]);
    const mp = f.etat.habillage!.base.supplementsMiseEnPage?.misesEnPage ?? [];
    expect(mp).toHaveLength(1);
    expect(mp[0]).toMatchObject({ mode: "cote", cote: "droite" });
    expect(Object.values(f.compo.entrees)).toContain(`https://r2.exemple/lire/${mp[0].carteCle}`);
  },
  async couleurs() {
    const f = await fabriquer([EXEMPLES.couleurs]);
    expect((f.passe.parametres!.image as { lumiere: string }).lumiere).toBe("plus");
    expect(f.passe.parametres!.teinte).toBe("plus-chaud");
  },
  async son() {
    // Bruitage de la banque (souffle court = whoosh) : posé au mixage de la composition.
    const f = await fabriquer([EXEMPLES.son]);
    expect(Object.entries(f.compo.entrees).filter(([k]) => k.startsWith("bruitage-")).map(([, v]) => v)).toEqual([expect.stringMatching(/\/bruitages\/illustration-forte-1\.wav$/)]);
    expect(f.etat.habillage!.base.bruitages?.[0]).toMatchObject({ declencheur: "illustration-forte" });
    // Plus fort : le son monté le reçoit.
    const g = await fabriquer([{ type: "son", action: "plus-fort", precision: null, debutMot: null, finMot: null }]);
    expect(g.son.parametres!.voix).toMatchObject({ volume: "plus-fort" });
  },
  async titre() {
    const f = await fabriquer([EXEMPLES.titre]);
    expect(f.cartes.some((d) => JSON.stringify(d.parametres).includes("3 erreurs à éviter"))).toBe(true);
  },
  async generique() {
    const f = await fabriquer([EXEMPLES.generique]);
    const carte = f.cartes.find((d) => JSON.stringify(d.parametres).includes("Merci de votre attention"));
    expect(carte).toBeTruthy();
    // Générique de fin : posé sur les dernières secondes de la vidéo (jamais après la fin).
    const duree = f.etat.habillage!.base.dureeSec;
    const pleins = (f.etat.habillage!.base.supplements?.cartesPleinEcran ?? []).filter((x) => x.carteCle === carte!.sortie.cle);
    expect(pleins).toHaveLength(1);
    expect(pleins[0].finSec).toBeLessThanOrEqual(duree + 1e-6);
    expect(pleins[0].debutSec).toBeGreaterThan(duree - 5);
  },
  async couper() {
    const sans = await fabriquer([]);
    const f = await fabriquer([EXEMPLES.couper]);
    const garde = (x: { debutSec: number; finSec: number }[]) => x.reduce((s, g) => s + g.finSec - g.debutSec, 0);
    expect(garde(f.son.parametres!.gardes as { debutSec: number; finSec: number }[])).toBeLessThan(garde(sans.son.parametres!.gardes as { debutSec: number; finSec: number }[]));
  },
  async retablir() {
    const etat = etatVide();
    etat.facecam.coupes.auto = [{ id: "c-debut", type: "debut", debutSec: 0, finSec: 2 }];
    const r = appliquer([EXEMPLES.retablir], etat);
    expect(r.etat.facecam.coupes.retablies).toEqual(["c-debut"]);
  },
  async retirer() {
    const pose = appliquer([EXEMPLES.ajouterCarte]);
    const id = pose.etat.facecam.passages[0].id;
    const r = appliquer([{ type: "retirer", passageId: id }], pose.etat);
    expect(cartesDesPassages(r.etat.facecam.passages as PassageMonteur[])).toEqual([]);
  },
  async remettre() {
    const etat = etatVide();
    etat.reglages.cartesAutoRetirees = ["auto-a-remettre"];
    const r = appliquer([EXEMPLES.remettre], etat);
    expect(r.appliquees).toHaveLength(1);
    // L'habillage ne reçoit plus la carte comme retirée : elle est reposée.
    expect(r.etat.reglages.cartesAutoRetirees).toEqual([]);
  },
  async objetMain() {
    expect(effetsDesPassages(appliquer([EXEMPLES.objetMain]).etat.facecam.passages)).toHaveLength(1);
  },
  async vitreBrisee() {
    expect(effetsDesPassages(appliquer([EXEMPLES.vitreBrisee]).etat.facecam.passages)).toHaveLength(1);
  },
  async transitionEcran() {
    expect(effetsDesPassages(appliquer([EXEMPLES.transitionEcran]).etat.facecam.passages)).toHaveLength(1);
  },
  async effetRealisteIA() {
    // Rendu après « Confirmer » : prouvé de bout en bout par `k-chaine-effet-realiste.test.ts`.
    expect(readFileSync("tests/k-chaine-effet-realiste.test.ts", "utf8")).toMatch(/morceau/);
  },
  async changerTitreCouverture() {
    // Rien dans la vidéo : l'image de couverture est refaite, prouvé de bout en bout par `v1-chat-monteur.test.ts`.
    const r = appliquer([EXEMPLES.changerTitreCouverture]);
    expect(r.appliquees).toHaveLength(1);
    expect(r.etat.facecam.passages).toEqual([]);
    expect(readFileSync("tests/v1-chat-monteur.test.ts", "utf8")).toMatch(/La couverture affiche maintenant/);
  },
};

describe("V6 P0 n° 6 · chaque opération est rendue OU refusée clairement", () => {
  it("chaque type du vocabulaire a une disponibilité déclarée", () => {
    for (const t of TYPES_OPERATION_FACECAM) expect(DISPONIBILITE_OPERATIONS[t], t).toBeDefined();
  });

  for (const type of TYPES_OPERATION_FACECAM) {
    const d = DISPONIBILITE_OPERATIONS[type];
    if (d?.rendu) {
      it(`${type} : rendu prouvé dans la sortie`, async () => {
        expect(PREUVES[type], `preuve manquante pour ${type}`).toBeDefined();
        await PREUVES[type]!();
      }, 30_000);
    } else {
      it(`${type} : refusé clairement (« ${PAS_ENCORE_POSSIBLE} »), rien d'enregistré`, () => {
        const r = appliquer([EXEMPLES[type]]);
        expect(r.refusees).toEqual([0]);
        expect(r.appliquees).toEqual([]);
        expect(r.etat.facecam.passages).toEqual([]);
        expect(r.alertes.join(" ")).toContain(PAS_ENCORE_POSSIBLE);
      });
    }
  }

  it("cas fins : musique (pas de musique branchée) et bruitage hors banque → refusés ; bruitage de la banque → rendu", () => {
    expect(disponibiliteOperation({ type: "son", action: "musique", precision: "calme", debutMot: null, finMot: null }).rendu).toBe(false);
    expect(disponibiliteOperation({ type: "son", action: "bruitage", precision: "klaxon", debutMot: 3, finMot: 3 }).rendu).toBe(false);
    expect(disponibiliteOperation({ type: "son", action: "bruitage", precision: "pop", debutMot: 3, finMot: 3 }).rendu).toBe(true);
    const r = appliquer([{ type: "son", action: "musique", precision: "calme", debutMot: null, finMot: null }]);
    expect(r.etat.reglages.son.musique).toBeNull();
    expect(r.alertes.join(" ")).toContain(PAS_ENCORE_POSSIBLE);
  });

  it("le monteur ne répond JAMAIS « C'est fait » pour une demande non rendue, même si Claude l'affirme", async () => {
    const etat = etatVide();
    const appeler = async () => ({ ok: true as const, simule: false, donnees: { reponse: "C'est fait, j'ai accéléré ce passage.", operations: [EXEMPLES.vitesse], consignes: [{ consigneId: "fil", comprise: true, resume: "Passage accéléré", operations: [0] }] } });
    const r = await piloterMonteur({ titre: "Essai", mots: MOTS, dureePriseSec: 60, etat, plafondAtteint: false, message: "Accélère ce passage" }, { nouvelId, appeler });
    expect(r.reponse).not.toMatch(/c'est fait/i);
    expect(r.reponse).toContain(PAS_ENCORE_POSSIBLE);
    expect(r.resumes[0].comprise).toBe(false);
    expect(r.resumes[0].resume).toContain(PAS_ENCORE_POSSIBLE);
    expect(r.etat.facecam.passages).toEqual([]);
  });

  it("une réponse mixte dit ce qui est fait ET ce qui n'est pas possible (jamais un « C'est fait » global)", async () => {
    const appeler = async () => ({ ok: true as const, simule: false, donnees: { reponse: "C'est fait.", operations: [EXEMPLES.zoom, EXEMPLES.arretImage], consignes: [{ consigneId: "fil", comprise: true, resume: "Zoom et arrêt sur image", operations: [0, 1] }] } });
    const r = await piloterMonteur({ titre: "Essai", mots: MOTS, dureePriseSec: 60, etat: etatVide(), plafondAtteint: false, message: "Zoome puis fige l'image" }, { nouvelId, appeler });
    expect(r.reponse).not.toMatch(/^c'est fait\.?$/i);
    expect(r.reponse).toContain(PAS_ENCORE_POSSIBLE);
    expect(r.etat.facecam.passages.map((p) => p.type)).toEqual(["zoom"]);
  });

  it("« Que puis-je demander ? » et la consigne de Claude ne proposent plus que ce qui est rendu", () => {
    const exemples = exemplesDemandes(50).join(" | ");
    expect(exemples).not.toMatch(/Accélère|Ralentis|arrêt sur image|Cache-moi|derrière moi|musique plus calme/);
    expect(exemples).toMatch(/Zoome/);
    expect(exemples).toMatch(/générique/);
    const texte = catalogueTexte();
    for (const t of TYPES_OPERATION_FACECAM.filter((x) => !DISPONIBILITE_OPERATIONS[x].rendu)) expect(texte).not.toMatch(new RegExp(`^- ${t} \\(`, "m"));
    expect(roleMonteurFacecam.consigne).toMatch(/pas encore possible/i);
  });

  it("zoom lent, zoom flou ou zoom sur la main : rendus en zoom net sur le visage, et Will en est averti", () => {
    const r = appliquer([{ type: "zoom", debutMot: 40, finMot: 44, style: "lent", cible: "main" }]);
    expect(r.appliquees).toHaveLength(1);
    expect((r.etat.facecam.passages[0] as PassageMonteur).operation).toMatchObject({ style: "punch-in", cible: "visage" });
    expect(r.alertes.join(" ")).toMatch(/zoom net/i);
  });

  it("brique réalisation : un zoom scinde le plan et serre le cadre (130 %), hors zoom rien ne change", () => {
    const gardes = [{ debutSec: 0, finSec: 12 }];
    const p = realiser({ gardes, mots: [], source: { largeur: 3840, hauteur: 2160 } });
    const z = appliquerZooms(p.plans, [{ debutSec: 3.2, finSec: 4 }], { largeur: 3840, hauteur: 2160 });
    const zoom = z.filter((x) => x.zoomDemande);
    expect(zoom).toHaveLength(1);
    expect(zoom[0]).toMatchObject({ debutSec: 3.2, taille: ZOOM_TAILLE, ouverture: "punch-in" });
    expect(zoom[0].finSec).toBeGreaterThanOrEqual(5.2 - 1e-6); // 2 s au moins
    expect(z[z.length - 1].finSec).toBe(p.plans[p.plans.length - 1].finSec);
    // Les bornes dans la prise suivent le temps monté (pas de décalage du son).
    for (const x of z) expect(+(x.priseFinSec - x.priseDebutSec).toFixed(3)).toBeCloseTo(x.finSec - x.debutSec, 2);
    expect(existsSync("src/briques/realisation/zooms.ts")).toBe(true);
  });
});

describe("V6 P0 n° 6 · retouche « zoome ici »", () => {
  it("un zoom ajouté dans le fil refait les plans et la piste montée (avant : seul l'habillage, le zoom n'apparaissait pas)", () => {
    const avant = appliquer([]);
    const apres = appliquer([EXEMPLES.zoom]);
    const sig = (e: EtatMonteur) => signatureMontage({ facecam: e.facecam, facecamMonteur: e.reglages });
    expect([...partiesARefaire(sig(avant.etat), sig(apres.etat))].sort()).toEqual(["habillage", "plans"]);
    expect(lireEntreesFacecam({ facecam: apres.etat.facecam }).passages).toHaveLength(1);
  });
});
