import express from 'express';
import session from 'express-session';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import db from './db.js';
import { sendSms, SMS_DEMO } from './sms.js';

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
  'id, first_name, last_name, gender, birth_place, citizenship, address, phone, consent, admin_comment, created_at, updated_at';

// Возвращает массив произвольных полей пользователя [{id, field_name, field_value}]
function getCustomFields(userId) {
  return db
    .prepare('SELECT id, field_name, field_value FROM user_fields WHERE user_id = ? ORDER BY id')
    .all(userId);
}

// Добавляет произвольные поля в объект пользователя
function withCustomFields(user) {
  if (!user) return user;
  return { ...user, custom_fields: getCustomFields(user.id) };
}

// ---------- SMS-подтверждение телефона ----------

// Запрос кода подтверждения
app.post('/api/otp/request', async (req, res) => {
  const normPhone = normalizePhone(req.body && req.body.phone);
  if (!normPhone) {
    return res.status(400).json({ error: 'Некорректный номер телефона' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(normPhone);
  if (exists) {
    return res.status(409).json({ error: 'Пользователь с таким номером уже зарегистрирован' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 цифр
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут

  db.prepare(
    `INSERT INTO otp_codes (phone, code, expires_at, attempts, verified)
     VALUES (?, ?, ?, 0, 0)
     ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, attempts=0, verified=0`
  ).run(normPhone, code, expiresAt);

  const result = await sendSms(normPhone, `Код подтверждения регистрации: ${code}`);
  if (!result.ok) {
    return res.status(502).json({ error: result.error || 'Не удалось отправить SMS' });
  }

  // В демо-режиме возвращаем код прямо на экран, чтобы можно было продолжить без реальной SMS
  res.json({ ok: true, demo: SMS_DEMO, ...(SMS_DEMO ? { code } : {}) });
});

// Проверяет код для телефона. Возвращает true/false. При успехе помечает verified.
function verifyOtp(phone, code) {
  const row = db.prepare('SELECT * FROM otp_codes WHERE phone = ?').get(phone);
  if (!row) return false;
  if (Date.now() > row.expires_at) return false;
  if (row.attempts >= 5) return false;
  if (String(code).trim() !== row.code) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?').run(phone);
    return false;
  }
  db.prepare('UPDATE otp_codes SET verified = 1 WHERE phone = ?').run(phone);
  return true;
}

// ---------- Публичные API ----------

// Регистрация пользователя
app.post('/api/register', (req, res) => {
  const { first_name, last_name, gender, birth_place, citizenship, address, phone, consent, code } =
    req.body || {};

  const fn = (first_name || '').trim();
  const ln = (last_name || '').trim();
  const bp = (birth_place || '').trim();
  const cit = (citizenship || '').trim();
  const addr = (address || '').trim();

  if (!fn || !ln || !bp || !cit || !addr) {
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

  // Проверка кода подтверждения телефона
  if (!verifyOtp(normPhone, code)) {
    return res.status(400).json({ error: 'Неверный или просроченный код подтверждения' });
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (first_name, last_name, gender, birth_place, citizenship, address, phone, consent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(fn, ln, gender, bp, cit, addr, normPhone, now, now);

  db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(normPhone);

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
            OR birth_place LIKE ? OR citizenship LIKE ? OR address LIKE ?
         ORDER BY created_at DESC`
      )
      .all(like, like, like, like, like, like);
  } else {
    rows = db.prepare(`SELECT ${userPublicColumns} FROM users ORDER BY created_at DESC`).all();
  }
  res.json(rows.map(withCustomFields));
});

app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
  const user = db.prepare(`SELECT ${userPublicColumns} FROM users WHERE id = ?`).get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(withCustomFields(user));
});

// Редактирование данных пользователя
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Пользователь не найден' });

  const { first_name, last_name, gender, birth_place, citizenship, address, phone, admin_comment, custom_fields } =
    req.body || {};

  const fn = (first_name || '').trim();
  const ln = (last_name || '').trim();
  const bp = (birth_place || '').trim();
  const cit = (citizenship || '').trim();
  const addr = (address || '').trim();
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
    `UPDATE users SET first_name=?, last_name=?, gender=?, birth_place=?, citizenship=?, address=?, phone=?, admin_comment=?, updated_at=?
     WHERE id=?`
  ).run(fn, ln, gender, bp, cit, addr, normPhone, (admin_comment || '').trim(), new Date().toISOString(), id);

  // Полностью пересохраняем произвольные поля (если переданы)
  if (Array.isArray(custom_fields)) {
    db.prepare('DELETE FROM user_fields WHERE user_id = ?').run(id);
    const ins = db.prepare('INSERT INTO user_fields (user_id, field_name, field_value) VALUES (?, ?, ?)');
    for (const f of custom_fields) {
      const name = (f && f.field_name ? String(f.field_name) : '').trim();
      const value = (f && f.field_value != null ? String(f.field_value) : '').trim();
      if (name) ins.run(id, name, value);
    }
  }

  const updated = db.prepare(`SELECT ${userPublicColumns} FROM users WHERE id = ?`).get(id);
  res.json(withCustomFields(updated));
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

  // Собираем все произвольные поля и определяем набор уникальных названий-столбцов
  const fieldsByUser = new Map();
  const dynamicNames = [];
  const seenNames = new Set();
  for (const r of rows) {
    const fields = getCustomFields(r.id);
    fieldsByUser.set(r.id, fields);
    for (const f of fields) {
      if (!seenNames.has(f.field_name)) {
        seenNames.add(f.field_name);
        dynamicNames.push(f.field_name);
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Единый реестр';
  wb.created = new Date();
  const ws = wb.addWorksheet('Пользователи');

  const baseColumns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Имя', key: 'first_name', width: 18 },
    { header: 'Фамилия', key: 'last_name', width: 20 },
    { header: 'Пол', key: 'gender', width: 6 },
    { header: 'Место рождения', key: 'birth_place', width: 28 },
    { header: 'Гражданство', key: 'citizenship', width: 20 },
    { header: 'Адрес проживания', key: 'address', width: 32 },
    { header: 'Телефон', key: 'phone', width: 18 },
    { header: 'Согласие', key: 'consent', width: 10 },
    { header: 'Комментарий администратора', key: 'admin_comment', width: 40 },
    { header: 'Дата регистрации', key: 'created_at', width: 22 },
    { header: 'Обновлено', key: 'updated_at', width: 22 }
  ];
  const dynamicColumns = dynamicNames.map((name) => ({
    header: name,
    key: 'cf__' + name,
    width: 22
  }));
  ws.columns = [...baseColumns, ...dynamicColumns];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  for (const r of rows) {
    const row = {
      ...r,
      consent: r.consent ? 'Да' : 'Нет',
      created_at: new Date(r.created_at).toLocaleString('ru-RU'),
      updated_at: new Date(r.updated_at).toLocaleString('ru-RU')
    };
    for (const f of fieldsByUser.get(r.id) || []) {
      row['cf__' + f.field_name] = f.field_value;
    }
    ws.addRow(row);
  }

  const lastCol = ws.columnCount;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: lastCol } };

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
