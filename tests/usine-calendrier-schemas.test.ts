/**
 * L6-01 · schémas de la porte calendrier (contrat 2), alignés sur CONTRATS-ECHANGE § 3 quater, appels 4 et 5.
 * Le document n'est pas dans ce dépôt : les corps ci-dessous sont des FIXTURES fictives à la forme exacte du texte du
 * contrat (noms de champs, bornes, codes de refus). Un corps conforme au document doit passer, un corps de l'ancien
 * schéma (cle, due_at, repere, reseaux/objectifs...) doit être refusé.
 */
import { describe, expect, it } from "vitest";
import { CODES_REFUS_CALENDRIER, CONTRAT_CALENDRIER, MAX_PROPOSITIONS, RESEAUX_CALENDRIER, TYPES_PROPOSABLES, comparerVersionCadence, lireCadenceUsine, lirePropositionCalendrier, lireReponseCalendrier } from "@/domaine/usine-calendrier";
import { TYPES_CONTENU_USINE } from "@/domaine/usine";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";

// Horloge fictive : 2026-11-20 10:00 à Paris (09:00 UTC).
const MAINTENANT = new Date("2026-11-20T09:00:00Z");
const HASH = "a".repeat(64);

/** Une ligne PropositionCalendrier telle que le contrat l'écrit (appel 4). */
const ligne = (sur: Record<string, unknown> = {}) => ({
  cle_proposition: HASH,
  reseau: "linkedin",
  compte: "compte-exemple",
  type_contenu: "video",
  dueAt: "2026-11-25T09:30:00+01:00",
  jour_vise: "2026-11-25",
  origine: "usine",
  ...sur,
});
const corps = (propositions: unknown[] = [ligne()], sur: Record<string, unknown> = {}) => ({ contrat: 2, propositions, ...sur });
const refus = (c: unknown) => {
  const r = lirePropositionCalendrier(c, MAINTENANT);
  return r.ok ? null : { code: r.code, http: r.http };
};

