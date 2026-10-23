/**
 * M0 · Contrat de la fiche d'écrans `fiche-ecrans/1` : schéma exact, suite des identifiants, empreinte d'un écran.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VERSION_FICHE_ECRANS,
  cadreDeFicheEcrans,
  empreinteEcran,
  texteDuCorps,
  validerSchemaFiche,
  type EcranCorps,
  type FicheEcrans,
} from "@/moteurs/montage-cas-concret/fiche";

/** Fiche minimale de 3 écrans (le nombre d'écrans du corps est une règle, R20, pas le schéma). */
function ficheMinimale(): FicheEcrans {
  return {
    version: VERSION_FICHE_ECRANS,
    formatId: "cas-concret",
    videoId: "video-1",
    versionId: "version-1",
    habillage: "charte-duo/1",
    ratio: "9:16",
    offre: "integration",
    origine: "porte-a",
    posture: "chez-nous",
    casId: "recrutement-apporteurs",
    empreinteCas: "cas-0123456789abcdef-1a",
    ecrans: [
      {
        id: "e01",
        type: "accroche",
        fond: "sombre",
        marque: "axion-ia.com",
        texteDit: "On recrute nos collaborateurs en quinze minutes.",
        avanceMs: 0,
        evenements: [{ cible: "titre-2", surMot: 4, avanceMs: 120 }],
        etiquette: "cas réel",
        lignes: ["On recrute", "en 15 minutes"],
        motOrange: "15",
      },
      {
        id: "e02",
        type: "liste-avant",
        fond: "ivoire",
        marque: "axion-ia.com",
        texteDit: "Avant, il fallait trier, appeler et relancer.",
        avanceMs: 200,
        evenements: [],
        taches: ["Trier", "Appeler", "Relancer"],
      },
      {
        id: "e03",
        type: "titre",
        fond: "sombre",
        marque: "axion-ia.com",
        texteDit: "Aujourd'hui, tout part seul.",
        avanceMs: 0,
        evenements: [],
        lignes: ["Tout part seul"],
      },
    ],
  };
}

const sans = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

