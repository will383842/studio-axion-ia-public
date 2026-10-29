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
function ficheAvec(titre: string): FicheImage {
  const cible = base.ecrans.find((e) => e.refs.includes("n07"))!;
  return { ...base, ecrans: base.ecrans.map((e) => (e.id === cible.id ? { ...e, scene: "toile", refs: ["n07", "n08", "n09"], texteDit: "Un email structuré arrive. Il part vers l'équipe concernée. Et une alerte Telegram prévient tout le monde.", textesEcran: [titre] } : e)) } as FicheImage;
}

function entetesDe(fiche: FicheImage) {
  const fin = planDesFinsIV({ reseaux: [...RESEAUX_IV], offre: carte.offre, numeroVersion: 1, appelCommentaire: "question-puis-fin", questionCommentaire: fiche.questionCommentaire.texteDit }).fins[0];
  const r = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES } as never);
  const ecran = fiche.ecrans.find((e) => e.refs.includes("n09"))!.id;
  return { r, entetes: r.ligne.evenements.filter((e) => e.id.startsWith(`${ecran}-entete`) && (e as { texte?: string }).texte).map((e) => ({ t: e.instantSec, texte: (e as { texte: string }).texte.split("|")[1] })) };
}

describe("le titre en liste suit le bloc en cours", () => {
  it("« Email structuré, équipe concernée, alerte Telegram » se révèle morceau par morceau, sur la voix", () => {
    const { r, entetes } = entetesDe(ficheAvec("Email structuré, équipe concernée, alerte Telegram"));
    expect(r.phrases).toEqual([]);
    expect(entetes.map((x) => x.texte)).toEqual(["Email structuré", "Email structuré, équipe concernée", "Email structuré, équipe concernée, alerte Telegram"]);
    for (let k = 1; k < entetes.length; k++) expect(entetes[k].t - entetes[k - 1].t).toBeGreaterThanOrEqual(0.6 - 1e-9);
  });

  it("garde-fou : une virgule décimale ou une virgule d'une phrase non nommée ne découpe rien", () => {
    const { entetes } = entetesDe(ficheAvec("Voici, en bref, la suite"));
    expect(entetes.map((x) => x.texte)).toEqual(["Voici, en bref, la suite"]);
  });
});
