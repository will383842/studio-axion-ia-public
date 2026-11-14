/**
 * Suite de la 491 : le renvoi « déjà envoyé » avec la VRAIE liste du site garde la version validée dans `versionTexteM1`.
 * Données 100 % fictives ; faux port, faux site : aucun réseau.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADRESSE, AUTEUR, banc, C, Com, COMPTE, depots, ENV, lireTexteDe, nettoyer, passer, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";
import { deposerCommentaire, deposerMessage, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => etat.catalogue }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true, validationPourEnvoi: async () => null }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const prives: any[] = [];
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });

beforeEach(async () => {
  await preparer();
  etat.catalogue = null;
  prives.length = 0;
  const p = banc.port.port as any;
  const priv = p.repondreEnPrive;
  p.repondreEnPrive = async (a: any) => (prives.push(a), priv(a));
  banc.port.reponses.texte = () => "OK";
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  void C;
});
afterEach(nettoyer);

describe("renvoi « déjà envoyé » : version retenue", () => {
  it.each(["mp-deja-envoye-v1-1", "mp-deja-envoye-v1-2", "mp-deja-envoye-v1-3"])("avec %s validée : le renvoi porte versionTexteM1 = la version validée", async (v) => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-lien-v3-1", v]);
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-fb-1", motSeul: "GUIDE", reseau: "facebook" });
    await pass(T0);
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-fb-adresse" });
    await pass(T0 + 1000);
    const avant = prives.length;
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-fb-2", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - 25 * H });
    await pass(T0 + 25 * H);
    expect(prives.length).toBe(avant + 1);
    const renvoi = Object.values(await toutesLesConversations()).find((x: any) => x.nature === "renvoi");
    expect(renvoi).toMatchObject({ groupeM1: "deja-envoye", versionTexteM1: v });
  });
});
