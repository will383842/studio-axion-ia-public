/**
 * L5-09 · reprise après échec et file « À corriger ». Faux fournisseur, dépôts en mémoire, faux stockage : aucun appel réel,
 * aucun envoi réel, données fictives. L'interrupteur éditorial (L7-08) est ÉTEINT par défaut.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const pub = await import("@/services/publications");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { reessayerEnvoi } = await import("@/services/reprise-envois");
const { construireFileACorriger, LIBELLE_A_CORRIGER, LIBELLE_MES_TEXTES } = await import("@/services/calendrier-reprogrammation");

const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CIBLE = "compte-1:li:42";
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;
const refusNet = () => new ErreurZernio("refuse", "refus", { statut: 400 });
const reponsePerdue = () => new ErreurZernio("indisponible", "coupure", { statut: 503 });

let appels: DemandePublication[] = [];
let relectures = 0;
let comportement: (n: number) => Promise<{ idExterne: string; via: "zernio"; statut: "brouillon" }>;
const faux = (): FournisseurPublication =>
  ({
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [{ id: CIBLE, organisationId: "zernio", nom: "Page LinkedIn", service: "linkedin", genre: "page" }],
    envoyer: async (d: DemandePublication) => {
      appels.push(d);
      return comportement(appels.length);
    },
    publicationsRecentes: async () => {
      relectures++;
      return [];
    },
  }) as unknown as FournisseurPublication;

const ok = async () => ({ idExterne: "ext-1", via: "zernio" as const, statut: "brouillon" as const });
const echoue = (e: () => Error) => async (): Promise<never> => {
  throw e();
};

async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

async function creerVisuel(): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs courantes", entree: { type: "sujet", sujet: "exemple" }, statut: "valide", modeTexte: "api",
    versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le,
    rendu: { empreinte: "e1", pdfCle: "visuels/vis_1/carrousel.pdf", vignetteCle: "visuels/vis_1/v.png", pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })), renduLe: le },
  } as never);
  await depots().creneauxEditoriaux.enregistrer({
    id: "cr-1", jourVise: DEMAIN.slice(0, 10), heuresParReseau: { linkedin: DEMAIN }, compteCible: CIBLE, visuelId: "vis_1",
    textes: { linkedin: { texte: "Légende d'exemple", premierCommentaire: "" } }, statut: "valide", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur",
  } as never);
}

const pubs = () => depots().publications.lister((p) => p.visuelId === "vis_1");
const total = () => depots().publications.compter();
const premiere = async () => (await pubs())[0]!;

/** Premier envoi normal, qui échoue : laisse une publication « refusée » (ou « à vérifier »). */
async function premierEchec(e: () => Error): Promise<string> {
  comportement = echoue(e);
  await expect(pub.envoyerVisuel(faux(), "cr-1", "linkedin", { lireUrl })).rejects.toBeTruthy();
  appels = [];
  return (await premiere()).id;
}
const reprise = (id: string) => reessayerEnvoi(id, { service: faux(), lireUrl });

beforeEach(async () => {
  appels = [];
  relectures = 0;
  comportement = ok;
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  reinitialiserRequete();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("L5-09 · interrupteur éteint = aucun essai", () => {
  it("réglage éditorial éteint (défaut) : refus, 0 appel, 0 relecture, rien d'écrit", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false);
    const avant = await total();
    await expect(reprise(id)).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    expect(relectures).toBe(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["calendrier fermé", PARAM_ENVOI_CALENDRIER],
    ["envoi général coupé", PARAM_ARRET_ZERNIO],
  ] as const)("%s : refus, 0 appel", async (_n, param) => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    await ecrireParametre(param, false);
    await expect(reprise(id)).rejects.toMatchObject({ code: expect.stringMatching(/FERME|ZERNIO|CALENDRIER/) });
    expect(appels).toHaveLength(0);
  });

  it("même une publication « à vérifier » n'est pas relue quand l'interrupteur est éteint", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(reponsePerdue);
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false);
    await expect(reprise(id)).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(relectures).toBe(0);
    expect(appels).toHaveLength(0);
  });
});

