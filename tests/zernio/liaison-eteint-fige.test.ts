/**
 * LIA-0 · le parcours GUIDE tel qu'il est AUJOURD'HUI (réglage `parcours.mots_multiples` éteint) est FIGÉ avant toute liaison.
 * Test de caractérisation : il ne doit plus jamais être modifié. Neuf scénarios, un instantané chacun.
 * Chaque instantané garde : la suite ordonnée des appels du port (méthode + arguments, sans jeton), les appels au site (chemin + corps),
 * `parcours.conversations`, la table d'alias, `parcours.oppositions.file`, et `etat` + `dernierCode` de chaque événement.
 * Horloge et secrets fixes (banc `filet-guide/_amorce.ts`). Données 100 % fictives, aucun réseau.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import fixture from "./aides/confirmations-page-guide.v1.json";
import {
  cleConversation,
  deposerCommentaire,
  deposerMessage,
  validerFormulationsAuParcours,
} from "./aides/conversation";
import {
  ADRESSE,
  AUTEUR,
  banc,
  C,
  Com,
  COMPTE,
  crochetCommentaire,
  depots,
  ENV,
  graineConv,
  lireTexteDe,
  nettoyer,
  passer,
  pm,
  preparer,
  T0,
  TITRE,
} from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const H = 3600_000;
type Appel = { appel: string; args: unknown };
let journalPort: Appel[] = [];

/** Enrobe le faux port : note chaque appel dans l'ordre. Les valeurs qui ressemblent à un jeton (long mot opaque dans un lien) sont masquées. */
const masquer = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v).replace(/(c1_|jeton=)[A-Za-z0-9_-]{8,}/g, "$1<masque>"),
  );
function enrober(): void {
  const p = banc.port.port as unknown as Record<
    string,
    (a: unknown) => Promise<unknown>
  >;
  for (const nom of [
    "repondreCommentaire",
    "repondreEnPrive",
    "lireMessage",
    "envoyerMessage",
  ]) {
    const orig = p[nom];
    p[nom] = async (a) => (
      journalPort.push({ appel: nom, args: masquer(a) }),
      orig(a)
    );
  }
}
beforeEach(async () => {
  await preparer();
  journalPort = [];
  enrober();
});
afterEach(nettoyer);

async function instantane(): Promise<Record<string, unknown>> {
  const evs = await depots().evenementsFournisseurs.lister(() => true);
  return {
    port: journalPort,
    site: banc.site.vus.map((r: RequeteSignee) => ({
      chemin: r.chemin,
      corps: JSON.parse(r.corps),
    })),
    conversations: await Com.lireParametre(C.PARAM_CONVERSATIONS, {}),
    alias: await Com.lireParametre(C.PARAM_CONVERSATIONS_ALIAS, {}),
    oppositionsFile: await Com.lireParametre("parcours.oppositions.file", {}),
    evenements: evs.map(
      (e: { type: string; charge: Record<string, unknown> }) => ({
        type: e.type,
        etat: e.charge.etat,
        dernierCode: e.charge.dernierCode ?? null,
      }),
    ),
  };
}

