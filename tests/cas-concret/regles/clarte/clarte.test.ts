/**
 * Clarté des scripts (24/10/2026) : le script réel de LT-02 (incompréhensible) est refusé, un script de référence passe,
 * et la relance de l'écriture sert un manque de clarté (jamais un appel de plus). Doubles seulement, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { controlerClarte } from "@/moteurs/montage-cas-concret/clarte";
import { ecrireFiche, ficheParGabarit, jugerFiche } from "@/moteurs/montage-cas-concret/ecriture";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsEcriture } from "@/moteurs/montage-cas-concret/outils";
import { regleAccroche } from "@/moteurs/montage-cas-concret/regles";
import { RECIT_LT02 } from "../../clarte/recits-de-test";

const FIXE = { videoId: "video-c", versionId: "version-c", habillage: "charte-duo/1", origine: "porte-a" } as const;
const { recit: _recit, ...baseSansRecit } = trouverCas("transporteur-demandes-de-cotation")!;
const base: CasConcret = baseSansRecit;
const lt02 = { ...base, recit: RECIT_LT02 };

/** Une fiche réduite à ce que lit le contrôle : le type et le texte dit de chaque écran. */
const fiche = (ecrans: [string, string][]) => ({ ecrans: ecrans.map(([type, texteDit]) => ({ type, texteDit })) }) as unknown as FicheEcrans;

/** Le script réel de LT-02 (essai du 24/10/2026), tel que lu. */
const SCRIPT_REEL = fiche([
  ["accroche", "Le poids manquant, réclamé sans rappeler. Possible."],
  ["liste-avant", "Avant : chaque demande écrite se recopie. Il faut rappeler pour le poids, puis la date. Une demande se perd dans la pile."],
  ["titre", "L'ancienne façon ne tenait plus : une automatisation réclame à votre place."],
  ["etape", "La demande arrive, d'où qu'elle vienne. Un accusé de réception part."],
  ["objet", "Tout s'enregistre au même endroit."],
  ["etape", "Puis elle est triée selon ce qui manque : poids, lieux, date."],
  ["etape", "Le demandeur reçoit un message court avec ce qui manque."],
  ["objet", "Personne ne décroche le téléphone pour réclamer le poids."],
  ["etape", "Complète, elle arrive signalée sur le téléphone de votre équipe."],
  ["objet", "Votre exploitant garde la décision : fixer le prix et accepter ou non le transport."],
  ["resultat", "Résultat : chaque jour, votre équipe chiffre des demandes complètes."],
  ["question", "Que confieriez-vous d'abord : les relances, ou la saisie ?"],
]);

/** Le script de référence : sujet dit tôt, scène, une demande suivie, trois temps, question sur le même problème. */
const SCRIPT_REFERENCE = fiche([
  ["accroche", "Vos demandes de prix arrivent sans le poids ?"],
  ["liste-avant", "Avant : un client écrit, il lui faut un camion la semaine prochaine. Ni poids, ni adresse d'enlèvement."],
  ["liste-avant", "Votre exploitant recopie, rappelle, attend. La demande dort dans la pile."],
  ["titre", "Voici ce que devient cette demande."],
  ["etape", "La demande de ce client est enregistrée au même endroit, d'où qu'elle vienne."],
  ["etape", "L'automatisation voit ce qui manque : le poids et l'adresse."],
  ["etape", "Le client reçoit aussitôt un message court qui les réclame."],
  ["etape", "Le client répond ; la demande complète arrive sur le téléphone de votre équipe."],
  ["objet", "Votre exploitant garde la main : fixer le prix et accepter ou non le transport."],
  ["resultat", "Résultat : plus personne ne rappelle pour un poids, votre équipe chiffre des demandes complètes."],
  ["question", "Et chez vous, combien de demandes de prix arrivent sans le poids ?"],
]);

