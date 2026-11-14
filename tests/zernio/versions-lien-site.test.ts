/**
 * VERSIONS AVEC LIEN · OK Instagram avec le VRAI fichier `versions-acceptees-site.ts` (aucun faux site « tout accepter »).
 * Données 100 % fictives ; faux port (dont la lecture du suivi est programmable), faux site : aucun réseau, aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE, VERSIONS_M1_ACCEPTEES_PAR_LE_SITE, siteAccepteVersionM1 } from "@/domaine/guide-reseau/versions-acceptees-site";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerMessage, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => etat.catalogue }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const FORM = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1"];
const iso = (ms: number) => new Date(ms).toISOString();
const racine = () => cleConversation(AUTEUR);
const cleG = (n: string) => n.padEnd(64, "0");

const suivi = { appels: [] as any[], file: [] as any[], defaut: { statut: "suit" } as any };
const envois: any[] = [];
const prives: any[] = [];
const publics: any[] = [];

function poserLecture(): void {
  (banc.port.port as any).lireSuiviInstagram = async (a: any) => {
    suivi.appels.push(a);
    const r = suivi.file.length > 0 ? suivi.file.shift() : suivi.defaut;
    if (r instanceof Error) throw r;
    return r;
  };
}
function brancher(): void {
  const p = banc.port.port as any;
  poserLecture();
  const priv = p.repondreEnPrive, env = p.envoyerMessage, pub = p.repondreCommentaire;
  p.repondreEnPrive = async (a: any) => (prives.push(a), priv(a));
  p.repondreCommentaire = async (a: any) => (publics.push(a), pub(a));
  p.envoyerMessage = async (a: any) => (envois.push({ ...a, enVol: await etatsEnVol() }), env(a));
  banc.port.reponses.texte = () => "OK";
}
const etatsEnVol = async () => Object.values(await toutesLesConversations()).map((x: any) => `${x.etat}|${x.idMessageOk ?? "-"}`);

async function semer(n: string, etatP: string, extra: Record<string, unknown> = {}, r: string = racine()): Promise<string> {
  const cle = cleParcours(r, cleG(n));
  const conv = await toutesLesConversations();
  const rang = Number(n.replace(/\D/g, "") || 0);
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...conv,
    [cle]: {
      ...graineConv(etatP, {
        reseau: "instagram", cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 5 * H + rang * 60_000), m1Le: iso(T0 - 5 * H + rang * 60_000 + 1000),
      }),
      ...extra,
    },
  });
  return cle;
}
const parcours = async () => Object.entries(await toutesLesConversations()) as Array<[string, any]>;
const un = async () => (await parcours())[0][1];
const message = (id: string, avance = 5000) => deposerMessage(depots, { idMessage: id, avance });
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });
const T1 = T0 + 10_000;

beforeEach(async () => {
  await preparer();
    etat.catalogue = null;
  suivi.appels.length = 0; suivi.file.length = 0; suivi.defaut = { statut: "suit" };
  envois.length = 0; prives.length = 0; publics.length = 0;
  brancher();
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  await validerFormulationsAuParcours(FORM);
});
afterEach(nettoyer);


const LIEN_RAPPEL = ["mp-lien-v3-1", "mp-lien-v3-2", "mp-lien-v3-3"];
const VRAIE_LISTE = [...VERSIONS_M1_ACCEPTEES_PAR_LE_SITE, ...VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE];

describe("versions avec lien acceptées par le site", () => {
  it.each(LIEN_RAPPEL)("OK Instagram (ig_attente_ok, réglages allumés, lien allumé) avec la formulation validée %s : le lien part", async (v) => {
    expect(VRAIE_LISTE).toContain(v);
    await validerFormulationsAuParcours(["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", v]);
    await semer("1", "ig_attente_ok");
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    expect(envois[0].texte).toMatch(/https?:\/\//);
    expect(await un()).toMatchObject({ etat: "attente_email", versionTexteM1: v, formulations: { "lien-rappel": v } });
  });

  it("le site refuse ce que la liste ne contient pas : version absente, lien-rappel inconnu, groupes sans lien", () => {
    for (const v of ["mp-lien-v2", "mp-pub-linkedin-v1", "mp-ig-suivre-v1-1", "mp-m1-v5-1", "mp-adresse-refusee-v3-1", "mp-lien-v3-4", "inconnue", ""]) expect(siteAccepteVersionM1(v), v).toBe(false);
  });

  it("liste fermée : exactement les versions à lien des groupes m1-lien, lien-rappel et deja-envoye du dictionnaire, plus mp-m1-v3", () => {
    const d = JSON.parse(readFileSync(new URL("../../contrats/dictionnaire-textes-mp.v2.json", import.meta.url), "utf8")) as { groupes: Record<string, string[]>; textes: Record<string, { texte: string }> };
    const attendu = ["m1-lien", "lien-rappel", "deja-envoye"].flatMap((g) => d.groupes[g]).filter((v) => d.textes[v].texte.includes("[LIEN]"));
    expect([...VRAIE_LISTE].sort()).toEqual([...attendu, "mp-m1-v3"].sort());
  });
});
