export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type TicketCategory = 'bug' | 'infrastructure' | 'access' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  tags: string[];
  root_cause: string | null;
  solution: string | null;
  suggested_reply: string | null;
  ai_confidence: number | null;
  analysis_model: string | null;
  similar_ticket_ids: number[];
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
}

export interface AIAnalysis {
  category: TicketCategory;
  priority: TicketPriority;
  root_cause: string;
  solution: string;
  confidence: number | null;
  model_used: string | null;
}

export interface SimilarTicket {
  id: number;
  title: string;
  similarity_score: number;
  status: TicketStatus;
}

export interface AnalyzeResponse {
  ticket: Ticket;
  analysis: AIAnalysis;
  similar_tickets: SimilarTicket[];
}

export interface Analytics {
  total_tickets: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  avg_confidence: number | null;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  tags: string[];
}
