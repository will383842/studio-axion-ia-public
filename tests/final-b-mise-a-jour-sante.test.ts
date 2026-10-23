/**
 * Correcteur final B — VERIF-E2E-2, bloquant 2 : `mettre-a-jour.sh` déclarait « en bonne santé » une version où
 * studio-rendu redémarrait en boucle (seul /api/sante était sondé) et la gardait comme référence de retour arrière.
 * Le script est lancé pour de vrai, avec un faux `docker` et un faux `git` (aucun conteneur, aucun réseau).
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const DEPLOIEMENT = join(process.cwd(), "deploiement");
const dossiers: string[] = [];

/** Faux docker : états des services lus dans FAUX_ETATS (« studio-rendu=restarting »), tags notés dans tags.log. */
const FAUX_DOCKER = `#!/usr/bin/env bash
J="$FAUX_JOURNAL"
echo "docker $*" >>"$J/appels.log"
if [ "$1" = compose ]; then
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --env-file) shift 2 ;;
      --profile) shift 2 ;;
      *) break ;;
    esac
  done
  case "$1" in
    ps) for a in "$@"; do s="$a"; done; echo "id-$s" ;;
    exec)
      # Vidéos en cours (psql) : aucune ; sinon la copie de la base (pg_dump).
      if [ "$3" = base ] && [ "$4" = psql ]; then echo 0; exit 0; fi
      if [ "$3" = base ]; then printf -- '-- dump\\nSELECT 1;\\n--\\n-- PostgreSQL database dump complete\\n--\\n'; fi
      exit 0 ;;
    *) exit 0 ;;
  esac
  exit 0
fi
if [ "$1" = inspect ]; then
  for a in "$@"; do id="$a"; done
  s="\${id#id-}"
  etat="$(tr ' ' '\\n' <<<"$FAUX_ETATS" | grep "^$s=" | cut -d= -f2)"
  echo "\${etat:-healthy}"
  exit 0
fi
if [ "$1" = image ]; then
  case "$2" in
    inspect) grep -qx "$3" "$J/images" ;;
    tag) echo "$3 -> $4" >>"$J/tags.log"; echo "$4" >>"$J/images" ;;
    *) exit 0 ;;
  esac
  exit $?
fi
exit 0
`;

const FAUX_GIT = `#!/usr/bin/env bash
case "$*" in
  *rev-parse*) echo abc1234 ;;
esac
exit 0
`;

interface Resultat {
  code: number | null;
  sortie: string;
  tags: string[];
  appels: string;
  racine: string;
}

function lancer(script: "mettre-a-jour.sh" | "revenir.sh", env: string, etats = ""): Resultat {
  const racine = mkdtempSync(join(tmpdir(), "studio-maj-"));
  dossiers.push(racine);
  const bin = join(racine, "bin");
  const journal = join(racine, "journal");
  mkdirSync(bin);
  mkdirSync(journal);
  mkdirSync(join(racine, "source/deploiement"), { recursive: true });
  writeFileSync(join(bin, "docker"), FAUX_DOCKER);
  writeFileSync(join(bin, "git"), FAUX_GIT);
  chmodSync(join(bin, "docker"), 0o755);
  chmodSync(join(bin, "git"), 0o755);
  writeFileSync(join(racine, ".env"), env);
  // Images en service avant la mise à jour (et une version saine connue).
  writeFileSync(join(journal, "images"), ["studio-axion-ia:local", "studio-rendu:local", "studio-aligneur:local", "studio-axion-ia:precedente", "studio-rendu:precedente", "studio-aligneur:precedente"].join("\n") + "\n");
  const r = spawnSync("bash", [join(DEPLOIEMENT, script)], {
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: racine,
      STUDIO_RACINE: racine,
      STUDIO_ATTENTE_SANTE_SEC: "2",
      STUDIO_INTERVALLE_SANTE_SEC: "1",
      FAUX_JOURNAL: journal,
      FAUX_ETATS: etats,
    } as unknown as NodeJS.ProcessEnv,
  });
  const tagsLog = join(journal, "tags.log");
  return {
    code: r.status,
    sortie: `${r.stdout}\n${r.stderr}`,
    tags: existsSync(tagsLog) ? readFileSync(tagsLog, "utf8").trim().split("\n") : [],
    appels: existsSync(join(journal, "appels.log")) ? readFileSync(join(journal, "appels.log"), "utf8") : "",
    racine,
  };
}

