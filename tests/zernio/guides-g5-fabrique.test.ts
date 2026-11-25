/**
 * G5 : fabrication d'un guide depuis le Studio. Sans base ni réseau : faux fetch, fausses dépendances, valeurs fictives.
 */
import { describe, expect, it, vi } from "vitest";
import { CHEMIN_GUIDES_CONTENU, cheminPdfDuGuide, codeGuideDuMot, corpsContenuGuide, guidesFabriqueActif, lireReponseSite } from "@/domaine/guides-pdf/guide-fabrique";
import { empreinteGuide, type ContenuGuide } from "@/domaine/guides-pdf/guide-contenu";
import { envoyerContenuGuide, type ResultatEnvoiContenu } from "@/services/guides-fabrique-site";
import { signatureValide } from "@/fournisseurs/site/signature";
import { DELAI_FABRICATION_MS } from "@/services/guides-fabrique-site";
import { fabriquerPdf, lireGuideDuMot, rattacherGuide, redigerGuide, validerGuide, type DepsFabrique } from "@/services/guides-fabrique";
import type { LiaisonMot } from "@/domaine/guide-reseau/cibles-contrat";
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
    envoyer: vi.fn(async () => ({ issue: "fabrique" as const, pages: 4, deja: false })),
    creerElement: vi.fn(async (o) => ({ ok: true as const, code: o.code })),
    lireLiaisons: vi.fn(async () => [] as LiaisonMot[]),
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
    for (const r of [await lireGuideDuMot("facture", d), await redigerGuide("facture", "studio", d), await validerGuide({ mot: "facture", version: 1, contenu: CONTENU, toutLu: true }, d), await fabriquerPdf({ mot: "facture" }, d), await rattacherGuide({ mot: "facture" }, d)]) {
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
  it("201 ET 200 {ok:true} = fabriqué ; chaque 409, le 503, le 404 ont leur phrase ; aucun chemin n'est lu du site", () => {
    expect(lireReponseSite(201, { ok: true, deja: false, pages: 3, cheminPdf: "/x.pdf" })).toEqual({ issue: "fabrique", pages: 3, deja: false });
    expect(lireReponseSite(200, { ok: true, deja: true, pages: 3, tailleOctets: 10, sha256Pdf: "a" })).toEqual({ issue: "fabrique", pages: 3, deja: true });
    expect(lireReponseSite(201, null)).toMatchObject({ issue: "fabrique", pages: null });
    expect(lireReponseSite(200, { ok: false }).issue).toBe("echec");
    expect(lireReponseSite(200, null).issue).toBe("echec");
    expect(lireReponseSite(409, { erreur: "version_perimee" }).issue).toBe("version_perimee");
    expect(lireReponseSite(409, { erreur: "version_existante" }).issue).toBe("version_existante");
    expect(lireReponseSite(409, { erreur: "en_cours" }).issue).toBe("site_en_cours");
    expect(lireReponseSite(409, null).issue).toBe("deja_ou_perime");
    const phrases = ["version_perimee", "version_existante", "en_cours"].map((e) => (lireReponseSite(409, { erreur: e }) as { phrase: string }).phrase);
    expect(new Set(phrases).size).toBe(3);
    expect(lireReponseSite(422, null).issue).toBe("refus_contenu");
    expect(lireReponseSite(429, null).issue).toBe("rendu_en_cours");
    expect(lireReponseSite(503, null).issue).toBe("indisponible");
    expect((lireReponseSite(503, null) as { phrase: string }).phrase).not.toBe((lireReponseSite(500, null) as { phrase: string }).phrase);
    expect(lireReponseSite(404, null).issue).toBe("site_absent");
    expect(lireReponseSite(500, null).issue).toBe("echec");
  });
  it("chemin dérivé : guides-reseau/<code>/v<version>.pdf, sans slash initial", () => {
    expect(cheminPdfDuGuide("gde-abc123def456", 2)).toBe("guides-reseau/gde-abc123def456/v2.pdf");
    expect(cheminPdfDuGuide("gde-abc123def456", 2)).toMatch(/^[A-Za-z0-9][A-Za-z0-9._/-]*\.pdf$/);
    expect(cheminPdfDuGuide("../x", 1)).toBeNull();
    expect(cheminPdfDuGuide("gde-abc123def456", 0)).toBeNull();
  });
  it("le délai du Studio est de 90 s", () => {
    expect(DELAI_FABRICATION_MS).toBe(90_000);
  });
});

