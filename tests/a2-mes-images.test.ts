/**
 * LOT A2 — « Mes images » et cascade au service, une règle = un test, SANS réseau ni clé.
 * Un fournisseur d'illustrations « réel » doublé (banques et fabrication enregistrées) est inscrit à la place de
 * `illustrationsReelles()`, pour faire tourner le vrai code des services et du moteur avocat de bout en bout.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

const doublure = vi.hoisted(() => ({ banques: true, recherches: [] as string[], fabrications: 0 }));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/fournisseurs/illustration/inscription", async () => {
  const { fournisseurIllustrationSimulation } = await import("@/fournisseurs/simulation/autres");
  const { centimes } = await import("@/lib/montants");
  const reel = {
    ...fournisseurIllustrationSimulation,
    id: "reel",
    mode: "reel",
    async chercher({ requete, sources }: { requete: string; sources: string[] }) {
      doublure.recherches.push(`${sources[0]}:${requete}`);
      if (!doublure.banques || !/banknotes/.test(requete) || sources[0] !== "pexels") return [];
      return [
        { idExterne: "h1", source: "pexels", fichierCle: "https://videos.pexels.com/h.mp4", vignetteCle: "https://images.pexels.com/h.jpg", dureeSec: 12, largeur: 1920, hauteur: 1080, licence: { type: "libre", usageCommercial: true, reseaux: [], source: "Pexels" }, description: "banknotes on a table" },
        { idExterne: "v1", source: "pexels", fichierCle: "https://videos.pexels.com/v.mp4", vignetteCle: "https://images.pexels.com/v.jpg", dureeSec: 12, largeur: 1080, hauteur: 1920, licence: { type: "libre", usageCommercial: true, reseaux: [], source: "Pexels — https://www.pexels.com/video/v1/" }, description: "counting euro banknotes on a table" },
      ];
    },
    async recopierResultat(r: { idExterne: string }) {
      return { ...r, fichierCle: `studio/dev/illustrations/pexels/${r.idExterne}.mp4`, vignetteCle: `studio/dev/illustrations/pexels/${r.idExterne}.jpg` };
    },
    fabrication: {
      async soumettre(d: { genre: string }) {
        doublure.fabrications++;
        return { idDemande: d.genre };
      },
      async suivre(id: string) {
        return { statut: "fait", fichierCle: `studio/dev/illustrations/fal/${id}.${id === "image" ? "jpg" : "mp4"}`, mime: id === "image" ? "image/jpeg" : "video/mp4", urlSource: `https://fal.media/${id}`, cout: centimes(id === "image" ? 4 : 10), coutUsdCentimes: id === "image" ? 3.9 : 10.8, modele: id };
      },
    },
  };
  return { illustrationsReelles: () => ({ reel }) };
});

process.env.FOURNISSEUR_ILLUSTRATION = "reel";
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const mesImages = await import("@/services/mes-images");
const { migrerDonnees } = await import("@/services/migrations");
const { etape13MesImages } = await import("@/services/migrations/etape-13-mes-images");
const domaine = await import("@/domaine/mes-images");

const MDP = "essai-a2-mes-images";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  doublure.banques = true;
  doublure.recherches = [];
  doublure.fabrications = 0;
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.MOTEUR_AVOCAT;
});

const maintenant = () => new Date().toISOString();
async function deposer(nom: string, largeur = 1000, hauteur = 1000, mime = "image/png") {
  const id = `f-${nom.replace(/[^a-z0-9]/gi, "")}`;
  await depots().fichiers.enregistrer({ id, cleStockage: `/essais/mes-images/${nom}`, nom, mime, taille: 1, origine: "depot", statut: "pret", creeLe: maintenant(), modifieLe: maintenant() });
  return { fichierId: id, nom, mime, largeur, hauteur };
}

/* ------------------------------------------------------------------ */
describe("« Mes images » : règles pures", () => {
  it("7 catégories, licence « Propriété Axion-IA »", () => {
    expect(domaine.CATEGORIES_MES_IMAGES.map((c) => c.id)).toEqual(["bureau", "consoles", "interventions", "evenements", "clients", "objets", "marque"]);
    expect(domaine.LICENCE_MES_IMAGES).toMatchObject({ type: "propriete", usageCommercial: true, source: "Propriété Axion-IA" });
  });
  it("à l'import, TOUJOURS « à vérifier » ; zones proposées non floutées ; accord demandé pour un visage ou un client", () => {
    const c = domaine.confidentialiteInitiale({ zones: [{ type: "visage", x: 1, y: 1, largeur: 2, hauteur: 2, floutee: true }], visageTiers: true, categorie: "clients" });
    expect(c).toMatchObject({ statut: "a_verifier", accordTiers: false, accordClient: false });
    expect(c.zones[0].floutee).toBe(false);
  });
  it("« prête » seulement si validée par Will, zones floutées sur une copie, accords cochés", () => {
    const base = { categorieImage: "consoles" as const, motsCles: [], confidentialite: domaine.confidentialiteInitiale({ zones: [{ type: "montant", x: 0, y: 0, largeur: 9, hauteur: 9, floutee: false }], visageTiers: false, categorie: "consoles" }) };
    expect(domaine.appliquerValidation(base, {}, maintenant()).confidentialite?.statut).toBe("a_verifier"); // pas de copie floutée
    const ok = domaine.appliquerValidation(base, {}, maintenant(), "f-copie");
    expect(ok.confidentialite).toMatchObject({ statut: "prete", fichierFlouteId: "f-copie" });
    expect(ok.confidentialite?.zones[0].floutee).toBe(true);
    const tiers = { ...base, confidentialite: { statut: "a_verifier" as const, zones: [], accordTiers: false } };
    expect(domaine.appliquerValidation(tiers, {}, maintenant()).confidentialite?.statut).toBe("a_verifier");
    expect(domaine.appliquerValidation(tiers, { accordTiers: true }, maintenant()).confidentialite?.statut).toBe("prete");
    expect(domaine.statutCalcule({ categorieImage: "clients", confidentialite: { statut: "a_verifier", zones: [] }, valideLe: maintenant() })).toBe("a_verifier");
  });
  it("une zone que Will ne retient pas n'est pas floutée", () => {
    const base = { categorieImage: "objets" as const, motsCles: [], confidentialite: { statut: "a_verifier" as const, zones: [{ type: "nom" as const, x: 0, y: 0, largeur: 1, hauteur: 1, floutee: false }, { type: "montant" as const, x: 5, y: 5, largeur: 1, hauteur: 1, floutee: false }] } };
    expect(domaine.appliquerValidation(base, { zonesAFlouter: [1] }, maintenant(), "f").confidentialite?.zones.map((z) => z.type)).toEqual(["montant"]);
  });
  it("doublons par empreinte ; recherche sur mots-clés FR / EN, description, catégorie ; pastilles", () => {
    expect(domaine.estDoublon("abc", [{ empreinte: "abc" }])).toBe(true);
    expect(domaine.estDoublon(undefined, [{ empreinte: undefined }])).toBe(false);
    const e = { nom: "Capture", description: "Console de suivi", motsCles: ["alertes"], motsClesEn: ["dashboard"], categorieImage: "consoles" as const };
    expect(domaine.correspondRecherche(e, "dashboard")).toBe(true);
    expect(domaine.correspondRecherche(e, "tableaux de bord")).toBe(true);
    expect(domaine.correspondRecherche(e, "facture")).toBe(false);
    expect(domaine.pastillesMesImage({ type: "illustration-video", confidentialite: { statut: "prete", zones: [], fichierFlouteId: "f" } }).map((p) => p.libelle)).toEqual(["Prête", "Floutée", "Vidéo"]);
  });
});

