# Уроки работы с Obsidian Local REST API

## Ключевая ошибка в понимании

### ❌ Что я думал:
- Obsidian API endpoint `/vault/{filename}` возвращает объект с метаданными
- Ожидал структуру: `{ content: "...", tags: [...], ... }`
- Думал что API работает как в telegram-bot из коробки

### ✅ Как на самом деле:
- `/vault/{filename}` возвращает **просто строку** с содержимым файла
- Никаких метаданных в ответе нет
- Теги нужно парсить из frontmatter самостоятельно

## Как работает Obsidian Local REST API

### 1. Поиск файлов с тегами
```javascript
// Запрос с JsonLogic (НЕ работает с обычным Content-Type!)
POST /search/
Content-Type: application/vnd.olrapi.jsonlogic+json
{ "!=": [{ "var": "tags" }, []] }

// Возвращает список файлов: [{ filename: "file.md", result: true }, ...]
```

### 2. Получение содержимого файла
```javascript
GET /vault/{filename}
// Возвращает СТРОКУ с содержимым файла, НЕ объект!
```

### 3. Структура файлов Obsidian
```markdown
---
title: "Заголовок"
date: 2025-06-27 07:35
tags:
  - tag1
  - tag2
  - tag_with_underscore
source: telegram-voice
---

Содержимое файла...
```

## Форматы тегов в frontmatter

### 1. YAML список (чаще всего в Telegram Voice Notes)
```yaml
tags:
  - доброта_к_другим
  - психология
  - саморазвитие
```

### 2. Inline формат (в старых файлах)
```yaml
tags: [tag1, tag2, tag3]
```

## Правильный алгоритм получения тегов

1. **Найти файлы с тегами** через `/search/` с JsonLogic
2. **Для каждого файла получить содержимое** через `/vault/{filename}`
3. **Распарсить frontmatter** из строки:
   - Найти блок между `---\n` и `\n---`
   - Определить формат тегов (YAML список или inline)
   - Извлечь теги соответствующим regex
4. **Отфильтровать** служебные теги (например `tg-transcript`)
5. **Собрать уникальный список** из всех файлов

## Почему в telegram-bot это работало?

В telegram-bot код точно такой же! Но я неправильно читал его:
- Там тоже парсится строка из `/vault/{filename}`
- Просто в коде это не было очевидно из-за проверки `if (fileResponse.data && fileResponse.data.tags)`
- Эта проверка всегда false, потому что `data` - это строка
- Но в telegram-bot видимо были другие пути получения тегов

## Важные детали

### Content-Type для поиска
- ❌ `application/json` - не работает для JsonLogic
- ❌ `application/vnd.olrapi.jsonlogic+json` - правильный, но сложный
- ✅ Проще парсить frontmatter из файлов напрямую

### Особенности тегов
- Теги с пробелами используют подчеркивание: `доброта_к_другим`
- Служебные теги нужно фильтровать: `tg-transcript`
- В Obsidian теги хранятся без `#`, но отображаются с ним

## Итоговое решение

```javascript
// Получаем все файлы с тегами
const filesWithTags = await searchFilesWithTags();

// Для каждого файла
for (const file of filesWithTags) {
  // Получаем содержимое как строку
  const content = await getFileContent(file.filename);
  
  // Парсим frontmatter
  const tags = parseFrontmatterTags(content);
  
  // Добавляем в общий Set
  tags.forEach(tag => allTags.add(tag));
}

return Array.from(allTags).sort();
```

## Выводы

1. **Всегда проверяй тип ответа** - `typeof response.data`
2. **Читай документацию API внимательно** - там может не быть метаданных
3. **Тестируй через curl** - быстрее понимаешь структуру ответов
4. **Парсинг frontmatter** - частая задача при работе с Markdown файлами
5. **YAML имеет разные форматы** - список и inline, нужно поддерживать оба

## Команды для отладки

```bash
# Проверить структуру ответа
curl -H "Authorization: Bearer API_KEY" "http://127.0.0.1:27123/vault/file.md"

# Получить список файлов в папке
curl -H "Authorization: Bearer API_KEY" "http://127.0.0.1:27123/vault/folder/"

# Проверить первые строки файла (с frontmatter)
curl -H "Authorization: Bearer API_KEY" "URL" | head -30
```