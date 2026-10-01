// ============================================
// PONTE CENTRAL: foto -> pose real (MediaPipe) -> geometria por vista -> achados/metricas
// Usado por MediaCollector (fluxo normal) e ExpressAnalysis (fluxo rapido).
//
// Convencoes gravadas (sem mudar o schema):
//  - ppa_findings.finding_key = codigo da flag (PEP13, PEP04...)
//  - ppa_metrics `side_<codigo>`    : unit = lados afetados ('D' | 'E' | 'D,E'), value = severidade
//  - ppa_metrics `measure_<codigo>` : value = medida (% do tronco/perna), unit = referencial
//  - ppa_metrics `keypoint_<nome_en>_<vista>` : value = x em PIXELS, unit = y em PIXELS
//  - ppa_metrics `warning_<n>`      : unit = mensagem de aviso (vista errada, camera torta...)
// ============================================

import { detectPoseFromImage } from './poseDetectionService';
import { analyzePostureGeometry, KEYPOINT_NAMES_EN, PostureFlag, Side } from './postureGeometry';

export interface PoseAnalysisFinding {
  key: string;
  direction: string;
  severity: number;
  confidence: number;
}

export interface PoseAnalysisMetric {
  key: string;
  value: number;
  unit: string | null;
  severity: number;
}

export interface PhotoInput {
  imageUrl: string;
  view: string; // 'anterior' | 'posterior' | 'lateral_d' | 'lateral_e'
}

export interface PoseAnalysisResult {
  findings: PoseAnalysisFinding[];
  metrics: PoseAnalysisMetric[];
  posesDetected: number;
  photosAnalyzed: number;
  warnings: string[];
}

function directionFromView(view: string): string {
  if (view.includes('lateral')) return 'lateral';
  if (view === 'posterior') return 'posterior';
  return 'anterior';
}

function loadImageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = url;
  });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function runPoseAnalysisOnPhotos(photos: PhotoInput[]): Promise<PoseAnalysisResult> {
  const warnings: string[] = [];
  const metrics: PoseAnalysisMetric[] = [];
  const flags: PostureFlag[] = [];
  let posesDetected = 0;

  for (const photo of photos) {
    try {
      const pose = await detectPoseFromImage(photo.imageUrl);
      if (!pose) {
        warnings.push(`Nenhuma pose detectada em ${photo.view}`);
        continue;
      }
      posesDetected++;
      const { w, h } = await loadImageSize(photo.imageUrl);

      // Keypoints em pixels, nomes em ingles (formato que o AnalyticCanvas desenha)
      Object.entries(KEYPOINT_NAMES_EN).forEach(([idx, name]) => {
        const kp = pose.keypoints[Number(idx)];
        if (!kp || kp.confidence < 0.5) return;
        metrics.push({ key: `keypoint_${name}_${photo.view}`, value: r1(kp.x * w), unit: String(r1(kp.y * h)), severity: 1 });
      });

      const geo = analyzePostureGeometry(pose.keypoints, photo.view, w, h);
      flags.push(...geo.flags);
      geo.metrics.forEach(m => metrics.push({ key: m.key, value: m.value, unit: m.unit, severity: 1 }));
      geo.warnings.forEach(wn => warnings.push(wn));
    } catch (err) {
      console.error(`Erro na análise de pose (${photo.view}):`, err);
      warnings.push(`Falha ao processar ${photo.view}: ${(err as Error).message}`);
    }
  }

  // Agrega por codigo: maior severidade/confianca, uniao dos lados
  const byCode = new Map<string, { sev: number; conf: number; dir: string; sides: Set<Side>; measure: number; unit: string }>();
  flags.forEach(f => {
    const cur = byCode.get(f.code) || { sev: 0, conf: 0, dir: directionFromView(f.view), sides: new Set<Side>(), measure: 0, unit: f.unit };
    if (f.severity > cur.sev) { cur.sev = f.severity; cur.dir = directionFromView(f.view); }
    cur.conf = Math.max(cur.conf, f.confidence);
    if (f.side) cur.sides.add(f.side);
    if (f.measurement > cur.measure) { cur.measure = f.measurement; cur.unit = f.unit; }
    byCode.set(f.code, cur);
  });

  const findings: PoseAnalysisFinding[] = [];
  byCode.forEach((v, code) => {
    findings.push({ key: code, direction: v.dir, severity: v.sev, confidence: v.conf });
    if (v.sides.size > 0) {
      metrics.push({ key: `side_${code}`, value: v.sev, unit: Array.from(v.sides).sort().join(','), severity: v.sev });
    }
    metrics.push({ key: `measure_${code}`, value: v.measure, unit: v.unit, severity: v.sev });
  });

  Array.from(new Set(warnings)).forEach((msg, i) => {
    metrics.push({ key: `warning_${i + 1}`, value: 1, unit: msg, severity: 1 });
  });

  return { findings, metrics, posesDetected, photosAnalyzed: photos.length, warnings };
}

export default { runPoseAnalysisOnPhotos };
