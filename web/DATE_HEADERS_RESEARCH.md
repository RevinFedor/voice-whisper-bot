# Исследование работы с текстом и HTML-блоками в tldraw

## Резюме исследования

Проведено комплексное исследование возможностей работы с текстовыми и HTML элементами в tldraw v3.15.1 для проекта voice-whisper-bot.

## 1. Варианты вставки HTML-блоков в tldraw

### Поддержка HTML элементов
- **Rich Text Support (2025)**: tldraw добавил полноценную поддержку rich text через **TipTap** editor
- **Возможности**: bold, italics, lists, links, code styles
- **Хранение**: Rich text хранится как JSON-документ TipTap в свойстве `richText`
- **Расширяемость**: Поддерживает кастомные TipTap расширения через `textOptions`

### Ключевые компоненты
- `HTMLContainer` - для рендеринга HTML элементов
- `SVGContainer` - для SVG элементов  
- `RichTextLabel` - для рендеринга rich text
- `RichTextArea` - для редактирования rich text (использует TipTap)
- `TextManager.measureHtml` - для измерения HTML-контента

### Архитектура
```typescript
class CustomShapeUtil extends ShapeUtil<CustomShape> {
  component(shape: CustomShape) {
    return (
      <HTMLContainer style={{ pointerEvents: 'all' }}>
        {/* Любой JSX/HTML контент */}
      </HTMLContainer>
    )
  }
}
```

## 2. Текущая реализация текстовых элементов

### Структура в проекте
- **CustomNoteShapeUtil** (`/frontend/src/components/CustomNoteShape.jsx`)
  - Использует `HTMLContainer` для рендеринга
  - Поддерживает типы заметок: voice, text, collection
  - Цветовая схема: голубой (#4a9eff), зеленый (#4aff4a), темно-зеленый (#2a4)

### Создание текстовых заголовков дат
```javascript
// SyncedProductionApp.jsx:257-271
editor.createShape({
    type: 'text',
    props: {
        richText: toRichText(`${day}\n${month}`),
        color: isToday ? 'green' : 'grey',
        size: 'xl',
        font: 'sans',
        autoSize: true,
        textAlign: 'middle',
    },
});
```

## 3. Возможности кастомизации

### Поддерживаемые цвета tldraw
```javascript
const allowedColors = [
    "black", "grey", "light-violet", "violet", 
    "blue", "light-blue", "yellow", "orange",
    "green", "light-green", "light-red", "red", "white"
];
```

### Расширение функциональности
- Можно добавлять новые свойства к shapes
- Полная поддержка React hooks и JSX
- Возможность встраивания интерактивного контента
- Поддержка медиа и даже встроенных веб-сайтов

## 4. Решение проблемы с валидацией цвета

### Проблема
Ошибка: `Expected "black" or "grey" or ... got light-grey`

### Анализ
- В коде используются только валидные цвета ('green', 'grey', 'black')
- Нет упоминаний "light-grey" в коде проекта
- Все shapes создаются с правильными цветами

### Потенциальные причины
1. Runtime ошибка при определенных условиях
2. Проблемы с кешем браузера при разработке
3. Конфликты версий tldraw
4. Неправильная конвертация данных при загрузке

### Рекомендации по исправлению
1. Очистить кеш браузера и node_modules
2. Убедиться в консистентности версий tldraw
3. Добавить валидацию цветов перед созданием shapes
4. Использовать `DefaultColorStyle` и `DefaultLabelColorStyle` из tldraw

## 5. Работа с обводками текста

### Методы реализации обводок

#### CSS text-stroke (рекомендуемый)
```css
.text-outline {
    -webkit-text-stroke: 1px #000;
    text-stroke: 1px #000;
}
```
✅ Лучшая производительность
✅ Hardware acceleration
⚠️ Может быть проблематично на мобильных

#### Text-shadow fallback
```css
.text-outline-shadow {
    text-shadow: 
        -1px -1px 0 #000, 1px -1px 0 #000,
        -1px 1px 0 #000, 1px 1px 0 #000;
}
```
⚠️ Плохая производительность при множественных тенях
❌ Медленно при скроллинге на мобильных

#### CSS filter
```css
.text-outline-filter {
    filter: 
        drop-shadow(1px 0 0 #000)
        drop-shadow(-1px 0 0 #000);
}
```
✅ Hardware acceleration
✅ Лучше text-shadow для анимаций
⚠️ Потребляет больше GPU памяти

### Интеграция в CustomNoteShape
```javascript
// Добавить в props
static props = {
    // ... существующие пропсы
    textStrokeWidth: T.number,
    textStrokeColor: T.string,
    enableTextStroke: T.boolean,
};

// В component методе
const textStrokeStyle = enableTextStroke ? {
    WebkitTextStroke: `${textStrokeWidth}px ${textStrokeColor}`,
    textStroke: `${textStrokeWidth}px ${textStrokeColor}`,
} : {};
```

## 6. Сравнение с другими платформами

### Miro
- Rich text editor с базовым форматированием
- Ограниченные возможности (нельзя разные размеры текста)
- CSS стили через API не отображаются в sticky notes

### Notion
- Полноценная rich text система
- Поддержка embedding из 1,900+ доменов
- Notion Forms и Charts (2024-2025)
- Ограничения с embeds требующими логина

### Figma
- Rich Text Editor Component Kit
- Auto Layout для динамических макетов
- WebAssembly + WebGL для рендеринга
- Конвертация текста в векторные пути

## Выводы

1. **tldraw предлагает наиболее гибкий подход** к HTML интеграции среди рассмотренных платформ
2. **Проблема с цветами** скорее всего runtime issue, код корректен
3. **Обводки текста** легко реализуемы через CSS с учетом производительности
4. **Rich text через TipTap** дает полноценные возможности форматирования
5. **HTMLContainer** позволяет встраивать любой React/HTML контент

## Рекомендации для дальнейшей разработки

1. Использовать HTMLContainer для сложных HTML блоков
2. Применять CSS text-stroke для обводок с fallback на text-shadow
3. Всегда валидировать цвета перед передачей в tldraw
4. Использовать TipTap расширения для дополнительного форматирования
5. Добавить debug утилиты для отслеживания runtime ошибок с цветами