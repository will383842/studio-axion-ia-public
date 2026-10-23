/**
 * L3 : le fichier d'emprunts du format « image → vidéo » est épinglé. Chaque symbole emprunté au cas concret, et chaque
 * ligne de banque lue, est vérifié ici : si l'un change, ce test rougit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as emprunts from "@/moteurs/montage-image-video/emprunts";
import { REGLES_FIN_DE_VOIX_IV } from "@/moteurs/montage-image-video/assemblage";
import type { Offre } from "@/moteurs/montage-image-video/emprunts";
import { OFFRES } from "@/formats/cas-concret/cas";
import { APPEL_A_COMMENTER_LINKEDIN, estAppelACommenter } from "@/briques/fins";

const { appelDeLaBanque, controlerFinDeVoix, finPour, texteAvecNombres, DECLENCHEUR_DE, MOTS_INTERDITS_FORMAT } = emprunts;

describe("symboles empruntés présents", () => {
  const fonctions = [
    "avancerVoixCasConcret", "etatInitialVoixCasConcret", "repriseVoixCasConcret", "controlerPrise",
    "lireWav", "silencesMesures", "controlerFinDeVoix", "recalerCoupesSurSilences",
    "motValide", "textesDePublication", "premierCommentaireDiagnostic", "texteAvecNombres",
    "poserBruitages", "finPour", "appelDeLaBanque", "phrasesDeLaBanque", "blocsSocleWill",
    "empreintePriseVoix", "planRaccordVoix", "parametresRaccord",
  ] as const;
  it.each(fonctions)("%s est une fonction", (nom) => {
    expect(typeof emprunts[nom]).toBe("function");
  });

  it("constantes épinglées", () => {
    expect(emprunts.LECTURES_CORPS_MAX).toBe(3);
    expect(emprunts.LECTURES_FIN_MAX).toBe(2);
    expect(emprunts.REGLES_FIN_DE_VOIX.toleranceFinMotSec).toBe(0.2);
    expect(emprunts.REGLES_BLANCS_CAS_CONCRET.seuilMs).toBe(220);
    expect([...emprunts.SORTES_BRUITAGE]).toEqual(["souffle", "pop", "papier", "vibration", "tic", "cloture"]);
    expect([...emprunts.FINS_MOT_AVEC_ENVOI]).toEqual(["fin-ig-mot-abonnement"]);
    expect(typeof emprunts.EXEMPLE_TON_V4).toBe("string");
    expect(emprunts.EXEMPLE_TON_V4.length).toBeGreaterThan(0);
    expect(emprunts.UNITES_NOMBRE).toContain("heures");
    expect(emprunts.RESEAUX_SANS_APPEL_A_COMMENTER).toEqual(["linkedin"]);
  });

  it("recette de la voix v4 (L12) : starfish, 1,1, atempo 1,08, −14 LUFS, raccord à 0,20 s", () => {
    const r = emprunts.RECETTE_VOIX_CAS_CONCRET;
    expect(r.synthese).toEqual({ fournisseur: "heygen", moteur: "starfish", vitesse: 1.1, locale: "fr-FR" });
    expect(r.filtres.atempo).toBe(1.08);
    expect(r.filtres.volume).toContain("I=-14");
    expect(r.resserrage.blancPhraseSec).toBe(0.2);
    expect(r.fin.silenceSec).toBe(0.8);
  });

  it("planDesFins et nombresDe ne sont PAS empruntés", () => {
    expect(Object.keys(emprunts)).not.toContain("planDesFins");
    expect(Object.keys(emprunts)).not.toContain("nombresDe");
  });
});

describe("texteAvecNombres", () => {
  it("passe les nombres écrits en lettres en chiffres", () => {
    expect(texteAvecNombres("vingt et un jours")).toContain("21 jours");
    expect(texteAvecNombres("quatre secondes")).toContain("4 secondes");
    expect(texteAvecNombres("une heure")).toContain("1 heure");
    expect(texteAvecNombres("cent pour cent")).toContain("100 %");
  });
  it("est déterministe", () => {
    expect(texteAvecNombres("trois minutes par commande")).toBe(texteAvecNombres("trois minutes par commande"));
  });
});

describe("controlerFinDeVoix sur un WAV synthétique", () => {
  const F = 16000;
  /** WAV PCM 16 bits mono : sinus 200 Hz de `de` à `a` s (avec fondu de sortie `fondu` s), silence ailleurs. */
  function wav(dureeSec: number, a: number, fondu: number): Uint8Array {
    const n = Math.round(dureeSec * F);
    const b = new Uint8Array(44 + n * 2);
    const v = new DataView(b.buffer);
    const txt = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
    txt(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); txt(8, "WAVE"); txt(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, F, true); v.setUint32(28, F * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    txt(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const t = i / F;
      const g = t >= 0.5 && t < a ? (fondu > 0 ? Math.min(1, (a - t) / fondu) : 1) : 0;
      v.setInt16(44 + i * 2, Math.round(0.3 * g * Math.sin(2 * Math.PI * 200 * t) * 32767), true);
    }
    return b;
  }

  it("lireWav lit la fréquence et la durée", () => {
    const son = emprunts.lireWav(wav(2, 1.5, 0.15));
    expect(son.frequence).toBe(F);
    expect(son.echantillons.length).toBe(2 * F);
  });
  it("une fin éteinte en douceur, à l'heure du dernier mot, passe", () => {
    const r = controlerFinDeVoix(emprunts.lireWav(wav(3, 1.6, 0.15)), 1.6);
    expect(r.ok).toBe(true);
  });
  it("une voix coupée net avant la fin du dernier mot est refusée", () => {
    const r = controlerFinDeVoix(emprunts.lireWav(wav(3, 1.0, 0)), 1.6);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.raison).toMatch(/pas dite jusqu'au bout/);
      expect(r.coupeNetteSec).toBeDefined();
    }
  });
  it("un son qui finit trop tôt, même doucement, est refusé", () => {
    const r = controlerFinDeVoix(emprunts.lireWav(wav(3, 1.6, 0.15)), 2.4);
    expect(r.ok).toBe(false);
  });
});

