import { useState, useCallback, useRef } from 'react';
import Header from './components/Header';
import DropZone from './components/DropZone';
import FileQueue from './components/FileQueue';
import PipelineBlock from './components/PipelineBlock';
import ResultsSection from './components/ResultsSection';
import { uid, toCSV } from './lib/utils';
import { processFile } from './lib/webhook';
import { saveRun } from './lib/supabase';

const LS_WH = 'lpo_wh_url';
const MAX_FILES = 20;
const STAGE_COUNT = 9;

export default function App() {
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem(LS_WH) || '');
  const [queue, setQueue]           = useState([]);
  const [processing, setProcessing] = useState(false);
  const [allRows, setAllRows]       = useState([]);
  const [csvContent, setCsvContent] = useState('');
  const [activeTab, setActiveTab]   = useState('all');
  const resultsRef = useRef(null);

  const saveUrl = url => { setWebhookUrl(url); localStorage.setItem(LS_WH, url); };

  const addFiles = useCallback(files => {
    setQueue(prev => {
      const next = [...prev];
      files.forEach(f => {
        if (next.length >= MAX_FILES) return;
        if (next.some(q => q.file.name === f.name && q.file.size === f.size)) return;
        next.push({
          id: uid(), file: f, status: 'pending',
          stages: Array(STAGE_COUNT).fill('pending'),
          rows: [], error: null, flagged: false, flagReason: null, sheetsUrl: null, msg: '',
        });
      });
      return next;
    });
  }, []);

  const removeItem = id => {
    if (id === 'all') setQueue(q => q.filter(i => i.status === 'active'));
    else setQueue(q => q.filter(i => i.id !== id));
  };

  const updateItem = (id, patch) =>
    setQueue(q => q.map(i => i.id === id ? { ...i, ...patch } : i));

  const setStage = (id, stageIdx, state) =>
    setQueue(q => q.map(i => {
      if (i.id !== id) return i;
      const stages = [...i.stages];
      stages[stageIdx] = state;
      return { ...i, stages };
    }));

  // Called after each file finishes — updates results immediately
  const refreshResultsAfter = (updatedId, updatedItem) => {
    setQueue(q => {
      const merged = q.map(i => i.id === updatedId ? { ...i, ...updatedItem } : i);
      const rows = merged.filter(i => i.status === 'done').flatMap(i => i.rows);
      const csv = toCSV(rows);
      setAllRows(rows);
      setCsvContent(csv);
      return merged;
    });
  };

  const runOne = async (item, url) => {
    updateItem(item.id, {
      status: 'active', stages: Array(STAGE_COUNT).fill('pending'),
      rows: [], error: null, flagged: false, flagReason: null, msg: '',
    });
    try {
      const result = await processFile(item, url, ({ stage, state, msg }) => {
        setStage(item.id, stage, state);
        if (msg !== undefined) updateItem(item.id, { msg });
      });
      const patch = {
        status: 'done', stages: Array(STAGE_COUNT).fill('done'), msg: '',
        rows: result.rows, flagged: result.flagged,
        flagReason: result.flagReason, sheetsUrl: result.sheetsUrl,
      };
      refreshResultsAfter(item.id, patch);
    } catch (err) {
      const short = err.message.length > 80 ? err.message.slice(0, 77) + '…' : err.message;
      setQueue(q => q.map(i => {
        if (i.id !== item.id) return i;
        const stages = [...i.stages];
        const activeIdx = stages.findIndex(s => s === 'active');
        if (activeIdx >= 0) stages[activeIdx] = 'error';
        return { ...i, status: 'error', stages, error: short, msg: short };
      }));
    }
  };

  const process = async () => {
    if (!webhookUrl) return;
    setProcessing(true);
    setAllRows([]);
    setCsvContent('');
    setActiveTab('all');
    const pending = queue.filter(q => q.status === 'pending');
    // Sequential — n8n drops binary data when concurrent requests arrive
    for (const item of pending) await runOne(item, webhookUrl);
    setProcessing(false);
    // Save once everything is done
    setQueue(q => {
      const rows = q.filter(i => i.status === 'done').flatMap(i => i.rows);
      if (rows.length) saveRun({ queue: q, allRows: rows, csvContent: toCSV(rows) });
      return q;
    });
  };

  const rerunItem = async (id) => {
    if (!webhookUrl || processing) return;
    const item = queue.find(i => i.id === id);
    if (!item) return;
    setProcessing(true);
    await runOne(item, webhookUrl);
    setProcessing(false);
  };

  const reset = () => { setQueue([]); setAllRows([]); setCsvContent(''); setActiveTab('all'); };

  const jumpTo = id => {
    setActiveTab(id);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const sheetsUrl    = queue.find(q => q.sheetsUrl)?.sheetsUrl || null;
  const showPipeline = queue.some(q => q.status !== 'pending');
  const donItems     = queue.filter(q => q.status === 'done');
  const showResults  = donItems.length > 0;

  return (
    <>
      <Header />
      <main>
        <DropZone onFiles={addFiles} webhookUrl={webhookUrl} onWebhookChange={saveUrl} />
        <FileQueue
          queue={queue}
          processing={processing}
          onRemove={removeItem}
          onProcess={process}
          onReset={reset}
          onJump={jumpTo}
          onRerun={rerunItem}
        />
        {showPipeline && (
          <div className="card">
            <div className="card-header">Processing Pipeline</div>
            <div className="card-body pipeline-body">
              {queue.filter(q => q.status !== 'pending').map(item => (
                <PipelineBlock key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
        {showResults && (
          <div ref={resultsRef}>
            <ResultsSection
              queue={queue}
              allRows={allRows}
              csvContent={csvContent}
              sheetsUrl={sheetsUrl}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
        )}
      </main>
    </>
  );
}
