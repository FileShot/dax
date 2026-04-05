import { useEffect, useState, useCallback } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Upload,
  Search,
  FileText,
  File,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  BookOpen,
} from 'lucide-react';

const dax = window.dax;

function CreateKBModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('nomic-embed-text');
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(50);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim(), model, chunk_size: chunkSize, overlap });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="agent-card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--dax-text-primary))' }}>
            New Knowledge Base
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'rgb(var(--dax-text-secondary))' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company Documentation"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgb(var(--dax-bg-primary))', color: 'rgb(var(--dax-text-primary))', border: '1px solid rgb(var(--dax-border))' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'rgb(var(--dax-text-secondary))' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of documents will this contain?"
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              rows={2}
              style={{ background: 'rgb(var(--dax-bg-primary))', color: 'rgb(var(--dax-text-primary))', border: '1px solid rgb(var(--dax-border))' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'rgb(var(--dax-text-secondary))' }}>Embedding Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgb(var(--dax-bg-primary))', color: 'rgb(var(--dax-text-primary))', border: '1px solid rgb(var(--dax-border))' }}
            >
              <option value="nomic-embed-text">nomic-embed-text (768d, recommended)</option>
              <option value="mxbai-embed-large">mxbai-embed-large (1024d, higher quality)</option>
              <option value="all-minilm">all-minilm (384d, fastest)</option>
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm mb-1" style={{ color: 'rgb(var(--dax-text-secondary))' }}>Chunk Size (tokens)</label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                min={64}
                max={2048}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'rgb(var(--dax-bg-primary))', color: 'rgb(var(--dax-text-primary))', border: '1px solid rgb(var(--dax-border))' }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm mb-1" style={{ color: 'rgb(var(--dax-text-secondary))' }}>Overlap (tokens)</label>
              <input
                type="number"
                value={overlap}
                onChange={(e) => setOverlap(Number(e.target.value))}
                min={0}
                max={256}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'rgb(var(--dax-bg-primary))', color: 'rgb(var(--dax-text-primary))', border: '1px solid rgb(var(--dax-border))' }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary px-4 py-2 text-sm rounded-lg">Create</button>
        </div>
      </div>
    </div>
  );
}

