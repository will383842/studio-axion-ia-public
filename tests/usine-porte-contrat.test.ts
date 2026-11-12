/**
 * Contrat croisé de la porte (v1 actuelle) : le Studio lit le jeu de fixtures de l'usine (copie fictive, empreinte sha256)
 * et vérifie que son client dit et lit exactement les mêmes champs. Toute divergence de champ fait échouer ce test.
 * Aucun réseau : `fetch` est une doublure.
 * Empreinte : sha256 de la concaténation, pour chaque fichier .json trié par nom, de « nom, saut de ligne, contenu, saut de
 * ligne ». Même algorithme des deux côtés ; la valeur attendue est inscrite ci-dessous : changer le jeu oblige à la changer ici.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const porte = await import("@/services/usine-porte");
const { lireIdeesUsine, lireMetiersUsine } = await import("@/domaine/usine");
import type { OrigineUsine } from "@/domaine/usine";

/** Empreinte du jeu de la porte publié par l'usine (RC-09). À mettre à jour ICI à chaque nouveau jeu. */
const EMPREINTE_ATTENDUE = "cf947b9ae1e743f95f151544ae5d9172d5aa15a516f07b6d22ca133200107890";
const DOSSIER = new URL("./fixtures/usine-porte/", import.meta.url);
const lire = <T>(nom: string): T => JSON.parse(readFileSync(new URL(nom, DOSSIER), "utf8")) as T;

interface Cas { nom: string; corps: Record<string, unknown> }
const sujets = lire<{ valides: Cas[]; reponse: { demandees: number; lignes: Record<string, unknown>[] } }>("porte-v1-sujets.json");
const retenir = lire<{ valides: Cas[]; invalides: Cas[]; rejeu: { requete: Record<string, unknown>; premiere: { statut: number; corps: unknown }; seconde: { statut: number; corps: unknown } } }>("porte-v1-retenir.json");
const metiers = lire<{ reponse: Record<string, unknown>[] }>("porte-v1-metiers.json");
const erreurs = lire<{ erreurs: { nom: string; statut: number; code?: string }[] }>("porte-v1-erreurs.json").erreurs;
const secrets = lire<{ courant: string; perime: string; court: string }>("porte-v1-secret.json");

const ENV = { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: secrets.courant };
const F = (f: unknown) => f as unknown as typeof fetch;
const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
const cles = (o: object) => Object.keys(o).sort();
const corpsEnvoye = (f: ReturnType<typeof vi.fn>) => JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Record<string, unknown>;

describe("fixtures de la porte · empreinte", () => {
  it("l'empreinte sha256 du jeu copié est celle de l'usine (nom + contenu, fichiers triés)", () => {
    const h = createHash("sha256");
    for (const nom of readdirSync(DOSSIER).filter((n) => n.endsWith(".json")).sort()) h.update(nom + "\n" + readFileSync(new URL(nom, DOSSIER), "utf8") + "\n");
    const calculee = h.digest("hex");
    expect(calculee).toBe(readFileSync(new URL("EMPREINTE.sha256", DOSSIER), "utf8").trim());
    expect(calculee, "le jeu n'est plus celui publié par l'usine : recopier le nouveau jeu ET son empreinte").toBe(EMPREINTE_ATTENDUE);
  });

  it("le jeu ne contient aucune adresse hors @exemple.fr ni aucune clé réelle", () => {
    const tout = readdirSync(DOSSIER).map((n) => readFileSync(new URL(n, DOSSIER), "utf8")).join("\n");
    expect(tout).not.toMatch(/@(?!exemple\.fr)[\w-]+\.\w+/);
    expect(secrets.courant).toMatch(/fictif/);
  });
});

