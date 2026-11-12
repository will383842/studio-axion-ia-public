/** MG-LIAISON fiche B · fonctions pures : clés de parcours, décision d'un commentaire, choix du message. Données fictives. */
import { describe, expect, it } from "vitest";
import {
  aliasDe,
  cleParcours,
  dossierDe,
  partieCible,
  racineDe,
  racinesConnues,
} from "@/domaine/guide-reseau/cles-parcours";
import { GROUPES_MP } from "@/domaine/guide-reseau/textes-mp";
import {
  choisirParcoursPourMessage,
  cibleLivree,
  deciderCommentaire,
  m1AvecLien,
  type Conversation,
} from "@/domaine/guide-reseau/machine-conversation";

const NOW = Date.parse("2026-10-18T12:00:00.000Z");
const H = 3600_000;
const iso = (ageMs: number) => new Date(NOW - ageMs).toISOString();
const rec = (o: Partial<Conversation> = {}): Conversation => ({
  etat: "nouveau",
  reseau: "instagram",
  idCompte: "c",
  idCommentaire: "com-1",
  idPostPlateforme: "p",
  versionTexteM1: "mp-m1-v4-1",
  guide: "guide-ia",
  cleIdempotenceGuide: "a".repeat(64),
  creeLe: iso(H),
  m1Le: null,
  occurredAt: null,
  m2Envoye: false,
  essaisSite: 0,
  essaisPub: 0,
  essaisM1: 0,
  prochainEssaiLe: null,
  dernierCode: null,
  alias: [],
  ...o,
});
const e = (cle: string, o: Partial<Conversation> = {}) => ({
  cle,
  etat: rec(o),
});
const ev = (o: Partial<{ idCommentaire: string; ageMs: number }> = {}) => ({
  idCommentaire: "com-2",
  ageMs: 1000,
  maintenantMs: NOW,
  ...o,
});
const opt = { plafondPersonneJour: 3 };
const envoye = (ageMs: number, o: Partial<Conversation> = {}) =>
  rec({
    etat: "attente_email",
    creeLe: iso(ageMs + 60_000),
    m1Le: iso(ageMs),
    idCommentaire: "com-0",
    ...o,
  });

describe("clés de parcours", () => {
  it("racineDe / cleParcours", () => {
    expect(racineDe("r1|abc")).toBe("r1");
    expect(racineDe("r1")).toBe("r1");
    expect(racineDe("r1|a|b")).toBe("r1");
    expect(cleParcours("r1", "b".repeat(64))).toBe(`r1|${"b".repeat(32)}`);
  });
  const conv = {
    r1: rec({ alias: ["x1", "x2"] }),
    "r1|k": rec(),
    r1x: rec(),
    "r2|k": rec(),
    r3: rec(),
  };
  it("racinesConnues et dossierDe (ancienne clé incluse, préfixe voisin exclu)", () => {
    expect(racinesConnues(conv)).toEqual(["r1", "r1x", "r2", "r3"]);
    expect(dossierDe("r1", conv).map((d) => d.cle)).toEqual(["r1", "r1|k"]);
    expect(dossierDe("r2", conv).map((d) => d.cle)).toEqual(["r2|k"]);
    expect(dossierDe("zz", conv)).toEqual([]);
  });
  it("aliasDe : ancien enregistrement + table, sans doublon", () => {
    expect(aliasDe("r1", conv, { x2: "r1", y: "r1", z: "r2" }).sort()).toEqual([
      "x1",
      "x2",
      "y",
    ]);
    expect(aliasDe("r2", conv, { z: "r2" })).toEqual(["z"]);
    expect(aliasDe("r9", conv, {})).toEqual([]);
  });
});

describe("m1AvecLien", () => {
  it("les messages de renvoi avec lien comptent comme des messages avec lien", () => {
    expect(m1AvecLien("mp-deja-envoye-v1-1")).toBe(true);
    expect(m1AvecLien("mp-lien-v3-2")).toBe(true);
    for (const v of GROUPES_MP["lien-rappel"]) expect(m1AvecLien(v)).toBe(true);
    expect(m1AvecLien("mp-lien-v3-99")).toBe(false);
    expect(m1AvecLien("mp-m1-v4-1")).toBe(true);
    expect(m1AvecLien("mp-m1-v3")).toBe(true);
    expect(m1AvecLien("mp-m1-v2")).toBe(false);
    expect(m1AvecLien(null)).toBe(false);
  });
});

