/**
 * LOT E2 — IMPORT DEPUIS GOOGLE DRIVE (plan facecam v4, L1). Double de simulation SEULEMENT : aucun appel à Google.
 * Connexion (jeton anti-falsification, jetons chiffrés), sélecteur (récentes, recherche), copie côté serveur par le
 * même chemin que l'iPhone (succès, plafond du format, 15 Go facecam), refus (expirée → Reconnecter, refus → iPhone),
 * reprise après coupure (seuls les morceaux manquants sont relus, octets identiques).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gd = await import("@/services/google-drive");
const { creerDriveSimule, octetEssai, remplacerFournisseurDrive, configDrive, fournisseurDrive, RefusDrive } = await import("@/fournisseurs/google-drive");
const { requeteVideos, refusDepuisReponse, versVideo } = await import("@/fournisseurs/google-drive/http");
const { chiffrer, dechiffrer } = await import("@/lib/chiffrement-jeton");

import type { SessionTournage, VarianteReseau } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import type { VideoDrive } from "@/fournisseurs/google-drive";

const MDP = "essai-drive-lot-e2";
const MO = 1024 * 1024;
const GO = 1024 * MO;
const SANS_ATTENTE = { essaisMs: [0, 0, 0] };

const petite = (taille: number, id = "essai-petite"): VideoDrive => ({ id, nom: "Petite.MOV", mime: "video/quicktime", taille, dureeSec: 12.5, creeLe: "2026-10-09T08:00:00.000Z", modifieLe: "2026-10-09T08:00:00.000Z", vignette: true });

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  remplacerFournisseurDrive(null);
  await auth.seConnecter(MDP, false);
});

afterEach(() => remplacerFournisseurDrive(null));

/** Connexion complète au double (page Google simulée → retour). */
async function connecter(): Promise<void> {
  const { adresse } = await gd.lancerConnexionDrive();
  const etat = new URL(adresse, "http://studio").searchParams.get("state")!;
  await gd.terminerConnexionDrive("essai", etat);
}

async function seanceDe(formatId: string): Promise<string> {
  const d = depots();
  await d.variantes.enregistrer({ id: `var-${formatId}`, formatId } as unknown as VarianteReseau);
  const s = { id: `seance-${formatId}`, varianteIds: [`var-${formatId}`], prises: [], etat: "preparee", creeLe: "2026-10-09T09:00:00.000Z", modifieLe: "2026-10-09T09:00:00.000Z" } as unknown as SessionTournage;
  await d.sessionsTournage.enregistrer(s);
  return s.id;
}

