/**
 * BR-ESCALIER-a : l'escalier de lignes (`LigneEscalier`) est monté dans `CalqueSousTitres`, piloté par le champ
 * facultatif `DonneesCalque.escalier`. Absent : HTML identique au caractère près (empreinte figée AVANT le changement).
 * Rendu statique seulement, aucun réseau. Se saute si les dépendances de studio-rendu ne sont pas installées.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, useCurrentFrame: () => 10, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { donneesCalque } from "@/briques/sous-titres";
import { escalierAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas cet import (PIEGE-REMOTION-TSC.md).
const chemin = ["..", "..", "..", "studio-rendu", "compositions", "sous-titres", "CalqueSousTitres"].join("/");
const CALQUE = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin)) as { CalqueSousTitres: unknown }) : null;

const seg = (id: string, debut: number, texte: string): SegmentRendu => ({
  id,
  debutSec: debut,
  finSec: debut + 1,
  mots: texte.split(" ").map((mot, i, tous) => ({ mot, debutSec: debut + i / tous.length, finSec: debut + (i + 1) / tous.length })),
});
const SEGMENTS = [seg("a", 0, "Premier groupe"), seg("b", 1, "deuxième groupe"), seg("c", 2, "troisième groupe."), seg("d", 3, "Nouvelle phrase")];
const base = donneesCalque({ segments: SEGMENTS, base: "karaoke", ratio: "9:16" });
const ZONE = { xPx: 60, yPx: 1300, largeurPx: 900, hauteurPx: 420 };
const avec = (zone = ZONE): DonneesCalque => ({ ...base, escalier: { zone, taillePx: 48 } });
const html = (d: DonneesCalque, t: number) => renderToStaticMarkup(createElement(CALQUE!.CalqueSousTitres as never, { donnees: d, instantSec: t }) as never);
const empreinte = (s: string) => createHash("sha256").update(s).digest("hex");

describe("escalierAuTemps (pure)", () => {
  it("sans champ : null, même avec un segment actif", () => {
    expect(escalierAuTemps(base, 2.5)).toBeNull();
  });
  it("aucun segment actif : null", () => {
    expect(escalierAuTemps(avec(), 9)).toBeNull();
  });
  it("3 segments d'une phrase : 3 lignes, ligne active = la dernière", () => {
    const r = escalierAuTemps(avec(), 2.5);
    expect(r?.lignes).toEqual(["Premier groupe", "deuxième groupe", "troisième groupe."]);
    expect(r?.ligneActive).toBe(2);
  });
  it("nouvelle phrase : repart à 1 ligne", () => {
    expect(escalierAuTemps(avec(), 3.5)).toEqual({ lignes: ["Nouvelle phrase"], ligneActive: 0 });
  });
  it("6 lignes au plus", () => {
    const segs = Array.from({ length: 9 }, (_, i) => seg(`s${i}`, i, `mot${i} suite`));
    const r = escalierAuTemps({ ...base, segments: segs, escalier: { zone: ZONE, taillePx: 48 } }, 8.5);
    expect(r?.lignes).toHaveLength(6);
    expect(r?.ligneActive).toBe(5);
  });
});

describe.skipIf(!AVEC_RENDU)("CalqueSousTitres et escalier (BR-ESCALIER-a)", () => {
  it("SANS champ : HTML identique au caractère près à celui d'avant le changement (empreinte figée sur master 93c9d422, 17/11/2026, avant le changement)", () => {
    expect(empreinte(html(base, 2.5))).toBe("e6d0957880448dfefc9bae5ae335f3e79e08d8ef5dc80edf97625a093319c6fd" /* CONTOURS-b-v21s : contour V2 seul (-webkit-text-stroke 6→3 px, ombre 8→10,4 px / 0,65→0,55) */);
    expect(html(base, 2.5)).not.toContain("data-ligne-escalier");
  });
  it("AVEC champ et 3 segments : 3 lignes d'escalier", () => {
    const h = html(avec(), 2.5);
    expect((h.match(/data-ligne-escalier/g) ?? []).length).toBe(3);
  });
  it("zone trop petite : rendu d'aujourd'hui (repli)", () => {
    const h = html(avec({ ...ZONE, hauteurPx: 20 }), 2.5);
    expect(h).toBe(html(base, 2.5));
  });
});
