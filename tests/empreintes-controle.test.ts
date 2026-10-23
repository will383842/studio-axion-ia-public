/**
 * PR B · LE CONTRÔLE « DÉJÀ TRAITÉ » ATTEND L'EMPREINTE (image → vidéo, lot, face caméra animée).
 * Une copie RENOMMÉE du même fichier (autre nom, autre taille annoncée) est reconnue par son contenu (sha256).
 * Dépôts en mémoire ; le stockage est un double qui « lit » un contenu par clé ; brouillon et lancement en doubles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id, Travail, Video } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/donnees/bases-usine", () => ({ metiers: () => [], casUsage: () => [] }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const ecran = await import("@/services/image-video-ecran");
const lots = await import("@/services/image-video-lot");
const fa = await import("@/services/facecam-animee");
const emp = await import("@/services/empreintes-fichiers");
const { ecrireParametre } = await import("@/services/_commun");
const reseau = vi.spyOn(globalThis, "fetch");

const horo = () => ({ creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
const RESEAUX = ["youtube-shorts"];
const PRIX = ecran.prixDuDepot(["youtube-shorts"], 0.9);
let n = 0;

/** Contenu de chaque objet du « seau » (clé de stockage → contenu) ; une valeur Error = panne de lecture. */
const seau = new Map<string, string | Error>();
let lecturesSeau: string[] = [];
const stockage = {
  id: "faux",
  mode: "reel",
  async empreinteSha256(cle: string, taille: number) {
    lecturesSeau.push(cle);
    const c = seau.get(cle);
    if (c instanceof Error) throw c;
    if (c === undefined) throw Object.assign(new Error("R2 GET 404"), { statut: 404 });
    return { sha256: `hash-${c}`, taille };
  },
} as unknown as StockageFichiers;
const empreinte = <T extends { id: string; cleStockage: string; sha256?: string }>(f: T) => emp.empreinteAvantControle(f, { stockage, delaiRattrapageMs: 2000 });

const cleIV = (id: string) => `studio/dev/entree/image-video/${id}.png`;
const cleFA = (id: string) => `studio/dev/entree/facecam-animee/${id}.mp4`;

/** Dépose une fiche de fichier « prête » dans les dépôts et son contenu dans le seau. */
async function fichierDepose(id: string, cle: string, nom: string, taille: number, contenu: string, mime: string, sha256?: string, origine = "depot") {
  seau.set(cle, contenu);
  await depots().fichiers.enregistrer({ id, cleStockage: cle, nom, mime, taille, origine, statut: "pret", ...(sha256 ? { sha256 } : {}), ...horo() } as never);
}
const depFichier = (mime: string) => async (id: string) => {
  const f = await depots().fichiers.obtenir(id);
  if (!f) throw new Error("absent");
  return { id: f.id, cleStockage: f.cleStockage, mime, taille: f.taille, nom: f.nom, ...(f.sha256 ? { sha256: f.sha256 } : {}) };
};

const dep = (mime: string, plus: Record<string, unknown> = {}) => ({
  formatOuvert: () => true,
  voix: async () => ({ voixId: "vx", personnageId: "px" }),
  fichier: depFichier(mime),
  empreinte,
  accordEssai: async () => true,
  enregistrerAccord: async () => undefined,
  taux: async () => 0.9,
  brouillon: async (e: { titre: string; entrees: Record<string, unknown>; formatId?: string }) => {
    const id = `v-${n++}`;
    await depots().videos.enregistrer({ id, titre: e.titre, entrees: e.entrees, statut: "brouillon", formatId: mime.startsWith("video") ? "facecam-animee" : "image-video", ...horo() } as unknown as Video);
    return { id };
  },
  abandonner: async () => undefined,
  lancer: async (videoId: Id) => {
    await depots().videos.modifier(videoId, { statut: "en_file" } as never);
    await depots().travaux.enregistrer({ id: `t-${videoId}`, type: "video", cibleId: videoId, titre: videoId, etapes: [], statut: "en_cours", progression: 0, tentatives: 1, cleIdempotence: videoId, fournisseurUtilise: "x", parametres: {}, ...horo() } as unknown as Travail);
    return { statut: "lancee" as const, travailId: `t-${videoId}` };
  },
  lancerVideo: async (videoId: Id) => ({ travailId: `t-${videoId}` }),
  ...plus,
});