describe("petit son isolé dans une pause (v-dcc902c3f3dd, 37,59 s)", () => {
  const F = 16000;
  /** Sinus 200 Hz par morceaux (`fondu` : fin en douceur, s), silence numérique ailleurs. */
  function syllabes(dureeSec: number, morceaux: { de: number; a: number; fondu?: number }[]): Float32Array {
    const x = new Float32Array(Math.round(dureeSec * F));
    for (let i = 0; i < x.length; i++) {
      const t = i / F;
      const m = morceaux.find((s) => t >= s.de && t < s.a);
      const g = m ? (m.fondu ? Math.min(1, (m.a - t) / m.fondu) : 1) : 0;
      x[i] = 0.3 * g * Math.sin(2 * Math.PI * 200 * t);
    }
    return x;
  }
  const avecSon = (finSonSec: number) => ({
    echantillons: syllabes(3.5, [{ de: 0.5, a: 1.5, fondu: 0.15 }, { de: 1.7, a: finSonSec }, { de: 1.9, a: 3.2, fondu: 0.15 }]),
    frequence: F,
  });
  const lire = (dossier: string, nom: string) => emprunts.lireWav(readFileSync(join(__dirname, dossier, nom)));

  it("un son de 40 ms entre deux pauses passe avec les règles de l'image → vidéo, pas avec celles par défaut", () => {
    // Pause de 200 ms avant le son (1,5 à 1,7 s), 160 ms après (1,74 à 1,9 s) ; la 2e syllabe finit en douceur.
    const son = { echantillons: syllabes(3.5, [{ de: 0.5, a: 1.5, fondu: 0.15 }, { de: 1.7, a: 1.74 }, { de: 1.9, a: 3.2, fondu: 0.15 }]), frequence: F };
    expect(controlerFinDeVoix(son, 3.2, REGLES_FIN_DE_VOIX_IV).ok).toBe(true);
    const defaut = controlerFinDeVoix(son, 3.2);
    expect(defaut.ok).toBe(false);
    if (!defaut.ok) expect(defaut.coupeNetteSec).toBeCloseTo(1.74, 1);
  });
  it("un son de 40 ms précédé de 60 ms de pause seulement (< 100 ms) reste refusé : la condition « blanc avant » compte", () => {
    const son = { echantillons: syllabes(3.5, [{ de: 0.5, a: 1.64, fondu: 0.15 }, { de: 1.7, a: 1.74 }, { de: 1.9, a: 3.2, fondu: 0.15 }]), frequence: F };
    expect(controlerFinDeVoix(son, 3.2, REGLES_FIN_DE_VOIX_IV).ok).toBe(false);
  });
  it("un son de 80 ms (un vrai bout de mot) reste refusé, même avec les règles de l'image → vidéo", () => {
    const r = controlerFinDeVoix(avecSon(1.78), 3.2, REGLES_FIN_DE_VOIX_IV);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/coupée net/);
  });
  it("le cas concret ne change pas : valeur par défaut 0, seuils inchangés", () => {
    expect(emprunts.REGLES_FIN_DE_VOIX.transitoireMaxSec).toBe(0);
    expect(REGLES_FIN_DE_VOIX_IV).toMatchObject({ transitoireMaxSec: 0.05, fortDb: -30, silenceDb: -60, tenueSec: 0.1 });
  });
  it("la v4 coupée en plein mot reste refusée avec les règles de l'image → vidéo", () => {
    const r = controlerFinDeVoix(lire("../cas-concret/fidelite-v4/sons", "v4-fin-coupee.wav"), 39.81 - 37.5, REGLES_FIN_DE_VOIX_IV);
    expect(r.ok).toBe(false);
  });
  it("extrait réel de la prod : refusé à ~0,59 s par défaut, accepté avec les règles de l'image → vidéo", () => {
    const son = lire("sons", "clic-pause-v-dcc902c3f3dd.wav");
    const defaut = controlerFinDeVoix(son, 1.0);
    expect(defaut.ok).toBe(false);
    if (!defaut.ok) expect(defaut.coupeNetteSec).toBeCloseTo(0.59, 1);
    expect(controlerFinDeVoix(son, 1.0, REGLES_FIN_DE_VOIX_IV).ok).toBe(true);
  });
});

