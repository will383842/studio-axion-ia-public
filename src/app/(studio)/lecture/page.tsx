import type { Metadata } from "next";
import { LecturePrompteur } from "@/components/tournage/LecturePrompteur";

export const metadata: Metadata = { title: "Lecture" };

/**
 * PAGE « LECTURE » (18/10) : le texte à lire de la face caméra en plein écran, pour l'iPad (Safari). Le texte arrive dans le
 * fragment du lien (`#t=…`), il n'est jamais envoyé ni enregistré : la page ne fait aucun appel.
 */
export default function PageLecture() {
  return <LecturePrompteur />;
}
