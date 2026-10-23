/**
 * Serveur simulé pour exécuter les scripts de `deploiement/` (bash) avec le faux `docker` (tests/helpers/faux-docker.sh).
 * /opt/studio-axion-ia → dossier temporaire ; `source/` = clone d'un dépôt « origin » qui porte le `deploiement/` de la
 * branche. Aucun serveur, aucun conteneur, aucune base réelle, aucun réseau.
 */
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DEPOT = resolve(__dirname, "../..");
const FAUX = join(DEPOT, "tests/helpers/faux-docker.sh");
export const ENV_GIT = { GIT_AUTHOR_NAME: "essai", GIT_AUTHOR_EMAIL: "essai@exemple.invalid", GIT_COMMITTER_NAME: "essai", GIT_COMMITTER_EMAIL: "essai@exemple.invalid" };

export function sh(commande: string, cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync("bash", ["-c", commande], { cwd, env: { ...process.env, ...ENV_GIT, ...env }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${commande}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

export interface Lancement {
  status: number | null;
  sortie: string;
}

export interface BancServeur {
  dossier: string;
  racine: string;
  faux: string;
  travail: string;
  env: Record<string, string>;
  /** `delaiMs` : le script est tué au-delà (status null) ; un script bloqué ne bloque pas toute la suite de tests. */
  lancer: (script: string, args?: string[], env?: Record<string, string>, delaiMs?: number) => Lancement;
  /** Même lancement, sans attendre la fin (deux mises en ligne en même temps). */
  lancerSansAttendre: (script: string, args?: string[], env?: Record<string, string>) => Promise<Lancement>;
  appels: () => string[];
  image: (nomTag: string) => string | null;
  poser: (nom: string, contenu?: string) => void;
}

export function bancServeur(o: { calage?: boolean } = {}): BancServeur {
  const d = mkdtempSync(join(tmpdir(), "banc-serveur-"));
  const racine = join(d, "opt");
  const faux = join(d, "faux-docker");
  const bin = join(d, "bin");
  const travail = join(d, "travail");
  mkdirSync(racine, { recursive: true });
  mkdirSync(join(faux, "images"), { recursive: true });
  mkdirSync(bin);
  symlinkSync(FAUX, join(bin, "docker"));
  chmodSync(FAUX, 0o755);
  // Faux `git` : note le GIT_SSH_COMMAND du pull ; `pull-bloque` simule un pull qui ne répond jamais (réseau, ssh).
  const vraiGit = spawnSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  writeFileSync(
    join(bin, "git"),
    `#!/usr/bin/env bash\nif [ "\${1:-}" = pull ]; then\n  echo "\${GIT_SSH_COMMAND:-}" >>"$FAUX_DOCKER/git-ssh.log"\n  [ -f "$FAUX_DOCKER/pull-bloque" ] && exec sleep 300\nfi\nexec ${vraiGit} "$@"\n`,
  );
  chmodSync(join(bin, "git"), 0o755);
  writeFileSync(
    join(racine, ".env"),
    ["POSTGRES_PASSWORD=essai", "STUDIO_RENDU_CLE=cle-essai", o.calage === false ? "STUDIO_ALIGNEUR_URL=" : "STUDIO_ALIGNEUR_URL=http://studio-aligneur:4200", "STUDIO_RENDU_CPUS=2", ""].join("\n"),
  );
  mkdirSync(travail);
  cpSync(join(DEPOT, "deploiement"), join(travail, "deploiement"), { recursive: true });
  sh("git init -q -b master && git add -A && git commit -qm v1 && git clone -q --bare . ../origin.git && git remote add origin ../origin.git", travail);
  sh(`git clone -q ${join(d, "origin.git")} ${join(racine, "source")}`, d);
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
  };
  const chemin = (script: string) => join(racine, "source/deploiement", script);
  return {
    dossier: d,
    racine,
    faux,
    travail,
    env,
    lancer: (script, args = [], plus = {}, delaiMs) => {
      const r = spawnSync("bash", [chemin(script), ...args], { env: { ...process.env, ...ENV_GIT, ...env, ...plus }, encoding: "utf8", timeout: delaiMs, killSignal: "SIGKILL" });
      return { status: r.status, sortie: `${r.stdout}\n${r.stderr}` };
    },
    lancerSansAttendre: (script, args = [], plus = {}) =>
      new Promise((ok) => {
        const p = spawn("bash", [chemin(script), ...args], { env: { ...process.env, ...ENV_GIT, ...env, ...plus } });
        let sortie = "";
        p.stdout.on("data", (x) => (sortie += x));
        p.stderr.on("data", (x) => (sortie += x));
        p.on("close", (status) => ok({ status, sortie }));
      }),
    appels: () => (existsSync(join(faux, "appels.log")) ? readFileSync(join(faux, "appels.log"), "utf8").trim().split("\n") : []),
    image: (nomTag) => (existsSync(join(faux, "images", nomTag)) ? readFileSync(join(faux, "images", nomTag), "utf8").trim() : null),
    poser: (nom, contenu = "") => writeFileSync(join(faux, nom), contenu),
  };
}
