/**
 * LE TON DE LA V4 (bloc `<gagnants>`) : les modèles de Will (sa meilleure vidéo) passent TOUJOURS en premier ; les
 * extraits de l'avocat de référence ne suivent que pour le format qui imite ce style (l'avocat). Le choix vient des paramètres du
 * format (`modelesDeTon`), jamais d'un test sur l'identifiant dans le contexte.
 */
import { describe, expect, it } from "vitest";
import { CADRE_AXION } from "@/donnees/generateur/domaine-axion";
import { appliquerInterdits, appliquerTournures } from "@/domaine/voix";
import { contientExpression } from "@/domaine/controles-script/texte";
import { motsInterditsDans } from "@/domaine/scripts-tableau-controles";
import { EXTRAITS_AVOCATREF } from "@/donnees/generateur/modeles-avocatref";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import { TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";
import { MOTS_INTERDITS_FORMAT } from "@/moteurs/montage-cas-concret/regles";
import { MOTS_TEMPS_INTERDITS } from "@/moteurs/montage-tableau/regles";
import { INTERDITS_RELUS_G2 } from "@/services/contexte-axion";
import { INTERDITS, TOURNURES_PARCOURS, TOURNURES_STRUCTURE } from "@/services/migrations/etape-19-generateur";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { blocsEnCache, rendreGagnants } from "@/generateur/contexte";

const TEXTE_V4 =
  "Votre équipe répond aux demandes en dix minutes. Oui, dix minutes. Avant, c'était ça : ouvrir le dossier, relire, répondre, classer, relancer. Une demi-journée, à chaque dossier. Alors nous avons simplifié. Le dossier se classe tout seul. La relance part toute seule. Nous, on relit. C'est notre seul travail. Résultat : dix minutes retrouvées, à chaque demande. Et chez vous, quelle tâche pourrait se faire toute seule ? Écrivez PLAN en commentaire. On vous envoie le plan.";

const SOCLE_VIDE = { maintenant: "2026-10-14T08:00:00.000Z", matieres: [], preuves: [] };

describe("modèles de ton de Will (v4)", () => {
  it("des extraits COURTS, mot pour mot dans le texte d'exemple, codés W01…, chacun annoté", () => {
    expect(EXTRAITS_WILL.length).toBeGreaterThanOrEqual(8);
    EXTRAITS_WILL.forEach((x, i) => {
      expect(x.code).toBe(`W${String(i + 1).padStart(2, "0")}`);
      expect(TEXTE_V4, x.code).toContain(x.extrait);
      expect(x.extrait.split(/\s+/).length, x.code).toBeLessThanOrEqual(25);
      expect(x.montre.length, x.code).toBeGreaterThan(5);
    });
    const tout = EXTRAITS_WILL.map((x) => x.extrait).join(" ");
    for (const geste of ["Oui, dix minutes.", "Alors nous avons simplifié.", "toute seule", "dix minutes retrouvées", "quelle tâche pourrait se faire toute seule ?", "Écrivez PLAN en commentaire."]) expect(tout).toContain(geste);
  });

  it("les paramètres du format choisissent les modèles : v4 seule (face caméra, tableau), v4 + l'avocat de référence (avocat)", () => {
    expect(parametresGenerateur("facecam").modelesDeTon).toEqual(["will"]);
    expect(parametresGenerateur("tableau-anime").modelesDeTon).toEqual(["will"]);
    expect(parametresGenerateur("avocat").modelesDeTon).toEqual(["will", "avocatref"]);
  });

  it("v4 seule : W01 présent, aucun extrait de l'avocat de référence, présenté comme le ton de Will", () => {
    const g = blocsEnCache(SOCLE_VIDE, parametresGenerateur("facecam")).gagnants!;
    expect(g).toMatch(/<modele code="W01"/);
    expect(g).not.toMatch(/<modele code="D/);
    expect(g).toMatch(/le ton de Will, sa meilleure vidéo/i);
    expect(g).toMatch(/jamais un contenu à reprendre/);
    expect(rendreGagnants(["will"])).toBe(g);
  });

  it("avocat : la v4 d'abord, puis les extraits de l'avocat de référence", () => {
    const g = blocsEnCache(SOCLE_VIDE, parametresGenerateur("avocat")).gagnants!;
    expect(g).toMatch(/<modele code="W01"/);
    expect(g).toMatch(/<modele code="D01"/);
    expect(g.indexOf('code="W09"')).toBeLessThan(g.indexOf('code="D01"'));
  });
});

describe("décisions de Will (14/10) sur la charte générale", () => {
  const PHRASE_AVOCAT = /à la manière de l'avocat de référence/;

  it("réserver un appel est permis ; réserver ou acheter une formation en ligne ne l'est pas", () => {
    expect(CADRE_AXION).toMatch(/Interdit : réserver ou acheter une formation \(ou toute prestation\) directement en ligne/);
    expect(CADRE_AXION).toMatch(/Permis : réserver un appel ou un échange avec Will \(diagnostic gratuit\), et écrire/);
    expect(CADRE_AXION).toMatch(/aucun prix, aucun engagement chiffré non validé/);
    expect(CADRE_AXION).not.toMatch(/jamais vers une réservation directe/);
  });

  it("la phrase « type avocat » sort de la charte générale : seule la recette avocat la reçoit", () => {
    expect(CADRE_AXION).not.toMatch(PHRASE_AVOCAT);
    expect(CADRE_AXION).not.toMatch(/type avocat/);
    expect(parametresGenerateur("avocat").cadreFormat).toMatch(PHRASE_AVOCAT);
    for (const f of ["facecam", "tableau-anime"]) expect(parametresGenerateur(f).cadreFormat, f).toBeUndefined();
  });

  it("l'avocat la reçoit toujours dans sa recette (<recette_format>, après le socle commun) ; les autres formats non", () => {
    const blocs = blocsEnCache(SOCLE_VIDE, parametresGenerateur("avocat"));
    expect(blocs.contexteAxion!.startsWith(CADRE_AXION)).toBe(true);
    // Le socle reste identique pour tous les formats (cache partagé, 15/10).
    expect(blocs.contexteAxion).toBe(blocsEnCache(SOCLE_VIDE, parametresGenerateur("facecam")).contexteAxion);
    expect(blocs.recette).toMatch(PHRASE_AVOCAT);
    expect(blocs.recette).toMatch(/le contenu parle TOUJOURS d'Axion-IA/);
    for (const f of ["facecam", "tableau-anime"]) {
      const b = blocsEnCache(SOCLE_VIDE, parametresGenerateur(f));
      expect(b.contexteAxion, f).not.toMatch(PHRASE_AVOCAT);
      expect(b.recette, f).toBeUndefined();
    }
  });
});

/**
 * Les modèles de ton partent dans le socle des formats : un extrait qui porte un mot que la relecture du format refuse
 * pousse Claude vers ce mot (W09 et « machine », refusé par R10 du cas concret). Les extraits de Will vont à TOUS les
 * formats ; ceux de l'avocat de référence au seul avocat (règles communes : tournures, interdits de Will).
 */
describe("aucun modèle de ton ne porte un mot que la relecture refuse", () => {
  const tournures = [...TOURNURES_CALIBREES.map((t) => ({ ...t, portee: "partout" as const })), ...TOURNURES_PARCOURS, ...TOURNURES_STRUCTURE];
  const interditsWill = [...INTERDITS, ...INTERDITS_RELUS_G2];

  function fautesCommunes(texte: string): string[] {
    // Seuil 1 : une seule tournure « grappe » dans un extrait de quelques mots est déjà de trop.
    const t = appliquerTournures(texte, tournures, { seuilGrappe: 1 });
    return [...t.trouvees.map((x) => `tournure ${x.id}`), ...appliquerInterdits(texte, interditsWill).map((i) => `interdit ${i.id}`)];
  }

  it("Will (tous les formats) : ni mots interdits du cas concret (R10) ni du tableau, ni tournures, ni interdits de Will", () => {
    expect(MOTS_INTERDITS_FORMAT).toContain("machine");
    for (const x of EXTRAITS_WILL) {
      const fautes = [
        ...MOTS_INTERDITS_FORMAT.filter((m) => contientExpression(x.extrait, m)).map((m) => `cas concret « ${m} »`),
        ...MOTS_TEMPS_INTERDITS.filter((m) => contientExpression(x.extrait, m)).map((m) => `tableau « ${m} »`),
        ...motsInterditsDans(x.extrait).map((l) => `tableau ${l}`),
        ...fautesCommunes(x.extrait),
      ];
      expect(fautes, `${x.code} : ${x.extrait}`).toEqual([]);
    }
  });

  it("l'avocat de référence (avocat) : ni tournures ni interdits de Will", () => {
    for (const x of EXTRAITS_AVOCATREF) expect(fautesCommunes(x.extrait), `${x.code} : ${x.extrait}`).toEqual([]);
  });
});
