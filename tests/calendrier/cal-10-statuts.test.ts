/**
 * CAL-10 : cycle de vie des statuts, boutons du tiroir selon l'état, verrou du passé et du publié, horloge de Paris.
 * Dépôts en mémoire, aucun appel réel, données fictives.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ refuser: false }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (session.refuser) throw new Error("Session requise");
    return { id: "s1" };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reinitialiserDepots } from "@/donnees/memoire";
import * as statuts from "@/domaine/plan-editorial/statuts";
import * as pastille from "@/components/calendrier/PastilleStatutPlan";
import { FicheEntree, type EntreeFiche } from "@/components/calendrier/FicheEntree";
import { enregistrerFicheEntreeAction } from "@/app/(studio)/calendrier/actions";
import { accepterEntree, refuserEntree, renvoyerEntreeCorrigee } from "@/app/(studio)/calendrier/actions/statuts";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";

const { TRANSITIONS_CYCLE, ETATS_INTERNES, passageAutorise, jourParis, estPasse, etatInterne, libelleStatut, boutonsTiroir, LIBELLES_ETAT } = statuts;

const AUJ = new Date("2026-11-20T10:00:00Z"); // 11 h à Paris
const creneau = (o: Partial<CreneauEditorial> = {}): CreneauEditorial => ({
  id: "c1", jourVise: "2026-12-03", heuresParReseau: { linkedin: "2026-12-03T08:00:00.000Z" }, compteCible: "compte-fictif-1", statut: "propose", decalages: 0, videoId: "v1", ...o,
});

describe("table unique des passages entre statuts", () => {
  it("les six statuts du cycle sont dans la table, avec Refusée et Manquée", () => {
    for (const e of ["propose", "refusee", "manquee", "echec", "programme", "publie"]) expect(ETATS_INTERNES).toContain(e);
    expect(Object.keys(TRANSITIONS_CYCLE).sort()).toEqual([...ETATS_INTERNES].sort());
  });
  it("passages permis : exactement ceux de la table, tout autre est refusé", () => {
    let permis = 0;
    for (const a of ETATS_INTERNES) for (const b of ETATS_INTERNES) {
      const attendu = TRANSITIONS_CYCLE[a].includes(b);
      expect([a, b, passageAutorise(a, b)]).toEqual([a, b, attendu]);
      if (attendu) permis++;
    }
    expect(permis).toBeGreaterThan(8);
    for (const [a, b] of [["publie", "propose"], ["publie", "programme"], ["propose", "programme"], ["propose", "publie"], ["refusee", "propose"], ["refusee", "a_valider"], ["manquee", "programme"], ["manquee", "publie"], ["echec", "publie"], ["programme", "propose"], ["propose", "propose"]] as const) {
      expect([a, b, passageAutorise(a, b)]).toEqual([a, b, false]);
    }
    for (const [a, b] of [["propose", "refusee"], ["a_valider", "refusee"], ["valide", "manquee"], ["manquee", "a_valider"], ["echec", "programme"], ["programme", "echec"], ["programme", "publie"]] as const) {
      expect([a, b, passageAutorise(a, b)]).toEqual([a, b, true]);
    }
  });
  it("Refusée est définitive (rien n'est supprimé, on archive) et un statut inconnu est refusé", () => {
    expect(TRANSITIONS_CYCLE.refusee).toEqual([]);
    expect(passageAutorise("inconnu", "propose")).toBe(false);
    expect(passageAutorise("propose", "inconnu")).toBe(false);
    expect(passageAutorise("", "")).toBe(false);
    expect(passageAutorise("toString", "propose")).toBe(false);
  });
  it("la table des statuts enregistrés en découle sans changer (aucune seconde table)", () => {
    expect(statuts.TRANSITIONS).toEqual({
      propose: ["a_valider", "archive"],
      a_valider: ["valide", "propose", "archive"],
      valide: ["programme", "a_valider", "archive"],
      programme: ["publie", "echec", "valide"],
      publie: ["archive"],
      echec: ["programme", "valide", "archive"],
      archive: [],
    });
  });
});

describe("état interne d'un créneau", () => {
  it("archivé avec un refus : Refusée ; archivé sans refus : Archivé", () => {
    expect(etatInterne(creneau({ statut: "archive", refuseLe: "2026-11-19T09:00:00.000Z" }), AUJ)).toBe("refusee");
    expect(etatInterne(creneau({ statut: "archive" }), AUJ)).toBe("archive");
  });
  it("jour passé (jour de Paris) et jamais parti : Manquée ; le jour même, non", () => {
    for (const statut of ["propose", "a_valider", "valide"] as const) {
      expect([statut, etatInterne(creneau({ statut, jourVise: "2026-11-19" }), AUJ)]).toEqual([statut, "manquee"]);
      expect([statut, etatInterne(creneau({ statut, jourVise: "2026-11-20" }), AUJ)]).toEqual([statut, statut]);
      expect([statut, etatInterne(creneau({ statut, jourVise: "2026-11-21" }), AUJ)]).toEqual([statut, statut]);
    }
  });
  it("programmé, publié et en échec restent ce qu'ils sont même passés", () => {
    for (const statut of ["programme", "publie", "echec"] as const) expect(etatInterne(creneau({ statut, jourVise: "2026-01-02" }), AUJ)).toBe(statut);
  });
  it("statut inconnu ou vide : null, jamais un brouillon par défaut ; jour illisible : le statut est gardé", () => {
    expect(etatInterne(creneau({ statut: "bidule" as never }), AUJ)).toBeNull();
    expect(etatInterne(creneau({ statut: "" as never }), AUJ)).toBeNull();
    expect(etatInterne(creneau({ statut: "propose", jourVise: "demain" }), AUJ)).toBe("propose");
  });
});

describe("horloge de Paris", () => {
  const cas: [string, string][] = [
    ["2026-03-28T22:30:00Z", "2026-03-28"], // 23 h 30 à Paris (hiver)
    ["2026-03-28T23:00:00Z", "2026-03-29"], // 0 h, veille du passage à l'heure d'été
    ["2026-03-29T21:59:59Z", "2026-03-29"], // 23 h 59 (été) : jour de 23 heures
    ["2026-03-29T22:00:00Z", "2026-03-30"],
    ["2026-10-24T21:59:59Z", "2026-10-24"], // 23 h 59 (été)
    ["2026-10-24T22:00:00Z", "2026-10-25"],
    ["2026-10-25T22:59:59Z", "2026-10-25"], // 23 h 59 (hiver) : jour de 25 heures
    ["2026-10-25T23:00:00Z", "2026-10-26"],
    ["2026-07-01T21:59:59Z", "2026-07-01"],
    ["2026-07-01T22:00:00Z", "2026-07-02"],
    ["2026-12-31T22:59:59Z", "2026-12-31"],
    ["2026-12-31T23:00:00Z", "2027-01-01"],
  ];
  it.each(cas)("%s → jour de Paris %s", (instant, jour) => {
    expect(jourParis(new Date(instant))).toBe(jour);
  });
  it("jour passé : strictement avant le jour de Paris, à la seconde du changement de jour", () => {
    expect(estPasse("2026-10-25", new Date("2026-10-25T22:59:59Z"))).toBe(false);
    expect(estPasse("2026-10-25", new Date("2026-10-25T23:00:00Z"))).toBe(true);
    expect(estPasse("2026-03-29", new Date("2026-03-29T21:59:59Z"))).toBe(false);
    expect(estPasse("2026-03-29", new Date("2026-03-29T22:00:00Z"))).toBe(true);
    expect(estPasse("2026-11-21", AUJ)).toBe(false);
  });
  it("une date ou une horloge illisible verrouille (passé par prudence)", () => {
    expect(estPasse("", AUJ)).toBe(true);
    expect(estPasse("2026-02-30", AUJ)).toBe(true);
    expect(estPasse("2026-11-21", new Date("n'importe quoi"))).toBe(true);
    expect(() => jourParis(new Date("n'importe quoi"))).toThrow();
  });
});

describe("une seule table état interne → libellé affiché", () => {
  it("chaque état interne a un libellé ; Échec diffuseur s'affiche « À corriger »", () => {
    for (const e of ETATS_INTERNES) expect([e, libelleStatut(e).connu]).toEqual([e, true]);
    expect(libelleStatut("echec")).toMatchObject({ libelle: "À corriger", ton: "brique" });
    expect(libelleStatut("propose").libelle).toBe("Idée de l'IA");
    expect(libelleStatut("refusee").libelle).toBe("Refusée");
    expect(libelleStatut("manquee").libelle).toBe("Manquée");
    expect(libelleStatut("programme").libelle).toBe("Programmé");
    expect(libelleStatut("publie").libelle).toBe("Publié");
  });
  it("un statut inconnu se dit tel quel : jamais « Brouillon » par défaut", () => {
    for (const s of ["bidule", "", "constructor", "__proto__", "ECHEC"]) {
      const l = libelleStatut(s);
      expect([s, l.connu, l.libelle]).toEqual([s, false, "État à vérifier"]);
    }
  });
  it("la pastille lit cette table et n'en garde aucune (mêmes objets)", () => {
    // Vue des six états affichés (pour le filtre), tirée de la table unique : aucune valeur n'est recopiée.
    expect(Object.keys(pastille.LIBELLES_ETAT)).toEqual([...statuts.ETATS_CALENDRIER]);
    for (const [k, v] of Object.entries(pastille.LIBELLES_ETAT)) expect(v).toBe((LIBELLES_ETAT as Record<string, unknown>)[k]);
    expect(pastille.STATUTS_VERS_ETAT).toBe(statuts.STATUTS_VERS_ETAT);
    const html = (etat: string, libelles?: typeof LIBELLES_ETAT) => renderToStaticMarkup(createElement(pastille.PastilleStatutPlan, { etat, libelles }));
    expect(html("echec", LIBELLES_ETAT)).toContain("À corriger");
    expect(html("manquee", LIBELLES_ETAT)).toContain("Manquée");
    expect(html("refusee", LIBELLES_ETAT)).toContain("Refusée");
    expect(html("a_corriger")).toContain("À corriger");
    expect(html("bidule", LIBELLES_ETAT)).toContain("État à vérifier");
    expect(html("bidule", LIBELLES_ETAT)).not.toContain("Brouillon");
    expect(html("bidule")).not.toContain("Brouillon");
  });
  it("Échec diffuseur → état affiché « À corriger » par la table des statuts", () => {
    expect(statuts.etatDepuisStatut("echec")).toBe("a_corriger");
    expect(pastille.libelleEtat(statuts.etatDepuisStatut("echec") as string).libelle).toBe("À corriger");
  });
});

describe("boutons du tiroir selon l'état", () => {
  const demain = "2026-11-21";
  it("bouton principal : libellés de la maquette validée", () => {
    const principal = (etat: string, jour = demain) => boutonsTiroir(etat, jour, AUJ).principal;
    expect(principal("brouillon")).toBe("Compléter le texte");
    expect(principal("a_valider")).toBe("Valider et programmer");
    expect(principal("programme")).toBe("Modifier le texte");
    expect(principal("a_corriger")).toBe("Corriger et renvoyer");
    expect(principal("echec")).toBe("Corriger et renvoyer");
    expect(principal("idee")).toBe("Accepter l'idée");
    expect(principal("brouillon", "2026-11-20")).toBe("Compléter le texte");
  });
  it("publiée ou passée : verrouillée, aucun bouton principal", () => {
    for (const etat of ["brouillon", "a_valider", "programme", "a_corriger", "echec", "idee", "manquee", "refusee"]) {
      const b = boutonsTiroir(etat, "2026-11-19", AUJ);
      expect([etat, b.principal, b.verrouille, b.raison]).toEqual([etat, null, true, "passee"]);
    }
    for (const jour of ["2026-11-19", demain]) {
      const b = boutonsTiroir("publie", jour, AUJ);
      expect([b.principal, b.verrouille, b.raison]).toEqual([null, true, "publiee"]);
    }
  });
  it("un état inconnu ou un jour illisible : verrouillé, sans bouton principal", () => {
    expect(boutonsTiroir("bidule", demain, AUJ)).toMatchObject({ principal: null, verrouille: true });
    expect(boutonsTiroir("brouillon", "demain", AUJ)).toMatchObject({ principal: null, verrouille: true, raison: "illisible" });
    expect(boutonsTiroir("", demain, AUJ)).toMatchObject({ principal: null, verrouille: true });
  });
  it("gestes secondaires selon le cas", () => {
    expect(boutonsTiroir("brouillon", demain, AUJ).secondaires).toEqual(["Dupliquer vers un autre réseau", "Retirer du calendrier"]);
    expect(boutonsTiroir("idee", demain, AUJ).secondaires).toEqual(["Dupliquer vers un autre réseau", "Refuser l'idée"]);
    expect(boutonsTiroir("publie", demain, AUJ).secondaires).toEqual(["Voir sur le réseau", "Dupliquer vers un autre réseau"]);
    expect(boutonsTiroir("manquee", "2026-11-19", AUJ).secondaires).toEqual(["Déplacer au…", "Dupliquer vers un autre réseau"]);
    expect(boutonsTiroir("brouillon", "2026-11-19", AUJ).secondaires).toEqual(["Dupliquer vers un autre réseau"]);
  });
});

describe("tiroir : la fiche branche les boutons selon l'état", () => {
  const entree = (o: Partial<EntreeFiche> = {}): EntreeFiche => ({ cle: "creneau:c1|linkedin", reseau: "linkedin", type: "video", jour: "2026-11-21", heure: "09:00", etat: "brouillon", texte: "Texte fictif", ...o }) as EntreeFiche;
  const rendre = (e: EntreeFiche, extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(FicheEntree, { entree: e, aujourdhui: "2026-11-20", action: () => {}, selonStatut: true, ...extra }));
  it("brouillon : le bouton principal de la maquette enregistre le texte", () => {
    expect(rendre(entree())).toMatch(/type="submit"[^>]*>.*Compléter le texte/);
  });
  // Le geste de l'hôte : on parcourt l'arbre rendu par la fiche (pas de DOM, pas de regex sur du texte de script).
  type Noeud = { type?: unknown; props?: Record<string, unknown> };
  const boutons = (n: unknown, sortie: Noeud[] = []): Noeud[] => {
    if (Array.isArray(n)) n.forEach((x) => boutons(x, sortie));
    else if (n && typeof n === "object") {
      const e = n as Noeud;
      if (e.props && (e.props.type === "button" || e.props.type === "submit")) sortie.push(e);
      if (e.props) boutons(e.props.children, sortie);
    }
    return sortie;
  };
  const arbre = (e: EntreeFiche, extra: Record<string, unknown> = {}) =>
    (FicheEntree as unknown as (p: Record<string, unknown>) => unknown)({ entree: e, aujourdhui: "2026-11-20", action: () => {}, selonStatut: true, ...extra });
  const enfantsTexte = (n: Noeud) => JSON.stringify(n.props?.children);
  it.each([
    ["a_valider", "Valider et programmer"],
    ["a_corriger", "Corriger et renvoyer"],
    ["programme", "Modifier le texte"],
    ["idee", "Accepter l'idée"],
  ])("%s : « %s » est un geste distinct (type bouton, rappel de l'hôte), jamais l'enregistrement du texte", (etat, libelle) => {
    const surPrincipal = vi.fn();
    const principal = boutons(arbre(entree({ etat }), { surPrincipal })).filter((b) => enfantsTexte(b).includes(libelle));
    expect(principal).toHaveLength(1);
    expect(principal[0].props?.type).toBe("button");
    expect(principal[0].props?.onClick).toBe(surPrincipal);
    (principal[0].props?.onClick as () => void)();
    expect(surPrincipal).toHaveBeenCalledTimes(1);
    expect(rendre(entree({ etat }), { surPrincipal })).not.toMatch(new RegExp(`type="submit"[^>]*>[^<]*${libelle}`));
  });
  it.each(["a_valider", "a_corriger", "idee"])("%s : le texte reste enregistrable par un bouton à part", (etat) => {
    expect(rendre(entree({ etat }), { surPrincipal: () => {} })).toMatch(/type="submit"[^>]*>.*Enregistrer le texte/);
  });
  it.each([
    ["a_valider", "Valider et programmer"],
    ["a_corriger", "Corriger et renvoyer"],
    ["programme", "Modifier le texte"],
    ["idee", "Accepter l'idée"],
  ])("%s sans rappel de l'hôte : pas de bouton mort « %s »", (etat, libelle) => {
    const h = rendre(entree({ etat }));
    expect(h).not.toContain(libelle);
    expect(boutons(arbre(entree({ etat }))).filter((b) => b.props?.type === "button" && enfantsTexte(b).includes(libelle))).toHaveLength(0);
  });
  it("publiée ou passée : aucun bouton principal", () => {
    for (const e of [entree({ etat: "publie" }), entree({ jour: "2026-11-19" }), entree({ etat: "publie", jour: "2026-11-19" })]) {
      const h = rendre(e);
      for (const mot of ["Compléter le texte", "Valider et programmer", "Modifier le texte", "Corriger et renvoyer"]) expect(h).not.toContain(mot);
      expect(h).not.toContain('type="submit"');
    }
  });
  it("sans selonStatut, la fiche garde son bouton d'avant", () => {
    expect(rendre(entree(), { selonStatut: undefined })).toMatch(/type="submit"[^>]*>.*Enregistrer le texte/);
  });
});

describe("actions : refuser et renvoyer, verrou côté serveur", () => {
  let d: ReturnType<typeof reinitialiserDepots>;
  beforeEach(() => {
    d = reinitialiserDepots();
    session.refuser = false;
    vi.useFakeTimers({ now: AUJ });
  });
  it("sans session, rien ne bouge", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau());
    session.refuser = true;
    await expect(refuserEntree("c1")).rejects.toThrow();
    await expect(renvoyerEntreeCorrigee("c1")).rejects.toThrow();
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.statut).toBe("propose");
  });
  it("refuser une proposition à venir : archivée avec le refus et le motif, jamais supprimée", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau());
    const r = await refuserEntree("c1", "  Pas le bon moment  ");
    expect(r.ok).toBe(true);
    const c = await d.creneauxEditoriaux.obtenir("c1");
    expect(c).toMatchObject({ statut: "archive", motifRefus: "Pas le bon moment" });
    expect(c?.refuseLe).toBe("2026-11-20T10:00:00.000Z");
    expect(etatInterne(c!, AUJ)).toBe("refusee");
    expect((await refuserEntree("c1")).ok).toBe(false);
  });
  it("refuser une entrée passée, programmée, publiée ou inconnue est refusé sans rien écrire", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "p", jourVise: "2026-11-19" }));
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "g", statut: "programme" }));
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "u", statut: "publie" }));
    for (const id of ["p", "g", "u", "absent"]) expect([id, (await refuserEntree(id)).ok]).toEqual([id, false]);
    expect((await d.creneauxEditoriaux.obtenir("p"))?.statut).toBe("propose");
    expect((await d.creneauxEditoriaux.obtenir("g"))?.statut).toBe("programme");
    expect((await d.creneauxEditoriaux.obtenir("u"))?.statut).toBe("publie");
  });
  it("le jour même reste refusable ; à 0 h 00 de Paris le lendemain, non", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ jourVise: "2026-10-25" }));
    vi.setSystemTime(new Date("2026-10-25T22:59:59Z"));
    expect((await refuserEntree("c1")).ok).toBe(true);
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c2", jourVise: "2026-10-25" }));
    vi.setSystemTime(new Date("2026-10-25T23:00:00Z"));
    expect((await refuserEntree("c2")).ok).toBe(false);
  });
  it("corriger et renvoyer : seul un échec à venir repasse « valide » ; le reste est refusé", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ statut: "echec" }));
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "e2", statut: "echec", jourVise: "2026-11-19" }));
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "e3", statut: "programme" }));
    expect((await renvoyerEntreeCorrigee("c1")).ok).toBe(true);
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.statut).toBe("valide");
    expect((await renvoyerEntreeCorrigee("e2")).ok).toBe(false);
    expect((await renvoyerEntreeCorrigee("e3")).ok).toBe(false);
    expect((await renvoyerEntreeCorrigee("absent")).ok).toBe(false);
    expect((await d.creneauxEditoriaux.obtenir("e2"))?.statut).toBe("echec");
    expect((await d.creneauxEditoriaux.obtenir("e3"))?.statut).toBe("programme");
  });
  it("aucun appel réseau", async () => {
    const espion = vi.spyOn(globalThis, "fetch");
    await d.creneauxEditoriaux.enregistrer(creneau());
    await refuserEntree("c1");
    expect(espion).not.toHaveBeenCalled();
  });
});

/**
 * Tableau de tous les boutons de la fiche : pour chaque statut de départ, chaque bouton rendu, son effet réel (actions
 * du dépôt en mémoire) et le statut d'arrivée attendu. Un bouton qui n'est pas dans le tableau, ou qui arrive ailleurs,
 * fait échouer le test. Aucun statut ne promet d'envoi, rien n'ouvre l'envoi : on n'arrive jamais à programmé ni publié
 * depuis un statut d'avant.
 */
