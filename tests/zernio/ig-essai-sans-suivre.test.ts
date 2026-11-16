/**
 * Instagram, cible d'ESSAI, réglage « suivre le compte » ÉTEINT (défaut) : le parcours « plusieurs mots » appelle etapesCommentaire avec ig=false.
 * Jamais de lien, jamais mp-m1-v2, jamais un texte du groupe « m1-adresse » (mp-m1-v5-x) sur Instagram : seule la demande d'adresse validée
 * (groupe « m1-adresse-rgpd », mp-m1-v6-x) peut partir ; sinon RIEN ne part, une alerte est émise (échec fermé).
 * Faux port, faux site, faux catalogue ; données 100 % fictives ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { deposerCommentaire as deposerCommentaireAide } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({ versions: new Set<string>(), catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => site.catalogue }));
vi.mock("@/services/notifications", async (orig) => ({ ...(await orig<Record<string, unknown>>()), creerNotification: vi.fn(async () => undefined) }));

const MM = await import("@/services/parcours-mots-multiples");
const V = await import("@/services/mots-validation-par-mot");

const MOT = "ESSAICONV";
const CODE = "gde-essai05";
const TITRE_ESSAI = "Guide d'essai conversation";
const V5 = "mp-m1-v5-1";
const V61 = "mp-m1-v6-1";
const V62 = "mp-m1-v6-2";
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const MESSAGE_IG_ADRESSE_INDISPONIBLE = "Instagram : la demande d'adresse validée (avec la mention d'information) manque : rien n'est parti";
const ENV_X = {
  ...ENV, PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE, PARCOURS_LIEN_GUIDE: "true", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale`,
  PARCOURS_ESSAI_COMPTES: COMPTE, PARCOURS_ESSAI_AUTEURS: AUTEUR,
};
const ENV_LIEN_ETEINT = { ...ENV_X, PARCOURS_LIEN_GUIDE: undefined };
const BASE = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-adresse-refusee-v3-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m2-v2-1"];

const catalogue = (test = true) => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: TITRE_ESSAI, actif: true, test },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: "guide-ia", actif: true },
    { mot: MOT, reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
// Le réglage public d'Instagram reste TEL QUEL ; le réglage « suivre le compte » (PARAM_INSTAGRAM_SUIVRE) reste ABSENT.
const com = (mot: string, reseau = "instagram") => deposerCommentaireAide(depots, { motSeul: mot, reseau, reglageInstagram: "intact" });
const pass = (ms: number = T0, env: Record<string, string | undefined> = ENV_X) => passer(ms, { env });
const convs = async () => Object.values(await toutesLesConversations()) as any[];
const conv = async () => (await convs())[0];
const charge = async (id: string) => (await evenement(depots, id)).charge;
const rendus = () => JSON.stringify([banc.port.pub, banc.port.prive, banc.port.envoyes]);

const registreMots = async () => {
  const reg: Record<string, unknown> = {};
  for (const mot of ["GUIDE", MOT]) reg[`${mot}|${COMPTE}`] = { mot, compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const validerEssai = async (reseau: "instagram" | "facebook") => {
  const a = (await V.apercuTextesMot({ mot: MOT, env: ENV_X, maintenantMs: T0 })).find((x) => x.reseau === reseau)!;
  if (!a.ok) throw new Error(`aperçu refusé : ${a.raison}`);
  const r = await V.validerTextesMot({ mot: MOT, reseau, empreinteVue: a.empreinte, confirmeParOperateur: true, env: ENV_X, maintenantMs: T0 });
  if (!r.ok) throw new Error(r.raison);
};
/** Validation de l'essai sur Instagram avec TOUTES les versions, puis la liste des formulations validées est remplacée par `versions`. */
const valider = async (versions: string[], reseau: "instagram" | "facebook" = "instagram") => {
  await validerFormulationsAuParcours([...BASE, V5, V61, V62]);
  await validerEssai(reseau);
  await validerFormulationsAuParcours([...BASE, ...versions]);
};
/** Rejoue le commentaire du mot d'essai sur une conversation remise en « pub_ok » (reprise après la réponse publique). */
async function reprendreEnPubOk(extra: Record<string, unknown>) {
  const id = await com(MOT);
  await pass(T0);
  const cle = Object.keys(await toutesLesConversations())[0];
  const c = (await convs())[0];
  const { formulations, ...reste } = c;
  const f = { ...(formulations ?? {}) };
  delete f["m1-adresse"];
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: { ...reste, formulations: f, etat: "pub_ok", m1Le: undefined, versionTexteM1: undefined, adresseIgLe: undefined, ...extra } });
  await valider([V5]);
  banc.port.pub.splice(0);
  banc.port.prive.splice(0);
  banc.port.envoyes.splice(0);
  const { creerNotification } = await import("@/services/notifications");
  vi.mocked(creerNotification).mockClear();
  const e = await evenement(depots, id);
  await depots().evenementsFournisseurs.enregistrer({ ...e, traite: false, charge: { ...e.charge, etat: "a_faire", dernierCode: undefined } });
  await pass(T0 + 1000);
  return id;
}
const alertesAdresse = async () => {
  const { creerNotification } = await import("@/services/notifications");
  return vi.mocked(creerNotification).mock.calls.filter(([n]) => (n as any).message === MESSAGE_IG_ADRESSE_INDISPONIBLE);
};

