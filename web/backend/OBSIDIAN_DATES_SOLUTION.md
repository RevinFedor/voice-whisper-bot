# Решение проблемы с датами в Obsidian

## Проблема
При создании файлов через Obsidian REST API системная дата файла = текущее время, а не реальная дата заметки.

## Решение (2 уровня)

### 1. Frontmatter (всегда работает)
Добавляем в каждый файл:
```yaml
---
created: "2024-08-19 14:30:00"
modified: "2024-08-19 14:30:00"
date: "2024-08-19 14:30:00"
---
```

### 2. Системные даты (macOS)
Используем `SetFile` для изменения дат после создания файла:
```bash
SetFile -d "MM/DD/YYYY HH:MM:SS" file.md  # Дата создания
SetFile -m "MM/DD/YYYY HH:MM:SS" file.md  # Дата модификации
```

## Настройка

Добавьте в `.env`:
```bash
OBSIDIAN_VAULT_PATH="/Users/fedor/Documents/Obsidian Vault"
```

## Как использовать в Obsidian

### Вариант 1: Dataview плагин
```dataview
TABLE created, modified
FROM "test-from-web"
SORT created DESC
```

### Вариант 2: Properties панель
В Obsidian 1.4+ свойства из frontmatter показываются в UI

### Рекомендуемые плагины
- **Update Frontmatter Modified Date** - автоматически обновляет даты
- **Dataview** - для запросов по frontmatter датам

## Результат
✅ Frontmatter всегда содержит правильные даты
✅ На macOS системные даты тоже правильные (через SetFile)
✅ Obsidian показывает реальные даты заметок