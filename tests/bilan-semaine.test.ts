/**
 * L8-04a : BILAN DE LA SEMAINE affiché à l'accueil. Interrupteur « accueil.bilan_semaine » ÉTEINT par défaut.
 * Dépôts en mémoire, données INVENTÉES : aucun appel réseau, aucun envoi, aucune écriture.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import type { VideoMesuree } from "@/domaine/mesures-rangs";
import { calculerBilanSemaine, lignesBilan, type BilanSemaine, type ContenuMesure, type PublicationBilan } from "@/domaine/bilan-semaine";
import { CarteBilanSemaine } from "@/components/accueil/CarteBilanSemaine";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const commun = await import("@/services/_commun");
const bilanService = await import("@/services/bilan-semaine");

const MDP = "essai-l8-04a";
/** Lundi 26/10/2026, 09 h à Paris : la semaine écoulée va du 19 au 25/10 (changement d'heure le 25). */
const MAINTENANT = new Date("2026-10-26T08:00:00.000Z");
const ND = "non disponible";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const pub = (extra: Partial<PublicationBilan> = {}): PublicationBilan => ({ reseau: "instagram", date: "2026-10-21T10:00:00.000Z", statut: "publiee", via: "zernio", ...extra });
const contenu = (type: "video" | "carrousel", id: string, reseau: VideoMesuree["reseau"], vues: number, date = "2026-10-21T10:00:00.000Z", extra: Partial<VideoMesuree["resultats"]> = {}): ContenuMesure => ({
  type,
  video: { reseau, formatId: "f", publicationId: `p-${id}`, varianteId: `v-${id}`, code: id, titre: `Titre ${id}`, date, resultats: { vues, ...extra } },
});
const vide = { publications: [], contenus: [] };

describe("calculerBilanSemaine : bornes de la semaine écoulée", () => {
  it("lundi à dimanche, heure de Paris, changement d'heure du 25/10/2026 compris", () => {
    const b = calculerBilanSemaine(vide, MAINTENANT);
    expect(b.du).toBe("2026-10-19");
    expect(b.au).toBe("2026-10-25");
    const d = (iso: string) => calculerBilanSemaine({ publications: [pub({ date: iso })], contenus: [] }, MAINTENANT).parties;
    expect(d("2026-10-18T21:59:59.000Z")).toEqual([]); // dimanche 18, 23 h 59 à Paris
    expect(d("2026-10-18T22:00:00.000Z")).toEqual([{ reseau: "instagram", nombre: 1 }]); // lundi 19, 00 h
    expect(d("2026-10-25T22:59:59.000Z")).toEqual([{ reseau: "instagram", nombre: 1 }]); // dimanche 25, 23 h 59 (heure d'hiver)
    expect(d("2026-10-25T23:00:00.000Z")).toEqual([]); // lundi 26, 00 h
  });

  it("le dimanche soir (heure de Paris) compte encore pour la semaine en cours : on montre celle d'avant", () => {
    const b = calculerBilanSemaine(vide, new Date("2026-10-25T22:30:00.000Z"));
    expect([b.du, b.au]).toEqual(["2026-10-12", "2026-10-18"]);
  });
});

describe("calculerBilanSemaine : semaine vide", () => {
  const b = calculerBilanSemaine(vide, MAINTENANT);
  it("un vrai zéro pour les publications, « non disponible » partout ailleurs", () => {
    expect(b.parties).toEqual([]);
    expect(b.meilleur).toBeNull();
    expect(b.moinsBon).toBeNull();
    expect(b.creneau).toBeNull();
    expect(b.visites).toBeNull();
    expect(b.rendezVous).toBeNull();
    expect(b.echecs).toBe(0);
    expect(b.aVerifier).toBe(0);
  });
  it("les lignes disent « non disponible » et jamais 0 pour une donnée absente", () => {
    const t = lignesBilan(b);
    expect(t.filter((l) => l.includes(ND)).length).toBeGreaterThanOrEqual(5);
    for (const l of t) if (l.includes(ND)) expect(l).not.toMatch(/\b0\b/);
    expect(t.join(" ")).toMatch(/Aucune publication/);
  });
});

