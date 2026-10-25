/**
 * Polices de la toile continue, chargées EN LOCAL (modèle `../polices.ts`) : Bricolage Grotesque (variable 300-800, titres), Instrument Serif
 * (romain et italique, accents et marque), plus Inter (`../polices.ts`, texte courant et pied : la police à chasse fixe de la maquette
 * est remplacée par Inter à chiffres tabulaires, L1).
 * Licences : `../../commune/polices/OFL-*.txt`, provenance : `../../commune/polices/README-continu.md`.
 * L'espace fine insécable (U+202F) manque à Instrument Serif : une face limitée à U+202F la prend dans Inter SemiBold.
 * Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import { DELAI_DELAYRENDER_MS } from "../commun/attente-police";
import { policeInterPrete } from "../polices";
import bricolage from "../../commune/polices/BricolageGrotesque-Variable.ttf";
import instrument from "../../commune/polices/InstrumentSerif-Regular.ttf";
import instrumentItalique from "../../commune/polices/InstrumentSerif-Italic.ttf";
import interSemiBold from "../../commune/polices/Inter-SemiBold.ttf";
import { FAMILLE_BRICOLAGE, FAMILLE_INSTRUMENT } from "./constantes-continu";

export { FAMILLE_INTER } from "../polices";

const PLAGE_ESPACE_FINE = "U+202F";

let chargement: Promise<void> | null = null;

function faces(): FontFace[] {
  return [
    new FontFace(FAMILLE_BRICOLAGE, `url(${bricolage})`, { weight: "300 800" }),
    new FontFace(FAMILLE_INSTRUMENT, `url(${instrument})`, { weight: "400", style: "normal" }),
    new FontFace(FAMILLE_INSTRUMENT, `url(${instrumentItalique})`, { weight: "400", style: "italic" }),
    new FontFace(FAMILLE_INSTRUMENT, `url(${interSemiBold})`, { weight: "400", style: "normal", unicodeRange: PLAGE_ESPACE_FINE }),
    new FontFace(FAMILLE_INSTRUMENT, `url(${interSemiBold})`, { weight: "400", style: "italic", unicodeRange: PLAGE_ESPACE_FINE }),
  ];
}

/** Lance le chargement (une fois) : Remotion attend la fin ; une police illisible fait échouer le rendu. */
export function chargerPolicesContinu(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Polices de la toile continue", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  chargement = Promise.all([...faces().map((f) => f.load()), policeInterPrete().then(() => null)]).then(
    (chargees) => {
      for (const f of chargees) if (f) document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police de la toile illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargement.catch(() => undefined);
}

/** Promesse du chargement de toutes les polices de la toile (lance le chargement si besoin). */
export function policesContinuPretes(): Promise<void> {
  chargerPolicesContinu();
  return chargement ?? Promise.resolve();
}
