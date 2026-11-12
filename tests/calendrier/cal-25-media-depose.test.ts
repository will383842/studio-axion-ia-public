/** CAL-25 · média déposé à la main : format par réseau, empreinte relue, lien public après validation, téléversement serveur. */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.SESSION_SECRET = "secret-de-session-essai-0123456789-abcdef";
process.env.STUDIO_ADRESSE = "https://studio.essai.example";

const { verifierFormat, ratioDe, LIMITES_FORMAT } = await import("@/domaine/calendrier/formats-media");
const svc = await import("@/services/medias-deposes");
const { AjouterEntree } = await import("@/components/calendrier/AjouterEntree");
const { DepotMedia, envoyerFichierChoisi } = await import("@/components/calendrier/DepotMedia");

const Mo = 1024 * 1024;
const SHA = "a".repeat(64);
const horo = { creeLe: "2026-12-08T08:00:00.000Z", modifieLe: "2026-12-08T08:00:00.000Z" };

function monde(sur: { taille?: number | null; sha?: string; statut?: "propose" | "a_valider" | "valide" | "programme" | "publie"; mime?: string; taillePosee?: number } = {}) {
  const fichiers = new Map<string, Record<string, unknown>>();
  const creneaux = new Map<string, Record<string, unknown>>([["c1", { id: "c1", jourVise: "2026-12-10", heuresParReseau: {}, compteCible: "compte-fictif", statut: sur.statut ?? "propose", decalages: 0, ...horo }]]);
  const televerse: unknown[] = [];
  const deps = {
    fichiers: { obtenir: async (id: string) => (fichiers.get(id) as never) ?? null, enregistrer: async (f: never) => { fichiers.set((f as { id: string }).id, f); return f; } },
    creneaux: { obtenir: async (id: string) => (creneaux.get(id) as never) ?? null, enregistrer: async (c: never) => { creneaux.set((c as { id: string }).id, c); return c; } },
    stockage: {
      tailleObjet: async () => (sur.taille === undefined ? 5 * Mo : sur.taille),
      empreinteSha256: async (_c: string, t: number) => ({ sha256: sur.sha ?? SHA, taille: t }),
      urlLectureDuree: vi.fn(async (_c: string, s: number) => `https://r2.exemple/objet?exp=${s}`),
    },
    diffuseur: { televerser: vi.fn(async (d: unknown) => { televerse.push(d); return { idDiffuseur: "media-fictif-1" }; }) },
    maintenant: () => Date.parse("2026-12-09T10:00:00Z"),
  };
  return { deps, fichiers, creneaux, televerse };
}
const depot = (o: Record<string, unknown> = {}) => ({ fichierId: "f1", creneauId: "c1", reseau: "linkedin" as const, cle: "studio/dev/entree/c1/f1.mp4", nom: "demo.mp4", mime: "video/mp4", taille: 5 * Mo, sha256: SHA, largeur: 1080, hauteur: 1920, ...o });

describe("formats-media : contrôle par réseau, raison en français", () => {
  it("accepte un mp4 sur LinkedIn, refuse un PDF sur Instagram avec la raison", () => {
    expect(verifierFormat("linkedin", { mime: "video/mp4", taille: 5 * Mo }).ok).toBe(true);
    const r = verifierFormat("instagram", { mime: "application/pdf", taille: 1 * Mo });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/Instagram.*PDF/);
  });
  it("limite exacte acceptée, un octet de plus refusé", () => {
    const max = LIMITES_FORMAT.linkedin.pdf!.tailleMax;
    expect(verifierFormat("linkedin", { mime: "application/pdf", taille: max }).ok).toBe(true);
    const r = verifierFormat("linkedin", { mime: "application/pdf", taille: max + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/trop lourd/i);
  });
  it("vide, taille nulle, type illisible, durée trop longue : refusés avec raison", () => {
    for (const m of [{ mime: "", taille: 10 }, { mime: "video/mp4", taille: 0 }, { mime: "video/mp4", taille: Number.NaN }, { mime: "application/zip", taille: 10 }]) {
      const r = verifierFormat("tiktok", m);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.raison.length).toBeGreaterThan(10);
    }
    expect(verifierFormat("youtube-shorts", { mime: "video/mp4", taille: 10, dureeSec: 181 }).ok).toBe(false);
    expect(verifierFormat("youtube-shorts", { mime: "video/mp4", taille: 10, dureeSec: 180 }).ok).toBe(true);
  });
  it("ratio : 9:16, 1:1, 4:5, 16:9 reconnus ; dimensions absentes ou nulles : null", () => {
    expect(ratioDe(1080, 1920)).toBe("9:16");
    expect(ratioDe(1080, 1080)).toBe("1:1");
    expect(ratioDe(1080, 1350)).toBe("4:5");
    expect(ratioDe(1920, 1080)).toBe("16:9");
    expect(ratioDe(0, 10)).toBeNull();
    expect(ratioDe(undefined, 10)).toBeNull();
  });
});

