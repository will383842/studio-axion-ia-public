/**
 * LOT R5 — étalonnage et son RÉELS (outils du serveur), chemin complet du studio : un vrai `studio-rendu` local
 * (serveur HTTP et files du conteneur ; les opérations y sont remplacées par des opérations d'essai qui notent les
 * demandes), `FOURNISSEUR_ETALONNAGE=studio-rendu`, `FOURNISSEUR_SON=studio-rendu`, stockage R2 signé localement et
 * joué par un faux seau en mémoire (aucun envoi sur Internet, aucune clé réelle, aucun appel payant).
 * ROUGE prouvé sur 03d297b : « LUT importée → image après présente ».
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { DemandeRendu } from "../studio-rendu/src/contrat";
import { FilesRendu } from "../studio-rendu/src/files";
import { creerServeur } from "../studio-rendu/src/serveur";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

// Un studio-rendu local : les demandes sont notées et réussissent.
const recues: DemandeRendu[] = [];
const files = new FilesRendu({
  operations: {
    etalonnage: async (d) => {
      recues.push(d);
      return { mesures: { tailleLut: 17, intensite: Number(d.parametres.intensite), largeur: 960, hauteur: 540 } };
    },
    mixage: async (d) => {
      recues.push(d);
      return { mesures: { lufs: -14.1, creteVraieDbtp: -1.9, lra: 4, dureeSec: 12 } };
    },
  },
});
const serveur: Server = creerServeur(files);
await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));

// Faux seau R2 : seules les adresses `*.r2.cloudflarestorage.com` sont interceptées.
const seau = new Map<string, Uint8Array>();
const fetchReel = globalThis.fetch;
const cleDe = (url: string) => decodeURIComponent(new URL(url).pathname.replace(/^\/studio-essai\//, ""));
vi.stubGlobal("fetch", async (entree: string | URL | Request, init?: RequestInit) => {
  const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
  if (!/\.r2\.cloudflarestorage\.com\//.test(url)) return fetchReel(entree, init);
  const cle = cleDe(url);
  const methode = (init?.method ?? "GET").toUpperCase();
  if (methode === "PUT") {
    seau.set(cle, new Uint8Array(init?.body as ArrayBuffer));
    return new Response(null, { status: 200 });
  }
  if (!seau.has(cle)) return new Response(null, { status: 404 });
  return new Response(methode === "HEAD" ? null : (seau.get(cle) as unknown as BodyInit), { status: 200 });
});

const ENV_AVANT = { ...process.env };
const VARIABLES = {
  STUDIO_RENDU_URL: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`,
  FOURNISSEUR_ETALONNAGE: "studio-rendu",
  FOURNISSEUR_SON: "studio-rendu",
  FOURNISSEUR_STOCKAGE: "r2",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "cle-essai",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "studio-essai",
};
Object.assign(process.env, VARIABLES);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const actions = await import("@/app/(studio)/bibliotheque/actions");
const { resoudreFournisseur } = await import("@/fournisseurs");

const MDP = "r5-etalonnage-son";

afterAll(() => {
  serveur.close();
  vi.unstubAllGlobals();
  for (const k of Object.keys(VARIABLES)) {
    if (ENV_AVANT[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_AVANT[k];
  }
});

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  recues.length = 0;
  seau.clear();
  await auth.seConnecter(MDP, false);
});

/** Une LUT 17³ « chaude » saine (gris qui monte toujours), écrite comme un vrai fichier .cube. */
function cubeChaud(n = 17): string {
  const lignes = ['TITLE "Chaud essai"', `LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) {
        const [x, y, z] = [r / (n - 1), g / (n - 1), b / (n - 1)];
        lignes.push(`${Math.min(1, x * 1.06 + 0.01).toFixed(6)} ${Math.min(1, y * 1.0).toFixed(6)} ${(z * 0.9).toFixed(6)}`);
      }
  return lignes.join("\n") + "\n";
}

describe("R5 · une LUT importée reçoit sa vraie image « après »", () => {
  it("ROUGE (03d297b) : LUT importée → image après présente", { timeout: 60_000 }, async () => {
    const contenu = cubeChaud();
    const r = await actions.importerLutAction({ nom: "Chaud essai", fichier: { nom: "chaud.cube", mime: "", taille: contenu.length }, contenu, tailleCube: 17 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = (await depots().elements.obtenir(r.donnees.id))!;
    if (e.valeur.type !== "lut") throw new Error("type");
    expect(e.valeur.apresFichierId, "image après").toBeTruthy();
    expect(e.valeur.apresFichierId).not.toBe(e.valeur.avantFichierId);
    const apres = (await depots().fichiers.obtenir(e.valeur.apresFichierId!))!;
    expect(apres.cleStockage).toMatch(new RegExp(`^studio/dev/elements/${e.id}/apres-[a-z0-9]+\\.jpg$`));
  });

  it("les VRAIS octets du .cube et de l'image de référence sont lus par le serveur ; une seule demande, à 100 %", { timeout: 60_000 }, async () => {
    const contenu = cubeChaud();
    const r = await actions.importerLutAction({ nom: "Chaud essai", fichier: { nom: "chaud.cube", mime: "", taille: contenu.length }, contenu, tailleCube: 17 });
    if (!r.ok) throw new Error(r.message);
    expect(recues).toHaveLength(1);
    const d = recues[0];
    expect(d).toMatchObject({ operation: "etalonnage", file: "courte", parametres: { intensite: 1 } });
    const e = (await depots().elements.obtenir(r.donnees.id))!;
    const cube = (await depots().fichiers.obtenir(e.fichierId!))!;
    // Le .cube est dans le seau, octet pour octet ; l'image de référence publique y a été copiée une fois.
    expect(new TextDecoder().decode(seau.get(cube.cleStockage))).toBe(contenu);
    expect(cleDe(d.entrees.lut)).toBe(cube.cleStockage);
    expect(cleDe(d.entrees.image)).toBe("studio/dev/public/demo/lut/avant.jpg");
    expect(seau.get("studio/dev/public/demo/lut/avant.jpg")?.byteLength).toBeGreaterThan(10_000);
    expect(d.entrees.image).toMatch(/X-Amz-Signature=/);
    // Rien n'est effacé : l'image avant n'a pas changé.
    expect(e.valeur.type === "lut" && e.valeur.avantFichierId).toBeTruthy();
  });

  it("un .cube déjà envoyé par le navigateur (gros fichier) est repris tel quel", { timeout: 60_000 }, async () => {
    const contenu = cubeChaud();
    const cle = "studio/dev/element/lut/f-envoye.cube";
    seau.set(cle, new TextEncoder().encode(contenu));
    await depots().fichiers.enregistrer({ id: "f-envoye", cleStockage: cle, nom: "gros.cube", mime: "application/octet-stream", taille: contenu.length, origine: "depot", statut: "pret", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
    const r = await actions.importerLutAction({ nom: "Gros", fichier: { nom: "gros.cube", mime: "", taille: contenu.length }, contenu: null, tailleCube: 17, fichierId: "f-envoye" });
    if (!r.ok) throw new Error(r.message);
    expect((await depots().elements.obtenir(r.donnees.id))!.fichierId).toBe("f-envoye");
    expect(cleDe(recues[0].entrees.lut)).toBe(cle);
    expect(r.donnees.apres).toBe(true);
  });

  /** Un .cube « envoyé par le navigateur » : fiche du fichier + octets dans le faux seau. */
  async function cubeDepose(id: string, octets: Uint8Array, extra: { statut?: "pret" | "en_attente"; taille?: number } = {}) {
    const cle = `studio/dev/element/lut/${id}.cube`;
    seau.set(cle, octets);
    await depots().fichiers.enregistrer({ id, cleStockage: cle, nom: "x.cube", mime: "application/octet-stream", taille: extra.taille ?? octets.byteLength, origine: "depot", statut: extra.statut ?? "pret", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
  }
  const importer = (fichierId: string, contenu: string | null) => actions.importerLutAction({ nom: "X", fichier: { nom: "x.cube", mime: "", taille: 1 }, contenu, tailleCube: 17, fichierId });

  it("sécurité : un .cube pas encore arrivé (« en attente ») est refusé", async () => {
    const contenu = cubeChaud();
    await cubeDepose("f-attente", new TextEncoder().encode(contenu), { statut: "en_attente" });
    expect((await importer("f-attente", contenu)).ok).toBe(false);
  });

  it("sécurité : au-delà de 50 Mo (annoncés ou réellement stockés), refus clair", async () => {
    await cubeDepose("f-annonce", new TextEncoder().encode(cubeChaud()), { taille: 60 * 1024 * 1024 });
    const r1 = await importer("f-annonce", null);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.message).toMatch(/50 Mo/);
    // 51 Mo d'« é » (2 octets chacun) : moins de 50 millions de signes, seul le COMPTE DES OCTETS lus peut l'arrêter.
    const e = new Uint8Array(51 * 1024 * 1024);
    for (let i = 0; i < e.length; i += 2) [e[i], e[i + 1]] = [0xc3, 0xa9];
    await cubeDepose("f-ment", e, { taille: 1000 });
    const r2 = await importer("f-ment", null);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.message).toMatch(/50 Mo/);
  });

  it("sécurité : le .cube gardé est CELUI qui a été vérifié (octets stockés relus et validés)", async () => {
    const contenu = cubeChaud();
    // Contenu vérifié par le navigateur ≠ octets réellement envoyés : refus.
    await cubeDepose("f-autre-octets", new TextEncoder().encode(contenu.replace("0.010000", "0.020000")));
    expect((await importer("f-autre-octets", contenu)).ok).toBe(false);
    // Gros fichier (contenu non transmis) : ce qui est stocké doit être une LUT valide.
    await cubeDepose("f-casse", new TextEncoder().encode("LUT_3D_SIZE 17\n0 0 0\n"));
    expect((await importer("f-casse", null)).ok).toBe(false);
    expect(recues).toHaveLength(0);
  });

  it("sécurité : une taille annoncée hors des tailles lues (256) est refusée avant tout dépôt", async () => {
    const avant = (await depots().fichiers.lister(() => true)).length;
    const r = await actions.importerLutAction({ nom: "X", fichier: { nom: "x.cube", mime: "", taille: 1 }, contenu: null, tailleCube: 256 });
    expect(r.ok).toBe(false);
    expect((await depots().fichiers.lister(() => true)).length).toBe(avant);
  });

  // Relecture sécurité R45 (tête 2ec5382) — n° 1, 2, 8 et 9 côté studio.
  it("sécurité R45 n° 1-2 : le .cube stocké est lu au fil du flux ; piégé (sauts de ligne, jeton géant) → refus rapide, sans mémoire géante", { timeout: 30_000 }, async () => {
    await cubeDepose("f-sauts", new Uint8Array(50 * 1024 * 1024 - 64).fill(0x0a));
    // Tas du moteur (chaînes, tableaux) : la copie des 50 Mo faite par le faux seau lui-même (hors tas) n'y compte pas.
    const avant = process.memoryUsage().heapUsed;
    const r1 = await importer("f-sauts", null);
    expect(process.memoryUsage().heapUsed - avant).toBeLessThan(50 * 1024 * 1024);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.message).toMatch(/trop de lignes vides/);
    await cubeDepose("f-jeton", new TextEncoder().encode("LUT_3D_SIZE 17\n0 0 " + "1".repeat(1024 * 1024) + "x\n"));
    const debut = performance.now();
    const r2 = await importer("f-jeton", null);
    expect(performance.now() - debut).toBeLessThan(500);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.message).toMatch(/beaucoup trop longue/);
    // Un vrai .cube envoyé passe toujours, comparé morceau par morceau au contenu vérifié par le navigateur.
    const contenu = cubeChaud();
    await cubeDepose("f-bon", new TextEncoder().encode(contenu));
    expect((await importer("f-bon", contenu)).ok).toBe(true);
    await cubeDepose("f-plus-long", new TextEncoder().encode(contenu + "# fin\n"));
    expect((await importer("f-plus-long", contenu)).ok).toBe(false);
  });

  it("sécurité R45 n° 8 : en stockage réel, ni fichier envoyé ni contenu → refus, rien n'est gardé", async () => {
    const avant = (await depots().fichiers.lister(() => true)).length;
    const r = await actions.importerLutAction({ nom: "Sans octets", fichier: { nom: "x.cube", mime: "", taille: 7_000_000 }, contenu: null, tailleCube: 65 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/n'a pas pu être lu/);
    expect((await depots().fichiers.lister(() => true)).length).toBe(avant);
    expect((await depots().elements.lister(() => true)).filter((e) => e.nom === "Sans octets")).toHaveLength(0);
  });

  it("sécurité R45 n° 9 : un stockage réel qui ne sait pas relire le fichier → refus (le raccourci « même longueur » est réservé à la simulation)", async () => {
    const contenu = cubeChaud();
    await cubeDepose("f-sans-lecture", new TextEncoder().encode(contenu));
    const stockage = resoudreFournisseur("stockage") as { urlLectureDuree?: unknown };
    const lecture = stockage.urlLectureDuree;
    stockage.urlLectureDuree = undefined;
    try {
      const r = await importer("f-sans-lecture", contenu);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/ne peut pas être relu/);
    } finally {
      stockage.urlLectureDuree = lecture;
    }
  });

  it("un fichier qui n'est pas une LUT envoyée n'est jamais repris", async () => {
    await depots().fichiers.enregistrer({ id: "f-autre", cleStockage: "studio/dev/video/v-1/f-autre.mp4", nom: "x.mp4", mime: "video/mp4", taille: 1, origine: "depot", statut: "pret", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
    const r = await actions.importerLutAction({ nom: "X", fichier: { nom: "x.cube", mime: "", taille: 1 }, contenu: null, tailleCube: 17, fichierId: "f-autre" });
    expect(r.ok).toBe(false);
  });
});

describe("R5 · fournisseurs réels inscrits et choisis", () => {
  it("étalonnage et son « studio-rendu » : réels, gratuits, choisis par FOURNISSEUR_<TYPE>", () => {
    for (const type of ["etalonnage", "son"] as const) {
      const f = resoudreFournisseur(type);
      expect(f).toMatchObject({ id: "studio-rendu", mode: "reel" });
      expect(f.capacites.tarif).toBeUndefined();
    }
  });

  it("mixer : une demande « mixage » (file longue), niveau mesuré rendu", async () => {
    const son = resoudreFournisseur("son");
    const r = await son.mixer({ voixCle: "x", bruitageIds: [], niveauCibleLufs: -14, baisseSousVoixDb: 12, source: { voixUrl: "https://r2.exemple/voix.wav", musiqueUrl: "https://r2.exemple/musique.wav", depot: { cle: "studio/dev/son/mix.wav", urlDepot: "https://r2.exemple/depot" } } });
    expect(r).toEqual({ fichierCle: "studio/dev/son/mix.wav", niveauLufs: -14.1, creteVraieDbtp: -1.9 });
    expect(recues[0]).toMatchObject({ operation: "mixage", file: "longue", entrees: { voix: "https://r2.exemple/voix.wav", musique: "https://r2.exemple/musique.wav" }, parametres: { lufs: -14, creteVraieMaxDbtp: -1.5, baisseSousVoixDb: 12 } });
  });

  it("sans source (rien dans le stockage) : refus clair, jamais un faux résultat", async () => {
    await expect(resoudreFournisseur("son").mixer({ voixCle: "x", bruitageIds: [], niveauCibleLufs: -14, baisseSousVoixDb: 12 })).rejects.toThrow(/stockage/);
    await expect(resoudreFournisseur("etalonnage").appliquer({ fichierCle: "x", lutId: "l", intensite: 1 })).rejects.toThrow(/stockage/);
  });
});
