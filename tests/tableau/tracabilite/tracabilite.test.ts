/**
 * TRAÇABILITÉ DU TABLEAU ANIMÉ : ajout seul, reconstruction rejouable depuis un journal témoin, coût total exact,
 * export CSV (une ligne par événement), et le bloc « Historique » absent pour un autre format. Dépôts en mémoire,
 * aucun appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

/** Le format est actif ; le cas « masqué » est SIMULÉ (`ouvert = false`), sans lire la valeur réelle du statut. */
const aiguillage = vi.hoisted(() => ({ ouvert: false }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string; statut: string } | null | undefined) => (aiguillage.ouvert ? vrai.ecranTableauVisible(f as never) : false) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/tableau-tracabilite");
const { coutTotalCentimes, enCsv } = await import("@/domaine/tracabilite-tableau");

const MDP = "tableau-tracabilite";
const VIDEO = "v-03";
const h = (c: string) => c.repeat(32);

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  aiguillage.ouvert = true;
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Journal témoin d'une fabrication : voix payée `cout` centimes (empreinte `voix`), 2 scènes, vidéo, master, vignette. */
function journal(voix: string, cout: number, reutilise = false) {
  return {
    version: "fabrication-tableau/1",
    etapes: {
      fiche: { empreinte: h("f"), dureeMs: 5, sortie: { scenes: [{}, {}], stylo: "crayon/1" } },
      script: { empreinte: h("e"), dureeMs: 7, sortie: { resume: "ok" } },
      voix: { empreinte: voix, dureeMs: 20_000, sortie: { fichierCle: `studio/dev/voix/${voix}.wav`, dureeSec: 41, coutCentimes: cout, caracteres: 335, fournisseur: "heygen", reutilise } },
      scenes: { empreinte: h("s"), dureeMs: 56_000, sortie: { cles: { s1: `studio/dev/scenes/v/${h("1")}.mp4`, s2: `studio/dev/scenes/v/${h("2")}.mp4` } } },
      composition: { empreinte: h("c"), dureeMs: 20_000, sortie: { sortieCle: "studio/dev/v/video.mp4", masterCle: "studio/dev/v/master.mp4", vignetteCle: "studio/dev/v/vignette.jpg", mesures: {}, alertes: [] } },
    },
  };
}

async function videoTemoin() {
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  await depots().versions.modifier(ver.id, { projetMontage: { moteur: "montage-tableau", tableau: { journal: journal(h("a"), 10) } } });
  return ver;
}

/** Ajoute une version produite par une retouche, avec son journal. */
async function versionRetouchee(parent: { id: string; commande: never }, numero: number, voix: string, cout: number, reutilise = false) {
  const id = `ver-retouche-${numero}`;
  await depots().versions.enregistrer({
    ...(await depots().versions.obtenir(parent.id))!,
    id,
    numero,
    parentVersionId: parent.id,
    travailId: undefined,
    creeLe: `2026-10-1${numero}T10:00:00.000Z`,
    modifieLe: `2026-10-1${numero}T10:00:00.000Z`,
    projetMontage: { moteur: "montage-tableau", tableau: { journal: journal(voix, cout, reutilise), retouchee: true } },
  });
  await depots().retouches.enregistrer({ id: `ret-${numero}`, videoId: VIDEO, versionId: parent.id, planIds: [], consigne: "Changer ce qui est dit — scène 2", statut: "terminee", versionProduiteId: id, creeLe: `2026-10-1${numero}T09:00:00.000Z`, modifieLe: `2026-10-1${numero}T09:00:00.000Z` } as never);
}

const parType = <T extends { type: string }>(evs: T[], t: string) => evs.filter((e) => e.type === t);

