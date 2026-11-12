/**
 * Page « Vidéos validées » (lot V) : allumée par défaut (décision de Williams, 08/11), vidéos classées par réseau,
 * téléchargement d'une vidéo ou de tout un réseau (zip des seules vidéos validées), aucune génération.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";

delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/services/image-video-carte", () => ({ travailImageVideo: async () => null }));
// Espion : le zip et la page ne génèrent JAMAIS un kit (l'appel interne de `obtenirKit` passe sans dépense).
const generation = vi.hoisted(() => ({ appels: [] as unknown[][] }));
vi.mock("@/services/publications", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/services/publications")>();
  return {
    ...m,
    genererKit: (...a: Parameters<typeof m.genererKit>) => {
      generation.appels.push(a);
      return m.genererKit(...a);
    },
  };
});

// Le stockage de simulation renvoie toujours la même adresse : ici l'adresse porte la clé, pour savoir QUEL fichier part au zip.
vi.mock("@/services/_commun", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...m,
    fournisseur: async (nom: string) => {
      const f = await (m.fournisseur as (n: string) => Promise<Record<string, unknown>>)(nom);
      return nom === "stockage" ? { ...f, urlLecture: async (cle: string) => `https://stockage.test/${cle}` } : f;
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const apub = await import("@/services/a-publier");
const tel = await import("@/services/telechargements");
const { lireZip } = await import("@/lib/zip");
const { ListeAPublier } = await import("@/components/publication/ListeAPublier");
const { GET } = await import("@/app/api/telechargements/route");

const MDP = "essai-validees";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  generation.appels.length = 0;
});

/** Livre une vidéo « image → vidéo » pour LinkedIn et Facebook (la livraison de la version choisie fait foi). */
async function livrerImageVideo(videoId: string) {
  const v = (await depots().videos.obtenir(videoId))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().versions.modifier(ver.id, {
    projetMontage: {
      ...(ver.projetMontage ?? {}),
      imageVideo: {
        livraison: [
          { reseau: "linkedin", version: "a", fichierCle: `studio/iv/${videoId}-li.mp4`, format: "9:16" },
          { reseau: "facebook", version: "a", fichierCle: `studio/iv/${videoId}-fb.mp4`, fichierCleFil: `studio/iv/${videoId}-fb-fil.mp4`, format: "9:16" },
        ],
      },
    },
  } as never);
}
/** Le jeu d'essai a déjà des vidéos validées : on ne garde validées que celles dont le test a besoin. */
const seulesValidees = (...ids: string[]) =>
  depots().videos.lister(() => true).then((vs) => Promise.all(vs.filter((v) => v.etapeEditoriale === "validee" && !ids.includes(v.id)).map((v) => depots().videos.modifier(v.id, { etapeEditoriale: "a_relire" }))));
const valider = (id: string) => depots().videos.modifier(id, { etapeEditoriale: "validee" });
const lignes = async () => (await apub.vueAPublier()).lignes;
const noms = (c: Awaited<ReturnType<typeof tel.contenuArchiveValidees>>) => c.entrees.map((e) => e.nom);

describe("Vidéos validées · page allumée par défaut (décision de Williams, 08/11)", () => {
  it("allumée sans réglage ; seul un false exact l'éteint", async () => {
    expect(await apub.pageAPublierAllumee()).toBe(true);
    await apub.definirPageAPublier(false);
    expect(await apub.pageAPublierAllumee()).toBe(false);
    await apub.definirPageAPublier(true);
    expect(await apub.pageAPublierAllumee()).toBe(true);
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre(apub.PARAM_PAGE_A_PUBLIER, "n importe quoi");
    expect(await apub.pageAPublierAllumee()).toBe(true);
  });

  it("le nombre de vidéos à relire alimente le lien « À relire (n) »", async () => {
    await depots().videos.modifier("v-15", { etapeEditoriale: "a_relire" });
    const attendu = await depots().videos.compter((v) => v.statut === "prete" && v.etapeEditoriale === "a_relire");
    expect((await apub.vueAPublier()).nbARelire).toBe(attendu);
    expect(attendu).toBeGreaterThan(0);
  });
});

describe("Vidéos validées · classement par réseau", () => {
  it("image → vidéo LinkedIn + Facebook : une ligne dans chaque section, en téléchargement seul", async () => {
    await livrerImageVideo("v-15");
    await valider("v-15");
    const l = (await lignes()).filter((x) => x.videoId === "v-15");
    expect(l.map((x) => x.reseau).sort()).toEqual(["facebook", "linkedin"]);
    for (const x of l) expect(x).toMatchObject({ telechargementSeul: true, reseauxPrecis: true });
    expect(l[0].reseauxVideo).toEqual(expect.arrayContaining(["linkedin", "facebook"]));
  });

  it("une vidéo sans réseau connu prend les réseaux par défaut, pastilles atténuées", async () => {
    await valider("v-15");
    const l = (await lignes()).filter((x) => x.videoId === "v-15");
    expect(l.length).toBeGreaterThan(0);
    for (const x of l) expect(x.telechargementSeul).toBeUndefined();
    const sorties = await depots().sorties.lister((s) => s.videoId === "v-15");
    if (!sorties.some((s) => s.reseaux?.length)) for (const x of l) expect(x.reseauxPrecis).toBe(false);
  });
});

