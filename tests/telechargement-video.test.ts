/**
 * Lot S (08/11, Williams) — téléchargement direct d'une vidéo : GET /api/telechargements/video?video=&reseau=&ratio=&fil=.
 * SÉCURITÉ : la route ne reçoit que des identifiants (jamais une clé de stockage) ; session obligatoire (401) ;
 * validation stricte (400) ; vidéo absente ou à la corbeille = 404 en français ; lien signé 600 s ; Cache-Control: no-store.
 * Aucun appel réseau : le stockage est une doublure qui note ce qu'on lui demande.
 */
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const appels: { cle: string; secondes: number; nom?: string }[] = [];
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<typeof import("@/services/_commun")>()),
  fournisseur: async () => ({
    urlLectureDuree: async (cle: string, secondes: number, options?: { telechargerSous?: string }) => {
      appels.push({ cle, secondes, nom: options?.telechargerSous });
      return `https://r2.exemple/${cle}?response-content-disposition=attachment&exp=${secondes}`;
    },
    urlLecture: async (cle: string) => cle,
  }),
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { GET } = await import("@/app/api/telechargements/video/route");
const { fichierATelecharger, nomTelechargement } = await import("@/services/telechargement-video");

const MDP = "s-socle-telechargement";
const NOW = "2026-11-08T10:00:00.000Z";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const { hash } = await import("@node-rs/argon2");
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  appels.length = 0;
});

const base = { creeLe: NOW, modifieLe: NOW };

/** Une vidéo du générateur avec une sortie 9:16 et une sortie 4:5 (clés de stockage connues du seul serveur). */
async function semer(id: string, extra: Record<string, unknown> = {}, livraison?: unknown[]) {
  const d = depots();
  await d.videos.enregistrer({ ...base, id, titre: "Mon été à Lyon : l’essentiel !", formatId: "f", versionChoisieId: `${id}-v`, statut: "prete", ...extra } as never);
  await d.versions.enregistrer({ ...base, id: `${id}-v`, videoId: id, numero: 1, statut: "prete", choisie: true, projetMontage: livraison ? { imageVideo: { livraison } } : undefined } as never);
  for (const [ratio, cle] of [["9:16", `studio/dev/video/${id}/neuf-seize.mp4`], ["4:5", `studio/dev/video/${id}/quatre-cinq.mp4`]] as const) {
    await d.fichiers.enregistrer({ ...base, id: `f-${id}-${ratio}`, cleStockage: cle, nom: "x.mp4", mime: "video/mp4", taille: 1, origine: "montage", statut: "pret" } as never);
    await d.sorties.enregistrer({ ...base, id: `s-${id}-${ratio}`, videoId: id, versionId: `${id}-v`, ratio, resolution: "1x1", fichierId: `f-${id}-${ratio}`, vignetteFichierId: "", dureeSec: 30, taille: 1 } as never);
  }
}

const requete = (qs: string) => new NextRequest(`http://localhost:3000/api/telechargements/video${qs}`);

async function connecte() {
  await auth.seConnecter(MDP, false);
}

describe("session et validation", () => {
  it("401 sans session, avant toute lecture", async () => {
    await semer("v1");
    const r = await GET(requete("?video=v1"));
    expect(r.status).toBe(401);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ erreur: expect.any(String) });
    expect(appels).toHaveLength(0);
  });

  it.each([
    ["sans identifiant", ""],
    ["identifiant vide", "?video="],
    ["identifiant trop long", `?video=${"a".repeat(81)}`],
    ["identifiant avec une barre (clé de stockage)", "?video=studio%2Fdev%2Fvideo%2Fv1%2Fneuf-seize.mp4"],
    ["identifiant avec des points", "?video=..%2F..%2Fx"],
    ["réseau inconnu", "?video=v1&reseau=twitter"],
    ["ratio inconnu", "?video=v1&ratio=3:2"],
  ])("400 : %s", async (_nom, qs) => {
    await semer("v1");
    await connecte();
    const r = await GET(requete(qs));
    expect(r.status).toBe(400);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(typeof (await r.json()).erreur).toBe("string");
    expect(appels).toHaveLength(0);
  });

  it("ignore une clé de stockage passée en paramètre : seule la clé de la base est signée", async () => {
    await semer("v1");
    await connecte();
    const r = await GET(requete("?video=v1&cle=studio/dev/video/AUTRE/secret.mp4&fichier=x&url=https://evil.example/a.mp4"));
    expect(r.status).toBe(302);
    expect(appels.map((a) => a.cle)).toEqual(["studio/dev/video/v1/neuf-seize.mp4"]);
    expect(r.headers.get("location")).not.toContain("AUTRE");
    expect(r.headers.get("location")).not.toContain("evil");
  });
});

