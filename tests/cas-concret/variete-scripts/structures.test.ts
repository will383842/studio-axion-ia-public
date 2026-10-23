/**
 * Lot D1 · recettes et patrons PAR STRUCTURE (pur : rien n'est branché à la fabrication). La v4 reste octet pour octet ce
 * qu'elle était ; les trois autres structures se conçoivent DANS R04.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sequencesDe } from "@/domaine/cas-concret-variete";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { CAS_STOCK } from "@/formats/cas-concret/stock-metiers";
import { recettePour, structureEffective, STRUCTURES_RECETTE } from "@/formats/cas-concret/recette";
import { ficheParGabarit, variableEcriture } from "@/moteurs/montage-cas-concret/ecriture";
import { texteDuCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { PATRONS, PATRONS_COMPATIBLES, ROLES_PATRON, blocStructure, patronsDeLaVideo } from "@/moteurs/montage-cas-concret/patrons-ecriture";
import { regleAccroche, regleOrdre, regleOrdreDuFonctionnement } from "@/moteurs/montage-cas-concret/regles";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { STRUCTURES } from "@/moteurs/montage-cas-concret/variete";
import { casCoaching } from "../x5/cas-coaching";

const V4 = STRUCTURES_RECETTE[0];
const AUTRES = STRUCTURES_RECETTE.slice(1);
const FIXE = { videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const recrutement = trouverCas("recrutement-apporteurs")!;
const TOUS = [...CATALOGUE, casCoaching];
/** Les 22 cas d'origine + coaching (23) : seuls figés par une empreinte v4. Les cas du stock s'ajoutent à la fin du catalogue sans en avoir. */
const ORIGINAUX = [...CATALOGUE_TS, casCoaching];
const ids = Array.from({ length: 200 }, (_, i) => `video-${i}`);
const empreinte = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/** `sha256(JSON.stringify(recettePour(cas)))[0..16]`, calculées sur `src/formats/cas-concret/recette.ts` de master avant le lot D1. */
const EMPREINTES_RECETTE_V4: Record<string, string> = {
  "recrutement-apporteurs": "010b015b30bc1e93",
  "rappels-rendez-vous": "010b015b30bc1e93",
  "email-difficile": "dee69e49e1f2558c",
  "compte-rendu-dicte": "dee69e49e1f2558c",
  "audit-une-journee": "63dd53b3426c8318",
  "contact-vers-crm": "e038fec7572e6c17",
  "devis-signe-alerte": "e038fec7572e6c17",
  "articles-blog": "010b015b30bc1e93",
  "cycle-de-formation": "0c174b19e73220d4",
  "programme-par-ia": "0c174b19e73220d4",
  "audit-departement": "63dd53b3426c8318",
  "diagnostic-gratuit": "63dd53b3426c8318",
  "dossier-laisse-relance": "010b015b30bc1e93",
  "documents-formation": "010b015b30bc1e93",
  "autofacture-formateurs": "010b015b30bc1e93",
  "devis-relances": "e038fec7572e6c17",
  "cv-tries": "04d7171e39571244",
  "alerte-courte": "010b015b30bc1e93",
  "outils-branches": "e038fec7572e6c17",
  "crm-qui-note": "e038fec7572e6c17",
  "compte-rendu-visio": "04d7171e39571244",
  "rendez-vous-classes": "010b015b30bc1e93",
  "coaching-dirigeant": "d206aed8ed87c242",
};
/** Calculées de même sur le code de master : `variableEcriture` des 23 cas (patrons de « video-3 »), et les patrons de 200 vidéos (sel 0 et 1). */
const EMPREINTE_VARIABLE_V4 = "28b849e538dedb6e";
const EMPREINTE_PATRONS_V4 = "1dac3ee01a3d0d89";

