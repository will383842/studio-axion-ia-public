/**
 * Série 5 : 13 nouvelles formulations (message sans lien qui demande l'adresse, accusé de réception, adresse non reconnue,
 * rappel avec lien), sur le même modèle que le lot A (groupes, tirage fixe par conversation, validation une par une sur /mots).
 * Les anciens textes (mp-m1-v2, mp-recu-v2, mp-m2-v1, mp-lien-v2) restent actifs et inchangés tant que les nouveaux ne sont pas validés.
 * Données 100 % fictives ; port et site FAUX ; le VRAI constructeur de corps d'envoi sert à chaque texte envoyé.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GROUPES_MP,
  TEXTES_MP,
  rendreTexteMp,
} from "@/domaine/guide-reseau/textes-mp";
import { controlerTexteSortant } from "@/services/mots-controle";
import {
  ADRESSE_FICTIVE,
  COMPTE,
  ENV,
  T0,
  TITRE,
  cleConversation,
  deposerCommentaire,
  deposerMessage,
  fauxPort,
  fauxSite,
  silencerConsole,
  validerFormulationsAuParcours,
  validerGuideAuParcours,
} from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const A = "auteur-fictif-400";

/** Copies LITTÉRALES des textes validés par Williams (jamais relues du dictionnaire). */
const M1 = [
  "Bonjour ! Merci pour votre commentaire, ça fait plaisir. Pour vous envoyer le guide « [TITRE DU GUIDE] », il me suffit de votre adresse e-mail : répondez-moi simplement ici.",
  "Merci d'avoir commenté « [MOT] » ! Le guide « [TITRE DU GUIDE] » est prêt. Écrivez-moi votre adresse e-mail en réponse et je vous l'envoie tout de suite.",
  "Bonjour, c'est bien reçu, merci ! Pour que le guide « [TITRE DU GUIDE] » arrive dans votre boîte mail, répondez-moi avec votre adresse e-mail.",
  "Avec plaisir ! Je vous envoie le guide « [TITRE DU GUIDE] » par e-mail : il me faut juste votre adresse, que vous pouvez écrire ici en réponse.",
] as const;
const RECU = [
  "Merci, c'est reçu ! Le guide « [TITRE DU GUIDE] » arrive dans votre boîte mail d'ici quelques minutes. S'il n'y est pas, jetez un œil à vos courriers indésirables.",
  "Parfait, merci ! Je vous envoie le guide « [TITRE DU GUIDE] » à cette adresse dans quelques minutes. Pensez à regarder aussi vos courriers indésirables. Bonne lecture !",
  "C'est noté, merci beaucoup ! Le guide « [TITRE DU GUIDE] » part vers votre boîte mail. Si vous ne le voyez pas d'ici quelques minutes, regardez dans vos courriers indésirables.",
] as const;
const M2 = [
  "Je n'ai pas reconnu d'adresse e-mail dans votre message. Pouvez-vous l'écrire à nouveau, par exemple adresse@entreprise.fr ? Si vous préférez ne pas la donner, touchez « Recevoir ici ».",
  "Mince, je n'ai pas trouvé d'adresse e-mail dans votre réponse. Pourriez-vous la réécrire, par exemple adresse@entreprise.fr ? Vous pouvez aussi toucher « Recevoir ici » si vous préférez.",
  "Je n'arrive pas à lire votre adresse e-mail, pouvez-vous la saisir à nouveau, par exemple adresse@entreprise.fr ? Sinon, touchez « Recevoir ici » et je vous envoie le guide autrement.",
] as const;
const LIEN = [
  "Voici votre guide « [TITRE DU GUIDE] », bonne lecture ! Le lien : [LIEN]",
  "Le guide « [TITRE DU GUIDE] » est ici, avec plaisir. Bonne lecture : [LIEN]",
  "Comme promis, voici le guide « [TITRE DU GUIDE] ». Il vous attend ici : [LIEN]",
] as const;
const V_M1 = ["mp-m1-v5-1", "mp-m1-v5-2", "mp-m1-v5-3", "mp-m1-v5-4"] as const;
const V_RECU = ["mp-recu-v3-1", "mp-recu-v3-2", "mp-recu-v3-3"] as const;
const V_M2 = ["mp-m2-v2-1", "mp-m2-v2-2", "mp-m2-v2-3"] as const;
const V_LIEN = ["mp-lien-v3-1", "mp-lien-v3-2", "mp-lien-v3-3"] as const;
const NOUVELLES = [...V_M1, ...V_RECU, ...V_M2, ...V_LIEN] as const;
const TEXTES_VALIDES = [...M1, ...RECU, ...M2, ...LIEN] as const;
const brut = (id: string) =>
  (
    TEXTES_MP as Record<
      string,
      { version: string; statut: string; texte: string }
    >
  )[id];
