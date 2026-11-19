import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Bell,
  Send,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Edit3,
  CheckCircle2,
  X,
  FileCode,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { Pagination } from '../../components/ui/pagination/Pagination';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { AppButton } from '../../components/ui/button/AppButton';
import { VisualEmailEditor } from '../../components/ui/editor/VisualEmailEditor';
import {
  useGetLogsQuery,
  useGetTemplatesQuery,
  useUpdateTemplateMutation,
  type NotificationLog,
  type NotificationTemplate,
} from '../../services/notificationsApi';

// ── Constants & Helpers ───────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const EVENT_TYPE_OPTIONS = [
  { label: 'All Event Types', value: 'ALL' },
  { label: 'Order Confirmation', value: 'order_confirmation' },
  { label: 'Order Shipped', value: 'order_shipped' },
  { label: 'Order Out for Delivery', value: 'order_out_for_delivery' },
  { label: 'Order Delivered', value: 'order_delivered' },
  { label: 'Order Cancelled', value: 'order_cancelled' },
  { label: 'Exchange Status Update', value: 'exchange_status_update' },
  { label: 'Welcome New User', value: 'welcome' },
  { label: 'Password Reset', value: 'password_reset' },
  { label: 'Email Verification', value: 'email_verification' },
];

const STATUS_FILTER_OPTIONS = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Delivered (Sent)', value: 'sent' },
  { label: 'Delivery Failed', value: 'failed' },
  { label: 'Retrying / Pending', value: 'retrying' },
];

const TYPE_NAME_MAP: Record<string, string> = {
  order_confirmation: 'Order Confirmation',
  order_shipped: 'Order Shipped',
  order_out_for_delivery: 'Out for Delivery',
  order_delivered: 'Order Delivered',
  order_cancelled: 'Order Cancelled',
  exchange_status_update: 'Exchange Update',
  welcome: 'Welcome Email',
  password_reset: 'Password Reset',
  email_verification: 'Email Verification',
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

function logStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'sent') {
    return {
      label: 'Sent',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    };
  }
  if (s === 'failed') {
    return {
      label: 'Failed',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertCircle,
    };
  }
  return {
    label: 'Retrying',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  };
}