describe("L5-09 · un seul nouvel essai après un échec net", () => {
  it("un refus net : UN nouvel essai, qui passe par l'envoi normal et réussit", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    comportement = ok;
    const r = await reprise(id);
    expect(r.action).toBe("envoye");
    expect(appels).toHaveLength(1);
    expect(appels[0]!.mode).toBe("brouillon");
    expect((await pubs()).filter((p) => p.etatEnvoi === "envoye")).toHaveLength(1);
  });

  it("le nouvel essai échoue aussi : un troisième appel n'a JAMAIS lieu, même demandé plusieurs fois", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    comportement = echoue(refusNet);
    await expect(reprise(id)).rejects.toBeTruthy();
    expect(appels).toHaveLength(1);
    for (let i = 0; i < 3; i++) await expect(reprise(id)).rejects.toMatchObject({ code: "REPRISE_DEJA_FAITE" });
    expect(appels).toHaveLength(1);
    expect(await pubs()).toHaveLength(2);
  });

  it("deux demandes en même temps : un seul appel", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    comportement = echoue(refusNet);
    const r = await Promise.allSettled([reprise(id), reprise(id)]);
    expect(appels).toHaveLength(1);
    expect(r.every((x) => x.status === "rejected")).toBe(true);
  });

  it("le créneau a changé depuis l'échec : rien ne part, c'est à reprogrammer", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    await depots().creneauxEditoriaux.modifier("cr-1", { heuresParReseau: { linkedin: new Date(Date.parse(DEMAIN) + 3600_000).toISOString() } } as never);
    await expect(reprise(id)).rejects.toMatchObject({ code: "CRENEAU_CHANGE" });
    expect(appels).toHaveLength(0);
  });

  it("une garde de l'envoi normal refuse (créneau retiré) : 0 appel", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    await depots().creneauxEditoriaux.modifier("cr-1", { retireLe: "2026-11-13T10:00:00Z" } as never);
    await expect(reprise(id)).rejects.toBeTruthy();
    expect(appels).toHaveLength(0);
  });
});

describe("L5-09 · « à vérifier » = relecture seule, jamais de renvoi", () => {
  it("relit chez le diffuseur, n'envoie rien, ne change rien d'autre", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(reponsePerdue);
    const avant = await total();
    const r = await reprise(id);
    expect(r.action).toBe("relu");
    expect(appels).toHaveLength(0);
    expect(relectures).toBeLessThanOrEqual(1);
    expect(await total()).toBe(avant);
    expect((await premiere()).etatEnvoi).toBe("a-verifier");
  });

  it("répété plusieurs fois : toujours 0 envoi", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(reponsePerdue);
    for (let i = 0; i < 4; i++) await reprise(id);
    expect(appels).toHaveLength(0);
  });

  it("le nouvel essai se perd (réponse perdue) : il devient « à vérifier », plus aucun envoi ensuite", async () => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    comportement = echoue(reponsePerdue);
    await expect(reprise(id)).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(appels).toHaveLength(1);
    const lui = (await pubs()).find((p) => p.etatEnvoi === "a-verifier")!;
    await reprise(lui.id);
    await expect(reprise(id)).rejects.toBeTruthy();
    expect(appels).toHaveLength(1);
  });
});

describe("L5-09 · ce qui est en cours ou envoyé ne repart jamais", () => {
  it.each(["en-cours", "envoye"] as const)("publication %s : refus, 0 appel", async (etat) => {
    await creerVisuel();
    await ouvrirTout();
    const id = await premierEchec(refusNet);
    await depots().publications.modifier(id, { etatEnvoi: etat, statut: "brouillon" } as never);
    await expect(reprise(id)).rejects.toMatchObject({ code: "REPRISE_REFUSEE" });
    expect(appels).toHaveLength(0);
  });

  it("publication inconnue : refus, 0 appel", async () => {
    await ouvrirTout();
    await expect(reprise("pub_inconnue")).rejects.toMatchObject({ code: "REPRISE_REFUSEE" });
    expect(appels).toHaveLength(0);
  });
});