const rendu = (id: string, lien?: string) =>
  rendreTexteMp(id as never, { mot: "GUIDE", titre: TITRE, lien })!;

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0) =>
  C.traiterConversations({
    port: port.port,
    comptesPermis: [COMPTE],
    titreGuide: TITRE,
    env: ENV,
    maintenantMs: ms,
  });
const etatDe = async () =>
  (
    await Com.lireParametre<
      Record<
        string,
        { formulations?: Record<string, string>; versionTexteM1?: string }
      >
    >(C.PARAM_CONVERSATIONS, {})
  )[cleConversation(A)];

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
    [`GUIDE|${COMPTE}`]: {
      mot: "GUIDE",
      compte: COMPTE,
      etat: "actif",
      idWorkflow: null,
      raison: null,
      modifieLe: "x",
    },
  });
  await validerGuideAuParcours();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("1 · dictionnaire", () => {
  it("les 13 textes sont égaux, à l'octet, aux textes validés par Williams", () => {
    NOUVELLES.forEach((v, n) => {
      expect(brut(v), v).toBeDefined();
      expect(brut(v).texte, v).toBe(TEXTES_VALIDES[n]);
      expect(brut(v).version, v).toBe(v);
    });
  });
  it("groupes : 4 + 3 + 3 + 3, ordre fixe, tous actifs ; les groupes du lot A sont intacts", () => {
    const G = GROUPES_MP as Record<string, readonly string[]>;
    expect(G["m1-adresse"]).toEqual([...V_M1]);
    expect(G["recu"]).toEqual([...V_RECU]);
    expect(G["adresse-non-reconnue"]).toEqual([...V_M2]);
    expect(G["lien-rappel"]).toEqual([...V_LIEN]);
    expect(G["m1-lien"]).toEqual([
      "mp-m1-v4-1",
      "mp-m1-v4-2",
      "mp-m1-v4-3",
      "mp-m1-v4-4",
    ]);
    expect(G["adresse-refusee"]).toEqual([
      "mp-adresse-refusee-v3-1",
      "mp-adresse-refusee-v3-2",
      "mp-adresse-refusee-v3-3",
    ]);
    for (const v of NOUVELLES) expect(brut(v)?.statut, v).toBe("actif");
  });
  it("les anciens textes ne bougent pas : mp-m1-v2, mp-recu-v2, mp-m2-v1, mp-lien-v2 restent actifs, rien n'est supprimé", () => {
    for (const v of ["mp-m1-v2", "mp-recu-v2", "mp-m2-v1", "mp-lien-v2"]) {
      expect(brut(v).statut, v).toBe("actif");
      expect(brut(v).texte, v).toMatch(
        /^Message automatique envoyé par Axion IA\./,
      );
    }
    for (const v of [
      "mp-m1-v3",
      "mp-m1-v2-a",
      "mp-m1-v2-b",
      "mp-m1-v2-c",
      "mp-m1-v2-d",
      "mp-m1-v2-e",
      "mp-adresse-refusee-v2",
    ])
      expect(brut(v).statut, v).toBe("retire");
    const d = JSON.parse(
      readFileSync(
        new URL(
          "../../contrats/dictionnaire-textes-mp.v2.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(Object.keys(d.textes).length).toBe(22 + 13);
    expect(d.version).toBe(4);
    expect(brut("mp-m1-v2").texte).toBe(
      "Message automatique envoyé par Axion IA. Merci pour votre commentaire « [MOT] ». Pour vous envoyer le guide « [TITRE DU GUIDE] » par e-mail, répondez à ce message avec votre adresse e-mail.",
    );
  });
});

describe("2 · contrôle de sortie des mots (mots-controle.ts) sur les 13 entrées", () => {
  it("aucune mention automatique, aucune signature, aucun stop, aucune question d'accord (texte brut ET rendu)", () => {
    for (const v of NOUVELLES) {
      for (const t of [
        brut(v).texte,
        rendu(v, "https://exemple.test/g?j=abc"),
      ]) {
        const codes = controlerTexteSortant("message_prive", t).map(
          (r) => r.code,
        );
        for (const interdit of [
          "mention_automatique",
          "signature",
          "mention_stop",
          "question_accord",
        ])
          expect(codes, `${v} · ${interdit}`).not.toContain(interdit);
        expect(t, v).not.toMatch(/message automatique|r[ée]ponse automatique/i);
        expect(t, v).not.toMatch(/\bstop\b/i);
        // Seule exception connue : l'exemple « adresse@entreprise.fr » des textes « adresse non reconnue ».
        expect(
          codes.filter((c) => c !== "adresse_email"),
          v,
        ).toEqual([]);
        if (!(V_M2 as readonly string[]).includes(v))
          expect(codes, v).toEqual([]);
      }
    }
  });
});

describe("3 · formulation tirée, figée dans l'état, validée une par une", () => {
  it("aucune nouvelle validée : les anciens textes partent, octet pour octet (M1, M2, accusé)", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(
      rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }),
    );
    port.reponses.texte = () => "bonjour sans adresse";
    await deposerMessage(depots, { idMessage: "m-a" });
    await passer(T0 + 1000);
    expect(port.envoyes[0].texte).toBe(brut("mp-m2-v1").texte);
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "m-b" });
    await passer(T0 + 2000);
    expect(port.envoyes[1].texte).toBe(
      rendreTexteMp("mp-recu-v2", { titre: TITRE }),
    );
  });
  it("M1 sans lien : une formulation validée part, figée dans l'état avant l'envoi, versionTexteM1 = cette version", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3"]);
    await deposerCommentaire(depots, {});
    let vuAvant: unknown;
    const prive = port.port.repondreEnPrive;
    port.port.repondreEnPrive = async (p) => (
      (vuAvant = (await etatDe())?.formulations),
      prive(p)
    );
    await passer();
    expect(port.prive[0].texte).toBe(rendu("mp-m1-v5-3"));
    expect(vuAvant).toEqual({ "m1-adresse": "mp-m1-v5-3" });
    expect(await etatDe()).toMatchObject({
      versionTexteM1: "mp-m1-v5-3",
      formulations: { "m1-adresse": "mp-m1-v5-3" },
    });
  });
  it("accusé : une formulation validée part, figée AVANT l'envoi", async () => {
    await validerFormulationsAuParcours(["mp-recu-v3-2"]);
    await deposerCommentaire(depots, {});
    await passer();
    let vuAvant: unknown;
    const envoyer = port.port.envoyerMessage;
    port.port.envoyerMessage = async (p) => (
      (vuAvant = (await etatDe())?.formulations),
      envoyer(p)
    );
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "m-b" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(rendu("mp-recu-v3-2"));
    expect(vuAvant).toMatchObject({ recu: "mp-recu-v3-2" });
    expect(await etatDe()).toMatchObject({
      formulations: { recu: "mp-recu-v3-2" },
    });
  });
  it("adresse non reconnue : une formulation validée part, figée AVANT l'envoi", async () => {
    await validerFormulationsAuParcours(["mp-m2-v2-3"]);
    await deposerCommentaire(depots, {});
    await passer();
    let vuAvant: unknown;
    const envoyer = port.port.envoyerMessage;
    port.port.envoyerMessage = async (p) => (
      (vuAvant = (await etatDe())?.formulations),
      envoyer(p)
    );
    port.reponses.texte = () => "bonjour sans adresse";
    await deposerMessage(depots, { idMessage: "m-a" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(brut("mp-m2-v2-3").texte);
    expect(vuAvant).toMatchObject({ "adresse-non-reconnue": "mp-m2-v2-3" });
  });
  it("une formulation non validée ne part jamais : seule la validée est prise, dans chaque groupe", async () => {
    await validerFormulationsAuParcours([
      "mp-m1-v5-2",
      "mp-recu-v3-1",
      "mp-m2-v2-1",
    ]);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendu("mp-m1-v5-2"));
    port.reponses.texte = () => "bonjour sans adresse";
    await deposerMessage(depots, { idMessage: "m-a" });
    await passer(T0 + 1000);
    expect(port.envoyes[0].texte).toBe(brut("mp-m2-v2-1").texte);
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "m-b" });
    await passer(T0 + 2000);
    expect(port.envoyes[1].texte).toBe(rendu("mp-recu-v3-1"));
  });
  it("une validation périmée (empreinte qui ne correspond plus) n'est pas comptée : retour à l'ancien texte", async () => {
    await Com.ecrireParametre("parcours.validation.formulations", {
      "mp-m1-v5-1": { empreinte: "0".repeat(64), valideLe: "x" },
    });
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(
      rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }),
    );
  });
  it("répartition : sur 400 clés fictives, chacune des 4 formulations du message sans lien reçoit entre 15 % et 35 %", async () => {
    const { rangFormulation } =
      await import("@/domaine/guide-reseau/formulations");
    const n = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++)
      n[rangFormulation("m1-adresse" as never, `cle-fictive-${i}`, 4)]++;
    for (const c of n) {
      expect(c / 400).toBeGreaterThan(0.15);
      expect(c / 400).toBeLessThan(0.35);
    }
  });
  it("le VRAI constructeur d'envoi accepte chacune des 13 nouvelles formulations rendues", async () => {
    const { texteDuDictionnaire } =
      await import("@/fournisseurs/publication/zernio-inbox-corps");
    for (const v of NOUVELLES)
      expect(
        texteDuDictionnaire(rendu(v, "https://exemple.test/g?j=abc"), false),
        v,
      ).toBe(true);
  });
});