// ── Toast Notification ────────────────────────────────────────────────────────
interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const Toast: React.FC<{ toast: ToastState | null; onClose: () => void }> = ({
  toast,
  onClose,
}) => {
  if (!toast) return null;
  return (
    <div
      role="alert"
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${toast.type === 'error'
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
    >
      {toast.type === 'error' ? (
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
      )}
      <span className="font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-700 ml-2 focus:outline-none"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ── Log Details Modal ─────────────────────────────────────────────────────────
interface LogDetailModalProps {
  log: NotificationLog | null;
  onClose: () => void;
}

const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, onClose }) => {
  if (!log) return null;
  const badge = logStatusBadge(log.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Notification Delivery Details</h2>
            <p className="text-xs text-slate-500 font-mono">ID: {log._id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-sm">
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Event Type</span>
              <span className="font-semibold text-slate-800 uppercase text-xs">
                {TYPE_NAME_MAP[log.type] || log.type}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Status</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.cls}`}
              >
                <badge.icon className="w-3 h-3" />
                {badge.label}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Attempts</span>
              <span className="font-bold text-slate-800">{log.attempts || 1}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Sent At</span>
              <span className="text-xs text-slate-600">{formatDate(log.createdAt)}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Recipient</span>
            <p className="font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              {log.recipient}
            </p>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Rendered Subject</span>
            <p className="font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              {log.subject || '—'}
            </p>
          </div>

          {log.error && (
            <div>
              <span className="text-xs font-semibold text-rose-600 block mb-1">Delivery Error</span>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                {log.error}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Human-Readable Variable Names Map ─────────────────────────────────────────
const VARIABLE_LABELS: Record<string, string> = {
  orderNumber: 'Order Number (#)',
  total: 'Total Amount (₹)',
  name: 'Customer Name',
  status: 'Exchange Status',
  exchangeId: 'Exchange ID',
  resetUrl: 'Password Reset Link',
  verifyUrl: 'Email Verification Link',
  storeUrl: 'Store Link',
};

// ── Edit Template Modal ───────────────────────────────────────────────────────
interface EditTemplateModalProps {
  template: NotificationTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = (props) =>
  props.template ? <EditTemplateModalContent {...props} template={props.template} /> : null;

const EditTemplateModalContent: React.FC<EditTemplateModalProps & { template: NotificationTemplate }> = ({
  template,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [subject, setSubject] = useState(template.subject);
  const [htmlBody, setHtmlBody] = useState(template.htmlBody || template.body || '');
  const [isActive, setIsActive] = useState(template.isActive !== false);
  const [editorMode, setEditorMode] = useState<'visual' | 'preview' | 'code'>('visual');
  const [error, setError] = useState<string | null>(null);

  const [updateTemplate, { isLoading }] = useUpdateTemplateMutation();

  const requiredPlaceholders = template.requiredPlaceholders || template.variables || [];

  // Check if all required placeholders exist in subject OR htmlBody
  const combinedText = subject + ' ' + htmlBody;
  const missingPlaceholders = requiredPlaceholders.filter(
    (p) => !combinedText.includes(`{{${p}}}`)
  );

  const availableVariables = requiredPlaceholders.map((p) => ({
    key: p,
    label: VARIABLE_LABELS[p] || p,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Subject line is required.');
      return;
    }

    if (!htmlBody.trim()) {
      setError('Email message body is required.');
      return;
    }

    if (missingPlaceholders.length > 0) {
      setError(
        `Please include the required variable(s): ${missingPlaceholders
          .map((p) => `"${VARIABLE_LABELS[p] || p}"`)
          .join(', ')}. Click the variable buttons above to add them to your email.`
      );
      return;
    }

    try {
      await updateTemplate({
        type: template.type,
        data: {
          subject: subject.trim(),
          htmlBody: htmlBody.trim(),
          requiredPlaceholders,
          isActive,
        },
      }).unwrap();

      showToast(`Template for ${TYPE_NAME_MAP[template.type] || template.type} updated successfully!`);
      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setError(
        apiErr?.data?.error?.message ||
        apiErr?.data?.message ||
        'Failed to update template. Please verify all placeholders.'
      );
    }
  };

  // Preview rendered with mockup customer data
  const renderedPreview = DOMPurify.sanitize(htmlBody
    .replace(/\{\{name\}\}/g, 'Priya Sharma')
    .replace(/\{\{orderNumber\}\}/g, 'MC-2026-0042')
    .replace(/\{\{total\}\}/g, '12,499')
    .replace(/\{\{status\}\}/g, 'Approved')
    .replace(/\{\{exchangeId\}\}/g, 'EX-8821')
    .replace(/\{\{resetUrl\}\}/g, 'https://madalsacouture.com/reset-password?token=sample')
    .replace(/\{\{verifyUrl\}\}/g, 'https://madalsacouture.com/verify-email-change?token=sample')
    .replace(/\{\{storeUrl\}\}/g, 'https://madalsacouture.com'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Customize Email: {TYPE_NAME_MAP[template.type] || template.type}
            </h2>
            <p className="text-xs text-slate-500">
              Easily edit the text and design of this automated customer email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject Line */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Email Subject Line *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Your Order #{{orderNumber}} is Confirmed!"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink"
              required
            />
          </div>

          {/* Active Status Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Automatic Sending</span>
              <span className="text-xs text-slate-500">
                Turn ON to automatically send this email whenever this event happens.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className="text-accent hover:opacity-80 transition flex items-center gap-2"
            >
              <span className="text-xs font-bold">{isActive ? 'ENABLED' : 'DISABLED'}</span>
              {isActive ? (
                <ToggleRight className="w-8 h-8 text-accent" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-300" />
              )}
            </button>
          </div>

          {/* Required Placeholders Checklist */}
          {requiredPlaceholders.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-accent" /> Required Information Checklist:
                </span>
                <span className="text-xs text-slate-500">Must be included in email</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {requiredPlaceholders.map((p) => {
                  const isPresent = combinedText.includes(`{{${p}}}`);
                  return (
                    <span
                      key={p}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${isPresent
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                    >
                      {isPresent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      {VARIABLE_LABELS[p] || p} {isPresent ? '✓' : '(Missing)'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Editor Mode Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Email Message Body *</label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setEditorMode('visual')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${editorMode === 'visual'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Visual Editor (Easy)
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${editorMode === 'preview'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Customer Inbox Preview
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('code')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${editorMode === 'code'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <FileCode className="w-3.5 h-3.5 inline mr-1" /> HTML Code
                </button>
              </div>
            </div>

            {/* Visual Editor */}
            {editorMode === 'visual' && (
              <VisualEmailEditor
                value={htmlBody}
                onChange={setHtmlBody}
                availableVariables={availableVariables}
                placeholder="Write your email here. Use the formatting buttons above for bold, headings, or lists."
              />
            )}

            {/* Customer Inbox Preview */}
            {editorMode === 'preview' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 space-y-3">
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="bg-ink px-6 py-4 text-center border-b border-amber-500/20">
                    <p className="text-accent text-sm font-semibold">
                      Madalsa Couture
                    </p>
                  </div>
                  <div className="p-6">
                    <p className="text-xs text-slate-400 mb-4 pb-2 border-b border-slate-100 font-sans">
                      Subject: <strong className="text-slate-800">{subject}</strong>
                    </p>
                    <div
                      className="prose prose-slate prose-sm max-w-none text-slate-800 font-sans leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderedPreview }}
                    />
                  </div>
                  <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center text-xs text-slate-400 font-sans">
                    © 2026 Madalsa Couture. All rights reserved.
                  </div>
                </div>
              </div>
            )}

            {/* Raw HTML Code Mode */}
            {editorMode === 'code' && (
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={10}
                placeholder="<p>Dear {{name}}, your order {{orderNumber}} is confirmed!</p>"
                className="w-full px-3.5 py-2.5 font-mono text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink bg-slate-900 text-slate-100"
                required
              />
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="md" isLoading={isLoading}>
              Save Email Template
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const Notifications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'logs' | 'templates'>('logs');

  // Logs filters and pagination
  const [logPage, setLogPage] = useState<number>(1);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [recipientSearch, setRecipientSearch] = useState<string>('');

  const [inspectLog, setInspectLog] = useState<NotificationLog | null>(null);
  const [editTemplate, setEditTemplate] = useState<NotificationTemplate | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Queries
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    isFetching: isFetchingLogs,
    refetch: refetchLogs,
  } = useGetLogsQuery({
    page: logPage,
    limit: PAGE_SIZE,
    type: eventTypeFilter !== 'ALL' ? eventTypeFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    recipient: recipientSearch.trim() || undefined,
  });

  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    refetch: refetchTemplates,
  } = useGetTemplatesQuery();

  const logs = logsData?.logs ?? [];
  const totalLogs = logsData?.pagination?.total ?? 0;

  // Stats
  const sentLogsCount = logs.filter((l) => l.status === 'sent').length;
  const failedLogsCount = logs.filter((l) => l.status === 'failed').length;
  const retryingLogsCount = logs.filter((l) => l.status === 'retrying').length;

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Modals */}
      <LogDetailModal log={inspectLog} onClose={() => setInspectLog(null)} />
      <EditTemplateModal
        template={editTemplate}
        onClose={() => setEditTemplate(null)}
        onSuccess={() => {
          setEditTemplate(null);
          refetchTemplates();
        }}
        showToast={(msg, type) => setToast({ message: msg, type: type || 'success' })}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notification Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor transactional email dispatch logs and configure automated email templates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'logs') refetchLogs();
              else refetchTemplates();
            }}
            isLoading={isFetchingLogs && !isLoadingLogs}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </AppButton>
        </div>
      </div>

      {/* Tab Navigation Toggle */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${activeTab === 'logs'
              ? 'bg-ink text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <Send className="w-4 h-4" /> Outbound Delivery Logs ({totalLogs})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${activeTab === 'templates'
              ? 'bg-ink text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <FileCode className="w-4 h-4" /> Email Templates ({templates.length})
        </button>
      </div>

      {/* ── TAB 1: OUTBOUND DELIVERY LOGS ── */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Dispatches"
              value={totalLogs.toLocaleString()}
              changePercentage={0}
              changeText="all logged emails"
              icon={Bell}
              iconBgColor="bg-slate-100"
              iconColor="text-slate-600"
            />
            <StatsCard
              title="Delivered (this page)"
              value={sentLogsCount.toLocaleString()}
              changePercentage={0}
              changeText="delivered to inbox"
              icon={CheckCircle2}
              iconBgColor="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <StatsCard
              title="Failures (this page)"
              value={failedLogsCount.toLocaleString()}
              changePercentage={0}
              changeText="failed after retries"
              icon={AlertCircle}
              iconBgColor="bg-rose-50"
              iconColor="text-rose-600"
            />
            <StatsCard
              title="Retrying (this page)"
              value={retryingLogsCount.toLocaleString()}
              changePercentage={0}
              changeText="retry queue"
              icon={Clock}
              iconBgColor="bg-amber-50"
              iconColor="text-amber-600"
            />
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-wrap">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => {
                    setRecipientSearch(e.target.value);
                    setLogPage(1);
                  }}
                  placeholder="Search recipient email..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition"
                />
              </div>

              {/* Event Type Filter */}
              <div className="w-full sm:w-60">
                <AppDropdown
                  options={EVENT_TYPE_OPTIONS}
                  value={eventTypeFilter}
                  onChange={(v) => {
                    setEventTypeFilter(String(v));
                    setLogPage(1);
                  }}
                />
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <AppDropdown
                  options={STATUS_FILTER_OPTIONS}
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(String(v));
                    setLogPage(1);
                  }}
                />
              </div>
            </div>

            {(recipientSearch || eventTypeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setRecipientSearch('');
                  setEventTypeFilter('ALL');
                  setStatusFilter('ALL');
                  setLogPage(1);
                }}
                className="text-xs text-accent hover:underline font-semibold self-end lg:self-center"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-4">Subject Line</th>
                    <th className="py-4 px-4">Event Type</th>
                    <th className="py-4 px-4">Recipient</th>
                    <th className="py-4 px-4">Sent At</th>
                    <th className="py-4 px-4 text-center">Attempts</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                          <span className="text-sm">Loading delivery logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Bell className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-slate-700">No notification logs found</p>
                          <p className="text-xs text-slate-400">
                            Dispatched emails will automatically be recorded here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const badge = logStatusBadge(log.status);

                      return (
                        <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Subject */}
                          <td className="py-4 px-4 max-w-xs">
                            <span className="font-semibold text-slate-900 truncate block">
                              {log.subject || '—'}
                            </span>
                          </td>

                          {/* Event Type */}
                          <td className="py-4 px-4">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                              {TYPE_NAME_MAP[log.type] || log.type}
                            </span>
                          </td>

                          {/* Recipient */}
                          <td className="py-4 px-4 text-xs font-medium text-slate-800">
                            {log.recipient}
                          </td>

                          {/* Sent At */}
                          <td className="py-4 px-4 text-xs text-slate-500">
                            {formatDate(log.createdAt)}
                          </td>

                          {/* Attempts */}
                          <td className="py-4 px-4 text-center font-bold text-xs text-slate-700">
                            {log.attempts || 1}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}
                            >
                              <badge.icon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-4 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setInspectLog(log)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-pink-50 transition"
                              title="Inspect Delivery Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Pagination
                currentPage={logPage}
                totalItems={totalLogs}
                pageSize={PAGE_SIZE}
                onPageChange={setLogPage}
                itemLabel="logs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EMAIL TEMPLATES MANAGEMENT ── */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {isLoadingTemplates ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
              <p className="text-xs">Loading email templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <FileCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No email templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map((tpl) => {
                const placeholders = tpl.requiredPlaceholders || tpl.variables || [];
                return (
                  <div
                    key={tpl.type}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-ink/40 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-accent">
                          {TYPE_NAME_MAP[tpl.type] || tpl.type}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tpl.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {tpl.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1">
                        {tpl.subject}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {(tpl.htmlBody || tpl.body || '').replace(/<[^>]*>?/gm, '')}
                      </p>

                      {placeholders.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {placeholders.map((p) => (
                            <span
                              key={p}
                              className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              {'{{' + p + '}}'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {tpl.updatedAt ? `Updated ${formatDate(tpl.updatedAt)}` : 'Default Template'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditTemplate(tpl)}
                        className="px-3 py-1.5 rounded-xl bg-pink-50 text-accent text-xs font-semibold hover:bg-pink-100 transition flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