describe("404 en français", () => {
  it("vidéo absente", async () => {
    await connecte();
    const r = await GET(requete("?video=nexiste-pas"));
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect((await r.json()).erreur).toMatch(/vidéo/i);
    expect(appels).toHaveLength(0);
  });

  it("vidéo à la corbeille", async () => {
    await semer("v1", { statut: "archivee", corbeilleLe: NOW });
    await connecte();
    expect((await GET(requete("?video=v1"))).status).toBe(404);
    expect(appels).toHaveLength(0);
  });

  it("vidéo sans aucun fichier", async () => {
    await depots().videos.enregistrer({ ...base, id: "vide", titre: "Vide", formatId: "f", statut: "brouillon" } as never);
    await connecte();
    expect((await GET(requete("?video=vide"))).status).toBe(404);
  });
});

describe("302 vers un lien signé de 600 s", () => {
  it("renvoie vers le stockage, en pièce jointe, 600 s, no-store", async () => {
    await semer("v1");
    await connecte();
    const r = await GET(requete("?video=v1"));
    expect(r.status).toBe(302);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(r.headers.get("location")).toContain("response-content-disposition=attachment");
    expect(appels).toHaveLength(1);
    expect(appels[0].secondes).toBe(600);
    expect(appels[0].nom).toMatch(/^[A-Za-z0-9-]{1,76}\.mp4$/);
  });

  it("le ratio demandé choisit la sortie de ce ratio", async () => {
    await semer("v1");
    await connecte();
    await GET(requete("?video=v1&ratio=4:5"));
    expect(appels[0].cle).toBe("studio/dev/video/v1/quatre-cinq.mp4");
  });

  it("une clé commençant par / (média du studio) redirige vers elle-même, sans signature", async () => {
    await semer("v1");
    await depots().fichiers.modifier("f-v1-9:16", { cleStockage: "/demo/avocat-1.mp4" });
    await connecte();
    const r = await GET(requete("?video=v1&ratio=9:16"));
    expect(r.status).toBe(302);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/demo/avocat-1.mp4");
    expect(appels).toHaveLength(0);
  });
});

const livraison = [
  { reseau: "linkedin", version: "courte", fichierCle: "studio/dev/iv/v2/linkedin.mp4", format: "4:5" },
  { reseau: "facebook", version: "longue", fichierCle: "studio/dev/iv/v2/fb-reel.mp4", fichierCleFil: "studio/dev/iv/v2/fb-fil.mp4" },
  { reseau: "instagram", version: "aucune" },
];

describe("redirection ouverte : une clé trompeuse ne mène jamais hors du studio", () => {
  it.each([["//evil.example/a.mp4"], ["/\\evil.example/a.mp4"], ["\\\\evil.example\\a.mp4"], ["/\t/evil.example/a.mp4"]])("clé %j", async (cle) => {
    await semer("v1");
    await depots().fichiers.modifier("f-v1-9:16", { cleStockage: cle });
    await connecte();
    const r = await GET(requete("?video=v1&ratio=9:16"));
    const lieu = r.headers.get("location");
    if (lieu) {
      expect(new URL(lieu).hostname).not.toBe("evil.example");
      expect(["localhost", "r2.exemple"]).toContain(new URL(lieu).hostname);
    } else expect(r.status).toBe(404);
  });

  it("sans signature possible (média du studio), une adresse « //hote » est refusée", async () => {
    await semer("v1");
    await depots().fichiers.modifier("f-v1-9:16", { cleStockage: "//evil.example/a.mp4" });
    await connecte();
    const r = await GET(requete("?video=v1&ratio=9:16"));
    expect(r.headers.get("location") ?? "").not.toMatch(/^(https?:)?\/\/evil\.example/);
  });
});

