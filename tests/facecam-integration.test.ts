/**
 * PLAN FACECAM v4 — LOT E « Intégration » : raccords entre les lots. Chaîne vidéo (lot B, double du studio-aligneur) →
 * agent monteur (lot D) → Décor IA (lot E1, coupé par défaut) → habillage (lot C : cartes rendues puis composition
 * finale dans studio-rendu, simulé). Règle de panne : aucun raccord ne bloque la livraison. Aucun réseau.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition } from "@/briques/composition/scene";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { resultatChaine } from "@/moteurs/montage-facecam/etapes-chaine";
import { creerMoteurMontageFacecam } from "@/moteurs/montage-facecam";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { cartePosee, cartesDesPassages, entreesAvecLivraison, type CarteMonteur } from "@/moteurs/montage-facecam/raccords";
import { brancherServicesFacecam, dependancesChaineParDefaut, servicesFacecam } from "@/moteurs/montage-facecam/dependances";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function commande(entrees: Record<string, unknown> = {}): CommandeFabrication {
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

/** Outils de studio-rendu simulés : horloge qui avance de 6 s à chaque lecture d'état (un rendu long dure 10 s). */
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
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

const CARTE_LISTE: CarteMonteur = { id: "pas-1", debutSec: 4, finSec: 9, disposition: "moitie-haute", modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], description: "Les trois raisons" };

describe("lot E · raccords purs", () => {
  it("passages du monteur → cartes posées : écran partagé → moitié haute, textes → données, `timeline` → `js`", () => {
    const passages = [
      { id: "pas-1", type: "ecran-partage", debutSec: 4, finSec: 9, origine: "consigne", ancre: { debutPriseSec: 6, finPriseSec: 11 }, operation: { type: "ajouterCarte", debutMot: 3, finMot: 9, modele: "liste", textes: CARTE_LISTE.textes, html: null, disposition: "ecran-partage", description: "Les trois raisons", animationGardeeId: null } },
      { id: "pas-2", type: "carte", debutSec: 12, finSec: 16, contenuCle: "facecam/v-fc/cartes/pas-2.json.gz", origine: "consigne", ancre: { debutPriseSec: 14, finPriseSec: 18 }, operation: { type: "ajouterCarte", debutMot: 12, finMot: 16, modele: null, textes: ["30 %"], html: null, disposition: "plein-ecran", description: "un chiffre : 30 % de temps gagné", animationGardeeId: null } },
      { id: "pas-3", type: "zoom", debutSec: 20, finSec: 21, origine: "consigne", ancre: { debutPriseSec: 22, finPriseSec: 23 }, operation: { type: "zoom", debutMot: 20, finMot: 21, style: "punch-in" } },
    ] as unknown as PassageMonteur[];
    const cartes = cartesDesPassages(passages);
    expect(cartes.map((c) => [c.id, c.disposition, c.modele])).toEqual([
      ["pas-1", "moitie-haute", "liste"],
      ["pas-2", "plein-ecran", null],
    ]);
    expect(cartes[1].codeCle).toBe("facecam/v-fc/cartes/pas-2.json.gz");
    const liste = cartePosee(cartes[0]);
    expect(liste?.carte?.modele).toBe("liste");
    const surMesure = cartePosee(cartes[1], { html: "<div class='axion'>30 %</div>", css: ".axion{color:#C65A2E}", timeline: "tl.to('.axion',{opacity:1})" });
    expect(surMesure?.code).toEqual({ html: "<div class='axion'>30 %</div>", css: ".axion{color:#C65A2E}", js: "tl.to('.axion',{opacity:1})" });
    // Sans code (dépôt illisible) : repli sur le modèle fixe le plus proche de la description.
    expect(cartePosee(cartes[1], null)?.carte?.modele).toBe("chiffre");
  });

  it("livraison recopiée dans entrees.facecam : coupes rétablies, passages et consignes écrites gardés, consigne dite ajoutée une fois", () => {
    const entrees = { autre: 1, facecam: { coupes: { auto: [], retablies: ["c-2"] }, passages: [{ id: "pas-1", type: "carte", debutSec: 1, finSec: 4, origine: "consigne" }], consignes: [{ id: "csg-1", origine: "ecrite", texte: "Ajoute une liste", etat: "comprise" }] } };
    const dite = { id: "csg-v1", origine: "voix" as const, texte: "Monteur, zoom ici", dansPriseSec: 12, etat: "comprise" as const };
    const apres = entreesAvecLivraison(entrees, { transcriptionCle: "facecam/v-fc/ver-1/transcription.json.gz", coupes: { auto: [{ id: "c-1", type: "debut", debutSec: 0, finSec: 2 }], retablies: [] }, consignes: [dite] });
    const deux = entreesAvecLivraison(apres, { coupes: { auto: [], retablies: [] }, consignes: [{ ...dite, id: "csg-v2" }] });
    const f = deux.facecam as { coupes: { auto: unknown[]; retablies: string[] }; passages: { id: string; origine?: string }[]; consignes: { id: string }[]; transcriptionCle?: string };
    expect(deux.autre).toBe(1);
    expect(f.coupes.retablies).toEqual(["c-2"]);
    expect(f.passages[0]).toMatchObject({ id: "pas-1", origine: "consigne" });
    expect(f.consignes.map((x) => x.id)).toEqual(["csg-1", "csg-v1"]);
    expect(f.transcriptionCle).toBe("facecam/v-fc/ver-1/transcription.json.gz");
  });
});

