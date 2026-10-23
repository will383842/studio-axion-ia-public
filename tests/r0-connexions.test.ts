/**
 * Lot R0 « Connexions vraies » (plan « outils réels » du 03/10, constats C1 et C2), sans aucun appel réseau ni dépense.
 *
 * C1 : l'écran fabriquait l'identifiant du service depuis son libellé (« Remotion » → « remotion », « WhisperX
 * (studio-aligneur) » → « whisperx ») : choisir « le vrai » enregistrait un identifiant que le registre ne connaît pas,
 * la carte restait « À relier » pour toujours et la simulation tournait en silence. Partout, un faux choix « Plus tard ».
 * C2 : la carte Montage ne disait pas ce qui serait VRAIMENT monté (il faut le serveur de rendu ET `moteur.<format>`).
 *
 * Les tests marqués ROUGE échouent sur 03d297b (preuve : docs/OUTILS-REELS-R0.md).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CATALOGUE, reglagesManquants, variablesDuCatalogue } from "@/fournisseurs/catalogue";
import type { OptionConnexion, TypeFournisseur } from "@/fournisseurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/reglages" }));
// Le premier chargement du registre (et de ses services) est lent sous Windows.
vi.setConfig({ testTimeout: 60_000 });
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const MDP = "essai-r0-connexions";
const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

/** Valeurs d'essai : chacune porte « SECRETR0 », qui ne doit JAMAIS ressortir. */
const SECRETS: Record<string, string> = {
  ANTHROPIC_API_KEY: "sk-ant-SECRETR0-aaaa1111",
  HEYGEN_API_KEY: "hg-SECRETR0-bbbb2222",
  STUDIO_RENDU_CLE: "rendu-SECRETR0-cccc3333",
  R2_ACCOUNT_ID: "compte-SECRETR0",
  R2_ACCESS_KEY_ID: "acces-SECRETR0",
  R2_SECRET_ACCESS_KEY: "secret-SECRETR0-dddd4444",
  R2_BUCKET: "seau-SECRETR0",
  PEXELS_API_KEY: "pexels-SECRETR0-eeee5555",
};

const environnementDepart = { ...process.env };

/** Les réglages qui influent sur le registre : effacés avant chaque chargement (le poste de dev peut en avoir). */
function nettoyerEnv() {
  for (const n of Object.keys(process.env)) if (n.startsWith("FOURNISSEUR_") || n.startsWith("MOTEUR_")) delete process.env[n];
  for (const n of [...variablesDuCatalogue(), ...Object.keys(SECRETS)]) delete process.env[n];
}

/** Recharge le registre (lu au chargement) avec ces réglages du serveur, des données neuves et une session ouverte. */
async function charger(env: Record<string, string> = {}) {
  vi.resetModules();
  nettoyerEnv();
  Object.assign(process.env, env);
  const fournisseurs = await import("@/fournisseurs");
  const reglages = await import("@/services/reglages");
  const complements = await import("@/services/C-videos-publication-complements");
  const commun = await import("@/services/_commun");
  const auth = await import("@/services/auth");
  (await import("@/donnees/memoire")).reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const ecran = await import("@/components/reglages/Connexions");
  const connexion = async (type: TypeFournisseur) => {
    const c = (await reglages.listerConnexions()).find((x) => x.type === type);
    if (!c) throw new Error(`connexion ${type} absente`);
    return c;
  };
  return { fournisseurs, reglages, complements, commun, ecran, connexion };
}

const vue = (c: { type: TypeFournisseur; etat: "simulation" | "relie" | "a-relier"; options: OptionConnexion[]; montageReelPour?: string[] }) => ({
  type: c.type,
  etat: c.etat,
  options: c.options,
  montageReelPour: c.montageReelPour,
});

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

afterAll(() => {
  process.env = { ...environnementDepart };
  vi.resetModules();
});

