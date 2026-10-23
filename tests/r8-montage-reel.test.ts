/**
 * LOT R8 — « Montage réel des vidéos avocat » : l'interrupteur, sa GARDE ROUGE et son PRIX.
 *  - décision pure (`deciderMontageReel`) : éteint par défaut ; proposé seulement quand double, voix, textes des
 *    réseaux, serveur de rendu (et stockage) sont reliés ; ce qui manque, en phrase simple ;
 *  - ROUGE : sans double prêt (aucun choisi au personnage, ou rendu d'avatar par le studio éteint), jamais de montage
 *    réel, et « Ma vidéo HeyGen » reste le chemin proposé — côté écran, côté réglage ET au lancement ;
 *  - ROUGE : le prix d'une vidéo de 45 s (voix + double + textes ; montage gratuit) ;
 *  - écrans : phrases simples, jamais de 4K.
 * Configuration de PRODUCTION (rendu d'avatar éteint, décision de Will du 03/10). Aucun réseau, aucune clé réelle.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";

process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
process.env.FOURNISSEUR_TEXTE_RESEAUX = "claude";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;
const appels = vi.hoisted(() => [] as string[]);
vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
  // Seule la LECTURE des doubles du compte répond (gratuite) ; tout le reste est noté et refusé.
  const f = (async (u: string, init?: RequestInit) => {
    appels.push(`${init?.method ?? "GET"} ${u}`);
    if (String(u).includes("/v3/avatars/looks")) return new Response(JSON.stringify({ data: [F.lookTermine.data], has_more: false }), { status: 200 });
    throw new Error("réseau interdit");
  }) as unknown as typeof fetch;
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-r8", fetch: f }), { fetch: f }) }),
    voixHeygen: () => ({ heygen: { ...fournisseurVoixSimulation, id: "heygen", mode: "reel" as const } }),
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const reglages = await import("@/services/reglages");
const fabrication = await import("@/services/fabrication");
const doublesHeygen = await import("@/services/doubles-heygen");
const { ecrireParametre } = await import("@/services/_commun");
const { deciderMontageReel, DOUBLE_PAS_CHOISI, DOUBLE_PARLE_DANS_HEYGEN } = await import("@/moteurs");
const { prixVideoReelle, centimesUsdTextesReseaux, DUREE_PRIX_REFERENCE_SEC, illustrationsTypes } = await import("@/moteurs/montage-avocat/prix-reel");
const { prixFabricationUsd } = await import("@/domaine/illustrations");
const { detailMontageReel } = await import("@/components/reglages/Connexions");

const MDP = "essai-r8-montage-reel";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  appels.length = 0;
  vi.stubGlobal("fetch", (async (u: string) => {
    appels.push(`GLOBAL ${u}`);
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */

const TOUT = { allume: true, doubleRelie: true, voixRelie: true, textesRelies: true, montageRelie: true, stockageRelie: true, doubleChoisi: true, renduAvatarAllume: true };

describe("décision pure", () => {
  it("éteint par défaut : l'essai reste, même tout relié et le double prêt", () => {
    expect(deciderMontageReel("avocat", null, { ...TOUT, allume: false })).toMatchObject({ moteurId: "simulation", effectif: false, manque: null, doublePasPret: null });
  });

  it("allumé, tout relié, double prêt : le moteur réel du format", () => {
    expect(deciderMontageReel("avocat", null, TOUT)).toEqual({ moteurId: "montage-avocat", effectif: true, manque: null, doublePasPret: null });
  });

  it("ce qui manque, en phrase simple ; l'essai reste", () => {
    const d = deciderMontageReel("avocat", null, { ...TOUT, voixRelie: false, montageRelie: false });
    expect(d).toMatchObject({ moteurId: "simulation", effectif: false, manque: "la voix et le serveur de rendu" });
    expect(deciderMontageReel("avocat", null, { ...TOUT, doubleRelie: false, textesRelies: false, stockageRelie: false }).manque).toBe("le double (visage), les textes de publication et le stockage des fichiers");
  });

  it("ROUGE — garde : aucun double choisi au personnage → jamais de montage réel ; « Ma vidéo HeyGen » proposé", () => {
    const d = deciderMontageReel("avocat", null, { ...TOUT, doubleChoisi: false });
    expect(d).toMatchObject({ moteurId: "simulation", effectif: false, doublePasPret: DOUBLE_PAS_CHOISI });
    expect(DOUBLE_PAS_CHOISI).toMatch(/Ma vidéo HeyGen/);
  });

  it("ROUGE — garde : rendu d'avatar par le studio éteint → jamais de montage réel ; « Ma vidéo HeyGen » proposé", () => {
    const d = deciderMontageReel("avocat", null, { ...TOUT, renduAvatarAllume: false });
    expect(d).toMatchObject({ moteurId: "simulation", effectif: false, doublePasPret: DOUBLE_PARLE_DANS_HEYGEN });
    expect(DOUBLE_PARLE_DANS_HEYGEN).toMatch(/Ma vidéo HeyGen/);
  });

  it("un moteur déjà réel par le réglage du format reste tel quel (comportement d'avant inchangé)", () => {
    expect(deciderMontageReel("avocat", "montage-avocat", { ...TOUT, allume: false, doubleChoisi: false })).toMatchObject({ moteurId: "montage-avocat", effectif: false });
    expect(deciderMontageReel("format-inconnu", null, TOUT)).toMatchObject({ moteurId: "simulation", effectif: false });
  });
});

