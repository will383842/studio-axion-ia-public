/**
 * PETITS OBJETS — terminal sombre (C9-19) : contour tracé, panneau en fondu, puis la commande tapée lettre par lettre avec un curseur.
 * Seule la commande est montrée (les mots du script) : aucune sortie de terminal inventée. Panneau toujours sombre, police JetBrains Mono
 * (exception G2, terminal seulement) ; l'appelant charge la police (C9-05), ce fichier n'importe aucun module du rendu ni du registre des droits.
 * Pièce pure, NON inscrite (rien ne l'importe). Imports relatifs seulement.
 */
import type { JSX } from "react";
import { PALETTE } from "../../charte/axion-2026";
import { MOTS_MAX, SURFACE_MAX, type DefinitionObjet } from "./contrat";
import { IMAGES_ENTREE, phaseObjet } from "./progres";
import { TraceSvg } from "./TraceSvg";

/** `commande` : 1 à 4 mots, une ligne ; `largeur` et `hauteur` en % du cadre. */
export interface ParametresTerminalCommande {
  commande: string;
  largeur: number;
  hauteur: number;
}

/** Même nom que `FAMILLE_JETBRAINS_MONO` (`studio-rendu/compositions/petits-objets/polices.ts`), recopié : ce fichier n'importe pas le chargeur. */
const FAMILLE_TERMINAL = `"JetBrains Mono", monospace`;
const L = 1000;
const H = 1000;
const MIN_POURCENT = 20;
const SIGNES_MAX = 40;
const HAUTEUR_BARRE = 70;
const MARGE = 40;
const TAILLE_POLICE = 40;
const LARGEUR_SIGNE = TAILLE_POLICE * 0.6;
const DECALAGE_COMMANDE = 56;
const IMAGES_FONDU = 6;
const IMAGES_PAR_LETTRE = 2;
const IMAGES_CLIGNOTEMENT = 12;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const f = (n: number): string => n.toFixed(1);

function valider(p: unknown): ParametresTerminalCommande | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { commande, largeur, hauteur } = p as Record<string, unknown>;
    if (typeof commande !== "string" || !nombre(largeur) || !nombre(hauteur)) return null;
    if (/[\r\n]/.test(commande) || commande.length > SIGNES_MAX) return null;
    const mots = commande.trim().split(/\s+/).filter(Boolean);
    if (mots.length === 0 || mots.length > MOTS_MAX) return null;
    if (largeur < MIN_POURCENT || largeur > 100 || hauteur < MIN_POURCENT || hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX + 1e-9) return null;
    // La ligne (marge, invite, commande, curseur, marge) doit tenir dans le panneau.
    if (2 * MARGE + DECALAGE_COMMANDE + (commande.length + 1) * LARGEUR_SIGNE > (largeur * L) / 100 + 1e-9) return null;
    return { commande, largeur, hauteur };
  } catch {
    return null;
  }
}

export const OBJET_TERMINAL_COMMANDE: DefinitionObjet<ParametresTerminalCommande> = {
  id: "objet-terminal-commande",
  famille: "ecran",
  capacite: "objet.ecran",
  valider,
  toile: { largeur: L, hauteur: H },
  dureeSec: { min: 2, max: 4 },
  donnees: "mots-dits",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, parametres } = pr;
    const phase = phaseObjet(image, dureeImages);
    const fondu = phase.trace < 1 ? 0 : Math.min(1, Math.max(0, (image - IMAGES_ENTREE + 1) / IMAGES_FONDU));
    const debutFrappe = IMAGES_ENTREE + IMAGES_FONDU;
    const total = parametres.commande.length;
    const finFrappe = debutFrappe + (total - 1) * IMAGES_PAR_LETTRE;
    const tapees = phase.trace < 1 ? 0 : Math.max(0, Math.min(total, Math.floor((image - debutFrappe) / IMAGES_PAR_LETTRE) + 1));
    const termine = tapees >= total;
    const texte = parametres.commande.slice(0, tapees);
    const w = (parametres.largeur * L) / 100;
    const h = (parametres.hauteur * H) / 100;
    const x = (L - w) / 2;
    const y = (H - h) / 2;
    const contour = `M ${f(x)} ${f(y)} L ${f(x + w)} ${f(y)} L ${f(x + w)} ${f(y + h)} L ${f(x)} ${f(y + h)} Z`;
    const barre = Math.min(HAUTEUR_BARRE, h * 0.2);
    const ligneY = y + barre + MARGE + TAILLE_POLICE;
    const departX = x + MARGE + DECALAGE_COMMANDE;
    const curseurX = departX + tapees * LARGEUR_SIGNE;
    // Pendant la frappe le curseur reste allumé ; ensuite il clignote.
    const curseurAllume = fondu > 0 && (!termine || Math.floor((image - finFrappe) / IMAGES_CLIGNOTEMENT) % 2 === 0);
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <rect x={f(x)} y={f(y)} width={f(w)} height={f(h)} rx={14} fill={PALETTE.noir} fillOpacity={fondu} stroke="none" />
          <TraceSvg d={contour} t={phase.trace} ton="neutre" fond="noir" />
          <g fillOpacity={fondu}>
            <text x={f(x + MARGE)} y={f(ligneY)} fontSize={TAILLE_POLICE} fontFamily={FAMILLE_TERMINAL} fill={PALETTE.grisSurNoir}>
              $
            </text>
            <text x={f(departX)} y={f(ligneY)} fontSize={TAILLE_POLICE} fontFamily={FAMILLE_TERMINAL} fill={PALETTE.ivoire} style={{ whiteSpace: "pre" }} data-tape={texte}>
              {texte}
            </text>
            {curseurAllume ? (
              <rect data-curseur="1" x={f(curseurX)} y={f(ligneY - TAILLE_POLICE + 6)} width={f(LARGEUR_SIGNE)} height={TAILLE_POLICE} fill={PALETTE.ivoire} stroke="none" />
            ) : null}
          </g>
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. Les commandes viennent du script, jamais d'un calcul. */
export const EXEMPLES_TERMINAL_COMMANDE: readonly ParametresTerminalCommande[] = [
  { commande: "npm run build", largeur: 60, hauteur: 40 },
  { commande: "git push", largeur: 50, hauteur: 30 },
  { commande: "claude", largeur: 70, hauteur: 50 },
];
