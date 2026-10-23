/**
 * LOT R1b — PETITS DÉFAUTS DU CONTRÔLE DU PAQUET 2 (`docs/controles/CONTROLES-PAQUET2-342ce27.md`, n° 1 à 5). Tests
 * ROUGES avant la correction :
 *  1. deux LinkedIn dont un déconnecté, aucune mémoire : le compte connecté est proposé coché, le message est juste ;
 *  2. un compte mémorisé déconnecté ne bloque plus le réseau : les comptes connectés restent à cocher, le message nomme
 *     le compte déconnecté ;
 *  3. seuls des comptes validés (réseau envoyé, compte connu) sont mémorisés ;
 *  4. tous les comptes refusés : la raison donnée résume tous les refus ;
 *  5. « 2 comptes », jamais « 2 réseaux » ni « réseau(x) ».
 *
 * Aucun réseau : `fetch` est remplacé par la doublure `helpers/r1-buffer.ts`. Aucune clé réelle.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CANAUX, LECTURES, fauxBuffer } from "./helpers/r1-buffer";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-r1b-petits";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const buf = await import("@/services/buffer");
const { casesEnvoi, casesParDefaut, ciblesDepuisCases, libelleComptes } = await import("@/domaine/comptes-envoi");

const MDP = "essai-r1b-petits-defauts";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();

// Noms distincts pour les deux LinkedIn (profil et page), dans la copie des lectures propre à ce fichier.
type Canal = { id: string; displayName: string; isDisconnected: boolean };
const canal = (id: string) => (LECTURES.canaux.data.channels as Canal[]).find((c) => c.id === id)!;
canal(CANAUX.linkedinProfil).displayName = "Profil Will";
canal(CANAUX.linkedinPage).displayName = "Page Axion";
const deconnecter = (id: string) => {
  canal(id).isDisconnected = true;
};

let buffer: ReturnType<typeof fauxBuffer>;
const cocher = async (id: string) => {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
};
const canauxEnvoyes = () => buffer.mutations().map((m) => (m.variables.input as { channelId: string }).channelId);
const LINKEDIN = [{ reseau: "linkedin" as const, nom: "LinkedIn" }];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  for (const c of LECTURES.canaux.data.channels as Canal[]) c.isDisconnected = false;
  reinitialiserDepots();
  // CORRECTEUR FINAL A : les exemples servent ici de vraies vidéos (vrai moteur, fichier sur le stockage).
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  buffer = fauxBuffer();
  vi.stubGlobal("fetch", buffer.appeler);
});

describe("R1b · petits défauts — compte déconnecté", () => {
  it("ROUGE 1 : deux LinkedIn dont la page déconnectée, sans mémoire → le profil est proposé coché et part", async () => {
    deconnecter(CANAUX.linkedinPage);
    await buf.testerBuffer();
    const vue = (await buf.vueEnvoiBuffer())!;
    expect(vue.comptes.linkedin?.probleme).toBeUndefined();
    expect(vue.comptes.linkedin?.avertissement).toMatch(/« Page Axion » est déconnecté/);
    const cases = casesEnvoi(LINKEDIN, vue.comptes);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ canalId: CANAUX.linkedinProfil, libelle: "LinkedIn · Profil Will" });
    const cles = casesParDefaut(cases, ["linkedin"], vue.comptes);
    expect(cles).toEqual([cases[0].cle]);
    // Ce que la feuille envoie part bien sur le profil, et seulement lui.
    await cocher(VIDEO);
    const { reseaux, comptes } = ciblesDepuisCases(cles, cases);
    const r = await pub.envoyerVersBuffer(VIDEO, reseaux, DEMAIN, { comptes });
    expect(canauxEnvoyes()).toEqual([CANAUX.linkedinProfil]);
    expect(r.publications).toHaveLength(1);
  });

  it("ROUGE 1 bis : sans la feuille (« Programmer les N »), le message dit juste : la page est déconnectée, choisir le compte", async () => {
    deconnecter(CANAUX.linkedinPage);
    await buf.testerBuffer();
    const c = await buf.comptesBufferPour("linkedin");
    expect(c.ok).toBe(false);
    if (c.ok) return;
    expect(c.message).toMatch(/« Page Axion » est déconnecté/);
    expect(c.message).toMatch(/choisissez le compte LinkedIn une première fois/i);
  });

  it("ROUGE 2 : mémoire [profil, page], la page se déconnecte → le profil reste à cocher, le message nomme la page", async () => {
    deconnecter(CANAUX.linkedinPage);
    await buf.testerBuffer();
    await buf.choisirCanalBuffer("linkedin", [CANAUX.linkedinProfil, CANAUX.linkedinPage]);
    const vue = (await buf.vueEnvoiBuffer())!;
    expect(vue.comptes.linkedin?.probleme).toBeUndefined();
    expect(vue.comptes.linkedin?.avertissement).toMatch(/« Page Axion » est déconnecté/);
    const cases = casesEnvoi(LINKEDIN, vue.comptes);
    expect(cases.map((x) => x.canalId)).toEqual([CANAUX.linkedinProfil]);
    expect(casesParDefaut(cases, ["linkedin"], vue.comptes)).toEqual([cases[0].cle]);
    // Réglages : pas de « problème » qui grise tout le réseau.
    const reglage = (await buf.vueBuffer()).reseaux.find((x) => x.reseau === "linkedin")!;
    expect(reglage.probleme).toBeUndefined();
    expect(reglage.avertissement).toMatch(/Page Axion/);
    // Sans case cochée (envoi automatique), le refus nomme le compte déconnecté.
    const c = await buf.comptesBufferPour("linkedin");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.message).toMatch(/LinkedIn « Page Axion » est déconnecté/);
  });

  it("le compte déconnecté coché d'office ailleurs (requête directe) est nommé dans le refus", async () => {
    deconnecter(CANAUX.linkedinPage);
    await buf.testerBuffer();
    await cocher(VIDEO);
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } })).rejects.toThrow(/« Page Axion »/);
    expect(buffer.mutations()).toHaveLength(0);
  });
});

describe("R1b · petits défauts — mémoire, refus, libellés", () => {
  it("ROUGE 3 : des comptes pour un réseau qui n'est pas envoyé ne sont jamais mémorisés", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage], facebook: ["compte-inconnu"] } });
    const vue = (await buf.vueEnvoiBuffer())!;
    expect(vue.comptes.linkedin?.memorises).toEqual([]);
    expect(vue.comptes.facebook?.memorises).toEqual([]);
    // Rien n'est écrit dans la mémoire des comptes : ni l'id inconnu, ni la page LinkedIn (réseau non envoyé).
    expect(JSON.stringify((await depots().parametres.obtenir(buf.PARAM_CORRESPONDANCE))?.valeur ?? {})).not.toMatch(/compte-inconnu|linkedin/);
  });

  it("ROUGE 4 : les deux LinkedIn refusés → la raison résume les deux refus", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinProfil, CANAUX.linkedinPage] } });
    const apres = new Date(Date.now() + 50 * 3600_000).toISOString();
    const e = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], apres, { comptes: { linkedin: [CANAUX.linkedinProfil, CANAUX.linkedinPage] } }).catch((x: Error) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toMatch(/Profil Will/);
    expect((e as Error).message).toMatch(/Page Axion/);
    expect(buffer.mutations()).toHaveLength(2);
  });

  it("ROUGE 5 : « 1 compte », « 2 comptes » ; le journal compte des comptes, jamais « réseau(x) »", async () => {
    expect(libelleComptes(1)).toBe("1 compte");
    expect(libelleComptes(2)).toBe("2 comptes");
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinProfil, CANAUX.linkedinPage] } });
    const journal = (await depots().evenements.lister()).map((x) => x.message).join("\n");
    expect(journal).toMatch(/Brouillon dans Buffer : 2 comptes/);
    expect(journal).not.toMatch(/réseau\(x\)/);
  });

  it("ROUGE 5 bis : la feuille d'envoi dit « comptes », accordés, sans « réseau(x) » ni « autre(s) »", () => {
    const f = readFileSync(new URL("../src/components/publication/FeuilleEnvoyerBuffer.tsx", import.meta.url), "utf8");
    expect(f).toMatch(/libelleComptes\(n\)/);
    expect(f).not.toMatch(/réseau\$\{n > 1 \? "x" : ""\}/);
    expect(f).not.toMatch(/autre\(s\)|réseau\(x\)/);
    const s = readFileSync(new URL("../src/services/publications.ts", import.meta.url), "utf8");
    expect(s).not.toMatch(/réseau\(x\)/);
  });
});
