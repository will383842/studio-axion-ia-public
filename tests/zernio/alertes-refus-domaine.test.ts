/** Alertes « refus d'envoi réglable » : fonction PURE. Données fictives. */
import { describe, expect, it } from "vitest";
import { CODES_MOTIF_REFUS, type CodeMotifRefus } from "@/domaine/guide-reseau/raison-refus";
import { alertesRefus, MOTIFS_REGLABLES, SOURCES_DECISION, type RefusVu } from "@/domaine/guide-reseau/alertes-refus";

const T = Date.parse("2027-03-10T12:00:00Z");
const H = 3600_000;
const J = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();
const COMPTES = [{ idCompte: "cpt-a", reseau: "facebook" }, { idCompte: "cpt-b", reseau: "facebook" }, { idCompte: "cpt-i", reseau: "instagram" }];

function refus(o: { racine?: string; idCompte?: string; reseau?: "facebook" | "instagram"; motif?: CodeMotifRefus; source?: string; statut?: number | null; il?: number }): RefusVu {
  return {
    racine: o.racine ?? "racine-1",
    idCompte: o.idCompte ?? "cpt-a",
    reseau: o.reseau ?? "facebook",
    raison: { motif: o.motif ?? "droits-manquants", statut: o.statut === undefined ? 400 : o.statut, codeClient: "refuse", meta: null, codeZernio: null, source: (o.source ?? "nombres") as never, le: iso(T - (o.il ?? 1 * H)) },
  };
}
/** Deux personnes distinctes sur le même compte. */
const deux = (o: Parameters<typeof refus>[0] = {}): RefusVu[] => [refus({ ...o, racine: "pa" }), refus({ ...o, racine: "pb" })];
const lancer = (refusVus: RefusVu[], dejaAlertees: Record<string, string> = {}) => alertesRefus({ refus: refusVus, dejaAlertees, comptesTries: COMPTES, maintenantMs: T });

describe("listes", () => {
  it("les motifs réglables existent dans CODES_MOTIF_REFUS", () => {
    for (const m of MOTIFS_REGLABLES) expect(CODES_MOTIF_REFUS as readonly string[]).toContain(m);
    expect(SOURCES_DECISION).toEqual(["nombres", "code-zernio", "statut"]);
  });
});