/* ------------------------------------------------------------------ */
describe("R0 · ROUGE — Montage → studio-rendu → Relié", () => {
  it("avec STUDIO_RENDU_URL, l'écran propose « studio-rendu » sous son identifiant exact, et le choisir donne « Relié »", async () => {
    const { ecran, complements, connexion } = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100" });
    const avant = await connexion("montage");
    const option = avant.options.find((o) => o.id === "studio-rendu");
    expect(option).toMatchObject({ id: "studio-rendu", mode: "reel", inscrit: true, pret: true, manque: [] });

    const html = renderToStaticMarkup(createElement(ecran.ChoixService, { connexion: vue(avant), valeur: "studio-rendu", onChange: () => undefined }));
    expect(html).toContain('data-option="studio-rendu"');
    expect(html).not.toContain('data-option="remotion"');
    expect(html).toContain("Relié");

    await complements.definirFournisseur("montage", "studio-rendu");
    const apres = await connexion("montage");
    expect(apres.etat).toBe("relie");
    expect(ecran.resumeConnexion(apres)).toBe("Montage sur le serveur du studio");
  });
});

describe("R0 · ROUGE — Calage → studio-aligneur → Relié", () => {
  it("avec STUDIO_ALIGNEUR_URL, l'écran propose « studio-aligneur » (jamais « whisperx »), et le choisir donne « Relié »", async () => {
    const { ecran, complements, connexion } = await charger({ STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" });
    const avant = await connexion("alignement");
    expect(avant.options.find((o) => o.id === "studio-aligneur")).toMatchObject({ inscrit: true, manque: [] });

    const html = renderToStaticMarkup(createElement(ecran.ChoixService, { connexion: vue(avant), valeur: "simulation", onChange: () => undefined }));
    expect(html).toContain('data-option="studio-aligneur"');
    expect(html).not.toContain('data-option="whisperx"');

    await complements.definirFournisseur("alignement", "studio-aligneur");
    expect((await connexion("alignement")).etat).toBe("relie");
  });
});

/* ------------------------------------------------------------------ */
describe("R0 · ROUGE — un identifiant inconnu pour ce type est refusé", () => {
  it("les anciens identifiants fabriqués (« remotion », « whisperx ») et un service d'un autre type sont refusés, rien n'est enregistré", async () => {
    const { complements, commun } = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100", STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" });
    await expect(complements.definirFournisseur("montage", "remotion")).rejects.toMatchObject({ code: "VALEUR_INVALIDE" });
    await expect(complements.definirFournisseur("alignement", "whisperx")).rejects.toMatchObject({ code: "VALEUR_INVALIDE" });
    await expect(complements.definirFournisseur("montage", "claude")).rejects.toMatchObject({ code: "VALEUR_INVALIDE" });
    await expect(complements.definirFournisseur("publication", "plus-tard")).rejects.toMatchObject({ code: "VALEUR_INVALIDE" });
    // Un nom hérité de tout objet JavaScript n'est pas un service.
    await expect(complements.definirFournisseur("script", "constructor")).rejects.toMatchObject({ code: "VALEUR_INVALIDE" });
    expect(await commun.lireParametre("fournisseur.montage", null)).toBeNull();
    expect(await commun.lireParametre("fournisseur.alignement", null)).toBeNull();
  });

  it("la simulation, un service inscrit et un service prévu mais pas encore relié restent acceptés", async () => {
    const { complements, commun, connexion, ecran } = await charger();
    await complements.definirFournisseur("publication", "buffer"); // prévu (R1), sans clé ici : « À relier »
    expect(await commun.lireParametre("fournisseur.publication", null)).toBe("buffer");
    const c = await connexion("publication");
    expect(c.etat).toBe("a-relier");
    expect(c.options.find((o) => o.choisi)?.manque).toEqual(["BUFFER_API_KEY"]);
    expect(ecran.resumeConnexion(c)).toBe("À relier : un réglage manque sur le serveur");
    await complements.definirFournisseur("publication", "simulation");
    expect(await commun.lireParametre("fournisseur.publication", null)).toBeNull();
  });

  it("un ancien choix déjà en base (« remotion ») est signalé, sans faire semblant d'être relié", async () => {
    const { commun, connexion, ecran } = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100" });
    await commun.ecrireParametre("fournisseur.montage", "remotion");
    const c = await connexion("montage");
    expect(c.etat).toBe("a-relier");
    expect(c.options.some((o) => o.choisi)).toBe(false);
    expect(ecran.resumeConnexion(c)).toBe("Ce choix n'existe plus : choisissez à nouveau");
  });
});

