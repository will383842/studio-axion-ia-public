/**
 * Lot R6 « Calage et “je lis” réels » — partie SERVICE et ÉCRAN (plan « outils réels » du 03/10).
 *
 * Les vidéos « je lis » (Will filme, aucune voix ni aucun double à payer) peuvent être montées pour de vrai DÈS
 * MAINTENANT, sans attendre le double (lot R8) : interrupteur `moteur.<format>.jeLis` dans la carte Montage. Il n'agit
 * que si le montage ET le stockage sont reliés (sinon : simulation, et l'écran dit pourquoi). Les vidéos du double
 * restent sur `moteur.<format>` (inchangé). Aucun appel réseau : seules les commandes sont construites.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { variablesDuCatalogue } from "@/fournisseurs/catalogue";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/reglages" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.setConfig({ testTimeout: 90_000 });

const MDP = "essai-r6-je-lis";
const environnementDepart = { ...process.env };

/** Serveur où le montage (studio-rendu) et le stockage (R2) sont reliés. Valeurs d'essai, jamais affichées. */
const RELIE = {
  STUDIO_RENDU_URL: "http://studio-rendu:4100",
  FOURNISSEUR_MONTAGE: "studio-rendu",
  R2_ACCOUNT_ID: "compte-SECRETR6",
  R2_ACCESS_KEY_ID: "acces-SECRETR6",
  R2_SECRET_ACCESS_KEY: "secret-SECRETR6",
  R2_BUCKET: "seau-SECRETR6",
  FOURNISSEUR_STOCKAGE: "r2",
};

/** Recharge le registre (lu au chargement) avec ces réglages du serveur, des données neuves et une session ouverte. */
async function charger(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const n of Object.keys(process.env)) if (n.startsWith("FOURNISSEUR_") || n.startsWith("MOTEUR_")) delete process.env[n];
  for (const n of variablesDuCatalogue()) delete process.env[n];
  Object.assign(process.env, env);
  const memoire = await import("@/donnees/memoire");
  memoire.reinitialiserDepots();
  reinitialiserRequete();
  const auth = await import("@/services/auth");
  await auth.seConnecter(MDP, false);
  const bg = await import("@/services/boucle-generation");
  bg.suspendreBoucleGeneration(true);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await memoire.depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await memoire.depots().preuves.enregistrer(p);
  return {
    depots: memoire.depots,
    bg,
    tournage: await import("@/services/tournage"),
    fabrication: await import("@/services/fabrication"),
    commun: await import("@/services/_commun"),
    reglages: await import("@/services/reglages"),
    ecran: await import("@/components/reglages/Connexions"),
    moteurs: await import("@/moteurs"),
  };
}
type Charge = Awaited<ReturnType<typeof charger>>;

