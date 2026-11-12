/**
 * Lot I : le moteur « Tutoriel d'outil » passe le contrat commun des moteurs (format sans prix), sur sa vraie chaîne
 * branchée sur des doubles (voix, Claude et rendu simulés, aucun appel réel).
 */
import { testerMoteurVideo } from "../../src/moteurs/contrat";
import { creerMoteurTutorielOutil } from "../../src/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une } from "./doubles";

const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles({ voix: [], claude: [], rendus: [] })) });

testerMoteurVideo(moteur, async () => commandeTutoriel(), { sansPrix: true });
