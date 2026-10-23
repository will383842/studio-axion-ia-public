/**
 * Plan « formats par réseau », tâche T4 : le fichier envoyé est choisi PAR RÉSEAU.
 *  - un fichier enregistré porte ses réseaux et sa fin (`Sortie.reseaux`, `Sortie.appelAuMot`, ajouts seuls) ;
 *  - un fichier déjà enregistré est reconnu par format ET fin : les deux verticaux du tableau animé sont gardés ;
 *  - le kit et l'envoi prennent `meilleureSortie` ; les avertissements lisent les fichiers faits ;
 *  - le kit dit « Fichier envoyé : 4:5 · 1080 × 1350 ».
 * Compatibilité : une sortie d'avant (sans réseaux ni fin) est choisie comme aujourd'hui.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RapportQualite, Sortie, Video, VersionVideo } from "@/domaine/types";
import { obtenirReseau, verifierPourReseau } from "@/reseaux";
import { fichierDejaFait, libelleFichierEnvoye, meilleureSortie } from "@/reseaux/sorties";
import { destinationDeLaSortie } from "@/moteurs/montage-tableau";
import * as formatsSortie from "@/moteurs/montage-tableau/formats-sortie";
import { IDS_SORTIES, type IdSortie } from "@/moteurs/montage-tableau/formats-sortie";
import type { FinRetenue } from "@/moteurs/montage-tableau/fabriquer";
import type { ResultatFabrication, SortieProduite } from "@/moteurs";
import { estFinAuMot, RESEAUX_DES_SORTIES, reseauDeLaSortie } from "@/services/tableau-fin";
import { finAuMot } from "@/moteurs/montage-tableau/variantes-fin";
import { TABLE_FINS } from "@/briques/fins";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "../site-videos/helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const pub = await import("@/services/publications");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const { moteurDeCommande } = await import("@/moteurs");
const { sortiePrincipale } = await import("@/services/site-videos");

describe("T4 · fichier déjà fait : format ET fin", () => {
  it("les deux verticaux du tableau (Reels avec la fin au mot, TikTok et Shorts sans elle) sont deux fichiers", () => {
    const reels = { ratio: "9:16" as const, reseaux: ["instagram", "facebook"] as const };
    const liens = { ratio: "9:16" as const, appelAuMot: false, reseaux: ["tiktok", "youtube-shorts"] as const };
    expect(fichierDejaFait([liens], reels)).toBe(false);
    expect(fichierDejaFait([reels], liens)).toBe(false);
  });

  it("compatibilité : même format sans fin connue (réexport, fichiers d'avant) = déjà fait, comme avant", () => {
    expect(fichierDejaFait([{ ratio: "9:16" }], { ratio: "9:16" })).toBe(true);
    expect(fichierDejaFait([{ ratio: "9:16" }], { ratio: "4:5" })).toBe(false);
    expect(fichierDejaFait([{ ratio: "1:1", appelAuMot: false }], { ratio: "1:1", appelAuMot: false })).toBe(true);
  });

  it("relecture 2, point 1 : deux verticaux à fin propre (fin « site » des Reels) restent deux fichiers (réseaux différents)", () => {
    const liens = { ratio: "9:16" as const, appelAuMot: false, reseaux: ["tiktok", "youtube-shorts"] as const };
    const reels = { ratio: "9:16" as const, appelAuMot: false, reseaux: ["instagram", "facebook"] as const };
    expect(fichierDejaFait([liens], reels)).toBe(false);
    expect(fichierDejaFait([reels], liens)).toBe(false);
    // Même ensemble de réseaux (ordre indifférent) : déjà fait.
    expect(fichierDejaFait([liens], { ...liens, reseaux: ["youtube-shorts", "tiktok"] })).toBe(true);
  });

  it("relecture 2, point 5 : fin inconnue → un fichier du même format à fin inconnue suffit, quels que soient ses réseaux", () => {
    expect(fichierDejaFait([{ ratio: "9:16" }], { ratio: "9:16", reseaux: ["instagram", "facebook", "tiktok", "youtube-shorts"] })).toBe(true);
  });
});

describe("T4 · tableau animé : chaque fichier dit ses réseaux et sa fin", () => {
  it("deux verticaux : Reels et stories d'un côté, TikTok et Shorts (sans appel au mot) de l'autre", () => {
    const faites = ["vertical", "vertical-liens", "horizontal"] as const;
    expect(destinationDeLaSortie("vertical", faites)).toEqual({ reseaux: ["instagram", "facebook"] });
    expect(destinationDeLaSortie("vertical-liens", faites)).toEqual({ reseaux: ["tiktok", "youtube-shorts"], appelAuMot: false });
    expect(destinationDeLaSortie("horizontal", faites)).toEqual({ reseaux: ["youtube"] });
  });

  it("vertical seul : il sert tous les réseaux verticaux, comme avant ; le carré n'a jamais d'appel au mot", () => {
    expect(destinationDeLaSortie("vertical", ["vertical"])).toEqual({ reseaux: ["instagram", "facebook", "tiktok", "youtube-shorts"] });
    expect(destinationDeLaSortie("carre", ["vertical", "carre"])).toEqual({ reseaux: ["linkedin", "facebook"], appelAuMot: false });
  });
});

/** Fins rendues par le tableau (`SortieFaite.fin`). */
const FIN_AU_MOT: FinRetenue = { id: "fin-guide", type: "commentaire", mot: "GUIDE", ecran: "Écrivez GUIDE en commentaire", dit: "Écrivez GUIDE en commentaire. Je vous l'envoie." };
const FIN_PROPRE: FinRetenue = { id: "fin-site", type: "site", ecran: "axion-ia.com", dit: "Tout est sur axion-ia.com." };

