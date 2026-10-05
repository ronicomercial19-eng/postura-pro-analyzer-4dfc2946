// Banco de Wells (sentar e alcancar): classificacao por sexo e faixa etaria.
// ATENCAO: valores de REFERENCIA do sistema (adaptados de normas amplamente citadas, ex.: ACSM/Wells-Dillon).
// Variam conforme o banco (apoio dos pes em 23 cm ou 26 cm) e o protocolo. O profissional deve conferir
// com o protocolo que adota. O valor digitado e a leitura na regua.

export type WellsSex = 'M' | 'F';
export const WELLS_LABELS = ['Fraco', 'Regular', 'Médio', 'Bom', 'Excelente'] as const;
export type WellsLabel = (typeof WELLS_LABELS)[number];

export const WELLS_AGE_GROUPS = ['até 29 anos', '30 a 39', '40 a 49', '50 a 59', '60 ou mais'];

// Limites SUPERIORES (cm, inclusivos) de Fraco, Regular, Médio, Bom. Acima do ultimo = Excelente.
const TABLE: Record<WellsSex, [number, number, number, number][]> = {
  M: [[24, 29, 33, 38], [23, 28, 32, 37], [19, 25, 29, 34], [17, 23, 27, 32], [14, 20, 24, 29]],
  F: [[28, 32, 36, 40], [27, 31, 35, 39], [24, 29, 33, 37], [22, 27, 31, 35], [19, 24, 28, 32]],
};

export function wellsAgeGroup(age: number): number {
  if (age < 30) return 0;
  if (age < 40) return 1;
  if (age < 50) return 2;
  if (age < 60) return 3;
  return 4;
}

export function classifyWells(sex: WellsSex, age: number, cm: number): { label: WellsLabel; group: number; bounds: [number, number, number, number] } {
  const group = wellsAgeGroup(age);
  const b = TABLE[sex][group];
  const label: WellsLabel = cm <= b[0] ? 'Fraco' : cm <= b[1] ? 'Regular' : cm <= b[2] ? 'Médio' : cm <= b[3] ? 'Bom' : 'Excelente';
  return { label, group, bounds: b };
}
