import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import ProShareCard, { type ProShareCardData } from '../components/ProShareCard';

export default function ProCardPublicPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<ProShareCardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('pro_cards')
        .select('snapshot, status')
        .eq('share_slug', slug)
        .maybeSingle();
      if (cancelled) return;
      const status = (data as { status?: string } | null)?.status;
      if (!data || !['approved', 'published'].includes(status ?? '')) {
        setCard(null);
        setLoading(false);
        return;
      }
      const snapshot = (data as { snapshot?: ProShareCardData }).snapshot;
      setCard(snapshot ?? null);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#060b1a] text-white">
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : card ? (
          <ProShareCard data={card} />
        ) : (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-300">
            Card não encontrado ou indisponível.
          </div>
        )}
      </main>
    </div>
  );
}
