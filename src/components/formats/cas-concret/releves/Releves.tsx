/**
 * RELEVÉS D'UNE VIDÉO (P2S, P2R point 9) : par réseau, les vues, les visites venues du lien et le code de version.
 * Jamais de personne : aucun prospect, aucune demande. État vide : « Pas encore de relevé ». PUR : reçoit les lignes.
 */
import { Carte } from "@/components/ui/Carte";
import type { ReseauCas } from "@/formats/cas-concret";
import type { LigneSuivi } from "@/services/cas-concret-suivi";

export const PHRASE_SANS_RELEVE = "Pas encore de relevé";

const NOM_RESEAU: Readonly<Record<ReseauCas, string>> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" };

/** Une ligne compte quand le site ou la publication a donné un chiffre. */
export const PHRASE_LIEN_PARTAGE = "Ancien lien commun à plusieurs vidéos : ses visites ne sont pas comptées.";

export const ligneReleve = (l: LigneSuivi): boolean => l.mesure || typeof l.vues === "number" || !!l.liensPartages;

export function Releves({ lignes }: { lignes: readonly LigneSuivi[] }) {
  const relevees = lignes.filter(ligneReleve);
  return (
    <Carte aria-label="Relevés">
      <h3 className="mb-2 text-sm font-semibold text-texte-doux">Relevés par réseau</h3>
      {relevees.length === 0 ? (
        <p className="text-[15px] text-texte-doux">{PHRASE_SANS_RELEVE}</p>
      ) : (
        <ul>
          {relevees.map((l) => (
            <li key={l.reseau} className="list-none space-y-1 border-t border-trait py-3 first:border-t-0 first:pt-0">
              <p className="text-[17px] font-semibold text-texte">{NOM_RESEAU[l.reseau]}</p>
              <p className="text-sm text-texte-doux">
                Vues : {typeof l.vues === "number" ? l.vues : "pas encore de mesure"} · Visites venues du lien : {l.mesure ? l.visites : "pas encore de mesure"}
              </p>
              {l.liensPartages ? <p className="text-sm text-texte-faible">{PHRASE_LIEN_PARTAGE}</p> : null}
              {l.codeSuivi && <p className="text-sm text-texte-faible">Code de version : {l.codeSuivi}</p>}
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}
