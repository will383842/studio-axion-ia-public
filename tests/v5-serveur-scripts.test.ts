/**
 * VÉRIF V5 (serveur) — scripts de déploiement EXÉCUTÉS (bash) avec un faux `docker` (tests/helpers/faux-docker.sh) et,
 * pour la sauvegarde et la restauration, une VRAIE base Postgres locale (sautés si Postgres n'est pas installé).
 * Aucun serveur, aucun conteneur, aucun réseau.
 *
 * ROUGE sur master 85655d2 : « mettre-a-jour.sh se relance dans la version qu'il vient de tirer » (09/10 : la première
 * exécution du nouveau script n'a pas lancé le contrôle des outils vidéo, l'ancien script tournait encore).
 */
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DEPOT = resolve(__dirname, "..");
const FAUX = join(DEPOT, "tests/helpers/faux-docker.sh");
const ENV_GIT = { GIT_AUTHOR_NAME: "essai", GIT_AUTHOR_EMAIL: "essai@exemple.invalid", GIT_COMMITTER_NAME: "essai", GIT_COMMITTER_EMAIL: "essai@exemple.invalid" };

function sh(commande: string, cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync("bash", ["-c", commande], { cwd, env: { ...process.env, ...ENV_GIT, ...env }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${commande}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

interface Banc {
  racine: string;
  faux: string;
  travail: string;
  env: Record<string, string>;
  lancer: (script: string, args?: string[], env?: Record<string, string>) => { status: number | null; sortie: string };
  appels: () => string[];
  image: (nomTag: string) => string | null;
  poser: (nom: string, contenu?: string) => void;
}

/** Serveur simulé : /opt/studio-axion-ia (racine), source = clone d'un dépôt « origin » qui porte deploiement/ de la branche. */
function banc(o: { calage?: boolean; pg?: { hote: string; port: string } } = {}): Banc {
  const d = mkdtempSync(join(tmpdir(), "v5-serveur-"));
  const racine = join(d, "opt");
  const faux = join(d, "faux-docker");
  const bin = join(d, "bin");
  const travail = join(d, "travail");
  mkdirSync(racine, { recursive: true });
  mkdirSync(join(faux, "images"), { recursive: true });
  mkdirSync(bin);
  symlinkSync(FAUX, join(bin, "docker"));
  chmodSync(FAUX, 0o755);
  writeFileSync(
    join(racine, ".env"),
    ["POSTGRES_PASSWORD=essai", "STUDIO_RENDU_CLE=cle-essai", o.calage === false ? "STUDIO_ALIGNEUR_URL=" : "STUDIO_ALIGNEUR_URL=http://studio-aligneur:4200", "STUDIO_RENDU_CPUS=2", ""].join("\n"),
  );
  mkdirSync(travail);
  cpSync(join(DEPOT, "deploiement"), join(travail, "deploiement"), { recursive: true });
  sh("git init -q -b master && git add -A && git commit -qm v1 && git clone -q --bare . ../origin.git && git remote add origin ../origin.git", travail);
  sh(`git clone -q ${join(d, "origin.git")} ${join(racine, "source")}`, d);
  // Images en service avant la mise à jour (construites la veille, marquées bonnes).
  for (const i of ["studio-axion-ia", "studio-rendu", "studio-aligneur"]) {
    writeFileSync(join(faux, "images", `${i}:local`), "en-service\n");
    writeFileSync(join(faux, "images", `${i}:bonne`), "en-service\n");
  }
  const env: Record<string, string> = {
    PATH: `${bin}:${process.env.PATH}`,
    FAUX_DOCKER: faux,
    STUDIO_RACINE: racine,
    STUDIO_ATTENTE_SANTE_SEC: "1",
    STUDIO_INTERVALLE_SANTE_SEC: "0",
    ...(o.pg ? { PGHOST: o.pg.hote, PGPORT: o.pg.port } : {}),
  };
  return {
    racine,
    faux,
    travail,
    env,
    lancer: (script, args = [], plus = {}) => {
      const r = spawnSync("bash", [join(racine, "source/deploiement", script), ...args], { env: { ...process.env, ...ENV_GIT, ...env, ...plus }, encoding: "utf8" });
      return { status: r.status, sortie: `${r.stdout}\n${r.stderr}` };
    },
    appels: () => (existsSync(join(faux, "appels.log")) ? readFileSync(join(faux, "appels.log"), "utf8").trim().split("\n") : []),
    image: (nomTag) => (existsSync(join(faux, "images", nomTag)) ? readFileSync(join(faux, "images", nomTag), "utf8").trim() : null),
    poser: (nom, contenu = "") => writeFileSync(join(faux, nom), contenu),
  };
}

/** Une nouvelle version poussée sur origin : mettre-a-jour.sh y laisse une trace quand c'est ELLE qui s'exécute. */
function pousserNouvelleVersion(b: Banc) {
  const p = join(b.travail, "deploiement/mettre-a-jour.sh");
  const s = readFileSync(p, "utf8").replace("set -euo pipefail\n", 'set -euo pipefail\necho "VERSION-2 EXECUTEE" >>"$FAUX_DOCKER/traces.log"\n');
  writeFileSync(p, s);
  sh("git commit -qam v2 && git push -q origin master", b.travail);
}

const traces = (b: Banc) => (existsSync(join(b.faux, "traces.log")) ? readFileSync(join(b.faux, "traces.log"), "utf8") : "");

describe("V5 · mettre-a-jour.sh sûr face à sa propre mise à jour", () => {
  it("ROUGE — après le git pull, le script se relance (exec) dans la NOUVELLE version, une seule fois", () => {
    const b = banc();
    pousserNouvelleVersion(b);
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status, r.sortie).toBe(0);
    // La nouvelle version s'est exécutée UNE fois (pas de boucle), et c'est elle qui a fait tout le reste.
    expect(traces(b).match(/VERSION-2 EXECUTEE/g)?.length).toBe(1);
    expect(r.sortie).toMatch(/relance de mettre-a-jour\.sh/);
    // Une seule construction, un seul contrôle des outils vidéo, une seule mise en service.
    expect(b.appels().filter((a) => / compose .*build /.test(a))).toHaveLength(1);
    expect(b.appels().filter((a) => a.startsWith("docker run --rm --network none"))).toHaveLength(3);
    expect(b.appels().filter((a) => / compose .*up -d/.test(a))).toHaveLength(1);
  });

  it("rien de neuf sur origin : aucune relance, la mise à jour se fait normalement", () => {
    const b = banc();
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).not.toMatch(/relance de mettre-a-jour\.sh/);
    expect(b.appels().filter((a) => / compose .*up -d/.test(a))).toHaveLength(1);
  });

  it("déjà relancé (STUDIO_MAJ_RELANCE=1) : aucun second git pull, aucune seconde relance", () => {
    const b = banc();
    pousserNouvelleVersion(b);
    const avant = sh("git rev-parse HEAD", join(b.racine, "source"));
    const r = b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_RELANCE: "1" });
    expect(r.status, r.sortie).toBe(0);
    expect(sh("git rev-parse HEAD", join(b.racine, "source"))).toBe(avant);
    expect(traces(b)).toBe("");
  });

  it("ordre : construction → contrôle réel des outils (mémoire bornée) → copie de la base → up -d → santé → tags `bonne`", () => {
    const b = banc();
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status, r.sortie).toBe(0);
    const a = b.appels();
    const i = (re: RegExp) => a.findIndex((x) => re.test(x));
    expect(i(/ compose .*build /)).toBeLessThan(i(/^docker run --rm --network none/));
    expect(i(/^docker run --rm --network none/)).toBeLessThan(i(/exec -T base pg_dump/));
    expect(i(/exec -T base pg_dump/)).toBeLessThan(i(/ compose .*up -d/));
    // Le contrôle ne peut pas prendre toute la mémoire du serveur (le site tourne à côté).
    for (const x of a.filter((y) => y.startsWith("docker run --rm --network none"))) expect(x).toMatch(/--memory \d+[gm] /);
    expect(b.image("studio-axion-ia:precedente")).toBe("en-service");
    expect(b.image("studio-axion-ia:bonne")).toBe("construite-1");
    expect(readdirSync(join(b.racine, "sauvegardes")).some((f) => /^avant-maj-.*\.sql\.gz$/.test(f))).toBe(true);
  });

  it("Will 15/10 : des vidéos en cours → la mise à jour attend qu'elles finissent, PUIS redémarre", () => {
    const b = banc();
    b.poser("fabrications", "2\n1\n0\n");
    const r = b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_ATTENTE_PAS_SEC: "0" });
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).toMatch(/2 vidéo\(s\) en cours : la mise à jour attend/);
    expect(r.sortie).toMatch(/Aucune vidéo en cours : redémarrage/);
    expect(b.appels().filter((a) => / compose .*up -d/.test(a))).toHaveLength(1);
  });

  it("Will 15/10 : vidéos encore en cours au bout de l'attente → rien n'est redémarré, `:local` rendu à la version en service", () => {
    const b = banc();
    b.poser("fabrications", "1\n");
    const r = b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_ATTENTE_PAS_SEC: "0", STUDIO_MAJ_ATTENTE_MAX_MIN: "0" });
    // Will, 18/10 : code distinct d'une panne (commun.sh, CODE_ATTENTE_EPUISEE).
    expect(r.status).toBe(3);
    expect(r.sortie).toMatch(/MISE À JOUR ARRÊTÉE : 1 vidéo\(s\) encore en cours/);
    expect(b.appels().some((a) => / compose .*up -d/.test(a))).toBe(false);
    expect(b.appels().some((a) => /exec -T base pg_dump/.test(a))).toBe(false);
    expect(b.image("studio-axion-ia:local")).toBe("en-service");
  });

  it("Will 15/10 : STUDIO_MAJ_FORCER=1 redémarre sans attendre les vidéos en cours", () => {
    const b = banc();
    b.poser("fabrications", "3\n");
    const r = b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_FORCER: "1" });
    expect(r.status, r.sortie).toBe(0);
    expect(b.appels().filter((a) => / compose .*up -d/.test(a))).toHaveLength(1);
  });

  it("contrôle des outils vidéo en échec : rien n'est sauvegardé ni redémarré, `:local` rendu à la version en service", () => {
    const b = banc();
    b.poser("outils-ko");
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status).toBe(1);
    expect(r.sortie).toMatch(/MISE À JOUR ARRÊTÉE/);
    expect(b.appels().some((a) => / compose .*up -d/.test(a))).toBe(false);
    expect(b.appels().some((a) => /pg_dump/.test(a))).toBe(false);
    expect(b.image("studio-rendu:local")).toBe("en-service");
    expect(b.image("studio-rendu:refusee")).toBe("construite-1");
  });

  it("santé en échec après up -d : code 1, commande de retour affichée, `bonne` NON déplacé", () => {
    const b = banc();
    b.poser("sante-ko");
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status).toBe(1);
    expect(r.sortie).toMatch(/revenir\.sh/);
    expect(b.image("studio-axion-ia:bonne")).toBe("en-service");
  });

  it("relancé après une mise à jour ratée : `precedente` reste la dernière version SAINE (jamais l'image ratée)", () => {
    const b = banc();
    b.poser("sante-ko");
    expect(b.lancer("mettre-a-jour.sh").status).toBe(1);
    expect(b.lancer("mettre-a-jour.sh").status).toBe(1);
    expect(b.image("studio-axion-ia:precedente")).toBe("en-service");
  });
});

