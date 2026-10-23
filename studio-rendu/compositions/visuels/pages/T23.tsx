import { BORDURE_CARTE, BORD_DROIT_TEXTE, COULEURS, MARGE, OMBRE_DECALAGE, POLICE_CORPS, POLICE_MANUSCRITE, TAILLES, TAILLE_MANUSCRITE } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { Picto } from "../commun/Picto";
import { ECHELLE, k, moinsK, Remplir } from "../commun/Remplir";
import { styleCarte } from "../commun/style-carte";
import type { QuestionSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { W01 } from "../mini/W01";
import { capaciteQuestion } from "../../../../src/briques/visuels/registre-pages";
import { chargerPoliceArchivoBlack, chargerPoliceInter, chargerPoliceKalam } from "../polices";

interface Proprietes {
  titre: string;
  questions: QuestionSpec[];
  annotation: string;
  index: number;
  total: number;
}

const PASTILLE = 104;
const ECART = 26;
const REMPLISSAGE = 26;
const ICONE = 104;
/** Abscisse du début du texte d'une question : marge, bordure, remplissage, pastille, espace. */
const X_TEXTE = MARGE + BORDURE_CARTE + REMPLISSAGE + PASTILLE + ECART;
/** L'icône est posée à droite, AVANT le bord du texte (x = 912) : elle reste hors des zones de la plateforme, le texte s'arrête avant elle. */
const BORD_TEXTE = BORD_DROIT_TEXTE - ICONE - ECART;

/**
 * Corps (px) de la question et de l'aide selon le nombre de questions (moins il y en a, plus elles sont grandes) et leur longueur : près du
 * budget (plus de 70 %), le corps baisse d'un cran au lieu de déborder. L'aide reste ≥ 30 px (texte courant).
 */
function tailles(questions: readonly QuestionSpec[]): { question: number; aide: number } {
  const n = questions.length;
  const budget = capaciteQuestion(n);
  const long = questions.some((q) => q.question.length > 0.7 * budget.question || q.aide.length > 0.7 * budget.aide);
  if (n <= 2) return long ? { question: 38, aide: TAILLES.corps } : { question: 44, aide: 34 };
  if (n === 3) return long ? { question: 34, aide: TAILLES.corps } : { question: 40, aide: 31 };
  return long ? { question: 32, aide: TAILLES.corps } : { question: 36, aide: TAILLES.corps };
}

/**
 * T23 — questions à se poser : 2 à 4 rangées (grande pastille orange au rang, question en gras, aide dessous, icône de la banque à droite),
 * annotation manuscrite (Kalam, encre) en bas. Le rang est dessiné par le code (`W01`). Les rangées gardent la hauteur de leur contenu, le
 * groupe grandit pour remplir la page (`Remplir`).
 */
export function T23({ titre, questions, annotation, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  chargerPoliceKalam();
  const t = tailles(questions);
  return (
    <PageBase titre={titre} index={index} total={total} type="T23">
      <Remplir max={1.6} ecart={18} style={{ paddingRight: OMBRE_DECALAGE }}>
        {questions.map((q, i) => (
          <div
            key={i}
            style={{
              flex: "none",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: ECART,
              padding: `${k(22)} ${REMPLISSAGE}px`,
              borderRadius: 28,
              ...styleCarte(i + 1),
              border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
            }}
          >
            <div style={{ flex: "none", width: k(PASTILLE), height: k(PASTILLE) }}>
              <div style={{ width: PASTILLE, height: PASTILLE, transform: ECHELLE, transformOrigin: "0 0" }}>
                <W01 taille={PASTILLE} rang={i + 1} />
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: k(8), maxWidth: moinsK(largeurTexteMax(X_TEXTE, BORD_TEXTE), PASTILLE + ICONE) }}>
              <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(t.question), lineHeight: 1.18, color: COULEURS.encre }}>{q.question}</div>
              <div style={{ fontFamily: POLICE_CORPS, fontWeight: 500, fontSize: k(t.aide), lineHeight: 1.28, color: COULEURS.encre }}>{q.aide}</div>
            </div>
            <Picto nom={q.icone ?? "question"} taille={k(ICONE)} />
          </div>
        ))}
        <div style={{ flex: "none", maxWidth: largeurTexteMax(MARGE + 30, BORD_DROIT_TEXTE_BAS), paddingLeft: 30, paddingTop: k(6), fontFamily: POLICE_MANUSCRITE, fontWeight: 700, fontSize: k(TAILLE_MANUSCRITE + 4), lineHeight: 1.12, color: COULEURS.encre, transform: "rotate(-1.5deg)", transformOrigin: "left center" }}>
          {annotation}
        </div>
      </Remplir>
    </PageBase>
  );
}
