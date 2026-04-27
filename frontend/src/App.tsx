import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Plus, RefreshCw, Zap, AlertTriangle, CheckCircle,
  Clock, Tag, ChevronRight, X, Cpu, Shield, Bug, Server,
  BarChart3, Sparkles, Copy, Check, Trash2, ExternalLink,
  Activity, TrendingUp, Layers
} from 'lucide-react';
import type { Ticket, AnalyzeResponse, Analytics } from './types';
import { api } from './utils/api';
import { useToast } from './hooks/useToast';
import './App.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  high: { label: 'HIGH', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', glow: '0 0 12px rgba(239,68,68,0.3)' },
  medium: { label: 'MEDIUM', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', glow: '0 0 12px rgba(245,158,11,0.3)' },
  low: { label: 'LOW', color: '#10b981', bg: 'rgba(16,185,129,0.12)', glow: '0 0 12px rgba(16,185,129,0.3)' },
};

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: '#6366f1', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: '#f59e0b', icon: Zap },
  RESOLVED: { label: 'Resolved', color: '#10b981', icon: CheckCircle },
};

const CATEGORY_ICONS = {
  bug: Bug,
  infrastructure: Server,
  access: Shield,
  other: Layers,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden'
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 2, transition: 'width 0.8s ease',
          boxShadow: `0 0 8px ${color}80`
        }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: 'Space Mono', minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

// ── Toast Container ───────────────────────────────────────────────────────────

