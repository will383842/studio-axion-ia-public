/**
 * C2-U13 : migration 25, cinq styles de texte à l'écran (dont « Pastille Axion »), INACTIVE tant que
 * `STYLES_TEXTE_ECRAN_INSTALLES` vaut `false`. Phrase de référence écrite ici, aucune voix. Aucune dépense.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", async (original) => ({ ...(await original<typeof import("@/services/auth")>()), exigerSession: async () => ({ id: "s-essai" }) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const donnees = await import("@/donnees/styles-texte-ecran");
const { etape25StylesTexteEcran } = await import("@/services/migrations/etape-25-styles-texte-ecran");
const { migrerDonnees } = await import("@/services/migrations");
const { seConnecter } = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const sousTitres = await import("@/briques/sous-titres");
const { controlerSousTitres, donneesCalque } = sousTitres;
const { modifierValeurAction } = await import("@/app/(studio)/bibliotheque/actions");
const { sceneAuTemps } = await import("@/briques/sous-titres/scene");
const { STYLE_SOUS_TITRES_AVOCAT, STYLE_SOUS_TITRES_MINIMAL } = await import("@/donnees/elements-avocat");

const T1 = "2026-11-17T08:00:00.000Z";
const T0 = Date.UTC(2026, 10, 17, 9, 0, 0);
const T2 = "2026-11-17T09:00:00.000Z";
const IDS = ["st-axion-surligne-v1", "st-axion-pave-v1", "st-axion-outils-v1", "st-axion-varie-v1", "st-pastille-axion-v1"];

beforeEach(() => reinitialiserDepots());

const instantane = async () => {
  const d = depots();
  return JSON.stringify({ e: await d.elements.lister(), p: await d.parametres.lister(), v: await d.videos.lister() });
};

describe("C2-U13 · constante et données", () => {
  it("la constante est vraie dans le code (allumée le 17/11 sur geste de Williams, seul `true` allume)", () => {
    // MISE À JOUR DE RÉFÉRENCE VOLONTAIRE (17/11, fiche ALLUME-STYLES-TEXTE-ECRAN, décision écrite de Williams) : `false` → `true`.
    expect(donnees.STYLES_TEXTE_ECRAN_INSTALLES).toBe(true);
  });

  it("cinq éléments « style-sous-titres », ids stables, aucun défaut de format, licence de propriété", () => {
    const els = donnees.elementsStylesTexteEcran(T1);
    expect(els.map((e) => e.id)).toEqual(IDS);
    expect(els.map((e) => e.nom)).toEqual(["Axion surligné", "Axion pavé", "Axion outils", "Axion varié", "Pastille Axion"]);
    for (const e of els) {
      expect(e.type).toBe("style-sous-titres");
      expect(e.valeur.type).toBe("style-sous-titres");
      expect(e.formatsParDefaut).toEqual([]);
      expect(e.licence).toMatchObject({ type: "propriete", usageCommercial: true });
      expect(e.creeLe).toBe(T1);
    }
  });

  it("réglages de texte à l'écran de chaque style", () => {
    const v = Object.fromEntries(donnees.elementsStylesTexteEcran(T1).map((e) => [e.id, e.valeur as import("@/domaine/types").ValeurStyleSousTitres]));
    expect(v["st-axion-surligne-v1"]).toMatchObject({ gabarit: "karaoke", texteEcran: { marqueur: { teinte: "terracotta", cible: "expression" } } });
    expect(v["st-axion-pave-v1"]).toMatchObject({ gabarit: "karaoke", texteEcran: { pave: { mots: "forts-et-chiffres" } } });
    expect(v["st-axion-outils-v1"]).toMatchObject({ gabarit: "minimal", texteEcran: { outils: "etiquette" } });
    expect(v["st-axion-varie-v1"]).toMatchObject({ gabarit: "karaoke", texteEcran: { varier: true } });
    expect(v["st-pastille-axion-v1"].pastille).toBe("axion");
    expect(v["st-pastille-axion-v1"].texteEcran).toBeUndefined();
  });

  it("chaque style se dessine sans débordement (9:16, 4:5, 16:9) et sans lever", () => {
    const phrase = "Vos mails perso sur Gmail : 3 clients ont tout perdu en 2026";
    const { fabriquerSousTitres } = sousTitres;
    for (const e of donnees.elementsStylesTexteEcran(T1)) {
      const style = e.valeur as import("@/domaine/types").ValeurStyleSousTitres;
      for (const ratio of ["9:16", "4:5", "16:9"] as const) {
        const base = style.gabarit === "minimal" ? ("minimal" as const) : ("karaoke" as const);
        const segments = fabriquerSousTitres({ texte: phrase, dureeSec: 8, style, base, ratio, emphase: ["Gmail", "clients"] });
        expect(segments.length).toBeGreaterThan(0);
        const d = donneesCalque({ segments, base, ratio, style });
        const debord = (x: typeof d) => controlerSousTitres(x).filter((a) => a.code === "debordement-sous-titres").length;
        if (ratio === "16:9") {
          // Le 16:9 déborde déjà avec les styles de base (70 px nominaux) : ces styles ne font pas pire qu'eux.
          const b = style.gabarit === "minimal" ? STYLE_SOUS_TITRES_MINIMAL : STYLE_SOUS_TITRES_AVOCAT;
          const sb = fabriquerSousTitres({ texte: phrase, dureeSec: 8, style: b, base, ratio, emphase: ["Gmail", "clients"] });
          expect(debord(d), `${e.id} ${ratio}`).toBeLessThanOrEqual(debord(donneesCalque({ segments: sb, base, ratio, style: b })));
        } else expect(debord(d), `${e.id} ${ratio}`).toBe(0);
        expect(sceneAuTemps(d, segments[0].debutSec + 0.2)).not.toBeNull();
        if (e.id === "st-pastille-axion-v1") expect(d.pastille).toBeDefined();
      }
    }
  });
});

describe("C2-U13 · migration 25", () => {
  // MISE À JOUR DE RÉFÉRENCE VOLONTAIRE (17/11, amendement du pilote 18/11 00:25) : la constante réelle est maintenant `true`.
  // La garde « installés ≠ true → rien » est GARDÉE intacte, mais par un paramètre explicite (`false`) et non plus par la vraie constante.
  it("garde : installés = false (paramètre explicite) rend null et n'écrit rien", async () => {
    const avant = await instantane();
    expect(await etape25StylesTexteEcran(depots(), T1, false)).toBeNull();
    expect(await instantane()).toBe(avant);
  });

  it("constante vraie (le vrai code, sans 3ᵉ argument) : installe les cinq styles ; second passage : null", async () => {
    expect(await etape25StylesTexteEcran(depots(), T1)).toEqual({ stylesAjoutes: IDS });
    const apres = await instantane();
    expect(await etape25StylesTexteEcran(depots(), T2)).toBeNull();
    expect(await instantane()).toBe(apres);
  });

  it("seul `true` strict allume (valeurs « vraies » d'un autre type : rien)", async () => {
    const avant = await instantane();
    for (const v of [1, "true", {}, [], null] as unknown[]) expect(await etape25StylesTexteEcran(depots(), T1, v as boolean)).toBeNull();
    expect(await instantane()).toBe(avant);
  });

  it("constante vraie (simulée) : cinq éléments ; second passage : null", async () => {
    const n = (await depots().elements.lister()).length;
    expect(await etape25StylesTexteEcran(depots(), T1, true)).toEqual({ stylesAjoutes: IDS });
    expect((await depots().elements.lister()).length).toBe(n + 5);
    for (const id of IDS) expect(await depots().elements.obtenir(id)).toBeTruthy();
    const apres = await instantane();
    expect(await etape25StylesTexteEcran(depots(), T2, true)).toBeNull();
    expect(await instantane()).toBe(apres);
  });

  it("n'écrit jamais sur un élément existant (renommé, réglé ou rangé par Williams)", async () => {
    await etape25StylesTexteEcran(depots(), T1, true);
    await depots().elements.modifier(IDS[0], { nom: "Mon surligné", archiveLe: T1 });
    await depots().elements.supprimer(IDS[1]);
    expect(await etape25StylesTexteEcran(depots(), T2, true)).toEqual({ stylesAjoutes: [IDS[1]] });
    expect(await depots().elements.obtenir(IDS[0])).toMatchObject({ nom: "Mon surligné", archiveLe: T1 });
  });

  it("n'ajoute aucune vidéo, aucun fichier, aucun réglage ; les éléments existants ne bougent pas", async () => {
    const d = depots();
    const avant = { v: JSON.stringify(await d.videos.lister()), f: JSON.stringify(await d.fichiers.lister()), p: JSON.stringify(await d.parametres.lister()), e: JSON.stringify(await d.elements.lister()) };
    await etape25StylesTexteEcran(d, T1, true);
    expect(JSON.stringify(await d.videos.lister())).toBe(avant.v);
    expect(JSON.stringify(await d.fichiers.lister())).toBe(avant.f);
    expect(JSON.stringify(await d.parametres.lister())).toBe(avant.p);
    const apres = (await d.elements.lister()).filter((e) => !IDS.includes(e.id));
    expect(JSON.stringify(apres)).toBe(avant.e);
  });

  it("aucun des cinq n'est le style par défaut d'un format (rien ne change pour les vidéos existantes)", async () => {
    await etape25StylesTexteEcran(depots(), T1, true);
    for (const e of await depots().elements.lister((x) => IDS.includes(x.id))) expect(e.formatsParDefaut).toEqual([]);
    // Les défauts d'avant sont identiques : les styles par défaut d'un format restent les mêmes éléments.
    const parDefaut = (await depots().elements.lister((x) => x.type === "style-sous-titres" && x.formatsParDefaut.length > 0)).map((e) => e.id).sort();
    reinitialiserDepots();
    const reference = (await depots().elements.lister((x) => x.type === "style-sous-titres" && x.formatsParDefaut.length > 0)).map((e) => e.id).sort();
    expect(parDefaut).toEqual(reference);
  });
});

describe("C2-U13 · migrerDonnees (démarrage)", () => {
  // MISE À JOUR DE RÉFÉRENCE VOLONTAIRE (17/11, amendement du pilote) : « éteinte : rien installé » devient « allumée : installé au démarrage, idempotent ».
  it("allumée : le démarrage installe les cinq styles, un second démarrage est identique (idempotent)", async () => {
    const r1 = await migrerDonnees(depots(), T1);
    for (const id of IDS) expect(await depots().elements.obtenir(id)).toBeTruthy();
    expect(r1.lots?.["styles-texte-ecran"]).toEqual({ stylesAjoutes: IDS });
    const avant = await instantane();
    const r2 = await migrerDonnees(depots(), T2);
    expect(r2.lots?.["styles-texte-ecran"]).toBeUndefined();
    expect(await instantane()).toBe(avant);
  });

  it("aucun style existant ne change : même liste de styles par défaut de format avant/après le démarrage", async () => {
    const parDefaut = async () => (await depots().elements.lister((x) => x.type === "style-sous-titres" && x.formatsParDefaut.length > 0)).map((e) => `${e.id}:${e.formatsParDefaut.join(",")}`).sort();
    const avant = await parDefaut();
    await migrerDonnees(depots(), T1);
    expect(await parDefaut()).toEqual(avant);
  });
});

describe("C2-U13 · aller-retour par l'action de la Bibliothèque (A2-12)", () => {
  it("modifierValeurAction réécrit le texte à l'écran d'un style installé, puis le rétablit à l'identique", async () => {
    await etape25StylesTexteEcran(depots(), T1, true);
    const id = "st-axion-surligne-v1";
    const origine = (await depots().elements.obtenir(id))!.valeur as import("@/domaine/types").ValeurStyleSousTitres;
    const change = { ...origine, texteEcran: { marqueur: { teinte: "ardoise" as const, cible: "mot-dit" as const } } };
    expect((await modifierValeurAction(id, change)).ok).toBe(true);
    expect((await depots().elements.obtenir(id))!.valeur).toEqual(change);
    expect((await modifierValeurAction(id, origine)).ok).toBe(true);
    expect((await depots().elements.obtenir(id))!.valeur).toEqual(donnees.elementsStylesTexteEcran(T1)[0].valeur);
    // Un type de réglage qui ne correspond pas est refusé, l'élément ne bouge pas.
    expect((await modifierValeurAction(id, { type: "profil-son" } as never)).ok).toBe(false);
    expect((await depots().elements.obtenir(id))!.valeur).toEqual(origine);
  });
});

/* ------------------------------------------------------------------ */
// Preuve par le CHEMIN RÉEL de fabrication (amendement du pilote 18/11) : migration au démarrage → choix du style sur la
// vidéo → commande de fabrication → moteur avocat → paramètres de composition envoyés à studio-rendu (fournisseurs simulés,
// aucun appel réel, coût nul). Rien n'est posé à la main sur la commande : seul le choix de style de la vidéo l'est.
describe("C2-U13 · une vidéo avocat fabriquée avec l'un des cinq styles choisi sort avec ce style", () => {
  const MDP = "essai-styles-texte-ecran";
  beforeAll(async () => {
    process.env.SESSION_SECRET = "s".repeat(48);
    const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
  });

  const stockage = (): StockageFichiers => ({
    id: "r2", type: "stockage", nom: "Stockage", reelPrevu: "R2", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }), confirmerDepot: async () => ({ ok: true }),
    urlLecture: async (cle) => `https://r2.exemple/${cle}?court`, urlLectureDuree: async (cle, sec) => `https://r2.exemple/${cle}?valable=${sec}`, urlDepotDuree: async (cle, sec) => `https://r2.exemple/${cle}?depot=${sec}`,
  });
  const MESURES = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 52_000_000, debitKbps: 14_050, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lufs: -14.1, lra: 2.2, creteVraieDbtp: -2.0, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41 };

  /** Fabrique la vidéo v-03 (avocat) de bout en bout avec le style choisi ; renvoie le calque de sous-titres de chaque ratio. */
  async function fabriquerAvec(styleId: string | null) {
    reinitialiserDepots();
    await depots().parametres.enregistrer({ id: "avocat.motionCommune", valeur: false, creeLe: "x", modifieLe: "x" } as never);
    await seConnecter(MDP, false);
    await migrerDonnees(depots(), T1); // chemin réel : les cinq styles sont installés par le démarrage
    if (styleId) await depots().videos.modifier("v-03", { styles: { sousTitresId: styleId } });
    const recues: DemandeRendu[] = [];
    const etats = new Map<string, EtatRendu>();
    const service: ServiceRendu = {
      async soumettre(d) { recues.push(d); etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? MESURES : undefined }); return { idRendu: d.idRendu }; },
      etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
    };
    const moteur = creerMoteurMontageAvocat({ rendu: service, stockage });
    const c = await construireCommande("v-03");
    let travail = await moteur.lancer(c, { travailId: "t-st", versionId: "ver-st", titre: "Styles", maintenant: T0 });
    for (let ms = T0; ms < T0 + 600_000 && travail.statut !== "termine" && travail.statut !== "echec"; ms += 500) travail = (await moteur.avancer(travail, c, ms)).travail;
    expect(travail.statut).toBe("termine");
    return { c, calques: recues.filter((d) => d.operation === "composition").map((d) => (d.parametres as { texte: { sousTitres?: Record<string, unknown> } }).texte.sousTitres) };
  }

  it("la commande retient le style choisi (installé par le démarrage), pas un autre", async () => {
    for (const id of IDS) {
      const { c } = await fabriquerAvec(id);
      expect(c.styles.sousTitres?.id).toBe(id);
    }
  });

  it("« Pastille Axion » : le calque envoyé au rendu porte la pastille ; « Axion surligné » : le surlignage ; « Axion pavé » : les plaques", async () => {
    const pastille = await fabriquerAvec("st-pastille-axion-v1");
    expect(pastille.calques.length).toBeGreaterThan(0);
    for (const k of pastille.calques) expect(k?.pastille).toBeDefined();
    const surligne = await fabriquerAvec("st-axion-surligne-v1");
    for (const k of surligne.calques) { expect(k?.surlignage).toBeDefined(); expect(k?.cibleMarqueur).toBe("expression"); }
    const pave = await fabriquerAvec("st-axion-pave-v1");
    for (const k of pave.calques) expect(k?.plaques).toBeDefined();
  });

  it("sans choix de style (aucun n'est par défaut) : la vidéo sort avec le style Avocat d'avant, sans pastille, surlignage ni plaque", async () => {
    const { c, calques } = await fabriquerAvec(null);
    expect(c.styles.sousTitres?.id).toBe("st-avocat-v1");
    for (const k of calques) for (const cle of ["pastille", "surlignage", "cibleMarqueur", "plaques", "motsOutils"]) expect(k?.[cle], cle).toBeUndefined();
  });
});
