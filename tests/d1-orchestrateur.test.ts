/**
 * D1 — chef d'orchestre de l'intensité (`INTENSITE-ET-BRUITAGES.md` §1, contrat `LOT-INTENSITE-CREDITS-EXECUTION.md` §4).
 * Critère de fin : sur 20 scripts, pour les 3 niveaux, aucune fenêtre de 3 s au-dessus du plafond, aucun effet fort
 * simultané, respiration respectée, un choix verrouillé jamais déplacé.
 */
import { describe, expect, it } from "vitest";
import { horodaterTexte } from "@/domaine/derivations";
import type { BruitageDisponible, NiveauIntensite, SegmentSousTitres } from "@/domaine/types";
import { RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { STYLE_MONTAGE_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { decouperEnPlans, type SegmentDecoupage } from "@/moteurs/montage-avocat/decoupage";
import { preparerTexteVoix, reporterHorodatages } from "@/moteurs/montage-avocat/report";
import {
  chargeA,
  demandesDesPlans,
  demandesDesSousTitres,
  orchestrerIntensite,
  orchestrerMontage,
  PLAFOND_PAR_NIVEAU,
  POIDS_EFFETS,
  prioriteEffective,
  REGLES_BRUITAGES,
  verifierIntensite,
  type DemandeEffet,
  type EffetPlace,
} from "@/briques/intensite";

const S = (id: string, bloc: string, texte: string, extra: Partial<SegmentDecoupage> = {}): SegmentDecoupage => ({ id, bloc, texte, ...extra });

/** Réserve de phrases réelles du format avocat (chiffres, documents, téléphones, montants). */
const PHRASES: Omit<SegmentDecoupage, "id">[] = [
  { bloc: "coeur", texte: "D'abord, regardez la date inscrite sur l'avis de contravention.", intentionIllustration: "un avis de contravention posé sur une table" },
  { bloc: "coeur", texte: "Si elle dépasse le délai légal, la procédure peut tomber entièrement.", emphase: ["délai légal"] },
  { bloc: "coeur", texte: "Ensuite, vérifiez la photo du radar et la plaque de votre voiture.", intentionIllustration: "un radar automatique au bord de la route" },
  { bloc: "coeur", texte: "Une seule lettre illisible, et le doute profite toujours au conducteur." },
  { bloc: "coeur", texte: "Votre patron vous écrit un SMS à 23 heures pour vous licencier.", intentionIllustration: "un téléphone posé sur un bureau avec une notification" },
  { bloc: "coeur", texte: "Ce message n'a aucune valeur : la loi exige une lettre recommandée.", emphase: ["aucune valeur"] },
  { bloc: "coeur", texte: "Vous avez quarante-cinq jours pour le contester, pas un de plus.", emphase: ["quarante-cinq jours"] },
  { bloc: "coeur", texte: "Beaucoup de gens paient par réflexe, et perdent 4 points pour rien.", intentionIllustration: "un permis de conduire rose", incrustation: { type: "montant", texte: "−4 pts", sens: "perte" } },
  { bloc: "preuve", texte: "L'an dernier, un client a récupéré 67 000 € grâce à ce détail.", emphase: ["67 000 €"], incrustation: { type: "montant", texte: "+ 67 000 €", sens: "gain" } },
  { bloc: "preuve", texte: "Une salariée a obtenu 18 mois de salaire après ce genre de SMS.", emphase: ["18 mois"], incrustation: { type: "montant", texte: "18 mois", sens: "gain" } },
  { bloc: "coeur", texte: "Votre contrat de travail prévoit peut-être une clause de mobilité.", intentionIllustration: "un contrat de travail signé" },
  { bloc: "coeur", texte: "Elle ne s'applique que si elle précise la zone géographique exacte." },
  { bloc: "coeur", texte: "Et 35 heures de travail dans Excel ne prouvent rien sans vos plannings.", emphase: ["35 heures"] },
  { bloc: "coeur", texte: "Gardez une copie de chaque courrier, datée et signée.", intentionIllustration: "une pile de courriers datés" },
];
const ACCROCHES = ["Vous recevez un PV de 135 € ?", "Votre patron peut-il lire vos mails ?", "Licencié par SMS : c'est légal ?", "35 heures dans Excel : attention."];
const FINS = [S("ap", "appel", "Gardez cette vidéo pour le jour où ça vous arrive."), S("b", "boucle", "Et surtout, ne signez rien tout de suite.")];

/** 20 scripts de 6 à 14 phrases, débits de 3,9 à 5,0 mots/s, un ou deux angles. */
const SCRIPTS = Array.from({ length: 20 }, (_, k) => {
  const n = 4 + (k % 9);
  const corps = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, ...PHRASES[(k * 5 + i * 3) % PHRASES.length] }));
  return {
    segments: [S("acc", "accroche", ACCROCHES[k % ACCROCHES.length], { emphase: ["135 €"] }), S("pro", "promesse", "Je vous explique pourquoi en trente secondes."), ...corps, ...FINS],
    debit: 3.9 + ((k * 7) % 12) / 10,
    deuxAngles: k % 3 !== 0,
  };
});

