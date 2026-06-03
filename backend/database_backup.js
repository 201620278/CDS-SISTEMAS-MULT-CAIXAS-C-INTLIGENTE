const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// ================================
// RESOLUÇÃO DO CAMINHO DO BANCO
// ================================

// 1. Se vier do Electron, usa a variável de ambiente DB_DIR
// 2. Se não vier, continua usando a pasta local do projeto (modo desenvolvimento)

const defaultDbDir = path.resolve(__dirname, '..', 'dados');

function obterDiretorioBanco() {
  const dbDirFromEnv = process.env.DB_DIR;

  if (dbDirFromEnv && dbDirFromEnv.trim() !== '') {
    return dbDirFromEnv;
  }

  // Caminho oficial do banco: pasta dados no diretório raiz do projeto
  return defaultDbDir;
}

const dbDir = obterDiretorioBanco();
const dbPath = path.join(dbDir, 'mercadao.db');

// Garante que a pasta exista
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Pasta do banco criada em:', dbDir);
}

console.log('Banco SQLite em uso:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    inicializarBanco();
  }
});

db.dbDir = dbDir;
db.dbPath = dbPath;

db.all("PRAGMA table_info(produtos)", [], (err, columns) => {
  if (err) return console.error(err);

  const colunas = columns.map(c => c.name);

  if (!colunas.includes('vendido_por_peso')) {
    db.run("ALTER TABLE produtos ADD COLUMN vendido_por_peso INTEGER DEFAULT 0");
  }

  if (!colunas.includes('unidade_venda')) {
    db.run("ALTER TABLE produtos ADD COLUMN unidade_venda TEXT DEFAULT 'UN'");
  }
});

function aplicarAlteracaoSegura(tabela, sql) {
  db.run(sql, (err) => {
    if (err) {
      const mensagem = err.message || ''
      if (
        mensagem.includes('duplicate column name') ||
        mensagem.includes('already exists')
      ) {
        return;
      }
      console.error(`Erro ao executar alteração em ${tabela}: ${sql}`, err);
      return;
    }
    console.log(`Alteração aplicada em ${tabela}: ${sql}`);
  });
}

function aplicarAlteracoesPosCriacao() {
  aplicarAlteracaoSegura('categorias', `ALTER TABLE categorias ADD COLUMN tipo TEXT DEFAULT 'produto'`);

  const alteracoesProdutos = [
    `ALTER TABLE produtos ADD COLUMN categoria_id INTEGER`,
    `ALTER TABLE produtos ADD COLUMN subcategoria_id INTEGER`,
    `ALTER TABLE produtos ADD COLUMN ncm TEXT`,
    `ALTER TABLE produtos ADD COLUMN cfop TEXT`,
    `ALTER TABLE produtos ADD COLUMN csosn TEXT`,
    `ALTER TABLE produtos ADD COLUMN origem INTEGER DEFAULT 0`,
    `ALTER TABLE produtos ADD COLUMN cest TEXT`,
    `ALTER TABLE produtos ADD COLUMN codigo_barras TEXT`,
    `ALTER TABLE produtos ADD COLUMN aliquota_icms REAL DEFAULT 0`,
    `ALTER TABLE produtos ADD COLUMN aliquota_pis REAL DEFAULT 0`,
    `ALTER TABLE produtos ADD COLUMN aliquota_cofins REAL DEFAULT 0`,
    `ALTER TABLE produtos ADD COLUMN lucro_percentual DECIMAL(10,2)`,
    `ALTER TABLE produtos ADD COLUMN vendido_por_peso INTEGER DEFAULT 0`,
    `ALTER TABLE produtos ADD COLUMN unidade_venda TEXT DEFAULT 'UN'`,
    `ALTER TABLE produtos ADD COLUMN peso_peca DECIMAL(10,3) DEFAULT 0`,
    `ALTER TABLE produtos ADD COLUMN preco_kg DECIMAL(10,2) DEFAULT 0`
  ];

  const alteracoesVendas = [
    `ALTER TABLE vendas ADD COLUMN valor_recebido DECIMAL(10,2)`,
    `ALTER TABLE vendas ADD COLUMN valor_inicial_caixa DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE vendas ADD COLUMN sangria DECIMAL(10,2) DEFAULT 0`
  ];

  alteracoesProdutos.forEach(sql => aplicarAlteracaoSegura('produtos', sql));
  alteracoesVendas.forEach(sql => aplicarAlteracaoSegura('vendas', sql));
}

