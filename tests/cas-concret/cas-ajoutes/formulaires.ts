/** Formulaires d'essai d'un cas ajouté (aucun appel, aucune base). */
import type { FormulaireCas } from "@/moteurs/montage-cas-concret/cas-ajoutes";

export const FORMULAIRE_MINIMAL: FormulaireCas = {
  titre: "Les devis envoyés relancés au bon moment",
  theme: "Devis relancés",
  offre: "integration",
  nature: "automatisation",
  cible: "Un dirigeant qui envoie ses devis et oublie de les relancer.",
  promesse: "Vos devis sont relancés sans oubli.",
  sujet: "Vos devis restent sans réponse.",
  scene: "Le devis est parti depuis longtemps. Personne n'a pensé à demander la réponse, et le dossier dort dans la boîte d'envoi.",
  exemple: "ce devis envoyé à un prospect",
  taches: ["Noter les devis envoyés", "Relancer chacun à la main"],
  etapes: [
    { ligne: "Chaque devis envoyé est noté tout seul." },
    { ligne: "Une relance part au bon moment." },
    { ligne: "La réponse du prospect est classée." },
    { ligne: "Vous décidez de la suite à donner." },
  ],
  resteHumain: "Décider de la suite à donner.",
  resteHumainApresEtape: 3,
  resultat: "Vos devis sont suivis et les réponses arrivent plus vite.",
  mot: "SUIVIDEVIS",
};
