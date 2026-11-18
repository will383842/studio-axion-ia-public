/**
 * C9-32a — Émojis plats Fluent (Microsoft, licence MIT, preuve : docs/droits/emojis.md), style « Flat » seulement.
 * PUR. ÉTEINT : rien n'appelle `emojiPermis` ; aucun visage, main ni personne ; aucune police d'émojis du système.
 */
export const EMOJIS_FLUENT: readonly { id: string; fichier: string; nom: string }[] = [
  { id: "alarm_clock", fichier: "svg/alarm_clock.svg", nom: "Alarm clock" },
  { id: "bar_chart", fichier: "svg/bar_chart.svg", nom: "Bar chart" },
  { id: "bell", fichier: "svg/bell.svg", nom: "Bell" },
  { id: "books", fichier: "svg/books.svg", nom: "Books" },
  { id: "bullseye", fichier: "svg/bullseye.svg", nom: "Bullseye" },
  { id: "calendar", fichier: "svg/calendar.svg", nom: "Calendar" },
  { id: "check_mark_button", fichier: "svg/check_mark_button.svg", nom: "Check mark button" },
  { id: "cross_mark", fichier: "svg/cross_mark.svg", nom: "Cross mark" },
  { id: "envelope", fichier: "svg/envelope.svg", nom: "Envelope" },
  { id: "file_folder", fichier: "svg/file_folder.svg", nom: "File folder" },
  { id: "gear", fichier: "svg/gear.svg", nom: "Gear" },
  { id: "high_voltage", fichier: "svg/high_voltage.svg", nom: "High voltage" },
  { id: "hourglass_done", fichier: "svg/hourglass_done.svg", nom: "Hourglass done" },
  { id: "key", fichier: "svg/key.svg", nom: "Key" },
  { id: "laptop", fichier: "svg/laptop.svg", nom: "Laptop" },
  { id: "light_bulb", fichier: "svg/light_bulb.svg", nom: "Light bulb" },
  { id: "link", fichier: "svg/link.svg", nom: "Link" },
  { id: "locked", fichier: "svg/locked.svg", nom: "Locked" },
  { id: "magnifying_glass_tilted_left", fichier: "svg/magnifying_glass_tilted_left.svg", nom: "Magnifying glass tilted left" },
  { id: "megaphone", fichier: "svg/megaphone.svg", nom: "Megaphone" },
  { id: "mobile_phone", fichier: "svg/mobile_phone.svg", nom: "Mobile phone" },
  { id: "pencil", fichier: "svg/pencil.svg", nom: "Pencil" },
  { id: "pushpin", fichier: "svg/pushpin.svg", nom: "Pushpin" },
  { id: "puzzle_piece", fichier: "svg/puzzle_piece.svg", nom: "Puzzle piece" },
  { id: "rocket", fichier: "svg/rocket.svg", nom: "Rocket" },
  { id: "star", fichier: "svg/star.svg", nom: "Star" },
  { id: "triangular_flag", fichier: "svg/triangular_flag.svg", nom: "Triangular flag" },
  { id: "trophy", fichier: "svg/trophy.svg", nom: "Trophy" },
  { id: "wrapped_gift", fichier: "svg/wrapped_gift.svg", nom: "Wrapped gift" },
];

/** Interrupteur : éteint tant que Williams n'a pas vu la planche. */
export const EMOJIS_ACTIFS = false;

/** Vrai seulement si l'interrupteur est allumé ET que l'id est dans la liste. */
export function emojiPermis(id: string, actif = EMOJIS_ACTIFS): boolean {
  if (actif !== true) return false;
  return EMOJIS_FLUENT.some((e) => e.id === id);
}
