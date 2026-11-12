import { describe, expect, it, vi } from "vitest";
import type { Publication } from "../../src/domaine/types";
import { REQUETE_CANAUX, REQUETE_COMPTE, REQUETE_POSTS_ENVOYES_STATS } from "../../src/services/import-buffer/requetes-lecture";
import {
  ATTENDU_PROGRAMMES,
  REQUETE_POSTS_PUBLIES,
  archiveDepuisPublications,
  clientLectureSeule,
  comparerAvecInventaire,
  copierEtVerifierMedias,
  formaterRapportArchive,
  lignesDepuisStudio,
  nomArchive,
  produireArchive,
  tenterLectureBuffer,
  type LignePublication,
} from "../../src/services/import-buffer/lire-publies";

const MAINTENANT = new Date("2026-11-12T10:00:00Z");

function pub(i: number, extra: Partial<Publication> = {}): Publication {
  return {
    id: `pub-${i}`,
    creeLe: "2026-11-01T08:00:00Z",
    modifieLe: "2026-11-01T08:00:00Z",
    videoId: `vid-${i}`,
    reseau: "linkedin",
    statut: "programmee",
    via: "zernio",
    date: "2026-11-20T08:00:00Z",
    texte: `Texte fictif ${i}`,
    idExterne: `ext-${i}`,
    canalId: "canal-1",
    ...extra,
  };
}
const ligne = (p: Publication, media?: LignePublication["media"]): LignePublication => ({ publication: p, ...(media ? { media } : {}) });

function lots(n: { linkedin: number; facebook: number; instagram: number }): LignePublication[] {
  const out: LignePublication[] = [];
  let i = 0;
  for (const r of ["linkedin", "facebook", "instagram"] as const) for (let k = 0; k < n[r]; k++) out.push(ligne(pub(++i, { reseau: r })));
  return out;
}

describe("L0-04 lecture seule : toute mutation est refusée", () => {
  it("la requête des posts publiés ne contient aucune mutation et ne remplace pas la requête des statistiques", () => {
    expect(/mutation/i.test(REQUETE_POSTS_PUBLIES)).toBe(false);
    expect(REQUETE_POSTS_PUBLIES).not.toBe(REQUETE_POSTS_ENVOYES_STATS);
    expect(REQUETE_POSTS_PUBLIES).toContain("sent");
    expect(REQUETE_POSTS_ENVOYES_STATS).toContain("metrics");
  });

  it("le client enveloppé refuse une mutation (toutes casses) avant d'atteindre le client réel", async () => {
    const reel = { lire: vi.fn(async () => ({})) };
    const sur = clientLectureSeule(reel);
    for (const q of ["mutation X { a }", "MUTATION X { a }", "query { a } # Mutation", "  \n mutation{a}"]) {
      await expect(sur.lire(q)).rejects.toMatchObject({ code: "ecriture-refusee" });
    }
    expect(reel.lire).not.toHaveBeenCalled();
    await sur.lire("query { a }");
    expect(reel.lire).toHaveBeenCalledTimes(1);
  });
});