describe("M0 · schéma de la fiche d'écrans", () => {
  it("une fiche minimale de 3 écrans passe", () => {
    const r = validerSchemaFiche(ficheMinimale());
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect(r.fiche.ecrans.map((e) => e.id)).toEqual(["e01", "e02", "e03"]);
  });

  it("titre : « orange » donné en un mot seul est lu comme une liste d'un mot (essai blog du 15/10)", () => {
    const f = sans(ficheMinimale()) as unknown as { ecrans: Record<string, unknown>[] };
    f.ecrans[2].orange = "seul";
    const r = validerSchemaFiche(f);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect((r.fiche.ecrans[2] as { orange?: string[] }).orange).toEqual(["seul"]);
    f.ecrans[2].orange = 3;
    expect(validerSchemaFiche(f).ok).toBe(false);
  });

  it("un champ inconnu est refusé (fiche, écran, événement)", () => {
    const f1 = { ...sans(ficheMinimale()), auteur: "x" };
    const f2 = sans(ficheMinimale()) as unknown as { ecrans: Record<string, unknown>[] };
    f2.ecrans[1].couleur = "rouge";
    const f3 = sans(ficheMinimale()) as unknown as { ecrans: { evenements: Record<string, unknown>[] }[] };
    f3.ecrans[0].evenements[0].duree = 3;
    for (const f of [f1, f2, f3]) {
      const r = validerSchemaFiche(f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problemes.some((p) => p.regle === "schéma exact" && /inconnu/.test(p.message))).toBe(true);
    }
  });

  it("un identifiant d'écran hors de la suite e01, e02… est refusé", () => {
    for (const id of ["e04", "s03", "e3", "e02"]) {
      const f = sans(ficheMinimale());
      f.ecrans[2].id = id;
      const r = validerSchemaFiche(f);
      expect(r.ok, id).toBe(false);
      if (!r.ok) expect(r.problemes[0].message).toMatch(/identifiant/);
    }
  });

  it("refuse une version inconnue, un type de fin dans le corps et un objet hors banque", () => {
    expect(validerSchemaFiche({ ...ficheMinimale(), version: "fiche-ecrans/2" }).ok).toBe(false);
    const fin = sans(ficheMinimale()) as unknown as { ecrans: Record<string, unknown>[] };
    fin.ecrans[2] = { id: "e03", type: "lien", fond: "sombre", marque: "axion-ia.com", texteDit: "Le lien est dans mon profil.", avanceMs: 0, evenements: [], fins: ["fin-ig-lien-profil"], titre: "Le lien est dans mon profil", bulle: "Diagnostic gratuit · lien dans le profil" };
    expect(validerSchemaFiche(fin).ok).toBe(false);
    const objet = sans(ficheMinimale()) as unknown as { ecrans: Record<string, unknown>[] };
    objet.ecrans[2] = { id: "e03", type: "objet", fond: "sombre", marque: "axion-ia.com", texteDit: "Un dossier rangé.", avanceMs: 0, evenements: [], titre: "Rangé", visuel: { sorte: "objet", objet: "personnage" } };
    expect(validerSchemaFiche(objet).ok).toBe(false);
  });

  it("refuse une avance hors de 0 à 500 ms, un mot d'événement hors du texte et un mot orange absent", () => {
    const a = sans(ficheMinimale());
    a.ecrans[1].avanceMs = 600;
    expect(validerSchemaFiche(a).ok).toBe(false);
    const b = sans(ficheMinimale());
    b.ecrans[0].evenements[0].surMot = 7;
    expect(validerSchemaFiche(b).ok).toBe(false);
    const c = sans(ficheMinimale());
    (c.ecrans[0] as Extract<EcranCorps, { type: "accroche" }>).motOrange = "vingt";
    expect(validerSchemaFiche(c).ok).toBe(false);
  });

  it("ne corrige rien : la fiche rendue est celle reçue", () => {
    const f = ficheMinimale();
    const r = validerSchemaFiche(f);
    expect(r.ok && r.fiche).toEqual(f);
  });

  it("texteDuCorps met les textes dits bout à bout", () => {
    expect(texteDuCorps(ficheMinimale())).toBe("On recrute nos collaborateurs en quinze minutes. Avant, il fallait trier, appeler et relancer. Aujourd'hui, tout part seul.");
  });
});

describe("M0 · empreinte d'un écran", () => {
  const fiche = ficheMinimale();
  const cadre = cadreDeFicheEcrans(fiche);
  const ecran = fiche.ecrans[0];

  it("ignore l'ordre des clés", () => {
    const inverse = Object.fromEntries(Object.entries(ecran).reverse()) as EcranCorps;
    const cadreInverse = Object.fromEntries(Object.entries(cadre).reverse()) as typeof cadre;
    expect(empreinteEcran(inverse, cadreInverse)).toBe(empreinteEcran(ecran, cadre));
    expect(empreinteEcran(ecran, cadre)).toMatch(/^ecran-[0-9a-f]{16}-[0-9a-z]+$/);
  });

  it("change si avanceMs change (écran ou événement), ou si le cadre change", () => {
    const base = empreinteEcran(ecran, cadre);
    expect(empreinteEcran({ ...ecran, avanceMs: 40 }, cadre)).not.toBe(base);
    expect(empreinteEcran({ ...ecran, evenements: [{ ...ecran.evenements[0], avanceMs: 0 }] }, cadre)).not.toBe(base);
    expect(empreinteEcran(ecran, { ...cadre, habillage: "charte-duo/2" })).not.toBe(base);
  });
});

describe("M0 · sens des imports", () => {
  it("fiche.ts et outils.ts n'importent rien de src/moteurs hors de leur dossier, ni aucun fournisseur", () => {
    for (const nom of ["fiche.ts", "outils.ts"]) {
      const texte = readFileSync(join(__dirname, "../../../src/moteurs/montage-cas-concret", nom), "utf8");
      const sources = [...texte.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
      expect(sources.length, nom).toBeGreaterThan(0);
      for (const s of sources) {
        expect(s, `${nom} : ${s}`).not.toMatch(/(^|\/)moteurs\//);
        expect(s, `${nom} : ${s}`).not.toMatch(/fournisseurs/);
        expect(s, `${nom} : ${s}`).not.toMatch(/studio-rendu|^\.\.?\/.*tests/);
      }
    }
  });
});
