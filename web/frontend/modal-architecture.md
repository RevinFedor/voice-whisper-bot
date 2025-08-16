58497c9a-6d3f-4ce4-af2a-8274b9271090

# 🏗️ Архитектура управления модалками

## 📐 Схема иерархии

```
┌─────────────────────────────────────┐
│         ModalStackProvider          │ ← Глобальный контекст
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │      NoteModal (100)        │   │ ← Основные модалки
│  │  ┌─────────────────────┐    │   │
│  │  │ ExpandedTitle (800) │    │   │ ← Вложенные элементы
│  │  └─────────────────────┘    │   │
│  │  ┌─────────────────────┐    │   │
│  │  │   TagInput (700)    │    │   │
│  │  └─────────────────────┘    │   │
│  │  ┌─────────────────────┐    │   │
│  │  │  AI Panels (500-600)│    │   │ ← Взаимоисключающие панели
│  │  └─────────────────────┘    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │    DatePicker (100)         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## 🎯 Принцип работы

### Stack Management (LIFO)
```
Открыли: [NoteModal] → [TitleAI] → [TagInput]
Esc #1:  [NoteModal] → [TitleAI] ← закрывается TagInput
Esc #2:  [NoteModal] ← закрывается TitleAI  
Esc #3:  [] ← закрывается NoteModal
```

## ⚙️ Конфигурация

### Приоритеты
```javascript
MODAL_PRIORITIES = {
  DROPDOWN: 1000,        // Высший
  EXPANDED_INPUT: 800,   
  TAG_INPUT: 700,       
  PROMPT_PANEL: 600,    
  TAG_PANELS: 500,      
  NOTE_MODAL: 100,      // Основные
  DATE_PICKER: 100      
}
```

### Группы взаимоисключения
```javascript
MODAL_GROUPS = {
  PANELS_GROUP: {
    mode: 'exclusive',
    modals: ['title-ai', 'title-history', 'tag-ai', 'tag-history', 'obsidian-tags']
  },
  INPUT_GROUP: {
    mode: 'parallel',
    modals: ['expanded-title', 'tag-input']
  }
}
```

## 🔄 Сценарии использования

### Сценарий A: Простое закрытие
```
NoteModal → Esc → Закрыто
```

### Сценарий B: Вложенные элементы
```
NoteModal → ExpandedTitle → Esc → Свернулся заголовок
                          → Esc → Закрылась модалка
```

### Сценарий C: Взаимоисключающие панели
```
NoteModal → TitleAI → TagHistory
            ↓автозакрытие
         → TagHistory открыта
```

## 📦 Компоненты системы

### `/contexts/ModalStackContext.jsx`
- `ModalStackProvider` - контейнер с глобальным стеком
- `useModalEscape(id, handler, priority, options)` - хук регистрации
- `registerModal()` / `unregisterModal()` - управление стеком

### `/components/NoteModal.jsx`
Использует несколько `useModalEscape`:
- Основная модалка
- Раскрытый заголовок
- Input тегов  
- AI панели (с `group: 'PANELS_GROUP'`)

### `/components/DatePickerModal.jsx`
Простая модалка с одним `useModalEscape`

## 🎮 Логика toggle-функций

### Взаимоисключающие toggle
```javascript
toggleHistory() {
  setShowHistory(!showHistory)
  // Закрываем ВСЕ остальные панели
  setShowPrompt(false)
  setShowTagChat(false)
  setShowTagHistory(false)
  setShowObsidianTags(false)
}
```

## 🔍 Отладка

### Консольные команды
- `testModalEscape.help()` - инструкции тестирования
- `checkPriorities()` - показать приоритеты
- `window.debugModalStack()` - состояние стека

### Логи в консоли
- `📌 Registering modal` - регистрация
- `📚 Modal stack updated` - изменение стека
- `⌨️ Escape pressed` - нажатие клавиши
- `✅ Escape handled by` - обработчик сработал

## 🚀 Расширение системы

### Добавление новой модалки
1. Определить приоритет в `MODAL_PRIORITIES`
2. Добавить в группу если нужна взаимоисключаемость
3. Использовать `useModalEscape` в компоненте
4. Реализовать toggle с закрытием других панелей

### Пример интеграции
```javascript
useModalEscape(
  `${modalId}-my-panel`,
  () => {
    if (showMyPanel) {
      setShowMyPanel(false)
      return true  // Обработано
    }
    return false   // Передать дальше
  },
  showMyPanel ? PRIORITY : -1,
  { group: 'PANELS_GROUP', exclusive: true }
)
```

## 📊 Текущее состояние

### Модалки в системе
- **NoteModal** - основная с 5 вложенными уровнями
- **DatePickerModal** - простая без вложенности
- **5 панелей** - взаимоисключающие (AI чаты, истории, теги)
- **2 input** - могут быть открыты параллельно

### Особенности реализации
- Один глобальный listener на `document`
- Capture phase для перехвата до bubbling
- Автоматическая сортировка по приоритету
- Cleanup при unmount компонентов