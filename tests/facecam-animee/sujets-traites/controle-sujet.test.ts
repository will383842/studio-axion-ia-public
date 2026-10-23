/**
 * LOT L7 · PRISE DÉJÀ TRAITÉE DANS « FACE CAMÉRA ANIMÉE ». Le contrôle `verifierSujet` joue dans `deposerFacecamAnimee` (et donc
 * dans la version en lot), SEULEMENT pour un nouveau dépôt, AVANT le brouillon et le lancement ; dans un envoi groupé la prise
 * déjà traitée est SAUTÉE et nommée. Clé exacte : empreinte sha256, sinon nom + taille, sinon référence du fichier.
 * Dépôts en mémoire, brouillon et lancement en doubles : rien n'est fabriqué ni payé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id, Video } from "@/domaine/types";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
// Petite banque de l'Usine : jamais d'import à froid du fichier de 2,8 Mo.
vi.mock("@/donnees/bases-usine", () => ({ metiers: () => [], casUsage: () => [] }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const fa = await import("@/services/facecam-animee");
const { ecrireParametre } = await import("@/services/_commun");
const sujet = await import("@/components/formats/facecam-animee/sujet-deja-traite");
const reseau = vi.spyOn(globalThis, "fetch");

const horo = () => ({ creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
let n = 0;
const lancees: Id[] = [];
const sansSha = new Set<string>();
/** Prises dont le contenu (empreinte) est celui d'une autre : `{ B: "A" }` = B a la même empreinte que A. */
const memeContenu: Record<string, string> = {};

const dep = (plus: Record<string, unknown> = {}) => ({
  fichier: async (id: string) => ({ id, cleStockage: `k/${id}`, mime: "video/mp4", taille: 5000 + id.length, nom: `${id}.mp4`, ...(sansSha.has(id) ? {} : { sha256: `sha-${memeContenu[id] ?? id}` }) }),
  accordEssai: async () => true,
  enregistrerAccord: async () => undefined,
  brouillon: async (e: { titre: string; entrees: Record<string, unknown> }) => {
    const id = `v-${n++}`;
    await depots().videos.enregistrer({ id, titre: e.titre, entrees: e.entrees, statut: "brouillon", formatId: "facecam-animee", ...horo() } as unknown as Video);
    return { id };
  },
  // Le vrai lancement passe la vidéo « en_file » : c'est ce qui la fait compter au registre.
  lancer: async (videoId: Id) => {
    lancees.push(videoId);
    await depots().videos.modifier(videoId, { statut: "en_file" } as never);
    return { travailId: `t-${videoId}` };
  },
  abandonner: async () => undefined,
  ...plus,
});

/** Une vidéo Face caméra animée déjà faite pour la prise `id`. */
async function videoDeLaPrise(id: string, statut: Video["statut"] = "prete", extra: Partial<Video> = {}, avecFichier = true) {
  if (avecFichier) await depots().fichiers.enregistrer({ id, cleStockage: `k/${id}`, nom: `${id}.mp4`, taille: 5000 + id.length, mime: "video/mp4", sha256: `sha-${id}`, ...horo() } as never);
  await depots().videos.enregistrer({ id: `v-${id}-${statut}`, titre: `Prise ${id}`, formatId: "facecam-animee", statut, entrees: { facecamAnimee: { fichierId: id, priseCle: `k/${id}`, dureePriseSec: 60 } }, ...horo(), ...extra } as unknown as Video);
}

const demande = (fichierId: string, plus: Record<string, unknown> = {}) => ({ fichierId, dureeSec: 60, ...plus });
const deposer = (fichierId: string, plus: Record<string, unknown> = {}, deps: Record<string, unknown> = {}) => fa.deposerFacecamAnimee(demande(fichierId, plus) as never, dep(deps) as never);
const lot = (ids: string[], plus: Record<string, unknown> = {}) => fa.deposerFacecamAnimeeLot(ids.map((id) => demande(id)) as never, dep(plus) as never);
const compter = async () => ({ videos: await depots().videos.compter(), travaux: await depots().travaux.compter(), depenses: await depots().depenses.compter() });

