/**
 * FIN-3 · page du suivi du tutoriel : le lien « Voir la vidéo » apparaît seulement quand le travail est terminé,
 * et les 4 fichiers touchés ne disent aucun mot de prix (même extraction que `tests/lot-a/aucun-prix-interface.test.ts`).
 * Rendu serveur seulement, dépôts en mémoire, composants clients remplacés par des doubles : aucun appel réel, 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/components/videos/SuiviTravail", () => ({ SuiviTravail: () => <div data-testid="suivi-travail" /> }));
vi.mock("@/components/tutoriel-outil/SuiviRoles", () => ({ SuiviRoles: () => <div data-testid="suivi-roles" /> }));
// La cloche n'est jamais posée ici (aucun réglage allumé, aucune écriture).
vi.mock("@/services/tutoriel-suivi", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/tutoriel-suivi")>();
  return { ...reel, signalerSuivi: vi.fn(async () => undefined) };
});

import type { Travail } from "@/domaine/types";

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const Page = (await import("@/app/(studio)/tutoriel-outil/suivi/[videoId]/page")).default;

const T = "2026-11-25T09:00:00.000Z";
const VIDEO = "vid_fin3";
const travail = (statut: Travail["statut"]): Travail =>
  ({ id: "trv_fin3", type: "fabrication", cibleId: VIDEO, titre: "Tutoriel", etapes: [], statut, progression: statut === "termine" ? 100 : 40, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "studio", creeLe: T, modifieLe: T }) as Travail;

async function rendre(): Promise<string> {
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ videoId: VIDEO }) }));
}

beforeEach(async () => {
  reinitialiserDepots();
  await depots().videos.enregistrer({ id: VIDEO, titre: "Mon tutoriel", statut: "en_fabrication", creeLe: T, modifieLe: T } as never);
});

describe("page du suivi du tutoriel : « Voir la vidéo »", () => {
  it("travail terminé : le lien mène à /videos/<id>", async () => {
    await depots().travaux.enregistrer(travail("termine"));
    const html = await rendre();
    expect(html).toMatch(new RegExp(`<a[^>]*href="/videos/${VIDEO}"[^>]*>Voir la vidéo</a>`));
    expect(html).toContain("suivi-travail");
  });

  it("travail en cours : pas de lien, le suivi s'affiche comme avant", async () => {
    await depots().travaux.enregistrer(travail("en_cours"));
    const html = await rendre();
    expect(html).not.toContain("Voir la vidéo");
    expect(html).not.toContain(`/videos/${VIDEO}`);
    expect(html).toContain("suivi-travail");
  });

  it("sans travail : l'état vide est inchangé, sans lien", async () => {
    const html = await rendre();
    expect(html).toContain("Rien n&#x27;est en cours");
    expect(html).not.toContain("Voir la vidéo");
  });
});

describe("aucun mot de prix dans les fichiers de la fiche (même motif que la garde du lot A)", () => {
  const MOTIF = /\b(prix|budget|plafond|coût|couts?|tarif|devis)\b|€/i;
  const textes = (src: string) => {
    const sans = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const chaines = sans.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|>[^<>{}]+</g) ?? [];
    return chaines.filter((c) => !/^["'`]?(?:@\/|\.\/|\.\.\/)/.test(c));
  };
  it.each([
    "src/app/(studio)/tutoriel-outil/suivi/[videoId]/page.tsx",
    "src/app/(studio)/tutoriel-outil/[videoId]/page.tsx",
    "src/components/formats/tutoriel-outil/AccepterDevis.tsx",
    "src/components/formats/cas-concret/entree/FeuilleVotreVideo.tsx",
  ])("%s", (f) => {
    const trouves = textes(readFileSync(join(__dirname, "../..", f), "utf8")).filter((c) => MOTIF.test(c));
    expect(trouves).toEqual([]);
  });
});
