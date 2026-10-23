/**
 * Mise en ligne, trou 1 (Will, 18/10) : `mettre-a-jour.sh` redémarrait SANS attendre quand la lecture des vidéos en cours
 * échouait (base qui redémarre, mot de passe refusé…), donc pouvait couper une fabrication payante.
 * Règle : base PRÉSENTE mais illisible → ARRÊT sans rien redémarrer (code 4) ; base ABSENTE (première installation) →
 * on continue ; STUDIO_MAJ_FORCER=1 reste l'exception explicite. Attente épuisée : code 3 (distinct d'une panne, code 1).
 * Script exécuté pour de vrai avec le faux `docker` (aucune base, aucun conteneur, aucun réseau).
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bancServeur, type BancServeur } from "./helpers/banc-serveur";

const bancs: BancServeur[] = [];
function banc() {
  const b = bancServeur();
  bancs.push(b);
  return b;
}
afterAll(() => {
  for (const b of bancs) rmSync(b.dossier, { recursive: true, force: true });
});

const RAPIDE = { STUDIO_MAJ_ATTENTE_PAS_SEC: "0" };
const redemarre = (b: BancServeur) => b.appels().some((a) => / compose .*up -d/.test(a));

describe("Mise en ligne : base présente mais illisible → arrêt, jamais un redémarrage à l'aveugle", () => {
  it("la lecture échoue à chaque essai : code 4, message clair, rien de redémarré ni sauvegardé, `:local` rendu", () => {
    const b = banc();
    b.poser("fabrications", "ko\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(4);
    expect(r.sortie).toMatch(/MISE À JOUR ARRÊTÉE : impossible de lire les vidéos en cours/);
    expect(r.sortie).toMatch(/STUDIO_MAJ_FORCER=1/);
    expect(redemarre(b)).toBe(false);
    expect(b.appels().some((a) => /pg_dump/.test(a))).toBe(false);
    expect(b.image("studio-axion-ia:local")).toBe("en-service");
    expect(b.image("studio-axion-ia:attente")).toBe("construite-1");
  });

  it("un échec passager puis une lecture réussie : la mise à jour continue normalement", () => {
    const b = banc();
    b.poser("fabrications", "ko\n1\n0\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).toMatch(/lecture des vidéos en cours impossible/);
    expect(r.sortie).toMatch(/1 vidéo\(s\) en cours : la mise à jour attend/);
    expect(b.appels().filter((a) => / compose .*up -d/.test(a))).toHaveLength(1);
  });

  it("une réponse qui n'est pas un nombre compte comme une lecture impossible (jamais « 0 »)", () => {
    const b = banc();
    b.poser("fabrications", "ERREUR: relation \"documents\" n'existe pas\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(4);
    expect(redemarre(b)).toBe(false);
  });

  it("la base n'est pas encore démarrée (première installation) : on continue sans attendre", () => {
    const b = banc();
    b.poser("absent-base");
    b.poser("fabrications", "ko\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.sortie).toMatch(/Base pas encore démarrée/);
    expect(redemarre(b)).toBe(true);
  });

  it("STUDIO_MAJ_FORCER=1 : base illisible, on redémarre quand même (exception explicite)", () => {
    const b = banc();
    b.poser("fabrications", "ko\n");
    const r = b.lancer("mettre-a-jour.sh", [], { ...RAPIDE, STUDIO_MAJ_FORCER: "1" });
    expect(r.status, r.sortie).toBe(0);
    expect(redemarre(b)).toBe(true);
  });

  it("vidéos encore en cours au bout de l'attente : code 3 (distinct d'une panne), rien de redémarré", () => {
    const b = banc();
    b.poser("fabrications", "1\n");
    const r = b.lancer("mettre-a-jour.sh", [], { ...RAPIDE, STUDIO_MAJ_ATTENTE_MAX_MIN: "0" });
    expect(r.status, r.sortie).toBe(3);
    expect(r.sortie).toMatch(/MISE À JOUR ARRÊTÉE : 1 vidéo\(s\) encore en cours/);
    expect(redemarre(b)).toBe(false);
  });
});

/**
 * Relecture sécurité + exactitude (18/10, « À CORRIGER ») : tout ce qui tourne en tenant le verrou a un délai maximal ;
 * l'erreur de la base n'est plus perdue ; un conteneur base ARRÊTÉ n'est pas une première installation ; un `tag` raté
 * ne change pas le code de sortie ; une vidéo qui démarre pendant la copie de la base n'est pas coupée ; une vidéo en
 * attente de crédit est dite comme telle.
 */