const SONS: BruitageDisponible[] = (["chiffre", "document", "telephone", "illustration-forte", "impact"] as const).flatMap((declencheur) => [1, 2, 3, 4].map((variante) => ({ elementId: `bruit-${declencheur}-${variante}`, declencheur, variante, dureeSec: 0.25 })));

function montage(script: (typeof SCRIPTS)[number], niveau: NiveauIntensite) {
  const t = preparerTexteVoix(script.segments, []);
  const mots = reporterHorodatages(t, horodaterTexte(t.texte, script.debit));
  const plans = decouperEnPlans({ mots, segments: script.segments, plansIndicatifs: [], recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, repartition: { principal: 0.85, second: 0.15 }, deuxAngles: script.deuxAngles, ouvertureSurIllustration: false, illustrations: true, levresNote: 92, personnageId: "p", intensite: niveau });
  const dureeSec = plans.at(-1)!.finSec;
  const segments = fabriquerSousTitres({ texte: script.segments.map((s) => s.texte).join(" "), dureeSec, mots, emphase: script.segments.flatMap((s) => s.emphase ?? []), style: STYLE_SOUS_TITRES_AVOCAT, base: "karaoke", intensite: niveau, coupesSec: plans.slice(1).map((p) => p.debutSec) });
  const relancesSec = script.segments.filter((s, i) => i > 0 && s.bloc !== script.segments[i - 1].bloc).map((s) => mots.find((m) => m.segmentId === s.id)?.debutSec ?? 0);
  const sortie = orchestrerMontage({ niveau, dureeSec, plans, segments, angleSecond: RECETTE_MONTAGE_AVOCAT.angles.second, relancesSec, bruitages: { reglage: "discrets", disponibles: SONS, graine: 7 } });
  return { plans, segments, sortie, dureeSec, relancesSec };
}

/** Les effets à l'image après orchestration, avec leur verrou d'origine. */
function effetsFinals(r: ReturnType<typeof montage>): EffetPlace[] {
  const d = [...demandesDesPlans(r.sortie.plans, RECETTE_MONTAGE_AVOCAT.angles.second), ...demandesDesSousTitres(r.sortie.segments)];
  const effets: EffetPlace[] = d.map((x) => ({ id: x.id, type: x.type, debutSec: x.debutSec, finSec: x.finSec, poids: POIDS_EFFETS[x.type], verrouille: prioriteEffective(x, r.relancesSec) === "verrouille" }));
  for (const b of r.sortie.bruitages) effets.push({ id: `son-${b.debutSec}`, type: "bruitage", debutSec: b.debutSec, finSec: b.debutSec + b.dureeSec, poids: 1, verrouille: false });
  return effets;
}

