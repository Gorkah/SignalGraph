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
  /** Se rellena cuando el tablón encuentra algo: la pregunta pasa a respuesta. */
  finding?: string;
};

export type QuestionLane = "archive" | "web";

export type QuestionNode = {
  id: string;
  prompt: string;
  lane: QuestionLane;
  position: Point;
  state: "open" | "answered";
  /** El carril de archivo tira de una entidad real y una relación real. */
  target?: {
    id: string;
    name: string;
    entityType: string;
    relation: string;
    preferred: string[];
  };
  answer: {
    title: string;
    body: string;
    sourceLabel: string;
    sourceUrl?: string;
    asOf?: string;
  };
};

export type ResearchCase = {
  id: string;
  title: string;
  focus: CaseNode;
  cards: EntityCard[];
  edges: Edge[];
  questions: QuestionNode[];
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

/** Lo que un agente decide sobre un caso. Ver `scripts/case-agent.md`. */
export type CaseManifest = {
  version: number;
  query: string;
  slug: string;
  generatedAt: string;
  question: string;
  subtitle: string;
  openVerb: { relation: string; label: string; noun: string; hidden?: boolean };
  ring: Array<{ id: string; name: string; role: string; subtitle: string }>;
  headline?: { bridge: string; why: string };
  bridges: Array<{ name: string; id: string | null; holders: string[]; verified: boolean }>;
  cover: Array<{ label: string; fields: string[]; fallback: string }>;
  back: { fields: string[]; hint: string };
  nouns: Array<{ type: string; noun: string }>;
  finding: { template: string; toast: string };
  /**
   * El relato que hace comprensible el caso sin un narrador al lado. Todo el
   * contenido depende del manifiesto: la interfaz no presupone un sector, una
   * geografía ni siquiera que el hallazgo sea una empresa.
   */
  story?: {
    restartOnLoad?: boolean;
    label?: string;
    questionLabel?: string;
    scope: string;
    answer: { label?: string; headline: string; body: string };
    facts?: Array<{
      value?: string;
      label: string;
      detail?: string;
      sourceLabel: string;
      sourceUrl?: string;
      asOf?: string;
    }>;
    actors?: { label?: string; title: string; body: string };
    limitationLabel?: string;
    limitation?: string;
    action: {
      label: string;
      body: string;
      entityId?: string;
      relationType?: string;
      pendingLabel?: string;
      revealedLabel?: string;
    };
    reveal?: {
      headline: string;
      body: string;
      sourceLabel: string;
      sourceUrl?: string;
      asOf?: string;
    };
    nextLabel?: string;
    nextQuestion?: string;
  };
  /** Vocabulario de la escena. Los defaults son neutrales y solo sirven para
   * manifiestos antiguos; un caso puede renombrar toda la gramática visible. */
  ui?: {
    caseOpen?: string;
    caseFinding?: string;
    cards?: string;
    leads?: string;
    connections?: string;
    connection?: string;
    noConnections?: string;
    showConnections?: string;
    hideConnections?: string;
    foundConnection?: string;
    openLead?: string;
    lead?: string;
    details?: string;
    front?: string;
    moreConnections?: string;
    collectConnections?: string;
    archiveQuestion?: string;
    externalQuestion?: string;
    askArchive?: string;
    askExternal?: string;
    archivePanel?: string;
  };
  /** El veredicto que se lee al final, cuando el caso ya tiene hallazgos. */
  closing?: string;
  questions?: Array<{
    id: string;
    prompt: string;
    lane: QuestionLane;
    target?: {
      id: string;
      name: string;
      entityType: string;
      relation: string;
      preferred: string[];
    };
    answer: {
      title: string;
      body: string;
      sourceLabel: string;
      sourceUrl?: string;
      asOf?: string;
    };
  }>;
  notes: string;
};

/** Lo que el cliente necesita para pintar la investigación y su relato. */
export type CaseView = Pick<
  CaseManifest,
  "query" | "openVerb" | "cover" | "back" | "nouns" | "finding" | "story" | "ui"
>;
