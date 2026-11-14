/**
 * INSTA-C · correctifs de relecture, parties PURES : liste fermée de OK (M1), plafond par personne (M2), versions ig-suivre (M5), tri des messages réglage éteint (F1).
 * Données 100 % fictives.
 */
import { describe, expect, it } from "vitest";
import { choisirParcoursPourMessage, m1AvecLien, transition, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { estOkInstagram, limitePersonneIg, PLAFOND_IG_PERSONNE } from "@/domaine/guide-reseau/suivi-instagram";

const H = 3600_000;
const T0 = Date.parse("2026-03-01T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const conv = (etat: string, extra: Partial<Conversation> = {}): Conversation =>
  ({ etat, reseau: "instagram", idCompte: "c", idCommentaire: "x", creeLe: iso(T0 - 5 * H), m2Envoye: false, ...extra }) as unknown as Conversation;

describe("M1 · liste FERMÉE de OK (message entier, après normalisation)", () => {
  it.each(["ok", "OK", "Okay", "oki", "Oui", "c'est fait", "C’est fait !", "fait", "Voilà", "done", "👍", "✅", "ok c'est fait", "Oui c est fait.", "  ok   ", "ok..."])("« %s » est un OK", (t) => expect(estOkInstagram(t)).toBe(true));
  it.each(["non merci", "pas intéressé", "c'est quoi ?", "jean.fictif@exemple.test", "ok mais non", "je ne veux pas", "", "   ", "ok ok", "Oui, c'est fait", "oui non", "👍👍", "pas fait", "okay merci", "ok https://exemple.test", "ok ?", "oui ?", "fait ?", "ok\u20e0"])("« %s » n'est PAS un OK", (t) => expect(estOkInstagram(t)).toBe(false));
});

describe("M1 · la machine ne sert un OK que s'il est reconnu", () => {
  for (const etat of ["ig_attente_ok", "ig_pas_encore"]) {
    it(`${etat} : OK reconnu → ig_ok ; sinon → ig_non_reconnu ; sans information → ig_non_reconnu`, () => {
      expect(transition(conv(etat), { t: "texte", estOpposition: false, adresse: null, okIg: true }).action).toBe("ig_ok");
      expect(transition(conv(etat), { t: "texte", estOpposition: false, adresse: null, okIg: false }).action).toBe("ig_non_reconnu");
      expect(transition(conv(etat), { t: "texte", estOpposition: false, adresse: "a@b.test", okIg: false }).action).toBe("ig_non_reconnu");
      expect(transition(conv(etat), { t: "texte", estOpposition: false, adresse: null }).action).toBe("ig_non_reconnu");
    });
  }
  it("l'opposition et le doute gardent leur chemin", () => {
    expect(transition(conv("ig_attente_ok"), { t: "texte", estOpposition: true, adresse: null, okIg: false }).action).toBe("opposer");
    expect(transition(conv("ig_attente_ok"), { t: "texte", estOpposition: false, doute: true, adresse: null, okIg: true }).action).toBe("doute");
  });
});

describe("M2 · plafond par personne : m1Le, pasEncoreLe et lienIgLe de moins de 24 h", () => {
  it("compte chaque message, tous parcours confondus", () => {
    const l = limitePersonneIg([conv("ig_pas_encore", { m1Le: iso(T0 - H), pasEncoreLe: iso(T0 - 30 * 60_000) }), conv("ig_attente_ok", { m1Le: iso(T0 - 2 * H) })], T0);
    expect(PLAFOND_IG_PERSONNE).toBe(3);
    expect(l.nombre).toBe(3);
    expect(l.atteint).toBe(true);
    expect(l.repriseMs).toBe(T0 - 2 * H + 24 * H); // le plus ancien sort de la fenêtre
  });
  it("2 messages : pas atteint ; un message de 24 h pile ou plus : non compté ; date illisible : comptée (fermé)", () => {
    expect(limitePersonneIg([conv("x", { m1Le: iso(T0 - H), lienIgLe: iso(T0 - H) })], T0).atteint).toBe(false);
    expect(limitePersonneIg([conv("x", { m1Le: iso(T0 - 24 * H) }), conv("x", { m1Le: iso(T0 - 25 * H) }), conv("x", { m1Le: iso(T0 - 1) })], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv("x", { m1Le: "pas une date" }), conv("x", { m1Le: iso(T0 - H) }), conv("x", { lienIgLe: iso(T0 - H) })], T0).atteint).toBe(true);
  });
  it("issue inconnue ou envoi interrompu : compté à la date de l'essai (échec fermé), jamais deux fois pour un succès", () => {
    const l = limitePersonneIg([conv("ig_a_verifier", { m1Le: iso(T0 - 3 * H), essaiEnvoiLe: iso(T0 - H) }), conv("m1_a_verifier", { essaiEnvoiLe: iso(T0 - 2 * H) })], T0);
    expect(l.nombre).toBe(3);
    expect(l.atteint).toBe(true);
    expect(limitePersonneIg([conv("attente_email", { m1Le: iso(T0 - 3 * H), essaiEnvoiLe: iso(T0 - H) })], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv("ig_envoi_en_vol", { creeLe: iso(T0 - 30 * H) }), conv("ig_envoi_en_vol", { creeLe: "illisible" })], T0).nombre).toBe(1);
  });
  it("4 messages : la reprise attend que 2 sortent de la fenêtre", () => {
    const l = limitePersonneIg([conv("x", { m1Le: iso(T0 - 4 * H), pasEncoreLe: iso(T0 - 3 * H), lienIgLe: iso(T0 - 2 * H) }), conv("x", { m1Le: iso(T0 - H) })], T0);
    expect(l.nombre).toBe(4);
    expect(l.repriseMs).toBe(T0 - 3 * H + 24 * H);
  });
});

describe("M5 · versions du groupe ig-suivre : jamais « adresse non reconnue »", () => {
  it("m1AvecLien reconnaît mp-ig-suivre-*", () => {
    expect(m1AvecLien("mp-ig-suivre-v1-1")).toBe(true);
    expect(m1AvecLien("mp-m1-v2")).toBe(false);
  });
  it("m1_a_verifier + version ig-suivre + texte sans adresse : silence", () => {
    const s = transition(conv("m1_a_verifier", { versionTexteM1: "mp-ig-suivre-v1-1" }), { t: "texte", estOpposition: false, adresse: null });
    expect(s.action).toBe("silence");
  });
});

describe("F1 · priorité des états Instagram : seulement réglage allumé", () => {
  const A = { cle: "A", etat: conv("attente_email", { m1Le: iso(T0 - 4 * H) }) };
  const B = { cle: "B", etat: conv("ig_attente_ok", { m1Le: iso(T0 - H) }) };
  it("éteint (défaut) : tri d'avant, les états Instagram n'existent pas pour le tri ; allumé : le parcours Instagram passe en premier", () => {
    expect(choisirParcoursPourMessage([A, B], "m", "c").principal?.cle).toBe("A"); // même un parcours Instagram plus récent
    expect(choisirParcoursPourMessage([A, B], "m", "c", false).principal?.cle).toBe("A");
    expect(choisirParcoursPourMessage([A, B], "m", "c", true).principal?.cle).toBe("B");
    const ancienIg = { cle: "B", etat: conv("ig_attente_ok", { m1Le: iso(T0 - 9 * H) }) };
    expect(choisirParcoursPourMessage([A, ancienIg], "m", "c", false).principal?.cle).toBe("A");
    expect(choisirParcoursPourMessage([A, ancienIg], "m", "c", true).principal?.cle).toBe("B");
  });
});
