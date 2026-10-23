/**
 * PR 3 de l'harmonisation : Image → vidéo n'a qu'une seule page de détail.
 * Carte de la galerie (rendu statique) + redirection de /videos/[id] (lecture de code).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarteVideo } from "../src/components/videos/CarteVideo";
import type { VueVideoCarte } from "../src/services/vues";

const carte = (formatId: string, statut: VueVideoCarte["statut"] = "prete"): VueVideoCarte =>
  ({
    id: "v1",
    titre: "Une vidéo",
    format: { id: formatId, nom: formatId, icone: "video", statut: "actif" },
    statut,
    dureeCibleSec: 30,
    dureeSec: 30,
    dureeEstimee: false,
    ratios: ["9:16"],
    ratioPrincipal: "9:16",
    vignette: null,
    video: null,
    creeLe: "2026-10-18T08:00:00.000Z",
    modifieLe: "2026-10-18T08:00:00.000Z",
  }) as unknown as VueVideoCarte;

const lien = (v: VueVideoCarte, href?: string) => /href="([^"]+)"/.exec(renderToStaticMarkup(createElement(CarteVideo, { video: v, href })))?.[1];

describe("CarteVideo : une seule fiche pour Image → vidéo", () => {
  it("une vidéo Image → vidéo mène à /image-video/<id>", () => {
    expect(lien(carte("image-video"))).toBe("/image-video/v1");
  });
  it("une vidéo prête d'un autre format mène toujours à /videos/<id>", () => {
    expect(lien(carte("avocat"))).toBe("/videos/v1");
  });
  it("un brouillon d'un autre format reprend l'assistant", () => {
    expect(lien(carte("avocat", "brouillon"))).toBe("/nouvelle/avocat?brouillon=v1");
  });
  it("une adresse imposée reste prioritaire", () => {
    expect(lien(carte("image-video"), "/ailleurs")).toBe("/ailleurs");
  });
});

describe("/videos/[id] : redirection d'Image → vidéo", () => {
  const code = readFileSync(join(__dirname, "../src/app/(studio)/videos/[id]/page.tsx"), "utf8");
  it("redirige avant le test des brouillons", () => {
    const i = code.indexOf("v.formatId === ID_FORMAT_IMAGE_VIDEO");
    const j = code.indexOf('v.statut === "brouillon"');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(code).toContain("redirect(`/image-video/${encodeURIComponent(v.id)}`)");
  });
});