describe("D1 · recettes par structure", () => {
  it("1 · sans structure ou en v4 : la recette de toujours ; la liste égale celle du moteur de variété", () => {
    for (const c of ORIGINAUX) {
      expect(recettePour(c), c.id).toEqual(recettePour(c, V4));
      // Empreinte calculée sur le code de master (avant ce lot) : une recette v4 modifiée par erreur rougit ici.
      expect(empreinte(JSON.stringify(recettePour(c))), c.id).toBe(EMPREINTES_RECETTE_V4[c.id]);
    }
    // Cas du stock : pas d'empreinte figée, mais la recette doit se calculer (v4 et chaque autre structure), sans erreur ni bloc manquant.
    for (const c of CAS_STOCK) {
      for (const s of STRUCTURES_RECETTE) {
        const blocs = recettePour(c, s);
        expect(blocs.length, `${s} · ${c.id}`).toBeGreaterThan(0);
        expect(blocs[0].id, `${s} · ${c.id}`).toBe("accroche");
      }
      expect(recettePour(c), c.id).toEqual(recettePour(c, V4));
    }
    expect([...STRUCTURES]).toEqual([...STRUCTURES_RECETTE]);
    expect(recettePour(recrutement).map((b) => b.id)).toContain("chiffre");
  });

  it("2 · chaque structure, chaque offre : accroche 1re, question dernière, blocs présents, aucun chiffre, tournure gardée", () => {
    for (const s of AUTRES) {
      for (const c of TOUS) {
        const blocs = recettePour(c, s);
        const idsBlocs = blocs.map((b) => b.id);
        const nom = `${s} · ${c.id}`;
        expect(idsBlocs[0], nom).toBe("accroche");
        expect(idsBlocs.at(-1), nom).toBe("question");
        for (const id of ["avant", "bascule", "etapes", "reste-humain", "resultat"] as const) expect(idsBlocs, nom).toContain(id);
        expect(idsBlocs, nom).not.toContain("chiffre");
        expect(idsBlocs.indexOf("resultat-tete"), nom).toBe(s === "resultat-d-abord" ? 1 : -1);
        expect(idsBlocs.filter((i) => i === "resultat").length, nom).toBe(1);
        if (c.offre === "integration") expect(blocs.find((b) => b.id === "etapes")?.consigne, nom).toMatch(/automatisation|outils reliés/i);
      }
    }
    const coaching = recettePour(casCoaching, "une-journee");
    expect(coaching.find((b) => b.id === "etapes")?.consigne).toMatch(/Les séances/);
  });

  it("2b · les durées et consignes annoncées par le plan", () => {
    const v4 = recettePour(recrutement, V4);
    const ps = recettePour(recrutement, "probleme-solution");
    const avant = (l: typeof v4) => l.find((b) => b.id === "avant")!.dureeCibleSec;
    expect(avant(ps)).toEqual([avant(v4)[0] + 2, avant(v4)[1] + 2]);
    expect(recettePour(recrutement, "resultat-d-abord")[1]).toMatchObject({ id: "resultat-tete", dureeCibleSec: [1, 3], consigne: "un écran « resultat » court, 3 à 6 mots dits" });
    expect(v4.find((b) => b.id === "avant")!.dureeCibleSec).toEqual([8, 12]);
    expect(recettePour(recrutement, "une-journee").find((b) => b.id === "bascule")!.consigne).toBe("la même journée, depuis que c'est en place");
  });

  it("2c · coaching : « une-journee » se comporte comme la v4 (recette, patrons, description) ; les autres structures s'appliquent", () => {
    expect(structureEffective("coaching", "une-journee")).toBe(V4);
    expect(structureEffective("integration", "une-journee")).toBe("une-journee");
    expect(recettePour(casCoaching, "une-journee")).toEqual(recettePour(casCoaching, V4));
    expect(blocStructure("une-journee", "coaching")).toBeNull();
    expect(blocStructure("une-journee", "integration")).not.toBeNull();
    for (const id of ids) expect(patronsDeLaVideo(id, 0, "une-journee", "coaching")).toEqual(patronsDeLaVideo(id, 0, V4));
    expect(recettePour(casCoaching, "resultat-d-abord").map((b) => b.id)).toContain("resultat-tete");
  });
});

describe("D1 · patrons par structure", () => {
  it("3 · sans structure ou en v4 : les mêmes patrons (200 vidéos) ; sinon un patron compatible, chacun tiré au moins une fois", () => {
    for (const id of ids) {
      expect(patronsDeLaVideo(id, 1)).toEqual(patronsDeLaVideo(id, 1, V4));
      expect(patronsDeLaVideo(id)).toEqual(patronsDeLaVideo(id, 0, undefined));
    }
    // Empreinte calculée sur le code de master : le tirage des patrons de la v4 n'a pas bougé.
    expect(empreinte(ids.map((id) => JSON.stringify([patronsDeLaVideo(id), patronsDeLaVideo(id, 1, V4)])).join("\n"))).toBe(EMPREINTE_PATRONS_V4);
    for (const s of AUTRES) {
      const vus = new Map<string, Set<string>>();
      for (const id of ids) {
        const p = patronsDeLaVideo(id, 0, s);
        for (const r of ROLES_PATRON) {
          const permis = PATRONS_COMPATIBLES[s as keyof typeof PATRONS_COMPATIBLES][r];
          if (permis) expect(permis, `${s} · ${r}`).toContain(p[r].id);
          const cle = `${s}:${r}`;
          vus.set(cle, (vus.get(cle) ?? new Set()).add(p[r].id));
        }
      }
      for (const [r, permis] of Object.entries(PATRONS_COMPATIBLES[s as keyof typeof PATRONS_COMPATIBLES])) {
        expect([...vus.get(`${s}:${r}`)!].sort(), `${s} · ${r}`).toEqual([...permis!].sort());
        for (const id of permis!) expect(PATRONS[r as keyof typeof PATRONS].map((p) => p.id)).toContain(id);
      }
    }
  });

  it("3b · un même identifiant donne les mêmes patrons (déterminisme)", () => {
    for (const s of AUTRES) expect(patronsDeLaVideo("video-9", 2, s)).toEqual(patronsDeLaVideo("video-9", 2, s));
  });
});

