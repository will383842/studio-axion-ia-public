/** UI-1 : fiche juste après la création (rendu en cours), refus, corbeille, simulation. Horloge et dépôt injectés. */
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { StatutVisuel } from "@/domaine/visuels/statuts";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import { lancerRendu, RENDU_PERIME_MS, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { ficheCarrousel } from "@/visuels/services/vues";

const DEPART = Date.parse("2026-10-23T10:00:00.000Z");
const SPEC = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T21" }] } as CarrouselSpecType;
const iso = (ms: number) => new Date(ms).toISOString();

function monter() {
  const depot = new DepotMemoire<Visuel>();
  const rendre = vi.fn(async () => ({ empreinte: "e".repeat(64), pages: [], pdfCle: "k/c.pdf", vignetteCle: "k/v.jpg" }));
  let chaine: Promise<unknown> = Promise.resolve();
  const etat = { instant: DEPART };
  const deps = {
    depot,
    texte: vi.fn(),
    porte: vi.fn(),
    contextePorte: vi.fn(),
    allume: async () => true,
    rendre,
    urlLecture: async (cle: string) => `https://stockage.invente/${cle}`,
    verrou: (f) => {
      const suite = chaine.then(f, f);
      chaine = suite.catch(() => undefined);
      return suite;
    },
    maintenant: () => iso(etat.instant),
    lireParametre: async <T>(_id: string, defaut: T) => defaut,
    ecrireParametre: async () => undefined,
  } as DependancesCarrousels;
  return { deps, depot, rendre, etat };
}

async function poser(b: ReturnType<typeof monter>, statut: StatutVisuel, extra: Partial<Visuel> = {}, id = "vis_a") {
  await b.depot.enregistrer({
    id, famille: "carrousel", titre: "Titre", entree: { type: "sujet", sujet: "Un sujet" }, statut, modeTexte: "simulation", spec: SPEC,
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: iso(DEPART), modifieLe: iso(DEPART), ...extra,
  });
  return id;
}

describe("fiche juste après la création : « ecrit » récent = rendu en cours", () => {
  it("texte écrit depuis 30 s : rendu en cours, pas de « Relancer le rendu »", async () => {
    const b = monter();
    await poser(b, "ecrit");
    b.etat.instant = DEPART + 30_000;
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(true);
    expect(f.actionsPermises).not.toContain("relancer_rendu");
  });
  it("texte écrit depuis plus de RENDU_PERIME_MS : périmé, « Relancer le rendu » proposé", async () => {
    const b = monter();
    await poser(b, "ecrit");
    b.etat.instant = DEPART + RENDU_PERIME_MS + 1;
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(false);
    expect(f.actionsPermises).toContain("relancer_rendu");
  });
  it("ecrit depuis 2 min : relance proposée, pas en cours", async () => {
    const b = monter();
    await poser(b, "ecrit");
    b.etat.instant = DEPART + 120_000;
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(false);
    expect(f.actionsPermises).toContain("relancer_rendu");
  });
  it("ecrit depuis 20 s : en cours, pas de relance", async () => {
    const b = monter();
    await poser(b, "ecrit");
    b.etat.instant = DEPART + 20_000;
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(true);
    expect(f.actionsPermises).not.toContain("relancer_rendu");
  });
  it("rendu_en_cours sans date de demande (anciennes données) : périmé, jamais « en cours » et « relancer » à la fois", async () => {
    const b = monter();
    await poser(b, "rendu_en_cours");
    b.etat.instant = DEPART + 30_000;
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(false);
    expect(f.actionsPermises).toContain("relancer_rendu");
  });
  it("rendu_en_cours demandé il y a 1 min : en cours ; il y a 11 min : périmé", async () => {
    const b = monter();
    await poser(b, "rendu_en_cours", { renduDemandeLe: iso(DEPART) });
    b.etat.instant = DEPART + 60_000;
    expect((await ficheCarrousel("vis_a", b.deps)).renduEnCours).toBe(true);
    b.etat.instant = DEPART + RENDU_PERIME_MS + 1;
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(false);
    expect(f.actionsPermises).toContain("relancer_rendu");
  });
  it("echec_rendu pour la mise en page : pas de « Relancer le rendu » (un nouvel essai échouera)", async () => {
    const b = monter();
    await poser(b, "echec_rendu", { erreur: "La page 2 ne tient pas dans la mise en page (zone réservée de LinkedIn) : raccourcissez ce texte ou changez de type de page." });
    expect((await ficheCarrousel("vis_a", b.deps)).actionsPermises).not.toContain("relancer_rendu");
  });
  it("echec_rendu pour la mise en page, sujet : « Refaire » proposé, sans « Relancer le rendu »", async () => {
    const b = monter();
    await poser(b, "echec_rendu", { erreur: "La page 2 ne tient pas dans la mise en page (le texte dépasse de son cadre) : raccourcissez ce texte ou changez de type de page." });
    expect((await ficheCarrousel("vis_a", b.deps)).actionsPermises.sort()).toEqual(["corbeille", "refaire"]);
  });
  it("echec_rendu pour la mise en page, texte déposé : ni « Refaire » ni « Relancer le rendu »", async () => {
    const b = monter();
    await poser(b, "echec_rendu", { entree: { type: "session" }, erreur: "La page 2 ne tient pas dans la mise en page (le texte dépasse de son cadre) : raccourcissez ce texte ou changez de type de page." });
    expect((await ficheCarrousel("vis_a", b.deps)).actionsPermises).toEqual(["corbeille"]);
  });
  it("echec_rendu ordinaire : « Relancer le rendu », pas de « Refaire »", async () => {
    const b = monter();
    await poser(b, "echec_rendu");
    expect((await ficheCarrousel("vis_a", b.deps)).actionsPermises.sort()).toEqual(["corbeille", "relancer_rendu"]);
  });
  it("echec_rendu : « Relancer le rendu » proposé, pas en cours", async () => {
    const b = monter();
    await poser(b, "echec_rendu");
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.renduEnCours).toBe(false);
    expect(f.actionsPermises).toContain("relancer_rendu");
  });
});

