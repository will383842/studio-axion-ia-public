/**
 * LOT R7e — corrections après relecture (`docs/controles/RELECTURE-R7E-a18f218.md`).
 *  n° 2 : fond uni + deux angles — les passages du second angle sont des mp4 (H.264) : la composition choisit le
 *         décodeur selon le format réel (vp9 seulement pour un webm), sinon elle échouait après paiement.
 *  n° 3 : chaque feuille qui lance une vidéo payante « confirmée d'office » dit que l'avatar parle, et pour combien.
 * Aucun appel réseau, aucune clé.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProprietesImageAvocat } from "@/moteurs/montage-avocat/scene";
import { argumentsImageFfmpeg, type FichiersImage } from "../studio-rendu/src/composition/image-ffmpeg";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/ecrire/sujets/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: null })) }));
// Feuilles montrées ouvertes : on lit ce que Will voit avant de toucher « Lancer ».
vi.mock("@/components/ui/FeuilleBas", () => ({ FeuilleBas: ({ children, pied }: { children?: unknown; pied?: unknown }) => createElement("div", null, children as never, pied as never) }));

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

const proprietes = (ext: string): ProprietesImageAvocat => ({
  ratio: "9:16",
  largeur: 1080,
  hauteur: 1920,
  fps: 25,
  images: 50,
  decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
  doubles: {
    principal: { type: "video", url: "entree:double-principal", transparent: false },
    second: { type: "tranches", transparent: false, morceaux: [{ url: "entree:double-second-0", debutSec: 0.5, finSec: 1.5 }].map((m) => ({ ...m, url: `${m.url}${ext}` })) },
  },
  plans: [
    { debutSec: 0, finSec: 1, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } },
    { debutSec: 1, finSec: 2, type: "double", angle: "second", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } },
  ],
});
const fichiers = (ext: string): FichiersImage => ({
  doubles: { principal: { fichier: `principal${ext}`, video: true }, second: { fichier: `s0${ext}`, video: true, tranches: [{ fichier: `s0${ext}`, debutSec: 0.5, finSec: 1.5 }] } },
  illustrations: {},
  luts: [],
  son: "son.wav",
});
const couleurs = { grainPct: 0, grainTaillePx: 2, vignettePct: 0 };
/** Options de lecture placées juste avant `-i fichier`. */
const avant = (args: string[], fichier: string) => args.slice(Math.max(0, args.indexOf(fichier) - 3), args.indexOf(fichier));

describe("n° 2 — fond uni, deux angles : décodeur choisi selon le format réel du passage", () => {
  it("ROUGE — passages mp4 : aucun décodeur vp9 imposé ; passages webm : vp9 (transparence) comme avant", () => {
    const mp4 = argumentsImageFfmpeg(proprietes(".mp4"), couleurs, fichiers(".mp4"), 2, "master.mov");
    expect(avant(mp4, "s0.mp4")).not.toContain("libvpx-vp9");
    expect(avant(mp4, "principal.mp4")).not.toContain("libvpx-vp9");
    const webm = argumentsImageFfmpeg(proprietes(".webm"), couleurs, fichiers(".webm"), 2, "master.mov");
    expect(avant(webm, "s0.webm")).toEqual(["-c:v", "libvpx-vp9", "-i"]);
  });

  it.skipIf(!ffmpegPresent)("ROUGE — vrai passage FFmpeg : piste principale et passage du second angle en mp4 H.264 → master complet", () => {
    const dossier = mkdtempSync(join(tmpdir(), "studio-r7e-uni-"));
    const run = (args: string[]) => {
      const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier });
      if (r.status !== 0) throw new Error(r.stderr.toString());
    };
    // Rendus « fond uni » comme HeyGen les livre : mp4 H.264, opaques.
    run(["-f", "lavfi", "-i", "color=c=0x202326:s=1080x1920:r=25:d=2,drawbox=x=340:y=600:w=400:h=1000:color=0xC4967A@1:t=fill", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "principal.mp4"]);
    run(["-f", "lavfi", "-i", "color=c=0x202326:s=1080x1920:r=25:d=1,drawbox=x=300:y=500:w=480:h=1100:color=0xC4967A@1:t=fill", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "s0.mp4"]);
    run(["-f", "lavfi", "-i", "sine=f=220:d=2.1:sample_rate=48000", "son.wav"]);
    run(argumentsImageFfmpeg(proprietes(".mp4"), couleurs, fichiers(".mp4"), 2, "master.mov").slice(2));
    const probe = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v", "-show_entries", "stream=nb_read_frames,width,height", "-of", "json", join(dossier, "master.mov")]).stdout.toString()).streams[0];
    expect(probe).toMatchObject({ nb_read_frames: "50", width: 1080, height: 1920 });
  }, 120_000);
});