describe("PropositionCalendrier (appel 4, contrat 2)", () => {
  it("accepte un corps conforme au document", () => {
    expect(lirePropositionCalendrier(corps(), MAINTENANT).ok).toBe(true);
    expect(CONTRAT_CALENDRIER).toBe(2);
  });
  it("accepte 1 et 10 propositions, refuse 0 et 11 (le document dit 1 à 10)", () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => ligne({ cle_proposition: String(i).padStart(64, "0") }));
    expect(MAX_PROPOSITIONS).toBe(10);
    expect(lirePropositionCalendrier(corps(n(1)), MAINTENANT).ok).toBe(true);
    expect(lirePropositionCalendrier(corps(n(10)), MAINTENANT).ok).toBe(true);
    expect(refus(corps(n(0)))).toEqual({ code: "champ_invalide", http: 400 });
    expect(refus(corps(n(11)))).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("refuse un corps de l'ancien schéma (cle, due_at, repere, signature) : 400 champ_invalide", () => {
    expect(refus(corps([{ cle: "cal-1", jour_vise: "2026-11-25", type_contenu: "video", reseau: "linkedin", compte: "linkedin:x", due_at: "2026-11-25T08:30:00Z" }]))).toEqual({ code: "champ_invalide", http: 400 });
    expect(refus(corps([ligne()], { repere: "usine:L12-3" }))).toEqual({ code: "champ_invalide", http: 400 });
    expect(refus(corps([ligne({ signature: "x" })]))).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("origine : seulement « usine » ; cle_proposition : 64 signes hexadécimaux", () => {
    expect(refus(corps([ligne({ origine: "fondateur" })]))?.code).toBe("champ_invalide");
    expect(refus(corps([ligne({ origine: undefined })]))?.code).toBe("champ_invalide");
    for (const cle_proposition of ["", "abc", "g".repeat(64), "A".repeat(64), "a".repeat(65)]) expect(refus(corps([ligne({ cle_proposition })])), cle_proposition).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("refuse une date passée et la limite exacte, accepte une seconde après (400 champ_invalide)", () => {
    expect(refus(corps([ligne({ jour_vise: "2026-11-19", dueAt: "2026-11-19T08:00:00Z" })]))).toEqual({ code: "champ_invalide", http: 400 });
    expect(refus(corps([ligne({ jour_vise: "2026-11-20", dueAt: "2026-11-20T09:00:00Z" })]))).toEqual({ code: "champ_invalide", http: 400 });
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-20", dueAt: "2026-11-20T09:00:01Z" })]), MAINTENANT).ok).toBe(true);
  });
  it("jour_vise doit être la date locale (Paris) de dueAt : 23 h 30 UTC la veille est déjà le lendemain", () => {
    expect(lirePropositionCalendrier(corps([ligne({ jour_vise: "2026-11-21", dueAt: "2026-11-20T23:30:00Z" })]), MAINTENANT).ok).toBe(true);
    expect(refus(corps([ligne({ jour_vise: "2026-11-20", dueAt: "2026-11-20T23:30:00Z" })]))).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("refuse une date illisible, inexistante ou sans décalage", () => {
    for (const dueAt of ["", "demain", "2026-02-30T08:00:00Z", "2026-11-25T08:30:00", "2026-11-25"]) expect(refus(corps([ligne({ dueAt })])), dueAt).toEqual({ code: "champ_invalide", http: 400 });
    expect(refus(corps([ligne({ jour_vise: "2026-02-30" })]))?.code).toBe("champ_invalide");
  });
  it("réseau inconnu (vide, majuscules, twitter) : 422 reseau_inconnu", () => {
    for (const reseau of ["myspace", "", "LinkedIn", "twitter"]) expect(refus(corps([ligne({ reseau })])), reseau).toEqual({ code: "reseau_inconnu", http: 422 });
  });
  it("type de contenu inactif ou inconnu (story, carrousel, image, texte, podcast, vide) : 422 type_inactif", () => {
    for (const type_contenu of ["story", "carrousel", "image", "texte", "podcast", ""]) expect(refus(corps([ligne({ type_contenu })])), type_contenu).toEqual({ code: "type_inactif", http: 422 });
  });
  it("tout champ d'état, nom de diffuseur ou montant : 400 champ_invalide", () => {
    for (const sur of [{ statut: "programme" }, { etat: "propose" }, { buffer_id: "x" }, { diffuseur: "zernio" }, { cout_estime_cents: 100 }]) expect(refus(corps([ligne(sur)])), JSON.stringify(sur)).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("contrat inconnu : 426 contrat_inconnu ; contrat absent : 400", () => {
    for (const contrat of [1, 1.1, 3, "2"]) expect(refus(corps([ligne()], { contrat })), String(contrat)).toEqual({ code: "contrat_inconnu", http: 426 });
    expect(refus({ propositions: [ligne()] })?.code).toBe("champ_invalide");
  });
  it("deux lignes de même cle_proposition dans le corps : refusées", () => {
    expect(refus(corps([ligne(), ligne()]))?.code).toBe("champ_invalide");
  });
  it("refuse null, texte, nombre, tableau", () => {
    for (const v of [null, undefined, "x", [], 12]) expect(refus(v)?.code, String(v)).toBe("champ_invalide");
  });
  it("horloge illisible : refus", () => {
    expect(lirePropositionCalendrier(corps(), new Date("x")).ok).toBe(false);
  });
});

describe("ReponseCalendrier (réponse de l'appel 4)", () => {
  const entree = (sur: Record<string, unknown> = {}) => ({
    cle_proposition: HASH,
    creneau_id: "cr-exemple-1",
    date_retenue: "2026-11-25T09:30:00+01:00",
    origine_date: "usine",
    etat_validation: "propose",
    avertissements: [],
    ...sur,
  });
  const rep = (entrees: unknown[] = [entree()], sur: Record<string, unknown> = {}) => ({ commande_id: "cmd-exemple-1", entrees, deja: false, ...sur });
  const ko = (c: unknown) => {
    const r = lireReponseCalendrier(c);
    return r.ok ? null : r.code;
  };
  it("accepte une réponse conforme au document, avec avertissements et date choisie par le fondateur", () => {
    expect(lireReponseCalendrier(rep()).ok).toBe(true);
    expect(lireReponseCalendrier(rep([entree({ origine_date: "choisie-par-le-fondateur", avertissements: ["Créneau déjà occupé."] })], { deja: true })).ok).toBe(true);
  });
  it("refuse l'ancien schéma (contrat, repere, reponses, decision, statut, due_at, motif)", () => {
    expect(ko({ contrat: 1.1, repere: "usine:L12-3", reponses: [{ cle: "a", decision: "accepte", statut: "valide" }] })).toBe("contrat_inconnu");
    expect(ko({ repere: "usine:L12-3", reponses: [{ cle: "a", decision: "accepte", statut: "valide", due_at: "2026-11-26T08:30:00Z", motif: "x" }] })).toBe("champ_invalide");
  });
  it("origine_date : un texte non vide (« usine », ou l'identifiant du fondateur donné par le contrat) ; vide, absent ou nombre refusés", () => {
    for (const origine_date of ["", undefined, 3, null]) expect(ko(rep([entree({ origine_date })])), String(origine_date)).toBe("champ_invalide");
  });
  it("refuse un champ manquant, un champ en trop, deja non booléen, avertissements non texte, date illisible", () => {
    for (const sur of [{ creneau_id: undefined }, { date_retenue: "bientôt" }, { avertissements: "x" }, { avertissements: [1] }, { etat_validation: "" }, { statut: "valide" }]) expect(ko(rep([entree(sur)])), JSON.stringify(sur)).toBe("champ_invalide");
    expect(ko(rep([entree()], { deja: "oui" }))).toBe("champ_invalide");
    expect(ko(rep([entree()], { commande_id: undefined }))).toBe("champ_invalide");
    expect(ko(rep([entree()], { repere: "usine:L1-1" }))).toBe("champ_invalide");
  });
  it("de 1 à 10 entrées ; null refusé", () => {
    expect(ko(rep([]))).toBe("champ_invalide");
    expect(ko(rep(Array.from({ length: 11 }, () => entree())))).toBe("champ_invalide");
    expect(ko(null)).toBe("champ_invalide");
  });
});

describe("CadenceUsine (appel 5, contrat 2)", () => {
  const quota = (sur: Record<string, unknown> = {}) => ({ reseau: "linkedin", type_contenu: "video", periode: "semaine", nombre: 3, ...sur });
  const cad = (quotas: unknown[] = [quota()], sur: Record<string, unknown> = {}) => ({ contrat: 2, cadence: { version: 4, regle_le: "2026-11-20T10:00:00+01:00", quotas, ...sur } });
  const ko = (c: unknown) => {
    const r = lireCadenceUsine(c);
    return r.ok ? null : { code: r.code, http: r.http };
  };
  it("accepte une cadence conforme au document", () => {
    expect(lireCadenceUsine(cad()).ok).toBe(true);
    expect(lireCadenceUsine(cad([quota({ periode: "jour", nombre: 0 }), quota({ reseau: "instagram", type_contenu: "carrousel" })])).ok).toBe(true);
  });
  it("refuse l'ancien schéma (reseaux avec heures, quota_par_jour, ecart_min_minutes ; objectifs)", () => {
    expect(ko({ contrat: 1.1, reseaux: { linkedin: { heures: ["08:30"], quota_par_jour: 1, ecart_min_minutes: 120 } }, objectifs: {} })?.code).toBe("contrat_inconnu");
    expect(ko({ contrat: 2, reseaux: { linkedin: { heures: [], quota_par_jour: 1, ecart_min_minutes: 0 } }, objectifs: {} })).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("les heures, plages et écarts sont des réglages du Studio : refusés dans la cadence", () => {
    for (const sur of [{ heures: ["08:30"] }, { ecart_min_minutes: 60 }, { plages: [] }]) expect(ko(cad([quota()], sur)), JSON.stringify(sur)).toEqual({ code: "champ_invalide", http: 400 });
    expect(ko(cad([quota({ heures: ["08:30"] })]))?.code).toBe("champ_invalide");
  });
  it("quantités seulement : aucun montant, ni en euros ni en centimes (400 champ_invalide)", () => {
    for (const sur of [{ budget_mensuel_cents: 1 }, { prix_euros: 3 }, { montant: 2 }]) expect(ko(cad([quota()], sur)), JSON.stringify(sur)).toEqual({ code: "champ_invalide", http: 400 });
    for (const q of [{ plafond_cents: 5 }, { cout_eur: 1 }]) expect(ko(cad([quota(q)])), JSON.stringify(q)).toEqual({ code: "champ_invalide", http: 400 });
    expect(ko({ ...cad(), budget_mensuel_cents: 1, mois: "2026-11" })?.code).toBe("champ_invalide");
  });
  it("nombre : entier ≥ 0 (0 permis, -1 / 1.5 / texte refusés)", () => {
    expect(lireCadenceUsine(cad([quota({ nombre: 0 })])).ok).toBe(true);
    for (const nombre of [-1, 1.5, "3", null]) expect(ko(cad([quota({ nombre })])), String(nombre)).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("période : « jour » ou « semaine » seulement", () => {
    for (const periode of ["mois", "", "Jour"]) expect(ko(cad([quota({ periode })])), periode).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("réseau inconnu : 422 reseau_inconnu ; type de contenu inconnu : 400 champ_invalide", () => {
    expect(ko(cad([quota({ reseau: "myspace" })]))).toEqual({ code: "reseau_inconnu", http: 422 });
    expect(ko(cad([quota({ type_contenu: "podcast" })]))).toEqual({ code: "champ_invalide", http: 400 });
  });
  it("version : entier ≥ 0 ; regle_le : instant ISO avec décalage ; quotas vide permis ; contrat inconnu : 426", () => {
    for (const version of [-1, 1.5, "4", undefined]) expect(ko(cad([quota()], { version }))?.code, String(version)).toBe("champ_invalide");
    for (const regle_le of ["", "2026-11-20", "2026-11-20T10:00:00", "hier"]) expect(ko(cad([quota()], { regle_le }))?.code, regle_le).toBe("champ_invalide");
    expect(lireCadenceUsine(cad([])).ok).toBe(true);
    expect(ko({ ...cad(), contrat: 3 })).toEqual({ code: "contrat_inconnu", http: 426 });
    expect(ko(null)?.code).toBe("champ_invalide");
  });
  it("version reçue : nouvelle, déjà vue (200 deja) ou périmée (409 version_perimee) face à la dernière gardée", () => {
    expect(comparerVersionCadence(null, 1)).toBe("nouvelle");
    expect(comparerVersionCadence(3, 4)).toBe("nouvelle");
    expect(comparerVersionCadence(4, 4)).toBe("deja");
    expect(comparerVersionCadence(4, 3)).toBe("perimee");
  });
});

describe("codes de refus du contrat", () => {
  it("les codes et statuts HTTP sont ceux de la liste « Erreurs stables »", () => {
    expect(CODES_REFUS_CALENDRIER).toEqual({ champ_invalide: 400, reseau_inconnu: 422, type_inactif: 422, contrat_inconnu: 426, version_perimee: 409 });
  });
});

describe("non-divergence avec le reste du Studio", () => {
  it("réseaux = taxonomie (une seule liste)", () => {
    expect([...RESEAUX_CALENDRIER]).toEqual([...RESEAUX_TAXONOMIE]);
  });
  it("types proposables = types actifs de l'usine ; story existe dans la liste, inactif", () => {
    expect([...TYPES_PROPOSABLES]).toEqual(TYPES_CONTENU_USINE.filter((t) => t.actif).map((t) => t.id));
    expect(TYPES_CONTENU_USINE.find((t) => t.id === "story")?.actif).toBe(false);
  });
});
