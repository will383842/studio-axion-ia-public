/**
 * L5-18a : MESURES DES VISUELS (carrousels). Deux classements séparés (vidéos / carrousels), trois états
 * (mesuré, pas encore, non disponible), jamais un zéro à la place d'une statistique non lue.
 * Dépôts en mémoire, données de TEST seulement : aucun appel réseau, aucune écriture à l'affichage.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { matiere, preparerMotDePasse } from "../helpers/g1a";
import { interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import { MINIMUM_GROUPE, rangsParReseau, type VideoMesuree } from "@/domaine/mesures-rangs";
import {
  carrouselCommeVideoMesuree,
  classerCarrousels,
  DELAI_NON_DISPONIBLE_JOURS,
  etatMesurePublication,
  MESURES_NON_DISPONIBLES,
} from "@/domaine/mesures-visuels";
import { CeQuiMarcheVisuels } from "@/components/mesures/CeQuiMarcheVisuels";
import type { StatsPublication } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const mc = await import("@/services/mesures-completes");
const mv = await import("@/services/mesures-visuels");

const MDP = "essai-l5-18a";
const MAINTENANT = new Date("2026-11-20T10:00:00.000Z");
const jourAvant = (n: number) => new Date(MAINTENANT.getTime() - n * 86_400_000).toISOString();
const stats = (vues: number, partagesParPortee?: number): StatsPublication => ({ vues, likes: 1, commentaires: 1, partages: 1, ...(partagesParPortee === undefined ? {} : { partagesParPortee }) });

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

/* ------------------------------------------------------------------ */
/* Domaine pur                                                         */
/* ------------------------------------------------------------------ */

describe("etatMesurePublication : trois états", () => {
  const releve = (source: "zernio" | "buffer" | "saisie" | "api", valeurs: Partial<StatsPublication>) => ({ le: jourAvant(1), jour: 1, source, valeurs: valeurs as StatsPublication, definitions: {} });

  it("le délai est de 7 jours", () => {
    expect(DELAI_NON_DISPONIBLE_JOURS).toBe(7);
  });

  it("un relevé avec au moins une valeur (diffuseur, ancien outil, saisie) → mesuré", () => {
    for (const source of ["zernio", "buffer", "saisie"] as const) {
      expect(etatMesurePublication({ date: jourAvant(2), releves: [releve(source, { vues: 120 })] }, MAINTENANT)).toBe("mesure");
    }
  });

  it("sans relevé : à J+2 → pas encore ; à J+8 → non disponible (jamais mesuré, jamais zéro)", () => {
    expect(etatMesurePublication({ date: jourAvant(2) }, MAINTENANT)).toBe("pas-encore");
    expect(etatMesurePublication({ date: jourAvant(8) }, MAINTENANT)).toBe("non-disponible");
    expect(etatMesurePublication({ date: jourAvant(8), releves: [] }, MAINTENANT)).toBe("non-disponible");
  });

  it("un relevé sans aucune valeur ne compte pas comme mesuré", () => {
    expect(etatMesurePublication({ date: jourAvant(2), releves: [releve("zernio", {})] }, MAINTENANT)).toBe("pas-encore");
    expect(etatMesurePublication({ date: jourAvant(9), releves: [releve("zernio", {})] }, MAINTENANT)).toBe("non-disponible");
  });

  it("un relevé de liens suivis seul (source « api ») ne rend pas la publication mesurée", () => {
    expect(etatMesurePublication({ date: jourAvant(2), releves: [releve("api", { vues: 5 })] }, MAINTENANT)).toBe("pas-encore");
  });
});

function carrousel(id: string, reseau: VideoMesuree["reseau"], partagesParPortee: number): VideoMesuree {
  return carrouselCommeVideoMesuree({ publicationId: `pub-${id}`, visuelId: `vis-${id}`, famille: "carrousel", titre: `Carrousel ${id}`, reseau, date: jourAvant(3), stats: stats(100, partagesParPortee) });
}
function video(id: string, reseau: VideoMesuree["reseau"], partagesParPortee: number): VideoMesuree {
  return { publicationId: `pv-${id}`, varianteId: `var-${id}`, code: `TEST-${id}`, titre: `Vidéo ${id}`, reseau, formatId: "avocat", date: jourAvant(3), resultats: { vues: 100, partagesParPortee } };
}

