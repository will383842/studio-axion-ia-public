import React from "react";
/** Point d'entrée Remotion du banc d'essai du lot 3 (contrôle seulement, jamais branché en production). */
import { registerRoot } from "remotion";
import { RacinePlancheLot3 } from "./PlancheLot3";

registerRoot(RacinePlancheLot3);
