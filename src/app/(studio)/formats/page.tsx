import { redirect } from "next/navigation";

/** AV2.1 : /formats renvoie vers Mes vidéos (les formats sont des onglets de galerie). */
export default function PageFormats() {
  redirect("/videos");
}