describe("carrouselCommeVideoMesuree : aucun champ inventé", () => {
  it("formatId = famille, varianteId = visuel, code vide, résultats depuis les statistiques", () => {
    const c = carrouselCommeVideoMesuree({ publicationId: "p1", visuelId: "vis-1", famille: "carrousel-continu", titre: "Titre de test", reseau: "instagram", date: jourAvant(3), stats: stats(250, 1.5) });
    expect(c).toMatchObject({ publicationId: "p1", varianteId: "vis-1", formatId: "carrousel-continu", code: "", titre: "Titre de test", reseau: "instagram" });
    expect(c.resultats).toMatchObject({ vues: 250, partagesParPortee: 1.5 });
    expect(c.structure).toBeUndefined();
    expect(c.ouverture).toBeUndefined();
  });

  it("statistiques absentes → résultats vides, jamais zéro", () => {
    const c = carrouselCommeVideoMesuree({ publicationId: "p1", visuelId: "vis-1", famille: "carrousel", titre: "T", reseau: "instagram", date: jourAvant(3), stats: undefined });
    expect(c.resultats).toEqual({});
  });
});

describe("deux classements séparés", () => {
  it("3 vidéos et 3 carrousels sur le même réseau : chacun a ses positions, dans le sien", () => {
    const videos = [video("a", "instagram", 9), video("b", "instagram", 5), video("c", "instagram", 1)];
    const carrousels = [carrousel("x", "instagram", 100), carrousel("y", "instagram", 50), carrousel("z", "instagram", 10)];
    const rv = rangsParReseau(videos).instagram!;
    const rc = classerCarrousels(carrousels).reseaux.find((r) => r.reseau === "instagram")!.rangs;
    expect(rv.map((r) => [r.video.code, r.rang, r.sur])).toEqual([["TEST-a", 1, 3], ["TEST-b", 2, 3], ["TEST-c", 3, 3]]);
    expect(rc.map((r) => [r.video.varianteId, r.rang, r.sur])).toEqual([["vis-x", 1, 3], ["vis-y", 2, 3], ["vis-z", 3, 3]]);
    // Un carrousel n'entre jamais dans le rang d'une vidéo, et inversement.
    expect(rv.every((r) => r.video.code.startsWith("TEST-"))).toBe(true);
    expect(rc.every((r) => r.video.code === "")).toBe(true);
  });

  it("2 carrousels → trop tôt (moins du minimum du groupe)", () => {
    expect(MINIMUM_GROUPE).toBe(3);
    const c = classerCarrousels([carrousel("x", "instagram", 5), carrousel("y", "instagram", 4)]);
    expect(c.tropTot).toBe(true);
    expect(c.reseaux.find((r) => r.reseau === "instagram")!.tropTot).toBe(true);
    expect(classerCarrousels([carrousel("x", "instagram", 5), carrousel("y", "instagram", 4), carrousel("z", "instagram", 3)]).tropTot).toBe(false);
  });

  it("aucun carrousel → trop tôt, liste vide", () => {
    const c = classerCarrousels([]);
    expect(c).toMatchObject({ nombre: 0, tropTot: true });
    expect(c.reseaux).toEqual([]);
  });
});