describe("lot E · chaîne → monteur → habillage", () => {
  it("les cartes du monteur sont rendues (opération `composition` sans mode), puis la composition finale pré-cadrée 10 bits ; la vidéo livrée est la vidéo habillée", async () => {
    const facecam = creerFacecamSimule();
    const outils = outilsRendu();
    const appels: { mots: number; dureePriseSec: number; coupes: number }[] = [];
    const deps: DependancesChaine = {
      facecam,
      monteur: async ({ entrees, mots, dureePriseSec }) => {
        appels.push({ mots: mots.length, dureePriseSec, coupes: ((entrees.facecam as { coupes: { auto: unknown[] } }).coupes.auto).length });
        return { cartes: [CARTE_LISTE] };
      },
      habillage: outils,
    };
    const etat = await jusquAuBout(deps);
    expect(etat.fini).toBe(true);
    expect(etat.sauts).toEqual([]);
    // Le monteur reçoit les mots de la prise et les coupes calculées (temps du montage justes), une seule fois.
    expect(appels).toHaveLength(1);
    expect(appels[0].mots).toBeGreaterThan(10);
    expect(appels[0].coupes).toBe(etat.coupes!.liste.length);
    // 1. la carte, sans mode ; 2. la composition finale, mode complet.
    const [carte, compo] = outils.soumises;
    expect(carte.operation).toBe("composition");
    expect(carte.parametres).toMatchObject({ composition: expect.stringMatching(/Liste/) });
    expect((carte.parametres as { mode?: string }).mode).toBeUndefined();
    expect(carte.sortie.cle).toBe("facecam/v-fc/ver-1/cartes/pas-1.mp4");
    const p = compo.parametres as unknown as ParametresDemandeComposition & { mode: "complet" };
    expect(p.mode).toBe("complet");
    expect(Object.values(compo.entrees)).toContain("https://r2.exemple/lire/facecam/v-fc/ver-1/cartes/pas-1.mp4");
    // Résultat : la vidéo composée (sous-titres vérifiés), la piste montée reste dans le projet.
    const r = resultatChaine(commande(), etat, false);
    expect(r.sorties[0].fichierCle).toBe(compo.sortie.cle);
    expect(r.sorties[0].rapportQualite.verifie.sousTitres).toBe(true);
    expect((r.projetMontage as { montageCle: string }).montageCle).toMatch(/cadrage/);
    // 11/10 : la vidéo SANS texte est gardée comme piste (les miniatures en sont tirées) .
    etat.habillage!.sortie!.masterCle = "facecam/v-fc/ver-1/master-sans-texte.mov";
    expect(resultatChaine(commande(), etat, false).pistes).toEqual([expect.objectContaining({ type: "master-sans-texte", ratio: "9:16", fichierCle: "facecam/v-fc/ver-1/master-sans-texte.mov" })]);
  });

  it("une carte ratée est retirée de la composition et la vidéo sort quand même (« 1 élément non fait »)", async () => {
    let t = 0;
    const simule = creerServiceRenduSimule(() => (t += 6_000));
    const enPanne: ServiceRendu = {
      soumettre: (d) => simule.soumettre(d),
      etat: async (id): Promise<EtatRendu> => (id.includes("cartes") ? { statut: "echec", erreur: { code: "inconnu", reessayable: false, message: "Panne simulée." } } : simule.etat(id)),
    };
    const outils = outilsRendu(enPanne);
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [CARTE_LISTE] }), habillage: outils });
    expect(etat.fini).toBe(true);
    const cartes = etat.habillage!.cartes;
    expect(cartes.length).toBeGreaterThan(0);
    expect(cartes.every((c) => c.statut === "echec")).toBe(true);
    expect(etat.sauts.map((s) => s.brique)).toContain("Une carte");
    expect(etat.habillage!.base.supplements?.ecransPartages ?? []).toEqual([]);
    expect(etat.habillage!.sortie?.fichierCle).toBeTruthy();
  });

  it("composition en panne définitive : la piste montée est livrée sans habillage (« 1 élément non fait »)", async () => {
    const outils = outilsRendu({ soumettre: async (d) => ({ idRendu: d.idRendu }), etat: async () => ({ statut: "echec", erreur: { code: "refuse", reessayable: false, message: "Refus simulé." } }) });
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils });
    expect(etat.fini).toBe(true);
    expect(etat.habillage?.abandonne).toBe(true);
    expect(etat.sauts.map((s) => s.brique)).toContain("Les sous-titres et cartes");
    expect(resultatChaine(commande(), etat, false).sorties[0].fichierCle).toMatch(/cadrage/);
  });

  it("monteur en panne : la vidéo est montée sans les consignes, jamais bloquée", async () => {
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur: async () => Promise.reject(new Error("Claude indisponible")) });
    expect(etat.fini).toBe(true);
    expect(etat.sauts.map((s) => s.brique)).toEqual(["Le monteur"]);
  });
});

