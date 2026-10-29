/**
 * Variété « Image → vidéo » · lot REC (axe 2, déroulé du récit) : REC-B (résultat puis « comment »), REC-C (on suit
 * un message), REC-D (trois étapes annoncées, repère k/3 sur le schéma). Le récit vit dans le script : il est donné à
 * l'écriture (doubles seulement, aucun appel) ; l'axe ne fait que l'accompagner à l'image, sans changer ce qui est montré
 * ni quand. Aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { ecrireScriptIV, type OutilsEcritureIV } from "@/moteurs/montage-image-video/ecriture";
import { FICHES_SIMULEES, FICHES_SIMULEES_RECIT, ficheSimuleeRecit } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { PARCOURS_RECIT, recitsPossibles, type CodeRecit } from "@/moteurs/montage-image-video/recettes";
import { cleFormule, verifierScript, type ChoixFormule } from "@/moteurs/montage-image-video/regles";
import { AXE_RECIT, type DonneesRecitIV } from "@/moteurs/montage-image-video/variete/axes/recit";
import { RECETTE_REFERENCE_IV, tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";
import { parametresDuBloc } from "@/services/image-video-rendu";
import { lireDonneesRecit } from "../../../studio-rendu/compositions/image-video/variete/recit/donnees";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const NOMS = ["A", "B", "C", "D", "E", "F"] as const;
const CODES: CodeRecit[] = ["REC-B", "REC-C", "REC-D"];
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(
  ["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]),
);
const C = carteDe("C");
const avec = (recit: CodeRecit): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, recit });

/** Entrée de la version TikTok d'une carte, avec une fiche donnée (la fiche de base par défaut). */
function entree(nom: string, fiche = FICHES_SIMULEES[`essai-${nom.toLowerCase()}`]!): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}
const recitDe = (b: BlocRenduIV) => b.variete?.donnees?.recit as DonneesRecitIV | undefined;

/** Doubles de l'écriture : réserve toujours, rend la simulation du rôle, garde chaque entrée envoyée. */
function outils(): { o: OutilsEcritureIV; envoyes: EntreeRole[] } {
  const envoyes: EntreeRole[] = [];
  return {
    envoyes,
    o: {
      budget: { reserver: async () => ({ ok: true }) },
      appeler: async (role: DefinitionRole, e: EntreeRole) => {
        envoyes.push(e);
        return { ok: true, simule: true, donnees: role.simuler(e) };
      },
    },
  };
}

describe("REC · le récit est donné à l'écriture du script", () => {
  it("ecrireScriptIV avec recit REC-B ajoute son parcours à la consigne envoyée ; sans récit, rien ne change", async () => {
    const sans = outils();
    await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte: C, choixFormules: GARDER }, sans.o);
    for (const code of CODES) {
      const a = outils();
      await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte: C, choixFormules: GARDER, recit: code }, a.o);
      expect(a.envoyes[0]!.variable).not.toBe(sans.envoyes[0]!.variable);
      expect(a.envoyes[0]!.variable).toContain(`<recit>${code} · ${PARCOURS_RECIT[code]}</recit>`);
    }
    expect(sans.envoyes[0]!.variable).not.toContain("<recit>");
    const ref = outils();
    await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte: C, choixFormules: GARDER, recit: "REC-A" }, ref.o);
    expect(ref.envoyes[0]!.variable).toBe(sans.envoyes[0]!.variable);
  });

  it("la simulation rend la fiche écrite selon le récit, et elle passe les règles avec ce récit", async () => {
    for (const code of CODES) {
      const a = outils();
      const r = await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte: C, choixFormules: GARDER, recit: code }, a.o);
      expect(r.ok, code).toBe(true);
      if (r.ok) expect(r.fiche).toEqual(FICHES_SIMULEES_RECIT["essai-c"]![code]);
    }
  });

  it("REC-B : le résultat AVANT la douleur passe verifierScript avec ce récit, et seulement avec lui", () => {
    const f = ficheSimuleeRecit("essai-c", "REC-B")!;
    expect(f.ecrans.map((e) => e.partie).slice(0, 4)).toEqual(["accroche", "resultat", "resultat", "douleur"]);
    expect(verifierScript(f, { carte: C, choixFormules: GARDER, recit: "REC-B" }).manquements).toEqual([]);
    expect(verifierScript(f, { carte: C, choixFormules: GARDER }).manquements.map((m) => m.regle)).toContain("Q07");
    // REC-B sans « Voici comment. » au début de réponse : refusé.
    const sansVoici = structuredClone(f);
    const debut = sansVoici.ecrans.find((e) => e.partie === "debut-reponse")!;
    debut.texteDit = "Sauf si quelqu'un lui répond, tout de suite.";
    expect(verifierScript(sansVoici, { carte: C, choixFormules: GARDER, recit: "REC-B" }).manquements.map((m) => m.message).join(" ")).toContain("Voici comment.");
  });

  it("REC-D : le début de réponse doit annoncer les trois étapes ; l'explication reste complète et dans l'ordre", () => {
    const f = ficheSimuleeRecit("essai-c", "REC-D")!;
    expect(verifierScript(f, { carte: C, choixFormules: GARDER, recit: "REC-D" }).ok).toBe(true);
    const base = FICHES_SIMULEES["essai-c"]!;
    expect(verifierScript(base, { carte: C, choixFormules: GARDER, recit: "REC-D" }).manquements.map((m) => m.message).join(" ")).toContain("Trois étapes.");
    // Mêmes blocs de la carte cités dans le même ordre (l'ordre réel du processus) que la fiche de base.
    const refs = (x: typeof base) => x.ecrans.filter((e) => e.partie === "explication").flatMap((e) => e.refs);
    for (const code of CODES) expect(refs(ficheSimuleeRecit("essai-c", code)!), code).toEqual(refs(base));
  });

  it("les fiches de base ne changent pas (ajouts seulement)", () => {
    expect(FICHES_SIMULEES["essai-c"]!.ecrans.map((e) => e.partie).slice(0, 3)).toEqual(["accroche", "douleur", "douleur"]);
    expect(ficheSimuleeRecit("essai-a", "REC-B")).toBeNull();
  });
});

