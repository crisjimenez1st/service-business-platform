import OneFlowMark from './OneFlowMark';

/**
 * Logotipo OneFlow Med. El texto usa el degradado de marca; "Med" va en
 * un tono sólido para distinguir la línea médica.
 */
export default function OneFlowLogo({
  size = 'md',
  tagline,
}: {
  size?: 'sm' | 'md' | 'lg';
  tagline?: string;
}) {
  const text = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }[size];
  const mark = { sm: 24, md: 34, lg: 52 }[size];
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        <OneFlowMark size={mark} />
        <span className={`${text} font-brand font-bold tracking-tight leading-none`}>
          <span className="bg-gradient-to-r from-[#0066FF] via-[#00D1C1] to-[#8A3FFC] bg-clip-text text-transparent">
            OneFlow
          </span>
          <span className="text-slate-900 font-semibold"> Med</span>
        </span>
      </div>
      {tagline && <p className="text-sm text-slate-500 mt-2 text-center">{tagline}</p>}
    </div>
  );
}
