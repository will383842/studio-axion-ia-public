/**
 * FACE CAMÉRA ANIMÉE — LOT D « Les photos et logos » : remplissage des fenêtres d'illustration.
 * Doubles des sources : AUCUN appel réseau.
 */
import { describe, expect, it } from "vitest";
import type { FenetrePlan } from "@/domaine/facecam-animee/plan";
import { schemaFenetre } from "@/domaine/facecam-animee/plan";
import {
  ORDRE_SOURCES,
  SEUIL_MOUVEMENT,
  classerCandidats,
  consigneVerification,
  consigneVerificationMiniVideo,
  ecartMoyen,
  licenceAcceptee,
  lireVerdict,
  lireVerdictMiniVideo,
  ordreDesSources,
  passageLePlusAnime,
  raisonEcart,
  remplirFenetres,
  requetesDe,
  requetesLitterales,
  sonsSansFenetresSupprimees,
  type CandidatImage,
  type DemandeRecherche,
  type DependancesImages,
  type MiniVideoPreparee,
} from "@/moteurs/montage-facecam-animee/images";
import { adaptateurStudio } from "@/moteurs/montage-facecam-animee/images/adaptateur";
import { videosPexels, videosPixabay, type Recuperer } from "@/moteurs/montage-facecam-animee/images/banques";
import { approvisionnerFenetresStudio, etapeImagesStudio, fenetresSansVie } from "@/moteurs/montage-facecam-animee/images/production";
import { creerMoteurMontageFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { COTE_COURT_MIN_VIDEO, formatMiniVideo, mediane, mesureMouvement, partsChangees, passageDansLaPlage, raisonEcartMiniVideo, SEUIL_PIXELS_CHANGES, SEUIL_PIXELS_CHANGES_MAX } from "@/moteurs/montage-facecam-animee/images/choisir";
import { argumentsPlanche, argumentsProfil, longueurExtrait, OCTETS_MAX_EXTRAIT, preparateurMiniVideo, type OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import type { ResultatBanque } from "@/fournisseurs/types";

const fenetre = (n: number, extra: Partial<FenetrePlan> = {}): FenetrePlan => ({ debut: n * 5, fin: n * 5 + 2, media: `fenetre-${n}`, recherche: "devis papier sur un bureau", ...extra });

let compteur = 0;
const cand = (source: CandidatImage["source"], extra: Partial<CandidatImage> = {}): CandidatImage => ({
  source,
  id: `${source}-${++compteur}`,
  genre: "photo",
  cle: `https://exemple.invalid/${source}/${compteur}.jpg`,
  vignette: `https://exemple.invalid/${source}/${compteur}-v.jpg`,
  largeur: 1080,
  hauteur: 1920,
  ...extra,
});

/** Double de la recherche : un catalogue fixe par source et par genre, avec le journal des appels. */
function sources(catalogue: Partial<Record<string, CandidatImage[]>>) {
  const appels: DemandeRecherche[] = [];
  const dep: DependancesImages = {
    async chercher(d) {
      appels.push(d);
      return (catalogue[`${d.source}${d.repli ? ":repli" : ""}`] ?? []).filter((c) => c.genre === d.genre);
    },
    async stocker(c) {
      return `rendu/${c.source}/${c.id}`;
    },
  };
  return { dep, appels };
}

describe("requêtes", () => {
  it("traduit les termes du métier et garde les mots français", () => {
    const r = requetesDe("entretien d'embauche");
    expect(r.requeteEn).toContain("job interview");
    expect(r.traduite).toBe(true);
    expect(requetesDe("devis papier sur un bureau").requeteEn).toMatch(/quote/);
    expect(requetesDe("réunion en visio").requeteEn).toMatch(/video call/);
    expect(requetesDe("devis papier sur un bureau").motsFr).toContain("devi");
  });
  it("repli sur les mots français quand rien n'est traduisible", () => {
    const r = requetesDe("zorglub mirifique");
    expect(r.traduite).toBe(false);
    expect(r.requeteEn).toBe("zorglub mirifique");
  });
  it("ordre des sources : Mes images d'abord, capture en tête seulement si demandée", () => {
    expect(ordreDesSources({})).toEqual(["mes-images", "pexels", "pixabay", "wikimedia", "capture-site"]);
    expect(ordreDesSources({ capture: true })[0]).toBe("capture-site");
  });
});

describe("aucune source payante", () => {
  it("la liste des sources est fermée et gratuite", () => {
    expect([...ORDRE_SOURCES]).toEqual(["mes-images", "pexels", "pixabay", "wikimedia", "capture-site"]);
    for (const s of ORDRE_SOURCES) expect(s).not.toMatch(/shutterstock|getty|adobe|istock|envato|storyblocks|fal|genere|\bia\b/i);
  });
  it("un candidat d'une source payante rendu par un adaptateur est ignoré", async () => {
    const payant = { ...cand("pexels"), source: "shutterstock" as unknown as CandidatImage["source"] };
    const dep: DependancesImages = {
      async chercher() {
        return [payant];
      },
      async stocker(c) {
        return c.id;
      },
    };
    const r = await remplirFenetres({ fenetres: [fenetre(1)] }, dep);
    expect(r.choix).toEqual([]);
    expect(r.manques).toHaveLength(1);
    expect(classerCandidats([payant], { video: false, dureeFenetreSec: 2, dejaPris: new Set() })).toEqual([]);
  });
});

describe("remplirFenetres (passe 3 : mini-vidéos seulement, jamais de photo morte)", () => {
  const vcand = (source: CandidatImage["source"], extra: Partial<CandidatImage> = {}) => cand(source, { genre: "video", dureeSec: 8, cle: `https://exemple.invalid/${source}/${compteur + 1}.mp4`, ...extra });

  it("respecte l'ordre des sources (Mes images avant Pexels avant Pixabay)", async () => {
    const { dep, appels } = sources({ pexels: [vcand("pexels")], pixabay: [vcand("pixabay")] });
    const r = await remplirFenetres({ fenetres: [fenetre(1)] }, dep);
    expect(appels.map((a) => a.source).slice(0, 2)).toEqual(["mes-images", "pexels"]);
    expect(r.choix[0].source).toBe("pexels");
    expect(r.plan.fenetres[0]).toMatchObject({ media: `rendu/pexels/${r.choix[0].id}`, video: true, depuisSec: 0 });
    expect(r.choix[0].url).toMatch(/^https:/);

    const mes = vcand("mes-images", { cle: "bibliotheque/devis.mp4" });
    const s2 = sources({ "mes-images": [mes], pexels: [vcand("pexels")] });
    const r2 = await remplirFenetres({ fenetres: [fenetre(1)] }, s2.dep);
    expect(r2.choix[0].source).toBe("mes-images");
    expect(s2.appels.map((a) => a.source)).toEqual(["mes-images"]);
  });

  it("une fenêtre non déclarée vidéo devient une mini-vidéo ; on ne cherche JAMAIS de photo", async () => {
    const { dep, appels } = sources({ pexels: [cand("pexels"), vcand("pexels")] });
    const plan = { fenetres: [fenetre(1)] };
    const r = await remplirFenetres(plan, dep);
    expect(r.choix[0].genre).toBe("video");
    expect(r.plan.fenetres[0].video).toBe(true);
    expect(appels.every((a) => a.genre === "video")).toBe(true);
    expect(schemaFenetre.safeParse(r.plan.fenetres[0]).success).toBe(true);
    // Le plan reçu n'est pas modifié.
    expect(plan.fenetres[0].media).toBe("fenetre-1");
    expect("video" in plan.fenetres[0]).toBe(false);
  });

  it("Pexels ET Pixabay, page par page (3 pages), requête par requête, puis recherche ÉLARGIE (synonymes, pages 4-5)", async () => {
    const { dep, appels } = sources({ pexels: [vcand("pexels", { dureeSec: 1 })], pixabay: [vcand("pixabay", { dureeSec: 1 })] });
    const r = await remplirFenetres({ fenetres: [fenetre(1)] }, dep);
    const banques = appels.filter((a) => a.source === "pexels" || a.source === "pixabay");
    expect(new Set(banques.map((a) => a.source))).toEqual(new Set(["pexels", "pixabay"]));
    expect(new Set(banques.map((a) => a.page))).toEqual(new Set([1, 2, 3, 4, 5]));
    const litterales = requetesLitterales("devis papier sur un bureau");
    // Recherche littérale d'abord : pages 1-3 des requêtes littérales, page 1 de toutes avant la page 2.
    const strictes = banques.slice(0, banques.findIndex((a) => !litterales.includes(a.requeteEn)));
    expect(new Set(strictes.map((a) => a.page))).toEqual(new Set([1, 2, 3]));
    const premiere2 = strictes.findIndex((a) => a.page === 2);
    expect(strictes.slice(0, premiere2).every((a) => a.page === 1)).toBe(true);
    // Puis les requêtes élargies (synonymes de la scène), puis les pages 4 et 5 des littérales.
    expect(banques.some((a) => !litterales.includes(a.requeteEn))).toBe(true);
    expect(banques.filter((a) => (a.page ?? 1) >= 4).every((a) => litterales.includes(a.requeteEn))).toBe(true);
    expect(r.supprimees).toEqual([0]);
  });

  it("pas de doublon dans la vidéo ni avec les 5 vidéos précédentes", async () => {
    const a = vcand("pexels");
    const b = vcand("pexels");
    const c = vcand("pexels");
    const d = vcand("pexels");
    const { dep } = sources({ pexels: [a, b, c, d] });
    const historique = [[`pexels:${a.id}`], ["x"], ["x"], ["x"], ["x"], ["x"]]; // a : il y a 6 vidéos → de nouveau permis
    const historique2 = [["x"], [`pexels:${b.id}`]];
    const r = await remplirFenetres({ fenetres: [fenetre(1), fenetre(2), fenetre(3)] }, { ...dep, historique: [...historique, ...historique2] });
    const pris = r.choix.map((x) => x.empreinte);
    expect(pris).toEqual([`pexels:${a.id}`, `pexels:${c.id}`, `pexels:${d.id}`]);
    expect(r.empreintes).toHaveLength(3);
  });

  it("refus du contrôle visuel → candidat suivant ; la consigne porte la SCÈNE et les mots dits", async () => {
    const marque = vcand("pexels");
    const bonne = vcand("pexels");
    const { dep } = sources({ pexels: [marque, bonne] });
    const vus: string[] = [];
    const r = await remplirFenetres(
      { fenetres: [fenetre(1, { illustre: "vos devis" })] },
      {
        ...dep,
        async verifierMiniVideo({ candidat, consigne }) {
          vus.push(candidat.id);
          expect(consigne).toContain("devis papier sur un bureau");
          expect(consigne).toContain("vos devis");
          return lireVerdictMiniVideo(candidat.id === marque.id ? '{"verdict":"littéral","logo":true}' : '{"verdict":"littéral","raison":"un devis rempli à la main"}');
        },
      },
    );
    expect(vus).toEqual([marque.id, bonne.id]);
    expect(r.choix[0]).toMatchObject({ empreinte: `pexels:${bonne.id}`, verdict: "littéral", raison: "un devis rempli à la main" });
    expect(r.manques).toEqual([]);
  });

  it("rien ne convient → AUTRE SCÈNE demandée au réalisateur, cherchée, et inscrite dans le plan", async () => {
    const bureau = vcand("pexels", { description: "paper quote document desk" });
    const tableau = vcand("pexels", { description: "writing on whiteboard office" });
    const demandes: unknown[] = [];
    const dep: DependancesImages = {
      async chercher(d) {
        return /whiteboard/.test(d.requeteEn) ? [tableau] : [bureau];
      },
      async stocker(c) {
        return `rendu/${c.id}`;
      },
      async verifierMiniVideo({ candidat }) {
        return lireVerdictMiniVideo(candidat.id === tableau.id ? '{"verdict":"littéral","raison":"on écrit au tableau"}' : '{"verdict":"métaphore"}');
      },
      async autreScene(d) {
        demandes.push(d);
        // 1re proposition : ne reprend AUCUN mot dit (défaut des fenêtres 1, 4 et 8 de la vidéo 4) → refusée sans recherche.
        return demandes.length === 1 ? "consultante qui écrit sur un tableau blanc" : "consultante qui note la première étape sur un tableau blanc";
      },
    };
    const r = await remplirFenetres({ fenetres: [fenetre(1, { illustre: "la première étape" })] }, dep);
    expect(demandes).toHaveLength(2);
    expect(demandes[0]).toMatchObject({ fenetre: 0, recherche: "devis papier sur un bureau", illustre: "la première étape", essayees: ["devis papier sur un bureau"] });
    expect((demandes[0] as { refus: string[] }).refus.join(" ")).toMatch(/métaphore/);
    // Le motif du refus de littéralité est rendu au réalisateur pour sa proposition suivante.
    expect((demandes[1] as { refus: string[] }).refus.join(" ")).toMatch(/« consultante qui écrit sur un tableau blanc » refusée avant recherche : ne reprend aucun mot dit/);
    expect(r.plan.fenetres[0]).toMatchObject({ media: `rendu/${tableau.id}`, recherche: "consultante qui note la première étape sur un tableau blanc", video: true });
    expect(r.choix[0].scene).toBe("consultante qui note la première étape sur un tableau blanc");
    expect(r.manques[0].raison).toMatch(/autre scène retenue/);
  });

  it("passe 4 : une scène de remplacement passe le contrôle de littéralité du PLAN (aucune erreur de fenêtre ensuite)", async () => {
    const { controleScene, scenesDeSecours } = await import("@/moteurs/montage-facecam-animee/images");
    const { verifierPlan } = await import("@/moteurs/montage-facecam-animee/realisateur/regles");
    // Les 3 scènes de remplacement de la vidéo 4 qui ne reprenaient aucun mot dit (fenêtres 1, 4 et 8) sont refusées.
    expect(controleScene("homme qui travaille tard le soir sur ordinateur au bureau", "vos journées, elles, n'en finissent plus").join()).toMatch(/aucun mot dit/);
    expect(controleScene("consultant qui examine des documents au bureau", "trouver la fuite").join()).toMatch(/aucun mot dit/);
    expect(controleScene("deux personnes qui discutent devant un ordinateur au bureau", "on vous propose de commencer par là").join()).toMatch(/aucun mot dit/);
    // Métaphore, action invisible, personne non montrée : refusées aussi.
    expect(controleScene("sablier qui s'écoule sur le bureau du dirigeant", "du temps vous échappe").join()).toMatch(/métaphore/);
    expect(controleScene("dirigeant qui sent le temps lui échapper au bureau", "du temps vous échappe").join()).toMatch(/ne se filme pas/);
    expect(controleScene("bureau d'entreprise recrutement vide", "un dirigeant qui voulait recruter").join()).toMatch(/personne|action/);
    // Les scènes de secours des 4 fenêtres supprimées de la vidéo 4 passent, et le PLAN qui les porte n'a aucune erreur de fenêtre.
    const fenetres: [string, number, number][] = [["on forme les équipes à l'IA", 20.1, 21.6], ["un accompagnement one-to-one", 66.4, 68.9], ["du temps vous échappe", 81, 83.6], ["temps vous échappe", 83.7, 86.6], ["vos journées, elles, n'en finissent plus", 1.7, 3.6], ["on vous propose de commencer par là", 51.4, 53.6], ["trouver la fuite", 38, 39.8]];
    for (const [illustre] of fenetres) expect(scenesDeSecours(illustre).length, illustre).toBeGreaterThan(0);
    const { readFileSync } = await import("node:fs");
    const mots = JSON.parse(readFileSync(new URL("./fixtures/mots-img7747.json", import.meta.url), "utf8"));
    const plan = {
      version: 1, charte: "interface-claire/1", duree: 93, fps: 25, largeur: 1080, hauteur: 1920, prise: { src: "p.mp4", finSec: 91 }, groupes: [], zooms: [], mouvements: [], cartes: [], calques: [], sons: [],
      fin: { debut: 90, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
      fenetres: fenetres.map(([illustre, debut, fin], i) => ({ debut, fin, media: `fenetre-${i + 1}`, recherche: scenesDeSecours(illustre)[0], illustre, video: true })),
    };
    const erreurs = verifierPlan(plan, mots).erreurs.filter((e) => /^Fenêtre \d+ : la (recherche|phrase)/.test(e));
    expect(erreurs).toEqual([]);
  });

  it("passe 4 : rien du tout chez le réalisateur → scènes de SECOURS contrôlées, cherchées avant toute suppression", async () => {
    const reunion = vcand("pexels", { description: "business coaching office" });
    const cherchees: string[] = [];
    const dep: DependancesImages = {
      async chercher(d) {
        cherchees.push(d.recherche);
        return /coaching|mentor|consultant|advising/.test(d.requeteEn) && d.recherche !== "zorglub mirifique sans scène" ? [reunion] : [];
      },
      async stocker(c) {
        return `rendu/${c.id}`;
      },
      async autreScene() {
        return null;
      },
    };
    const r = await remplirFenetres({ fenetres: [fenetre(1, { recherche: "zorglub mirifique sans scène", illustre: "un accompagnement one-to-one" })] }, dep);
    expect(r.supprimees).toEqual([]);
    expect(r.choix[0].scene).toMatch(/accompagne/);
    expect(cherchees[0]).toBe("zorglub mirifique sans scène");
  });

  it("toujours rien (ou pas d'autre scène) → la fenêtre est SUPPRIMÉE, jamais remplacée par une photo", async () => {
    const photo = cand("pexels", { description: "paper quote document" });
    const { dep, appels } = sources({ pexels: [photo, vcand("pexels", { dureeSec: 1 })], "mes-images:repli": [cand("mes-images", { cle: "bibliotheque/portrait-will.jpg" })] });
    let scenes = 0;
    const r = await remplirFenetres({ fenetres: [fenetre(1), fenetre(2)] }, { ...dep, autreScene: async () => (++scenes === 1 ? "artisan au téléphone avec un client" : null) });
    expect(r.plan.fenetres).toEqual([]);
    expect(r.supprimees).toEqual([0, 1]);
    expect(r.manques.map((m) => m.supprimee)).toEqual([true, true]);
    expect(r.manques[0].recherche).toBe("devis papier sur un bureau | artisan au téléphone avec un client");
    expect(r.manques[0].raison).toMatch(/fenêtre supprimée/);
    expect(appels.every((a) => a.genre === "video")).toBe(true);
    expect(r.choix).toEqual([]);
  });

  it("une capture du site (capture: true) est gardée : elle défile, ce n'est pas une photo morte", async () => {
    const capture = cand("capture-site", { cle: "captures/accueil.png" });
    const { dep } = sources({ "capture-site:repli": [capture] });
    const r = await remplirFenetres({ fenetres: [fenetre(1, { capture: true, video: true, depuisSec: 1 })] }, dep);
    expect(r.choix[0].source).toBe("capture-site");
    expect(r.plan.fenetres[0].media).toBe(`rendu/capture-site/${capture.id}`);
    expect("video" in r.plan.fenetres[0]).toBe(false);
    expect("depuisSec" in r.plan.fenetres[0]).toBe(false);
  });

  it("une source en panne n'empêche pas la suivante", async () => {
    const video = vcand("pixabay");
    const dep: DependancesImages = {
      async chercher(d) {
        if (d.source === "pexels") throw new Error("Pexels ne répond pas");
        return d.source === "pixabay" ? [video] : [];
      },
      async stocker(c) {
        return c.id;
      },
    };
    const r = await remplirFenetres({ fenetres: [fenetre(1)] }, dep);
    expect(r.choix[0].source).toBe("pixabay");
  });
});

describe("classement", () => {
  const ctx = { video: false, dureeFenetreSec: 2, dejaPris: new Set<string>() };
  it("vertical d'abord, puis 4:5, puis recadrable ; trop petit écarté", () => {
    const paysage = cand("pexels", { largeur: 2400, hauteur: 1600 }); // recadré 4:5 → 1280 de large
    const quatreCinq = cand("pexels", { largeur: 1080, hauteur: 1350 });
    const vertical = cand("pexels", { largeur: 1080, hauteur: 1920 });
    const petit = cand("pexels", { largeur: 720, hauteur: 1280 });
    const petitPaysage = cand("pexels", { largeur: 1920, hauteur: 1080 }); // recadré → 864 : trop petit
    expect(classerCandidats([paysage, petit, quatreCinq, petitPaysage, vertical], ctx).map((c) => c.id)).toEqual([vertical.id, quatreCinq.id, paysage.id]);
  });
  it("description sans rapport ou défaut connu du B-roll : écarté", () => {
    const horsSujet = cand("pexels", { description: "man walking dog in park" });
    const filigrane = cand("pexels", { filigrane: true });
    const bon = cand("pexels", { description: "paper quote document on desk" });
    expect(classerCandidats([horsSujet, filigrane, bon], { ...ctx, requeteEn: "paper quote document" }).map((c) => c.id)).toEqual([bon.id]);
  });
});

describe("contrôle visuel", () => {
  it("consigne en français avec la recherche ; réponse illisible = refus", () => {
    expect(consigneVerification("devis papier")).toContain("« devis papier »");
    expect(consigneVerification("x")).toMatch(/marque/);
    expect(lireVerdict('Voici : {"accepte": true, "raison": "ok"}')).toEqual({ accepte: true, raison: "ok" });
    expect(lireVerdict("je ne sais pas").accepte).toBe(false);
  });
});

describe("adaptateur de la recherche existante", () => {
  it("branche Pexels/Pixabay sur FournisseurIllustration.chercher et recopie seulement le retenu", async () => {
    const resultat: ResultatBanque = {
      idExterne: "42",
      source: "pexels",
      fichierCle: "https://videos.pexels.invalid/42.mp4",
      vignetteCle: "https://images.pexels.invalid/42.jpg",
      dureeSec: 8,
      largeur: 1080,
      hauteur: 1920,
      licence: { type: "libre", usageCommercial: true, reseaux: [], source: "Pexels" },
      description: "paper quote document desk",
    };
    const demandes: unknown[] = [];
    const recopies: string[] = [];
    const a = adaptateurStudio({
      illustration: {
        async chercher(d) {
          demandes.push(d);
          return [resultat];
        },
        async recopierResultat(r) {
          recopies.push(r.idExterne);
          return { ...r, fichierCle: "illustrations/pexels/42.mp4" };
        },
      },
    });
    const r = await remplirFenetres({ fenetres: [fenetre(1, { video: true })] }, a);
    expect(demandes[0]).toMatchObject({ ratio: "9:16", sources: ["pexels"] });
    expect(recopies).toEqual(["42"]);
    expect(r.plan.fenetres[0].media).toBe("illustrations/pexels/42.mp4");
    expect(r.choix[0]).toMatchObject({ source: "pexels", genre: "video", url: "https://videos.pexels.invalid/42.mp4" });
  });
});

/* ------------------------------------------------------------------ */
/* MINI-VIDÉOS (retour de Will du 14/10)                               */
/* ------------------------------------------------------------------ */

describe("requêtes littérales (mini-vidéos)", () => {
  const MOTS_FRANCAIS = /\b(qui|une?|les?|la|des?|du|au|sur|dans|par|pour|avec|bureau|entretien|reunion|famille|facture|devis|clavier|telephone|livraison|atelier|nuit|soir)\b/;
  const cas: [string, RegExp][] = [
    ["dirigeant qui fait passer un entretien d'embauche", /^job interview manager office$/],
    ["salariée qui tape au clavier", /typing keyboard/],
    ["artisan au téléphone avec un client", /phone call/],
    ["réunion d'équipe au bureau", /team meeting.*office/],
    ["signature d'un contrat", /signing contract/],
    ["artisan dans son atelier", /craftsman working.*workshop/],
    ["livraison d'un colis chez un client", /delivery package/],
    ["bureau la nuit", /working late.*office.*night/],
    ["famille le week-end", /family weekend/],
    ["facture impayée sur le bureau", /invoice paperwork.*desk/],
    ["devis papier sur un bureau", /paper quote document desk/],
    ["boîte mail pleine", /email inbox/],
    ["tableau de bord de l'entreprise", /dashboard analytics/],
  ];
  it.each(cas)("« %s » → 2-3 requêtes anglaises littérales", (recherche, attendu) => {
    const q = requetesLitterales(recherche);
    expect(q.length).toBeGreaterThanOrEqual(2);
    expect(q.length).toBeLessThanOrEqual(3);
    expect(q[0]).toMatch(attendu);
    for (const r of q) {
      expect(r).not.toMatch(/[^a-z ]/); // anglais, sans accent ni ponctuation
      expect(r).not.toMatch(MOTS_FRANCAIS);
      expect(r.split(" ").length).toBeLessThanOrEqual(6);
    }
    // requetesDe porte la première requête littérale (les banques la reçoivent en tête).
    expect(requetesDe(recherche).requeteEn).toBe(q[0]);
    expect(requetesDe(recherche).litterales).toEqual(q);
  });
  it("les 4 fenêtres de la vidéo 1 donnent des scènes littérales", () => {
    expect(requetesLitterales("horloge murale dans un bureau vide le soir")[0]).toBe("wall clock empty office night");
    expect(requetesLitterales("robinet qui fuit goutte à goutte")[0]).toMatch(/^leaking faucet/);
    expect(requetesLitterales("dirigeant débordé par la paperasse au bureau")[0]).toBe("paperwork stack overwhelmed manager office");
    expect(requetesLitterales("sablier qui s'écoule sur un bureau")[0]).toBe("hourglass sand desk");
  });
  it("les mots dits (« illustre ») servent quand la recherche ne nomme pas de scène", () => {
    expect(requetesLitterales("zorglub mirifique", "je signe le contrat")[0]).toMatch(/signing contract/);
    expect(requetesLitterales("zorglub mirifique")).toEqual([]);
  });
});

describe("choix des mini-vidéos", () => {
  const ctx = { video: true, dureeFenetreSec: 3, dejaPris: new Set<string>() };
  const vid = (extra: Partial<CandidatImage> = {}) => cand("pexels", { genre: "video", dureeSec: 10, largeur: 1080, hauteur: 1920, cle: "https://exemple.invalid/v.mp4", ...extra });

  it("écarte la vidéo trop courte (< fenêtre + 0,5 s)", () => {
    expect(raisonEcart(vid({ dureeSec: 3.4 }), ctx)).toBe("vidéo trop courte");
    expect(raisonEcart(vid({ dureeSec: 3.5 }), ctx)).toBeNull();
  });
  it("écarte l'horizontale non recadrable, garde le 16:9 recadré en 4:5 si ≥ 720 px", () => {
    expect(raisonEcart(vid({ largeur: 2560, hauteur: 1080 }), ctx)).toBe("horizontale non recadrable"); // 21:9
    expect(raisonEcart(vid({ largeur: 1920, hauteur: 1080 }), ctx)).toBeNull(); // recadré 864×1080
    expect(raisonEcart(vid({ largeur: 1280, hauteur: 720 }), ctx)).toBe("résolution trop faible"); // recadré 576×720
    expect(raisonEcart(vid({ largeur: 720, hauteur: 1280 }), ctx)).toBeNull(); // 720 accepté pour une vidéo
    expect(raisonEcart(vid({ largeur: 540, hauteur: 960 }), ctx)).toBe("résolution trop faible");
  });
  it("écarte la vidéo sans mouvement, garde celle qui bouge", () => {
    expect(raisonEcart(vid({ mouvement: 0.4 }), ctx)).toBe("sans mouvement");
    expect(raisonEcart(vid({ mouvement: SEUIL_MOUVEMENT + 1 }), ctx)).toBeNull();
  });
  it("écarte la vidéo déjà utilisée (cette vidéo ou les 5 précédentes)", () => {
    const v = vid();
    expect(raisonEcart(v, { ...ctx, dejaPris: new Set([`pexels:${v.id}`]) })).toBe("déjà dans cette vidéo");
    expect(raisonEcart(v, { ...ctx, historique: [[`pexels:${v.id}`], ["x"]] })).toBe("déjà dans une des 5 vidéos précédentes");
  });
  it("écarte texte incrusté, logo, visage en très gros plan", () => {
    expect(raisonEcart(vid({ texteIncruste: true }), ctx)).toBe("texte incrusté");
    expect(raisonEcart(vid({ logo: true }), ctx)).toBe("logo de marque");
    expect(raisonEcart(vid({ visageGrosPlan: true }), ctx)).toBe("visage en très gros plan");
  });
  it("classe vertical d'abord, puis 1080 avant 720", () => {
    const paysage = vid({ largeur: 1920, hauteur: 1080 });
    const v720 = vid({ largeur: 720, hauteur: 1280 });
    const v1080 = vid();
    expect(classerCandidats([paysage, v720, v1080], ctx).map((c) => c.id)).toEqual([v1080.id, v720.id, paysage.id]);
  });
  it("Wikimedia : CC0 ou CC-BY (attribution notée) seulement", () => {
    expect(licenceAcceptee({ source: "wikimedia", licence: { usageCommercial: true, nom: "CC0" } })).toBe(true);
    expect(licenceAcceptee({ source: "wikimedia", licence: { usageCommercial: true, nom: "CC BY 4.0", attribution: "Jean Dupont" } })).toBe(true);
    expect(licenceAcceptee({ source: "wikimedia", licence: { usageCommercial: true, nom: "CC BY 4.0" } })).toBe(false);
    expect(licenceAcceptee({ source: "wikimedia", licence: { usageCommercial: true, nom: "CC BY-SA 4.0", attribution: "X" } })).toBe(false);
    expect(licenceAcceptee({ source: "wikimedia", licence: { usageCommercial: true } })).toBe(false);
  });
});

describe("mesure du mouvement", () => {
  it("écart moyen sur 3 images ; image fixe = 0", () => {
    const a = new Uint8Array([0, 0, 0, 0]);
    const b = new Uint8Array([10, 10, 10, 10]);
    expect(ecartMoyen([a, a, a])).toBe(0);
    expect(ecartMoyen([a, b, a])).toBe(10);
    expect(ecartMoyen([a])).toBe(0);
  });
  it("passage le plus animé : la fenêtre glissante au plus grand écart", () => {
    const ecarts = [0, 0, 0, 0, 5, 6, 7, 6, 0, 0]; // 4 images/s
    expect(passageLePlusAnime(ecarts, 4, 1)).toEqual({ debutSec: 1, mouvement: 6 });
    expect(passageLePlusAnime([], 4, 1)).toEqual({ debutSec: 0, mouvement: 0 });
  });
});

describe("contrôle « littéral »", () => {
  it("consigne avec les mots dits et la recherche", () => {
    const c = consigneVerificationMiniVideo("robinet qui fuit", "une fuite d'argent");
    expect(c).toContain("« une fuite d'argent »");
    expect(c).toContain("« robinet qui fuit »");
    expect(c).toMatch(/littéral/);
  });
  it("seul « littéral » sans défaut passe ; illisible = hors sujet", () => {
    expect(lireVerdictMiniVideo('{"verdict":"littéral","texte":false,"logo":false,"grosPlanVisage":false,"raison":"un robinet goutte"}')).toMatchObject({ accepte: true, verdict: "littéral" });
    expect(lireVerdictMiniVideo('{"verdict":"métaphore","raison":"des billets qui s\'envolent"}')).toMatchObject({ accepte: false, verdict: "métaphore" });
    expect(lireVerdictMiniVideo('{"verdict":"hors sujet"}').accepte).toBe(false);
    expect(lireVerdictMiniVideo('{"verdict":"littéral","logo":true}')).toMatchObject({ accepte: false, logo: true });
    expect(lireVerdictMiniVideo("je ne sais pas")).toMatchObject({ accepte: false, verdict: "hors sujet" });
  });
});

describe("remplirFenetres avec mini-vidéos", () => {
  const fen = (extra: Partial<FenetrePlan> = {}): FenetrePlan => ({ debut: 10, fin: 13, media: "fenetre-1", recherche: "robinet qui fuit goutte à goutte", illustre: "trouver la fuite", video: true, ...extra });
  const vid = (extra: Partial<CandidatImage> = {}) => cand("pexels", { genre: "video", dureeSec: 12, cle: `https://exemple.invalid/v${compteur}.mp4`, description: "leaking faucet dripping water", ...extra });

  function banc(videos: CandidatImage[], options: { mouvement?: (c: CandidatImage) => number; verdict?: (c: CandidatImage) => string; photos?: CandidatImage[] } = {}) {
    const requetes: string[] = [];
    const abandons: string[] = [];
    const prepares: string[] = [];
    const dep: DependancesImages = {
      async chercher(d) {
        if (d.source === "pexels") requetes.push(`${d.genre}:${d.requeteEn}`);
        if (d.source !== "pexels") return [];
        return d.genre === "video" ? videos : (options.photos ?? []);
      },
      async stocker(c) {
        return `images/fenetre-1.jpg#${c.id}`;
      },
      async preparerMiniVideo(c, d): Promise<MiniVideoPreparee> {
        prepares.push(c.id);
        return { cle: `images/fenetre-${d.fenetre + 1}.mp4`, depuisSec: 0, mouvement: options.mouvement?.(c) ?? 4, debutSourceSec: 2, dureeSec: 3.5, octets: 2_000_000, image: `/tmp/${c.id}.jpg` };
      },
      async abandonner(cle) {
        abandons.push(cle);
      },
      async verifierMiniVideo({ candidat, consigne, illustre }) {
        expect(illustre).toBe("trouver la fuite");
        expect(consigne).toContain("robinet qui fuit");
        return lireVerdictMiniVideo(options.verdict?.(candidat) ?? '{"verdict":"littéral","raison":"un robinet goutte"}');
      },
    };
    return { dep, requetes, abandons, prepares };
  }

  it("mini-vidéo littérale retenue : media .mp4, video:true, depuisSec renseigné, rapport complet", async () => {
    const v = vid({ licence: { usageCommercial: true, nom: "Pexels" }, page: "https://www.pexels.com/video/1" });
    const { dep, requetes } = banc([v]);
    const r = await remplirFenetres({ fenetres: [fen()] }, dep);
    // Passe 3 : la requête vient de la SCÈNE demandée (« robinet qui fuit »), pas de la phrase dite (« trouver la fuite »).
    expect(requetes[0]).toMatch(/^video:leaking faucet/);
    expect(r.plan.fenetres[0]).toMatchObject({ media: "images/fenetre-1.mp4", video: true, depuisSec: 0 });
    expect(schemaFenetre.safeParse(r.plan.fenetres[0]).success).toBe(true);
    expect(r.choix[0]).toMatchObject({ source: "pexels", id: v.id, verdict: "littéral", licence: { nom: "Pexels" }, mouvement: 4 });
    expect(r.manques).toEqual([]);
  });

  it("« métaphore » refusée → candidat suivant ; fichier préparé retiré", async () => {
    const meta = vid();
    const bonne = vid();
    const { dep, abandons } = banc([meta, bonne], { verdict: (c) => (c.id === meta.id ? '{"verdict":"métaphore","raison":"symbole"}' : '{"verdict":"littéral","raison":"ok"}') });
    const r = await remplirFenetres({ fenetres: [fen()] }, dep);
    expect(r.choix[0].id).toBe(bonne.id);
    expect(abandons).toEqual(["images/fenetre-1.mp4"]);
  });

  it("sans mouvement mesuré → écartée avant le contrôle visuel", async () => {
    const fixe = vid();
    const bouge = vid();
    let controles = 0;
    const b = banc([fixe, bouge], { mouvement: (c) => (c.id === fixe.id ? 0.2 : 5) });
    const verifier = b.dep.verifierMiniVideo!;
    b.dep.verifierMiniVideo = async (d) => (controles++, verifier(d));
    const r = await remplirFenetres({ fenetres: [fen()] }, b.dep);
    expect(r.choix[0].id).toBe(bouge.id);
    expect(controles).toBe(1);
  });

  it("contrôle visuel sur l'image EXTRAITE du passage, jamais la vignette ; sans image extraite → refusé", async () => {
    const sans = vid({ vignette: "https://banque.invalid/apercu.jpg" });
    const avec = vid({ vignette: "https://banque.invalid/apercu2.jpg" });
    const b = banc([sans, avec]);
    const preparer = b.dep.preparerMiniVideo!;
    b.dep.preparerMiniVideo = async (c, d) => {
      const p = await preparer(c, d);
      return c.id === sans.id ? { ...p, image: undefined } : p;
    };
    const vues: (string | undefined)[] = [];
    const verifier = b.dep.verifierMiniVideo!;
    b.dep.verifierMiniVideo = async (d) => (vues.push(d.image), verifier(d));
    const r = await remplirFenetres({ fenetres: [fen()] }, b.dep);
    expect(r.choix[0].id).toBe(avec.id);
    expect(vues).toEqual([`/tmp/${avec.id}.jpg`]);
  });

  it("aucune mini-vidéo ne passe (et la banque a des photos) : fenêtre SUPPRIMÉE, aucune photo", async () => {
    const photo = cand("pexels", { description: "leaking faucet" });
    const { dep } = banc([vid(), vid()], { verdict: () => '{"verdict":"hors sujet"}', photos: [photo] });
    const r = await remplirFenetres({ fenetres: [fen({ depuisSec: 1.5 })] }, dep);
    expect(r.choix).toEqual([]);
    expect(r.plan.fenetres).toEqual([]);
    expect(r.supprimees).toEqual([0]);
    expect(r.manques[0]).toMatchObject({ supprimee: true });
  });
});

describe("mouvement VISIBLE (passe 2 : une vidéo qu'on ne distingue pas d'une photo est refusée)", () => {
  const image = (f: (i: number) => number) => Uint8Array.from({ length: 96 * 120 }, (_, i) => f(i));
  it("images identiques : 0 % de pixels changés, toutes figées ; images qui changent : mesurées", () => {
    const a = image(() => 100);
    expect(mesureMouvement([a, a, a])).toEqual({ ecart: 0, pixelsChanges: 0, partFigee: 1, mediane: 0, coupes: 0 });
    const b = image((i) => (i % 10 === 0 ? 160 : 100)); // 10 % des pixels changent de 60 niveaux
    const m = mesureMouvement([a, b, a]);
    expect(m.pixelsChanges).toBeCloseTo(0.1, 5);
    expect(m.partFigee).toBe(0);
    expect(mesureMouvement([a]).partFigee).toBe(1);
  });
  it("le bruit de compression (écart ≤ 12 niveaux) ne compte pas comme du mouvement", () => {
    expect(mesureMouvement([image(() => 100), image(() => 110)]).pixelsChanges).toBe(0);
  });
  it("passe 3 : plage 3-35 % sur la MÉDIANE (25 i/s) ; figée, travelling et coupe refusés", () => {
    const v: CandidatImage = { source: "pexels", id: "1", genre: "video", cle: "https://x.invalid/v.mp4", largeur: 1080, hauteur: 1920, dureeSec: 10 };
    expect(SEUIL_PIXELS_CHANGES).toBe(0.03);
    expect(SEUIL_PIXELS_CHANGES_MAX).toBe(0.35);
    // Étalonnage vidéo 3 : fenêtre 2 (1,5 %) et 3 (2,2 %) refusées, 12 (5,7 %) et 5 (24 %) gardées.
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.015 }, 3)).toMatch(/mouvement invisible/);
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.022 }, 3)).toMatch(/mouvement invisible/);
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.057, partFigee: 0 }, 3)).toBeNull();
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.24, partFigee: 0 }, 3)).toBeNull();
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.5 }, 3)).toMatch(/bouge trop/);
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.1, coupes: 1 }, 3)).toMatch(/changement de plan/);
    expect(raisonEcartMiniVideo({ ...v, pixelsChangesMedian: 0.05, partFigee: 0.5 }, 3)).toMatch(/figées/);
    // La médiane décide, pas la moyenne (une seule image qui saute ne fait pas bouger une vidéo figée).
    expect(raisonEcartMiniVideo({ ...v, pixelsChanges: 0.08, pixelsChangesMedian: 0.01 }, 3)).toMatch(/mouvement invisible/);
  });
  it("passage choisi : sans coupe, médiane la plus haute DANS la plage (pas le travelling)", () => {
    // 25 i/s, 20 s : 0-6 s figé, 6-10 s action (8 %), 10-14 s travelling (60 %), 14-20 s figé, coupe à 17 s.
    const parts = Array.from({ length: 500 }, (_, k) => (k >= 150 && k < 250 ? 0.08 : k >= 250 && k < 350 ? 0.6 : k === 425 ? 0.9 : 0));
    const p = passageDansLaPlage(parts, 25, 3.5);
    expect(p.dansLaPlage).toBe(true);
    expect(p.mediane).toBeCloseTo(0.08);
    expect(p.debutSec).toBeGreaterThanOrEqual(6);
    expect(p.debutSec + 3.5).toBeLessThanOrEqual(10.01);
    expect(passageDansLaPlage(Array(200).fill(0.005), 25, 3).dansLaPlage).toBe(false);
    expect(mediane([0.01, 0.9, 0.02])).toBe(0.02);
    expect(partsChangees([Uint8Array.of(0, 0, 0, 0), Uint8Array.of(0, 200, 0, 0)])).toEqual([0.25]);
  });
  it("remplirFenetres : un extrait au mouvement invisible est retiré et le candidat suivant est pris ; mesures au rapport", async () => {
    const fixe: CandidatImage = { source: "pexels", id: "fixe", genre: "video", cle: "https://x.invalid/a.mp4", largeur: 1080, hauteur: 1920, dureeSec: 10, description: "leaking faucet" };
    const bouge: CandidatImage = { ...fixe, id: "bouge", cle: "https://x.invalid/b.mp4" };
    const abandons: string[] = [];
    const r = await remplirFenetres(
      { fenetres: [{ debut: 1, fin: 3, media: "fenetre-1", recherche: "robinet qui fuit", video: true }] },
      {
        chercher: async (d) => (d.source === "pexels" && d.genre === "video" ? [fixe, bouge] : []),
        stocker: async () => "x",
        preparerMiniVideo: async (c) => ({ cle: `videos/fenetre-1.mp4#${c.id}`, depuisSec: 0, mouvement: 3, pixelsChanges: c.id === "fixe" ? 0.008 : 0.06, pixelsChangesMedian: c.id === "fixe" ? 0.008 : 0.055, partFigee: 0.1, dureeSec: 3.5, image: `/tmp/${c.id}.jpg` }),
        abandonner: async (cle) => void abandons.push(cle),
        verifierMiniVideo: async () => lireVerdictMiniVideo('{"verdict":"littéral","raison":"ok"}'),
      },
    );
    expect(abandons).toEqual(["videos/fenetre-1.mp4#fixe"]);
    expect(r.plan.fenetres[0]).toMatchObject({ media: "videos/fenetre-1.mp4#bouge", video: true, depuisSec: 0 });
    expect(r.choix[0]).toMatchObject({ id: "bouge", pixelsChanges: 0.06, pixelsChangesMedian: 0.055, partFigee: 0.1, imageControle: "/tmp/bouge.jpg" });
  });
});