describe("Vidéos validées · zip d'un réseau", () => {
  it("ne prend que des validées de ce réseau : bon fichier, texte enregistré, aucun kit généré", async () => {
    await livrerImageVideo("v-15");
    await seulesValidees("v-15", "v-03");
    await valider("v-15");
    // v-03 : validée mais faite pour TikTok seulement ; v-12 : LinkedIn par défaut mais encore à relire.
    await depots().videos.modifier("v-03", { etapeEditoriale: "validee", reseau: "tiktok" } as never);
    await depots().videos.modifier("v-12", { etapeEditoriale: "a_relire" });
    const kitsAvant = await depots().kits.compter(() => true);
    const c = await tel.contenuArchiveValidees("linkedin");
    expect(c.nom).toMatch(/^LinkedIn-validees-\d{4}-\d{2}-\d{2}\.zip$/);
    const fichiers = c.entrees.filter((e) => "url" in e);
    expect(fichiers).toHaveLength(1);
    expect(c.entrees.some((e) => "url" in e && e.url.includes("v-15-li.mp4"))).toBe(true);
    expect(c.entrees.some((e) => "url" in e && e.url.includes("v-15-fb"))).toBe(false);
    expect(c.entrees.filter((e) => e.nom.endsWith(".txt"))).toHaveLength(1);
    expect(noms(c).every((n) => /^[A-Za-z0-9.-]+$/.test(n))).toBe(true);
    // Les autres vidéos (TikTok, à relire) n'y sont pas.
    const v03 = (await depots().videos.obtenir("v-03"))!;
    expect(noms(c).join("|").toLowerCase()).not.toContain(v03.titre.split(" ")[0].toLowerCase());
    expect(await depots().kits.compter(() => true)).toBe(kitsAvant);
    expect(generation.appels).toHaveLength(0);
  });

  it("le fil de Facebook accompagne la vidéo de Facebook", async () => {
    await seulesValidees("v-15");
    await livrerImageVideo("v-15");
    await valider("v-15");
    const c = await tel.contenuArchiveValidees("facebook");
    const urls = c.entrees.flatMap((e) => ("url" in e ? [e.url] : []));
    expect(urls.some((u) => u.includes("v-15-fb.mp4"))).toBe(true);
    expect(urls.some((u) => u.includes("v-15-fb-fil.mp4"))).toBe(true);
  });

  it("une vidéo ordinaire donne la meilleure sortie du réseau, sans réécrire de texte", async () => {
    await valider("v-12");
    const c = await tel.contenuArchiveValidees("linkedin");
    expect(c.entrees.some((e) => "url" in e && e.nom.endsWith(".mp4"))).toBe(true);
    expect(generation.appels).toHaveLength(0);
  });

  it("le nom du zip garde le nom entier du réseau (aucune lettre perdue)", async () => {
    await seulesValidees();
    await valider("v-12");
    const c = await tel.contenuArchiveValidees("instagram");
    expect(c.nom).toMatch(/^Instagram-validees-/);
  });

  it("une vidéo archivée n'y est jamais", async () => {
    await seulesValidees("v-15");
    await valider("v-15");
    await livrerImageVideo("v-15");
    await depots().videos.modifier("v-15", { statut: "archivee" } as never);
    await expect(tel.contenuArchiveValidees("linkedin")).rejects.toMatchObject({ code: "RIEN_A_TELECHARGER" });
  });

  it("une vidéo prête mais à la corbeille n'y est jamais (filtre corbeilleLe)", async () => {
    await seulesValidees("v-15");
    await valider("v-15");
    await livrerImageVideo("v-15");
    await depots().videos.modifier("v-15", { corbeilleLe: new Date().toISOString(), statut: "prete" } as never);
    await expect(tel.contenuArchiveValidees("linkedin")).rejects.toMatchObject({ code: "RIEN_A_TELECHARGER" });
  });

  it("une vidéo programmée puis publiée est exclue du zip", async () => {
    await seulesValidees("v-15", "v-12");
    await livrerImageVideo("v-15");
    await valider("v-15");
    await valider("v-12");
    const cleDe = (c: Awaited<ReturnType<typeof tel.contenuArchiveValidees>>) => c.entrees.flatMap((e) => ("url" in e ? [e.url] : []));
    expect(cleDe(await tel.contenuArchiveValidees("linkedin")).some((u) => u.includes("v-15-li.mp4"))).toBe(true);
    for (const etape of ["programmee", "publiee"] as const) {
      await depots().videos.modifier("v-15", { etapeEditoriale: etape });
      const c = await tel.contenuArchiveValidees("linkedin");
      expect(cleDe(c).some((u) => u.includes("v-15"))).toBe(false);
    }
  });

  it("une validée sans fichier est nommée dans le zip, pas sautée en silence", async () => {
    await seulesValidees("v-15");
    await valider("v-15");
    await depots().videos.modifier("v-15", { reseau: "linkedin" } as never);
    await depots().sorties.lister((s) => s.videoId === "v-15").then((ss) => Promise.all(ss.map((s) => depots().sorties.supprimer?.(s.id))));
    const v = (await depots().videos.obtenir("v-15"))!;
    const c = await tel.contenuArchiveValidees("linkedin");
    const note = c.entrees.find((e) => e.nom === "VIDEOS-SANS-FICHIER.txt");
    expect(note && "contenu" in note ? note.contenu : "").toContain(v.titre);
  });

  it("une liste vide lève une ErreurStudio", async () => {
    await depots().videos.lister(() => true).then((vs) => Promise.all(vs.map((v) => depots().videos.modifier(v.id, { etapeEditoriale: "a_relire" }))));
    const { ErreurStudio } = await import("@/services/_commun");
    await expect(tel.contenuArchiveValidees("linkedin")).rejects.toBeInstanceOf(ErreurStudio);
  });

  it("sans session : refusé", async () => {
    await auth.seDeconnecter();
    await expect(tel.contenuArchiveValidees("linkedin")).rejects.toMatchObject({ vers: "/connexion" });
  });
});