describe("L5-09 · aucun PUT automatique, aucun appel réseau direct", () => {
  it("le code neuf ne contient ni PUT, ni fetch, ni modification de publication chez le diffuseur", () => {
    for (const f of ["src/services/reprise-envois.ts", "src/services/calendrier-reprogrammation.ts", "src/app/(studio)/calendrier/a-reprogrammer/page.tsx"]) {
      const s = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(s, f).not.toMatch(/\bPUT\b|\bfetch\s*\(|method:\s*["']PUT|modifierPost|mettreAJourPost/);
    }
  });
});

describe("L5-09 · file « À corriger » et libellés", () => {
  const base = { reseau: "linkedin", via: "zernio", statut: "echec", date: DEMAIN, texte: "t", canalId: CIBLE, visuelId: "vis_1", cleEnvoi: "k1", creeLe: "2026-11-12T10:00:00Z", modifieLe: "2026-11-12T10:00:00Z" };

  it("libellés visibles", () => {
    expect(LIBELLE_A_CORRIGER).toBe("À corriger");
    expect(LIBELLE_MES_TEXTES).toBe("Mes textes");
  });

  it("un refus net seul : reessayer ; deux refus : à la main ; à vérifier : relire ; envoyé ou en cours : absent de la file", () => {
    const f = construireFileACorriger([
      { ...base, id: "a", etatEnvoi: "refuse" },
      { ...base, id: "b", etatEnvoi: "refuse", cleEnvoi: "k2" },
      { ...base, id: "b2", etatEnvoi: "refuse", cleEnvoi: "k2" },
      { ...base, id: "c", etatEnvoi: "a-verifier", statut: "brouillon", cleEnvoi: "k3" },
      { ...base, id: "d", etatEnvoi: "envoye", statut: "brouillon", cleEnvoi: "k4" },
      { ...base, id: "e", etatEnvoi: "en-cours", statut: "brouillon", cleEnvoi: "k5" },
      { ...base, id: "f", etatEnvoi: "refuse", cleEnvoi: "k6" },
      { ...base, id: "g", etatEnvoi: "envoye", statut: "brouillon", cleEnvoi: "k6" },
    ] as never);
    const parId = Object.fromEntries(f.map((l) => [l.publicationId, l.action]));
    expect(parId.a).toBe("reessayer");
    expect(Object.values(parId).filter((x) => x === "a-la-main")).toHaveLength(1);
    expect(parId.c).toBe("relire");
    expect(Object.keys(parId)).not.toEqual(expect.arrayContaining(["d"]));
    expect(Object.keys(parId)).not.toEqual(expect.arrayContaining(["e"]));
    expect(f.some((l) => l.publicationId === "f" || l.publicationId === "g")).toBe(false);
  });

  it("l'écran et les services n'écrivent ni « À reprogrammer », ni « Stock », ni nom d'outil", () => {
    for (const f of ["src/services/calendrier-reprogrammation.ts", "src/app/(studio)/calendrier/a-reprogrammer/page.tsx"]) {
      const s = readFileSync(resolve(process.cwd(), f), "utf8");
      const chaines = (s.match(/"[^"\n]*"|`[^`\n]*`|>[^<>{}\n]+</g) ?? []).join("\n");
      expect(chaines, f).not.toMatch(/À reprogrammer|Stock|Zernio|Buffer|Claude/);
    }
    const page = readFileSync(resolve(process.cwd(), "src/app/(studio)/calendrier/a-reprogrammer/page.tsx"), "utf8");
    expect(page).toContain("À corriger");
  });
});
