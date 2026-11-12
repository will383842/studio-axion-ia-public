/** L1-04 (correction après relecture) : l'action « valider » côté serveur ne déprogramme jamais un visuel programmé. */
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { StatutVisuel } from "@/domaine/visuels/statuts";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import { ErreurVisuel, lancerRendu, valider, type DependancesCarrousels } from "@/visuels/services/carrousels";

const DEPART = Date.parse("2026-10-19T10:00:00.000Z");
const SPEC = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T21" }] } as CarrouselSpecType;

function monter(allume = true) {
  const depot = new DepotMemoire<Visuel>();
  const suppressions = vi.spyOn(depot, "supprimer");
  const parametres = new Map<string, unknown>();
  const etat = { instant: DEPART };
  const rendre = vi.fn();
  const urlLecture = vi.fn(async (cle: string) => `https://stockage.invente/${cle}`);
  let chaine: Promise<unknown> = Promise.resolve();
  const deps = {
    depot,
    texte: vi.fn(),
    porte: vi.fn(),
    contextePorte: vi.fn(),
    allume: async () => allume,
    rendre,
    rendreReseaux: async () => [],
    urlLecture,
    verrou: (f) => {
      const suite = chaine.then(f, f);
      chaine = suite.catch(() => undefined);
      return suite;
    },
    maintenant: () => new Date(etat.instant).toISOString(),
    lireParametre: async <T>(id: string, defaut: T) => (parametres.has(id) ? (parametres.get(id) as T) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void parametres.set(id, v),
  } as DependancesCarrousels;
  return { deps, depot, etat, suppressions, parametres, rendre, urlLecture };
}
type Banc = ReturnType<typeof monter>;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ErreurVisuel ? e.code : `AUTRE:${String(e)}`;
  }
  return "AUCUNE";
};

async function poser(b: Banc, id: string, statut: StatutVisuel, extra: Partial<Visuel> = {}): Promise<void> {
  const t = new Date(b.etat.instant).toISOString();
  await b.depot.enregistrer({
    id, famille: "carrousel", titre: `Titre ${id}`, entree: { type: "sujet", sujet: "Un sujet inventé" }, statut, modeTexte: "simulation", spec: SPEC,
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: t, modifieLe: t, ...extra,
  });
}

describe("valider côté serveur", () => {
  it("refuse un visuel programmé et ne touche ni son statut ni valideLe", async () => {
    const b = monter();
    await poser(b, "p1", "programme", { valideLe: "2026-01-01T00:00:00.000Z" });
    expect(await code(valider("p1", b.deps))).toBe("TRANSITION_REFUSEE");
    const v = await b.depot.obtenir("p1");
    expect(v?.statut).toBe("programme");
    expect(v?.valideLe).toBe("2026-01-01T00:00:00.000Z");
  });
  it.each(["valide", "publie", "echec_envoi", "brouillon", "refuse"] as StatutVisuel[])("refuse depuis %s", async (st) => {
    const b = monter();
    await poser(b, "x", st);
    expect(await code(valider("x", b.deps))).toBe("TRANSITION_REFUSEE");
    expect((await b.depot.obtenir("x"))?.statut).toBe(st);
  });
  it("valide toujours un visuel à valider", async () => {
    const b = monter();
    await poser(b, "a", "a_valider");
    expect(await code(valider("a", b.deps))).toBe("AUCUNE");
    expect((await b.depot.obtenir("a"))?.statut).toBe("valide");
  });
});
