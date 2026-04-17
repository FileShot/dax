/**
 * Toolbar — horizontal action bar (filter chips, search, view toggle).
 */
export default function Toolbar({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-2 flex-wrap mb-5 ${className}`}>
      {children}
    </div>
  );
}
