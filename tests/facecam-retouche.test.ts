/**
 * PLAN FACECAM v4 — LOT G « Usage réel » : la retouche RÉELLE ne relance que les étapes que la consigne touche, en
 * réutilisant ce qui est déjà fait (transcription, visages, son, passe image 10 bits, cartes rendues) ; la relecture
 * ciblée applique 1 correction au plus, jamais de seconde relecture ; le plafond du monteur sort la version simple.
 * Doubles de simulation du studio-aligneur et de studio-rendu : aucun réseau, aucun appel Claude.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { resultatChaine } from "@/moteurs/montage-facecam/etapes-chaine";
import { creerMoteurMontageFacecam } from "@/moteurs/montage-facecam";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import { empreinte, etapesRetouche, partiesARefaire, signatureMontage } from "@/moteurs/montage-facecam/retouche";
import { appliquerRelecture, instantsDeControle } from "@/moteurs/montage-facecam/relecture";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import { heurePrete } from "@/domaine/facecam-parcours";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

const LISTE = { id: "pas-1", type: "ecran-partage", debutSec: 4, finSec: 9, origine: "demande", ancre: { debutPriseSec: 4, finPriseSec: 9 }, operation: { type: "ajouterCarte", debutMot: 8, finMot: 18, modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], html: null, disposition: "ecran-partage", description: "Les trois raisons", animationGardeeId: null } };
const CHIFFRE = { id: "pas-2", type: "carte", debutSec: 12, finSec: 16, origine: "demande", ancre: { debutPriseSec: 12, finPriseSec: 16 }, operation: { type: "ajouterCarte", debutMot: 25, finMot: 32, modele: "chiffre", textes: ["30 %", "de temps gagné"], html: null, disposition: "plein-ecran", description: "30 % de temps gagné", animationGardeeId: null } };

function commande(facecam: Record<string, unknown> = {}, monteur?: Record<string, unknown>): CommandeFabrication {
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
    entrees: { facecam: { passages: [LISTE], ...facecam }, ...(monteur ? { facecamMonteur: monteur } : {}) },
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
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

/** Les doubles « réels » (mode reel) : la chaîne les prend comme le vrai studio-aligneur. */
function dependances(options: { relire?: DependancesChaine["relire"] } = {}) {
  const facecam = creerFacecamSimule();
  const reel: DependancesChaine["facecam"] = { ...facecam, mode: "reel", soumettre: (route, d) => facecam.soumettre(route, route === "transcrire" ? { ...d, parametres: { ...d.parametres, texte: TEXTE } } : d) };
  const outils = outilsRendu();
  const deps: DependancesChaine = {
    facecam: reel,
    habillage: outils,
    // La transcription est relue sur R2 à la retouche (la reprise ne garde pas les mots en ligne).
    lireJsonGz: async (cle) => (cle.includes("transcription") ? { mots: TEXTE.split(/\s+/).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 })) } : null),
    monteur: async ({ entrees }) => ({ cartes: cartesDesPassages(((entrees.facecam as { passages: PassageMonteur[] }).passages ?? []) as PassageMonteur[]), entrees: { facecam: entrees.facecam } }),
    ...(options.relire ? { relire: options.relire } : {}),
  };
  return { facecam, outils, deps };
}

/** Fabrication complète (la version 1), via le moteur. */
async function fabriquer(deps: DependancesChaine, c = commande()) {
  const moteur = creerMoteurMontageFacecam({ chaine: () => deps });
  let travail: Travail = await moteur.lancer(c, { travailId: "t-1", versionId: "ver-1", titre: "Essai", maintenant: 0 });
  let resultat;
  for (let i = 0; i < 80 && !resultat; i++) ({ travail, resultat } = await moteur.avancer(travail, c, 1_000 * i));
  expect(resultat).toBeTruthy();
  return { moteur, resultat: resultat!, travail };
}