const videoIV = (fichierId: string, cle: string) =>
  depots().videos.enregistrer({ id: `v-${fichierId}`, titre: `Chatbot ${fichierId}`, formatId: "image-video", statut: "prete", entrees: { imageVideo: { imageCle: cle, fichierId, reseaux: RESEAUX, largeur: 1080, hauteur: 1350 } }, ...horo() } as unknown as Video);
const videoFA = (fichierId: string, cle: string) =>
  depots().videos.enregistrer({ id: `v-${fichierId}`, titre: `Prise ${fichierId}`, formatId: "facecam-animee", statut: "prete", entrees: { facecamAnimee: { fichierId, priseCle: cle, dureePriseSec: 60 } }, ...horo() } as unknown as Video);

const deposerIV = (fichierId: string, deps: Record<string, unknown> = {}) => ecran.deposerImageVideo({ fichierId, reseaux: RESEAUX, largeur: 1080, hauteur: 1350, accordCentimes: PRIX } as never, dep("image/png", deps) as never);
const deposerFA = (fichierId: string, deps: Record<string, unknown> = {}) => fa.deposerFacecamAnimee({ fichierId, dureeSec: 60 } as never, dep("video/mp4", deps) as never);
const compter = async () => ({ videos: await depots().videos.compter(), travaux: await depots().travaux.compter(), depenses: await depots().depenses.compter() });

beforeEach(() => {
  reinitialiserDepots();
  emp.oublierRattrapageEmpreintes();
  n = 0;
  seau.clear();
  lecturesSeau = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  reseau.mockClear();
});

describe("image → vidéo : copie renommée", () => {
  it("vidéo comptée avec « a.png » (empreinte connue), même image renommée « b.png » d'une autre taille : refus « déjà traitée », rien créé", async () => {
    await fichierDepose("A", cleIV("A"), "a.png", 1000, "contenu-1", "image/png", "hash-contenu-1");
    await videoIV("A", cleIV("A"));
    await fichierDepose("B", cleIV("B"), "b.png", 2345, "contenu-1", "image/png");
    const avant = await compter();
    const r = await deposerIV("B");
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.phrase).toBe(ecran.PHRASE_IMAGE_DEJA_TRAITEE);
    expect(await compter()).toEqual(avant);
    expect((await depots().fichiers.obtenir("B"))?.sha256).toBe("hash-contenu-1");
  });

  it("ancien fichier SANS empreinte : rattrapé, puis la copie renommée est refusée", async () => {
    await fichierDepose("A", cleIV("A"), "a.png", 1000, "contenu-1", "image/png");
    await videoIV("A", cleIV("A"));
    await fichierDepose("B", cleIV("B"), "b.png", 2345, "contenu-1", "image/png");
    const r = await deposerIV("B");
    expect(r.statut).toBe("sujet-deja-traite");
    expect((await depots().fichiers.obtenir("A"))?.sha256).toBe("hash-contenu-1");
  });

  it("même nom et même taille mais contenus différents : pas de refus", async () => {
    await fichierDepose("A", cleIV("A"), "a.png", 1000, "contenu-1", "image/png", "hash-contenu-1");
    await videoIV("A", cleIV("A"));
    await fichierDepose("C", cleIV("C"), "a.png", 1000, "contenu-2", "image/png");
    const r = await deposerIV("C");
    expect(r.statut).not.toBe("sujet-deja-traite");
    expect(r.statut).not.toBe("refusee");
  });

  it("échec du calcul (panne R2) : refusée avec la phrase, rien créé ni payé", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 2345, "x", "image/png");
    seau.set(cleIV("B"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    const avant = await compter();
    const r = await deposerIV("B");
    expect(r).toEqual({ statut: "refusee", phrase: emp.PHRASE_VERIFICATION_IMPOSSIBLE });
    expect(await compter()).toEqual(avant);
  });
});

