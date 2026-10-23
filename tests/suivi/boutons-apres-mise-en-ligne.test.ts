/**
 * Boutons du suivi commun après une mise en ligne : une page ouverte avant garde l'ancien identifiant d'action, le
 * serveur la refuse. Le clic doit dire pourquoi (phrase visible), jamais échouer sans rien dire.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHRASES_ACTION, estActionInconnue, phrasePanneAction } from "@/components/ui/phrasesAction";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("phrase d'une action qui échoue", () => {
  it("identifiant d'action inconnu (erreur de Next, ou son texte recopié) : « rechargez-la »", () => {
    const next = Object.assign(new Error('Server Action "40abc" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'), { name: "UnrecognizedActionError" });
    expect(estActionInconnue(next)).toBe(true);
    expect(phrasePanneAction(next)).toBe("La page date d'avant la dernière mise à jour : rechargez-la.");
    expect(phrasePanneAction(new Error('Server Action "40abc" was not found on the server.'))).toBe(PHRASES_ACTION.pageAncienne);
  });

  it("toute autre panne (réseau, texte, rien) : une phrase de panne, au vouvoiement", () => {
    for (const err of [new TypeError("Failed to fetch"), "boum", null, undefined, {}]) {
      expect(estActionInconnue(err)).toBe(false);
      expect(phrasePanneAction(err)).toBe(PHRASES_ACTION.panne);
    }
    expect(PHRASES_ACTION.panne).not.toMatch(/\b(tu|ton|ta|tes)\b|undefined|Error/i);
  });
});

describe("suivi commun", () => {
  const suivi = lire("src/components/videos/SuiviTravail.tsx");

  it("chaque action est dans un try/catch qui pose la phrase, et la relance acceptée relit le suivi tout de suite", () => {
    expect(suivi.match(/catch \(err\)/g)).toHaveLength(2);
    expect(suivi.match(/phrasePanneAction\(err\)/g)).toHaveLength(2);
    expect(suivi.match(/void actualiser\(\)/g)).toHaveLength(2);
    expect(suivi).toContain("message={panne}");
  });

  it("ProgressionEtapes montre la phrase (role=alert)", () => {
    const prog = lire("src/components/ui/ProgressionEtapes.tsx");
    expect(prog).toMatch(/message && \(\s*<p role="alert"/);
  });
});