/** Retouche (la version 2) depuis le résultat de la version 1. */
async function retoucher(moteur: ReturnType<typeof creerMoteurMontageFacecam>, c: CommandeFabrication, projetMontage: Record<string, unknown>, travailId = "t-2") {
  let travail: Travail = await moteur.retoucher({ commande: c, contexte: { travailId, versionId: "ver-2", titre: "Retouche", maintenant: Date.parse("2026-10-09T12:00:00Z") }, planIds: [], consigne: "essai", parent: { versionId: "ver-1", projetMontage, pistes: [] } });
  const debut = travail;
  let resultat;
  for (let i = 0; i < 80 && !resultat; i++) ({ travail, resultat } = await moteur.avancer(travail, c, 1_000 * i));
  expect(resultat).toBeTruthy();
  return { debut, travail, resultat: resultat! };
}

const routes = (soumises: { route: string; demande: { idTravail: string; parametres?: Record<string, unknown> } }[], depuis: number) =>
  soumises.slice(depuis).map((s) => `${s.route}${s.demande.parametres?.etape ? `:${s.demande.parametres.etape}` : ""}`);

describe("lot G · retouche réelle : seules les étapes touchées repartent", () => {
  it("le moteur sait retoucher (capacité) et refuse sans la chaîne réelle (jamais une vidéo d'essai à la place de la vraie)", () => {
    const sans = creerMoteurMontageFacecam({ chaine: () => null });
    expect(sans.capacites.retoucheParPlan).toBe(true);
    expect(sans.refusRetouche?.(commande())).toMatchObject({ code: "RETOUCHE_INDISPONIBLE" });
    expect(creerMoteurMontageFacecam({ chaine: () => dependances().deps }).refusRetouche?.(commande())).toBeNull();
  });

  it("la version finie garde ses entrées et sa reprise (clés, petits résultats, sans les mots en ligne)", async () => {
    const { deps } = dependances();
    const { resultat } = await fabriquer(deps);
    const projet = resultat.projetMontage as { entrees: { facecam: { passages: unknown[]; coupes: { auto: unknown[] } } }; reprise: { travaux: Record<string, { resultat?: { mots?: unknown } }>; cartes: unknown[]; signature: unknown } };
    expect(projet.entrees.facecam.passages).toHaveLength(1);
    expect(Array.isArray(projet.entrees.facecam.coupes.auto)).toBe(true);
    expect(Object.keys(projet.reprise.travaux).sort()).toEqual(["cadrage", "passe", "son", "transcrire", "visages"]);
    expect(projet.reprise.travaux.transcrire.resultat?.mots).toBeUndefined();
    expect(projet.reprise.cartes).toHaveLength(1);
  });

  it("couper / rétablir → son monté, piste montée et habillage seulement (ni transcription, ni visages, ni passe image)", async () => {
    const { deps, facecam, outils } = dependances();
    const { moteur, resultat } = await fabriquer(deps);
    const projet = resultat.projetMontage as { entrees: { facecam: Record<string, unknown> } };
    const n = facecam.soumises.length;
    const r = outils.soumises.length;
    // « Coupe ce passage » (fil) : une coupe demandée dans la prise (rétablir suit le même chemin).
    const c2 = commande(projet.entrees.facecam, { coupesDemandees: [{ id: "cpd-1", debutSec: 30, finSec: 33 }] });
    const { debut, travail } = await retoucher(moteur, c2, resultat.projetMontage);
    expect(debut.parametres?.refaire).toEqual(expect.arrayContaining(["assemblage", "habillage"]));
    expect(debut.parametres?.refaire).not.toContain("image");
    expect(routes(facecam.soumises, n)).toEqual(["son", "image:cadrage"]);
    // Le son est monté sans le passage coupé ; les nouveaux travaux portent l'identifiant de la retouche.
    expect((facecam.soumises[n].demande.parametres?.gardes as { debutSec: number; finSec: number }[]).some((g) => g.debutSec < 31 && g.finSec > 31)).toBe(false);
    expect(facecam.soumises.slice(n).every((s) => s.demande.idTravail.startsWith("t-2-"))).toBe(true);
    expect(travail.statut).toBe("termine");
    // Habillage : la composition repart ; la carte, identique, n'est pas rendue une seconde fois.
    const nouvelles = outils.soumises.slice(r);
    expect(nouvelles.filter((d) => (d.parametres as { mode?: string }).mode === "complet")).toHaveLength(1);
    expect(nouvelles.filter((d) => !(d.parametres as { mode?: string }).mode)).toHaveLength(0);
  });

  it("image (3 crans) → seulement la passe image, puis le cadrage et l'habillage", async () => {
    const { deps, facecam } = dependances();
    const { moteur, resultat } = await fabriquer(deps);
    const projet = resultat.projetMontage as { entrees: { facecam: Record<string, unknown> } };
    const n = facecam.soumises.length;
    const c2 = commande({ ...projet.entrees.facecam, image: { lumiere: "plus", couleurs: "juste", mine: "juste", dents: "juste" } });
    const { debut } = await retoucher(moteur, c2, resultat.projetMontage);
    expect(debut.parametres?.refaire).toEqual(["habillage", "image"]);
    expect(routes(facecam.soumises, n)).toEqual(["image:passe", "image:cadrage"]);
    expect(facecam.soumises[n].demande.parametres?.image).toMatchObject({ lumiere: "plus" });
  });

  it("teinte demandée (« plus chaud ») → passe image avec la teinte ; son plus fort → son monté seul (avec cadrage)", async () => {
    const { deps, facecam } = dependances();
    const { moteur, resultat } = await fabriquer(deps);
    const projet = resultat.projetMontage as { entrees: { facecam: Record<string, unknown> } };
    let n = facecam.soumises.length;
    await retoucher(moteur, commande(projet.entrees.facecam, { teinte: "plus-chaud" }), resultat.projetMontage);
    expect(routes(facecam.soumises, n)).toEqual(["image:passe", "image:cadrage"]);
    expect(facecam.soumises[n].demande.parametres?.teinte).toBe("plus-chaud");
    n = facecam.soumises.length;
    await retoucher(moteur, commande(projet.entrees.facecam, { son: { nettoyer: true, musique: null, volume: "plus-fort", bruitages: [] } }), resultat.projetMontage, "t-3");
    expect(routes(facecam.soumises, n)).toEqual(["son", "image:cadrage"]);
    expect(facecam.soumises[n].demande.parametres?.voix).toEqual({ nettoyer: true, volume: "plus-fort" });
  });

  it("carte ajoutée (fil, feuille Cartes) → l'habillage SEUL : aucune étape du studio-aligneur, seule la nouvelle carte est rendue", async () => {
    const { deps, facecam, outils } = dependances();
    const { moteur, resultat } = await fabriquer(deps);
    const projet = resultat.projetMontage as { entrees: { facecam: { passages: unknown[] } } };
    const n = facecam.soumises.length;
    const r = outils.soumises.length;
    const { debut, travail } = await retoucher(moteur, commande({ ...projet.entrees.facecam, passages: [LISTE, CHIFFRE] }), resultat.projetMontage);
    expect(debut.parametres?.refaire).toEqual(["habillage"]);
    expect(debut.etapes.map((e) => e.cle)).toEqual(["sous-titres", "export"]);
    expect(routes(facecam.soumises, n)).toEqual([]);
    const cartes = outils.soumises.slice(r).filter((d) => !(d.parametres as { mode?: string }).mode);
    expect(cartes.map((d) => d.sortie.cle)).toEqual(["facecam/v-fc/ver-2/cartes/pas-2.mp4"]);
    // La carte reprise est lue à sa clé d'origine (version 1) par la composition.
    const compo = outils.soumises.slice(r).find((d) => (d.parametres as { mode?: string }).mode === "complet")!;
    expect(Object.values(compo.entrees)).toContain("https://r2.exemple/lire/facecam/v-fc/ver-1/cartes/pas-1.mp4");
    expect(travail.statut).toBe("termine");
  });

  it("élément retiré, consigne annulée, style ou sous-titres → l'habillage seul, sans aucune carte rendue", async () => {
    const { deps, facecam, outils } = dependances();
    const { moteur, resultat } = await fabriquer(deps);
    const projet = resultat.projetMontage as { entrees: { facecam: Record<string, unknown> } };
    const n = facecam.soumises.length;
    const r = outils.soumises.length;
    const { debut } = await retoucher(moteur, commande({ ...projet.entrees.facecam, passages: [] }), resultat.projetMontage);
    expect(debut.parametres?.refaire).toEqual(["habillage"]);
    expect(routes(facecam.soumises, n)).toEqual([]);
    expect(outils.soumises.slice(r).filter((d) => !(d.parametres as { mode?: string }).mode)).toHaveLength(0);
  });

  it("sous-titres corrigés (onglet Sous-titres, « Appliquer à la vidéo ») → l'habillage seul, avec ces groupes", async () => {
    const { deps, facecam, outils } = dependances();
    const { moteur, resultat } = await fabriquer(deps);
    expect(resultat.sousTitres?.length).toBeGreaterThan(0);
    const corriges = resultat.sousTitres!.map((g, i) => (i === 0 ? { ...g, mots: g.mots.map((m, j) => (j === 0 ? { ...m, mot: "Bonjour !" } : m)) } : g));
    const n = facecam.soumises.length;
    const r = outils.soumises.length;
    const c = commande((resultat.projetMontage as { entrees: { facecam: Record<string, unknown> } }).entrees.facecam);
    let travail: Travail = await moteur.recalquer!({ commande: c, contexte: { travailId: "t-st", versionId: "ver-2", titre: "Sous-titres" }, sousTitresId: "st-2", segments: corriges, parent: { versionId: "ver-1", projetMontage: resultat.projetMontage, pistes: [] } });
    expect(travail.type).toBe("recalque-sous-titres");
    let fin;
    for (let i = 0; i < 60 && !fin; i++) ({ travail, resultat: fin } = await moteur.avancer(travail, c, i * 1000));
    expect(routes(facecam.soumises, n)).toEqual([]);
    expect(outils.soumises.slice(r).filter((d) => !(d.parametres as { mode?: string }).mode)).toHaveLength(0);
    expect(fin!.sousTitres![0].mots[0].mot).toBe("Bonjour !");
  });

  it("temps estimé clair : la retouche d'une carte finit bien avant celle de l'image (« Prête vers … »)", () => {
    const carte = etapesRetouche(new Set(["habillage"]), 90, 1).reduce((t, e) => t + e.dureeEstimeeSec, 0);
    const image = etapesRetouche(new Set(["habillage", "image"]), 90, 0).reduce((t, e) => t + e.dureeEstimeeSec, 0);
    expect(carte).toBeLessThan(image);
    expect(image).toBeGreaterThan(9 * 90);
    expect(heurePrete(new Date(Date.parse("2026-10-09T12:00:00Z") + carte * 1000).toISOString(), Date.parse("2026-10-09T12:00:00Z"))).toMatch(/^Prête vers 14 h \d{2}$/);
  });

  it("parties à refaire : coupes → assemblage ; crans → image ; passages → habillage seul ; rien d'avant → tout", () => {
    const a = signatureMontage(commande().entrees);
    expect([...partiesARefaire(a, signatureMontage(commande().entrees))]).toEqual(["habillage"]);
    expect([...partiesARefaire(a, signatureMontage(commande({ passages: [] }).entrees))]).toEqual(["habillage"]);
    expect(partiesARefaire(a, signatureMontage(commande({ coupes: { auto: [{ id: "c", type: "debut", debutSec: 0, finSec: 2 }], retablies: [] } }).entrees)).has("assemblage")).toBe(true);
    expect(partiesARefaire(undefined, a).size).toBe(4);
    expect(empreinte("abc")).toBe(empreinte("abc"));
    expect(empreinte("abc")).not.toBe(empreinte("abd"));
  });
});