describe("face caméra animée : copie renommée", () => {
  it("même prise renommée et d'une autre taille : refus « déjà traitée » ; panne R2 : refusée, rien créé", async () => {
    await fichierDepose("A", cleFA("A"), "prise-a.mp4", 5000, "film-1", "video/mp4");
    await videoFA("A", cleFA("A"));
    await fichierDepose("B", cleFA("B"), "autre-nom.mp4", 7777, "film-1", "video/mp4");
    const avant = await compter();
    const r = await deposerFA("B");
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.phrase).toBe(fa.PHRASE_PRISE_DEJA_TRAITEE);
    expect(await compter()).toEqual(avant);

    await fichierDepose("D", cleFA("D"), "d.mp4", 8000, "film-3", "video/mp4");
    seau.set(cleFA("D"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    const panne = await deposerFA("D");
    expect(panne).toEqual({ statut: "refusee", phrase: emp.PHRASE_VERIFICATION_IMPOSSIBLE });
    expect(await compter()).toEqual(avant);
  });

  it("contenus différents : la prise passe", async () => {
    await fichierDepose("A", cleFA("A"), "prise-a.mp4", 5000, "film-1", "video/mp4", "hash-film-1");
    await videoFA("A", cleFA("A"));
    await fichierDepose("C", cleFA("C"), "prise-a.mp4", 5000, "film-2", "video/mp4");
    expect((await deposerFA("C")).statut).toBe("lancee");
  });
});

describe("lot image → vidéo", () => {
  const images = (...ids: string[]) => ids.map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 }));
  const lot = (ids: string[], plus: Record<string, unknown> = {}) => lots.deposerLotImageVideo({ images: images(...ids), reseaux: RESEAUX, accordCentimes: PRIX * ids.length }, dep("image/png", plus) as never);

  it("deux copies renommées dans le lot : la seconde est sautée, les autres partent", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "contenu-1", "image/png");
    await fichierDepose("C", cleIV("C"), "copie-de-b.png", 2200, "contenu-1", "image/png");
    await fichierDepose("D", cleIV("D"), "d.png", 3300, "contenu-4", "image/png");
    const r = await lot(["B", "C", "D"]);
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.sautees).toEqual([{ nom: "copie-de-b.png", precedents: [] }]);
  });

  it("panne R2 : refusé avec la phrase, rien payé", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    await fichierDepose("C", cleIV("C"), "c.png", 2200, "y", "image/png");
    seau.set(cleIV("C"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    const avant = await compter();
    const r = await lot(["B", "C"]);
    expect(r).toEqual({ statut: "refusee", phrase: `« c.png » : ${emp.PHRASE_VERIFICATION_IMPOSSIBLE}` });
    expect(await compter()).toEqual(avant);
  });
});

/** Une porte : une lecture qui attend qu'on l'ouvre (aucun temps réel dans les tests). */
const porte = () => {
  let ouvrir!: () => void;
  const ouverte = new Promise<void>((r) => (ouvrir = r));
  return { ouverte, ouvrir };
};
/** Stockage dont certaines lectures attendent une porte ; `debuts` note chaque lecture commencée. */
const stockageRetenu = (portes: Record<string, Promise<void> | undefined>, debuts: string[] = [], apres?: (cle: string) => void) =>
  ({
    ...stockage,
    async empreinteSha256(cle: string, taille: number) {
      debuts.push(cle);
      await portes[cle];
      apres?.(cle);
      return (stockage as { empreinteSha256: (c: string, t: number) => Promise<{ sha256: string; taille: number }> }).empreinteSha256(cle, taille);
    },
  }) as unknown as StockageFichiers;

/** Combien de minuteurs ont été posés avec CE délai (délais uniques par test : on compte les attentes, pas les secondes). */
const minuteurs = () => {
  const espion = vi.spyOn(globalThis, "setTimeout");
  return (delai: number) => espion.mock.calls.filter((c) => c[1] === delai).length;
};