beforeEach(async () => {
  await preparer();
  site.versions = new Set(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", V61]);
  site.catalogue = catalogue();
  lireTexteDe("OK");
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true); // « plusieurs mots » allumé ; PARAM_INSTAGRAM_SUIVRE laissé absent
  await registreMots();
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

describe("Instagram, cible d'essai, « suivre le compte » éteint : échec fermé", () => {
  it("A1 · v6-1/v6-2 non validées, v5-1 validée : rien ne part (ni public, ni privé), écarté/adresse_indisponible, m1_refuse, alerte, aucun rendu de mp-m1-v2 ni de v5-1", async () => {
    await valider([V5]);
    const { creerNotification } = await import("@/services/notifications");
    vi.mocked(creerNotification).mockClear();
    const id = await com(MOT);
    await pass(T0);
    expect(banc.port.pub).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "adresse_indisponible" });
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "adresse_indisponible" });
    expect(await alertesAdresse()).toHaveLength(1);
    expect(rendus()).not.toContain(rendreTexteMp("mp-m1-v2", { mot: MOT, titre: TITRE_ESSAI }));
    expect(rendus()).not.toContain(rendreTexteMp(V5, { mot: MOT, titre: TITRE_ESSAI }));
  });

  it("A2 · conversation en pub_ok (cibleEssai true, guide d'essai) : le filet après preparerM1 ferme : rien ne part, m1_refuse/adresse_indisponible, alerte", async () => {
    await valider([V61]);
    await reprendreEnPubOk({ cibleEssai: true });
    expect(banc.port.prive).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "adresse_indisponible", guide: CODE });
    expect(await alertesAdresse()).toHaveLength(1);
  });

  it("A3 · comme A2, drapeau cibleEssai ABSENT et catalogue du jour test:true : même résultat", async () => {
    await valider([V61]);
    await reprendreEnPubOk({ cibleEssai: undefined });
    expect(banc.port.prive).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "adresse_indisponible" });
    expect(await alertesAdresse()).toHaveLength(1);
  });

  it("A4 · v6-1 validée : réponse publique 1, message privé 1 = rendu de mp-m1-v6-1 sans http ; attente_email, versionTexteM1 v6-1", async () => {
    await valider([V61]);
    await com(MOT);
    await pass(T0);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V61, { mot: MOT, titre: TITRE_ESSAI }));
    expect(banc.port.prive[0].texte).not.toMatch(/https?:/);
    expect(await conv()).toMatchObject({ etat: "attente_email", versionTexteM1: V61 });
  });

  it("A5 · Facebook, cible d'essai, v6-x non validées, v5-1 validée : M1 v5-1 part (inchangé)", async () => {
    await valider([V5], "facebook");
    await com(MOT, "facebook");
    await pass(T0);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V5, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await conv()).toMatchObject({ etat: "attente_email", versionTexteM1: V5 });
  });

  it("A6 · GUIDE réel sur Instagram, lien éteint, suivre éteint : M1 part comme avant (non-régression)", async () => {
    await valider([V5]);
    const id = await com("GUIDE");
    await pass(T0, ENV_LIEN_ETEINT);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).not.toMatch(/https?:/);
    expect((await charge(id)).dernierCode).not.toBe("adresse_indisponible");
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email" });
    expect(c.cibleEssai).toBeUndefined();
  });
});
