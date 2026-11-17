/**
 * STU-APUB-LECT : « À publier » est en lecture d'état pour une commande d'ORIGINE USINE ; le contenu ajouté à la main garde tout.
 *  - la garde est côté service (`envoyerParOutilAction`, l'action de la liste) : refus `ORIGINE_USINE` AVANT toute lecture de réglage,
 *    zéro appel d'envoi ; le geste manuel d'un contenu du studio est inchangé ;
 *  - la vue marque la ligne (`origineUsine`) ; la liste n'offre ni « Envoyer » ni « Remettre à relire » pour elle ;
 *  - le chemin du calendrier (`envoyerVisuelAction`) n'est pas lu par cette garde.
 * Aucun envoi réel, aucun appel réseau : faux client, dépôts en mémoire.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import type { LigneAPublier } from "@/services/a-publier";

delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-factice-essai"; });
vi.mock("@/services/image-video-carte", () => ({ travailImageVideo: async () => null }));

/** Compte les lectures de réglage et les envois : la garde doit les précéder. */
const sondes = vi.hoisted(() => ({ reglages: 0 }));
vi.mock("@/services/zernio", async (original) => {
  const reel = await original<typeof import("@/services/zernio")>();
  return { ...reel, envoiZernioAutorise: async () => (sondes.reglages++, reel.envoiZernioAutorise()) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const apub = await import("@/services/a-publier");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");
const { ListeAPublier } = await import("@/components/publication/ListeAPublier");

const MDP = "essai-origine-usine";
const VIDEO = "v-15";
const AUTRE = "v-16";
const DEMAIN = new Date(Date.now() + 86_400_000).toISOString();

async function fixerOrigine(videoId: string, origine: "usine" | "studio" | null) {
  for (const v of await depots().versions.lister((x) => x.videoId === videoId)) {
    const { origine: _o, ...reste } = v.commande as typeof v.commande & { origine?: string };
    await depots().versions.modifier(v.id, { commande: origine ? { ...reste, origine } : reste });
  }
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  delete process.env.ZERNIO_API_KEY;
  injecterClientZernio(null);
  sondes.reglages = 0;
});

describe("garde du service : envoyerParOutilAction", () => {
  it("origine usine depuis la liste : refus ORIGINE_USINE, message neutre, AUCUNE lecture de réglage, zéro appel d'envoi, rien d'écrit", async () => {
    await fixerOrigine(VIDEO, "usine");
    const { client, faux } = creerFauxClientZernio([]);
    injecterClientZernio(client);
    const avant = await depots().publications.compter(() => true);
    const r = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "zernio" });
    expect(r).toMatchObject({ ok: false, code: "ORIGINE_USINE" });
    if (!r.ok) expect(r.message).not.toMatch(/zernio|buffer|usine/i);
    expect(sondes.reglages).toBe(0);
    expect(faux.appels).toHaveLength(0);
    expect(await depots().publications.compter(() => true)).toBe(avant);
  });

  it("origine usine : le refus vaut pour tous les réseaux et tous les choix d'envoi de la liste", async () => {
    await fixerOrigine(VIDEO, "usine");
    const { client, faux } = creerFauxClientZernio([]);
    injecterClientZernio(client);
    for (const reseau of ["instagram", "facebook", "linkedin", "tiktok", "youtube-shorts"] as const) {
      expect(await envoyerParOutilAction(VIDEO, reseau, DEMAIN, { outil: "zernio", comptes: ["c1"], premierCommentaire: "x", accordTiktok: true })).toMatchObject({ ok: false, code: "ORIGINE_USINE" });
    }
    expect(faux.appels).toHaveLength(0);
  });

  it("contenu manuel (origine « studio », ou aucune) : la garde ne le touche pas, le chemin d'avant s'exécute (réglage lu)", async () => {
    for (const origine of ["studio", null] as const) {
      await fixerOrigine(VIDEO, origine);
      sondes.reglages = 0;
      const r = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "zernio" });
      if (!r.ok) expect(r.code).not.toBe("ORIGINE_USINE");
      expect(sondes.reglages).toBeGreaterThan(0);
    }
  });

  it("un autre contenu manuel reste libre pendant qu'une commande d'usine est refusée", async () => {
    await fixerOrigine(VIDEO, "usine");
    await fixerOrigine(AUTRE, "studio");
    expect(await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "zernio" })).toMatchObject({ code: "ORIGINE_USINE" });
    const r = await envoyerParOutilAction(AUTRE, "instagram", DEMAIN, { outil: "zernio" });
    if (!r.ok) expect(r.code).not.toBe("ORIGINE_USINE");
  });

  it("l'ordre des refus d'avant est gardé : un outil refusé reste OUTIL_REFUSE, même pour une commande d'usine", async () => {
    await fixerOrigine(VIDEO, "usine");
    expect(await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" as never })).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
  });

  it("le chemin du calendrier est intact : envoyerVisuelAction ne contient aucune trace de la garde d'origine", () => {
    const source = readFileSync("src/services/a-publier-zernio.ts", "utf8");
    const debut = source.indexOf("export async function envoyerVisuelAction");
    expect(debut).toBeGreaterThan(0);
    expect(source.slice(debut)).not.toMatch(/ORIGINE_USINE|origineDeLaVideo/);
    // Les seuls appelants d'envoyerParOutilAction sont les lignes de la liste « À publier ».
    expect(readFileSync("src/services/publications.ts", "utf8")).not.toMatch(/envoyerParOutilAction/);
  });
});