describe("REC · variantes possibles par image", () => {
  it("REC-B s'il y a un résultat chiffré ; REC-C s'il y a un message à suivre ; REC-D sur trois temps lisibles", () => {
    const possibles = Object.fromEntries(NOMS.map((n) => [n, AXE_RECIT.possibles(carteDe(n), "9:16")]));
    expect(possibles).toEqual({ A: ["REC-A"], B: ["REC-A"], C: ["REC-A", "REC-B", "REC-C", "REC-D"], D: ["REC-A", "REC-B", "REC-C", "REC-D"], E: ["REC-A", "REC-D"], F: ["REC-A", "REC-B", "REC-C", "REC-D"] });
    expect(recitsPossibles(C)).toEqual(possibles.C);
  });

  it("le tirage ne donne jamais un récit impossible (repli sur REC-A)", () => {
    for (const n of NOMS) {
      const carte = carteDe(n);
      for (let g = 0; g < 40; g++) expect(["REC-A", ...recitsPossibles(carte)]).toContain(tirerVarieteIV({ graine: `v${g}`, carte, format: "9:16" }).recit);
    }
    expect(new Set(Array.from({ length: 60 }, (_, g) => tirerVarieteIV({ graine: `v${g}`, carte: C, format: "9:16" }).recit))).toEqual(new Set(["REC-A", ...CODES])); // la référence REC-A est tirable (issue 124)
  });
});