describe("client signé (faux fetch)", () => {
  const corps = corpsContenuGuide("gde-abc123def456", 1, CONTENU);
  it("poste sur la bonne route avec une signature valide", async () => {
    const f = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => (void _u, void _i, new Response(JSON.stringify({ ok: true, deja: false, pages: 2 }), { status: 201 })));
    const r = await envoyerContenuGuide({ corps, env: ENV, fetch: f as unknown as typeof fetch, maintenantMs: 1_800_000_000_000 });
    expect(r).toMatchObject({ issue: "fabrique", pages: 2 });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe(`https://site.exemple${CHEMIN_GUIDES_CONTENU}`);
    expect(init?.method).toBe("POST");
    const h = init?.headers as Record<string, string>;
    expect(signatureValide(SECRET, { methode: "POST", chemin: CHEMIN_GUIDES_CONTENU, corps: String(init?.body), horodatage: h["x-axion-horodatage"], nonce: h["x-axion-nonce"], signature: h["x-axion-signature"] })).toBe(true);
    expect(JSON.parse(String(init?.body))).toEqual(corps);
  });
  it.each([[404, "site_absent"], [503, "indisponible"], [409, "deja_ou_perime"], [422, "refus_contenu"], [429, "rendu_en_cours"]])("statut %i → %s", async (statut, issue) => {
    const f = vi.fn(async () => new Response("", { status: statut }));
    expect(await envoyerContenuGuide({ corps, env: ENV, fetch: f as unknown as typeof fetch })).toMatchObject({ issue });
  });
  it("200 {ok:true,deja:true} (renvoi identique) = fabriqué", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, deja: true, pages: 2, tailleOctets: 9, sha256Pdf: "a".repeat(64) }), { status: 200 }));
    expect(await envoyerContenuGuide({ corps, env: ENV, fetch: f as unknown as typeof fetch })).toMatchObject({ issue: "fabrique", pages: 2, deja: true });
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
    expect(r).toMatchObject({ ok: true, cheminPdf: `guides-reseau/${codeGuideDuMot(idMot)}/v1.pdf`, pages: 4 });
    expect(mem.m.get(cleFabrique)).toMatchObject({ cheminPdf: `guides-reseau/${codeGuideDuMot(idMot)}/v1.pdf` });
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
  it("écriture du statut en échec après un 201, puis reprise réussie grâce au 200 deja", async () => {
    const mem = memoire(valide());
    let panne = true;
    const ecrire = async (id: string, v: unknown) => { if (panne && id === cleFabrique) throw new Error("base"); await mem.ecrire(id, v); };
    const premier = deps({ ecrireParametre: ecrire, lireParametre: mem.lire, envoyer: vi.fn(async () => ({ issue: "fabrique" as const, pages: 4, deja: false })) });
    expect(await fabriquerPdf({ mot: "facture" }, premier.d)).toMatchObject({ ok: false, raison: "indisponible" });
    expect(mem.m.has(cleFabrique)).toBe(false);
    panne = false;
    const reprise = deps({ ecrireParametre: ecrire, lireParametre: mem.lire, envoyer: vi.fn(async () => ({ issue: "fabrique" as const, pages: 4, deja: true })) });
    expect(await fabriquerPdf({ mot: "facture" }, reprise.d)).toMatchObject({ ok: true, pages: 4 });
    expect(mem.m.get(cleFabrique)).toMatchObject({ version: 1 });
  });
  it("texte abîmé dans l'enregistrement (empreinte différente) : refus, rien envoyé", async () => {
    const abime = { ...versionA("Validé"), empreinte: "0".repeat(64) };
    const { d } = deps({}, { [cleRedaction]: { versions: [abime] } });
    expect(await fabriquerPdf({ mot: "facture" }, d)).toMatchObject({ raison: "texte_modifie" });
    expect(d.envoyer).not.toHaveBeenCalled();
  });
  it("un seul geste à la fois par mot", async () => {
    let debloquer: (v: { issue: "fabrique"; pages: null; deja: boolean }) => void = () => {};
    const { d } = deps({ envoyer: () => new Promise<ResultatEnvoiContenu>((res) => { debloquer = res as typeof debloquer; }) }, valide());
    const premier = fabriquerPdf({ mot: "facture" }, d);
    await new Promise((r) => setTimeout(r, 0));
    expect(await fabriquerPdf({ mot: "facture" }, d)).toMatchObject({ raison: "en_cours" });
    debloquer({ issue: "fabrique", pages: null, deja: false });
    expect(await premier).toMatchObject({ ok: true });
  });
});

