export type EntityStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface EntityEnvelope {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PageMeta {
  cursor: string | null;
  limit: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}
