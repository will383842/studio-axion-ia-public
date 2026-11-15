/**
 * G5 : fabrication d'un guide depuis le Studio. Sans base ni réseau : faux fetch, fausses dépendances, valeurs fictives.
 */
import { describe, expect, it, vi } from "vitest";
import { CHEMIN_GUIDES_CONTENU, codeGuideDuMot, corpsContenuGuide, guidesFabriqueActif, lireReponseSite } from "@/domaine/guides-pdf/guide-fabrique";
import { empreinteGuide, type ContenuGuide } from "@/domaine/guides-pdf/guide-contenu";
import { envoyerContenuGuide, type ResultatEnvoiContenu } from "@/services/guides-fabrique-site";
import { signatureValide } from "@/fournisseurs/site/signature";
import { fabriquerPdf, lireGuideDuMot, rattacherGuide, redigerGuide, validerGuide, type DepsFabrique } from "@/services/guides-fabrique";
import { identifiantMot } from "@/services/guides-redaction";

const J = (a: string, b: string) => a + b;
const SECRET = "s".repeat(40);
const ENV = { GUIDES_FABRIQUE_ECRAN: "true", SITE_GUIDES_RESEAU_SECRET: SECRET, SITE_VIDEOS_URL: "https://site.exemple" };
const CONTENU: ContenuGuide = { titre: "Mon premier guide", sections: [{ titre: "Pour commencer", paragraphes: ["Un texte simple."], puces: ["Une puce"] }] };

function memoire(init: Record<string, unknown> = {}) {
  const m = new Map<string, unknown>(Object.entries(init));
  return { m, lire: async (id: string) => m.get(id) ?? null, ecrire: async (id: string, v: unknown) => void m.set(id, structuredClone(v)) };
}
function deps(over: Partial<DepsFabrique> = {}, init: Record<string, unknown> = {}) {
  const mem = memoire(init);
  const d: DepsFabrique = {
    env: ENV,
    lireParametre: mem.lire,
    ecrireParametre: mem.ecrire,
    journaliser: vi.fn(async () => {}),
    maintenant: () => "2026-11-15T10:00:00Z",
    rediger: vi.fn(async () => ({ ok: true as const, version: 1, statut: "À valider" as const, empreinte: "x" })),
    envoyer: vi.fn(async () => ({ issue: "fabrique" as const, cheminPdf: "/guides/mon-guide.pdf", pages: 4 })),
    creerElement: vi.fn(async (o) => ({ ok: true as const, code: o.code })),
    lierInactif: vi.fn(async () => ({ ok: true as const })),
    ...over,
  };
  return { d, mem };
}
const idMot = identifiantMot("facture")!;
const cleRedaction = `guides.redaction.${idMot}`;
const cleFabrique = `guides.fabrique.${idMot}`;
const versionA = (statut: string, version = 1, contenu = CONTENU) => ({ version, statut, empreinte: empreinteGuide(contenu), modele: "m", creeLe: "t", contenu });

describe("interrupteur GUIDES_FABRIQUE_ECRAN", () => {
  it("vrai seulement pour la chaîne exacte « true »", () => {
    expect(guidesFabriqueActif({})).toBe(false);
    for (const v of ["True", "TRUE", " true", "true ", "1", "oui", "truee", "true".padEnd(40, " ")]) expect(guidesFabriqueActif({ GUIDES_FABRIQUE_ECRAN: v })).toBe(false);
    expect(guidesFabriqueActif({ GUIDES_FABRIQUE_ECRAN: "true" })).toBe(true);
  });
  it("éteint : chaque geste refuse sans rien lire, écrire ni envoyer", async () => {
    const { d } = deps({ env: {} });
    const lire = vi.fn(d.lireParametre);
    d.lireParametre = lire;
    for (const r of [await lireGuideDuMot("facture", d), await redigerGuide("facture", d), await validerGuide({ mot: "facture", version: 1, contenu: CONTENU, toutLu: true }, d), await fabriquerPdf({ mot: "facture" }, d), await rattacherGuide({ mot: "facture" }, d)]) {
      expect(r).toMatchObject({ ok: false, raison: "ecran_eteint" });
    }
    expect(lire).not.toHaveBeenCalled();
    expect(d.rediger).not.toHaveBeenCalled();
    expect(d.envoyer).not.toHaveBeenCalled();
    expect(d.creerElement).not.toHaveBeenCalled();
  });
});