describe("ajout seul", () => {
  it("un événement déjà écrit n'est ni modifié ni remplacé, et le service n'offre ni modification ni suppression", async () => {
    const base = { videoId: VIDEO, type: "code" as const, cle: "code:test", date: "2026-10-11T10:00:00.000Z", ordre: 0, origine: "fabrication" as const, donnees: { chaine: "v1" } };
    const un = await service.ajouterEvenement(base);
    const deux = await service.ajouterEvenement({ ...base, date: "2030-01-01T00:00:00.000Z", centimes: 999, donnees: { chaine: "v2" } });
    expect(un.ajoute).toBe(true);
    expect(deux.ajoute).toBe(false);
    const liste = await service.lireHistorique(VIDEO);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toEqual(un.evenement);
    expect(liste[0].donnees).toEqual({ chaine: "v1" });
    expect(liste[0].centimes).toBeUndefined();
    const noms = Object.keys(service);
    expect(noms.filter((n) => /modifier|supprimer|retirer|effacer|purger/i.test(n))).toEqual([]);
  });
});

describe("reconstruction depuis le journal de fabrication", () => {
  it("donne les bons événements, et rejouée n'en duplique ni n'en change aucun", async () => {
    await videoTemoin();
    const bilan = await service.reconstruireHistorique(VIDEO);
    const evs = await service.lireHistorique(VIDEO);
    expect(bilan.ajoutes).toBe(evs.length);
    expect(parType(evs, "script")).toHaveLength(1);
    expect(parType(evs, "fiche")).toHaveLength(1);
    expect(parType(evs, "voix")).toHaveLength(1);
    expect(parType(evs, "etape")).toHaveLength(5);
    expect(parType(evs, "code")[0].donnees.chaine).toBe("fabrication-tableau/1");
    const fichiers = parType(evs, "fichier").map((e) => e.donnees.role).sort();
    expect(fichiers).toEqual(["master", "scene", "scene", "video", "vignette", "voix"]);
    expect(parType(evs, "fichier").find((e) => e.donnees.role === "scene")!.donnees.empreinte).toBe(h("1"));
    expect(parType(evs, "voix")[0].donnees).toMatchObject({ dureeSec: 41, caracteres: 335, fournisseur: "heygen" });
    expect(parType(evs, "voix")[0].centimes).toBe(10);
    expect(parType(evs, "controle")).toHaveLength(2);

    const avant = JSON.stringify(evs);
    const encore = await service.reconstruireHistorique(VIDEO);
    expect(encore.ajoutes).toBe(0);
    expect(encore.dejaLa).toBe(evs.length);
    expect(JSON.stringify(await service.lireHistorique(VIDEO))).toBe(avant);
  });

  it("une retouche s'ajoute à la suite, sans toucher à l'existant", async () => {
    const ver = await videoTemoin();
    await service.reconstruireHistorique(VIDEO);
    const avant = await service.lireHistorique(VIDEO);
    await versionRetouchee(ver as never, 2, h("b"), 25);
    const bilan = await service.reconstruireHistorique(VIDEO);
    const apres = await service.lireHistorique(VIDEO);
    expect(bilan.ajoutes).toBeGreaterThan(0);
    for (const e of avant) expect(apres.find((x) => x.id === e.id)).toEqual(e);
    expect(parType(apres, "retouche")).toHaveLength(1);
    expect(parType(apres, "fiche")[0].donnees.origine).not.toBe("correction");
  });
});

