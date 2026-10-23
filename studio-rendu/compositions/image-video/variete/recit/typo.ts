/** Styles de texte du calque « récit » (polices de la charte, chargées par la composition). PUR. */
import type { CSSProperties } from "react";
import { POLICES_DUO } from "../../../../../src/briques/habillage/charte-duo";

export const ANTON: CSSProperties = { fontFamily: POLICES_DUO.affiche.famille, fontWeight: POLICES_DUO.affiche.graisse, textTransform: "uppercase", lineHeight: 1 };
