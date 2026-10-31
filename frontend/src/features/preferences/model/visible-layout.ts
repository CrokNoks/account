/**
 * Ne garde de la disposition enregistrée que les widgets connus : un widget
 * retiré du catalogue (ex. `insights`) disparaît sans toucher à l'ordre, la
 * largeur et la visibilité des autres.
 */
export function visibleLayout<T extends { id: string }>(saved: T[], knownIds: string[]): T[] {
  return saved.filter((w) => knownIds.includes(w.id));
}
