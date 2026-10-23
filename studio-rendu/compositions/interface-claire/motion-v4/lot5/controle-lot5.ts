/**
 * Contrôle chiffré du lot 5 (sous `tsx`, sans rendu) : densité d'événements (R1), prise seule (R2), immobilité (R3), temps de visage couvert (R8),
 * entrées / sorties, plus petit texte. Usage : `npx tsx controle-lot5.ts`.
 */
import { planEnchainement, planExtrait, Plan, Bloc, FPS } from "./plan-lot5";
import { DUREE_DALLE_CLAQUEE, evenementsDalleClaquee } from "./DalleClaquee";
import { evenementsRafale } from "./RafaleTroisMots";
import { evenementsDuelVideo } from "./DuelVideo";
import { evenementsMotDerriere } from "./MotDerriere";
import { evenementsElementBarre, evenementsPictos } from "./ElementBarre";
import { evenementsAppelFinal } from "./AppelFinalPile";
import { gestesDeVie, grouperMots } from "./commun-lot5";
import { DEMI_HAUTEUR_ST, dReel, groupeDouble, positionSousTitres, ZONE_YEUX } from "./position-st";
import { evenementsPanneauFin } from "./PanneauFin";

export function evenementsBloc(b: Bloc, finPlan = 1e9): number[] {
  switch (b.t) {
    case "etq": return [b.debut, ...(b.sur ? [b.debut + 4] : []), ...gestesDeVie(8, b.fin - b.debut - 3).map((x) => b.debut + x), b.fin - 3];
    case "dalle": return evenementsDalleClaquee(b.debut);
    case "rafale": return evenementsRafale(b.debut, b.ecarts, b.duree).filter((x) => x < b.debut + b.duree);
    case "duel": return evenementsDuelVideo(b.debut, b.iMotB, b.verdict?.i, b.duree).map((x, k, a) => (k === a.length - 1 ? b.debut + b.duree - 3 : x));
    case "mot": return evenementsMotDerriere(b.debut, b.mot.length, b.duree).map((x, k, a) => (k === a.length - 1 ? b.debut + b.duree - 3 - b.mot.length : x));
    case "barre": return b.variante === "pictos" ? evenementsPictos(b.debut, b.iBarre, b.duree) : evenementsElementBarre(b.debut, b.iApp, b.iBarre, b.resultat?.i, b.duree);
    case "appel": return evenementsAppelFinal(b.debut, b.iLignes, b.duree);
    case "fin": return evenementsPanneauFin(b.debut, 5, finPlan);
  }
}
const fin = (b: Bloc) => (b.t === "etq" ? b.fin : b.t === "dalle" ? b.debut + DUREE_DALLE_CLAQUEE : b.t === "fin" ? 1e9 : b.debut + b.duree);

export function controler(plan: Plan) {
  const ev = Array.from(new Set(plan.blocs.flatMap((b) => evenementsBloc(b, plan.duree)).concat(plan.D.map((d) => d.i)))).filter((x) => x < plan.duree).sort((a, b) => a - b);
  const sec = plan.duree / FPS;
  let minFenetre = Infinity;
  const fenetre = Math.min(150, plan.duree);
  for (let t = 0; t + fenetre <= plan.duree; t += 5) minFenetre = Math.min(minFenetre, ev.filter((x) => x >= t && x < t + fenetre).length / (fenetre / FPS));
  let plusLongGap = 0;
  let gapDe = 0;
  for (let k = 1; k < ev.length; k++) if (ev[k] - ev[k - 1] > plusLongGap) { plusLongGap = ev[k] - ev[k - 1]; gapDe = ev[k - 1]; }
  // Prise seule : images sans aucun bloc actif.
  let seule = 0, seuleMax = 0, cur = 0;
  for (let f = 0; f < plan.duree; f++) {
    const actif = plan.blocs.some((b) => f >= b.debut && f < fin(b));
    if (!actif) { cur++; seule++; seuleMax = Math.max(seuleMax, cur); } else cur = 0;
  }
  // Assertion image par image : le groupe de sous-titres visible ne coupe jamais les yeux [0,27 + D(f) ; 0,36 + D(f)] H, D(f) étant la descente RÉELLE.
  const groupes = grouperMots(plan.mots, plan.duree / FPS);
  let imagesSurLesYeux = 0, imagesAvecSousTitres = 0, imagesMasqueesDoublon = 0;
  for (let f = 0; f < plan.duree; f++) {
    const g = groupes.find((x) => f / FPS >= x.debut - 1e-6 && f / FPS < x.fin - 1e-6);
    const yc = positionSousTitres(plan, f);
    if (!g || yc === null) continue;
    if (groupeDouble(plan, Math.max(f, Math.round(g.mots[g.mots.length - 1].debut * FPS)), g.mots.map((m) => m.mot))) { imagesMasqueesDoublon++; continue; }
    imagesAvecSousTitres++;
    const D = dReel(f, plan);
    if (yc + DEMI_HAUTEUR_ST > ZONE_YEUX[0] + D && yc - DEMI_HAUTEUR_ST < ZONE_YEUX[1] + D) imagesSurLesYeux++;
  }
  return { id: plan.id, sous_titres_sur_les_yeux_images: imagesSurLesYeux, images_avec_sous_titres: imagesAvecSousTitres, images_sous_titre_masque_doublon: imagesMasqueesDoublon, duree_s: sec, evenements: ev.length, densite_moyenne: +(ev.length / sec).toFixed(2), densite_min_5s: +minFenetre.toFixed(2), plus_longue_immobilite_images: plusLongGap, apres_image: gapDe, prise_seule_totale_images: seule, prise_seule_max_images: seuleMax };
}

if (process.argv[1]?.endsWith("controle-lot5.ts")) {
  const ids = ["dalle-claquee", "rafale-trois-mots", "duel-video", "mot-derriere", "element-barre", "element-barre-pictos", "appel-final-pile", "panneau-fin"];
  console.log(JSON.stringify(controler(planEnchainement()), null, 1));
  for (const id of ids) console.log(JSON.stringify(controler(planExtrait(id))));
}
