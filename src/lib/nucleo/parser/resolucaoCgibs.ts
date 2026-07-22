// nucleo/parser/resolucaoCgibs.ts — porta fiel de nucleo/parser/resolucao_cgibs.py.
//
// Implementa as CINCO DEFESAS do parser hierárquico de Resoluções CGIBS:
//  D1 — Guarda de monotonicidade na abertura de artigos.
//  D2 — Junção de headings (e entradas de sumário) quebrados em duas linhas.
//  D3 — Corte e segregação de anexos ao encontrar "ANEXO ...".
//  D4 — Sensibilidade a maiúsculas em Seção/Subseção (evita falsos headings).
//  D5 — Validação estrutural contra o sumário, usado como gabarito.
import { sha256Hex } from "../hash";
import type { Dispositivo, Hierarquia, RelatorioAuditoria } from "../types";
import { extrairLinhas } from "./pdfLinhas";

const RX_SUMARIO_LINHA = /\.{4,}\s*\d+\s*$/;
const RX_LIVRO = /^(LIVRO\s+[IVXLCDM]+\b.*)$/;
const RX_TITULO = /^(TÍTULO\s+[IVXLCDM]+\b.*)$/;
const RX_CAPITULO = /^(CAPÍTULO\s+[IVXLCDM]+\b.*)$/;
const RX_SECAO = /^(Seção\s+[IVXLCDM]+\b.*)$/; // D4: case-sensitive
const RX_SUBSECAO = /^(Subseção\s+[IVXLCDM]+\b.*)$/; // D4: case-sensitive
const RX_ARTIGO = /^Art\.\s+(\d{1,3})(?:[ºo]|\.)?(?:-([A-Z]))?\s/;
const RX_ANEXO = /^ANEXO\s+[IVXLCDM]+\b/;
const RX_PAGINA = /^\d{1,3}$/;
const RX_REF_EXT = /\((Arts?\.\s*[^)]*?(?:LC\s*(?:nº\s*)?\d{3}\/\d{4}|Constitui[çc]ão Federal)[^)]*)\)/g;
const RX_REF_INT = /\bart(?:s)?\.\s*(\d{1,3})/gi;

const NIVEIS = ["livro", "titulo", "capitulo", "secao", "subsecao"] as const;
type Nivel = (typeof NIVEIS)[number];
const PADROES_HIERARQUIA: [Nivel, RegExp][] = [
  ["livro", RX_LIVRO],
  ["titulo", RX_TITULO],
  ["capitulo", RX_CAPITULO],
  ["secao", RX_SECAO],
  ["subsecao", RX_SUBSECAO],
];

function normalizar(s: string): string {
  const semAcento = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return semAcento.replace(/\s+/g, " ").trim().toUpperCase();
}

interface EntradaSumario {
  texto: string;
  norm: string;
}

function parsearSumario(linhas: [number, string][]): EntradaSumario[] {
  const sumario: EntradaSumario[] = [];
  let emSumario = false;
  let pendente: string | null = null;
  for (const [, linha] of linhas) {
    if (linha.toUpperCase() === "SUMÁRIO") {
      emSumario = true;
      continue;
    }
    if (!emSumario) continue;
    if (RX_ARTIGO.test(linha) || linha.startsWith("RESOLVE") || linha.startsWith("O COMITÊ")) break;
    if (RX_PAGINA.test(linha)) continue;
    if (RX_SUMARIO_LINHA.test(linha)) {
      let entrada = linha.replace(RX_SUMARIO_LINHA, "").trim();
      if (pendente) {
        entrada = pendente + " " + entrada; // D2 no sumário
        pendente = null;
      }
      sumario.push({ texto: entrada, norm: normalizar(entrada) });
    } else {
      pendente = pendente ? pendente + " " + linha : linha;
    }
  }
  return sumario;
}

