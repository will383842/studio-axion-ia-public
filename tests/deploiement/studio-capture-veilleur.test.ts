/**
 * POSTE-2 · veilleur du poste de capture (script root côté hôte) : lecture du TEXTE du script, du compose et des unités,
 * puis EXÉCUTIONS sans root ni docker (mode essai explicite VEILLEUR_TEST=1 + faux docker/mount/… en tête du PATH).
 * Aucun réseau, aucune IA, aucune dépense.
 */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const CHEMIN_SCRIPT = join(RACINE, "deploiement/studio-capture/veilleur.sh");
const brut = readFileSync(CHEMIN_SCRIPT, "utf8");
const sansCommentaires = (t: string) =>
  t
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
const script = sansCommentaires(brut);
const compose = readFileSync(join(RACINE, "deploiement/docker-compose.yml"), "utf8");
const service = readFileSync(join(RACINE, "deploiement/studio-capture/studio-capture-veilleur.service"), "utf8");
const minuterie = readFileSync(join(RACINE, "deploiement/studio-capture/studio-capture-veilleur.timer"), "utf8");

/** Liste fermée du plan §3 (comparée à contrat.ts de POSTE-3 s'il existe). */
const TYPES = ["film-zip", "film-description", "apercu"];
const CODES = [
  "OK", "DEMANDE_INVALIDE", "ZIP_REFUSE", "MAQUETTE_INTROUVABLE", "CONTROLE_SOURCE", "TROP_GROS", "CAPTURE_ECHEC",
  "DUREE_DEPASSEE", "FILM_INVALIDE", "EMPREINTE", "INTERROMPU", "POSTE_OCCUPE",
];

function blocService(nom: string): string {
  const lignes = compose.split("\n");
  const debut = lignes.findIndex((l) => l === `  ${nom}:`);
  if (debut < 0) return "";
  const out: string[] = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i]!;
    if ((/^\S/.test(l) || /^  \S/.test(l)) && !/^\s*#/.test(l)) break;
    out.push(l);
  }
  return sansCommentaires(out.join("\n"));
}

describe("POSTE-2 · texte du script", () => {
  it("bash -n passe ; bash strict, umask 077, PATH fixé, flock, une seule option --une-fois", () => {
    execFileSync("bash", ["-n", CHEMIN_SCRIPT]);
    expect(brut.split("\n")[0]).toBe("#!/bin/bash");
    expect(script).toMatch(/^set -euo pipefail$/m);
    expect(script).toMatch(/^umask 077$/m);
    expect(script).toMatch(/^PATH=\/usr\/local\/sbin:/m);
    expect(script).toMatch(/if ! flock -n 9; then\n\s+pouls \|\| true\n\s+exit 0\nfi/);
    expect(script).toContain('"$1" = "--une-fois"');
  });
  it("ne lit aucun JSON : ni jq, ni node, ni python, ni parseur", () => {
    expect(script).not.toMatch(/\b(jq|node|python3?|perl|ruby|tsx|npx|eval)\b/);
  });
  it("mv -T pour la prise ET la remise ; copies par cp --no-dereference seulement", () => {
    expect(script).toMatch(/mv -T -- "\$BOITE\/demandes\/\$1" "\$V\/travail-\$1"/);
    expect(script).toMatch(/mv -T -- "\$r" "\$BOITE\/reponses\/\$NOM"/);
    // le film est DÉPLACÉ dans la réponse (même système de fichiers), jamais recopié une seconde fois
    expect(script).toMatch(/mv -T -- "\$res\/\$f" "\$r\/\$f"/);
    const cp = script.split("\n").filter((l) => /\bcp\b/.test(l));
    expect(cp.length).toBeGreaterThanOrEqual(2);
    for (const l of cp) expect(l, l).toMatch(/timeout -k 10 "\$COPIE_S" cp -R --no-dereference/);
    expect(script).not.toMatch(/\b(rsync|tar|unzip)\b|cp -L|cp -a|cp -H/);
  });
  it("chaque `docker compose … run` est précédé du double `docker ps -aq` (nom ET label) dans la même fonction", () => {
    const lignes = script.split("\n");
    const runs = lignes.map((l, i) => (/docker compose .* run /.test(l) ? i : -1)).filter((i) => i >= 0);
    expect(runs).toHaveLength(1);
    const debutFonction = lignes.slice(0, runs[0]).findLastIndex((l) => /^lancer_conteneur\(\)/.test(l));
    expect(debutFonction).toBeGreaterThanOrEqual(0);
    expect(lignes.slice(debutFonction, runs[0]).join("\n")).toMatch(/poste_libre \|\| arret panne POSTE_OCCUPE/);
    expect(script).toMatch(/docker ps -aq --filter name=studio-capture\)/);
    expect(script).toMatch(/docker ps -aq --filter label=com\.docker\.compose\.service=studio-capture\)/);
    // /sortie neuf : le contrôle précède toute action sur /sortie
    expect(script).toMatch(/sortie_neuve\(\) \{\n\s+poste_libre \|\| arret panne POSTE_OCCUPE\n\s+boucle_neuve/);
  });
  it("forme `timeout <délai> docker wait … || docker kill` (960 s, 120 s pour verifier), puis docker inspect, logs bornés, rm -f", () => {
    expect(script).toMatch(/timeout -k 10 "\$delai" docker wait "\$nom" >\/dev\/null \|\| timeout -k 10 60 docker kill "\$nom"/);
    expect(script).toContain("DELAI_ETAPE_S=960");
    expect(script).toContain("DELAI_VERIFIER_S=120");
    expect(script).toMatch(/if \[ "\$1" = verifier \]; then delai=\$DELAI_VERIFIER_S/);
    expect(script).toContain("docker inspect -f '{{.State.ExitCode}}'");
    expect(script).toContain("tail -c 8192");
    expect(script).toMatch(/docker rm -f "\$nom"/);
  });
  it("docker compose : --env-file du .env réel, -f et --project-directory fixés, COMPOSE_* vidées, --pull never, run -d sous timeout, image vérifiée avant", () => {
    const l = script.split("\n").filter((x) => /docker compose .* run /.test(x));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatch(/timeout -k 10 120 env -u COMPOSE_FILE -u COMPOSE_PROFILES -u COMPOSE_PROJECT_NAME -u COMPOSE_ENV_FILES /);
    expect(l[0]).toContain('docker compose -p "$PROJET_COMPOSE" --env-file "$ENV_FICHIER" --project-directory "$DEPLOIEMENT" -f "$DEPLOIEMENT/docker-compose.yml" --profile capture run -d --pull never --name');
    expect(l[0]).not.toMatch(/--build/);
    expect(script).toContain('readonly ENV_FICHIER="$RACINE/.env"');
    expect(script).toMatch(/docker image inspect studio-capture:local[^\n]*\|\| arret panne CAPTURE_ECHEC\n\s+poste_libre/);
    expect(script).toMatch(/docker-compose\.override\.yml .*compose\.yaml/);
  });
  it("pouls : fichier temporaire propre au processus, chmod AVANT mv -T ; la boîte doit être un point de montage ; ffprobe lu en octets bornés", () => {
    expect(script).toMatch(/tmp="\$V\/pouls\.\$\$\.tmp"/);
    expect(script).toMatch(/chmod 0444 "\$tmp" && mv -T -- "\$tmp" "\$BOITE\/pouls"/);
    expect(script).not.toMatch(/chmod 0444 "\$BOITE\/pouls"/);
    expect(script).toMatch(/monte "\$BOITE" \|\| refuser_config/);
    expect(script).toMatch(/head -c \$\(\(MAX_FFPROBE \+ 1\)\)/);
    expect(script).not.toMatch(/reprendre \|\| true/);
  });
  it("aucun --entrypoint, -v, --volume, -e, --env, docker.sock, --privileged, network", () => {
    for (const motif of [/--entrypoint/, / -v /, /--volume/, /--env(?!-file)\b/, /docker\.sock/, /--privileged/, /network/]) {
      expect(script, String(motif)).not.toMatch(motif);
    }
    // ` -e ` : permis pour realpath/ls, jamais sur une ligne docker
    for (const l of script.split("\n").filter((x) => /\bdocker\b/.test(x))) expect(l, l).not.toMatch(/ -e /);
  });
  it("tous les `mount -o` portent nodev,nosuid,noexec", () => {
    const m = script.split("\n").filter((l) => /\bmount -o\b/.test(l));
    expect(m.length).toBeGreaterThanOrEqual(3);
    for (const l of m) expect(l, l).toMatch(/nodev,nosuid,noexec/);
    expect(script).toMatch(/mount -o remount,ro,nodev,nosuid,noexec/);
  });
  it("liste fermée des types et des codes = plan §3", () => {
    const motif = /readonly REGEX_NOM='\^\((.+)\)--/.exec(script);
    expect(motif?.[1]?.split("|")).toEqual(TYPES);
    const codes = /readonly CODES="([^"]+)"/.exec(script);
    expect(codes?.[1]?.trim().split(/\s+/)).toEqual(CODES);
    const contrat = join(RACINE, "src/moteurs/montage-tutoriel-outil/capture-auto/contrat.ts");
    if (existsSync(contrat)) {
      const t = readFileSync(contrat, "utf8");
      for (const c of CODES) expect(t, c).toContain(`"${c}"`);
      for (const ty of TYPES) expect(t, ty).toContain(`"${ty}"`);
    }
  });
  it("film-description et apercu : refus immédiat, aucun conteneur (construire reporté à POSTE-1b)", () => {
    expect(brut).toContain("POSTE-1b");
    expect(script).toMatch(/film-description \| apercu\) arret refus DEMANDE_INVALIDE/);
    expect(script).not.toMatch(/\bconstruire\b/);
  });
  it("le mode essai est fermé : variables refusées sans VEILLEUR_TEST=1, script installé refusé", () => {
    expect(script).toMatch(/VEILLEUR_RACINE VEILLEUR_PATH_TEST VEILLEUR_VERROU/);
    expect(script).toMatch(/\/usr\/local\/sbin\/\* \|/);
    expect(script).toContain('[ "$(id -u)" = 0 ] || refuser_config');
  });
});

