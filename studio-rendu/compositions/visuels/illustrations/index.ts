/** Banque d'illustrations : composants purs, indexés par l'identifiant du registre (liste fermée). */
import type { ComponentType } from "react";
import type { IdIllustration } from "../../../../src/briques/visuels/registre-illustrations";
import type { ProprietesIllustration } from "./Cadre";
import { I01, I02, I03, I04, I05, I06, I07, I08, I09, I10, I11, I12 } from "./Illustrations";

export type { ProprietesIllustration } from "./Cadre";
export { BLANC_CARTE } from "./palette";
export { I01, I02, I03, I04, I05, I06, I07, I08, I09, I10, I11, I12 } from "./Illustrations";

export const COMPOSANTS_ILLUSTRATIONS: Record<IdIllustration, ComponentType<ProprietesIllustration>> = { I01, I02, I03, I04, I05, I06, I07, I08, I09, I10, I11, I12 };
