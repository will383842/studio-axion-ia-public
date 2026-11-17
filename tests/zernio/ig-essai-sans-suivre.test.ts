/**
 * Instagram, cible d'ESSAI, réglage « suivre le compte » ÉTEINT (défaut) : le parcours « plusieurs mots » appelle etapesCommentaire avec ig=false.
 * Jamais de lien, jamais mp-m1-v2, jamais un texte du groupe « m1-adresse » (mp-m1-v5-x) sur Instagram : seule la demande d'adresse validée
 * (groupe « m1-adresse-rgpd », mp-m1-v6-x) peut partir ; sinon RIEN ne part, une alerte est émise (échec fermé).
 * Faux port, faux site, faux catalogue ; données 100 % fictives ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { ADRESSE_FICTIVE, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { deposerCommentaire as deposerCommentaireAide, deposerMessage as deposerMessageAide } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({ versions: new Set<string>(), catalogue: null as unknown, panneEssai: false, pannes: 0, lectures: 0, lieux: [] as string[], formulerNul: false }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
// Rendu nul limité aux appels faits depuis `formuler` (la demande d'adresse hors RGPD, avec repli) : tout le reste rend le texte normal.
vi.mock("@/domaine/guide-reseau/textes-mp", async (orig) => {
  const o = await orig<typeof import("@/domaine/guide-reseau/textes-mp")>();
  return { ...o, rendreTexteMp: (...a: Parameters<typeof o.rendreTexteMp>) => (site.formulerNul && /formuler/.test(new Error().stack ?? "") ? null : o.rendreTexteMp(...a)) };
});
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => {
    // Panne de lecture limitée à l'appel de la fonction qui décide « cible d'essai du jour » (les autres lectures réussissent).
    // `lectures` compte les lectures faites par la fonction visée ; `pannes` / `lieux` prouvent que la panne s'est déclenchée DANS cette fonction (pas seulement une regex sur la pile).
    const lieu = /at (?:async )?(statutEssaiCatalogue|cibleEstEssaiAujourdhui)\b/.exec(new Error().stack ?? "");
    if (lieu) site.lectures++;
    if (site.panneEssai && lieu) { site.pannes++; site.lieux.push(lieu[1]); throw new Error("catalogue en panne (fictif)"); }
    return site.catalogue;
  } }));
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
const msg = (id: string, avance = 5000) => deposerMessageAide(depots, { idMessage: id, avance, reglageInstagram: "intact" });
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const sorties = () => banc.port.pub.length + banc.port.prive.length + banc.port.envoyes.length;
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
async function reprendreEnPubOk(extra: Record<string, unknown>, versions: string[] = [V5], opts: { env?: Record<string, string | undefined>; reseau?: "instagram" | "facebook"; avantRejeu?: () => void } = {}) {
  const reseau = opts.reseau ?? "instagram";
  const id = await com(MOT, reseau);
  await pass(T0);
  const cle = Object.keys(await toutesLesConversations())[0];
  const c = (await convs())[0];
  const { formulations, ...reste } = c;
  const f = { ...(formulations ?? {}) };
  delete f["m1-adresse"];
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: { ...reste, formulations: f, etat: "pub_ok", m1Le: undefined, versionTexteM1: undefined, adresseIgLe: undefined, ...extra } });
  await valider(versions, reseau);
  opts.avantRejeu?.();
  banc.port.pub.splice(0);
  banc.port.prive.splice(0);
  banc.port.envoyes.splice(0);
  const { creerNotification } = await import("@/services/notifications");
  vi.mocked(creerNotification).mockClear();
  const e = await evenement(depots, id);
  await depots().evenementsFournisseurs.enregistrer({ ...e, traite: false, charge: { ...e.charge, etat: "a_faire", dernierCode: undefined } });
  await pass(T0 + 1000, opts.env);
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
  site.panneEssai = false;
  site.pannes = 0;
  site.lectures = 0;
  site.lieux = [];
  site.formulerNul = false;
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

describe("Suites de la relecture de #853 : renvoi, filet Facebook, drapeau, report", () => {
  const alertes = async () => {
    const { creerNotification } = await import("@/services/notifications");
    return vi.mocked(creerNotification).mock.calls;
  };
  const rejouer = async (id: string, ms: number) => {
    const e = await evenement(depots, id);
    await depots().evenementsFournisseurs.enregistrer({ ...e, traite: false, charge: { ...e.charge, etat: "a_faire", dernierCode: undefined } });
    await pass(ms);
  };

  it("T1 · renvoi Instagram, cible d'essai : AVANT la réponse publique, rien ne part ; événement et conversation clos « renvoi_impossible », sans alerte", async () => {
    await valider([V61]);
    const id = await reprendreEnPubOk({ cibleEssai: true, nature: "renvoi", groupeM1: "deja-envoye", etat: "nouveau" }, [V61]);
    expect(banc.port.pub).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "m1_refuse", dernierCode: "renvoi_impossible" });
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "renvoi_impossible" });
    expect(await alertes()).toHaveLength(0);
  });

  it("T2 · Facebook, cible d'essai, formuler rend un texte null : même résultat qu'avant #853 (m1_refuse / texte_incomplet), pas d'alerte « adresse indisponible »", async () => {
    await valider([V5], "facebook");
    const id = await com(MOT, "facebook");
    await pass(T0);
    const cle = Object.keys(await toutesLesConversations())[0];
    const c = (await convs())[0];
    const { formulations, ...reste } = c;
    const f = { ...(formulations ?? {}) };
    delete f["m1-adresse"];
    // `formuler` rend un texte null (rendu nul, y compris pour le repli mp-m1-v2).
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: { ...reste, formulations: f, etat: "pub_ok", m1Le: undefined, versionTexteM1: undefined, cibleEssai: true } });
    site.formulerNul = true;
    banc.port.pub.splice(0); banc.port.prive.splice(0); banc.port.envoyes.splice(0);
    const { creerNotification } = await import("@/services/notifications");
    vi.mocked(creerNotification).mockClear();
    await rejouer(id, T0 + 1000);
    expect(banc.port.prive).toHaveLength(0);
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "texte_incomplet" });
    expect(await charge(id)).toMatchObject({ etat: "m1_refuse", dernierCode: "texte_incomplet" });
    expect(await alertesAdresse()).toHaveLength(0);
  });

  it("T5 · sans suivre : drapeau absent → v6-1 part → adresse écrite → UNE demande au site { guide, reseau instagram, versionTexteM1 v6-1 }", async () => {
    await valider([V61]);
    await reprendreEnPubOk({ cibleEssai: undefined }, [V61]);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V61, { mot: MOT, titre: TITRE_ESSAI }));
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", versionTexteM1: V61 });
    expect(c.cibleEssai).toBe(true);
    lireTexteDe(`Mon adresse : ${ADRESSE_FICTIVE}`);
    await msg("msg-adr-t5", 30_000);
    await pass(T0 + 40_000);
    expect(demandes()).toHaveLength(1);
    expect(JSON.parse(demandes()[0].corps)).toMatchObject({ guide: CODE, reseau: "instagram", versionTexteM1: V61 });
  });

  it("T6 · garde AVANT la réponse publique, branche « catalogue du jour » (drapeau absent, test:true, v6 non validées) : aucune réponse publique", async () => {
    await valider([V61]);
    const id = await reprendreEnPubOk({ cibleEssai: undefined, etat: "nouveau" });
    expect(banc.port.pub).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "adresse_indisponible" });
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "adresse_indisponible" });
  });

  it("T7 · rejeu après adresse_indisponible : rien ne repart, même une fois v6-1 validée", async () => {
    await valider([V5]);
    const id = await com(MOT);
    await pass(T0);
    expect(sorties()).toBe(0);
    await valider([V61]);
    await rejouer(id, T0 + 5000);
    await rejouer(id, T0 + 10_000);
    expect(sorties()).toBe(0);
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "adresse_indisponible" });
  });

  it("T8 · site.versions SANS mp-m1-v6-1 : v6-1 part quand même (siteAccepteVersionM1 non appliqué à la demande d'adresse)", async () => {
    site.versions = new Set(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1"]);
    await valider([V61]);
    await com(MOT);
    await pass(T0);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V61, { mot: MOT, titre: TITRE_ESSAI }));
  });

  it("T9 · lecture du catalogue en erreur AVANT la réponse publique : reporté (catalogue_illisible), pas de clôture, rien ne part", async () => {
    site.panneEssai = true;
    await valider([V61]);
    const id = await reprendreEnPubOk({ cibleEssai: undefined, etat: "nouveau" });
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    const c = await conv();
    expect(c.etat).toBe("nouveau");
    expect(c.dernierCode).not.toBe("adresse_indisponible");
    expect(await alertesAdresse()).toHaveLength(0);
  });


  it("T10 bis · pub_ok, drapeau absent, lecture du catalogue en PANNE dans preparerM1 (essai supposé) : rien ne part, reporté catalogue_illisible, cibleEssai absent ; panne levée, reprise après l'attente", async () => {
    await valider([V61]);
    // Panne intermittente : la garde lit le catalogue sans erreur, puis la lecture de preparerM1 (statutEssaiCatalogue) tombe en panne : l'essai est seulement SUPPOSÉ.
    const id = await reprendreEnPubOk({ cibleEssai: undefined }, [V61], { avantRejeu: () => { site.panneEssai = true; site.pannes = 0; site.lieux = []; } });
    expect(site.pannes).toBeGreaterThan(0); // la panne s'est bien déclenchée dans statutEssaiCatalogue
    expect(site.lieux.every((l) => l === "statutEssaiCatalogue")).toBe(true);
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    const c1 = await conv();
    expect(c1.etat).toBe("pub_ok");
    expect(c1.cibleEssai).toBeUndefined();
    expect(c1.dernierCode).not.toBe("adresse_indisponible");
    expect(await alertesAdresse()).toHaveLength(0);
    // Reprise : panne levée, l'horloge du banc avance au-delà de l'attente (60 s), aucune remise à « a_faire » à la main.
    site.panneEssai = false;
    await pass(T0 + 1000 + 61_000);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V61, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await conv()).toMatchObject({ etat: "attente_email", versionTexteM1: V61, cibleEssai: true });
  });

  it("T11 · comme T10 bis mais catalogue lu sans panne, test:true (essai prouvé) : cibleEssai posé ; la lecture a bien eu lieu et rien n'est tombé en panne", async () => {
    await valider([V61]);
    await reprendreEnPubOk({ cibleEssai: undefined }, [V61], { avantRejeu: () => { site.pannes = 0; site.lectures = 0; } });
    expect(site.lectures).toBeGreaterThan(0); // statutEssaiCatalogue a lu le catalogue (sinon « pas de panne » ne prouverait rien)
    expect(site.pannes).toBe(0);
    expect(banc.port.prive).toHaveLength(1);
    expect((await conv()).cibleEssai).toBe(true);
  });

  it("T16 · Facebook, lecture du catalogue en panne dans preparerM1 : comme avant, M1 v5-1 part, cibleEssai jamais posé (aucun report)", async () => {
    await valider([V5], "facebook");
    const id = await reprendreEnPubOk({ cibleEssai: undefined }, [V5], { reseau: "facebook", avantRejeu: () => { site.panneEssai = true; site.pannes = 0; site.lieux = []; } });
    expect(site.pannes).toBeGreaterThan(0);
    expect(site.lieux.every((l) => l === "statutEssaiCatalogue")).toBe(true);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V5, { mot: MOT, titre: TITRE_ESSAI }));
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", reseau: "facebook" });
    expect(c.cibleEssai).toBeUndefined();
    expect((await charge(id)).dernierCode).not.toBe("catalogue_illisible");
  });

  it("T12 · S4 sur Facebook, essai prouvé par le catalogue : M1 part, cibleEssai n'est JAMAIS posé", async () => {
    await valider([V5], "facebook");
    await reprendreEnPubOk({ cibleEssai: undefined }, [V5], { reseau: "facebook" });
    expect(banc.port.prive).toHaveLength(1);
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", reseau: "facebook" });
    expect(c.cibleEssai).toBeUndefined();
  });

  it("T13 · renvoi Instagram, cibleEssai ABSENT, catalogue test:true : aucune réponse publique, clôture renvoi_impossible", async () => {
    await valider([V61]);
    const id = await reprendreEnPubOk({ cibleEssai: undefined, nature: "renvoi", groupeM1: "deja-envoye", etat: "nouveau" }, [V61]);
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "m1_refuse", dernierCode: "renvoi_impossible" });
    expect(await conv()).toMatchObject({ etat: "m1_refuse", dernierCode: "renvoi_impossible" });
  });

  it("T14 · reprise automatique après le report du T9 : panne levée, l'horloge du banc passe ATTENTE_CATALOGUE_MS (60 s), l'événement est repris SANS remise à « a_faire » à la main", async () => {
    await valider([V61]);
    const id = await reprendreEnPubOk({ cibleEssai: undefined, etat: "nouveau" }, [V61], { avantRejeu: () => { site.panneEssai = true; site.pannes = 0; site.lieux = []; } });
    expect(site.pannes).toBeGreaterThan(0);
    expect(site.lieux.every((l) => l === "statutEssaiCatalogue")).toBe(true);
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    site.panneEssai = false;
    await pass(T0 + 1000 + 30_000); // attente non écoulée : l'événement reste reporté
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    await pass(T0 + 1000 + 61_000); // attente écoulée : repris tout seul
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp(V61, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await conv()).toMatchObject({ etat: "attente_email", cibleEssai: true });
    expect((await charge(id)).etat).not.toBe("a_reessayer");
  });
});