describe("TikTok sans portée : « non disponible », jamais zéro", () => {
  it("l'indicateur « partages » est non disponible sur TikTok, pas ailleurs", () => {
    expect(MESURES_NON_DISPONIBLES.tiktok).toContain("partages");
    expect(MESURES_NON_DISPONIBLES.instagram).toBeUndefined();
  });

  it("le classement le porte, et aucun rang de partages n'est inventé", () => {
    const tt = classerCarrousels([carrousel("x", "tiktok", 0), carrousel("y", "tiktok", 0), carrousel("z", "tiktok", 0)]).reseaux.find((r) => r.reseau === "tiktok")!;
    expect(tt.nonDisponibles).toContain("partages");
    for (const r of tt.rangs) expect(r.parIndicateur.partages).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Service (dépôts en mémoire)                                          */
/* ------------------------------------------------------------------ */

async function visuel(id: string, extra: Record<string, unknown> = {}) {
  await depots().visuels.enregistrer({ id, famille: "carrousel", titre: `Titre ${id}`, entree: { type: "session" }, statut: "valide", modeTexte: "simulation", versionSpec: 1, coutCentimes: 0, creeLe: jourAvant(20), modifieLe: jourAvant(20), ...extra } as never);
}
async function publicationVisuel(id: string, visuelId: string, extra: Record<string, unknown> = {}) {
  await depots().publications.enregistrer({ id, visuelId, reseau: "instagram", statut: "publiee", via: "zernio", date: jourAvant(3), texte: "", creeLe: jourAvant(3), modifieLe: jourAvant(3), ...extra } as never);
}
const releveZ = (v: Partial<StatsPublication>) => ({ le: jourAvant(1), jour: 2, source: "zernio" as const, valeurs: v as StatsPublication, definitions: {} });

describe("ceQuiMarcheVisuels (dépôts en mémoire)", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
  });

  it("classe les carrousels mesurés et compte les trois états", async () => {
    for (const [i, part] of [9, 5, 1].entries()) {
      await visuel(`v${i}`);
      await publicationVisuel(`p${i}`, `v${i}`, { stats: stats(100, part), releves: [releveZ(stats(100, part))] });
    }
    await visuel("vattente");
    await publicationVisuel("pattente", "vattente", { date: jourAvant(2) });
    await visuel("vperdu");
    await publicationVisuel("pperdu", "vperdu", { date: jourAvant(8) });
    const r = await mv.ceQuiMarcheVisuels(MAINTENANT);
    expect(r.etats).toEqual({ mesure: 3, pasEncore: 1, nonDisponible: 1 });
    expect(r.classement.nombre).toBe(3);
    expect(r.classement.tropTot).toBe(false);
    const ig = r.classement.reseaux.find((x) => x.reseau === "instagram")!;
    expect(ig.rangs.map((x) => [x.video.titre, x.rang])).toEqual([["Titre v0", 1], ["Titre v1", 2], ["Titre v2", 3]]);
  });

  it("ignore une publication simulée, un visuel à la corbeille et un visuel disparu", async () => {
    await visuel("v1");
    await publicationVisuel("p-sim", "v1", { via: "simulation", stats: stats(100, 5), releves: [releveZ(stats(100, 5))] });
    await visuel("v2", { corbeilleLe: jourAvant(1) });
    await publicationVisuel("p-corb", "v2", { stats: stats(100, 5), releves: [releveZ(stats(100, 5))] });
    await publicationVisuel("p-disparu", "v-inconnu", { stats: stats(100, 5), releves: [releveZ(stats(100, 5))] });
    const r = await mv.ceQuiMarcheVisuels(MAINTENANT);
    expect(r.etats).toEqual({ mesure: 0, pasEncore: 0, nonDisponible: 0 });
    expect(r.classement.nombre).toBe(0);
  });

  it("une publication de vidéo n'est jamais lue ici", async () => {
    await depots().publications.enregistrer({ id: "pv", videoId: "v-02", reseau: "instagram", statut: "publiee", via: "zernio", date: jourAvant(3), texte: "", stats: stats(100, 5), creeLe: jourAvant(3), modifieLe: jourAvant(3) } as never);
    const r = await mv.ceQuiMarcheVisuels(MAINTENANT);
    expect(r.etats).toEqual({ mesure: 0, pasEncore: 0, nonDisponible: 0 });
  });

  it("ceQuiMarche() rend EXACTEMENT ce qu'il rendait avant : aucun carrousel dans le rang des vidéos", async () => {
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "Peut-on lire des factures ?", reseaux: ["tiktok", "linkedin"], formatId: "avocat" });
    const e = await gen.ecrireSujetSimule(s.id);
    if (!e.ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    const tt = vue.versions.find((v) => v.variante.reseau === "tiktok")!.variante;
    await gen.validerVersions([tt.id]);
    await gen.rangerVideo("v-02", tt.id);
    for (const [i, part] of [8, 4, 2].entries()) {
      await depots().publications.enregistrer({ id: `PV${i}`, videoId: "v-02", reseau: "instagram", statut: "publiee", via: "buffer", date: jourAvant(5), texte: "", varianteId: tt.id, stats: stats(100, part), creeLe: jourAvant(5), modifieLe: jourAvant(5) } as never);
    }
    const avant = await mc.ceQuiMarche();
    expect(avant.nombre).toBe(3);
    for (const [i, part] of [99, 50, 10].entries()) {
      await visuel(`c${i}`);
      await publicationVisuel(`pc${i}`, `c${i}`, { stats: stats(100, part), releves: [releveZ(stats(100, part))] });
    }
    const apres = await mc.ceQuiMarche();
    expect(apres).toEqual(avant);
    expect((await mv.ceQuiMarcheVisuels(MAINTENANT)).classement.nombre).toBe(3);
  });

  it("n'écrit rien : les dépôts sont identiques avant et après la lecture", async () => {
    await visuel("v1");
    await publicationVisuel("p1", "v1", { stats: stats(100, 5), releves: [releveZ(stats(100, 5))] });
    const avant = JSON.stringify([await depots().publications.lister(), await depots().visuels.lister()]);
    await mv.ceQuiMarcheVisuels(MAINTENANT);
    expect(JSON.stringify([await depots().publications.lister(), await depots().visuels.lister()])).toBe(avant);
  });
});