describe("V5 · revenir.sh et les tags precedente / bonne", () => {
  it("remet `precedente` en service sans rien construire, garde l'image retirée sous `annulee`, marque `bonne`", () => {
    const b = banc();
    expect(b.lancer("mettre-a-jour.sh").status).toBe(0);
    const r = b.lancer("revenir.sh");
    expect(r.status, r.sortie).toBe(0);
    for (const i of ["studio-axion-ia", "studio-rendu", "studio-aligneur"]) {
      expect(b.image(`${i}:local`)).toBe("en-service");
      expect(b.image(`${i}:annulee`)).toBe("construite-1");
      expect(b.image(`${i}:bonne`)).toBe("en-service");
    }
    const apres = b.appels().slice(b.appels().findLastIndex((a) => a.includes("image tag studio-axion-ia:precedente studio-axion-ia:local")));
    expect(apres.some((a) => / build( |$)/.test(a))).toBe(false);
    expect(apres.some((a) => / compose .*--profile calage up -d --no-build/.test(a))).toBe(true);
    expect(readFileSync(join(b.faux, "en-service/studio"), "utf8").trim()).toBe("en-service");
  });

  it("calage éteint : studio-aligneur n'est pas exigé sain et n'est pas démarré", () => {
    const b = banc({ calage: false });
    expect(b.lancer("mettre-a-jour.sh").status).toBe(0);
    b.poser("sante-studio-aligneur", "exited");
    const r = b.lancer("revenir.sh");
    expect(r.status, r.sortie).toBe(0);
    expect(b.appels().filter((a) => / up -d --no-build/.test(a)).every((a) => !a.includes("--profile calage"))).toBe(true);
  });

  it("aucune image `precedente` : refus clair, rien n'est touché", () => {
    const b = banc();
    const r = b.lancer("revenir.sh");
    expect(r.status).toBe(1);
    expect(r.sortie).toMatch(/Aucune image studio-axion-ia:precedente/);
    expect(b.appels().some((a) => / up /.test(a))).toBe(false);
  });

  it("version précédente malade aussi : code 1, `bonne` n'est pas posé sur elle", () => {
    const b = banc();
    expect(b.lancer("mettre-a-jour.sh").status).toBe(0);
    rmSync(join(b.faux, "images", "studio-axion-ia:bonne"));
    b.poser("sante-studio-rendu", "unhealthy");
    const r = b.lancer("revenir.sh");
    expect(r.status).toBe(1);
    expect(b.image("studio-rendu:bonne")).toBe("construite-1");
  });
});

