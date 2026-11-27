/** Pinterest, PR 4 · rapatriement et retour des épingles : lecture seule chez Zernio, données fictives, aucun réseau. */
import { describe, expect, it } from "vitest";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import type { Publication } from "@/domaine/types";
import { cleRapatriement, compterEcart, deciderRapatriement, reseauDepuisPlateforme, type ConnusLocaux } from "@/domaine/rapatriement-zernio";
import { lienMedia } from "@/domaine/calendrier";
import { cartesDepuisEntrees } from "@/components/calendrier/CarteEntreeCalendrier";

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { rapatrierPostsZernio } = await import("@/services/rapatriement-zernio");
const { listerEntrees } = await import("@/services/calendrier");

const VIDE: ConnusLocaux = { idsExternes: new Set(), clesEnvoi: new Set(), clesCreneaux: new Set() };
const INSTANT = "2026-11-20T10:00:00.000Z";

const epingle = (over: Partial<PostZernio> = {}, specifique: Record<string, unknown> | null = { boardId: "111", title: "Titre", link: "https://exemple.fr/a" }): PostZernio => ({
  _id: "p-pin-1",
  content: "Description d'exemple",
  status: "scheduled",
  scheduledFor: "2026-12-01T09:00:00.000Z",
  platforms: [{ platform: "pinterest", accountId: "compte-fictif", ...(specifique ? { platformSpecificData: specifique } : {}) }],
  ...over,
});

describe("PR 4 · domaine", () => {
  it("pinterest est un réseau connu du rapatriement (table inverse)", () => {
    expect(reseauDepuisPlateforme("pinterest")).toBe("pinterest");
  });

  it("épingle faite chez Zernio (sans origine) → rapatriée, externe, canalId avec tableau", () => {
    const r = deciderRapatriement([epingle()], VIDE, { instant: INSTANT });
    expect(r.ecarts).toEqual([]);
    expect(r.aCreer).toHaveLength(1);
    expect(r.aCreer[0]).toMatchObject({ reseau: "pinterest", origineDiffuseur: "externe", canalId: "compte-fictif:pin:111", id: cleRapatriement("p-pin-1", "compte-fictif"), statut: "programmee" });
  });

  it("la clé de rapatriement reste sur l'identifiant du compte (jamais le tableau)", () => {
    expect(cleRapatriement("p1", "acc")).toBe("zr_p1_acc");
  });

  it.each([
    ["sans boardId", { title: "t" }],
    ["boardId non numérique", { boardId: "abc" }],
    ["boardId nombre", { boardId: 111 }],
    ["sans platformSpecificData", null],
  ])("%s → canalId = accountId, jamais un écart", (_nom, spec) => {
    const r = deciderRapatriement([epingle({}, spec as never)], VIDE, { instant: INSTANT });
    expect(r.ecarts).toEqual([]);
    expect(r.aCreer[0].canalId).toBe("compte-fictif");
  });

  it("le nom du canal tableau est repris de la table des noms (clé = canalId)", () => {
    const r = deciderRapatriement([epingle()], VIDE, { instant: INSTANT, nomsComptes: new Map([["compte-fictif:pin:111", "Compte · Tableau"]]) });
    expect(r.aCreer[0].canalNom).toBe("Compte · Tableau");
  });

  it("compterEcart : plus aucun reseau-inconnu pour pinterest", () => {
    expect(compterEcart([epingle()], VIDE).absents).toEqual([{ postId: "p-pin-1", raison: "absent" }]);
  });

  it("connue par idExterne, par studioCle (réponse perdue), par créneau → connus = 3, rien à créer", () => {
    const posts = [epingle({ _id: "a" }), epingle({ _id: "b", metadata: { studioCle: "cle-b" } }), epingle({ _id: "c", metadata: { studioCle: "cle-c" } })];
    const c: ConnusLocaux = { idsExternes: new Set(["a"]), clesEnvoi: new Set(["cle-b"]), clesCreneaux: new Set(["cle-c"]) };
    const r = deciderRapatriement(posts, c, { instant: INSTANT });
    expect(r.connus).toBe(3);
    expect(r.aCreer).toEqual([]);
  });

  it("un post publié (published) n'est pas lu pour le rapatriement : limite écrite", async () => {
    const { STATUTS_RAPATRIES } = await import("@/domaine/rapatriement-zernio");
    expect([...STATUTS_RAPATRIES]).toEqual(["scheduled", "draft", "publishing"]);
  });

  it("famille « epingle » : lien vers la fiche du visuel, aucun lien sans identifiant", () => {
    expect(lienMedia("epingle", "v1")).toBe("/visuels/v1");
    expect(lienMedia("epingle", null)).toBeNull();
  });

  it("une entrée de famille epingle donne une carte de type image (affichée « Épingle »), jamais vidéo", () => {
    const cartes = cartesDepuisEntrees([{ cle: "publication:x", jour: "2026-12-01", famille: "epingle", origine: "publication", titre: "t", vignette: null, lien: null, reseaux: ["pinterest"], mediaId: null, statut: "programmee" }]);
    expect(cartes).toHaveLength(1);
    expect(cartes[0].type).toBe("image");
  });
});