describe("Mise en ligne : relecture « À CORRIGER »", () => {
  const pause = (b: BancServeur) => {
    try {
      return readFileSync(join(b.faux, "pause.log"), "utf8").trim().split("\n");
    } catch {
      return [];
    }
  };

  it("(1) psql ne répond jamais : chaque lecture est bornée (code 124 = lecture ratée), arrêt code 4 en quelques secondes", () => {
    const b = banc();
    b.poser("fabrications", "bloque\n");
    const debut = Date.now();
    const r = b.lancer("mettre-a-jour.sh", [], { ...RAPIDE, STUDIO_DELAI_BASE_SEC: "1" }, 30_000);
    expect(r.status, r.sortie).toBe(4);
    expect(Date.now() - debut).toBeLessThan(20_000);
    expect(r.sortie).toMatch(/pas de réponse de la base en 1 s/);
    expect(redemarre(b)).toBe(false);
    // Délai de connexion aussi côté libpq (équivalent de PGCONNECT_TIMEOUT).
    expect(b.appels().some((a) => /base psql .*connect_timeout=/.test(a))).toBe(true);
  });

  it("(1) git pull qui ne répond jamais : borné, code 1, rien construit ; ssh avec ConnectTimeout", () => {
    const b = banc();
    const normal = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(normal.status, normal.sortie).toBe(0);
    expect(readFileSync(join(b.faux, "git-ssh.log"), "utf8")).toMatch(/-o ConnectTimeout=20/);
    const c = banc();
    c.poser("pull-bloque");
    const debut = Date.now();
    const r = c.lancer("mettre-a-jour.sh", [], { ...RAPIDE, STUDIO_DELAI_PULL_SEC: "1" }, 30_000);
    expect(r.status, r.sortie).toBe(1);
    expect(Date.now() - debut).toBeLessThan(20_000);
    expect(r.sortie).toMatch(/git pull .*délai/);
    expect(c.appels().some((a) => / compose .*build /.test(a))).toBe(false);
  });

  it("(1) le message du code 5 ne prétend plus que tout est borné à 120 min", () => {
    const src = readFileSync(join(__dirname, "../deploiement/commun.sh"), "utf8");
    expect(src).not.toMatch(/est bornée à \$\{STUDIO_MAJ_ATTENTE_MAX_MIN:-120\} min\) : relancer après/);
    expect(src).toMatch(/construction des images .*pas de délai maximal/i);
  });

  it("(3) conteneur base ARRÊTÉ (vu par ps -a seulement) : ce n'est pas une première installation → code 4", () => {
    const b = banc();
    b.poser("arrete-base");
    b.poser("fabrications", "ko\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(4);
    expect(r.sortie).not.toMatch(/Base pas encore démarrée/);
    expect(redemarre(b)).toBe(false);
  });

  it("(3) `compose ps` en échec : jamais pris pour « absent » → code 4", () => {
    const b = banc();
    b.poser("ps-ko");
    b.poser("fabrications", "ko\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(4);
    expect(r.sortie).not.toMatch(/Base pas encore démarrée/);
    expect(redemarre(b)).toBe(false);
  });

  it("(5) l'erreur de psql est gardée : sa dernière ligne figure dans le message du code 4", () => {
    const b = banc();
    b.poser("fabrications", "ko\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(4);
    expect(r.sortie).toMatch(/Dernière erreur : .*connection to server on socket/);
  });

  it("(6) `docker image tag` raté en rendant `:local` : le code reste 4 (pas 1) et le geste manuel est affiché", () => {
    const b = banc();
    b.poser("fabrications", "ko\n");
    b.poser("tag-ko");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(4);
    expect(r.sortie).toMatch(/n'a pas pu être rendue? à la version en service/);
    expect(r.sortie).toMatch(/docker image tag studio-axion-ia:precedente studio-axion-ia:local/);
  });

  it("(7a) une vidéo démarre pendant la copie de la base : relue juste avant `up -d`, rien n'est redémarré (code 3)", () => {
    const b = banc();
    // 1re lecture : 0 → pause, copie ; dernière relecture : 1 → on attend de nouveau (attente épuisée ici).
    b.poser("fabrications", "0\n1\n");
    const r = b.lancer("mettre-a-jour.sh", [], { ...RAPIDE, STUDIO_MAJ_ATTENTE_MAX_MIN: "0" });
    expect(r.status, r.sortie).toBe(3);
    expect(r.sortie).toMatch(/Dernière relecture : 1 vidéo\(s\) ont démarré/);
    expect(redemarre(b)).toBe(false);
    // La pause posée est levée à la sortie.
    expect(pause(b)).toEqual(["pose", "leve"]);
  });

  it("(7a) mise en ligne normale : copie, PUIS pause (jamais dans la copie), dernière relecture, `up -d`, pause levée", () => {
    const b = banc();
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).toMatch(/Dernière relecture juste avant le redémarrage : aucune vidéo en cours/);
    expect(pause(b)).toEqual(["pose", "leve"]);
    const a = b.appels();
    const iPose = a.findIndex((x) => /'baux'.*INSERT|INSERT.*'baux'/.test(x));
    const iDump = a.findIndex((x) => /pg_dump/.test(x));
    const iUp = a.findIndex((x) => / compose .*up -d/.test(x));
    const iLeve = a.findIndex((x) => /DELETE.*'baux'/.test(x));
    const iRelu = a.findLastIndex((x) => /base psql .*count\(\*\)/.test(x));
    expect(iDump).toBeGreaterThan(-1);
    expect(iDump).toBeLessThan(iPose);
    expect(iPose).toBeLessThan(iRelu);
    expect(iRelu).toBeLessThan(iUp);
    expect(iUp).toBeLessThan(iLeve);
  });

  it("(7b) une vidéo en attente de crédit est dite comme telle (elle ne fabrique pas), la règle ne change pas", () => {
    const b = banc();
    b.poser("fabrications", "2|1\n0\n");
    const r = b.lancer("mettre-a-jour.sh", [], RAPIDE);
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).toMatch(/2 vidéo\(s\) en cours, dont 1 en attente de crédit/);
    const c = banc();
    c.poser("fabrications", "1|1\n");
    const r3 = c.lancer("mettre-a-jour.sh", [], { ...RAPIDE, STUDIO_MAJ_ATTENTE_MAX_MIN: "0" });
    expect(r3.status, r3.sortie).toBe(3);
    expect(r3.sortie).toMatch(/dont 1 en attente de crédit/);
    expect(redemarre(c)).toBe(false);
  });
});