describe("4 · écran /mots", () => {
  it("la vue liste 20 formulations, non validées ; valider l'une ne change que celle-ci ; un ancien texte est refusé", async () => {
    const actions = await import("@/app/(studio)/mots/actions");
    const avant = await MS.lireVueMots();
    const versions = avant.formulations!.map((f) => f.version as string);
    for (const v of NOUVELLES) expect(versions, v).toContain(v);
    expect(avant.formulations!).toHaveLength(7 + 13);
    expect(avant.formulations!.every((f) => !f.valide)).toBe(true);
    expect(
      await actions.validerFormulationAction("mp-recu-v3-2"),
    ).toMatchObject({ ok: true });
    const apres = await MS.lireVueMots();
    expect(
      apres.formulations!.filter((f) => f.valide).map((f) => f.version),
    ).toEqual(["mp-recu-v3-2"]);
    expect(await actions.validerFormulationAction("mp-recu-v2")).toMatchObject({
      ok: false,
    });
  });
  it("EcranMots affiche une carte par groupe, le texte de chaque formulation et le bouton « Valider cette formulation »", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { EcranMots } = await import("@/components/mots/EcranMots");
    const vue = await MS.lireVueMots();
    const html = renderToStaticMarkup(
      createElement(EcranMots, {
        vue,
        services: {
          validerFormulation: async () => ({ ok: true, raison: "valide" }),
        } as never,
        comptes: [COMPTE],
      }),
    );
    const esc = (t: string) =>
      t
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    for (const t of TEXTES_VALIDES)
      expect(html, t.slice(0, 30)).toContain(esc(t));
    for (const g of [
      "m1-adresse",
      "recu",
      "adresse-non-reconnue",
      "lien-rappel",
    ])
      expect(html, g).toContain(`data-groupe="${g}"`);
    expect(html.match(/Valider cette formulation/g)).toHaveLength(7 + 13);
  });
});

describe("5 · rien de sensible dans l'état", () => {
  it("l'état ne contient que des noms de versions : aucun texte rendu, aucune adresse", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-1", "mp-recu-v3-1"]);
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "m-b" });
    await passer(T0 + 1000);
    const s = JSON.stringify(await etatDe());
    expect(s).not.toContain("Merci");
    expect(s).not.toContain(ADRESSE_FICTIVE);
  });
});