describe("n° 3 — l'avatar qui parle est dit sur chaque feuille de lancement payante", async () => {
  const { BoutonSecondeOuverture, CarteFabriquerLesN, EtatFabricationVersion } = await import("@/components/generateur/FabricationReseaux");
  const PHRASE = "Votre avatar parle dans ces vidéos : environ 1,20 €, à confirmer.";
  const plan = {
    mere: { code: "0002-AV-FB", reseau: "facebook" as const, dureeSec: 50 },
    versions: [
      { varianteId: "v1", code: "0002-AV-FB", reseau: "facebook" as const, role: "mere" as const, prix: "1,12 €", dejaVideo: false },
      { varianteId: "v2", code: "0002-AV-TT", reseau: "tiktok" as const, role: "variante" as const, prix: "1,10 €", dejaVideo: false },
    ],
    total: "2,22 €",
    totalCentimes: 222,
    sansDeclinaison: "2,24 €",
    surMere: false,
  };
  it("ROUGE — « Fabriquer les N » : la phrase est sur la feuille ; sans avatar, rien", () => {
    expect(renderToStaticMarkup(createElement(CarteFabriquerLesN, { sujetId: "s1", plan: { ...plan, avatarParle: PHRASE } }))).toContain(PHRASE);
    expect(renderToStaticMarkup(createElement(CarteFabriquerLesN, { sujetId: "s1", plan }))).not.toContain("Votre avatar parle");
  });
  it("ROUGE — « Fabriquer en entier » et « 2e ouverture » : la phrase est dite avant le bouton", () => {
    const une = "Votre avatar parle dans cette vidéo : environ 0,60 €, à confirmer.";
    expect(renderToStaticMarkup(createElement(EtatFabricationVersion, { sujetId: "s1", etat: { videoId: "x", attendMere: false, attendConfirmation: true, coutComplet: "1,10 €", avatarParle: une, points: [], enCours: false } }))).toContain(une);
    expect(renderToStaticMarkup(createElement(BoutonSecondeOuverture, { sujetId: "s1", varianteId: "v1", prix: "1,10 €", avatarParle: une }))).toContain(une);
  });
});

describe("n° 6 — reprise après panne : la recherche gratuite du rendu suit les pages jusqu'à la décision", async () => {
  const { creerRendusHeygen } = await import("@/fournisseurs/heygen/rendus");
  const T = Date.UTC(2026, 9, 3, 12, 0, 0) / 1000;
  /** Compte HeyGen doublé : le filtre `title` est IGNORÉ (cas non vérifié de la documentation), 20 vidéos par page. */
  function compte(videos: { id: string; title: string; created_at: number }[]) {
    const appels: string[] = [];
    const client = {
      requeteEntiere: async (_m: string, chemin: string) => {
        appels.push(chemin);
        const q = new URL(`https://x${chemin}`).searchParams;
        const debut = Number(q.get("token") ?? 0);
        const page = videos.slice(debut, debut + 20);
        return { data: page.map((v) => ({ ...v, status: "processing" })), has_more: debut + 20 < videos.length, next_token: debut + 20 < videos.length ? String(debut + 20) : null };
      },
    };
    return { client: client as never, appels };
  }
  // Les plus récentes d'abord : 30 vidéos plus récentes que le rendu cherché, puis lui, puis des plus anciennes.
  const autres = (n: number, depuis: number, pas: number) => Array.from({ length: n }, (_, i) => ({ id: `v${depuis}-${i}`, title: `autre ${depuis}-${i}`, created_at: depuis - i * pas }));
  const cible = { id: "video-cible", title: "Reprise · angle principal · 0123456789ab", created_at: T + 10 };

  it("ROUGE — le rendu n'est pas dans les 20 derniers : il est quand même retrouvé (pas de second envoi payant)", async () => {
    const { client } = compte([...autres(30, T + 7200, 60), cible, ...autres(10, T - 60, 60)]);
    expect(await creerRendusHeygen(client).retrouver(cible.title, { depuis: new Date(T * 1000).toISOString() })).toEqual({ videoId: "video-cible" });
  });

  it("la recherche s'arrête aux vidéos plus anciennes que la décision (pas de lecture sans fin)", async () => {
    const { client, appels } = compte([...autres(25, T - 60, 60), ...autres(200, T - 7200, 60)]);
    expect(await creerRendusHeygen(client).retrouver(cible.title, { depuis: new Date(T * 1000).toISOString() })).toBeNull();
    expect(appels).toHaveLength(1);
  });
});