function deps(posts: PostZernio[]) {
  return {
    client: { listerPosts: async (q?: Record<string, string | number | boolean>) => (q?.status === "scheduled" && Number(q?.page ?? 1) === 1 ? posts : []) },
    publications: async () => (await depots().publications.lister()) as Publication[],
    clesCreneaux: async () => new Set<string>(),
    nomsComptes: async () => new Map([["compte-fictif:pin:111", "Compte · Tableau"]]),
    creerSiAbsente: async (p: never) => {
      const pp = p as Publication;
      if (await depots().publications.obtenir(pp.id)) return "existait" as const;
      await depots().publications.enregistrer({ ...pp, creeLe: INSTANT, modifieLe: INSTANT });
      return "creee" as const;
    },
    instant: () => INSTANT,
    budget: { restant: 6 },
  };
}

describe("PR 4 · service et calendrier", () => {
  it("deux passages non à blanc → 1 création, puis existaient = 1 ; visible au calendrier en famille epingle", async () => {
    reinitialiserDepots();
    const d = deps([epingle()]);
    const a = await rapatrierPostsZernio(d, { aBlanc: false });
    expect(a.crees).toBe(1);
    const b = await rapatrierPostsZernio(d, { aBlanc: false });
    expect(b.crees).toBe(0);
    expect(b.lus).toBe(1);
    const toutes = await listerEntrees({ publications: depots().publications, creneaux: depots().creneauxEditoriaux, videos: depots().videos, visuels: depots().visuels } as never, "2026-12-01", "2026-12-01");
    // Le dépôt en mémoire porte des données de démonstration : on ne regarde que la publication rapatriée.
    const entrees = toutes.filter((e) => e.cle === `publication:${cleRapatriement("p-pin-1", "compte-fictif")}`);
    expect(entrees).toHaveLength(1);
    expect(entrees[0]).toMatchObject({ famille: "epingle", reseaux: ["pinterest"], lien: null });
    expect(cartesDepuisEntrees(entrees)).toHaveLength(1);
  });

  it("nomsComptes du serveur : reprend aussi les noms des canaux tableau enregistrés", async () => {
    reinitialiserDepots();
    const { ecrireParametre } = await import("@/services/_commun");
    const { PARAM_CANAUX_ZERNIO } = await import("@/services/comptes-envoi-zernio");
    await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: INSTANT, canaux: [{ id: "compte-fictif:pin:111", organisationId: "zernio", nom: "Compte · Tableau", service: "pinterest" }] });
    const { depsRapatriementServeur } = await import("@/services/rapatriement-zernio");
    const noms = await (await depsRapatriementServeur()).nomsComptes();
    expect(noms.get("compte-fictif:pin:111")).toBe("Compte · Tableau");
  });
});
