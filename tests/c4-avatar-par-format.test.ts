/**
 * CORRECTEUR 4 — AVATAR PAR FORMAT (03/10, validé par Will), sur le modèle exact de la voix par format :
 *  - `Personnage.visageParFormat` (ajout pur, aucune migration) ; résolution `visagePourFormat` : choix de la vidéo >
 *    visage du format > visage par défaut > premier prêt ; le second angle reste celui du MÊME avatar (même tenue) ;
 *  - services `choisirVisagePourFormat` / `choisirVisageParDefaut` ;
 *  - les appels qui ignoraient le format (création d'un brouillon, distribution par défaut de la fabrication) ;
 *  - `visagePour` : changer de tenue ou de posture ne bascule pas sur l'autre avatar ;
 *  - angle principal lu dans la recette (brique « visage »), plus « trois-quarts » en dur ;
 *  - garde B4 (pure) : un montage réel refuse une voix d'essai.
 * Aucun appel réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { CommandeFabrication, Visage } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const personnages = await import("@/services/personnages");
const videos = await import("@/services/videos");
const fabrication = await import("@/services/fabrication");
const distribution = await import("@/domaine/distribution");
const logique = await import("@/assistant/express/logique");
const { briqueVisage } = await import("@/briques");
const moteurAvocat = await import("@/moteurs/montage-avocat");

const MDP_TEST = "essai-c4-avatar-format";

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

/** Deux avatars de Will : A « Chemise noire » (vis-will-face + vis-a-34) et B « Costume » (vis-b-34 + vis-b-face). */
async function deuxAvatars() {
  const d = depots();
  const base = (await d.visages.obtenir("vis-will-face"))!;
  const ajouter = (id: string, angle: Visage["angle"], tenue: string) => d.visages.enregistrer({ ...base, id, nom: `${tenue} ${angle}`, angle, tenue, tenueId: distribution.normaliserTenue(tenue) });
  await d.visages.modifier("vis-will-34", { statut: "brouillon" });
  await ajouter("vis-a-34", "trois-quarts", "Chemise noire");
  await ajouter("vis-b-34", "trois-quarts", "Costume");
  await ajouter("vis-b-face", "face", "Costume");
}

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

describe("domaine : visagePourFormat", () => {
  const v = (id: string, statut: Visage["statut"] = "pret") => ({ id, statut });
  const visages = [v("a"), v("b"), v("c"), v("d", "brouillon")];

  it("ROUGE — choix de la vidéo > visage du format > visage par défaut > premier prêt", () => {
    const p = { visageParDefautId: "b", visageParFormat: { avocat: "c" } };
    expect(distribution.visagePourFormat(visages, p, "avocat", "a")?.id).toBe("a");
    expect(distribution.visagePourFormat(visages, p, "avocat")?.id).toBe("c");
    expect(distribution.visagePourFormat(visages, p, "podcast")?.id).toBe("b");
    expect(distribution.visagePourFormat(visages, {}, "avocat")?.id).toBe("a");
    // Un choix qui n'est pas prêt (ou disparu) est sauté, jamais inventé.
    expect(distribution.visagePourFormat(visages, { visageParDefautId: "b", visageParFormat: { avocat: "d" } }, "avocat", "zz")?.id).toBe("b");
    expect(distribution.visagePourFormat([v("d", "brouillon")], p, "avocat")).toBeUndefined();
  });

  it("ROUGE — ancien personnage sans visageParFormat : exactement le comportement d'avant (visageParDefaut)", () => {
    for (const p of [{}, { visageParDefautId: "b" }, { visageParDefautId: "d" }, { visageParDefautId: "zz" }]) {
      expect(distribution.visagePourFormat(visages, p, "avocat")?.id).toBe(distribution.visageParDefaut(visages, p.visageParDefautId)?.id);
    }
    expect(distribution.visagePourFormat(visages, null, "avocat")?.id).toBe("a");
  });

  it("ROUGE — le second angle reste celui du MÊME avatar (même tenue), jamais l'autre", async () => {
    await deuxAvatars();
    const sesVisages = await depots().visages.lister((x) => x.personnageId === "p-will");
    const will = { visageParDefautId: "vis-a-34", visageParFormat: { avocat: "vis-b-34" } };
    const principal = distribution.visagePourFormat(sesVisages, will, "avocat")!;
    expect(principal.id).toBe("vis-b-34");
    const r = distribution.resoudreVisagesParAngle({ visages: sesVisages, principal, partSecond: 0.15 });
    expect(r).toMatchObject({ modeAngles: "deux-angles", visagesParAngle: { "trois-quarts": "vis-b-34", face: "vis-b-face" } });
    // Pour un autre format : l'avatar habituel A, et son propre second angle (chemise noire).
    const habituel = distribution.visagePourFormat(sesVisages, will, "podcast")!;
    expect(distribution.resoudreVisagesParAngle({ visages: sesVisages, principal: habituel, partSecond: 0.15 }).visagesParAngle).toEqual({ "trois-quarts": "vis-a-34", face: "vis-will-face" });
  });

  it("ROUGE — angle principal lu dans la recette ; « trois-quarts » seulement à défaut", () => {
    expect(distribution.anglePrincipalDe(undefined)).toBe("trois-quarts");
    expect(distribution.anglePrincipalDe({ angles: { principal: "face" } })).toBe("face");
    expect(distribution.visagePrincipalResolu({ face: 1, "trois-quarts": 2 }, "face")).toBe(1);
    expect(distribution.visagePrincipalResolu({ face: 1, "trois-quarts": 2 }, "trois-quarts")).toBe(2);
    expect(distribution.visagePrincipalResolu({ face: 1 }, "trois-quarts")).toBe(1);
    expect(distribution.visagePrincipalResolu(undefined, "face")).toBeUndefined();
  });
});

