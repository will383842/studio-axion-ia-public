/**
 * Contrôles de RENDU RÉEL de chaque type de pages (Remotion + Chromium) : contenu MAXIMAL du schéma sans aucun débordement,
 * contenu MINIMAL sans zone vide de plus de 15 % de la hauteur. Ces tests demandent les dépendances de `studio-rendu`
 * (`npm ci` dans ce dossier) et un Chromium local (`STUDIO_RENDU_NAVIGATEUR`, ou celui de Playwright) : sans eux, ils sont
 * IGNORÉS (la CI ciblée des visuels n'installe pas studio-rendu). Le script `scripts/essai-visuel-m3a.ts` fait les mêmes contrôles.
 */
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { controlerMax, controlerMin, PART_ZONE_VIDE_MAX } from "../../studio-rendu/scripts/controle-pages";
import { navigateurLocal, ouvrirRendeur, type Rendeur } from "../../studio-rendu/scripts/rendu-visuel";

const DISPONIBLE = existsSync(new URL("../../studio-rendu/node_modules/@remotion/renderer", import.meta.url)) && Boolean(navigateurLocal());
const MINUTES = 60_000;
// La couverture A (T01, validée en M1-04) est volontairement minimaliste : son titre court, centré, laisse du blanc. Les autres types sont tous contrôlés.
const SANS_CONTROLE_MIN = ["T01"];

describe.skipIf(!DISPONIBLE)("rendu réel des types de pages", () => {
  let rendeur: Rendeur;
  beforeAll(async () => {
    rendeur = await ouvrirRendeur();
  }, 5 * MINUTES);

  it.each(TYPES_PAGE)("%s : contenu MAXIMAL = 0 débordement", async (type) => {
    const resultats = await controlerMax(rendeur, type);
    expect(resultats.length).toBeGreaterThan(0);
    for (const r of resultats) expect(r.erreur, `${type} ${r.nom}`).toBeNull();
  }, 5 * MINUTES);

  it.each(TYPES_PAGE.filter((t) => !SANS_CONTROLE_MIN.includes(t)))("%s : contenu MINIMAL = aucune zone vide de plus de 15 % de la hauteur", async (type) => {
    const resultats = await controlerMin(rendeur, type);
    expect(resultats.length).toBeGreaterThan(0);
    for (const r of resultats) expect(r.part, `${type} ${r.nom} : zone vide de ${r.hauteurVidePx} px`).toBeLessThanOrEqual(PART_ZONE_VIDE_MAX);
  }, 5 * MINUTES);

  // Le garde-fou lui-même : un texte qui ne tient pas FAIT ÉCHOUER le rendu, il n'est jamais coupé en silence.
  it("un mot trop long pour la largeur fait échouer le rendu d'un titre", async () => {
    const sortie = resolve(mkdtempSync(resolve(tmpdir(), "debordement-")), "page.jpg");
    const spec = { version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre: "Une couverture" }, { type: "T06", titre: "x".repeat(30), points: ["a", "b", "c"].map((texte) => ({ texte })) }] };
    await expect(rendeur.page(spec, 1, sortie)).rejects.toThrow(/ne tient pas dans la largeur|déborde de son cadre/);
  }, 5 * MINUTES);

  it("un point de liste d'un seul mot trop long fait échouer le rendu", async () => {
    const sortie = resolve(mkdtempSync(resolve(tmpdir(), "debordement-")), "page.jpg");
    const spec = { version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre: "Une couverture" }, { type: "T06", titre: "Une liste", points: [{ texte: "x".repeat(70) }, { texte: "b" }, { texte: "c" }] }] };
    await expect(rendeur.page(spec, 1, sortie)).rejects.toThrow(/déborde de son cadre/);
  }, 5 * MINUTES);
});