/* ------------------------------------------------------------------ */
describe("R0 — Claude se choisit sans rien dépenser", () => {
  it("garde : avec ANTHROPIC_API_KEY, choisir « claude » puis lister les connexions ne fait aucun appel réseau", async () => {
    const appels = vi.fn(async () => new Response("{}"));
    const fetchAvant = globalThis.fetch;
    globalThis.fetch = appels as unknown as typeof fetch;
    try {
      const { complements, connexion } = await charger({ ANTHROPIC_API_KEY: SECRETS.ANTHROPIC_API_KEY });
      expect((await connexion("script")).options.find((o) => o.id === "claude")).toMatchObject({ inscrit: true, cout: "1,50 $ au plus par sujet" });
      await complements.definirFournisseur("script", "claude");
      expect((await connexion("script")).etat).toBe("relie");
      expect(appels).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = fetchAvant;
    }
  });

  it("choix par le serveur : FOURNISSEUR_SCRIPT=claude + clé → option « claude » choisie, carte « Relié · Claude »", async () => {
    const { connexion, ecran } = await charger({ ANTHROPIC_API_KEY: SECRETS.ANTHROPIC_API_KEY, FOURNISSEUR_SCRIPT: "claude" });
    const c = await connexion("script");
    expect(c.source).toBe("environnement");
    expect(c.etat).toBe("relie");
    expect(c.options.filter((o) => o.choisi).map((o) => o.id)).toEqual(["claude"]);
    expect(ecran.resumeConnexion(c)).toBe("Claude");
    expect(ecran.pastilleConnexion(c)).toEqual({ libelle: "Relié", ton: "sauge" });
  });
});

describe("Contrôle paquet 2, n° 6 — Son et Étalonnage : prêts sur le serveur, pas « Relié » aux vidéos", () => {
  it("Son et mixage, Étalonnage des couleurs reliés → « Prêt sur le serveur du studio », jamais « Relié » ni nom technique", async () => {
    const { ecran, connexion } = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100", FOURNISSEUR_SON: "studio-rendu", FOURNISSEUR_ETALONNAGE: "studio-rendu" });
    for (const type of ["son", "etalonnage"] as const) {
      const c = await connexion(type);
      expect(c.etat).toBe("relie");
      expect(ecran.resumeConnexion(c)).toBe("Prêt sur le serveur du studio");
      expect(ecran.pastilleConnexion(c).libelle).not.toBe("Relié");
      expect(ecran.resumeConnexion(c)).not.toMatch(/studio-rendu/);
    }
    // Le montage, lui, sert vraiment aux vidéos : il reste « Relié ».
    expect(ecran.pastilleConnexion({ type: "montage", etat: "relie", options: [] })).toEqual({ libelle: "Relié", ton: "sauge" });
  });
});