describe("empreinteAvantControle", () => {
  it("rend le fichier tel quel hors des dossiers contrôlés ou s'il a déjà une empreinte (aucune lecture)", async () => {
    const hors = { id: "Z", cleStockage: "k/Z", nom: "z.png" };
    expect(await empreinte(hors)).toBe(hors);
    const deja = { id: "Y", cleStockage: cleIV("Y"), sha256: "s" };
    expect(await empreinte(deja)).toBe(deja);
    expect(lecturesSeau).toHaveLength(0);
  });

  it("un rattrapage trop long ne bloque pas le dépôt : le fichier précis est quand même calculé", async () => {
    await fichierDepose("A", cleIV("A"), "a.png", 1000, "contenu-1", "image/png");
    await fichierDepose("B", cleIV("B"), "b.png", 1000, "contenu-2", "image/png");
    const p = porte(); // la lecture de A (rattrapage) reste ouverte pendant tout le test
    const f = await depots().fichiers.obtenir("B");
    const r = await emp.empreinteAvantControle<{ id: string; cleStockage: string; sha256?: string }>({ id: "B", cleStockage: f!.cleStockage }, { stockage: stockageRetenu({ [cleIV("A")]: p.ouverte }), delaiRattrapageMs: 30 });
    expect(r.sha256 ?? "").toBe("hash-contenu-2");
    p.ouvrir();
  });
});

describe("garde « éteint » : aucune lecture du stockage, comme avant", () => {
  beforeEach(async () => {
    await ecrireParametre("sujets.garde", "eteint");
  });

  it("image seule : panne R2 sans effet, dépôt lancé, aucune lecture", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    seau.set(cleIV("B"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    const r = await deposerIV("B");
    expect(r.statut).toBe("lancee");
    expect(lecturesSeau).toHaveLength(0);
  });

  it("prise : idem", async () => {
    await fichierDepose("D", cleFA("D"), "d.mp4", 8000, "film", "video/mp4");
    seau.set(cleFA("D"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    const r = await deposerFA("D");
    expect(r.statut).toBe("lancee");
    expect(lecturesSeau).toHaveLength(0);
  });

  it("lot : idem, le lot part en entier", async () => {
    for (const id of ["B", "C"]) {
      await fichierDepose(id, cleIV(id), `${id}.png`, 1100, "x", "image/png");
      seau.set(cleIV(id), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    }
    const r = await lots.deposerLotImageVideo({ images: ["B", "C"].map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 })), reseaux: RESEAUX, accordCentimes: PRIX * 2 }, dep("image/png") as never);
    expect(r.statut).toBe("lancee");
    expect(lecturesSeau).toHaveLength(0);
  });
});

describe("contrôle coupé (sansControleSujet) : l'empreinte n'est jamais appelée", () => {
  it("dépôt seul et lot", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    await fichierDepose("C", cleIV("C"), "c.png", 1100, "y", "image/png");
    const espion = vi.fn(async (f: unknown) => f);
    expect((await deposerIV("B", { sansControleSujet: true, empreinte: espion })).statut).toBe("lancee");
    const r = await lots.deposerLotImageVideo({ images: ["B", "C"].map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 })), reseaux: RESEAUX, accordCentimes: PRIX * 2 }, dep("image/png", { sansControleSujet: true, empreinte: espion }) as never);
    expect(r.statut).toBe("lancee");
    expect(espion).not.toHaveBeenCalled();
  });
});