describe("T4 · relecture 1 : une seule table des réseaux servis par chaque sortie", () => {
  it("le tableau et la fin lisent la MÊME table (formats-sortie.ts), plus une copie écrite à la main", () => {
    expect((formatsSortie as Record<string, unknown>).RESEAUX_DES_SORTIES).toBe(RESEAUX_DES_SORTIES);
    expect(typeof (formatsSortie as Record<string, unknown>).reseauxDeLaSortie).toBe("function");
  });

  it("destinationDeLaSortie et reseauDeLaSortie renvoient les mêmes réseaux, quels que soient les fichiers faits (LinkedIn en plus sur un portrait à fin propre)", () => {
    const lots: IdSortie[][] = [["vertical"], ["vertical", "vertical-liens"], [...IDS_SORTIES], ["carre", "portrait", "horizontal"]];
    for (const faites of lots) {
      for (const sortie of IDS_SORTIES) {
        for (const fin of [undefined, FIN_AU_MOT, FIN_PROPRE]) {
          const { reseaux } = destinationDeLaSortie(sortie, faites, fin);
          // Décision de Will : LinkedIn = 4:5 partout. Seul ajout aux réseaux de la règle des fins : LinkedIn sur le portrait à fin
          // propre, sauf quand le portrait de LinkedIn (T5) est fait : c'est lui qui sert LinkedIn.
          const dePlus = sortie === "portrait" && fin === FIN_PROPRE && !faites.includes("portrait-linkedin") ? ["linkedin"] : [];
          const servis = reseaux.filter((r) => !dePlus.includes(r));
          expect(reseaux.filter((r) => dePlus.includes(r))).toEqual(dePlus);
          expect(reseauDeLaSortie(sortie, {}, faites)).toBe(servis[0] ?? reseauDeLaSortie(sortie, {}, faites));
          for (const r of servis) expect(reseauDeLaSortie(sortie, { reseaux: [r] }, faites)).toBe(r);
        }
        const { reseaux } = destinationDeLaSortie(sortie, faites);
        expect(reseauDeLaSortie(sortie, {}, faites)).toBe(reseaux[0]);
        for (const r of reseaux) expect(reseauDeLaSortie(sortie, { reseaux: [r] }, faites)).toBe(r);
      }
    }
  });

  it("décision de Will du 19/10 : LinkedIn = 9:16 ; d'anciens fichiers 4:5 et carré restent livrables, le carré avant le 4:5 (ordre du registre)", () => {
    const portrait = { ratio: "4:5" as const, id: "portrait", ...destinationDeLaSortie("portrait", ["portrait", "carre"], FIN_PROPRE) };
    const carre = { ratio: "1:1" as const, id: "carre", ...destinationDeLaSortie("carre", ["portrait", "carre"], FIN_PROPRE) };
    expect(portrait.reseaux).toContain("linkedin");
    for (const ordre of [[portrait, carre], [carre, portrait]]) expect(meilleureSortie("linkedin", ordre)?.id).toBe("carre");
    // Portrait à fin au mot : interdit sur LinkedIn → le carré (fin propre) reste son repli.
    const portraitAuMot = { ratio: "4:5" as const, id: "portrait", ...destinationDeLaSortie("portrait", ["portrait", "carre"], FIN_AU_MOT) };
    expect(portraitAuMot.reseaux).not.toContain("linkedin");
    expect(meilleureSortie("linkedin", [portraitAuMot, carre])?.id).toBe("carre");
    // Carré seul : LinkedIn le garde.
    expect(meilleureSortie("linkedin", [carre])?.id).toBe("carre");
  });
});