describe("medias-deposes : dépôt, empreinte, rattachement", () => {
  it("dépôt complet : fichier prêt, rattaché à l'entrée, entrée toujours « propose », média privé", async () => {
    const m = monde();
    const r = await svc.enregistrerDepot(depot(), m.deps as never);
    expect(r.ok).toBe(true);
    expect((m.fichiers.get("f1") as { statut: string; sha256: string }).statut).toBe("pret");
    expect((m.fichiers.get("f1") as { sha256: string }).sha256).toBe(SHA);
    expect(m.creneaux.get("c1")).toMatchObject({ videoId: "f1", statut: "propose" });
    expect(m.deps.diffuseur.televerser).not.toHaveBeenCalled();
    expect(await svc.lienPublicPourDiffuseur("f1", "c1", m.deps as never)).toEqual({ ok: false, raison: expect.stringMatching(/valid/i) });
  });
  it("image et PDF se rattachent comme visuel", async () => {
    const m = monde();
    await svc.enregistrerDepot(depot({ mime: "application/pdf", cle: "studio/dev/entree/c1/f1.pdf", nom: "a.pdf" }), m.deps as never);
    expect(m.creneaux.get("c1")).toMatchObject({ visuelId: "f1" });
  });
  it("taille relue différente : refusé, entrée en brouillon, rien rattaché", async () => {
    const m = monde({ taille: 3 * Mo });
    const r = await svc.enregistrerDepot(depot(), m.deps as never);
    expect(r).toMatchObject({ ok: false, etat: "brouillon" });
    expect(m.creneaux.get("c1")).not.toHaveProperty("videoId");
    expect(m.fichiers.get("f1")?.statut).not.toBe("pret");
  });
  it("empreinte relue différente, ou objet absent (null) : refusé, brouillon", async () => {
    for (const sur of [{ sha: "b".repeat(64) }, { taille: null }]) {
      const m = monde(sur);
      const r = await svc.enregistrerDepot(depot(), m.deps as never);
      expect(r).toMatchObject({ ok: false, etat: "brouillon" });
      expect(m.creneaux.get("c1")).not.toHaveProperty("videoId");
    }
  });
  it("sans empreinte annoncée ou sans lecture possible : refusé (rien ne se prouve)", async () => {
    const m = monde();
    expect((await svc.enregistrerDepot(depot({ sha256: "" }), m.deps as never)).ok).toBe(false);
    const n = monde();
    delete (n.deps.stockage as Record<string, unknown>).empreinteSha256;
    expect((await svc.enregistrerDepot(depot(), n.deps as never)).ok).toBe(false);
  });
  it("format refusé par le réseau : l'ajout n'est pas bloqué, fichier gardé, brouillon à compléter avec la raison", async () => {
    const m = monde();
    const r = await svc.enregistrerDepot(depot({ reseau: "instagram", mime: "application/pdf", cle: "studio/dev/entree/c1/f1.pdf", nom: "a.pdf" }), m.deps as never);
    expect(r).toMatchObject({ ok: true, etat: "brouillon", formatRefuse: expect.stringMatching(/Instagram/) });
    expect(m.fichiers.get("f1")?.statut).toBe("pret");
    expect(m.creneaux.get("c1")).toMatchObject({ statut: "propose" });
  });
  it("rejeu du même dépôt : même résultat, un seul fichier", async () => {
    const m = monde();
    await svc.enregistrerDepot(depot(), m.deps as never);
    const r = await svc.enregistrerDepot(depot(), m.deps as never);
    expect(r.ok).toBe(true);
    expect(m.fichiers.size).toBe(1);
  });
  it("entrée inconnue ou archivée : refus", async () => {
    const m = monde();
    expect((await svc.enregistrerDepot(depot({ creneauId: "inconnu" }), m.deps as never)).ok).toBe(false);
    (m.creneaux.get("c1") as { statut: string }).statut = "archive";
    expect((await svc.enregistrerDepot(depot(), m.deps as never)).ok).toBe(false);
  });
});

