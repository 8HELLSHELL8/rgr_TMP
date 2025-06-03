const express = require('express');
const { Pool } = require('pg'); 
const jwt = require('jsonwebtoken'); 
const cors = require('cors');
require('dotenv').config(); 
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const pdfMake = require('pdfmake/build/pdfmake');
const pdfFontsModule = require('pdfmake/build/vfs_fonts'); 

if (pdfFontsModule && pdfFontsModule.pdfMake && pdfFontsModule.pdfMake.vfs) {
    pdfMake.vfs = pdfFontsModule.pdfMake.vfs;
} else if (global.pdfMake && global.pdfMake.vfs && Object.keys(global.pdfMake.vfs).length > 0 && (!pdfMake.vfs || Object.keys(pdfMake.vfs).length === 0)) {
    console.warn("vfs_fonts.js did not export the standard { pdfMake: { vfs: ... } } structure. " +
                 "Using VFS from global.pdfMake populated by side-effect.");
    pdfMake.vfs = global.pdfMake.vfs;
} else if (pdfMake.vfs && Object.keys(pdfMake.vfs).length > 0) {
    console.log("pdfMake.vfs appears to be populated, possibly by side-effect from vfs_fonts.js on the imported pdfMake object.");
} else if (pdfFontsModule && typeof pdfFontsModule === 'object' && Object.keys(pdfFontsModule).length > 5 && Object.values(pdfFontsModule).every(val => typeof val === 'string')) {
    console.warn("vfs_fonts.js did not export the standard { pdfMake: { vfs: ... } } structure, " +
                 "and pdfMake.vfs was not populated by side-effect or globally. " +
                 "Attempting to use the direct export of vfs_fonts.js as VFS data.");
    pdfMake.vfs = pdfFontsModule;
}

const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');

const app = express();
const port = process.env.PORT || 5000; 

