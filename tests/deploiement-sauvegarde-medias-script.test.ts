/**
 * L2-12b — sauvegarde nocturne des médias : script, cron, alerte. Le script est EXÉCUTÉ (bash) avec le faux docker
 * (tests/helpers/faux-docker.sh) et un faux `node` dans le PATH : aucun réseau, aucun seau, aucune clé.
 * Contrat de copier-r2.mjs medias-delta : sortie 0 / 1 / 3, dernière ligne JSON {"copies","deja","echecs"}.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DEPOT = resolve(__dirname, "..");
const SCRIPT = join(DEPOT, "deploiement/sauvegarder-medias.sh");
const FAUX = join(DEPOT, "tests/helpers/faux-docker.sh");

// Enveloppe de `docker` : `run … medias-delta` exécute le faux `node` du PATH (sans réseau) ; tout le reste (dont
// `run … alerte`, noté dans alertes.log) est confié au faux docker du dépôt.
const ENVELOPPE = `#!/usr/bin/env bash
if [ "\${1:-}" = run ] && [[ "$*" == *medias-delta* ]]; then
  echo "docker $*" >>"$FAUX_DOCKER/appels.log"
  exec node /copie/copier-r2.mjs medias-delta
fi
exec "${FAUX}" "$@"
`;

function banc(o: { code: number; sortie?: string; r2?: boolean; secours?: boolean }) {
  const d = mkdtempSync(join(tmpdir(), "l2-12b-"));
  const racine = join(d, "opt");
  const faux = join(d, "faux");
  const bin = join(d, "bin");
  for (const p of [racine, faux, bin]) mkdirSync(p, { recursive: true });
  writeFileSync(join(bin, "docker"), ENVELOPPE, { mode: 0o755 });
  writeFileSync(join(bin, "node"), `#!/usr/bin/env bash\nprintf '%s\\n' '${o.sortie ?? ""}'\nexit ${o.code}\n`, { mode: 0o755 });
  chmodSync(FAUX, 0o755);
  symlinkSync(FAUX, join(bin, "faux-docker"));
  const lignes = ["POSTGRES_PASSWORD=essai"];
  if (o.r2 !== false) lignes.push("R2_ACCOUNT_ID=compte", "R2_ACCESS_KEY_ID=cle-essai", "R2_SECRET_ACCESS_KEY=secret-essai", "R2_BUCKET=source");
  if (o.secours !== false) lignes.push("R2_BUCKET_SECOURS=secours");
  writeFileSync(join(racine, ".env"), lignes.join("\n") + "\n");
  const r = spawnSync("bash", [SCRIPT], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAUX_DOCKER: faux, STUDIO_RACINE: racine },
    encoding: "utf8",
    timeout: 30000,
  });
  const lire = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");
  return {
    status: r.status,
    sortie: `${r.stdout}${r.stderr}`,
    journal: lire(join(racine, "sauvegardes/sauvegardes-medias.log")),
    alertes: lire(join(faux, "alertes.log")),
    appels: lire(join(faux, "appels.log")),
  };
}

describe("L2-12b : sauvegarder-medias.sh", () => {
  it("succès : une ligne datée dans le journal, aucune alerte", () => {
    const r = banc({ code: 0, sortie: '{"copies":2,"deja":5,"echecs":0}' });
    expect(r.status).toBe(0);
    expect(r.journal).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} OK.*copies.*2/m);
    expect(r.alertes).toBe("");
    expect(r.appels).toMatch(/medias-delta/);
  });

  it("échec de la copie (sortie 1) : ligne ÉCHEC et alerte", () => {
    const r = banc({ code: 1, sortie: '{"copies":1,"deja":0,"echecs":1}' });
    expect(r.status).not.toBe(0);
    expect(r.journal).toMatch(/ÉCHEC/);
    expect(r.alertes).toMatch(/copier-r2\.mjs.* alerte/);
    expect(r.alertes).toMatch(/ÉCHEC/);
  });

  it("seau de secours absent (sortie 3) : alerte claire, sans clé ni e-mail", () => {
    const r = banc({ code: 3, sortie: "R2_BUCKET_SECOURS absent", secours: false });
    expect(r.status).not.toBe(0);
    expect(r.alertes).toMatch(/copier-r2\.mjs.* alerte/);
    expect(r.alertes).not.toMatch(/cle-essai|secret-essai|@/);
  });

  it("R2 absent du .env : alerte sans lancer la copie", () => {
    const r = banc({ code: 0, r2: false, secours: false });
    expect(r.status).not.toBe(0);
    expect(r.alertes).toMatch(/alerte/);
    expect(r.appels).not.toMatch(/medias-delta/);
  });
});

describe("L2-12b : lecture du script, du cron et de env.exemple", () => {
  const script = existsSync(SCRIPT) ? readFileSync(SCRIPT, "utf8") : "";
  it("aucun DELETE, rm sur un seau, --delete ni sync", () => {
    expect(script.length).toBeGreaterThan(0);
    expect(script).not.toMatch(/DELETE|--delete|rclone|\bsync\b|aws s3|(?<![-\w])rm\s/i);
    expect(script).toMatch(/copier-r2\.mjs/);
    expect(script).toMatch(/medias-delta/);
  });
  it("crontab : 4 h chaque nuit, lignes existantes inchangées", () => {
    const cron = readFileSync(join(DEPOT, "deploiement/crontab"), "utf8");
    expect(cron).toMatch(/^0 4 \* \* \* root \/bin\/bash \/opt\/studio-axion-ia\/source\/deploiement\/sauvegarder-medias\.sh .*\/opt\/studio-axion-ia\/sauvegardes\//m);
    expect(cron).toMatch(/^30 3 \* \* \* root .*sauvegarder\.sh/m);
    expect(cron).toMatch(/^\*\/5 \* \* \* \* root .*surveiller\.sh/m);
    expect(cron).toMatch(/^15 4 \* \* \* root .*nettoyer-disque\.sh/m);
  });
  it("env.exemple documente R2_BUCKET_SECOURS= vide", () => {
    const env = readFileSync(join(DEPOT, "deploiement/env.exemple"), "utf8");
    expect(env).toMatch(/^R2_BUCKET_SECOURS=$/m);
    expect(env).toMatch(/second seau créé par le fondateur/);
  });
});
