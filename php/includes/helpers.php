<?php
require_once __DIR__ . '/db.php';

// Колонки пользователя, отдаваемые наружу
const USER_COLUMNS = 'id, first_name, last_name, gender, birth_place, citizenship, address, specialty, phone, consent, admin_comment, created_at, updated_at';

// Отправить JSON-ответ и завершить выполнение
function json_out($data, $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Прочитать тело запроса как JSON (массив)
function read_json_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Нормализация телефона к виду +7XXXXXXXXXX (или null, если некорректный)
function normalize_phone($raw)
{
    if (!is_string($raw)) return null;
    $digits = preg_replace('/\D/', '', $raw);
    if (strlen($digits) === 11 && $digits[0] === '8') $digits = '7' . substr($digits, 1);
    if (strlen($digits) === 10) $digits = '7' . $digits;
    if (strlen($digits) !== 11 || $digits[0] !== '7') return null;
    return '+' . $digits;
}

// Запустить сессию (один раз)
function ensure_session()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

// Проверка прав администратора — иначе 401
function require_admin()
{
    ensure_session();
    if (empty($_SESSION['is_admin'])) {
        json_out(['error' => 'Требуется авторизация администратора'], 401);
    }
}

// Произвольные поля пользователя
function get_custom_fields($userId)
{
    $stmt = db()->prepare('SELECT id, field_name, field_value FROM user_fields WHERE user_id = ? ORDER BY id');
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

// Добавить произвольные поля и привести consent к числу
function with_custom_fields($user)
{
    if (!$user) return $user;
    $user['consent'] = (int) $user['consent'];
    $user['custom_fields'] = get_custom_fields($user['id']);
    return $user;
}

// Бутстрап для всех точек входа
function bootstrap()
{
    ensure_session();
    try {
        init_db();
    } catch (Throwable $e) {
        json_out(['error' => 'Ошибка базы данных: ' . $e->getMessage()], 500);
    }
}
