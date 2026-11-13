/**
 * AP-01 : « À publier » montre les carrousels et les infographies à côté des vidéos.
 * Aucun appel réel, aucun service payant : dépôts en mémoire, stockage simulé. Lecture seule : rien n'est créé ni envoyé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { Visuel } from "@/domaine/visuels/visuel";

delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { ListeAPublier } = await import("@/components/publication/ListeAPublier");

const MDP = "essai-ap-01";
const MAINTENANT = "2026-11-13T10:00:00.000Z";

function visuel(id: string, p: Partial<Visuel> = {}): Visuel {
  return {
    id, famille: "carrousel", titre: `Titre ${id}`, entree: { type: "sujet", sujet: "s" }, statut: "valide", modeTexte: "simulation",
    versionSpec: 1, coutCentimes: 0, creeLe: MAINTENANT, modifieLe: MAINTENANT,
    rendu: { empreinte: "e", pdfCle: `k/${id}.pdf`, vignetteCle: `k/${id}.jpg`, pages: [{ index: 0, x1Cle: "a", x2Cle: "b" }, { index: 1, x1Cle: "c", x2Cle: "d" }], renduLe: MAINTENANT },
    ...p,
  };
}
const poser = async (...vs: Visuel[]) => { for (const v of vs) await depots().visuels.enregistrer(v); };
// Les dépôts en mémoire contiennent déjà des vidéos d'exemple : on ne regarde que les visuels.
const ids = async () => (await pub.listerContenusAPublier()).filter((c) => c.famille !== "video").map((c) => c.id);

beforeAll(async () => { await preparerMotDePasse(MDP); });
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("AP-01 · les familles", () => {
  it("R1 : un carrousel validé est « carrousel », une infographie validée « infographie », un carrousel continu reste un carrousel", async () => {
    await poser(visuel("vis_c"), visuel("vis_i", { famille: "infographie" }), visuel("vis_cc", { famille: "carrousel-continu" }));
    const parId = Object.fromEntries((await pub.listerContenusAPublier()).map((c) => [c.id, c.famille]));
    expect(parId).toMatchObject({ vis_c: "carrousel", vis_i: "infographie", vis_cc: "carrousel" });
  });

  it("R2 : seuls les visuels « validé » (ni à valider, ni programmé, ni publié) et hors corbeille sont à publier", async () => {
    await poser(
      visuel("vis_ok"),
      visuel("vis_av", { statut: "a_valider" }),
      visuel("vis_pr", { statut: "programme" }),
      visuel("vis_pu", { statut: "publie" }),
      visuel("vis_br", { statut: "brouillon" }),
      visuel("vis_co", { corbeilleLe: MAINTENANT, statutAvantCorbeille: "valide" }),
    );
    expect(await ids()).toEqual(["vis_ok"]);
  });

  it("R3 : l'interrupteur « Afficher les exemples » vaut aussi pour les visuels d'exemple", async () => {
    await poser(visuel("vis_demo", { estDemo: true }), visuel("vis_vrai"));
    expect(await ids()).toEqual(expect.arrayContaining(["vis_demo", "vis_vrai"]));
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("afficherExemples", false);
    expect(await ids()).toEqual(["vis_vrai"]);
  });

  it("R4 : la carte d'un visuel garde titre, nombre de pages, miniature et lien vers sa fiche ; aucun prix", async () => {
    await poser(visuel("vis_a"));
    const [c] = (await pub.listerContenusAPublier()).filter((x) => x.famille !== "video");
    expect(c).toMatchObject({ id: "vis_a", titre: "Titre vis_a", nbPages: 2, lien: "/carrousels/vis_a" });
    expect(JSON.stringify(c)).not.toMatch(/cout|prix|centimes|€/i);
  });

  it("R5 : listerAPublier et listerAProgrammer (envoi et réserve du calendrier) restent aux vidéos seules", async () => {
    await poser(visuel("vis_a"));
    expect((await pub.listerAPublier()).every((v) => v.famille === "video")).toBe(true);
    expect((await pub.listerAProgrammer()).some((v) => v.id === "vis_a")).toBe(false);
  });

  it("R6 : lecture seule : aucune publication créée, visuel inchangé", async () => {
    await poser(visuel("vis_a"));
    const avant = await depots().publications.compter(() => true);
    await pub.listerContenusAPublier();
    expect(await depots().publications.compter(() => true)).toBe(avant);
    expect((await depots().visuels.obtenir("vis_a"))!.statut).toBe("valide");
  });
});

describe("AP-01 · la page (d'après M5)", () => {
  const carte = (famille: "carrousel" | "infographie", id: string) => ({ famille, id, titre: `Titre ${id}`, vignette: null, nbPages: famille === "carrousel" ? 5 : 1, lien: `/carrousels/${id}` });
  const rendu = (visuels: ReturnType<typeof carte>[]) => renderToStaticMarkup(createElement(ListeAPublier, { lignes: [], visuels, filtre: "toutes" }));

  it("R7 : une carte par visuel, avec sa famille en toutes lettres et son lien, sans bouton d'envoi", () => {
    const html = rendu([carte("carrousel", "vis_c"), carte("infographie", "vis_i")]);
    expect(html).toContain("Carrousel");
    expect(html).toContain("Infographie");
    expect(html).toContain('href="/carrousels/vis_c"');
    expect(html).toContain("5 pages");
    expect(html).not.toMatch(/Envoyer|api\/telechargements/);
  });

  it("R8 : aucun visuel, aucune section ; couleurs de famille par jetons, jamais d'orange", () => {
    expect(rendu([])).not.toContain("Carrousel");
    const html = rendu([carte("carrousel", "vis_c"), carte("infographie", "vis_i")]);
    expect(html).toMatch(/fam-carrousel/);
    expect(html).toMatch(/fam-infographie/);
    expect(html).not.toMatch(/orange/);
  });

  it("R9 : la page s'appelle « À publier » pour tous les formats ; vide seulement sans vidéo ni visuel ; aucun prix, aucun chemin de PC", () => {
    const src = readFileSync("src/app/(studio)/a-publier/page.tsx", "utf8");
    expect(src).toContain('title: "À publier"');
    expect(src).toContain('titre="À publier"');
    expect(src).not.toContain("Vidéos validées");
    expect(src).toMatch(/listerVisuelsAPublier|listerContenusAPublier/);
    expect(src).toMatch(/vue\.lignes\.length \|\| visuels\.length/);
    for (const f of ["src/app/(studio)/a-publier/page.tsx", "src/components/publication/ListeAPublier.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/€|\bprix\b|C:\\|\/Users\/|\/home\//i);
    }
  });
});
