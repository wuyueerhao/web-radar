import { useEffect, useRef, useState, type ReactNode } from 'react';
import { privateAsset } from './api';
import type { ServiceStatus } from '../shared/model';

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <Mark />
      <span className="brand-wordmark">Web Radar</span>
    </span>
  );
}
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    users: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></>,
    tag: <><path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r=".5"/></>,
    chart: <><path d="M4 3v17h17M8 15l4-5 4 2 5-7"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9 3-.7 2.6-2.6.7L3 9l1.9 2v2L3 15l2.7 2.7 2.6.7L9 21h6l.7-2.6 2.6-.7L21 15l-1.9-2v-2L21 9l-2.7-2.7-2.6-.7L15 3Z" />
      </>
    ),
    message: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10.5a9.5 9.5 0 1 1 19 0Z" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    play: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8 6 4-6 4Z" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1" />
        <path d="m3 17 5-5 4 4 4-7 5 8" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="m4 15-1 6 6-1L21 8l-5-5L4 15Z" />
        <path d="m13 6 5 5" />
      </>
    ),
    folder: <path d="M3 7V4h6l3 3h9v13H3V7Z" />,
    down: <path d="m6 9 6 6 6-6" />,
    up: <path d="m6 15 6-6 6 6" />,
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H3v16h6m4-4 4-4-4-4m-5 4h13" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      </>
    ),
    palette: (
      <>
        <circle cx="13.5" cy="6.5" r="1" />
        <circle cx="17.5" cy="10.5" r="1" />
        <circle cx="8.5" cy="7.5" r="1" />
        <circle cx="6.5" cy="12.5" r="1" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.4-.4-.8-.4-1.2 0-.9.8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.3-10-9.3Z" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
      </>
    ),
    alert: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4m0 4h.01" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
export function Button({
  children,
  kind = 'secondary',
  busy = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      className={`button ${kind} ${className}`}
    >
      {busy && <span className="spinner" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  hint,
  children,
  required = false,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && <em>必填</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="title-actions">{actions}</div>}
    </div>
  );
}
export function Empty({
  icon = 'folder',
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={27} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'error' | 'success' | 'warning';
}) {
  return (
    <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const before = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      before?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <Button kind="quiet" onClick={onClose} aria-label="关闭">
            <Icon name="close" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AssetView({
  projectId,
  assetId,
  video = false,
  className = '',
  alt = '产品图片',
  onUrl,
  variant = 'original',
  lazy = false,
  onOpen,
  fallback,
}: {
  projectId: string;
  assetId?: string;
  video?: boolean;
  className?: string;
  alt?: string;
  onUrl?: (url: string) => void;
  variant?: 'original' | 'preview';
  lazy?: boolean;
  onOpen?: () => void;
  fallback?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible || !lazy) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [lazy, visible]);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setError('');
    if (assetId && (visible || !lazy))
      privateAsset(projectId, assetId, variant)
        .then((next) => {
          objectUrl = next;
          if (active) {
            setUrl(next);
            onUrl?.(next);
          } else URL.revokeObjectURL(next);
        })
        .catch((failure: unknown) => {
          if (active)
            setError(failure instanceof Error ? failure.message : '图片读取失败，请重试。');
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, assetId, variant, visible, lazy, attempt]);
  return (
    <div ref={container} className={`asset-view ${className}`}>
      {fallback && (!assetId || error) ? fallback : url ? (
        video ? (
          <video src={url} controls playsInline preload="metadata" />
        ) : onOpen ? (
          <button type="button" className="asset-open" onClick={onOpen} aria-label={`放大${alt}`}>
            <img src={url} alt={alt} onError={fallback ? ()=>setError('图片无法显示') : undefined} />
          </button>
        ) : (
          <img src={url} alt={alt} onError={fallback ? ()=>setError('图片无法显示') : undefined} />
        )
      ) : (
        <span className="asset-placeholder">
          <Icon name={video ? 'play' : 'image'} size={25} />
          <small>
            {error || (assetId ? (visible || !lazy ? '正在载入' : '滚动查看') : '添加图片')}
          </small>
          {error && (
            <button
              type="button"
              className="asset-retry"
              onClick={() => setAttempt((value) => value + 1)}
            >
              重新加载
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function ServiceList({ services }: { services: ServiceStatus[] }) {
  return (
    <div className="service-list">
      {services.map((service) => (
        <div className="service-row" key={service.name}>
          <span className={`status-dot ${service.mode}`} />
          <div>
            <strong>{service.name}</strong>
            <small>{service.detail}</small>
          </div>
          <span className={`pill ${service.mode === 'live' ? 'green' : 'muted'}`}>
            {service.mode === 'test' ? '测试适配器' : service.configured ? '已配置' : '未接通'}
          </span>
        </div>
      ))}
    </div>
  );
}
export const dateTime = (value: string) =>
  new Date(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export const statusNames: Record<string, string> = {
  paused: '已暂停',
  cancelled: '已停止',
  queued: '等待处理',
  running: '处理中',
  unknown: '等待核对',
  succeeded: '已完成',
  failed: '失败',
  sent: '已发送',
};