describe("image → vidéo : la livraison fait foi", () => {
  it("réseau LinkedIn : son fichier", async () => {
    await semer("v2", {}, livraison);
    await connecte();
    await GET(requete("?video=v2&reseau=linkedin"));
    expect(appels[0].cle).toBe("studio/dev/iv/v2/linkedin.mp4");
  });

  it("Facebook : le Reel par défaut, le fil avec fil=1", async () => {
    await semer("v2", {}, livraison);
    await connecte();
    await GET(requete("?video=v2&reseau=facebook"));
    await GET(requete("?video=v2&reseau=facebook&fil=1"));
    expect(appels.map((a) => a.cle)).toEqual(["studio/dev/iv/v2/fb-reel.mp4", "studio/dev/iv/v2/fb-fil.mp4"]);
  });

  it("réseau non livré : 404, jamais le mauvais fichier", async () => {
    await semer("v2", {}, livraison);
    await connecte();
    expect((await GET(requete("?video=v2&reseau=instagram"))).status).toBe(404);
    expect(appels).toHaveLength(0);
  });
});

describe("service", () => {
  it("la clé vient de la base : sortie du ratio, puis meilleure sortie du réseau, puis la principale", async () => {
    await semer("v1");
    expect((await fichierATelecharger("v1", { ratio: "4:5" }))?.cle).toBe("studio/dev/video/v1/quatre-cinq.mp4");
    // Le format préféré de chaque réseau décide (registre), sans règle écrite en dur dans ce test.
    const { obtenirReseau } = await import("@/reseaux");
    const cleDe = (ratio: string) => (ratio === "4:5" ? "studio/dev/video/v1/quatre-cinq.mp4" : "studio/dev/video/v1/neuf-seize.mp4");
    for (const r of ["linkedin", "tiktok", "facebook"] as const) {
      expect((await fichierATelecharger("v1", { reseau: r }))?.cle).toBe(cleDe(obtenirReseau(r).ratioPrefere));
    }
    expect((await fichierATelecharger("v1", {}))?.cle).toBeTruthy();
    expect(await fichierATelecharger("inconnue", {})).toBeNull();
  });

  it("le nom suit le fichier réellement servi : « fil » seulement pour le fil Facebook, format de la livraison sinon", async () => {
    await semer("v2", {}, livraison);
    expect((await fichierATelecharger("v2", { reseau: "facebook", fil: true }))?.nom).toMatch(/-facebook-fil\.mp4$/);
    expect((await fichierATelecharger("v2", { reseau: "facebook" }))?.nom).toMatch(/-facebook-9-16\.mp4$/);
    // fil=1 sans Facebook : le fichier servi n'est pas un fil, le nom ne le dit pas ; le ratio demandé ne le renomme pas.
    expect((await fichierATelecharger("v2", { reseau: "linkedin", fil: true, ratio: "16:9" }))?.nom).toMatch(/-linkedin-4-5\.mp4$/);
    await semer("v1");
    expect((await fichierATelecharger("v1", { fil: true }))?.nom).not.toContain("fil.mp4");
  });

  it("nomTelechargement : [A-Za-z0-9-], 80 au plus, .mp4", () => {
    const n = nomTelechargement("Mon été à Lyon : l’essentiel ! ../../etc/passwd \"x\"", "linkedin");
    expect(n).toMatch(/^[A-Za-z0-9-]+\.mp4$/);
    expect(nomTelechargement("é".repeat(300), "facebook", "4:5").length).toBeLessThanOrEqual(80);
    expect(nomTelechargement("", undefined)).toMatch(/^[A-Za-z0-9-]+\.mp4$/);
  });
});