describe("lot G · relecture ciblée appliquée", () => {
  it("instants : 3 premières secondes, chaque carte et écran partagé, chaque raccord, la dernière image", () => {
    const i = instantsDeControle({ dureeSec: 30, raccordsSec: [5, 12], cartes: [{ id: "pas-1", debutSec: 4, finSec: 9, ecranPartage: true }] });
    expect(i.map((x) => x.legende)).toEqual(["Début de la vidéo (0,5 s)", "Début de la vidéo (1,5 s)", "Début de la vidéo (2,5 s)", "Raccord 1 à 0:05", "Écran partagé à 0:04", "Raccord 2 à 0:12", "Dernière image"]);
    expect(i.find((x) => x.elementId === "pas-1")?.instantSec).toBe(6.5);
    expect(instantsDeControle({ dureeSec: 300, raccordsSec: Array.from({ length: 80 }, (_, k) => 3 + k * 3.5), cartes: [] }).length).toBeLessThanOrEqual(24);
  });

  it("UN appel, la correction (1 au plus) est appliquée par la retouche dans le même travail, jamais de seconde relecture", async () => {
    const relire = vi.fn<NonNullable<DependancesChaine["relire"]>>(async ({ entrees, images }) => {
      expect(images.length).toBeGreaterThan(3);
      expect(images.some((x) => x.elementId === "pas-1")).toBe(true);
      return appliquerRelecture(entrees, { ok: false, defauts: [{ elementId: "pas-1", defaut: "texte-deborde", detail: "Le texte sort de la carte." }], corrections: [{ type: "retirer", passageId: "pas-1" }, { type: "retirer", passageId: "pas-1" }] }, { mots: [], dureePriseSec: 60, nouvelId: (p) => `${p}-x` });
    });
    const { deps, facecam, outils } = dependances({ relire });
    const { resultat } = await fabriquer(deps);
    expect(relire).toHaveBeenCalledTimes(1);
    // Images extraites de la vidéo FINIE (composée), puis seulement l'habillage refait (aucune étape du studio-aligneur).
    const ordre = routes(facecam.soumises, 0);
    expect(ordre).toEqual(["transcrire", "visages", "son", "image:passe", "image:cadrage", "image:images"]);
    expect(outils.soumises.filter((d) => (d.parametres as { mode?: string }).mode === "complet")).toHaveLength(2);
    const projet = resultat.projetMontage as { entrees: { facecam: { passages: unknown[] } }; relecture: { correction: string } };
    expect(projet.entrees.facecam.passages).toEqual([]);
    expect(projet.relecture.correction).toBe("Élément retiré après relecture");
  });

  it("relecture sans défaut, ou plafond atteint : rien n'est refait ; en retouche, jamais de relecture", async () => {
    const relire = vi.fn<NonNullable<DependancesChaine["relire"]>>(async () => ({ defauts: [] }));
    const { deps, facecam } = dependances({ relire });
    const { moteur, resultat } = await fabriquer(deps);
    expect(relire).toHaveBeenCalledTimes(1);
    const n = facecam.soumises.length;
    await retoucher(moteur, commande({ ...(resultat.projetMontage as { entrees: { facecam: Record<string, unknown> } }).entrees.facecam, passages: [] }), resultat.projetMontage);
    expect(relire).toHaveBeenCalledTimes(1);
    expect(routes(facecam.soumises, n)).toEqual([]);
    const simple = dependances({ relire });
    await fabriquer(simple.deps, { ...commande(), plafondClaudeAtteint: true } as CommandeFabrication);
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it("une relecture inutilisable ou une correction inapplicable n'empêche jamais la livraison", () => {
    const entrees = commande().entrees as Record<string, unknown>;
    expect(appliquerRelecture(entrees, null, { mots: [], dureePriseSec: 60, nouvelId: (p) => p }).entrees).toBeUndefined();
    expect(appliquerRelecture(entrees, { ok: false, defauts: [], corrections: [{ type: "retirer", passageId: "inconnu" }] }, { mots: [], dureePriseSec: 60, nouvelId: (p) => p }).entrees).toBeUndefined();
    // Un effet de détourage n'est jamais décidé par la relecture.
    expect(appliquerRelecture(entrees, { ok: false, defauts: [], corrections: [{ type: "masquerPersonne", debutMot: 0, finMot: 2 }] }, { mots: [], dureePriseSec: 60, nouvelId: (p) => p }).entrees).toBeUndefined();
  });
});

describe("lot G · l'état de la chaîne garde la reprise petite", () => {
  it("la reprise n'embarque ni mots ni code de carte", async () => {
    const { deps } = dependances();
    let etat: EtatChaine = etatChaineInitial();
    for (let i = 0; i < 60 && !etat.fini; i++) etat = await avancerChaine(etat, commande(), { travailId: "t-1", versionId: "ver-1" }, deps);
    const r = resultatChaine(commande(), etat, false);
    expect(JSON.stringify((r.projetMontage as { reprise: unknown }).reprise).length).toBeLessThan(20_000);
  });
});
