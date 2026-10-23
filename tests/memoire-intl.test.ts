/**
 * Mémoire native (17/10, docs/memoire-native/COMPTE-RENDU.md) : un formateur Intl créé À CHAQUE APPEL entassait de la
 * mémoire ICU (malloc, invisible pour V8) jusqu'au ramasse-miettes : 1,2 Go dans le tas de glibc, jamais rendu. Les
 * formateurs sont désormais partagés (`src/lib/intl.ts`) ; ces essais empêchent le retour du problème.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const RACINE = join(__dirname, "..", "src");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("formateurs Intl : jamais un nouveau par appel", () => {
  it("aucun `new Intl.…` hors d'une constante de module (sauf src/lib/intl.ts)", () => {
    const fautifs: string[] = [];
    for (const f of fichiers(RACINE)) {
      const chemin = relative(RACINE, f);
      if (chemin === join("lib", "intl.ts")) continue;
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          if (!/\bIntl\.[A-Z]\w*\(/.test(ligne)) return;
          // Seule forme permise : une constante de MODULE, créée une fois au chargement.
          if (/^(export )?const \w+ = new Intl\.[A-Z]\w*\(/.test(ligne)) return;
          fautifs.push(`src/${chemin}:${i + 1} : ${ligne.trim().slice(0, 120)}`);
        });
    }
    expect(fautifs, "Utilisez formateurDate / formateurNombre / formateurRelatif / formateurNoms de @/lib/intl").toEqual([]);
  });

  describe("à l'exécution", () => {
    const origine = Intl.DateTimeFormat;
    afterEach(() => {
      Intl.DateTimeFormat = origine;
      vi.resetModules();
    });

    it("10 000 clés de jour et de mois (le budget de l'accueil) : un seul formateur créé", async () => {
      let crees = 0;
      Intl.DateTimeFormat = new Proxy(origine, {
        construct(cible, args, nouvelle) {
          crees++;
          return Reflect.construct(cible, args, nouvelle);
        },
      });
      vi.resetModules();
      const { cleJour, cleMois } = await import("@/lib/dates");
      const { moisParis } = await import("@/services/couts");
      for (let i = 0; i < 10_000; i++) {
        const d = new Date(Date.UTC(2026, 0, 1) + i * 3_600_000);
        cleJour(d);
        cleMois(d);
        moisParis(d);
      }
      expect(crees).toBe(1);
      // Le résultat reste celui d'avant (heure de Paris) : le 31/12 à 23 h 30 UTC est déjà le 1er janvier à Paris.
      expect(cleJour("2026-12-31T23:30:00Z")).toBe("2027-01-01");
      expect(cleMois("2026-10-31T23:30:00Z")).toBe("2026-11");
    });

    it("mêmes réglages : même formateur ; réglages différents : formateurs différents", async () => {
      const { formateurDate, formateurNombre } = await import("@/lib/intl");
      expect(formateurDate("fr-FR", { timeZone: "Europe/Paris" })).toBe(formateurDate("fr-FR", { timeZone: "Europe/Paris" }));
      expect(formateurDate("fr-FR", { timeZone: "UTC" })).not.toBe(formateurDate("fr-FR", { timeZone: "Europe/Paris" }));
      expect(formateurNombre("fr-FR", { maximumFractionDigits: 1 }).format(1.25)).toBe("1,3");
    });
  });
});