describe("REC · l'axe accompagne le récit à l'image", () => {
  it("REC-D : le repère k/3 est posé sur les blocs `toile` de l'explication, de 1/3 à 3/3", () => {
    const r = mettreEnSceneIV({ ...entree("C", ficheSimuleeRecit("essai-c", "REC-D")!), variete: avec("REC-D") });
    const toiles = r.ligne.blocs.filter((b) => b.sorte === "toile");
    expect(toiles.length).toBeGreaterThan(0);
    for (const b of toiles) {
      const d = recitDe(b);
      expect(d?.code, b.id).toBe("REC-D");
      if (d?.code !== "REC-D") continue;
      expect(d.total).toBe(3);
      expect(d.changements.map((c) => c.numero)).toEqual([1, 2, 3]);
      expect(d.place).toBe("toile");
      // Le passage à l'étape 2 tombe sur l'écran du chatbot (la décision), au début de son plan.
      const decision = r.ligne.plans.find((p) => p.ecran === "e06")!;
      expect(d.changements[1]!.t + b.debut).toBeCloseTo(decision.debut, 2);
    }
    expect(r.ligne.variete?.replis).toEqual([]);
  });

  it("REC-B : sur le résultat dit d'abord, le « comment » en cartes ; au début de l'explication, la pastille du résultat", () => {
    const r = mettreEnSceneIV({ ...entree("C", ficheSimuleeRecit("essai-c", "REC-B")!), variete: avec("REC-B") });
    const resultat = r.ligne.blocs.filter((b) => recitDe(b)?.role === "resultat");
    const comment = r.ligne.blocs.filter((b) => recitDe(b)?.role === "comment");
    expect(resultat.map((b) => b.sorte)).toEqual(["moments"]);
    expect(comment.map((b) => b.sorte)).toEqual(["toile"]);
    const d = recitDe(comment[0]!);
    expect(d?.code === "REC-B" && d.role === "comment" ? d.resultat : null).toBe("80 %");
  });

  it("REC-B sur un script qui ne met pas le résultat d'abord : rien n'est posé, le repli est inscrit", () => {
    const r = mettreEnSceneIV({ ...entree("C"), variete: avec("REC-B") });
    expect(r.ligne.blocs.some((b) => recitDe(b))).toBe(false);
    expect(r.ligne.variete?.replis).toEqual([{ axe: "recit", code: "REC-B", raison: "le script ne dit pas le résultat avant l'explication" }]);
  });

  it("REC-C : la bulle « 23h14 » suit le message sur chaque toile de l'explication ; la réponse arrive au résultat", () => {
    const r = mettreEnSceneIV({ ...entree("C", ficheSimuleeRecit("essai-c", "REC-C")!), variete: avec("REC-C") });
    const suivis = r.ligne.blocs.filter((b) => recitDe(b)?.role === "suivi");
    expect(suivis.map((b) => b.sorte)).toEqual(["toile", "toile"]);
    const d = recitDe(suivis[0]!);
    if (d?.code !== "REC-C") throw new Error("REC-C attendu");
    expect(d).toMatchObject({ libelle: "23h14", depart: "n01" });
    expect(d.noeuds[0]).toBe("n01");
    expect(d.reponse).not.toBeNull();
  });

  it("le calque lit exactement ce que pose l'axe, et le service le passe dans les propriétés du bloc", () => {
    for (const code of CODES) {
      const r = mettreEnSceneIV({ ...entree("C", ficheSimuleeRecit("essai-c", code)!), variete: avec(code) });
      const portes = r.ligne.blocs.filter((b) => recitDe(b));
      expect(portes.length, code).toBeGreaterThan(0);
      for (const b of portes) {
        expect(lireDonneesRecit(recitDe(b))).toEqual(recitDe(b));
        const p = parametresDuBloc(b, r.ligne).proprietes as { variete?: { donnees?: { recit?: unknown } } };
        expect(p.variete?.donnees?.recit).toEqual(recitDe(b));
      }
    }
    expect(lireDonneesRecit({ code: "REC-D", role: "suivi", fonds: [] })).toBeNull();
    expect(lireDonneesRecit(undefined)).toBeNull();
  });
});

describe("REC · invariants : ce qui est montré et dit ne bouge pas", () => {
  it("sur les 6 cartes et chaque variante (fiche de base) : mêmes chiffres et textes aux mêmes heures, mêmes contrôles", () => {
    for (const n of NOMS) {
      const e = entree(n);
      const sans = mettreEnSceneIV(e);
      for (const code of CODES) {
        const a = mettreEnSceneIV({ ...e, variete: avec(code) });
        expect(invariantsVarieteIV(sans, a), `${n} ${code}`).toEqual([]);
        // Sans rien posé, le repli est inscrit (jamais un écran vide).
        if (!a.ligne.blocs.some((b) => recitDe(b))) expect(a.ligne.variete?.replis.some((x) => x.axe === "recit"), `${n} ${code}`).toBe(true);
      }
    }
  });

  it("sur les fiches écrites selon le récit (carte C) : la variante ne change rien à ce qui est montré", () => {
    for (const code of CODES) {
      const e = entree("C", ficheSimuleeRecit("essai-c", code)!);
      const sans = mettreEnSceneIV(e);
      expect(sans.ok, code).toBe(true);
      expect(invariantsVarieteIV(sans, mettreEnSceneIV({ ...e, variete: avec(code) })), code).toEqual([]);
    }
  });
});