describe("Drive · chiffrement et choix du fournisseur", () => {
  it("chiffre et déchiffre ; un jeton modifié ou une autre clé ne se lisent pas", () => {
    const env = { SESSION_SECRET: "s".repeat(40) };
    const p = chiffrer('{"acces":"secret"}', env);
    expect(p).not.toContain("secret");
    expect(dechiffrer(p, env)).toBe('{"acces":"secret"}');
    expect(dechiffrer(p.slice(0, -2) + "AA", env)).toBeNull();
    expect(dechiffrer(p, { SESSION_SECRET: "t".repeat(40) })).toBeNull();
  });

  it("le double est pris par défaut ; le vrai Drive exige FOURNISSEUR_GOOGLE_DRIVE=google et les deux clés", () => {
    expect(fournisseurDrive({}).mode).toBe("simulation");
    expect(configDrive({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toBeNull();
    expect(configDrive({ FOURNISSEUR_GOOGLE_DRIVE: "google", GOOGLE_CLIENT_ID: "id" })).toBeNull();
    expect(configDrive({ FOURNISSEUR_GOOGLE_DRIVE: "google", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", STUDIO_ADRESSE: "https://studio.exemple/" })).toMatchObject({ redirection: "https://studio.exemple/api/google-drive/retour" });
  });

  it("client réel (sans réseau) : recherche échappée, durée lue, refus traduits", async () => {
    expect(requeteVideos("l'avocat")).toBe("mimeType contains 'video/' and trashed = false and name contains 'l\\'avocat'");
    expect(versVideo({ id: "a", name: "b.mov", mimeType: "video/quicktime", size: "2048", videoMediaMetadata: { durationMillis: "95840" } })).toMatchObject({ taille: 2048, dureeSec: 95.8 });
    const rep = (status: number, corps: object) => new Response(JSON.stringify(corps), { status });
    expect((await refusDepuisReponse(rep(401, {}))).raison).toBe("expire");
    expect((await refusDepuisReponse(rep(400, { error: "invalid_grant" }))).raison).toBe("expire");
    expect((await refusDepuisReponse(rep(403, { error: { errors: [{ reason: "downloadQuotaExceeded" }] } }))).raison).toBe("quota");
    expect((await refusDepuisReponse(rep(403, {}))).raison).toBe("refuse");
    expect((await refusDepuisReponse(rep(404, {}))).raison).toBe("introuvable");
  });
});

describe("Drive · connexion une seule fois (Réglages › Mon Google Drive)", () => {
  it("relie le compte, garde les jetons chiffrés, refuse un jeton anti-falsification inconnu ou réutilisé", async () => {
    expect(await gd.etatDrive()).toMatchObject({ relie: false, simulation: true });
    const { adresse } = await gd.lancerConnexionDrive();
    const etat = new URL(adresse, "http://studio").searchParams.get("state")!;
    await expect(gd.terminerConnexionDrive("essai", "faux")).rejects.toMatchObject({ code: "DRIVE_LIEN" });
    // Le jeton est à usage unique : l'essai raté l'a consommé.
    await expect(gd.terminerConnexionDrive("essai", etat)).rejects.toMatchObject({ code: "DRIVE_LIEN" });
    await connecter();
    expect(await gd.etatDrive()).toMatchObject({ relie: true, compte: expect.stringContaining("essai") });
    const brut = JSON.stringify(await depots().parametres.obtenir("googleDrive.connexion"));
    expect(brut).not.toContain("essai-acces");
    expect(brut).not.toContain("essai-rafraichissement");
    await gd.deconnecterDrive();
    expect(await gd.etatDrive()).toMatchObject({ relie: false });
  });

  it("le jeton d'accès expiré est rafraîchi tout seul", async () => {
    let decalage = 2 * 3600_000; // premier jeton d'une heure, donné il y a deux heures
    const d = creerDriveSimule({ maintenant: () => Date.now() - decalage });
    const rafraichir = vi.spyOn(d, "rafraichir");
    remplacerFournisseurDrive(d);
    await connecter();
    decalage = 0;
    await expect(gd.listerVideosDrive()).resolves.toMatchObject({ videos: expect.any(Array) });
    expect(rafraichir).toHaveBeenCalledWith("essai-rafraichissement");
    // Le nouveau jeton est gardé : pas de second rafraîchissement.
    await gd.listerVideosDrive();
    expect(rafraichir).toHaveBeenCalledTimes(1);
  });
});

describe("Drive · sélecteur", () => {
  it("les vidéos récentes d'abord, recherche par nom", async () => {
    await connecter();
    const { videos } = await gd.listerVideosDrive();
    expect(videos.map((v) => v.nom)[0]).toBe("IMG_7747.MOV");
    expect(videos.every((v) => v.taille > 0 && v.creeLe)).toBe(true);
    const r = await gd.listerVideosDrive({ recherche: "opco" });
    expect(r.videos.map((v) => v.nom)).toEqual(["Formation OPCO - prise 2.mp4"]);
  });

  it("sans connexion : « Connexion au Drive expirée — Reconnecter »", async () => {
    await expect(gd.listerVideosDrive()).rejects.toMatchObject({ code: "DRIVE_EXPIRE", message: "Connexion au Drive expirée — Reconnecter." });
  });
});

describe("Drive · copie côté serveur (même chemin que l'iPhone)", () => {
  it("succès : le fichier est enregistré « prêt » avec sa taille et sa durée, prêt à ranger comme prise", async () => {
    await connecter();
    const v = await gd.importerDepuisDrive({ driveId: "essai-formation-opco", typeEntite: "rush", entiteId: "seance-x" }, SANS_ATTENTE);
    expect(["en_attente", "en_cours"]).toContain(v.statut);
    const fin = await gd.attendreImportDrive(v.id);
    expect(fin).toMatchObject({ statut: "termine", octetsFaits: 820 * MO, fichierId: expect.stringMatching(/^f/) });
    const f = await depots().fichiers.obtenir(fin!.fichierId!);
    expect(f).toMatchObject({ nom: "Formation OPCO - prise 2.mp4", mime: "video/mp4", taille: 820 * MO, dureeSec: 63, origine: "depot" });
  });

  it("le plafond du format s'applique : 14 Go passe en facecam, pas en avocat (4 Go)", async () => {
    await connecter();
    const avocat = await seanceDe("avocat");
    await expect(gd.importerDepuisDrive({ driveId: "essai-longue", typeEntite: "rush", entiteId: avocat })).rejects.toMatchObject({ code: "TAILLE_INVALIDE", message: "Ce fichier dépasse 4 Go." });
    const facecam = await seanceDe("facecam");
    const v = await gd.importerDepuisDrive({ driveId: "essai-longue", typeEntite: "rush", entiteId: facecam }, SANS_ATTENTE);
    expect(await gd.attendreImportDrive(v.id)).toMatchObject({ statut: "termine", octetsFaits: 14 * GO });
  });

  it("au-delà de 15 Go ou un fichier qui n'est pas une vidéo : refus clair", async () => {
    remplacerFournisseurDrive(creerDriveSimule({ videos: [petite(16 * GO, "enorme"), { ...petite(MO, "doc"), mime: "application/pdf" }] }));
    await connecter();
    await expect(gd.importerDepuisDrive({ driveId: "enorme", typeEntite: "rush", entiteId: "s" })).rejects.toMatchObject({ message: "Cette vidéo dépasse 15 Go." });
    await expect(gd.importerDepuisDrive({ driveId: "doc", typeEntite: "rush", entiteId: "s" })).rejects.toMatchObject({ code: "PAS_UNE_VIDEO" });
  });

  it("refus : connexion expirée → Reconnecter ; accès refusé pendant la copie → Envoyez depuis l'iPhone", async () => {
    await connecter();
    remplacerFournisseurDrive(creerDriveSimule({ refus: "expire" }));
    await expect(gd.importerDepuisDrive({ driveId: "essai-img-7747", typeEntite: "rush", entiteId: "s" })).rejects.toMatchObject({ code: "DRIVE_EXPIRE", message: "Connexion au Drive expirée — Reconnecter." });

    // Refus en cours de copie (droits retirés) : le double refuse la lecture.
    const d = creerDriveSimule({ videos: [petite(30 * MO)] });
    remplacerFournisseurDrive(d);
    d.lirePlage = async () => {
      throw new RefusDrive("refuse", "Google refuse l'accès.");
    };
    const v = await gd.importerDepuisDrive({ driveId: "essai-petite", typeEntite: "rush", entiteId: "s" }, SANS_ATTENTE);
    expect(await gd.attendreImportDrive(v.id)).toMatchObject({ statut: "refuse", action: "iphone", message: "Google refuse l'accès à cette vidéo. Envoyez-la depuis l'iPhone." });
    await expect(gd.reprendreImportDrive(v.id)).rejects.toMatchObject({ code: "DRIVE_REFUS" });
  });

  it("reprise : une coupure met en pause ; « Reprendre » ne relit que les morceaux manquants", async () => {
    // 35 Mo → 4 morceaux de 10 Mo ; 2 réussis, puis 4 échecs (tous les essais du 3e morceau).
    const d = creerDriveSimule({ videos: [petite(35 * MO)], coupures: 4, coupureApres: 2 });
    remplacerFournisseurDrive(d);
    await connecter();
    const v = await gd.importerDepuisDrive({ driveId: "essai-petite", typeEntite: "rush", entiteId: "s" }, SANS_ATTENTE);
    const pause = await gd.attendreImportDrive(v.id);
    expect(pause).toMatchObject({ statut: "en_pause", action: "reprendre", octetsFaits: 20 * MO });
    expect(pause!.message).toMatch(/reprendra là où elle s'est arrêtée/);
    await gd.reprendreImportDrive(v.id, SANS_ATTENTE);
    expect(await gd.attendreImportDrive(v.id)).toMatchObject({ statut: "termine", octetsFaits: 35 * MO });
    // Morceaux 1 et 2 lus une seule fois, 3 et 4 après la reprise.
    expect(d.lectures.map((l) => l.debut / (10 * MO))).toEqual([0, 1, 2, 3]);
  });
});

describe("Drive · cœur de la copie avec un stockage multipart (octets réels)", () => {
  /** Stockage multipart en mémoire : garde les morceaux, refuse de terminer s'il en manque. */
  function stockageMemoire() {
    const morceaux = new Map<number, Uint8Array>();
    const s: StockageFichiers = {
      id: "memoire",
      type: "stockage",
      nom: "Mémoire",
      reelPrevu: "R2",
      mode: "reel",
      capacites: { asynchrone: false, accordExige: false },
      async preparerDepot() {
        return { cleStockage: "studio/dev/rush/s/f1.mov", urlDepot: "" };
      },
      async confirmerDepot() {
        return { ok: true };
      },
      async urlLecture() {
        return "";
      },
      multipart: {
        async commencer() {
          return { idEnvoi: "env-1" };
        },
        async signerMorceaux(_c: string, _i: string, numeros: number[]) {
          return Object.fromEntries(numeros.map((n: number) => [n, `memoire://${n}`]));
        },
        async morceauxRecus() {
          return [...morceaux].map(([numero, o]) => ({ numero, etag: `e${numero}`, taille: o.length }));
        },
        async terminer() {
          return { ok: true };
        },
      },
    } as unknown as StockageFichiers;
    const deposer = async (adresse: string, octets: Uint8Array) => {
      const n = Number(adresse.split("//")[1]);
      morceaux.set(n, octets);
      return `e${n}`;
    };
    return { s, deposer, morceaux };
  }

  it("coupure puis reprise : les morceaux déjà dans le stockage ne sont pas relus, le fichier assemblé est identique", async () => {
    const taille = 25 * MO + 123;
    const drive = creerDriveSimule({ videos: [petite(taille)], coupures: 4, coupureApres: 1 });
    const { s, deposer, morceaux } = stockageMemoire();
    const notes: unknown[] = [];
    const depart = { id: "drv-1", driveId: "essai-petite", nom: "Petite.MOV", mime: "video/quicktime", taille, dureeSec: 12.5, typeEntite: "rush", entiteId: "s", fichierId: "f1", cle: "studio/dev/rush/s/f1.mov", idEnvoi: "env-1", tailleMorceau: 10 * MO, faits: [], octetsFaits: 0, statut: "en_attente" as const, creeLe: "", modifieLe: "" };
    const dep = { drive, acces: async () => "essai-acces-1", stockage: s, deposer, enregistrer: async (i: unknown) => void notes.push(i), essaisMs: [0, 0, 0] };

    const pause = await gd.transfererParMorceaux(depart, dep);
    expect(pause).toMatchObject({ statut: "en_pause", raison: "reseau", octetsFaits: 10 * MO });
    expect([...morceaux.keys()]).toEqual([1]);

    // Le stockage fait foi : la reprise part de ce qu'il a reçu, même si la note locale est perdue.
    const fin = await gd.transfererParMorceaux({ ...pause, faits: [] }, dep);
    expect(fin).toMatchObject({ statut: "en_cours", octetsFaits: taille });
    expect(fin.faits.map((f) => f.numero)).toEqual([1, 2, 3]);
    expect(drive.lectures.map((l) => l.debut)).toEqual([0, 10 * MO, 20 * MO]);
    const tout = Buffer.concat([1, 2, 3].map((n) => morceaux.get(n)!));
    expect(tout.length).toBe(taille);
    for (const i of [0, 10 * MO - 1, 10 * MO, taille - 1]) expect(tout[i]).toBe(octetEssai("essai-petite", i));
    expect(notes.length).toBeGreaterThan(3);
  });

  it("connexion expirée pendant la copie : rafraîchie une fois, la copie continue", async () => {
    const drive = creerDriveSimule({ videos: [petite(5 * MO)] });
    const { s, deposer } = stockageMemoire();
    const acces = vi.fn(async (forcer?: boolean) => (forcer ? "essai-acces-neuf" : "perime"));
    const depart = { id: "drv-2", driveId: "essai-petite", nom: "Petite.MOV", mime: "video/quicktime", taille: 5 * MO, dureeSec: 0, typeEntite: "rush", entiteId: "s", fichierId: "f1", cle: "studio/dev/rush/s/f1.mov", idEnvoi: "env-1", tailleMorceau: 10 * MO, faits: [], octetsFaits: 0, statut: "en_attente" as const, creeLe: "", modifieLe: "" };
    const fin = await gd.transfererParMorceaux(depart, { drive, acces, stockage: s, deposer, enregistrer: async () => undefined, essaisMs: [0] });
    expect(fin).toMatchObject({ statut: "en_cours", octetsFaits: 5 * MO });
    expect(acces).toHaveBeenCalledWith(true);
  });
});
