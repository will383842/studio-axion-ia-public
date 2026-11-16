/**
 * LOT R1b — LE COMPTE SE CHOISIT À CHAQUE ENVOI (deux LinkedIn, deux Facebook). Tests ROUGES avant le code
 * (`docs/OUTILS-REELS-R1.md`, section R1b) :
 *  1. deux comptes du même réseau cochés → DEUX envois légitimes (deux demandes, deux publications) ;
 *  2. le même compte deux fois (dans la même demande, ou renvoyé) → UN seul envoi ;
 *  3. sans mémoire, aucun compte n'est coché par défaut dans la feuille (jamais un compte que le dirigeant n'a pas vu) ;
 *  4. « Programmer les N » sans compte mémorisé pour un réseau à plusieurs comptes → ce réseau est mis de côté, phrase simple.
 * Et : la mémoire du dernier choix, l'affichage du compte, une publication d'avant R1b reste reconnue.
 *
 * Adapté à L0-13 (Buffer résilié, ne peut plus envoyer) : les mêmes gardes sont prouvées sur le chemin Zernio (faux fournisseur, aucun appel réel,
 * aucune clé réelle) ; Zernio ne mémorise pas de comptes, les attentes sur la mémoire de Buffer deviennent « rien n'est mémorisé ».
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import type { CanalPublication } from "@/fournisseurs/types";

vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-zernio-de-test-r1b-7788"; });
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
const gen = await import("@/services/generateur");
const mes = await import("@/services/mesures");
const { fournisseurParId } = await import("@/fournisseurs");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");

const MDP = "essai-r1b-comptes";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const canal = (id: string, nom: string, service: string, genre?: string): CanalPublication => ({ id, organisationId: "org-exemple", nom, service, deconnecte: false, ...(genre ? { genre } : {}) });
const CANAUX = {
  instagram: canal("exemple-ig", "Exemple IG", "instagram"),
  facebook1: canal("exemple-fb-1", "Exemple Page 1", "facebook", "page"),
  facebook2: canal("exemple-fb-2", "Exemple Page 2", "facebook", "page"),
  linkedinProfil: canal("exemple-li-profil", "Exemple LI profil", "linkedin", "profile"),
  linkedinPage: canal("exemple-li-page", "Exemple LI page", "linkedin", "page"),
};
const ID = Object.fromEntries(Object.entries(CANAUX).map(([k, c]) => [k, c.id])) as Record<keyof typeof CANAUX, string>;

let envoyer: ReturnType<typeof brancher>;
function brancher() {
  injecterClientZernio(creerFauxClientZernio().client);
  const zernio = fournisseurParId("publication", "zernio");
  vi.spyOn(zernio, "listerCanaux").mockResolvedValue(Object.values(CANAUX));
  let n = 0;
  return vi.spyOn(zernio, "envoyer").mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 5));
    return { idExterne: `exemple-post-${++n}`, via: "zernio" as const, statut: "brouillon" as const };
  });
}
const cocher = async (id: string) => {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
};
const canauxEnvoyes = () => envoyer.mock.calls.map((c) => (c[0] as unknown as { cible: string }).cible);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  reinitialiserDepots();
  // CORRECTEUR FINAL A : les exemples servent ici de vraies vidéos (vrai moteur, fichier sur le stockage).
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  envoyer = brancher();
});

describe("R1b — un compte choisi à chaque envoi", () => {
  it("ROUGE 1 : LinkedIn profil ET page cochés → deux envois légitimes, deux publications, chacune avec son compte", async () => {
    await cocher(VIDEO);
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinProfil, ID.linkedinPage] } });
    expect(envoyer.mock.calls).toHaveLength(2);
    expect(canauxEnvoyes().sort()).toEqual([ID.linkedinProfil, ID.linkedinPage].sort());
    expect(r.publications.map((p) => p.canalId).sort()).toEqual([ID.linkedinProfil, ID.linkedinPage].sort());
    expect(r.publications.every((p) => p.etatEnvoi === "envoye" && p.reseau === "linkedin" && p.via === "zernio")).toBe(true);
    // Le compte visé est enregistré (nom lisible) pour l'affichage.
    expect(r.publications.every((p) => !!p.canalNom)).toBe(true);
    // Un seul texte LinkedIn pour les deux comptes.
    expect(new Set(r.publications.map((p) => p.texte)).size).toBe(1);
    // Deux empreintes différentes : deux envois, pas un doublon.
    expect(new Set(r.publications.map((p) => p.cleEnvoi)).size).toBe(2);
  });

  it("ROUGE 1 bis : la page déjà chez Zernio n'empêche pas d'envoyer ensuite au profil (autre compte)", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage] } });
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinProfil] } });
    expect(envoyer.mock.calls).toHaveLength(2);
    expect(r.publications[0]).toMatchObject({ canalId: ID.linkedinProfil, etatEnvoi: "envoye" });
  });

  it("ROUGE 2 : le même compte deux fois (même demande, puis renvoi) → UN seul envoi", async () => {
    await cocher(VIDEO);
    const a = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage, ID.linkedinPage] } });
    expect(envoyer.mock.calls).toHaveLength(1);
    expect(a.publications).toHaveLength(1);
    const b = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage] } });
    expect(envoyer.mock.calls).toHaveLength(1);
    expect(b.publications[0].id).toBe(a.publications[0].id);
    // Deux touchers simultanés sur le même compte : toujours un seul message.
    await Promise.allSettled([
      pub.envoyerVersBuffer(VIDEO, ["facebook"], DEMAIN, { comptes: { facebook: [ID.facebook2] } }),
      pub.envoyerVersBuffer(VIDEO, ["facebook"], DEMAIN, { comptes: { facebook: [ID.facebook2] } }),
    ]);
    expect(canauxEnvoyes().filter((c) => c === ID.facebook2)).toHaveLength(1);
  });

  it("le même compte, autre date, déjà chez Zernio → refus clair, aucun second message (garantie R1 inchangée)", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage] } });
    const apres = new Date(Date.now() + 50 * 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], apres, { comptes: { linkedin: [ID.linkedinPage] } })).rejects.toMatchObject({ code: "DEJA_DANS_OUTIL" });
    expect(envoyer.mock.calls).toHaveLength(1);
  });

  it("un compte qui n'est pas de ce réseau n'est jamais utilisé comme cible (Zernio prend un compte LinkedIn)", async () => {
    await cocher(VIDEO);
    // Identifiant d'Instagram donné pour LinkedIn : refusé (CIBLE_ZERNIO), rien ne part, aucun compte LinkedIn n'est deviné.
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.instagram] } })).rejects.toMatchObject({ code: "CIBLE_ZERNIO" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(canauxEnvoyes()).toEqual([]);
  });

  it("ROUGE 3 : sans mémoire, aucun compte LinkedIn n'est coché par défaut ; un envoi Zernio ne mémorise rien (la mémoire des comptes était celle de Buffer)", async () => {
    const { casesEnvoi, casesParDefaut } = await import("@/domaine/comptes-envoi");
    const { enregistrerCanauxZernio, vueEnvoiZernio } = await import("@/services/comptes-envoi-zernio");
    await enregistrerCanauxZernio(fournisseurParId("publication", "zernio"));
    const vue = (await vueEnvoiZernio())!;
    // Deux comptes LinkedIn : deux cases, rien de coché ; Instagram (un seul compte) : une case.
    const reseaux = [
      { reseau: "linkedin" as const, nom: "LinkedIn" },
      { reseau: "instagram" as const, nom: "Instagram" },
    ];
    const cases = casesEnvoi(reseaux, vue.comptes);
    expect(cases.filter((c) => c.reseau === "linkedin")).toHaveLength(2);
    expect(cases.filter((c) => c.reseau === "instagram")).toHaveLength(1);
    expect(cases.find((c) => c.reseau === "linkedin")!.libelle).toMatch(/^LinkedIn · /);
    const defaut = casesParDefaut(cases, ["linkedin", "instagram"], vue.comptes);
    expect(defaut.filter((cle) => cases.find((c) => c.cle === cle)?.reseau === "linkedin")).toEqual([]);
    expect(defaut).toContain("instagram");

    // Le dirigeant envoie vers la page : la demande part sur ce compte, mais rien n'est mémorisé ni coché d'office ensuite.
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinPage] } });
    expect(canauxEnvoyes()).toEqual([ID.linkedinPage]);
    const vue2 = (await vueEnvoiZernio())!;
    expect(vue2.comptes.linkedin?.memorises).toEqual([]);
    const cases2 = casesEnvoi(reseaux, vue2.comptes);
    expect(casesParDefaut(cases2, ["linkedin"], vue2.comptes)).toEqual([]);
    expect(await depots().parametres.obtenir("buffer.correspondance")).toBeNull();
  });

  it("la feuille : cases cochées → réseaux et comptes envoyés", async () => {
    const { ciblesDepuisCases } = await import("@/domaine/comptes-envoi");
    const cases = [
      { cle: "instagram", reseau: "instagram" as const, libelle: "Instagram" },
      { cle: `linkedin:${ID.linkedinProfil}`, reseau: "linkedin" as const, canalId: ID.linkedinProfil, libelle: "LinkedIn · Profil" },
      { cle: `linkedin:${ID.linkedinPage}`, reseau: "linkedin" as const, canalId: ID.linkedinPage, libelle: "LinkedIn · Page" },
    ];
    expect(ciblesDepuisCases(["instagram", `linkedin:${ID.linkedinPage}`, `linkedin:${ID.linkedinProfil}`], cases)).toEqual({
      reseaux: ["instagram", "linkedin"],
      comptes: { linkedin: [ID.linkedinPage, ID.linkedinProfil] },
    });
  });

  it("ROUGE 4 : « Programmer les N » sans page Facebook choisie → Facebook mis de côté, phrase simple (rien ne part au hasard) ; les autres partent", async () => {
    const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
    const VIDEOS = ["v-15", "v-02", "v-01", "v-11", "v-13"];
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" }, { dejaControle: true });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    for (const [i, r] of CINQ.entries()) {
      await gen.rangerVideo(VIDEOS[i], vue.versions.find((x) => x.variante.reseau === r)!.variante.id);
      await cocher(VIDEOS[i]);
    }
    const r = await mes.programmerSujet(s.id, { jourJ: mes.jourJParDefaut() });
    const facebook = r.ignorees.find((x) => x.reseau === "facebook");
    expect(facebook?.message).toMatch(/Cochez la page ou le profil de destination/);
    expect(facebook?.message).toMatch(/Exemple Page 1/);
    expect(facebook?.message).not.toMatch(/Simulation|Réglages, Connexions|DEJA_|ZERNIO_/);
    expect(canauxEnvoyes()).not.toContain(ID.facebook1);
    expect(canauxEnvoyes()).not.toContain(ID.facebook2);
    expect(r.programmees.some((x) => x.reseau === "facebook")).toBe(false);
    expect(r.programmees.map((x) => x.reseau).sort()).toEqual(["instagram", "linkedin"]);
    expect(canauxEnvoyes()).toContain(ID.instagram);
  });

  it("« Programmer les N » : un envoi précédent au profil ne mémorise rien ; LinkedIn part sur le compte que Zernio prend, aucun réseau mis de côté", async () => {
    const CINQ = ["linkedin"] as const;
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" }, { dejaControle: true });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    await gen.rangerVideo("v-11", vue.versions[0].variante.id);
    await cocher("v-11");
    await cocher(VIDEO);
    // Le dirigeant a choisi le profil lors d'un envoi précédent (autre vidéo) : Zernio ne garde pas ce choix.
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [ID.linkedinProfil] } });
    const r = await mes.programmerSujet(s.id, { jourJ: mes.jourJParDefaut() });
    expect(r.ignorees).toEqual([]);
    expect(canauxEnvoyes()).toHaveLength(2);
    expect(canauxEnvoyes()[0]).toBe(ID.linkedinProfil);
    expect([ID.linkedinProfil, ID.linkedinPage]).toContain(canauxEnvoyes()[1]);
  });

  it("données existantes : une publication d'avant R1b (empreinte sans compte, via buffer) reste reconnue par l'anti-doublon : refus DEJA_CHEZ_UN_AUTRE_OUTIL, rien n'est renvoyé ni réécrit", async () => {
    await cocher(VIDEO);
    const ancienne = createHash("sha256").update(`${VIDEO}|instagram|${DEMAIN}`).digest("hex").slice(0, 32);
    const p = await depots().publications.enregistrer({
      id: "pub-ancienne",
      videoId: VIDEO,
      reseau: "instagram",
      statut: "brouillon",
      via: "buffer",
      date: DEMAIN,
      texte: "texte",
      etatEnvoi: "envoye",
      canalId: ID.instagram,
      cleEnvoi: ancienne,
      idExterne: "f1a2b3c4d5e6f7a8b9c0d999",
      creeLe: DEMAIN,
      modifieLe: DEMAIN,
    });
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "DEJA_CHEZ_UN_AUTRE_OUTIL", message: expect.stringMatching(/Buffer/) });
    expect(envoyer.mock.calls).toHaveLength(0);
    expect(await depots().publications.obtenir(p.id)).toMatchObject({ via: "buffer", idExterne: "f1a2b3c4d5e6f7a8b9c0d999", etatEnvoi: "envoye" });
    expect(await depots().publications.compter((x) => x.videoId === VIDEO)).toBe(1);
  });
});

describe("R1b — écrans", () => {
  it("le compte visé s'affiche avec le réseau ; une publication d'avant R1b garde le seul nom du réseau", async () => {
    const { libelleReseauCompte } = await import("@/domaine/comptes-envoi");
    expect(libelleReseauCompte("LinkedIn", "Axion-IA.com")).toBe("LinkedIn · Axion-IA.com");
    expect(libelleReseauCompte("LinkedIn", undefined)).toBe("LinkedIn");
  });

  it("deux comptes au même nom : le genre (Profil, Page) les distingue, en français", async () => {
    const { casesEnvoi } = await import("@/domaine/comptes-envoi");
    const cases = casesEnvoi([{ reseau: "linkedin", nom: "LinkedIn" }], {
      linkedin: {
        choix: [
          { id: "a", nom: "Nom exemple", genre: "profile" },
          { id: "b", nom: "Nom exemple", genre: "page" },
        ],
      },
    });
    expect(cases.map((c) => c.libelle)).toEqual(["LinkedIn · Nom exemple (Profil)", "LinkedIn · Nom exemple (Page)"]);
  });

  it("la feuille d'envoi passe les comptes cochés et ne coche jamais d'office un compte non choisi", async () => {
    const { readFileSync } = await import("node:fs");
    const f = readFileSync(new URL("../src/components/publication/FeuilleEnvoyer.tsx", import.meta.url), "utf8");
    expect(f).toMatch(/envoyerVersBufferAction\(videoId, reseaux, dateIso\(\), autreReseau, comptes\)/);
    expect(f).toMatch(/casesParDefaut/);
    expect(f).not.toMatch(/Simulation/);
  });
});