describe("préparation d'une mini-vidéo (outils doublés, aucun ffmpeg lancé)", () => {
  const norm = (f: string) => f.split("\\").join("/");
  function outils(options: { tailles?: number[] } = {}) {
    const journal: string[] = [];
    const tailles = [...(options.tailles ?? [3_000_000])];
    let verrous = 0;
    const o: OutilsPreparation = {
      async executer(programme, a) {
        const fichier = programme === "ffprobe" ? a[a.length - 1] : a[a.indexOf("-i") + 1];
        const extrait = fichier.endsWith("extrait.mp4");
        if (programme === "ffprobe") return new TextEncoder().encode(JSON.stringify({ streams: [{ width: 1080, height: extrait ? 1350 : 1920 }], format: { duration: extrait ? "3.5" : "12" } }));
        if (a.includes("rawvideo")) {
          // Taille d'image lue dans le filtre (recadrage 4:5 puis réduction) : le double suit ce que ffmpeg rendrait.
          const [, w, h] = /scale=(\d+):(\d+)/.exec(a[a.indexOf("-vf") + 1])!.map(Number);
          const taille = w * h;
          const n = extrait ? 87 : 300; // 25 i/s : extrait de 3,5 s, source de 12 s
          const brut = new Uint8Array(taille * n);
          // Source : immobile sauf de 6 à 9 s (10 % des pixels) ; extrait : un pixel sur 20 change à chaque image (5 %).
          for (let k = 0; k < n; k++)
            for (let i = 0; i < taille; i++) brut[k * taille + i] = extrait ? (i % 20 === 0 && k % 2 ? 200 : 50) : k >= 150 && k < 225 && i % 10 === 0 ? (k % 2 ? 220 : 30) : 90;
          return brut;
        }
        journal.push(a.includes("libx264") ? `encodage ${a[a.indexOf("-crf") + 1]} ${a[a.indexOf("-ss") + 1]}` : "image de contrôle");
        return new Uint8Array();
      },
      async telecharger(url, f) {
        journal.push(`téléchargement ${url} ${norm(f)}`);
      },
      async dossierTravail(nom) {
        return `/travail/${nom}`;
      },
      async taille() {
        return tailles.length > 1 ? tailles.shift()! : tailles[0];
      },
      async deposer(_f, cle) {
        journal.push(`dépôt ${cle}`);
        return cle;
      },
      async supprimer(f) {
        journal.push(`suppression ${norm(f)}`);
      },
      async sousVerrou(f) {
        verrous++;
        return f();
      },
    };
    return { o, journal, verrous: () => verrous };
  }
  const c: CandidatImage = { source: "pexels", id: "42", genre: "video", cle: "https://x.invalid/v.mp4", largeur: 1080, hauteur: 1920, dureeSec: 12 };

  it("passage dans la plage, mouvement mesuré sur l'extrait (médiane), planche de contrôle, source supprimée, dépôt sous videos/fenetre-N.mp4", async () => {
    const { o, journal, verrous } = outils();
    const p = await preparateurMiniVideo(o)(c, { fenetre: 2, dureeFenetreSec: 2.8 });
    expect(p.cle).toBe("videos/fenetre-3.mp4");
    expect(p.depuisSec).toBe(0);
    expect(p.debutSourceSec).toBeGreaterThanOrEqual(5.5);
    expect(p.debutSourceSec).toBeLessThanOrEqual(6.5);
    expect(p.pixelsChanges).toBeCloseTo(0.05, 2);
    expect(p.pixelsChangesMedian).toBeCloseTo(0.05, 2);
    expect(p.coupes).toBe(0);
    expect(p.partFigee).toBe(0);
    expect(journal.filter((l) => l === "image de contrôle")).toHaveLength(1);
    expect(norm(p.image ?? "")).toBe("/travail/pexels-42/controle.jpg");
    expect(verrous()).toBe(1);
    expect(journal).toContain("suppression /travail/pexels-42/source.mp4");
    expect(journal.at(-1)).toBe("dépôt videos/fenetre-3.mp4");
  });

  it("trop lourd : qualité baissée par paliers jusqu'à ≤ 8 Mo", async () => {
    const { o, journal } = outils({ tailles: [OCTETS_MAX_EXTRAIT + 1, OCTETS_MAX_EXTRAIT + 1, 5_000_000] });
    await preparateurMiniVideo(o)(c, { fenetre: 0, dureeFenetreSec: 2 });
    expect(journal.filter((l) => l.startsWith("encodage")).map((l) => l.split(" ")[1])).toEqual(["21", "25", "29"]);
  });

  it("une clé qui n'est pas une adresse n'est pas téléchargée", async () => {
    const { o } = outils();
    await expect(preparateurMiniVideo(o)({ ...c, cle: "images/deja.mp4" }, { fenetre: 0, dureeFenetreSec: 2 })).rejects.toThrow(/adresse/);
  });

  it("longueur de l'extrait : fenêtre + 0,5 s entre 3 et 4 s, jamais plus que la source", () => {
    expect(longueurExtrait(1.5, 30)).toBe(3);
    expect(longueurExtrait(3.2, 30)).toBeCloseTo(3.7);
    expect(longueurExtrait(5, 30)).toBe(4);
    expect(longueurExtrait(3, 2.5)).toBeCloseTo(2.4);
  });

  it("adaptateur de production : la préparation branchée expose preparerMiniVideo et abandonner", async () => {
    const retraits: string[] = [];
    const { o } = outils();
    const avec = adaptateurStudio({ preparation: { ...o, retirer: async (cle) => void retraits.push(cle) } });
    expect(typeof avec.preparerMiniVideo).toBe("function");
    await avec.abandonner!("videos/fenetre-1.mp4");
    expect(retraits).toEqual(["videos/fenetre-1.mp4"]);
    expect(adaptateurStudio({}).preparerMiniVideo).toBeUndefined();
  });

  it("requêtes littérales : équipe en formation, goutte d'eau d'une fuite", () => {
    expect(requetesLitterales("équipe en formation autour d'une table de réunion")[0]).toBe("corporate training team office");
    expect(requetesLitterales("goutte d'eau qui tombe d'une fuite dans un bureau")[0]).toMatch(/^water leak dripping/);
  });

  it("passe 3 : la requête vient de la SCÈNE demandée, jamais de la phrase dite", () => {
    expect(requetesLitterales("goutte d'eau qui tombe d'une fuite dans un bureau", "On veut colmater")[0]).toMatch(/^water leak dripping/);
    expect(requetesLitterales("dirigeant qui fait passer un entretien pour recruter", "un dirigeant qui voulait recruter pour absorber")[0]).toBe("job interview manager office");
    expect(requetesLitterales("sablier qui s'écoule sur un bureau", "du temps vous échappe")[0]).toBe("hourglass sand desk");
    expect(requetesDe("robinet qui fuit goutte à goutte dans une cuisine", "c'est de trouver la fuite").requeteEn).toMatch(/^leaking faucet/);
    // Les mots dits ne servent que si la scène ne dit rien au lexique ni à la traduction.
    expect(requetesLitterales("zorglub mirifique", "je signe le contrat")[0]).toMatch(/signing contract/);
  });

  it("passe 3 : scènes de la vidéo 3 qui étaient mal cherchées (« chart », « manager » seuls, clavier pour une fuite)", () => {
    expect(requetesLitterales("consultante qui note la première étape sur un tableau blanc")[0]).toMatch(/^writing on whiteboard/);
    expect(requetesLitterales("consultant en rendez-vous one-to-one avec un dirigeant")[0]).toMatch(/^one-on-one meeting/);
    expect(requetesLitterales("équipes de salariés qui quittent le bureau l'après-midi")[0]).toMatch(/^employees leaving office/);
    expect(requetesLitterales("consultant qui fait un audit complet sur ordinateur")[0]).toMatch(/^analyzing data laptop consultant/);
    expect(requetesLitterales("dirigeant qui lit ce que l'IA rapporte sur son ordinateur")[0]).toMatch(/^reading laptop screen/);
    expect(requetesLitterales("formateur qui forme une équipe à l'IA en salle de réunion")[0]).toMatch(/^corporate training/);
    expect(requetesLitterales("dirigeant qui travaille seul au bureau chaque jour")[0]).toMatch(/^working alone/);
    expect(requetesLitterales("dirigeant qui finit ses journées tard au bureau")[0]).toMatch(/^working late/);
    for (const r of ["consultante qui note la première étape sur un tableau blanc", "consultant en rendez-vous one-to-one avec un dirigeant"])
      for (const q of requetesLitterales(r)) expect(q.split(" ").length).toBeLessThanOrEqual(6);
  });

  it("passe 3 : arguments ffmpeg — profil recadré 4:5 à 25 i/s, planche de 3 images", () => {
    const prof = argumentsProfil("s.mp4", 25, 1920, 1080);
    expect(prof.join(" ")).toMatch(/fps=25,crop=864:1080,scale=180:226,format=gray/);
    const pl = argumentsPlanche("e.mp4", 3, "c.jpg");
    expect(pl.filter((x) => x === "-i")).toHaveLength(3);
    expect(pl.join(" ")).toMatch(/hstack=inputs=3/);
  });

  it("passe 2 : une vidéo paysage n'est gardée que si son cadre 4:5 garde 720 px (1920×1080 oui, 1280×720 non)", () => {
    expect(formatMiniVideo({ largeur: 1280, hauteur: 720 })?.coteCourt).toBeLessThan(COTE_COURT_MIN_VIDEO);
    expect(formatMiniVideo({ largeur: 1920, hauteur: 1080 })?.coteCourt).toBeGreaterThanOrEqual(COTE_COURT_MIN_VIDEO);
    expect(formatMiniVideo({ largeur: 720, hauteur: 1280 })?.coteCourt).toBe(720);
  });

  it("passe 2 : un agenda se montre en train d'être rempli (des mains qui écrivent), pas posé seul", () => {
    expect(requetesLitterales("agenda ouvert sur un bureau avec un rendez-vous noté")[0]).toMatch(/^writing in planner/);
  });
});

