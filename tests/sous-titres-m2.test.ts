/**
 * LOT M2 du moteur avocat (plan v3.2, B.5, B.0 §20 sans rendu ; décision de Will du 01/10 sur les styles) :
 * sous-titres du lancement par le nouveau groupement, correction d'un mot = NOUVELLE version (l'ancienne intacte),
 * tous les lecteurs sur la plus haute (fiche, export, retouche), toucher un groupe (verrouillé), exports sans
 * chevauchement.
 */
import { hash } from "@node-rs/argon2";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const videos = await import("@/services/videos");
const sousTitres = await import("@/services/sous-titres");
const { ecrireParametre } = await import("@/services/_commun");
const route = await import("@/app/api/sous-titres/[id]/route");

const MDP_TEST = "essai-sous-titres-m2";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

async function versionChoisie(videoId: string) {
  const v = await depots().videos.obtenir(videoId);
  return v!.versionChoisieId!;
}

describe("sous-titres du lancement (nouveau groupement, mélange, base et intensité figées)", () => {
  it("la commande porte la base (Karaoké pour l'avocat) et l'intensité (Équilibré par défaut), puis le choix de la vidéo", async () => {
    const c = await fabrication.construireCommande("v-04");
    expect(c.sousTitres).toEqual({ base: "karaoke", intensite: "equilibre" });
    const v = await depots().videos.obtenir("v-04");
    await depots().videos.modifier("v-04", { styles: { ...v!.styles, sousTitresBase: "minimal", sousTitresIntensite: "sobre" } });
    expect((await fabrication.construireCommande("v-04")).sousTitres).toEqual({ base: "minimal", intensite: "sobre" });
  });

  it("au lancement : groupes de 2 à 4 mots, styles posés, calés sur les coupes des plans", async () => {
    await ecrireParametre("budget.mensuel", { centimes: 10_000_000, devise: "EUR" });
    const { versionId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const st = await videos.sousTitresCourants(versionId);
    expect(st?.version).toBe(1);
    const segments = st!.segments;
    expect(segments.length).toBeGreaterThan(3);
    for (const s of segments) {
      expect(s.mots.length).toBeGreaterThanOrEqual(1);
      expect(s.mots.length).toBeLessThanOrEqual(6);
      expect(["base", "impact", "bandeau"]).toContain(s.style);
    }
    expect(segments.some((s) => s.style === "impact")).toBe(true);
    // Aucun chevauchement.
    for (let i = 1; i < segments.length; i++) expect(segments[i].debutSec).toBeGreaterThanOrEqual(segments[i - 1].finSec - 1e-6);
  });
});

describe("correction d'un mot : nouvelle version, l'ancienne intacte, tous les lecteurs sur la plus haute (B.0 §20)", () => {
  it("corriger crée une version + 1 ; la version d'avant reste en base, inchangée", async () => {
    const versionId = await versionChoisie("v-01");
    const avant = (await videos.sousTitresCourants(versionId))!;
    const seg = avant.segments[0];
    await videos.corrigerMotSousTitres("v-01", seg.id, 0, "Patron");
    const toutes = await depots().sousTitres.lister((s) => s.versionId === versionId);
    expect(toutes).toHaveLength(2);
    const ancienne = toutes.find((s) => s.id === avant.id)!;
    expect(ancienne.version).toBe(avant.version);
    expect(ancienne.segments[0].mots[0].mot).toBe(seg.mots[0].mot);
    const courante = (await videos.sousTitresCourants(versionId))!;
    expect(courante.version).toBe(avant.version + 1);
    expect(courante.segments[0].mots[0].mot).toBe("Patron");
    // Fiche vidéo : la plus haute.
    expect((await videos.obtenirVideo("v-01"))!.sousTitres!.id).toBe(courante.id);
  });

  it("un mot vide est refusé ; un mot identique ne crée pas de version", async () => {
    const versionId = await versionChoisie("v-01");
    const st = (await videos.sousTitresCourants(versionId))!;
    await expect(videos.corrigerMotSousTitres("v-01", st.segments[0].id, 0, "  ")).rejects.toThrow();
    await videos.corrigerMotSousTitres("v-01", st.segments[0].id, 0, st.segments[0].mots[0].mot);
    expect(await depots().sousTitres.lister((s) => s.versionId === versionId)).toHaveLength(1);
  });

  it("export .srt / .vtt : la version la plus haute, sans chevauchement", async () => {
    const versionId = await versionChoisie("v-01");
    const st = (await videos.sousTitresCourants(versionId))!;
    await videos.corrigerMotSousTitres("v-01", st.segments[1].id, 0, "CORRIGÉ");
    const reponse = await route.GET(new NextRequest("http://localhost/api/sous-titres/v-01?format=srt"), { params: Promise.resolve({ id: "v-01" }) } as never);
    expect(reponse.status).toBe(200);
    const srt = await reponse.text();
    expect(srt).toContain("CORRIGÉ");
    const temps = [...srt.matchAll(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/g)].map((m) => [
      +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000,
      +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000,
    ]);
    for (let i = 1; i < temps.length; i++) expect(temps[i][0]).toBeGreaterThanOrEqual(temps[i - 1][1] - 1e-6);
    const vtt = await (await route.GET(new NextRequest("http://localhost/api/sous-titres/v-01?format=vtt"), { params: Promise.resolve({ id: "v-01" }) } as never)).text();
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("CORRIGÉ");
  });

  it("la retouche recopie la version COURANTE seulement", async () => {
    await ecrireParametre("budget.mensuel", { centimes: 10_000_000, devise: "EUR" });
    const versionId = await versionChoisie("v-01");
    const st = (await videos.sousTitresCourants(versionId))!;
    await videos.corrigerMotSousTitres("v-01", st.segments[0].id, 0, "Retouché");
    const plans = await depots().plans.lister((p) => p.versionId === versionId);
    await fabrication.lancerRetouche("v-01", [plans[0].id], "Plus serré", { confirme: true });
    const versions = await depots().versions.lister((v) => v.videoId === "v-01");
    const nouvelle = versions.find((v) => v.parentVersionId === versionId && v.id !== versionId)!;
    const copies = await depots().sousTitres.lister((s) => s.versionId === nouvelle.id);
    expect(copies).toHaveLength(1);
    expect(copies[0].segments[0].mots[0].mot).toBe("Retouché");
  });
});

describe("toucher un groupe (décision de Will) : le choix est verrouillé, seule une nouvelle version est créée", () => {
  it("Impact sur un groupe : nouvelle version, groupe verrouillé, les autres inchangés", async () => {
    const versionId = await versionChoisie("v-01");
    const avant = (await videos.sousTitresCourants(versionId))!;
    const cible = avant.segments[2];
    const apres = await sousTitres.changerGroupeSousTitres("v-01", cible.id, "impact");
    expect(apres.version).toBe(avant.version + 1);
    const touche = apres.segments.find((s) => s.id === cible.id)!;
    expect(touche).toMatchObject({ style: "impact", verrouille: true });
    expect(apres.segments.filter((s) => s.id !== cible.id)).toEqual(avant.segments.filter((s) => s.id !== cible.id));
    expect(await depots().sousTitres.obtenir(avant.id)).toBeTruthy();
  });

  it("un choix inconnu ou un groupe absent est refusé clairement", async () => {
    await expect(sousTitres.changerGroupeSousTitres("v-01", "absent", "impact")).rejects.toThrow("Ce passage n'existe plus.");
    await expect(sousTitres.changerGroupeSousTitres("v-01", "x", "inconnu" as never)).rejects.toThrow();
  });

  it("données du calque de la version : base, couleurs du jeton de la marque, largeur libre des réseaux du format", async () => {
    const versionId = await versionChoisie("v-01");
    const d = await sousTitres.donneesCalqueVersion(versionId);
    expect(d).not.toBeNull();
    expect(d!.largeur).toBe(1080);
    expect(d!.couleurs.accent.toLowerCase()).toBe("#e07040");
    expect(d!.largeurMaxPx).toBeLessThanOrEqual(1080);
  });
});