/* ------------------------------------------------------------------ */
/* Texte source et rendu                                                */
/* ------------------------------------------------------------------ */

describe("texte source : lecture seule", () => {
  const lire = (f: string) => readFileSync(join(__dirname, "..", "..", f), "utf8");
  const SOURCES = ["src/domaine/mesures-visuels.ts", "src/services/mesures-visuels.ts", "src/components/mesures/CeQuiMarcheVisuels.tsx"];

  it("aucun import réseau, notification, diffuseur ni lecture de réglage ; aucune écriture", () => {
    for (const f of SOURCES) {
      const src = lire(f);
      expect(src, f).not.toMatch(/from\s+["'][^"']*(\.\/zernio|@\/fournisseurs|\.\/notifications|\/zernio)/);
      expect(src, f).not.toMatch(/lireParametre|\bfetch\(|\.enregistrer\(|\.modifier\(|\.supprimer\(/);
    }
  });

  it("le service est réservé au serveur et le domaine n'importe que des types et mesures-rangs", () => {
    expect(lire("src/services/mesures-visuels.ts")).toMatch(/import "server-only"/);
    expect(lire("src/domaine/mesures-visuels.ts")).not.toMatch(/from\s+["']@\/services/);
  });

  it("la page garde sa section actuelle et ajoute SEULEMENT la section des carrousels dessous", () => {
    const page = lire("src/app/(studio)/mesures/ce-qui-marche/page.tsx");
    expect(page).toContain("<CeQuiMarche donnees={donnees}");
    expect(page).toContain("ceQuiMarcheVisuels()");
    expect(page).toContain("<CeQuiMarcheVisuels");
    expect(page.indexOf("<CeQuiMarcheVisuels")).toBeGreaterThan(page.indexOf("<CeQuiMarche donnees"));
  });
});

describe("rendu du composant", () => {
  function rendre(carrousels: VideoMesuree[], etats = { mesure: carrousels.length, pasEncore: 1, nonDisponible: 2 }) {
    const classement = classerCarrousels(carrousels);
    return renderToStaticMarkup(createElement(CeQuiMarcheVisuels, { donnees: { classement, etats } }));
  }
  const textes = (html: string) => html.split(/<[^>]+>/).map((t) => t.trim()).filter(Boolean);

  it("section « Carrousels » et ligne d'état", () => {
    const html = rendre([carrousel("x", "instagram", 9), carrousel("y", "instagram", 5), carrousel("z", "instagram", 1)]);
    expect(html).toContain("Carrousels");
    expect(html).toContain("3 mesurés · 1 pas encore · 2 non disponibles");
    expect(html).toContain("Titre");
  });

  it("aucun « € », aucun montant, aucun interdit sur chaque libellé ; vouvoiement, pas de nom d'outil", () => {
    const html = rendre([carrousel("x", "tiktok", 0), carrousel("y", "tiktok", 0), carrousel("z", "tiktok", 0)]) + rendre([carrousel("x", "instagram", 5)]) + rendre([], { mesure: 0, pasEncore: 0, nonDisponible: 0 });
    expect(html).not.toMatch(/€|euro|\$|crédit|prix/i);
    expect(html).not.toMatch(/buffer|zernio|\bapi\b|kit|variante/i);
    for (const t of textes(html)) expect(interditsTousEcrivains(t), t).toEqual([]);
  });

  it("TikTok : « non disponible » est écrit, jamais un zéro à la place", () => {
    const html = rendre([carrousel("x", "tiktok", 0), carrousel("y", "tiktok", 0), carrousel("z", "tiktok", 0)]);
    expect(html).toMatch(/non disponible/i);
    expect(textes(html).filter((t) => /^0(\s|$|%)/.test(t))).toEqual([]);
  });

  it("2 carrousels : « trop tôt »", () => {
    expect(rendre([carrousel("x", "instagram", 5), carrousel("y", "instagram", 4)])).toMatch(/trop tôt/i);
  });

  it("aucun carrousel : message clair, pas de classement", () => {
    const html = rendre([], { mesure: 0, pasEncore: 0, nonDisponible: 0 });
    expect(html).toMatch(/pas encore/i);
    expect(html).toContain("0 mesuré");
  });
});