function criarTabelas() {
  db.serialize(() => {
    // Tabela de categorias
    db.run(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        tipo TEXT NOT NULL DEFAULT 'produto',
        ativo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela categorias:', err);
      else console.log('Tabela categorias criada/verificada');
    });

    // Tabela de subcategorias
    db.run(`
      CREATE TABLE IF NOT EXISTS subcategorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria_id INTEGER NOT NULL,
        ativo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela subcategorias:', err);
      else console.log('Tabela subcategorias criada/verificada');
    });

    // Tabela de fornecedores
    db.run(`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(200) NOT NULL,
        razao_social VARCHAR(200),
        cpf_cnpj VARCHAR(20) UNIQUE,
        telefone VARCHAR(20),
        email VARCHAR(100),
        contato VARCHAR(100),
        cep VARCHAR(10),
        rua VARCHAR(200),
        numero VARCHAR(20),
        bairro VARCHAR(100),
        cidade VARCHAR(100),
        uf VARCHAR(2),
        observacoes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela fornecedores:', err);
      else console.log('Tabela fornecedores criada/verificada');
    });

    // Tabela de produtos
    db.run(`
      CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo VARCHAR(50) UNIQUE,
        nome VARCHAR(200) NOT NULL,
        categoria_id INTEGER,
        subcategoria_id INTEGER,
        unidade VARCHAR(20),
        preco_compra DECIMAL(10,2),
        preco_venda DECIMAL(10,2) NOT NULL,
        lucro_percentual DECIMAL(10,2),
        estoque_atual DECIMAL(10,2) DEFAULT 0,
        estoque_minimo DECIMAL(10,2) DEFAULT 0,
        fornecedor VARCHAR(200),
        vendido_por_peso INTEGER DEFAULT 0,
        unidade_venda TEXT DEFAULT 'UN',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela produtos:', err);
      else console.log('Tabela produtos criada/verificada');
    });

    // Tabela de clientes
    db.run(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(200) NOT NULL,
        cpf_cnpj VARCHAR(20) UNIQUE,
        telefone VARCHAR(20),
        email VARCHAR(100),
        endereco TEXT,
        limite_credito DECIMAL(10,2) DEFAULT 0,
        credito_atual DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cep VARCHAR(10),
        rua VARCHAR(200),
        numero VARCHAR(20),
        bairro VARCHAR(100),
        cidade VARCHAR(100),
        uf VARCHAR(2)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela clientes:', err);
      else console.log('Tabela clientes criada/verificada');
    });

    // Tabela de vendas
    db.run(`
      CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo VARCHAR(50) UNIQUE,
        data_venda DATE NOT NULL,
        cliente_id INTEGER,
        total DECIMAL(10,2) NOT NULL,
        desconto DECIMAL(10,2) DEFAULT 0,
        forma_pagamento VARCHAR(50),
        status VARCHAR(20) DEFAULT 'concluida',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela vendas:', err);
      else console.log('Tabela vendas criada/verificada');
    });

    // Tabela de itens de venda
    db.run(`
      CREATE TABLE IF NOT EXISTS vendas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER,
        produto_id INTEGER,
        quantidade DECIMAL(10,2) NOT NULL,
        preco_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela vendas_itens:', err);
      else console.log('Tabela vendas_itens criada/verificada');
    });

    // Tabela de controle de caixa
    db.run(`
      CREATE TABLE IF NOT EXISTS caixa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data DATE,
        valor_inicial DECIMAL(10,2),
        total_vendas DECIMAL(10,2),
        total_sangria DECIMAL(10,2),
        saldo_final DECIMAL(10,2),
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela caixa:', err);
      } else {
        console.log('Tabela caixa criada/verificada');
      }
    });
  });
}

function inicializarBanco() {
  db.serialize(() => {
    criarTabelas();
    aplicarAlteracoesPosCriacao();
    inserirConfiguracoesPadrao();
    criarUsuarioAdminPadrao();
    garantirCategoriasPadraoDespesa();
  });
}

function criarUsuarioAdminPadrao() {
  seedUsuarioAdmin();
}

function garantirCategoriasPadraoDespesa() {
  const categoriasPadrao = [
    'Aluguel',
    'Água',
    'Luz',
    'Internet',
    'Impostos e Taxas',
    'Material de Uso Interno',
    'Outras Despesas'
  ];

  categoriasPadrao.forEach((nome) => {
    db.get('SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)', [nome], (err, row) => {
      if (err) {
        console.error('Erro ao verificar categoria padrão de despesa:', err.message);
        return;
      }

      if (!row) {
        db.run(
          'INSERT INTO categorias (nome, descricao, tipo) VALUES (?, ?, ?)',
          [nome, `Categoria padrão de despesa: ${nome}`, 'despesa'],
          (insertErr) => {
            if (insertErr) {
              console.error(`Erro ao inserir categoria padrão "${nome}":`, insertErr.message);
            }
          }
        );
      } else {
        db.run(
          'UPDATE categorias SET tipo = ? WHERE id = ? AND (tipo IS NULL OR tipo = "")',
          ['despesa', row.id],
          (updateErr) => {
            if (updateErr) {
              console.error(`Erro ao ajustar tipo da categoria "${nome}":`, updateErr.message);
            }
          }
        );
      }
    });
  });
}

