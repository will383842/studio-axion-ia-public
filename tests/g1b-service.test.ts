/**
 * G1b : ÉCRANS ET CLASSEMENT, côté services (dépôts en mémoire, écriture SIMULÉE, aucune dépense).
 * Critères : sujet à 2 formats × 5 réseaux + 1 version « je lis » (grille lisible) ; retrouvé par la rangée, le format et
 * la recherche « 42 » ; zip aux bons noms, tous ratios ; feuille Buffer d'une version TikTok verrouillée ; kit ouvert
 * sur le réseau de la version et resynchronisé ; « À ranger » ; tuiles d'Accueil.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const pub = await import("@/services/publications");
const tel = await import("@/services/telechargements");
const { rechercher } = await import("@/services/recherche");
const { changerEtapeEditoriale } = await import("@/services/videos");
const { versSujetListe, codesParFormat } = await import("@/components/generateur/donnees");
import { filtrerSujets } from "@/domaine/classement-generateur";
import { lireZip } from "@/lib/zip";

const MDP = "essai-g1b-service";
const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Le prochain sujet prendra le n° 42 : 41 sujets déjà numérotés (archivés, ils comptent quand même). */
async function reserverJusqua(n: number) {
  await depots().scriptsMaitres.enregistrer({ id: "suj-ancien", numero: n, version: 1, brief: { idee: "ancien" } as never, ancrages: [], marqueId: "marque-axion", contexteAxionVersion: 0, archiveLe: "2026-09-01T00:00:00Z", creeLe: "2026-09-01T00:00:00Z", modifieLe: "2026-09-01T00:00:00Z" });
}

/** n° 42 : Avocat (5 réseaux) + Avocat « je lis » (5 réseaux) + Podcast (5 réseaux). */
async function sujet42() {
  await reserverJusqua(41);
  await depots().matieres.enregistrer(matiere("La première fois que j'ai vu ses tableaux, j'ai compté 47 onglets."));
  const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat", motCle: "factures ChatGPT" });
  const a = await gen.ecrireSujetSimule(s.id);
  const l = await gen.ecrireSujetSimule(s.id, { mode: "teleprompteur" });
  const p = await gen.ecrireSujetSimule(s.id, { formatId: "podcast" });
  if (!a.ok || !l.ok || !p.ok) throw new Error("écriture refusée");
  return s.id;
}

describe("sujet à 2 formats × 5 réseaux + 1 version « je lis »", () => {
  it("3 lignes de 5 cases, chacune nommée et codée ; libellés courts (lisibles à 390 px)", async () => {
    const id = await sujet42();
    const vue = await gen.obtenirSujet(id);
    expect(vue?.maitre.numero).toBe(42);
    const liste = versSujetListe(vue!);
    expect(liste.grille.map((l) => l.libelle)).toEqual(["Avocat", "Avocat · je lis", "Podcast · je lis"].slice(0, liste.grille.length));
    expect(liste.grille).toHaveLength(3);
    for (const l of liste.grille) {
      expect(Object.keys(l.cases)).toHaveLength(5);
      for (const r of CINQ) expect(l.cases[r].etat).toBe("a-relire");
      // Colonne du libellé à 390 px : 326 px de carte − 5 × 36 px − 5 × 6 px = 116 px, soit ~16 caractères par ligne en 13 px.
      expect(l.libelle.length).toBeLessThanOrEqual(32);
    }
    expect(liste.grille[1].cases.tiktok.code).toBe("0042-AV-TT-L");
    expect(vue!.versions).toHaveLength(15);
    expect(new Set(vue!.versions.map((v) => v.variante.code)).size).toBe(15);
  });

  it("retrouvé par la rangée (TikTok), le bouton Format (podcast) et la recherche « 42 » (liste ET recherche globale)", async () => {
    const id = await sujet42();
    const s2 = await gen.creerSujet({ idee: "Un autre sujet, LinkedIn seulement", reseaux: ["linkedin"], formatId: "avocat" });
    await gen.ecrireSujetSimule(s2.id);
    const sujets = (await gen.listerSujets()).map(versSujetListe);
    expect(filtrerSujets(sujets, { reseau: "tiktok" }).map((s) => s.id)).toEqual([id]);
    expect(filtrerSujets(sujets, { format: "podcast" }).map((s) => s.id)).toEqual([id]);
    expect(filtrerSujets(sujets, { q: "42" }, codesParFormat()).map((s) => s.id)).toEqual([id]);
    expect(filtrerSujets(sujets, { q: "0042-PO-YS" }, codesParFormat()).map((s) => s.id)).toEqual([id]);
    const r = await rechercher("42");
    expect(r.sujets.map((x) => x.lien)).toEqual([`/ecrire/sujets/${id}`]);
    expect(r.sujets[0].titre).toMatch(/^n° 42 · /);
    expect((await rechercher("0042-AV-TT-L")).sujets).toHaveLength(1);
  });
});

