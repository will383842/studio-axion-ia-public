import { iconesDesQuestions } from "../../../../src/briques/visuels/choix-illustration";
import { taillesT23 } from "../../../../src/briques/visuels/places-mots";
import { BORD_DROIT_TEXTE, COULEURS, MARGE, POLICE_CORPS, POLICE_MANUSCRITE, TAILLE_MANUSCRITE } from "../commun/constantes";
import { filetAuDessus, Pastille } from "../commun/editorial";
import { PageBase } from "../commun/PageBase";
import { Picto } from "../commun/Picto";
import { colonne, type Colonne } from "../commun/geometrie";
import { k, largeurColonne, Remplir } from "../commun/Remplir";
import type { QuestionSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceKalam } from "../polices";

interface Proprietes {
  titre: string;
  questions: QuestionSpec[];
  annotation: string;
  index: number;
  total: number;
}

const PASTILLE = 60;
const ECART = 28;
const ICONE = 76;
/** L'annotation manuscrite est inclinée : son bord droit avance de quelques pixels, elle s'arrête donc un peu avant x = 860. */
const MARGE_ROTATION = 24;
/** Abscisse du début du texte d'une question : marge, pastille, espace. */
const X_TEXTE = MARGE + PASTILLE + ECART;

/** Colonne de texte de chaque question (`geometrie.ts`) : après la pastille (qui grandit), avant l'icône (qui grandit aussi). Fonction PURE. */
export function colonnesT23(n: number, icones: boolean): Colonne[] {
  return Array.from({ length: n }, (_, i) => colonne(X_TEXTE, (i >= n - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE) - (icones ? ICONE + ECART : 0), PASTILLE, icones ? ICONE : 0));
}

/**
 * T23 — questions à se poser, style ÉDITORIAL (A, ART-1) : 2 à 4 rangées séparées par des filets de 2 px ; pastille orange au rang (posée par
 * le code), question en Inter Bold, aide en Inter Medium ; icône de la banque à droite SEULEMENT si chaque question en a une QUI A UN SENS (choisie dans son texte, jamais le « ? » répété : `iconesDesQuestions`, un seul système
 * par page) ; annotation manuscrite (Kalam, encre) en bas. Une espace fine insécable tient « ? » au dernier mot (`typographie-francaise.ts`).
 */
export function T23({ titre, questions, annotation, index, total }: Proprietes) {
  chargerPoliceInter();
  chargerPoliceKalam();
  const t = taillesT23(questions);
  // Une icône qui a un sens pour CHAQUE question (jamais le « ? » répété), sinon aucune.
  const icones = iconesDesQuestions(questions);
  const cols = colonnesT23(questions.length, icones !== null);
  return (
    <PageBase titre={titre} index={index} total={total} type="T23">
      <Remplir max={2.4} ecart={28}>
        {questions.map((q, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: ECART, ...filetAuDessus(i === 0, 26) }}>
            <Pastille rang={i + 1} taille={k(PASTILLE)} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: k(8), maxWidth: largeurColonne(cols[i]) }}>
              <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(t.question), lineHeight: 1.15, color: COULEURS.encre, textWrap: "pretty" }}>{q.question}</div>
              <div style={{ fontFamily: POLICE_CORPS, fontWeight: 500, fontSize: k(t.aide), lineHeight: 1.3, color: COULEURS.encre, textWrap: "pretty" }}>{q.aide}</div>
            </div>
            {icones && <Picto nom={icones[i]} taille={k(ICONE)} />}
          </div>
        ))}
        <div style={{ alignSelf: "flex-start", maxWidth: largeurTexteMax(MARGE, BORD_DROIT_TEXTE_BAS - MARGE_ROTATION), paddingTop: k(8), fontFamily: POLICE_MANUSCRITE, fontWeight: 700, fontSize: k(TAILLE_MANUSCRITE + 4), lineHeight: 1.12, color: COULEURS.encre, transform: "rotate(-1.5deg)", transformOrigin: "left center" }}>
          {annotation}
        </div>
      </Remplir>
    </PageBase>
  );
}
