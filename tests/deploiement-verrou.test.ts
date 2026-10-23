/**
 * Mise en ligne, trou 2 (Will, 18/10) : aucun verrou entre deux mises en ligne. Deux `mettre-a-jour.sh` lancés en même
 * temps ont déjà laissé un conteneur orphelin (studio coupé ≈ 5 min). Un `pgrep` sur le nom du script ne voit pas
 * `nohup setsid bash …/mettre-a-jour.sh` : le verrou est un FICHIER ($STUDIO_RACINE/mise-a-jour.verrou, flock), pris
 * avant le `git pull`, gardé pendant la relance (exec) dans la version tirée, rendu à la sortie quelle qu'elle soit.
 * Seconde mise à jour pendant la première : « une mise à jour tourne déjà », code 5, RIEN n'est fait.
 * Script exécuté pour de vrai avec le faux `docker` (aucun conteneur, aucun réseau).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bancServeur, sh, type BancServeur } from "./helpers/banc-serveur";

const bancs: BancServeur[] = [];
function banc() {
  const b = bancServeur();
  bancs.push(b);
  return b;
}
afterAll(() => {
  for (const b of bancs) rmSync(b.dossier, { recursive: true, force: true });
});

const constructions = (b: BancServeur) => b.appels().filter((a) => / compose .*build /.test(a)).length;
const redemarrages = (b: BancServeur) => b.appels().filter((a) => / compose .*up -d/.test(a)).length;

/** Attend (sans `sleep` bloquant) que la première mise à jour soit entrée dans son attente des vidéos en cours. */
async function quandAttend(b: BancServeur) {
  for (let i = 0; i < 200; i++) {
    if (b.appels().some((a) => /exec -T base psql/.test(a))) return;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  throw new Error("la première mise à jour n'a jamais atteint l'attente des vidéos en cours");
}

async function deuxMisesAJour(plus: Record<string, string> = {}) {
  const b = banc();
  // La première attend une vidéo en cours pendant ~2 s (pas d'1 s), puis redémarre.
  b.poser("fabrications", "1\n1\n0\n");
  const premiere = b.lancerSansAttendre("mettre-a-jour.sh", [], { STUDIO_MAJ_ATTENTE_PAS_SEC: "1", ...plus });
  await quandAttend(b);
  const seconde = b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_ATTENTE_PAS_SEC: "0", ...plus });
  const r1 = await premiere;
  return { b, r1, seconde };
}

describe("Mise en ligne : une seule à la fois (verrou)", () => {
  it("seconde mise à jour pendant la première : refusée (code 5, message clair, qui tient le verrou), rien n'est fait", async () => {
    const { b, r1, seconde } = await deuxMisesAJour();
    expect(seconde.status, seconde.sortie).toBe(5);
    expect(seconde.sortie).toMatch(/tourne déjà/);
    expect(seconde.sortie).toMatch(/PID \d+/);
    // La première va au bout, seule : une construction, un redémarrage.
    expect(r1.status, r1.sortie).toBe(0);
    expect(constructions(b)).toBe(1);
    expect(redemarrages(b)).toBe(1);
  });

  it("verrou rendu après une sortie en erreur : la mise à jour suivante passe", () => {
    const b = banc();
    b.poser("outils-ko");
    expect(b.lancer("mettre-a-jour.sh").status).toBe(1);
    rmSync(join(b.faux, "outils-ko"));
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).not.toMatch(/tourne déjà/);
  });

  it("verrou rendu après un arrêt par prudence (vidéos encore en cours) : la mise à jour suivante passe", () => {
    const b = banc();
    b.poser("fabrications", "1\n");
    expect(b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_ATTENTE_PAS_SEC: "0", STUDIO_MAJ_ATTENTE_MAX_MIN: "0" }).status).toBe(3);
    b.poser("fabrications", "0\n");
    expect(b.lancer("mettre-a-jour.sh").status).toBe(0);
  });

  it("relance (exec) dans la version tirée : le verrou reste tenu pendant toute la relance, sans se bloquer lui-même", () => {
    const b = banc();
    const p = join(b.travail, "deploiement/mettre-a-jour.sh");
    const verrou = join(b.racine, "mise-a-jour.verrou");
    // La version 2 note, à son tout début, si le verrou est libre pour un autre processus.
    const trace = `if flock -n "${verrou}" true 2>/dev/null; then echo LIBRE; else echo TENU; fi >>"$FAUX_DOCKER/traces.log"\n`;
    writeFileSync(p, readFileSync(p, "utf8").replace("set -euo pipefail\n", `set -euo pipefail\n${trace}`));
    sh("git commit -qam v2 && git push -q origin master", b.travail);
    const r = b.lancer("mettre-a-jour.sh");
    expect(r.status, r.sortie).toBe(0);
    expect(r.sortie).toMatch(/relance de mettre-a-jour\.sh/);
    expect(readFileSync(join(b.faux, "traces.log"), "utf8").trim()).toBe("TENU");
    expect(redemarrages(b)).toBe(1);
    // Rendu à la fin.
    expect(spawnSync("flock", ["-n", verrou, "true"]).status).toBe(0);
  });

  it("lancé comme la session 92 (nohup setsid bash …) : la seconde le voit quand même", async () => {
    const b = banc();
    b.poser("fabrications", "1\n1\n0\n");
    const script = join(b.racine, "source/deploiement/mettre-a-jour.sh");
    const premiere = new Promise<number | null>((ok) => {
      const env = { ...process.env, ...b.env, STUDIO_MAJ_ATTENTE_PAS_SEC: "1", GIT_AUTHOR_NAME: "e", GIT_AUTHOR_EMAIL: "e@e.invalid" };
      const p = spawnSync("bash", ["-c", `nohup setsid bash "${script}" >"${b.dossier}/nohup.log" 2>&1 & echo $!`], { env, encoding: "utf8" });
      const pid = Number(p.stdout.trim());
      const attendre = () => {
        try {
          process.kill(pid, 0);
          setTimeout(attendre, 50);
        } catch {
          ok(0);
        }
      };
      attendre();
    });
    await quandAttend(b);
    const seconde = b.lancer("mettre-a-jour.sh", [], { STUDIO_MAJ_ATTENTE_PAS_SEC: "0" });
    await premiere;
    expect(seconde.status, seconde.sortie).toBe(5);
    expect(redemarrages(b)).toBe(1);
  });
});