describe("empreinte et corps : importés de guide-contenu, jamais recopiés", () => {
  it("sha256Texte = empreinte du JSON canonique ; le code du guide est stable", () => {
    const c = corpsContenuGuide("gde-abc123def456", 2, CONTENU);
    expect(c).toEqual({ code: "gde-abc123def456", version: 2, sha256Texte: empreinteGuide(CONTENU), titre: CONTENU.titre, sections: CONTENU.sections });
    expect(codeGuideDuMot("facture-1")).toMatch(/^gde-[0-9a-f]{12}$/);
    expect(codeGuideDuMot("facture-1")).toBe(codeGuideDuMot("facture-1"));
  });
});

describe("réponses du site", () => {
  it("201 fabriqué ; 409, 422, 429, 503, 404 ont chacun leur phrase ; un chemin douteux est écarté", () => {
    expect(lireReponseSite(201, { cheminPdf: "/guides/a.pdf", pages: 3 })).toEqual({ issue: "fabrique", cheminPdf: "/guides/a.pdf", pages: 3 });
    expect(lireReponseSite(201, { cheminPdf: "/../etc.pdf" })).toMatchObject({ issue: "fabrique", cheminPdf: null });
    expect(lireReponseSite(201, null)).toMatchObject({ issue: "fabrique", cheminPdf: null, pages: null });
    expect(lireReponseSite(409, null).issue).toBe("deja_ou_perime");
    expect(lireReponseSite(422, null).issue).toBe("refus_contenu");
    expect(lireReponseSite(429, null).issue).toBe("rendu_en_cours");
    expect(lireReponseSite(503, null).issue).toBe("echec");
    expect(lireReponseSite(404, null).issue).toBe("site_absent");
    expect(lireReponseSite(500, null).issue).toBe("echec");
  });
});

describe("client signé (faux fetch)", () => {
  const corps = corpsContenuGuide("gde-abc123def456", 1, CONTENU);
  it("poste sur la bonne route avec une signature valide", async () => {
    const f = vi.fn(async (...a: [string | URL | Request, RequestInit?]) => (a, new Response(JSON.stringify({ cheminPdf: "/guides/a.pdf", pages: 2 }), { status: 201 })));
    const r = await envoyerContenuGuide({ corps, env: ENV, fetch: f as unknown as typeof fetch, maintenantMs: 1_800_000_000_000 });
    expect(r).toMatchObject({ issue: "fabrique", cheminPdf: "/guides/a.pdf" });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe(`https://site.exemple${CHEMIN_GUIDES_CONTENU}`);
    expect(init?.method).toBe("POST");
    const h = init?.headers as Record<string, string>;
    expect(signatureValide(SECRET, { methode: "POST", chemin: CHEMIN_GUIDES_CONTENU, corps: String(init?.body), horodatage: h["x-axion-horodatage"], nonce: h["x-axion-nonce"], signature: h["x-axion-signature"] })).toBe(true);
    expect(JSON.parse(String(init?.body))).toEqual(corps);
  });
  it.each([[404, "site_absent"], [503, "echec"], [409, "deja_ou_perime"], [422, "refus_contenu"], [429, "rendu_en_cours"]])("statut %i → %s", async (statut, issue) => {
    const f = vi.fn(async () => new Response("", { status: statut }));
    expect(await envoyerContenuGuide({ corps, env: ENV, fetch: f as unknown as typeof fetch })).toMatchObject({ issue });
  });
  it("coupure : « incertain », sans lever ; site non relié : aucun appel", async () => {
    const coupe = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await envoyerContenuGuide({ corps, env: ENV, fetch: coupe as unknown as typeof fetch })).toMatchObject({ issue: "incertain" });
    const jamais = vi.fn();
    expect(await envoyerContenuGuide({ corps, env: {}, fetch: jamais as unknown as typeof fetch })).toMatchObject({ issue: "non_relie" });
    expect(await envoyerContenuGuide({ corps, env: { ...ENV, SITE_GUIDES_RESEAU_SECRET: "court" }, fetch: jamais as unknown as typeof fetch })).toMatchObject({ issue: "non_relie" });
    expect(jamais).not.toHaveBeenCalled();
  });
});

