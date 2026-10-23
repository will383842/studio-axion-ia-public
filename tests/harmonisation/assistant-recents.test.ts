/** Harmonisation H8c : récents du format sous l'express de l'assistant (masqués quand `?brouillon=`), sans nouvelle requête. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { versRecentsVideos } from "@/components/creation/vues-recents";
import { STATUTS_VIDEO } from "@/domaine/libelles";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const carte = (p: Record<string, unknown> = {}) => ({ id: "v 1", titre: "Ma vidéo", statut: "prete", creeLe: "2026-10-10T09:00:00", modifieLe: "2026-10-18T14:05:00", ...p }) as never;

describe("versRecentsVideos", () => {
  it("lien vers la vidéo, état lisible tiré du vocabulaire commun, date, icône", () => {
    expect(versRecentsVideos([carte()])).toEqual([{ id: "v 1", href: "/videos/v%201", titre: "Ma vidéo", etat: STATUTS_VIDEO.prete.libelle, date: "2026-10-18T14:05:00", icone: "video" }]);
  });

  it("un titre vide devient « Sans titre » ; aucune vidéo : liste vide", () => {
    expect(versRecentsVideos([carte({ titre: "" })])[0].titre).toBe("Sans titre");
    expect(versRecentsVideos([])).toEqual([]);
  });

  it("date affichée = dernière modification, celle du tri de listerVideos (sinon les dates paraissent en désordre)", () => {
    const [a, b] = versRecentsVideos([carte({ id: "a", creeLe: "2026-10-01T08:00:00", modifieLe: "2026-10-18T10:00:00" }), carte({ id: "b", creeLe: "2026-10-15T08:00:00", modifieLe: "2026-10-16T10:00:00" })]);
    expect([a.date, b.date]).toEqual(["2026-10-18T10:00:00", "2026-10-16T10:00:00"]);
  });
});

describe("page de l'assistant · récents", () => {
  const page = lire("src/app/(studio)/nouvelle/[format]/page.tsx");
  const assistant = lire("src/assistant/Assistant.tsx");

  it("requête existante listerVideos du format, limitée ; rien de plus, pas de SQL ici", () => {
    expect(page).toMatch(/listerVideos\(\{\s*formatId/);
    expect(page).toMatch(/limite:\s*\d/);
    expect(page).not.toMatch(/\bsql\b|postgres|pool\.query/i);
  });

  it("masqués quand ?brouillon= : la requête n'est même pas lancée", () => {
    expect(page).toMatch(/sp\.brouillon \? Promise\.resolve\(\[\] as VueVideoCarte\[\]\) : listerVideos\(/);
  });

  it("l'Assistant reçoit `recents` et ne l'affiche que sous l'express", () => {
    expect(page).toMatch(/<RecentsGenerateur/);
    expect(page).toMatch(/recents=\{/);
    expect(assistant).toMatch(/recents/);
    const express = assistant.slice(assistant.indexOf("if (express) {"), assistant.indexOf("const quitter") > 0 ? assistant.indexOf("  return (\n    <GabaritCreation\n      entete") : undefined);
    expect(express).toMatch(/recents=\{recents\}/);
  });
});