const corsOptions = {
  origin: ['http://localhost:80', 'http://localhost:3000', 'http://localhost:5000', 'http://217.71.129.139:5785',
    'http://217.71.129.139:5784','http://172.17.7.208:3000', 'http://172.17.7.208:5000', 'http://172.17.7.208'], 
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json()); 
app.use(cookieParser()); 

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10), 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
  process.exit(1);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function authenticateToken(req, res, next) {
  const token = req.cookies?.token;

  console.log(`[AUTH] Попытка аутентификации: есть ли токен? ${!!token}`);

  if (!token) {
    console.warn(`[AUTH] Токен отсутствует`);
    return res.status(401).json({ 
      success: false, 
      message: 'Токен отсутствует' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: false });
    
    console.log(`[JWT] Декодированный токен:`, decoded);

    if (typeof decoded.id !== 'number') {
      console.warn(`[AUTH] Некорректный ID пользователя в токене: ${decoded.id}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Некорректный ID пользователя' 
      });
    }

    const { rows } = await pool.query(`
      SELECT 
        su.id, 
        su.name, 
        su.surname, 
        su.lastname, 
        su.role AS user_role_id,
        r.id AS role_id, 
        r.name AS role_name,
        r.description AS role_description
      FROM system_users su
      LEFT JOIN roles r ON su.role = r.id
      WHERE su.id = $1 AND su.current_token = $2
    `, [decoded.id, token]);

    console.log(`[DB] Выполнен запрос на проверку токена для пользователя ${decoded.id}`);

    if (rows.length === 0) {
      console.warn(`[AUTH] Пользователь ${decoded.id} не найден или токен недействителен`);
      return res.status(401).json({ 
        success: false, 
        message: 'Пользователь не найден или токен недействителен' 
      });
    }

    const user = rows[0];
    if (!user.role_id) {
      console.warn(`[AUTH] Пользователь ${user.id} не имеет привязанной роли`);
    }

    req.user = user;
    console.log(`[AUTH] Аутентификация успешна для пользователя ${user.id}`);
    next();
  } catch (error) {
    console.error(`[ERROR] Ошибка аутентификации:`, error.message, error.stack);
    const message = error.name === 'TokenExpiredError' 
      ? 'Срок действия токена истёк' 
      : 'Недействительный токен';
    return res.status(401).json({ 
      success: false, 
      message 
    });
  }
}

function verifyCsrfToken(req, res, next) {
  const csrfCookie = req.cookies['csrf-token'];
  const csrfHeader = req.headers['x-csrf-token'];

  console.log(`[CSRF] Проверка: csrfCookie="${csrfCookie}", csrfHeader="${csrfHeader}"`);

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    console.warn(`[CSRF] Ошибка: csrfCookie="${csrfCookie}", csrfHeader="${csrfHeader}"`);
    return res.status(403).json({ success: false, message: 'Ошибка CSRF токена (Forbidden: Invalid CSRF token)' });
  }
  next();
}


app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  console.log(`[LOGIN] Получен запрос: ${JSON.stringify(req.body)}`);

  if (!username || !password) {
    console.warn(`[LOGIN] Некорректные данные: username=${username}, password=${password}`);
    return res.status(400).json({
      success: false,
      message: 'Имя пользователя и пароль обязательны'
    });
  }

  try {
    // Получаем пользователя по имени
    const result = await pool.query(
      'SELECT * FROM system_users WHERE name = $1',
      [username]
    );

    console.log(`[DB] SELECT system_users WHERE name = "${username}"`);

    if (result.rows.length === 0) {
      console.warn(`[LOGIN] Пользователь не найден: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const user = result.rows[0];

    console.log(`[DB] Найденный пользователь:`, user);

    // Сравниваем введённый пароль с хешем в БД
    const isMatch = await bcrypt.compare(password, user.password);

    console.log(`[AUTH] Сравнение паролей: введённый="${password}", хэш из БД="${user.password}", совпадают=${isMatch}`);

    if (!isMatch) {
      console.warn(`[LOGIN] Неверный пароль для пользователя ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Неверный пароль'
      });
    }

    // Генерируем новый токен
    const effectiveToken = generateToken(user);
    console.log(`[JWT] Сгенерирован токен для пользователя ${user.id}: ${effectiveToken}`);

    // Сохранение токена в базе данных
    await pool.query(
      'UPDATE system_users SET current_token = $1 WHERE id = $2',
      [effectiveToken, user.id]
    );
    console.log(`[DB] Обновлен токен для пользователя ${user.id}`);

    // Генерация CSRF токена
    const csrfToken = crypto.randomBytes(100).toString('hex');

    // Установка cookie с JWT-токеном
    res.cookie('token', effectiveToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
    });

    // Установка cookie с CSRF-токеном
    res.cookie('csrf-token', csrfToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
    });

    // Опционально: сохранить информацию о пользователе в cookie
    res.cookie('user', JSON.stringify({
      id: user.id,
      name: user.name,
      surname: user.surname,
      role: user.role,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    console.log(`[RESPONSE] Авторизация успешна для пользователя ${user.id}`);

    res.json({
      success: true,
      message: 'Авторизация успешна!',
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        role: user.role,
      },
      token: effectiveToken,
      csrfToken: csrfToken,
    });
  } catch (error) {
    console.error(`[ERROR] Ошибка при авторизации:`, error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при авторизации'
    });
  }
});

// Эндпоинт для выхода из системы
app.post('/api/logout', authenticateToken, verifyCsrfToken, async (req, res) => { // Added verifyCsrfToken
  try {
    // Опционально: очистить current_token в базе данных
    if (req.user && req.user.id) {
      await pool.query('UPDATE system_users SET current_token = NULL WHERE id = $1', [req.user.id]);
    }

    res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.clearCookie('user', { secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.clearCookie('csrf-token', { secure: process.env.NODE_ENV === 'production', sameSite: 'strict' }); // Clear CSRF token cookie

    res.json({ success: true, message: 'Выход выполнен успешно (Logout successful)' });
  } catch (error) {
    console.error('Ошибка при выходе (Logout error):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error during logout)' });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  const user = req.user;

  console.log(`[ME] Запрошена информация о пользователе:`, user);

  if (!user?.id) {
    console.warn(`[ME] Пользователь не определён`);
    return res.status(401).json({ 
      success: false, 
      message: 'Пользователь не определён' 
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      surname: user.surname,
      lastname: user.lastname || '',
      fullName: `${user.name} ${user.surname} ${user.lastname || ''}`.trim(),
      role: {
        id: user.role_id || user.user_role_id,
        name: user.role_name || "Неизвестная роль",
        description: user.role_description || ""
      }
    }
  });
});

// --- Weapon Endpoints ---
app.get('/api/weapons', authenticateToken, async (req, res) => { // Added authenticateToken for consistency if needed
  try {
    const result = await pool.query(`
      SELECT 
        w.id, wt.name AS type_name, ws.name AS status_name,
        w.name AS weapon_name, w.last_maintenance, w.description
      FROM weapon w
      JOIN weapon_type wt ON w.type = wt.id
      JOIN weapon_statuses ws ON w.status = ws.id
    `);
    const weapons = result.rows.map((row) => ({
      id: row.id,
      name: row.weapon_name,
      typeName: row.type_name,
      statusName: row.status_name,
      lastMaintenance: row.last_maintenance ? new Date(row.last_maintenance).toLocaleDateString() : 'N/A',
      description: row.description || 'Нет описания',
    }));
    res.json({ success: true, weapons });
  } catch (error) {
    console.error('Ошибка при получении списка оружия (Error fetching weapons list):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

app.get('/api/weapons/:id', authenticateToken, async (req, res) => { // Added authenticateToken
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: 'ID оружия должен быть числом (Weapon ID must be a number)' });
  }
  try {
    const result = await pool.query(`
      SELECT 
        w.id, wt.name AS type_name, ws.name AS status_name,
        w.name AS weapon_name, w.last_maintenance, w.description
      FROM weapon w
      JOIN weapon_type wt ON w.type = wt.id
      JOIN weapon_statuses ws ON w.status = ws.id
      WHERE w.id = $1
    `, [id]);
    if (result.rows.length > 0) {
      const weapon = result.rows[0];
      res.json({
        success: true,
        weapon: {
          id: weapon.id,
          name: weapon.weapon_name,
          typeName: weapon.type_name,
          statusName: weapon.status_name,
          lastMaintenance: weapon.last_maintenance ? new Date(weapon.last_maintenance).toLocaleDateString() : 'N/A',
          description: weapon.description || 'Нет описания',
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'Оружие не найдено (Weapon not found)' });
    }
  } catch (error) {
    console.error('Ошибка при получении информации об оружии (Error fetching weapon details):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

// --- Specials Endpoints ---
app.get('/api/specials', authenticateToken, async (req, res) => { // Added authenticateToken
  try {
    const result = await pool.query(`
      SELECT 
        s.id, st.name AS type_name, ws.name AS status_name,
        s.name AS special_name, s.description
      FROM specials s
      JOIN specials_type st ON s.type = st.id
      JOIN weapon_statuses ws ON s.status = ws.id
    `);
    const specials = result.rows.map((row) => ({
      id: row.id,
      name: row.special_name,
      typeName: row.type_name,
      statusName: row.status_name,
      description: row.description || 'Нет описания',
    }));
    res.json({ success: true, specials });
  } catch (error) {
    console.error('Ошибка при получении списка спецустройств (Error fetching specials list):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

app.get('/api/specials/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: 'ID спецустройства должен быть числом (Special ID must be a number)' });
  }
  try {
    const result = await pool.query(`
      SELECT 
        s.id, st.name AS type_name, ws.name AS status_name,
        s.name AS special_name, s.description
      FROM specials s
      JOIN specials_type st ON s.type = st.id
      JOIN weapon_statuses ws ON s.status = ws.id
      WHERE s.id = $1
    `, [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Спецустройство не найдено (Special device not found)' });
    }
    const special = result.rows[0];
    res.json({
      success: true,
      special: {
        id: special.id,
        name: special.special_name,
        typeName: special.type_name,
        statusName: special.status_name,
        description: special.description || 'Нет описания',
      },
    });
  } catch (error) {
    console.error('Ошибка при получении информации о спецустройстве (Error fetching special device details):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

// --- Log Endpoints ---
app.get('/api/logs/summary', authenticateToken, async (req, res) => { // Added authenticateToken
  try {
    const result = await pool.query(`
      SELECT 
        l.id, l.action_time AS time,
        s.name || ' ' || s.surname || ' ' || COALESCE(s.lastname, '') AS user,
        a.name AS action, w.name AS weapon_name, sp.name AS special_name,
        as_status.name AS status
      FROM logs l
      JOIN soldiers s ON l.soldier = s.id
      JOIN actions a ON l.action_type = a.id
      LEFT JOIN weapon w ON l.gun_taken = w.id
      LEFT JOIN specials sp ON l.specials_taken = sp.id
      JOIN action_status as_status ON l.status = as_status.id
      ORDER BY l.action_time DESC; -- Optional: order by time
    `);
    const logsSummary = result.rows.map((row) => ({
      id: row.id,
      time: row.time ? new Date(row.time).toLocaleString() : 'N/A',
      user: row.user,
      action: row.action,
      item: row.weapon_name || row.special_name || 'Не указано',
      status: row.status,
    }));
    res.json({ success: true, logs: logsSummary });
  } catch (error) {
    console.error('Ошибка при получении кратких логов (Error fetching log summary):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

app.get('/api/logs/full/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: 'ID лога должен быть числом (Log ID must be a number)' });
  }
  try {
    const result = await pool.query(`
      SELECT 
        l.id, l.action_time AS time,
        s.name || ' ' || s.surname || ' ' || COALESCE(s.lastname, '') AS user,
        a.name AS action, w.name AS weapon_name, sp.name AS special_name,
        l.comment, as_status.name AS status
      FROM logs l
      JOIN soldiers s ON l.soldier = s.id
      JOIN actions a ON l.action_type = a.id
      LEFT JOIN weapon w ON l.gun_taken = w.id
      LEFT JOIN specials sp ON l.specials_taken = sp.id
      JOIN action_status as_status ON l.status = as_status.id
      WHERE l.id = $1
    `, [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Лог не найден (Log entry not found)' });
    }
    const logFull = result.rows[0];
    res.json({
      success: true,
      log: {
        id: logFull.id,
        time: logFull.time ? new Date(logFull.time).toLocaleString() : 'N/A',
        user: logFull.user,
        action: logFull.action,
        weapon: logFull.weapon_name || null,
        special: logFull.special_name || null,
        comment: logFull.comment || 'Нет комментариев',
        status: logFull.status || 'Не указан',
      },
    });
  } catch (error) {
    console.error('Ошибка при получении полного лога (Error fetching full log entry):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

// --- Action Statuses Endpoint ---
app.get('/api/action-statuses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM action_status ORDER BY name'); // Assuming 'name' for ordering
    res.json({ success: true, actionStatuses: result.rows });
  } catch (error) {
    console.error('Ошибка при получении списка статусов действий (Error fetching action statuses):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера при получении статусов действий' });
  }
});


app.post('/api/logs', authenticateToken, verifyCsrfToken, async (req, res) => {


  const ACTION_TAKEN_ID = 1;       
  const ACTION_RETURNED_ID = 2;    
  const ACTION_MAINTENANCE_ID = 3; 

  const STATUS_IN_STOCK_ID = 1;    
  const STATUS_ISSUED_ID = 2;      
  const STATUS_TAKEN_ID = 3;      
  const STATUS_UNDER_REPAIR_ID = 4; 

  const { soldier, action_type, gun_taken, specials_taken, comment, status } = req.body;

  if (!soldier || !action_type || !status) {
    return res.status(400).json({ success: false, message: 'Солдат, тип действия и статус лога обязательны (Bad Request: Soldier, action type, and log status are required)' });
  }

  const parsedActionType = parseInt(action_type, 10);
  if (isNaN(parsedActionType)) {
    return res.status(400).json({ success: false, message: 'Тип действия должен быть числом (Action type must be a number)' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert the log entry
    const logInsertResult = await client.query(`
      INSERT INTO logs (soldier, action_type, gun_taken, specials_taken, comment, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [soldier, parsedActionType, gun_taken || null, specials_taken || null, comment || null, status]);

    const newLogId = logInsertResult.rows[0].id;

    let gunUpdateAttempted = false;
    let gunUpdateSucceeded = false;
    let specialUpdateAttempted = false;
    let specialUpdateSucceeded = false;

    // --- Handle Weapon Status Update ---
    if (gun_taken) {
      gunUpdateAttempted = true;
      let weaponUpdateResult;
      if (parsedActionType === ACTION_TAKEN_ID) {
        weaponUpdateResult = await client.query(
          'UPDATE weapon SET status = $1 WHERE id = $2 AND status = $3', // Must be 'In Stock' to be 'Taken'
          [STATUS_TAKEN_ID, gun_taken, STATUS_IN_STOCK_ID]
        );
        if (weaponUpdateResult.rowCount > 0) gunUpdateSucceeded = true;
      } else if (parsedActionType === ACTION_RETURNED_ID) {
        weaponUpdateResult = await client.query(
          'UPDATE weapon SET status = $1 WHERE id = $2 AND status IN ($3, $4, $5)', // Can be returned if 'Taken', 'Issued', or 'Under Repair'
          [STATUS_IN_STOCK_ID, gun_taken, STATUS_TAKEN_ID, STATUS_ISSUED_ID, STATUS_UNDER_REPAIR_ID]
        );
        if (weaponUpdateResult.rowCount > 0) gunUpdateSucceeded = true;
      } else if (parsedActionType === ACTION_MAINTENANCE_ID) {
        weaponUpdateResult = await client.query(
          'UPDATE weapon SET status = $1 WHERE id = $2 AND status IN ($3, $4, $5)', // Can be sent for maintenance if 'In Stock', 'Issued', or 'Taken'
          [STATUS_UNDER_REPAIR_ID, gun_taken, STATUS_IN_STOCK_ID, STATUS_ISSUED_ID, STATUS_TAKEN_ID]
        );
        if (weaponUpdateResult.rowCount > 0) gunUpdateSucceeded = true;
      }

      if (gunUpdateSucceeded) {
        console.log(`[LOG ACTION] Weapon ID ${gun_taken} status updated successfully for action type ${parsedActionType}.`);
      } else if (parsedActionType === ACTION_TAKEN_ID || parsedActionType === ACTION_RETURNED_ID || parsedActionType === ACTION_MAINTENANCE_ID) {
        const currentStatusRes = await client.query('SELECT status FROM weapon WHERE id = $1', [gun_taken]); // Check status within transaction
        const currentStatusId = currentStatusRes.rows.length > 0 ? currentStatusRes.rows[0].status : 'not found';
        console.warn(`[LOG ACTION] Weapon ID ${gun_taken} (Action Type: ${parsedActionType}) status NOT updated. Current status ID: ${currentStatusId}.`);
      }
    }

    if (specials_taken) {
      specialUpdateAttempted = true;
      let specialUpdateResult;
      if (parsedActionType === ACTION_TAKEN_ID) {
        specialUpdateResult = await client.query(
          'UPDATE specials SET status = $1 WHERE id = $2 AND status = $3', // Must be 'In Stock'
          [STATUS_TAKEN_ID, specials_taken, STATUS_IN_STOCK_ID]
        );
        if (specialUpdateResult.rowCount > 0) specialUpdateSucceeded = true;
      } else if (parsedActionType === ACTION_RETURNED_ID) {
        specialUpdateResult = await client.query(
          'UPDATE specials SET status = $1 WHERE id = $2 AND status IN ($3, $4, $5)', // 'Taken', 'Issued', 'Under Repair'
          [STATUS_IN_STOCK_ID, specials_taken, STATUS_TAKEN_ID, STATUS_ISSUED_ID, STATUS_UNDER_REPAIR_ID]
        );
        if (specialUpdateResult.rowCount > 0) specialUpdateSucceeded = true;
      } else if (parsedActionType === ACTION_MAINTENANCE_ID) {
        specialUpdateResult = await client.query(
          'UPDATE specials SET status = $1 WHERE id = $2 AND status IN ($3, $4, $5)', // 'In Stock', 'Issued', 'Taken'
          [STATUS_UNDER_REPAIR_ID, specials_taken, STATUS_IN_STOCK_ID, STATUS_ISSUED_ID, STATUS_TAKEN_ID]
        );
        if (specialUpdateResult.rowCount > 0) specialUpdateSucceeded = true;
      }

      if (specialUpdateSucceeded) {
        console.log(`[LOG ACTION] Special ID ${specials_taken} status updated successfully for action type ${parsedActionType}.`);
      } else if (parsedActionType === ACTION_TAKEN_ID || parsedActionType === ACTION_RETURNED_ID || parsedActionType === ACTION_MAINTENANCE_ID) {
        const currentStatusRes = await client.query('SELECT status FROM specials WHERE id = $1', [specials_taken]); // Check status within transaction
        const currentStatusId = currentStatusRes.rows.length > 0 ? currentStatusRes.rows[0].status : 'not found';
        console.warn(`[LOG ACTION] Special ID ${specials_taken} (Action Type: ${parsedActionType}) status NOT updated. Current status ID: ${currentStatusId}.`);
      }
    }

    const relevantActionForStatusChange = [ACTION_TAKEN_ID, ACTION_RETURNED_ID, ACTION_MAINTENANCE_ID].includes(parsedActionType);

    if (relevantActionForStatusChange) {
      if ((gunUpdateAttempted && !gunUpdateSucceeded) || (specialUpdateAttempted && !specialUpdateSucceeded)) {
        await client.query('ROLLBACK');
        console.error('[LOG ACTION] Transaction rolled back: Item status update failed as item was not in the expected state.');

        let gunCurrentStatusInfo = '';
        if (gunUpdateAttempted && !gunUpdateSucceeded) {
            const csRes = await pool.query('SELECT ws.name FROM weapon w JOIN weapon_statuses ws ON w.status = ws.id WHERE w.id = $1', [gun_taken]);
            gunCurrentStatusInfo = csRes.rows.length > 0 ? ` Оружие (ID ${gun_taken}) сейчас в статусе "${csRes.rows[0].name}".` : ` Оружие (ID ${gun_taken}) не найдено или статус неизвестен.`;
        }
        let specialCurrentStatusInfo = '';
        if (specialUpdateAttempted && !specialUpdateSucceeded) {
             const csRes = await pool.query('SELECT ws.name FROM specials s JOIN weapon_statuses ws ON s.status = ws.id WHERE s.id = $1', [specials_taken]);
             specialCurrentStatusInfo = csRes.rows.length > 0 ? ` Спецустройство (ID ${specials_taken}) сейчас в статусе "${csRes.rows[0].name}".` : ` Спецустройство (ID ${specials_taken}) не найдено или статус неизвестен.`;
        }

        return res.status(409).json({ 
            success: false,
            message: `Действие не выполнено: Статус предмета не соответствует ожидаемому для этого действия.${gunCurrentStatusInfo}${specialCurrentStatusInfo} Убедитесь, что предмет находится в корректном состоянии.`
        });
      }
    }

    await client.query('COMMIT');

    // Fetch the newly created log with details for the response (using the main pool, not client, as transaction is committed)
    const logWithDetails = await pool.query(`
      SELECT
        l.id, l.action_time AS time,
        s.name || ' ' || s.surname || ' ' || COALESCE(s.lastname, '') AS user,
        a.name AS action, w.name AS weapon_name, sp.name AS special_name,
        l.comment, as_status.name AS status_name
      FROM logs l
      JOIN soldiers s ON l.soldier = s.id
      JOIN actions a ON l.action_type = a.id
      LEFT JOIN weapon w ON l.gun_taken = w.id
      LEFT JOIN specials sp ON l.specials_taken = sp.id
      JOIN action_status as_status ON l.status = as_status.id
      WHERE l.id = $1
    `, [newLogId]);

    const formattedLog = logWithDetails.rows[0];
    res.status(201).json({
      success: true,
      message: 'Лог успешно создан, статус предмета обновлен (Log created, item status updated successfully)',
      log: {
        id: formattedLog.id,
        time: formattedLog.time ? new Date(formattedLog.time).toLocaleString('ru-RU') : 'N/A',
        user: formattedLog.user,
        action: formattedLog.action,
        item: formattedLog.weapon_name || formattedLog.special_name || "Не указано",
        comment: formattedLog.comment || "Нет комментариев",
        status: formattedLog.status_name
      },
    });

  } catch (error) {
    // Only rollback if client exists and transaction might have started
    if (client) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Ошибка при отмене транзакции (Error during rollback):', rollbackError);
        }
    }
    console.error('Ошибка при создании лога или обновлении статуса предмета (Error creating log entry or updating item status):', error);
    if (error.constraint) { // Handle specific DB constraint errors
        return res.status(400).json({ success: false, message: `Ошибка данных: ${error.detail || error.message} (Data error due to constraint: ${error.constraint})` });
    }
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error during log creation)' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get('/api/soldiers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, surname, lastname, qualification, license_level, barrack_id
      FROM soldiers
    `);
    res.json({ success: true, soldiers: result.rows });
  } catch (error) {
    console.error('Ошибка при получении списка солдат (Error fetching soldiers list):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

app.get('/api/actions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name, description FROM actions`);
    res.json({ success: true, actions: result.rows });
  } catch (error) {
    console.error('Ошибка при получении списка действий (Error fetching actions list):', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера (Server error)' });
  }
});