describe("deciderCommentaire", () => {
  it("R0 : un enregistrement opposé => silence", () => {
    const T = [e("r|1", { etat: "oppose" }), e("r|2", { etat: "termine" })];
    expect(deciderCommentaire(T, [T[1]], ev(), opt)).toMatchObject({
      action: "silence",
      raison: "oppose",
    });
  });
  it("R1 : même commentaire => reprendre (nouveau, pub_ok), sinon silence deja_traite", () => {
    for (const etat of ["nouveau", "pub_ok"] as const) {
      const T = [e("r|1", { etat, idCommentaire: "com-2" })];
      expect(deciderCommentaire(T, T, ev(), opt).action).toBe("reprendre");
    }
    const T = [e("r|1", { etat: "termine", idCommentaire: "com-2" })];
    expect(deciderCommentaire(T, T, ev(), opt)).toMatchObject({
      action: "silence",
      raison: "deja_traite",
    });
  });
  it("R2 : cible sans enregistrement => démarrer, ou périmé après 24 h", () => {
    expect(deciderCommentaire([], [], ev(), opt).action).toBe("demarrer");
    expect(deciderCommentaire([], [], ev({ ageMs: 25 * H }), opt).action).toBe(
      "perime",
    );
  });
  it("R3 : enregistrement en cours (nouveau, pub_ok, m1_en_vol) => public seul", () => {
    for (const etat of ["nouveau", "pub_ok", "m1_en_vol"] as const) {
      const D = [e("r|1", { etat, idCommentaire: "com-0" })];
      expect(deciderCommentaire(D, D, ev(), opt)).toMatchObject({
        action: "public_seul",
        raison: "en_cours",
      });
    }
  });
  it("R4 : sans date d'envoi, un m1_refuse récent => public seul, sinon R2", () => {
    const frais = [
      e("r|1", {
        etat: "m1_refuse",
        idCommentaire: "com-0",
        refuseLe: iso(2 * H),
        creeLe: iso(30 * H),
      }),
    ];
    expect(deciderCommentaire(frais, frais, ev(), opt).action).toBe(
      "public_seul",
    );
    const vieux = [
      e("r|1", {
        etat: "m1_refuse",
        idCommentaire: "com-0",
        refuseLe: iso(30 * H),
        creeLe: iso(31 * H),
      }),
    ];
    expect(deciderCommentaire(vieux, vieux, ev(), opt).action).toBe("demarrer");
    expect(
      deciderCommentaire(vieux, vieux, ev({ ageMs: 30 * H }), opt).action,
    ).toBe("perime");
  });
  it("R4 : m1_a_verifier prend creeLe comme date d'envoi", () => {
    const D = [
      e("r|1", {
        etat: "m1_a_verifier",
        idCommentaire: "com-0",
        creeLe: iso(2 * H),
        m1Le: null,
      }),
    ];
    expect(deciderCommentaire(D, D, ev(), opt).action).toBe("public_seul");
  });
  it("R5 : cible livrée", () => {
    expect(cibleLivree(rec({ etat: "guide_demande" }))).toBe(true);
    expect(cibleLivree(rec({ etat: "termine" }))).toBe(true);
    expect(cibleLivree(rec({ etat: "attente_email" }))).toBe(false);
    const recent = [{ cle: "r|1", etat: envoye(5 * H, { etat: "termine" }) }];
    expect(deciderCommentaire(recent, recent, ev(), opt).action).toBe(
      "public_seul",
    );
    const ancien = [
      { cle: "r|1", etat: envoye(30 * H, { etat: "guide_demande" }) },
    ];
    expect(deciderCommentaire(ancien, ancien, ev(), opt)).toMatchObject({
      action: "renvoyer",
      groupe: "deja-envoye",
    });
  });
  it("R5 : cible non livrée", () => {
    const recent = [{ cle: "r|1", etat: envoye(40 * H) }];
    expect(deciderCommentaire(recent, recent, ev(), opt).action).toBe(
      "public_seul",
    );
    const ancien = [{ cle: "r|1", etat: envoye(50 * H) }];
    expect(deciderCommentaire(ancien, ancien, ev(), opt)).toMatchObject({
      action: "renvoyer",
      groupe: "lien-rappel",
    });
  });
  it("R6 : plafond de la personne sur 24 h => public seul avant démarrer / renvoyer", () => {
    const D = [{ cle: "r|1", etat: envoye(50 * H) }];
    const T = [
      ...D,
      e("r|2", { etat: "termine", m1Le: iso(2 * H) }),
      e("r|3", { etat: "termine", m1Le: iso(3 * H) }),
      e("r|4", { etat: "termine", m1Le: iso(4 * H) }),
    ];
    expect(deciderCommentaire(T, D, ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "plafond_personne",
    });
    expect(deciderCommentaire(T.slice(1), [], ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "plafond_personne",
    });
    expect(
      deciderCommentaire(T.slice(1), [], ev(), { plafondPersonneJour: 4 })
        .action,
    ).toBe("demarrer");
  });
  it("R7 : renvoyer sur un commentaire de plus de 24 h => périmé", () => {
    const D = [{ cle: "r|1", etat: envoye(50 * H) }];
    expect(deciderCommentaire(D, D, ev({ ageMs: 25 * H }), opt).action).toBe(
      "perime",
    );
  });
  it("deux mots vers la même cible : pas de 2e envoi", () => {
    const D = [
      {
        cle: "r|1",
        etat: envoye(10 * 60_000, { mot: "GUIDE", nature: "premier" }),
      },
    ];
    expect(
      deciderCommentaire(D, D, ev({ idCommentaire: "com-autre-mot" }), opt)
        .action,
    ).toBe("public_seul");
  });
  it("deux mots vers la même cible : D calculé par partieCible", () => {
    const T = [
      e("r|1", {
        etat: "attente_email",
        m1Le: iso(10 * 60_000),
        mot: "GUIDE",
        nature: "premier",
        guide: "guide-ia",
      }),
      e("r|2", { etat: "termine", m1Le: iso(10 * H), guide: "autre-guide" }),
    ];
    const D = partieCible(T, "guide-ia");
    expect(D.map((x) => x.cle)).toEqual(["r|1"]);
    expect(
      deciderCommentaire(T, D, ev({ idCommentaire: "com-autre-mot" }), opt)
        .action,
    ).toBe("public_seul");
  });
  it("ancien enregistrement sans mot ni nature : décidé comme les autres", () => {
    const ancien = envoye(10 * 60_000);
    expect(ancien.mot).toBeUndefined();
    expect(ancien.nature).toBeUndefined();
    const D = [{ cle: "racine", etat: ancien }];
    expect(deciderCommentaire(D, D, ev(), opt).action).toBe("public_seul");
  });
});