/** Tient le verrou depuis un autre processus (comme une mise à jour en cours) ; rendu par `rendre()`. */
async function tenirVerrou(b: BancServeur) {
  const verrou = join(b.racine, "mise-a-jour.verrou");
  const p = spawn("flock", [verrou, "sleep", "30"], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    if (spawnSync("flock", ["-n", verrou, "true"]).status !== 0) return { rendre: () => p.kill("SIGKILL") };
    await new Promise((ok) => setTimeout(ok, 50));
  }
  p.kill("SIGKILL");
  throw new Error("verrou jamais tenu");
}

describe("Relecture « À CORRIGER » (7c) : retour arrière et restauration prennent le même verrou", () => {
  it("revenir.sh pendant une mise à jour : refusé (code 5), rien n'est redémarré ni retagué", async () => {
    const b = banc();
    b.poser("images/studio-axion-ia:precedente", "ancienne\n");
    const v = await tenirVerrou(b);
    const r = b.lancer("revenir.sh");
    v.rendre();
    expect(r.status, r.sortie).toBe(5);
    expect(r.sortie).toMatch(/tourne déjà/);
    expect(redemarrages(b)).toBe(0);
    expect(b.image("studio-axion-ia:local")).toBe("en-service");
  });

  it("revenir.sh seul : passe (verrou libre), et le rend à la fin", () => {
    const b = banc();
    b.poser("images/studio-axion-ia:precedente", "ancienne\n");
    const r = b.lancer("revenir.sh");
    expect(r.status, r.sortie).toBe(0);
    expect(spawnSync("flock", ["-n", join(b.racine, "mise-a-jour.verrou"), "true"]).status).toBe(0);
  });

  it("restaurer-base.sh pendant une mise à jour : refusé (code 5), le studio n'est pas arrêté", async () => {
    const b = banc();
    const copie = join(b.dossier, "copie.sql.gz");
    sh(`printf -- '-- dump\\n-- PostgreSQL database dump complete\\n' | gzip >"${copie}"`, b.dossier);
    const v = await tenirVerrou(b);
    const r = b.lancer("restaurer-base.sh", [copie]);
    v.rendre();
    expect(r.status, r.sortie).toBe(5);
    expect(b.appels().some((a) => / compose .*stop studio/.test(a))).toBe(false);
  });
});

describe("Relecture « À CORRIGER » (4) : plus de verrou de secours mkdir (course, PID réattribué)", () => {
  it("le code de production ne connaît plus STUDIO_VERROU_SANS_FLOCK ni le dossier de secours", () => {
    const src = readFileSync(join(__dirname, "../deploiement/commun.sh"), "utf8");
    expect(src).not.toMatch(/STUDIO_VERROU_SANS_FLOCK/);
    expect(src).not.toMatch(/mise-a-jour\.verrou\.d|VERROU_MAJ\.d/);
  });

  it("flock absent : refus net (code 1), rien n'est fait — jamais de mise à jour sans verrou", () => {
    const b = banc();
    // PATH sans flock : un lien vers chaque outil du système, sauf flock.
    const sans = join(b.dossier, "sans-flock");
    mkdirSync(sans);
    for (const dossier of (process.env.PATH ?? "").split(":")) {
      if (!dossier || !existsSync(dossier)) continue;
      for (const nom of readdirSync(dossier)) {
        if (nom === "flock" || existsSync(join(sans, nom))) continue;
        try {
          symlinkSync(join(dossier, nom), join(sans, nom));
        } catch {
          /* nom en double */
        }
      }
    }
    const r = b.lancer("mettre-a-jour.sh", [], { PATH: `${join(b.dossier, "bin")}:${sans}` });
    expect(r.status, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/flock introuvable/);
    expect(b.appels().some((a) => / compose /.test(a))).toBe(false);
  });
});
