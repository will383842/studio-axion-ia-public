/**
 * VÉRIFICATION E2E-1 n° 1 (MAJEUR) et n° 4 — variables d'environnement.
 * Le compose ne transmet au conteneur QUE les variables listées (pas d'`env_file`) : une variable lue par le code mais
 * absente du compose n'arrive jamais en production (coupure de secours inopérante, mesures en mode essai). Ce test lit
 * le code et échoue dès qu'une variable lue n'est ni transmise par le compose ni déclarée « développement seulement ».
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");
const compose = readFileSync(join(RACINE, "deploiement/docker-compose.yml"), "utf8");
const exemple = readFileSync(join(RACINE, "deploiement/env.exemple"), "utf8");

/** Fixées par Node, Next ou les tests : jamais posées à la main. */
// NEXT_PHASE : posée par `next build` lui-même (E2E-2 données n° 7, le refus de démarrer sans base l'ignore à la construction).
// NODE_OPTIONS (relecture paquet 4) : lue par l'import de fichiers pour garder la borne mémoire de son fil ; variable de Node.
const SYSTEME = new Set(["NODE_ENV", "NEXT_RUNTIME", "NEXT_PHASE", "VITEST", "NODE_OPTIONS"]);
/** Développement seulement (ignorées en production) : documentées dans env.exemple, JAMAIS transmises par le compose. */
// STUDIO_SANS_BASE : essai LOCAL volontaire d'un serveur construit sans base ; jamais dans le compose (E2E-2 données n° 7).
// GOOGLE_DRIVE_ESSAI (lot E2 facecam) : écrans de repli du double Google Drive ; ignorée quand NODE_ENV=production.
const DEVELOPPEMENT = new Set(["STUDIO_APERCU_MESURES", "CREDITS_ESSAI", "STUDIO_SIMULATION_LENTEUR_MS", "STUDIO_SANS_BASE", "GOOGLE_DRIVE_ESSAI"]);
/**
 * ÉTEINTES VOLONTAIREMENT (lot M4b, Remotion Lambda « écrit, éteint ») : transmises à `studio-rendu` seulement ; le
 * studio ne les reçoit pas, donc n'inscrit jamais Lambda. Le compose le dit en commentaire (à relier le jour où Will
 * ouvre AWS). Les clés AWS ne vont pas dans un conteneur qui n'en a pas besoin.
 */
const ETEINTES = new Set(["REMOTION_LAMBDA_ACTIVE", "REMOTION_LAMBDA_REGION", "REMOTION_LAMBDA_FONCTION", "REMOTION_LAMBDA_SITE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

/** Variables lues par le code du studio (`process.env.X`, `env.X`, `cleDans(env, "X")`, `VARIABLE_… = "X"`). */
function variablesLues(): Set<string> {
  const vues = new Set<string>();
  const motifs = [/process\.env\.([A-Z][A-Z0-9_]+)/g, /process\.env\[\s*"([A-Z][A-Z0-9_]+)"\s*\]/g, /\benv\.([A-Z][A-Z0-9_]+)/g, /cleDans\(\s*env\s*,\s*"([A-Z][A-Z0-9_]+)"/g, /VARIABLE_[A-Z_]+\s*=\s*"([A-Z][A-Z0-9_]+)"/g];
  for (const f of fichiers(join(RACINE, "src"))) {
    const texte = readFileSync(f, "utf8");
    for (const m of motifs) for (const r of texte.matchAll(m)) vues.add(r[1]);
  }
  return vues;
}

/** Variables transmises au service `studio` du compose. */
function transmisesAuStudio(): Set<string> {
  const bloc = compose.slice(compose.indexOf("\n  studio:"), compose.indexOf("\n  studio-rendu:"));
  return new Set([...bloc.matchAll(/^\s{6}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]));
}

describe("E2E-1 n° 1 · toute variable lue par le code arrive au conteneur", () => {
  const lues = variablesLues();
  const transmises = transmisesAuStudio();

  it("le relevé du code trouve bien les variables du générateur (le test n'est pas aveugle)", () => {
    for (const v of ["PLAUSIBLE_KEY", "PLAUSIBLE_URL", "PLAUSIBLE_SITE", "BUFFER_API_KEY", "STUDIO_BOUCLE_GENERATION", "ANTHROPIC_API_KEY", "STUDIO_APERCU_MESURES"]) expect(lues.has(v), v).toBe(true);
  });

  it("chaque variable lue est transmise au studio, sauf les variables système et de développement", () => {
    const manquantes = [...lues].filter((v) => !SYSTEME.has(v) && !DEVELOPPEMENT.has(v) && !ETEINTES.has(v) && !transmises.has(v)).sort();
    expect(manquantes).toEqual([]);
  });

  it("les cinq variables du rapport, et les deux coupures de secours, sont dans le compose sous la forme ${VAR:-}", () => {
    for (const v of ["PLAUSIBLE_KEY", "PLAUSIBLE_URL", "PLAUSIBLE_SITE", "BUFFER_API_KEY", "STUDIO_BOUCLE_GENERATION", "STUDIO_BOUCLE", "FOURNISSEUR_SCRIPT"]) {
      expect(compose, v).toContain(`${v}: \${${v}:-}`);
    }
  });

  it("les variables de développement ne sont JAMAIS transmises en production", () => {
    for (const v of DEVELOPPEMENT) expect(transmises.has(v), v).toBe(false);
  });

  it("env.exemple documente chaque variable du compose (sauf celles que le compose fixe lui-même), sans aucune valeur", () => {
    const fixees = new Set(["DATABASE_URL", "STUDIO_ENTETE_IP"]);
    const lignes = exemple.split(/\r?\n/);
    for (const v of transmises) {
      if (fixees.has(v)) continue;
      expect(lignes.some((l) => l === `${v}=`), v).toBe(true);
    }
    // Aucune valeur réelle : toute ligne active est « NOM= » vide.
    for (const l of lignes.filter((x) => /^[A-Z][A-Z0-9_]*=/.test(x))) expect(l, l).toMatch(/^[A-Z][A-Z0-9_]*=$/);
    // Variables de développement : seulement en commentaire.
    for (const v of DEVELOPPEMENT) {
      expect(exemple).toContain(`# ${v}`);
      expect(lignes.some((l) => l.startsWith(`${v}=`)), v).toBe(false);
    }
  });

  it("plus de commentaire périmé « Plus tard : Claude » (la clé est posée, Claude écrit les scripts)", () => {
    expect(compose).not.toMatch(/Plus tard \(aucune clé aujourd'hui\)/);
    expect(exemple).not.toMatch(/Plus tard : Claude/);
  });
});
