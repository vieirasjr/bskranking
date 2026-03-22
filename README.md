<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/183efefa-0ddd-48e2-b6de-9b071acc0e29

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL` – URL do seu projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` – Chave anon do Supabase

3. Run the app:
   ```bash
   npm run dev
   ```

### Supabase

O app usa Supabase para banco de dados, auth e tempo real.

- **Tabelas:** `players`, `stats`, `session`, `partida_sessoes` — use `supabase/setup_completo.sql`. Se já tiver o banco, execute `supabase/add_partida_sessoes.sql` para a tabela de sessões de partida.
- **Auth sem confirmação de e-mail:** em **Dashboard > Authentication > Providers > Email**, desative a opção "Confirm email" para login imediato.
- **Realtime (lista em tempo real):** a tabela `players` precisa estar na publicação. Execute `supabase/enable_realtime.sql` ou em **Dashboard > Database > Replication** adicione `players` e `session` à publicação `supabase_realtime`.
# bsknext
# bsknext
