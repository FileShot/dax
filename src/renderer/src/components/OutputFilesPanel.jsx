import { useEffect, useState } from 'react';
import { FileText, RefreshCw, X, FolderOpen, Clock, HardDrive } from 'lucide-react';

export default function OutputFilesPanel() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      const list = await window.dax.outputFiles.list();
      setFiles(list || []);
    } catch (e) {
      console.error('Failed to list output files:', e);
    }
  };

  useEffect(() => { refresh(); }, []);

  const openFile = async (name) => {
    setLoading(true);
    setSelectedFile(name);
    try {
      const data = await window.dax.outputFiles.read(name);
      setFileContent(data);
    } catch (e) {
      setFileContent({ error: e.message });
    }
    setLoading(false);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-dax-accent" />
          <span className="text-xs font-semibold text-dax-text-bright uppercase tracking-wide">Agent Output Files</span>
          <span className="text-[10px] text-dax-text-dim">test-output/</span>
        </div>
        <button onClick={refresh} className="p-1 rounded hover:bg-dax-card text-dax-text-dim hover:text-dax-text transition-fast" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      {files.length === 0 ? (
        <div className="agent-card p-4 text-center">
          <FileText size={24} className="text-dax-text-dim mx-auto mb-2 opacity-30" />
          <p className="text-xs text-dax-text-dim">No output files yet</p>
          <p className="text-[10px] text-dax-text-dim mt-0.5 opacity-60">Files created by agents will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {files.map((f) => (
            <div
              key={f.name}
              onClick={() => openFile(f.name)}
              className="agent-card p-3 cursor-pointer hover:border-dax-accent/40 transition-fast"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileText size={12} className="text-amber-400 shrink-0" />
                <span className="text-xs text-dax-text-bright font-medium truncate">{f.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-dax-text-dim">
                <span className="flex items-center gap-1"><HardDrive size={8} />{formatSize(f.size)}</span>
                <span className="flex items-center gap-1"><Clock size={8} />{new Date(f.modified).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setSelectedFile(null); setFileContent(null); }}>
          <div className="bg-dax-panel border border-dax-panel-border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-dax-panel-border">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-amber-400" />
                <span className="text-sm font-medium text-dax-text-bright">{selectedFile}</span>
                {fileContent && !fileContent.error && (
                  <span className="text-[10px] text-dax-text-dim">{formatSize(fileContent.size)}</span>
                )}
              </div>
              <button onClick={() => { setSelectedFile(null); setFileContent(null); }} className="text-dax-text-dim hover:text-dax-text transition-fast text-xs">Close</button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {loading ? (
                <div className="text-xs text-dax-text-dim text-center py-8 animate-pulse">Loading...</div>
              ) : fileContent?.error ? (
                <div className="text-xs text-dax-error">{fileContent.error}</div>
              ) : (
                <pre className="text-xs text-dax-text whitespace-pre-wrap font-mono leading-relaxed">{fileContent?.content}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
