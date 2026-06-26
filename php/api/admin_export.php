<?php
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/xlsx.php';
bootstrap();
require_admin();

$rows = db()->query('SELECT ' . USER_COLUMNS . ' FROM users ORDER BY created_at DESC')->fetchAll();

// Собираем произвольные поля и список уникальных названий-столбцов
$fieldsByUser = [];
$dynamicNames = [];
foreach ($rows as $r) {
    $fields = get_custom_fields($r['id']);
    $fieldsByUser[$r['id']] = $fields;
    foreach ($fields as $f) {
        if (!in_array($f['field_name'], $dynamicNames, true)) {
            $dynamicNames[] = $f['field_name'];
        }
    }
}

$headers = array_merge([
    'ID', 'Имя', 'Фамилия', 'Пол', 'Место рождения', 'Гражданство',
    'Адрес проживания', 'Специальность', 'Телефон', 'Согласие',
    'Комментарий администратора', 'Дата регистрации', 'Обновлено',
], $dynamicNames);

$data = [];
foreach ($rows as $r) {
    $line = [
        $r['id'],
        $r['first_name'],
        $r['last_name'],
        $r['gender'],
        $r['birth_place'],
        $r['citizenship'],
        $r['address'],
        $r['specialty'],
        $r['phone'],
        ((int)$r['consent']) ? 'Да' : 'Нет',
        (string)$r['admin_comment'],
        fmt_dt($r['created_at']),
        fmt_dt($r['updated_at']),
    ];
    // значения произвольных полей по порядку столбцов
    $map = [];
    foreach ($fieldsByUser[$r['id']] as $f) {
        $map[$f['field_name']] = $f['field_value'];
    }
    foreach ($dynamicNames as $name) {
        $line[] = $map[$name] ?? '';
    }
    $data[] = $line;
}

output_spreadsheet('reestr-' . date('Y-m-d_H-i-s'), $headers, $data);

function fmt_dt($s)
{
    $ts = strtotime($s);
    if (!$ts) return $s;
    return date('d.m.Y H:i', $ts);
}