describe("téléchargement groupé : zip aux bons noms, tous ratios", () => {
  it("« Tout le sujet » : 0042-<titre-court>.zip, un fichier par ratio exporté, nommé par le code de la version", async () => {
    const id = await sujet42();
    const vue = await gen.obtenirSujet(id);
    const tt = vue!.versions.find((v) => v.variante.code === "0042-AV-TT")!;
    // v-02 (démonstration) a trois ratios : 9:16, 1:1, 16:9.
    await gen.rangerVideo("v-02", tt.variante.id);
    const contenu = await tel.contenuArchiveSujet(id);
    expect(contenu.nom).toBe("0042-chatgpt-peut-il-lire.zip");
    const videos = contenu.entrees.filter((e) => e.nom.endsWith(".mp4")).map((e) => e.nom);
    expect(videos.sort()).toEqual(["0042-AV-TT-chatgpt-peut-il-lire-16x9.mp4", "0042-AV-TT-chatgpt-peut-il-lire-1x1.mp4", "0042-AV-TT-chatgpt-peut-il-lire-9x16.mp4"]);
    const zip = await tel.construireArchive(contenu, async (url) => new TextEncoder().encode(url));
    const noms = lireZip(zip).map((f) => f.nom);
    expect(noms).toEqual(contenu.entrees.map((e) => e.nom));
    for (const n of noms) expect(n).toMatch(/^0042-AV-TT-chatgpt-peut-il-lire(-(9x16|1x1|16x9))?\.(mp4|srt|vtt)$/);
  });

  it("« Par réseau » : TikTok-<début>-<fin>.zip, seulement les publications programmées de la période", async () => {
    // Horloge fixée : le test ne dépend pas du jour où il tourne (seule la date est figée, les minuteries restent réelles).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T08:00:00Z"));
    // Les données d'exemple sont datées d'après l'horloge : on les refait une fois l'horloge fixée.
    reinitialiserDepots();
    const id = await sujet42();
    const tt = (await gen.obtenirSujet(id))!.versions.find((v) => v.variante.code === "0042-AV-TT")!;
    await gen.rangerVideo("v-02", tt.variante.id);
    await depots().publications.enregistrer({ id: "pub-essai", videoId: "v-02", reseau: "tiktok", statut: "programmee", via: "buffer", date: "2026-10-06T09:00:00Z", texte: "", varianteId: tt.variante.id, creeLe: "2026-10-02T00:00:00Z", modifieLe: "2026-10-02T00:00:00Z" });
    const c = await tel.contenuArchiveReseau("tiktok", "2026-10-05", "2026-10-11");
    expect(c.nom).toBe("TikTok-2026-10-05-2026-10-11.zip");
    expect(c.entrees.filter((e) => e.nom.endsWith(".mp4"))).toHaveLength(3);
    expect((await tel.contenuArchiveReseau("tiktok", "2026-10-12", "2026-10-18")).entrees).toHaveLength(0);
    expect(tel.cetteSemaine(new Date("2026-10-08T12:00:00Z"))).toEqual({ debut: "2026-10-05", fin: "2026-10-11" });
  });
});

