import type { Ticket, AnalyzeResponse, Analytics, CreateTicketPayload } from '../types';

const BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  createTicket: (payload: CreateTicketPayload) =>
    request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(payload) }),

  listTickets: (params?: { status?: string; priority?: string; category?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.fromEntries(
          Object.entries(params).filter(([, v]) => v)
        )).toString()
      : '';
    return request<Ticket[]>(`/tickets${qs}`);
  },

  getTicket: (id: number) => request<Ticket>(`/tickets/${id}`),

  analyzeTicket: (id: number) =>
    request<AnalyzeResponse>(`/tickets/${id}/analyze`, { method: 'POST' }),

  updateStatus: (id: number, status: string) =>
    request<Ticket>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteTicket: (id: number) =>
    fetch(`${BASE}/tickets/${id}`, { method: 'DELETE' }),

  getAnalytics: () => request<Analytics>('/analytics'),
};