beforeEach(() => {
  reinitialiserDepots();
  n = 0;
  lancees.length = 0;
  sansSha.clear();
  for (const k of Object.keys(memeContenu)) delete memeContenu[k];
});
afterEach(() => {
  expect(reseau).not.toHaveBeenCalled();
});

describe("prise seule : la même prise déposée deux fois est refusée, rien n'est créé ni lancé", () => {
  it("vidéo prête sur la même empreinte : refus, précédents avec lien, jeton", async () => {
    await videoDeLaPrise("A");
    const avant = await compter();
    const r = await deposer("A");
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut !== "sujet-deja-traite") return;
    expect(r.niveau).toBe("identique");
    expect(r.precedents.map((p) => p.videoId)).toEqual(["v-A-prete"]);
    expect(r.precedents[0]!.lien).toBe("/videos/v-A-prete");
    expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    expect(r.nom).toBe("A.mp4");
    expect(r).not.toHaveProperty("suggestions");
    expect(await compter()).toEqual(avant);
    expect(lancees).toEqual([]);
  });

  it("une prise différente passe et est lancée", async () => {
    await videoDeLaPrise("A");
    const r = await deposer("B");
    expect(r.statut).toBe("lancee");
    expect(lancees.length).toBe(1);
  });

  it("même contenu sous un autre fichier (même empreinte) : refusé", async () => {
    await videoDeLaPrise("A");
    memeContenu.B = "A";
    expect((await deposer("B")).statut).toBe("sujet-deja-traite");
  });

  it("sans empreinte : nom normalisé + taille, puis référence de stockage", async () => {
    sansSha.add("A");
    await depots().fichiers.enregistrer({ id: "A", cleStockage: "k/A", nom: "A.mp4", taille: 5001, mime: "video/mp4", ...horo() } as never);
    await videoDeLaPrise("A", "prete", {}, false);
    expect((await deposer("A")).statut).toBe("sujet-deja-traite");
    reinitialiserDepots();
    sansSha.add("C");
    await videoDeLaPrise("C", "prete", {}, false);
    expect((await deposer("C")).statut).toBe("sujet-deja-traite");
  });

  it("même nom et même taille mais empreintes différentes : deux prises", async () => {
    await videoDeLaPrise("A");
    const r = await deposer("B", {}, { fichier: async () => ({ id: "B", cleStockage: "k/B", mime: "video/mp4", taille: 5001, nom: "A.mp4", sha256: "sha-B" }) });
    expect(r.statut).toBe("lancee");
  });
});

describe("échec puis relance : libre", () => {
  it("une vidéo en échec ne compte pas : redéposer la prise part", async () => {
    await videoDeLaPrise("A", "echec");
    expect((await deposer("A")).statut).toBe("lancee");
  });

  it("une vidéo archivée ne compte pas ; une prête archivée compte encore", async () => {
    await videoDeLaPrise("A", "archivee");
    expect((await deposer("A")).statut).toBe("lancee");
    await videoDeLaPrise("C", "archivee", { statutAvantArchive: "prete" } as never);
    expect((await deposer("C")).statut).toBe("sujet-deja-traite");
  });
});