describe("fins lues dans la banque", () => {
  it("finPour(\"linkedin\") dans la table du diagnostic ne rend aucun appel à commenter", () => {
    const fin = finPour("linkedin", "fin-li-lien-commentaire", {}, emprunts.TABLE_FINS_DIAGNOSTIC);
    expect(fin).toMatchObject({ groupe: "linkedin", type: "lien", dit: "Le lien est en premier commentaire." });
    expect(estAppelACommenter(fin)).toBe(false);
  });
  it("finPour(\"linkedin\") sans table du diagnostic n'a aucune fin validée (table provisoire)", () => {
    expect(() => finPour("linkedin")).toThrow(/Aucune fin validée par Will pour linkedin/);
  });
  it("une fin à commenter sur LinkedIn est refusée par la banque", () => {
    expect(() => finPour("linkedin", "fin-ig-mot-abonnement", { mot: "AUDIT" }, emprunts.TABLE_FINS_DIAGNOSTIC)).toThrow();
  });
  it("le garde-fou LinkedIn reste actif : une fin à commenter est refusée", () => {
    expect(emprunts.RESEAUX_SANS_APPEL_A_COMMENTER).toContain("linkedin");
    expect(APPEL_A_COMMENTER_LINKEDIN).toMatch(/LinkedIn/);
  });

  const attendu = (code: string) => appelDeLaBanque(code)!;
  it("fin-if-question", () => {
    expect(attendu("fin-if-question")).toMatchObject({
      reseaux: ["instagram", "facebook"], type: "question", etat: "valide",
      dit: "Et chez vous, quelle tâche revient tous les jours ?",
    });
  });
  it("fin-ty-question-tache (TikTok et Shorts)", () => {
    expect(attendu("fin-ty-question-tache")).toMatchObject({
      reseaux: ["tiktok", "youtube-shorts"], type: "question", etat: "valide",
      dit: "Et chez vous, quelle tâche revient tous les jours ?",
    });
  });
  it("fin-ty-lien-profil couvre TikTok ET Shorts", () => {
    expect(attendu("fin-ty-lien-profil")).toMatchObject({
      reseaux: ["tiktok", "youtube-shorts"], type: "lien", etat: "valide",
      dit: "Le lien est dans mon profil.", emplacement: "profil",
    });
  });
  it("toutes les lignes fin-li-* disent \"\" (rien de dit sur LinkedIn)", () => {
    const li = emprunts.BANQUE_APPELS.filter((a) => a.code.startsWith("fin-li-"));
    expect(li.length).toBeGreaterThan(5);
    for (const a of li) {
      expect(a.reseaux, a.code).toEqual(["linkedin"]);
      expect(a.dit, a.code).toBe("");
      expect(a.ecran, a.code).toBe("");
    }
  });
  it("fin-li-question existe, validée, sans phrase dite (patron du texte LinkedIn)", () => {
    expect(attendu("fin-li-question")).toMatchObject({ dit: "", etat: "valide", type: "question" });
  });
  it("TABLE_FINS_DIAGNOSTIC contient une fin Instagram à mot avec envoi", () => {
    expect(emprunts.TABLE_FINS_DIAGNOSTIC.some((f) => f.id === "fin-ig-mot-abonnement")).toBe(true);
  });
});

describe("règles et déclencheurs", () => {
  it("MOTS_INTERDITS_FORMAT", () => {
    expect([...MOTS_INTERDITS_FORMAT]).toEqual(["machine", "machines", "Villeexemple", "aucun gain garanti"]);
  });
  it("DECLENCHEUR_DE : sorte → déclencheur existant", () => {
    expect(DECLENCHEUR_DE).toEqual({
      souffle: "illustration-forte", pop: "impact", papier: "document",
      vibration: "telephone", tic: "chiffre", cloture: "impact",
    });
  });
  it("le type Offre", () => {
    expect([...OFFRES]).toEqual(["formation", "audit", "integration", "coaching"]);
    expectTypeOf<Offre>().toEqualTypeOf<"formation" | "audit" | "integration" | "coaching">();
  });
});

describe("aucun cycle d'import", () => {
  it("emprunts.ts n'importe rien du format image-video ni de son propre dossier", () => {
    const src = readFileSync(join(process.cwd(), "src/moteurs/montage-image-video/emprunts.ts"), "utf8");
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) {
      expect(i, i).not.toMatch(/image-video/);
      expect(i, i).toMatch(/montage-cas-concret|briques\/fins|formats\/cas-concret/);
    }
  });
});