describe("prix d'une vidéo de 45 s", () => {
  const RESEAUX = ["linkedin", "instagram", "tiktok", "youtube-shorts"] as const;

  it("ROUGE — voix au caractère + double à la seconde + textes des réseaux ; montage gratuit ; au taux du studio", () => {
    const p = prixVideoReelle({ reseaux: [...RESEAUX], tauxUsdEur: 0.9 });
    expect(p.dureeSec).toBe(45);
    expect(DUREE_PRIX_REFERENCE_SEC).toBe(45);
    const ligne = (q: string) => p.lignes.find((l) => l.quoi === q)!.montant.centimes;
    // 45 s × 16 caractères × 0,03 c$ × 0,9 = 19,44 c€, arrondi au centime SUPÉRIEUR (intégration finale) : 20 ;
    // 45 s × 7 c$ × 0,9 = 283,5 c€.
    expect(ligne("Voix")).toBe(20);
    expect(ligne("Votre avatar")).toBe(284);
    expect(ligne("Montage, sous-titres, couleurs, son, miniature")).toBe(0);
    const textes = ligne("Textes des réseaux");
    expect(textes).toBe(Math.round(centimesUsdTextesReseaux([...RESEAUX]) * 0.9));
    expect(textes).toBeGreaterThan(0);
    expect(textes).toBeLessThan(100);
    expect(p.total.centimes).toBe(20 + 284 + textes);
    expect(p.total.devise).toBe("EUR");
  });

  it("INTÉGRATION FINALE — illustrations fabriquées : nombre type de la recette avocat (8 pour 45 s), seulement si fal.ai est branché", () => {
    expect(illustrationsTypes(45)).toBe(8);
    const sans = prixVideoReelle({ reseaux: [], tauxUsdEur: 0.9 });
    const avec = prixVideoReelle({ reseaux: [], tauxUsdEur: 0.9, illustrationsFabriquees: true });
    const illus = avec.lignes.find((l) => l.quoi === "Illustrations fabriquées (jusqu'à 8)")!.montant.centimes;
    expect(illus).toBe(Math.ceil(8 * prixFabricationUsd() * 0.9));
    expect(avec.total.centimes).toBe(sans.total.centimes + illus);
    expect(sans.lignes.some((l) => l.quoi.startsWith("Illustrations"))).toBe(false);
    // Jamais « 0 € » pour une voix payée, même très courte.
    expect(prixVideoReelle({ reseaux: [], dureeSec: 1, tauxUsdEur: 0.9 }).lignes[0].montant.centimes).toBe(1);
  });

  it("le taux et les réseaux comptent ; aucun réseau : pas de ligne de textes", () => {
    expect(prixVideoReelle({ reseaux: [...RESEAUX], tauxUsdEur: 1 }).total.centimes).toBeGreaterThan(prixVideoReelle({ reseaux: [...RESEAUX], tauxUsdEur: 0.9 }).total.centimes);
    expect(centimesUsdTextesReseaux(["linkedin"])).toBeLessThan(centimesUsdTextesReseaux([...RESEAUX]));
    expect(prixVideoReelle({ reseaux: [], tauxUsdEur: 0.9 }).lignes.map((l) => l.quoi)).toEqual(["Voix", "Votre avatar", "Montage, sous-titres, couleurs, son, miniature"]);
  });
});

/* ------------------------------------------------------------------ */

async function carte() {
  return (await reglages.listerConnexions()).find((c) => c.type === "montage")!.montageReel!.find((f) => f.formatId === "avocat")!;
}

