/** Web-native equivalent of Orval's generic union multipart serializer. */
export function unionFormData(
  body?: object,
  nullAsEmpty: readonly string[] = [],
): FormData {
  const form = new FormData();
  function append(name: string, value: unknown, item = false): void {
    if (value === undefined) return;
    if (value === null) {
      if (item || !nullAsEmpty.includes(name))
        throw new TypeError(
          `Field ${name} cannot represent null in a form request.`,
        );
      form.append(name, "");
      return;
    }
    if (value instanceof Blob) form.append(name, value);
    else if (Array.isArray(value))
      value.forEach((value: unknown) => append(name, value, true));
    else
      form.append(
        name,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
  }
  for (const [name, value] of Object.entries(body ?? {})) append(name, value);
  return form;
}

/** Encode nested JSON fields and primitive unions without dropping numbers. */
export function unionUrlEncoded(
  body?: object,
  nullAsEmpty: readonly string[] = [],
): URLSearchParams {
  const form = new URLSearchParams();
  function append(name: string, value: unknown, item = false): void {
    if (value === undefined) return;
    if (value === null) {
      if (item || !nullAsEmpty.includes(name))
        throw new TypeError(
          `Field ${name} cannot represent null in a form request.`,
        );
      form.append(name, "");
      return;
    }
    if (value instanceof Blob)
      throw new TypeError("Files require multipart/form-data.");
    if (Array.isArray(value))
      value.forEach((value: unknown) => append(name, value, true));
    else
      form.append(
        name,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
  }
  for (const [name, value] of Object.entries(body ?? {})) append(name, value);
  return form;
}
