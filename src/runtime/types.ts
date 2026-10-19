export type ApiBodyKind = "json" | "text" | "blob";

export interface ApiResponseMetadata {
  content: Record<string, ApiBodyKind>;
}

/** Generated from the same OpenAPI document as the operation functions. */
export interface ApiOperationMetadata {
  operationId: string;
  responses: Record<string, ApiResponseMetadata>;
}

export interface ApiUploadProgress {
  loaded: number;
  total?: number;
  lengthComputable: boolean;
}

export interface ApiTransportRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: BodyInit | null;
  signal: AbortSignal;
  /** Remaining overall deadline, including preparation; null disables the deadline. */
  timeoutMs: number | null;
  operation: ApiOperationMetadata;
  credentials?: RequestCredentials;
  redirect?: RequestRedirect;
  responsePolicy?: "default" | "status-first-json";
  cookiePolicy?: "omit";
  onUploadProgress?: (progress: ApiUploadProgress) => void;
  onUploadComplete?: () => void;
}

export interface ApiTransportResponse {
  status: number;
  data: unknown;
  headers: Headers;
  /** A transport preserved HTTP status without obtaining the declared body. */
  unexpected?: boolean;
}

export type ApiTransport = (
  request: ApiTransportRequest,
) => Promise<ApiTransportResponse>;

export interface ApiClientOptions {
  baseUrl: string;
  transport?: ApiTransport;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** Defaults to 10 seconds. null disables the deadline but retains cancellation. */
  timeoutMs?: number | null;
  credentials?: RequestCredentials;
}

export interface ApiClient {
  readonly baseUrl: string;
  readonly transport: ApiTransport;
  readonly headers: ApiClientOptions["headers"];
  readonly timeoutMs: number | null;
  readonly credentials: RequestCredentials | undefined;
}

export type ApiRequestOptions = Pick<
  RequestInit,
  "method" | "headers" | "credentials" | "redirect"
> & {
  /** Orval emits explicit undefined for optional bodies; transport omits them. */
  body?: BodyInit | null | undefined;
  client?: ApiClient;
  signal?: AbortSignal | null;
  /** Overrides the client deadline; null explicitly disables it. */
  timeoutMs?: number | null;
  /** Supplied by generated code; consumers should not override this metadata. */
  operation?: ApiOperationMetadata;
  responsePolicy?: "default" | "status-first-json";
  cookiePolicy?: "omit";
  onUploadProgress?: (progress: ApiUploadProgress) => void;
  onUploadComplete?: () => void;
};

export interface ApiUnexpectedResponse extends ApiTransportResponse {
  kind: "unexpected";
}

export type ApiResponse<T extends ApiTransportResponse = ApiTransportResponse> =
  (T & { kind: "documented" }) | ApiUnexpectedResponse;
