/**
 * LE SCRIPT RÉEL DU 15/10 (vidéo v-d3e2a726cf0c, noté 10 sur 10 par l'ancienne relecture, jugé « catastrophique » par
 * Will) : son texte dit est lu MOT POUR MOT dans le témoin de production
 * (`tests/tableau/temoins/fabrication-arretee-ecriture-a-l-heure-2026-10-15.json`, scènes de la fiche), puis rangé par
 * passage. Les mots à l'écran sont les premiers mots dits de chaque phrase. Il n'a ni idée, ni gain, ni
 * métier déclarés : il a été écrit avant le gabarit cadré.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DemandeScriptTableau, EcritureScript, PhraseScript } from "@/domaine/scripts-tableau";
import { phrasesAJustifier, phrasesDe, texteDitDe } from "@/domaine/scripts-tableau-controles";

interface SceneTemoin {
  id: string;
  role: string;
  texteDit: string;
}

/** Les scènes de la fiche réelle du 15/10, dans l'ordre. */
export function scenes1510(): SceneTemoin[] {
  const brut = JSON.parse(readFileSync(join(__dirname, "..", "tableau", "temoins", "fabrication-arretee-ecriture-a-l-heure-2026-10-15.json"), "utf8")) as { fiche: { scenes: SceneTemoin[] } };
  return brut.fiche.scenes;
}

const enPhrases = (t: string): PhraseScript[] => phrasesDe(t).map((dit) => ({ dit, ecran: dit.replace(/[.,:;!?«»]/g, "").split(/\s+/).filter(Boolean).slice(0, 4).join(" ") }));

export const DEMANDE_1510: DemandeScriptTableau = {
  serie: "formation",
  sujet: "Vos équipes utilisent déjà l'IA en cachette : formez-les avant qu'elles fassent des erreurs",
  public: "Dirigeants de TPE et PME dont les salariés utilisent ChatGPT sans cadre",
  vraiCas: null,
  reseau: "courts",
  fin: { type: "diagnostic" },
  envoi: "Un appel de diagnostic",
};

/** Le script du 15/10, rangé par passage (accroche, douleur, promesse, 4 étapes, exemple, à retenir, appel). */
export function ecriture1510(): EcritureScript {
  const sc = scenes1510();
  const t = (id: string) => sc.find((s) => s.id === id)!.texteDit;
  const s01 = phrasesDe(t("s01"));
  // « Un. Demandez… » : le numéro et sa phrase forment l'action.
  const etape = (...ids: string[]) => {
    const ph = enPhrases(ids.map(t).join(" "));
    const action = `${ph[0].dit} ${ph[1].dit}`;
    return { action: { dit: action, ecran: ph[1].ecran }, comment: ph.slice(2) };
  };
  const script: EcritureScript["script"] = {
    accroche: enPhrases(s01[0]),
    douleur: enPhrases([...s01.slice(1), t("s02")].join(" ")),
    promesse: enPhrases(t("s03")),
    etapes: [etape("s04"), etape("s05", "s06"), etape("s07"), etape("s08", "s09")],
    exemple: { mentionEcran: "Exemple illustratif", phrases: enPhrases(`${t("s10")} ${t("s11")}`) },
    aRetenir: enPhrases(t("s12")),
    appel: enPhrases(t("s13")),
  };
  return {
    idee: "",
    gain: { formule: "", unite: "" },
    metierExemple: "plomberie",
    script,
    motsDouleur: ["savez", "équipe", "colle"],
    sources: [],
    // Le relevé de la production n'est pas dans le témoin : chaque phrase à justifier est couverte, pour que le refus ne
    // tienne qu'aux défauts du texte.
    affirmations: phrasesAJustifier(texteDitDe(script)).map((extrait) => ({ extrait, nature: "consigne" as const, pourquoi: "Relevé de la production (non conservé dans le témoin)." })),
    variantes: [],
    aPreparer: [],
  };
}