// Helper function to build WHERE clause and values for log exports
function buildLogExportQuery(filters) {
  let queryBase = `
    SELECT
      l.id, l.action_time AS time,
      s.name || ' ' || s.surname || ' ' || COALESCE(s.lastname, '') AS "user",
      a.name AS action,
      w.name AS weapon_name,
      sp.name AS special_name,
      l.comment,
      as_status.name AS status
    FROM logs l
    JOIN soldiers s ON l.soldier = s.id
    JOIN actions a ON l.action_type = a.id
    LEFT JOIN weapon w ON l.gun_taken = w.id
    LEFT JOIN specials sp ON l.specials_taken = sp.id
    JOIN action_status as_status ON l.status = as_status.id
  `;
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (filters.start_date) {
    conditions.push(`l.action_time >= $${paramIndex++}`);
    values.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push(`l.action_time <= $${paramIndex++}`);
    values.push(filters.end_date);
  }
  if (filters.action) {
    conditions.push(`a.name = $${paramIndex++}`);
    values.push(filters.action);
  }
  if (filters.item) {
    // Ensure item filter checks both weapon and special names
    conditions.push(`(w.name = $${paramIndex} OR sp.name = $${paramIndex})`);
    values.push(filters.item);
    paramIndex++;
  }
  if (filters.status) {
    conditions.push(`as_status.name = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (conditions.length > 0) {
    queryBase += ' WHERE ' + conditions.join(' AND ');
  }
  queryBase += ' ORDER BY l.action_time DESC';

  return { query: queryBase, values };
}

app.get('/api/logs/export/pdf', authenticateToken, verifyCsrfToken, async (req, res) => {
  try {
    const { start_date, end_date, action, item, status } = req.query;
    const { query, values } = buildLogExportQuery({ start_date, end_date, action, item, status });

    const result = await pool.query(query, values);
    const logs = result.rows;

    // PDFMake document definition (ensure pdfMake and vfs_fonts are correctly configured)
    const docDefinition = {
      content: [
        { text: 'Отчет по логам', style: 'header' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*'], // Adjusted widths
            body: [
              [
                { text: 'ID', style: 'tableHeader' },
                { text: 'Время', style: 'tableHeader' },
                { text: 'Пользователь', style: 'tableHeader' },
                { text: 'Действие', style: 'tableHeader' },
                { text: 'Предмет', style: 'tableHeader' },
                { text: 'Статус', style: 'tableHeader' },
                { text: 'Комментарий', style: 'tableHeader' }
              ],
              ...logs.map(log => [
                log.id,
                log.time ? new Date(log.time).toLocaleString('ru-RU') : 'N/A',
                log.user || 'Не указан',
                log.action || 'Не указано',
                log.weapon_name || log.special_name || '—',
                log.status || 'Не указан',
                log.comment || ''
              ])
            ]
          }
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 20] },
        tableHeader: { bold: true, fontSize: 10 }
      },
      defaultStyle: { font: 'Roboto' } // Make sure Roboto font is in pdfMake.vfs
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBuffer((buffer) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="logs_report.pdf"');
      res.send(buffer);
    });

  } catch (error) {
    console.error('Ошибка при экспорте логов в PDF:', error);
    if (error.message && error.message.includes("Font 'Roboto' not found")) {
         console.error("CRITICAL PDFMake VFS Error: Roboto font not found. Check VFS setup.");
         return res.status(500).json({ success: false, message: 'Ошибка генерации PDF: Шрифт не найден.' });
    }
    res.status(500).json({ success: false, message: 'Ошибка сервера при экспорте PDF' });
  }
});

app.get('/api/logs/export/csv', authenticateToken, verifyCsrfToken, async (req, res) => {
  try {
    const { start_date, end_date, action, item, status } = req.query;
    const { query, values } = buildLogExportQuery({ start_date, end_date, action, item, status });
    const result = await pool.query(query, values);

    const logsData = result.rows.map(log => ({
        id: log.id,
        time: log.time ? new Date(log.time).toLocaleString('ru-RU') : 'N/A',
        user: log.user || 'Не указан',
        action: log.action || 'Не указано',
        item: log.weapon_name || log.special_name || 'Не указано',
        status_name: log.status || 'Не указан', // Use a distinct key for the CSV header
        comment: log.comment || ''
    }));

    const csvFilename = `temp_logs_report_${Date.now()}.csv`; // Ensure this is unique enough or placed in a temp dir
    const writer = createObjectCsvWriter({
      path: csvFilename,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'time', title: 'Время' },
        { id: 'user', title: 'Пользователь' },
        { id: 'action', title: 'Действие' },
        { id: 'item', title: 'Предмет' },
        { id: 'status_name', title: 'Статус' },
        { id: 'comment', title: 'Комментарий' },
      ]
    });

    await writer.writeRecords(logsData);

    res.download(csvFilename, 'logs_report.csv', (err) => {
      if (err) {
        console.error("Ошибка при скачивании CSV:", err);
        if (!res.headersSent) {
            res.status(500).send("Ошибка при генерации CSV отчета");
        }
      }
      // Clean up the temporary file
      require('fs').unlink(csvFilename, (unlinkErr) => {
        if (unlinkErr) console.error("Ошибка при удалении временного CSV файла:", unlinkErr);
      });
    });
  } catch (error) {
    console.error('Ошибка при экспорте логов в CSV:', error);
    if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Ошибка сервера при экспорте CSV' });
    }
  }
});

app.get('/api/logs/export/xlsx', authenticateToken, verifyCsrfToken, async (req, res) => {
  try {
    const { start_date, end_date, action, item, status: statusFilter } = req.query; // Alias status to avoid naming conflicts
    const { query, values } = buildLogExportQuery({ start_date, end_date, action, item, status: statusFilter });
    const result = await pool.query(query, values);
    const logs = result.rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Логи');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Время', key: 'time', width: 25 },
      { header: 'Пользователь', key: 'user', width: 30 },
      { header: 'Действие', key: 'action', width: 25 },
      { header: 'Оружие', key: 'weapon_name', width: 20 },
      { header: 'Спецустройство', key: 'special_name', width: 20 },
      { header: 'Комментарий', key: 'comment', width: 40 },
      { header: 'Статус', key: 'status_data', width: 20 } // Key for data mapping
    ];

    logs.forEach((log) => {
      worksheet.addRow({
        id: log.id,
        time: log.time ? new Date(log.time).toLocaleString('ru-RU') : 'N/A',
        user: log.user || 'Не указан',
        action: log.action || 'Не указано',
        weapon_name: log.weapon_name || '',
        special_name: log.special_name || '',
        comment: log.comment || '',
        status_data: log.status || 'Не указан' // Mapped to 'status_data' key
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logs_report.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Ошибка при экспорте логов в XLSX:', error);
    if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Ошибка сервера при экспорте XLSX' });
    }
  }
});

// --- Server Startup ---
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port} (Server running on http://localhost:${port})`);
  console.warn("!!! SECURITY WARNING: Ensure JWT_SECRET is strong and passwords in the database are hashed !!!");
});
