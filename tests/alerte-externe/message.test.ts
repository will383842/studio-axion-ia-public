/**
 * L5-08 : alerte externe sans IA. surveiller.sh prévient par e-mail (chemin d'alerte existant) quand /api/sante répond
 * autre chose que 200 (503…) ou quand la dernière sauvegarde réussie est trop ancienne. Santé OK : rien. Jamais de clé
 * ni d'adresse e-mail dans le message. Scripts exécutés pour de vrai avec le faux `docker` : aucun appel réel.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bancServeur, type BancServeur } from "../helpers/banc-serveur";

const bancs: BancServeur[] = [];
function banc() {
  const b = bancServeur();
  b.poser("stats", "studio-axion-ia-studio-1;12.00%;300MiB / 2GiB\n");
  bancs.push(b);
  return b;
}
afterAll(() => {
  for (const b of bancs) rmSync(b.dossier, { recursive: true, force: true });
});

const alertes = (b: BancServeur) => (existsSync(join(b.faux, "alertes.log")) ? readFileSync(join(b.faux, "alertes.log"), "utf8").trim().split("\n") : []);
const SECRET = "cle-secrete-0123456789abcdef";
const ADRESSE = "destinataire@exemple.invalid";

function poserSecrets(b: BancServeur) {
  appendFileSync(join(b.racine, ".env"), `EMAIL_SECOURS_CLE=${SECRET}\nEMAIL_SECOURS_DESTINATAIRE=${ADRESSE}\nEMAIL_SECOURS_EXPEDITEUR=expediteur@exemple.invalid\n`);
}

function derniereSauvegarde(b: BancServeur, ageHeures: number) {
  const dossier = join(b.racine, "sauvegardes");
  mkdirSync(dossier, { recursive: true });
  const f = join(dossier, "DERNIER-SUCCES");
  writeFileSync(f, "2026-01-01 03:30:00\n");
  const t = new Date(Date.now() - ageHeures * 3600_000);
  utimesSync(f, t, t);
}

describe("L5-08 alerte externe : santé", () => {
  it("503 sur /api/sante : un message d'alerte, code 2", () => {
    const b = banc();
    b.poser("sante-ko");
    const r = b.lancer("surveiller.sh");
    expect(r.status, r.sortie).toBe(2);
    const a = alertes(b);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/\/api\/sante/);
  });

  it("santé OK : aucun message, code 0", () => {
    const b = banc();
    const r = b.lancer("surveiller.sh");
    expect(r.status, r.sortie).toBe(0);
    expect(alertes(b)).toHaveLength(0);
  });

  it("panne qui dure : un seul message par heure ; retour à la normale puis nouvelle panne : un nouveau message", () => {
    const b = banc();
    b.poser("sante-ko");
    b.lancer("surveiller.sh");
    b.lancer("surveiller.sh");
    expect(alertes(b)).toHaveLength(1);
    rmSync(join(b.faux, "sante-ko"));
    expect(b.lancer("surveiller.sh").status).toBe(0);
    b.poser("sante-ko");
    b.lancer("surveiller.sh");
    expect(alertes(b)).toHaveLength(2);
  });

  it("ni clé ni adresse e-mail dans le message envoyé", () => {
    const b = banc();
    poserSecrets(b);
    b.poser("sante-ko");
    b.lancer("surveiller.sh");
    const a = alertes(b).join("\n");
    expect(a).toMatch(/\/api\/sante/);
    expect(a).not.toContain(SECRET);
    expect(a).not.toContain(ADRESSE);
    expect(a).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});

describe("L5-08 alerte externe : texte de l'alerte de bout en bout", () => {
  it("une adresse ou une clé qui se glisse dans le texte (titre ou message) est masquée avant l'envoi", () => {
    const b = banc();
    poserSecrets(b);
    b.poser("stats", `studio-axion-ia-${ADRESSE};90.00%;1GiB / 1GiB\nstudio-axion-ia-${SECRET};91.00%;1GiB / 1GiB\n`);
    const r = b.lancer("surveiller.sh");
    expect(r.status, r.sortie).toBe(2);
    const a = alertes(b).join("\n");
    expect(a).toMatch(/de sa mémoire/);
    expect(a).not.toContain(ADRESSE);
    expect(a).not.toContain(SECRET);
    expect(a).toContain("masquée]");
  });
});

describe("L5-08 alerte externe : dernière sauvegarde réussie (DERNIER-SUCCES)", () => {
  it("plus de 36 h : message d'alerte", () => {
    const b = banc();
    derniereSauvegarde(b, 72);
    const r = b.lancer("surveiller.sh");
    expect(r.status, r.sortie).toBe(2);
    const a = alertes(b);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/sauvegarde/i);
  });

  it("récente (2 h) : rien", () => {
    const b = banc();
    derniereSauvegarde(b, 2);
    expect(b.lancer("surveiller.sh").status).toBe(0);
    expect(alertes(b)).toHaveLength(0);
  });

  it("aucune sauvegarde encore (première installation) : rien", () => {
    const b = banc();
    expect(b.lancer("surveiller.sh").status).toBe(0);
    expect(alertes(b)).toHaveLength(0);
  });
});

describe("L5-08 alerte externe : nettoyage du message (alerte.sh)", () => {
  function nettoyer(texte: string, env: Record<string, string> = {}) {
    const racine = join(__dirname, "../../deploiement");
    const r = spawnSync("bash", ["-c", `ICI="${racine}"; source "${racine}/alerte.sh"; nettoyer_message "$1"`, "x", texte], { env: { ...process.env, ...env }, encoding: "utf8" });
    return r.stdout;
  }

  it("masque une adresse e-mail", () => {
    const s = nettoyer("échec pour a.b+c@exemple.invalid ce matin");
    expect(s).not.toMatch(/@/);
    expect(s).toContain("ce matin");
  });

  it("masque la valeur d'une clé du .env et un long jeton", () => {
    const s = nettoyer(`erreur 401 avec ${SECRET} et jeton ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`, { EMAIL_SECOURS_CLE: SECRET });
    expect(s).not.toContain(SECRET);
    expect(s).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    expect(s).toContain("erreur 401");
  });

  it("laisse un message ordinaire intact", () => {
    expect(nettoyer("Studio Axion-IA : /api/sante répond 503 (disque 91 %)")).toBe("Studio Axion-IA : /api/sante répond 503 (disque 91 %)");
  });
});