function QueryPanel({ kbId, onClose }) {
  const [question, setQuestion] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await dax.knowledgeBase.query({ kb_id: kbId, question: question.trim(), top_k: 5 });
      setResults(res);
    } catch (err) {
      setResults({ error: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="agent-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgb(var(--dax-text-primary))' }}>
          <Search size={16} /> Query Knowledge Base
        </h3>
        <button onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          placeholder="Ask a question..."
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{ background: 'rgb(var(--dax-bg-primary))', color: 'rgb(var(--dax-text-primary))', border: '1px solid rgb(var(--dax-border))' }}
        />
        <button onClick={handleQuery} disabled={loading || !question.trim()} className="btn-primary px-3 py-2 text-sm rounded-lg">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
        </button>
      </div>
      {results && !results.error && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {results.chunks?.map((chunk, i) => (
            <div key={i} className="p-3 rounded-lg text-xs" style={{ background: 'rgb(var(--dax-bg-primary))' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="badge text-xs">Score: {(chunk.score * 100).toFixed(1)}%</span>
                <span style={{ color: 'rgb(var(--dax-text-muted))' }}>Chunk #{chunk.chunk_index}</span>
              </div>
              <p style={{ color: 'rgb(var(--dax-text-secondary))' }}>{chunk.text.slice(0, 300)}{chunk.text.length > 300 ? '...' : ''}</p>
            </div>
          ))}
          {results.chunks?.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--dax-text-muted))' }}>No matching chunks found.</p>
          )}
        </div>
      )}
      {results?.error && (
        <div className="flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: 'rgb(var(--dax-error))' }}>
          <AlertCircle size={14} /> {results.error}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeBaseView() {
  const [kbs, setKbs] = useState([]);
  const [selectedKB, setSelectedKB] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState(null);
  const [queryKBId, setQueryKBId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadKBs = useCallback(async () => {
    try {
      const list = await dax.knowledgeBase.list();
      setKbs(list || []);
    } catch (err) {
      console.error('Failed to load KBs:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadKBs(); }, [loadKBs]);

  const handleCreate = async (data) => {
    try {
      await dax.knowledgeBase.create(data);
      await loadKBs();
    } catch (err) {
      console.error('Failed to create KB:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await dax.knowledgeBase.delete(id);
      if (selectedKB?.id === id) setSelectedKB(null);
      if (queryKBId === id) setQueryKBId(null);
      await loadKBs();
    } catch (err) {
      console.error('Failed to delete KB:', err);
    }
  };

  const handleIngestFiles = async (kbId) => {
    try {
      const files = await dax.knowledgeBase.selectFile();
      if (!files || files.length === 0) return;

      setIngesting(true);
      setIngestStatus(null);

      for (const filePath of files) {
        setIngestStatus(`Ingesting ${filePath.split(/[/\\]/).pop()}...`);
        await dax.knowledgeBase.ingest({ kb_id: kbId, file_path: filePath });
      }

      setIngestStatus(`${files.length} file(s) ingested successfully`);
      setTimeout(() => setIngestStatus(null), 3000);
      await loadKBs();
      // Reload detail
      if (selectedKB?.id === kbId) {
        const detail = await dax.knowledgeBase.get(kbId);
        setSelectedKB(detail);
      }
    } catch (err) {
      setIngestStatus(`Error: ${err.message}`);
    }
    setIngesting(false);
  };

  const handleDeleteDoc = async (kbId, docId) => {
    try {
      await dax.knowledgeBase.deleteDoc({ kb_id: kbId, doc_id: docId });
      await loadKBs();
      if (selectedKB?.id === kbId) {
        const detail = await dax.knowledgeBase.get(kbId);
        setSelectedKB(detail);
      }
    } catch (err) {
      console.error('Failed to delete doc:', err);
    }
  };

  const handleSelectKB = async (kb) => {
    try {
      const detail = await dax.knowledgeBase.get(kb.id);
      setSelectedKB(detail);
    } catch (err) {
      console.error('Failed to load KB detail:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: 'rgb(var(--dax-accent))' }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database size={24} style={{ color: 'rgb(var(--dax-accent))' }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--dax-text-primary))' }}>Knowledge Base</h1>
            <p className="text-sm" style={{ color: 'rgb(var(--dax-text-muted))' }}>
              Upload documents and query them with AI — powered by local embeddings
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-sm rounded-lg flex items-center gap-2">
          <Plus size={16} /> New Knowledge Base
        </button>
      </div>

      {/* Ingest Status */}
      {ingestStatus && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{
          background: ingestStatus.startsWith('Error') ? 'rgba(var(--dax-error), 0.1)' : 'rgba(var(--dax-accent), 0.1)',
          color: ingestStatus.startsWith('Error') ? 'rgb(var(--dax-error))' : 'rgb(var(--dax-accent))',
        }}>
          {ingesting ? <Loader2 size={14} className="animate-spin" /> :
            ingestStatus.startsWith('Error') ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
          {ingestStatus}
        </div>
      )}

      {/* KB Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kbs.map((kb) => (
          <div
            key={kb.id}
            className={`agent-card p-4 cursor-pointer transition-all ${selectedKB?.id === kb.id ? 'ring-2' : ''}`}
            style={selectedKB?.id === kb.id ? { '--tw-ring-color': 'rgb(var(--dax-accent))' } : {}}
            onClick={() => handleSelectKB(kb)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen size={18} style={{ color: 'rgb(var(--dax-accent))' }} />
                <h3 className="font-semibold text-sm" style={{ color: 'rgb(var(--dax-text-primary))' }}>{kb.name}</h3>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setQueryKBId(queryKBId === kb.id ? null : kb.id); }}
                  className="btn-ghost p-1" title="Query"
                >
                  <Search size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleIngestFiles(kb.id); }}
                  className="btn-ghost p-1" title="Upload documents"
                  disabled={ingesting}
                >
                  <Upload size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(kb.id); }}
                  className="btn-ghost p-1 hover:text-red-400" title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {kb.description && (
              <p className="text-xs mb-2" style={{ color: 'rgb(var(--dax-text-muted))' }}>{kb.description}</p>
            )}
            <div className="flex gap-3 text-xs" style={{ color: 'rgb(var(--dax-text-secondary))' }}>
              <span className="badge">{kb.doc_count || 0} docs</span>
              <span className="badge">{kb.chunk_count || 0} chunks</span>
              <span className="badge">{kb.model || 'nomic-embed-text'}</span>
            </div>
          </div>
        ))}

        {kbs.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Database size={48} className="mx-auto mb-4 opacity-30" style={{ color: 'rgb(var(--dax-text-muted))' }} />
            <p className="text-sm mb-2" style={{ color: 'rgb(var(--dax-text-muted))' }}>No knowledge bases yet</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-sm rounded-lg">
              Create your first Knowledge Base
            </button>
          </div>
        )}
      </div>

      {/* Query Panel */}
      {queryKBId && (
        <QueryPanel kbId={queryKBId} onClose={() => setQueryKBId(null)} />
      )}

      {/* Detail panel */}
      {selectedKB && (
        <div className="agent-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'rgb(var(--dax-text-primary))' }}>
              <FileText size={16} /> Documents in "{selectedKB.name}"
            </h3>
            <button
              onClick={() => handleIngestFiles(selectedKB.id)}
              disabled={ingesting}
              className="btn-secondary px-3 py-1.5 text-xs rounded-lg flex items-center gap-1"
            >
              <Upload size={12} /> Add Files
            </button>
          </div>
          {selectedKB.documents?.length > 0 ? (
            <div className="space-y-2">
              {selectedKB.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgb(var(--dax-bg-primary))' }}>
                  <div className="flex items-center gap-2">
                    <File size={14} style={{ color: 'rgb(var(--dax-accent))' }} />
                    <div>
                      <p className="text-sm" style={{ color: 'rgb(var(--dax-text-primary))' }}>{doc.filename}</p>
                      <p className="text-xs" style={{ color: 'rgb(var(--dax-text-muted))' }}>
                        {doc.chunk_count} chunks · {(doc.size_bytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDoc(selectedKB.id, doc.id)}
                    className="btn-ghost p-1 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--dax-text-muted))' }}>
              No documents yet. Click "Add Files" to upload.
            </p>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <CreateKBModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