describe("LIA-0 · comportement actuel figé (réglage éteint)", () => {
  it("1 · commentaire GUIDE Facebook : réponse publique puis M1", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer();
    expect(journalPort.map((a) => a.appel)).toEqual([
      "repondreCommentaire",
      "repondreEnPrive",
    ]);
    expect(await instantane()).toMatchSnapshot("1-guide-facebook");
  });

  it("2 · trois commentaires de la même personne", async () => {
    for (const mot of ["GUIDE", "guide", "Guide"])
      await crochetCommentaire(mot, { reseau: "facebook", idAuteur: AUTEUR });
    await passer();
    expect(await instantane()).toMatchSnapshot("2-trois-commentaires");
  });

  it("3 · événement injecté avec motSeul « CHATGPT » : écarté (raison « mot »)", async () => {
    await deposerCommentaire(depots, {
      reseau: "facebook",
      motSeul: "CHATGPT",
    });
    await passer();
    const evs = await depots().evenementsFournisseurs.lister(() => true);
    expect(evs[0].charge.etat).toBe("ecarte");
    expect(evs[0].charge.dernierCode).toBe("mot");
    expect(await instantane()).toMatchSnapshot("3-mot-ecarte");
  });

  it("4 · commentaire « stop »", async () => {
    await crochetCommentaire("stop", {
      reseau: "facebook",
      idAuteur: "auteur-fictif-401",
    });
    await passer();
    // Même mot en message privé, d'une personne déjà entrée dans le parcours : l'opposition l'emporte (état « oppose »).
    await crochetCommentaire("GUIDE", { reseau: "facebook", idAuteur: AUTEUR });
    await passer(T0 + 500);
    lireTexteDe("stop");
    await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
    await passer(T0 + 1000);
    expect(await instantane()).toMatchSnapshot("4-stop");
  });

  it("5 · message avec adresse : corps exact de l'appel au site", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer();
    lireTexteDe(`Voici mon adresse : ${ADRESSE}`);
    await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
    await passer(T0 + 1000);
    expect(banc.site.vus).toHaveLength(1);
    expect(await instantane()).toMatchSnapshot("5-adresse");
  });

  it("6 · m1_refuse puis commentaire 25 h après : redémarre sur la même clé", async () => {
    const cle = cleConversation(AUTEUR);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: graineConv("m1_refuse", {
        refuseLe: new Date(T0).toISOString(),
        dernierCode: "debit",
        creeLe: new Date(T0 - H).toISOString(),
      }),
    });
    const tard = T0 + 25 * H;
    await deposerCommentaire(depots, {
      reseau: "facebook",
      idAuteur: AUTEUR,
      idCommentaire: "com-fictif-tard",
      ageMs: -(25 * H - 1000),
    });
    await passer(tard);
    const apres = (
      await Com.lireParametre<Record<string, { etat?: string }>>(
        C.PARAM_CONVERSATIONS,
        {},
      )
    )[cle];
    const toutes = await Com.lireParametre<Record<string, { etat?: string }>>(
      C.PARAM_CONVERSATIONS,
      {},
    );
    expect(Object.keys(toutes)).toEqual([cle]); // même clé de conversation : aucune seconde conversation
    expect(apres.etat).toBe("attente_email");
    expect(await instantane()).toMatchSnapshot("6-m1-refuse-25h");
  });

  it("7 · message « doute »", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer();
    lireTexteDe("je ne veux pas de stop");
    await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
    await passer(T0 + 1000);
    expect(banc.site.vus).toHaveLength(0);
    expect(await instantane()).toMatchSnapshot("7-doute");
  });

  it("8 · merci (interrupteur allumé, texte validé)", async () => {
    const ref = createHash("sha256").update("jeton-fictif-1").digest("hex");
    const cle = cleConversation(AUTEUR);
    const m = new Date(T0 - H).toISOString();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: {
        ...graineConv("attente_email", {
          versionTexteM1: "mp-m1-v4-1",
          creeLe: new Date(T0 - 2 * H).toISOString(),
          m1Le: new Date(T0 - 2 * H).toISOString(),
        }),
        reseau: "instagram",
        refLienConv: "c1_AbCdEf0123456789_-xyZQ",
        empreintesLien: [ref],
        derniereActiviteLe: m,
        idMessageDernier: "msg-dernier-fictif",
      },
    });
    await depots().evenementsFournisseurs.enregistrer({
      id: "evf-merci",
      fournisseur: "zernio",
      idEvenement: "evt-merci",
      type: "zernio.message",
      recuLe: m,
      traite: true,
      creeLe: m,
      modifieLe: m,
      charge: {
        idMessage: "msg-dernier-fictif",
        idConversation: "conv-fictive-700",
        idCompte: COMPTE,
        idExpediteur: AUTEUR,
        etat: "termine",
      },
    });
    const b = TEXTES_MP["mp-merci-v1"];
    await Com.ecrireParametre("parcours.validation.merci", {
      empreinte: createHash("sha256")
        .update(`${b.version}\n${b.texte}`)
        .digest("hex"),
    });
    pm.injecterTransportSite(async (r: RequeteSignee) => {
      banc.site.vus.push(r);
      if (r.chemin === fixture.lecture.chemin)
        return {
          statut: 200,
          corps: {
            ok: true,
            schemaVersion: 1,
            confirmations: [
              { ref, valideLe: new Date(T0 - 60_000).toISOString() },
            ],
          },
        };
      return { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } };
    });
    await C.traiterMercis({
      port: banc.port.port,
      comptesPermis: [COMPTE],
      titreGuide: TITRE,
      env: { ...ENV, PARCOURS_MERCI_ENABLED: "1" },
      maintenantMs: T0,
    });
    expect(banc.port.envoyes).toHaveLength(1);
    expect(await instantane()).toMatchSnapshot("8-merci");
  });

  it("9 · adresse refusée par le site (422)", async () => {
    await validerFormulationsAuParcours();
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer();
    banc.site.reponses = () => ({ statut: 422, corps: { erreur: "invalide" } });
    lireTexteDe(`Mon adresse ${ADRESSE}`);
    await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
    await passer(T0 + 1000);
    expect(await instantane()).toMatchSnapshot("9-adresse-refusee-422");
  });
});