describe("lot E · Décor IA (coupé par défaut)", () => {
  it("option coupée : étape absente du moteur, le Décor n'est jamais appelé ni attendu", async () => {
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam: creerFacecamSimule() }) });
    expect(moteur.etapes(commande()).some((e) => e.cle === "decor")).toBe(false);
    expect(moteur.etapes(commande({ facecamDecorIa: true })).find((e) => e.cle === "decor")).toMatchObject({ nom: "Le décor", dependDe: ["etalonnage"] });
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), decor: async () => null });
    expect(etat.fini).toBe(true);
    expect(etat.decor).toEqual({ statut: "ignore" });
  });

  it("décor appliqué : son plan part au cadrage ; repli : la vidéo garde son vrai décor (« 1 élément non fait »)", async () => {
    const facecam = creerFacecamSimule();
    const plan = { morceaux: [{ source: "decor", cle: "facecam/v-fc/decor/0.mp4" }], audio: "origine", ips: 25, zoomMax: 1.1 };
    const etat = await jusquAuBout({ facecam, decor: async () => ({ applique: true, message: "Décor IA appliqué.", plan }) });
    expect(etat.fini).toBe(true);
    const cadrage = facecam.soumises.find((s) => s.demande.parametres?.etape === "cadrage")!.demande;
    // Lot G : le plan reçoit la fenêtre 9:16 du décor (le cadrage y relit les morceaux retouchés).
    expect(cadrage.parametres?.decor).toEqual({ ...plan, fenetre: expect.objectContaining({ largeur: 1214, hauteur: 2160 }) });
    const repli = await jusquAuBout({ facecam: creerFacecamSimule(), decor: async () => ({ applique: false, message: "Décor non réussi : la vidéo est livrée avec son vrai décor." }) });
    expect(repli.fini).toBe(true);
    expect(repli.sauts.map((s) => s.brique)).toEqual(["Le décor"]);
  });

  it("moteur : l'étape « Le décor » suit l'état de la chaîne, puis tout est fait", async () => {
    const c = commande({ facecamDecorIa: true });
    const facecam = creerFacecamSimule();
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam, decor: async () => null }) });
    let travail: Travail = await moteur.lancer(c, { travailId: "t-4", versionId: "ver-4", titre: "Essai" });
    for (let i = 0; i < 40 && travail.statut !== "termine"; i++) ({ travail } = await moteur.avancer(travail, c, Date.now()));
    expect(travail.statut).toBe("termine");
    expect(travail.etapes.find((e) => e.cle === "decor")?.statut).toBe("terminee");
  });
});

describe("lot E · branchements des services et réel coupé par défaut", () => {
  it("les services branchés passent dans les dépendances réelles ; sans réglage caché, jamais de réel", () => {
    const avant = servicesFacecam();
    try {
      const monteur = async () => ({ cartes: [] });
      brancherServicesFacecam({ monteur: () => monteur, decor: () => async () => null });
      const env = { STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" };
      expect(dependancesChaineParDefaut(commande(), env)).toBeNull();
      const reel = dependancesChaineParDefaut(commande({ facecamAligneurReel: true }), env)!;
      expect(reel.monteur).toBe(monteur);
      // Décor seulement si la commande l'a demandé ; habillage seulement si studio-rendu est réel.
      expect(reel.decor).toBeUndefined();
      expect(reel.habillage).toBeUndefined();
      const complet = dependancesChaineParDefaut(commande({ facecamAligneurReel: true, facecamDecorIa: true }), { ...env, STUDIO_RENDU_URL: "http://studio-rendu:4100", STUDIO_RENDU_CLE: "cle-essai" })!;
      expect(complet.decor).toBeTypeOf("function");
      expect(complet.habillage?.recette.id).toBe("facecam");
    } finally {
      brancherServicesFacecam({ monteur: avant.monteur, decor: avant.decor, relire: avant.relire });
    }
  });

  it("le lancement réel reste refusé tant que la chaîne n'est pas demandée (refusAuLancement gardé)", () => {
    expect(creerMoteurMontageFacecam().refusAuLancement?.(commande())?.code).toBe("FACECAM_EN_CHANTIER");
  });
});

describe("lot E · style des cartes (lot C2)", () => {
  it("demande de Will ou vidéo « très dynamique » → Spectaculaire ; sinon Sobre (aucun style posé)", () => {
    expect(cartePosee(CARTE_LISTE)?.style).toBeUndefined();
    expect(cartePosee({ ...CARTE_LISTE, description: "Les trois raisons, en plus spectaculaire" })?.style).toBe("spectaculaire");
    expect(cartePosee(CARTE_LISTE, null, "tres-dynamique")?.style).toBe("spectaculaire");
  });
});
