<?php
/**
 * Elegancia Dental — Hostinger MySQL
 *
 * 1. hPanel → Databases → MySQL Databases: create a database and a user.
 * 2. Click Add User To Database and grant All Privileges.
 * 3. Copy the FULL names Hostinger shows. They look like:
 *      u123456789_dental
 *      u123456789_clinic
 *    Short names such as dental_clinic or elegencia will fail.
 * 4. phpMyAdmin → select that database → Import install.sql.
 * 5. Copy this file to config.php and paste the exact values.
 */
return array(
  "db_host" => "localhost",
  "db_name" => "u123456789_dental",
  "db_user" => "u123456789_clinic",
  "db_pass" => "YOUR_DATABASE_PASSWORD",
  "db_charset" => "utf8mb4",
  "dashboard_key" => "elg-change-this-to-a-long-secret-key",
);
