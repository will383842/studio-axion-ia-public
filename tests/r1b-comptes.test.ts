/**
 * LOT R1b — LE COMPTE SE CHOISIT À CHAQUE ENVOI (deux LinkedIn, deux Facebook). Tests ROUGES avant le code
 * (`docs/OUTILS-REELS-R1.md`, section R1b) :
 *  1. deux comptes du même réseau cochés → DEUX envois légitimes (deux brouillons, deux publications) ;
 *  2. le même compte deux fois (dans la même demande, ou renvoyé) → UN seul envoi ;
 *  3. sans mémoire, aucun compte n'est coché par défaut dans la feuille (jamais un compte que Will n'a pas vu) ;
 *  4. « Programmer les N » sans compte mémorisé pour un réseau à plusieurs comptes → ce réseau est mis de côté, phrase simple.
 * Et : la mémoire du dernier choix, l'affichage du compte, une publication d'avant R1b reste reconnue.
 *
 * Aucun réseau : `fetch` est remplacé par la doublure `helpers/r1-buffer.ts`. Aucune clé réelle.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { CANAUX, fauxBuffer } from "./helpers/r1-buffer";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-r1b-7788";
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
const gen = await import("@/services/generateur");
const mes = await import("@/services/mesures");

const MDP = "essai-r1b-comptes";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const EN_PLUS = [
  { id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" },
  { id: "e00091000000000000000000", name: "Exemple name", displayName: "Exemple YouTube", service: "youtube", type: "channel", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" },
];

let buffer: ReturnType<typeof fauxBuffer>;
function brancher() {
  buffer = fauxBuffer({ canauxEnPlus: EN_PLUS });
  vi.stubGlobal("fetch", buffer.appeler);
}
const cocher = async (id: string) => {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
};
const canauxEnvoyes = () => buffer.mutations().map((m) => (m.variables.input as { channelId: string }).channelId);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  // CORRECTEUR FINAL A : les exemples servent ici de vraies vidéos (vrai moteur, fichier sur le stockage).
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  brancher();
});

describe("R1b — un compte choisi à chaque envoi", () => {
  it("ROUGE 1 : LinkedIn profil ET page cochés → deux envois légitimes, deux publications, chacune avec son compte", async () => {
    await cocher(VIDEO);
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinProfil, CANAUX.linkedinPage] } });
    expect(buffer.mutations()).toHaveLength(2);
    expect(canauxEnvoyes().sort()).toEqual([CANAUX.linkedinProfil, CANAUX.linkedinPage].sort());
    expect(r.publications.map((p) => p.canalId).sort()).toEqual([CANAUX.linkedinProfil, CANAUX.linkedinPage].sort());
    expect(r.publications.every((p) => p.etatEnvoi === "envoye" && p.reseau === "linkedin")).toBe(true);
    // Le compte visé est enregistré (nom lisible) pour l'affichage.
    expect(r.publications.every((p) => !!p.canalNom)).toBe(true);
    // Un seul texte LinkedIn pour les deux comptes.
    expect(new Set(r.publications.map((p) => p.texte)).size).toBe(1);
    // Deux empreintes différentes : deux envois, pas un doublon.
    expect(new Set(r.publications.map((p) => p.cleEnvoi)).size).toBe(2);
  });

  it("ROUGE 1 bis : la page déjà dans Buffer n'empêche pas d'envoyer ensuite au profil (autre compte)", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } });
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinProfil] } });
    expect(buffer.mutations()).toHaveLength(2);
    expect(r.publications[0]).toMatchObject({ canalId: CANAUX.linkedinProfil, etatEnvoi: "envoye" });
  });

  it("ROUGE 2 : le même compte deux fois (même demande, puis renvoi) → UN seul envoi", async () => {
    await cocher(VIDEO);
    const a = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage, CANAUX.linkedinPage] } });
    expect(buffer.mutations()).toHaveLength(1);
    expect(a.publications).toHaveLength(1);
    const b = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } });
    expect(buffer.mutations()).toHaveLength(1);
    expect(b.publications[0].id).toBe(a.publications[0].id);
    // Deux touchers simultanés sur le même compte : toujours un seul message.
    await Promise.allSettled([
      pub.envoyerVersBuffer(VIDEO, ["facebook"], DEMAIN, { comptes: { facebook: [CANAUX.facebook2] } }),
      pub.envoyerVersBuffer(VIDEO, ["facebook"], DEMAIN, { comptes: { facebook: [CANAUX.facebook2] } }),
    ]);
    expect(canauxEnvoyes().filter((c) => c === CANAUX.facebook2)).toHaveLength(1);
  });

  it("le même compte, autre date, déjà dans Buffer → refus clair, aucun second message (garantie R1 inchangée)", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } });
    const apres = new Date(Date.now() + 50 * 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], apres, { comptes: { linkedin: [CANAUX.linkedinPage] } })).rejects.toMatchObject({ code: "DEJA_DANS_BUFFER" });
    expect(buffer.mutations()).toHaveLength(1);
  });

  it("un compte qui n'est pas de ce réseau est refusé avant tout envoi", async () => {
    await cocher(VIDEO);
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.instagram] } })).rejects.toThrow(/LinkedIn/);
    expect(buffer.mutations()).toHaveLength(0);
  });

  it("ROUGE 3 : sans mémoire, aucun compte LinkedIn n'est coché par défaut ; après un choix, ce choix revient", async () => {
    const { casesEnvoi, casesParDefaut } = await import("@/domaine/comptes-envoi");
    await buf.testerBuffer();
    const vue = (await buf.vueEnvoiBuffer())!;
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

    // Will envoie vers la page : c'est mémorisé et proposé la fois suivante.
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } });
    const vue2 = (await buf.vueEnvoiBuffer())!;
    const cases2 = casesEnvoi(reseaux, vue2.comptes);
    const defaut2 = casesParDefaut(cases2, ["linkedin"], vue2.comptes);
    expect(defaut2.map((cle) => cases2.find((c) => c.cle === cle)?.canalId)).toEqual([CANAUX.linkedinPage]);
  });

  it("la feuille : cases cochées → réseaux et comptes envoyés", async () => {
    const { ciblesDepuisCases } = await import("@/domaine/comptes-envoi");
    const cases = [
      { cle: "instagram", reseau: "instagram" as const, libelle: "Instagram" },
      { cle: `linkedin:${CANAUX.linkedinProfil}`, reseau: "linkedin" as const, canalId: CANAUX.linkedinProfil, libelle: "LinkedIn · Profil" },
      { cle: `linkedin:${CANAUX.linkedinPage}`, reseau: "linkedin" as const, canalId: CANAUX.linkedinPage, libelle: "LinkedIn · Page" },
    ];
    expect(ciblesDepuisCases(["instagram", `linkedin:${CANAUX.linkedinPage}`, `linkedin:${CANAUX.linkedinProfil}`], cases)).toEqual({
      reseaux: ["instagram", "linkedin"],
      comptes: { linkedin: [CANAUX.linkedinPage, CANAUX.linkedinProfil] },
    });
  });

  it("ROUGE 4 : « Programmer les N » sans compte LinkedIn mémorisé → LinkedIn mis de côté, phrase simple ; les autres partent", async () => {
    const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
    const VIDEOS = ["v-15", "v-02", "v-01", "v-11", "v-13"];
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    for (const [i, r] of CINQ.entries()) {
      await gen.rangerVideo(VIDEOS[i], vue.versions.find((x) => x.variante.reseau === r)!.variante.id);
      await cocher(VIDEOS[i]);
    }
    await buf.testerBuffer();
    // Facebook : compte déjà choisi une fois ; LinkedIn : jamais.
    await buf.choisirCanalBuffer("facebook", CANAUX.facebook2);
    const r = await mes.programmerSujet(s.id, { jourJ: mes.jourJParDefaut() });
    const linkedin = r.ignorees.find((x) => x.reseau === "linkedin");
    expect(linkedin?.message).toMatch(/choisissez le compte LinkedIn une première fois/i);
    expect(linkedin?.message).not.toMatch(/\b[A-Z][A-Z0-9_]{3,}\b|Simulation|Réglages, Connexions/);
    expect(canauxEnvoyes()).not.toContain(CANAUX.linkedinPage);
    expect(canauxEnvoyes()).not.toContain(CANAUX.linkedinProfil);
    expect(canauxEnvoyes()).toContain(CANAUX.facebook2);
    expect(r.programmees.some((x) => x.reseau === "facebook")).toBe(true);
  });

  it("« Programmer les N » avec un compte LinkedIn mémorisé par un envoi → part sur ce compte", async () => {
    const CINQ = ["linkedin"] as const;
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    await gen.rangerVideo("v-11", vue.versions[0].variante.id);
    await cocher("v-11");
    await cocher(VIDEO);
    // Will a choisi le profil lors d'un envoi précédent (autre vidéo).
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinProfil] } });
    const r = await mes.programmerSujet(s.id, { jourJ: mes.jourJParDefaut() });
    expect(r.ignorees).toEqual([]);
    expect(canauxEnvoyes()).toEqual([CANAUX.linkedinProfil, CANAUX.linkedinProfil]);
  });

  it("données existantes : une publication d'avant R1b (empreinte sans compte) reste reconnue, rien n'est renvoyé", async () => {
    await cocher(VIDEO);
    await buf.testerBuffer();
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
      canalId: CANAUX.instagram,
      cleEnvoi: ancienne,
      idExterne: "f1a2b3c4d5e6f7a8b9c0d999",
      creeLe: DEMAIN,
      modifieLe: DEMAIN,
    });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(0);
    expect(r.publications[0].id).toBe(p.id);
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
          { id: "a", nom: "Williams Jullin", genre: "profile" },
          { id: "b", nom: "Williams Jullin", genre: "page" },
        ],
      },
    });
    expect(cases.map((c) => c.libelle)).toEqual(["LinkedIn · Williams Jullin (Profil)", "LinkedIn · Williams Jullin (Page)"]);
  });

  it("la feuille d'envoi passe les comptes cochés et ne coche jamais d'office un compte non choisi", async () => {
    const { readFileSync } = await import("node:fs");
    const f = readFileSync(new URL("../src/components/publication/FeuilleEnvoyerBuffer.tsx", import.meta.url), "utf8");
    expect(f).toMatch(/envoyerVersBufferAction\(videoId, reseaux, dateIso\(\), autreReseau, comptes\)/);
    expect(f).toMatch(/casesParDefaut/);
    expect(f).not.toMatch(/Simulation/);
  });
});