describe("valider après relecture", () => {
  it("refuse sans « j'ai tout lu », texte mal formé ou mot interdit ; rien n'est écrit", async () => {
    const { d, mem } = deps({}, { [cleRedaction]: { versions: [versionA("À valider")] } });
    expect(await validerGuide({ mot: "facture", version: 1, contenu: CONTENU, toutLu: false }, d)).toMatchObject({ ok: false, raison: "relecture_requise" });
    expect(await validerGuide({ mot: "facture", version: 1, contenu: { titre: "x" }, toutLu: true }, d)).toMatchObject({ raison: "texte_invalide" });
    const mauvais = { ...CONTENU, sections: [{ titre: "Suivi", paragraphes: [`Vous gagnez 30 % de plus à ${J("gren", "oble")}.`], puces: [] }] };
    expect(await validerGuide({ mot: "facture", version: 1, contenu: mauvais, toutLu: true }, d)).toMatchObject({ raison: "texte_refuse", regle: expect.any(String) });
    expect((mem.m.get(cleRedaction) as { versions: { statut: string }[] }).versions[0].statut).toBe("À valider");
  });
  it("valide la dernière version, enregistre le texte corrigé et son empreinte recalculée", async () => {
    const { d, mem } = deps({}, { [cleRedaction]: { versions: [versionA("À valider")] } });
    const corrige: ContenuGuide = { ...CONTENU, titre: "Mon guide corrigé" };
    const r = await validerGuide({ mot: "facture", version: 1, contenu: corrige, toutLu: true }, d);
    expect(r).toMatchObject({ ok: true, empreinte: empreinteGuide(corrige) });
    const v = (mem.m.get(cleRedaction) as { versions: { statut: string; contenu: ContenuGuide; empreinte: string }[] }).versions[0];
    expect(v).toMatchObject({ statut: "Validé", empreinte: empreinteGuide(corrige) });
    expect(v.contenu.titre).toBe("Mon guide corrigé");
    expect(await validerGuide({ mot: "facture", version: 1, contenu: corrige, toutLu: true }, d)).toMatchObject({ raison: "deja_valide" });
  });
  it("refuse une version qui n'est pas la dernière", async () => {
    const { d } = deps({}, { [cleRedaction]: { versions: [versionA("À valider", 1), versionA("À valider", 2)] } });
    expect(await validerGuide({ mot: "facture", version: 1, contenu: CONTENU, toutLu: true }, d)).toMatchObject({ raison: "pas_la_derniere" });
  });
});

describe("fabriquer le PDF", () => {
  const valide = () => ({ [cleRedaction]: { versions: [versionA("Validé")] } });
  it("refuse sans texte validé", async () => {
    const { d } = deps({}, { [cleRedaction]: { versions: [versionA("À valider")] } });
    expect(await fabriquerPdf({ mot: "facture" }, d)).toMatchObject({ raison: "pas_valide" });
    expect(d.envoyer).not.toHaveBeenCalled();
  });
  it("201 : envoie le texte validé enregistré (pas celui d'un client) et note « fabriqué » ; un second appel est refusé", async () => {
    const { d, mem } = deps({}, valide());
    const r = await fabriquerPdf({ mot: "facture" }, d);
    expect(r).toMatchObject({ ok: true, cheminPdf: "/guides/mon-guide.pdf", pages: 4 });
    expect(d.envoyer).toHaveBeenCalledWith({ code: codeGuideDuMot(idMot), version: 1, sha256Texte: empreinteGuide(CONTENU), titre: CONTENU.titre, sections: CONTENU.sections });
    expect(mem.m.get(cleFabrique)).toMatchObject({ version: 1, sha256Texte: empreinteGuide(CONTENU) });
    expect(await fabriquerPdf({ mot: "facture" }, d)).toMatchObject({ raison: "deja_fabrique" });
    expect(d.envoyer).toHaveBeenCalledTimes(1);
  });
  it.each(["deja_ou_perime", "refus_contenu", "rendu_en_cours", "echec", "site_absent", "non_relie", "incertain"] as const)("site : %s → message clair, rien noté comme fabriqué", async (issue) => {
    const { d, mem } = deps({ envoyer: vi.fn(async () => ({ issue, phrase: "Phrase du site." })) }, valide());
    const r = await fabriquerPdf({ mot: "facture" }, d);
    expect(r).toMatchObject({ ok: false, raison: "site", phrase: "Phrase du site." });
    expect(mem.m.has(cleFabrique)).toBe(false);
  });
  it("texte abîmé dans l'enregistrement (empreinte différente) : refus, rien envoyé", async () => {
    const abime = { ...versionA("Validé"), empreinte: "0".repeat(64) };
    const { d } = deps({}, { [cleRedaction]: { versions: [abime] } });
    expect(await fabriquerPdf({ mot: "facture" }, d)).toMatchObject({ raison: "texte_modifie" });
    expect(d.envoyer).not.toHaveBeenCalled();
  });
  it("un seul geste à la fois par mot", async () => {
    let debloquer: (v: { issue: "fabrique"; cheminPdf: null; pages: null }) => void = () => {};
    const { d } = deps({ envoyer: () => new Promise<ResultatEnvoiContenu>((res) => { debloquer = res as typeof debloquer; }) }, valide());
    const premier = fabriquerPdf({ mot: "facture" }, d);
    await new Promise((r) => setTimeout(r, 0));
    expect(await fabriquerPdf({ mot: "facture" }, d)).toMatchObject({ raison: "en_cours" });
    debloquer({ issue: "fabrique", cheminPdf: null, pages: null });
    expect(await premier).toMatchObject({ ok: true });
  });
});