describe("correctifs de relecture", () => {
  it("m1_consommee récent : pas de 2e message privé (passe par R5 non livrée)", () => {
    const D = [
      e("r|1", {
        etat: "m1_consommee",
        idCommentaire: "com-0",
        creeLe: iso(5 * 60_000),
        m1Le: null,
      }),
    ];
    expect(deciderCommentaire(D, D, ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "deja_envoye",
    });
    const vieux = [
      e("r|1", {
        etat: "m1_consommee",
        idCommentaire: "com-0",
        creeLe: iso(50 * H),
      }),
    ];
    expect(deciderCommentaire(vieux, vieux, ev(), opt)).toMatchObject({
      action: "renvoyer",
      groupe: "lien-rappel",
    });
  });
  it("doute d'opposition sur une autre cible : jamais demarrer ni renvoyer", () => {
    const doute = e("r|9", {
      etat: "termine",
      guide: "autre-guide",
      m1Le: iso(100 * H),
      douteOpposition: true,
    });
    const vide = [doute];
    expect(deciderCommentaire(vide, [], ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "doute_opposition",
    });
    const D = [{ cle: "r|1", etat: envoye(50 * H) }];
    expect(deciderCommentaire([...D, doute], D, ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "doute_opposition",
    });
  });
  it("R4 : ancien m1_refuse sans refuseLe => date de création", () => {
    const recent = [
      e("r|1", {
        etat: "m1_refuse",
        idCommentaire: "com-0",
        creeLe: iso(2 * H),
        refuseLe: null,
      }),
    ];
    expect(deciderCommentaire(recent, recent, ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "deja_envoye",
    });
    const vieux = [
      e("r|1", {
        etat: "m1_refuse",
        idCommentaire: "com-0",
        creeLe: iso(30 * H),
      }),
    ];
    expect(deciderCommentaire(vieux, vieux, ev(), opt).action).toBe("demarrer");
  });
  it("R6 : plafond illisible (NaN, undefined) => atteint par prudence", () => {
    for (const p of [Number.NaN, undefined, Infinity]) {
      const o = { plafondPersonneJour: p as unknown as number };
      expect(deciderCommentaire([], [], ev(), o)).toMatchObject({
        action: "public_seul",
        raison: "plafond_personne",
      });
    }
  });
  it("m1AvecLien reconnaît tout identifiant du groupe lien-rappel du dictionnaire", () => {
    for (const id of GROUPES_MP["lien-rappel"])
      expect(m1AvecLien(id), id).toBe(true);
  });
});

