import { describe, expect, it } from "vitest";
import { comparerVersions, courteEmpreinte, lireVersionsSite, type VersionSite, type VersionStudio } from "@/domaine/guides-pdf/reconciliation";

const h = (c: string) => c.repeat(64);
const st = (code: string, version: number, e = h("a")): VersionStudio => ({ code, version, empreinte: e });
const si = (code: string, version: number, o: Partial<VersionSite> = {}): VersionSite => ({ code, version, sha256Texte: h("a"), statut: "pret", sha256Pdf: h("b"), tailleOctets: 1234, ...o });
const A = "gde-aaaaaaaa";
const B = "gde-bbbbbbbb";

describe("G6 · comparerVersions", () => {
  it("rien à signaler quand tout concorde (et « en_cours » n'est pas un écart)", () => {
    expect(comparerVersions([st(A, 1), st(A, 2)], [si(A, 1), si(A, 2, { statut: "en_cours", tailleOctets: 0, sha256Pdf: null })])).toEqual([]);
  });
  it("manquant_au_site : le guide n'existe pas du tout au site, ou une version manque au milieu", () => {
    expect(comparerVersions([st(A, 1)], [])).toEqual([{ type: "manquant_au_site", code: A, version: 1, empreinteStudio: "aaaaaaaaaaaa" }]);
    const e = comparerVersions([st(A, 1), st(A, 2), st(A, 3)], [si(A, 1), si(A, 3)]);
    expect(e.map((x) => [x.type, x.version])).toEqual([["manquant_au_site", 2]]);
  });
  it("version_en_retard : le site s'arrête avant la dernière version du Studio", () => {
    const e = comparerVersions([st(A, 1), st(A, 2), st(A, 3)], [si(A, 1)]);
    expect(e.map((x) => [x.type, x.version])).toEqual([["version_en_retard", 2], ["version_en_retard", 3]]);
  });
  it("manquant_au_studio : le site a une version que le Studio ne connaît pas", () => {
    expect(comparerVersions([], [si(A, 4, { sha256Texte: h("c") })])).toEqual([{ type: "manquant_au_studio", code: A, version: 4, empreinteSite: "cccccccccccc" }]);
  });
  it("empreinte_differente : les deux empreintes courtes sont rendues, majuscules ignorées", () => {
    expect(comparerVersions([st(A, 1, h("a"))], [si(A, 1, { sha256Texte: h("d") })])).toEqual([{ type: "empreinte_differente", code: A, version: 1, empreinteStudio: "aaaaaaaaaaaa", empreinteSite: "dddddddddddd" }]);
    expect(comparerVersions([st(A, 1, h("a"))], [si(A, 1, { sha256Texte: h("A") })])).toEqual([]);
  });
  it("echec_au_site", () => {
    expect(comparerVersions([st(A, 1)], [si(A, 1, { statut: "echec", sha256Pdf: null, tailleOctets: 0 })])).toEqual([{ type: "echec_au_site", code: A, version: 1 }]);
  });
  it("pdf_incoherent : prêt mais taille 0 (ou illisible) ; pas d'écart pour un échec ni un « en_cours »", () => {
    expect(comparerVersions([st(A, 1)], [si(A, 1, { tailleOctets: 0 })])).toEqual([{ type: "pdf_incoherent", code: A, version: 1 }]);
    expect(comparerVersions([st(A, 1)], [si(A, 1, { tailleOctets: -5 })]).map((x) => x.type)).toEqual(["pdf_incoherent"]);
    expect(comparerVersions([st(A, 1)], [si(A, 1, { tailleOctets: Number.NaN })]).map((x) => x.type)).toEqual(["pdf_incoherent"]);
  });
  it("plusieurs écarts sur la même version sortent dans l'ordre fixe", () => {
    const e = comparerVersions([st(A, 1)], [si(A, 1, { sha256Texte: h("d"), tailleOctets: 0 })]);
    expect(e.map((x) => x.type)).toEqual(["empreinte_differente", "pdf_incoherent"]);
  });
  it("tri stable : code, puis version, quel que soit l'ordre d'entrée ; même résultat si l'entrée est mélangée", () => {
    const studio = [st(B, 2), st(A, 3), st(B, 1), st(A, 1)];
    const e1 = comparerVersions(studio, []);
    const e2 = comparerVersions([...studio].reverse(), []);
    expect(e1.map((x) => `${x.code}#${x.version}`)).toEqual([`${A}#1`, `${A}#3`, `${B}#1`, `${B}#2`]);
    expect(e2).toEqual(e1);
  });
  it("doublons : la première ligne fait foi, un écart n'est pas compté deux fois", () => {
    expect(comparerVersions([st(A, 1), st(A, 1)], [])).toHaveLength(1);
  });
  it("ne modifie pas ses entrées", () => {
    const studio = [st(A, 1)];
    const site = [si(A, 2)];
    const copie = JSON.stringify([studio, site]);
    comparerVersions(studio, site);
    expect(JSON.stringify([studio, site])).toBe(copie);
  });
  it("AUCUNE fuite de texte : un code, une empreinte ou un statut piégés ne ressortent pas", () => {
    const texte = "Vous réussirez votre guide secret";
    const e = comparerVersions(
      [st(texte, 1, texte), st(A, 2, texte)],
      [{ ...si(texte, 3, { sha256Texte: texte }), statut: "echec" }, si(A, 2, { sha256Texte: texte, tailleOctets: 0 })],
    );
    const sortie = JSON.stringify(e);
    expect(sortie).not.toContain("secret");
    expect(sortie).not.toContain("réussirez");
    for (const x of e) {
      for (const cle of Object.keys(x)) expect(["type", "code", "version", "empreinteStudio", "empreinteSite"]).toContain(cle);
      if (x.empreinteStudio) expect(x.empreinteStudio).toMatch(/^([0-9a-f]{12}|\?)$/);
      if (x.empreinteSite) expect(x.empreinteSite).toMatch(/^([0-9a-f]{12}|\?)$/);
      expect(x.code).toMatch(/^(gde-[a-z0-9-]{6,24}|\?)$/);
    }
  });
  it("courteEmpreinte : 12 premiers caractères, sinon « ? »", () => {
    expect(courteEmpreinte("0123456789abcdef0123")).toBe("0123456789ab");
    for (const v of ["", "abc", "zzzzzzzzzzzzzz", 12, null, undefined]) expect(courteEmpreinte(v)).toBe("?");
  });
});

