import { ListeStock } from "./ListeStock";
import type { MessageStock } from "@/domaine/stock-messages";

/** Onglet « Mes textes » : les textes mis de côté, à placer dans le calendrier. */
export function OngletMesTextes({ entrees }: { entrees: MessageStock[] }) {
  return <ListeStock entrees={entrees} />;
}