describe("partieCible", () => {
  it("garde les enregistrements de la cible, l'ancien (guide absent) = guide-ia", () => {
    const a = e("r|1", { guide: "guide-ia", titreCible: "Guide IA" });
    const b = e("r|2", { guide: "autre" });
    const ancien = e("r", {});
    (ancien.etat as { guide?: string }).guide = undefined;
    expect(partieCible([a, b, ancien], "guide-ia")).toEqual([a, ancien]);
    expect(partieCible([a, b, ancien], "autre")).toEqual([b]);
    expect(partieCible([], "guide-ia")).toEqual([]);
  });
});

describe("choisirParcoursPourMessage", () => {
  const A = e("r|a", {
    etat: "guide_demande",
    idMessageGuide: "m-1",
    m1Le: iso(10 * H),
  });
  const B = e("r|b", { etat: "attente_email", m1Le: iso(2 * H) });
  const C = e("r|c", { etat: "m2_envoye", m1Le: iso(5 * H) });
  const Z = e("r|z", {
    etat: "attente_email",
    idCompte: "autre",
    m1Le: iso(1 * H),
  });
  it("1 enregistrement", () => {
    expect(choisirParcoursPourMessage([B], "m-9", "c")).toEqual({
      principal: B,
      tous: [B],
    });
  });
  it("2 enregistrements : guide_demande portant le message, sinon le plus récent accepté", () => {
    expect(choisirParcoursPourMessage([B, A], "m-1", "c").principal).toBe(A);
    expect(choisirParcoursPourMessage([A, B], "m-9", "c").principal).toBe(B);
  });
  it("3 enregistrements : compte, états acceptés, repli", () => {
    expect(choisirParcoursPourMessage([A, B, C], "m-9", "c").principal).toBe(B);
    expect(choisirParcoursPourMessage([Z, A, C], "m-9", "c").principal).toBe(C);
    const fini = e("r|f", { etat: "termine", m1Le: iso(1 * H) });
    expect(choisirParcoursPourMessage([A, fini, Z], "m-9", "c").principal).toBe(
      fini,
    );
    // Aucun parcours du même compte : jamais de repli sur le parcours d'un autre compte.
    expect(choisirParcoursPourMessage([Z, B], "m-9", "inconnu")).toEqual({
      principal: null,
      tous: [],
    });
    expect(choisirParcoursPourMessage([], "m-9", "c")).toEqual({
      principal: null,
      tous: [],
    });
    expect(choisirParcoursPourMessage([A, B, C, Z], "m-9", "c").tous).toEqual([
      A,
      B,
      C,
    ]);
  });
});

describe("enregistrements sans m1Le (adresse reçue depuis m1_a_verifier)", () => {
  for (const etat of [
    "guide_demande",
    "termine",
    "site_refuse",
    "expire",
  ] as const) {
    it(`${etat} sans m1Le, récent : jamais de nouveau premier message`, () => {
      const T = [
        e("r|1", {
          etat,
          m1Le: null,
          creeLe: iso(10 * 60_000),
          idCommentaire: "com-0",
        }),
      ];
      const d = deciderCommentaire(T, T, ev(), opt);
      expect(d.action).not.toBe("demarrer");
      expect(["public_seul", "renvoyer"]).toContain(d.action);
    });
  }
  it("plafond : trois enregistrements termine sans m1Le récents => plafond_personne", () => {
    const T = [1, 2, 3].map((i) =>
      e(`r|${i}`, {
        etat: "termine",
        m1Le: null,
        creeLe: iso(10 * 60_000),
        idCommentaire: `com-0${i}`,
      }),
    );
    expect(deciderCommentaire(T, [], ev(), opt)).toMatchObject({
      action: "public_seul",
      raison: "plafond_personne",
    });
  });
  it("Infinity compte comme plafond atteint (pas de valeur illimité)", () => {
    expect(
      deciderCommentaire([], [], ev(), { plafondPersonneJour: Infinity }),
    ).toMatchObject({ action: "public_seul", raison: "plafond_personne" });
  });
});
