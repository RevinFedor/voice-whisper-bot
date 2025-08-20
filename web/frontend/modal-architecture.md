# 🏗️ Архитектура модальных окон

## 📐 Как это всё работает

У нас есть система управления модалками, которая решает несколько задач:
- Закрытие по Escape в правильном порядке (сначала вложенные, потом основные)
- **🆕 Закрытие при клике вне модалки (click outside)**
- Автоматическое закрытие одних панелей при открытии других
- **🆕 Сброс всех состояний через resetAllPanels при закрытии модалки**

## 🚇 Архитектура тоннелей

### Тоннель A: Простое закрытие
```
NoteModal → Esc → Закрыто
          → Клик на backdrop → Закрыто + сброс всех панелей
```
**Реализация:** `NoteModal.jsx` - `useModalEscape` + `handleModalClose`

### Тоннель B: Вложенная иерархия с Click Outside
```
NoteModal → ExpandedTitle(800) → TagInput(700) → AI Panel(500)
     Esc ←────────── Esc ←────────── Esc ←────────── Esc
   Click ←──────── Click ←──────── Click ←──────── Click
  outside         outside         outside         outside
```
**Реализация:** Приоритеты в `ModalStackContext.jsx` + хук `useClickOutside`

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

### 🆕 Новые файлы
- `hooks/useClickOutside.js` - универсальный хук для отслеживания кликов вне элемента

### ModalStackContext.jsx
- `registerModal(id, handler, priority, options)` - регистрация модалки в стеке
- `unregisterModal(id)` - удаление из стека  
- `handleGlobalEscape()` - глобальный обработчик Escape

### NoteModal.jsx - Новые функции 🆕
- `resetAllPanels()` - сбрасывает все панели и состояния
- `handleModalClose()` - закрывает модалку со сбросом всех панелей

### Toggle функции (закрывают другие)
- `toggleHistory()` - история заголовков
- `togglePrompt()` - AI чат заголовков
- `toggleTagChat()` - AI чат тегов
- `toggleTagHistory()` - история тегов
- `toggleObsidianTags()` - панель Obsidian тегов

### 🆕 Click Outside Refs в NoteModal
- `titleHistoryPanelRef` - панель истории заголовков
- `titlePromptPanelRef` - AI чат для заголовков
- `tagChatPanelRef` - AI чат для тегов
- `tagHistoryPanelRef` - история тегов
- `obsidianTagsPanelRef` - панель Obsidian тегов
- `addTagInputRef` - инпут добавления тега

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

## 🚀 Как добавить новую модалку с Click Outside

### Шаг 1: Добавь приоритет в ModalStackContext
```javascript
MODAL_PRIORITIES = {
  // ...
  MY_NEW_PANEL: 550,  // Выбери приоритет между существующими
}
```

### Шаг 2: Создай ref с useClickOutside
```javascript
const myPanelRef = useClickOutside(() => {
  setShowMyPanel(false);
}, showMyPanel);
```

### Шаг 3: Добавь Escape обработчик
```javascript
useModalEscape(
  `${modalId}-my-panel`,
  () => {
    setShowMyPanel(false);
    return true;
  },
  showMyPanel ? MODAL_PRIORITIES.MY_NEW_PANEL : -1
);
```

### Шаг 4: Добавь в resetAllPanels
```javascript
const resetAllPanels = useCallback(() => {
  // ...
  setShowMyPanel(false);  // Обязательно добавь!
  // ...
}, []);
```

### Шаг 5: В JSX добавь ref и stopPropagation
```javascript
{showMyPanel && (
  <div 
    ref={myPanelRef}
    onMouseDown={(e) => e.stopPropagation()}  // Важно!
  >
    Контент панели
  </div>
)}
```

### Шаг 6: Toggle функция (если нужно)
```javascript
const toggleMyPanel = () => {
  setShowMyPanel(!showMyPanel);
  // Закрыть другие панели из той же группы
  setShowOtherPanel(false);
}
```

## 🎭 Как всё работает вместе

### Открытие панели:
1. Пользователь нажимает кнопку (например, AI чат)
2. Toggle функция закрывает все другие панели
3. Открывается нужная панель
4. Регистрируется Escape-обработчик
5. Активируется click outside отслеживание

### Закрытие панели:
- **Escape:** через ModalStackContext по приоритетам
- **Клик вне:** через useClickOutside
- **Открытие другой:** через toggle функции
- **Закрытие модалки:** через resetAllPanels

## 🔬 Что тестировать

1. **Клик на backdrop** → всё закрывается ✓
2. **Клик внутри модалки но вне панелей** → панели закрываются ✓
3. **Клик внутри панели** → ничего не происходит ✓
4. **Переключение между заметками** → состояния сбрасываются ✓
5. **Escape** → закрывает по приоритетам ✓
6. **Открытие одной панели** → другие закрываются ✓

## ✨ Что изменилось в последней версии

### Новые возможности:
1. **Click Outside** - все панели теперь закрываются при клике вне них
2. **resetAllPanels()** - функция для сброса всех состояний при закрытии модалки
3. **useClickOutside хук** - универсальный хук для отслеживания кликов вне элемента
4. **handleModalClose()** - обработчик закрытия модалки со сбросом всех панелей

### Исправленные баги:
- Состояние панелей больше не сохраняется между заметками
- При закрытии модалки все панели сбрасываются
- Клик вне панели теперь корректно её закрывает

### Как это влияет на UX:
- Более интуитивное поведение - клик вне панели закрывает её
- Чистое состояние при открытии новой заметки
- Меньше кликов для закрытия вложенных элементов

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