/* ------------------------------------------------------------------ */
describe("R0 — aucune valeur de clé ne sort, aucun nom de réglage à l'écran", () => {
  it("ROUGE (point 10) — aucun nom de variable en MAJUSCULES n'est rendu, même quand des réglages manquent", async () => {
    // Chaque type choisi « réel » sans aucun réglage : toutes les cartes sont « À relier », toutes les feuilles listent ce qui manque.
    const choix: Record<string, string> = {};
    for (const [type, liste] of Object.entries(CATALOGUE)) choix[`FOURNISSEUR_${type.replace(/-/g, "_").toUpperCase()}`] = liste[0].id;
    const { reglages, ecran } = await charger(choix);
    const toutes = await reglages.listerConnexions();
    expect(toutes.every((c) => c.etat === "a-relier")).toBe(true);
    const NOM_DE_VARIABLE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
    expect(renderToStaticMarkup(createElement(ecran.Connexions, { connexions: toutes.map(vue) }))).not.toMatch(NOM_DE_VARIABLE);
    for (const c of toutes) {
      const html = renderToStaticMarkup(createElement(ecran.ChoixService, { connexion: vue(c), valeur: "simulation", onChange: () => undefined }));
      expect(html, c.type).not.toMatch(NOM_DE_VARIABLE);
    }
  });

  it("ni la liste des connexions (envoyée au navigateur) ni l'écran ne contiennent une valeur de réglage", async () => {
    const { connexion, reglages, ecran } = await charger({ ...SECRETS, STUDIO_RENDU_URL: "http://studio-rendu:4100", FOURNISSEUR_MONTAGE: "studio-rendu" });
    const toutes = await reglages.listerConnexions();
    const json = JSON.stringify(toutes);
    expect(json).not.toContain("SECRETR0");
    for (const v of Object.values(SECRETS)) expect(json).not.toContain(v.slice(-4));
    for (const c of toutes) {
      const html = renderToStaticMarkup(createElement(ecran.ChoixService, { connexion: vue(c), valeur: "simulation", onChange: () => undefined }));
      expect(html).not.toContain("SECRETR0");
    }
    const liste = renderToStaticMarkup(createElement(ecran.Connexions, { connexions: toutes.map(vue) }));
    expect(liste).not.toContain("SECRETR0");
    expect((await connexion("montage")).etat).toBe("relie");
  });
});

