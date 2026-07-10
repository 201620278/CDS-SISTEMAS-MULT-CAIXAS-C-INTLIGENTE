/**
 * Testes — DANFE NFC-e com todos os produtos da venda
 * Executar: node tests/fiscal/danfe-itens-venda.test.js
 */

const assert = require('assert');
const {
  gerarDanfeHtml,
  obterQuantidadeImpressao,
  obterValorImpressao,
  obterQuantidadeFiscalDanfe,
  obterValorFiscalItemDanfe
} = require('../../backend/services/fiscal/danfe');

let passou = 0;
let falhou = 0;

function test(nome, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passou += 1;
      console.log(`  OK  ${nome}`);
    })
    .catch((error) => {
      falhou += 1;
      console.error(`  FALHOU  ${nome}`);
      console.error(`         ${error.message}`);
    });
}

const itemArroz = {
  produto_nome: 'Arroz',
  quantidade_fiscal: 1,
  quantidade_nao_fiscal: 0,
  valor_fiscal: 10,
  valor_nao_fiscal: 0,
  preco_unitario: 10
};

const itemRefrigerante = {
  produto_nome: 'Refrigerante',
  quantidade_fiscal: 0,
  quantidade_nao_fiscal: 1,
  valor_fiscal: 0,
  valor_nao_fiscal: 5,
  preco_unitario: 5
};

async function main() {
  console.log('\n=== Testes DANFE — todos os produtos da venda ===\n');

  await test('obterQuantidadeImpressao soma fiscal + não fiscal', async () => {
    assert.strictEqual(obterQuantidadeImpressao(itemArroz), 1);
    assert.strictEqual(obterQuantidadeImpressao(itemRefrigerante), 1);
    assert.strictEqual(obterQuantidadeImpressao({
      quantidade_fiscal: 2,
      quantidade_nao_fiscal: 3
    }), 5);
  });

  await test('obterValorImpressao soma fiscal + não fiscal', async () => {
    assert.strictEqual(obterValorImpressao(itemArroz), 10);
    assert.strictEqual(obterValorImpressao(itemRefrigerante), 5);
  });

  await test('helpers fiscais permanecem inalterados', async () => {
    assert.strictEqual(obterQuantidadeFiscalDanfe(itemRefrigerante), 0);
    assert.strictEqual(obterValorFiscalItemDanfe(itemRefrigerante), 0);
    assert.strictEqual(obterValorFiscalItemDanfe(itemArroz), 10);
  });

  await test('DANFE lista Arroz e Refrigerante', async () => {
    const html = await gerarDanfeHtml({
      venda: { total: 15, desconto: 0, valor_fiscal: 10 },
      itens: [itemArroz, itemRefrigerante],
      itensFiscal: [itemArroz],
      empresa: { nome: 'Loja Teste', cnpj: '65957340000150', endereco: 'Rua A' },
      chave: '35260112345678000199550010000000011000000001',
      numero: 1,
      serie: 1,
      qrCodeUrl: '',
      tributos: { vICMS: 1, vPIS: 0.5, vCOFINS: 0.5 },
      nota: { tpAmb: 1 }
    });

    assert.ok(html.includes('Arroz'), 'deve conter Arroz');
    assert.ok(html.includes('Refrigerante'), 'deve conter Refrigerante');
    assert.ok(!html.includes('Não Fiscal'), 'sem rótulo não fiscal');
    assert.ok(!html.includes('Fiscal'), 'sem rótulo fiscal');
    assert.ok(html.includes('Total: R$ 15.00'), 'total da venda completa');
    assert.ok(html.includes('ICMS: R$ 1.00'), 'tributos fiscais preservados');
    assert.ok(html.includes('35260112345678000199550010000000011000000001'), 'chave preservada');
  });

  await test('DANFE não inclui Refrigerante quando só itens fiscais passados (legado)', async () => {
    const html = await gerarDanfeHtml({
      venda: { total: 10, valor_fiscal: 10 },
      itens: [itemArroz],
      itensFiscal: [itemArroz],
      empresa: { nome: 'Loja', cnpj: '65957340000150', endereco: '' },
      chave: 'CHAVE123',
      numero: 2,
      serie: 1,
      qrCodeUrl: '',
      tributos: null,
      nota: { tpAmb: 1 }
    });

    assert.ok(html.includes('Arroz'));
    assert.ok(!html.includes('Refrigerante'));
  });

  console.log(`\nResultado: ${passou} passou, ${falhou} falhou\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