describe("passe 3 : banques Pexels + Pixabay en direct, page par page", () => {
  const CLE = "cle-secrete-0123456789";
  function faux() {
    const urls: string[] = [];
    const recuperer: Recuperer = async (url, init) => {
      urls.push(url);
      if (url.includes("pexels")) {
        expect(init?.headers?.Authorization).toBe(CLE);
        const portrait = url.includes("orientation=portrait");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            videos: [
              { id: portrait ? 1 : 2, url: `https://www.pexels.com/video/man-fixing-a-sink-${portrait ? 1 : 2}/`, duration: 9, user: { name: "A" }, video_files: [{ link: "https://v.invalid/a-4k.mp4", width: 3840, height: 2160 }, { link: "https://v.invalid/a-hd.mp4", width: 1920, height: 1080 }, { link: "https://v.invalid/a-sd.mp4", width: 1280, height: 720 }] },
            ],
          }),
        };
      }
      if (url.includes("&page=3")) return { ok: false, status: 400, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ hits: [{ id: 7, pageURL: "https://pixabay.com/videos/7", tags: "plumber, sink", duration: 12, user: "B", videos: { large: { url: "https://v.invalid/p-l.mp4", width: 1920, height: 1080 }, medium: { url: "https://v.invalid/p-m.mp4", width: 1280, height: 720 } } }] }) };
    };
    return { urls, recuperer };
  }

  it("Pexels : verticales puis toutes orientations, version la plus petite qui garde 720 px une fois recadrée 4:5", async () => {
    const { urls, recuperer } = faux();
    const r = await videosPexels(CLE, "plumber fixing leak", 2, recuperer);
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.includes("page=2"))).toBe(true);
    expect(r.map((c) => c.cle)).toEqual(["https://v.invalid/a-hd.mp4", "https://v.invalid/a-hd.mp4"]);
    expect(r[0]).toMatchObject({ source: "pexels", genre: "video", description: "man fixing a sink", licence: { usageCommercial: true, nom: "Pexels License" } });
  });

  it("Pixabay : page demandée, au-delà de la dernière page = liste vide (pas une panne) ; la clé n'apparaît jamais dans un candidat", async () => {
    const { recuperer } = faux();
    const p1 = await videosPixabay(CLE, "plumber", 1, recuperer);
    expect(p1[0]).toMatchObject({ source: "pixabay", id: "7", cle: "https://v.invalid/p-l.mp4", licence: { nom: "Pixabay Content License" } });
    expect(await videosPixabay(CLE, "plumber", 3, recuperer)).toEqual([]);
    expect(JSON.stringify(p1)).not.toContain(CLE);
    expect(await videosPixabay(undefined, "plumber", 1, recuperer)).toEqual([]);
  });

  it("adaptateur du studio : `chercherVideos` prioritaire et paginé ; le fournisseur (une page) n'est lu qu'en page 1", async () => {
    const pages: number[] = [];
    let fournisseur = 0;
    const a = adaptateurStudio({
      chercherVideos: async (_s, _q, page) => (pages.push(page), []),
      illustration: { chercher: async () => (fournisseur++, []) },
    });
    await a.chercher({ source: "pexels", genre: "video", recherche: "x", motsFr: [], requeteEn: "plumber", dureeMinSec: 2, page: 3 });
    expect(pages).toEqual([3]);
    const b = adaptateurStudio({ illustration: { chercher: async () => (fournisseur++, []) } });
    await b.chercher({ source: "pexels", genre: "video", recherche: "x", motsFr: [], requeteEn: "plumber", dureeMinSec: 2, page: 2 });
    expect(fournisseur).toBe(0);
  });
});

