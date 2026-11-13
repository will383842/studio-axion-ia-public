/**
 * GV2-28 : le texte ENVOYÉ à la voix finit toujours par une ponctuation de fin ; le texte qui entre dans les empreintes
 * (`cleVoix`, `cleLecture`), `texteDit`, les sous-titres et le prix ne changent PAS (une vidéo déjà faite ne relit rien).
 */
import { describe, expect, it } from "vitest";
import { avecPonctuationFinale } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { empreinte, fabriquerTableau, texteVoixTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { RECETTE_VOIX_TABLEAU, reglagesRecette } from "../../../src/moteurs/montage-tableau/recette-voix";
import { copie, ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

describe("avecPonctuationFinale (pur)", () => {
  it("ajoute un point quand la fin n'est pas une ponctuation de fin", () => {
    expect(avecPonctuationFinale("Le geste avant l'erreur")).toBe("Le geste avant l'erreur.");
    expect(avecPonctuationFinale("Le geste avant l'erreur  ")).toBe("Le geste avant l'erreur.");
  });
  it("laisse intacts les textes finissant par . ? ! …, même avant un guillemet fermant", () => {
    for (const t of ["Fini.", "Fini ?", "Fini !", "Fini…", "Il dit « stop. »", "Il dit « stop ? »", "Fini.  "]) expect(avecPonctuationFinale(t)).toBe(t);
  });
  it("une fin en , : ; — devient un point", () => {
    expect(avecPonctuationFinale("Voici,")).toBe("Voici.");
    expect(avecPonctuationFinale("Voici :")).toBe("Voici.");
    expect(avecPonctuationFinale("Voici;")).toBe("Voici.");
    expect(avecPonctuationFinale("Voici —")).toBe("Voici.");
  });
});

/** Fiche dont la dernière scène finit (ou non) par un point. */
function ficheFinissantPar(fin: string) {
  const f = copie(ficheDemonstration);
  const derniere = f.scenes.at(-1)!;
  derniere.texteDit = derniere.texteDit.replace(/[.?!…]+\s*$/u, "") + fin;
  return f;
}

async function fabriquer(fin: string) {
  const fiche = ficheFinissantPar(fin);
  const d = doubles(fiche);
  const textes: string[] = [];
  const voix = { ...d.outils.voix.voix(), lire: async (x: { texte: string }) => (textes.push(x.texte), d.outils.voix.voix().lire(x as never)) };
  const rapport = await fabriquerTableau({ ...d.outils, voix: { ...d.outils.voix, voix: () => voix as never } });
  return { fiche, d, textes, rapport };
}

describe("fabrication : le point final n'est ajouté qu'au texte envoyé", () => {
  const reglagesLecture = { stabilite: 45, emotion: 30, vitesse: RECETTE_VOIX_TABLEAU.synthese.vitesse };
  const cle = (texte: string) => empreinte("voix", texte, "voix-williams", reglagesLecture, "simulation", reglagesRecette());

  it("sans point final : le texte envoyé finit par « . », texteDit et sous-titres inchangés, cleVoix = celle du texte brut", async () => {
    const { fiche, d, textes } = await fabriquer("");
    const brut = texteVoixTableau(fiche);
    expect(brut.endsWith(".")).toBe(false);
    expect(textes).toHaveLength(1);
    expect(textes[0]).toBe(`${brut}.`);
    expect(d.journal.valeur!.etapes.voix!.empreinte).toBe(cle(brut));
    const calage = d.journal.valeur!.etapes.calage!.sortie as { fiche: { scenes: { texteDit: string }[] } };
    expect(calage.fiche.scenes.map((s) => s.texteDit)).toEqual(fiche.scenes.map((s) => s.texteDit));
  });

  it("avec point final : texte envoyé et cleVoix identiques à ceux d'avant", async () => {
    const { fiche, d, textes } = await fabriquer(".");
    const brut = texteVoixTableau(fiche);
    expect(textes).toEqual([brut]);
    expect(d.journal.valeur!.etapes.voix!.empreinte).toBe(cle(brut));
  });

  it("« ? » et « ! » restent inchangés", async () => {
    for (const fin of ["?", "!"]) {
      const { fiche, textes } = await fabriquer(fin);
      expect(textes).toEqual([texteVoixTableau(fiche)]);
    }
  });

  it("le prix annoncé compte le texte de la fiche, pas le point ajouté", async () => {
    const a = await fabriquer("");
    expect(a.rapport.estimation.caracteres).toBe(texteVoixTableau(a.fiche).length);
  });
});