/* ------------------------------------------------------------------ */
describe("R0 — écran à 390 px : vrais choix, états clairs, plus de « Plus tard »", () => {
  it("liste : Relié / À relier (phrase simple, sans nom de réglage) / Essai ; carte Montage « Montage réel pour : — »", async () => {
    const { reglages, ecran } = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100", FOURNISSEUR_MONTAGE: "studio-rendu", FOURNISSEUR_STOCKAGE: "r2" });
    const toutes = (await reglages.listerConnexions()).map(vue);
    const html = renderToStaticMarkup(createElement(ecran.Connexions, { connexions: toutes }));
    expect(html).toContain("Relié");
    expect(html).toContain("À relier : des réglages manquent sur le serveur");
    // Les NOMS restent dans les données (journal, relevé, intégration), jamais à l'écran.
    expect(toutes.find((c) => c.type === "stockage")?.options.find((o) => o.choisi)?.manque).toEqual(["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]);
    expect(html).toContain("Essai");
    // Texte affiché (hors attributs data-*) : « Essai », jamais « Simulation ».
    expect(html).not.toMatch(/>[^<]*simulation/i);
    // Le tableau animé (actif) se monte sur le serveur de rendu : la ligne le dit dès que ce serveur est relié.
    expect(html).toContain("Montage réel pour : Tableau animé");
    expect(html).not.toContain("Plus tard");
    // Lisible à 390 px : chaque ligne se resserre (min-w-0 + truncate), la pastille ne se tasse pas.
    expect(html).toMatch(/class="min-w-0 flex-1"/);
    expect(html).toMatch(/block truncate text-xs/);
  });

  it("feuille : un choix par ligne, pleine largeur, coût et état ; le détail du réglage manquant revient à la ligne", async () => {
    const { connexion, ecran } = await charger();
    const html = renderToStaticMarkup(createElement(ecran.ChoixService, { connexion: vue(await connexion("notification")), valeur: "simulation", onChange: () => undefined }));
    expect(html).toContain('data-option="simulation"');
    expect(html).toContain('data-option="web-push-email"');
    expect(html).toContain("Téléphone et e-mail");
    expect(html).toContain("Gratuit");
    expect(html).toContain("À relier : des réglages manquent sur le serveur");
    expect(html).toMatch(/flex min-h-14 w-full/);
    expect(html).toMatch(/block break-words text-xs/);
    expect(html).not.toContain("Plus tard");
  });

  it("un service dont les réglages sont posés mais dont le code n'est pas livré ne peut pas être choisi", async () => {
    const { ecran } = await charger();
    const option: OptionConnexion = { id: "exemple", nom: "Service à venir", mode: "reel", inscrit: false, pret: true, manque: [], cout: "Gratuit", choisi: false };
    const simulation: OptionConnexion = { id: "simulation", nom: "Essai", mode: "simulation", inscrit: true, pret: true, manque: [], cout: "Aucun envoi, aucun coût", choisi: true };
    const html = renderToStaticMarkup(
      createElement(ecran.ChoixService, { connexion: { type: "son", etat: "simulation", options: [simulation, option] }, valeur: "simulation", onChange: () => undefined }),
    );
    expect(html).toMatch(/data-option="exemple" disabled=""/);
    expect(html).toContain("Pas encore disponible");
  });

  it("le code de l'écran ne fabrique plus d'identifiant depuis un libellé", () => {
    const source = lire("src/components/reglages/Connexions.tsx");
    expect(source).not.toMatch(/idReel|sansAccents|Plus tard/);
  });
});

/* ------------------------------------------------------------------ */
describe("R0 — carte Montage : ce qui sera VRAIMENT monté (C2)", () => {
  it("« — » sans serveur de rendu, même avec `moteur.avocat` ; « — » avec le serveur mais sans moteur réel", async () => {
    let r = await charger();
    await r.commun.ecrireParametre("moteur.avocat", "montage-avocat");
    expect((await r.connexion("montage")).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual([]);
    // Sans serveur de rendu, le tableau animé (actif) n'est pas annoncé non plus.
    expect((await r.connexion("montage")).montageReelPour).toEqual([]);

    r = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100" });
    await r.complements.definirFournisseur("montage", "studio-rendu");
    expect((await r.connexion("montage")).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual([]);
  });

  it("ROUGE (relecture) — serveur de rendu posé + `moteur.avocat`, carte Montage en Simulation : le type avocat EST monté pour de vrai", async () => {
    // Le moteur avocat rend sur le serveur dès que STUDIO_RENDU_URL existe (`renduSimule`), quel que soit le choix de la carte.
    const r = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100" });
    await r.commun.ecrireParametre("moteur.avocat", "montage-avocat");
    const c = await r.connexion("montage");
    expect(c.etat).toBe("simulation");
    expect(c.montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Type avocat"]);
    expect(r.ecran.ligneMontageReel(c.montageReelPour)).toBe("Montage réel pour : Type avocat, Tableau animé, Cas concret MD");
    // Les autres types ne portent pas cette ligne.
    expect((await r.connexion("voix")).montageReelPour).toBeUndefined();
  });

  it("face caméra (format actif) : annoncé monté pour de vrai seulement avec le serveur d'alignement, comme au lancement", async () => {
    // Sans STUDIO_ALIGNEUR_URL, le moteur face caméra refuse le lancement (FACECAM_EN_CHANTIER) : la carte ne le promet pas.
    let r = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100" });
    expect((await r.connexion("montage")).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual([]);
    // Serveur d'alignement posé, chaîne réelle allumée par défaut : le face caméra est monté pour de vrai.
    r = await charger({ STUDIO_RENDU_URL: "http://studio-rendu:4100", STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" });
    expect((await r.connexion("montage")).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Face caméra"]);
    await r.commun.ecrireParametre("moteur.avocat", "montage-avocat");
    expect(r.ecran.ligneMontageReel((await r.connexion("montage")).montageReelPour)).toBe("Montage réel pour : Type avocat, Face caméra, Tableau animé, Cas concret MD");
    // Chaîne réelle coupée en base (`facecam.aligneur.reel` = false) : plus annoncé.
    await r.commun.ecrireParametre("facecam.aligneur.reel", false);
    expect((await r.connexion("montage")).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Type avocat"]);
    // Sans serveur de rendu : « — », même avec le serveur d'alignement.
    r = await charger({ STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" });
    expect((await r.connexion("montage")).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
describe("R0 — catalogue des services prévus (intégration des lots R1 à R8)", () => {
  const ATTENDUS: Record<TypeFournisseur, string[]> = {
    script: ["claude"],
    visage: ["heygen"],
    voix: ["heygen"],
    montage: ["studio-rendu", "remotion-lambda"],
    illustration: ["reel"],
    etalonnage: ["studio-rendu"],
    son: ["studio-rendu"],
    miniature: ["studio-rendu"],
    publication: ["buffer"],
    "texte-reseaux": ["claude"],
    notification: ["web-push-email"],
    stockage: ["r2"],
    alignement: ["studio-aligneur"],
    // Vidéos sur le site (lots S3-S4) : le vrai client est prévu (jamais choisi par défaut) ; seul le site factice fonctionne.
    site: ["http"],
  };

  it("chaque type décrit ses implémentations prévues sous leur identifiant exact", () => {
    for (const [type, ids] of Object.entries(ATTENDUS)) expect(CATALOGUE[type as TypeFournisseur].map((i) => i.id), type).toEqual(ids);
  });

  it("noms des réglages : tous présents dans deploiement/env.exemple", () => {
    const exemple = lire("deploiement/env.exemple");
    for (const n of variablesDuCatalogue()) expect(exemple, n).toMatch(new RegExp(`^#?\\s*${n}=`, "m"));
  });

  it("noms et coûts en mots simples (ni jargon, ni « IA »)", () => {
    for (const liste of Object.values(CATALOGUE)) {
      for (const i of liste) {
        expect(`${i.nom} ${i.cout}`).not.toMatch(/ffmpeg|loudnorm|whisper|aligneur|remotion|cloudflare|\bR2\b|AWS|lambda|\bIA\b|Plus tard/i);
        expect(i.cout.length).toBeGreaterThan(0);
      }
    }
  });

  it("ce qui manque : le plus petit ensemble, les interrupteurs exigés, la présence seulement", () => {
    const notif = CATALOGUE.notification[0];
    expect(reglagesManquants(notif, {})).toEqual(["VAPID_PUBLIQUE", "VAPID_PRIVEE", "VAPID_SUJET"]);
    expect(reglagesManquants(notif, { EMAIL_SECOURS_CLE: "x", EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com" })).toEqual(["EMAIL_SECOURS_DESTINATAIRE"]);
    expect(reglagesManquants(notif, { VAPID_PUBLIQUE: "a", VAPID_PRIVEE: "b", VAPID_SUJET: "mailto:contact@axion-ia.com" })).toEqual([]);
    const visage = CATALOGUE.visage[0];
    expect(reglagesManquants(visage, { HEYGEN_API_KEY: "k" })).toEqual(["FOURNISSEUR_VISAGE"]);
    expect(reglagesManquants(visage, { HEYGEN_API_KEY: "k", FOURNISSEUR_VISAGE: "heygen" })).toEqual([]);
    expect(reglagesManquants(CATALOGUE.illustration[0], { FAL_KEY: "k" })).toEqual([]);
    expect(reglagesManquants(CATALOGUE.publication[0], { BUFFER_API_KEY: "   " })).toEqual(["BUFFER_API_KEY"]);
  });

  it("toute implémentation INSCRITE au registre (tous les réglages posés) est décrite au catalogue", async () => {
    const tout: Record<string, string> = { FOURNISSEUR_VISAGE: "heygen", REMOTION_LAMBDA_ACTIVE: "true", VAPID_SUJET: "mailto:contact@axion-ia.com", STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200", STUDIO_RENDU_URL: "http://studio-rendu:4100" };
    for (const n of variablesDuCatalogue()) tout[n] ??= `essai-${n.toLowerCase()}`;
    const { fournisseurs } = await charger(tout);
    for (const type of fournisseurs.TYPES_FOURNISSEURS) {
      const options = fournisseurs.optionsConnexion(type, null, tout);
      const horsCatalogue = options.filter((o) => o.mode === "reel" && !CATALOGUE[type].some((i) => i.id === o.id));
      expect(horsCatalogue.map((o) => o.id), type).toEqual([]);
      // Avec tous les réglages, plus rien ne manque.
      expect(options.flatMap((o) => o.manque), type).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("R0 · relecture — un choix prêt mais pas encore livré n'est pas « un choix qui n'existe plus »", () => {
  const simulation: OptionConnexion = { id: "simulation", nom: "Essai", mode: "simulation", inscrit: true, pret: true, manque: [], cout: "Aucun envoi, aucun coût", choisi: false };
  const avenir: OptionConnexion = { id: "buffer", nom: "Buffer", mode: "reel", inscrit: false, pret: true, manque: [], cout: "Gratuit", choisi: true };

  it("ROUGE — option choisie, réglages présents, code pas encore inscrit : « Pas encore disponible », pastille neutre", async () => {
    const { ecran } = await charger();
    const c = { etat: "a-relier" as const, options: [simulation, avenir] };
    expect(ecran.resumeConnexion(c)).toBe("Buffer : pas encore disponible, le mode essai reste actif");
    expect(ecran.pastilleConnexion(c)).toEqual({ libelle: "Pas encore disponible", ton: "neutre" });
    // Seul un identifiant que plus aucun choix ne porte est « un choix qui n'existe plus ».
    const inconnu = { etat: "a-relier" as const, options: [simulation, { ...avenir, choisi: false }] };
    expect(ecran.resumeConnexion(inconnu)).toBe("Ce choix n'existe plus : choisissez à nouveau");
  });

  it("service réel : choix d'un service prévu, réglages posés — jamais « n'existe plus » (Buffer avant ou après R1)", async () => {
    const { commun, connexion, ecran } = await charger({ BUFFER_API_KEY: "buffer-essai-r0" });
    await commun.ecrireParametre("fournisseur.publication", "buffer");
    const c = await connexion("publication");
    expect(ecran.resumeConnexion(c)).not.toMatch(/n'existe plus/);
    const option = c.options.find((o) => o.id === "buffer");
    expect(option?.choisi).toBe(true);
    if (option?.inscrit) expect(c.etat).toBe("relie");
    else expect(ecran.pastilleConnexion(c).libelle).toBe("Pas encore disponible");
  });

  it("ROUGE — adresse du calage sans http(s):// : jugée comme `aligneurReel` (réglage à corriger, pas « prêt »)", async () => {
    const calage = CATALOGUE.alignement[0];
    expect(reglagesManquants(calage, { STUDIO_ALIGNEUR_URL: "studio-aligneur:4200" })).toEqual(["STUDIO_ALIGNEUR_URL"]);
    expect(reglagesManquants(calage, { STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" })).toEqual([]);
    const { connexion, ecran } = await charger({ STUDIO_ALIGNEUR_URL: "studio-aligneur:4200", FOURNISSEUR_ALIGNEMENT: "studio-aligneur" });
    const c = await connexion("alignement");
    expect(c.etat).toBe("a-relier");
    expect(c.options.find((o) => o.choisi)?.manque).toEqual(["STUDIO_ALIGNEUR_URL"]);
    expect(ecran.resumeConnexion(c)).toBe("À relier : un réglage manque sur le serveur");
  });

  it("la feuille lit `pret` : option prête non inscrite → non cliquable ; option non prête → « À relier »", async () => {
    const { ecran } = await charger();
    const html = renderToStaticMarkup(
      createElement(ecran.ChoixService, {
        connexion: { type: "publication", etat: "a-relier", options: [simulation, avenir, { ...avenir, id: "autre", nom: "Autre", pret: false, manque: ["AUTRE_CLE"], choisi: false }] },
        valeur: "simulation",
        onChange: () => undefined,
      }),
    );
    expect(html).toMatch(/data-option="buffer" disabled=""/);
    expect(html).toContain("À relier : un réglage manque sur le serveur");
    expect(html).not.toContain("AUTRE_CLE");
  });
});

/* ------------------------------------------------------------------ */
describe("R0 · relecture — un nom hérité de tout objet n'est jamais un service relié", () => {
  it("ROUGE — « constructor » en base ou dans FOURNISSEUR_SCRIPT : simulation résolue, carte « À relier », jamais « Relié »", async () => {
    let r = await charger();
    expect(r.fournisseurs.resoudreFournisseur("script", "constructor").mode).toBe("simulation");
    expect(r.fournisseurs.etatConnexion("script", "constructor")).toBe("a-relier");
    expect(r.fournisseurs.estSimule("script", "toString")).toBe(true);
    r = await charger({ FOURNISSEUR_SCRIPT: "constructor" });
    expect(r.fournisseurs.resoudreFournisseur("script").id).toBe("simulation");
    expect((await r.connexion("script")).etat).toBe("a-relier");
  });
});

/* ------------------------------------------------------------------ */
describe("R0 · finition — titres fixes par service, aucun nom technique rendu", () => {
  it("ROUGE — stockage R2 et montage en ligne reliés : ni « (LUT) », ni « Cloudflare R2 », ni « Remotion » à l'écran ; titres fixes", async () => {
    const env: Record<string, string> = {
      R2_ACCOUNT_ID: "a",
      R2_ACCESS_KEY_ID: "b",
      R2_SECRET_ACCESS_KEY: "c",
      R2_BUCKET: "d",
      FOURNISSEUR_STOCKAGE: "r2",
      STUDIO_RENDU_URL: "http://studio-rendu:4100",
      REMOTION_LAMBDA_ACTIVE: "true",
      REMOTION_LAMBDA_REGION: "eu-west-1",
      REMOTION_LAMBDA_FONCTION: "f",
      REMOTION_LAMBDA_SITE: "s",
      AWS_ACCESS_KEY_ID: "k",
      AWS_SECRET_ACCESS_KEY: "s",
      FOURNISSEUR_MONTAGE: "remotion-lambda",
    };
    const { reglages, ecran } = await charger(env);
    const toutes = await reglages.listerConnexions();
    expect(toutes.find((c) => c.type === "stockage")?.etat).toBe("relie");
    expect(toutes.find((c) => c.type === "montage")?.etat).toBe("relie");
    const rendus = [renderToStaticMarkup(createElement(ecran.Connexions, { connexions: toutes.map(vue) }))];
    for (const c of toutes) rendus.push(renderToStaticMarkup(createElement(ecran.ChoixService, { connexion: vue(c), valeur: "simulation", onChange: () => undefined })));
    for (const html of rendus) expect(html).not.toMatch(/\(LUT\)|Cloudflare|\bR2\b|Remotion|Lambda|AWS/);
    expect(rendus[0]).toContain("Étalonnage des couleurs");
    expect(rendus[0]).toContain("Stockage des fichiers");
    expect(rendus[0]).toContain("Stockage en ligne"); // valeur choisie, en mots simples
    expect(rendus[0]).toContain("Montage en ligne (plus rapide)");
  });
});
