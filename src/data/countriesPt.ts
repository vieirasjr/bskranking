/** Países (ISO 3166-1 alpha-2) com nome em português — lista para cadastro de origem. */
export const COUNTRIES_PT: { code: string; name: string }[] = [
  { code: 'BR', name: 'Brasil' },
  { code: 'PT', name: 'Portugal' },
  { code: 'AO', name: 'Angola' },
  { code: 'MZ', name: 'Moçambique' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'ST', name: 'São Tomé e Príncipe' },
  { code: 'GW', name: 'Guiné-Bissau' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'AR', name: 'Argentina' },
  { code: 'UY', name: 'Uruguai' },
  { code: 'PY', name: 'Paraguai' },
  { code: 'CL', name: 'Chile' },
  { code: 'BO', name: 'Bolívia' },
  { code: 'CO', name: 'Colômbia' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'PE', name: 'Peru' },
  { code: 'EC', name: 'Equador' },
  { code: 'MX', name: 'México' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'CA', name: 'Canadá' },
  { code: 'ES', name: 'Espanha' },
  { code: 'FR', name: 'França' },
  { code: 'IT', name: 'Itália' },
  { code: 'DE', name: 'Alemanha' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'IE', name: 'Irlanda' },
  { code: 'NL', name: 'Países Baixos' },
  { code: 'BE', name: 'Bélgica' },
  { code: 'CH', name: 'Suíça' },
  { code: 'AT', name: 'Áustria' },
  { code: 'PL', name: 'Polônia' },
  { code: 'UA', name: 'Ucrânia' },
  { code: 'RU', name: 'Rússia' },
  { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japão' },
  { code: 'KR', name: 'Coreia do Sul' },
  { code: 'AU', name: 'Austrália' },
  { code: 'NZ', name: 'Nova Zelândia' },
  { code: 'ZA', name: 'África do Sul' },
  { code: 'NG', name: 'Nigéria' },
  { code: 'EG', name: 'Egito' },
  { code: 'MA', name: 'Marrocos' },
  { code: 'SN', name: 'Senegal' },
  { code: 'CU', name: 'Cuba' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'PR', name: 'Porto Rico' },
  { code: 'PA', name: 'Panamá' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'NI', name: 'Nicarágua' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'TT', name: 'Trinidad e Tobago' },
  { code: 'IN', name: 'Índia' },
  { code: 'PH', name: 'Filipinas' },
  { code: 'XX', name: 'Outro / não listado' },
];

function sortCountriesPt(list: { code: string; name: string }[]) {
  return [...list].sort((a, b) => {
    if (a.code === 'BR') return -1;
    if (b.code === 'BR') return 1;
    if (a.code === 'XX') return 1;
    if (b.code === 'XX') return -1;
    return a.name.localeCompare(b.name, 'pt');
  });
}

export const COUNTRIES_PT_SORTED = sortCountriesPt(COUNTRIES_PT);