describe("T4 · relecture 2 : la fin connue de chaque fichier est posée (jamais la fin au mot sur TikTok, Shorts ou LinkedIn)", () => {
  it("fin au mot → appelAuMot vrai ; fin propre ou sans écran de fin → faux ; fin inconnue → absent", () => {
    expect(destinationDeLaSortie("portrait", ["portrait"], FIN_AU_MOT).appelAuMot).toBe(true);
    expect(destinationDeLaSortie("portrait", ["portrait"], FIN_PROPRE).appelAuMot).toBe(false);
    // Relecture 2, point 2 : fin absente → champ absent (la voix de ces sorties peut dire l'appel de la fiche).
    expect(destinationDeLaSortie("portrait", ["portrait"], { absente: "Aucune fin validée" })).not.toHaveProperty("appelAuMot");
    expect(destinationDeLaSortie("vertical", ["vertical"], { absente: "Aucune fin validée" })).not.toHaveProperty("appelAuMot");
    // Les sorties qui ne disent jamais l'appel au mot restent « fin propre », fin absente ou non.
    expect(destinationDeLaSortie("vertical-liens", ["vertical", "vertical-liens"], { absente: "Aucune fin validée" }).appelAuMot).toBe(false);
    expect(destinationDeLaSortie("carre", ["carre"], { absente: "Aucune fin validée" }).appelAuMot).toBe(false);
    expect(destinationDeLaSortie("portrait", ["portrait"])).not.toHaveProperty("appelAuMot");
    // Même verdict que la règle des fins des services (`estFinAuMot`).
    for (const f of [FIN_AU_MOT, FIN_PROPRE] as const) expect(destinationDeLaSortie("portrait", ["portrait"], f).appelAuMot).toBe(estFinAuMot(f as Parameters<typeof estFinAuMot>[0]));
  });

  it("relecture 2, point 4 : finAuMot et estFinAuMot donnent le même verdict sur toute TABLE_FINS, et {MOT} dans `dit` compte", () => {
    for (const f of TABLE_FINS) expect([f.id, finAuMot(f)]).toEqual([f.id, estFinAuMot(f)]);
    const dansDit = { id: "fin-x", type: "question" as const, ecran: "Merci", dit: "Écrivez {MOT} sous la vidéo." };
    expect(estFinAuMot(dansDit)).toBe(true);
    expect(finAuMot(dansDit)).toBe(true);
  });

  it("relecture 2, point 3 : horizontal avec fin au mot → YouTube le reçoit toujours (décision de Will du 18/10 16 h 55 : YouTube garde par défaut le fichier au mot, écrivez MOT en commentaire)", () => {
    const horizontal = { ratio: "16:9" as const, ...destinationDeLaSortie("horizontal", ["vertical", "horizontal"], FIN_AU_MOT) };
    expect(horizontal).toMatchObject({ appelAuMot: true, reseaux: ["youtube"] });
    expect(meilleureSortie("youtube", [horizontal])).toBe(horizontal);
    // La tolérance ne vaut que pour le 16:9 de YouTube : jamais TikTok ni Shorts.
    const vertical = { ratio: "9:16" as const, appelAuMot: true };
    expect(meilleureSortie("tiktok", [vertical])).toBeNull();
    expect(meilleureSortie("youtube-shorts", [vertical])).toBeNull();
  });

  it("un portrait avec une fin au mot n'est jamais envoyé à LinkedIn", () => {
    const portrait = { ratio: "4:5" as const, ...destinationDeLaSortie("portrait", ["portrait"], FIN_AU_MOT) };
    expect(portrait.reseaux).not.toContain("linkedin");
    expect(meilleureSortie("linkedin", [portrait])).toBeNull();
    expect(meilleureSortie("instagram", [portrait])).toBe(portrait);
  });

  it("TikTok et Shorts ne reçoivent pas un vertical à fin au mot (vertical seul : il ne dit plus les servir)", () => {
    const vertical = { ratio: "9:16" as const, ...destinationDeLaSortie("vertical", ["vertical"], FIN_AU_MOT) };
    expect(vertical).toMatchObject({ appelAuMot: true, reseaux: ["instagram", "facebook"] });
    expect(meilleureSortie("tiktok", [vertical])).toBeNull();
    expect(meilleureSortie("youtube-shorts", [vertical])).toBeNull();
    // Vertical seul à fin propre : tous les réseaux verticaux, comme avant.
    expect(destinationDeLaSortie("vertical", ["vertical"], FIN_PROPRE)).toEqual({ reseaux: ["instagram", "facebook", "tiktok", "youtube-shorts"], appelAuMot: false });
  });
});