describe("V5 · nettoyage sûr du disque", () => {
  it("retire les images sans nom, le vieux cache et les dossiers temporaires de plus de 24 h ; JAMAIS les volumes, les travaux, les sauvegardes", () => {
    const b = banc();
    const vieux = new Date(Date.now() - 2 * 86_400_000);
    const rendu = join(b.faux, "conteneurs/id-studio-rendu/tmp");
    const aligneur = join(b.faux, "conteneurs/id-studio-aligneur/tmp");
    const travaux = join(b.faux, "conteneurs/id-studio-aligneur/app/travaux/image/passe-1");
    for (const x of [join(rendu, "studio-rendu-vieux"), join(rendu, "remotion-vieux"), join(rendu, "studio-rendu-neuf"), join(rendu, "autre-chose"), join(aligneur, "calage-vieux"), travaux]) mkdirSync(x, { recursive: true });
    for (const x of [join(rendu, "studio-rendu-vieux"), join(rendu, "remotion-vieux"), join(rendu, "autre-chose"), join(aligneur, "calage-vieux"), travaux]) utimesSync(x, vieux, vieux);
    mkdirSync(join(b.racine, "sauvegardes"), { recursive: true });
    writeFileSync(join(b.racine, "sauvegardes/avant-maj-2026-10-01_120000.sql.gz"), "x");
    utimesSync(join(b.racine, "sauvegardes/avant-maj-2026-10-01_120000.sql.gz"), vieux, vieux);
    const r = b.lancer("nettoyer-disque.sh");
    expect([0, 2]).toContain(r.status);
    expect(existsSync(join(rendu, "studio-rendu-vieux"))).toBe(false);
    expect(existsSync(join(rendu, "remotion-vieux"))).toBe(false);
    expect(existsSync(join(aligneur, "calage-vieux"))).toBe(false);
    // Gardés : un dossier récent (rendu en cours), un nom inconnu, les travaux face caméra, les sauvegardes.
    expect(existsSync(join(rendu, "studio-rendu-neuf"))).toBe(true);
    expect(existsSync(join(rendu, "autre-chose"))).toBe(true);
    expect(existsSync(travaux)).toBe(true);
    expect(existsSync(join(b.racine, "sauvegardes/avant-maj-2026-10-01_120000.sql.gz"))).toBe(true);
    const a = b.appels();
    expect(a).toContain("docker image prune -f");
    expect(a.some((x) => /builder prune -f --filter until=168h/.test(x))).toBe(true);
    expect(a.some((x) => /volume|system prune|image prune .*-a|--all/.test(x))).toBe(false);
  });
});

