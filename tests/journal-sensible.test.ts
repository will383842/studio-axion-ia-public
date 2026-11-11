/**
 * L8-17 · journal des actions sensibles (une ligne par action, liste blanche, aucune donnée de personne).
 * Aucun réseau : seule la sortie standard est observée.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIONS_SENSIBLES,
  PREFIXE_JOURNAL_SENSIBLE,
  filtrerActionSensible,
  journaliserActionSensible,
  journaliserBasculeInterrupteur,
} from "@/services/journal-sensible";

afterEach(() => vi.restoreAllMocks());

function lignes(espion: ReturnType<typeof vi.spyOn>): string[] {
  return espion.mock.calls.map((a) => String(a[0]));
}

describe("journal des actions sensibles", () => {
  it("couvre interrupteur, promotion, clé, export et prise de main", () => {
    expect([...ACTIONS_SENSIBLES].sort()).toEqual(["cle", "export", "interrupteur", "priseDeMain", "promotion"].sort());
  });

  it("écrit exactement une ligne par bascule de l'interrupteur", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    journaliserBasculeInterrupteur({ acteur: "fondateur", reglage: "zernio.envoi_calendrier_autorise", etat: true });
    journaliserBasculeInterrupteur({ acteur: "fondateur", reglage: "zernio.envoi_calendrier_autorise", etat: false });
    const l = lignes(log);
    expect(l).toHaveLength(2);
    for (const ligne of l) expect(ligne.startsWith(`${PREFIXE_JOURNAL_SENSIBLE} {`)).toBe(true);
    const a = JSON.parse(l[0].slice(PREFIXE_JOURNAL_SENSIBLE.length + 1));
    expect(a).toMatchObject({ action: "interrupteur", acteur: "fondateur", cible: "zernio.envoi_calendrier_autorise", etat: "allume" });
    expect(typeof a.ts).toBe("string");
    expect(JSON.parse(l[1].slice(PREFIXE_JOURNAL_SENSIBLE.length + 1)).etat).toBe("eteint");
  });

  it("n'écrit ni e-mail ni pseudo ni champ inconnu", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    journaliserActionSensible({
      action: "cle",
      acteur: "marie@exemple.fr",
      cible: "@pseudo_fictif",
      etat: "cree",
      email: "paul@exemple.fr",
      pseudo: "jean",
      detail: "secret-fictif",
    } as never);
    const texte = lignes(log).join("\n");
    expect(texte).not.toMatch(/exemple\.fr|@|pseudo|jean|secret/);
    const o = JSON.parse(texte.slice(PREFIXE_JOURNAL_SENSIBLE.length + 1));
    expect(Object.keys(o).sort()).toEqual(["action", "etat", "ts"]);
  });

  it("refuse une action inconnue : rien n'est écrit", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    journaliserActionSensible({ action: "autre", acteur: "fondateur" } as never);
    expect(log).not.toHaveBeenCalled();
    expect(filtrerActionSensible({ action: "autre" })).toBeNull();
    expect(filtrerActionSensible(null)).toBeNull();
  });

  it("ne lève jamais, même si la sortie échoue", () => {
    vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("sortie fermée");
    });
    expect(() => journaliserActionSensible({ action: "export", acteur: "systeme" })).not.toThrow();
  });

  it("n'expose aucune purge", async () => {
    const m = await import("@/services/journal-sensible");
    expect(Object.keys(m).filter((k) => /purg|supprim|effac|vider/i.test(k))).toEqual([]);
  });
});
