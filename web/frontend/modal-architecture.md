# 🏗️ Архитектура модальных окон

## 📐 Схема управления

```
ModalStackProvider (глобальный контекст)
    └─> Stack модалок с приоритетами
            └─> Группы взаимоисключения
                    └─> Escape-обработчики
```

## 🚇 Архитектура тоннелей

### Тоннель A: Простое закрытие
```
NoteModal → Esc → Закрыто
```
**Реализация:** `NoteModal.jsx:1150` - базовый `useModalEscape`

### Тоннель B: Вложенная иерархия
```
NoteModal → ExpandedTitle(800) → TagInput(700) → AI Panel(500)
     Esc ←────────── Esc ←────────── Esc ←────────── Esc
```
**Реализация:** Приоритеты в `ModalStackContext.jsx:15-25`

### Тоннель C: Взаимоисключение в группе
```
TitleAI ──┐
TagHistory ├─> PANELS_GROUP (только один активен)
TagAI ────┘
```
**Реализация:** `group: 'PANELS_GROUP'` в `NoteModal.jsx:1180-1250`

### Графические тоннели (Z-index)
```
Dropdown(1000) > ExpandedInput(800) > TagInput(700) > Panels(500) > Base(100)
```

## ⚙️ Конфигурация модалок с группами

### Основная конфигурация
```javascript
// contexts/ModalStackContext.jsx:15-25
MODAL_PRIORITIES = {
  DROPDOWN: 1000,
  EXPANDED_INPUT: 800,   
  TAG_INPUT: 700,       
  PROMPT_PANEL: 600,    
  TAG_PANELS: 500,      
  NOTE_MODAL: 100
}

// contexts/ModalStackContext.jsx:27-35
MODAL_GROUPS = {
  PANELS_GROUP: {
    mode: 'exclusive',
    modals: ['title-ai', 'title-history', 'tag-ai', 'tag-history', 'obsidian-tags']
  }
}
```

### Использование в компонентах
```javascript
// components/NoteModal.jsx:1180
useModalEscape(
  `${modalId}-title-ai`,
  handleClose,
  showPrompt ? PRIORITY : -1,
  { group: 'PANELS_GROUP', exclusive: true }
)
```

## 🔧 Ключевые функции и их расположение

### ModalStackContext.jsx
- `registerModal(id, handler, priority, options)` - линия 45
- `unregisterModal(id)` - линия 78  
- `handleGlobalEscape()` - линия 95
- `sortModalsByPriority()` - линия 120

### NoteModal.jsx
- `toggleHistory()` - линия 850 (закрывает другие панели)
- `togglePrompt()` - линия 865
- `toggleTagChat()` - линия 880
- `toggleTagHistory()` - линия 895
- `toggleObsidianTags()` - линия 910

### Хуки escape (NoteModal.jsx)
- Основная модалка: линия 1150
- Раскрытый заголовок: линия 1160  
- Input тегов: линия 1170
- AI панели: линии 1180-1250 (5 штук с группой)

## 🎮 Паттерн toggle с взаимоисключением

```javascript
// components/NoteModal.jsx:850
toggleHistory() {
  setShowHistory(!showHistory)
  // Закрываем ВСЕ остальные
  setShowPrompt(false)
  setShowTagChat(false)
  setShowTagHistory(false)
  setShowObsidianTags(false)
}
```

## 🔍 Debug-утилиты

```javascript
window.debugModalStack()     // contexts/ModalStackContext.jsx:200
window.testModalEscape.help() // utils/modalTestHelpers.js:10
window.checkPriorities()      // utils/modalTestHelpers.js:25
```

## 📊 Структура стека в runtime

```javascript
// Пример состояния стека
modalStack = [
  { id: 'note-123', priority: 100, handler: fn },
  { id: 'note-123-title', priority: 800, handler: fn },
  { id: 'note-123-title-ai', priority: 600, handler: fn, group: 'PANELS_GROUP' }
]
// При Esc обрабатывается сверху вниз (от большего приоритета)
```

## 🚀 Быстрая интеграция новой модалки

1. Добавить приоритет в `MODAL_PRIORITIES` (ModalStackContext.jsx:15)
2. Добавить в группу если нужно (ModalStackContext.jsx:27)
3. Использовать хук в компоненте:
```javascript
useModalEscape(id, handler, priority, { group: 'MY_GROUP' })
```
4. Реализовать toggle с закрытием других (по паттерну из NoteModal.jsx:850)