describe("rattacher au mot", () => {
  const pret = (extra: object = {}) => ({ [cleRedaction]: { versions: [versionA("Validé")] }, [cleFabrique]: { version: 1, sha256Texte: empreinteGuide(CONTENU), code: codeGuideDuMot(idMot), cheminPdf: `guides-reseau/${codeGuideDuMot(idMot)}/v1.pdf`, pages: 2, fabriqueLe: "t", ...extra } });
  it("refuse tant que le PDF n'est pas fabriqué", async () => {
    const { d } = deps({}, { [cleRedaction]: { versions: [versionA("Validé")] } });
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ raison: "pas_fabrique" });
  });
  it("crée l'élément du catalogue puis la liaison INACTIVE ; rien d'autre", async () => {
    const { d, mem } = deps({}, pret());
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ ok: true });
    expect(d.creerElement).toHaveBeenCalledWith({ titre: CONTENU.titre, cheminPdf: `guides-reseau/${codeGuideDuMot(idMot)}/v1.pdf`, code: codeGuideDuMot(idMot) });
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
  it("le chemin est dérivé du code et de la version, même si l'état n'en porte pas", async () => {
    const { d } = deps({}, pret({ cheminPdf: null }));
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ ok: true });
    expect(d.creerElement).toHaveBeenCalledWith(expect.objectContaining({ cheminPdf: `guides-reseau/${codeGuideDuMot(idMot)}/v1.pdf` }));
  });
  it("B1 : liaison existante ET active pour ce mot : refus, rien n'est écrit", async () => {
    const active: LiaisonMot = { mot: "facture", reseau: "tous", codeCible: "gde-autre0000000", actif: true };
    const { d, mem } = deps({ lireLiaisons: vi.fn(async () => [active]) }, pret());
    const r = await rattacherGuide({ mot: "Facture" }, d);
    expect(r).toMatchObject({ ok: false, raison: "mot_deja_en_service", phrase: expect.stringContaining("Ce mot envoie déjà un guide en service") });
    expect(d.creerElement).not.toHaveBeenCalled();
    expect(d.lierInactif).not.toHaveBeenCalled();
    expect((mem.m.get(cleFabrique) as { rattacheLe?: string }).rattacheLe).toBeUndefined();
  });
  it("B1 : liaison existante inactive, ou d'un autre mot ou réseau : le rattachement se fait", async () => {
    const autres: LiaisonMot[] = [
      { mot: "facture", reseau: "tous", codeCible: "gde-autre0000000", actif: false },
      { mot: "devis", reseau: "tous", codeCible: "gde-autre0000000", actif: true },
      { mot: "facture", reseau: "linkedin", codeCible: "gde-autre0000000", actif: true },
    ];
    const { d } = deps({ lireLiaisons: vi.fn(async () => autres) }, pret());
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ ok: true });
  });
  it("B1 : liaisons illisibles : refus, rien n'est écrit", async () => {
    for (const lire of [vi.fn(async () => null), vi.fn(async () => { throw new Error("x"); })]) {
      const { d } = deps({ lireLiaisons: lire }, pret());
      expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ ok: false, raison: "liaisons_illisibles" });
      expect(d.creerElement).not.toHaveBeenCalled();
      expect(d.lierInactif).not.toHaveBeenCalled();
    }
  });
  it("l'empreinte de l'état fabriqué doit être celle de la version validée", async () => {
    const { d } = deps({}, pret({ sha256Texte: "0".repeat(64) }));
    expect(await rattacherGuide({ mot: "facture" }, d)).toMatchObject({ ok: false, raison: "pas_fabrique" });
    expect(d.creerElement).not.toHaveBeenCalled();
  });
  it("la fiche est active côté site (il refuse de lier à une fiche inactive) : le message l'explicite", async () => {
    const { d } = deps({}, pret());
    const r = await rattacherGuide({ mot: "facture" }, d);
    expect(r).toMatchObject({ ok: true, phrase: expect.stringContaining("fiche du catalogue est créée active") });
    expect(d.creerElement).toHaveBeenCalledWith(expect.not.objectContaining({ actif: expect.anything() }));
  });
})

describe("rédiger et lire", () => {
  it("rédiger appelle la rédaction G2 une fois ; ses refus deviennent des phrases", async () => {
    const { d } = deps();
    expect(await redigerGuide("facture", "studio", d)).toMatchObject({ ok: true, version: 1 });
    expect(d.rediger).toHaveBeenCalledTimes(1);
    const refuse = deps({ rediger: vi.fn(async () => ({ ok: false as const, raison: "interrupteur_eteint" as const })) });
    expect(await redigerGuide("facture", "studio", refuse.d)).toMatchObject({ ok: false, raison: "redaction" });
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