describe("coût total", () => {
  it("additionne la voix de chaque version, sans compter deux fois une voix reprise", async () => {
    const ver = await videoTemoin();
    await versionRetouchee(ver as never, 2, h("b"), 25); // voix refaite : 25 c
    await versionRetouchee(ver as never, 3, h("b"), 25, true); // même voix reprise : rien de plus
    await versionRetouchee(ver as never, 4, h("a"), 10, true); // voix d'origine reprise : rien de plus
    await service.reconstruireHistorique(VIDEO);
    expect(await service.coutTotal(VIDEO)).toBe(35);
    expect(parType(await service.lireHistorique(VIDEO), "voix")).toHaveLength(2);
  });

  it("la page de la vidéo montre UNE somme, la vraie : écriture, découpage et voix payés, comme « Coût payé »", async () => {
    await videoTemoin();
    const ligne = (etape: string, c: number) => ({ etape, fournisseur: "essai", unite: "appel" as const, quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" as const }, total: { centimes: c, devise: "EUR" as const }, nature: "reel" as const });
    const le = new Date().toISOString();
    for (const [id, etape, c] of [["dep-ecr", "Tableau · script", 41], ["dep-dec", "Tableau · découpage", 24], ["dep-voix", "voix", 41]] as const) {
      await depots().depenses.enregistrer({ id, videoId: VIDEO, lignes: [ligne(etape, c)], total: { centimes: c, devise: "EUR" }, date: le, creeLe: le, modifieLe: le });
    }
    const vue = await service.historiqueTableau(VIDEO);
    const { coutsDeLaVideo } = await import("@/services/cout-video");
    expect(vue!.coutTotalCentimes).toBe(106);
    expect(vue!.coutTotalCentimes).toBe((await coutsDeLaVideo(VIDEO)).paye.centimes);
  });

  it("ignore ce qui n'a pas de coût", () => {
    expect(coutTotalCentimes([{ centimes: 10 }, {}, { centimes: 5 }])).toBe(15);
    expect(coutTotalCentimes([])).toBe(0);
  });
});

describe("export", () => {
  it("le CSV a une ligne par événement (plus l'en-tête) et dit les phrases lisibles", async () => {
    await videoTemoin();
    await service.reconstruireHistorique(VIDEO);
    const evs = await service.lireHistorique(VIDEO);
    const csv = await service.exporterCsv(VIDEO);
    const lignes = csv.split("\r\n").filter(Boolean);
    expect(lignes).toHaveLength(evs.length + 1);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toMatch(/Voix enregistrée · 41 s · 0,10\s€/);
    expect(csv).toContain("Vidéo verticale produite");
    expect(enCsv(evs).split("\r\n").filter(Boolean)).toHaveLength(evs.length + 1);
  });

  it("le JSON porte tous les événements et le coût total", async () => {
    await videoTemoin();
    await service.reconstruireHistorique(VIDEO);
    const evs = await service.lireHistorique(VIDEO);
    const json = JSON.parse(await service.exporterJson(VIDEO));
    expect(json.evenements).toHaveLength(evs.length);
    expect(json.coutTotalCentimes).toBe(10);
  });
});

describe("publication saisie à la main", () => {
  it("ajoute un événement, et refuse un réseau, une date ou un lien invalides", async () => {
    await videoTemoin();
    const avant = (await service.lireHistorique(VIDEO)).length;
    const e = await service.noterPublication(VIDEO, { reseau: "tiktok", date: "2026-10-12", lien: "https://www.tiktok.com/@axion/video/1" });
    expect(e.origine).toBe("saisie");
    expect((await service.lireHistorique(VIDEO)).length).toBe(avant + 1);
    await expect(service.noterPublication(VIDEO, { reseau: "inconnu", date: "2026-10-12" })).rejects.toThrow();
    await expect(service.noterPublication(VIDEO, { reseau: "tiktok", date: "2026-13-45" })).rejects.toThrow();
    await expect(service.noterPublication(VIDEO, { reseau: "tiktok", date: "2026-10-12", lien: "javascript:alert(1)" })).rejects.toThrow();
    expect((await service.lireHistorique(VIDEO)).length).toBe(avant + 1);
  });
});

describe("le bloc ne s'affiche que pour le tableau animé", () => {
  it("rien pour un autre format, ni pour le tableau si le format est masqué (simulé)", async () => {
    await videoTemoin();
    expect(await service.historiqueTableau(VIDEO)).not.toBeNull();
    const ecrits = (await service.lireHistorique(VIDEO)).length;
    await depots().videos.modifier(VIDEO, { formatId: "facecam" });
    expect(await service.historiqueTableau(VIDEO)).toBeNull();
    await expect(service.telechargerHistorique(VIDEO, "csv")).rejects.toThrow();
    await expect(service.noterPublication(VIDEO, { reseau: "tiktok", date: "2026-10-12" })).rejects.toThrow();
    expect(await service.lireHistorique(VIDEO)).toHaveLength(ecrits);
    await depots().videos.modifier(VIDEO, { formatId: "tableau-anime" });
    aiguillage.ouvert = false; // format masqué
    expect(await service.historiqueTableau(VIDEO)).toBeNull();
  });

  it("format actif : le bloc d'historique du tableau s'affiche", async () => {
    await videoTemoin();
    aiguillage.ouvert = true;
    expect(await service.historiqueTableau(VIDEO)).not.toBeNull();
  });
});
