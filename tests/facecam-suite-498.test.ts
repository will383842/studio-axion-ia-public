/**
 * Suite de la relecture de #498 (face caméra sans texte, téléprompteur) : lecture iPad sans perte du texte écrit,
 * « Fermer » qui revient d'où l'on vient, envoi sans texte propre, bouton grisé honnête. Aucun réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { variablesDuCatalogue } from "@/fournisseurs/catalogue";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.setConfig({ testTimeout: 60_000 });

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");

describe("point 2 · lecture iPad : le texte écrit n'est jamais perdu", () => {
  it("le lien « Lire sur l'iPad » s'ouvre dans un nouvel onglet (l'assistant reste là), sans accès à l'ouvreur", () => {
    const script = lire("src/assistant/etapes/Script.tsx");
    const lien = script.match(/<a\s[^>]*href=\{lienLecture\([\s\S]*?>/)?.[0] ?? "";
    expect(lien).toContain('target="_blank"');
    expect(lien).toContain('rel="noopener');
  });

  it("« Fermer » revient en arrière quand il y a un historique, sinon à l'assistant (jamais à l'accueil)", async () => {
    const { fermetureLecture, LIEN_FERMETURE_LECTURE } = await import("@/domaine/teleprompteur");
    expect(fermetureLecture(3)).toBe("retour");
    expect(fermetureLecture(2)).toBe("retour");
    expect(fermetureLecture(1)).toBe("assistant");
    expect(fermetureLecture(0)).toBe("assistant");
    expect(LIEN_FERMETURE_LECTURE).not.toBe("/");
    expect(LIEN_FERMETURE_LECTURE).toMatch(/^\/nouvelle\/facecam/);
  });

  it("la page de lecture utilise cette règle", () => {
    const page = lire("src/components/tournage/LecturePrompteur.tsx");
    expect(page).toContain("fermetureLecture");
    expect(page).not.toMatch(/<Link href="\/"/);
  });

  it("« Fermer » sans historique tente window.close() puis, si l'onglet reste ouvert, va à l'assistant après ≈150 ms", () => {
    const page = lire("src/components/tournage/LecturePrompteur.tsx").replace(/\r\n/g, "\n");
    const i = page.indexOf("window.close()");
    expect(i).toBeGreaterThanOrEqual(0);
    const suite = page.slice(i);
    expect(suite).toMatch(/window\.closed/);
    expect(suite).toMatch(/setTimeout\([\s\S]*?routeur\.push\(LIEN_FERMETURE_LECTURE\)[\s\S]*?150\)/);
    expect(page).toContain("routeur.back()");
  });
});

describe("points 3 à 5 · envoi sans texte et bouton grisé", () => {
  it("point 3 : le titre repris est celui du brouillon, à défaut son sujet", async () => {
    const { titreDejaFilme } = await import("@/domaine/facecam-script");
    expect(titreDejaFilme({ titre: " Ma vidéo ", sujet: "Un sujet" })).toBe("Ma vidéo");
    expect(titreDejaFilme({ titre: "  ", sujet: " Un sujet " })).toBe("Un sujet");
    expect(titreDejaFilme({ titre: "", sujet: "" })).toBeUndefined();
  });

  it("point 3 : le brouillon vidéo déjà créé est archivé, pas laissé orphelin", () => {
    const express = lire("src/assistant/etapes/Express.tsx");
    expect(express).toContain("abandonnerBrouillonAction");
    expect(express).not.toContain("archiverVideosAction");
    expect(express).toMatch(/titreDejaFilme\(brouillon\)/);
  });

  it("point 3 : l'archivage du brouillon ne peut pas faire échouer l'envoi (isolé, sans doublon au nouvel essai)", () => {
    const express = lire("src/assistant/etapes/Express.tsx").replace(/\r\n/g, "\n");
    expect(express).toMatch(/await abandonnerBrouillonAction\(brouillon\.videoId\)\.catch\(\(\) => undefined\)/);
  });

  it("point 4 : l'envoi sans texte ne reste pas bloqué sur « chargement » si l'action lève", () => {
    const express = lire("src/assistant/etapes/Express.tsx").replace(/\r\n/g, "\n");
    const debut = express.indexOf("if (!scriptFacultatif(formatId)) return ouvrirScript();");
    const fin = express.indexOf("setLancement(true);\n    try {\n      const r = await chargerCout");
    expect(debut).toBeGreaterThanOrEqual(0);
    expect(fin).toBeGreaterThan(debut);
    const bloc = express.slice(debut, fin);
    expect(bloc).toMatch(/try \{/);
    expect(bloc).toMatch(/finally \{[\s\S]*setLancement\(false\)/);
  });

  it("point 5 : sans texte (script facultatif), l'aperçu budget/refus ne grise pas le bouton", async () => {
    const { boutonFabriquerGrise } = await import("@/domaine/facecam-script");
    const base = { aTexte: false, formatId: "facecam", budgetDepasse: true, refus: true };
    expect(boutonFabriquerGrise(base)).toBe(false);
    expect(boutonFabriquerGrise({ ...base, formatId: "avocat" })).toBe(true);
    expect(boutonFabriquerGrise({ ...base, aTexte: true })).toBe(true);
    expect(boutonFabriquerGrise({ ...base, aTexte: true, budgetDepasse: false, refus: false })).toBe(false);
    expect(boutonFabriquerGrise({ ...base, formatId: "avocat", budgetDepasse: false, refus: false })).toBe(true);
  });

  it("point 5 : le bouton et la phrase du dessous utilisent la même règle", () => {
    const express = lire("src/assistant/etapes/Express.tsx");
    expect(express).toContain("boutonFabriquerGrise(");
    expect(express).toMatch(/!aTexte && scriptFacultatif\(formatId\) \?[\s\S]{0,200}vidéo déjà filmée\.<\/p>\s*\) : !aTexte/);
  });
});

const MDP = "essai-facecam-suite-498";
const environnementDepart = { ...process.env };
const fetchDepart = globalThis.fetch;
const appelsReseau: unknown[] = [];

async function charger() {
  vi.resetModules();
  for (const n of Object.keys(process.env)) if (n.startsWith("FOURNISSEUR_") || n.startsWith("MOTEUR_")) delete process.env[n];
  for (const n of variablesDuCatalogue()) delete process.env[n];
  const memoire = await import("@/donnees/memoire");
  memoire.reinitialiserDepots();
  reinitialiserRequete();
  const auth = await import("@/services/auth");
  await auth.seConnecter(MDP, false);
  (await import("@/services/boucle-generation")).suspendreBoucleGeneration(true);
  return {
    depots: memoire.depots,
    envoi: await import("@/services/envoi-facecam"),
    tournage: await import("@/services/tournage"),
    actions: await import("@/app/(studio)/envoyer/actions"),
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
  globalThis.fetch = ((...a: unknown[]) => {
    appelsReseau.push(a);
    throw new Error("fetch interdit dans ce test");
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = fetchDepart;
  process.env = { ...environnementDepart };
  vi.resetModules();
});

describe("point 6 · une version sans texte est listée à tourner et à envoyer", () => {
  it("listerVersionsATourner et versionsFacecamAEnvoyer la retrouvent, avec le titre donné", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte("", "Ma vidéo sans texte");
    const aTourner = await r.tournage.listerVersionsATourner();
    const v = aTourner.find((x) => x.id === varianteId);
    expect(v).toBeDefined();
    expect(v?.formatId).toBe("facecam");
    expect(v?.titre).toBe("Ma vidéo sans texte");
    expect(await r.envoi.versionsFacecamAEnvoyer()).toEqual([{ varianteId, titre: "Ma vidéo sans texte" }]);
  });

  it("une version sans texte ni titre garde un titre lisible dans l'envoi (jamais vide)", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte(undefined);
    const [e] = await r.envoi.versionsFacecamAEnvoyer();
    expect(e.varianteId).toBe(varianteId);
    expect(e.titre.trim()).not.toBe("");
  });
});

describe("point 6 · aucun appel Claude pour envoyer une vidéo déjà filmée sans texte", () => {
  it("l'action (celle du bouton) crée la version sans réseau, sans génération, sans écriture de texte", async () => {
    const r = await charger();
    appelsReseau.length = 0;
    const res = await r.actions.creerVersionDejaFilmeeAction(undefined, "Titre du brouillon");
    expect(res.ok).toBe(true);
    expect(appelsReseau).toEqual([]);
    expect(await r.depots().generations.lister()).toEqual([]);
    if (res.ok) expect((await r.envoi.vueEnvoiFacecam(res.donnees.varianteId))?.titre).toBe("Titre du brouillon");
  });
});

describe("point 3 · seul un brouillon est archivé (action serveur dédiée)", () => {
  it("l'action abandonnerBrouillonAction existe côté serveur et passe par abandonnerBrouillon", () => {
    const actions = lire("src/app/(studio)/videos/actions.ts");
    expect(actions).toMatch(/export async function abandonnerBrouillonAction\(/);
    expect(actions).toMatch(/exigerSession\(\);[\s\S]{0,120}essayer\(\(\) => abandonnerBrouillon\(/);
  });
});

describe("point 3 · abandonnerBrouillon sur dépôts en mémoire : seul le statut « brouillon » est archivé", () => {
  it.each(["maquette", "echec"] as const)("un brouillon au statut « %s » n'est PAS archivé", async (statut) => {
    const r = await charger();
    const { abandonnerBrouillon, creerBrouillon } = await import("@/services/videos");
    const id = await creerBrouillon("facecam");
    await r.depots().videos.modifier(id, { statut });
    await abandonnerBrouillon(id);
    const v = await r.depots().videos.obtenir(id);
    expect(v?.statut).toBe(statut);
    expect(v?.statutAvantArchive).toBeUndefined();
  });

  it("un brouillon au statut « brouillon » est archivé (jamais effacé), avec son statut d'avant", async () => {
    const r = await charger();
    const { abandonnerBrouillon, creerBrouillon } = await import("@/services/videos");
    const id = await creerBrouillon("facecam");
    expect((await r.depots().videos.obtenir(id))?.statut).toBe("brouillon");
    await abandonnerBrouillon(id);
    const v = await r.depots().videos.obtenir(id);
    expect(v?.statut).toBe("archivee");
    expect(v?.statutAvantArchive).toBe("brouillon");
  });
});
