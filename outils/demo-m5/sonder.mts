/** Sonde (gratuite) : pour quelques requêtes, combien de vidéos verticales PERTINENTES chez Pexels et Pixabay. */
import { chargerCles } from "./cles.ts";
chargerCles(["PEXELS_API_KEY", "PIXABAY_API_KEY"]);
const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const dom = await charger<typeof import("@/domaine/illustrations")>("@/domaine/illustrations");
const pexels = await charger<typeof import("@/fournisseurs/illustration/pexels")>("@/fournisseurs/illustration/pexels");
const pixabay = await charger<typeof import("@/fournisseurs/illustration/pixabay")>("@/fournisseurs/illustration/pixabay");
for (const intention of process.argv.slice(2)) {
  const req = intention.startsWith("en:") ? { requeteEn: intention.slice(3) } : dom.requeteDuPlan({ id: "x", ordre: 0, texte: intention, requete: intention });
  const a = (await pexels.chercherPexels(process.env.PEXELS_API_KEY!, req.requeteEn)).filter((c) => dom.resultatBanqueAcceptable(c, "9:16", 2, req.requeteEn));
  const b = (await pixabay.chercherPixabay(process.env.PIXABAY_API_KEY!, req.requeteEn)).filter((c) => dom.resultatBanqueAcceptable(c, "9:16", 2, req.requeteEn));
  console.log(`« ${intention} » → « ${req.requeteEn} » : pexels ${a.length} (${a[0]?.description ?? "-"}), pixabay ${b.length} (${b[0]?.description ?? "-"}) ; fabrication : ${dom.requeteFabrication(req.requeteEn) ? "possible" : "non"}`);
}