describe("calculerBilanSemaine : publications, échecs, à vérifier", () => {
  it("compte par réseau les seules publications parties de la semaine (ni simulation, ni programmée, ni hors semaine)", () => {
    const b = calculerBilanSemaine(
      {
        publications: [
          pub(), pub(), pub({ reseau: "tiktok" }),
          pub({ via: "simulation" }), pub({ statut: "programmee" }), pub({ date: "2026-10-12T10:00:00.000Z" }),
          pub({ statut: "echec" }), pub({ statut: "echec", reseau: "tiktok" }), pub({ etatEnvoi: "a-verifier", statut: "programmee" }),
        ],
        contenus: [],
      },
      MAINTENANT,
    );
    expect(b.parties).toEqual([{ reseau: "instagram", nombre: 2 }, { reseau: "tiktok", nombre: 1 }]);
    expect(b.echecs).toBe(2);
    expect(b.aVerifier).toBe(1);
  });
});

describe("calculerBilanSemaine : meilleur et moins bon d'après le rang", () => {
  const trois = [contenu("video", "a", "tiktok", 900), contenu("video", "b", "tiktok", 500), contenu("video", "c", "tiktok", 100)];

  it("meilleur = rang 1, moins bon = dernier rang, d'après le rang et non la valeur", () => {
    const b = calculerBilanSemaine({ publications: [], contenus: trois }, MAINTENANT);
    expect(b.meilleur).toEqual({ titre: "Titre a", reseau: "tiktok", type: "video", rang: "1re sur 3" });
    expect(b.moinsBon).toEqual({ titre: "Titre c", reseau: "tiktok", type: "video", rang: "3e sur 3" });
  });

  it("un contenu hors semaine sert au rang mais n'est jamais montré", () => {
    const b = calculerBilanSemaine({ publications: [], contenus: [contenu("video", "vieux", "tiktok", 99999, "2026-10-05T10:00:00.000Z"), ...trois] }, MAINTENANT);
    expect(b.meilleur?.titre).toBe("Titre a");
    expect(b.meilleur?.rang).toBe("2e sur 4");
  });

  it("un groupe de moins de 3 contenus sur un réseau : pas de rang, « non disponible »", () => {
    const b = calculerBilanSemaine({ publications: [], contenus: trois.slice(0, 2) }, MAINTENANT);
    expect(b.meilleur).toBeNull();
    expect(b.moinsBon).toBeNull();
  });

  it("carrousels et vidéos ne sont jamais comparés : chacun a son propre rang, jamais mêlés", () => {
    const car = [contenu("carrousel", "x", "instagram", 5), contenu("carrousel", "y", "instagram", 4), contenu("carrousel", "z", "instagram", 3)];
    const b = calculerBilanSemaine({ publications: [], contenus: [...trois, ...car] }, MAINTENANT);
    expect(b.meilleur?.type).toBe(b.moinsBon?.type);
    // les valeurs des carrousels (5, 4, 3) sont bien plus basses que celles des vidéos : aucun mélange
    const seulsCarrousels = calculerBilanSemaine({ publications: [], contenus: car }, MAINTENANT);
    expect(seulsCarrousels.meilleur).toEqual({ titre: "Titre x", reseau: "instagram", type: "carrousel", rang: "1re sur 3" });
    expect(seulsCarrousels.moinsBon?.titre).toBe("Titre z");
    expect(b.meilleur?.rang).toMatch(/sur 3$/);
  });
});

