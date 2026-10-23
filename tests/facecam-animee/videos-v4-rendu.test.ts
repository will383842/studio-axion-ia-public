/**
 * FACE CAMÉRA ANIMÉE v4 — côté service de rendu (18/10/2026, vidéo v-60359dd080b1 : « broll/ » sans nom de fichier, 404 à 99 % du montage).
 *  - les vidéos d'illustration arrivent en entrées signées « broll:<nom> » et sont rangées dans le dossier servi ;
 *  - REFUS PRÉCOCE (avant de télécharger la prise) d'un plan dont une plaquette à vidéo n'a pas ses médias, avec une phrase en français simple
 *    qui cite la plaquette et l'instant ; refus NON réessayable ;
 *  - un ancien studio qui n'envoie pas d'entrées « broll: » reste compris (tolérance).
 * Aucun rendu réel, aucun réseau : fonctions pures et dossiers temporaires.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { besoinVideosV4 } from "@/moteurs/montage-facecam-animee/videos-v4";
import { lireParametresFacecamV4, preparerMediasV4, PRISE_MONTEE_V4 } from "../../studio-rendu/src/operations/facecam-v4";
import { controlerMediasPlaquettesV4, PLAQUETTES_A_VIDEO_V4, telechargerVideosIllustrationV4 } from "../../studio-rendu/src/operations/medias-plaquettes-v4";

const gardes = [{ debutSec: 0, finSec: 10 }];
const plan = (elementsV4: unknown[]) => ({ elementsV4, duree: 30, fps: 30, prise: { src: PRISE_MONTEE_V4 }, sons: [] });
const avant = (extra: Record<string, unknown> = {}) => ({ id: "AvantApres", debut: 12.34, fin: 15, recherches: ["homme qui tape"], ...extra });

describe("rendu v4 · refus précoce d'une plaquette à vidéo sans media", () => {
  it("la table du rendu est celle du catalogue du studio (aucune dérive)", () => {
    const attendu = Object.fromEntries(CATALOGUE_V4.filter((f) => f.videos[1] > 0).map((f) => [f.id, f.videos[0]]));
    expect(PLAQUETTES_A_VIDEO_V4).toEqual(attendu);
    for (const id of Object.keys(attendu)) expect(besoinVideosV4(id)![0]).toBe(attendu[id]);
  });

  it("AvantApres sans medias : refus non réessayable, phrase en français qui cite la plaquette et l'instant", () => {
    let erreur: { erreur?: { reessayable?: boolean }; message?: string } | undefined;
    try {
      lireParametresFacecamV4({ plan: plan([avant()]), gardes });
    } catch (e) {
      erreur = e as typeof erreur;
    }
    expect(erreur).toBeDefined();
    expect(erreur!.erreur?.reessayable).toBe(false);
    expect(erreur!.message).toMatch(/AvantApres/);
    expect(erreur!.message).toMatch(/12,3 s/);
    expect(erreur!.message).toMatch(/vidéo/);
  });

  it("un medias vide, des clés vides ou une mosaïque trop courte sont refusés ; un plan complet passe", () => {
    expect(() => lireParametresFacecamV4({ plan: plan([avant({ medias: [] })]), gardes })).toThrow(/AvantApres/);
    expect(() => lireParametresFacecamV4({ plan: plan([avant({ medias: [""] })]), gardes })).toThrow(/AvantApres/);
    expect(() => lireParametresFacecamV4({ plan: plan([{ id: "MosaiqueVideos", debut: 5, fin: 8, medias: ["broll/v4-0-0.mp4", "broll/v4-0-1.mp4", "broll/v4-0-2.mp4"] }]), gardes })).toThrow(/MosaiqueVideos/);
    expect(() => lireParametresFacecamV4({ plan: plan([{ id: "duel-video", debut: 5, fin: 7, medias: ["broll/v4-1-0.mp4"] }]), gardes })).toThrow(/duel-video/);
    const ok = lireParametresFacecamV4({ plan: plan([avant({ medias: ["broll/v4-0-0.mp4"] }), { id: "dalle-claquee", debut: 20, fin: 21, mots: ["OUI"] }]), gardes });
    expect(ok.plan.elementsV4).toHaveLength(2);
  });

  it("présence dans le dossier servi : un media absent du dossier est refusé avec la plaquette et l'instant", () => {
    const els = [avant({ medias: ["broll/v4-0-0.mp4"] })];
    expect(() => controlerMediasPlaquettesV4(els, new Set(["v4-0-0.mp4"]))).not.toThrow();
    expect(() => controlerMediasPlaquettesV4(els, new Set(["autre.mp4"]))).toThrow(/AvantApres.*12,3 s|12,3 s.*AvantApres/);
    // les anciens plans (b-roll maison du dossier broll/) restent acceptés quand le fichier est servi
    expect(() => controlerMediasPlaquettesV4([avant({ medias: ["broll/broll-bureau-ordinateur.mp4"] })], new Set(["broll-bureau-ordinateur.mp4"]))).not.toThrow();
  });
});

describe("rendu v4 · vidéos d'illustration reçues en entrées « broll: »", () => {
  it("chaque entrée est téléchargée dans le dossier des médias sous son nom ; les autres entrées sont ignorées", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "rendu-v4-"));
    const telecharger = vi.fn(async (_url: string, fichier: string) => writeFileSync(fichier, "x"));
    const n = await telechargerVideosIllustrationV4({ prise: "https://p", "broll:v4-0-0.mp4": "https://s/0", "broll:v4-0-1.mp4": "https://s/1" }, dossier, telecharger);
    expect(n).toBe(2);
    expect(readdirSync(dossier).sort()).toEqual(["v4-0-0.mp4", "v4-0-1.mp4"]);
    expect(telecharger).toHaveBeenCalledTimes(2);
  });

  it("ancien studio sans entrées « broll: » : rien à faire, aucun refus", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "rendu-v4-"));
    expect(await telechargerVideosIllustrationV4({ prise: "https://p" }, dossier, vi.fn())).toBe(0);
  });

  it("un nom dangereux ou hors du préfixe « v4- » est refusé (pas de sortie du dossier, pas de doublon avec la banque)", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "rendu-v4-"));
    const telecharger = vi.fn();
    for (const nom of ["../x.mp4", "a/b.mp4", "broll-bureau-ordinateur.mp4", "v4-0-0.exe", "v4-.mp4"]) {
      await expect(telechargerVideosIllustrationV4({ [`broll:${nom}`]: "https://s/0" }, dossier, telecharger)).rejects.toMatchObject({ erreur: { reessayable: false } });
    }
    expect(telecharger).not.toHaveBeenCalled();
  });

  it("un doublon de nom avec la banque donne l'erreur française de déploiement (pas un EEXIST brut)", async () => {
    const racine = mkdtempSync(join(tmpdir(), "racine-v4-"));
    const ic = join(racine, "compositions", "interface-claire");
    for (const d of ["sons", "motion-v4/lot5/sons", "motion-v4/communs/broll", "motion-v4/lot5/polices", "motion-v4/lot5/marque", "motion-v4/lot2/polices"]) mkdirSync(join(ic, d), { recursive: true });
    mkdirSync(join(racine, "compositions", "commune", "polices"), { recursive: true });
    writeFileSync(join(ic, "motion-v4/lot2/polices/Montserrat-Black.ttf"), "x");
    writeFileSync(join(racine, "compositions/commune/polices/Inter-Bold.ttf"), "x");
    writeFileSync(join(ic, "motion-v4/communs/broll/v4-0-0.mp4"), "x");
    const dossier = mkdtempSync(join(tmpdir(), "rendu-v4-"));
    writeFileSync(join(dossier, "v4-0-0.mp4"), "x"); // la vidéo d'illustration déjà reçue
    await expect(preparerMediasV4(dossier, racine)).rejects.toMatchObject({ erreur: { reessayable: false }, message: expect.stringMatching(/deux fichiers portent le nom « v4-0-0\.mp4 »/) });
    expect(existsSync(join(dossier, "v4-0-0.mp4"))).toBe(true);
  });
});