describe("alertesRefus", () => {
  it("10 refus du même motif et du même compte = 1 alerte", () => {
    const r = Array.from({ length: 10 }, (_, i) => refus({ racine: `p${i}` }));
    const a = lancer(r);
    expect(a).toHaveLength(1);
    expect(a[0].sujet).toBe("refus:droits-manquants:cpt-a");
  });
  it("droits-manquants : source phrase = rien, source nombres à 2 personnes = 1", () => {
    expect(lancer([refus({ source: "phrase" }), refus({ source: "phrase", racine: "p2" })])).toEqual([]);
    expect(lancer(deux({ source: "nombres" }))).toHaveLength(1);
  });
  it("R1 : un seul refus d'un motif propre au compte = aucune alerte", () => {
    expect(lancer([refus({ source: "nombres" })])).toEqual([]);
    expect(lancer([refus({ motif: "messagerie-instagram-desactivee", idCompte: "cpt-i", reseau: "instagram" })])).toEqual([]);
  });
  it("R1 : la même personne plusieurs fois = aucune alerte", () => {
    expect(lancer([refus({}), refus({ il: 2 * H })])).toEqual([]);
  });
  it("R1 : 2 personnes sur 2 comptes différents = aucune alerte", () => {
    expect(lancer([refus({ racine: "p1", idCompte: "cpt-a" }), refus({ racine: "p2", idCompte: "cpt-b" })])).toEqual([]);
  });
  it("R1 : 2 personnes sur le même compte = 1 alerte", () => {
    expect(lancer(deux())).toHaveLength(1);
  });
  it("R1 : Inbox et quota : un seul refus suffit", () => {
    expect(lancer([refus({ motif: "inbox-zernio-requise" })])).toHaveLength(1);
    expect(lancer([refus({ motif: "quota-messages-zernio" })])).toHaveLength(1);
  });
  it("R2 : jeton-expire-ou-invalide ne donne plus d'alerte", () => {
    expect(MOTIFS_REGLABLES as readonly string[]).not.toContain("jeton-expire-ou-invalide");
    expect(lancer(deux({ motif: "jeton-expire-ou-invalide" }))).toEqual([]);
  });
  it("R3 : un refus daté de plus de 60 s dans le futur n'est pas récent", () => {
    expect(lancer([refus({ motif: "inbox-zernio-requise", il: -61_000 })])).toEqual([]);
    expect(lancer([refus({ motif: "inbox-zernio-requise", il: -30_000 })])).toHaveLength(1);
    expect(lancer(deux({ il: -2 * H }))).toEqual([]);
  });
  it("sources code-zernio et statut déclenchent", () => {
    expect(lancer(deux({ source: "code-zernio" }))).toHaveLength(1);
    expect(lancer(deux({ source: "statut" }))).toHaveLength(1);
  });
  it("sources reseau et interne : jamais", () => {
    expect(lancer([...deux({ source: "reseau" }), ...deux({ source: "interne" })])).toEqual([]);
  });
  it("messagerie de la page (phrase) : 1 personne = rien", () => {
    expect(lancer([refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase" })])).toEqual([]);
  });
  it("messagerie de la page (phrase) : 2 personnes en 24 h avec 4xx = 1", () => {
    const a = lancer([refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p1" }), refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p2", il: 5 * H })]);
    expect(a).toHaveLength(1);
    expect(a[0].sujet).toBe("refus:messagerie-desactivee-sur-la-page:cpt-a");
  });
  it("messagerie de la page (phrase) : statut 5xx ou null = rien", () => {
    for (const statut of [500, null]) {
      const r = [refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p1", statut }), refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p2", statut })];
      expect(lancer(r)).toEqual([]);
    }
  });
  it("messagerie de la page (phrase) : 2 personnes sur 2 comptes différents = rien", () => {
    const r = [refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p1", idCompte: "cpt-a" }), refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p2", idCompte: "cpt-b" })];
    expect(lancer(r)).toEqual([]);
  });
  it("messagerie de la page (phrase) : 2 personnes mais à plus de 24 h d'écart du présent = rien", () => {
    const r = [refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p1", il: 30 * H }), refus({ motif: "messagerie-desactivee-sur-la-page", source: "phrase", racine: "p2", il: 31 * H })];
    expect(lancer(r)).toEqual([]);
  });
  it("messagerie de la page (phrase) : la même personne deux fois = rien", () => {
    const m = "messagerie-desactivee-sur-la-page" as const;
    expect(lancer([refus({ motif: m, source: "phrase" }), refus({ motif: m, source: "phrase", il: 2 * H })])).toEqual([]);
  });
  it("les cinq autres motifs en phrase : jamais, même à deux personnes", () => {
    for (const motif of MOTIFS_REGLABLES.filter((m) => m !== "messagerie-desactivee-sur-la-page")) {
      expect(lancer([refus({ motif, source: "phrase", racine: "p1" }), refus({ motif, source: "phrase", racine: "p2" })])).toEqual([]);
    }
  });
  it("motif non réglable = rien", () => {
    expect(lancer([...deux({ motif: "limite-meta" }), ...deux({ motif: "erreur-serveur" })])).toEqual([]);
  });
  it("alerte de moins de 7 jours : bloque", () => {
    expect(lancer(deux(), { "refus:droits-manquants:cpt-a": iso(T - 3 * J) })).toEqual([]);
  });
  it("après 7 jours et nouveau refus : repart", () => {
    const a = lancer(deux({ il: 1 * H }), { "refus:droits-manquants:cpt-a": iso(T - 8 * J) });
    expect(a).toHaveLength(1);
  });
  it("après 7 jours mais sans refus plus récent que l'alerte : rien", () => {
    expect(lancer(deux({ il: 7 * J }), { "refus:droits-manquants:cpt-a": iso(T - 7 * J) })).toEqual([]);
  });
  it("refus de plus de 7 jours = rien", () => {
    expect(lancer(deux({ il: 8 * J }))).toEqual([]);
  });
  it("Inbox et quota : sujet global (2 comptes = 1 alerte)", () => {
    for (const motif of ["inbox-zernio-requise", "quota-messages-zernio"] as const) {
      const a = lancer([refus({ motif, idCompte: "cpt-a" }), refus({ motif, idCompte: "cpt-b", racine: "p2" })]);
      expect(a).toHaveLength(1);
      expect(a[0].sujet).toBe(`refus:${motif}`);
    }
  });
  it("plafond de 3, ordre de sujet croissant", () => {
    const motifs = ["droits-manquants", "messagerie-desactivee-sur-la-page", "messagerie-instagram-desactivee", "inbox-zernio-requise", "quota-messages-zernio"] as const;
    const a = lancer(motifs.flatMap((motif) => deux({ motif, source: "nombres" })));
    expect(a).toHaveLength(3);
    expect(a.map((x) => x.sujet)).toEqual([...a.map((x) => x.sujet)].sort());
  });
  it("aucun message ne contient idCompte ni la racine", () => {
    const r = MOTIFS_REGLABLES.flatMap((motif, i) => [refus({ motif, idCompte: "cpt-secret-zzz", racine: `racine-secrete-${i}` }), refus({ motif, idCompte: "cpt-secret-zzz", racine: `racine-secrete-b${i}` })]);
    const tous = [...lancer(r), ...alertesRefus({ refus: r, dejaAlertees: {}, comptesTries: [{ idCompte: "cpt-secret-zzz", reseau: "facebook" }], maintenantMs: T })];
    expect(tous.length).toBeGreaterThan(0);
    for (const x of tous) {
      expect(x.message).not.toContain("cpt-secret-zzz");
      expect(x.message).not.toContain("racine-secrete");
    }
  });
  it("libellé : même rang que l'alerte des jetons (ids triés par réseau), sans rang quand un seul compte ou compte inconnu", () => {
    const b = lancer(deux({ idCompte: "cpt-b" }));
    expect(b[0].message.startsWith("Facebook n°2 : ")).toBe(true);
    const desordre = alertesRefus({ refus: deux({ idCompte: "cpt-a" }), dejaAlertees: {}, comptesTries: [{ idCompte: "cpt-b", reseau: "facebook" }, { idCompte: "cpt-a", reseau: "facebook" }], maintenantMs: T });
    expect(desordre[0].message.startsWith("Facebook n°1 : ")).toBe(true);
    const i = lancer(deux({ idCompte: "cpt-i", reseau: "instagram", motif: "messagerie-instagram-desactivee" }));
    expect(i[0].message.startsWith("Instagram : ")).toBe(true);
    const inconnu = alertesRefus({ refus: deux({ idCompte: "cpt-x" }), dejaAlertees: {}, comptesTries: COMPTES, maintenantMs: T });
    expect(inconnu[0].message.startsWith("Facebook : ")).toBe(true);
    const vide = alertesRefus({ refus: deux({ idCompte: "cpt-a" }), dejaAlertees: {}, comptesTries: [], maintenantMs: T });
    expect(vide[0].message.startsWith("Facebook : ")).toBe(true);
  });
  it("messages exacts", () => {
    const m = (motif: CodeMotifRefus, idCompte = "cpt-i", reseau: "facebook" | "instagram" = "instagram") => lancer(deux({ motif, idCompte, reseau }))[0].message;
    expect(m("messagerie-instagram-desactivee")).toBe("Instagram : le compte Instagram refuse l'accès aux messages privés. Dans l'application Instagram, autorisez l'accès aux messages pour les outils connectés.");
    expect(m("droits-manquants", "cpt-a", "facebook")).toBe("Facebook n°1 : Zernio n'a pas le droit d'envoyer des messages pour cette page. Reconnectez le compte dans Zernio en acceptant toutes les autorisations demandées.");
    expect(m("inbox-zernio-requise")).toBe("Le module Inbox de Zernio n'est pas activé : activez-le dans votre abonnement Zernio.");
    expect(m("quota-messages-zernio")).toBe("Le quota de messages de Zernio est épuisé : augmentez-le dans votre abonnement Zernio ou attendez sa remise à zéro.");
    const page = lancer(deux({ motif: "messagerie-desactivee-sur-la-page", source: "nombres", idCompte: "cpt-b" }))[0].message;
    expect(page).toBe("Facebook n°2 : d'après le message du réseau, la messagerie de la page semble désactivée. Activez la messagerie dans les réglages de la page.");
  });
});