describe("« Refaire quand même » : jeton", () => {
  it("bon jeton : le dépôt part, avec la trace au journal", async () => {
    await videoDeLaPrise("A");
    const refus = await deposer("A");
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const r = await deposer("A", { sujet: { choix: "refaire", jeton: refus.jeton } });
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const journal = await depots().evenements.lister((e) => e.entiteId === r.videoId);
    expect(journal.some((e) => /prise déjà traitée.*choix « refaire »/.test(e.message))).toBe(true);
  });

  it("jeton périmé (une autre vidéo est apparue) : refus de nouveau, rien créé", async () => {
    await videoDeLaPrise("A");
    const refus = await deposer("A");
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    await depots().videos.enregistrer({ id: "v-autre", titre: "Autre", formatId: "facecam-animee", statut: "en_file", entrees: { facecamAnimee: { fichierId: "A", priseCle: "k/A" } }, ...horo() } as unknown as Video);
    const avant = await compter();
    const r = await deposer("A", { sujet: { choix: "refaire", jeton: refus.jeton } });
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.jetonPerime).toBe(true);
    expect(await compter()).toEqual(avant);
  });

  it("jeton d'une autre prise, inventé ou mal formé : refusé", async () => {
    await videoDeLaPrise("A");
    await videoDeLaPrise("B");
    const refusA = await deposer("A");
    if (refusA.statut !== "sujet-deja-traite") throw new Error("attendu");
    expect((await deposer("B", { sujet: { choix: "refaire", jeton: refusA.jeton } })).statut).toBe("sujet-deja-traite");
    for (const brut of [{ choix: "refaire", jeton: "0000000000000000" }, { choix: "n-importe-quoi", jeton: "x" }, { jeton: "x" }, "oui"]) {
      expect((await deposer("A", { sujet: brut })).statut).toBe("sujet-deja-traite");
    }
    expect(lancees).toEqual([]);
  });
});

describe("double clic : un seul dépôt", () => {
  it("deux dépôts simultanés de la même prise : un seul part, l'autre est refusé", async () => {
    const [a, b] = await Promise.all([deposer("A"), deposer("A")]);
    expect([a.statut, b.statut].sort()).toEqual(["lancee", "sujet-deja-traite"]);
    expect(lancees.length).toBe(1);
  });
});

describe("réglage sujets.garde", () => {
  it("« eteint » : exactement comme avant (même issue, mêmes champs), avec ou sans vidéo prête", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    const sans = await deposer("A");
    reinitialiserDepots();
    await ecrireParametre("sujets.garde", "eteint");
    await videoDeLaPrise("A");
    const avec = await deposer("A");
    expect(sans.statut).toBe("lancee");
    expect(avec.statut).toBe("lancee");
    expect(Object.keys(avec).sort()).toEqual(Object.keys(sans).sort());
    expect(avec).not.toHaveProperty("avertissement");
  });

  it("« avertissement » : la prise déjà traitée passe, avec l'avertissement", async () => {
    await ecrireParametre("sujets.garde", "avertissement");
    await videoDeLaPrise("A");
    const r = await deposer("A");
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.avertissement?.precedents.map((p) => p.videoId)).toEqual(["v-A-prete"]);
  });
});

describe("D1 : la même image dans un AUTRE générateur prévient sans bloquer", () => {
  it("image d'Image → vidéo sur le même fichier : lancée, avec avertissement", async () => {
    await depots().fichiers.enregistrer({ id: "A", cleStockage: "k/A", nom: "A.mp4", taille: 5001, mime: "video/mp4", sha256: "sha-A", ...horo() } as never);
    await depots().videos.enregistrer({ id: "v-iv", titre: "Image", formatId: "image-video", statut: "prete", entrees: { imageVideo: { imageCle: "k/A", fichierId: "A", empreinte: "sha-A" } }, ...horo() } as unknown as Video);
    const r = await deposer("A");
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.avertissement).toMatchObject({ precedents: [{ videoId: "v-iv", generateur: "image-video" }] });
  });
});