describe("attentes bornées (comptage des attentes, jamais de secondes)", () => {
  const images = (...ids: string[]) => ids.map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 }));
  const lotDe = (ids: string[], options: Record<string, unknown>) => lots.deposerLotImageVideo({ images: images(...ids), reseaux: RESEAUX, accordCentimes: PRIX * ids.length }, dep("image/png", { empreinte: undefined, optionsEmpreinte: options }) as never);

  it("lot de 10 images avec rattrapage lent : UNE seule attente du rattrapage (pas 10)", async () => {
    await fichierDepose("OLD", cleIV("OLD"), "vieux.png", 1000, "vieux", "image/png");
    const ids = Array.from({ length: 10 }, (_, k) => `L${k}`);
    for (const id of ids) await fichierDepose(id, cleIV(id), `${id}.png`, 1000 + ids.indexOf(id), `c-${id}`, "image/png");
    const p = porte();
    const compte = minuteurs();
    const r = await lotDe(ids, { stockage: stockageRetenu({ [cleIV("OLD")]: p.ouverte }), delaiRattrapageMs: 47 });
    expect(r.statut).toBe("lancee");
    expect(compte(47)).toBe(1);
    p.ouvrir();
  });

  it("un rattrapage lent des prises n'est jamais attendu ni lu par un dépôt d'image", async () => {
    await fichierDepose("OLDFA", cleFA("OLDFA"), "vieux.mp4", 1000, "vieux-film", "video/mp4");
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    const p = porte();
    const debuts: string[] = [];
    const r = await deposerIV("B", { empreinte: undefined, optionsEmpreinte: { stockage: stockageRetenu({ [cleFA("OLDFA")]: p.ouverte }, debuts), delaiRattrapageMs: 600_000 } });
    expect(r.statut).toBe("lancee");
    expect(debuts).not.toContain(cleFA("OLDFA"));
    p.ouvrir();
  });

  it("calcul du fichier du dépôt trop long : refus « vérification en cours » ; l'essai suivant le trouve fini", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    const p = porte();
    const options = { stockage: stockageRetenu({ [cleIV("B")]: p.ouverte }), delaiRattrapageMs: 5, delaiFichierMs: 40 };
    const avant = await compter();
    const r = await deposerIV("B", { empreinte: undefined, optionsEmpreinte: options });
    expect(r).toEqual({ statut: "refusee", phrase: emp.PHRASE_VERIFICATION_EN_COURS });
    expect(await compter()).toEqual(avant);
    p.ouvrir();
    await vi.waitFor(async () => expect((await depots().fichiers.obtenir("B"))?.sha256).toBe("hash-x"));
    expect((await deposerIV("B", { empreinte: undefined, optionsEmpreinte: options })).statut).toBe("lancee");
  });

  it("lot : au premier fichier trop long, le lot entier est refusé en NOMMANT ce fichier, sans lire les suivants", async () => {
    for (const id of ["B", "C", "D"]) await fichierDepose(id, cleIV(id), `${id}.png`, 1100, `c-${id}`, "image/png");
    const p = porte();
    const debuts: string[] = [];
    const options = { stockage: stockageRetenu({ [cleIV("B")]: p.ouverte, [cleIV("C")]: p.ouverte, [cleIV("D")]: p.ouverte }, debuts), delaiRattrapageMs: 5, delaiFichierMs: 40 };
    const avant = await compter();
    const r = await lotDe(["B", "C", "D"], options);
    expect(r).toEqual({ statut: "refusee", phrase: `« B.png » : ${emp.PHRASE_VERIFICATION_EN_COURS}` });
    expect(debuts.filter((c) => c !== cleIV("B") && c !== cleIV("C") && c !== cleIV("D"))).toHaveLength(0);
    expect(await compter()).toEqual(avant);
    p.ouvrir();
  });

  it("lot : UNE échéance globale pour toute la boucle (le 2e fichier n'a que le temps restant)", async () => {
    // Origine « fabrication » : le rattrapage de fond ne les lit pas, seule la boucle du lot le fait (l'horloge reste maîtrisée).
    for (const id of ["B", "C"]) await fichierDepose(id, cleIV(id), `${id}.png`, 1100, `c-${id}`, "image/png", undefined, "fabrication");
    let t = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => t);
    const compte = minuteurs();
    const pC = porte();
    const options = { stockage: stockageRetenu({ [cleIV("C")]: pC.ouverte }, [], (cle) => cle === cleIV("B") && (t += 50)), delaiRattrapageMs: 5, delaiFichierMs: 60 };
    const r = await lotDe(["B", "C"], options);
    expect(r).toEqual({ statut: "refusee", phrase: `« C.png » : ${emp.PHRASE_VERIFICATION_EN_COURS}` });
    expect(compte(60)).toBe(1); // B : l'échéance entière
    expect(compte(10)).toBe(1); // C : il ne restait que 60 - 50
    pC.ouvrir();
  });
});

