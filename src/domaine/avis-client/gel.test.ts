import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { figerAvisPourLaCommande, avisRetires, type AvisClientFige } from "./gel";
import { marquerAvisDuSite } from "./provenance";
import { empreinteAvis } from "./texte";
import type { AvisClient } from "./types";

function avis(o: Partial<AvisClient> = {}): AvisClient {
  return {
    id: "a1", auteur: "Marie", date: "2026-05-01", source: "google", note: 4,
    texte: "Très bien.", statut: "published",
    accordAuteur: { ecrit: true, date: "2026-05-02", forme: "courriel" },
    valideLe: "2026-05-03", ...o,
  };
}
const site = (o: Partial<AvisClient> = {}) => marquerAvisDuSite(avis(o));
const MAINTENANT = "2026-11-15T10:00:00.000Z";

describe("figerAvisPourLaCommande", () => {
  it("fige un avis du site, publié, avec accord, avec empreinte", () => {
    const a = site();
    const f = figerAvisPourLaCommande([a], "a1", MAINTENANT);
    expect(f.id).toBe("a1");
    expect(f.avis).toEqual(avis());
    expect(f.valideLe).toBe("2026-05-03");
    expect(f.figeLe).toBe(MAINTENANT);
    expect(f.empreinte).toBe(empreinteAvis(a));
  });
  it("la copie figée est indépendante de l'avis d'origine", () => {
    const a = site();
    const f = figerAvisPourLaCommande([a], "a1", MAINTENANT);
    a.texte = "modifié";
    a.accordAuteur.forme = "autre";
    expect(f.avis.texte).toBe("Très bien.");
    expect(f.avis.accordAuteur.forme).toBe("courriel");
  });
  it("N-12 : un avis écrit à la main, « published » avec accord, est refusé", () => {
    expect(() => figerAvisPourLaCommande([avis()], "a1", MAINTENANT)).toThrow(/lecteur du site/);
    expect(() => figerAvisPourLaCommande([{ ...site() }], "a1", MAINTENANT)).toThrow(/lecteur du site/);
  });
  it("refuse l'exemple", () => {
    expect(() => figerAvisPourLaCommande([site({ exemple: true })], "a1", MAINTENANT)).toThrow(/exemple/);
  });
  it("refuse un avis non publié", () => {
    expect(() => figerAvisPourLaCommande([site({ statut: "hidden" })], "a1", MAINTENANT)).toThrow(/published/);
  });
  it("refuse un avis sans accord écrit (garde avisAffichables)", () => {
    const sans = { ecrit: false, date: "2026-05-02", forme: "oral" };
    expect(() => figerAvisPourLaCommande([site({ accordAuteur: sans })], "a1", MAINTENANT)).toThrow(/accord/);
  });
  it("refuse un id absent", () => {
    expect(() => figerAvisPourLaCommande([site()], "zzz", MAINTENANT)).toThrow(/zzz/);
    expect(() => figerAvisPourLaCommande([], "a1", MAINTENANT)).toThrow(/a1/);
  });
  it("type distinct : non assignable depuis un objet d'exemple", () => {
    const f = figerAvisPourLaCommande([site()], "a1", MAINTENANT);
    const ok: AvisClientFige = f;
    expect(ok).toBe(f);
    // @ts-expect-error un littéral n'est pas un avis figé (marque de type)
    const faux: AvisClientFige = { avis: avis(), id: "a1", valideLe: "x", figeLe: "y", empreinte: "z" };
    expect(faux.id).toBe("a1");
  });
});

describe("avisRetires", () => {
  const videos = [
    { videoId: "v1", avisId: "a1" },
    { videoId: "v2", avisId: "a2" },
    { videoId: "v3", avisId: "a3" },
  ];
  it("liste la vidéo dont l'avis a disparu, et rien d'autre", () => {
    const publies = [avis({ id: "a1" }), avis({ id: "a3" })];
    expect(avisRetires(videos, publies)).toEqual([{ videoId: "v2", avisId: "a2" }]);
  });
  it("un avis repassé hors « published » compte comme retiré", () => {
    const publies = [avis({ id: "a1" }), avis({ id: "a2", statut: "hidden" }), avis({ id: "a3" })];
    expect(avisRetires(videos, publies)).toEqual([{ videoId: "v2", avisId: "a2" }]);
  });
  it("rien de retiré → liste vide ; pur (entrées intactes)", () => {
    const publies = [avis({ id: "a1" }), avis({ id: "a2" }), avis({ id: "a3" })];
    const copie = JSON.stringify(videos);
    expect(avisRetires(videos, publies)).toEqual([]);
    expect(JSON.stringify(videos)).toBe(copie);
  });
});

describe("aucun exemple d'avis dans la fabrication", () => {
  const racine = join(__dirname, "..", "..");
  function lire(chemin: string): string[] {
    let st;
    try { st = statSync(chemin); } catch { return []; }
    if (st.isFile()) return [readFileSync(chemin, "utf8")];
    return readdirSync(chemin).flatMap((n) => lire(join(chemin, n)));
  }
  it("fabrication.ts, moteurs et plan-scenes n'importent pas d'exemple d'avis", () => {
    const textes = [
      ...lire(join(racine, "services", "fabrication.ts")),
      ...lire(join(racine, "moteurs")),
      ...lire(join(racine, "briques", "plan-scenes")),
    ].join("\n");
    const imports = textes.split("\n").filter((l) => /\b(import|require)\b|\bfrom\s+["']/.test(l));
    const fautifs = imports.filter((l) => /avis/i.test(l) && /(outils|exemple)/i.test(l));
    expect(fautifs).toEqual([]);
  });
});
