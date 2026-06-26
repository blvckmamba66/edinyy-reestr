<?php
require_once __DIR__ . '/config.php';

// Возвращает единое подключение PDO к базе данных.
function db()
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// Создаёт таблицы при первом запуске (безопасно вызывать каждый раз).
function init_db()
{
    $pdo = db();

    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        first_name    VARCHAR(255) NOT NULL,
        last_name     VARCHAR(255) NOT NULL,
        gender        VARCHAR(8)   NOT NULL,
        birth_place   VARCHAR(255) NOT NULL,
        citizenship   VARCHAR(255) NOT NULL,
        address       VARCHAR(500) NOT NULL DEFAULT '',
        specialty     VARCHAR(255) NOT NULL DEFAULT '',
        phone         VARCHAR(20)  NOT NULL UNIQUE,
        consent       TINYINT      NOT NULL DEFAULT 0,
        admin_comment TEXT         NULL,
        created_at    DATETIME     NOT NULL,
        updated_at    DATETIME     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_fields (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        field_name  VARCHAR(255) NOT NULL,
        field_value VARCHAR(1000) NOT NULL DEFAULT '',
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS otp_codes (
        phone      VARCHAR(20) PRIMARY KEY,
        code       VARCHAR(10) NOT NULL,
        expires_at BIGINT      NOT NULL,
        attempts   INT         NOT NULL DEFAULT 0,
        verified   TINYINT     NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