describe("envoi groupé : la prise déjà traitée est sautée et nommée, les autres partent", () => {
  it("3 prises dont 1 déjà prête : 2 lancées, 1 sautée nommée, phrase unique", async () => {
    await videoDeLaPrise("B");
    const { issues, phraseSautees } = await lot(["A", "B", "C"]);
    expect(issues.map((i) => [i.fichierId, i.statut])).toEqual([["A", "lancee"], ["B", "sujet-deja-traite"], ["C", "lancee"]]);
    expect(lancees.length).toBe(2);
    expect(phraseSautees).toBe("1 vidéo est déjà traitée et sautée (B.mp4) : 2 vidéos partent.");
  });

  it("la même prise en double dans l'envoi : une seule part ; même contenu sous un autre fichier : le second est sauté", async () => {
    memeContenu.C = "A";
    // Comme en production, le fichier envoyé est dans le dépôt avec son empreinte : la vidéo de A en porte la clé.
    await depots().fichiers.enregistrer({ id: "A", cleStockage: "k/A", nom: "A.mp4", taille: 5001, mime: "video/mp4", sha256: "sha-A", ...horo() } as never);
    const { issues, phraseSautees } = await fa.deposerFacecamAnimeeLot([demande("A"), demande("A"), demande("C"), demande("D")] as never, dep() as never);
    expect(issues.map((i) => [i.fichierId, i.statut])).toEqual([["A", "lancee"], ["C", "sujet-deja-traite"], ["D", "lancee"]]);
    expect(phraseSautees).toContain("(C.mp4)");
  });

  it("toutes déjà traitées : rien n'est lancé, aucune vidéo créée", async () => {
    await videoDeLaPrise("A");
    await videoDeLaPrise("B");
    const avant = await compter();
    const { issues, phraseSautees } = await lot(["A", "B"]);
    expect(issues.every((i) => i.statut === "sujet-deja-traite")).toBe(true);
    expect(phraseSautees).toContain("Aucune ne part");
    expect(await compter()).toEqual(avant);
  });

  it("une prise dont la vidéo a échoué n'est pas sautée", async () => {
    await videoDeLaPrise("B", "echec");
    const { issues, phraseSautees } = await lot(["A", "B"]);
    expect(issues.map((i) => i.statut)).toEqual(["lancee", "lancee"]);
    expect(phraseSautees).toBeUndefined();
  });

  it("pas de trou « brouillon » : les prises d'un envoi sont lancées tout de suite, donc comptées au registre", async () => {
    await lot(["A", "B"]);
    expect((await deposer("A")).statut).toBe("sujet-deja-traite");
  });

  it("« eteint » : tout part, comme avant", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    await videoDeLaPrise("B");
    const { issues, phraseSautees } = await lot(["A", "B"]);
    expect(issues.map((i) => i.statut)).toEqual(["lancee", "lancee"]);
    expect(phraseSautees).toBeUndefined();
  });
});

describe("fonctions pures de l'écran", () => {
  it("anti double clic : un second clic pendant l'envoi est ignoré", () => {
    expect(sujet.clicIgnore(true)).toBe(true);
    expect(sujet.clicIgnore(false)).toBe(false);
  });

  it("avertissement d'un autre type de vidéo : titres sans doublon, trois au plus, vide sans titre", () => {
    expect(sujet.phraseAvertissement([])).toBe("");
    expect(sujet.phraseAvertissement(["A", "A", "B"])).toBe("Cette vidéo existe déjà dans un autre type de vidéo : A · B.");
    expect(sujet.phraseAvertissement(["A", "B", "C", "D"])).toBe("Cette vidéo existe déjà dans un autre type de vidéo : A · B · C.");
  });

  it("phrase de l'envoi groupé : une prise, plusieurs, aucune", () => {
    expect(sujet.phrasePrisesSautees([], 3)).toBe("");
    expect(sujet.phrasePrisesSautees(["a.mp4"], 4)).toBe("1 vidéo est déjà traitée et sautée (a.mp4) : 4 vidéos partent.");
    expect(sujet.phrasePrisesSautees(["a.mp4", "b.mp4"], 1)).toBe("2 vidéos sont déjà traitées et sautées (a.mp4, b.mp4) : 1 vidéo part.");
    expect(sujet.phrasePrisesSautees(["a.mp4"], 0)).toContain("Aucune ne part");
  });
});