describe("lot face caméra animée : après la première vérification « en cours », les suivantes ne sont pas attendues", () => {
  it("1re prise trop longue : les 2 autres sont refusées avec la même phrase, sans lecture ni attente", async () => {
    for (const id of ["P1", "P2", "P3"]) await fichierDepose(id, cleFA(id), `${id}.mp4`, 5000, `film-${id}`, "video/mp4");
    const p = porte();
    const debuts: string[] = [];
    const compte = minuteurs();
    const options = { stockage: stockageRetenu({ [cleFA("P1")]: p.ouverte, [cleFA("P2")]: p.ouverte, [cleFA("P3")]: p.ouverte }, debuts), delaiRattrapageMs: 53, delaiFichierMs: 41 };
    const avant = await compter();
    const r = await fa.deposerFacecamAnimeeLot(["P1", "P2", "P3"].map((fichierId) => ({ fichierId, dureeSec: 60 })) as never, dep("video/mp4", { empreinte: undefined, optionsEmpreinte: options }) as never);
    expect(r.issues.map((i) => i.statut)).toEqual(["refusee", "refusee", "refusee"]);
    expect(r.issues.every((i) => i.statut === "refusee" && i.phrase === emp.PHRASE_VERIFICATION_EN_COURS)).toBe(true);
    expect(compte(41)).toBe(1); // une seule échéance de fichier posée pour tout le lot
    expect(debuts).not.toContain(cleFA("P3"));
    expect(await compter()).toEqual(avant);
    p.ouvrir();
  });
});

describe("attente du rattrapage mémorisée", () => {
  it("10 appels d'empreinteAvantControle pendant un rattrapage lent : une seule attente (délai dépassé retenu)", async () => {
    await fichierDepose("OLD", cleIV("OLD"), "vieux.png", 1000, "vieux", "image/png");
    const ids = Array.from({ length: 10 }, (_, k) => `M${k}`);
    for (const id of ids) await fichierDepose(id, cleIV(id), `${id}.png`, 1000, `c-${id}`, "image/png");
    const p = porte();
    const compte = minuteurs();
    const options = { stockage: stockageRetenu({ [cleIV("OLD")]: p.ouverte }), delaiRattrapageMs: 59 };
    for (const id of ids) await emp.empreinteAvantControle({ id, cleStockage: cleIV(id) }, options);
    expect(compte(59)).toBe(1);
    p.ouvrir();
  });
});

describe("phrases du refus", () => {
  it("échec DÉFINITIF (403) : « fichier illisible » dans les trois dépôts ; autre panne : « réessayez dans une minute »", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    await fichierDepose("C", cleIV("C"), "c.png", 1100, "y", "image/png");
    await fichierDepose("D", cleFA("D"), "d.mp4", 8000, "film", "video/mp4");
    const interdit = Object.assign(new Error("R2 GET 403"), { statut: 403 });
    for (const cle of [cleIV("B"), cleIV("C"), cleFA("D")]) seau.set(cle, interdit);
    const attendu = { statut: "refusee", phrase: emp.PHRASE_FICHIER_ILLISIBLE };
    expect(await deposerIV("B")).toEqual(attendu);
    expect(await deposerFA("D")).toEqual(attendu);
    const lot = await lots.deposerLotImageVideo({ images: [{ fichierId: "C", largeur: 1080, hauteur: 1350 }, { fichierId: "B", largeur: 1080, hauteur: 1350 }], reseaux: RESEAUX, accordCentimes: PRIX * 2 }, dep("image/png") as never);
    expect(lot).toEqual({ statut: "refusee", phrase: `« c.png » : ${emp.PHRASE_FICHIER_ILLISIBLE}` });
    expect(emp.phraseRefusEmpreinte(new Error("panne"))).toBe(emp.PHRASE_VERIFICATION_IMPOSSIBLE);
  });
});

describe("lot déjà créé", () => {
  it("renvoyé avec son lotId même si R2 est en panne au second dépôt", async () => {
    await fichierDepose("B", cleIV("B"), "b.png", 1100, "x", "image/png");
    await fichierDepose("C", cleIV("C"), "c.png", 1100, "y", "image/png");
    const demande = { images: ["B", "C"].map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 })), reseaux: RESEAUX, accordCentimes: PRIX * 2 };
    const premier = await lots.deposerLotImageVideo(demande, dep("image/png", { empreinte: async (f: unknown) => f }) as never);
    expect(premier.statut).toBe("lancee");
    seau.set(cleIV("B"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    seau.set(cleIV("C"), Object.assign(new Error("R2 GET 503"), { statut: 503 }));
    lecturesSeau = [];
    const second = await lots.deposerLotImageVideo(demande, dep("image/png") as never);
    expect(second.statut).toBe("lancee");
    if (premier.statut === "lancee" && second.statut === "lancee") expect(second.lotId).toBe(premier.lotId);
    expect(lecturesSeau).toHaveLength(0);
  });
});