/** Les 13 textes dits du script de référence, sur les 13 écrans typés du gabarit de LT-02 (les règles R02-R23 s'appliquent en entier). */
const TEXTES_REFERENCE = [
  "Vos demandes de prix arrivent sans le poids ?",
  "Avant : un client écrit, il lui faut un camion la semaine prochaine.",
  "Ni poids, ni adresse d'enlèvement.",
  "Votre exploitant recopie, rappelle, attend. La demande dort dans la pile.",
  "Voici ce que devient cette demande.",
  "La demande de ce client est enregistrée au même endroit, d'où qu'elle vienne.",
  "L'automatisation voit ce qui manque : le poids et l'adresse.",
  "Le client reçoit aussitôt un message court qui les réclame.",
  "Le client répond ; la demande complète arrive sur le téléphone de votre équipe.",
  "Votre exploitant garde la main : fixer le prix et accepter ou non le transport.",
  "Alors la demande est prête : l'exploitant fixe le prix et accepte ou non.",
  "Résultat : plus personne ne rappelle pour un poids, votre équipe chiffre des demandes complètes.",
  "Et chez vous, combien de demandes de prix arrivent sans le poids ?",
];
/** Le sujet est dit, mais les étapes parlent par pronoms (« Tout s'enregistre », « Elle est triée »). */
const TEXTES_PRONOMS = [
  ...TEXTES_REFERENCE.slice(0, 5),
  "Tout s'enregistre au même endroit, quel que soit le moyen utilisé.",
  "Elle est triée selon ce qui manque dans la fiche reçue.",
  "Elle part ensuite vers le téléphone de votre équipe.",
  "Elle attend alors la réponse écrite de la personne concernée.",
  ...TEXTES_REFERENCE.slice(9),
];
/** La fiche du gabarit (13 écrans typés), dont on remplace le texte dit et dont on refait les événements (un tous les 4 mots). */
function ficheAvecTextes(textes: string[]): FicheEcrans {
  const f = structuredClone(ficheParGabarit(lt02, FIXE));
  f.ecrans.forEach((e, i) => {
    const n = textes[i].split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
    const cibles = e.evenements.map((x) => x.cible);
    e.texteDit = textes[i];
    e.evenements = (cibles.length ? Array.from({ length: Math.floor((n - 1) / 4) }, (_, k) => ({ cible: cibles[k % cibles.length], surMot: 4 * (k + 1), avanceMs: 0 })) : []) as typeof e.evenements;
  });
  return f;
}
const ENTREE = { ...FIXE, cas: lt02 };

describe("clarté · critères C1 à C7", () => {
  it("(b) complet : le script de référence, sur ses écrans typés, passe toutes les règles (jugerFiche) et les sept critères", () => {
    const j = jugerFiche(ficheAvecTextes(TEXTES_REFERENCE), ENTREE);
    if (!j.ok) throw new Error(j.refus.join("\n"));
    expect(j.clarte, j.clarte.join("\n")).toEqual([]);
  });

  it("sujet dit mais étapes en pronoms (« Tout s'enregistre », « Elle est triée ») : valide pour les règles, refusé pour la clarté (C3)", () => {
    const j = jugerFiche(ficheAvecTextes(TEXTES_PRONOMS), ENTREE);
    if (!j.ok) throw new Error(j.refus.join("\n"));
    expect(j.clarte.join(" ")).toContain("Clarté C3");
  });

  it("C2 : une scène qui ne vient pas avant la bascule (rien de plus que les tâches « avant ») est refusée", () => {
    const f = fiche([
      ["accroche", "Vos demandes de prix arrivent sans le poids ?"],
      ["liste-avant", "Avant : vous recopiez, vous rappelez, vous attendez."],
      ["titre", "Voici ce que devient cette demande."],
      ["etape", "La demande de ce client est enregistrée au même endroit."],
      ["question", "Et chez vous, combien de demandes de prix arrivent sans le poids ?"],
    ]);
    expect(controlerClarte(f, lt02).some((m) => m.critere === "C2")).toBe(true);
  });

  it("C6 : une question sur un autre sujet que le problème est refusée, même si la scène en parle", () => {
    const f = fiche([...SCRIPT_REFERENCE.ecrans.slice(0, -1).map((e) => [e.type, e.texteDit] as [string, string]), ["question", "Et chez vous, qui recopie encore, rappelle et attend la pile ?"]]);
    expect(controlerClarte(f, lt02).some((m) => m.critere === "C6")).toBe(true);
  });

  it("(a) le script réel de LT-02 est refusé : C1, C4, C6 et C7", () => {
    const manques = controlerClarte(SCRIPT_REEL, lt02);
    const criteres = new Set(manques.map((m) => m.critere));
    for (const c of ["C1", "C4", "C6", "C7"]) expect(criteres, [...criteres].join(",")).toContain(c);
    expect(manques.find((m) => m.critere === "C1")!.detail).toContain("« prix »");
  });

  it("(b) le script de référence passe les sept critères", () => {
    expect(controlerClarte(SCRIPT_REFERENCE, lt02)).toEqual([]);
  });

  it("C4 : une phrase de moins de 3 mots est refusée, le préfixe « Avant : » ne compte pas", () => {
    const f = fiche([["accroche", "Vos demandes de prix arrivent sans le poids."], ["liste-avant", "Avant : Possible."], ["titre", "Voici la suite des étapes de cette demande."]]);
    expect(controlerClarte(f, lt02).filter((m) => m.critere === "C4").map((m) => m.detail).join()).toContain("Avant : Possible.");
  });

  it("C5 : une phrase égale au titre d'une étape du cas est refusée", () => {
    const titre = base.etapes[0].titre;
    const f = fiche([["accroche", "Vos demandes de prix arrivent sans le poids."], ["etape", `${titre}.`]]);
    expect(controlerClarte(f, lt02).some((m) => m.critere === "C5")).toBe(true);
  });

  it("C1 compare les racines (« demande » et « demandes » sont le même mot)", () => {
    const f = fiche([["accroche", "Cette demande de prix arrive sans poids."], ["liste-avant", "Avant : un client écrit pour un camion la semaine prochaine, sans adresse."], ["titre", "Voici ce que devient cette demande."]]);
    expect(controlerClarte(f, lt02).filter((m) => m.critere === "C1")).toEqual([]);
  });

  it("sans récit : seulement C4, C5 et C7, jamais C1, C2, C3 ni C6", () => {
    const criteres = controlerClarte(SCRIPT_REEL, base).map((m) => m.critere);
    expect(criteres).toContain("C4");
    for (const c of ["C1", "C2", "C3", "C6"]) expect(criteres).not.toContain(c);
  });

  it("R03 : avec un récit, l'accroche dit le sujet (et non la promesse)", () => {
    const f = ficheParGabarit(lt02, FIXE);
    const ctx = { cas: lt02, texteScript: f.ecrans.map((e) => e.texteDit).join(" ") };
    expect(regleAccroche(f, ctx)).toEqual([]);
    const sansSujet = ficheParGabarit(base, FIXE); // accroche = promesse du cas
    const m = regleAccroche(sansSujet, ctx);
    expect(m.length).toBeGreaterThan(0);
    expect(m[0].detail).toContain("le sujet du cas");
    expect(regleAccroche(sansSujet, { cas: base, texteScript: "" })).toEqual([]);
  });
});

