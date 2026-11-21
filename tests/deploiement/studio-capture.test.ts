/**
 * T-EXT-51b · poste de capture sans réseau : lecture de TEXTE seulement (compose, Dockerfile, script de mise à jour).
 * Aucun docker, aucun réseau, aucun navigateur, aucune IA.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
    const volumes = service.split("\n").filter((l) => /^\s+- .*:\/.*/.test(l) && !/^\s+- \/tmp:/.test(l));
    expect(volumes.length).toBeGreaterThanOrEqual(3);
    const inscriptibles = volumes.filter((l) => !/:ro\s*$/.test(l));
    expect(inscriptibles).toHaveLength(1);
    expect(inscriptibles[0]).toMatch(/:\/sortie\s*$/);
    expect(volumes.some((l) => /:\/app\/outils\/maquettes-tableaux-de-bord\/maquette:ro\s*$/.test(l))).toBe(true);
    expect(volumes.some((l) => /:\/entree:ro\s*$/.test(l))).toBe(true);
  });
  it("tmpfs minimal et borné", () => {
    const tmpfs = service.split("\n").filter((l) => /^\s+- \/\w+:.*size=/.test(l));
    expect(tmpfs).toHaveLength(1);
    const m = /size=(\d+)m/.exec(tmpfs[0]);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(512);
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
    expect(dockerfileCode).toContain(`@playwright/test@${v}`);
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
    expect(dockerfileCode).toMatch(/^ENTRYPOINT \["timeout", "--kill-after=\d+", "900",/m);
    expect(dockerfileCode).toMatch(/^RUN .*verifier-poste\.mts/m);
    // la vérification vient avant le dernier USER/ENTRYPOINT et rien n'est lancé après
    expect(dockerfileCode.indexOf("verifier-poste.mts")).toBeLessThan(dockerfileCode.indexOf("ENTRYPOINT"));
  });
  it("copie seulement capture, poste et le scénario (+ son unique import, la police)", () => {
    const copies = dockerfileCode.split("\n").filter((l) => /^COPY\s/.test(l) && !/--from=/.test(l));
    const sources = copies.flatMap((l) => l.replace(/^COPY\s+(--\S+\s+)*/, "").split(/\s+/).slice(0, -1));
    expect(sources.sort()).toEqual(
      [
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
