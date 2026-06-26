<?php
// Страница проверки и установки.
// Откройте её в браузере один раз после загрузки файлов и настройки config.php:
//   https://ваш-домен/install.php
// Она проверит окружение, подключение к базе и создаст таблицы.
// ПОСЛЕ успешной установки удалите этот файл с хостинга.

header('Content-Type: text/html; charset=utf-8');

function row($ok, $label, $detail = '')
{
    $color = $ok ? '#1f7a44' : '#b3261e';
    $mark = $ok ? '✓' : '✗';
    echo "<tr><td style='color:$color;font-weight:700;font-size:18px'>$mark</td><td>" . htmlspecialchars($label) . "</td><td style='color:#6b7686'>" . htmlspecialchars($detail) . "</td></tr>";
}

echo '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Установка — Единый реестр</title>';
echo '<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f3f5f8;color:#1c2533;padding:30px;max-width:760px;margin:0 auto}';
echo 'h1{color:#14305c}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d8dee8;border-radius:10px;overflow:hidden}';
echo 'td{padding:10px 12px;border-top:1px solid #eef1f6}.box{background:#fff;border:1px solid #d8dee8;border-radius:10px;padding:16px 18px;margin-top:16px}';
echo '.ok{color:#1f7a44}.err{color:#b3261e}a{color:#1f4a8a}</style></head><body>';
echo '<h1>Проверка установки</h1><table>';

// 1. Версия PHP
$phpOk = version_compare(PHP_VERSION, '7.4.0', '>=');
row($phpOk, 'Версия PHP', PHP_VERSION . ($phpOk ? '' : ' — нужна 7.4 и выше'));

// 2. Расширения
row(extension_loaded('pdo_mysql'), 'Расширение PDO MySQL', extension_loaded('pdo_mysql') ? 'есть' : 'не установлено');
row(class_exists('ZipArchive'), 'ZipArchive (для .xlsx)', class_exists('ZipArchive') ? 'есть' : 'нет — экспорт будет в CSV');
row(function_exists('curl_init') || ini_get('allow_url_fopen'), 'HTTP-запросы (для SMS)', function_exists('curl_init') ? 'cURL' : (ini_get('allow_url_fopen') ? 'file_get_contents' : 'недоступно'));

// 3. База данных
$dbOk = false;
$dbDetail = '';
try {
    require_once __DIR__ . '/includes/db.php';
    db();
    init_db();
    $dbOk = true;
    $dbDetail = 'подключение успешно, таблицы созданы';
} catch (Throwable $e) {
    $dbDetail = $e->getMessage();
}
row($dbOk, 'База данных MySQL', $dbDetail);

echo '</table>';

if ($dbOk && $phpOk) {
    echo '<div class="box"><p class="ok"><b>Всё готово!</b> Сайт можно открывать.</p>';
    echo '<p>→ <a href="/">Открыть сайт</a> &nbsp;|&nbsp; <a href="/admin.html">Админ-панель</a></p>';
    echo '<p style="color:#b3261e"><b>Важно:</b> удалите файл <code>install.php</code> с хостинга после проверки.</p></div>';
} else {
    echo '<div class="box"><p class="err"><b>Есть проблемы.</b> Исправьте отмеченные пункты.</p>';
    echo '<p>Чаще всего нужно заполнить данные базы в файле <code>includes/config.php</code> (имя БД, пользователь, пароль из панели reg.ru).</p></div>';
}

echo '</body></html>';
