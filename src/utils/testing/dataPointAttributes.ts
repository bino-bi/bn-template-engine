const ATTRIBUTES = [
  "data-bn-row-group",
  "data-bn-category",
  "data-bn-sub-category",
  "data-bn-date",
  "data-bn-scenario",
  "data-bn-row",
  "data-bn-part",
];

/**
 * Drops the data-point keys below a host, for the golden markup of a table:
 * it shows that nothing else changed. The keys have specs of their own.
 */
export function withoutDataPointAttributes<T extends Element>(host: T): T {
  host.shadowRoot?.querySelectorAll("tr, td").forEach((element) => {
    ATTRIBUTES.forEach((attribute) => element.removeAttribute(attribute));
  });
  return host;
}