afterAll(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

const ENV_SANS_CALAGE = "STUDIO_RENDU_CLE=cle-factice\nSTUDIO_ALIGNEUR_URL=\n";
const ENV_CALAGE = 'STUDIO_RENDU_CLE=cle-factice\nSTUDIO_ALIGNEUR_URL="http://studio-aligneur:4200"\n';

describe("mettre-a-jour.sh : la santé des 4 services avant « en bonne santé »", () => {
  it("studio-rendu redémarre en boucle (incident du 04/10) : échec, code 1, aucun tag `bonne`", () => {
    const r = lancer("mettre-a-jour.sh", ENV_SANS_CALAGE, "studio-rendu=restarting");
    expect(r.code).toBe(1);
    expect(r.sortie).not.toContain("Studio à jour et en bonne santé");
    expect(r.sortie).toContain("studio-rendu : restarting");
    expect(r.sortie).toContain("revenir.sh");
    expect(r.tags.filter((t) => t.endsWith(":bonne"))).toEqual([]);
  });

  it("la base n'est pas saine : échec, aucun tag `bonne`", () => {
    const r = lancer("mettre-a-jour.sh", ENV_SANS_CALAGE, "base=unhealthy");
    expect(r.code).toBe(1);
    expect(r.tags.filter((t) => t.endsWith(":bonne"))).toEqual([]);
  });

  it("calage actif (adresse entre guillemets) : studio-aligneur construit, attendu sain ; en panne → échec", () => {
    const r = lancer("mettre-a-jour.sh", ENV_CALAGE, "studio-aligneur=unhealthy");
    expect(r.appels).toMatch(/--profile calage build studio studio-rendu studio-aligneur/);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("studio-aligneur : unhealthy");
    expect(r.tags.filter((t) => t.endsWith(":bonne"))).toEqual([]);
  });

  it("tout est sain : succès, `bonne` posé image par image, copie de la base vérifiée avant le redémarrage", () => {
    const r = lancer("mettre-a-jour.sh", ENV_CALAGE);
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("Studio à jour et en bonne santé : abc1234");
    expect(r.tags).toEqual(expect.arrayContaining(["studio-axion-ia:local -> studio-axion-ia:bonne", "studio-rendu:local -> studio-rendu:bonne", "studio-aligneur:local -> studio-aligneur:bonne"]));
    const copies = readdirSync(join(r.racine, "sauvegardes")).filter((f) => /^avant-maj-.*\.sql\.gz$/.test(f));
    expect(copies).toHaveLength(1);
    // La copie est faite AVANT le redémarrage (donc avant la migration au démarrage).
    expect(r.appels.indexOf("pg_dump")).toBeLessThan(r.appels.indexOf(" up -d"));
  });

  it("sans calage : studio-aligneur n'est ni attendu ni marqué `bonne`", () => {
    const r = lancer("mettre-a-jour.sh", ENV_SANS_CALAGE, "studio-aligneur=absent");
    expect(r.code).toBe(0);
    expect(r.tags.some((t) => t.includes("studio-aligneur:bonne"))).toBe(false);
  });

  it("clé partagée vide : arrêt avant toute construction (studio-rendu refuserait de démarrer)", () => {
    const r = lancer("mettre-a-jour.sh", 'STUDIO_RENDU_CLE=""\n');
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("STUDIO_RENDU_CLE manquante");
    expect(r.appels).not.toMatch(/ build /);
  });
});

describe("revenir.sh : même contrôle avant de reprendre une version comme référence", () => {
  it("studio-rendu malade après le retour : échec, aucun tag `bonne`", () => {
    const r = lancer("revenir.sh", ENV_SANS_CALAGE, "studio-rendu=unhealthy");
    expect(r.code).toBe(1);
    expect(r.tags.filter((t) => t.endsWith(":bonne"))).toEqual([]);
  });

  it("tout est sain : `bonne` posé", () => {
    const r = lancer("revenir.sh", ENV_SANS_CALAGE);
    expect(r.code).toBe(0);
    expect(r.tags).toContain("studio-rendu:local -> studio-rendu:bonne");
  });
});