describe("POSTE-2 · compose et unités", () => {
  const studio = blocService("studio");
  it("le service studio a UNE entrée volumes, vers /var/studio-capture, défaut hors dépôt, variable non obligatoire", () => {
    const vols = studio.split("\n").filter((l) => /^\s+- .*:\/.*/.test(l));
    expect(vols).toEqual(["      - ${STUDIO_CAPTURE_BOITE:-/opt/studio-axion-ia/capture-boite}:/var/studio-capture"]);
    expect(studio).not.toMatch(/STUDIO_CAPTURE_BOITE:\?/);
    expect(studio).not.toMatch(/docker\.sock|privileged|cap_add|devices/);
    expect(studio).toMatch(/networks: \[interne, coolify\]/);
    expect(studio).not.toMatch(/^\s{6}STUDIO_CAPTURE/m);
  });
  it("studio-capture garde profil capture, réseau none et mentionne le veilleur dans le commentaire", () => {
    const cap = blocService("studio-capture");
    expect(cap).toMatch(/profiles: \[capture\]/);
    expect(cap).toMatch(/network_mode: none/);
    expect(compose).toContain("Déclenchement automatique : `studio-capture/veilleur.sh`");
    // la phrase « Déclenchement À LA MAIN seulement, depuis deploiement/ ; … » n'est pas coupée ; la mention suit « Le point d'entrée est lancer.sh. »
    const l = compose.split("\n");
    const i = l.findIndex((x) => x.includes("Déclenchement automatique : `studio-capture/veilleur.sh`"));
    expect(l[i - 1]).toMatch(/Le point d'entrée est lancer\.sh\.$/);
    expect(l[i - 3]).toMatch(/Déclenchement À LA MAIN seulement,$/);
    expect(l[i - 2]).toMatch(/^\s+# depuis deploiement\/ ;/);
  });
  it("service systemd oneshot, minuterie 30 s, rien d'activé par défaut", () => {
    expect(service).toMatch(/^Type=oneshot$/m);
    expect(service).toMatch(/^ExecStart=\/opt\/studio-axion-ia\/source\/deploiement\/studio-capture\/veilleur\.sh --une-fois$/m);
    expect(service).toMatch(/^Environment=VEILLEUR_BOITE=\/opt\/studio-axion-ia\/capture-boite$/m);
    expect(service).toMatch(/^Environment=DEPLOIEMENT=\/opt\/studio-axion-ia\/source\/deploiement$/m);
    // lancé DEPUIS le clone : plus aucune copie dans /usr/local/sbin
    expect(service.split("\n").filter((x) => !x.startsWith("#")).join("\n")).not.toMatch(/sbin/);
    expect(service).not.toMatch(/VEILLEUR_TEST|VEILLEUR_RACINE|VEILLEUR_PATH_TEST/);
    // 3 étapes de 960 s + marge, et une seule demande par passage
    const delai = Number(/^TimeoutStartSec=(\d+)$/m.exec(service)?.[1]);
    expect(delai).toBeGreaterThanOrEqual(3 * 960 + 300);
    expect(delai).toBeLessThan(3600);
    // pas de PrivateTmp/ProtectSystem… (les boucles doivent être visibles de dockerd) : expliqué dans l'unité
    expect(service.split("\n").filter((x) => !x.startsWith("#")).join("\n")).not.toMatch(/PrivateTmp|ProtectSystem|ProtectHome|PrivateMounts/);
    expect(service).toMatch(/# VOLONTAIREMENT SANS PrivateTmp, ProtectSystem/);
    expect(service).toMatch(/VISIBLES de dockerd/);
    expect(service).toMatch(/^Nice=10$/m);
    expect(service).toMatch(/^IOSchedulingClass=idle$/m);
    expect(minuterie).toMatch(/^OnBootSec=2min$/m);
    expect(minuterie).toMatch(/^OnUnitInactiveSec=30s$/m);
    expect(minuterie).toMatch(/^AccuracySec=5s$/m);
    expect(minuterie).toMatch(/^Persistent=false$/m);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Exécutions : faux docker & co, boîte temporaire, SANS root
// ---------------------------------------------------------------------------------------------------------------------
const FAUX_OUTILS = (faux: string): Record<string, string> => ({
  docker: `#!/bin/bash
# Points de rendez-vous des essais de concurrence : si « bloquer » existe, le premier appel signale « bloque » puis attend
# « libere » (au plus 30 s : jamais d'attente sans fin).
if [ -f "${faux}/bloquer" ]; then
  touch "${faux}/bloque"
  for _ in $(seq 1 600); do [ -f "${faux}/libere" ] && break; sleep 0.05; done
fi
echo "docker $*" >> "${faux}/appels"
case "$1" in
  ps) [ -f "${faux}/occupe" ] && cat "${faux}/occupe"; exit 0 ;;
  compose)
    shift; while [ "$1" != "studio-capture" ]; do [ "$1" = "--name" ] && nom=$2; shift; done; shift
    mode=$1
    echo "env $mode ENTREE=$STUDIO_CAPTURE_ENTREE SORTIE=$STUDIO_CAPTURE_SORTIE MAQ=\${STUDIO_CAPTURE_MAQUETTE:-}" >> "${faux}/appels"
    echo "$mode $(stat -c %a "$STUDIO_CAPTURE_MAQUETTE") $(ls -A "$STUDIO_CAPTURE_MAQUETTE" | wc -l)" >> "${faux}/maquette-vue"
    touch "${faux}/ctr-$nom"; echo "$mode" > "${faux}/mode-$nom"
    case "$mode" in
      decompresser) [ -f "${faux}/lent" ] && sleep 3
                    [ -f "${faux}/pas-de-maquette" ] || { mkdir -p "$STUDIO_CAPTURE_SORTIE/maquette/site"; echo "<html>" > "$STUDIO_CAPTURE_SORTIE/maquette/site/index.html"; }
                    [ -f "${faux}/lien-dans-sortie" ] && ln -s /etc/passwd "$STUDIO_CAPTURE_SORTIE/maquette/site/lien" ;;
      capturer) mkdir -p "$STUDIO_CAPTURE_SORTIE/film-abc"; echo "MP4" > "$STUDIO_CAPTURE_SORTIE/film-abc/navigation.mp4"; echo "{}" > "$STUDIO_CAPTURE_SORTIE/film-abc/navigation.json" ;;
      verifier) if [ -f "${faux}/ffprobe-lien" ]; then ln -s /dev/null "$STUDIO_CAPTURE_SORTIE/ffprobe.json"
                  elif [ -f "${faux}/ffprobe-dossier" ]; then mkdir "$STUDIO_CAPTURE_SORTIE/ffprobe.json"
                  elif [ -f "${faux}/ffprobe-gros" ]; then head -c 70000 /dev/zero | tr '\\0' 'x' > "$STUDIO_CAPTURE_SORTIE/ffprobe.json"; else echo "{}" > "$STUDIO_CAPTURE_SORTIE/ffprobe.json"; fi
                  ls "$STUDIO_CAPTURE_ENTREE" > "${faux}/entree-verifier" ;;
    esac
    echo "$nom" ;;
  wait) exit 0 ;;
  kill) echo "kill $2" >> "${faux}/kills"; m=$(cat "${faux}/mode-$2" 2>/dev/null); echo 137 > "${faux}/rc-$m"; exit 0 ;;
  inspect) m=$(cat "${faux}/mode-\${@: -1}" 2>/dev/null); if [ -f "${faux}/rc-$m" ]; then cat "${faux}/rc-$m"; else echo 0; fi ;;
  logs) if [ -f "${faux}/logs" ]; then cat "${faux}/logs"; else echo "journal du poste"; fi ;;
  image) exit \$([ -f "${faux}/pas-d-image" ] && echo 1 || echo 0) ;;
  rm) rm -f "${faux}/ctr-\${@: -1}"; exit 0 ;;
esac
`,
  mount: `#!/bin/bash
echo "mount $*" >> "${faux}/appels"
m=$(cat "${faux}/mount-echoue" 2>/dev/null); if [ -n "$m" ] && [[ "$*" == *"$m"* ]]; then exit 1; fi
[ "$1" = "-o" ] && case "$2" in remount*) exit 0 ;; esac
dir="\${@: -1}"; find "$dir" -mindepth 1 -delete; echo "$dir" >> "${faux}/montes"
`,
  umount: `#!/bin/bash
echo "umount $*" >> "${faux}/appels"
if [ -f "${faux}/umount-echoue-maquette" ] && [[ "$1" == */capture-maquettes/* ]]; then exit 1; fi
find "$1" -mindepth 1 -delete 2>/dev/null
grep -vx "$1" "${faux}/montes" > "${faux}/montes.n" || true; mv "${faux}/montes.n" "${faux}/montes"
`,
  timeout: `#!/bin/bash
echo "timeout-brut $*" >> "${faux}/delais-bruts"
orig=("$@")
if [ "$1" = -k ]; then shift 2; fi
echo "timeout $*" >> "${faux}/delais"
if [ "$2" = docker ] && [ "$3" = wait ] && [ -f "${faux}/timeout-124" ]; then exit 124; fi
if [ "$2" = cp ] && [ -f "${faux}/timeout-cp" ]; then exit 124; fi
exec /usr/bin/timeout "\${orig[@]}"
`,
  mv: `#!/bin/bash
# $1=-T $2=-- $3=source $4=destination
if [ -f "${faux}/disparait" ] && [[ "$3" == */demandes/* ]]; then rm -rf "$3"; exit 1; fi
if [ -f "${faux}/mv-reponse-echoue" ] && [[ "$4" == */reponses/* ]]; then exit 1; fi
echo "mv $*" >> "${faux}/mouvements"
exec /usr/bin/mv "$@"
`,
  mountpoint: `#!/bin/bash
grep -qx "$2" "${faux}/montes" 2>/dev/null
`,
  "mkfs.ext4": `#!/bin/bash\n[ -f "${faux}/mkfs-echoue" ] && exit 1\nexit 0\n`,
  fallocate: `#!/bin/bash\ntouch "\${@: -1}"\n`,
  chown: `#!/bin/bash
m=$(cat "${faux}/chown-echoue" 2>/dev/null); if [ -n "$m" ] && [[ "$*" == *"$m"* ]]; then exit 1; fi
exit 0
`,
});

interface Banc {
  dossier: string; boite: string; racine: string; faux: string; deploiement: string;
  lancer: (extra?: Record<string, string | undefined>, args?: string[]) => ReturnType<typeof spawnSync>;
  demande: (nom: string, fichiers?: Record<string, string>) => string;
  appels: () => string[];
}
const dossiers: string[] = [];
function banc(): Banc {
  const dossier = mkdtempSync(join(tmpdir(), "veilleur-"));
  dossiers.push(dossier);
  const boite = join(dossier, "boite");
  const racine = join(dossier, "opt");
  const faux = join(dossier, "faux");
  const deploiement = join(dossier, "deploiement");
  for (const d of [boite, racine, faux, deploiement, join(boite, "demandes"), join(boite, "reponses"), join(boite, ".veilleur")]) mkdirSync(d, { recursive: true });
  for (const d of ["capture-sortie", "capture-entree", "capture-maquettes", "capture-maquettes-img", "capture-veilleur"]) mkdirSync(join(racine, d));
  writeFileSync(join(boite, "PRET"), "");
  chmodSync(join(boite, "PRET"), 0o444);
  chmodSync(join(boite, ".veilleur"), 0o700);
  writeFileSync(join(deploiement, "docker-compose.yml"), "name: essai\n");
  mkdirSync(join(dossier, "outils/maquettes-tableaux-de-bord/charte"), { recursive: true });
  chmodSync(join(deploiement, "docker-compose.yml"), 0o644);
  mkdirSync(join(deploiement, "studio-capture"));
  writeFileSync(join(deploiement, "studio-capture/seccomp.json"), "{}");
  writeFileSync(join(deploiement, "studio-capture/veilleur.sh"), "#!/bin/bash\n");
  chmodSync(join(deploiement, "studio-capture/veilleur.sh"), 0o755);
  for (const d of ["outils", "outils/maquettes-tableaux-de-bord", "outils/maquettes-tableaux-de-bord/charte", "deploiement/studio-capture"]) chmodSync(join(dossier, d), 0o755);
  writeFileSync(join(racine, ".env"), "POSTGRES_PASSWORD=x\n");
  for (const d of [boite, racine, deploiement, join(racine, "capture-maquettes"), join(racine, "capture-maquettes-img"), join(racine, "capture-veilleur")]) chmodSync(d, 0o755);
  chmodSync(join(racine, ".env"), 0o600);
  for (const [nom, contenu] of Object.entries(FAUX_OUTILS(faux))) {
    writeFileSync(join(faux, nom), contenu);
    chmodSync(join(faux, nom), 0o755);
  }
  writeFileSync(join(faux, "montes"), `${boite}\n`);
  const lancer: Banc["lancer"] = (extra = {}, args = ["--une-fois"]) =>
    spawnSync("bash", [CHEMIN_SCRIPT, ...args], {
      encoding: "utf8",
      env: {
        PATH: "/usr/local/bin:/usr/bin:/bin",
        VEILLEUR_TEST: "1", VEILLEUR_RACINE: racine, VEILLEUR_PATH_TEST: faux, VEILLEUR_BOITE: boite, DEPLOIEMENT: deploiement,
        ...extra,
      } as NodeJS.ProcessEnv,
    });
  const demande = (nom: string, fichiers?: Record<string, string>) => {
    const d = join(boite, "demandes", nom);
    mkdirSync(d);
    for (const [f, c] of Object.entries(fichiers ?? { "dossier.zip": "PK", "scenario.json": "{}", "calage.json": "{}" })) writeFileSync(join(d, f), c);
    return d;
  };
  const appels = () => (existsSync(join(faux, "appels")) ? readFileSync(join(faux, "appels"), "utf8").trim().split("\n") : []);
  return { dossier, boite, racine, faux, deploiement, lancer, demande, appels };
}
afterAll(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const etat = (b: Banc, nom: string) => readFileSync(join(b.boite, "reponses", nom, "etat.txt"), "utf8");
const NOM = "film-zip--abcdef123456";

describe("POSTE-2 · refus de configuration (code 2, avant toute commande docker)", { timeout: 30_000 }, () => {
  it("DEPLOIEMENT absent : code 2", () => {
    const b = banc();
    const r = b.lancer({ DEPLOIEMENT: undefined });
    expect(r.status).toBe(2);
    expect(b.appels()).toEqual([]);
  });
  it("PRET absent : code 2, docker jamais appelé", () => {
    const b = banc();
    rmSync(join(b.boite, "PRET"));
    expect(b.lancer().status).toBe(2);
    expect(b.appels()).toEqual([]);
  });
  it("PRET en lien symbolique, .veilleur trop ouvert, compose inscriptible par tous : code 2", () => {
    let b = banc();
    rmSync(join(b.boite, "PRET"));
    symlinkSync("/etc/hostname", join(b.boite, "PRET"));
    expect(b.lancer().status).toBe(2);
    b = banc();
    chmodSync(join(b.boite, ".veilleur"), 0o755);
    expect(b.lancer().status).toBe(2);
    b = banc();
    chmodSync(join(b.deploiement, "docker-compose.yml"), 0o666);
    expect(b.lancer().status).toBe(2);
    expect(b.appels()).toEqual([]);
  });
  it("boîte inscriptible par le groupe/les autres, ou propriétaire autre : code 2 (docker jamais appelé)", () => {
    for (const mode of [0o770, 0o757, 0o777]) {
      const b = banc();
      chmodSync(b.boite, mode);
      const r = b.lancer();
      expect(r.status, mode.toString(8)).toBe(2);
      expect(String(r.stderr)).toContain("la boîte ne doit être inscriptible que par root");
      expect(b.appels()).toEqual([]);
    }
    const b = banc();
    const r = b.lancer({}, ["--une-fois"]);
    expect(r.status).toBe(0);
  });
  it("la boîte doit être un point de montage ; racine et dossiers fixes de root non inscriptibles par d'autres : code 2", () => {
    let b = banc();
    writeFileSync(join(b.faux, "montes"), "");
    let r = b.lancer();
    expect(r.status).toBe(2);
    expect(String(r.stderr)).toContain("point de montage");
    for (const [mode, dossier] of [[0o775, "racine"], [0o777, "capture-maquettes"], [0o770, "capture-maquettes-img"], [0o757, "capture-veilleur"], [0o777, "capture-entree"]] as const) {
      b = banc();
      chmodSync(dossier === "racine" ? b.racine : join(b.racine, dossier), mode);
      r = b.lancer();
      expect(r.status, `${dossier} ${mode.toString(8)}`).toBe(2);
      expect(b.appels()).toEqual([]);
    }
  });
  it("DEPLOIEMENT inscriptible, seccomp.json inscriptible, .env absent ou inscriptible, fichier compose en trop : code 2", () => {
    const cas: Array<[string, (b: Banc) => void]> = [
      ["deploiement", (b) => chmodSync(b.deploiement, 0o777)],
      ["seccomp", (b) => chmodSync(join(b.deploiement, "studio-capture/seccomp.json"), 0o666)],
      [".env absent", (b) => rmSync(join(b.racine, ".env"))],
      [".env inscriptible", (b) => chmodSync(join(b.racine, ".env"), 0o666)],
      ["dossier studio-capture", (b) => chmodSync(join(b.deploiement, "studio-capture"), 0o777)],
      ["veilleur.sh inscriptible", (b) => chmodSync(join(b.deploiement, "studio-capture/veilleur.sh"), 0o666)],
      ["veilleur.sh absent", (b) => rmSync(join(b.deploiement, "studio-capture/veilleur.sh"))],
      ["parent du clone", (b) => chmodSync(b.dossier, 0o777)],
      ["dossier outils", (b) => chmodSync(join(b.dossier, "outils"), 0o777)],
      ["dossier maquettes-tableaux-de-bord", (b) => chmodSync(join(b.dossier, "outils/maquettes-tableaux-de-bord"), 0o777)],
      ["charte montée", (b) => chmodSync(join(b.dossier, "outils/maquettes-tableaux-de-bord/charte"), 0o777)],
      [".env : STUDIO_CAPTURE_MAQUETTE", (b) => writeFileSync(join(b.racine, ".env"), "POSTGRES_PASSWORD=x\nSTUDIO_CAPTURE_MAQUETTE=/etc\n")],
      [".env : COMPOSE_PROFILES", (b) => writeFileSync(join(b.racine, ".env"), "COMPOSE_PROFILES=capture\n")],
      [".env : export COMPOSE_FILE", (b) => writeFileSync(join(b.racine, ".env"), "  export COMPOSE_FILE=/tmp/x.yml\n")],
      [".env : BOM puis STUDIO_CAPTURE_SORTIE", (b) => writeFileSync(join(b.racine, ".env"), "\uFEFFSTUDIO_CAPTURE_SORTIE=/srv\n")],
      [".env : BOM puis export COMPOSE_FILE", (b) => writeFileSync(join(b.racine, ".env"), "POSTGRES_PASSWORD=x\n\uFEFF  export COMPOSE_FILE=/tmp/x.yml\n")],
      [".env : STUDIO_CAPTURE_SORTIE", (b) => writeFileSync(join(b.racine, ".env"), "STUDIO_CAPTURE_SORTIE=/srv\n")],
      ["override", (b) => writeFileSync(join(b.deploiement, "docker-compose.override.yml"), "services: {}\n")],
      ["compose.yaml", (b) => writeFileSync(join(b.deploiement, "compose.yaml"), "services: {}\n")],
    ];
    for (const [nom, piege] of cas) {
      const b = banc();
      piege(b);
      expect(b.lancer().status, nom).toBe(2);
      expect(b.appels(), nom).toEqual([]);
    }
  });
  it("DEPLOIEMENT dont un maillon est un lien : refusé (code 2) ; le chemin réel, lui, passe", () => {
    const b = banc();
    const lien = join(tmpdir(), `veilleur-lien-${process.pid}-${Date.now()}`);
    dossiers.push(lien);
    symlinkSync(b.dossier, lien);
    const nom = b.deploiement.slice(b.dossier.length); // /deploiement
    const r = b.lancer({ DEPLOIEMENT: `${lien}${nom}` });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/DEPLOIEMENT contient un lien/);
    expect(b.appels()).toEqual([]);
    expect(b.lancer().status).toBe(0);
  });
  it("texte : le script finit par `principal; exit $?` (une réécriture en place ne fait rien exécuter de mélangé) ; garde explicite avant le rm -rf de $res", () => {
    expect(script.trimEnd().split("\n").pop()).toBe("principal; exit $?");
    expect(script).toContain('[ -n "${ID:-}" ] && [ "$res" = "$V/resultat-$ID" ] && [ -n "$V" ] || arret panne CAPTURE_ECHEC\n  rm -rf --one-file-system -- "$res"\n  mkdir -- "$res"');
  });
  it("sans VEILLEUR_TEST=1, les variables d'essai sont REFUSÉES (jamais ignorées)", () => {
    for (const v of ["VEILLEUR_RACINE", "VEILLEUR_PATH_TEST", "VEILLEUR_VERROU", "VEILLEUR_BUDGET"]) {
      const b = banc();
      const r = b.lancer({ VEILLEUR_TEST: undefined, [v]: v === "VEILLEUR_RACINE" ? b.racine : v === "VEILLEUR_BUDGET" ? "5" : b.faux });
      expect(r.status, v).toBe(2);
      expect(b.appels()).toEqual([]);
    }
    const b = banc();
    expect(b.lancer({ VEILLEUR_TEST: "oui" }).status).toBe(2);
  });
  it("le mode essai refuse la vraie racine et la vraie boîte ; argument inconnu refusé", () => {
    const b = banc();
    expect(b.lancer({ VEILLEUR_RACINE: "/opt/studio-axion-ia" }).status).toBe(2);
    expect(b.lancer({ VEILLEUR_BOITE: "/opt/studio-axion-ia/capture-boite" }).status).toBe(2);
    // barre finale, //, ./ : comparés après realpath -m, donc refusés pour la bonne raison (message « interdite »)
    for (const racine of ["/opt/studio-axion-ia/", "//opt/studio-axion-ia", "/opt//studio-axion-ia/"]) {
      const r = b.lancer({ VEILLEUR_RACINE: racine });
      expect(r.status, racine).toBe(2);
      expect(String(r.stderr), racine).toContain("la vraie racine est interdite");
    }
    for (const boite of ["/opt/studio-axion-ia/capture-boite/", "//opt/studio-axion-ia/capture-boite", "/opt/studio-axion-ia//capture-boite/"]) {
      const r = b.lancer({ VEILLEUR_BOITE: boite });
      expect(r.status, boite).toBe(2);
      expect(String(r.stderr), boite).toContain("la vraie boîte est interdite");
    }
    expect(b.lancer({}, ["--autre"]).status).toBe(2);
    expect(b.lancer({}, ["--une-fois", "--x"]).status).toBe(2);
    expect(b.lancer({ VEILLEUR_BOITE: "/tmp/../etc" }).status).toBe(2);
  });
  it("sans mode essai, le script refuse de tourner sans root (ou, en root, de lire un autre DEPLOIEMENT inexistant)", () => {
    const b = banc();
    const r = b.lancer({ VEILLEUR_TEST: undefined, VEILLEUR_PATH_TEST: undefined, VEILLEUR_RACINE: undefined, DEPLOIEMENT: undefined });
    expect(r.status).toBe(2);
  });
});

describe("POSTE-2 · exécution avec faux docker", { timeout: 60_000 }, () => {
  it("rien à faire : pouls écrit (0444), aucune action docker autre que `ps`", () => {
    const b = banc();
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(readFileSync(join(b.boite, "pouls"), "utf8")).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\n$/);
    expect(b.appels().every((a) => a.startsWith("docker ps "))).toBe(true);
  });
  it("film-zip de bout en bout : réponse ok, trois fichiers, étapes dans l'ordre, ps avant chaque run, tout nettoyé", () => {
    const b = banc();
    b.demande(NOM);
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(etat(b, NOM)).toBe("ok\nOK\n");
    expect(readdirSync(join(b.boite, "reponses", NOM)).sort()).toEqual(["etat.txt", "ffprobe.json", "navigation.json", "navigation.mp4"]);
    expect(readdirSync(join(b.boite, "demandes"))).toEqual([]);
    expect(readdirSync(join(b.boite, ".veilleur"))).toEqual([]);
    const a = b.appels();
    const modes = a.filter((l) => l.startsWith("env ")).map((l) => l.split(" ")[1]);
    expect(modes).toEqual(["decompresser", "capturer", "verifier"]);
    // chaque run est précédé de deux `docker ps` (nom puis label)
    a.forEach((l, i) => {
      if (/^docker compose /.test(l)) {
        expect(a[i - 2]).toContain("docker ps -aq --filter name=studio-capture");
        expect(a[i - 1]).toContain("docker ps -aq --filter label=com.docker.compose.service=studio-capture");
        expect(l).toContain("--profile capture run -d --pull never --name studio-capture-abcdef123456-");
      }
    });
    expect(a.find((l) => l.startsWith("env capturer"))).toContain(`MAQ=${b.racine}/capture-maquettes/abcdef123456/maquette`);
    expect(readdirSync(join(b.racine, "capture-maquettes"))).toEqual([]);
    expect(readdirSync(join(b.racine, "capture-maquettes-img"))).toEqual([]);
    expect(readFileSync(join(b.faux, "montes"), "utf8")).toBe(`${b.boite}\n`);
  });
  it("film-description et apercu : refus DEMANDE_INVALIDE, aucun conteneur", () => {
    for (const type of ["film-description", "apercu"]) {
      const b = banc();
      const nom = `${type}--abcdef123456`;
      b.demande(nom, { "description.json": "{}", "attendue.txt": "abcdef12\n" });
      expect(b.lancer().status).toBe(0);
      expect(etat(b, nom)).toBe("refus\nDEMANDE_INVALIDE\n");
      expect(b.appels().some((l) => /^docker compose/.test(l))).toBe(false);
    }
  });
  it("demande piégée (lien symbolique, nom hors liste, fichier trop gros) : refus DEMANDE_INVALIDE, aucun conteneur", () => {
    const pieges: Array<(d: string) => void> = [
      (d) => { rmSync(join(d, "scenario.json")); symlinkSync("/etc/passwd", join(d, "scenario.json")); },
      (d) => writeFileSync(join(d, "intrus.sh"), "x"),
      (d) => writeFileSync(join(d, "calage.json"), "x".repeat(262145)),
    ];
    for (const piege of pieges) {
      const b = banc();
      piege(b.demande(NOM));
      expect(b.lancer().status).toBe(0);
      expect(etat(b, NOM)).toBe("refus\nDEMANDE_INVALIDE\n");
      expect(b.appels().some((l) => /^docker compose/.test(l))).toBe(false);
    }
  });
  it("conteneur de capture vivant : RIEN n'est pris, la demande reste, aucune action sur /sortie", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "occupe"), "abc123\n");
    expect(b.lancer().status).toBe(0);
    expect(readdirSync(join(b.boite, "demandes"))).toEqual([NOM]);
    expect(b.appels().some((l) => /^(mount|umount|docker compose)/.test(l))).toBe(false);
  });
  it("code 4 de decompresser : refus ZIP_REFUSE ; 137 : panne DUREE_DEPASSEE ; capturer 5 : panne CAPTURE_ECHEC ; verifier 1 : refus FILM_INVALIDE", () => {
    const cas: Array<[string, string, string, string]> = [
      ["decompresser", "4", "refus", "ZIP_REFUSE"],
      ["decompresser", "137", "panne", "DUREE_DEPASSEE"],
      ["capturer", "5", "panne", "CAPTURE_ECHEC"],
      ["verifier", "1", "refus", "FILM_INVALIDE"],
    ];
    for (const [mode, rc, st, code] of cas) {
      const b = banc();
      b.demande(NOM);
      writeFileSync(join(b.faux, `rc-${mode}`), rc);
      expect(b.lancer().status).toBe(0);
      expect(etat(b, NOM)).toBe(`${st}\n${code}\n`);
      expect(readdirSync(join(b.racine, "capture-maquettes-img"))).toEqual([]);
    }
  });
  it("sortie sans index.html : refus MAQUETTE_INTROUVABLE ; lien dans la sortie : refus CONTROLE_SOURCE (aucune copie)", () => {
    let b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "pas-de-maquette"), "");
    b.lancer();
    expect(etat(b, NOM)).toBe("refus\nMAQUETTE_INTROUVABLE\n");
    b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "lien-dans-sortie"), "");
    b.lancer();
    expect(etat(b, NOM)).toBe("refus\nCONTROLE_SOURCE\n");
    expect(b.appels().some((l) => l.startsWith("env capturer"))).toBe(false);
  });
  it("reprise : un travail resté dans .veilleur devient panne INTERROMPU, conteneurs restants tués, rien n'est relancé", () => {
    const b = banc();
    mkdirSync(join(b.boite, ".veilleur", `travail-${NOM}`));
    writeFileSync(join(b.faux, "occupe"), "zzz\n");
    // le faux `ps` répond « occupé » tant que le faux `rm` n'a pas vidé le fichier « occupe »
    const docker = readFileSync(join(b.faux, "docker"), "utf8").replace("rm) rm -f", `rm) rm -f "${join(b.faux, "occupe")}"; rm -f`);
    writeFileSync(join(b.faux, "docker"), docker);
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(existsSync(join(b.boite, ".veilleur", `travail-${NOM}`))).toBe(false);
    expect(existsSync(join(b.faux, "kills"))).toBe(true);
    expect(b.appels().some((l) => /^docker compose/.test(l))).toBe(false);
  });
  it("entrée invalide ancienne de demandes/ supprimée, récente conservée ; une réponse déjà présente n'est jamais écrasée", () => {
    const b = banc();
    const vieux = join(b.boite, "demandes", "MAUVAIS");
    const neuf = join(b.boite, "demandes", ".prep-abcdefgh");
    mkdirSync(vieux);
    mkdirSync(neuf);
    const ancien = new Date(Date.now() - 3600_000);
    utimesSync(vieux, ancien, ancien);
    b.lancer();
    expect(existsSync(vieux)).toBe(false);
    expect(existsSync(neuf)).toBe(true);
    // réponse déjà là
    const c = banc();
    mkdirSync(join(c.boite, "reponses", NOM));
    writeFileSync(join(c.boite, "reponses", NOM, "etat.txt"), "ok\nOK\n");
    c.demande(NOM, { "intrus": "x" });
    c.lancer();
    expect(readFileSync(join(c.boite, "reponses", NOM, "etat.txt"), "utf8")).toBe("ok\nOK\n");
  });
  it("deux passages en même temps : le second sort sans rien faire (flock), mais rafraîchit le pouls (0444, sans reste)", () => {
    const b = banc();
    const verrou = join(b.dossier, "v.lock");
    b.demande(NOM);
    const ancien = "2000-01-01T00:00:00Z\n";
    writeFileSync(join(b.boite, "pouls"), ancien);
    // Le verrou est tenu par le shell du test lui-même (descripteur 8 ; le script ouvre le sien sur le descripteur 9, donc un
    // autre « open file description » : flock -n échoue À COUP SÛR). ENVIRONNEMENT PROPRE (comme banc().lancer) : l'environnement
    // du processus de test peut contenir INVOCATION_ID / JOURNAL_STREAM (lanceur sous systemd, cas du CI), que le script refuse
    // en mode essai (code 2) — c'était la cause du rouge en CI, pas une course de temps.
    const r = spawnSync("bash", ["-c", `exec 8>"${verrou}"; flock -n 8 || exit 99; bash "${CHEMIN_SCRIPT}" --une-fois 9>&-; echo $?`], {
      encoding: "utf8",
      env: {
        PATH: "/usr/local/bin:/usr/bin:/bin",
        VEILLEUR_TEST: "1", VEILLEUR_RACINE: b.racine, VEILLEUR_PATH_TEST: b.faux, VEILLEUR_BOITE: b.boite, DEPLOIEMENT: b.deploiement,
        VEILLEUR_VERROU: verrou,
      } as NodeJS.ProcessEnv,
    });
    expect(r.stderr).toBe("");
    expect(r.stdout.trim()).toBe("0");
    expect(readdirSync(join(b.boite, "demandes"))).toEqual([NOM]);
    const pouls = readFileSync(join(b.boite, "pouls"), "utf8");
    expect(pouls).not.toBe(ancien);
    expect(pouls).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\n$/);
    expect(statSync(join(b.boite, "pouls")).mode & 0o777).toBe(0o444);
    expect(readdirSync(join(b.boite, ".veilleur"))).toEqual([]);
    expect(b.appels()).toEqual([]);
  });
  it("deux vrais passages : le premier est BLOQUÉ (signal) dans le faux docker pendant que le second tourne et sort (flock)", async () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "bloquer"), "");
    const env = {
      PATH: "/usr/local/bin:/usr/bin:/bin",
      VEILLEUR_TEST: "1", VEILLEUR_RACINE: b.racine, VEILLEUR_PATH_TEST: b.faux, VEILLEUR_BOITE: b.boite, DEPLOIEMENT: b.deploiement,
    } as NodeJS.ProcessEnv;
    const premier = spawn("bash", [CHEMIN_SCRIPT, "--une-fois"], { env, stdio: "ignore" });
    const fini = new Promise<number | null>((ok) => premier.on("close", (c) => ok(c)));
    try {
      // rendez-vous : le premier tient le verrou et attend dans docker (borne : 30 s)
      const limite = Date.now() + 30_000;
      while (!existsSync(join(b.faux, "bloque")) && Date.now() < limite) await new Promise((r) => setTimeout(r, 20));
      expect(existsSync(join(b.faux, "bloque")), "le premier passage doit atteindre le faux docker").toBe(true);
      writeFileSync(join(b.boite, "pouls"), "2000-01-01T00:00:00Z\n");
      const second = spawnSync("bash", [CHEMIN_SCRIPT, "--une-fois"], { env, encoding: "utf8", timeout: 30_000 });
      expect(second.status).toBe(0);
      expect(second.stderr).toBe("");
      // le second n'a rien pris, rien appelé, mais a rafraîchi le pouls
      expect(readdirSync(join(b.boite, "demandes"))).toEqual([NOM]);
      expect(readFileSync(join(b.boite, "pouls"), "utf8")).not.toBe("2000-01-01T00:00:00Z\n");
      expect(b.appels()).toEqual([]);
      expect(premier.exitCode, "le premier tient encore le verrou").toBeNull();
    } finally {
      writeFileSync(join(b.faux, "libere"), "");
    }
    expect(await fini).toBe(0);
  });
  it("pouls : le mode est posé AVANT le mv -T (jamais de fichier root 0600 visible dans la boîte)", () => {
    const b = banc();
    // faux mv : relève le mode de la source au moment du renommage
    writeFileSync(join(b.faux, "mv"), `#!/bin/bash\nif [[ "$4" == */pouls ]]; then stat -c %a "$3" > "${b.faux}/mode-avant-mv"; fi\nexec /usr/bin/mv "$@"\n`);
    chmodSync(join(b.faux, "mv"), 0o755);
    expect(b.lancer().status).toBe(0);
    expect(readFileSync(join(b.faux, "mode-avant-mv"), "utf8").trim()).toBe("444");
  });
  it("une seule demande par passage avec --une-fois ; sans argument, la borne de temps (VEILLEUR_BUDGET) empêche d'en prendre une autre", () => {
    const b = banc();
    b.demande(NOM);
    b.demande("film-zip--bbbbbb123456");
    expect(b.lancer().status).toBe(0); // --une-fois
    expect(readdirSync(join(b.boite, "reponses"))).toHaveLength(1);
    expect(readdirSync(join(b.boite, "demandes"))).toHaveLength(1);
    const c = banc();
    c.demande(NOM);
    c.demande("film-zip--bbbbbb123456");
    writeFileSync(join(c.faux, "lent"), ""); // la 1re étape dure 3 s ; borne à 2 s
    const r = c.lancer({ VEILLEUR_BUDGET: "2" }, []);
    expect(r.status, String(r.stderr)).toBe(0);
    expect(readdirSync(join(c.boite, "reponses"))).toHaveLength(1);
    expect(readdirSync(join(c.boite, "demandes"))).toHaveLength(1);
    expect(String(r.stderr)).toContain("borne de temps atteinte");
    // sans la borne, les deux sont traitées
    const d = banc();
    d.demande(NOM);
    d.demande("film-zip--bbbbbb123456");
    expect(d.lancer({}, []).status).toBe(0);
    expect(readdirSync(join(d.boite, "reponses"))).toHaveLength(2);
  });
  it("demande retirée par le studio entre le find et le mv : on passe, code 0, aucun travail", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "disparait"), "");
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(String(r.stderr)).toContain("demande disparue");
    expect(readdirSync(join(b.boite, "reponses"))).toEqual([]);
    expect(b.appels().some((l) => /^docker compose/.test(l))).toBe(false);
  });
  it("reprise : si la réponse INTERROMPU ne peut pas être posée, le travail n'est PAS effacé (puis réessayé au passage suivant)", () => {
    const b = banc();
    mkdirSync(join(b.boite, ".veilleur", `travail-${NOM}`));
    writeFileSync(join(b.faux, "mv-reponse-echoue"), "");
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(existsSync(join(b.boite, ".veilleur", `travail-${NOM}`))).toBe(true);
    expect(readdirSync(join(b.boite, "reponses"))).toEqual([]);
    expect(String(r.stderr)).toContain("le travail est conservé");
    rmSync(join(b.faux, "mv-reponse-echoue"));
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(existsSync(join(b.boite, ".veilleur", `travail-${NOM}`))).toBe(false);
  });
  it("délai dépassé côté hôte (faux timeout rendant 124) : docker kill du conteneur, puis panne DUREE_DEPASSEE", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "timeout-124"), "");
    expect(b.lancer().status).toBe(0);
    expect(readFileSync(join(b.faux, "kills"), "utf8")).toContain("kill studio-capture-abcdef123456-decompresser");
    expect(readFileSync(join(b.faux, "delais"), "utf8")).toContain("timeout 60 docker kill studio-capture-abcdef123456-decompresser");
    expect(etat(b, NOM)).toBe("panne\nDUREE_DEPASSEE\n");
    expect(b.appels().some((l) => l === "docker rm -f studio-capture-abcdef123456-decompresser")).toBe(true);
  });
  it("délais : 960 s pour les étapes, 120 s pour verifier ; copies sous timeout ; run -d sous timeout 120", () => {
    const b = banc();
    b.demande(NOM);
    expect(b.lancer().status).toBe(0);
    const d = readFileSync(join(b.faux, "delais"), "utf8").split("\n");
    const attentes = d.filter((l) => l.startsWith("timeout ") && l.includes(" docker wait "));
    expect(attentes.map((l) => l.split(" ")[1])).toEqual(["960", "960", "120"]);
    expect(d.filter((l) => /^timeout 120 env /.test(l))).toHaveLength(3);
    // `-k 10` partout : chaque appel de timeout (copies, docker, head) le porte
    const bruts = readFileSync(join(b.faux, "delais-bruts"), "utf8").split("\n").filter((l) => l !== "");
    expect(bruts.length).toBeGreaterThan(20);
    for (const l of bruts) expect(l, l).toMatch(/^timeout-brut -k 10 \d+ /);
    // docker ps/kill/logs/inspect/rm sont bornés aussi
    for (const sousCommande of ["ps", "logs", "inspect", "image", "rm"]) expect(d.some((l) => l.startsWith(`timeout 60 docker ${sousCommande} `)), sousCommande).toBe(true);
    expect(d.filter((l) => /^timeout 300 cp -R --no-dereference /.test(l)).length).toBeGreaterThanOrEqual(6);
  });
  it("copie qui ne finit pas (faux timeout 124 sur cp) : panne INTERROMPU, code 0 de l'unité", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "timeout-cp"), "");
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(b.appels().some((l) => /^docker compose/.test(l))).toBe(false);
  });
  it("FIFO glissée à la place de dossier.zip : copiée comme FIFO (cp -R) puis refusée, sans blocage", () => {
    const b = banc();
    const d = b.demande(NOM);
    rmSync(join(d, "dossier.zip"));
    // le contrôle de la source refuse déjà un non-fichier ; ici on vérifie que le script rend la main vite
    execFileSync("mkfifo", [join(d, "dossier.zip")]);
    const debut = Date.now();
    expect(b.lancer().status).toBe(0);
    expect(Date.now() - debut).toBeLessThan(20_000);
    expect(etat(b, NOM)).toBe("refus\nDEMANDE_INVALIDE\n");
  });
  it("compose : --env-file du .env réel, -f et --project-directory, aucune variable COMPOSE_* héritée, --pull never", () => {
    const b = banc();
    b.demande(NOM);
    const r = b.lancer({ COMPOSE_FILE: "/tmp/autre.yml", COMPOSE_PROFILES: "x", COMPOSE_PROJECT_NAME: "y" });
    expect(r.status, String(r.stderr)).toBe(0);
    const runs = b.appels().filter((l) => /^docker compose /.test(l));
    expect(runs).toHaveLength(3);
    for (const l of runs) {
      expect(l).toContain(`-p studio-axion-ia --env-file ${b.racine}/.env --project-directory ${b.deploiement} -f ${b.deploiement}/docker-compose.yml --profile capture run -d --pull never --name `);
      expect(l).not.toContain("--build");
    }
    // le faux docker consigne l'environnement COMPOSE_* reçu : rien
    expect(b.appels().filter((l) => l.startsWith("env ") && l.includes("COMPOSE"))).toEqual([]);
  });
  it("image absente : jamais de construction, panne CAPTURE_ECHEC, aucun docker compose", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "pas-d-image"), "");
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nCAPTURE_ECHEC\n");
    expect(b.appels().some((l) => /^docker compose/.test(l))).toBe(false);
  });
  it("verifier : /entree ne contient que navigation.mp4 ; ffprobe.json trop gros refusé (lecture bornée) ; code non nul : jamais cru", () => {
    let b = banc();
    b.demande(NOM);
    expect(b.lancer().status).toBe(0);
    expect(readFileSync(join(b.faux, "entree-verifier"), "utf8").trim()).toBe("navigation.mp4");
    b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "ffprobe-gros"), "");
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("refus\nFILM_INVALIDE\n");
    b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "rc-verifier"), "3"); // ffprobe.json existe, mais le conteneur a échoué
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("refus\nFILM_INVALIDE\n");
    expect(existsSync(join(b.boite, "reponses", NOM, "ffprobe.json"))).toBe(false);
  });
  it("verifier : ffprobe.json en LIEN symbolique (vers /dev/null) ou dossier : refusé même avec le code 0", () => {
    for (const piege of ["lien", "dossier"]) {
      const b = banc();
      b.demande(NOM);
      writeFileSync(join(b.faux, `ffprobe-${piege}`), "");
      const r = b.lancer();
      expect(r.status, piege + String(r.stderr)).toBe(0);
      expect(etat(b, NOM)).toMatch(/^refus\n(FILM_INVALIDE|CONTROLE_SOURCE)\n$/);
      expect(existsSync(join(b.boite, "reponses", NOM, "ffprobe.json"))).toBe(false);
    }
  });
  it("verifier : kill de l'hôte court (120 s) et /sortie neuf avant l'étape", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "timeout-124"), "");
    writeFileSync(join(b.faux, "rc-decompresser"), "0");
    expect(b.lancer().status).toBe(0);
    const modes = b.appels().filter((l) => /^mount -o loop/.test(l) && l.includes("capture-sortie"));
    expect(modes.length).toBeGreaterThanOrEqual(1);
    expect(script).toMatch(/if \[ "\$1" = verifier \]; then delai=\$DELAI_VERIFIER_S/);
    expect(script).toMatch(/lancer_conteneur "studio-capture-\$ID-verifier"/);
    expect(script).toMatch(/etape_verifier\(\) \{\n[^}]*sortie_neuve/);
  });
  it("le film est DÉPLACÉ dans la réponse (mv), jamais recopié une seconde fois", () => {
    const b = banc();
    b.demande(NOM);
    expect(b.lancer().status).toBe(0);
    const mv = readFileSync(join(b.faux, "mouvements"), "utf8");
    expect(mv).toMatch(/mv -T -- \S+\/resultat-abcdef123456\/navigation\.mp4 \S+\/reponse-film-zip--abcdef123456\/navigation\.mp4/);
    const d = readFileSync(join(b.faux, "delais"), "utf8");
    // 3 copies de la demande + maquette + 2 fichiers du résultat + le film pour verifier = 7 ; aucune pour la réponse
    expect(d.split("\n").filter((l) => /^timeout 300 cp /.test(l))).toHaveLength(7);
  });
  it("image .img de maquette effacée seulement si le démontage a réussi", () => {
    let b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "umount-echoue-maquette"), "");
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(readdirSync(join(b.racine, "capture-maquettes-img"))).toEqual(["abcdef123456.img"]);
    expect(String(r.stderr)).toContain("image conservée");
    b = banc();
    b.demande(NOM);
    expect(b.lancer().status).toBe(0);
    expect(readdirSync(join(b.racine, "capture-maquettes-img"))).toEqual([]);
  });
  it("journal du conteneur : fins de ligne et caractères de contrôle neutralisés, aucune fausse ligne « veilleur: » possible", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "logs"), "ligne\nveilleur: demande finie film-zip--fausse0000 ok OK\r\u001b[31mrouge\u0000\n");
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    const lignes = String(r.stderr).split("\n").filter((l) => l !== "");
    for (const l of lignes) expect(l, l).toMatch(/^veilleur: /);
    expect(lignes.filter((l) => l.includes("demande finie film-zip--fausse0000"))).toHaveLength(3);
    for (const l of lignes.filter((x) => x.includes("fausse0000"))) expect(l).toMatch(/^veilleur: poste\| /);
    expect(String(r.stderr)).not.toMatch(/[\u0000-\u0009\u000b-\u001f]/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 2e tour : set -e jamais neutralisé, gardes explicites, projet fixé, valeurs fixes, droits refaits, -k 10
// ---------------------------------------------------------------------------------------------------------------------
describe("POSTE-2 · 2e tour : texte", () => {
  const corps = (nom: string) => {
    const m = new RegExp(`^${nom}\\(\\) \\{[^\\n]*\\n([\\s\\S]*?)\\n\\}$`, "m").exec(script);
    return m?.[1] ?? "";
  };
  it("traiter_demande et travailler ne sont JAMAIS appelées dans un `||`, `&&`, `if`, `!`, `while` ou `until` (bash y ignore set -e)", () => {
    const lignes = script.split("\n").filter((l) => !/^\s*(traiter_demande|travailler|reprendre)\(\)/.test(l));
    for (const nom of ["traiter_demande", "travailler", "reprendre"]) {
      for (const l of lignes.filter((x) => new RegExp(`\\b${nom}\\b`).test(x))) {
        expect(l, l).not.toMatch(new RegExp(`(\\|\\||&&|\\bif\\b|\\bwhile\\b|\\buntil\\b|!)[^\\n]*\\b${nom}\\b`));
        expect(l, l).not.toMatch(new RegExp(`\\b${nom}\\b[^\\n]*(\\|\\||&&)`));
      }
    }
    // la forme exacte : appel seul, puis test de la variable globale
    expect(script).toMatch(/\n\s+traiter_demande "\$CHOIX"\n\s+\[ "\$ARRET_BOUCLE" = 0 \] \|\| break\n/);
    expect(script).toMatch(/\n\s+\( travailler \)\n/);
    // traiter_demande ne rend jamais un code non nul
    expect(corps("traiter_demande")).not.toMatch(/return [1-9]/);
    expect(corps("traiter_demande")).toContain("ARRET_BOUCLE=1");
  });
  it("chaque fallocate, mkfs.ext4, mount, chown, chmod porte une garde explicite (`|| arret panne INTERROMPU`, ou `|| return 1` dans poser_reponse)", () => {
    const l = script.split("\n").filter((x) => /^\s*(fallocate|mkfs\.ext4|mount|chown|chmod)\b/.test(x));
    expect(l.length).toBeGreaterThanOrEqual(12);
    for (const x of l) expect(x, x).toMatch(/\|\| (arret panne INTERROMPU|return 1)\s*$/);
    expect(l.filter((x) => /remount/.test(x)).length).toBeGreaterThanOrEqual(2);
    for (const x of l.filter((y) => /remount/.test(y))) expect(x).toMatch(/\|\| arret panne INTERROMPU$/);
  });
  it("tout `timeout` porte -k 10 ; docker ps/kill/logs/inspect/rm/image/wait sont bornés par timeout", () => {
    for (const x of script.split("\n").filter((y) => /\btimeout\b/.test(y))) {
      expect(x, x).not.toMatch(/\btimeout (?!-k 10 )[^\s]/);
    }
    expect(script).not.toMatch(/(?<!timeout -k 10 (?:60|"\$delai") )\bdocker (?:ps|kill|logs|inspect|rm|image|wait)\b/);
    expect(script).toMatch(/xargs timeout -k 10 60 docker kill/);
    expect(script).toMatch(/xargs timeout -k 10 60 docker rm -f/);
  });
  it("commentaire de --pull never : seul `docker image inspect` empêche la construction", () => {
    expect(brut).toMatch(/`--pull never` n'empêche PAS la construction/);
    expect(brut).toMatch(/`docker image inspect studio-capture:local`/);
    expect(brut).not.toMatch(/jamais de construction d'image par le veilleur : ni --build/);
  });
  it("projet fixé -p studio-axion-ia et --env-file /opt/studio-axion-ia/.env dans CHAQUE appel compose (valeurs de production)", () => {
    expect(script).toContain("readonly PROJET_COMPOSE=studio-axion-ia");
    expect(script).toContain("readonly RACINE_PROD=/opt/studio-axion-ia");
    expect(script).toContain('readonly ENV_FICHIER="$RACINE/.env"');
    expect(script).toMatch(/^\s+RACINE=\$RACINE_PROD$/m);
    const appels = script.split("\n").filter((x) => /docker compose /.test(x));
    expect(appels).toHaveLength(1);
    for (const x of appels) expect(x).toContain('docker compose -p "$PROJET_COMPOSE" --env-file "$ENV_FICHIER" --project-directory "$DEPLOIEMENT" -f "$DEPLOIEMENT/docker-compose.yml"');
    // le compose du dépôt porte bien ce nom de projet
    expect(compose).toMatch(/^name: studio-axion-ia$/m);
  });
  it("l'image est `studio-capture:local` : le compose la nomme ainsi et le veilleur attend ce nom exact (nettoyage horaire : images `studio-*` épargnées)", () => {
    expect(blocService("studio-capture")).toMatch(/^\s+image: studio-capture:local$/m);
    expect(script).toContain("docker image inspect studio-capture:local");
    expect(script.match(/studio-capture:local/g)).toHaveLength(1);
    expect("studio-capture:local".startsWith("studio-")).toBe(true);
  });
  it("STUDIO_CAPTURE_ENTREE/SORTIE/MAQUETTE toujours exportées ; maquette vide de root pour decompresser et verifier", () => {
    expect(script).toContain('export STUDIO_CAPTURE_ENTREE="$entree" STUDIO_CAPTURE_SORTIE="$SORTIE" STUDIO_CAPTURE_MAQUETTE="$maquette"');
    expect(script).toContain('maquette="$TRAVAIL_HOTE/maquette-vide"');
    expect(script).toContain('mkdir -m 0555 "$maquette"');
    expect(script).not.toMatch(/if \[ -n "\$maquette" \]; then export/);
  });
  it("mode essai : refusé sous systemd (INVOCATION_ID, JOURNAL_STREAM) et pour un script lancé depuis /opt/studio-axion-ia ; le script de production vient du clone", () => {
    expect(script).toContain('"$RACINE_PROD"/*)');
    expect(script).toMatch(/INVOCATION_ID/);
    expect(script).toMatch(/JOURNAL_STREAM/);
    expect(script).toContain('[ "$SCRIPT_REEL" != "$(realpath -e -- "$f")" ]');
  });
  it("la dispense de contrôle des droits est restreinte à $SORTIE et $ENTREE", () => {
    expect(script).toMatch(/if \[ "\$d" = "\$SORTIE" \] \|\| \[ "\$d" = "\$ENTREE" \]; then/);
    expect(script).not.toMatch(/^\s+if ! monte "\$d"; then root_sans_ecriture "\$d" "le dossier fixe"; fi\n\s+done/m);
  });
});

describe("POSTE-2 · 2e tour : exécutions", { timeout: 60_000 }, () => {
  const aucunCompose = (b: Banc) => b.appels().some((l) => /^docker compose/.test(l));
  it("mkfs.ext4 en échec : panne INTERROMPU, AUCUN docker compose, rien ne reste monté ni dans .veilleur", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "mkfs-echoue"), "");
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(aucunCompose(b)).toBe(false);
    expect(readFileSync(join(b.faux, "montes"), "utf8")).toBe(`${b.boite}\n`);
    expect(readdirSync(join(b.boite, ".veilleur"))).toEqual([]);
  });
  it("mount en échec sur capture-entree, puis capture-sortie : panne INTERROMPU, AUCUN docker compose", () => {
    for (const cible of ["capture-entree", "capture-sortie"]) {
      const b = banc();
      b.demande(NOM);
      writeFileSync(join(b.faux, "mount-echoue"), cible);
      const r = b.lancer();
      expect(r.status, cible + String(r.stderr)).toBe(0);
      expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
      expect(aucunCompose(b), cible).toBe(false);
      expect(readFileSync(join(b.faux, "montes"), "utf8"), cible).toBe(`${b.boite}\n`);
    }
  });
  it("remount en lecture seule de l'entrée en échec : panne INTERROMPU, AUCUN docker compose", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "mount-echoue"), "remount,ro");
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(aucunCompose(b)).toBe(false);
  });
  it("chown de l'entrée, puis de /sortie, en échec : panne INTERROMPU, AUCUN docker compose", () => {
    for (const cible of ["capture-entree", "capture-sortie"]) {
      const b = banc();
      b.demande(NOM);
      writeFileSync(join(b.faux, "chown-echoue"), cible);
      expect(b.lancer().status, cible).toBe(0);
      expect(etat(b, NOM), cible).toBe("panne\nINTERROMPU\n");
      expect(aucunCompose(b), cible).toBe(false);
    }
  });
  it("mount de la maquette en échec : panne INTERROMPU, decompresser a tourné mais capturer JAMAIS", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "mount-echoue"), "capture-maquettes/");
    expect(b.lancer().status).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(b.appels().filter((l) => l.startsWith("env ")).map((l) => l.split(" ")[1])).toEqual(["decompresser"]);
    expect(readdirSync(join(b.racine, "capture-maquettes"))).toEqual([]);
  });
  it("droits refaits après démontage : /sortie montée puis démontée avec un dossier ouvert à tous : panne INTERROMPU, aucun conteneur", () => {
    const b = banc();
    b.demande(NOM);
    writeFileSync(join(b.faux, "montes"), `${b.boite}\n${b.racine}/capture-sortie\n`);
    chmodSync(join(b.racine, "capture-sortie"), 0o777);
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0); // monté : dispensé du contrôle de départ
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(aucunCompose(b)).toBe(false);
    expect(b.appels().some((l) => /^mount -o loop.*capture-sortie$/.test(l))).toBe(false);
  });
  it("dispense restreinte : capture-maquettes montée mais ouverte à tous : code 2 ; capture-sortie montée : acceptée", () => {
    let b = banc();
    writeFileSync(join(b.faux, "montes"), `${b.boite}\n${b.racine}/capture-maquettes\n`);
    chmodSync(join(b.racine, "capture-maquettes"), 0o777);
    expect(b.lancer().status).toBe(2);
    expect(b.appels()).toEqual([]);
    b = banc();
    writeFileSync(join(b.faux, "montes"), `${b.boite}\n${b.racine}/capture-sortie\n`);
    chmodSync(join(b.racine, "capture-sortie"), 0o777);
    expect(b.lancer().status).toBe(0);
  });
  it("STUDIO_CAPTURE_* fixées pour CHAQUE mode, même si l'environnement du processus en pose d'autres ; maquette vide (0555, 0 entrée) pour decompresser et verifier", () => {
    const b = banc();
    b.demande(NOM);
    const r = b.lancer({ STUDIO_CAPTURE_MAQUETTE: "/etc", STUDIO_CAPTURE_ENTREE: "/etc", STUDIO_CAPTURE_SORTIE: "/etc" });
    expect(r.status, String(r.stderr)).toBe(0);
    const env = b.appels().filter((l) => l.startsWith("env "));
    expect(env).toHaveLength(3);
    const vide = `${b.racine}/capture-veilleur/maquette-vide`;
    for (const l of env) {
      expect(l).toContain(`ENTREE=${b.racine}/capture-entree SORTIE=${b.racine}/capture-sortie MAQ=`);
      expect(l).not.toContain("/etc");
    }
    expect(env[0]).toContain(`MAQ=${vide}`);
    expect(env[1]).toContain(`MAQ=${b.racine}/capture-maquettes/abcdef123456/maquette`);
    expect(env[2]).toContain(`MAQ=${vide}`);
    const vues = readFileSync(join(b.faux, "maquette-vue"), "utf8").split("\n").filter((l) => l !== "");
    expect(vues[0]).toBe("decompresser 555 0");
    expect(vues[2]).toBe("verifier 555 0");
  });
  it("mode essai refusé sous systemd : INVOCATION_ID ou JOURNAL_STREAM posé : code 2, docker jamais appelé", () => {
    for (const v of ["INVOCATION_ID", "JOURNAL_STREAM"]) {
      const b = banc();
      b.demande(NOM);
      const r = b.lancer({ [v]: "1" });
      expect(r.status, v).toBe(2);
      expect(String(r.stderr)).toContain("lancé par systemd");
      expect(b.appels()).toEqual([]);
    }
  });
});