/** Une version « je lis » validée, avec une prise de toute la version rangée par la séance de tournage. */
async function videoJeLis(r: Charge): Promise<string> {
  const s = SUJETS_BANC[0];
  const g = await r.bg.lancerGeneration({ idee: s.idee, reseaux: ["tiktok"], formatId: "avocat", pilier: s.pilier.id, mode: "teleprompteur" });
  if (!g.ok) throw new Error("lancement");
  await r.bg.tourBoucleGeneration();
  const m = await r.depots().scriptsMaitres.obtenir(g.scriptMaitreId);
  if (m?.exception && !m.exception.valideeParWill) await r.bg.validerException(g.scriptMaitreId, "c-est-juste");
  const ids = (await r.depots().variantes.lister((v) => v.scriptMaitreId === g.scriptMaitreId)).map((v) => v.id);
  await r.bg.validerVariantes(ids);
  const [v] = await r.depots().variantes.lister((x) => x.scriptMaitreId === g.scriptMaitreId);
  const t = new Date().toISOString();
  await r.depots().fichiers.enregistrer({ id: "f-prise-r6", cleStockage: "studio/prod/rushs/f-prise-r6.mp4", nom: "f-prise-r6.mp4", mime: "video/mp4", taille: 2_000_000, dureeSec: 24, origine: "envoi", statut: "pret", creeLe: t, modifieLe: t } as never);
  const seance = await r.tournage.creerSeance([v.id]);
  await r.tournage.enregistrerPrise({ seanceId: seance.id, varianteId: v.id, fichierId: "f-prise-r6", dureeSec: 24 });
  return (await r.depots().variantes.obtenir(v.id))!.videoId!;
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

afterAll(() => {
  process.env = { ...environnementDepart };
  vi.resetModules();
});

/* ------------------------------------------------------------------ */
describe("R6 — vidéos « je lis » montées pour de vrai (moteur.<format>.jeLis)", () => {
  it("interrupteur allumé, montage et stockage reliés : la vidéo « je lis » part sur le vrai montage ; le double reste en simulation", async () => {
    const r = await charger(RELIE);
    const videoId = await videoJeLis(r);
    expect((await r.fabrication.construireCommande(videoId)).moteurId).toBe("simulation");
    await r.reglages.definirJeLisReel("avocat", true);
    const c = await r.fabrication.construireCommande(videoId);
    expect(c.prises).toHaveLength(1);
    expect(c.moteurId).toBe("montage-avocat");
    // Une vidéo du double (sans prise) n'est pas concernée : `moteur.avocat` décide, inchangé.
    expect((await r.fabrication.construireCommande("v-03")).moteurId).toBe("simulation");
    expect(r.moteurs.moteurPrisesFilmees("avocat")).toBe("montage-avocat");
    // Journal : le nom du type de vidéo, jamais l'identifiant technique.
    const journal = (await r.depots().evenements.lister()).map((e) => e.message);
    expect(journal).toContain("Vidéos « je lis » (Type avocat) : montage réel");
    await r.reglages.definirJeLisReel("avocat", false);
    expect((await r.depots().evenements.lister()).map((e) => e.message)).toContain("Vidéos « je lis » (Type avocat) : coupé");
    expect(r.moteurs.moteurPrisesFilmees("format-inconnu")).toBeNull();
  });

  it("montage ou stockage non relié : l'interrupteur n'agit pas (simulation), la carte dit ce qui manque", async () => {
    let r = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100", FOURNISSEUR_MONTAGE: "studio-rendu" });
    let videoId = await videoJeLis(r);
    await r.commun.ecrireParametre("moteur.avocat.jeLis", true);
    expect((await r.fabrication.construireCommande(videoId)).moteurId).toBe("simulation");
    const montage = (await r.reglages.listerConnexions()).find((x) => x.type === "montage")!;
    expect(montage.jeLis).toEqual([{ formatId: "avocat", nom: "Type avocat", allume: true, possible: false, manque: "le stockage des fichiers" }]);
    expect(montage.montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual([]);

    r = await charger();
    videoId = await videoJeLis(r);
    await r.commun.ecrireParametre("moteur.avocat.jeLis", true);
    expect((await r.fabrication.construireCommande(videoId)).moteurId).toBe("simulation");
  });

  it("carte Montage : « Type avocat · je lis » dans « Montage réel pour » ; interrupteur et aucune valeur de réglage à l'écran", async () => {
    const r = await charger(RELIE);
    let montage = (await r.reglages.listerConnexions()).find((x) => x.type === "montage")!;
    expect(montage.jeLis).toEqual([{ formatId: "avocat", nom: "Type avocat", allume: false, possible: true }]);
    expect(montage.montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual([]);
    await r.reglages.definirJeLisReel("avocat", true);
    montage = (await r.reglages.listerConnexions()).find((x) => x.type === "montage")!;
    expect(montage.montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Type avocat · je lis"]);
    // Le double réel ensuite (R8) : le type entier est monté, la ligne « je lis » n'a plus lieu d'être.
    await r.commun.ecrireParametre("moteur.avocat", "montage-avocat");
    montage = (await r.reglages.listerConnexions()).find((x) => x.type === "montage")!;
    expect(montage.montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Type avocat"]);

    const html = renderToStaticMarkup(createElement(r.ecran.ChoixService, { connexion: montage, valeur: "studio-rendu", onChange: () => undefined }));
    expect(html).toContain("Vidéos « je lis » montées pour de vrai");
    expect(html).toContain('data-je-lis="avocat"');
    expect(html).toContain("Type avocat");
    expect(html).not.toMatch(/SECRETR6|studio-rendu:4100/);
    // Aucune autre carte ne porte l'interrupteur.
    const voix = (await r.reglages.listerConnexions()).find((x) => x.type === "voix")!;
    expect(voix.jeLis).toBeUndefined();
  });

  it("interrupteur sans effet possible : grisé, avec la raison ; sans calage relié, les sous-titres sont annoncés approximatifs", async () => {
    const r = await charger();
    const ecran = r.ecran;
    const rendre = (p: Parameters<typeof ecran.BlocJeLis>[0]) => renderToStaticMarkup(createElement(ecran.BlocJeLis, p)).replace(/&#x27;/g, "'");
    const html = rendre({ formats: [{ formatId: "avocat", nom: "Type avocat", allume: false, possible: false, manque: "le montage" }], calageRelie: false });
    expect(html).toContain("Il faut d'abord relier le montage");
    expect(html).toMatch(/disabled=""/);
    const libre = rendre({ formats: [{ formatId: "avocat", nom: "Type avocat", allume: false, possible: true }], calageRelie: true });
    expect(libre).toContain("Montées par le studio. Gratuit.");
    expect(libre).not.toMatch(/serveur/);
    const relie = rendre({ formats: [{ formatId: "avocat", nom: "Type avocat", allume: true, possible: true }], calageRelie: false });
    expect(relie).toContain("Sous-titres approximatifs tant que le calage des sous-titres n'est pas relié");
    const cale = rendre({ formats: [{ formatId: "avocat", nom: "Type avocat", allume: true, possible: true }], calageRelie: true });
    expect(cale).not.toContain("approximatifs");
  });

  it("refus : format inconnu ou sans montage des prises ; rien n'est enregistré", async () => {
    const r = await charger(RELIE);
    await expect(r.reglages.definirJeLisReel("format-inconnu", true)).rejects.toMatchObject({ code: "FORMAT_INCONNU" });
    expect(await r.commun.lireParametre("moteur.format-inconnu.jeLis", null)).toBeNull();
    await r.reglages.definirJeLisReel("avocat", false);
    expect(await r.commun.lireParametre("moteur.avocat.jeLis", null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
describe("R6 — une seule règle : la carte Montage et le lancement disent toujours la même chose", () => {
  const CAS: { nom: string; env: Record<string, string>; allume: boolean; moteurAvocat?: string }[] = [
    { nom: "tout relié, allumé", env: RELIE, allume: true },
    { nom: "tout relié, éteint", env: RELIE, allume: false },
    { nom: "stockage absent, allumé", env: { STUDIO_RENDU_URL: "http://studio-rendu:4100", FOURNISSEUR_MONTAGE: "studio-rendu" }, allume: true },
    { nom: "rien de relié, allumé", env: {}, allume: true },
    { nom: "moteur réel déjà choisi, allumé", env: RELIE, allume: true, moteurAvocat: "montage-avocat" },
    { nom: "moteur réel déjà choisi, éteint", env: RELIE, allume: false, moteurAvocat: "montage-avocat" },
  ];
  for (const cas of CAS) {
    it(cas.nom, async () => {
      const r = await charger(cas.env);
      const videoId = await videoJeLis(r);
      await r.commun.ecrireParametre("moteur.avocat.jeLis", cas.allume);
      if (cas.moteurAvocat) await r.commun.ecrireParametre("moteur.avocat", cas.moteurAvocat);
      const montage = (await r.reglages.listerConnexions()).find((x) => x.type === "montage")!;
      const c = await r.fabrication.construireCommande(videoId);
      const decision = await r.reglages.decisionJeLis("avocat");
      // Le lancement fige exactement le moteur de la décision ; la carte dit « · je lis » exactement quand elle agit.
      expect(c.moteurId).toBe(decision.moteurId);
      expect((montage.montageReelPour ?? []).includes("Type avocat · je lis")).toBe(decision.effectif);
      if (cas.moteurAvocat) {
        // Moteur réel déjà choisi : il décide (interrupteur sans objet), et la carte le dit sans « je lis ».
        expect(c.moteurId).toBe(cas.moteurAvocat);
        expect(decision.effectif).toBe(false);
        expect(montage.montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Type avocat"]);
      } else {
        expect(c.moteurId).toBe(decision.effectif ? "montage-avocat" : "simulation");
      }
    });
  }
});

describe("R6 — sécurité et serveur", () => {
  it("sans session : definirJeLisReel est refusé, rien n'est enregistré", async () => {
    const r = await charger(RELIE);
    reinitialiserRequete();
    await expect(r.reglages.definirJeLisReel("avocat", true)).rejects.toThrow(/REDIRECT \/connexion/);
    expect(await r.commun.lireParametre("moteur.avocat.jeLis", null)).toBeNull();
  });

  it("mettre-a-jour.sh : calage seulement pour une vraie adresse et avec la clé ; adresse retirée → conteneur arrêté", () => {
    const script = readFileSync(new URL("../deploiement/mettre-a-jour.sh", import.meta.url), "utf8");
    // Correcteur final B : les deux contrôles vivent dans commun.sh (guillemets acceptés) ; comportement vérifié en
    // lançant le script (tests/final-b-mise-a-jour-sante.test.ts).
    const commun = readFileSync(new URL("../deploiement/commun.sh", import.meta.url), "utf8");
    expect(script).toMatch(/if calage_actif; then/);
    expect(script).toMatch(/variable_renseignee STUDIO_RENDU_CLE/);
    expect(commun).toContain(`grep -Eq "^STUDIO_ALIGNEUR_URL=[\\"']?https?://"`);
    expect(script).toMatch(/--profile calage stop studio-aligneur/);
    expect(script).not.toMatch(/\brm\b|down/);
    const principal = readFileSync(new URL("../studio-aligneur/aligneur/__main__.py", import.meta.url), "utf8");
    expect(principal).toMatch(/cle = cle_obligatoire\(dict\(os.environ\)\)/);
  });

  it("écran : aucun mot technique (« serveur », « simulation ») dans l'interrupteur « je lis »", () => {
    const source = readFileSync(new URL("../src/components/reglages/Connexions.tsx", import.meta.url), "utf8");
    const bloc = source.slice(source.indexOf("function detailJeLis"));
    expect(bloc).toContain("je lis : coupé");
    expect(bloc).not.toMatch(/sur le serveur|je lis : simulation/);
  });
});