describe("medias-deposes : après validation", () => {
  it("lien public signé (relais L5-04) seulement une fois l'entrée validée ; statuts avant validation refusés", async () => {
    for (const statut of ["propose", "a_valider"] as const) {
      const m = monde({ statut: statut as never });
      await svc.enregistrerDepot(depot(), m.deps as never);
      expect((await svc.lienPublicPourDiffuseur("f1", "c1", m.deps as never)).ok).toBe(false);
    }
    const m = monde();
    await svc.enregistrerDepot(depot(), m.deps as never);
    (m.creneaux.get("c1") as { statut: string }).statut = "valide"; // validation du fondateur, APRÈS le dépôt
    const r = await svc.lienPublicPourDiffuseur("f1", "c1", m.deps as never);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toMatch(/^https:\/\/studio\.essai\.example\/api\/medias-publics\/[^/]+\/video\.mp4$/);
  });
  it("le fichier d'une autre entrée n'est jamais publié par ce créneau", async () => {
    const m = monde();
    await svc.enregistrerDepot(depot(), m.deps as never);
    (m.creneaux.get("c1") as { statut: string }).statut = "valide";
    m.creneaux.set("c2", { id: "c2", jourVise: "2026-12-11", heuresParReseau: {}, compteCible: "compte-fictif", statut: "valide", decalages: 0, ...horo });
    expect((await svc.lienPublicPourDiffuseur("f1", "c2", m.deps as never)).ok).toBe(false);
  });
  it("le serveur téléverse le fichier privé chez le diffuseur, après validation seulement", async () => {
    const p = monde();
    await svc.enregistrerDepot(depot(), p.deps as never);
    expect((await svc.televerserChezDiffuseur("f1", "c1", p.deps as never)).ok).toBe(false);
    expect(p.deps.diffuseur.televerser).not.toHaveBeenCalled();
    const v = monde();
    await svc.enregistrerDepot(depot(), v.deps as never);
    (v.creneaux.get("c1") as { statut: string }).statut = "valide";
    const r = await svc.televerserChezDiffuseur("f1", "c1", v.deps as never);
    expect(r).toMatchObject({ ok: true, idDiffuseur: "media-fictif-1" });
    expect(v.televerse).toHaveLength(1);
    expect(v.televerse[0]).toMatchObject({ nom: "demo.mp4", mime: "video/mp4", taille: 5 * Mo });
  });
  it("panne du diffuseur : échec clair, rien de faux enregistré", async () => {
    const v = monde();
    await svc.enregistrerDepot(depot(), v.deps as never);
    (v.creneaux.get("c1") as { statut: string }).statut = "valide";
    v.deps.diffuseur.televerser.mockRejectedValueOnce(new Error("hors ligne"));
    expect((await svc.televerserChezDiffuseur("f1", "c1", v.deps as never)).ok).toBe(false);
  });
});

describe("medias-deposes : un dépôt ramène l'entrée en brouillon (relecture u1)", () => {
  it("dépôt sur une entrée valide ou programmée : elle repasse à « a_valider », le fondateur doit revalider, rien ne part", async () => {
    for (const statut of ["valide", "programme"] as const) {
      const m = monde({ statut });
      const r = await svc.enregistrerDepot(depot(), m.deps as never);
      expect(r.ok).toBe(true);
      expect(m.creneaux.get("c1")).toMatchObject({ statut: "a_valider", videoId: "f1" });
      expect((await svc.televerserChezDiffuseur("f1", "c1", m.deps as never)).ok).toBe(false);
      expect(m.deps.diffuseur.televerser).not.toHaveBeenCalled();
    }
  });
  it("dépôt sur une entrée déjà publiée : refusé, rien n'est rattaché", async () => {
    const m = monde({ statut: "publie" });
    const r = await svc.enregistrerDepot(depot(), m.deps as never);
    expect(r.ok).toBe(false);
    expect(m.creneaux.get("c1")).toMatchObject({ statut: "publie" });
    expect(m.creneaux.get("c1")).not.toHaveProperty("videoId");
  });
  it("entrée « propose » ou « a_valider » : le statut ne bouge pas", async () => {
    for (const statut of ["propose", "a_valider"] as const) {
      const m = monde({ statut });
      await svc.enregistrerDepot(depot(), m.deps as never);
      expect(m.creneaux.get("c1")).toMatchObject({ statut });
    }
  });
  it("format refusé : jamais téléversé chez le diffuseur, même sur une entrée validée (lien refusé aussi)", async () => {
    const m = monde();
    await svc.enregistrerDepot(depot({ reseau: "instagram", mime: "application/pdf", cle: "studio/dev/entree/c1/f1.pdf", nom: "a.pdf" }), m.deps as never);
    (m.creneaux.get("c1") as { statut: string; reseau?: string; heuresParReseau: Record<string, string> }).statut = "programme";
    (m.creneaux.get("c1") as { heuresParReseau: Record<string, string> }).heuresParReseau = { instagram: "2026-12-10T08:00:00.000Z" };
    const r = await svc.televerserChezDiffuseur("f1", "c1", m.deps as never);
    expect(r).toMatchObject({ ok: false, raison: expect.stringMatching(/Instagram/) });
    expect(m.deps.diffuseur.televerser).not.toHaveBeenCalled();
    expect(await svc.lienPublicPourDiffuseur("f1", "c1", m.deps as never)).toMatchObject({ ok: false });
  });
});