describe("visagePour : la tenue change, l'avatar reste", () => {
  const vis = (id: string, angle: Visage["angle"], tenue: string, fournisseur: string, posture: Visage["posture"] = "assis") =>
    ({ id, angle, tenue, tenueId: distribution.normaliserTenue(tenue), fournisseur, posture, statut: "pret" }) as Visage;

  it("ROUGE — même tenue chez deux avatars : le visage actuel (ou son fournisseur) est gardé, à l'angle principal de la recette", () => {
    const essai = vis("essai-34", "trois-quarts", "Costume", "simulation");
    const heygen34 = vis("hg-34", "trois-quarts", "Costume", "heygen");
    const heygenFace = vis("hg-face", "face", "Costume", "heygen");
    const visages = [essai, heygen34, heygenFace];
    // Avant : le premier trois-quarts prêt (l'essai) remplaçait l'avatar HeyGen.
    expect(logique.visagePour(visages, "costume", "assis", { actuel: heygenFace })?.id).toBe("hg-face");
    expect(logique.visagePour(visages, "costume", "assis", { actuel: { id: "autre", fournisseur: "heygen" } })?.id).toBe("hg-34");
    expect(logique.visagePour(visages, "costume", "assis", { actuel: { id: "autre", fournisseur: "heygen" }, anglePrincipal: "face" })?.id).toBe("hg-face");
    // Sans visage actuel : comportement d'avant (angle principal d'abord).
    expect(logique.visagePour(visages, "costume", "assis")?.id).toBe("essai-34");
    expect(logique.visagePour(visages, "pull", "assis")).toBeUndefined();
  });
});

describe("services : choisirVisagePourFormat / choisirVisageParDefaut", () => {
  it("ROUGE — une action ; visage d'un autre personnage, pas prêt ou format inconnu : refusé ; « habituel » retire", async () => {
    await personnages.choisirVisagePourFormat("p-will", "avocat", "vis-will-34");
    expect((await depots().personnages.obtenir("p-will"))!.visageParFormat).toEqual({ avocat: "vis-will-34" });
    expect((await depots().personnages.obtenir("p-will"))!.visageParDefautId).toBeUndefined(); // l'habituel ne bouge pas
    await expect(personnages.choisirVisagePourFormat("p-will", "avocat", "vis-clara-face")).rejects.toMatchObject({ code: "INTROUVABLE" });
    await expect(personnages.choisirVisagePourFormat("p-will", "format-inconnu", "vis-will-34")).rejects.toMatchObject({ code: "INTROUVABLE" });
    await depots().visages.modifier("vis-will-face", { statut: "en_preparation" });
    await expect(personnages.choisirVisagePourFormat("p-will", "podcast", "vis-will-face")).rejects.toMatchObject({ code: "VISAGE_PAS_PRET" });
    await personnages.choisirVisagePourFormat("p-will", "avocat", null);
    expect((await depots().personnages.obtenir("p-will"))!.visageParFormat).toEqual({});
    expect(await depots().visages.compter((v) => v.personnageId === "p-will")).toBe(2); // rien d'effacé
  });

  it("ROUGE — « Visage par défaut » : écrit visageParDefautId, refuse un visage étranger ou pas prêt", async () => {
    await personnages.choisirVisageParDefaut("p-will", "vis-will-34");
    expect((await depots().personnages.obtenir("p-will"))!.visageParDefautId).toBe("vis-will-34");
    await expect(personnages.choisirVisageParDefaut("p-will", "vis-sophie-face")).rejects.toMatchObject({ code: "INTROUVABLE" });
    await depots().visages.modifier("vis-will-face", { statut: "echec" });
    await expect(personnages.choisirVisageParDefaut("p-will", "vis-will-face")).rejects.toMatchObject({ code: "VISAGE_PAS_PRET" });
    expect((await depots().personnages.obtenir("p-will"))!.visageParDefautId).toBe("vis-will-34");
  });
});

