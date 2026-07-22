export interface Hierarquia {
  livro: string;
  titulo: string;
  capitulo: string;
  secao: string;
  subsecao: string;
}

export interface Dispositivo {
  idCanonico: string;
  numeroArtigo: number;
  hierarquia: Hierarquia;
  texto: string;
  hashSha256: string;
  paginas: number[];
  remissoesExternas: string[];
  remissoesInternas: number[];
}

export interface RelatorioAuditoria {
  totalArtigos: number;
  sequenciaCompleta: boolean;
  duplicados: number[];
  faltando: number[];
  artigosSemHierarquia: number[];
  tamanhoChars: { min: number; mediana: number; p95: number; max: number };
  headingsSumario: number;
  headingsNaoEncontradosNoCorpo: string[];
  tabelasNaoEncontradasNosAnexos: string[];
  remissoesExternasTotal: number;
  remissoesInternasTotal: number;
  anexosDetectados: string[];
  linhasAnexosSegregadas: number;
  avisosMonotonicidade: string[];
  aprovavel: boolean;
}

export interface Mensagem {
  role: "user" | "assistant";
  content: string;
  dispositivos?: any[];
  referenciados?: any[];
  rota?: string;
}