describe("rattacher au mot", () => {
  const pret = (extra: object = {}) => ({ [cleRedaction]: { versions: [versionA("Validé")] }, [cleFabrique]: { version: 1, sha256Texte: empreinteGuide(CONTENU), code: codeGuideDuMot(idMot), cheminPdf: "/guides/a.pdf", pages: 2, fabriqueLe: "t", ...extra } });
  it("refuse tant que le PDF n'est pas fabriqué", async () => {
    const { d } = deps({}, { [cleRedaction]: { versions: [versionA("Validé")] } });
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ raison: "pas_fabrique" });
  });
  it("crée l'élément du catalogue puis la liaison INACTIVE ; rien d'autre", async () => {
    const { d, mem } = deps({}, pret());
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ ok: true });
    expect(d.creerElement).toHaveBeenCalledWith({ titre: CONTENU.titre, cheminPdf: "/guides/a.pdf", code: codeGuideDuMot(idMot) });
    expect(d.lierInactif).toHaveBeenCalledWith({ mot: "facture", codeCible: codeGuideDuMot(idMot) });
    expect(mem.m.get(cleFabrique)).toMatchObject({ rattacheLe: expect.any(String) });
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ raison: "deja_rattache" });
  });
  it("échec du catalogue ou de la liaison : phrase claire, pas noté rattaché", async () => {
    const a = deps({ creerElement: vi.fn(async (o) => ({ ok: false as const, phrase: "Catalogue refusé.", code: o.code })) }, pret());
    expect(await rattacherGuide({ mot: "facture" }, a.d)).toMatchObject({ ok: false, phrase: "Catalogue refusé." });
    expect(a.d.lierInactif).not.toHaveBeenCalled();
    const b = deps({ lierInactif: vi.fn(async () => ({ ok: false as const, phrase: "Liaison refusée." })) }, pret());
    expect(await rattacherGuide({ mot: "facture" }, b.d)).toMatchObject({ ok: false });
    expect((b.mem.m.get(cleFabrique) as { rattacheLe?: string }).rattacheLe).toBeUndefined();
  });
  it("sans chemin de PDF donné par le site : refus", async () => {
    const { d } = deps({}, pret({ cheminPdf: null }));
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ raison: "pas_de_pdf" });
  });
});

describe("rédiger et lire", () => {
  it("rédiger appelle la rédaction G2 une fois ; ses refus deviennent des phrases", async () => {
    const { d } = deps();
    expect(await redigerGuide("facture", d)).toMatchObject({ ok: true, version: 1 });
    expect(d.rediger).toHaveBeenCalledTimes(1);
    const refuse = deps({ rediger: vi.fn(async () => ({ ok: false as const, raison: "interrupteur_eteint" as const })) });
    expect(await redigerGuide("facture", refuse.d)).toMatchObject({ ok: false, raison: "redaction" });
  });
  it("lit l'état : dernière version, PDF, rattachement", async () => {
    const { d } = deps({}, { [cleRedaction]: { versions: [versionA("À valider")] } });
    const r = await lireGuideDuMot("facture", d);
    expect(r).toMatchObject({ ok: true, vue: { nbVersions: 1, fabrique: null, derniere: { version: 1, statut: "À valider" } } });
  });
  it("mot invalide refusé", async () => {
    const { d } = deps();
    expect(await lireGuideDuMot("   ", d)).toMatchObject({ raison: "mot_invalide" });
  });
});
