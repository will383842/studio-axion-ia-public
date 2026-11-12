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
import { refuserEntree, renvoyerEntreeCorrigee } from "@/app/(studio)/calendrier/actions/statuts";
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
    expect(pastille.LIBELLES_ETAT).toBe(LIBELLES_ETAT);
    expect(pastille.STATUTS_VERS_ETAT).toBe(statuts.STATUTS_VERS_ETAT);
    const html = (etat: string) => renderToStaticMarkup(createElement(pastille.PastilleStatutPlan, { etat }));
    expect(html("echec")).toContain("À corriger");
    expect(html("manquee")).toContain("Manquée");
    expect(html("refusee")).toContain("Refusée");
    expect(html("bidule")).toContain("État à vérifier");
    expect(html("bidule")).not.toContain("Brouillon");
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
    expect(boutonsTiroir("manquee", "2026-11-19", AUJ).secondaires).toEqual(["Dupliquer vers un autre réseau"]);
    expect(boutonsTiroir("brouillon", "2026-11-19", AUJ).secondaires).toEqual(["Dupliquer vers un autre réseau"]);
  });
});

describe("tiroir : la fiche branche les boutons selon l'état", () => {
  const entree = (o: Partial<EntreeFiche> = {}): EntreeFiche => ({ cle: "creneau:c1|linkedin", reseau: "linkedin", type: "video", jour: "2026-11-21", heure: "09:00", etat: "brouillon", texte: "Texte fictif", ...o }) as EntreeFiche;
  const rendre = (e: EntreeFiche, extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(FicheEntree, { entree: e, aujourdhui: "2026-11-20", action: () => {}, selonStatut: true, ...extra }));
  it("brouillon, à valider, à corriger : le bouton principal est celui de la maquette", () => {
    expect(rendre(entree())).toMatch(/type="submit"[^>]*>.*Compléter le texte/);
    expect(rendre(entree({ etat: "a_valider" }))).toMatch(/type="submit"[^>]*>.*Valider et programmer/);
    expect(rendre(entree({ etat: "a_corriger" }))).toMatch(/type="submit"[^>]*>.*Corriger et renvoyer/);
  });
  it("programmé : « Modifier le texte » sans enregistrer le formulaire (type bouton)", () => {
    const h = rendre(entree({ etat: "programme" }));
    expect(h).toMatch(/type="button"[^>]*>.*Modifier le texte/);
    expect(h).not.toContain('type="submit"');
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
