import express from 'express';
import session from 'express-session';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
// Логин и пароль администратора. Поменяйте через переменные окружения в продакшене.
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-secret';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
  })
);

// ---------- Вспомогательные функции ----------

// Нормализация телефона к виду +7XXXXXXXXXX
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  if (digits.length !== 11 || digits[0] !== '7') return null;
  return '+' + digits;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Требуется авторизация администратора' });
}

const userPublicColumns =
  'id, first_name, last_name, gender, birth_place, citizenship, phone, consent, admin_comment, created_at, updated_at';

// ---------- Публичные API ----------

// Регистрация пользователя
app.post('/api/register', (req, res) => {
  const { first_name, last_name, gender, birth_place, citizenship, phone, consent } = req.body || {};

  const fn = (first_name || '').trim();
  const ln = (last_name || '').trim();
  const bp = (birth_place || '').trim();
  const cit = (citizenship || '').trim();

  if (!fn || !ln || !bp || !cit) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  if (gender !== 'М' && gender !== 'Ж') {
    return res.status(400).json({ error: 'Укажите пол (М или Ж)' });
  }
  const normPhone = normalizePhone(phone);
  if (!normPhone) {
    return res.status(400).json({ error: 'Некорректный номер телефона' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'Необходимо согласие на обработку персональных данных' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(normPhone);
  if (exists) {
    return res.status(409).json({ error: 'Пользователь с таким номером уже зарегистрирован' });
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (first_name, last_name, gender, birth_place, citizenship, phone, consent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(fn, ln, gender, bp, cit, normPhone, now, now);

  req.session.userId = Number(info.lastInsertRowid);
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

// Вход по номеру телефона (без кода подтверждения)
app.post('/api/login', (req, res) => {
  const normPhone = normalizePhone(req.body && req.body.phone);
  if (!normPhone) {
    return res.status(400).json({ error: 'Некорректный номер телефона' });
  }
  const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(normPhone);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден. Сначала зарегистрируйтесь.' });
  }
  req.session.userId = user.id;
  res.json({ ok: true });
});

// Данные текущего пользователя
app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не выполнен вход' });
  const user = db.prepare(`SELECT ${userPublicColumns} FROM users WHERE id = ?`).get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------- Админ-панель API ----------

app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body || {};
  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Неверный логин или пароль' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Список пользователей с поиском
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const search = (req.query.search || '').trim();
  let rows;
  if (search) {
    const like = `%${search}%`;
    rows = db
      .prepare(
        `SELECT ${userPublicColumns} FROM users
         WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?
            OR birth_place LIKE ? OR citizenship LIKE ?
         ORDER BY created_at DESC`
      )
      .all(like, like, like, like, like);
  } else {
    rows = db.prepare(`SELECT ${userPublicColumns} FROM users ORDER BY created_at DESC`).all();
  }
  res.json(rows);
});

app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
  const user = db.prepare(`SELECT ${userPublicColumns} FROM users WHERE id = ?`).get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(user);
});

// Редактирование данных пользователя
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Пользователь не найден' });

  const { first_name, last_name, gender, birth_place, citizenship, phone, admin_comment } = req.body || {};

  const fn = (first_name || '').trim();
  const ln = (last_name || '').trim();
  const bp = (birth_place || '').trim();
  const cit = (citizenship || '').trim();
  if (!fn || !ln || !bp || !cit) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  if (gender !== 'М' && gender !== 'Ж') {
    return res.status(400).json({ error: 'Укажите пол (М или Ж)' });
  }
  const normPhone = normalizePhone(phone);
  if (!normPhone) {
    return res.status(400).json({ error: 'Некорректный номер телефона' });
  }
  const dup = db.prepare('SELECT id FROM users WHERE phone = ? AND id <> ?').get(normPhone, id);
  if (dup) {
    return res.status(409).json({ error: 'Другой пользователь уже использует этот номер' });
  }

  db.prepare(
    `UPDATE users SET first_name=?, last_name=?, gender=?, birth_place=?, citizenship=?, phone=?, admin_comment=?, updated_at=?
     WHERE id=?`
  ).run(fn, ln, gender, bp, cit, normPhone, (admin_comment || '').trim(), new Date().toISOString(), id);

  const updated = db.prepare(`SELECT ${userPublicColumns} FROM users WHERE id = ?`).get(id);
  res.json(updated);
});

// Отдельное сохранение комментария администратора
app.post('/api/admin/users/:id/comment', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Пользователь не найден' });
  db.prepare('UPDATE users SET admin_comment=?, updated_at=? WHERE id=?').run(
    (req.body.admin_comment || '').trim(),
    new Date().toISOString(),
    id
  );
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ok: true });
});

// Выгрузка всех данных в Excel
app.get('/api/admin/export', requireAdmin, async (req, res) => {
  const rows = db.prepare(`SELECT ${userPublicColumns} FROM users ORDER BY created_at DESC`).all();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Единый реестр';
  wb.created = new Date();
  const ws = wb.addWorksheet('Пользователи');

  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Имя', key: 'first_name', width: 18 },
    { header: 'Фамилия', key: 'last_name', width: 20 },
    { header: 'Пол', key: 'gender', width: 6 },
    { header: 'Место рождения', key: 'birth_place', width: 28 },
    { header: 'Гражданство', key: 'citizenship', width: 20 },
    { header: 'Телефон', key: 'phone', width: 18 },
    { header: 'Согласие', key: 'consent', width: 10 },
    { header: 'Комментарий администратора', key: 'admin_comment', width: 40 },
    { header: 'Дата регистрации', key: 'created_at', width: 24 },
    { header: 'Обновлено', key: 'updated_at', width: 24 }
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  for (const r of rows) {
    ws.addRow({
      ...r,
      consent: r.consent ? 'Да' : 'Нет',
      created_at: new Date(r.created_at).toLocaleString('ru-RU'),
      updated_at: new Date(r.updated_at).toLocaleString('ru-RU')
    });
  }

  ws.autoFilter = { from: 'A1', to: 'K1' };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reestr-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// ---------- Статика ----------
app.use(express.static(join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Единый реестр запущен: http://localhost:${PORT}`);
  console.log(`  Админ-панель:          http://localhost:${PORT}/admin`);
  console.log(`  Логин админа: ${ADMIN_LOGIN}   Пароль: ${ADMIN_PASSWORD}\n`);
});
