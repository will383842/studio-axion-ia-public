/** L8-11a : nouvelle version d'un contenu publié, contrôles purs de placement et de texte. Aucun réseau, aucune base. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PREFIXE_REPUBLICATION,
  REPUBLICATIONS_MAX_PAR_CONTENU,
  idNouvelleVersion,
  rangSuivant,
  verifierPlacement,
  verifierTexte,
  type ExistantPlacement,
  type EntreePlacement,
} from "@/domaine/republication/nouvelle-version";

const JOUR_MS = 24 * 3600 * 1000;
const MAINTENANT = Date.parse("2026-12-01T08:00:00Z");
const ORIGINE = MAINTENANT - 100 * JOUR_MS;

function entree(sur: Partial<EntreePlacement> = {}): EntreePlacement {
  return {
    reseau: "instagram",
    jour: "2026-12-10",
    heure: "10:00",
    maintenant: MAINTENANT,
    publicationId: "pub-1",
    mediaOrigine: "media-a",
    mediaNouveau: "media-a",
    datePublicationOrigine: ORIGINE,
    rang: 1,
    existants: [],
    ...sur,
  };
}
const existant = (sur: Partial<ExistantPlacement>): ExistantPlacement => ({ id: "x1", reseau: "instagram", jour: "2026-12-10", heure: "10:00", statut: "propose", ...sur });
const refus = (sur: Partial<EntreePlacement>) => {
  const r = verifierPlacement(entree(sur));
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.motifs;
};

describe("constantes et identifiants", () => {
  it("propose le maximum de 2 republications, en hypothese", () => {
    expect(REPUBLICATIONS_MAX_PAR_CONTENU).toEqual({ statut: "hypothese", valeur: 2 });
    expect(PREFIXE_REPUBLICATION).toBe("republication-");
  });
  it("construit l'identifiant et le rang suivant (archivés compris)", () => {
    expect(idNouvelleVersion("pub-1", 2)).toBe("republication-pub-1-2");
    expect(rangSuivant("pub-1", [])).toBe(1);
    expect(rangSuivant("pub-1", ["republication-pub-1-1", "autre", "republication-pub-2-1", "republication-pub-1-2"])).toBe(3);
  });
});

describe("placement : refus", () => {
  it("refuse un jour passé", () => {
    expect(refus({ jour: "2026-11-30" }).join(" ")).toMatch(/jour est déjà passé/);
  });
  it("refuse une heure passée le jour même", () => {
    expect(refus({ jour: "2026-12-01", heure: "09:00" }).join(" ")).toMatch(/passée/);
  });
  it("refuse un jour occupé par un créneau proposé", () => {
    expect(refus({ existants: [existant({ heure: "18:00" })] }).join(" ")).toMatch(/occupé/);
  });
  it("accepte si l'unique créneau du jour est archivé ou en échec", () => {
    expect(verifierPlacement(entree({ existants: [existant({ statut: "archive" })] })).ok).toBe(true);
    expect(verifierPlacement(entree({ existants: [existant({ id: "x2", statut: "echec" })] })).ok).toBe(true);
  });
  it("ignore une publication simulée", () => {
    expect(verifierPlacement(entree({ existants: [existant({ statut: "publiee", simulee: true })] })).ok).toBe(true);
    expect(refus({ existants: [existant({ statut: "publiee", simulee: false })] }).join(" ")).toMatch(/occupé/);
  });
  it("ignore un autre réseau", () => {
    expect(verifierPlacement(entree({ existants: [existant({ reseau: "facebook" })] })).ok).toBe(true);
  });
  it("ignore un créneau archivé pour l'écart de 3 h", () => {
    expect(verifierPlacement(entree({ existants: [existant({ heure: "11:00", statut: "archive" })] })).ok).toBe(true);
  });
  it("refuse un écart sous 3 h avec un créneau voisin d'un autre jour de Paris (minuit)", () => {
    const m = refus({ jour: "2026-12-10", heure: "00:30", existants: [existant({ id: "veille", jour: "2026-12-09", heure: "23:00" })] });
    expect(m.join(" ")).toMatch(/écart/);
  });
  it("refuse LinkedIn un samedi (avertissement devenu refus)", () => {
    expect(refus({ reseau: "linkedin", jour: "2026-12-12", datePublicationOrigine: ORIGINE }).join(" ")).toMatch(/week-end/);
  });
  it("refuse une deuxième republication du même contenu à 2 jours", () => {
    const m = refus({ rang: 2, jour: "2026-12-10", existants: [existant({ id: "republication-pub-1-1", jour: "2026-12-08", heure: "10:00", statut: "a_valider" })] });
    expect(m.join(" ")).toMatch(/répét|même contenu/);
  });
  it("n'applique pas la répétition aux autres contenus", () => {
    expect(verifierPlacement(entree({ existants: [existant({ id: "autre", jour: "2026-12-08", statut: "valide" })] })).ok).toBe(true);
  });
  it("refuse un délai trop court (Instagram à 10 jours)", () => {
    expect(refus({ datePublicationOrigine: MAINTENANT - 10 * JOUR_MS }).join(" ")).toMatch(/délai/);
  });
  it("refuse TikTok avec le même média", () => {
    expect(refus({ reseau: "tiktok", mediaNouveau: "media-a" }).join(" ")).toMatch(/média/);
    expect(verifierPlacement(entree({ reseau: "tiktok", mediaNouveau: "media-b" })).ok).toBe(true);
  });
  it("refuse le rang 3 quand le maximum est 2", () => {
    expect(refus({ rang: 3 }).join(" ")).toMatch(/maximum/);
    expect(verifierPlacement(entree({ rang: 2 })).ok).toBe(true);
  });
  it("refuse sans planter une entrée existante au jour ou à l'heure illisible", () => {
    for (const heure of ["", "9h"]) {
      const m = refus({ existants: [existant({ id: "bancal", jour: "2026-12-12", heure })] });
      expect(m.join(" ")).toMatch(/illisible/);
    }
  });
  it("ne donne qu'une phrase pour un jour occupé", () => {
    const m = refus({ existants: [existant({ heure: "18:00" })] });
    expect(m.filter((x) => /occupé/.test(x)).length).toBe(1);
    expect(m.length).toBe(1);
  });
  it("refuse un réseau inconnu, un jour ou une heure mal écrits", () => {
    expect(refus({ reseau: "myspace" as never }).length).toBeGreaterThan(0);
    expect(refus({ jour: "10/12/2026" }).length).toBeGreaterThan(0);
    expect(refus({ heure: "25:99" }).length).toBeGreaterThan(0);
  });
  it("rend des motifs en français, au vouvoiement, sans chiffre brut de score", () => {
    const m = refus({ rang: 3, reseau: "tiktok", jour: "2026-11-30", datePublicationOrigine: MAINTENANT - 2 * JOUR_MS });
    expect(m.length).toBeGreaterThan(2);
    for (const x of m) {
      expect(x).toMatch(/^[A-ZÉÀ«]/);
      expect(x).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
      expect(x.endsWith(".")).toBe(true);
    }
  });
});

describe("placement : accepté", () => {
  it("accepte le cas nominal", () => {
    expect(verifierPlacement(entree())).toEqual({ ok: true });
  });
  it("accepte à l'heure d'été (2026-03-29 10:00) et d'hiver (2026-10-25 10:00)", () => {
    const origine = Date.parse("2025-01-01T00:00:00Z");
    expect(verifierPlacement(entree({ jour: "2026-03-29", heure: "10:00", maintenant: Date.parse("2026-03-20T08:00:00Z"), datePublicationOrigine: origine }))).toEqual({ ok: true });
    expect(verifierPlacement(entree({ jour: "2026-10-25", heure: "10:00", maintenant: Date.parse("2026-10-20T08:00:00Z"), datePublicationOrigine: origine }))).toEqual({ ok: true });
  });
  it("juge l'heure passée à l'heure de Paris, pas en UTC", () => {
    // 2026-07-01 08:30 UTC = 10:30 à Paris.
    const maintenant = Date.parse("2026-07-01T08:30:00Z");
    const origine = Date.parse("2025-01-01T00:00:00Z");
    expect(refus({ jour: "2026-07-01", heure: "10:00", maintenant, datePublicationOrigine: origine }).join(" ")).toMatch(/passée/);
    expect(verifierPlacement(entree({ jour: "2026-07-01", heure: "11:00", maintenant, datePublicationOrigine: origine })).ok).toBe(true);
  });
});

describe("texte", () => {
  const origine = "Découvrez comment organiser votre semaine de contenus simplement et sans stress cette année.";
  const verif = (texte: string) => verifierTexte({ reseau: "instagram", texte, texteOrigine: origine });

  it("refuse un texte vide", () => {
    for (const t of ["", "   \n "]) {
      const r = verif(t);
      expect(r.ok).toBe(false);
      expect(r.motifs.join(" ")).toMatch(/vide/);
    }
  });
  it("refuse un texte identique à l'original", () => {
    const r = verif(origine);
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/identique/);
  });
  it("refuse 6 mots d'affilée repris", () => {
    const r = verif("Notre guide : organiser votre semaine de contenus simplement, pour tenir dans la durée avec un rythme serein.");
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/reprend/);
  });
  it("refuse le tutoiement", () => {
    const r = verif("Tu peux préparer ta prochaine publication en quelques minutes avec un plan clair.");
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/vouvoiement/);
  });
  it("refuse un mot interdit par la charte", () => {
    const r = verif("Avec ce plan, c'est aucun gain garanti mais un rythme régulier pour vos réseaux.");
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/charte/);
    expect(r.motifs.join(" ")).toMatch(/interdit/i);
    expect(r.motifs.join(" ")).not.toMatch(/reprend|proche|identique/);
  });
  it("accepte un texte neuf au vouvoiement", () => {
    expect(verif("Voici un nouveau regard sur la régularité : trois idées simples pour garder le cap sur vos réseaux.")).toEqual({ ok: true, motifs: [] });
  });
  it("tolère une citation entre guillemets", () => {
    const r = verif("Comme nous le disions : « organiser votre semaine de contenus simplement et sans stress ». Voici une autre piste pour vos réseaux.");
    expect(r.ok).toBe(true);
  });
  it("refuse un réseau inconnu", () => {
    expect(verifierTexte({ reseau: "myspace" as never, texte: "Un texte neuf pour vous.", texteOrigine: origine }).ok).toBe(false);
  });
});

describe("statique", () => {
  const source = readFileSync("src/domaine/republication/nouvelle-version.ts", "utf8");
  it("n'importe ni service, ni fournisseur, ni server-only", () => {
    expect(source).not.toMatch(/@\/services/);
    expect(source).not.toMatch(/@\/fournisseurs/);
    expect(source).not.toMatch(/server-only/);
  });
  it("ne contient ni lecture de réglage ni appel requête", () => {
    expect(source).not.toContain("lire" + "Parametre");
    expect(source).not.toContain("." + "requete");
  });
  it("n'utilise aucune horloge système", () => {
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)/);
  });
});
