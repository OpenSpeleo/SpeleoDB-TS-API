import type { ApiOperationMetadata } from "../src/runtime/types";

export function operationOverrides(document: unknown): Record<
  string,
  {
    requestOptions: { operation: ApiOperationMetadata };
    formData?: { path: string; name: string };
    formUrlEncoded?: { path: string; name: string };
  }
>;

export function formMutators(document: unknown): string;