describe("T4 · relecture 5 : sorties d'avant, l'ancien ordre de repli", () => {
  it("ni `reseaux` ni fin : format préféré, puis l'ordre des fichiers (LinkedIn : le 9:16, son format préféré, avant le 16:9)", () => {
    const a = { ratio: "9:16" as const };
    const b = { ratio: "16:9" as const };
    expect(meilleureSortie("linkedin", [a, b])).toBe(a);
    expect(meilleureSortie("linkedin", [b, a])).toBe(a);
  });
  it("avec `reseaux` ou une fin connue : l'ordre des formats du registre s'applique", () => {
    const a = { ratio: "9:16" as const, reseaux: ["instagram"] as const };
    const b = { ratio: "16:9" as const, reseaux: ["youtube"] as const };
    expect(meilleureSortie("linkedin", [a, b])).toBe(a);
    expect(meilleureSortie("linkedin", [{ ratio: "9:16" as const, appelAuMot: false }, { ratio: "16:9" as const, appelAuMot: false }])?.ratio).toBe("9:16");
  });
});

describe("T4 · page du site : jamais le vertical des Reels quand celui sans appel au mot existe", () => {
  const s = (id: string, taille: number, extra: Partial<Sortie> = {}) => ({ id, ratio: "9:16", taille, ...extra }) as Sortie;
  it("à ratio égal, la fin propre passe avant, même plus petite", () => {
    expect(sortiePrincipale({ ratios: ["9:16"] }, [s("reels", 900, { reseaux: ["instagram", "facebook"] }), s("liens", 800, { appelAuMot: false })])?.id).toBe("liens");
  });
  it("relecture 4 : la fin propre ne joue qu'à format égal, jamais dans le repli entre formats", () => {
    const t = (id: string, ratio: Sortie["ratio"], taille: number, extra: Partial<Sortie> = {}) => ({ id, ratio, taille, ...extra }) as Sortie;
    // Ratio maître absent : la plus grande sans réseau (le 16:9), pas le 9:16 plus petit à fin propre.
    expect(sortiePrincipale({ ratios: ["4:5"] }, [t("vertical", "9:16", 800, { appelAuMot: false }), t("horizontal", "16:9", 900)])?.id).toBe("horizontal");
    // Dans le repli, à format égal, la fin propre passe encore avant.
    expect(sortiePrincipale({ ratios: ["4:5"] }, [t("reels", "9:16", 900, { appelAuMot: true }), t("liens", "9:16", 800, { appelAuMot: false }), t("h", "16:9", 700)])?.id).toBe("liens");
  });
  it("décision de Will du 18/10 16 h 55 : à format égal, la fin au mot passe en dernier, après une fin inconnue (ancien fichier)", () => {
    const t = (id: string, taille: number, extra: Partial<Sortie> = {}) => ({ id, ratio: "9:16", taille, ...extra }) as Sortie;
    // Ancien fichier (fin inconnue) plus petit + nouveau vertical à fin au mot plus grand : la page du site n'affiche pas « Écrivez MOT ».
    expect(sortiePrincipale({ ratios: ["9:16"] }, [t("nouveau-au-mot", 900, { appelAuMot: true }), t("ancien", 800)])?.id).toBe("ancien");
    expect(sortiePrincipale({ ratios: ["9:16"] }, [t("ancien", 800), t("nouveau-au-mot", 900, { appelAuMot: true })])?.id).toBe("ancien");
    // La fin propre passe toujours avant tout.
    expect(sortiePrincipale({ ratios: ["9:16"] }, [t("ancien", 950), t("au-mot", 900, { appelAuMot: true }), t("propre", 700, { appelAuMot: false })])?.id).toBe("propre");
  });
  it("compatibilité : sorties d'avant, la plus grande comme avant", () => {
    expect(sortiePrincipale({ ratios: ["9:16"] }, [s("a", 800), s("b", 900)])?.id).toBe("b");
  });
});

