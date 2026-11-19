import { describe, expect, it } from "vitest";
import { CODES_PANNE_RENDUE, estPanneRendue } from "@/domaine/pannes-rendues";

describe("estPanneRendue", () => {
  it("la liste fermée contient exactement les 5 codes", () => {
    expect([...CODES_PANNE_RENDUE]).toEqual(["TABLEAU_NON_RELIE", "CAS_CONCRET_NON_RELIE", "FACECAM_NON_RELIE", "FACECAM_ANIMEE_NON_RELIE", "IV_NON_RELIE"]);
  });
  it.each(CODES_PANNE_RENDUE)("%s : vrai seulement si reessayable === true", (code) => {
    expect(estPanneRendue({ code, reessayable: true })).toBe(true);
    expect(estPanneRendue({ code, reessayable: false })).toBe(false);
    expect(estPanneRendue({ code })).toBe(false);
  });
  it.each(["TABLEAU_DECOUPAGE_NON_RELIE", "CAS_CONCRET_FICHE_REFUSEE", "PANNE_SANS_NOUVELLE", "IV_SCRIPT_A_VALIDER", "FOURNISSEUR_INDISPONIBLE", "", "tableau_non_relie"])("code voisin ou autre %s : faux", (code) => {
    expect(estPanneRendue({ code, reessayable: true })).toBe(false);
  });
  it("pas d'erreur : faux", () => {
    expect(estPanneRendue(undefined)).toBe(false);
    expect(estPanneRendue(null)).toBe(false);
    expect(estPanneRendue({ reessayable: true })).toBe(false);
  });
});

/* --- R8 · reprise bornée : fonctions pures ---------------------------------------------------- */
import { ATTENTE_MAX_MS } from "@/domaine/suivi";
import type { RepriseTravail, Travail } from "@/domaine/types";
import { entreEnAttenteRendue, estRepriseRendue, garderRepriseRendue, MARQUE_REPRISE_RENDUE, panneRendueQuiRepart, suiteDePanneRendue } from "@/domaine/pannes-rendues";

const T = Date.parse("2026-11-18T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const marquee = (extra: Partial<RepriseTravail> = {}): RepriseTravail => ({ echecs: 2, premiereLe: iso(T), prochainEssai: iso(T + 1000), derniereErreur: `${MARQUE_REPRISE_RENDUE}Phrase.`, ...extra });
const etapes = (...s: string[]) => s.map((statut, i) => ({ cle: `e${i}`, statut })) as unknown as Travail["etapes"];

describe("suiteDePanneRendue", () => {
  it("pose la marque et ne coupe pas avant 24 h", () => {
    const s = suiteDePanneRendue(undefined, T, "Phrase.");
    expect(s.abandon).toBe(false);
    expect(s.reprise).toMatchObject({ echecs: 1, premiereLe: iso(T), derniereErreur: `${MARQUE_REPRISE_RENDUE}Phrase.` });
    expect(estRepriseRendue(s.reprise)).toBe(true);
  });
  it("abandonne à premiereLe + 24 h même si attenteDepuis est récent", () => {
    const r = marquee({ echecs: 5, attenteDepuis: iso(T + 23 * 3600_000) });
    expect(suiteDePanneRendue(r, T + ATTENTE_MAX_MS - 1, "x").abandon).toBe(false);
    expect(suiteDePanneRendue(r, T + ATTENTE_MAX_MS, "x").abandon).toBe(true);
  });
  it("une reprise « crédit » n'est pas reprise : on repart d'une reprise vide", () => {
    const s = suiteDePanneRendue(marquee({ motif: "credit", echecs: 9 }), T + 5000, "x");
    expect(s.reprise.echecs).toBe(1);
    expect(s.reprise.premiereLe).toBe(iso(T + 5000));
  });
});

describe("garderRepriseRendue", () => {
  const actuel = { etapes: etapes("terminee", "en_cours"), reprise: marquee({ attenteDepuis: iso(T) }) };
  const travail = (statut: Travail["statut"], e = etapes("terminee", "en_cours")) => ({ statut, etapes: e }) as unknown as Travail;
  it("rend le MÊME objet : statut ≠ en_cours, reprise non marquée, crédit, ou 1 étape de plus terminée", () => {
    for (const t of [travail("echec"), travail("termine"), travail("en_cours", etapes("terminee", "terminee"))]) expect(garderRepriseRendue(actuel, t)).toBe(t);
    const t = travail("en_cours");
    expect(garderRepriseRendue({ ...actuel, reprise: marquee({ derniereErreur: "Panne levée" }) }, t)).toBe(t);
    expect(garderRepriseRendue({ ...actuel, reprise: marquee({ motif: "credit" }) }, t)).toBe(t);
    expect(garderRepriseRendue({ etapes: actuel.etapes, reprise: undefined }, t)).toBe(t);
  });
  it("sans vrai progrès : garde premiereLe et echecs, retire attenteDepuis", () => {
    const r = garderRepriseRendue(actuel, travail("en_cours")).reprise!;
    expect(r).toMatchObject({ echecs: 2, premiereLe: iso(T) });
    expect(r.attenteDepuis).toBeUndefined();
    expect(estRepriseRendue(r)).toBe(true);
  });
});

describe("entreEnAttenteRendue / panneRendueQuiRepart", () => {
  it("entrée : vrai pour undefined, faux pour une reprise marquée, faux si attenteDepuis présent", () => {
    expect(entreEnAttenteRendue(undefined)).toBe(true);
    expect(entreEnAttenteRendue(marquee())).toBe(false);
    expect(entreEnAttenteRendue({ ...marquee(), derniereErreur: "x", attenteDepuis: iso(T) })).toBe(false);
  });
  it("le cas concret sur l'étape « ecriture » ne repart jamais seul ; sur une autre étape, si", () => {
    const erreur = { code: "CAS_CONCRET_NON_RELIE", reessayable: true };
    const t = (cle: string) => ({ erreur, etapes: [{ cle, statut: "echec" }] }) as unknown as Travail;
    expect(panneRendueQuiRepart(t("ecriture"))).toBe(false);
    expect(panneRendueQuiRepart(t("rendu"))).toBe(true);
    expect(panneRendueQuiRepart({ erreur: { code: "TABLEAU_NON_RELIE", reessayable: true }, etapes: [{ cle: "ecriture", statut: "echec" }] } as unknown as Travail)).toBe(true);
  });
});