describe("lancerRendu : pas de second rendu", () => {
  it("rendu déjà demandé et non périmé : sans effet", async () => {
    const b = monter();
    await poser(b, "rendu_en_cours", { renduDemandeLe: iso(DEPART) });
    b.etat.instant = DEPART + 60_000;
    await lancerRendu("vis_a", b.deps);
    expect(b.rendre).not.toHaveBeenCalled();
  });
  it("deux lancements simultanés depuis « ecrit » : un seul rendu", async () => {
    const b = monter();
    await poser(b, "ecrit");
    await Promise.all([lancerRendu("vis_a", b.deps), lancerRendu("vis_a", b.deps)]);
    expect(b.rendre).toHaveBeenCalledTimes(1);
  });
});

describe("fiche : adresse du PDF", () => {
  it("l'adresse de téléchargement, avec le titre nettoyé, remplace l'adresse de lecture", async () => {
    const b = monter();
    const appels: string[][] = [];
    b.deps.urlTelechargement = async (cle, nom) => (appels.push([cle, nom]), `https://stockage.invente/${cle}?telecharger=${nom}`);
    await poser(b, "a_valider", { titre: "Un titre : à l'essai", rendu: { empreinte: "e", pdfCle: "k/c.pdf", vignetteCle: "k/v.jpg", pages: [], renduLe: iso(DEPART) } });
    const f = await ficheCarrousel("vis_a", b.deps);
    expect(f.pdfUrl).toBe("https://stockage.invente/k/c.pdf?telecharger=Un-titre-a-l-essai.pdf");
    expect(appels).toEqual([["k/c.pdf", "Un-titre-a-l-essai.pdf"]]);
  });
});