describe("T4 · relecture 3 : LinkedIn reçoit le 9:16 (décision du 19/10), le site jamais la fin au mot", () => {
  const tableau = (fin: FinRetenue) => {
    const faites: IdSortie[] = ["vertical", "portrait", "carre"];
    return {
      portrait: { ratio: "4:5" as const, ...destinationDeLaSortie("portrait", faites, fin) },
      carre: { ratio: "1:1" as const, ...destinationDeLaSortie("carre", faites) },
    };
  };
  it("anciens fichiers : portrait à fin propre + carré : LinkedIn reçoit le carré (le 4:5 n'est plus son format préféré)", () => {
    const { portrait, carre } = tableau(FIN_PROPRE);
    expect(meilleureSortie("linkedin", [carre, portrait])).toBe(carre);
    expect(meilleureSortie("linkedin", [portrait, carre])).toBe(carre);
  });
  it("portrait à fin au mot + carré : LinkedIn reçoit le 1:1 (jamais l'appel au mot)", () => {
    const { portrait, carre } = tableau(FIN_AU_MOT);
    expect(portrait.reseaux).not.toContain("linkedin");
    expect(meilleureSortie("linkedin", [portrait, carre])).toBe(carre);
  });
  it("portrait à fin inconnue : LinkedIn n'est pas déclaré servi (la voix peut dire l'appel)", () => {
    expect(destinationDeLaSortie("portrait", ["portrait", "carre"]).reseaux).not.toContain("linkedin");
  });
  it("sans 4:5 ni 1:1 : LinkedIn reçoit le vertical « liens » 9:16 (sans appel au mot), avant le 16:9", () => {
    const faites: IdSortie[] = ["vertical-liens", "horizontal"];
    const liens = { ratio: "9:16" as const, ...destinationDeLaSortie("vertical-liens", faites) };
    const horizontal = { ratio: "16:9" as const, ...destinationDeLaSortie("horizontal", faites, FIN_PROPRE) };
    expect(meilleureSortie("linkedin", [liens, horizontal])).toBe(liens);
  });
  it("site : fin propre, puis fin inconnue, puis fin au mot, avant la taille", () => {
    const s = (id: string, taille: number, extra: Partial<Sortie> = {}) => ({ id, ratio: "9:16", taille, ...extra }) as Sortie;
    expect(sortiePrincipale({ ratios: ["9:16"] }, [s("reels", 900, { appelAuMot: true }), s("avant", 800)])?.id).toBe("avant");
    expect(sortiePrincipale({ ratios: ["9:16"] }, [s("reels", 900, { appelAuMot: true }), s("avant", 850), s("liens", 800, { appelAuMot: false })])?.id).toBe("liens");
  });
});

describe("T4 · avertissements lus sur les fichiers faits", () => {
  const youtube = obtenirReseau("youtube");
  it("un 16:9 fait mais absent de video.ratios : pas d'« Aucun format d'image adapté » à tort", () => {
    const a = verifierPourReseau(youtube, { dureeSec: 30, ratios: ["9:16"], sortieEnvoyee: { ratio: "16:9" } });
    expect(a.map((x) => x.code)).not.toContain("ratio-absent");
  });
  it("aucun fichier envoyable (null) : l'avertissement, même si video.ratios dit le contraire", () => {
    const a = verifierPourReseau(obtenirReseau("tiktok"), { dureeSec: 30, ratios: ["9:16"], sortieEnvoyee: null });
    expect(a.map((x) => x.code)).toContain("ratio-absent");
  });
  it("compatibilité : sans `sortieEnvoyee`, la règle d'avant sur video.ratios", () => {
    expect(verifierPourReseau(youtube, { dureeSec: 30, ratios: ["9:16"] }).map((x) => x.code)).toContain("ratio-absent");
  });
});

describe("T4 · libellé du fichier envoyé", () => {
  it("« Fichier envoyé : 4:5 · 1080 × 1350 »", () => {
    expect(libelleFichierEnvoye({ ratio: "4:5", resolution: "1080x1350" })).toBe("Fichier envoyé : 4:5 · 1080 × 1350");
  });
  it("résolution illisible : les dimensions du registre", () => {
    expect(libelleFichierEnvoye({ ratio: "16:9", resolution: "" })).toBe("Fichier envoyé : 16:9 · 1920 × 1080");
  });
});

