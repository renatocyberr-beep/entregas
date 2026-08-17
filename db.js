const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'ponto.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  pin TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- entrada | saida | intervalo_inicio | intervalo_fim
  foto_path TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  precisao REAL,
  endereco TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id)
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL
);
`);

// Seed default admin if none exists
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
if (adminCount === 0) {
  const hash = bcrypt.hashSync('prime123', 10);
  db.prepare('INSERT INTO admins (usuario, senha_hash) VALUES (?, ?)').run('admin', hash);
  console.log('Admin padrão criado -> usuário: admin | senha: prime123 (troque depois)');
}

// Seed a sample colaborador if none exists (for quick testing)
const colabCount = db.prepare('SELECT COUNT(*) as c FROM colaboradores').get().c;
if (colabCount === 0) {
  const hash = bcrypt.hashSync('1234', 10);
  db.prepare('INSERT INTO colaboradores (matricula, nome, cargo, pin) VALUES (?, ?, ?, ?)')
    .run('001', 'Colaborador Teste', 'Entregador', hash);
  console.log('Colaborador de teste criado -> matrícula: 001 | PIN: 1234');
}

module.exports = db;
