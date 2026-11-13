/** ATR-A : décision pure de carte LinkedIn/TikTok. Jamais d'envoi. Données fictives. */
import { describe, expect, it } from "vitest";
import { decisionCopie, dejaTraitePourMot, proposerCarte, type MotDuReseau } from "@/domaine/guide-reseau/carte-manuelle";
import type { CarteATraiter } from "@/services/a-traiter-types";

const actif: MotDuReseau = { mot: "GUIDE", etat: "actif", textesValides: true };
const base = { reseau: "linkedin_page" as const, motSeul: "GUIDE", motsDuReseau: [actif], opposee: false, dejaTraite: false };

describe("proposerCarte", () => {
  const cas: Array<[string, Partial<Omit<typeof base, "motSeul">> & { motSeul?: string | null }, object]> = [
    ["opposition écrite", { motSeul: "STOP" }, { action: "silence", raison: "opposition" }],
    ["opposition écrite sur TikTok", { motSeul: "STOP", reseau: "tiktok" as never }, { action: "silence", raison: "opposition" }],
    ["personne opposée", { opposee: true }, { action: "silence", raison: "personne_opposee" }],
    ["personne opposée sans mot", { opposee: true, motSeul: null }, { action: "silence", raison: "personne_opposee" }],
    ["rien", { motSeul: null }, { action: "silence", raison: "rien" }],
    ["mot actif LinkedIn", {}, { action: "carte", motif: "mot_manuel", mot: "GUIDE", reponseAProposer: true, message: "a_fabriquer", raisonSansMessage: null }],
    ["mot en pause", { motsDuReseau: [{ ...actif, etat: "pause" }] }, { action: "carte", motif: "mot_manuel", mot: "GUIDE", reponseAProposer: false, message: "indisponible", raisonSansMessage: "mot_en_pause" }],
    ["textes non valides", { motsDuReseau: [{ ...actif, textesValides: false }] }, { action: "carte", motif: "mot_manuel", mot: "GUIDE", reponseAProposer: false, message: "indisponible", raisonSansMessage: "textes_non_valides" }],
    ["mot inconnu", { motSeul: "AUTRE" }, { action: "carte", motif: "mot_inconnu", mot: "AUTRE", reponseAProposer: false, message: "indisponible", raisonSansMessage: "mot_inconnu" }],
    ["déjà traité", { dejaTraite: true }, { action: "carte", motif: "mot_manuel", mot: "GUIDE", reponseAProposer: true, message: "indisponible", raisonSansMessage: "deja_traite_pour_ce_mot" }],
    ["TikTok : jamais de message", { reseau: "tiktok" as never }, { action: "carte", motif: "mot_manuel", mot: "GUIDE", reponseAProposer: true, message: "indisponible", raisonSansMessage: "tiktok_sans_message_prive" }],
    ["TikTok mot inconnu", { reseau: "tiktok" as never, motSeul: "AUTRE" }, { action: "carte", motif: "mot_inconnu", mot: "AUTRE", reponseAProposer: false, message: "indisponible", raisonSansMessage: "tiktok_sans_message_prive" }],
  ];
  it.each(cas)("%s", (_n, o, attendu) => {
    expect(proposerCarte({ ...base, ...o })).toEqual(attendu);
  });
  it("doute d'opposition (« STOPPER ») : silence, jamais de carte", () => {
    expect(proposerCarte({ ...base, motSeul: "STOPPER" })).toEqual({ action: "silence", raison: "opposition" });
    expect(proposerCarte({ ...base, motSeul: "ARRETMALADIE" })).toEqual({ action: "silence", raison: "opposition" });
  });
  it("aucun résultat ne porte d'action d'envoi", () => {
    for (const [, o] of cas) expect(["silence", "carte"]).toContain(proposerCarte({ ...base, ...o }).action);
  });
});

describe("decisionCopie", () => {
  const T = Date.parse("2026-11-12T12:00:00.000Z");
  const il = (h: number) => new Date(T - h * 3600_000).toISOString();
  it("sous le plafond : ok", () => expect(decisionCopie([il(1), il(2)], T)).toEqual({ ok: true }));
  it("3 copies récentes : refus", () => expect(decisionCopie([il(1), il(2), il(3)], T)).toEqual({ ok: false, raison: "plafond_24h" }));
  it("limite 24 h : une copie d'il y a 24 h pile ne compte plus, 23 h 59 oui", () => {
    expect(decisionCopie([il(24), il(2), il(3)], T)).toEqual({ ok: true });
    expect(decisionCopie([new Date(T - 24 * 3600_000 + 1000).toISOString(), il(2), il(3)], T)).toEqual({ ok: false, raison: "plafond_24h" });
  });
  it("plafond 4 : trois copies passent, quatre non", () => {
    expect(decisionCopie([il(1), il(2), il(3)], T, 4)).toEqual({ ok: true });
    expect(decisionCopie([il(1), il(2), il(3), il(4)], T, 4).ok).toBe(false);
  });
  it("instant courant illisible : refus (échec fermé)", () => {
    for (const t of [NaN, Infinity, undefined as never, "x" as never]) expect(decisionCopie([], t)).toEqual({ ok: false, raison: "plafond_24h" });
  });
  it("date illisible : compte (échec fermé)", () => {
    expect(decisionCopie(["n'importe quoi", il(1), il(2)], T)).toEqual({ ok: false, raison: "plafond_24h" });
    expect(decisionCopie([undefined as never, il(1), il(2)], T).ok).toBe(false);
  });
});

describe("dejaTraitePourMot", () => {
  const carte = (o: Partial<CarteATraiter>): CarteATraiter => ({ idEvenement: "e1", reseau: "linkedin", post: "p", lienPost: null, mot: "GUIDE", motif: "mot_manuel", extrait: "", creeLe: "2026-11-12T00:00:00.000Z", statut: "fait", kit: null, empreintes: ["emp_a"], ...o });
  it("même personne, même mot, carte faite", () => expect(dejaTraitePourMot([carte({})], ["emp_a"], "guide")).toBe(true));
  it("copie faite sans clôture", () => expect(dejaTraitePourMot([carte({ statut: "a_traiter", copieLe: "2026-11-12T00:00:00.000Z" })], ["emp_a"], "GUIDE")).toBe(true));
  it("autre personne, autre mot, carte non faite, sans empreinte : non", () => {
    expect(dejaTraitePourMot([carte({})], ["emp_b"], "GUIDE")).toBe(false);
    expect(dejaTraitePourMot([carte({})], ["emp_a"], "AUTRE")).toBe(false);
    expect(dejaTraitePourMot([carte({ statut: "a_traiter" })], ["emp_a"], "GUIDE")).toBe(false);
    expect(dejaTraitePourMot([carte({})], [], "GUIDE")).toBe(false);
  });
});