const RAPPORT: RapportQualite = { note: 90, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: false }, alertes: [], niveauSonoreLufs: -14 };

describe("T4 · le kit choisit le fichier de chaque réseau", () => {
  beforeAll(async () => {
    await preparerMotDePasse(MDP_SITE);
  });
  beforeEach(async () => {
    await preparerBase();
    vi.stubGlobal("fetch", async () => {
      throw new Error("réseau interdit");
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Une vidéo prête construite ICI (aucune donnée de démonstration lue) : sa version choisie porte les sorties données.
   * Les fichiers n'existent pas dans le dépôt : le kit n'en lit que le format, la résolution, la fin et les réseaux.
   */
  async function videoAvec(sorties: Partial<Sortie>[]) {
    const d = depots();
    const h = { creeLe: "2026-10-18T10:00:00.000Z", modifieLe: "2026-10-18T10:00:00.000Z" };
    const videoId = "v-t4-kit";
    const versionId = "ver-t4-kit";
    const video: Video = {
      id: videoId,
      titre: "Le kit choisit le fichier de chaque réseau",
      formatId: "tableau-anime",
      versionFormat: 1,
      profilRenduVersion: 1,
      marqueId: "marque-t4",
      statut: "prete",
      dureeCibleSec: 30,
      ratios: ["9:16"],
      distribution: [],
      entrees: {},
      reglages: {},
      styles: {} as Video["styles"],
      mentionIA: {} as Video["mentionIA"],
      langue: "fr",
      versionChoisieId: versionId,
      ...h,
    };
    await d.videos.enregistrer(video);
    const version: VersionVideo = { id: versionId, videoId, numero: 1, commande: {} as VersionVideo["commande"], statut: "prete", choisie: true, ...h };
    await d.versions.enregistrer(version);
    const ids: string[] = [];
    for (const [i, s] of sorties.entries()) {
      const id = `sortie-t4-${i}`;
      ids.push(id);
      await d.sorties.enregistrer({ ratio: "9:16", resolution: "1080x1920", fichierId: `fichier-t4-${i}`, vignetteFichierId: `vignette-t4-${i}`, dureeSec: 30, taille: 1000 + i, rapportQualite: RAPPORT, ...s, id, videoId, versionId, ...h } as Sortie);
    }
    return { videoId, ids };
  }

  it("deux verticaux : TikTok et Shorts reçoivent celui sans appel au mot, Instagram et Facebook celui des Reels", async () => {
    const { videoId, ids } = await videoAvec([
      { ratio: "9:16", resolution: "1080x1920", appelAuMot: false, reseaux: ["tiktok", "youtube-shorts"] },
      { ratio: "9:16", resolution: "1080x1920", reseaux: ["instagram", "facebook"] },
    ]);
    const kit = (await pub.obtenirKit(videoId))!;
    const de = (id: string) => kit.reseaux.find((r) => r.reseau === id)!;
    expect(de("tiktok").sortieConseillee?.id).toBe(ids[0]);
    expect(de("youtube-shorts").sortieConseillee?.id).toBe(ids[0]);
    expect(de("instagram").sortieConseillee?.id).toBe(ids[1]);
    expect(de("facebook").sortieConseillee?.id).toBe(ids[1]);
  });

  it("YouTube : le 16:9 fait est envoyé, sans avertissement à tort, avec le libellé du fichier", async () => {
    const { videoId, ids } = await videoAvec([
      { ratio: "9:16", resolution: "1080x1920" },
      { ratio: "16:9", resolution: "1920x1080", reseaux: ["youtube"] },
    ]);
    const yt = (await pub.obtenirKit(videoId))!.reseaux.find((r) => r.reseau === "youtube")!;
    expect(yt.sortieConseillee?.id).toBe(ids[1]);
    expect(yt.avertissements.map((a) => a.code)).not.toContain("ratio-absent");
    expect(yt.fichierEnvoye).toBe("Fichier envoyé : 16:9 · 1920 × 1080");
  });

  it("relecture 2, point 3 : horizontal avec fin au mot → YouTube le reçoit toujours (kit)", async () => {
    const { videoId, ids } = await videoAvec([{ ratio: "16:9", resolution: "1920x1080", ...destinationDeLaSortie("horizontal", ["horizontal"], FIN_AU_MOT) }]);
    const yt = (await pub.obtenirKit(videoId))!.reseaux.find((r) => r.reseau === "youtube")!;
    expect(yt.sortieConseillee?.id).toBe(ids[0]);
    expect(yt.avertissements.map((a) => a.code)).not.toContain("ratio-absent");
  });

  it("jamais la fin au mot sur TikTok : seul fichier vertical avec appel au mot → aucun fichier, et l'avertissement", async () => {
    const { videoId } = await videoAvec([{ ratio: "9:16", resolution: "1080x1920", appelAuMot: true, reseaux: ["instagram"] }]);
    const tt = (await pub.obtenirKit(videoId))!.reseaux.find((r) => r.reseau === "tiktok")!;
    expect(tt.sortieConseillee).toBeUndefined();
    expect(tt.fichierEnvoye).toBeUndefined();
    expect(tt.avertissements.map((a) => a.code)).toContain("ratio-absent");
  });

  it("compatibilité : sorties d'avant (ni réseaux ni fin) → le format préféré du réseau, comme aujourd'hui", async () => {
    const { videoId, ids } = await videoAvec([
      { ratio: "1:1", resolution: "1080x1080" },
      { ratio: "4:5", resolution: "1080x1350" },
      { ratio: "9:16", resolution: "1080x1920" },
    ]);
    const kit = (await pub.obtenirKit(videoId))!;
    const de = (id: string) => kit.reseaux.find((r) => r.reseau === id)!;
    expect(de("linkedin").sortieConseillee?.id).toBe(ids[2]);
    expect(de("linkedin").fichierEnvoye).toBe("Fichier envoyé : 9:16 · 1080 × 1920");
    expect(de("instagram").sortieConseillee?.id).toBe(ids[2]);
    expect(de("tiktok").sortieConseillee?.id).toBe(ids[2]);
  });

  it("compatibilité (relecture 5) : vidéo d'avant avec un 9:16 puis un 16:9 → LinkedIn reçoit le 9:16, comme avant", async () => {
    const { videoId, ids } = await videoAvec([
      { ratio: "9:16", resolution: "1080x1920" },
      { ratio: "16:9", resolution: "1920x1080" },
    ]);
    const kit = (await pub.obtenirKit(videoId))!;
    expect(kit.reseaux.find((r) => r.reseau === "linkedin")!.sortieConseillee?.id).toBe(ids[0]);
    expect(kit.reseaux.find((r) => r.reseau === "youtube")!.sortieConseillee?.id).toBe(ids[1]);
  });
});

/** Une sortie produite par un moteur (clés propres au test). */
function produite(n: number, extra: Partial<SortieProduite> = {}): SortieProduite {
  return { ratio: "9:16", fichierCle: `studio/dev/videos/t4/sortie-${n}.mp4`, vignetteCle: `studio/dev/videos/t4/vignette-${n}.jpg`, resolution: "1080x1920", dureeSec: 30, taille: 1_000_000 + n, rapportQualite: RAPPORT, ...extra };
}

describe("T4 · relectures 3 et 6 : enregistrement des fichiers d'un résultat (appliquerResultat)", () => {
  beforeAll(async () => {
    await preparerMotDePasse(MDP_SITE);
  });
  beforeEach(async () => {
    await preparerBase();
    vi.stubGlobal("fetch", async () => {
      throw new Error("réseau interdit");
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Termine une fabrication avec ce résultat (le chemin réel : `ecrireAvancement` → `appliquerResultat`). */
  async function terminerAvec(sorties: SortieProduite[], deja: Partial<Sortie>[] = []) {
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const t = (await depots().travaux.obtenir(travailId))!;
    const version = (await depots().versions.obtenir(t.versionId!))!;
    for (const [i, s] of deja.entries()) {
      await depots().sorties.enregistrer({ fichierId: `f-deja-${i}`, vignetteFichierId: `v-deja-${i}`, resolution: "1080x1920", dureeSec: 30, taille: 1, rapportQualite: RAPPORT, ratio: "9:16", ...s, id: `sortie-deja-${i}`, videoId: t.cibleId, versionId: t.versionId!, creeLe: t.creeLe, modifieLe: t.creeLe } as Sortie);
    }
    const resultat: ResultatFabrication = { sorties, noteQualite: { globale: 90, alertes: [] }, lignesReelles: [], projetMontage: {} };
    const lu = { travail: t, commande: version.commande, moteur: moteurDeCommande(version.commande) };
    await travaux.ecrireAvancement(lu, { travail: { ...t, statut: "termine" as const, progression: 100, modifieLe: new Date(Date.now() + 1).toISOString() }, resultat });
    return depots().sorties.lister((s) => s.versionId === t.versionId);
  }

  const faites: IdSortie[] = ["vertical-liens", "vertical"];
  const deuxVerticaux = () => [produite(1, destinationDeLaSortie("vertical-liens", faites, FIN_PROPRE)), produite(2, destinationDeLaSortie("vertical", faites, FIN_AU_MOT))];

  it("résultat du tableau avec les deux verticaux : deux sorties enregistrées, chacune avec ses réseaux et sa fin", async () => {
    const enregistrees = await terminerAvec(deuxVerticaux());
    const verticales = enregistrees.filter((s) => s.ratio === "9:16");
    expect(verticales).toHaveLength(2);
    const liens = verticales.find((s) => s.appelAuMot === false)!;
    const reels = verticales.find((s) => s.appelAuMot === true)!;
    expect(liens.reseaux).toEqual(["tiktok", "youtube-shorts"]);
    expect(reels.reseaux).toEqual(["instagram", "facebook"]);
    expect(meilleureSortie("tiktok", enregistrees)?.id).toBe(liens.id);
    expect(meilleureSortie("instagram", enregistrees)?.id).toBe(reels.id);
  });

  it("Réessayer après un enregistrement partiel : pas de 3e 9:16", async () => {
    const enregistrees = await terminerAvec(deuxVerticaux(), [{ ratio: "9:16", appelAuMot: false, reseaux: ["tiktok", "youtube-shorts"] }]);
    expect(enregistrees.filter((s) => s.ratio === "9:16")).toHaveLength(2);
  });

  it("dans un même lot, deux 9:16 à fin inconnue ne font qu'un fichier (comme pour un fichier déjà enregistré)", async () => {
    const enregistrees = await terminerAvec([produite(1), produite(2), produite(3, { ratio: "16:9", resolution: "1920x1080" })]);
    expect(enregistrees.filter((s) => s.ratio === "9:16")).toHaveLength(1);
    expect(enregistrees.filter((s) => s.ratio === "16:9")).toHaveLength(1);
  });

  it("relecture 2, point 1 : deux verticaux à fin propre des deux côtés → 2 sorties ; Instagram garde le vertical des Reels", async () => {
    const enregistrees = await terminerAvec([produite(1, destinationDeLaSortie("vertical-liens", faites, FIN_PROPRE)), produite(2, destinationDeLaSortie("vertical", faites, FIN_PROPRE))]);
    const verticales = enregistrees.filter((s) => s.ratio === "9:16");
    expect(verticales).toHaveLength(2);
    const reels = verticales.find((s) => s.reseaux?.includes("instagram"))!;
    expect(reels.fichierId).not.toBe(verticales.find((s) => s.reseaux?.includes("tiktok"))!.fichierId);
    expect(meilleureSortie("instagram", enregistrees)?.id).toBe(reels.id);
    expect(meilleureSortie("facebook", enregistrees)?.id).toBe(reels.id);
  });

  it("relecture 2, point 5 : Réessayer une version d'avant T4 (9:16 sans fin ni réseaux) → pas de 9:16 en double", async () => {
    const enregistrees = await terminerAvec([produite(1, destinationDeLaSortie("vertical", ["vertical"]))], [{ ratio: "9:16" }]);
    expect(enregistrees.filter((s) => s.ratio === "9:16")).toHaveLength(1);
  });

  it("relecture 2, point 5 (suite) : Réessayer une version d'avant T4 avec un nouveau vertical à fin au mot → le fichier d'avant reste celui du site", async () => {
    const enregistrees = await terminerAvec([produite(1, destinationDeLaSortie("vertical", ["vertical"], FIN_AU_MOT))], [{ ratio: "9:16" }]);
    const verticales = enregistrees.filter((s) => s.ratio === "9:16");
    expect(verticales.some((s) => s.appelAuMot === true)).toBe(true);
    const ancien = verticales.find((s) => s.appelAuMot === undefined);
    expect(ancien).toBeDefined();
    expect(sortiePrincipale({ ratios: ["9:16"] }, [...verticales].sort((a, b) => b.taille - a.taille))?.id).toBe(ancien!.id);
  });

  it("fin inconnue : déjà faite si un fichier du même format a aussi une fin inconnue", async () => {
    const enregistrees = await terminerAvec([produite(1)], [{ ratio: "9:16" }]);
    expect(enregistrees.filter((s) => s.ratio === "9:16")).toHaveLength(1);
  });
});
