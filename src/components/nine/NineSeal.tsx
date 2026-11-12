import NineMark from '@/components/nine/NineMark';

/** Selo NINE HEALTH TECH: marca + nome em duas linhas. */
const NineSeal = ({ size = 36 }: { size?: number }) => (
  <div className="flex items-center gap-3" role="img" aria-label="NINE Health Tech">
    <NineMark size={size} />
    <div className="leading-none">
      <p className="font-heading text-lg font-bold tracking-[0.28em]">NINE</p>
      <p className="mt-1 font-heading text-[10px] font-semibold tracking-[0.32em] text-brand">HEALTH TECH</p>
    </div>
  </div>
);

export default NineSeal;
