/**
 * C9-36t — filet : le plan de scènes des trois générateurs (adaptateur) et de la vidéo entière (face caméra, face caméra
 * animée), figé AVANT le branchement des objets de bibliothèque. C9-35b et C9-36b devront garder ces sorties octet pour
 * octet tant que rien n'est permis. Doubles seulement : aucun appel réseau, le faux LLM compte ses appels.
 */
import { describe, expect, it } from "vitest";
import { adapterPlan, GENERATEURS_PLAN, type EntreeAdaptateur, type SegmentCale } from "@/briques/plan-scenes-generateurs/adaptateur";
import { planPourVideo, segmenterEnPhrases, type MemoPlanVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { enMillisecondes } from "@/briques/plan-scenes-generateurs/video";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { fnv1a64 } from "@/briques/plan-scenes/empreinte";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import type { FormatPlan } from "@/briques/plan-scenes/schema";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const FORMAT: FormatPlan = { largeur: 1080, hauteur: 1920, fps: 25 };
const SCRIPTS = [
  { nom: "chiffres", texte: DIX_SCRIPTS[0]! },
  { nom: "etapes", texte: DIX_SCRIPTS[4]! },
  { nom: "enumeration", texte: DIX_SCRIPTS[8]! },
];

/** Un mot toutes les 350 ms, fin à +300 ms. */
function motsEnSecondes(script: string): MotEnSecondes[] {
  return script.split(/\s+/).filter(Boolean).map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
}
const dureeSecDe = (m: MotEnSecondes[]) => m.at(-1)!.finSec;

function segmentsDe(script: string): SegmentCale[] {
  return segmenterEnPhrases(enMillisecondes(motsEnSecondes(script)));
}

/** Faux LLM déterministe : réponse fixe (une carte KPI sur 0..3000 ms), compte ses appels, aucune horloge ni hasard. */
function fauxAppeler() {
  const appels: RequeteClaude[] = [];
  const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => {
    appels.push(req);
    const plan = {
      version: "plan-scenes-1",
      scenes: [{ id: "a", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", piece: "carte-kpi", parametres: { valeur: "42", etiquette: "devis" } }],
    };
    return { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude;
  };
  return { appels, appeler };
}

const codes = (r: { remarques: { code: string }[] }) => r.remarques.map((x) => x.code);
const facecamDe = (g: (typeof GENERATEURS_PLAN)[number]) => g !== "cas-concret";

function entreeAdaptateur(g: (typeof GENERATEURS_PLAN)[number], script: string): EntreeAdaptateur {
  return { generateur: g, script, segments: segmentsDe(script), format: FORMAT, facecam: facecamDe(g) };
}

function constatAdaptateur(r: Awaited<ReturnType<typeof adapterPlan>>) {
  return {
    source: r.source,
    laissees: r.laissees,
    plan: r.plan && { empreintes: r.plan.scenes.map((s) => s.empreinte), scenes: r.plan.scenes },
    codes: codes(r),
  };
}

const aucuneFamilleObjet = (scenes: { piece: string }[] | undefined) =>
  (scenes ?? []).every((s) => CATALOGUE_BRIQUES[s.piece as keyof typeof CATALOGUE_BRIQUES].famille !== "objet");

describe("adaptateur sans objets : sortie figée pour les trois générateurs", () => {
  it("les trois générateurs sont couverts", () => {
    expect([...GENERATEURS_PLAN]).toEqual(["cas-concret", "facecam", "facecam-animee"]);
  });

  for (const g of GENERATEURS_PLAN) {
    for (const s of SCRIPTS) {
      it(`${g} / ${s.nom} : stock (sans LLM) figé, déterministe, aucun appel`, async () => {
        const sans = fauxAppeler();
        const a = await adapterPlan(entreeAdaptateur(g, s.texte));
        const b = await adapterPlan(entreeAdaptateur(g, s.texte));
        expect(b).toEqual(a);
        expect(sans.appels).toHaveLength(0);
        expect(a.source).toBe("stock");
        expect(aucuneFamilleObjet(a.plan?.scenes)).toBe(true);
        for (const sc of a.plan?.scenes ?? []) expect(sc.empreinte).toMatch(/^[0-9a-f]{16}$/);
        expect(constatAdaptateur(a)).toMatchSnapshot();
      });

      it(`${g} / ${s.nom} : avec faux LLM figé, deux exécutions identiques`, async () => {
        const f1 = fauxAppeler();
        const f2 = fauxAppeler();
        const a = await adapterPlan(entreeAdaptateur(g, s.texte), { appeler: f1.appeler });
        const b = await adapterPlan(entreeAdaptateur(g, s.texte), { appeler: f2.appeler });
        expect(b).toEqual(a);
        expect(f1.appels.length).toBeGreaterThan(0);
        expect(aucuneFamilleObjet(a.plan?.scenes)).toBe(true);
        for (const sc of a.plan?.scenes ?? []) expect(sc.empreinte).toMatch(/^[0-9a-f]{16}$/);
        expect(constatAdaptateur(a)).toMatchSnapshot();
      });
    }
  }
});

describe("vidéo entière sans objets : planPourVideo figé (face caméra, face caméra animée)", () => {
  for (const g of ["facecam", "facecam-animee"] as const) {
    for (const s of SCRIPTS) {
      const mots = motsEnSecondes(s.texte);
      const base = { generateur: g, mots, dureeSec: dureeSecDe(mots), facecam: true, format: FORMAT };

      it(`${g} / ${s.nom} : sans LLM, plan figé et déterministe`, async () => {
        const a = await planPourVideo(base);
        const b = await planPourVideo(base);
        expect(b).toEqual(a);
        expect(aucuneFamilleObjet(a.plan?.scenes)).toBe(true);
        expect({ entree: a.entree, plan: a.plan, codes: codes(a) }).toMatchSnapshot();
      });

      it(`${g} / ${s.nom} : avec faux LLM, plan figé ; la reprise (memo) ne rappelle pas l'IA`, async () => {
        const f1 = fauxAppeler();
        const f2 = fauxAppeler();
        const a = await planPourVideo({ ...base, appeler: f1.appeler });
        const b = await planPourVideo({ ...base, appeler: f2.appeler });
        expect(b).toEqual(a);
        expect(f1.appels.length).toBeGreaterThan(0);
        const reprise = fauxAppeler();
        const c = await planPourVideo({ ...base, appeler: reprise.appeler, memo: a as MemoPlanVideo });
        expect(reprise.appels).toHaveLength(0);
        expect(c).toEqual(a);
        expect({ entree: a.entree, plan: a.plan, codes: codes(a) }).toMatchSnapshot();
      });
    }
  }
});

describe("consigne envoyée au LLM sans objets permis", () => {
  it("empreinte du texte système figée, identique pour tous les générateurs ; sans objet proposé", async () => {
    const empreintes: string[] = [];
    for (const g of GENERATEURS_PLAN) {
      const f = fauxAppeler();
      await adapterPlan(entreeAdaptateur(g, SCRIPTS[0]!.texte), { appeler: f.appeler });
      expect(f.appels.length).toBeGreaterThan(0);
      const texte = f.appels[0]!.systeme.map((b) => b.texte).join("\n");
      expect(texte).not.toMatch(/objet-/);
      empreintes.push(fnv1a64(texte));
    }
    expect(new Set(empreintes).size).toBe(1);
    expect(empreintes[0]).toMatch(/^[0-9a-f]{16}$/);
    expect({ systeme: empreintes[0] }).toMatchSnapshot();
  });

  it("consignePlan() est identique à consignePlan([]) et ne contient aucun identifiant objet-", () => {
    expect(consignePlan()).toBe(consignePlan([]));
    expect(consignePlan()).not.toMatch(/objet-/);
    expect(fnv1a64(consignePlan())).toMatch(/^[0-9a-f]{16}$/);
  });

  // `adapterPlan` ne reçoit pas encore d'entrée bibliothèque et `src/` est interdit à cette fiche.
  it.todo("entrée bibliothèque vide de permissions (profil tout prevu) : sortie identique (C9-35b / C9-36b)");
});
