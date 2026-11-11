// Selo 9 provisório (hexágono + 9). Trocar pelo arquivo oficial do brand book quando disponível.
const NineMark = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 2 28 9v14L16 30 4 23V9L16 2Z" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />
    <text x="16" y="21.5" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="15" className="fill-primary">9</text>
  </svg>
);

export default NineMark;