describe("V5 · surveillance mémoire (85 % de la limite) et disque", () => {
  it("alerte une fois par heure pour un conteneur au-delà de 85 %, rien pour les autres ni pour le site", () => {
    const b = banc();
    b.poser(
      "stats",
      [
        "studio-axion-ia-studio-aligneur-1;88.10%;5.16GiB / 5.859GiB",
        "studio-axion-ia-studio-rendu-1;40.00%;1.2GiB / 3GiB",
        "axion-ia-site-1;99.00%;1.9GiB / 2GiB",
        "",
      ].join("\n"),
    );
    const r1 = b.lancer("surveiller.sh", [], { STUDIO_SEUIL_DISQUE_PCT: "101" });
    expect(r1.status).toBe(2);
    const alertes = () => (existsSync(join(b.faux, "alertes.log")) ? readFileSync(join(b.faux, "alertes.log"), "utf8").trim().split("\n") : []);
    expect(alertes()).toHaveLength(1);
    expect(alertes()[0]).toMatch(/studio-aligneur-1 à 88\.10% de sa mémoire/);
    expect(alertes()[0]).not.toMatch(/EMAIL_SECOURS_CLE=/);
    // Second passage 5 min plus tard : pas de nouvel e-mail (rappel au bout d'une heure).
    b.lancer("surveiller.sh", [], { STUDIO_SEUIL_DISQUE_PCT: "101" });
    expect(alertes()).toHaveLength(1);
    expect(readFileSync(join(b.racine, "surveillance/surveillance.log"), "utf8")).toMatch(/MÉMOIRE studio-axion-ia-studio-aligneur-1 : 88\.10%/);
    // Retour sous le seuil : levée notée, le prochain dépassement réalerte tout de suite.
    b.poser("stats", "studio-axion-ia-studio-aligneur-1;60.00%;3.5GiB / 5.859GiB\n");
    expect(b.lancer("surveiller.sh", [], { STUDIO_SEUIL_DISQUE_PCT: "101" }).status).toBe(0);
    expect(existsSync(join(b.racine, "surveillance/alerte-memoire-studio-axion-ia-studio-aligneur-1"))).toBe(false);
  });

  it("disque au-delà du seuil → alerte disque", () => {
    const b = banc();
    b.poser("stats", "");
    const r = b.lancer("surveiller.sh", [], { STUDIO_SEUIL_DISQUE_PCT: "0" });
    expect(r.status).toBe(2);
    expect(readFileSync(join(b.faux, "alertes.log"), "utf8")).toMatch(/disque à/);
  });
});