describe("parcours : fiche personnage → nouvelle vidéo → fabrication", () => {
  it("ROUGE — nouvelle vidéo avocat : l'avatar du format est pris d'office (le visage par défaut reste pour les autres)", async () => {
    // Avant : premier prêt (vis-will-face) ; le visage du format était ignoré.
    await personnages.choisirVisagePourFormat("p-will", "avocat", "vis-will-34");
    const id = await videos.creerBrouillon("avocat");
    expect((await depots().videos.obtenir(id))!.distribution[0]).toMatchObject({ personnageId: "p-will", visageId: "vis-will-34" });
  });

  it("ancien personnage (sans visageParFormat) : la nouvelle vidéo prend le visage par défaut, comme avant", async () => {
    await depots().personnages.modifier("p-will", { visageParDefautId: "vis-will-34" });
    const id = await videos.creerBrouillon("avocat");
    expect((await depots().videos.obtenir(id))!.distribution[0].visageId).toBe("vis-will-34");
  });

  it("ROUGE — fabrication d'une distribution sans visage : l'avatar du format et SON second angle (même tenue)", async () => {
    await deuxAvatars();
    await depots().personnages.modifier("p-will", { visageParDefautId: "vis-a-34", visageParFormat: { avocat: "vis-b-34" } });
    const v = (await depots().videos.obtenir("v-03"))!;
    expect(v.formatId).toBe("avocat");
    await depots().videos.modifier("v-03", { distribution: v.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: "p-will", visageId: undefined, visagesParAngle: undefined } : x)) });
    const c = await fabrication.construireCommande("v-03");
    expect(c.distribution[0].visageId).toBe("vis-b-34");
    expect(c.distribution[0].visagesParAngle).toEqual({ "trois-quarts": "vis-b-34", face: "vis-b-face" });
  });

  it("modifiable vidéo par vidéo : le choix de la vidéo l'emporte sur le format", async () => {
    await deuxAvatars();
    await depots().personnages.modifier("p-will", { visageParFormat: { avocat: "vis-b-34" } });
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { distribution: v.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: "p-will", visageId: "vis-a-34", visagesParAngle: undefined } : x)) });
    const c = await fabrication.construireCommande("v-03");
    expect(c.distribution[0].visageId).toBe("vis-a-34");
    expect(c.distribution[0].visagesParAngle?.face).toBe("vis-will-face");
  });
});

describe("angle principal de la recette (brique « visage »)", () => {
  it("ROUGE — recette « face » d'abord : le prix suit l'avatar de face, pas celui de trois quarts", () => {
    const c = {
      versionContrat: 2,
      moteurId: "montage-avocat",
      dureeCibleSec: 45,
      tauxUsdEur: 1,
      renduDouble: { allume: true },
      recetteMontage: { angles: { principal: "face", second: "trois-quarts", repartitionParDefaut: { principal: 1, second: 0 } } },
      distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { face: { visageId: "hg", fournisseur: "heygen", statut: "pret" }, "trois-quarts": { visageId: "essai", fournisseur: "simulation", statut: "pret" } } }],
    } as unknown as CommandeFabrication;
    const lignes = briqueVisage.estimer(c);
    expect(lignes[0]).toMatchObject({ etape: "Double, angle principal", fournisseur: "heygen" });
  });

  it("CORRIGÉ (relecture finale) — commande sans moteur, ou à moteur inconnu : moteur du format (essai), aucun prix HeyGen", () => {
    const base = { versionContrat: 2, formatId: "avocat", dureeCibleSec: 45, tauxUsdEur: 1, renduDouble: { allume: true }, recetteMontage: { angles: { principal: "face", repartitionParDefaut: { principal: 1, second: 0 } } }, distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { face: { visageId: "hg", fournisseur: "heygen", statut: "pret" } } }] };
    for (const moteurId of [undefined, "fantome"]) {
      const lignes = briqueVisage.estimer({ ...base, moteurId } as unknown as CommandeFabrication);
      expect(lignes[0]).toMatchObject({ etape: "Double, angle principal", fournisseur: "simulation" });
    }
  });
});

describe("garde B4 (pure) : voix d'essai refusée pour un montage réel", () => {
  const cmd = (fournisseurVoix?: string, source: "double" | "rush" = "double") => ({ distribution: [{ role: "Face caméra", source, fournisseurVoix }], prises: source === "rush" ? [{}] : undefined }) as unknown as CommandeFabrication;

  it("ROUGE — voix absente ou d'essai : « Reliez d'abord votre voix HeyGen dans Personnages. »", () => {
    expect(moteurAvocat.refusVoixEssai(cmd(undefined))).toBe("Reliez d'abord votre voix HeyGen dans Personnages.");
    expect(moteurAvocat.refusVoixEssai(cmd("simulation"))).toBe("Reliez d'abord votre voix HeyGen dans Personnages.");
    expect(moteurAvocat.refusVoixEssai(cmd("heygen"))).toBeNull();
    // Prises filmées (sa propre voix enregistrée) ou format sans personnage : rien à refuser.
    expect(moteurAvocat.refusVoixEssai(cmd(undefined, "rush"))).toBeNull();
    expect(moteurAvocat.refusVoixEssai({ distribution: [] } as unknown as CommandeFabrication)).toBeNull();
  });
});