describe("tableau : statut de départ, bouton, statut d'arrivée", () => {
  type Noeud = { type?: unknown; props?: Record<string, unknown> };
  const parcourir = (n: unknown, sortie: Noeud[] = []): Noeud[] => {
    if (Array.isArray(n)) n.forEach((x) => parcourir(x, sortie));
    else if (n && typeof n === "object") {
      const e = n as Noeud;
      if (e.props && (e.props.type === "button" || e.props.type === "submit")) sortie.push(e);
      if (e.props) parcourir(e.props.children, sortie);
    }
    return sortie;
  };
  const texteDe = (n: Noeud) => JSON.stringify(n.props?.children).replace(/[^\p{L}' ]/gu, "");
  const rendu = (fiche: unknown) => fiche as Noeud;

  const FUTUR = "2026-11-21";
  const PASSE = "2026-11-19";
  const JOUR_MEME = "2026-11-20";
  // [statut enregistré, jour, bouton (type), statut enregistré d'arrivée]
  const TABLEAU: ReadonlyArray<readonly [string, string, ReadonlyArray<readonly [string, "button" | "submit", string]>]> = [
    ["propose", FUTUR, [["Accepter l'idée", "button", "valide"], ["Enregistrer le texte", "submit", "propose"]]],
    ["a_valider", FUTUR, [["Valider et programmer", "button", "valide"], ["Enregistrer le texte", "submit", "a_valider"]]],
    ["valide", FUTUR, [["Compléter le texte", "submit", "a_valider"]]],
    ["programme", FUTUR, [["Modifier le texte", "button", "programme"]]],
    ["echec", FUTUR, [["Corriger et renvoyer", "button", "valide"], ["Enregistrer le texte", "submit", "echec"]]],
    ["publie", FUTUR, []],
    ["archive", FUTUR, []],
    // Le jour même, l'horloge est à 11 h Paris et le créneau à 09 h Paris : l'heure est passée, les deux gestes sont refusés
    // (CORRECTIF 12/11 17 h) ; les boutons restent affichés, le statut ne bouge pas.
    ["propose", JOUR_MEME, [["Accepter l'idée", "button", "propose"], ["Enregistrer le texte", "submit", "propose"]]],
    ["a_valider", JOUR_MEME, [["Valider et programmer", "button", "a_valider"], ["Enregistrer le texte", "submit", "a_valider"]]],
    ["propose", PASSE, []],
    ["a_valider", PASSE, []],
    ["valide", PASSE, []],
    ["programme", PASSE, []],
    ["echec", PASSE, []],
    ["publie", PASSE, []],
    ["archive", PASSE, []],
  ];
  type Ligne = readonly [depart: string, jour: string, bouton: string | null, type: "button" | "submit" | null, arrivee: string];
  const lignes: Ligne[] = TABLEAU.flatMap(([depart, jour, bs]): Ligne[] =>
    bs.length ? bs.map(([b, t, arrivee]): Ligne => [depart, jour, b, t, arrivee]) : [[depart, jour, null, null, depart]],
  );

  beforeEach(() => {
    reinitialiserDepots();
    session.refuser = false;
    vi.useFakeTimers({ now: AUJ });
  });

  it.each(lignes)("%s (%s) : bouton %s (%s) → %s", async (depart, jour, bouton, type, arrivee) => {
    const d = reinitialiserDepots();
    await d.creneauxEditoriaux.enregistrer(creneau({ statut: depart as CreneauEditorial["statut"], jourVise: jour, heuresParReseau: { linkedin: `${jour}T08:00:00.000Z` } }));
    const c = (await d.creneauxEditoriaux.obtenir("c1"))!;
    const interne = etatInterne(c, AUJ);
    const etat = (statuts.STATUTS_VERS_ETAT as Record<string, string | null>)[depart] ?? interne;
    const geste = vi.fn(async () => {
      // Hôte : chaque geste du bouton principal est relié à l'action réelle de son état.
      if (etat === "idee" || etat === "a_valider") await accepterEntree("c1");
      else if (etat === "a_corriger") await renvoyerEntreeCorrigee("c1");
      // Programmé : « Modifier le texte » attend le diffuseur (non touché) : aucun changement de statut ici.
    });
    const action = async () => void (await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte fictif modifié" }));
    const entree = { cle: "creneau:c1|linkedin", reseau: "linkedin", type: "video", jour, heure: "10:00", etat: String(etat), texte: "Texte fictif", confiee: depart === "programme" } as EntreeFiche;
    const fiche = (FicheEntree as unknown as (p: Record<string, unknown>) => unknown)({ entree, aujourdhui: "2026-11-20", action, selonStatut: true, surPrincipal: geste });
    const presents = parcourir(fiche).map((b) => [texteDe(b), b.props?.type as string] as const);

    // Les boutons rendus sont exactement ceux du tableau pour ce départ.
    const attendus = TABLEAU.find(([s, j]) => s === depart && j === jour)![2].map(([b, t]) => [b.replace(/[^\p{L}' ]/gu, ""), t] as const);
    expect(presents.filter(([, t]) => t === "button" || t === "submit")).toEqual(expect.arrayContaining(attendus));
    expect(presents).toHaveLength(attendus.length);
    if (bouton === null) {
      expect((await d.creneauxEditoriaux.obtenir("c1"))?.statut).toBe(depart);
      return;
    }

    const noeud = parcourir(fiche).find((b) => texteDe(b) === bouton.replace(/[^\p{L}' ]/gu, ""));
    if (!noeud) throw new Error(`Bouton absent : ${bouton}`);
    expect(noeud.props?.type).toBe(type);
    if (type === "button") await (noeud.props?.onClick as () => Promise<void>)();
    else await action();
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.statut).toBe(arrivee);
    // Aucun statut d'avant ne mène à l'envoi.
    if (!["programme", "publie"].includes(depart)) expect(["programme", "publie"]).not.toContain(arrivee);
  });
});

/** CORRECTIF 12/11 16 h : une entrée dont l'heure est passée (Manquée) ne passe pas à « valide » par les deux boutons. */
describe("entrée passée (Manquée) : « Accepter l'idée » et « Valider et programmer » refusés", () => {
  const PHRASE = "L'heure est passée : déplacez la publication avant de la valider";
  beforeEach(() => {
    reinitialiserDepots();
    session.refuser = false;
    vi.useFakeTimers({ now: AUJ });
  });
  it.each([
    ["Accepter l'idée", "propose"],
    ["Valider et programmer", "a_valider"],
  ] as const)("%s (départ %s, jour passé) : refus avec la phrase claire, aucune écriture", async (_bouton, depart) => {
    const d = reinitialiserDepots();
    await d.creneauxEditoriaux.enregistrer(creneau({ statut: depart, jourVise: "2026-11-19", heuresParReseau: { linkedin: "2026-11-19T08:00:00.000Z" } }));
    expect(etatInterne((await d.creneauxEditoriaux.obtenir("c1"))!, AUJ)).toBe("manquee");
    const r = await accepterEntree("c1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(PHRASE);
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.statut).toBe(depart);
  });
  it.each([
    ["Accepter l'idée", "propose"],
    ["Valider et programmer", "a_valider"],
  ] as const)("%s (départ %s, le jour même, heure passée) : même refus, même phrase, aucune écriture (CORRECTIF 12/11 17 h)", async (_bouton, depart) => {
    const d = reinitialiserDepots();
    // AUJ = 20/11 à 11 h Paris ; créneau à 09 h Paris.
    await d.creneauxEditoriaux.enregistrer(creneau({ statut: depart, jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T08:00:00.000Z" } }));
    const r = await accepterEntree("c1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(PHRASE);
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.statut).toBe(depart);
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.validePar).toBeUndefined();
  });
  it("le jour même, limite exacte : une seconde avant l'heure passe, à l'heure pile passe, une seconde après est refusée ; deux réseaux : une heure passée suffit", async () => {
    const d = reinitialiserDepots();
    const cree = (id: string, h: Record<string, string>) => d.creneauxEditoriaux.enregistrer(creneau({ id, statut: "propose", jourVise: "2026-11-20", heuresParReseau: h }));
    await cree("c1", { linkedin: "2026-11-20T12:00:00.000Z" });
    vi.setSystemTime(new Date("2026-11-20T11:59:59Z"));
    expect((await accepterEntree("c1")).ok).toBe(true);
    await cree("c2", { linkedin: "2026-11-20T12:00:00.000Z" });
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    expect((await accepterEntree("c2")).ok).toBe(true);
    await cree("c3", { linkedin: "2026-11-20T12:00:00.000Z" });
    vi.setSystemTime(new Date("2026-11-20T12:00:01Z"));
    expect((await accepterEntree("c3")).ok).toBe(false);
    await cree("c4", { linkedin: "2026-11-20T18:00:00.000Z", instagram: "2026-11-20T08:00:00.000Z" });
    expect((await accepterEntree("c4")).ok).toBe(false);
    expect((await d.creneauxEditoriaux.obtenir("c4"))?.statut).toBe("propose");
  });
  it("à la limite exacte : le jour même (minuit passé à Paris) reste ouvert, la veille à 23 h 59 Paris est refusée", async () => {
    const d = reinitialiserDepots();
    await d.creneauxEditoriaux.enregistrer(creneau({ statut: "propose", jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T08:00:00.000Z" } }));
    vi.setSystemTime(new Date("2026-11-19T23:30:00Z")); // 00 h 30 le 20/11 à Paris
    expect((await accepterEntree("c1")).ok).toBe(true);
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c2", statut: "a_valider", jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T08:00:00.000Z" } }));
    vi.setSystemTime(new Date("2026-11-20T23:00:00Z")); // 00 h le 21/11 à Paris
    const r = await accepterEntree("c2");
    expect(r.ok).toBe(false);
    expect((await d.creneauxEditoriaux.obtenir("c2"))?.statut).toBe("a_valider");
  });
  it("entrée absente, déjà publiée, programmée, en échec, refusée : refus sans écriture ; sans session : refus", async () => {
    const d = reinitialiserDepots();
    for (const [id, statut] of [["p1", "publie"], ["p2", "programme"], ["p3", "echec"], ["p4", "archive"]] as const) {
      await d.creneauxEditoriaux.enregistrer(creneau({ id, statut, jourVise: "2026-11-25", heuresParReseau: { linkedin: "2026-11-25T08:00:00.000Z" } }));
      expect((await accepterEntree(id)).ok).toBe(false);
      expect((await d.creneauxEditoriaux.obtenir(id))?.statut).toBe(statut);
    }
    expect((await accepterEntree("absent")).ok).toBe(false);
    expect((await accepterEntree("")).ok).toBe(false);
    session.refuser = true;
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "s1", statut: "propose", jourVise: "2026-11-25" }));
    await expect(accepterEntree("s1")).rejects.toThrow();
    expect((await d.creneauxEditoriaux.obtenir("s1"))?.statut).toBe("propose");
  });
  it("le bouton « Déplacer au… » reste proposé à une entrée Manquée ; il ne l'est pas à une publication publiée", () => {
    const b = boutonsTiroir("manquee", "2026-11-19", AUJ);
    expect(b.principal).toBeNull();
    expect(b.secondaires).toContain("Déplacer au…");
    expect(boutonsTiroir("publie", "2026-11-19", AUJ).secondaires).not.toContain("Déplacer au…");
  });
});