---

## 🤖 ОБЯЗАТЕЛЬНО ДЛЯ AI МОДЕЛЕЙ - ПРАВИЛА ДОБАВЛЕНИЯ МОДАЛОК

### ⚠️ Модалка подтверждения/предупреждения

**Когда нужна:** Удаление, необратимые действия, важные предупреждения

**Шаги реализации:**
1. Создай компонент в `/components/modals/ConfirmModal.jsx`:
```javascript
import { useModalEscape } from '../../contexts/ModalStackContext'

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Да", cancelText = "Отмена" }) {
  useModalEscape(
    'confirm-modal',
    () => { onClose(); return true },
    isOpen ? 200 : -1  // Приоритет между базовыми и вложенными
  )
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onClose}>{cancelText}</button>
      </div>
    </div>
  )
}
```

2. Используй в родительском компоненте:
```javascript
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

<ConfirmModal 
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  onConfirm={handleDelete}
  title="Удалить заметки?"
  message={`Вы уверены что хотите удалить ${selectedNotes.length} заметок?`}
/>
```

### 🔔 Toast уведомления

**Когда нужны:** Успешные операции, ошибки, информационные сообщения

**Используй готовый хук:** `/hooks/useToast.js`
```javascript
import { useToast } from '../hooks/useToast'

const { showToast } = useToast()

// Успех
showToast('Заметки удалены', 'success')

// Ошибка  
showToast('Ошибка при удалении', 'error')

// Информация
showToast('Синхронизация...', 'info')
```

### 💡 Тултипы

**Когда нужны:** Подсказки при наведении

**Используй компонент:** `/components/common/Tooltip.jsx`
```javascript
import Tooltip from '../common/Tooltip'

<Tooltip content="Удалить выбранные заметки">
  <button>🗑️</button>
</Tooltip>
```

### 📌 Модалка с AI-генерацией (специфичная для заметок)

**Для AI-тегов при экспорте:**
```javascript
// 1. Проверь есть ли заметки без тегов
const notesWithoutTags = selectedNotes.filter(note => !note.tags?.length)

// 2. Покажи модалку если есть
if (notesWithoutTags.length > 0) {
  setShowAITagsConfirm(true)
  setNotesForAI(notesWithoutTags)
}

// 3. В модалке предложи генерацию
<ConfirmModal
  title="Добавить AI-теги?"
  message={`У ${notesWithoutTags.length} заметок отсутствуют теги. Добавить AI-рекомендации?`}
  onConfirm={async () => {
    for (const note of notesWithoutTags) {
      await generateAITags(note.id)  // Используй существующую функцию
    }
    await exportToObsidian(selectedNotes)
  }}
/>
```

### 🔧 Интеграция с существующей системой

**ВАЖНО:** Всегда проверяй:
1. **Приоритет** - между 100-1000 (см. MODAL_PRIORITIES)
2. **Группу** - нужна ли взаимоисключаемость
3. **Z-index** - чтобы модалка была поверх остальных
4. **Escape** - обязательно используй `useModalEscape`

### 🎯 Готовые паттерны

**Удаление с подтверждением:**
```javascript
const handleDeleteClick = () => {
  setDeleteConfirmData({
    isOpen: true,
    items: selectedNotes,
    onConfirm: async () => {
      await api.deleteNotes(selectedNotes.map(n => n.id))
      showToast('Удалено', 'success')
      refreshNotes()
    }
  })
}
```

**Экспорт с AI-проверкой:**
```javascript
const handleExportClick = () => {
  const needsAI = selectedNotes.some(n => !n.tags?.length)
  if (needsAI) {
    setShowAIConfirm(true)
  } else {
    exportToObsidian(selectedNotes)
  }
}
```

### ⚡ Чеклист для AI при добавлении модалки

- [ ] Определил тип модалки (confirm/toast/tooltip/custom)
- [ ] Выбрал приоритет (100-1000)
- [ ] Добавил `useModalEscape` если нужно Escape
- [ ] Проверил z-index для наложения
- [ ] Добавил в группу если нужна взаимоисключаемость
- [ ] Использовал существующие компоненты где возможно
- [ ] Добавил логирование для отладки

