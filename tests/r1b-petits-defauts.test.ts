/**
 * LOT R1b — PETITS DÉFAUTS DU CONTRÔLE DU PAQUET 2 (`docs/controles/CONTROLES-PAQUET2-342ce27.md`, n° 1 à 5), adaptés à L0-13 :
 * Buffer est résilié et ne peut plus envoyer, les mêmes défauts restent gardés sur le chemin Zernio (faux fournisseur, aucun appel réel) :
 *  1. deux LinkedIn dont un déconnecté, aucune mémoire : le compte connecté est proposé coché et part seul ;
 *  2. un compte déconnecté ne bloque plus le réseau : les comptes connectés restent à cocher ;
 *  3. seuls des comptes validés (réseau envoyé, compte connu) sont utilisés, rien n'est mémorisé de l'ancien outil ;
 *  4. tous les comptes refusés : la raison donnée résume tous les refus ;
 *  5. « 2 comptes », jamais « 2 réseaux » ni « réseau(x) ».
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import type { CanalPublication } from "@/fournisseurs/types";

vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-zernio-de-test-r1b-petits"; });
delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "zernio";
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
const { fournisseurParId } = await import("@/fournisseurs");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");
const { enregistrerCanauxZernio, vueEnvoiZernio } = await import("@/services/comptes-envoi-zernio");
const { casesEnvoi, casesParDefaut, ciblesDepuisCases, libelleComptes } = await import("@/domaine/comptes-envoi");

const MDP = "essai-r1b-petits-defauts";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();

// Noms distincts pour les deux LinkedIn (profil et page).
const canal = (id: string, nom: string, service: string, genre?: string): CanalPublication => ({ id, organisationId: "org-exemple", nom, service, deconnecte: false, ...(genre ? { genre } : {}) });
const CANAUX = {
  instagram: canal("exemple-ig", "Exemple IG", "instagram"),
  linkedinProfil: canal("exemple-li-profil", "Profil exemple", "linkedin", "profile"),
  linkedinPage: canal("exemple-li-page", "Page exemple", "linkedin", "page"),
};
const ID = { instagram: CANAUX.instagram.id, linkedinProfil: CANAUX.linkedinProfil.id, linkedinPage: CANAUX.linkedinPage.id };
let deconnectes: string[] = [];
const lus = (): CanalPublication[] => Object.values(CANAUX).map((c) => ({ ...c, deconnecte: deconnectes.includes(c.id) }));

let envoyer: ReturnType<typeof brancher>;
function brancher() {
  injecterClientZernio(creerFauxClientZernio().client);
  const zernio = fournisseurParId("publication", "zernio");
  vi.spyOn(zernio, "listerCanaux").mockImplementation(async () => lus());
  let n = 0;
  return vi.spyOn(zernio, "envoyer").mockImplementation(async () => ({ idExterne: `exemple-post-${++n}`, via: "zernio" as const, statut: "brouillon" as const }));
}
const cocher = async (id: string) => {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
};
const canauxEnvoyes = () => envoyer.mock.calls.map((c) => (c[0] as unknown as { cible: string }).cible);
const LINKEDIN = [{ reseau: "linkedin" as const, nom: "LinkedIn" }];
const lireComptes = async () => {
  await enregistrerCanauxZernio(fournisseurParId("publication", "zernio"));
  return (await vueEnvoiZernio())!;
};

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  deconnectes = [];
  reinitialiserDepots();
  // CORRECTEUR FINAL A : les exemples servent ici de vraies vidéos (vrai moteur, fichier sur le stockage).
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  envoyer = brancher();
});

describe("R1b · petits défauts — compte déconnecté (chemin Zernio)", () => {
  it("ROUGE 1 : deux LinkedIn dont la page déconnectée, sans mémoire → le profil est proposé coché ; sans compte nommé le refus ne cite que lui, avec le compte nommé il part, lui seul", async () => {
    deconnectes = [ID.linkedinPage];
    const vue = await lireComptes();
    expect(vue.comptes.linkedin?.probleme).toBeUndefined();
    const cases = casesEnvoi(LINKEDIN, vue.comptes);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ reseau: "linkedin" });
    expect(vue.comptes.linkedin).toMatchObject({ nom: "Profil exemple" });
    const cles = casesParDefaut(cases, ["linkedin"], vue.comptes);
    expect(cles).toEqual([cases[0].cle]);
    // Sans compte nommé (l'unique case n'en porte pas), Zernio exige un choix explicite : rien ne part, le refus ne nomme que le compte connecté.
    await cocher(VIDEO);
    const { reseaux, comptes } = ciblesDepuisCases(cles, cases);
    const refus = await pub.envoyerVersBuffer(VIDEO, reseaux, DEMAIN, { comptes }).catch((e: Error) => e);
    expect(refus).toMatchObject({ code: "CIBLE_ZERNIO", message: expect.stringMatching(/« Profil exemple »/) });
    expect((refus as Error).message).not.toMatch(/Page exemple/);
    expect(envoyer).not.toHaveBeenCalled();
    // Le compte connecté nommé part bien, et seulement lui.
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinProfil] } });
    expect(canauxEnvoyes()).toEqual([ID.linkedinProfil]);
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ via: "zernio", canalId: ID.linkedinProfil });
  });

  it("ROUGE 1 bis : sans la feuille (« Programmer les N »), le message dit juste : la page est déconnectée, seul le profil est cité, rien ne part", async () => {
    deconnectes = [ID.linkedinPage];
    await lireComptes();
    await cocher(VIDEO);
    const e = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN).catch((x: Error) => x);
    expect(e).toMatchObject({ code: "CIBLE_ZERNIO" });
    expect((e as Error).message).toMatch(/Cochez la page ou le profil de destination/);
    expect((e as Error).message).toMatch(/« Profil exemple »/);
    expect((e as Error).message).not.toMatch(/Page exemple/);
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("ROUGE 2 : la page se déconnecte après la lecture des comptes → relue, le profil reste à cocher, jamais de « problème » qui grise tout le réseau", async () => {
    const avant = await lireComptes();
    expect(casesEnvoi(LINKEDIN, avant.comptes)).toHaveLength(2);
    deconnectes = [ID.linkedinPage];
    const apres = await lireComptes();
    expect(apres.comptes.linkedin?.probleme).toBeUndefined();
    const cases = casesEnvoi(LINKEDIN, apres.comptes);
    expect(cases.map((x) => x.canalId ?? null)).not.toContain(ID.linkedinPage);
    expect(casesParDefaut(cases, ["linkedin"], apres.comptes)).toEqual([cases[0].cle]);
    // Le compte choisi (le profil) part ; la page déconnectée n'est jamais visée.
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinProfil] } });
    expect(canauxEnvoyes()).toEqual([ID.linkedinProfil]);
  });

  it("le compte déconnecté coché d'office ailleurs (requête directe) est refusé (CIBLE_ZERNIO) : jamais utilisé comme cible, seul le compte connecté est cité", async () => {
    deconnectes = [ID.linkedinPage];
    await lireComptes();
    await cocher(VIDEO);
    const e = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage] } }).catch((x: Error) => x);
    expect(e).toMatchObject({ code: "CIBLE_ZERNIO", message: expect.stringMatching(/n'est plus relié à Zernio.*recochez-le/) });
    expect((e as Error).message).not.toMatch(/Page exemple/);
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("R1b · petits défauts — mémoire, refus, libellés", () => {
  it("ROUGE 3 : des comptes pour un réseau qui n'est pas envoyé ne sont jamais utilisés ni mémorisés", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage], facebook: ["compte-inconnu"] } });
    expect(canauxEnvoyes()).toEqual([ID.instagram]);
    const vue = await lireComptes();
    expect(vue.comptes.linkedin?.memorises).toEqual([]);
    expect(vue.comptes.facebook?.memorises ?? []).toEqual([]);
    // Rien n'est écrit dans la mémoire des comptes de l'ancien outil : ni l'id inconnu, ni la page LinkedIn.
    expect(JSON.stringify((await depots().parametres.obtenir("buffer.correspondance"))?.valeur ?? {})).not.toMatch(/compte-inconnu|linkedin/);
  });

  it("ROUGE 4 : les deux LinkedIn refusés (déjà chez Zernio, autre date) → la raison résume les deux refus", async () => {
    await cocher(VIDEO);
    const deux = { comptes: { linkedin: [ID.linkedinProfil, ID.linkedinPage] } };
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, deux);
    const apres = new Date(Date.now() + 50 * 3600_000).toISOString();
    const e = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], apres, deux).catch((x: Error) => x);
    expect(e).toMatchObject({ code: "DEJA_DANS_OUTIL" });
    expect((e as Error).message).toMatch(/Aucun des 2 comptes n'est parti/);
    expect((e as Error).message).toMatch(/Profil exemple/);
    expect((e as Error).message).toMatch(/Page exemple/);
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it("ROUGE 5 : « 1 compte », « 2 comptes » ; le journal compte des comptes, jamais « réseau(x) »", async () => {
    expect(libelleComptes(1)).toBe("1 compte");
    expect(libelleComptes(2)).toBe("2 comptes");
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinProfil, ID.linkedinPage] } });
    const journal = (await depots().evenements.lister()).map((x) => x.message).join("\n");
    expect(journal).toMatch(/Brouillon dans l'outil de publication : 2 comptes/);
    expect(journal).not.toMatch(/réseau\(x\)/);
  });

  it("ROUGE 5 bis : la feuille d'envoi dit « comptes », accordés, sans « réseau(x) » ni « autre(s) »", () => {
    const f = readFileSync(new URL("../src/components/publication/FeuilleEnvoyer.tsx", import.meta.url), "utf8");
    expect(f).toMatch(/libelleComptes\(n\)/);
    expect(f).not.toMatch(/réseau\$\{n > 1 \? "x" : ""\}/);
    expect(f).not.toMatch(/autre\(s\)|réseau\(x\)/);
    const s = readFileSync(new URL("../src/services/publications.ts", import.meta.url), "utf8");
    expect(s).not.toMatch(/réseau\(x\)/);
  });
});