describe("formulaire : le fichier choisi est réellement envoyé", () => {
  const fichier = (nom: string, type: string, taille = 1000) => ({ name: nom, type, size: taille }) as unknown as File;
  it("fichier accepté : envoyé une fois, vers l'entrée du formulaire, et rattaché (vidéo ou visuel)", async () => {
    const envoyer = vi.fn(async () => ({ fichierId: "fAbc", simulation: false }));
    const v = await envoyerFichierChoisi(fichier("a.mp4", "video/mp4"), "linkedin", "manuel-k1", envoyer as never);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer).toHaveBeenCalledWith(expect.anything(), { typeEntite: "entree", entiteId: "manuel-k1" });
    expect(v).toEqual({ ok: true, videoId: "fAbc" });
    const i = await envoyerFichierChoisi(fichier("a.png", "image/png"), "linkedin", "manuel-k1", envoyer as never);
    expect(i).toEqual({ ok: true, visuelId: "fAbc" });
  });
  it("format refusé par le réseau : jamais envoyé, l'ajout reste possible sans fichier", async () => {
    const envoyer = vi.fn(async () => ({ fichierId: "fAbc", simulation: false }));
    const r = await envoyerFichierChoisi(fichier("a.pdf", "application/pdf"), "instagram", "manuel-k1", envoyer as never);
    expect(envoyer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, refuse: expect.stringMatching(/Instagram/), nonEnvoye: expect.stringMatching(/n'a pas été envoyé/) });
  });
  it("envoi en échec : l'ajout continue sans fichier, avec une phrase claire", async () => {
    const envoyer = vi.fn(async () => { throw new Error("hors ligne"); });
    const r = await envoyerFichierChoisi(fichier("a.mp4", "video/mp4"), "linkedin", "manuel-k1", envoyer as never);
    expect(r).toMatchObject({ ok: true, nonEnvoye: expect.stringMatching(/à joindre ensuite/) });
    expect(r).not.toHaveProperty("videoId");
  });
  it("aucun fichier choisi : rien n'est envoyé", async () => {
    const envoyer = vi.fn();
    expect(await envoyerFichierChoisi(null, "linkedin", "manuel-k1", envoyer as never)).toEqual({ ok: true });
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("medias-deposes : ratio, affiche, urlDeLecture", () => {
  it("expose le ratio, l'image d'affiche et une adresse de lecture à durée limitée", async () => {
    const m = monde();
    await svc.enregistrerDepot(depot({ afficheCle: "studio/dev/entree/c1/affiche.jpg" }), m.deps as never);
    const i = await svc.infosMedia("f1", m.deps as never);
    expect(i).toMatchObject({ ratio: "9:16", affiche: "studio/dev/entree/c1/affiche.jpg" });
    const u = await svc.urlDeLecture("f1", m.deps as never);
    expect(u).toMatch(/^https:\/\//);
    expect(m.deps.stockage.urlLectureDuree).toHaveBeenCalledWith(expect.any(String), svc.DUREE_LECTURE_SEC);
    expect(svc.DUREE_LECTURE_SEC).toBeLessThanOrEqual(900);
    expect(await svc.urlDeLecture("inconnu", m.deps as never)).toBeNull();
  });
});

describe("composants", () => {
  it("AjouterEntree propose le dépôt d'un fichier (vidéo, PDF, image) ; DepotMedia dit que rien ne part sans validation", () => {
    const html = renderToStaticMarkup(createElement(AjouterEntree, { jour: "2026-12-10", compteCible: "compte-fictif" }));
    expect(html).toMatch(/vidéo, PDF, image/i);
    const d = renderToStaticMarkup(createElement(DepotMedia, { reseau: "linkedin", onMedia: () => undefined }));
    expect(d).toMatch(/ne partira pas|rien ne part/i);
  });
});