/* ------------------------------------------------------------------ */
describe("« Mes images » : service (import, validation, archivage)", () => {
  it("import en vrac : classées, à vérifier, zones remises à l'échelle ; un doublon n'est jamais réimporté", async () => {
    const a = await deposer("console-alertes.png", 2000, 1000);
    const b = await deposer("console-alertes-copie.png", 2000, 1000);
    const r = await mesImages.importerMesImages([
      { ...a, empreinte: "1".repeat(64) },
      { ...b, empreinte: "1".repeat(64) },
    ]);
    expect(r.importees).toHaveLength(1);
    expect(r.doublons).toEqual(["console-alertes-copie.png"]);
    const e = (await depots().elements.obtenir(r.importees[0]))!;
    expect(e).toMatchObject({ origine: "personnelle", categorieImage: "consoles", importeDepuis: "fichier", licence: { type: "propriete" }, confidentialite: { statut: "a_verifier" } });
    expect(e.confidentialite!.zones[0]).toMatchObject({ x: 120, largeur: 760 }); // grille 1000 → image de 2000 px
    // Le fichier du doublon est gardé (rien n'est supprimé).
    expect(await depots().fichiers.obtenir(b.fichierId)).not.toBeNull();
    expect((await mesImages.importerMesImages([{ ...b, empreinte: "1".repeat(64) }])).doublons).toHaveLength(1);
  });

  it("validation : copie floutée créée À CÔTÉ de l'original (jamais remplacé), image prête ; archivage et restauration", async () => {
    const f = await deposer("facture-devis.png");
    const [id] = (await mesImages.importerMesImages([{ ...f, empreinte: "2".repeat(64) }])).importees;
    const vue = await mesImages.validerMesImage(id, { categorie: "objets", motsCles: ["facture", "devis"] });
    expect(vue).toMatchObject({ statut: "prete", floutee: true, categorie: "objets" });
    const e = (await depots().elements.obtenir(id))!;
    expect(e.fichierId).toBe(f.fichierId);
    expect(e.confidentialite!.fichierFlouteId).not.toBe(f.fichierId);
    expect(await depots().fichiers.obtenir(e.confidentialite!.fichierFlouteId!)).not.toBeNull();
    await mesImages.archiverMesImage(id, true);
    expect(await mesImages.listerMesImages()).toHaveLength(0);
    expect(await mesImages.listerMesImages({ ranges: true })).toHaveLength(1);
    expect(await depots().elements.obtenir(id)).not.toBeNull();
    await mesImages.archiverMesImage(id, false);
    expect((await mesImages.listerMesImages({ statut: "prete" })).map((x) => x.id)).toEqual([id]);
  });

  it("salon : visage d'un tiers → reste « à vérifier » sans la case d'accord", async () => {
    const f = await deposer("gofab-stand.jpg", 1000, 1000, "image/jpeg");
    const [id] = (await mesImages.importerMesImages([{ ...f, empreinte: "3".repeat(64) }])).importees;
    expect((await mesImages.validerMesImage(id, {})).statut).toBe("a_verifier");
    expect((await mesImages.validerMesImage(id, { accordTiers: true })).statut).toBe("prete");
    expect((await mesImages.resumeMesImages()).aVerifier).toBe(0);
  });

  it("Google Drive : adresse vérifiée, lecture seule, pas encore relié (aucune donnée inventée)", async () => {
    await expect(mesImages.preparerImportDrive("https://exemple.fr")).rejects.toThrow(/Google Drive/);
    expect(await mesImages.preparerImportDrive("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp")).toMatchObject({ dossierId: "1AbCdEfGhIjKlMnOp", relie: false });
  });
});

