import { cx, clampPercent } from '../utils';
import '../styles/ui.css';

function points(values, width, height, padding = 8) {
  const numbers = values.map(item => Number(typeof item === 'object' ? item.value : item) || 0);
  const min = Math.min(...numbers, 0);
  const max = Math.max(...numbers, 1);
  const span = max - min || 1;
  return numbers.map((value, index) => `${padding + (index * (width - padding * 2)) / Math.max(1, numbers.length - 1)},${height - padding - ((value - min) / span) * (height - padding * 2)}`).join(' ');
}

/** Generic responsive line chart. `paths` accepts page-prepared SVG paths so data shaping remains at page level. */
export function LineChart({ series = [], paths = [], width = 720, height = 300, ariaLabel = 'Graphique en courbes', showLegend = true, legend, gridLines = [], xLabels = [], marker, className, svgClassName, legendClassName, labelsClassName, empty, loading = false, unstyled = false }) {
  const items = paths.length ? paths : series;
  if (loading) return <div className={cx(!unstyled && 'hui-chart', className)} aria-busy="true" />;
  if (!items.length) return empty ?? null;
  const legends = legend || items;
  return <figure className={cx(!unstyled && 'hui-chart', className)} style={unstyled ? { margin: 0, display: 'contents' } : undefined}>
    <svg className={svgClassName} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      {gridLines.map((line) => <line key={`${line.x1 || 0}-${line.y1 || line}`} x1={line.x1 ?? 0} x2={line.x2 ?? width} y1={line.y1 ?? line} y2={line.y2 ?? line} className={line.className} stroke={line.stroke} strokeWidth={line.strokeWidth} />)}
      {items.map((item, index) => paths.length
        ? <path key={item.id} d={item.d} className={item.className} fill={item.fill ?? 'none'} stroke={item.stroke} strokeWidth={item.strokeWidth} strokeDasharray={item.strokeDasharray} strokeLinecap={item.strokeLinecap} strokeLinejoin={item.strokeLinejoin} vectorEffect={item.vectorEffect} />
        : <polyline key={item.id} points={points(item.values, width, height)} fill="none" stroke={item.color || `var(--hui-chart-${(index % 4) + 1})`} strokeWidth="3" vectorEffect="non-scaling-stroke" />)}
      {marker?.line && <line {...marker.line} />}
      {marker?.point && <circle {...marker.point} />}
    </svg>
    {showLegend && legends.length > 0 && <figcaption className={cx(!unstyled && 'hui-chart__legend', legendClassName)}>{legends.map((item) => <span key={item.id || item.label}><i className={item.swatchClassName} style={item.color ? { backgroundColor: item.color } : undefined} />{item.label}</span>)}</figcaption>}
    {xLabels.length > 0 && <div className={labelsClassName}>{xLabels.map((item, index) => <span key={item.key || `${item.label || item}-${index}`}>{item.label ?? item}</span>)}</div>}
  </figure>;
}