describe("Vidéos validées · route /api/telechargements?validees=1&reseau=…", () => {
  const demande = (q: string) => new NextRequest(`http://studio.test/api/telechargements${q}`);

  it("renvoie un zip lu au fil de l'eau (fluxZip, jamais creerZip)", async () => {
    await livrerImageVideo("v-15");
    await valider("v-15");
    vi.stubGlobal("fetch", async () => new Response(new Uint8Array([1, 2, 3, 4])));
    const r = await GET(demande("?validees=1&reseau=linkedin"));
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/zip");
    expect(decodeURIComponent(r.headers.get("Content-Disposition") ?? "")).toMatch(/LinkedIn-validees-\d{4}-\d{2}-\d{2}\.zip/);
    const zip = lireZip(new Uint8Array(await r.arrayBuffer()));
    expect(zip.some((f) => f.nom.endsWith(".mp4"))).toBe(true);
    expect(zip.some((f) => f.nom.endsWith(".txt"))).toBe(true);
  });

  it("sans session : 401", async () => {
    await auth.seDeconnecter();
    expect((await GET(demande("?validees=1&reseau=linkedin"))).status).toBe(401);
  });

  it("réseau inconnu : 400 ; rien de validé : 404", async () => {
    expect((await GET(demande("?validees=1&reseau=nimporte"))).status).toBe(400);
    expect((await GET(demande("?validees=1"))).status).toBe(400);
    await depots().videos.lister(() => true).then((vs) => Promise.all(vs.map((v) => depots().videos.modifier(v.id, { etapeEditoriale: "a_relire" }))));
    expect((await GET(demande("?validees=1&reseau=linkedin"))).status).toBe(404);
  });

  it("les deux anciennes branches (sujet, réseau + dates) répondent comme avant", async () => {
    expect((await GET(demande(""))).status).toBe(400);
    expect((await GET(demande("?sujet=inconnu"))).status).toBe(404);
  });
});

describe("Vidéos validées · la liste", () => {
  const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");
  const liste = async (reseau?: string) => renderToStaticMarkup(createElement(ListeAPublier, { lignes: await lignes(), filtre: "toutes", reseau }));

  it("une section par réseau : « Tout télécharger », et par ligne Télécharger + Remettre à relire", async () => {
    await livrerImageVideo("v-15");
    await valider("v-15");
    const h = await liste();
    expect(h).toContain('href="/api/telechargements?validees=1&amp;reseau=linkedin"');
    expect(h).toContain('href="/api/telechargements?validees=1&amp;reseau=facebook"');
    expect(h).toContain("/api/telechargements/video?video=v-15&amp;reseau=linkedin");
    expect(texte(h)).toContain("Tout télécharger");
    expect(texte(h)).toContain("Télécharger");
    expect(texte(h)).toContain("Remettre à relire");
  });

  it("« Tout télécharger » seulement si la section a une ligne validée", async () => {
    await seulesValidees("v-15");
    await livrerImageVideo("v-15");
    await valider("v-15");
    const l = (await lignes()).map((x) => (x.videoId === "v-15" && x.reseau === "facebook" ? { ...x, etapeVideo: "programmee" as const } : x));
    const h = renderToStaticMarkup(createElement(ListeAPublier, { lignes: l, filtre: "toutes", reseau: "tous" }));
    expect(h).toContain("reseau=linkedin");
    expect(h).not.toContain("validees=1&amp;reseau=facebook");
  });

  it("une ligne image → vidéo n'offre jamais l'envoi", async () => {
    await livrerImageVideo("v-15");
    await valider("v-15");
    const h = texte(await liste("facebook"));
    expect(h).toContain("Télécharger");
    expect(h).not.toMatch(/Envoyer|Programmer/);
  });

  it("aucun mot interdit dans la page", async () => {
    await valider("v-15");
    expect(texte(await liste())).not.toMatch(/Buffer|Zernio|\bkit\b|variante/i);
  });
});