// Função separada para inserir configurações padrão
function inserirConfiguracoesPadrao() {
  const configs = [
    ['nome_empresa', 'Mercadão da Economia', 'string', 'Nome da empresa'],
    ['nome_fantasia', '', 'string', 'Nome fantasia'],
    ['razao_social', '', 'string', 'Razão social'],
    ['cnpj', '', 'string', 'CNPJ da empresa'],
    ['ie', '', 'string', 'Inscrição estadual'],
    ['im', '', 'string', 'Inscrição municipal'],
    ['telefone', '', 'string', 'Telefone para contato'],
    ['whatsapp', '', 'string', 'WhatsApp'],
    ['email', '', 'string', 'Email para contato'],
    ['cep', '', 'string', 'CEP'],
    ['logradouro', '', 'string', 'Logradouro'],
    ['numero', '', 'string', 'Número'],
    ['complemento', '', 'string', 'Complemento'],
    ['bairro', '', 'string', 'Bairro'],
    ['cidade', '', 'string', 'Cidade'],
    ['uf', 'CE', 'string', 'UF'],
    ['regime_tributario', 'simples_nacional', 'string', 'Regime tributário'],
    ['crt', '1', 'string', 'Código de Regime Tributário NFC-e'],
    ['token_nfce', '', 'string', 'Token NFC-e'],
    ['csc_nfce', '', 'string', 'CSC NFC-e'],
    ['serie_nfce', '1', 'string', 'Série NFC-e'],
    ['numero_nfce', '1', 'string', 'Número NFC-e'],
    ['impressora_padrao', '', 'string', 'Impressora padrão'],
    ['via_estabelecimento', '', 'string', 'Via do estabelecimento NFC-e'],
    ['caminho_logomarca', '', 'string', 'Caminho da logomarca'],
    ['mensagem_cupom', 'Obrigado pela preferência!', 'string', 'Mensagem padrão do cupom'],
    ['arredondamento', '0.01', 'decimal', 'Padrão de arredondamento'],
    ['maximo_parcelas', '12', 'integer', 'Máximo de parcelas'],
    ['juros_parcelas', '2.0', 'decimal', 'Juros mensais parcelas (%)'],
    ['aviso_estoque_baixo', '1', 'boolean', 'Avisar estoque baixo'],
    ['estoque_minimo_padrao', '5', 'integer', 'Estoque mínimo padrão'],
    ['backup_automatico', '1', 'boolean', 'Backup automático'],
    ['intervalo_backup', '24', 'integer', 'Intervalo backup (horas)'],
    ['caminho_backup', '', 'string', 'Caminho backup'],
    ['tema_interface', 'light', 'string', 'Tema da interface'],
    ['idioma', 'pt-BR', 'string', 'Idioma do sistema'],
    ['formato_data', 'DD/MM/YYYY', 'string', 'Formato da data'],
    ['formato_hora', 'HH:mm:ss', 'string', 'Formato da hora'],
    ['fuso_horario', 'America/Fortaleza', 'string', 'Fuso horário'],
    ['moeda', 'BRL', 'string', 'Moeda padrão'],
    ['separador_decimal', ',', 'string', 'Separador decimal'],
    ['separador_milhar', '.', 'string', 'Separador de milhar']
  ];

  configs.forEach(([chave, valor, tipo, descricao]) => {
    db.run(
      'INSERT OR IGNORE INTO configuracoes (chave, valor, tipo, descricao) VALUES (?, ?, ?, ?)',
      [chave, valor, tipo, descricao],
      (err) => {
        if (err) {
          console.error(`Erro ao inserir configuração padrão ${chave}:`, err.message);
        }
      }
    );
  });
}

function seedUsuarioAdmin() {
  const username = 'admin';
  const password = 'admin123';
  
  // Verificar se usuário admin já existe
  db.get('SELECT id FROM usuarios WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Erro ao verificar usuário admin:', err.message);
      return;
    }
    
    if (!row) {
      // Criar hash da senha
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.error('Erro ao criar hash da senha:', err.message);
          return;
        }
        
        // Inserir usuário admin
        db.run(
          'INSERT INTO usuarios (username, password_hash, role) VALUES (?, ?, ?)',
          [username, hash, 'admin'],
          function(err) {
            if (err) {
              console.error('Erro ao criar usuário admin:', err.message);
            } else {
              console.log('Usuário admin criado com sucesso');
              console.log('Username: admin');
              console.log('Password: admin123');
            }
          }
        );
      });
    } else {
      console.log('Usuário admin já existe');
    }
  });
}

module.exports = db;
