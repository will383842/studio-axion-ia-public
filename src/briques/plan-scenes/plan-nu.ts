/**
 * Plan « nu » (X3-06) : cran Aucun = l'écran seul, sans pièce ni calque ; cran Sobre = niveau 1 (calques retirés).
 * PUR : aucun import de service, de moteur ni d'argent. Aucune date, aucun hasard.
 *
 * Le schéma d'une scène exige une pièce : « écran seul » s'exprime donc par ZÉRO scène (le plan de repli fait déjà
 * ainsi quand le script ne contient aucun fait) ; l'écran et les sous-titres jouent seuls sur toute la durée.
 * Le plan nu n'a donc pas besoin de l'IA : 0 appel Claude. Rien ne l'appelle sans cran explicite dans la commande.
 */
import type { ContexteValidation } from "./validateur";
import { planDeRepli } from "./validateur";
import { empreinteScene } from "./empreinte";
import type { PlanValide, SceneValide } from "./schema";

/** Plan nu : même gabarit que le plan de repli (format, mots, durée, habillage), sans aucune scène. */
export function planNu(contexte: ContexteValidation): PlanValide {
  const { scenes: _scenes, ...gabarit } = planDeRepli(contexte);
  void _scenes;
  return { ...gabarit, scenes: [] };
}

/** Niveau 1 : retire les calques (niveau 2 → 1) et le code (niveau 3) ; la pièce principale reste. Entrée intacte. */
export function planNiveau1(plan: PlanValide): PlanValide {
  return {
    ...plan,
    scenes: plan.scenes.map((s): SceneValide => {
      if (s.niveau === 1 && !s.calques && s.code === undefined) return s;
      const { calques: _calques, code: _code, ...reste } = s;
      void _calques;
      void _code;
      const niveau1 = { ...reste, niveau: 1 } as SceneValide;
      // Contenu changé : l'empreinte suit (la retouche ne refait que les scènes dont l'empreinte change).
      return { ...niveau1, empreinte: empreinteScene(niveau1, plan) };
    }),
  };
}
