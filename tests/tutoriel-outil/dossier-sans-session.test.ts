/**
 * FIN-1 (P5, SÉCURITÉ) · la chaîne en fond lit le dossier .zip SANS session, avec les mêmes contrôles que `fichierEnvoye`.
 * `cookies()` et `exigerSession` lèvent (hors requête). Stockage simulé, `fetch` piégé qui rend un petit zip valide :
 * aucun réseau, 0 €. Les modules HeyGen / ElevenLabs lèvent s'ils sont appelés. Aucun réglage réel n'est allumé :
 * l'interrupteur `tutoriel.entreeZip` s'écrit seulement dans les dépôts en mémoire du test.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Fichier } from "@/domaine/types";
import { creerZip } from "@/lib/zip";

const horsRequete = vi.hoisted(() => ({ appelsCookies: 0, appelsSession: 0, appelsVoix: [] as string[], adressesLues: [] as string[] }));

vi.mock("next/headers", () => ({
  cookies: async () => {
    horsRequete.appelsCookies++;
    throw new Error("cookies() was called outside a request scope");
  },
  headers: async () => {
    throw new Error("headers() was called outside a request scope");
  },
}));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    horsRequete.appelsSession++;
    throw new Error("session exigée : hors requête");
  }),
}));

const espion = (nom: string) => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const vrai = await importOriginal();
  return Object.fromEntries(
    Object.entries(vrai).map(([cle, v]) => [
      cle,
      typeof v === "function" && /^[a-z]/.test(cle)
        ? () => {
            horsRequete.appelsVoix.push(`${nom}.${cle}`);
            throw new Error(`${nom}.${cle} ne doit pas être appelé sans voix`);
          }
        : v,
    ]),
  );
};
vi.mock("@/fournisseurs/heygen/voix", (o) => espion("heygen/voix")(o as never));
vi.mock("@/fournisseurs/heygen/client", (o) => espion("heygen/client")(o as never));
vi.mock("@/fournisseurs/heygen/rendus", (o) => espion("heygen/rendus")(o as never));
vi.mock("@/fournisseurs/credits/heygen", (o) => espion("credits/heygen")(o as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (o) => espion("credits/elevenlabs")(o as never));

// Stockage : l'adresse de lecture est fictive ; le seul réseau possible est le `fetch` piégé ci-dessous.
vi.mock("@/services/_commun", async (orig) => ({
  ...(await orig<object>()),
  fournisseur: vi.fn(async () => ({
    urlLectureDuree: async (cle: string, duree: number) => {
      horsRequete.adressesLues.push(`${cle}#${duree}`);
      return `https://stockage.invalide/${cle}`;
    },
    urlLecture: async (cle: string) => `https://stockage.invalide/${cle}`,
  })),
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { fichierDepotSansSession } = await import("@/services/tutoriel-dossier-fond");
const { portsEquipe, viderCacheDossier } = await import("@/services/tutoriel-equipe");

const LE = "2026-11-25T08:00:00.000Z";
const CLE_PRETE = "studio/dev/entree/v-1/f-zip1.zip";

function fichier(p: Partial<Fichier> = {}): Fichier {
  return { id: "f-zip1", cleStockage: CLE_PRETE, nom: "dossier.zip", mime: "application/zip", taille: 100, origine: "depot", statut: "pret", creeLe: LE, modifieLe: LE, ...p };
}

const ZIP = creerZip([{ nom: "index.html", donnees: new TextEncoder().encode("<html><body><h1 data-zone=\"titre\">Ventes</h1></body></html>") }]);
const fetchPiege = vi.fn(async (adresse: string) => {
  if (!String(adresse).startsWith("https://stockage.invalide/")) throw new Error(`réseau interdit : ${adresse}`);
  return { ok: true, arrayBuffer: async () => ZIP.buffer.slice(ZIP.byteOffset, ZIP.byteOffset + ZIP.byteLength) };
});

async function lireParLaChaine(fichierId: string) {
  const commande = { origine: "studio", entrees: { tutorielOutil: { depot: { mode: "dossier", fichierId, attestationImages: false } } } };
  return portsEquipe(commande as never, "v-1").lireDossier!();
}

beforeEach(async () => {
  reinitialiserDepots();
  viderCacheDossier();
  vi.stubGlobal("fetch", fetchPiege);
  fetchPiege.mockClear();
  Object.assign(horsRequete, { appelsCookies: 0, appelsSession: 0, appelsVoix: [], adressesLues: [] });
});

describe("hors requête : la chaîne en fond lit le dossier sans session", () => {
  it("le port lireDossier de l'équipe (sans fichiersDuDossier injecté) lit un fichier prêt, d'origine depot, sous entree", async () => {
    await depots().fichiers.enregistrer(fichier());
    await ecrireParametre("tutoriel.entreeZip", true);
    const dossier = await lireParLaChaine("f-zip1");
    expect(dossier).not.toBeNull();
    expect(horsRequete.appelsCookies).toBe(0);
    expect(horsRequete.appelsSession).toBe(0);
    expect(fetchPiege).toHaveBeenCalledTimes(1);
    expect(horsRequete.adressesLues).toEqual([`${CLE_PRETE}#300`]); // lecture limitée à 300 s
  });

  it("le contrôle d'origine : la même fonction pour l'interface (fichierEnvoye) exige toujours la session", async () => {
    const { fichierEnvoye } = await import("@/services/fichiers");
    await depots().fichiers.enregistrer(fichier());
    await expect(fichierEnvoye("f-zip1", "entree")).rejects.toThrow(/session exigée/);
  });

  it("0 appel HeyGen / ElevenLabs pendant la lecture", async () => {
    await depots().fichiers.enregistrer(fichier());
    await ecrireParametre("tutoriel.entreeZip", true);
    await lireParLaChaine("f-zip1");
    expect(horsRequete.appelsVoix).toEqual([]);
  });
});

describe("les contrôles de fichierEnvoye sont gardés", () => {
  const refus = async (id: unknown, code: string) => {
    await expect(fichierDepotSansSession(id, "entree")).rejects.toMatchObject({ name: "ErreurStudio", code });
  };

  it("accepte un fichier prêt, d'origine depot, de type entree", async () => {
    await depots().fichiers.enregistrer(fichier());
    await expect(fichierDepotSansSession("f-zip1", "entree")).resolves.toMatchObject({ id: "f-zip1" });
  });

  it.each([["id mal formé (chemin)", "../f-zip1"], ["id sans préfixe", "zip1"], ["id trop long", `f-${"a".repeat(41)}`], ["id vide", ""], ["id non texte", 42], ["id absent", undefined]])("refuse : %s", async (_n, id) => {
    await depots().fichiers.enregistrer(fichier());
    await refus(id, "FICHIER_INCONNU");
  });

  it("refuse un fichier absent", async () => refus("f-absent", "FICHIER_INCONNU"));

  it("refuse une origine autre que depot", async () => {
    await depots().fichiers.enregistrer(fichier({ origine: "generation" as never }));
    await refus("f-zip1", "FICHIER_INCONNU");
  });

  it("refuse un fichier qui n'appartient pas à la vidéo : autre type que entree", async () => {
    await depots().fichiers.enregistrer(fichier({ cleStockage: "studio/dev/bibliotheque/b-1/f-zip1.zip" }));
    await refus("f-zip1", "FICHIER_INCONNU");
  });

  it("refuse une clé de stockage vide ou trop courte", async () => {
    await depots().fichiers.enregistrer(fichier({ cleStockage: "" }));
    await refus("f-zip1", "FICHIER_INCONNU");
    await depots().fichiers.enregistrer(fichier({ cleStockage: "studio/dev" }));
    await refus("f-zip1", "FICHIER_INCONNU");
  });

  it("refuse un statut autre que pret", async () => {
    await depots().fichiers.enregistrer(fichier({ statut: "refuse" as never }));
    await refus("f-zip1", "ENVOI_INCOMPLET");
  });

  it("par le port de l'équipe : un fichier d'un autre type n'est ni téléchargé ni lu", async () => {
    await depots().fichiers.enregistrer(fichier({ cleStockage: "studio/dev/bibliotheque/b-1/f-zip1.zip" }));
    await ecrireParametre("tutoriel.entreeZip", true);
    await expect(lireParLaChaine("f-zip1")).rejects.toMatchObject({ code: "FICHIER_INCONNU" });
    expect(fetchPiege).not.toHaveBeenCalled();
  });
});

describe("interrupteur tutoriel.entreeZip", () => {
  it("éteint : l'extraction est refusée comme avant, même pour un fichier valide", async () => {
    await depots().fichiers.enregistrer(fichier());
    expect(await lireParLaChaine("f-zip1")).toBeNull();
  });

  it("éteint après un premier passage allumé : le cache est vidé, rien n'est servi", async () => {
    await depots().fichiers.enregistrer(fichier());
    await ecrireParametre("tutoriel.entreeZip", true);
    expect(await lireParLaChaine("f-zip1")).not.toBeNull();
    await ecrireParametre("tutoriel.entreeZip", false);
    expect(await lireParLaChaine("f-zip1")).toBeNull();
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("garde d'import : réservé à la chaîne en fond", () => {
  const racine = process.cwd();
  const tous = sources(join(racine, "src")).map((f) => ({ f: f.slice(racine.length + 1).replaceAll("\\", "/"), src: readFileSync(f, "utf8") }));
  const importeurs = tous.filter(({ src }) => /tutoriel-dossier-fond/.test(src)).map(({ f }) => f);

  it("seul src/services/tutoriel-equipe.ts l'importe (le module lui-même mis à part)", () => {
    expect(importeurs.filter((f) => f !== "src/services/tutoriel-dossier-fond.ts")).toEqual(["src/services/tutoriel-equipe.ts"]);
  });

  it("aucun fichier sous src/app ni src/components ne le cite", () => {
    expect(importeurs.filter((f) => f.startsWith("src/app/") || f.startsWith("src/components/"))).toEqual([]);
  });

  it("aucun fichier « use server » ne le cite, et lui-même n'est pas une action serveur", () => {
    const actions = tous.filter(({ src }) => /^\s*["']use server["']/m.test(src)).map(({ f }) => f);
    expect(importeurs.filter((f) => actions.includes(f))).toEqual([]);
    const propre = tous.find(({ f }) => f === "src/services/tutoriel-dossier-fond.ts")!;
    expect(propre.src).toContain('import "server-only"');
    expect(propre.src).not.toMatch(/["']use server["']/);
  });

  it("tutoriel-equipe.ts n'est lui-même importé par aucune action serveur ni composant en tant que module de lecture", () => {
    // Garde de compagnie : le seul point d'entrée est `portsEquipe` ; la fonction de lecture sans session n'est pas ré-exportée.
    const equipe = tous.find(({ f }) => f === "src/services/tutoriel-equipe.ts")!;
    expect(equipe.src).not.toMatch(/export\s*\{[^}]*fichierDepotSansSession/);
    expect(equipe.src).not.toMatch(/export\s+.*fichierDepotSansSession/);
  });
});
