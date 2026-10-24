/**
 * Entrée Remotion du paquet de mesure de la toile continue (opération `toile-continue`). Hors de `visuels/` : le test `jsx-chargement-module`
 * charge ensemble tous les modules de `visuels/`, et deux `registerRoot` dans un même paquet lèvent une erreur.
 */
import { registerRoot } from "remotion";
import { RacineToile } from "./visuels/continu/mesure/Racine";

registerRoot(RacineToile);