describe("L0-04 une seule tentative de lecture Buffer, son échec n'est pas une erreur", () => {
  it("clé qui ne répond plus : renvoie « indisponible », sans lever, sans clé dans le message, une seule requête", async () => {
    const lire = vi.fn(async () => {
      throw new Error("HTTP 401 avec cle-exemple-secrete");
    });
    const r = await tenterLectureBuffer({ lire }, { secrets: ["cle-exemple-secrete"] });
    expect(r.etat).toBe("indisponible");
    expect(JSON.stringify(r)).not.toContain("cle-exemple-secrete");
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it("client absent (pas de clé) : indisponible, rien n'est appelé", async () => {
    const r = await tenterLectureBuffer(undefined);
    expect(r).toMatchObject({ etat: "indisponible" });
  });

  it("lecture réussie : posts publiés normalisés, tous statuts « sent », pagination suivie", async () => {
    const pages = [
      { posts: { edges: [{ node: { id: "b1", channelId: "c1", status: "sent", text: "un", sentAt: "2026-11-02T08:00:00Z", assets: [] } }], pageInfo: { hasNextPage: true, endCursor: "p2" } } },
      { posts: { edges: [{ node: { id: "b2", channelId: "c1", status: "sent", text: "deux", sentAt: "2026-11-03T08:00:00Z", assets: [] } }], pageInfo: { hasNextPage: false } } },
    ];
    let page = 0;
    const lire = vi.fn(async (q: string) => {
      if (q === REQUETE_COMPTE) return { account: { organizations: [{ id: "org-exemple" }] } };
      if (q === REQUETE_CANAUX) return { channels: [] };
      return pages[page++];
    });
    const r = await tenterLectureBuffer({ lire });
    expect(r.etat).toBe("lu");
    if (r.etat === "lu") expect(r.posts.map((p) => p.id)).toEqual(["b1", "b2"]);
  });
});

describe("L0-04 archive depuis les Publications du Studio (Buffer inaccessible)", () => {
  it("produit l'archive datée (jour de Paris, pas UTC) sans aucun accès Buffer", async () => {
    // 23 h 30 UTC le 11/11 = 00 h 30 à Paris le 12/11
    expect(nomArchive(new Date("2026-11-11T23:30:00Z"))).toBe("archive-buffer-2026-11-12");
    const r = await produireArchive({ lignes: [ligne(pub(1))], maintenant: MAINTENANT, client: undefined });
    expect(r.archive.source).toBe("studio");
    expect(r.archive.bufferLu).toBe("indisponible");
    expect(r.archive.entrees).toHaveLength(1);
    expect(r.archive.nom).toBe("archive-buffer-2026-11-12");
  });

  it("le rapport liste les champs absents, identifiants et nombre, y compris texte vide, date illisible, média absent", () => {
    const lignes = [
      ligne(pub(1, { texte: "" })),
      ligne(pub(2, { date: "pas-une-date" })),
      ligne(pub(3, { idExterne: undefined })),
      ligne(pub(4, { canalId: undefined })),
      ligne(pub(5)), // pas de média
      ligne(pub(6), { type: "video", mime: "video/mp4", source: "https://exemple.fr/v.mp4" }),
      ligne(pub(7, { statut: "publiee", urlPubliee: undefined })),
    ];
    const a = archiveDepuisPublications(lignes, MAINTENANT);
    const par = Object.fromEntries(a.champsAbsents.map((c) => [c.champ, c.ids]));
    expect(par.texte).toEqual(["pub-1"]);
    expect(par.date).toEqual(["pub-2"]);
    expect(par.idExterne).toEqual(["pub-3"]);
    expect(par.canalId).toEqual(["pub-4"]);
    expect(par.urlPubliee).toEqual(["pub-7"]);
    expect(par.media).toContain("pub-5");
    expect(par.media).not.toContain("pub-6");
    const texte = formaterRapportArchive(a);
    expect(texte).toContain("Champs absents");
    expect(texte).toContain("pub-2");
  });

  it("aucun champ absent : le rapport le dit au lieu de rester muet", () => {
    const a = archiveDepuisPublications([ligne(pub(1, { statut: "publiee", urlPubliee: "https://exemple.fr/p/1" }), { type: "image", mime: "image/png", source: "https://exemple.fr/i.png" })], MAINTENANT);
    expect(a.champsAbsents).toEqual([]);
    expect(formaterRapportArchive(a)).toContain("Aucun champ absent");
  });

  it("entrée vide, liste vide : archive vide valide, rapport lisible", () => {
    const a = archiveDepuisPublications([], MAINTENANT);
    expect(a.entrees).toEqual([]);
    expect(formaterRapportArchive(a)).toContain("0");
  });

  it("l'archive ne contient jamais l'adresse de lecture temporaire d'un média", () => {
    const a = archiveDepuisPublications([ligne(pub(1), { type: "image", mime: "image/png", source: "https://exemple.fr/i.png?signature=jeton" })], MAINTENANT);
    expect(JSON.stringify(a)).not.toContain("signature=jeton");
    expect(JSON.stringify(a)).not.toContain("https://exemple.fr/i.png");
  });

  it("rejeu : les mêmes publications deux fois (même id, ou même idExterne) ne comptent qu'une fois", () => {
    const p = pub(1);
    const a = archiveDepuisPublications([ligne(p), ligne(p), ligne(pub(2, { idExterne: "ext-1" }))], MAINTENANT);
    expect(a.entrees).toHaveLength(1);
    expect(a.doublonsIgnores).toBe(2);
  });
});

describe("L0-04 comparaison avec les 92 posts programmés de l'inventaire", () => {
  it("la référence est LinkedIn 39, Facebook 34, Instagram 19 = 92", () => {
    expect(ATTENDU_PROGRAMMES).toEqual({ linkedin: 39, facebook: 34, instagram: 19, total: 92 });
  });

  it("compte exact : écart nul, affiché « conforme »", () => {
    const c = comparerAvecInventaire(lots({ linkedin: 39, facebook: 34, instagram: 19 }).map((l) => l.publication), MAINTENANT);
    expect(c.trouve.total).toBe(92);
    expect(c.ecart.total).toBe(0);
    expect(c.conforme).toBe(true);
  });

  it("87 programmés Zernio + 12 brouillons : l'écart est négatif par réseau et seuls les programmés comptent", () => {
    const programmes = lots({ linkedin: 35, facebook: 30, instagram: 10 }).map((l) => l.publication);
    const brouillons = lots({ linkedin: 4, facebook: 4, instagram: 4 }).map((l, i) => ({ ...l.publication, id: `brouillon-${i}`, idExterne: `bx-${i}`, statut: "brouillon" as const }));
    const c = comparerAvecInventaire([...programmes, ...brouillons], MAINTENANT);
    expect(c.trouve).toMatchObject({ linkedin: 35, facebook: 30, instagram: 10, total: 75 });
    expect(c.ecart).toEqual({ linkedin: -4, facebook: -4, instagram: -9, total: -17 });
    expect(c.conforme).toBe(false);
  });

  it("une simulation n'est jamais comptée comme programmée ; publiée, échec non plus", () => {
    const c = comparerAvecInventaire(
      [pub(1, { via: "simulation" }), pub(2, { statut: "publiee" }), pub(3, { statut: "echec" }), pub(4)],
      MAINTENANT,
    );
    expect(c.trouve.total).toBe(1);
    expect(c.simulationsIgnorees).toBe(1);
  });

  it("plus que prévu : écart positif ; réseaux hors inventaire listés à part et hors total", () => {
    const base = lots({ linkedin: 40, facebook: 34, instagram: 19 }).map((l) => l.publication);
    const c = comparerAvecInventaire([...base, pub(900, { reseau: "tiktok" })], MAINTENANT);
    expect(c.ecart.linkedin).toBe(1);
    expect(c.ecart.total).toBe(1);
    expect(c.horsInventaire).toEqual({ tiktok: 1 });
  });

  it("programmée à la date exacte de maintenant : pas en retard ; une minute avant : en retard ; date illisible : à vérifier", () => {
    const c = comparerAvecInventaire(
      [pub(1, { date: MAINTENANT.toISOString() }), pub(2, { date: "2026-11-12T09:59:00Z" }), pub(3, { date: "n'importe quoi" })],
      MAINTENANT,
    );
    expect(c.enRetard).toBe(1);
    expect(c.dateIllisible).toBe(1);
    expect(c.trouve.total).toBe(3);
  });

  it("le rapport affiche les trois nombres et l'écart avec son signe", () => {
    const a = archiveDepuisPublications(lots({ linkedin: 35, facebook: 34, instagram: 19 }), MAINTENANT);
    const t = formaterRapportArchive(a);
    expect(t).toContain("92");
    expect(t).toContain("LinkedIn");
    expect(t).toMatch(/-4/);
    expect(t).toContain("écart");
  });
});

describe("L0-04 médias copiés vers R2 puis vérifiés", () => {
  const OCTETS = new Uint8Array([1, 2, 3, 4, 5]);
  const reponse = () => new Response(OCTETS, { status: 200, headers: { "content-length": "5" } });
  const media = { type: "image" as const, mime: "image/png", source: "https://exemple.fr/i.png" };

  function appeler() {
    return vi.fn(async (_u: unknown, init?: RequestInit) => (init?.method === "PUT" ? new Response(null, { status: 200 }) : reponse()));
  }

  it("copie puis vérifie la taille de l'objet stocké : ok", async () => {
    const stockage = { urlDepotDuree: vi.fn(async () => "https://depot.exemple.fr/x"), tailleObjet: vi.fn(async () => 5) };
    const r = await copierEtVerifierMedias([ligne(pub(1), media)], stockage, appeler() as unknown as typeof fetch);
    expect(r.copies).toBe(1);
    expect(r.verifies).toBe(1);
    expect(r.echecs).toEqual([]);
    expect(stockage.tailleObjet).toHaveBeenCalledWith("import-buffer/pub-1/0.png");
  });

  it("objet absent ou taille différente après dépôt : échec signalé, jamais compté vérifié", async () => {
    for (const taille of [null, 4, 0]) {
      const stockage = { urlDepotDuree: async () => "https://depot.exemple.fr/x", tailleObjet: async () => taille };
      const r = await copierEtVerifierMedias([ligne(pub(1), media)], stockage, appeler() as unknown as typeof fetch);
      expect(r.verifies).toBe(0);
      expect(r.echecs).toHaveLength(1);
    }
  });

  it("stockage sans moyen de vérifier : copie non vérifiée, donc échec explicite (pas de faux « vérifié »)", async () => {
    const r = await copierEtVerifierMedias([ligne(pub(1), media)], { urlDepotDuree: async () => "https://depot.exemple.fr/x" }, appeler() as unknown as typeof fetch);
    expect(r.verifies).toBe(0);
    expect(r.echecs[0].raison).toContain("vérif");
  });

  it("publication sans média : rien à copier ; échec de téléchargement : signalé sans adresse", async () => {
    const stockage = { urlDepotDuree: async () => "https://depot.exemple.fr/x", tailleObjet: async () => 5 };
    expect((await copierEtVerifierMedias([ligne(pub(1))], stockage, appeler() as unknown as typeof fetch)).copies).toBe(0);
    const refus = vi.fn(async () => new Response(null, { status: 403 }));
    const r = await copierEtVerifierMedias([ligne(pub(2), media)], stockage, refus as unknown as typeof fetch);
    expect(r.echecs).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain("exemple.fr/i.png");
  });
});

describe("L0-04 correction après relecture : l'archive se lit dans les dépôts du Studio", () => {
  const sortie = { id: "s1", videoId: "vid-1", fichierId: "f1" };
  const depotsFictifs = (publications: Publication[]) => ({
    publications: { lister: async () => publications },
    sorties: { obtenir: async (id: string) => (id === "s1" ? sortie : null), lister: async (f?: (x: typeof sortie) => boolean) => [sortie].filter((x) => !f || f(x)) },
    fichiers: { obtenir: async (id: string) => (id === "f1" ? { id: "f1", cleStockage: "studio/prod/sortie/s1/f1.mp4", mime: "video/mp4", taille: 12 } : null) },
    visuels: { obtenir: async (id: string) => (id === "vis-1" ? { id: "vis-1", rendu: { pdfCle: "studio/prod/visuel/vis-1/rendu.pdf" } } : null) },
  });

  it("sans fichier JSON : les lignes viennent des Publications, avec la clé de stockage de la vidéo ou du visuel", async () => {
    const lignes = await lignesDepuisStudio(depotsFictifs([pub(1, { sortieId: "s1" }), pub(2, { videoId: undefined, visuelId: "vis-1" }), pub(3, { videoId: "vid-inconnue" })]));
    expect(lignes.map((l) => l.publication.id)).toEqual(["pub-1", "pub-2", "pub-3"]);
    expect(lignes[0].media).toMatchObject({ type: "video", mime: "video/mp4", cleStockage: "studio/prod/sortie/s1/f1.mp4" });
    expect(lignes[1].media).toMatchObject({ cleStockage: "studio/prod/visuel/vis-1/rendu.pdf" });
    expect(lignes[2].media).toBeUndefined();
    const a = archiveDepuisPublications(lignes, MAINTENANT);
    expect(a.entrees[0].media).toMatchObject({ cleStockage: "studio/prod/sortie/s1/f1.mp4" });
    expect(a.champsAbsents.find((c) => c.champ === "media")?.ids).toEqual(["pub-3"]);
  });

  it("une publication sans source unique ne fait pas tomber l'archive : média absent signalé", async () => {
    const lignes = await lignesDepuisStudio(depotsFictifs([pub(4, { videoId: undefined })]));
    expect(lignes).toHaveLength(1);
    expect(lignes[0].media).toBeUndefined();
  });

  it("média déjà dans le stockage du Studio : vérifié sans téléchargement ni adresse", async () => {
    const lignes = await lignesDepuisStudio(depotsFictifs([pub(1, { sortieId: "s1" })]));
    const appeler = vi.fn();
    const r = await copierEtVerifierMedias(lignes, { urlDepotDuree: async () => "https://x.exemple.fr/p", tailleObjet: async () => 12 }, appeler as unknown as typeof fetch);
    expect(appeler).not.toHaveBeenCalled();
    expect(r).toMatchObject({ verifies: 1 });
    expect(r.echecs).toHaveLength(0);
    const absent = await copierEtVerifierMedias(lignes, { urlDepotDuree: async () => "https://x.exemple.fr/p", tailleObjet: async () => null });
    expect(absent.echecs).toHaveLength(1);
  });

  const postBuffer = (id: string, extra: Record<string, unknown> = {}) => ({
    id, canalId: "canal-b", texte: `Texte Buffer ${id}`, dateUtc: "2026-11-02T08:00:00Z", envoyeLe: "2026-11-02T08:00:05Z", statut: "sent",
    medias: [{ type: "image", mime: "image/png", source: "https://cdn.exemple.fr/secret-adresse.png" }], ...extra,
  });

  it("les posts publiés lus dans Buffer vont dans l'archive (texte, date de Paris, canal, identifiant), sans adresse de média", () => {
    const a = archiveDepuisPublications([ligne(pub(1, { idExterne: "b1" }))], MAINTENANT, { etat: "lu", tronque: false, posts: [postBuffer("b1"), postBuffer("b2")] as never });
    expect(a.bufferPublies).toBe(2);
    expect(a.entreesBuffer?.map((e) => e.id)).toEqual(["b1", "b2"]);
    expect(a.entreesBuffer?.[1]).toMatchObject({ texte: "Texte Buffer b2", canalId: "canal-b", dateParis: "02/11/2026 09:00", medias: [{ type: "image", mime: "image/png" }] });
    expect(JSON.stringify(a)).not.toContain("secret-adresse");
    expect(a.bufferSansJumeau).toEqual(["b2"]);
    expect(formaterRapportArchive(a)).toContain("sans jumeau");
  });

  it("Buffer indisponible : pas d'entrées Buffer", () => {
    const a = archiveDepuisPublications([], MAINTENANT, { etat: "indisponible", raison: "x" });
    expect(a.entreesBuffer ?? []).toHaveLength(0);
  });
});
