/**
 * What the panels of an XY chart report on the names of `labels.points`.
 * A name is unknown when no panel has it: one panel of a facet grid may well miss a name.
 */
export class LabelReport {
  private unknown: Set<string> | null = null;
  private readonly dropped: string[] = [];

  /**
   * @param unknownNames - names of the list that this panel does not have
   * @param droppedNames - names of this panel that found no place
   * @param panel - facet key of the panel, empty without facets
   */
  public addPanel(unknownNames: string[], droppedNames: string[], panel: string): void {
    const known = this.unknown;
    this.unknown = new Set(known === null ? unknownNames : unknownNames.filter((name) => known.has(name)));
    for (const name of droppedNames) {
      this.dropped.push(panel === "" ? name : `${name} (${panel})`);
    }
  }

  public unknownNames(): string[] {
    return [...(this.unknown ?? [])];
  }

  public droppedNames(): string[] {
    return this.dropped;
  }
}
