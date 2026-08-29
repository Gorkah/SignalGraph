export type SelectorMode = "description" | "money" | "city" | "latest";

export type Point = { x: number; y: number };

export type ClaimSource = {
  label: string;
  query: string;
  file: string;
  runAt: string;
  url?: string;
};

export type Claim = {
  key: string;
  label: string;
  value: string;
  date?: string;
  source: ClaimSource;
};

export type RelationSummary = {
  type: string;
  count: number;
};

export type EntityCard = {
  id: string;
  name: string;
  entityType: string;
  category?: string;
  position: Point;
  claims: Claim[];
  relations: RelationSummary[];
};

export type Pin = {
  id: string;
  name: string;
  entityType: string;
  category?: string;
  position: Point;
  parentId: string;
  relationType: string;
  claims?: Claim[];
};

export type Edge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  source?: ClaimSource;
};

export type CaseNode = {
  id: string;
  title: string;
  query: string;
  position: Point;
};

export type ResearchCase = {
  id: string;
  title: string;
  focus: CaseNode;
  cards: EntityCard[];
  pins: Pin[];
  edges: Edge[];
};

export type DossierCandidate = {
  id?: string;
  name: string;
  entityType?: string;
  category?: string;
  claims: Claim[];
};

export type Dossier = {
  id: string;
  query: string;
  title: string;
  deliveredAt: string;
  source: "live" | "disk" | "fallback";
  candidates: DossierCandidate[];
};

export type InboxReceipt = {
  id: string;
  query: string;
  startedAt: number;
  state: "pending" | "arrived" | "failed";
  dossier?: Dossier;
  error?: string;
};

export type SeedPayload = {
  researchCase: ResearchCase;
  fallbackDossier: Dossier;
  defaultReportQuery: string;
};

export type CalaEntity = {
  id: string;
  name: string;
  entity_type: string;
  mentions: string[];
};

export type CalaResult = Record<string, string | number | null>;

export type CalaQueryDump = {
  input: string;
  runAt: string;
  ok: boolean;
  status: number;
  ms?: number;
  attempt?: number;
  data?: {
    results?: CalaResult[];
    entities?: CalaEntity[];
  };
  error?: string;
};

export type ProjectionEntity = {
  id: string;
  name: string;
  entityType: string;
  category?: string;
  claims: Claim[];
};

export type ProjectionResponse = {
  entityId: string;
  relationType: string;
  source: "disk" | "live" | "local-evidence";
  entities: ProjectionEntity[];
};

export type IntrospectionResponse = {
  entity: ProjectionEntity;
  relations: RelationSummary[];
  source: "disk" | "live" | "local-evidence";
};

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "SATURATED"
  | "UPSTREAM_ERROR"
  | "TIMEOUT";

export type ApiErrorResponse = {
  error: string;
  code: ApiErrorCode;
};
