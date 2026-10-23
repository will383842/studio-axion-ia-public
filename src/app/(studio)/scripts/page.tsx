import { redirect } from "next/navigation";

/** AV2.1 : les scripts vivent dans « Écrire ». */
export default function PageScripts() {
  redirect("/ecrire?onglet=scripts");
}
