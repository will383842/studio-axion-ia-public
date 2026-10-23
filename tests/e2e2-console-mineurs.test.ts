/**
 * Vérification de bout en bout n° 2 — points de la console :
 * - parcours n° 11 : Réglages › Mention IA ne porte plus aucune phrase juridique (simple interrupteur facultatif) ;
 * - parcours n° 21 : les mots-dièse du type avocat parlent d'Axion-IA, pas de droit du travail ;
 * - parcours n° 22 : « votre ton » (le nom) n'est plus pris pour un tutoiement ;
 * - parcours n° 23 : une seule des deux recherches de la coquille répond au raccourci clavier ;
 * - argent n° 16 : le mois du budget se compte à l'heure de Paris.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alerteAdresse, analyserAdresse } from "@/domaine/adresse";
import { motsDiesePour } from "@/domaine/textes-publication";
import { cleMois } from "@/lib/dates";
import { chiffresCoutVideo } from "@/domaine/cout-video";
import { repondAuRaccourci } from "@/components/coquille/Recherche";

function fichiers(dossier: string, liste: string[] = []): string[] {
  for (const n of readdirSync(dossier)) {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) fichiers(p, liste);
    else if (/\.(ts|tsx)$/.test(n)) liste.push(p);
  }
  return liste;
}

describe("E2E-2 parcours n° 11 · Réglages › Mention IA sans phrase juridique", () => {
  it("aucun écran ni commentaire de la console ne parle de règle européenne ou d'avis d'avocat à propos de la mention", () => {
    const racines = ["src/components", "src/app", "src/services", "src/lib", "src/formats", "src/domaine"].map((r) => join(process.cwd(), r));
    const fautifs = racines.flatMap((r) => fichiers(r)).filter((f) => /règle européenne|AI Act|art\. 50\(4\)|confirmer avec votre avocat|après avis d'un avocat/i.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("le texte d'aide reste : facultative, coupée par défaut", () => {
    const source = readFileSync(join(process.cwd(), "src/components/reglages/Preferences.tsx"), "utf8");
    expect(source).toMatch(/Facultative, coupée par défaut/);
  });
});

describe("E2E-2 parcours n° 21 · mots-dièse du type avocat", () => {
  it("thèmes d'Axion-IA, jamais le droit du travail", () => {
    const tags = motsDiesePour("avocat", "linkedin", 10);
    expect(tags).not.toContain("#DroitDuTravail");
    expect(tags).not.toContain("#Avocat");
    expect(tags).not.toContain("#Salarié");
    expect(tags).toContain("#AxionIA");
  });
});

describe("E2E-2 parcours n° 22 · « ton » nom commun", () => {
  it("un texte au vouvoiement contenant « votre ton » ne déclenche aucune alerte", () => {
    const t = "Gardez votre ton naturel : vous parlez à un dirigeant, pas à un jury. Le ton juste vous fait gagner du temps.";
    expect(analyserAdresse(t).melange).toBe(false);
    expect(alerteAdresse(t, "vous")).toBeNull();
  });
  it("« je tiens à » non plus ; un vrai tutoiement reste repéré", () => {
    expect(analyserAdresse("Je tiens à vous le dire : vos devis dorment.").melange).toBe(false);
    expect(analyserAdresse("Vous savez ce que ton patron pense ?").melange).toBe(true);
  });
});

describe("E2E-2 parcours n° 23 · une seule recherche au raccourci", () => {
  it("grand écran : le champ ; petit écran : la loupe", () => {
    expect(repondAuRaccourci("champ", true)).toBe(true);
    expect(repondAuRaccourci("icone", true)).toBe(false);
    expect(repondAuRaccourci("champ", false)).toBe(false);
    expect(repondAuRaccourci("icone", false)).toBe(true);
  });
});

describe("E2E-2 argent n° 16 · mois du budget à l'heure de Paris", () => {
  it("le 1er octobre à 1 h (Paris) = 30 septembre 23 h UTC : octobre, même sur un serveur réglé en UTC", () => {
    const avant = process.env.TZ;
    process.env.TZ = "UTC"; // le conteneur de production tourne en UTC
    try {
      expect(cleMois("2026-09-30T23:30:00.000Z")).toBe("2026-10");
      expect(cleMois("2026-10-31T22:30:00.000Z")).toBe("2026-10"); // 23 h 30 à Paris (heure d'hiver)
      expect(cleMois("2026-10-31T23:30:00.000Z")).toBe("2026-11");
    } finally {
      if (avant === undefined) delete process.env.TZ;
      else process.env.TZ = avant;
    }
  });
});

describe("E2E-2 argent n° 6 et 7 (demande du correcteur argent) · fiche vidéo : payé et essai séparés", () => {
  const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
  it("voix payée + double simulé : « Coût payé » sans ESSAI, « Essai, pas payé » avec ESSAI", () => {
    const c = chiffresCoutVideo({ paye: eur(120), essai: eur(565), nbDepenses: 1, fabricationSimulee: true });
    expect(c).toEqual([
      { libelle: "Coût payé", montant: eur(120) },
      { libelle: "Essai, pas payé", montant: eur(565), essai: true },
    ]);
  });
  it("tout payé : une seule case, sans ESSAI ; rien d'enregistré : l'estimation", () => {
    expect(chiffresCoutVideo({ paye: eur(300), essai: eur(0), nbDepenses: 2, fabricationSimulee: false })).toEqual([{ libelle: "Coût payé", montant: eur(300) }]);
    expect(chiffresCoutVideo({ paye: eur(0), essai: eur(0), nbDepenses: 0, coutEstime: eur(400), fabricationSimulee: true })[0]).toMatchObject({ estime: true, essai: true });
  });
});
