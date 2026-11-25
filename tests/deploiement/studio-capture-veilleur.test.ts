/**
 * POSTE-2 · veilleur du poste de capture (script root côté hôte) : lecture du TEXTE du script, du compose et des unités,
 * puis EXÉCUTIONS sans root ni docker (mode essai explicite VEILLEUR_TEST=1 + faux docker/mount/… en tête du PATH).
 * Aucun réseau, aucune IA, aucune dépense.
 */
import { spawnSync, execFileSync } from "node:child_process";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync,
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
    expect(script).toMatch(/flock -n 9 \|\| exit 0/);
    expect(script).toContain('"$1" = "--une-fois"');
  });
  it("ne lit aucun JSON : ni jq, ni node, ni python, ni parseur", () => {
    expect(script).not.toMatch(/\b(jq|node|python3?|perl|ruby|tsx|npx|eval)\b/);
  });
  it("mv -T pour la prise ET la remise ; copies par cp --no-dereference seulement", () => {
    expect(script).toMatch(/mv -T -- "\$BOITE\/demandes\/\$1" "\$V\/travail-\$1"/);
    expect(script).toMatch(/mv -T -- "\$r" "\$BOITE\/reponses\/\$NOM"/);
    const cp = script.split("\n").filter((l) => /\bcp\b/.test(l));
    expect(cp.length).toBeGreaterThan(3);
    for (const l of cp) expect(l, l).toMatch(/--no-dereference/);
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
  it("forme `timeout 960 docker wait … || docker kill`, puis docker inspect, logs bornés, rm -f", () => {
    expect(script).toMatch(/timeout 960 docker wait "\$nom" >\/dev\/null \|\| docker kill "\$nom"/);
    expect(script).toContain("docker inspect -f '{{.State.ExitCode}}'");
    expect(script).toContain("tail -c 8192");
    expect(script).toMatch(/docker rm -f "\$nom"/);
  });
  it("aucun --entrypoint, -v, --volume, -e, --env, docker.sock, --privileged, network", () => {
    for (const motif of [/--entrypoint/, / -v /, /--volume/, /--env\b/, /docker\.sock/, /--privileged/, /network/]) {
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
  });
  it("service systemd oneshot, minuterie 30 s, rien d'activé par défaut", () => {
    expect(service).toMatch(/^Type=oneshot$/m);
    expect(service).toMatch(/^ExecStart=\/usr\/local\/sbin\/studio-capture-veilleur$/m);
    expect(service).toMatch(/^Environment=VEILLEUR_BOITE=\/opt\/studio-axion-ia\/capture-boite$/m);
    expect(service).toMatch(/^Environment=DEPLOIEMENT=\//m);
    expect(service).not.toMatch(/VEILLEUR_TEST|VEILLEUR_RACINE|VEILLEUR_PATH_TEST/);
    expect(service).toMatch(/^TimeoutStartSec=3600$/m);
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
echo "docker $*" >> "${faux}/appels"
case "$1" in
  ps) [ -f "${faux}/occupe" ] && cat "${faux}/occupe"; exit 0 ;;
  compose)
    shift; while [ "$1" != "studio-capture" ]; do [ "$1" = "--name" ] && nom=$2; shift; done; shift
    mode=$1
    echo "env $mode ENTREE=$STUDIO_CAPTURE_ENTREE SORTIE=$STUDIO_CAPTURE_SORTIE MAQ=\${STUDIO_CAPTURE_MAQUETTE:-}" >> "${faux}/appels"
    touch "${faux}/ctr-$nom"; echo "$mode" > "${faux}/mode-$nom"
    case "$mode" in
      decompresser) [ -f "${faux}/pas-de-maquette" ] || { mkdir -p "$STUDIO_CAPTURE_SORTIE/maquette/site"; echo "<html>" > "$STUDIO_CAPTURE_SORTIE/maquette/site/index.html"; }
                    [ -f "${faux}/lien-dans-sortie" ] && ln -s /etc/passwd "$STUDIO_CAPTURE_SORTIE/maquette/site/lien" ;;
      capturer) mkdir -p "$STUDIO_CAPTURE_SORTIE/film-abc"; echo "MP4" > "$STUDIO_CAPTURE_SORTIE/film-abc/navigation.mp4"; echo "{}" > "$STUDIO_CAPTURE_SORTIE/film-abc/navigation.json" ;;
      verifier) echo "{}" > "$STUDIO_CAPTURE_SORTIE/ffprobe.json" ;;
    esac
    echo "$nom" ;;
  wait) exit 0 ;;
  kill) echo "kill $2" >> "${faux}/kills"; exit 0 ;;
  inspect) m=$(cat "${faux}/mode-\${@: -1}" 2>/dev/null); if [ -f "${faux}/rc-$m" ]; then cat "${faux}/rc-$m"; else echo 0; fi ;;
  logs) echo "journal du poste" ;;
  rm) rm -f "${faux}/ctr-\${@: -1}"; exit 0 ;;
esac
`,
  mount: `#!/bin/bash
echo "mount $*" >> "${faux}/appels"
[ "$1" = "-o" ] && case "$2" in remount*) exit 0 ;; esac
dir="\${@: -1}"; find "$dir" -mindepth 1 -delete; echo "$dir" >> "${faux}/montes"
`,
  umount: `#!/bin/bash
