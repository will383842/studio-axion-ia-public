/**
 * L8-11b : service de création d'une nouvelle version (proposition « à valider »). Dépôts en mémoire (doublures), aucun appel réel,
 * données fictives. Rien n'est validé, envoyé ni programmé.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import { creerNouvelleVersion, type DemandeNouvelleVersion, type DepsRepublication } from "@/services/republication";
import type { CreneauPlan, DepotsPlan } from "@/services/plan-editorial";

const JOUR_MS = 24 * 3600 * 1000;
const NOW = "2026-12-01T08:00:00.000Z";
const ORIGINE = new Date(Date.parse(NOW) - 100 * JOUR_MS).toISOString();
const TEXTE_ORIGINE = "Voici comment nous préparons un lot de vidéos chaque lundi matin pour gagner du temps toute la semaine.";
const TEXTE_NEUF = "Notre méthode du lundi : trois gestes simples pour avancer sans stress cette semaine.";

function faux<T extends { id: string }>(): Depot<T> {
  const m = new Map<string, T>();
  return {
    async lister(f) { return [...m.values()].filter((e) => !f || f(e)).map((e) => structuredClone(e)); },
    async obtenir(id) { const e = m.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...m.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { m.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) { const e = m.get(id); if (!e) throw new Error("absent"); const n = { ...e, ...p }; m.set(id, n); return structuredClone(n); },
  } as Depot<T>;
}

const pub = (sur: Partial<Publication> = {}): Publication => ({
  id: "pub-1", reseau: "instagram", statut: "publiee", via: "manuel", date: ORIGINE, texte: TEXTE_ORIGINE, videoId: "video-1",
  creeLe: ORIGINE, modifieLe: ORIGINE, ...sur,
} as Publication);

function monde(maintenant = NOW, publications: Publication[] = [pub()]) {
  const creneaux = faux<CreneauPlan>();
  const journal = faux<JournalDecalage>();
  const pubs = faux<Publication>();
  const ecritures: string[] = [];
  const enregistrer = creneaux.enregistrer.bind(creneaux);
  creneaux.enregistrer = async (e) => { ecritures.push(`${e.id}:${e.statut}`); return enregistrer(e); };
  const prets = Promise.all(publications.map((p) => pubs.enregistrer(p)));
  const deps: DepsRepublication = { plan: { creneaux, journal } as DepotsPlan, publications: pubs, maintenant: () => maintenant };
  return { deps, creneaux, journal, pubs, ecritures, prets };
}

const demande = (sur: Partial<DemandeNouvelleVersion> = {}): DemandeNouvelleVersion => ({
  publicationId: "pub-1", jour: "2026-12-10", heure: "10:00", texte: TEXTE_NEUF, compteCible: "compte-fictif-1", ...sur,
});

async function refuse(m: ReturnType<typeof monde>, d: DemandeNouvelleVersion): Promise<string[]> {
  await m.prets;
  const avant = JSON.stringify(await m.creneaux.lister());
  const r = await creerNouvelleVersion(m.deps, d);
  expect(r.ok).toBe(false);
  expect(JSON.stringify(await m.creneaux.lister())).toBe(avant);
  expect(m.ecritures).toEqual([]);
  expect(await m.journal.lister()).toEqual([]);
  return r.ok ? [] : r.motifs;
}

describe("L8-11b : cas nominal", () => {
  it("crée UN créneau « a_valider », sans validation, origine « vous », même média, texte enregistré", async () => {
    const m = monde();
    await m.prets;
    const r = await creerNouvelleVersion(m.deps, demande());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.deja).toBe(false);
    expect(r.creneau).toMatchObject({
      id: "republication-pub-1-1", statut: "a_valider", origine: "vous", videoId: "video-1", jourVise: "2026-12-10",
      compteCible: "compte-fictif-1", decalages: 0, textes: { instagram: { texte: TEXTE_NEUF, premierCommentaire: "" } },
      heuresParReseau: { instagram: "2026-12-10T09:00:00.000Z" },
    });
    expect(r.creneau.valideeLe).toBeUndefined();
    expect(r.creneau.valideePar).toBeUndefined();
    expect(r.creneau.visuelId).toBeUndefined();
    expect(await m.creneaux.lister()).toHaveLength(1);
    expect(m.ecritures).toEqual(["republication-pub-1-1:propose", "republication-pub-1-1:a_valider"]);
  });

  it("reprend le visuel d'un original en visuel", async () => {
    const m = monde(NOW, [pub({ videoId: undefined, visuelId: "visuel-1" })]);
    await m.prets;
    const r = await creerNouvelleVersion(m.deps, demande());
    expect(r.ok && r.creneau.visuelId).toBe("visuel-1");
    expect(r.ok && r.creneau.videoId).toBeUndefined();
  });
});

describe("L8-11b : idempotence et rangs", () => {
  it("deuxième appel identique : même créneau, deja: true, un seul créneau", async () => {
    const m = monde();
    await m.prets;
    const a = await creerNouvelleVersion(m.deps, demande());
    const b = await creerNouvelleVersion(m.deps, demande());
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.deja).toBe(true);
    expect(b.creneau).toEqual(a.creneau);
    expect(await m.creneaux.lister()).toHaveLength(1);
  });

  it("une nouvelle version restée « propose » est menée à « a_valider » au rejeu, sans seconde", async () => {
    const m = monde();
    await m.prets;
    await m.creneaux.enregistrer({
      id: "republication-pub-1-1", jourVise: "2026-12-10", heuresParReseau: { instagram: "2026-12-10T09:00:00.000Z" }, compteCible: "compte-fictif-1",
      videoId: "video-1", statut: "propose", decalages: 0, origine: "vous",
    });
    const r = await creerNouvelleVersion(m.deps, demande());
    expect(r.ok && r.deja).toBe(true);
    expect(r.ok && r.creneau.statut).toBe("a_valider");
    expect(await m.creneaux.lister()).toHaveLength(1);
  });

  it("après archivage de la première : rang 2 accepté ; puis rang 3 refusé", async () => {
    const m = monde();
    await m.prets;
    const a = await creerNouvelleVersion(m.deps, demande());
    expect(a.ok).toBe(true);
    await m.creneaux.modifier("republication-pub-1-1", { statut: "archive" });
    const b = await creerNouvelleVersion(m.deps, demande({ jour: "2026-12-17" }));
    expect(b.ok && b.creneau.id).toBe("republication-pub-1-2");
    expect(b.ok && b.deja).toBe(false);
    await m.creneaux.modifier("republication-pub-1-2", { statut: "archive" });
    const avant = JSON.stringify(await m.creneaux.lister());
    const c = await creerNouvelleVersion(m.deps, demande({ jour: "2026-12-24" }));
    expect(c).toEqual({ ok: false, motifs: ["Ce contenu a déjà atteint le maximum de 2 nouvelles versions."] });
    expect(JSON.stringify(await m.creneaux.lister())).toBe(avant);
  });
});

describe("L8-11b : refus sans aucune écriture", () => {
  it("jour déjà occupé sur le réseau, motif unique", async () => {
    const m = monde();
    await m.prets;
    await m.creneaux.enregistrer({
      id: "autre", jourVise: "2026-12-10", heuresParReseau: { instagram: "2026-12-10T15:00:00.000Z" }, compteCible: "compte-fictif-1",
      videoId: "video-2", statut: "valide", decalages: 0,
    });
    m.ecritures.length = 0;
    expect(await refuse(m, demande())).toEqual(["Ce jour est déjà occupé sur ce réseau : choisissez un autre jour."]);
  });

  it("écart L3-15 trop court (veille proche, jour différent)", async () => {
    const m = monde();
    await m.prets;
    await m.creneaux.enregistrer({
      id: "autre", jourVise: "2026-12-09", heuresParReseau: { instagram: "2026-12-09T22:30:00.000Z" }, compteCible: "compte-fictif-1",
      videoId: "video-2", statut: "valide", decalages: 0,
    });
    m.ecritures.length = 0;
    const motifs = await refuse(m, demande({ heure: "00:30" }));
    expect(motifs).toEqual([expect.stringMatching(/^L'écart avec une autre publication de ce réseau est inférieur à \d+ h : choisissez une autre heure\.$/)]);
  });

  it("texte copié de l'original", async () => {
    const m = monde();
    expect(await refuse(m, demande({ texte: TEXTE_ORIGINE }))).toEqual(["Votre texte est identique à l'original : écrivez une version neuve."]);
  });

  it("texte vide", async () => {
    const m = monde();
    expect(await refuse(m, demande({ texte: "   " }))).toEqual(["Votre texte est vide : écrivez la nouvelle version."]);
  });

  it("jour passé", async () => {
    const m = monde();
    expect(await refuse(m, demande({ jour: "2026-11-20" }))).toEqual(["Ce jour est déjà passé : choisissez un jour à venir."]);
  });

  it("délai trop court depuis l'original", async () => {
    const m = monde(NOW, [pub({ date: new Date(Date.parse(NOW) - 5 * JOUR_MS).toISOString() })]);
    expect(await refuse(m, demande())).toEqual(["Le délai depuis la publication d'origine est trop court pour une nouvelle version sur ce réseau."]);
  });

  it("TikTok : même média que l'original = identique", async () => {
    const m = monde(NOW, [pub({ reseau: "tiktok" })]);
    expect(await refuse(m, demande())).toContain("Ce réseau refuse le même média que l'original : choisissez un média différent.");
  });

  it("jour ou heure illisible", async () => {
    const m = monde();
    expect(await refuse(m, demande({ heure: "9h" }))).toEqual(["Le jour ou l'heure n'est pas lisible : indiquez un jour AAAA-MM-JJ et une heure HH:MM."]);
  });

  it("heure inexistante au passage à l'heure d'été (29/03/2026 02:30) : refusée", async () => {
    const m = monde("2026-03-01T08:00:00.000Z", [pub({ date: "2025-12-01T09:00:00.000Z" })]);
    expect(await refuse(m, demande({ jour: "2026-03-29", heure: "02:30" }))).toEqual([
      "Cette heure n'existe pas à Paris le jour du changement d'heure : choisissez une autre heure.",
    ]);
  });

  it("jour du passage à l'heure d'été, heure existante (29/03/2026 10:00) : acceptée", async () => {
    const m = monde("2026-03-01T08:00:00.000Z", [pub({ date: "2025-12-01T09:00:00.000Z" })]);
    await m.prets;
    const r = await creerNouvelleVersion(m.deps, demande({ jour: "2026-03-29", heure: "10:00" }));
    expect(r.ok && r.creneau.heuresParReseau.instagram).toBe("2026-03-29T08:00:00.000Z");
  });

  it("heure d'hiver (25/10/2026 02:30, heure répétée) : première occurrence", async () => {
    const m = monde("2026-10-01T08:00:00.000Z", [pub({ date: "2026-06-01T09:00:00.000Z" })]);
    await m.prets;
    const r = await creerNouvelleVersion(m.deps, demande({ jour: "2026-10-25", heure: "02:30" }));
    expect(r.ok && r.creneau.heuresParReseau.instagram).toBe("2026-10-25T00:30:00.000Z");
  });

  it("aucun motif en double quand plusieurs règles disent la même chose", async () => {
    const m = monde();
    await m.prets;
    await m.creneaux.enregistrer({
      id: "autre", jourVise: "2026-12-10", heuresParReseau: { instagram: "2026-12-10T09:30:00.000Z" }, compteCible: "compte-fictif-1",
      videoId: "video-2", statut: "valide", decalages: 0,
    });
    const r = await creerNouvelleVersion(m.deps, demande());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(new Set(r.motifs).size).toBe(r.motifs.length);
  });

  it("compte cible invalide : jamais deviné", async () => {
    const m = monde();
    const attendu = ["Compte de publication inconnu : ajoutez cette entrée à la main depuis le calendrier."];
    expect(await refuse(m, demande({ compteCible: "" }))).toEqual(attendu);
    expect(await refuse(m, demande({ compteCible: "a b" }))).toEqual(attendu);
  });

  it("original introuvable", async () => {
    const m = monde();
    expect(await refuse(m, demande({ publicationId: "absente" }))).toEqual(["Le contenu d'origine est introuvable."]);
  });

  it("original non publié", async () => {
    const m = monde(NOW, [pub({ statut: "programmee" })]);
    expect(await refuse(m, demande())).toEqual(["Le contenu d'origine n'est pas publié : seule une publication déjà publiée peut avoir une nouvelle version."]);
  });

  it("original simulé", async () => {
    const m = monde(NOW, [pub({ via: "simulation" })]);
    expect(await refuse(m, demande())).toEqual(["Le contenu d'origine est une simulation : seule une publication réelle peut avoir une nouvelle version."]);
  });

  it("original sans média lisible", async () => {
    const m = monde(NOW, [pub({ videoId: undefined })]);
    expect(await refuse(m, demande())).toEqual(["Le média du contenu d'origine n'est pas lisible : la nouvelle version ne peut pas être créée."]);
  });
});

describe("L8-11b : verrou et garde statique", () => {
  it("contrôle, création et passage à « a_valider » se font dans un seul verrou", async () => {
    const m = monde();
    await m.prets;
    let enCours = 0;
    let entrees = 0;
    const evenements: string[] = [];
    const enregistrer = m.creneaux.enregistrer.bind(m.creneaux);
    m.creneaux.enregistrer = async (e) => { evenements.push(`ecrit:${e.statut}:${enCours}`); return enregistrer(e); };
    const deps: DepsRepublication = {
      ...m.deps,
      verrou: async (f) => { entrees++; enCours++; try { return await f(); } finally { enCours--; } },
    };
    const r = await creerNouvelleVersion(deps, demande());
    expect(r.ok).toBe(true);
    expect(entrees).toBe(1);
    expect(evenements).toEqual(["ecrit:propose:1", "ecrit:a_valider:1"]);
  });

  const source = readFileSync("src/services/republication.ts", "utf8");
  it("aucun import d'envoi, de fournisseur, de validation ni de réglage ; ni lecture de réglage, ni appel direct, ni action serveur", () => {
    for (const interdit of ["@/services/zernio", "@/fournisseurs", "envoi-depuis-creneau", "branchement-envoi-calendrier", "valider-entree", "reprise-envois"]) {
      expect(source).not.toContain(interdit);
    }
    expect(source).not.toContain("lireParametre");
    expect(source).not.toContain("." + "requete");
    expect(source).not.toMatch(/use server/);
    expect(source).not.toMatch(/"valide"|"programme"|valideeLe|valideePar/);
  });
});