async function choisirLeDouble() {
  const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
  return doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
}

describe("service et carte Montage (production : le studio ne fait pas encore parler le double)", () => {
  it("éteint par défaut, prix d'une vidéo de 45 s déjà montré", async () => {
    const f = await carte();
    expect(f).toMatchObject({ formatId: "avocat", allume: false, possible: false });
    expect(f.prix.dureeSec).toBe(45);
    expect(f.prix.total.centimes).toBeGreaterThan(0);
    expect(f.prix.lignes.map((l) => l.quoi)).toEqual(["Voix", "Votre avatar", "Textes des réseaux", "Montage, sous-titres, couleurs, son, miniature"]);
  });

  it("ROUGE — aucun double choisi : indisponible, la phrase renvoie vers « Ma vidéo HeyGen » ; refusé côté serveur", async () => {
    expect((await carte()).raison).toBe(DOUBLE_PAS_CHOISI);
    await expect(reglages.definirMontageReel("avocat", true)).rejects.toMatchObject({ code: "MONTAGE_REEL_INDISPONIBLE", message: DOUBLE_PAS_CHOISI });
    expect((await reglages.decisionMontageReel("avocat")).allume).toBe(false);
  });

  it("ROUGE — double choisi mais rendu d'avatar éteint : indisponible, refusé ; même forcé en base, la vidéo part en essai", async () => {
    await choisirLeDouble();
    const f = await carte();
    expect(f).toMatchObject({ possible: false, raison: DOUBLE_PARLE_DANS_HEYGEN });
    await expect(reglages.definirMontageReel("avocat", true)).rejects.toMatchObject({ code: "MONTAGE_REEL_INDISPONIBLE" });
    // Même si le réglage était posé à la main, le lancement reste en essai (garde au lancement).
    await ecrireParametre("moteur.avocat.montageReel", true);
    expect((await reglages.decisionMontageReel("avocat")).moteurId).toBe("simulation");
    expect((await fabrication.construireCommande("v-03")).moteurId).toBe("simulation");
    expect(await reglages.moteurAuLancement("avocat")).toBe("simulation");
    // Aucune demande payante chez HeyGen, rien d'autre que la lecture gratuite des doubles.
    expect(appels.every((a) => a.startsWith("GET ") && a.includes("/v3/avatars/looks"))).toBe(true);
  });

  it("une connexion manque : la phrase la nomme simplement (connexions d'abord)", async () => {
    await choisirLeDouble();
    await ecrireParametre("fournisseur.voix", "simulation");
    expect((await carte()).raison).toBe("Il faut d'abord relier la voix.");
  });

  it("couper est toujours permis, sans rien effacer", async () => {
    await reglages.definirMontageReel("avocat", false);
    expect((await carte()).allume).toBe(false);
    const journal = await reglages.listerJournal(5);
    expect(journal[0].message).toMatch(/retour en essai/);
  });
});

describe("écrans", () => {
  const prix = prixVideoReelle({ reseaux: ["linkedin"], tauxUsdEur: 0.9 });
  it("phrases simples : ce qui manque, le double pas prêt, ou le prix ; jamais de nom technique ni de 4K", () => {
    const textes = [
      detailMontageReel({ formatId: "avocat", nom: "Avocat", allume: false, possible: false, raison: "Il faut d'abord relier la voix.", prix }),
      detailMontageReel({ formatId: "avocat", nom: "Avocat", allume: false, possible: false, raison: DOUBLE_PARLE_DANS_HEYGEN, prix }),
      detailMontageReel({ formatId: "avocat", nom: "Avocat", allume: false, possible: true, prix }),
      detailMontageReel({ formatId: "avocat", nom: "Avocat", allume: true, possible: true, prix }),
    ];
    expect(textes[0]).toBe("Il faut d'abord relier la voix.");
    expect(textes[1]).toMatch(/Ma vidéo HeyGen/);
    expect(textes[2]).toMatch(/^Environ .+ pour une vidéo de 45 s\. Éteint : vos vidéos restent des essais\.$/);
    expect(textes[3]).toMatch(/Prix confirmé à chaque lancement/);
    for (const t of textes) expect(t).not.toMatch(/simulation|montage-avocat|studio-rendu|[A-Z]+_[A-Z]+|4K|2160/i);
    const source = readFileSync("src/components/reglages/Connexions.tsx", "utf8") + readFileSync("src/assistant/etapes/Apercu.tsx", "utf8");
    expect(source).not.toMatch(/4K|2160p|3840/);
  });
});