export async function parsear(
  conteudoPdf: Uint8Array,
  siglaDocumento: string,
  _dataPublicacao: string
): Promise<{ dispositivos: Dispositivo[]; anexos: Record<string, string>; relatorio: RelatorioAuditoria }> {
  const linhas = await extrairLinhas(conteudoPdf);
  const sumario = parsearSumario(linhas);
  const gabaritoHeadings = sumario.filter((e) => !["ANEXO", "RESOLUCAO", "TABELA"].some((p) => e.norm.startsWith(p)));
  const gabaritoTabelas = sumario.filter((e) => e.norm.startsWith("TABELA"));

  const estado: Hierarquia = { livro: "", titulo: "", capitulo: "", secao: "", subsecao: "" };
  const dispositivos: Dispositivo[] = [];
  let atual: { numero: number; hierarquia: Hierarquia } | null = null;
  let buffer: string[] = [];
  let paginasArtigo = new Set<number>();
  const avisos: string[] = [];
  let ultimoNumero = 0;
  let headingAberto: Nivel | null = null;
  let emAnexos = false;
  let anexoAtual: string | null = null;
  const anexosBrutos: Record<string, string[]> = {};

  async function fecharArtigo() {
    if (atual !== null) {
      const texto = buffer.join(" ").replace(/\s+/g, " ").trim();
      const refsExt = [...texto.matchAll(RX_REF_EXT)].map((m) => m[1]);
      const textoSemExt = texto.replace(RX_REF_EXT, "");
      const numerosInternos = new Set<number>();
      for (const m of textoSemExt.matchAll(RX_REF_INT)) {
        const n = Number(m[1]);
        if (n !== atual.numero && n > 0 && n <= 999) numerosInternos.add(n);
      }
      dispositivos.push({
        idCanonico: `${siglaDocumento}-ART${String(atual.numero).padStart(3, "0")}`,
        numeroArtigo: atual.numero,
        hierarquia: { ...atual.hierarquia },
        texto,
        hashSha256: await sha256Hex(texto),
        paginas: [...paginasArtigo].sort((a, b) => a - b),
        remissoesExternas: refsExt,
        remissoesInternas: [...numerosInternos].sort((a, b) => a - b),
      });
    }
    atual = null;
    buffer = [];
    paginasArtigo = new Set();
  }

  for (const [pagina, linha] of linhas) {
    if (RX_SUMARIO_LINHA.test(linha) || linha.toUpperCase() === "SUMÁRIO") continue;
    if (RX_PAGINA.test(linha)) continue;

    // D3 — entrada nos anexos encerra a captura de artigos.
    if (ultimoNumero > 0 && RX_ANEXO.test(linha)) {
      if (!emAnexos) {
        await fecharArtigo();
        emAnexos = true;
      }
      anexoAtual = linha;
      anexosBrutos[anexoAtual] = [];
      continue;
    }
    if (emAnexos) {
      anexosBrutos[anexoAtual!].push(linha);
      continue;
    }

    let casouHeading = false;
    for (const [nivel, rx] of PADROES_HIERARQUIA) {
      const m = rx.exec(linha);
      if (m) {
        const indice = NIVEIS.indexOf(nivel);
        estado[nivel] = m[1];
        for (const filho of NIVEIS.slice(indice + 1)) estado[filho] = "";
        headingAberto = nivel;
        casouHeading = true;
        break;
      }
    }
    if (casouHeading) continue;

    const mArt = RX_ARTIGO.exec(linha);

    // D2 — linha entre um heading e o próximo elemento estrutural é continuação do heading.
    if (headingAberto && !mArt) {
      estado[headingAberto] += " " + linha;
      continue;
    }
    headingAberto = null;

    // D1 — guarda de monotonicidade.
    if (mArt) {
      const numero = Number(mArt[1]);
      if (numero === ultimoNumero + 1) {
        await fecharArtigo();
        atual = { numero, hierarquia: { ...estado } };
        ultimoNumero = numero;
        buffer.push(linha);
        paginasArtigo.add(pagina);
        continue;
      }
      avisos.push(
        `p.${pagina}: 'Art. ${numero}' fora de sequência (esperado ${ultimoNumero + 1}) — tratado como corpo de texto`
      );
    }

    if (atual !== null) {
      buffer.push(linha);
      paginasArtigo.add(pagina);
    }
  }
  await fecharArtigo();

  // ─── D5 — Auditoria estrutural ───
  const numeros = dispositivos.map((d) => d.numeroArtigo);
  const contagem = new Map<number, number>();
  for (const n of numeros) contagem.set(n, (contagem.get(n) ?? 0) + 1);
  const duplicados = [...contagem.entries()]
    .filter(([, c]) => c > 1)
    .map(([n]) => n)
    .sort((a, b) => a - b);
  const maxNumero = numeros.length ? Math.max(...numeros) : 0;
  const presentes = new Set(numeros);
  const faltando: number[] = [];
  for (let n = 1; n <= maxNumero; n++) if (!presentes.has(n)) faltando.push(n);

  const tamanhos = dispositivos.map((d) => d.texto.length).sort((a, b) => a - b);
  if (!tamanhos.length) tamanhos.push(0);
  const semHierarquia = dispositivos
    .filter((d) => !NIVEIS.some((n) => d.hierarquia[n]) && d.numeroArtigo !== 1)
    .map((d) => d.numeroArtigo);

  const headingsCorpo = new Set<string>();
  for (const d of dispositivos) for (const n of NIVEIS) if (d.hierarquia[n]) headingsCorpo.add(normalizar(d.hierarquia[n]));
  const headingsNaoEncontrados = gabaritoHeadings.map((e) => e.norm).filter((n) => !headingsCorpo.has(n)).sort();

  const textoAnexosNorm = normalizar(Object.values(anexosBrutos).flat().join(" "));
  const tabelasNaoEncontradas = gabaritoTabelas.filter((e) => !textoAnexosNorm.includes(e.norm)).map((e) => e.texto);

  const aprovavel =
    !duplicados.length && !faltando.length && !semHierarquia.length && !headingsNaoEncontrados.length && !tabelasNaoEncontradas.length;

  const p95Index = tamanhos.length > 1 ? Math.floor(tamanhos.length * 0.95) : 0;
  const relatorio: RelatorioAuditoria = {
    totalArtigos: dispositivos.length,
    sequenciaCompleta: !faltando.length && !duplicados.length,
    duplicados,
    faltando,
    artigosSemHierarquia: semHierarquia,
    tamanhoChars: {
      min: tamanhos[0],
      mediana: tamanhos[Math.floor(tamanhos.length / 2)],
      p95: tamanhos[p95Index],
      max: tamanhos[tamanhos.length - 1],
    },
    headingsSumario: gabaritoHeadings.length,
    headingsNaoEncontradosNoCorpo: headingsNaoEncontrados,
    tabelasNaoEncontradasNosAnexos: tabelasNaoEncontradas,
    remissoesExternasTotal: dispositivos.reduce((s, d) => s + d.remissoesExternas.length, 0),
    remissoesInternasTotal: dispositivos.reduce((s, d) => s + d.remissoesInternas.length, 0),
    anexosDetectados: Object.keys(anexosBrutos),
    linhasAnexosSegregadas: Object.values(anexosBrutos).reduce((s, v) => s + v.length, 0),
    avisosMonotonicidade: avisos,
    aprovavel,
  };
  const anexos: Record<string, string> = {};
  for (const [rotulo, ls] of Object.entries(anexosBrutos)) anexos[rotulo] = ls.join("\n");

  return { dispositivos, anexos, relatorio };
}