describe("contrat croisé · demande de sujets", () => {
  it("la demande du Studio ne porte que des champs que l'usine accepte (champs de la fixture complète)", async () => {
    const f = vi.fn(async () => reponse(200, { demandees: 0, pourquoi: [], lignes: [] }));
    await porte.proposerIdeesUsine({ type: "video", reseaux: ["instagram"], metiers: ["compta.metier-fictif"], tailles: ["TPE"] }, { env: ENV, fetchImpl: F(f) });
    const corps = corpsEnvoye(f);
    const complete = sujets.valides.find((c) => c.nom === "complete")!.corps;
    for (const k of Object.keys(corps)) expect(Object.keys(complete), `champ « ${k} » inconnu de l'usine`).toContain(k);
    expect(cles(corps)).toEqual(["metiers", "n", "reseaux", "tailles", "type_contenu"]);
    expect(corps.n).toBeGreaterThanOrEqual(1);
    expect(corps.n).toBeLessThanOrEqual(20);
  });

  it("le Studio lit la réponse de la fixture : une idée par ligne, signature et parts intactes", () => {
    const idees = lireIdeesUsine(sujets.reponse);
    expect(idees).toHaveLength(sujets.reponse.lignes.length);
    sujets.reponse.lignes.forEach((l, i) => {
      expect(idees[i].signature).toBe(l.signature);
      expect(idees[i].parts).toEqual(l.parts);
    });
    expect(idees[0].douleur).toContain("relances");
  });

  it("le Studio lit TOUS les champs de la première ligne de la fixture (valeur attendue complète)", () => {
    expect(lireIdeesUsine(sujets.reponse)[0]).toEqual({
      signature: "compta.cabinet-fictif|TPE|formation|d-retards|cas-fictif-01||video-court|scène vécue",
      parts: { metier: "compta.cabinet-fictif", taille: "TPE", service: "formation", douleur: "d-retards", cas_usage: "cas-fictif-01", actualite: null, format: "video-court", structure: "scène vécue" },
      metier: "Cabinet comptable (fictif)",
      taille: "Petite structure",
      service: "Formation",
      douleur: "Les relances partent trop tard.",
      casUsage: "Relances triées · Le tri se fait seul.",
      sujet: undefined,
      format: "Vidéo courte",
      famille: "scène vécue",
      fin: "Dites-le en commentaire.",
    });
  });

  it("chaque champ que le Studio lit existe dans chaque ligne de la fixture (un renommage fait échouer)", () => {
    for (const l of sujets.reponse.lignes as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(typeof l.metier?.libelle, "metier.libelle").toBe("string");
      expect(typeof l.taille?.libelle, "taille.libelle").toBe("string");
      expect(typeof l.service?.libelle, "service.libelle").toBe("string");
      expect(typeof l.format?.libelle, "format.libelle").toBe("string");
      expect(typeof l.accroche?.famille, "accroche.famille").toBe("string");
      expect(typeof l.douleur?.dite, "douleur.dite").toBe("string");
      expect(typeof l.cas_usage?.ce_que_ca_change, "cas_usage.ce_que_ca_change").toBe("string");
      for (const [reseau, fin] of Object.entries((l.fins ?? {}) as Record<string, { dit?: unknown }>)) expect(typeof fin?.dit, `fins.${reseau}.dit`).toBe("string");
    }
  });

  it("le Studio envoie le secret en Bearer exact, sur la bonne route", async () => {
    const f = vi.fn(async () => reponse(200, sujets.reponse));
    await porte.proposerIdeesUsine({ type: "video", reseaux: ["instagram"], metiers: [], tailles: [] }, { env: ENV, fetchImpl: F(f) });
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("https://usine.test/api/porte/sujets");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${secrets.courant}`);
  });
});

describe("contrat croisé · métiers", () => {
  it("le Studio lit la fixture (enveloppe { metiers }) et garde les champs du contrat", () => {
    for (const m of metiers.reponse) expect(cles(m)).toEqual(["allume", "cas_sources", "code", "libelle", "secteur"]);
    const lus = lireMetiersUsine({ metiers: metiers.reponse });
    expect(lus).toHaveLength(metiers.reponse.length);
    expect(lus[0]).toMatchObject({ code: "compta.cabinet-fictif", allume: true, nbCas: 3, secteur: "Services" });
    expect(lus[1]).toMatchObject({ code: "compta.metier-fictif", allume: false, nbCas: 0 });
  });
});

describe("contrat croisé · retenir et rejeu", () => {
  const origine = (corps: Record<string, unknown>): OrigineUsine => ({ signature: corps.signature as string, parts: corps.parts as OrigineUsine["parts"], typeContenu: corps.type_contenu as OrigineUsine["typeContenu"] });

  it("le corps de retenir a exactement les champs de la fixture valide", async () => {
    const valide = retenir.valides[0].corps;
    const f = vi.fn(async () => reponse(200, retenir.rejeu.premiere.corps));
    expect(await porte.retenirSujetUsine(origine(valide), valide.reference_studio as string, { env: ENV, fetchImpl: F(f) })).toBe(true);
    expect(corpsEnvoye(f)).toEqual(valide);
  });

  it("rejeu : la même demande, deux fois, reste un succès (deja: true la seconde fois)", async () => {
    const { requete, premiere, seconde } = retenir.rejeu;
    const f = vi.fn().mockResolvedValueOnce(reponse(premiere.statut, premiere.corps)).mockResolvedValueOnce(reponse(seconde.statut, seconde.corps));
    const o = { env: ENV, fetchImpl: F(f) };
    expect(await porte.retenirSujetUsine(origine(requete), requete.reference_studio as string, o)).toBe(true);
    expect(await porte.retenirSujetUsine(origine(requete), requete.reference_studio as string, o)).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("contrat croisé · erreurs et retenues échouées", () => {
  beforeEach(() => porte.reinitialiserRetenuesEchouees());

  it("chaque erreur de la fixture devient une erreur du Studio au code attendu", async () => {
    for (const e of erreurs) {
      const corps = e.code ? { erreur: "Phrase de l'usine.", code: e.code } : {};
      const x = await porte.listerMetiersUsine({ env: ENV, fetchImpl: F(vi.fn(async () => reponse(e.statut, corps))) }).catch((z: { code?: string }) => z);
      const attendu = e.statut === 401 ? "USINE_REFUS" : e.statut === 404 ? "USINE_PORTE_ETEINTE" : e.statut === 413 ? "USINE_TROP_GROS" : e.statut === 415 ? "USINE_FORMAT" : `USINE_${e.code!.toUpperCase()}`;
      expect((x as { code?: string }).code, e.nom).toBe(attendu);
    }
  });

  it("le secret court ou absent éteint la porte : aucun appel", async () => {
    const f = vi.fn();
    expect(porte.usineActive({ USINE_URL: "https://usine.test", USINE_PORTE_SECRET: secrets.court })).toBe(false);
    expect(porte.usineActive({ USINE_URL: "https://usine.test" })).toBe(false);
    await expect(porte.listerMetiersUsine({ env: { USINE_URL: "https://usine.test", USINE_PORTE_SECRET: secrets.court }, fetchImpl: F(f) })).rejects.toMatchObject({ code: "USINE_ETEINTE" });
    await expect(porte.listerMetiersUsine({ env: { USINE_URL: "https://usine.test" }, fetchImpl: F(f) })).rejects.toMatchObject({ code: "USINE_ETEINTE" });
    expect(f).not.toHaveBeenCalled();
  });

  it("chaque retenue échouée est comptée ; une réussie ne l'est pas", async () => {
    const valide = retenir.valides[0].corps;
    const o = (statut: number) => ({ env: ENV, fetchImpl: F(vi.fn(async () => reponse(statut, {}))) });
    const o1 = { signature: valide.signature as string, parts: valide.parts as OrigineUsine["parts"], typeContenu: "video" as const };
    expect(porte.compterRetenuesEchouees()).toBe(0);
    for (const e of erreurs.filter((x) => x.statut !== 404)) expect(await porte.retenirSujetUsine(o1, "0042-AV-TT", o(e.statut))).toBe(false);
    expect(porte.compterRetenuesEchouees()).toBe(erreurs.filter((x) => x.statut !== 404).length);
    await porte.retenirSujetUsine(o1, "0042-AV-TT", o(200));
    expect(porte.compterRetenuesEchouees()).toBe(erreurs.filter((x) => x.statut !== 404).length);
  });
});