echo "umount $*" >> "${faux}/appels"
find "$1" -mindepth 1 -delete 2>/dev/null
grep -vx "$1" "${faux}/montes" > "${faux}/montes.n" || true; mv "${faux}/montes.n" "${faux}/montes"
`,
  mountpoint: `#!/bin/bash
grep -qx "$2" "${faux}/montes" 2>/dev/null
`,
  "mkfs.ext4": "#!/bin/bash\nexit 0\n",
  fallocate: `#!/bin/bash\ntouch "\${@: -1}"\n`,
  chown: "#!/bin/bash\nexit 0\n",
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
  chmodSync(join(deploiement, "docker-compose.yml"), 0o644);
  for (const [nom, contenu] of Object.entries(FAUX_OUTILS(faux))) {
    writeFileSync(join(faux, nom), contenu);
    chmodSync(join(faux, nom), 0o755);
  }
  writeFileSync(join(faux, "montes"), "");
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

describe("POSTE-2 · refus de configuration (code 2, avant toute commande docker)", () => {
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
  it("sans VEILLEUR_TEST=1, les variables d'essai sont REFUSÉES (jamais ignorées)", () => {
    for (const v of ["VEILLEUR_RACINE", "VEILLEUR_PATH_TEST", "VEILLEUR_VERROU"]) {
      const b = banc();
      const r = b.lancer({ VEILLEUR_TEST: undefined, [v]: v === "VEILLEUR_RACINE" ? b.racine : b.faux });
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

describe("POSTE-2 · exécution avec faux docker", () => {
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
    expect(readdirSync(join(b.boite, ".veilleur")).sort()).toEqual(["pouls.tmp"].filter(() => false));
    const a = b.appels();
    const modes = a.filter((l) => l.startsWith("env ")).map((l) => l.split(" ")[1]);
    expect(modes).toEqual(["decompresser", "capturer", "verifier"]);
    // chaque run est précédé de deux `docker ps` (nom puis label)
    a.forEach((l, i) => {
      if (/^docker compose /.test(l)) {
        expect(a[i - 2]).toContain("docker ps -aq --filter name=studio-capture");
        expect(a[i - 1]).toContain("docker ps -aq --filter label=com.docker.compose.service=studio-capture");
        expect(l).toContain("--profile capture run -d --name studio-capture-abcdef123456-");
      }
    });
    expect(a.find((l) => l.startsWith("env capturer"))).toContain(`MAQ=${b.racine}/capture-maquettes/abcdef123456/maquette`);
    expect(readdirSync(join(b.racine, "capture-maquettes"))).toEqual([]);
    expect(readdirSync(join(b.racine, "capture-maquettes-img"))).toEqual([]);
    expect(readFileSync(join(b.faux, "montes"), "utf8")).toBe("");
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
    // le faux `ps` répond « occupé » tant que `rm -f` n'a pas vidé le fichier : on le fait vider par le faux rm via ctr
    writeFileSync(join(b.faux, "docker-rm-vide"), "");
    const docker = readFileSync(join(b.faux, "docker"), "utf8").replace('rm) rm -f', 'rm) rm -f "${faux_occupe:-/nonexistent}" "' + join(b.faux, "occupe") + '"; rm -f');
    writeFileSync(join(b.faux, "docker"), docker);
    const r = b.lancer();
    expect(r.status, String(r.stderr)).toBe(0);
    expect(etat(b, NOM)).toBe("panne\nINTERROMPU\n");
    expect(existsSync(join(b.boite, ".veilleur", `travail-${NOM}`))).toBe(false);
    expect(existsSync(join(b.faux, "kills"))).toBe(true);
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
  it("deux passages en même temps : le second sort sans rien faire (flock)", () => {
    const b = banc();
    const verrou = join(b.dossier, "v.lock");
    const tenu = spawnSync("bash", ["-c", `exec 9>"${verrou}"; flock -n 9 && VEILLEUR_TEST=1 VEILLEUR_RACINE="${b.racine}" VEILLEUR_PATH_TEST="${b.faux}" VEILLEUR_BOITE="${b.boite}" DEPLOIEMENT="${b.deploiement}" VEILLEUR_VERROU="${verrou}" bash "${CHEMIN_SCRIPT}" --une-fois 9>&-; echo $?`], { encoding: "utf8" });
    // le sous-processus a son propre descripteur 9 fermé : il prend le verrou normalement (statut 0) ; le test de contention suit
    expect(tenu.stdout.trim()).toBe("0");
    b.demande(NOM);
    const r = spawnSync("bash", ["-c", `exec 8>"${verrou}"; flock -n 8; VEILLEUR_TEST=1 VEILLEUR_RACINE="${b.racine}" VEILLEUR_PATH_TEST="${b.faux}" VEILLEUR_BOITE="${b.boite}" DEPLOIEMENT="${b.deploiement}" VEILLEUR_VERROU="${verrou}" bash "${CHEMIN_SCRIPT}" --une-fois; echo $?`], { encoding: "utf8" });
    expect(r.stdout.trim()).toBe("0");
    expect(readdirSync(join(b.boite, "demandes"))).toEqual([NOM]);
  });
});