function ToastContainer({ toasts, remove }: { toasts: any[]; remove: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast" style={{
          background: t.type === 'error' ? 'rgba(239,68,68,0.15)' :
                      t.type === 'success' ? 'rgba(16,185,129,0.15)' :
                      t.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${t.type === 'error' ? '#ef444440' : t.type === 'success' ? '#10b98140' : t.type === 'warning' ? '#f59e0b40' : '#6366f140'}`,
          borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(20px)', color: '#e2e8f0', fontSize: 13, maxWidth: 340,
          animation: 'slideIn 0.3s ease',
        }}>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Analysis Modal ────────────────────────────────────────────────────────────

function AnalysisModal({ data, onClose, tickets }: { data: AnalyzeResponse; onClose: () => void; tickets: Ticket[] }) {
  const { ticket, analysis, similar_tickets } = data;
  const [copied, setCopied] = useState(false);
  const pri = PRIORITY_CONFIG[analysis.priority];
  const CatIcon = CATEGORY_ICONS[analysis.category] || Layers;

  const copyReply = () => {
    if (ticket.suggested_reply) {
      navigator.clipboard.writeText(ticket.suggested_reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>
                AI Analysis
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'Space Mono', marginTop: 2 }}>
                {analysis.model_used || 'gemini-1.5-flash'} · Ticket #{ticket.id}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#64748b' }}>
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
            {ticket.title}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: pri.bg, border: `1px solid ${pri.color}40`,
            borderRadius: 8, padding: '6px 12px',
            boxShadow: pri.glow,
          }}>
            <AlertTriangle size={13} color={pri.color} />
            <span style={{ fontSize: 11, fontWeight: 700, color: pri.color, fontFamily: 'Space Mono', letterSpacing: '0.05em' }}>
              {pri.label} PRIORITY
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8, padding: '6px 12px',
          }}>
            <CatIcon size={13} color="#6366f1" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', fontFamily: 'Space Mono', letterSpacing: '0.05em' }}>
              {analysis.category.toUpperCase()}
            </span>
          </div>
          {analysis.confidence != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', minWidth: 160 }}>
              <Cpu size={13} color="#94a3b8" />
              <ConfidenceBar value={analysis.confidence} />
            </div>
          )}
        </div>

        {/* Root Cause */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#6366f1', letterSpacing: '0.08em', marginBottom: 8 }}>
            ◆ ROOT CAUSE
          </div>
          <div style={{
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 10, padding: '14px 16px',
            fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, fontFamily: 'DM Sans',
          }}>
            {analysis.root_cause}
          </div>
        </div>

        {/* Solution */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#10b981', letterSpacing: '0.08em', marginBottom: 8 }}>
            ◆ RESOLUTION STEPS
          </div>
          <div style={{
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: 10, padding: '14px 16px',
            fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, fontFamily: 'DM Sans',
            whiteSpace: 'pre-wrap',
          }}>
            {analysis.solution}
          </div>
        </div>

        {/* Suggested Reply */}
        {ticket.suggested_reply && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#f59e0b', letterSpacing: '0.08em' }}>
                ◆ SUGGESTED REPLY
              </div>
              <button onClick={copyReply} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                color: '#f59e0b', fontSize: 11, fontFamily: 'Space Mono',
              }}>
                {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div style={{
              background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: 10, padding: '14px 16px',
              fontSize: 12, color: '#94a3b8', lineHeight: 1.8, fontFamily: 'DM Sans',
              maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {ticket.suggested_reply}
            </div>
          </div>
        )}

        {/* Similar Tickets */}
        {similar_tickets.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>
              ◆ SIMILAR TICKETS ({similar_tickets.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {similar_tickets.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#6366f1' }}>#{s.id}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#10b981' }}>
                      {Math.round(s.similarity_score * 100)}% match
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: `${STATUS_CONFIG[s.status].color}20`,
                      color: STATUS_CONFIG[s.status].color,
                      fontFamily: 'Space Mono',
                    }}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────

function AnalyticsPanel({ analytics }: { analytics: Analytics }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
      <div className="stat-card">
        <div style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#64748b', marginBottom: 6, letterSpacing: '0.05em' }}>TOTAL TICKETS</div>
        <div style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: '#6366f1' }}>{analytics.total_tickets}</div>
      </div>
      <div className="stat-card">
        <div style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#64748b', marginBottom: 6, letterSpacing: '0.05em' }}>AI CONFIDENCE</div>
        <div style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: '#10b981' }}>
          {analytics.avg_confidence != null ? `${Math.round(analytics.avg_confidence * 100)}%` : '—'}
        </div>
      </div>
      {Object.entries(analytics.by_status).map(([k, v]) => (
        <div key={k} className="stat-card" style={{ borderColor: `${STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.color || '#6366f1'}30` }}>
          <div style={{ fontSize: 10, fontFamily: 'Space Mono', color: '#64748b', marginBottom: 4 }}>{k}</div>
          <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, color: STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.color || '#6366f1' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket, onAnalyze, onDelete, onStatusChange, analyzing
}: {
  ticket: Ticket;
  onAnalyze: () => void;
  onDelete: () => void;
  onStatusChange: (s: string) => void;
  analyzing: boolean;
}) {
  const status = STATUS_CONFIG[ticket.status];
  const StatusIcon = status.icon;
  const pri = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null;
  const CatIcon = ticket.category ? (CATEGORY_ICONS[ticket.category] || Layers) : null;
  const isAnalyzed = !!ticket.analyzed_at;

  return (
    <div className="ticket-card" style={{ borderLeft: `2px solid ${pri?.color || '#6366f120'}` }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#6366f1' }}>#{ticket.id}</span>
            {pri && (
              <span style={{
                fontSize: 9, fontFamily: 'Space Mono', fontWeight: 700,
                color: pri.color, background: pri.bg,
                padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em'
              }}>
                {pri.label}
              </span>
            )}
            {CatIcon && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <CatIcon size={11} color="#64748b" />
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'Space Mono' }}>{ticket.category}</span>
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'Syne', fontWeight: 600, fontSize: 14, color: '#f1f5f9', lineHeight: 1.35 }}>
            {ticket.title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: `${status.color}15`, border: `1px solid ${status.color}30`,
            borderRadius: 6, padding: '3px 8px',
          }}>
            <StatusIcon size={11} color={status.color} />
            <span style={{ fontSize: 10, color: status.color, fontFamily: 'Space Mono' }}>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 12, fontFamily: 'DM Sans' }}>
        {ticket.description.length > 120 ? ticket.description.slice(0, 120) + '…' : ticket.description}
      </div>

      {/* AI confidence bar if analyzed */}
      {isAnalyzed && ticket.ai_confidence != null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'Space Mono', marginBottom: 4 }}>
            AI CONFIDENCE
          </div>
          <ConfidenceBar value={ticket.ai_confidence} />
        </div>
      )}

      {/* Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {ticket.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 4, padding: '2px 8px', color: '#818cf8', fontFamily: 'Space Mono',
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'Space Mono' }}>
          {timeAgo(ticket.created_at)}
          {isAnalyzed && <span style={{ color: '#10b981', marginLeft: 8 }}>· analyzed</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ticket.status !== 'RESOLVED' && (
            <select
              value={ticket.status}
              onChange={e => onStatusChange(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '4px 8px', color: '#94a3b8', fontSize: 10,
                cursor: 'pointer', fontFamily: 'Space Mono',
              }}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          )}
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: analyzing ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6, padding: '5px 10px', cursor: analyzing ? 'not-allowed' : 'pointer',
              color: '#818cf8', fontSize: 11, fontFamily: 'Space Mono',
              transition: 'all 0.2s',
            }}
          >
            {analyzing ? <><RefreshCw size={11} className="spin" /> Analyzing…</> : <><Sparkles size={11} /> Analyze</>}
          </button>
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#f87171',
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: (t: Ticket) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    try {
      const ticket = await api.createTicket({ title, description, tags });
      onCreated(ticket);
      setTitle(''); setDescription(''); setTags([]); setTagInput('');
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Plus size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>New Ticket</div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'DM Sans' }}>AI auto-analyzes on creation</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#64748b', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            TITLE
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Cannot access VPN from home office"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8, padding: '10px 14px',
              color: '#e2e8f0', fontSize: 13, fontFamily: 'DM Sans',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#64748b', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail — include error messages, steps to reproduce, and affected systems…"
            rows={5}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8, padding: '10px 14px',
              color: '#e2e8f0', fontSize: 13, fontFamily: 'DM Sans',
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
          />
        </div>

        {/* Tags */}
        <div>
          <label style={{ fontSize: 11, fontFamily: 'Space Mono', color: '#64748b', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            TAGS (OPTIONAL)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="vpn, authentication…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 8, padding: '8px 12px',
                color: '#e2e8f0', fontSize: 12, fontFamily: 'DM Sans', outline: 'none',
              }}
            />
            <button onClick={addTag} style={{
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#818cf8',
            }}>
              <Tag size={14} />
            </button>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 4, padding: '3px 8px', color: '#818cf8', fontFamily: 'Space Mono',
                }}>
                  #{tag}
                  <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0, display: 'flex' }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={loading || !title.trim() || !description.trim()}
          className="btn-primary"
        >
          {loading ? <><RefreshCw size={14} className="spin" /> Submitting…</> : <><Zap size={14} /> Submit Ticket</>}
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyzing, setAnalyzing] = useState<Record<number, boolean>>({});
  const [modalData, setModalData] = useState<AnalyzeResponse | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const loadTickets = useCallback(async () => {
    try {
      const data = await api.listTickets();
      setTickets(data);
    } catch (e: any) {
      addToast('Failed to load tickets: ' + e.message, 'error');
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadTickets();
    loadAnalytics();
    // Poll for background analysis updates
    const interval = setInterval(loadTickets, 8000);
    return () => clearInterval(interval);
  }, [loadTickets]);

  const handleCreated = (ticket: Ticket) => {
    setTickets(prev => [ticket, ...prev]);
    addToast(`Ticket #${ticket.id} created — AI analysis running…`, 'success');
    loadAnalytics();
  };

  const handleAnalyze = async (ticket: Ticket) => {
    setAnalyzing(prev => ({ ...prev, [ticket.id]: true }));
    try {
      const result = await api.analyzeTicket(ticket.id);
      setTickets(prev => prev.map(t => t.id === ticket.id ? result.ticket : t));
      setModalData(result);
      addToast('Analysis complete!', 'success');
      loadAnalytics();
    } catch (e: any) {
      addToast('Analysis failed: ' + e.message, 'error');
    } finally {
      setAnalyzing(prev => ({ ...prev, [ticket.id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteTicket(id);
      setTickets(prev => prev.filter(t => t.id !== id));
      addToast('Ticket deleted', 'info');
      loadAnalytics();
    } catch (e: any) {
      addToast('Delete failed: ' + e.message, 'error');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const updated = await api.updateStatus(id, status);
      setTickets(prev => prev.map(t => t.id === id ? updated : t));
      addToast(`Status updated to ${status}`, 'info');
    } catch (e: any) {
      addToast('Update failed: ' + e.message, 'error');
    }
  };

  const filtered = tickets.filter(t => filter === 'ALL' || t.status === filter);

  return (
    <div className="app">
      {/* Background */}
      <div className="bg-grid" />
      <div className="bg-glow" />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>
              <Bot size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                AI Service Desk
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'Space Mono' }}>
                powered by Gemini
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => { setShowAnalytics(!showAnalytics); loadAnalytics(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: showAnalytics ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showAnalytics ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#94a3b8',
                fontSize: 12, fontFamily: 'Space Mono', transition: 'all 0.2s',
              }}>
              <BarChart3 size={14} />
              Analytics
            </button>
            <button onClick={loadTickets}
              style={{
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '7px', cursor: 'pointer', color: '#64748b',
              }}>
              <RefreshCw size={14} />
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 8, padding: '6px 12px',
            }}>
              <Activity size={12} color="#10b981" />
              <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'Space Mono' }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="main">
        {/* Left column */}
        <div className="left-col">
          <CreateForm onCreated={handleCreated} />

          {/* Analytics panel */}
          {showAnalytics && analytics && (
            <div className="glass-panel" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TrendingUp size={16} color="#6366f1" />
                <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>Analytics</span>
              </div>
              <AnalyticsPanel analytics={analytics} />
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="right-col">
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  fontSize: 10, fontFamily: 'Space Mono', letterSpacing: '0.04em',
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  border: filter === f ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  background: filter === f ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                  color: filter === f ? '#818cf8' : '#475569',
                  transition: 'all 0.2s',
                }}>
                {f.replace('_', ' ')}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  {f === 'ALL' ? tickets.length : tickets.filter(t => t.status === f).length}
                </span>
              </button>
            ))}
          </div>

          {/* Ticket list */}
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 20px', color: '#475569', textAlign: 'center',
            }}>
              <Bot size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
              <div style={{ fontFamily: 'Syne', fontSize: 16, marginBottom: 6, color: '#64748b' }}>No tickets yet</div>
              <div style={{ fontSize: 12, fontFamily: 'DM Sans' }}>Create your first ticket to get started</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  analyzing={!!analyzing[ticket.id]}
                  onAnalyze={() => handleAnalyze(ticket)}
                  onDelete={() => handleDelete(ticket.id)}
                  onStatusChange={s => handleStatusChange(ticket.id, s)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Analysis Modal */}
      {modalData && (
        <AnalysisModal
          data={modalData}
          onClose={() => setModalData(null)}
          tickets={tickets}
        />
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} remove={removeToast} />
    </div>
  );
}