describe("V5 · budgets mémoire sur un serveur de 15 Go partagé avec le site", () => {
  const compose = readFileSync(join(DEPOT, "deploiement/docker-compose.yml"), "utf8");
  const enMo = (v: string) => (v.endsWith("g") ? Number(v.slice(0, -1)) * 1024 : Number(v.replace(/m$/, "")));
  const limites = () => {
    const r: Record<string, number> = {};
    let service = "";
    for (const l of compose.split("\n")) {
      const s = /^ {2}([a-z-]+):$/.exec(l);
      if (s) service = s[1];
      const m = /^ {4}mem_limit: (\S+)/.exec(l);
      if (m) r[service] = enMo(m[1]);
    }
    return r;
  };

  it("chaque service a une limite ; studio-aligneur ≥ 6000m (pic mesuré 4,40 Go le 09/10 = 73 %, sous l'alerte de 85 %)", () => {
    const l = limites();
    expect(Object.keys(l).sort()).toEqual(["base", "studio", "studio-aligneur", "studio-rendu"]);
    expect(l["studio-aligneur"]).toBeGreaterThanOrEqual(6000);
    expect((4.4 * 1024) / l["studio-aligneur"]).toBeLessThan(0.85);
  });

  it("le studio entier tient dans 11 Go : au moins 4 Go restent au site axion-ia, au système et au proxy", () => {
    const total = Object.values(limites()).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(11 * 1024);
    expect(15 * 1024 - total).toBeGreaterThanOrEqual(4 * 1024);
  });

  it("les conteneurs sans état (rendu, aligneur) sont tués EN PREMIER si la machine manque de mémoire, jamais la base ni le site", () => {
    for (const s of ["studio-rendu", "studio-aligneur"]) {
      const bloc = compose.split(/\n {2}(?=[a-z-]+:\n)/).find((x) => x.startsWith(`${s}:`))!;
      expect(bloc).toMatch(/oom_score_adj: [1-9]\d\d/);
    }
  });

  it("le dossier des travaux face caméra survit à la recréation du conteneur (volume) : reprise depuis les tranches", () => {
    expect(compose).toMatch(/travaux-aligneur:\/app\/travaux/);
    expect(compose).toMatch(/STUDIO_ALIGNEUR_TRAVAUX: \/app\/travaux/);
    const dockerfile = readFileSync(join(DEPOT, "deploiement/studio-aligneur/Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/mkdir -p \/app\/travaux[\s\S]*chown -R aligneur:aligneur \/app/);
  });

  it("crontab : surveillance toutes les 5 min, nettoyage la nuit (après la sauvegarde de 03:30)", () => {
    const cron = readFileSync(join(DEPOT, "deploiement/crontab"), "utf8");
    // Le dossier du journal est créé AVANT la redirection (sinon cron ne lance rien au premier passage).
    expect(cron).toMatch(/^\*\/5 \* \* \* \* root mkdir -p \/opt\/studio-axion-ia\/surveillance && \/bin\/bash \/opt\/studio-axion-ia\/source\/deploiement\/surveiller\.sh .*2>>\/opt\/studio-axion-ia\/surveillance\/cron\.log$/m);
    expect(cron).toMatch(/^15 4 \* \* \* root mkdir -p \/opt\/studio-axion-ia\/surveillance && \/bin\/bash \/opt\/studio-axion-ia\/source\/deploiement\/nettoyer-disque\.sh .*2>>\/opt\/studio-axion-ia\/surveillance\/cron\.log$/m);
  });
});

/* ------------------------------------------------------------------ */
/* Sauvegarde avant migration et restauration : VRAIE base Postgres locale */
/* ------------------------------------------------------------------ */
const BIN_PG = ["/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/15/bin"].find((d) => existsSync(join(d, "pg_ctl")));
const pg = { dossier: "", hote: "", port: String(56_000 + Math.floor(Math.random() * 1000)), pret: false };

function psql(sqlTexte: string, base = "studio"): string {
  return sh(`psql -h ${pg.hote} -p ${pg.port} -U studio -d ${base} -tA -v ON_ERROR_STOP=1 -c ${JSON.stringify(sqlTexte)}`, tmpdir()).trim();
}

describe.skipIf(!BIN_PG || process.getuid?.() !== 0)("V5 · sauvegarde avant migration et restauration (Postgres local)", () => {
  beforeAll(() => {
    pg.dossier = mkdtempSync(join(tmpdir(), "v5-pg-"));
    pg.hote = join(pg.dossier, "sock");
    mkdirSync(pg.hote);
    sh(`chown -R postgres ${pg.dossier} && chmod 777 ${pg.dossier}`, tmpdir());
    const u = (c: string) => sh(`runuser -u postgres -- ${BIN_PG}/${c}`, pg.dossier);
    u(`initdb -D ${pg.dossier}/data --auth=trust -U postgres >/dev/null`);
    u(`pg_ctl -D ${pg.dossier}/data -l ${pg.dossier}/journal -o "-k ${pg.hote} -p ${pg.port} -c listen_addresses=''" -w start`);
    sh(`psql -h ${pg.hote} -p ${pg.port} -U postgres -d postgres -qc "CREATE ROLE studio SUPERUSER LOGIN" && createdb -h ${pg.hote} -p ${pg.port} -U studio -O studio studio`, tmpdir());
    // Schéma réel du studio (src/donnees/postgres) et quelques documents, accents compris.
    psql("CREATE TABLE documents (collection text NOT NULL, id text NOT NULL, data jsonb NOT NULL, modifie_le timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (collection, id))");
    psql(`INSERT INTO documents (collection, id, data) SELECT 'videos', 'v' || i, jsonb_build_object('titre', 'Vidéo n° ' || i || ' — « été »', 'duree', i * 7) FROM generate_series(1, 300) i`);
    psql(`INSERT INTO documents (collection, id, data) VALUES ('reglages', 'budget', '{"plafond": 50}')`);
    pg.pret = true;
  });

  afterAll(() => {
    if (pg.dossier) spawnSync("bash", ["-c", `runuser -u postgres -- ${BIN_PG}/pg_ctl -D ${pg.dossier}/data -m immediate stop; rm -rf ${pg.dossier}`]);
  });

  const empreinte = (base = "studio") => psql("SELECT count(*) || ':' || md5(string_agg(collection || id || data::text, ',' ORDER BY collection, id)) FROM documents", base);

  it("mettre-a-jour.sh copie la base AVANT up -d ; la copie est complète et vérifiée ; puis une « migration » la modifie ; restaurer-base.sh rend la base d'avant et GARDE la migrée", () => {
    const b = banc({ pg: { hote: pg.hote, port: pg.port } });
    const avant = empreinte();
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status, r.sortie).toBe(0);
    const copie = readdirSync(join(b.racine, "sauvegardes")).find((f) => /^avant-maj-.*\.sql\.gz$/.test(f))!;
    const texte = gunzipSync(readFileSync(join(b.racine, "sauvegardes", copie))).toString("utf8");
    expect(texte).toMatch(/PostgreSQL database dump complete/);
    expect(texte).toMatch(/Vidéo n° 300 — « été »/);

    // Le nouveau studio « migre » au démarrage : documents changés, ajoutés, retirés.
    psql(`UPDATE documents SET data = data || '{"migre": 2}' WHERE collection = 'videos'`);
    psql(`DELETE FROM documents WHERE id = 'v1'`);
    psql(`INSERT INTO documents (collection, id, data) VALUES ('nouveau', 'x', '{}')`);
    const migree = empreinte();
    expect(migree).not.toBe(avant);

    const rest = b.lancer("restaurer-base.sh", [join(b.racine, "sauvegardes", copie)]);
    expect(rest.status, rest.sortie).toBe(0);
    expect(empreinte()).toBe(avant);
    const gardee = psql("SELECT datname FROM pg_database WHERE datname LIKE 'studio_avant_restauration_%'", "postgres");
    expect(gardee).toMatch(/^studio_avant_restauration_\d{8}_\d{6}$/);
    expect(empreinte(gardee)).toBe(migree);
    // Le studio a été arrêté pendant la restauration, puis redémarré.
    const a = b.appels();
    expect(a.findIndex((x) => / compose .*stop studio/.test(x))).toBeLessThan(a.findIndex((x) => /ALTER DATABASE studio RENAME/.test(x)));
    expect(a.some((x) => / compose .*start studio/.test(x))).toBe(true);
    psql(`DROP DATABASE ${gardee}`, "postgres");
  });

  it("copie tronquée : refus AVANT de toucher à quoi que ce soit (studio jamais arrêté, base intacte)", () => {
    const b = banc({ pg: { hote: pg.hote, port: pg.port } });
    const avant = empreinte();
    const f = join(b.racine, "tronquee.sql.gz");
    sh(`pg_dump -h ${pg.hote} -p ${pg.port} -U studio -d studio | head -n 20 | gzip > ${f}`, tmpdir());
    const r = b.lancer("restaurer-base.sh", [f]);
    expect(r.status).toBe(1);
    expect(r.sortie).toMatch(/n'est pas une sauvegarde complète/);
    expect(b.appels().some((x) => /stop studio/.test(x))).toBe(false);
    expect(empreinte()).toBe(avant);
  });

  it("chargement qui échoue en cours de route : la base d'avant reprend son nom, le studio redémarre", () => {
    const b = banc({ pg: { hote: pg.hote, port: pg.port } });
    const avant = empreinte();
    const f = join(b.racine, "cassee.sql.gz");
    sh(`printf 'CREATE TABLE documents (x int);\\nINSERT INTO pas_de_table VALUES (1);\\n-- PostgreSQL database dump complete\\n' | gzip > ${f}`, tmpdir());
    const r = b.lancer("restaurer-base.sh", [f]);
    expect(r.status).toBe(1);
    expect(r.sortie).toMatch(/retour à la base d'avant/);
    expect(empreinte()).toBe(avant);
    expect(b.appels().some((x) => / compose .*start studio/.test(x))).toBe(true);
    const ratee = psql("SELECT datname FROM pg_database WHERE datname LIKE 'studio_restauration_ratee_%'", "postgres");
    if (ratee) psql(`DROP DATABASE ${ratee}`, "postgres");
  });

  it("redémarrage de la base pendant un travail : l'écriture faite pendant la coupure échoue sans rien changer en mémoire ; après le retour, rien n'est perdu", async () => {
    const { creerDepotsPostgres } = await import("@/donnees/postgres");
    const url = `postgresql://studio@${encodeURIComponent(pg.hote)}:${pg.port}/studio`;
    const d = creerDepotsPostgres(url);
    type P = { id: string; valeur: number };
    const parametres = d.parametres as unknown as { enregistrer: (e: P) => Promise<P>; obtenir: (id: string) => Promise<P | null> };
    await parametres.enregistrer({ id: "v5-avant", valeur: 1 });
    sh(`runuser -u postgres -- ${BIN_PG}/pg_ctl -D ${pg.dossier}/data -m fast -w stop`, pg.dossier);
    try {
      await expect(parametres.enregistrer({ id: "v5-pendant", valeur: 2 })).rejects.toThrow();
      // Écriture d'abord en base, puis en mémoire : rien de « fantôme » que la base n'aurait pas.
      expect(await parametres.obtenir("v5-pendant")).toBeNull();
    } finally {
      sh(`runuser -u postgres -- ${BIN_PG}/pg_ctl -D ${pg.dossier}/data -l ${pg.dossier}/journal -o "-k ${pg.hote} -p ${pg.port} -c listen_addresses=''" -w start`, pg.dossier);
    }
    // La base revenue : le même processus réécrit (le pool se reconnecte), le tour suivant refait l'écriture ratée.
    await parametres.enregistrer({ id: "v5-pendant", valeur: 2 });
    // Le studio redémarre à son tour : il relit tout depuis la base.
    const relu = creerDepotsPostgres(url).parametres as unknown as typeof parametres;
    expect(await relu.obtenir("v5-avant")).toMatchObject({ valeur: 1 });
    expect(await relu.obtenir("v5-pendant")).toMatchObject({ valeur: 2 });
    psql("DELETE FROM documents WHERE id LIKE 'v5-%'");
  });

  it("essai mensuel de deploiement/README.md (base À PART) : mêmes documents que la base en service", () => {
    const b = banc({ pg: { hote: pg.hote, port: pg.port } });
    expect(b.lancer("mettre-a-jour.sh").status).toBe(0);
    const F = join(b.racine, "sauvegardes", readdirSync(join(b.racine, "sauvegardes")).find((f) => f.startsWith("avant-maj-"))!);
    const env = { ...b.env, F };
    sh(`docker exec studio-axion-ia-base-1 createdb -U studio studio_essai_restauration`, tmpdir(), env);
    sh(`gunzip -c "$F" | docker exec -i studio-axion-ia-base-1 psql -q -U studio -d studio_essai_restauration`, tmpdir(), env);
    expect(empreinte("studio_essai_restauration")).toBe(empreinte());
    psql("DROP DATABASE studio_essai_restauration", "postgres");
  });
});
