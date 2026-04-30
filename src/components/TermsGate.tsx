import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import TermsConsentModal, { TERMS_CONSENT_VERSION } from './TermsConsentModal';

type ConsentStatus = 'unknown' | 'accepted' | 'pending';

export default function TermsGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  const [status, setStatus] = useState<ConsentStatus>('unknown');

  useEffect(() => {
    if (loading) return;

    if (!user || isGuest) {
      setStatus('accepted');
      return;
    }

    let cancelled = false;
    setStatus('unknown');

    supabase
      .from('user_consents')
      .select('id')
      .eq('auth_id', user.id)
      .eq('consent_version', TERMS_CONSENT_VERSION)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== 'PGRST116') {
          // Em caso de falha de leitura, evita travar o app — assume aceito.
          setStatus('accepted');
          return;
        }
        setStatus(data ? 'accepted' : 'pending');
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, isGuest]);

  return (
    <>
      {children}
      {status === 'pending' && (
        <TermsConsentModal onAccepted={() => setStatus('accepted')} />
      )}
    </>
  );
}
