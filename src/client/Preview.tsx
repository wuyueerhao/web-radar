import { singleProductRuntime } from '../templates/themes/singleProduct';
import { bannerRuntime } from '../shared/banner-runtime';
import { materialsRuntime } from '../shared/materials-runtime';
import { productImageViewerRuntime } from '../shared/product-image-viewer';
import { useEffect, useRef, useState } from 'react';
import type { DesignPage, Language, Project } from '../shared/model';
import { pageLabel, plannedPages } from '../shared/site-brief';
import { api, post, errorMessage, privateAssetBlob, requestId } from './api';
import { Button, Icon, Notice } from './components';
import { labels } from '../templates/labels';
import { referenceInteractions } from '../templates/themes/referenceInteractions';

const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function privateAssetId(value: string, projectId: string): string | null {
  if (!value.startsWith('/api/projects/')) return null;
  try {
    const url = new URL(value, 'https://preview.invalid');
    const match = url.pathname.match(/^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/);
    return match && decodeURIComponent(match[1]) === projectId
      ? decodeURIComponent(match[2])
      : null;
  } catch {
    return null;
  }
}

export function rewritePreviewMedia(
  node: {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  },
  projectId: string,
) {
  for (const attribute of ['src', 'poster', 'data-src', 'data-large']) {
    const value = node.getAttribute(attribute) || '';
    if (!value || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
      continue;
    const id = privateAssetId(value, projectId);
    if (id) {
      node.removeAttribute(attribute);
      node.setAttribute(`data-wr-${attribute}`, id);
    } else if (value.startsWith('/templates/')) {
      // Keep template assets intact
      continue;
    } else {
      node.removeAttribute(attribute);
    }
  }
}

export function rewriteMaterialsPreviewMedia(node:{getAttribute(name:string):string|null;setAttribute(name:string,value:string):void;removeAttribute(name:string):void},projectId:string):string[]{
  const ids:string[]=[];
  for(const attribute of ['srcset','data-wr-desktop-poster','data-wr-mobile-poster']){
    const id=privateAssetId(node.getAttribute(attribute)||'',projectId);
    if(id){ids.push(id);node.removeAttribute(attribute);node.setAttribute(attribute==='srcset'?'data-wr-srcset':attribute+'-id',id);}
  }
  const style=node.getAttribute('style')||'';
  const safe=style.replace(/url\((['"]?)([^)]+?)\1\)/g,(match,quote:string,url:string)=>{
    const id=privateAssetId(url,projectId);if(!id)return match;ids.push(id);return'none';
  });
  if(safe!==style){node.setAttribute('data-wr-material-style',style);node.setAttribute('style',safe);}
  return ids;
}

function restoreMaterialsPreviewMedia(urls:Map<string,string>,projectId:string){
  const assetId=(value:string)=>{
    try{const match=new URL(value,'https://preview.invalid').pathname.match(/^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/);return match&&decodeURIComponent(match[1])===projectId?decodeURIComponent(match[2]):null;}catch{return null;}
  };
  document.querySelectorAll('[data-wr-material-style],[data-wr-srcset],[data-wr-desktop-poster-id],[data-wr-mobile-poster-id]').forEach(node=>{
    const style=node.getAttribute('data-wr-material-style');
    if(style)node.setAttribute('style',style.replace(/url\((['"]?)([^)]+?)\1\)/g,(match,quote:string,url:string)=>{const id=assetId(url);return id?urls.has(id)?`url("${urls.get(id)}")`:'none':match;}));
    for(const attribute of ['srcset','data-wr-desktop-poster','data-wr-mobile-poster']){
      const id=node.getAttribute(attribute==='srcset'?'data-wr-srcset':attribute+'-id');const url=id?urls.get(id):undefined;if(url)node.setAttribute(attribute,url);
    }
  });
  window.dispatchEvent(new Event('wr:materials-media-ready'));
}

export function SitePreview({
  project,
  onClose,
  draftPreview = false,
}: {
  project: Project;
  onClose: () => void;
  draftPreview?: boolean;
}) {
  const pages = plannedPages(project.draft);
  const [lang, setLang] = useState<Language>('en'),
    [page, setPage] = useState<DesignPage>('home'),
    [productId, setProductId] = useState(
      project.draft.primaryProductId || project.draft.products[0]?.id || '',
    );
  const [mobile, setMobile] = useState(false),
    [html, setHtml] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null),
    channel = useRef(requestId());
  const media = useRef<{ id: string; blob: Blob }[]>([]);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);
  useEffect(() => {
    if (!productId && (project.draft.primaryProductId || project.draft.products[0]?.id)) {
      setProductId(project.draft.primaryProductId || project.draft.products[0]?.id || '');
    }
  }, [project.draft.primaryProductId, project.draft.products, productId]);
  useEffect(() => {
    let active = true;
    const renderChannel = requestId();
    channel.current = renderChannel;
    media.current = [];
    setLoading(true);
    setError('');
    setHtml('');
    (async () => {
      const effectiveProductId = productId || project.draft.primaryProductId || project.draft.products[0]?.id || '';
      const query = new URLSearchParams({
        lang,
        page,
        ...(page === 'detail' && effectiveProductId ? { productId: effectiveProductId } : {}),
      });
      const path = `/api/projects/${encodeURIComponent(project.id)}/preview?${query}`;
      const result = draftPreview
        ? await post<{ html: string }>(path, { draft: project.draft })
        : await api<{ html: string }>(path);
      const doc = new DOMParser().parseFromString(result.html, 'text/html');
      // Only trusted template styling and our tiny navigation bridge run inside the sandbox.
      doc
        .querySelectorAll(
          'script,base,meta[http-equiv="refresh"],meta[http-equiv="Content-Security-Policy"]',
        )
        .forEach((node) => node.remove());
      const targets = [...doc.querySelectorAll('[src],[poster],[data-src],[data-large]')];
      const materialsIds=project.materials?[...doc.querySelectorAll('[style],[srcset],[data-wr-desktop-poster],[data-wr-mobile-poster]')].flatMap(node=>rewriteMaterialsPreviewMedia(node,project.id)):[];
      const ids = [
        ...new Set(
          [...materialsIds,...targets.flatMap((node) =>
            ['src', 'poster', 'data-src', 'data-large']
              .map((attribute) => privateAssetId(node.getAttribute(attribute) || '', project.id))
              .filter((id): id is string => !!id),
          )],
        ),
      ];
      const items = await Promise.all(
        ids.map(async (id) => ({ id, blob: await privateAssetBlob(project.id, id) })),
      );
      if (!active) return;
      media.current = items;
      targets.forEach((node) => rewritePreviewMedia(node, project.id));
      doc.querySelectorAll('form').forEach((form) => {
        form.removeAttribute('action');
        form.removeAttribute('target');
      });
      const nonce = requestId().replaceAll('-', '');
      const csp = doc.createElement('meta');
      csp.httpEquiv = 'Content-Security-Policy';
      csp.content = `default-src 'none'; img-src blob: data: https: http: 'self'; media-src blob: data: https: http: 'self'; style-src 'unsafe-inline' ${window.location.origin}; script-src 'nonce-${nonce}'; font-src data: https: ${window.location.origin}; base-uri 'none'; form-action 'none'`;
      doc.head.insertBefore(csp, doc.head.firstChild);
      const bridge = doc.createElement('script');
      bridge.setAttribute('nonce', nonce);
      bridge.textContent = `
        var __name = typeof __name === 'function' ? __name : (v) => v;
        (${referenceInteractions.toString()})();
        (${materialsRuntime.toString()})();
        (${productImageViewerRuntime.toString()})();
        ${bannerRuntime}
        for (const search of document.querySelectorAll('[data-product-search]')) search.addEventListener('input', () => {
          for (const card of document.querySelectorAll('[data-product-card]')) card.hidden = !(card.dataset.productName || card.textContent).toLowerCase().includes(search.value.toLowerCase());
        });
        document.addEventListener('submit', event => {
          event.preventDefault();
          const form = event.target;
          if (!form.reportValidity()) return;
          let status = form.querySelector('[role=status]');
          if (!status) { status = document.createElement('p'); status.setAttribute('role','status'); form.append(status); }
          status.textContent = 'Preview: form validation passed. No message was sent.';
        });
        ${singleProductRuntime}
        const video = document.getElementById('hero-video');
        const toggle = document.getElementById('video-toggle');
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        const videoLabels = ${scriptJson({ play: labels[lang].play, pause: labels[lang].pause })};
        function buttonState() {
          if (!toggle || !video) return;
          toggle.textContent = video.paused ? '▶' : 'Ⅱ';
          toggle.setAttribute('aria-label', video.paused ? videoLabels.play : videoLabels.pause);
        }
        function respectMotion() {
          document.body.classList.toggle('reduced-motion', motion.matches);
          if (video) { video.muted = true; if (motion.matches) video.pause(); else video.play().catch(() => {}); }
          buttonState();
        }
        motion.addEventListener('change', respectMotion);
        video?.addEventListener('play', buttonState);
        video?.addEventListener('pause', buttonState);
        toggle?.addEventListener('click', () => {
          if (!video) return;
          if (video.paused) { document.body.classList.remove('reduced-motion'); video.play().catch(() => {}); }
          else video.pause();
        });
        const mediaUrls = [];
        window.addEventListener('message', event => {
          if (event.source !== parent || event.origin !== ${scriptJson(window.location.origin)} ||
            event.data?.type !== 'wr:preview-media' || event.data.channel !== ${scriptJson(renderChannel)}) return;
          mediaUrls.forEach(url => URL.revokeObjectURL(url));
          mediaUrls.length = 0;
          const urls = new Map(event.data.items.map(item => {
            const url = URL.createObjectURL(item.blob); mediaUrls.push(url); return [item.id, url];
          }));
          document.querySelectorAll('[data-wr-src],[data-wr-poster],[data-wr-data-src],[data-wr-data-large]').forEach(node => {
            for (const attribute of ['src', 'poster', 'data-src', 'data-large']) {
              const url = urls.get(node.getAttribute('data-wr-' + attribute));
              if (url) node.setAttribute(attribute, url);
            }
          });
          ${project.materials?`(${restoreMaterialsPreviewMedia.toString()})(urls,${scriptJson(project.id)});`:''}
          document.dispatchEvent(new Event('wr:banner-media-ready'));
          if (video) video.load();
          respectMotion();
        });
        window.addEventListener('pagehide', () => mediaUrls.forEach(url => URL.revokeObjectURL(url)));
        parent.postMessage({type:'wr:preview-ready', channel:${scriptJson(renderChannel)}}, ${scriptJson(window.location.origin)});
        document.addEventListener('click', function(event) {
          const link = event.target.closest('a');
          if (!link) return;
          event.preventDefault();
          const page = link.dataset.wrPage || ${scriptJson(page)};
          if (link.dataset.wrPage || link.dataset.wrLang) parent.postMessage({
            type:'wr:preview-navigate', channel:${scriptJson(renderChannel)},
            page, lang:link.dataset.wrLang, productId:link.dataset.wrProductId || ${scriptJson(productId)}
          }, ${scriptJson(window.location.origin)});
        });
      `;
      doc.body.appendChild(bridge);
      setHtml('<!doctype html>' + doc.documentElement.outerHTML);
    })()
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      media.current = [];
    };
  }, [project.id, project.version, project.draft, draftPreview, lang, page, productId, retry]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== 'null' ||
        event.data?.channel !== channel.current
      )
        return;
      if (event.data.type === 'wr:preview-ready') {
        frame.current?.contentWindow?.postMessage(
          { type: 'wr:preview-media', channel: channel.current, items: media.current },
          '*',
        );
        return;
      }
      if (event.data.type !== 'wr:preview-navigate') return;
      const next = event.data;
      if (!pages.includes(next.page)) return;
      if (next.lang && project.draft.languages.includes(next.lang)) setLang(next.lang);
      if (next.productId && project.draft.products.some((product) => product.id === next.productId))
        setProductId(next.productId);
      setPage(next.page);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [project, pages]);
  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="私有整站预览">
      <div className="preview-toolbar">
        <div>
          <span className="preview-lock">
            <Icon name="lock" />
          </span>
          <strong>私有整站预览</strong>
          <span className="muted">
            {draftPreview ? '模版试览 · 未保存' : `V${project.version}`}
          </span>
        </div>
        <div className="preview-route-controls">
          <select
            aria-label="预览语言"
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
          >
            {project.draft.languages.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            aria-label="预览页面"
            value={page}
            onChange={(e) => setPage(e.target.value as DesignPage)}
          >
            {pages.map((id) => (
              <option key={id} value={id}>
                {pageLabel(project.draft, id)}
              </option>
            ))}
          </select>
          {page === 'detail' && (
            <select
              aria-label="预览产品"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {project.draft.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <div className="segmented preview-device">
            <button className={!mobile ? 'selected' : ''} onClick={() => setMobile(false)}>
              桌面
            </button>
            <button className={mobile ? 'selected' : ''} onClick={() => setMobile(true)}>
              手机
            </button>
          </div>
          <Button kind="quiet" onClick={onClose} aria-label="关闭预览">
            <Icon name="close" />
          </Button>
        </div>
      </div>
      <div className="preview-note">
        <Icon name="lock" size={13} />
        仅授权成员可见 · 草稿素材通过当前登录安全读取 · 预览中的询盘表单不发送邮件
      </div>
      <div className={`preview-canvas ${mobile ? 'mobile' : ''}`}>
        {loading ? (
          <div className="preview-loading">
            <span className="spinner" />
            正在准备页面与私有素材…
          </div>
        ) : error ? (
          <div className="preview-error">
            <Notice tone="error">{error}</Notice>
            <Button onClick={() => setRetry((current) => current + 1)}>
              <Icon name="refresh" />
              重试预览
            </Button>
          </div>
        ) : (
          <iframe
            ref={frame}
            title={`${pageLabel(project.draft, page)} ${lang} 私有预览`}
            sandbox="allow-scripts allow-forms"
            srcDoc={html}
          />
        )}
      </div>
    </div>
  );
}
