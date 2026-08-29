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
  /** El resultado nombraba a la entidad de pasada; el dato es de otra ficha. */
  mention?: true;
  source: ClaimSource;
};

export type RelationSummary = {
  type: string;
  /** Ausente cuando el cabo viene de introspección en vivo: Cala lista los
   *  tipos disponibles pero no cuántos hay hasta que se proyecta. */
  count?: number;
};

/**
 * Un solo vocabulario para todo lo que hay en el corcho. Una pista es la misma
 * ficha en su densidad mínima —retrato, nombre y tipo—; se vuelve completa al
 * abrirla. Antes había dos símbolos (chincheta y ficha) para la misma cosa, y
 * obligaba a aprender dos gramáticas.
 */
export type CardDensity = "lead" | "full";

export type NarrativeStory = {
  question: string;
  title: string;
  answer: string;
  because: string;
  beat: "problema" | "causa" | "mecanismo" | "consecuencia" | "tensión";
  nextQuestion?: string;
  confidence: number;
  model: string;
  provider: "openai" | "pioneer";
  evidenceNames: string[];
};

export type EntityCard = {
  id: string;
  name: string;
  entityType: string;
  category?: string;
  position: Point;
  claims: Claim[];
  relations: RelationSummary[];
  density: CardDensity;
  /** De qué ficha y por qué hilo salió esta pista. */
  parentId?: string;
  relationType?: string;
  /** Pistas del mismo tirón comparten mazo y se apilan hasta que lo abrís. */
  stackId?: string;
  /** Respuesta causal redactada por el modelo únicamente desde evidencia Cala. */
  story?: NarrativeStory;
};

export type Edge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  /** Pregunta que abrió esta continuación, si el hilo nació de un borrador. */
  question?: string;
  source?: ClaimSource;
};

export type CaseNode = {
  id: string;
  title: string;
  query: string;
  position: Point;
  /** Se rellena cuando el tablón encuentra algo: la pregunta pasa a respuesta. */
  finding?: string;
};

export type ResearchCase = {
  id: string;
  title: string;
  focus: CaseNode;
  cards: EntityCard[];
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
  caseView?: CaseView;
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

/** Borrador de siguiente pregunta evaluado por Pioneer. */
export type PotentialQuestion = {
  nodeId: string;
  worthwhile: boolean;
  question?: string;
  rationale: string;
  score: number;
  source: "openai" | "pioneer" | "disk";
  provider?: "openai" | "pioneer";
  model: string;
};

export type StoryAnswer = NarrativeStory & {
  source: "openai" | "pioneer" | "disk";
};

/** Lo que un agente decide sobre un caso. Ver `scripts/case-agent.md`. */
export type CaseManifest = {
  version: number;
  query: string;
  slug: string;
  generatedAt: string;
  question: string;
  subtitle: string;
  openVerb: { relation: string; label: string; noun: string };
  ring: Array<{ id: string; name: string; role: string; subtitle: string }>;
  headline?: { bridge: string; why: string };
  bridges: Array<{ name: string; id: string | null; holders: string[]; verified: boolean }>;
  cover: Array<{ label: string; fields: string[]; fallback: string }>;
  back: { fields: string[]; hint: string };
  nouns: Array<{ type: string; noun: string }>;
  finding: { template: string; toast: string };
  notes: string;
};

export type CaseView = Pick<CaseManifest, "query" | "openVerb" | "cover" | "back" | "nouns" | "finding">;