describe("vue « À publier » : la ligne d'une commande d'usine est marquée", () => {
  it("origineUsine vrai pour la commande d'usine, absent pour le contenu manuel", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    await depots().videos.modifier(AUTRE, { etapeEditoriale: "validee" });
    await fixerOrigine(VIDEO, "usine");
    await fixerOrigine(AUTRE, "studio");
    const lignes = (await apub.vueAPublier()).lignes;
    const usine = lignes.filter((l) => l.videoId === VIDEO);
    const manuel = lignes.filter((l) => l.videoId === AUTRE);
    expect(usine.length).toBeGreaterThan(0);
    expect(manuel.length).toBeGreaterThan(0);
    for (const l of usine) expect(l.origineUsine).toBe(true);
    for (const l of manuel) expect(l.origineUsine).toBeUndefined();
  });
});

const CASES = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
const AUCUNE = { image: false, son: false, sousTitres: false, mentionIA: false, droits: false };
function ligne(videoId: string, x: Partial<LigneAPublier> = {}): LigneAPublier {
  return {
    famille: "video", cle: `${videoId}:instagram`, videoId, titre: `Titre ${videoId}`, jaquette: null, lecture: `/v/${videoId}.mp4`, reseau: "instagram", reseauNom: "Instagram",
    texte: "Phrase", motsDiese: [], apercu: "Phrase", commentaireTransmissible: true, compte: { nom: "Axion", memorises: ["c1"] }, manquantes: [], casesRequises: [...CASES], coches: { ...AUCUNE },
    creeLe: "2026-01-01T10:00:00.000Z", typeVideo: "Cas concret", etapeVideo: "validee", ...x,
  } as LigneAPublier;
}
const liste = (lignes: LigneAPublier[]) => renderToStaticMarkup(createElement(ListeAPublier, { lignes, filtre: "toutes" }));
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

describe("liste « À publier » : lecture d'état pour l'usine, tout pour le manuel", () => {
  it("commande d'usine : titre et état visibles, aucun bouton Envoyer ni Remettre à relire, aucun lien vers l'écran d'envoi", () => {
    const h = liste([ligne("v-u", { origineUsine: true, etat: { libelle: "Programmée", ton: "neutre", envoye: true, comptesPris: [], sansCompte: false } })]);
    expect(texte(h)).toContain("Titre v-u");
    expect(texte(h)).toContain("Programmée");
    expect(texte(h)).toMatch(/lecture seule/i);
    expect(h).not.toMatch(/>Envoyer</);
    expect(h).not.toMatch(/Remettre à relire|>Valider</);
    expect(h).not.toContain("/a-publier/v-u");
    expect(h).toContain("/api/telechargements/video?video=v-u");
  });

  it("commande d'usine encore « À envoyer » : l'état est montré, le geste manuel n'est pas proposé", () => {
    const h = liste([ligne("v-u", { origineUsine: true })]);
    expect(texte(h)).toContain("À envoyer");
    expect(h).not.toMatch(/>Envoyer</);
  });

  it("contenu manuel : tous ses boutons restent (Envoyer, Remettre à relire, lien vers le détail)", () => {
    const h = liste([ligne("v-m")]);
    expect(h).toMatch(/>Envoyer</);
    expect(h).toContain("Remettre à relire");
    expect(h).toContain("/a-publier/v-m");
    expect(texte(h)).not.toMatch(/lecture seule/i);
  });

  it("une liste mixte : l'usine en lecture seule, le manuel libre", () => {
    const h = liste([ligne("v-u", { origineUsine: true }), ligne("v-m")]);
    expect(h.match(/>Envoyer</g)).toHaveLength(1);
    expect(h).toContain("/a-publier/v-m");
    expect(h).not.toContain("/a-publier/v-u");
  });
});