describe("calculerBilanSemaine : créneau et liens suivis", () => {
  const mardi = (h: number) => `2026-10-20T${String(h).padStart(2, "0")}:15:00.000Z`; // mardi, 12 h à 14 h à Paris
  it("sous le seuil de la case : « trop tôt » ; sinon le créneau lu", () => {
    const peu = [contenu("video", "a", "tiktok", 9, mardi(10)), contenu("video", "b", "tiktok", 5, mardi(10)), contenu("video", "c", "tiktok", 1, "2026-10-22T05:00:00.000Z")];
    expect(calculerBilanSemaine({ publications: [], contenus: peu }, MAINTENANT).creneau).toBe("trop-tot");
    const assez = [...peu.slice(0, 2), contenu("video", "d", "tiktok", 7, mardi(11)), contenu("video", "c", "tiktok", 1, "2026-10-22T05:00:00.000Z")];
    const c = calculerBilanSemaine({ publications: [], contenus: assez }, MAINTENANT).creneau;
    expect(c).toEqual({ libelle: expect.stringContaining("mardi") });
  });

  it("visites et rendez-vous : somme des valeurs relevées de la semaine ; aucune valeur = null (jamais 0)", () => {
    const b = calculerBilanSemaine({ publications: [], contenus: [contenu("video", "a", "tiktok", 9, undefined, { visites: 4, rendezVous: 1 }), contenu("video", "b", "tiktok", 8, undefined, { visites: 3 })] }, MAINTENANT);
    expect([b.visites, b.rendezVous]).toEqual([7, 1]);
    const sans = calculerBilanSemaine({ publications: [], contenus: [contenu("video", "a", "tiktok", 9)] }, MAINTENANT);
    expect([sans.visites, sans.rendezVous]).toEqual([null, null]);
  });
});

describe("lignesBilan : texte", () => {
  const plein = (): BilanSemaine => ({
    du: "2026-10-19",
    au: "2026-10-25",
    parties: [{ reseau: "instagram", nombre: 2 }, { reseau: "tiktok", nombre: 1 }],
    meilleur: { titre: "Titre a", reseau: "tiktok", type: "video", rang: "1re sur 3" },
    moinsBon: { titre: "Titre c", reseau: "tiktok", type: "video", rang: "3e sur 3" },
    creneau: { libelle: "mardi, 12 h – 14 h (heure de Paris)" },
    visites: 7,
    rendezVous: 1,
    echecs: 2,
    aVerifier: 1,
  });
  const cas: BilanSemaine[] = [
    plein(),
    { ...plein(), creneau: "trop-tot", meilleur: null, moinsBon: null, visites: null, rendezVous: null, echecs: 0, aVerifier: 0 },
    { ...plein(), parties: [], creneau: null },
  ];

  it("aucun interdit, aucun « € », aucun mot d'argent, aucun nom d'outil, vouvoiement", () => {
    for (const b of cas) for (const l of lignesBilan(b)) {
      expect(interditsTousEcrivains(l), l).toEqual([]);
      expect(l, l).not.toMatch(/€|euro|crédit|prix|\$/i);
      expect(l, l).not.toMatch(/buffer|zernio|\bapi\b/i);
      expect(l, l).not.toMatch(/\bnous\b|\btu\b|\btes?\b/i);
    }
  });

  it("« trop tôt » écrit pour le créneau sous le seuil, sans chiffre inventé", () => {
    const l = lignesBilan(cas[1]).join("\n");
    expect(l).toMatch(/trop tôt/i);
    expect(lignesBilan(cas[0]).join("\n")).toContain("mardi, 12 h – 14 h");
  });
});

/* ------------------------------------------------------------------ */
/* Service : l'interrupteur                                            */
/* ------------------------------------------------------------------ */