describe("passe 3 : chemin de production (adaptateurStudio branché dans le moteur, format toujours fermé)", () => {
  const plan = { fenetres: [{ debut: 1, fin: 3, media: "fenetre-1", recherche: "robinet qui fuit" } as FenetrePlan] };
  const video: CandidatImage = { source: "pexels", id: "9", genre: "video", cle: "https://v.invalid/9.mp4", largeur: 1080, hauteur: 1920, dureeSec: 10, description: "leaking faucet" };

  it("fenetresSansVie : photo ou vidéo déclarée sans fichier vidéo = sans vie ; capture et .mp4 = vivantes", () => {
    expect(fenetresSansVie([
      { debut: 0, fin: 1, media: "images/a.jpg", recherche: "x" },
      { debut: 2, fin: 3, media: "images/b.jpg", recherche: "x", video: true },
      { debut: 4, fin: 5, media: "videos/c.mp4", recherche: "x", video: true },
      { debut: 6, fin: 7, media: "captures/d.png", recherche: "x", capture: true },
    ])).toEqual([0, 1]);
  });

  it("approvisionnerFenetresStudio passe par adaptateurStudio : recherche paginée, préparation, contrôle, plan sans photo", async () => {
    const preparation: OutilsPreparation = {
      async executer() {
        throw new Error("non utilisé");
      },
      async telecharger() {},
      async dossierTravail(n) {
        return n;
      },
      async taille() {
        return 1;
      },
      async deposer(_f, cle) {
        return cle;
      },
    };
    const r = await approvisionnerFenetresStudio(plan, {
      chercherVideos: async (s, _q, page) => (s === "pexels" && page === 1 ? [video] : []),
      preparation,
      verifierMiniVideo: async () => lireVerdictMiniVideo('{"verdict":"littéral","raison":"robinet qui goutte"}'),
    }).catch((e: Error) => e);
    // La préparation doublée échoue (ffmpeg absent) : le candidat est refusé, la fenêtre supprimée — jamais une photo.
    expect(r).not.toBeInstanceOf(Error);
    if (r instanceof Error) return;
    expect(r.supprimees).toEqual([0]);
    expect(fenetresSansVie(r.plan.fenetres)).toEqual([]);
  });

  it("la garde finale refuse un plan qui garderait une photo (adaptateur qui recopie une vidéo… en .jpg)", async () => {
    await expect(
      approvisionnerFenetresStudio(plan, {
        chercherVideos: async () => [{ ...video, cle: "bibliotheque/arret-sur-image.jpg" }],
      }),
    ).rejects.toThrow(/sans mini-vidéo/);
  });

  it("le moteur appelle l'étape images (etapeImagesStudio) et la rend réessayable si elle échoue ; le format reste fermé", async () => {
    const ecrits: unknown[] = [];
    const etape = etapeImagesStudio<{ id: string }>({
      lirePlan: async () => plan,
      ecrirePlan: async (_c, res) => void ecrits.push(res.plan),
      options: () => ({ chercherVideos: async () => [{ ...video, cle: "videos/fenetre-1.mp4" }] }),
    });
    await etape({ id: "x" });
    expect(ecrits).toEqual([{ fenetres: [expect.objectContaining({ media: "videos/fenetre-1.mp4", video: true })] }]);

    const appels: string[] = [];
    const moteur = creerMoteurMontageFacecamAnimee({ images: async () => void appels.push("images") });
    expect(moteur.refusAuLancement?.({} as never)).toMatchObject({ code: "FACECAM_ANIMEE_EN_CHANTIER" });
    const enPanne = creerMoteurMontageFacecamAnimee({
      images: async () => {
        throw new Error("Fenêtres sans mini-vidéo");
      },
    });
    const commande = { videoId: "v", ratios: ["9:16"], briques: {}, distribution: [], dureeCibleSec: 30 } as never;
    const t0 = await enPanne.lancer(commande, { travailId: "t", versionId: "1", titre: "essai", maintenant: 0 } as never);
    const { travail } = await enPanne.avancer(t0, commande, 10 ** 9);
    const images = travail.etapes.find((e) => e.cle === "images")!;
    expect(images.statut).toBe("echec");
    expect(images.erreur).toMatchObject({ code: "FACECAM_ANIMEE_IMAGES", reessayable: true });
    const t1 = await moteur.lancer(commande, { travailId: "t", versionId: "1", titre: "essai", maintenant: 0 } as never);
    await moteur.avancer(t1, commande, 10 ** 9);
    expect(appels).toEqual(["images"]);
  });
});

describe("passe 3 : bruitages d'une fenêtre supprimée", () => {
  it("retire le whoosh d'entrée, de sortie et le son de l'étiquette, garde ceux des éléments restants", () => {
    const supprimee = { debut: 36.3, fin: 39.3, media: "images/f6.jpg", recherche: "x", etiquette: { texte: "Trouver la fuite", a: 38.32 } } as unknown as FenetrePlan;
    const gardee = { debut: 39.5, fin: 42.3, media: "videos/f7.mp4", recherche: "y", video: true } as unknown as FenetrePlan;
    const sons = [[36.28, "whoosh-in", 0.25], [38.32, "drop_004", 0.04], [39.18, "whoosh-out", 0.18], [39.48, "whoosh-in", 0.25], [37, "pop", 0.1]];
    const restants = sonsSansFenetresSupprimees(sons, [supprimee], { fenetres: [supprimee, gardee], cartes: [{ debut: 37 }] });
    expect(restants).toEqual([[39.48, "whoosh-in", 0.25], [37, "pop", 0.1]]);
  });
});