interface Double extends OutilsEcriture {
  appels: EntreeRole[];
}
function double(reponses: object[]): Double {
  const d: Double = {
    appels: [],
    async appeler(_r: DefinitionRole, e: EntreeRole) {
      d.appels.push(e);
      const r = reponses[Math.min(d.appels.length, reponses.length) - 1];
      return { ok: true, simule: false, texte: JSON.stringify(r), stopReason: "end_turn" };
    },
    budget: {
      async reserver() {
        return { ok: true };
      },
    },
  };
  return d;
}
/** Une fiche valide mais dont la question finale n'a rien à voir avec le sujet (C6). */
function ficheFlou(): FicheEcrans {
  const f = structuredClone(ficheParGabarit(lt02, FIXE));
  const flou = ficheParGabarit(base, FIXE).ecrans.at(-1)!;
  f.ecrans[f.ecrans.length - 1] = { ...flou, id: f.ecrans.at(-1)!.id } as FicheEcrans["ecrans"][number];
  return f;
}

describe("clarté · l'écriture", () => {
  it("(c) un script flou est relancé une fois avec le manque dit, puis le clair est pris : 2 appels", async () => {
    const d = double([ficheFlou(), ficheParGabarit(lt02, FIXE)]);
    const r = await ecrireFiche({ ...FIXE, cas: lt02 }, d);
    if (!r.ok) throw new Error(`${r.message} ${r.refus.join(" | ")}`);
    expect(r.appels).toBe(2);
    expect(r.relance).toBe(true);
    expect(d.appels[1].variable).toContain("Clarté C6");
    expect(r.notes.join(" ")).not.toContain("Clarté (à voir");
  });

  it("si le flou persiste après la relance, la fiche est gardée avec une note rouge (jamais un 3e appel)", async () => {
    const d = double([ficheFlou(), ficheFlou()]);
    const r = await ecrireFiche({ ...FIXE, cas: lt02 }, d);
    if (!r.ok) throw new Error(`${r.message} ${r.refus.join(" | ")}`);
    expect(r.appels).toBe(2);
    expect(r.notes.join(" ")).toContain("Clarté (à voir avant de valider)");
  });

  it("un script clair du premier coup : un seul appel, aucune note de clarté", async () => {
    const d = double([ficheParGabarit(lt02, FIXE)]);
    const r = await ecrireFiche({ ...FIXE, cas: lt02 }, d);
    if (!r.ok) throw new Error(`${r.message} ${r.refus.join(" | ")}`);
    expect(r.appels).toBe(1);
    expect(r.notes.join(" ")).not.toContain("Clarté");
  });
});
