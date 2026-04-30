import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, Image as ImageIcon, MapPin, Eye, AlertCircle, Check, ArrowDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

export const TERMS_CONSENT_VERSION = '2026-04-30';

const SCROLL_TOLERANCE_PX = 24;

export default function TermsConsentModal({ onAccepted }: { onAccepted: () => void }) {
  const { user, signOut } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceToBottom <= SCROLL_TOLERANCE_PX) setReachedBottom(true);
    };

    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const handleAccept = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('user_consents').insert({
        auth_id: user.id,
        email: user.email ?? null,
        consent_version: TERMS_CONSENT_VERSION,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (insertError && insertError.code !== '23505') {
        throw insertError;
      }
      onAccepted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar o aceite. Tente novamente.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="terms-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] flex flex-col bg-slate-900 sm:rounded-3xl border-0 sm:border border-slate-800 overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-5 py-4 sm:px-7 sm:py-5 border-b border-slate-800 flex items-start gap-3 shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-black text-lg leading-tight">
                Termos de Uso, Privacidade e Compartilhamento de Dados
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Versão {TERMS_CONSENT_VERSION} · Em conformidade com a LGPD (Lei nº 13.709/2018)
              </p>
            </div>
          </div>

          {/* Conteúdo rolável */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 text-slate-200 text-sm leading-relaxed space-y-5"
          >
            <p className="text-slate-300">
              Antes de continuar, leia com atenção os termos abaixo. Ao tocar em <strong className="text-white">Concordo</strong>,
              você declara estar ciente e de acordo com as condições de uso da plataforma <strong className="text-white">Braska</strong>.
            </p>

            {/* Resumo visual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-start gap-2.5">
                <ImageIcon className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold">Uso de imagem</p>
                  <p className="text-slate-400 text-xs">Sua foto pode ser exibida no app, ranking e cards.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold">Localização</p>
                  <p className="text-slate-400 text-xs">Usada para validar presença na quadra (geofencing).</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-start gap-2.5">
                <Eye className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold">Visualização pública</p>
                  <p className="text-slate-400 text-xs">Nome, estatísticas e ranking são visíveis a outros atletas.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold">Não vendemos seus dados</p>
                  <p className="text-slate-400 text-xs">Não compartilhamos nem comercializamos dados pessoais.</p>
                </div>
              </div>
            </div>

            <section>
              <h3 className="text-white font-bold text-base mb-2">1. Quem somos</h3>
              <p>
                A Braska é uma plataforma de gestão de quadras de basquete que oferece fila automática, placar ao vivo,
                ranking persistente, estatísticas individuais, eventos e torneios. Estes termos aplicam-se a todos os
                usuários (atletas, gestores e visitantes) que acessam o aplicativo.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">2. Aceitação dos termos</h3>
              <p>
                Ao criar uma conta, fazer login ou continuar usando o aplicativo, você concorda integralmente com este
                documento. Caso não concorde com qualquer cláusula, encerre o uso e exclua sua conta antes de prosseguir.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">3. Dados coletados</h3>
              <p>Coletamos apenas o necessário para o funcionamento do app:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Cadastro:</strong> nome de exibição, e-mail, senha (criptografada) e país.</li>
                <li><strong className="text-white">Imagem:</strong> foto de perfil enviada por você e, eventualmente, fotos de eventos.</li>
                <li><strong className="text-white">Localização:</strong> usada apenas para confirmar presença em quadra (geofencing) — não rastreamos sua localização em segundo plano.</li>
                <li><strong className="text-white">Estatísticas:</strong> pontos, vitórias, assistências, rebotes, eficiência e demais métricas geradas pelo seu uso.</li>
                <li><strong className="text-white">Dispositivo:</strong> dados técnicos básicos (user-agent, idioma, fuso) para suporte e segurança.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">4. Consentimento de uso de imagem</h3>
              <p>
                Ao enviar sua foto e/ou participar de partidas, eventos e torneios na plataforma, você autoriza, de
                forma gratuita e por prazo indeterminado, o uso da sua imagem dentro do aplicativo Braska, em:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>perfil pessoal e card de atleta;</li>
                <li>rankings, estatísticas e destaques de sessão;</li>
                <li>cards e placar ao vivo do local em que você joga;</li>
                <li>eventos e torneios em que você se inscrever.</li>
              </ul>
              <p className="mt-2">
                Você pode revogar esse consentimento a qualquer momento removendo sua foto pelo perfil ou solicitando
                a exclusão da conta — situações em que sua imagem deixa de ser exibida.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">5. Visibilidade pública</h3>
              <p>
                Para que o ranking, a fila e o placar funcionem em comunidade, alguns dados são <strong className="text-white">públicos por natureza</strong> e
                podem ser vistos por outros atletas e visitantes do local:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>nome de exibição;</li>
                <li>foto de perfil (quando enviada);</li>
                <li>cidade/local em que joga e bandeira do país;</li>
                <li>estatísticas, vitórias, pontuação e posição no ranking;</li>
                <li>cards públicos compartilháveis quando você gerar um.</li>
              </ul>
              <p className="mt-2">
                Dados sensíveis (e-mail, senha, telefone, dados de pagamento, geolocalização precisa) <strong className="text-white">nunca</strong> são exibidos publicamente.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">6. Compartilhamento de dados</h3>
              <p>
                <strong className="text-white">Não vendemos, alugamos nem compartilhamos seus dados pessoais</strong> com terceiros para fins
                de marketing ou publicidade. Compartilhamos dados estritamente quando necessário para a operação do serviço:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>provedor de infraestrutura (Supabase) para armazenar sua conta e estatísticas;</li>
                <li>processador de pagamentos (Mercado Pago) apenas quando você assina um plano;</li>
                <li>autoridades públicas, mediante ordem judicial ou requisição legal.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">7. Bases legais (LGPD)</h3>
              <p>O tratamento dos seus dados ocorre com fundamento nas seguintes bases legais (art. 7º da LGPD):</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Consentimento</strong> — para uso de imagem e exibição pública de perfil.</li>
                <li><strong className="text-white">Execução de contrato</strong> — para operar a conta, ranking e assinaturas.</li>
                <li><strong className="text-white">Legítimo interesse</strong> — para segurança, prevenção de fraude e melhoria do serviço.</li>
                <li><strong className="text-white">Cumprimento de obrigação legal</strong> — quando exigido por lei.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">8. Seus direitos como titular</h3>
              <p>A LGPD garante a você, a qualquer momento, os direitos de:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>confirmar a existência de tratamento dos seus dados;</li>
                <li>acessar, corrigir ou atualizar dados incompletos ou desatualizados;</li>
                <li>solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>solicitar a portabilidade dos dados;</li>
                <li>revogar este consentimento a qualquer momento;</li>
                <li>solicitar a exclusão definitiva da sua conta.</li>
              </ul>
              <p className="mt-2">
                Para exercer qualquer direito, entre em contato pelo e-mail de suporte exibido na página de cada local
                ou em <span className="text-orange-300">contato@braska.app</span>. Responderemos em até 15 dias úteis.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">9. Segurança e retenção</h3>
              <p>
                Adotamos medidas técnicas e administrativas para proteger seus dados (criptografia em trânsito,
                isolamento por linha — RLS, controle de acesso). Mantemos os dados pelo tempo necessário ao
                cumprimento das finalidades aqui descritas e às obrigações legais. Após exclusão da conta, dados
                podem ser mantidos de forma anonimizada para fins estatísticos.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">10. Conduta do usuário</h3>
              <p>
                Você é responsável pelas informações que cadastra. É proibido publicar conteúdo ilícito, ofensivo,
                discriminatório, que infrinja direitos de terceiros ou que utilize a imagem de outras pessoas sem
                autorização. Contas que violarem estas regras podem ser suspensas ou excluídas.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">11. Alterações destes termos</h3>
              <p>
                Podemos atualizar este documento. Quando houver mudança relevante, exibiremos esta tela novamente
                para que você possa rever e aceitar a nova versão antes de continuar usando a plataforma.
              </p>
            </section>

            <section>
              <h3 className="text-white font-bold text-base mb-2">12. Foro</h3>
              <p>
                Estes termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio do usuário para
                dirimir quaisquer controvérsias decorrentes deste instrumento.
              </p>
            </section>

            <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-orange-300 mt-0.5 shrink-0" />
              <p className="text-orange-100 text-xs">
                Ao tocar em <strong>Concordo</strong> abaixo, você confirma ter lido integralmente este documento e
                consente com o tratamento dos seus dados nos termos descritos, inclusive com o uso da sua imagem na
                plataforma.
              </p>
            </div>

            <p id="terms-end" className="text-center text-xs text-slate-500 pt-2">— fim dos termos —</p>
          </div>

          {/* Rodapé com CTA */}
          <div className="border-t border-slate-800 px-5 sm:px-7 py-4 bg-slate-950/80 backdrop-blur shrink-0 space-y-3">
            {!reachedBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <ArrowDown className="w-4 h-4" /> Role até o final para habilitar o botão
              </button>
            )}

            {error && (
              <div className="flex items-start gap-2 text-red-300 text-xs bg-red-500/15 border border-red-500/25 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => signOut()}
                className="flex-1 py-3 rounded-xl font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all text-sm"
              >
                Não concordo e sair
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={!reachedBottom || submitting}
                className="flex-[2] py-3 rounded-xl font-bold text-white text-sm bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Concordo e quero continuar
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
