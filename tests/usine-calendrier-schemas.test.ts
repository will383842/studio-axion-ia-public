import { describe, expect, it } from "vitest";
import { CONTRAT_CALENDRIER_PROPOSITION, CONTRAT_CALENDRIER_REPONSE, lireCadenceUsine, lirePropositionCalendrier, lireReponseCalendrier, TYPES_PROPOSABLES, RESEAUX_CALENDRIER } from "@/domaine/usine-calendrier";
import { TYPES_CONTENU_USINE } from "@/domaine/usine";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import { STATUTS_PLAN } from "@/domaine/plan-editorial/statuts";

// Horloge fictive : 2026-11-20 10:00 à Paris (09:00 UTC).
const MAINTENANT = new Date("2026-11-20T09:00:00Z");

const ligne = (sur: Record<string, unknown> = {}) => ({
  cle: "cal-0001",
  jour_vise: "2026-11-25",
  type_contenu: "video",
  reseau: "linkedin",
  compte: "linkedin:compte-exemple",
  due_at: "2026-11-25T08:30:00Z",
  ...sur,
});
const corps = (lignes: unknown[] = [ligne()], sur: Record<string, unknown> = {}) => ({ contrat: CONTRAT_CALENDRIER_PROPOSITION, repere: "usine:L12-3", propositions: lignes, ...sur });

describe("PropositionCalendrier", () => {
  it("accepte une proposition valide", () => {
    const r = lirePropositionCalendrier(corps(), MAINTENANT);
    expect(r.ok).toBe(true);
  });
  it("refuse une date passée, et la limite exacte (maintenant)", () => {
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-19", due_at: "2026-11-19T08:00:00Z" })]), MAINTENANT).ok).toBe(false);
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-20", due_at: "2026-11-20T09:00:00Z" })]), MAINTENANT).ok).toBe(false);
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-20", due_at: "2026-11-20T09:00:01Z" })]), MAINTENANT).ok).toBe(true);
  });
  it("juge le jour à Paris : 23h30 UTC la veille est déjà le lendemain à Paris", () => {
    const r = lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-21", due_at: "2026-11-20T23:30:00Z" })]), MAINTENANT);
    expect(r.ok).toBe(true);
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-20", due_at: "2026-11-20T23:30:00Z" })]), MAINTENANT).ok).toBe(false);
  });
  it("refuse une date illisible, inexistante ou sans décalage", () => {
    for (const due_at of ["", "demain", "2026-02-30T08:00:00Z", "2026-11-25T08:30:00", "2026-11-25"]) {
      expect(lirePropositionCalendrier(corps([ligne({ due_at })]), MAINTENANT).ok, due_at).toBe(false);
    }
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-02-30" })]), MAINTENANT).ok).toBe(false);
  });
  it("refuse un réseau inconnu (et vide, et majuscules)", () => {
    for (const reseau of ["myspace", "", "LinkedIn", "twitter"]) {
      expect(lirePropositionCalendrier(corps([ligne({ reseau, compte: `${reseau}:x` })]), MAINTENANT).ok, reseau).toBe(false);
    }
  });
  it("refuse un type inactif ou inconnu, dont story", () => {
    for (const type_contenu of ["story", "carrousel", "image", "texte", "podcast", ""]) {
      expect(lirePropositionCalendrier(corps([ligne({ type_contenu })]), MAINTENANT).ok, type_contenu).toBe(false);
    }
  });
  it("refuse un compte d'un autre réseau", () => {
    expect(lirePropositionCalendrier(corps([ligne({ compte: "instagram:compte-exemple" })]), MAINTENANT).ok).toBe(false);
  });
  it("refuse un champ en trop (montant compris), un contrat inconnu, une liste vide ou trop longue", () => {
    expect(lirePropositionCalendrier(corps([ligne({ cout_estime_cents: 100 })]), MAINTENANT).ok).toBe(false);
    expect(lirePropositionCalendrier(corps([ligne({ statut: "programme" })]), MAINTENANT).ok).toBe(false);
    expect(lirePropositionCalendrier(corps([], {}), MAINTENANT).ok).toBe(false);
    expect(lirePropositionCalendrier(corps([ligne()], { contrat: 3 }), MAINTENANT).ok).toBe(false);
    expect(lirePropositionCalendrier(corps(Array.from({ length: 101 }, (_, i) => ligne({ cle: `c${i}` }))), MAINTENANT).ok).toBe(false);
  });
  it("refuse deux lignes de même clé (rejeu dans le même corps)", () => {
    expect(lirePropositionCalendrier(corps([ligne(), ligne()]), MAINTENANT).ok).toBe(false);
  });
  it("refuse null, texte et tableau", () => {
    for (const v of [null, undefined, "x", [], 12]) expect(lirePropositionCalendrier(v, MAINTENANT).ok).toBe(false);
  });
});