/* ------------------------------------------------------------------ */
describe("migration étape 13", () => {
  it("base neuve : rien ; illustration payée sans origine → fabriquée ; image de Will sans contrôle → à vérifier ; idempotente", async () => {
    expect(await etape13MesImages(depots(), maintenant())).toBeNull();
    const base = { marqueId: "marque-axion", formatsParDefaut: [], licence: { type: "propriete" as const, usageCommercial: true, reseaux: [] }, creeLe: maintenant(), modifieLe: maintenant(), motsCles: [] };
    await depots().elements.enregistrer({ ...base, id: "x1", type: "illustration-video", nom: "payée", valeur: { type: "illustration-video" }, fabrique: true });
    await depots().elements.enregistrer({ ...base, id: "x2", type: "illustration-image", nom: "à moi", valeur: { type: "illustration-image" }, origine: "personnelle" });
    expect(await etape13MesImages(depots(), maintenant())).toEqual({ fabriquees: ["x1"], aVerifier: ["x2"] });
    expect(await etape13MesImages(depots(), maintenant())).toBeNull();
    const rapport = await migrerDonnees(depots());
    expect(rapport.lots?.["mes-images"]).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* La cascade au service, puis la fabrication par le moteur avocat                                        */
/* ------------------------------------------------------------------ */

const seg = (id: string, texte: string, intentionIllustration?: string) => ({ id, texte, ...(intentionIllustration ? { intentionIllustration } : {}) });
async function videoDemo(): Promise<string> {
  const id = await videos.creerBrouillon("avocat", { scriptId: "script-2" });
  const v = (await depots().videos.obtenir(id))!;
  await depots().scripts.modifier(v.scriptId!, {
    blocs: [
      { id: "b1", blocRecette: "accroche", segments: [seg("s1", "Vous recevez un PV de 135 € ? Ne le payez pas tout de suite.")] },
      { id: "b2", blocRecette: "promesse", segments: [seg("s2", "Je vous explique pourquoi, en trente secondes, et c'est simple.")] },
      {
        id: "b3",
        blocRecette: "coeur",
        segments: [
          seg("s3", "Votre contestation part toujours avec un accusé de réception : c'est votre seule preuve.", "un accusé de réception de lettre recommandée"),
          seg("s4", "Sans ce papier, l'administration peut dire qu'elle n'a jamais rien reçu, et vous perdez."),
          seg("s5", "Relisez aussi le contrat de location du véhicule avant de signer quoi que ce soit.", "un contrat sur une table"),
          seg("s6", "Une seule erreur sur l'avis, une date ou une plaque, et le PV tombe."),
        ],
      },
      { id: "b4", blocRecette: "preuve", segments: [seg("s7", "Un client a gardé ses 2 500 € en billets, simplement comme ça.", "billets d'euros sur une table"), seg("s8", "Moi, je suis tout dans ma console de suivi du budget, chaque semaine.", "la console de suivi du budget")] },
      { id: "b5", blocRecette: "appel", segments: [seg("s9", "Gardez cette vidéo pour le prochain PV, et partagez-la.")] },
    ],
  });
  return id;
}
async function mesImagePrete(): Promise<string> {
  const f = await deposer("console-budget-studio.png", 390, 844);
  const [id] = (await mesImages.importerMesImages([{ ...f, empreinte: "4".repeat(64) }])).importees;
  await mesImages.validerMesImage(id, { motsCles: ["console", "suivi", "budget"] });
  return id;
}
const origines = (a: Awaited<ReturnType<typeof fabrication.apercuFabrication>>) => a.plans.filter((p) => p.sourceImage === "illustration").map((p) => a.illustrations?.parPlan[p.id]?.origine);

describe("cascade à l'Aperçu (le moteur trouve SEUL les illustrations)", () => {
  it("Mes images → réutilisée (0 €) → banque verticale (licence, recopiée) → à fabriquer ; coût « à fabriquer » estimé", async () => {
    process.env.MOTEUR_AVOCAT = "montage-avocat";
    const perso = await mesImagePrete();
    const id = await videoDemo();
    const a = await fabrication.apercuFabrication(id);
    expect(origines(a)).toEqual(["a-fabriquer", "reutilisee", "banque", "mes-images"]);
    expect(a.illustrations?.resume).toMatchObject({ mesImages: 1, reutilisees: 1, banques: 1, aFabriquer: 1, centimesAFabriquer: 13 });
    expect(a.estimation.lignes.find((l) => l.etape === "Illustrations à fabriquer")?.total.centimes).toBe(13);
    expect(a.estimation.lignes.some((l) => l.etape === "Illustrations")).toBe(false);
    const banque = (await depots().elements.trouver((e) => e.origine === "banque"))!;
    expect(banque).toMatchObject({ type: "illustration-video", empreinte: "pexels:v1", licence: { usageCommercial: true }, valeur: { type: "illustration-video" } });
    expect((await depots().fichiers.obtenir(banque.fichierId!))!.cleStockage).toBe("studio/dev/illustrations/pexels/v1.mp4");
    expect(a.plans.find((p) => a.illustrations?.parPlan[p.id]?.origine === "mes-images")?.illustration?.elementId).toBe(perso);
    // Pexels d'abord ; Pixabay seulement si Pexels n'a rien.
    expect(doublure.recherches.filter((r) => r.includes("banknotes"))).toEqual(["pexels:banknotes euro table"]);
  });

  it("une image de Will « à vérifier » n'est pas utilisée", async () => {
    const f = await deposer("console-budget-studio.png");
    await mesImages.importerMesImages([{ ...f, empreinte: "5".repeat(64) }]);
    const id = await videoDemo();
    expect(origines(await fabrication.apercuFabrication(id))).not.toContain("mes-images");
  });

  it("le montage lit la COPIE floutée d'une image prête, jamais l'original", async () => {
    const perso = await mesImagePrete();
    const id2 = await videoDemo();
    const c = await fabrication.construireCommande(id2);
    expect(c.plans.some((p) => p.illustration?.elementId === perso)).toBe(true);
    const e = (await depots().elements.obtenir(perso))!;
    const floute = (await depots().fichiers.obtenir(e.confidentialite!.fichierFlouteId!))!;
    expect(c.medias?.[perso]?.cle).toBe(floute.cleStockage);
    expect(floute.id).not.toBe(e.fichierId);
  });

  it("mode économique : rien n'est fabriqué (le plan revient au double), banques seulement ; et retour", async () => {
    const id = await videoDemo();
    await fabrication.apercuFabrication(id);
    await fabrication.changerModeEconomiqueApercu(id, true);
    const a = await fabrication.apercuFabrication(id);
    expect(origines(a)).toContain("double");
    expect(a.illustrations?.economique).toBe(true);
    expect(a.estimation.lignes.some((l) => /fabriquer/.test(l.etape))).toBe(false);
    const c = await fabrication.construireCommande(id);
    expect(c.entrees.illustrationsEconomique).toBe(true);
    await fabrication.changerModeEconomiqueApercu(id, false);
    expect(origines(await fabrication.apercuFabrication(id))).toContain("a-fabriquer");
  });

  it("fabrication (moteur avocat) : UNE illustration fabriquée, rangée dans la Bibliothèque ; usages marqués ; pas de répétition dans la vidéo suivante", async () => {
    process.env.MOTEUR_AVOCAT = "montage-avocat";
    vi.useFakeTimers({ toFake: ["Date"] });
    await mesImagePrete();
    const id = await videoDemo();
    const a = await fabrication.apercuFabrication(id);
    const { travailId } = await fabrication.lancerFabrication(id, { confirme: true });
    let t = await depots().travaux.obtenir(travailId);
    for (let i = 0; i < 60 && t && t.statut !== "termine" && t.statut !== "echec"; i++) {
      await travaux.avancerTravaux();
      vi.setSystemTime(Date.now() + 5_000);
      t = await depots().travaux.obtenir(travailId);
    }
    expect(t?.statut).toBe("termine");
    expect(t!.etapes.find((e) => e.cle === "illustrations")).toMatchObject({ statut: "terminee", coutReel: { centimes: 14 } });
    expect(doublure.fabrications).toBe(2); // une image, un clip
    const cree = (await depots().elements.trouver((e) => e.origine === "fabriquee"))!;
    expect(cree).toMatchObject({ type: "illustration-video", fabrique: true, utilisations: 1, derniereVideoId: id, licence: { type: "generee-ia" } });
    // Le plan de la version pointe vers l'élément créé (plus vers l'identifiant provisoire).
    const plans = await depots().plans.lister((p) => p.versionId === t!.versionId);
    expect(plans.some((p) => p.illustration?.elementId === cree.id)).toBe(true);
    expect(plans.some((p) => p.illustration?.elementId?.startsWith("fab-"))).toBe(false);
    // La réutilisée (« Contrat sur une table ») est marquée utilisée par cette vidéo…
    const reutilisee = a.plans.find((p) => a.illustrations?.parPlan[p.id]?.origine === "reutilisee")!.illustration!.elementId!;
    expect(await depots().elements.obtenir(reutilisee)).toMatchObject({ utilisations: 1, derniereVideoId: id, dernierRangVideo: 1 });
    // … donc la vidéo suivante ne la reprend pas (moins de 10 vidéos d'écart).
    const id2 = await videoDemo();
    const a2 = await fabrication.apercuFabrication(id2);
    expect(a2.plans.some((p) => p.illustration?.elementId === reutilisee)).toBe(false);
  }, 60_000);
});
