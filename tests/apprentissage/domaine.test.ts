/**
 * APPRENTISSAGE (L1, L2, mémoire de la voix, lien de réservation) : fonctions pures, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { correctionsDeLignes, formeDe, gagnantsDuFormat, jourDe, POIDS_APPRENTISSAGE_MAX, poidsDepuisGroupes, rendreGagnantsMesures, tournuresDesCorrections, type ProfilGagnant } from "@/domaine/apprentissage";
import { lienDeVersion } from "@/domaine/mesures";
import type { Groupe, RangVideo, VideoMesuree } from "@/domaine/mesures-rangs";
import { blocsEnCache, rendreGagnants, type DonneesSocle } from "@/generateur/contexte";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import { EXTRAITS_AVOCATREF, rendreExtraits } from "@/donnees/generateur/modeles-avocatref";

const rang = (code: string, position: number, extra: Partial<VideoMesuree> = {}): RangVideo => ({
  video: { reseau: "tiktok", formatId: "avocat", publicationId: `p-${code}`, varianteId: `v-${code}`, code, titre: "t", date: "2026-10-01", resultats: { vues: 100 }, structure: "S2", ouverture: "question", ...extra },
  rang: Math.round((1 - position) * 10) + 1,
  sur: 10,
  position,
  parIndicateur: {},
});

describe("L1 · gagnants d'un format", () => {
  it("moins de 3 vidéos mesurées dans le format : aucun gagnant (repli sur les extraits de Will)", () => {
    expect(gagnantsDuFormat([rang("a", 0.9), rang("b", 0.8)], "avocat")).toEqual([]);
    // 2 du format + beaucoup d'un autre format : toujours le repli.
    const autres = ["c", "d", "e", "f"].map((c) => rang(c, 0.7, { formatId: "cas-concret" }));
    expect(gagnantsDuFormat([rang("a", 0.9), rang("b", 0.8), ...autres], "avocat")).toEqual([]);
  });

  it("3 vidéos suffisent ; au plus 5, les mieux placées d'abord ; les exemples de démonstration ne comptent pas", () => {
    expect(gagnantsDuFormat([rang("a", 0.9), rang("b", 0.8), rang("c", 0.1)], "avocat").map((r) => r.video.code)).toEqual(["a", "b", "c"]);
    const sept = ["a", "b", "c", "d", "e", "f", "g"].map((c, i) => rang(c, 1 - i * 0.1));
    expect(gagnantsDuFormat(sept, "avocat").map((r) => r.video.code)).toEqual(["a", "b", "c", "d", "e"]);
    const avecExemples = [rang("a", 0.9), rang("b", 0.8), rang("x", 0.99, { exemple: true })];
    expect(gagnantsDuFormat(avecExemples, "avocat")).toEqual([]);
  });

  it("le bloc rendu décrit la FORME et ne contient aucun texte de la vidéo", () => {
    const forme = formeDe({ ouverture: ["Vous perdez trois heures par semaine ?", "Voici pourquoi."], corps: ["Le secret du dossier tient en une phrase très secrète."], fin: ["Réservez votre appel."] });
    expect(forme.formeAccroche).toBe("question");
    expect(forme.motsAccroche).toBe(6);
    expect(forme.livraisonPct).toBeGreaterThan(0);
    const profil: ProfilGagnant = { code: "0001-AV-TT", rang: 1, sur: 10, structure: "S2", ouverture: "question", ...forme };
    const texte = rendreGagnantsMesures([profil]);
    expect(texte).toContain("FORME");
    expect(texte).toContain("n° 1 sur 10");
    expect(texte).not.toMatch(/trois heures|secret|dossier|Réservez/);
    expect(rendreGagnantsMesures([])).toBe("");
  });
});

describe("L1 · cache canonique stable", () => {
  const socle = (gagnantsMesures?: string): DonneesSocle => ({ maintenant: "2026-10-17T08:00:00.000Z", matieres: [], preuves: [], ...(gagnantsMesures ? { gagnantsMesures } : {}) });
  const format = { modelesDeTon: ["will"] as const };
  const mesures = rendreGagnantsMesures([{ code: "a", rang: 1, sur: 10, structure: "S2", ouverture: "question", motsAccroche: 6, formeAccroche: "question", motsParPhrase: 9, livraisonPct: 20 }]);

  it("éteint (ou moins de 3 vidéos) : le bloc est exactement l'ancien (extraits de Will), octet pour octet", () => {
    const attendu = ["Le ton de Will, sa meilleure vidéo (la v4, texte dit réel, citations courtes) : un modèle de TON et de rythme, jamais un contenu à reprendre.", rendreExtraits(EXTRAITS_WILL)].join("\n");
    expect(rendreGagnants(["will"])).toBe(attendu);
    expect(blocsEnCache(socle(), format).gagnants).toBe(attendu);
    expect(blocsEnCache(socle(""), format).gagnants).toBe(attendu);
  });

  it("le même bloc mesuré donne les mêmes octets d'un appel à l'autre, et ne dépend pas de l'heure", () => {
    const a = blocsEnCache(socle(mesures), format);
    const b = blocsEnCache({ ...socle(mesures), maintenant: "2026-10-17T23:59:00.000Z" }, format);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.gagnants).toContain("FORME");
    expect(a.gagnants).not.toContain(rendreExtraits(EXTRAITS_WILL));
  });

  it("le reste du socle (charte, style, preuves) ne change pas quand les gagnants changent", () => {
    const a = blocsEnCache(socle(), format);
    const b = blocsEnCache(socle(mesures), format);
    expect({ ...a, gagnants: "" }).toEqual({ ...b, gagnants: "" });
  });

  it("le style imité (avocatref) reste après le bloc mesuré", () => {
    const g = rendreGagnants(["will", "avocatref"], mesures);
    expect(g.startsWith(mesures)).toBe(true);
    expect(g).toContain(rendreExtraits(EXTRAITS_AVOCATREF));
  });

  it("le jour sert de clé : même jour, même clé", () => {
    expect(jourDe("2026-10-17T00:00:01.000Z")).toBe(jourDe("2026-10-17T23:59:59.000Z"));
    expect(jourDe("2026-10-18T00:00:00.000Z")).not.toBe(jourDe("2026-10-17T23:59:59.000Z"));
  });
});

describe("L2 · poids", () => {
  const g = (valeur: string, positionMediane: number | undefined, tropTot = false): Groupe => ({ axe: "structure", valeur, nombre: tropTot ? 2 : 6, positionMediane, tropTot });
  it("×1,5 au plus, jamais sous 1, groupe trop petit ignoré", () => {
    const p = poidsDepuisGroupes([g("S1", 1), g("S2", 0.75), g("S3", 0.5), g("S4", 0.2), g("S5", undefined, true)]);
    expect(p).toEqual({ S1: POIDS_APPRENTISSAGE_MAX, S2: 1.25 });
    expect(Math.max(...Object.values(p))).toBeLessThanOrEqual(1.5);
  });
});

describe("Mémoire de la voix de Will", () => {
  it("garde les seules phrases changées (avant → après), jamais une phrase vidée", () => {
    const avant = [{ id: "a", dit: "Il est important de noter que ça marche." }, { id: "b", dit: "Inchangée." }, { id: "c", dit: "Autre." }];
    const apres = [{ id: "a", dit: "Ça marche." }, { id: "b", dit: "Inchangée. " }, { id: "c", dit: "  " }];
    expect(correctionsDeLignes(avant, apres)).toEqual([{ phraseAvant: "Il est important de noter que ça marche.", phraseApres: "Ça marche." }]);
  });

  it("tournures à éviter et préférées : seulement ce qui revient (≥ 2 corrections)", () => {
    const c = [
      { phraseAvant: "Il est important de noter que le dossier avance.", phraseApres: "Le dossier avance, point." },
      { phraseAvant: "Il est important de noter que le client paie.", phraseApres: "Le client paie, point." },
      { phraseAvant: "Une phrase unique en son genre.", phraseApres: "Une phrase rare." },
    ];
    const t = tournuresDesCorrections(c);
    expect(t.aEviter).toContain("est important");
    expect(t.aEviter).not.toContain("unique");
    expect(t.preferees).toContain("point");
    expect(t.preferees).not.toContain("rare");
    expect(tournuresDesCorrections(c, 3)).toEqual({ aEviter: [], preferees: [] });
    expect(tournuresDesCorrections([])).toEqual({ aEviter: [], preferees: [] });
  });
});

describe("Mesure de l'origine des rendez-vous", () => {
  it("le lien de réservation de /fr/appel porte le code de la version en campagne, l'activité en contenu et depuis", () => {
    const u = new URL(lienDeVersion("https://axion-ia.com/fr/appel", { reseau: "tiktok", code: "0042-AV-TT" }, "public.apporteurs")!);
    expect(u.origin + u.pathname).toBe("https://axion-ia.com/fr/appel");
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: "tiktok", utm_medium: "video", utm_campaign: "0042-AV-TT", utm_content: "apporteurs", depuis: "video-tiktok" });
  });
});