describe("ReponseCalendrier", () => {
  const rep = (sur: Record<string, unknown> = {}) => ({ cle: "cal-0001", decision: "accepte", statut: "valide", ...sur });
  const c = (reponses: unknown[] = [rep()], sur: Record<string, unknown> = {}) => ({ contrat: CONTRAT_CALENDRIER_REPONSE, repere: "usine:L12-3", reponses, ...sur });
  it("accepte accepté, refusé avec motif, décalé avec nouvelle date", () => {
    expect(lireReponseCalendrier(c()).ok).toBe(true);
    expect(lireReponseCalendrier(c([rep({ decision: "refuse", statut: "archive", motif: "Pas ce jour-là" })])).ok).toBe(true);
    expect(lireReponseCalendrier(c([rep({ decision: "decale", statut: "valide", due_at: "2026-11-26T08:30:00Z" })])).ok).toBe(true);
  });
  it("refuse un statut hors du tableau, une décision inconnue, un décalage sans date, un motif trop long", () => {
    expect(lireReponseCalendrier(c([rep({ statut: "envoye" })])).ok).toBe(false);
    expect(lireReponseCalendrier(c([rep({ decision: "peut-etre" })])).ok).toBe(false);
    expect(lireReponseCalendrier(c([rep({ decision: "decale" })])).ok).toBe(false);
    expect(lireReponseCalendrier(c([rep({ decision: "refuse", statut: "archive", motif: "x".repeat(301) })])).ok).toBe(false);
    expect(lireReponseCalendrier(c([rep({ decision: "decale", due_at: "bientôt" })])).ok).toBe(false);
  });
  it("refuse contrat inconnu et corps vide", () => {
    expect(lireReponseCalendrier(c([rep()], { contrat: 2 })).ok).toBe(false);
    expect(lireReponseCalendrier(c([])).ok).toBe(false);
    expect(lireReponseCalendrier(null).ok).toBe(false);
  });
});

describe("CadenceUsine", () => {
  const cad = (sur: Record<string, unknown> = {}) => ({
    contrat: CONTRAT_CALENDRIER_REPONSE,
    reseaux: { linkedin: { heures: ["08:30", "12:00"], quota_par_jour: 1, ecart_min_minutes: 120 } },
    objectifs: { video: { quantite: 3, periode: "semaine" } },
    ...sur,
  });
  it("accepte une cadence en quantités", () => {
    expect(lireCadenceUsine(cad()).ok).toBe(true);
  });
  it("refuse réseau inconnu, heure illisible, quota négatif ou non entier, quantité trop grande", () => {
    expect(lireCadenceUsine(cad({ reseaux: { myspace: { heures: [], quota_par_jour: 1, ecart_min_minutes: 0 } } })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: ["25:00"], quota_par_jour: 1, ecart_min_minutes: 0 } } })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: ["8h30"], quota_par_jour: 1, ecart_min_minutes: 0 } } })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: [], quota_par_jour: -1, ecart_min_minutes: 0 } } })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: [], quota_par_jour: 1.5, ecart_min_minutes: 0 } } })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ objectifs: { video: { quantite: 1000, periode: "semaine" } } })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ objectifs: { video: { quantite: 1, periode: "mois" } } })).ok).toBe(false);
  });
  it("refuse tout montant ou plafond en euros (quantités seulement)", () => {
    expect(lireCadenceUsine(cad({ budget_mensuel_cents: 1 })).ok).toBe(false);
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: [], quota_par_jour: 1, ecart_min_minutes: 0, plafond_cents: 5 } } })).ok).toBe(false);
  });
  it("accepte vide aux limites (quota 0, aucune heure) et refuse heures en double", () => {
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: [], quota_par_jour: 0, ecart_min_minutes: 0 } } })).ok).toBe(true);
    expect(lireCadenceUsine(cad({ reseaux: { linkedin: { heures: ["08:30", "08:30"], quota_par_jour: 1, ecart_min_minutes: 0 } } })).ok).toBe(false);
  });
});

describe("non-divergence du schéma avec le reste du Studio", () => {
  it("réseaux = taxonomie (une seule liste)", () => {
    expect([...RESEAUX_CALENDRIER]).toEqual([...RESEAUX_TAXONOMIE]);
  });
  it("types proposables = types actifs de l'usine ; story existe dans la liste, inactif", () => {
    expect([...TYPES_PROPOSABLES]).toEqual(TYPES_CONTENU_USINE.filter((t) => t.actif).map((t) => t.id));
    expect(TYPES_CONTENU_USINE.find((t) => t.id === "story")?.actif).toBe(false);
  });
  it("statuts de la réponse = statuts du plan", () => {
    for (const s of STATUTS_PLAN) expect(lireReponseCalendrier({ contrat: CONTRAT_CALENDRIER_REPONSE, repere: "usine:L1-1", reponses: [{ cle: "a", decision: "accepte", statut: s }] }).ok, s).toBe(true);
  });
});
