/** Une opposition vaut PARTOUT : lecture seule, fermé en cas de doute de lecture. Secrets et identifiants fictifs. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consommerJetonNonOpposee,
  emettreJetonNonOpposee,
} from "@/domaine/guide-reseau/jeton-non-opposee";
import {
  empreinteHeritee,
  empreintePersonne,
  lireClesEmpreinte,
  VARIABLE_SECRET_EMPREINTE,
  VARIABLE_SECRETS_ANCIENS,
  type EspacePersonne,
} from "@/domaine/guide-reseau/empreinte-personne";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const Opp = await import("@/services/oppositions-mots");
const Com = await import("@/services/_commun");

const S1 = "secret-fictif-partout-numero-un-0123456789";
const S2 = "secret-fictif-partout-numero-deux-012345678";
const ENV = { [VARIABLE_SECRET_EMPREINTE]: S1 };
const ENV_ROT = {
  [VARIABLE_SECRET_EMPREINTE]: S2,
  [VARIABLE_SECRETS_ANCIENS]: S1,
};
const cl = (env: Record<string, string>) => {
  const k = lireClesEmpreinte(env);
  if (!k.ok) throw new Error("clés");
  return k;
};
const emp = (espace: EspacePersonne, id: string, env = ENV) =>
  empreintePersonne(cl(env).courante, espace, id);
const ligne = (id: string, alias?: string[]) => ({
  id,
  le: "2026-01-01T00:00:00.000Z",
  transmise: false,
  ...(alias ? { alias } : {}),
});
const poser = async (cle: string, v: unknown) => Com.ecrireParametre(cle, v);
const REG = Opp.PARAM_OPPOSITIONS_MOTS;
const CONV = "parcours.conversations";
const ALIAS = "parcours.conversations.alias";

beforeEach(() => reinitialiserDepots());
afterEach(() => vi.restoreAllMocks());

describe("un STOP vaut dans chacun des 5 espaces", () => {
  for (const espace of Opp.ESPACES_TOUS) {
    it(`STOP en « ${espace} » retrouvé par l'identifiant brut`, async () => {
      await poser(REG, [ligne(emp(espace, "ct_1"))]);
      expect(
        await Opp.personneOpposeePartout({ idsBruts: ["ct_1"] }, { env: ENV }),
      ).toEqual({ opposee: true, source: "registre" });
    });
  }
  it("personne inconnue : non opposée, avec jeton", async () => {
    await poser(REG, [ligne(emp("instagram", "autre"))]);
    const v = await Opp.personneOpposeePartout(
      { idsBruts: ["ct_1", null, ""] },
      { env: ENV },
    );
    expect(v.opposee).toBe(false);
    if (!v.opposee) expect(consommerJetonNonOpposee(v.jeton)).toBe(true);
  });
  it("forme ancienne (rotation) et forme héritée reconnues", async () => {
    await poser(REG, [ligne(emp("facebook", "ct_a", ENV))]);
    expect(
      (
        await Opp.personneOpposeePartout(
          { idsBruts: ["ct_a"] },
          { env: ENV_ROT },
        )
      ).opposee,
    ).toBe(true);
    await poser(REG, [ligne(empreinteHeritee("ct_h"))]);
    expect(
      (await Opp.personneOpposeePartout({ idsBruts: ["ct_h"] }, { env: ENV }))
        .opposee,
    ).toBe(true);
  });
});

describe("conversations", () => {
  it("STOP posé comme empreinte (clé de conversation) retrouvé par l'identifiant brut via l'alias", async () => {
    const cle = emp("zernio-conversation", "conv_x");
    await poser(REG, [ligne(cle)]);
    await poser(CONV, { [cle]: { etat: "actif" } });
    await poser(ALIAS, { [emp("instagram", "exp_1")]: cle });
    expect(
      await Opp.personneOpposeePartout({ idsBruts: ["exp_1"] }, { env: ENV }),
    ).toEqual({ opposee: true, source: "registre" });
  });
  it("empreinte fournie seule : retrouvée au registre", async () => {
    const e = emp("evenement", "evt");
    await poser(REG, [ligne(e)]);
    expect(
      (await Opp.personneOpposeePartout({ empreintes: [e] }, { env: ENV }))
        .opposee,
    ).toBe(true);
  });
  it("conversation « oppose » absente du registre : source « etat »", async () => {
    const cle = emp("zernio-conversation", "exp_2");
    await poser(CONV, { [cle]: { etat: "oppose" } });
    expect(
      await Opp.personneOpposeePartout({ idsBruts: ["exp_2"] }, { env: ENV }),
    ).toEqual({ opposee: true, source: "etat" });
  });
  it("doute : opposée seulement avec douteBloque", async () => {
    const cle = emp("zernio-conversation", "exp_3");
    await poser(CONV, { [cle]: { etat: "actif", douteOpposition: true } });
    expect(
      (await Opp.personneOpposeePartout({ idsBruts: ["exp_3"] }, { env: ENV }))
        .opposee,
    ).toBe(false);
    expect(
      await Opp.personneOpposeePartout(
        { idsBruts: ["exp_3"] },
        { env: ENV, douteBloque: true },
      ),
    ).toEqual({ opposee: true, source: "doute" });
  });
});

describe("échec fermé : la fonction LÈVE", () => {
  const code = async (
    p: Parameters<typeof Opp.personneOpposeePartout>[0],
    env: Record<string, string> = ENV,
  ) => {
    try {
      await Opp.personneOpposeePartout(p, { env });
      return "pas d'erreur";
    } catch (e) {
      return e instanceof Opp.ErreurOppositionIllisible
        ? e.code
        : (e as Error).name;
    }
  };
  it("rien à vérifier", async () => {
    expect(await code({})).toBe("personne_inconnue");
    expect(
      await code({ idsBruts: [null, undefined, ""], empreintes: [] }),
    ).toBe("personne_inconnue");
  });
  it("secret absent", async () =>
    expect(await code({ idsBruts: ["a"] }, {})).toBe(
      "ErreurEmpreinteIndisponible",
    ));
  it("registre non tableau", async () => {
    await poser(REG, { x: 1 });
    expect(await code({ idsBruts: ["a"] })).toBe("registre");
  });
  it("kid inconnu", async () => {
    await poser(REG, [ligne("p1.deadbeef." + "0".repeat(64))]);
    expect(await code({ idsBruts: ["a"] })).toBe("ErreurEmpreinteIndisponible");
  });
  it("conversations illisibles", async () => {
    await poser(CONV, []);
    expect(await code({ idsBruts: ["a"] })).toBe("conversations");
    await poser(CONV, {});
    await poser(ALIAS, "x");
    expect(await code({ idsBruts: ["a"] })).toBe("conversations");
  });
  it("message fixe, sans identifiant", async () => {
    const e = new Opp.ErreurOppositionIllisible("registre");
    expect(e.message).not.toMatch(/ct_|p1\./);
  });
});

describe("jeton", () => {
  it("se consomme une seule fois ; un objet forgé est refusé", () => {
    const j = emettreJetonNonOpposee();
    expect(Object.isFrozen(j)).toBe(true);
    expect(consommerJetonNonOpposee(j)).toBe(true);
    expect(consommerJetonNonOpposee(j)).toBe(false);
    for (const f of [{}, null, undefined, "x", 1, Object.freeze({})])
      expect(consommerJetonNonOpposee(f)).toBe(false);
  });
});

describe("lecture seule et exhaustivité", () => {
  it("aucune écriture", async () => {
    const esp = vi.spyOn(Com, "ecrireParametre");
    await poser(REG, [ligne(emp("zernio-contact", "ct_z", ENV))]);
    esp.mockClear();
    await Opp.personneOpposeePartout({ idsBruts: ["ct_z"] }, { env: ENV_ROT });
    await Opp.personneOpposeePartout({ idsBruts: ["inconnu"] }, { env: ENV });
    expect(esp).not.toHaveBeenCalled();
  });
  it("ESPACES_TOUS couvre tout EspacePersonne", () => {
    const tous = {
      instagram: true,
      facebook: true,
      "zernio-contact": true,
      evenement: true,
      "zernio-conversation": true,
    } as const satisfies Record<EspacePersonne, true>;
    expect([...Opp.ESPACES_TOUS].sort()).toEqual(Object.keys(tous).sort());
  });
});
