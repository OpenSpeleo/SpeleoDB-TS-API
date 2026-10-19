/** Exclude only obsolete SpeleoDB API v1 routes, never authentication's v1. */
export function sdkDocument(document) {
  return {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths ?? {}).filter(
        ([path]) => path !== "/api/v1" && !path.startsWith("/api/v1/"),
      ),
    ),
  };
}