describe("kit et feuille Buffer d'une version TikTok", () => {
  async function videoTikTok() {
    const id = await sujet42();
    const tt = (await gen.obtenirSujet(id))!.versions.find((v) => v.variante.code === "0042-AV-TT")!;
    await gen.rangerVideo("v-02", tt.variante.id);
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier("v-02", c, true);
    return tt.variante;
  }

  it("le kit s'ouvre sur TikTok, avec le texte RECOPIÉ de la version (resynchronisé, jamais une retouche à la main)", async () => {
    const v = await videoTikTok();
    const kit = await pub.obtenirKit("v-02");
    expect(kit?.reseaux[0].reseau).toBe("tiktok");
    expect(kit?.variante).toMatchObject({ code: "0042-AV-TT", reseau: "tiktok" });
    expect(kit?.reseaux[0].texte).toBe(v.publication.texte);
    await pub.modifierTexteKit("v-02", "tiktok", "Mon texte à moi", ["#moi"]);
    expect((await pub.obtenirKit("v-02"))?.reseaux[0].texte).toBe("Mon texte à moi");
  });

  it("un seul réseau proposé : un autre réseau est refusé sans confirmation ; la publication porte la version", async () => {
    const v = await videoTikTok();
    await expect(pub.envoyerVersBuffer("v-02", ["linkedin"], "2026-10-06T09:00:00Z")).rejects.toMatchObject({ code: "RESEAU_DIFFERENT" });
    const ok = await pub.envoyerVersBuffer("v-02", ["tiktok"], "2026-10-06T09:00:00Z");
    expect(ok.publications).toHaveLength(1);
    expect(ok.publications[0]).toMatchObject({ reseau: "tiktok", varianteId: v.id });
    const ailleurs = await pub.envoyerVersBuffer("v-02", ["linkedin"], "2026-10-07T09:00:00Z", { autreReseauConfirme: true });
    expect(ailleurs.publications[0].varianteId).toBeUndefined();
  });
});

describe("« À ranger », étape manuelle et tuiles d'Accueil", () => {
  it("une ancienne vidéo sans réseau est « à ranger » ; rangée, elle prend le réseau de la version et sort de la liste", async () => {
    const id = await sujet42();
    const avant = (await gen.listerVideosARanger()).map((v) => v.id);
    expect(avant).toContain("v-02");
    const libres = await gen.listerVersionsSansVideo();
    expect(libres).toHaveLength(15);
    const ys = libres.find((v) => v.code === "0042-PO-YS-L") ?? libres.find((v) => v.code.startsWith("0042-PO-YS"))!;
    await gen.rangerVideo("v-02", ys.id);
    expect((await depots().videos.obtenir("v-02"))?.reseau).toBe("youtube-shorts");
    expect((await gen.listerVideosARanger()).map((v) => v.id)).not.toContain("v-02");
    expect(await gen.listerVersionsSansVideo()).toHaveLength(14);
    await expect(gen.rangerVideo("v-03", ys.id)).rejects.toMatchObject({ code: "DEJA_RANGEE" });
    const vue = await gen.obtenirSujet(id);
    expect(vue!.versions.find((v) => v.variante.id === ys.id)?.videoId).toBe("v-02");
  });

  it("changer l'étape d'une vidéo rattachée passe par sa version (l'état de la version fait foi)", async () => {
    const id = await sujet42();
    const tt = (await gen.obtenirSujet(id))!.versions.find((v) => v.variante.code === "0042-AV-TT")!;
    await gen.rangerVideo("v-02", tt.variante.id);
    await changerEtapeEditoriale("v-02", "publiee");
    expect((await depots().variantes.obtenir(tt.variante.id))?.etat).toBe("a-relire");
    expect((await depots().videos.obtenir("v-02"))?.etapeEditoriale).toBe("a_relire");
    await changerEtapeEditoriale("v-02", "validee");
    expect((await depots().variantes.obtenir(tt.variante.id))?.etat).toBe("validee");
  });

  it("tuiles : à relire, il manque une matière (brouillon sans matière), prêt à fabriquer après « Valider les N »", async () => {
    const id = await sujet42();
    const vide = await gen.creerSujet({ idee: "Sans matière ?", reseaux: ["tiktok"], formatId: "avocat" });
    // Toutes les matières disponibles sont imposées au n° 42 : la seule matière sert d'ancrage ; on la retire pour l'autre.
    await depots().matieres.modifier((await depots().matieres.lister())[0].id, { retrait: { le: "2026-10-02T00:00:00Z", motif: "autre" } });
    await gen.ecrireSujetSimule(vide.id);
    let c = await gen.compteursGenerateur();
    expect(c).toMatchObject({ aRelire: 1, manqueMatiere: 1, pretAFabriquer: 0 });
    const vue = (await gen.obtenirSujet(id))!;
    const n = await gen.validerVersions(vue.versions.filter((v) => v.variante.reseau === "tiktok").map((v) => v.variante.id));
    expect(n).toBe(3);
    c = await gen.compteursGenerateur();
    expect(c.pretAFabriquer).toBe(1);
    expect(c.aRanger).toBeGreaterThan(0);
  });
});