describe("G6 · lireVersionsSite", () => {
  it("garde les lignes valides, compte les autres, refuse ce qui n'est pas une liste", () => {
    expect(lireVersionsSite({})).toBeNull();
    expect(lireVersionsSite(null)).toBeNull();
    const r = lireVersionsSite([si(A, 1), { code: A }, "x", null, { ...si(A, 2), statut: "autre" }, { ...si("pas un code", 3) }, { ...si(A, 4), tailleOctets: "1" }]);
    expect(r?.versions).toHaveLength(1);
    expect(r?.ignorees).toBe(6);
  });
  it("sha256Pdf absent devient null", () => {
    const sans: Partial<VersionSite> = si(A, 1);
    delete sans.sha256Pdf;
    expect(lireVersionsSite([sans])?.versions[0].sha256Pdf).toBeNull();
  });

  it("pdf_incoherent : prêt mais sha256Pdf null, absent ou non hexadécimal de 64 signes", () => {
    for (const mauvais of [null, "", "b".repeat(63), "b".repeat(65), "z".repeat(64), `${"b".repeat(63)} `, 12 as unknown as string]) {
      expect(comparerVersions([st(A, 1)], [si(A, 1, { sha256Pdf: mauvais })]), String(mauvais)).toEqual([{ type: "pdf_incoherent", code: A, version: 1 }]);
    }
  });
  it("pdf_incoherent : un sha256Pdf valide (64 hexadécimaux, majuscules admises) ne déclenche rien ; « en_cours » sans PDF non plus", () => {
    expect(comparerVersions([st(A, 1)], [si(A, 1, { sha256Pdf: "AbCdEf0123456789".repeat(4) })])).toEqual([]);
    expect(comparerVersions([st(A, 1)], [si(A, 1, { statut: "en_cours", sha256Pdf: null, tailleOctets: 0 })])).toEqual([]);
  });
});
