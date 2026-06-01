import { useEffect } from 'react';
import useModelStore from '../stores/useModelStore';

/**
 * Shared model dropdown — loads from DB (imported GGUF / configured models).
 */
export default function ModelSelect({
  value,
  onChange,
  className = '',
  placeholder = 'Select a model…',
  disabled = false,
  allowEmpty = true,
}) {
  const { models, loading, fetch } = useModelStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading}
      className={`input text-xs w-full ${className}`}
      title={models.length === 0 ? 'Import models from Settings or Models page' : undefined}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}{m.provider ? ` (${m.provider})` : ''}
        </option>
      ))}
    </select>
  );
}
