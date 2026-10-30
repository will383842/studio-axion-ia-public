/**
 * 30/10/2026 : « le titre d'un écran reste fixe alors que le bloc allumé change » (essai comptable v-534c568b453c : « Nom du client,
 * pièces attendues, ton adapté » posé en entier dès le début de l'écran). Le titre en liste (virgules ou « · ») suit le bloc dont le
 * libellé est dit : chaque étape montre les éléments déjà dits, jamais davantage, sans changer un mot du texte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { SONS_BANQUE, idElementBruitage } from "@/donnees/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";

const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8")) as CarteImage;
const base = FICHES_SIMULEES["essai-c"];
const VALIDES = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));

/** Écran « toile » dont les trois blocs n07, n08, n09 sont dits l'un après l'autre ; son titre les liste. */
const DIT = "Un email structuré arrive. Il part vers l'équipe concernée. Et une alerte Telegram prévient tout le monde.";
function ficheAvec(titre: string | string[], texteDit = DIT): FicheImage {
  const lignes = Array.isArray(titre) ? titre : [titre];
  const cible = base.ecrans.find((e) => e.refs.includes("n07"))!;
  return { ...base, ecrans: base.ecrans.map((e) => (e.id === cible.id ? { ...e, scene: "toile", refs: ["n07", "n08", "n09"], texteDit, textesEcran: lignes } : e)) } as FicheImage;
}

function entetesDe(fiche: FicheImage) {
  const fin = planDesFinsIV({ reseaux: [...RESEAUX_IV], offre: carte.offre, numeroVersion: 1, appelCommentaire: "question-puis-fin", questionCommentaire: fiche.questionCommentaire.texteDit }).fins[0];
  const r = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES } as never);
  const ecran = fiche.ecrans.find((e) => e.refs.includes("n09"))!.id;
  return { r, entetes: r.ligne.evenements.filter((e) => e.id.startsWith(`${ecran}-entete`) && (e as { texte?: string }).texte).map((e) => ({ t: e.instantSec, texte: (e as { texte: string }).texte.split("|")[1], etiquette: (e as { texte: string }).texte.split("|")[0] })) };
}

describe("le titre en liste suit le bloc en cours", () => {
  it("« Email structuré, équipe concernée, alerte Telegram » se révèle morceau par morceau, sur la voix", () => {
    const { r, entetes } = entetesDe(ficheAvec("Email structuré, équipe concernée, alerte Telegram"));
    expect(r.phrases).toEqual([]);
    expect(entetes.map((x) => x.texte)).toEqual(["Email structuré", "Email structuré, équipe concernée", "Email structuré, équipe concernée, alerte Telegram"]);
    for (let k = 1; k < entetes.length; k++) expect(entetes[k].t - entetes[k - 1].t).toBeGreaterThanOrEqual(0.6 - 1e-9);
  });

  it("un chiffre décimal « 2,5 » n'est jamais coupé, même dans un titre ancré qui se révèle morceau par morceau", () => {
    const { entetes } = entetesDe(ficheAvec("Email structuré 2,5 s, alerte Telegram", "Un email structuré arrive en 2,5 secondes. Il part vers l'équipe concernée. Et une alerte Telegram prévient tout le monde."));
    const titres = entetes.filter((x) => x.texte.startsWith("Email"));
    expect(titres.length).toBeGreaterThan(0);
    for (const x of titres) expect(x.texte).toMatch(/^Email structuré 2,5 s/);
  });

  it("un titre-phrase dont les deux moitiés sont dites mais ne nomment pas deux blocs distincts reste ENTIER", () => {
    const titre = "Un *email structuré* arrive, il part";
    const { entetes } = entetesDe(ficheAvec(titre));
    expect(entetes.filter((x) => x.texte.startsWith("Un")).map((x) => x.texte)).toEqual([titre]);
  });

  it("deux morceaux qui visent le même bloc ne sont pas coupés", () => {
    const { entetes } = entetesDe(ficheAvec("Email structuré, email structuré auto"));
    expect(entetes.map((x) => x.texte)).toEqual(["Email structuré, email structuré auto"]);
  });

  it("un titre mêlant « · » et virgules garde ses liens d'origine", () => {
    const titre = "Email structuré · équipe concernée, alerte Telegram";
    const { entetes } = entetesDe(ficheAvec(titre));
    expect(entetes.map((x) => x.texte)).toEqual(["Email structuré", "Email structuré · équipe concernée", titre]);
  });

  it("l'étiquette reste la même à toutes les étapes quand la seconde ligne (non dite) précède le titre", () => {
    const { entetes } = entetesDe(ficheAvec(["OUI · Autoliquidation", "*Email* structuré, équipe concernée, alerte Telegram"]));
    expect(entetes.length).toBe(3);
    expect(new Set(entetes.map((x) => x.etiquette))).toEqual(new Set(["OUI"]));
  });
});
