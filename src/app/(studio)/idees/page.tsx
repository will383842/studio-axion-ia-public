import { redirect } from "next/navigation";

/** AV2.1 : les idées vivent dans « Écrire ». */
export default function PageIdees() {
  redirect("/ecrire?onglet=idees");
}
