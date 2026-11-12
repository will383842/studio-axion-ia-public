/** P3-A · lecture tolérante : une ligne mal formée est ignorée par les écrans (pas d'écran en erreur) et signalée. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { memeSource, videoIdSure } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { nouvelId } = await import("@/lib/ids");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const MDP = "essai-p3a-ancienne";
const base = { reseau: "instagram", statut: "brouillon", date: "2026-11-05T10:00:00.000Z", texte: "Texte d'exemple", estDemo: false } as const;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("P3-A · publications anciennes et mal formées", () => {
  it("listerCalendrier lit une ancienne publication (videoId seul) et ignore une ligne mal formée", async () => {
    const d = depots();
    const video = (await d.videos.lister())[0];
    const maintenant = new Date().toISOString();
    const ancienne = await d.publications.enregistrer({ ...base, id: nouvelId("pub"), videoId: video.id, creeLe: maintenant, modifieLe: maintenant } as never);
    const cassee = await d.publications.enregistrer({ ...base, id: nouvelId("pub"), videoId: "", creeLe: maintenant, modifieLe: maintenant } as never);
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    const jours = await pub.listerCalendrier("2026-11-01T00:00:00.000Z", "2026-11-30T00:00:00.000Z");
    const ids = jours.flatMap((j) => j.publications.map((p) => p.id));
    expect(ids).toContain(ancienne.id);
    expect(ids).not.toContain(cassee.id);
    expect(avertir).toHaveBeenCalledWith(expect.stringContaining(cassee.id));
    avertir.mockRestore();
  });

  it("videoIdSure ne lève pas ; memeSource ne confond pas deux visuels sans vidéo", () => {
    expect(videoIdSure({ videoId: "" })).toBeUndefined();
    expect(videoIdSure({ visuelId: "x1" })).toBeUndefined();
    expect(memeSource({ visuelId: "x1" }, { visuelId: "x2" })).toBe(false);
    expect(memeSource({ visuelId: "x1" }, { visuelId: "x1" })).toBe(true);
    expect(memeSource({ videoId: "v1" }, { videoId: "v1" })).toBe(true);
    expect(memeSource({ videoId: "v1" }, { visuelId: "v1" })).toBe(false);
  });
});
