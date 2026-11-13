/**
 * INSTA-C · second audit : parties PURES. R1 (sélection des parcours d'un OK), V2 (plafond complet par personne), m3 (message avec adresse).
 * Données 100 % fictives.
 */
import { describe, expect, it } from "vitest";
import { choisirParcoursPourMessage, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { limitePersonneIg, parcoursAServir } from "@/domaine/guide-reseau/suivi-instagram";

const H = 3600_000;
const T0 = Date.parse("2026-03-01T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const conv = (etat: string, extra: Partial<Conversation> = {}): Conversation =>
  ({ etat, reseau: "instagram", idCompte: "c", idCommentaire: "x", creeLe: iso(T0 - 5 * H), m2Envoye: false, ...extra }) as unknown as Conversation;

describe("R1 · parcoursAServir : sélection pure des parcours d'un OK", () => {
  const entrees = (servis: string[]) => ["a", "b", "c", "d"].map((cle) => ({ cle, etat: servis.includes(cle) ? { idMessageOk: "m1" } : {} }));
  const attente = ["a", "b", "c", "d"].map((cle) => ({ cle }));
  it("4 parcours, 1 déjà servi par ce message : 2 au plus (le maximum compte le déjà servi)", () => {
    const r = parcoursAServir(entrees(["a"]), attente, "m1", 3);
    expect(r.map((x) => x.cle)).toEqual(["b", "c"]);
  });
  it("aucun déjà servi : les 3 premiers ; tous servis ou maximum atteint : rien", () => {
    expect(parcoursAServir(entrees([]), attente, "m1", 3).map((x) => x.cle)).toEqual(["a", "b", "c"]);
    expect(parcoursAServir(entrees(["a", "b", "c"]), attente, "m1", 3)).toEqual([]);
    expect(parcoursAServir(entrees(["a"]), attente, "m1", 0)).toEqual([]);
  });
  it("un autre message n'est pas « déjà servi » ; l'ordre d'arrivée est gardé", () => {
    expect(parcoursAServir(entrees(["a"]), attente, "m2", 3).map((x) => x.cle)).toEqual(["a", "b", "c"]);
  });
});

describe("V2 · plafond par personne : TOUS les messages Instagram", () => {
  const dateur = (champ: string) => limitePersonneIg([conv("attente_email", { [champ]: iso(T0 - H) } as Partial<Conversation>)], T0).nombre;
  it.each(["m2Le", "adresseRefuseeLe", "accuseLe", "merciEssaiLe"])("%s de moins de 24 h compte ; 24 h pile non", (champ) => {
    expect(dateur(champ)).toBe(1);
    expect(limitePersonneIg([conv("attente_email", { [champ]: iso(T0 - 24 * H) } as Partial<Conversation>)], T0).nombre).toBe(0);
    expect(limitePersonneIg([conv("attente_email", { [champ]: "illisible" } as Partial<Conversation>)], T0).nombre).toBe(1); // fermé
  });
  it("merci : merciEssaiLe et merciLe d'un même merci ne comptent qu'une fois", () => {
    expect(limitePersonneIg([conv("termine", { merciEssaiLe: iso(T0 - H), merciLe: iso(T0 - H) } as Partial<Conversation>)], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv("termine", { merciLe: iso(T0 - H) } as Partial<Conversation>)], T0).nombre).toBe(1);
  });
  it("essaiEnvoiLe compte QUEL QUE SOIT L'ÉTAT (guide_demande après m1_a_verifier), sans doubler un succès à la même date", () => {
    expect(limitePersonneIg([conv("guide_demande", { essaiEnvoiLe: iso(T0 - H) })], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv("attente_email", { essaiEnvoiLe: iso(T0 - H), m1Le: iso(T0 - H) })], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv("attente_email", { essaiEnvoiLe: iso(T0 - H), pasEncoreLe: iso(T0 - 2 * H), lienIgLe: iso(T0 - H) })], T0).nombre).toBe(2);
  });
  it("m1_a_verifier sans date d'essai : compté à la création (fermé) ; un parcours d'un autre réseau n'est pas compté", () => {
    expect(limitePersonneIg([conv("m1_a_verifier", { creeLe: iso(T0 - H) })], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv("attente_email", { reseau: "facebook", m2Le: iso(T0 - H), accuseLe: iso(T0 - H) } as Partial<Conversation>)], T0).nombre).toBe(0);
  });
  it("suivre + pas encore + lien + merci : 4 messages", () => {
    const l = limitePersonneIg([conv("attente_email", { m1Le: iso(T0 - 4 * H), pasEncoreLe: iso(T0 - 3 * H), lienIgLe: iso(T0 - 2 * H), merciEssaiLe: iso(T0 - H) } as Partial<Conversation>)], T0);
    expect(l.nombre).toBe(4);
    expect(l.atteint).toBe(true);
  });
});

describe("m3 · un message qui CONTIENT une adresse va au parcours attente_email", () => {
  const A = { cle: "A", etat: conv("attente_email", { m1Le: iso(T0 - 4 * H) }) };
  const B = { cle: "B", etat: conv("ig_attente_ok", { m1Le: iso(T0 - H) }) };
  it("réglage allumé + adresse : parcours attente_email ; sans adresse : parcours Instagram ; sans parcours attente_email : Instagram", () => {
    expect(choisirParcoursPourMessage([A, B], "m", "c", true, true).principal?.cle).toBe("A");
    expect(choisirParcoursPourMessage([A, B], "m", "c", true, false).principal?.cle).toBe("B");
    expect(choisirParcoursPourMessage([A, B], "m", "c", true).principal?.cle).toBe("B");
    expect(choisirParcoursPourMessage([B], "m", "c", true, true).principal?.cle).toBe("B");
  });
  it("réglage éteint : inchangé (adresse ou non)", () => {
    expect(choisirParcoursPourMessage([A, B], "m", "c", false, true).principal?.cle).toBe("A");
    expect(choisirParcoursPourMessage([A, B], "m", "c").principal?.cle).toBe("A");
  });
});