/** Generic donut chart. `conic` preserves CSS-based legacy visuals while remaining data-driven. */
export function DonutChart({ segments = [], size = 180, thickness = 18, centerLabel, ariaLabel = 'Graphique en anneau', className, visualClassName, showLegend = true, variant = 'ring', gradient, empty, loading = false, unstyled = false }) {
  const safeSegments = segments.filter(item => Math.max(0, Number(item.value) || 0) > 0);
  const total = safeSegments.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0);
  if (loading) return <div className={cx(!unstyled && 'hui-donut', className)} aria-busy="true" />;
  if (!total && !gradient) return empty ?? null;
  if (variant === 'conic') {
    let offset = 0;
    const stops = safeSegments.map((item, index) => {
      const start = offset;
      offset += (Number(item.value) / total) * 100;
      return `${item.color || `var(--hui-chart-${(index % 4) + 1})`} ${start}% ${offset}%`;
    });
    return <figure className={cx(!unstyled && 'hui-donut', className)} style={unstyled ? { margin: 0, display: 'contents' } : undefined}><div className={visualClassName} style={{ background: gradient || `conic-gradient(${stops.join(',')})` }} role="img" aria-label={ariaLabel}>{centerLabel}</div>{showLegend && <figcaption>{safeSegments.map((item, index) => <span key={item.label}><i style={{ backgroundColor: item.color || `var(--hui-chart-${(index % 4) + 1})` }} />{item.label}<strong>{item.value}</strong></span>)}</figcaption>}</figure>;
  }
  return <figure className={cx(!unstyled && 'hui-donut', className)}><div className={cx(!unstyled && 'hui-donut__visual', visualClassName)} style={{ width: size, height: size }}><svg viewBox="0 0 42 42" role="img" aria-label={ariaLabel}>{safeSegments.map((item, index) => { const fraction = item.value / total * 100; const itemOffset = safeSegments.slice(0, index).reduce((sum, segment) => sum + segment.value / total * 100, 0); return <circle key={item.label} cx="21" cy="21" r="15.9155" fill="transparent" stroke={item.color || `var(--hui-chart-${(index % 4) + 1})`} strokeWidth={thickness / 10} strokeDasharray={`${fraction} ${100 - fraction}`} strokeDashoffset={25 - itemOffset} />; })}</svg>{centerLabel && <span>{centerLabel}</span>}</div>{showLegend && <figcaption>{safeSegments.map((item, index) => <span key={item.label}><i style={{ backgroundColor: item.color || `var(--hui-chart-${(index % 4) + 1})` }} />{item.label}<strong>{item.value}</strong></span>)}</figcaption>}</figure>;
}

/** Compact trend visual supporting either values or a page-prepared path. */
export function Sparkline({ values = [], path, color = 'var(--hui-accent)', width = 120, height = 40, ariaLabel = 'Tendance', ariaHidden = false, className, pathClassName, strokeWidth = 2, unstyled = false }) {
  return <svg className={cx(!unstyled && 'hui-sparkline', className)} viewBox={`0 0 ${width} ${height}`} role={ariaHidden ? undefined : 'img'} aria-hidden={ariaHidden || undefined} aria-label={ariaHidden ? undefined : ariaLabel}>{path ? <path d={path} className={pathClassName} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /> : <polyline points={points(values, width, height, 3)} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />}</svg>;
}

/** Generic progress primitive; custom element/class props preserve legacy page markup during migrations. */
export function ProgressBar({ value, max = 100, label, showValue = true, tone = 'default', className, trackClassName, fillClassName, ariaLabel, as: Root = 'div', fillAs: Fill = 'span', unstyled = false, loading = false, empty = false }) {
  const percent = clampPercent(value, max);
  if (empty) return null;
  if (unstyled) return <Root className={className} role="progressbar" aria-valuenow={Number(value) || 0} aria-valuemin="0" aria-valuemax={max} aria-label={ariaLabel || (typeof label === 'string' ? label : 'Progression')} aria-busy={loading || undefined}><Fill className={fillClassName} style={{ width: `${percent}%` }} /></Root>;
  return <Root className={cx(!unstyled && 'hui-progress', className)} aria-busy={loading || undefined}>{(label || showValue) && !unstyled && <div><span>{label}</span>{showValue && <strong>{Math.round(percent)} %</strong>}</div>}<div className={cx(!unstyled && 'hui-progress__track', trackClassName)} role="progressbar" aria-valuenow={Number(value) || 0} aria-valuemin="0" aria-valuemax={max} aria-label={ariaLabel || (typeof label === 'string' ? label : 'Progression')}><Fill className={cx(!unstyled && `hui-progress__fill hui-progress__fill--${tone}`, fillClassName)} style={{ width: `${percent}%` }} /></div></Root>;
}

/** @param {{children: React.ReactNode, tone?: 'neutral'|'accent'|'success'|'warning'|'danger'|'info', icon?: React.ReactNode, className?: string}} props */
export function Badge({ children, tone = 'neutral', icon, className }) { return <span className={cx('hui-badge', `hui-badge--${tone}`, className)}>{icon}{children}</span>; }