describe("bilanSemaineAccueil (dépôts en mémoire)", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
  });
  const publier = (id: string, extra: Record<string, unknown> = {}) =>
    depots().publications.enregistrer({ id, videoId: "v-02", reseau: "instagram", statut: "publiee", via: "zernio", date: "2026-10-21T10:00:00.000Z", texte: "Texte du post inventé", creeLe: "2026-10-21T10:00:00.000Z", modifieLe: "2026-10-21T10:00:00.000Z", ...extra } as never);

  it("réglage absent → null, et AUCUNE lecture des publications ni des visuels", async () => {
    await publier("p1");
    const espions = [vi.spyOn(depots().publications, "lister"), vi.spyOn(depots().publications, "obtenir"), vi.spyOn(depots().visuels, "lister"), vi.spyOn(depots().variantes, "obtenir")];
    expect(await bilanService.bilanSemaineAccueil(MAINTENANT)).toBeNull();
    for (const e of espions) expect(e).not.toHaveBeenCalled();
  });

  it("seul « true » allume : false, 1, « true » en texte → null", async () => {
    for (const v of [false, 1, "true", null]) {
      await commun.ecrireParametre("accueil.bilan_semaine", v);
      expect(await bilanService.bilanSemaineAccueil(MAINTENANT)).toBeNull();
    }
  });

  it("allumé : rend les lignes (semaine vide : un vrai zéro et « non disponible »)", async () => {
    await commun.ecrireParametre("accueil.bilan_semaine", true);
    const l = await bilanService.bilanSemaineAccueil(MAINTENANT);
    expect(l).not.toBeNull();
    expect(l!.join("\n")).toContain("19/10/2026");
    expect(l!.join("\n")).toContain(ND);
  });

  it("allumé : compte les publications de la semaine, sans écrire, sans montrer le texte du post ni le compte", async () => {
    await commun.ecrireParametre("accueil.bilan_semaine", true);
    await publier("p1", { canalNom: "Compte inventé" });
    await publier("p2", { statut: "echec", erreur: "Refus inventé du réseau" });
    const avant = JSON.stringify(await depots().publications.lister());
    const l = (await bilanService.bilanSemaineAccueil(MAINTENANT))!.join("\n");
    expect(l).toMatch(/instagram/i);
    expect(l).not.toMatch(/Texte du post inventé|Compte inventé|Refus inventé/);
    expect(l).not.toMatch(/€|crédit/i);
    expect(JSON.stringify(await depots().publications.lister())).toBe(avant);
  });

  it("ni notification ni e-mail : les espions ne sont jamais appelés", async () => {
    const notifs = await import("@/services/notifications");
    const email = await import("@/fournisseurs/notification/email");
    const a = vi.spyOn(notifs, "creerNotification");
    const b = vi.spyOn(email, "envoyerEmail");
    await commun.ecrireParametre("accueil.bilan_semaine", true);
    await publier("p1");
    await bilanService.bilanSemaineAccueil(MAINTENANT);
    await commun.ecrireParametre("accueil.bilan_semaine", false);
    await bilanService.bilanSemaineAccueil(MAINTENANT);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* Texte source, composant, page                                       */
/* ------------------------------------------------------------------ */

describe("texte source et page", () => {
  const lire = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
  const SOURCES = ["src/domaine/bilan-semaine.ts", "src/services/bilan-semaine.ts", "src/components/accueil/CarteBilanSemaine.tsx"];

  it("aucun import réseau, diffuseur, notification, veille ni modèle ; aucune écriture, aucun appel réseau", () => {
    for (const f of SOURCES) {
      const src = lire(f);
      expect(src, f).not.toMatch(/from\s+["'][^"']*(\.\/zernio|@\/fournisseurs|\.\/notifications|\.\/veille|\/zernio|claude)/);
      expect(src, f).not.toMatch(/\bfetch\(|\.enregistrer\(|\.modifier\(|\.supprimer\(|ecrireParametre|envoyerEmail|creerNotification/);
    }
  });

  it("le service est réservé au serveur ; le domaine n'importe aucun service", () => {
    expect(lire("src/services/bilan-semaine.ts")).toMatch(/import "server-only"/);
    expect(lire("src/domaine/bilan-semaine.ts")).not.toMatch(/from\s+["']@\/services/);
  });

  it("le service lit l'interrupteur « accueil.bilan_semaine » avec le défaut false", () => {
    expect(lire("src/services/bilan-semaine.ts")).toMatch(/lireParametre<boolean>\(\s*"accueil\.bilan_semaine",\s*false\s*\)/);
  });

  it("la page appelle le bilan et n'affiche la carte que si les lignes existent", () => {
    const page = lire("src/app/(studio)/page.tsx");
    expect(page).toContain("bilanSemaineAccueil(");
    expect(page).toMatch(/bilan\s*&&\s*<CarteBilanSemaine\s+lignes=\{bilan\}/);
  });

  it("la carte « Votre semaine » affiche les lignes, sans montant ni nom d'outil", () => {
    const html = renderToStaticMarkup(createElement(CarteBilanSemaine, { lignes: ["Première ligne.", "Seconde ligne : non disponible."] }));
    expect(html).toContain("Votre semaine");
    expect(html).toContain("Première ligne.");
    expect(html).not.toMatch(/€|crédit|buffer|zernio/i);
  });
});
