/**
 * T-EXT-51b · poste de capture sans réseau : lecture de TEXTE seulement (compose, Dockerfile, script de mise à jour).
 * Aucun docker, aucun réseau, aucun navigateur, aucune IA.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const sansCommentaires = (t: string) =>
  t
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

/** Le bloc du service (de « studio-x: » jusqu'au service suivant ou à la section suivante), commentaires retirés. */
function bloc(compose: string, service: string): string {
  const lignes = compose.split("\n");
  const debut = lignes.findIndex((l) => l === `  ${service}:`);
  if (debut < 0) return "";
  const out: string[] = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i];
    if (/^\S/.test(l) || /^  \S/.test(l)) {
      if (!/^\s*#/.test(l)) break;
    }
    out.push(l);
  }
  return sansCommentaires(out.join("\n"));
}

const compose = lire("deploiement/docker-compose.yml");
const service = bloc(compose, "studio-capture");
const dockerfile = lire("deploiement/studio-capture/Dockerfile");
const dockerfileCode = sansCommentaires(dockerfile);
const lancer = sansCommentaires(lire("deploiement/studio-capture/lancer.sh"));

describe("T-EXT-51b · service studio-capture du compose", () => {
  it("existe", () => {
    expect(service).not.toBe("");
  });
  it("est INACTIF : profil capture, jamais construit ni démarré par défaut", () => {
    expect(service).toMatch(/^\s+profiles: \[capture\]\s*$/m);
    expect(service).not.toMatch(/depends_on/);
  });
  it("sans réseau, sans port, sans redémarrage", () => {
    expect(service).toMatch(/^\s+network_mode: none\s*$/m);
    expect(service).not.toMatch(/^\s+networks:/m);
    expect(service).not.toMatch(/^\s+(ports|expose):/m);
    expect(service).toMatch(/^\s+restart: "no"\s*$/m);
  });
  it("système de fichiers en lecture seule, /sortie seul volume inscriptible, maquette en lecture seule", () => {
    expect(service).toMatch(/^\s+read_only: true\s*$/m);
    const volumes = service.split("\n").filter((l) => /^\s+- .*:\/.*/.test(l) && !/^\s+- \/(tmp|dev\/shm):/.test(l));
    expect(volumes.length).toBeGreaterThanOrEqual(3);
    const inscriptibles = volumes.filter((l) => !/:ro\s*$/.test(l));
    expect(inscriptibles).toHaveLength(1);
    expect(inscriptibles[0]).toMatch(/:\/sortie\s*$/);
    expect(volumes.some((l) => /:\/app\/outils\/maquettes-tableaux-de-bord\/maquette:ro\s*$/.test(l))).toBe(true);
    expect(volumes.some((l) => /:\/entree:ro\s*$/.test(l))).toBe(true);
  });
  it("tmpfs minimal et borné : /tmp et /dev/shm seulement, chacun <= 512 Mo", () => {
    const tmpfs = service.split("\n").filter((l) => /^\s+- \/[\w/]+:.*size=/.test(l));
    expect(tmpfs.map((l) => l.trim().split(":")[0])).toEqual(["- /tmp", "- /dev/shm"]);
    for (const l of tmpfs) {
      const m = /size=(\d+)m/.exec(l);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeLessThanOrEqual(512);
    }
  });
  it("mémoire 2 Go, processus bornés, utilisateur non root, aucune capacité, pas de nouveaux privilèges", () => {
    expect(service).toMatch(/^\s+limits:\s*\n\s+memory: 2g\s*$/m);
    expect(service).toMatch(/^\s+pids: \d+\s*$/m);
    const u = /^\s+user: "?(\d+)(?::\d+)?"?\s*$/m.exec(service);
    expect(u).not.toBeNull();
    expect(Number(u![1])).toBeGreaterThan(0);
    expect(service).toMatch(/^\s+cap_drop: \[ALL\]\s*$/m);
    expect(service).toMatch(/^\s+- no-new-privileges:true\s*$/m);
    expect(service).not.toMatch(/privileged|cap_add|pid: host|network_mode: host/);
    expect(Number(/^\s+pids: (\d+)\s*$/m.exec(service)![1])).toBeLessThanOrEqual(1024);
  });
  it("un SEUL uid : celui de `user:` du compose = celui de l'utilisateur de l'image (pwuser)", () => {
    const u = /^\s+user: "?(\d+):(\d+)"?\s*$/m.exec(service);
    expect(u).not.toBeNull();
    expect(u![2]).toBe(u![1]);
    const dernier = dockerfileCode.split("\n").filter((l) => /^USER\s/.test(l)).pop() ?? "";
    expect(dernier).toBe(`USER ${u![1]}:${u![2]}`);
    // la construction contrôle que pwuser a bien cet uid (sinon elle échoue)
    expect(dockerfileCode).toContain(`test "$(id -u pwuser)" = "${u![1]}"`);
    expect(Number(u![1])).toBeGreaterThan(1000); // ni root ni l'uid 1000 d'ubuntu
  });
  it("CPU bornée, tmpfs /tmp noexec,nosuid,nodev (init: true : voir réserve 1 bis, il est INTERDIT)", () => {
    expect(service).toMatch(/^\s+cpus: "?[0-9.]+"?\s*$/m);
    expect(service).toMatch(/^\s+cpu_shares: \d+\s*$/m);
    const tmp = service.split("\n").find((l) => /^\s+- \/tmp:/.test(l)) ?? "";
    for (const o of ["noexec", "nosuid", "nodev"]) expect(tmp).toMatch(new RegExp(`[:,]${o}(,|\\s*$)`));
  });
  it("entrée et sortie par défaut HORS du dépôt cloné", () => {
    const vols = service.split("\n").filter((l) => /:\/(entree|sortie)(:ro)?\s*$/.test(l));
    expect(vols).toHaveLength(2);
    for (const l of vols) expect(l).toMatch(/:-\/opt\/studio-axion-ia\/capture-/);
  });
  it("aucune porte dérobée : pas de privileged, unconfined, docker.sock, ipc/pid/userns host, devices, cap_add, --no-sandbox", () => {
    expect(service).not.toMatch(/privileged/);
    expect(service).not.toMatch(/seccomp[:=]\s*unconfined/i);
    expect(service).not.toMatch(/apparmor[:=]\s*unconfined/i);
    expect(service).not.toMatch(/systempaths[:=]\s*unconfined/i);
    expect(service).not.toMatch(/docker\.sock|\/var\/run|\/run\//);
    expect(service).not.toMatch(/^\s+ipc:\s*"?host/m);
    expect(service).not.toMatch(/^\s+pid:\s*"?host/m);
    expect(service).not.toMatch(/^\s+userns_mode:/m);
    expect(service).not.toMatch(/^\s+(devices|cap_add|cgroup_parent):/m);
    expect(service).not.toMatch(/--no-sandbox|chromiumSandbox/);
    expect(dockerfileCode).not.toMatch(/--no-sandbox|chromiumSandbox/);
    // security_opt : exactement no-new-privileges et le profil seccomp du dépôt (jamais unconfined)
    expect(liste("security_opt")).toEqual(["- no-new-privileges:true", "- seccomp=./studio-capture/seccomp.json"]);
    // le commentaire du service rappelle les interdits
    expect(compose).toMatch(/NE JAMAIS ajouter : privileged/);
  });
  it("commande documentée : préparation des dossiers (chown de l'uid) et --calage", () => {
    const u = /^\s+user: "?(\d+)/m.exec(service)![1];
    expect(compose).toContain(`chown ${u}:${u} /opt/studio-axion-ia/capture-sortie`);
    expect(compose).toMatch(/#\s+--maquette \S+ --scenario \/entree\/scenario\.json --calage \/entree\/calage\.json --sortie \/sortie\s*$/m);
  });
  it("aucune variable d'environnement, donc aucun secret", () => {
    expect(service).not.toMatch(/^\s+(environment|env_file):/m);
    expect(service).not.toMatch(/_CLE|_KEY|_SECRET|TOKEN|PASSWORD/i);
  });
});

describe("T-EXT-51b · Dockerfile de studio-capture", () => {
  const from = dockerfileCode.split("\n").filter((l) => /^FROM\s/i.test(l));
  it("deux FROM, tous épinglés par empreinte sha256 (64 hexadécimaux)", () => {
    expect(from).toHaveLength(2);
    for (const l of from) expect(l).toMatch(/@sha256:[0-9a-f]{64}(\s|$)/);
  });
  it("base Playwright v1.63.0-noble = version de @playwright/test du pnpm-lock.yaml", () => {
    const lock = lire("pnpm-lock.yaml");
    const v = /'@playwright\/test':\s+specifier: [^\n]+\s+version: (\d+\.\d+\.\d+)/.exec(lock)?.[1];
    expect(v).toBeDefined();
    expect(from.some((l) => l.includes(`mcr.microsoft.com/playwright:v${v}-noble@sha256:`))).toBe(true);
    expect(JSON.parse(lire("deploiement/studio-capture/package.json")).dependencies["@playwright/test"]).toBe(v);
  });
  it("même FFmpeg statique (même empreinte) que studio-rendu", () => {
    const f = (t: string) => /^FROM (mwader\/static-ffmpeg:[^\s]+)/m.exec(t)?.[1];
    expect(f(dockerfileCode)).toBeDefined();
    expect(f(dockerfileCode)).toBe(f(sansCommentaires(lire("deploiement/studio-rendu/Dockerfile"))));
    expect(f(dockerfileCode)).toContain("8.1.1@sha256:");
  });
  it("utilisateur non root, CAPTURE_CONTENEUR=true, police copiée, durée bornée, vérification à la construction", () => {
    const users = dockerfileCode.split("\n").filter((l) => /^USER\s/.test(l));
    expect(users.length).toBeGreaterThan(0);
    expect(users[users.length - 1]).not.toMatch(/^USER\s+(root|0)\b/);
    expect(dockerfileCode).toMatch(/^ENV .*\bCAPTURE_CONTENEUR=true\b/m);
    expect(dockerfileCode).toContain("manrope-latin.woff2");
    expect(dockerfileCode).toMatch(/^ENTRYPOINT \["\/app\/lancer\.sh"\]\s*$/m);
    expect(lancer).toMatch(/exec timeout --kill-after=30 900 \S*tsx outils\/maquettes-tableaux-de-bord\/capture\/capturer\.mts "\$@"/);
    expect(dockerfileCode).toMatch(/^RUN .*verifier-poste\.mts/m);
    // la vérification vient avant le dernier USER/ENTRYPOINT et rien n'est lancé après
    expect(dockerfileCode.indexOf("verifier-poste.mts")).toBeLessThan(dockerfileCode.indexOf("ENTRYPOINT"));
  });
  it("copie seulement capture, poste et le scénario (+ son unique import, la police)", () => {
    const copies = dockerfileCode.split("\n").filter((l) => /^COPY\s/.test(l) && !/--from=/.test(l));
    const sources = copies.flatMap((l) => l.replace(/^COPY\s+(--\S+\s+)*/, "").split(/\s+/).slice(0, -1));
    expect(sources.sort()).toEqual(
      [
        "deploiement/studio-capture/lancer.sh",
        "deploiement/studio-capture/package-lock.json",
        "deploiement/studio-capture/package.json",
        "outils/maquettes-tableaux-de-bord/capture",
        "outils/maquettes-tableaux-de-bord/poste",
        "src/app/polices/manrope-latin.woff2",
        "src/moteurs/montage-tutoriel-outil/etapes-tutoriel.ts",
        "src/moteurs/montage-tutoriel-outil/scenario-maquette.ts",
      ].sort(),
    );
    expect(dockerfileCode).not.toMatch(/^COPY\s+\.\s/m);
  });
  it("aucun secret dans l'image", () => {
    expect(dockerfileCode).not.toMatch(/_CLE|_KEY|_SECRET|TOKEN|PASSWORD/i);
  });
});

describe("T-EXT-51b · jamais construit ni démarré par la mise à jour", () => {
  it("mettre-a-jour.sh ne nomme pas studio-capture ni le profil capture", () => {
    const s = lire("deploiement/mettre-a-jour.sh");
    expect(s).not.toMatch(/studio-capture/);
    expect(s).not.toMatch(/--profile capture/);
  });
  it("aucun autre service du compose n'est dans le profil capture", () => {
    expect(compose.match(/profiles: \[capture\]/g)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------------------------------------------------
 * T-EXT-51c · lot « conteneur » : une réserve des audits de #1574 = au moins un test.
 * ---------------------------------------------------------------------------------------------------------------- */

/** Les lignes `- ...` du sous-bloc `cle:` du service (liste YAML à tirets), commentaires déjà retirés. */
function liste(cle: string): string[] {
  const lignes = service.split("\n");
  const i = lignes.findIndex((l) => new RegExp(`^\\s+${cle}:\\s*$`).test(l));
  if (i < 0) return [];
  const indent = /^(\s*)/.exec(lignes[i])![1].length;
  const out: string[] = [];
  for (let k = i + 1; k < lignes.length; k++) {
    const l = lignes[k];
    if (l.trim() === "") continue;
    if (/^(\s*)/.exec(l)![1].length <= indent) break;
    out.push(l.trim());
  }
  return out;
}

describe("T-EXT-51c · réserve 1 : /sortie bornée", () => {
  it("lancer.sh refuse de démarrer (codes dédiés, message français) si /sortie n'est pas un point de montage ou dépasse 4 Gio", () => {
    expect(lancer).toMatch(/grep -q ' \/sortie ' \/proc\/self\/mountinfo/);
    expect(lancer).toMatch(/exit 64/);
    expect(lancer).toMatch(/df -B1 --output=size \/sortie/);
    expect(lancer).toMatch(/MAX_OCTETS=4294967296\b/);
    expect(lancer).toMatch(/-gt "\$MAX_OCTETS"/);
    expect(lancer).toMatch(/exit 65/);
    expect(lancer).toMatch(/refus de démarrer/);
    // la vérification vient AVANT tout lancement
    expect(lancer.indexOf("mountinfo")).toBeLessThan(lancer.indexOf("exec timeout"));
    expect(lancer.indexOf("MAX_OCTETS")).toBeLessThan(lancer.indexOf("exec timeout"));
  });
  it("le commentaire du service documente le système de fichiers en boucle de 3 Gio (fallocate, mkfs.ext4, loop,nodev,nosuid,noexec, fstab, chown 1001)", () => {
    for (const t of ["fallocate -l 3G", "mkfs.ext4", "loop,nodev,nosuid,noexec", "/etc/fstab", "chown 1001:1001 /opt/studio-axion-ia/capture-sortie"])
      expect(compose).toContain(t);
    expect(compose).not.toMatch(/TAILLE DE \/sortie : non bornée/);
  });
  it("aucune mémoire vive dépensée pour /sortie : pas de tmpfs sur /sortie, mémoire du service inchangée", () => {
    expect(liste("tmpfs").join("\n")).not.toMatch(/\/sortie/);
    expect(service).toMatch(/^\s+memory: 2g\s*$/m);
  });
});

describe("T-EXT-51c · réserve 2 : dépendances verrouillées (npm ci)", () => {
  const lock = JSON.parse(lire("deploiement/studio-capture/package-lock.json"));
  const pkg = JSON.parse(lire("deploiement/studio-capture/package.json"));
  const pnpm = lire("pnpm-lock.yaml");
  const versionPnpm = (nom: string) =>
    new RegExp(`'?${nom.replace("/", "\\/")}'?:\\s+specifier: [^\\n]+\\s+version: (\\d+\\.\\d+\\.\\d+)`).exec(pnpm)?.[1];
  it("package-lock.json existe, lockfileVersion >= 3, chaque paquet a une intégrité sha512 et vient du registre npm", () => {
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(3);
    const paquets = Object.entries(lock.packages as Record<string, { integrity?: string; resolved?: string }>).filter(([k]) => k !== "");
    expect(paquets.length).toBeGreaterThan(0);
    for (const [k, v] of paquets) {
      expect(v.integrity, k).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/);
      expect(v.resolved, k).toMatch(/^https:\/\/registry\.npmjs\.org\//);
    }
  });
  it("@playwright/test et tsx : versions exactes = pnpm-lock.yaml, esbuild aligné", () => {
    for (const nom of ["@playwright/test", "tsx"]) {
      const v = versionPnpm(nom);
      expect(v, nom).toBeDefined();
      expect(pkg.dependencies[nom]).toBe(v);
      expect(lock.packages[`node_modules/${nom}`].version).toBe(v);
    }
    const esb = /^  esbuild@(\d+\.\d+\.\d+):/m.exec(pnpm)?.[1];
    expect(esb).toBeDefined();
    expect(pkg.overrides.esbuild).toBe(esb);
    expect(lock.packages["node_modules/esbuild"].version).toBe(esb);
  });
  it("le Dockerfile utilise `npm ci --ignore-scripts` après avoir copié les deux fichiers, jamais `npm install`", () => {
    expect(dockerfileCode).toMatch(/^RUN npm ci\b[^\n]*--ignore-scripts/m);
    expect(dockerfileCode).not.toMatch(/npm (install|i|add|update)\b/);
    expect(dockerfileCode).not.toMatch(/\b(pnpm|yarn)\b/);
    expect(dockerfileCode.indexOf("package-lock.json")).toBeLessThan(dockerfileCode.indexOf("npm ci"));
    expect(dockerfileCode).toMatch(/^COPY deploiement\/studio-capture\/package\.json deploiement\/studio-capture\/package-lock\.json /m);
  });
  it("l'étape verifier-poste tourne SANS RÉSEAU et ne peut pas être neutralisée", () => {
    const l = dockerfileCode.split("\n").filter((x) => /verifier-poste/.test(x));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatch(/^RUN --network=none env CI=true node_modules\/\.bin\/tsx \S*verifier-poste\.mts/);
    expect(l[0]).not.toMatch(/\|\||;|&/);
  });
});

describe("T-EXT-51c · réserve 3 : CI retiré de l'image", () => {
  it("`CI` absent de tout ENV/ARG du Dockerfile et de l'environnement du service ; CAPTURE_CONTENEUR=true reste ; `CI=true` SEULEMENT sur la ligne exacte de verifier-poste", () => {
    for (const l of dockerfileCode.split("\n").filter((x) => /^(ENV|ARG)\s/.test(x)))
      expect(l, l).not.toMatch(/(^|\s)CI(=|\s|$)/);
    const avecCI = dockerfileCode.split("\n").filter((x) => /\bCI\b/.test(x));
    expect(avecCI).toEqual([
      "RUN --network=none env CI=true node_modules/.bin/tsx outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts --sortie /tmp/poste-construction",
    ]);
    expect(service).not.toMatch(/(^|\s|-)CI[=:]/m);
    expect(service).not.toMatch(/^\s+environment:/m);
    expect(dockerfileCode).toMatch(/^ENV .*\bCAPTURE_CONTENEUR=true\b/m);
  });
});

describe("T-EXT-51c · réserve 4 : liste EXACTE des montages et Dockerfile durci", () => {
  it("volumes : exactement les 4 montages attendus (sources, cibles, options)", () => {
    expect(liste("volumes")).toEqual([
      "- ${STUDIO_CAPTURE_MAQUETTE:-../outils/maquettes-tableaux-de-bord/03-accueil-24h}:/app/outils/maquettes-tableaux-de-bord/maquette:ro",
      "- ../outils/maquettes-tableaux-de-bord/charte:/app/outils/maquettes-tableaux-de-bord/charte:ro",
      "- ${STUDIO_CAPTURE_ENTREE:-/opt/studio-axion-ia/capture-entree}:/entree:ro",
      "- ${STUDIO_CAPTURE_SORTIE:-/opt/studio-axion-ia/capture-sortie}:/sortie",
    ]);
  });
  it("interdits dans le service : volumes_from, extends, ancres/fusions YAML, runtime, pids > 1024", () => {
    expect(service).not.toMatch(/^\s*volumes_from:/m);
    expect(service).not.toMatch(/^\s*extends:/m);
    expect(service).not.toMatch(/<<:/);
    expect(service).not.toMatch(/(^|\s)[&*][A-Za-z_][\w-]*/m);
    expect(service).not.toMatch(/^\s*runtime:/m);
    expect(Number(/^\s+pids: (\d+)\s*$/m.exec(service)![1])).toBeLessThanOrEqual(1024);
  });
  it("le service n'utilise ni `<<:` ni `&ancre` ni `*alias` (le compose n'en a que pour les journaux des autres services)", () => {
    expect(sansCommentaires(compose)).not.toMatch(/<<:/);
    expect(service).not.toMatch(/&[A-Za-z_]|\*[A-Za-z_]/);
  });
  it("tmpfs : jamais `exec`, toujours nosuid et nodev", () => {
    const t = liste("tmpfs");
    expect(t.length).toBeGreaterThan(0);
    for (const l of t) {
      expect(l).not.toMatch(/[:,]exec(,|$)/);
      expect(l).toMatch(/[:,]noexec(,|$)/);
      expect(l).toMatch(/[:,]nosuid(,|$)/);
      expect(l).toMatch(/[:,]nodev(,|$)/);
    }
  });
  it("aucune commande documentée avec -v/--volume/--entrypoint/-e en dehors de leur interdiction", () => {
    const cmd = compose.split("\n").filter((l) => /^\s*#\s+docker (compose )?\S*.*(run|exec)/.test(l) || /^\s*#\s+(--|\/)/.test(l));
    for (const l of cmd) expect(l).not.toMatch(/\s(-v|--volume|--entrypoint|-e|--env)(\s|=)/);
    expect(compose).toMatch(/JAMAIS `--entrypoint`, `-v`\/`--volume`/);
  });
  it("Dockerfile : pas d'ADD, pas de playwright install, pas de chmod setuid/setgid, pas d'ARG/ENV de secret, --ignore-scripts", () => {
    expect(dockerfileCode).not.toMatch(/^\s*ADD\s/im);
    expect(dockerfileCode).not.toMatch(/playwright\s+install/);
    expect(dockerfileCode).not.toMatch(/chmod\s+(-\S+\s+)*[ugoa]*\+s|chmod\s+(-\S+\s+)*[2467][0-7]{3}\b/);
    expect(dockerfileCode).not.toMatch(/--chmod=[2467][0-7]{3}\b/);
    for (const l of dockerfileCode.split("\n").filter((x) => /^(ARG|ENV)\s/.test(x)))
      expect(l, l).not.toMatch(/PAT|TOKEN|KEY|SECRET|PASSWORD/i);
    expect(dockerfileCode).toMatch(/--ignore-scripts/);
    expect(dockerfileCode).not.toMatch(/\|\|\s*true|;\s*true\b/);
  });
});

describe("T-EXT-51c · réserve 5 : /dev/shm déclaré, borné, sans exec", () => {
  it("tmpfs /dev/shm:size<=512m,noexec,nosuid,nodev, et plus de shm_size implicite", () => {
    const l = liste("tmpfs").find((x) => x.startsWith("- /dev/shm:")) ?? "";
    expect(l).toMatch(/^- \/dev\/shm:size=(\d+)m,mode=1777,noexec,nosuid,nodev$/);
    expect(Number(/size=(\d+)m/.exec(l)![1])).toBeLessThanOrEqual(512);
    expect(service).not.toMatch(/^\s+shm_size:/m);
  });
  it("le commentaire dit vrai : /dev/shm est cité parmi les zones inscriptibles", () => {
    expect(compose).not.toMatch(/Rien n'est inscriptible hors/);
    expect(compose).toMatch(/Inscriptible : \/sortie \(bornée\), un tmpfs \/tmp de 256 Mo et un tmpfs \/dev\/shm de 512 Mo/);
  });
});

describe("T-EXT-51c · réserve 6 : lancer.sh, modes capturer, decompresser et verifier", () => {
  const brut = lire("deploiement/studio-capture/lancer.sh");
  it("set -eu, shebang sh, pas d'eval, exec, arguments en \"$@\"", () => {
    expect(brut.split("\n")[0]).toBe("#!/bin/sh");
    expect(lancer).toMatch(/^set -eu\s*$/m);
    expect(lancer).not.toMatch(/\beval\b|`|\$\(\s*\$|bash -c|sh -c/);
    const execs = lancer.split("\n").filter((l) => /^\s*exec\s/.test(l));
    expect(execs).toHaveLength(3);
    // seule exemption de "$@" : la ligne exacte du mode verifier (aucun argument de l'appelant ne va à ffprobe)
    const LIGNE_VERIFIER = "exec timeout --kill-after=30 60 ffprobe -v error -f mov -show_entries format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate -of json /entree/navigation.mp4 > /sortie/ffprobe.json";
    expect(execs.filter((x) => x.trim() === LIGNE_VERIFIER)).toHaveLength(1);
    for (const l of execs.filter((x) => x.trim() !== LIGNE_VERIFIER)) expect(l).toMatch(/"\$@"\s*$/);
    expect(lancer).not.toMatch(/\$\*|\$@[^"]|[^"]\$@/);
  });
  it("liste fermée de modes : capturer (défaut, 900 s), decompresser (300 s) et verifier (60 s) ; mode inconnu refusé", () => {
    expect(lancer).toMatch(/exec timeout --kill-after=30 900 \S*tsx outils\/maquettes-tableaux-de-bord\/capture\/capturer\.mts "\$@"/);
    expect(lancer).toMatch(/exec timeout --kill-after=30 300 \S*tsx outils\/maquettes-tableaux-de-bord\/capture\/decompresser\.mts "\$@"/);
    expect(lancer).toMatch(/capturer \| decompresser \| verifier\)/);
    expect(lancer).toMatch(/^mode=capturer\s*$/m);
    expect(lancer).toMatch(/exit 66/);
    const cases = [...lancer.matchAll(/^ {2}(\w+)\)\s*$/gm)].map((m) => m[1]);
    expect(cases).toEqual(["capturer", "decompresser", "verifier"]);
  });
  it("la commande de décompression est documentée : même service, zip en /entree :ro, sortie /sortie, pas de --entrypoint", () => {
    expect(compose).toMatch(/^\s*#\s+decompresser --zip \/entree\/<fichier>\.zip --sortie \/sortie\/maquette\s*$/m);
    expect(compose).not.toMatch(/decompresser \/entree/);
    expect(compose).toMatch(/lecture seule\) sur \/entree|lecture seule sur \/entree/);
    expect(compose).toMatch(/dans CE conteneur[^\n]*jamais sur l'hôte/);
  });
  it("DÉPENDANCE : decompresser.mts est livré par le lot « zip » (lecture seule, sans effet ici)", () => {
    expect(lancer).toContain("outils/maquettes-tableaux-de-bord/capture/decompresser.mts");
  });
});

describe("T-EXT-51c · corrections de l'audit de #1611", () => {
  it("réserve 1 bis : journaux Docker BORNÉS, en clair dans le service (json-file, max-size <= 20m, max-file <= 5)", () => {
    expect(liste("logging")).toEqual(["driver: json-file", "options:", 'max-size: "20m"', 'max-file: "5"']);
    const taille = /max-size: "(\d+)m"/.exec(service);
    expect(taille).not.toBeNull();
    expect(Number(taille![1])).toBeLessThanOrEqual(20);
    expect(Number(/max-file: "(\d+)"/.exec(service)![1])).toBeLessThanOrEqual(5);
    expect(service).not.toMatch(/logging:\s*\*/);
  });
  it("réserve 2 : `init: false` EN CLAIR (timeout doit être PID 1, insensible à SIGSTOP ; ni init: true ni clé absente) ; lancer.sh fait `exec timeout` dans les trois modes", () => {
    expect(service.split("\n").filter((l) => /^\s+init:/.test(l))).toEqual(["    init: false"]);
    const execs = lancer.split("\n").filter((l) => /^\s*exec\s/.test(l));
    expect(execs).toHaveLength(3);
    for (const l of execs) expect(l).toMatch(/^\s*exec timeout /);
    expect(lancer.match(/\bexec\b/g)).toHaveLength(3); // aucun autre exec (ex. `exec "$@"`) ailleurs que sur ces trois lignes
    expect(compose).toMatch(/PAS d'`init: true`/);
    expect(compose).toMatch(/`init: false` ÉCRIT EN CLAIR/);
  });
  it("interdits en plus : storage_opt, ulimits, stop_signal, CMD, et tout RUN après le USER final hors verifier-poste", () => {
    expect(service).not.toMatch(/^\s+(storage_opt|ulimits|stop_signal|stop_grace_period|command|entrypoint):/m);
    expect(dockerfileCode).not.toMatch(/^CMD\b/m);
    const l = dockerfileCode.split("\n");
    const dernierUser = l.map((x, i) => (/^USER\s/.test(x) ? i : -1)).filter((i) => i >= 0).pop()!;
    const apres = l.slice(dernierUser + 1).filter((x) => /^(RUN|ADD|COPY|ENV|ARG)\s/.test(x));
    expect(apres).toEqual([
      "RUN --network=none env CI=true node_modules/.bin/tsx outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts --sortie /tmp/poste-construction",
    ]);
  });
  it("dépendances : EXACTEMENT 2 (@playwright/test, tsx) dans package.json, toutes présentes à la même version dans le lock", () => {
    const pkg = JSON.parse(lire("deploiement/studio-capture/package.json"));
    const lock = JSON.parse(lire("deploiement/studio-capture/package-lock.json"));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@playwright/test", "tsx"]);
    expect(pkg.devDependencies ?? {}).toEqual({});
    expect(pkg.optionalDependencies ?? {}).toEqual({});
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    for (const [nom, v] of Object.entries(pkg.dependencies)) expect(lock.packages[`node_modules/${nom}`].version).toBe(v);
  });
  it("échéance côté hôte qui TUE le conteneur : run -d --name, docker wait borné à 960 s sinon docker kill, docker rm -f", () => {
    expect(compose).toMatch(/^\s*#\s+docker compose --profile capture run -d --name studio-capture-<id> studio-capture <arguments du mode> && timeout 960 docker wait studio-capture-<id> \|\| docker kill studio-capture-<id>\s*$/m);
    expect(compose).toMatch(/studio-capture <arguments du mode> && timeout 960 docker wait studio-capture-<id> \|\| docker kill studio-capture-<id>\s*$/m);
    // `&&` : ne jamais attendre un ancien conteneur (docker wait seul sur un nom déjà pris)
    expect(compose).not.toMatch(/^\s*#\s+timeout 960 docker wait/m);
    expect(compose).toMatch(/^\s*#\s+docker logs studio-capture-<id> ; docker rm -f studio-capture-<id>\s*$/m);
    // l'ancienne forme (qui ne tuait pas le conteneur) est interdite
    expect(compose).not.toMatch(/timeout 960 docker compose/);
    // aucune commande documentée `run --rm` (sans échéance) : la seule forme est `run -d --name`
    expect(compose).not.toMatch(/^\s*#\s+docker compose --profile capture run --rm/m);
    const lancements = compose.match(/^\s*#\s+(STUDIO_CAPTURE_\w+=\S+ )?docker compose --profile capture run .*$/gm) ?? [];
    expect(lancements.length).toBe(2);
    for (const l of lancements) expect(l).toMatch(/ run -d --name studio-capture-<id> studio-capture <arguments du mode> && timeout 960 docker wait studio-capture-<id> \|\| docker kill studio-capture-<id>$/);
  });
  it("procédure côté hôte : aucun conteneur, /sortie NEUF (umount, mkfs.ext4 sur fichier neuf, mount loop, chown 1001), copie sans lien hors de capture-sortie, contrôle, montage de la copie", () => {
    const cmd = (re: RegExp) => expect(compose, String(re)).toMatch(re);
    cmd(/^\s*#\s+1\. AUCUN conteneur ne doit tourner : `docker ps -a --filter name=studio-capture` doit être VIDE \(sinon ARRÊT : ne rien faire\),$/m);
    cmd(/^\s*#\s+ET `docker ps -a --filter label=com\.docker\.compose\.service=studio-capture` doit être VIDE \(sinon ARRÊT : ne rien faire\)\.$/m);
    expect(compose).not.toMatch(/sinon continuer/i);
    cmd(/^\s*#\s+sudo umount \/opt\/studio-axion-ia\/capture-sortie\s*$/m);
    cmd(/^\s*#\s+sudo rm -f \/opt\/studio-axion-ia\/capture-sortie\.img && sudo fallocate -l 3G \/opt\/studio-axion-ia\/capture-sortie\.img\s*$/m);
    cmd(/^\s*#\s+sudo mkfs\.ext4 -q -m 0 \/opt\/studio-axion-ia\/capture-sortie\.img\s*$/m);
    cmd(/^\s*#\s+sudo mount -o loop,nodev,nosuid,noexec \/opt\/studio-axion-ia\/capture-sortie\.img \/opt\/studio-axion-ia\/capture-sortie\s*$/m);
    cmd(/^\s*#\s+sudo chown 1001:1001 \/opt\/studio-axion-ia\/capture-sortie\s*$/m);
    cmd(/CONTRÔLER LA SOURCE, puis COPIER la maquette décompressée HORS de capture-sortie, vers un dossier de root/);
    expect(compose).not.toMatch(/rsync/i); // rsync (liens physiques, options) est retiré de la procédure
    cmd(/sudo chown -R root:root \/opt\/studio-axion-ia\/capture-maquettes\/<id>\/maquette/);
    // fs en boucle BORNÉ et NEUF pour la copie (1 Gio), puis remontage en lecture seule
    cmd(/^\s*#\s+sudo mkdir -p \/opt\/studio-axion-ia\/capture-maquettes-img && sudo rm -f \/opt\/studio-axion-ia\/capture-maquettes-img\/<id>\.img && sudo fallocate -l 1G \/opt\/studio-axion-ia\/capture-maquettes-img\/<id>\.img\s*$/m);
    cmd(/^\s*#\s+sudo mkfs\.ext4 -q -m 0 \/opt\/studio-axion-ia\/capture-maquettes-img\/<id>\.img\s*$/m);
    cmd(/^\s*#\s+sudo mkdir \/opt\/studio-axion-ia\/capture-maquettes\/<id> && sudo mount -o loop,nodev,nosuid,noexec \/opt\/studio-axion-ia\/capture-maquettes-img\/<id>\.img \/opt\/studio-axion-ia\/capture-maquettes\/<id>\s*$/m);
    cmd(/^\s*#\s+sudo mount -o remount,ro \/opt\/studio-axion-ia\/capture-maquettes\/<id>\s*$/m);
    cmd(/^\s*#\s+6\. Après la capture/m);
    cmd(/sudo umount \/opt\/studio-axion-ia\/capture-maquettes\/<id> && sudo rm -f \/opt\/studio-axion-ia\/capture-maquettes-img\/<id>\.img && sudo rmdir /);
    // étape 3 : refaire l'étape 1 après la décompression
    cmd(/^\s*#\s+3\. Décompresser \(commande ci-dessus\), puis refaire l'étape 1 \(le conteneur est supprimé\)\.$/m);
    // réglage du noyau
    cmd(/`sysctl fs\.suid_dumpable` doit valoir 0 ou 2/);
    cmd(/sudo sysctl -w fs\.suid_dumpable=0/);
    cmd(/`setpriority` et SCHED_IDLE peuvent RETARDER la fin du conteneur/);
    cmd(/seul le `docker kill` de l'hôte la garantit, à l'échéance de 960 s/);
    cmd(/CONTRÔLER LA COPIE de la même façon/);
    cmd(/STUDIO_CAPTURE_MAQUETTE=\/opt\/studio-axion-ia\/capture-maquettes\/<id>\/maquette docker compose --profile capture run -d --name studio-capture-<id>/);
    // contrôles de la SOURCE (une commande par ligne, copiable) AVANT le cp, puis contrôles de la COPIE
    const D = "\\/opt\\/studio-axion-ia";
    const L = (re: string) => new RegExp(`^\\s*#\\s+${re}\\s*$`, "m");
    const srcFind = L(`sudo find ${D}\\/capture-sortie\\/maquette ! -type f ! -type d`);
    const srcReal = L(`sudo realpath -e ${D}\\/capture-sortie\\/maquette\\/<dossier>`);
    const neuf = L(`sudo mkdir -p ${D}\\/capture-maquettes && test ! -e ${D}\\/capture-maquettes\\/<id> && test ! -L ${D}\\/capture-maquettes\\/<id>`);
    const srcLiens = L(`sudo find ${D}\\/capture-sortie\\/maquette -type f -links \\+1`);
    const cp = L(`sudo cp -r --no-dereference ${D}\\/capture-sortie\\/maquette\\/<dossier> ${D}\\/capture-maquettes\\/<id>\\/maquette`);
    const copFind = L(`sudo find ${D}\\/capture-maquettes\\/<id>\\/maquette ! -type f ! -type d`);
    const copReal = L(`sudo realpath -e ${D}\\/capture-maquettes\\/<id>\\/maquette`);
    const fsMount = L(`sudo mkdir ${D}\\/capture-maquettes\\/<id> && sudo mount -o loop,nodev,nosuid,noexec .*`);
    // chaque critère est écrit sur la ligne qui PRÉCÈDE immédiatement la commande qu'il vise
    const avant = (critere: string, commande: RegExp) =>
      new RegExp(`^\\s*#\\s+${critere}[^\\n]*\\n${commande.source.replace(/^\^/, "")}`, "m");
    const critere = [
      avant("Critère 1 : [^\\n]*doit afficher RIEN", srcFind),
      avant("Critère 1 bis : [^\\n]*liens physiques[^\\n]*doit afficher RIEN", srcLiens),
      avant("Critère 2 : [^\\n]*doit être ÉGAL", srcReal),
      avant("Critère 3 : <id> doit être NEUF", neuf),
      avant("Critère 4 : [^\\n]*doit afficher RIEN[^\\n]*ÉGAL", copFind),
    ];
    critere.forEach((re, i) => expect(compose, `critère ${i + 1} juste avant sa commande`).toMatch(re));
    expect(compose).toMatch(/^\s*#\s+ne monter rien|au moindre écart : ARRÊT, ne rien monter\./m);
    expect(compose.search(/au moindre écart : ARRÊT, ne rien monter\./)).toBeGreaterThan(compose.indexOf("4. CONTRÔLER LA SOURCE"));
    expect(compose.search(/au moindre écart : ARRÊT, ne rien monter\./)).toBeLessThan(compose.search(srcFind));
    // la copie est suivie de son realpath, directement après son find
    expect(compose).toMatch(new RegExp(`${copFind.source.replace(/^\^/, "").replace(/\$$/, "")}\\n${copReal.source.replace(/^\^/, "")}`, "m"));
    // étape 5 : refaire le contrôle docker ps JUSTE AVANT de lancer
    const e5 = compose.indexOf("5. Refaire l'étape 2");
    const rappel = compose.indexOf("JUSTE AVANT de lancer, refaire le contrôle `docker ps` de l'étape 1");
    const lance = compose.indexOf("STUDIO_CAPTURE_MAQUETTE=/opt/studio-axion-ia/capture-maquettes/<id>/maquette docker compose");
    expect(e5).toBeGreaterThan(0);
    expect(rappel).toBeGreaterThan(e5);
    expect(lance).toBeGreaterThan(rappel);
    // `test ! -L` : un lien cassé ne passe pas `test ! -e`
    expect(compose).toMatch(/test ! -e [^\n]*<id> && test ! -L [^\n]*<id>/);
    const pos = [srcFind, srcLiens, srcReal, neuf, fsMount, cp, copFind, copReal].map((re) => compose.search(re));
    expect(pos.every((n) => n >= 0), JSON.stringify(pos)).toBe(true);
    expect([...pos].sort((x, y) => x - y)).toEqual(pos); // source (find, liens), realpath, id neuf, fs borné monté, cp, copie (find, realpath) : dans cet ordre
    // l'ordre des étapes : 1 (aucun conteneur) avant 2 (/sortie neuf) avant 4 (source puis copie) avant 5 (capture)
    const ordre = ["1. AUCUN conteneur", "2. Un /sortie NEUF", "3. Décompresser", "4. CONTRÔLER LA SOURCE", "5. Refaire"].map((t) => compose.indexOf(t));
    expect(ordre.every((n) => n >= 0)).toBe(true);
    expect([...ordre].sort((x, y) => x - y)).toEqual(ordre);
    // exactement 2 contrôles `! -type f ! -type d` (source, copie), 2 `realpath -e`, jamais `-type l` seul ni `ls`
    expect(compose.match(/! -type f ! -type d/g)).toHaveLength(2);
    expect(compose.match(/^\s*#\s+(sudo )?find /gm)).toHaveLength(3); // 2 `! -type f ! -type d` + 1 `-links +1`
    expect(compose.match(/-links \+1/g)).toHaveLength(1);
    expect(compose.match(/^\s*#\s+sudo realpath -e /gm)).toHaveLength(2);
    expect(compose.match(/realpath -e /g)).toHaveLength(2);
    expect(compose).not.toMatch(/-type l\b/);
    expect(compose).not.toMatch(/^\s*#\s+(sudo )?ls /m);
    // l'ancienne règle « monter la maquette prise dans capture-sortie » n'existe plus
    expect(compose).not.toMatch(/STUDIO_CAPTURE_MAQUETTE=\/opt\/studio-axion-ia\/capture-sortie/);
    expect(compose).toMatch(/docker SUIT sur l'hôte un lien/);
  });
  it("timeout en 0711 avant le USER final ; commentaires : seul docker kill garantit la durée ; umount réussit même avec un conteneur", () => {
    const l = dockerfileCode.split("\n");
    const chmod = l.findIndex((x) => x === "RUN chmod 0711 /usr/bin/timeout");
    const user = l.findIndex((x) => x === "USER 1001:1001");
    expect(chmod).toBeGreaterThanOrEqual(0);
    expect(user).toBeGreaterThan(chmod);
    expect(l.filter((x) => /chmod/.test(x) && /timeout/.test(x))).toEqual(["RUN chmod 0711 /usr/bin/timeout"]);
    expect(compose).toMatch(/seul le `docker kill` de l'HÔTE[^\n]*\n?[^\n]*GARANTIT/);
    expect(compose).toMatch(/ne font que la rendre\s+# plus difficile à contourner/);
    expect(compose).toMatch(/`umount` \(étape 2\) RÉUSSIT même si un conteneur garde \/sortie ouvert/);
    expect(compose).toMatch(/OBLIGATOIRE/);
  });
});

describe("T-EXT-51c · profil seccomp du service (ptrace du PID 1 interdit)", () => {
  const brut = lire("deploiement/studio-capture/seccomp.json");
  const profil = JSON.parse(brut);
  // Référence : profil par défaut de Docker 29.10.0, à l'identique (commit moby 06db173) :
  // https://github.com/moby/moby/blob/docker-v29.10.0/vendor/github.com/moby/profiles/seccomp/default.json
  const SHA256_REFERENCE = "6416b47770785a41ac59073cdc77d9fe98517df2799dc83ef207e622de3053f6";
  const RETIRES = ["ptrace", "process_vm_readv", "process_vm_writev"];
  /** Reconstruit la référence : remet les 3 noms retirés, dans leurs règles et à leurs places d'origine. */
  function reference() {
    const p = JSON.parse(brut);
    const regle = p.syscalls.find((r: { names: string[] }) => r.names.includes("process_madvise") && r.names.includes("kcmp"));
    regle.names.push("process_vm_readv", "process_vm_writev", "ptrace");
    p.syscalls.splice(1, 0, {
      names: ["process_vm_readv", "process_vm_writev", "ptrace"],
      action: "SCMP_ACT_ALLOW",
      includes: { minKernel: "4.8" },
    });
    return p;
  }
  it("le service charge ce profil, par le chemin relatif au compose, et le fichier existe à cet endroit", () => {
    expect(liste("security_opt")).toContain("- seccomp=./studio-capture/seccomp.json");
    expect(() => lire("deploiement/studio-capture/seccomp.json")).not.toThrow();
  });
  it("jamais unconfined, ni profil par défaut implicite", () => {
    for (const l of liste("security_opt")) expect(l).not.toMatch(/unconfined/i);
    expect(liste("security_opt").some((l) => /^- seccomp=/.test(l))).toBe(true);
    expect(brut).not.toMatch(/unconfined/i);
  });
  it("defaultAction SCMP_ACT_ERRNO ; aucun des 3 appels système dans une règle, ALLOW ou autre", () => {
    expect(profil.defaultAction).toBe("SCMP_ACT_ERRNO");
    for (const r of profil.syscalls as { names: string[]; action: string }[])
      for (const n of RETIRES) expect(r.names, `${r.action} ${n}`).not.toContain(n);
    expect(brut).not.toMatch(/"(ptrace|process_vm_readv|process_vm_writev)"/);
  });
  it("IDENTIQUE au profil par défaut de Docker 29.10.0 moins ces 3 noms : la référence reconstruite a l'empreinte figée", () => {
    const reconstruit = JSON.stringify(reference(), null, "\t");
    expect(createHash("sha256").update(reconstruit).digest("hex")).toBe(SHA256_REFERENCE);
  });
  it("seul le retrait est permis : aucune règle ajoutée, aucun nom ajouté", () => {
    const ref = reference();
    expect(profil.syscalls.length).toBe(ref.syscalls.length - 1);
    const noms = (p: { syscalls: { names: string[] }[] }) => p.syscalls.flatMap((r) => r.names);
    expect(noms(profil).filter((n) => !noms(ref).includes(n))).toEqual([]);
    expect(noms(ref).length - noms(profil).length).toBe(RETIRES.length * 2);
  });
});

describe("T-EXT-51c · lancer.sh EXÉCUTÉ (faux grep, df, timeout dans un PATH temporaire)", () => {
  const dir = mkdtempSync(join(tmpdir(), "lancer-test-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const faux = (nom: string, corps: string) => {
    writeFileSync(join(dir, nom), `#!/bin/sh\n${corps}\n`);
    chmodSync(join(dir, nom), 0o755);
  };
  faux("grep", 'exit "${FAUX_GREP:-0}"');
  faux("df", 'echo Size; echo "${FAUX_DF-}"');
  faux("timeout", 'echo APPEL_TIMEOUT; for a in "$@"; do echo "ARG:$a"; done');
  const lancerSh = join(RACINE, "deploiement/studio-capture/lancer.sh");
  const lancerEn = (env: Record<string, string>, ...args: string[]) => {
    const r = spawnSync("sh", [lancerSh, ...args], {
      env: { PATH: `${dir}:${process.env.PATH}`, ...env } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    return { code: r.status, out: r.stdout, err: r.stderr, appele: r.stdout.includes("APPEL_TIMEOUT"), args: r.stdout.split("\n").filter((l) => l.startsWith("ARG:")).map((l) => l.slice(4)) };
  };
  const TSX = "node_modules/.bin/tsx";
  const CAP = "outils/maquettes-tableaux-de-bord/capture/capturer.mts";
  const DEC = "outils/maquettes-tableaux-de-bord/capture/decompresser.mts";
  it("/sortie n'est pas un point de montage : code 64, timeout jamais appelé", () => {
    const r = lancerEn({ FAUX_GREP: "1", FAUX_DF: "3094126592" }, "--maquette", "x");
    expect(r.code).toBe(64);
    expect(r.appele).toBe(false);
    expect(r.err).toContain("refus de démarrer");
  });
  it("/sortie trop grande (5 Gio) : code 65, timeout jamais appelé ; 4 Gio + 1 octet aussi ; exactement 4 Gio accepté", () => {
    for (const n of ["5368709120", "4294967297"]) {
      const r = lancerEn({ FAUX_DF: n }, "--maquette", "x");
      expect(r.code, n).toBe(65);
      expect(r.appele, n).toBe(false);
    }
    expect(lancerEn({ FAUX_DF: "4294967296" }, "--maquette", "x").code).toBe(0);
  });
  it("taille illisible (vide, texte) : code 65, timeout jamais appelé", () => {
    for (const n of ["", "abc", "12x34", "-1"]) {
      const r = lancerEn({ FAUX_DF: n }, "--maquette", "x");
      expect(r.code, JSON.stringify(n)).toBe(65);
      expect(r.appele, JSON.stringify(n)).toBe(false);
    }
  });
  it("bon (3 Gio), mode par défaut : exec timeout --kill-after=30 900 tsx capturer.mts avec les arguments tels quels", () => {
    const r = lancerEn({ FAUX_DF: "3094126592" }, "--maquette", "un dossier", "--sortie", "/sortie");
    expect(r.code).toBe(0);
    expect(r.args).toEqual(["--kill-after=30", "900", TSX, CAP, "--maquette", "un dossier", "--sortie", "/sortie"]);
  });
  it("mode capturer explicite : le mot « capturer » est retiré (shift)", () => {
    const r = lancerEn({ FAUX_DF: "3094126592" }, "capturer", "--maquette", "x");
    expect(r.args).toEqual(["--kill-after=30", "900", TSX, CAP, "--maquette", "x"]);
  });
  it("mode decompresser : timeout --kill-after=30 300, sans le mot « decompresser » dans les arguments", () => {
    const r = lancerEn({ FAUX_DF: "3094126592" }, "decompresser", "--zip", "a", "--sortie", "b");
    expect(r.code).toBe(0);
    expect(r.args).toEqual(["--kill-after=30", "300", TSX, DEC, "--zip", "a", "--sortie", "b"]);
  });
  it("mode inconnu : code 66, timeout jamais appelé (sh, -h, CAPTURER)", () => {
    for (const m of ["sh", "-h", "CAPTURER", "id"]) {
      const r = lancerEn({ FAUX_DF: "3094126592" }, m);
      expect(r.code, m).toBe(66);
      expect(r.appele, m).toBe(false);
    }
  });
  it("verifier avec un argument : code 66, timeout jamais appelé", () => {
    const r = lancerEn({ FAUX_DF: "3094126592" }, "verifier", "x");
    expect(r.code).toBe(66);
    expect(r.appele).toBe(false);
  });
  it("construire (hors de ce lot) : code 66, timeout jamais appelé", () => {
    const r = lancerEn({ FAUX_DF: "3094126592" }, "construire");
    expect(r.code).toBe(66);
    expect(r.appele).toBe(false);
  });
  it("sans argument : mode capturer par défaut", () => {
    const r = lancerEn({ FAUX_DF: "3094126592" });
    expect(r.args).toEqual(["--kill-after=30", "900", TSX, CAP]);
  });
});

describe("POSTE-1 · mode verifier (ffprobe sur la copie, dans un conteneur jetable)", () => {
  const brut = lire("deploiement/studio-capture/lancer.sh");
  const ligneVerifier = lancer.split("\n").find((l) => /^\s*exec\s.*ffprobe/.test(l)) ?? "";
  it("exactement trois modes : capturer | decompresser | verifier, chacun sous exec timeout --kill-after=30 (900/300/60)", () => {
    expect(lancer).toMatch(/capturer \| decompresser \| verifier\)/);
    expect(lancer).not.toMatch(/construire/);
    const durees = lancer.split("\n").filter((l) => /^\s*exec\s/.test(l)).map((l) => /^\s*exec timeout --kill-after=30 (\d+) /.exec(l)?.[1]);
    expect(durees).toEqual(["900", "300", "60"]);
  });
  it("verifier : ffprobe sur /entree/navigation.mp4 seul, sortie vers /sortie/ffprobe.json, aucun \"$@\"", () => {
    expect(ligneVerifier).toMatch(/exec timeout --kill-after=30 60 ffprobe -v error -f mov -show_entries format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate -of json \/entree\/navigation\.mp4 > \/sortie\/ffprobe\.json\s*$/);
    expect(ligneVerifier).not.toMatch(/\$@|\$\*/);
    // noclobber posé avant l'exec dans la branche verifier
    const bloc = /^ {2}verifier\)\n([\s\S]*?)^ {4};;/m.exec(lancer)?.[1] ?? "";
    expect(bloc).toMatch(/^\s*set -C\s*$/m);
    expect(bloc.indexOf("set -C")).toBeLessThan(bloc.indexOf("exec timeout"));
  });
  it("verifier refuse tout argument (code 66) avant l'exec", () => {
    const bloc = /^ {2}verifier\)\n([\s\S]*?)^ {4};;/m.exec(lancer)?.[1] ?? "";
    expect(bloc.indexOf('"$#" -gt 0')).toBeGreaterThanOrEqual(0);
    expect(bloc.indexOf("exit 66")).toBeLessThan(bloc.indexOf("exec timeout"));
  });
  it("les contrôles de /sortie (64, 65) précèdent le choix du mode et tout exec", () => {
    expect(lancer.indexOf("exit 64")).toBeLessThan(lancer.indexOf("case \"$1\" in"));
    expect(lancer.indexOf("exit 65")).toBeLessThan(lancer.indexOf("case \"$mode\" in"));
    expect(lancer.indexOf("exit 65")).toBeLessThan(lancer.indexOf("exec timeout"));
  });
  it("lancer.sh passe sh -n et reste de la POSIX sh ; le Dockerfile ne change aucune garde", () => {
    expect(spawnSync("sh", ["-n", join(RACINE, "deploiement/studio-capture/lancer.sh")]).status).toBe(0);
    expect(brut.split("\n")[0]).toBe("#!/bin/sh");
    expect(dockerfileCode).not.toMatch(/ecrire-maquette|constructeur/);
    expect(dockerfileCode).toMatch(/^RUN chmod 0711 \/usr\/bin\/timeout\s*$/m);
  });
});