describe("D1 · partie variable", () => {
  it("4 · sans structure ou en v4 : identique octet pour octet ; hors v4 : la balise, avant les formes", () => {
    const base = variableEcriture(recrutement, recettePour(recrutement), FIXE, [], { patrons: patronsDeLaVideo("v", 0) });
    expect(variableEcriture(recrutement, recettePour(recrutement), FIXE, [], { patrons: patronsDeLaVideo("v", 0), structure: blocStructure(V4) })).toBe(base);
    expect(variableEcriture(recrutement, recettePour(recrutement), FIXE, [], { patrons: patronsDeLaVideo("v", 0), structure: null })).toBe(base);
    expect(base).not.toContain("<structure_de_la_video>");
    // Empreinte calculée sur le code de master : la partie variable de la v4 (23 cas) est inchangée, donc rien n'est repayé.
    const variables = ORIGINAUX.map((c) => variableEcriture(c, recettePour(c, V4), FIXE, [], { patrons: patronsDeLaVideo("video-3", 0, V4), structure: blocStructure(V4) }));
    expect(empreinte(variables.join("\n====\n"))).toBe(EMPREINTE_VARIABLE_V4);
    for (const s of AUTRES) {
      const texte = variableEcriture(recrutement, recettePour(recrutement, s), FIXE, [], { patrons: patronsDeLaVideo("v", 0, s), structure: blocStructure(s) });
      expect(texte).toContain("<structure_de_la_video>");
      expect(texte.indexOf("<structure_de_la_video>")).toBeLessThan(texte.indexOf("<formes_de_la_video>"));
    }
  });
});

describe("D1 · garde-fous de contenu", () => {
  it("5 · aucune suite de 4 mots de la v4 ni des extraits de Will ; jamais Villeexemple, « aucun gain garanti », « machine »", () => {
    const v4 = new Set([...EXTRAITS_WILL.flatMap((e) => sequencesDe(e.extrait, 4)), ...SCRIPT_V4_RECRUTEMENT.ecrans.flatMap((e) => sequencesDe(e.texteDit, 4))]);
    const textes = [
      ...AUTRES.map((s) => blocStructure(s)!),
      ...AUTRES.flatMap((s) => TOUS.flatMap((c) => recettePour(c, s).map((b) => `${b.nom}. ${b.consigne ?? ""}`))),
    ];
    for (const t of textes) {
      expect(/villeexemple|aucun gain garanti|machine/i.test(t), t).toBe(false);
      for (const suite of sequencesDe(t, 4)) expect(v4.has(suite), `${suite} dans ${t}`).toBe(false);
    }
    expect(blocStructure(V4)).toBeNull();
    for (const s of AUTRES) expect(blocStructure(s)).toMatch(/avant six secondes/);
    expect(blocStructure("resultat-d-abord")).toMatch(/n'est PAS un écran « chiffre »/);
    expect(blocStructure("une-journee")).toContain("depuis que c'est en place");
  });
});

describe("D1 · les règles d'ordre acceptent la nouvelle structure", () => {
  const renumeroter = (f: FicheEcrans): FicheEcrans => ({ ...f, ecrans: f.ecrans.map((e, i) => ({ ...e, id: `e${String(i + 1).padStart(2, "0")}` })) });

  it("6 · les 22 cas : un écran « resultat » de 8 mots juste après l'accroche, sans chiffre, débit 3,0 : R03, R04 et R23 ne disent rien", () => {
    for (const cas of CATALOGUE) {
      const f = ficheParGabarit(cas, FIXE);
      const fin = [...f.ecrans].reverse().find((e) => e.type === "resultat")!;
      const tete = { ...fin, texteDit: "Huit mots dits pour annoncer le gain obtenu." };
      // L'écran « chiffre » est retiré, comme dans la recette.
      const ecrans = f.ecrans.filter((e) => e.type !== "chiffre");
      const transformee = renumeroter({ ...f, ecrans: [ecrans[0], tete, ...ecrans.slice(1)] });
      const contexte = { cas, texteScript: texteDuCorps(transformee), debitMotsParSeconde: 3.0 };
      expect(regleOrdre(transformee, contexte), cas.id).toEqual([]);
      expect(regleAccroche(transformee, contexte), cas.id).toEqual([]);
      expect(regleOrdreDuFonctionnement(transformee, contexte), cas.id).toEqual([]);
    }
  });
});