describe("D1 — chef d'orchestre de l'intensité, 20 scripts × 3 niveaux", () => {
  for (const niveau of ["sobre", "equilibre", "tres-dynamique"] as const) {
    it(`${niveau} : aucune fenêtre de 3 s au-dessus de ${PLAFOND_PAR_NIVEAU[niveau]}, un seul effet fort à la fois, respiration de 1,5 s`, () => {
      let effetsTotal = 0;
      for (const [k, script] of SCRIPTS.entries()) {
        const r = montage(script, niveau);
        const effets = effetsFinals(r);
        effetsTotal += effets.length;
        expect(verifierIntensite(effets, niveau), `script ${k + 1}`).toEqual([]);
        // Toutes les fenêtres, verrouillés compris : aucune au-dessus du plafond… sauf quand seuls des effets qui
        // passent TOUJOURS (structure, montant affiché : décision de Will du 02/10) le dépassent ; alors rien de
        // facultatif ne s'y ajoute.
        for (const t of effets.map((e) => e.debutSec)) {
          if (chargeA(effets, t) <= PLAFOND_PAR_NIVEAU[niveau] + 1e-6) continue;
          expect(chargeA(effets.filter((e) => !e.verrouille), t), `script ${k + 1}, ${t} s : facultatif au-dessus du plafond`).toBe(0);
        }
        expect(r.sortie.rapport.depassements, `script ${k + 1}`).toEqual([]);
        expect(r.sortie.rapport.plafond).toBe(PLAFOND_PAR_NIVEAU[niveau]);
        // La structure du découpage ne bouge jamais (mêmes plans, mêmes instants).
        expect(r.sortie.plans.map((p) => [p.debutSec, p.finSec, p.sourceImage])).toEqual(r.plans.map((p) => [p.debutSec, p.finSec, p.sourceImage]));
      }
      expect(effetsTotal).toBeGreaterThan(200);
    });
  }

  it("R14 — en Sobre, une structure trop chargée perd une coupe, sans jamais coller deux cadrages identiques ni dépasser 6 s", () => {
    let allegees = 0;
    for (const script of SCRIPTS) {
      const t = preparerTexteVoix(script.segments, []);
      const mots = reporterHorodatages(t, horodaterTexte(t.texte, script.debit));
      const entree = { mots, segments: script.segments, plansIndicatifs: [], recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, repartition: { principal: 0.85, second: 0.15 }, deuxAngles: script.deuxAngles, ouvertureSurIllustration: false, illustrations: true, levresNote: 92, personnageId: "p" };
      const sans = decouperEnPlans(entree);
      const sobre = decouperEnPlans({ ...entree, intensite: "sobre" });
      // Équilibré et Très dynamique : la structure de ces scripts tient déjà, rien ne change.
      expect(decouperEnPlans({ ...entree, intensite: "equilibre" })).toEqual(sans);
      if (sobre.length < sans.length) allegees++;
      expect(sobre.map((p, i) => p.ordre === i + 1)).not.toContain(false);
      expect(sobre.at(-1)!.finSec).toBe(sans.at(-1)!.finSec);
      for (let i = 1; i < sobre.length; i++) {
        expect(sobre[i].debutSec).toBe(sobre[i - 1].finSec);
        const a = sobre[i - 1];
        const b = sobre[i];
        if (a.sourceImage === "double" && b.sourceImage === "double" && a.angle === b.angle) expect(a.cadrage.valeur).not.toBe(b.cadrage.valeur);
      }
      for (const p of sobre) if (p.sourceImage === "double") expect(p.finSec - p.debutSec).toBeLessThanOrEqual(6 + 1e-6);
    }
    expect(allegees).toBeGreaterThan(0);
  });

  it("le niveau change vraiment le montage : moins d'accents en Sobre qu'en Très dynamique", () => {
    const compte = (n: NiveauIntensite) => SCRIPTS.reduce((s, sc) => s + effetsFinals(montage(sc, n)).filter((e) => e.type !== "coupe" && e.type !== "poitrine" && e.type !== "second-angle" && e.type !== "illustration").length, 0);
    expect(compte("sobre")).toBeLessThan(compte("equilibre"));
    expect(compte("equilibre")).toBeLessThan(compte("tres-dynamique"));
  });

  it("un montant affiché n'est jamais retiré, à aucun niveau (décision de Will du 02/10)", () => {
    let montants = 0;
    for (const niveau of ["sobre", "equilibre", "tres-dynamique"] as const)
      for (const script of SCRIPTS) {
        const r = montage(script, niveau);
        for (const [i, p] of r.plans.entries()) {
          if (p.incrustation?.type !== "montant") continue;
          montants++;
          expect(r.sortie.plans[i].incrustation?.texte, `${niveau}, plan ${p.ordre}`).toBe(p.incrustation.texte);
        }
      }
    expect(montants).toBeGreaterThan(20);
  });

  it("un groupe verrouillé par Will n'est jamais décalé ni sauté, même au-dessus du plafond", () => {
    const r0 = montage(SCRIPTS[3], "sobre");
    const cible = r0.segments.find((s) => s.debutSec > 4)!;
    const segments: SegmentSousTitres[] = r0.segments.map((s) => (s.id === cible.id ? { ...s, style: "impact", verrouille: true } : s));
    const sortie = orchestrerMontage({ niveau: "sobre", dureeSec: r0.dureeSec, plans: r0.plans, segments });
    const apres = sortie.segments.find((s) => s.id === cible.id)!;
    expect(apres.style).toBe("impact");
    expect(apres.debutSec).toBe(cible.debutSec);
    expect(sortie.decisions.find((d) => d.id === `st-${cible.id}:impact`)?.decision).toBe("garde");
  });

  it("orchestrateur seul : priorités, décalage, raison en clair, déterministe", () => {
    const D = (id: string, type: DemandeEffet["type"], debutSec: number, finSec: number, extra: Partial<DemandeEffet> = {}): DemandeEffet => ({ id, type, debutSec, finSec, priorite: "normale", origine: "test", ...extra });
    const demandes = [D("illu", "illustration", 4, 6, { priorite: "verrouille" }), D("impact", "impact", 5, 5.6), D("bandeau", "bandeau", 6.5, 7.5, { decalageMaxSec: 1.5, decalageSens: "plus-tard" }), D("acc", "impact", 0.3, 0.9), D("z", "zoom-lent", 4, 6)];
    const a = orchestrerIntensite(demandes, { niveau: "equilibre", dureeSec: 12 });
    const b = orchestrerIntensite(demandes, { niveau: "equilibre", dureeSec: 12 });
    expect(a).toEqual(b);
    const d = Object.fromEntries(a.decisions.map((x) => [x.id, x]));
    expect(d.illu.decision).toBe("garde");
    expect(d.impact.decision).toBe("saute");
    expect(d.impact.raison).toBe("deux effets forts en même temps");
    expect(d.bandeau.decision).toBe("decale");
    expect(d.bandeau.debutSec).toBeCloseTo(7.5, 3);
    expect(d.acc.decision).toBe("garde");
    expect(a.rapport.courbe.length).toBe(25);
    expect(a.rapport.effetsSautes).toBe(1);
    expect(a.rapport.effetsDecales).toBe(1);
  });

  it("bruitages : au plus un toutes les 10 s, jamais dans la dernière seconde, ni sur la coupe d'un zoom, variantes sans répétition", () => {
    for (const script of SCRIPTS) {
      const r = montage(script, "equilibre");
      const b = r.sortie.bruitages;
      for (let i = 1; i < b.length; i++) expect(b[i].debutSec - b[i - 1].debutSec).toBeGreaterThanOrEqual(REGLES_BRUITAGES.intervalleMinSec - 1e-6);
      for (const x of b) {
        expect(x.debutSec + x.dureeSec).toBeLessThanOrEqual(r.dureeSec - REGLES_BRUITAGES.pasDansDerniereSec + 1e-6);
        expect(x.gainDb).toBeLessThanOrEqual(-REGLES_BRUITAGES.sousVoixDb[0]);
        expect(x.gainDb).toBeGreaterThanOrEqual(-REGLES_BRUITAGES.sousVoixDb[1]);
        expect(x.dureeSec * 1000).toBeLessThanOrEqual(REGLES_BRUITAGES.dureeMaxMs[x.declencheur] + 1e-6);
        const zooms = r.sortie.plans.filter((p) => p.cadrage.zoomFin !== undefined).map((p) => p.debutSec);
        expect(zooms.some((z) => Math.abs(z - x.debutSec) < 0.3)).toBe(false);
      }
      const parType = new Map<string, string[]>();
      for (const x of b) parType.set(x.declencheur, [...(parType.get(x.declencheur) ?? []), x.elementId]);
      for (const ids of parType.values()) for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });
});
