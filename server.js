const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'prime-entregas-dev-secret-troque-em-producao';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Upload de fotos ----------
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Arquivo precisa ser uma imagem'));
    cb(null, true);
  },
});

// ---------- Auth admin ----------
function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessão inválida' });
  }
}

app.post('/api/admin/login', (req, res) => {
  const { usuario, senha } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE usuario = ?').get(usuario);
  if (!admin || !bcrypt.compareSync(senha || '', admin.senha_hash)) {
    return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
  }
  const token = jwt.sign({ id: admin.id, usuario: admin.usuario }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ usuario: req.admin.usuario });
});

// ---------- Colaboradores (bater ponto) ----------
app.post('/api/ponto/validar', (req, res) => {
  const { matricula, pin } = req.body;
  const colab = db.prepare('SELECT * FROM colaboradores WHERE matricula = ? AND ativo = 1').get(matricula);
  if (!colab || !bcrypt.compareSync(pin || '', colab.pin)) {
    return res.status(401).json({ erro: 'Matrícula ou PIN inválidos' });
  }
  res.json({ id: colab.id, nome: colab.nome, cargo: colab.cargo });
});

app.post('/api/ponto/bater', upload.single('foto'), (req, res) => {
  try {
    const { matricula, pin, tipo, latitude, longitude, precisao, endereco } = req.body;
    if (!req.file) return res.status(400).json({ erro: 'Foto é obrigatória' });

    const colab = db.prepare('SELECT * FROM colaboradores WHERE matricula = ? AND ativo = 1').get(matricula);
    if (!colab || !bcrypt.compareSync(pin || '', colab.pin)) {
      fs.unlinkSync(req.file.path);
      return res.status(401).json({ erro: 'Matrícula ou PIN inválidos' });
    }
    if (!['entrada', 'saida', 'intervalo_inicio', 'intervalo_fim'].includes(tipo)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ erro: 'Tipo de registro inválido' });
    }

    const stmt = db.prepare(`INSERT INTO registros
      (colaborador_id, tipo, foto_path, latitude, longitude, precisao, endereco)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      colab.id,
      tipo,
      `/uploads/${req.file.filename}`,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      precisao ? parseFloat(precisao) : null,
      endereco || null
    );

    res.json({
      ok: true,
      registro: {
        id: info.lastInsertRowid,
        nome: colab.nome,
        tipo,
        horario: dayjs().format('DD/MM/YYYY HH:mm:ss'),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao registrar ponto' });
  }
});

// ---------- Admin: colaboradores CRUD ----------
app.get('/api/admin/colaboradores', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, matricula, nome, cargo, ativo, criado_em FROM colaboradores ORDER BY nome').all();
  res.json(rows);
});

app.post('/api/admin/colaboradores', requireAdmin, (req, res) => {
  const { matricula, nome, cargo, pin } = req.body;
  if (!matricula || !nome || !pin) return res.status(400).json({ erro: 'Matrícula, nome e PIN são obrigatórios' });
  try {
    const hash = bcrypt.hashSync(String(pin), 10);
    const info = db.prepare('INSERT INTO colaboradores (matricula, nome, cargo, pin) VALUES (?, ?, ?, ?)')
      .run(matricula, nome, cargo || null, hash);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(400).json({ erro: 'Matrícula já cadastrada' });
    res.status(500).json({ erro: 'Erro ao cadastrar' });
  }
});

app.put('/api/admin/colaboradores/:id', requireAdmin, (req, res) => {
  const { nome, cargo, ativo, pin } = req.body;
  const colab = db.prepare('SELECT * FROM colaboradores WHERE id = ?').get(req.params.id);
  if (!colab) return res.status(404).json({ erro: 'Não encontrado' });
  db.prepare('UPDATE colaboradores SET nome = ?, cargo = ?, ativo = ? WHERE id = ?')
    .run(nome ?? colab.nome, cargo ?? colab.cargo, ativo === undefined ? colab.ativo : (ativo ? 1 : 0), req.params.id);
  if (pin) {
    db.prepare('UPDATE colaboradores SET pin = ? WHERE id = ?').run(bcrypt.hashSync(String(pin), 10), req.params.id);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/colaboradores/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE colaboradores SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Admin: registros / relatórios ----------
function buscarRegistros({ colaborador_id, inicio, fim }) {
  let sql = `SELECT r.*, c.nome, c.matricula, c.cargo
             FROM registros r JOIN colaboradores c ON c.id = r.colaborador_id
             WHERE 1=1`;
  const params = [];
  if (colaborador_id) { sql += ' AND r.colaborador_id = ?'; params.push(colaborador_id); }
  if (inicio) { sql += ' AND date(r.criado_em) >= date(?)'; params.push(inicio); }
  if (fim) { sql += ' AND date(r.criado_em) <= date(?)'; params.push(fim); }
  sql += ' ORDER BY r.criado_em DESC';
  return db.prepare(sql).all(...params);
}

app.get('/api/admin/registros', requireAdmin, (req, res) => {
  const { colaborador_id, inicio, fim } = req.query;
  res.json(buscarRegistros({ colaborador_id, inicio, fim }));
});

app.get('/api/admin/registros/export', requireAdmin, async (req, res) => {
  const { colaborador_id, inicio, fim } = req.query;
  const registros = buscarRegistros({ colaborador_id, inicio, fim });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Registros de Ponto');
  sheet.columns = [
    { header: 'Matrícula', key: 'matricula', width: 12 },
    { header: 'Nome', key: 'nome', width: 28 },
    { header: 'Cargo', key: 'cargo', width: 18 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: 'Data/Hora', key: 'data_hora', width: 20 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
    { header: 'Precisão (m)', key: 'precisao', width: 14 },
    { header: 'Link da Foto', key: 'foto', width: 40 },
  ];
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  registros.forEach((r) => {
    sheet.addRow({
      matricula: r.matricula,
      nome: r.nome,
      cargo: r.cargo,
      tipo: labelTipo(r.tipo),
      data_hora: dayjs(r.criado_em).format('DD/MM/YYYY HH:mm:ss'),
      latitude: r.latitude,
      longitude: r.longitude,
      precisao: r.precisao,
      foto: `${baseUrl}${r.foto_path}`,
    });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-ponto-${dayjs().format('YYYY-MM-DD')}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

function labelTipo(tipo) {
  return { entrada: 'Entrada', saida: 'Saída', intervalo_inicio: 'Início Intervalo', intervalo_fim: 'Fim Intervalo' }[tipo] || tipo;
}

app.listen(PORT, () => {
  console.log(`Prime Entregas - Sistema de Ponto rodando em http://localhost:${PORT}`);
});
