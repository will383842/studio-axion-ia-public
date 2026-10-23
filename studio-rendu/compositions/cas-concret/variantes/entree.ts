/**
 * Entrée Remotion PROPRE aux maquettes de variété (lot L1) : empaquetée seulement par `outils/maquettes-variete/`.
 * La racine de production (`compositions/index.ts`) ne l'importe pas : rien ne change pour le studio en service.
 */
import { registerRoot } from "remotion";
import { CompositionsMaquettes } from "./Maquettes";

registerRoot(CompositionsMaquettes);
