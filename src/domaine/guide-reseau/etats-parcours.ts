// États du parcours de conversation et leur nature. Module PUR, sans import : lisible depuis les services sans tirer le port Zernio.
export type EtatParcours =
  | "nouveau" | "pub_ok" | "m1_en_vol" | "attente_email" | "m1_a_verifier" | "m1_consommee" | "m1_refuse"
  | "m2_envoye" | "guide_demande" | "termine" | "site_refuse" | "expire" | "oppose";
/** Nature de chaque état (exhaustif : un état ajouté sans nature ne compile pas). */
const NATURE_ETAT: Record<EtatParcours, "en_cours" | "fini"> = {
  nouveau: "en_cours", pub_ok: "en_cours", m1_en_vol: "en_cours", attente_email: "en_cours", m1_a_verifier: "en_cours", m2_envoye: "en_cours", guide_demande: "en_cours",
  m1_consommee: "fini", m1_refuse: "fini", termine: "fini", site_refuse: "fini", expire: "fini", oppose: "fini",
};
export const ETATS_EN_COURS: readonly string[] = (Object.keys(NATURE_ETAT) as EtatParcours[]).filter((e) => NATURE_ETAT[e] === "en_cours");
