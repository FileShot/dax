export default function Sparkline({
  data = [],
  width = 80,
  height = 24,
  color = 'rgb(var(--dax-accent))',
  fillOpacity = 0.15,
  strokeWidth = 1.5,
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const fillPath = `M${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}Z`;

  return (
    <svg width={width} height={height} className="block" viewBox={`0 0 ${width} ${height}`}>
      {fillOpacity > 0 && (
        <path d={fillPath} fill={color} opacity={fillOpacity} />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest value dot */}
      {data.length > 0 && (() => {
        const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2);
        const lastY = padding + (1 - (data[data.length - 1] - min) / range) * (height - padding * 2);
        return <circle cx={lastX} cy={lastY} r={1.5} fill={color} />;
      })()}
    </svg>
  );
}
