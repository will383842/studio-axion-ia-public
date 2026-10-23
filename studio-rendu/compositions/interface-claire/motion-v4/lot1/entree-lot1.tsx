import React from "react";
/** Point d'entrée Remotion du banc d'essai du lot 1 v4 (contrôle seulement, jamais branché en production). */
import { registerRoot } from "remotion";
import { RacineLot1 } from "./PlancheLot1";

registerRoot(RacineLot1);
