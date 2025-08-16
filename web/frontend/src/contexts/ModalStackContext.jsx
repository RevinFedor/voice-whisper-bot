import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Система приоритетов для разных уровней модалок
export const MODAL_PRIORITIES = {
  // Вложенные элементы (высший приоритет - закрываются первыми)
  DROPDOWN: 1000,
  AUTOCOMPLETE: 900,
  EXPANDED_INPUT: 800,     // Раскрытый textarea заголовка
  TAG_INPUT: 700,          // Input для тегов
  PROMPT_PANEL: 600,       // AI панели (история, чат)
  TAG_PANELS: 500,         // Панели тегов (история, Obsidian теги)
  
  // Основные модалки (низкий приоритет - закрываются последними)
  NOTE_MODAL: 100,         // NoteModal
  DATE_PICKER: 100,        // DatePickerModal
  
  // Фоновые элементы
  BACKDROP: 10
};

// Режимы работы групп модалок
export const MODAL_GROUPS = {
  // ВСЕ панели (AI чаты, истории, теги) - взаимоисключающие
  PANELS_GROUP: {
    mode: 'exclusive',
    modals: ['title-ai-chat', 'title-history', 'tag-ai-chat', 'tag-history', 'obsidian-tags']
  },
  
  // Инпуты (могут быть параллельны с другими)
  INPUT_GROUP: {
    mode: 'parallel',
    modals: ['expanded-title', 'tag-input']
  }
};

const ModalStackContext = createContext(null);

export function ModalStackProvider({ children }) {
  const [modalStack, setModalStack] = useState([]);
  const escapeHandlerRef = useRef(null);
  
  // Регистрация модалки в стеке
  const registerModal = useCallback((modalId, priority = 0, escapeHandler, options = {}) => {
    console.log(`📌 Registering modal: ${modalId} with priority: ${priority}`);
    
    setModalStack(prev => {
      // Проверяем группу модалки
      const { group, exclusive = false } = options;
      let newStack = [...prev];
      
      // Если модалка в эксклюзивной группе, закрываем другие из той же группы
      if (group && exclusive) {
        const groupConfig = Object.values(MODAL_GROUPS).find(g => 
          g.modals.includes(modalId.split('-').slice(-2).join('-'))
        );
        
        if (groupConfig && groupConfig.mode === 'exclusive') {
          // Удаляем другие модалки из той же группы
          newStack = newStack.filter(m => {
            const modalType = m.modalId.split('-').slice(-2).join('-');
            const isInSameGroup = groupConfig.modals.includes(modalType);
            if (isInSameGroup && m.modalId !== modalId) {
              console.log(`🔄 Auto-closing modal from same group: ${m.modalId}`);
              // Вызываем их escape handler для корректного закрытия
              if (m.escapeHandler) {
                setTimeout(() => m.escapeHandler(), 0);
              }
              return false;
            }
            return true;
          });
        }
      }
      
      // Добавляем новую модалку
      newStack.push({ modalId, priority, escapeHandler, options });
      
      // Сортируем по приоритету (выше приоритет = первым в массиве)
      newStack.sort((a, b) => b.priority - a.priority);
      
      console.log(`📚 Modal stack updated:`, newStack.map(m => `${m.modalId}(${m.priority})`));
      return newStack;
    });
    
    // Возвращаем функцию для отмены регистрации
    return () => unregisterModal(modalId);
  }, []);
  
  // Удаление модалки из стека
  const unregisterModal = useCallback((modalId) => {
    console.log(`📤 Unregistering modal: ${modalId}`);
    setModalStack(prev => {
      const newStack = prev.filter(m => m.modalId !== modalId);
      console.log(`📚 Modal stack after unregister:`, newStack.map(m => `${m.modalId}(${m.priority})`));
      return newStack;
    });
  }, []);
  
  // Глобальный обработчик Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modalStack.length > 0) {
        // Получаем топовую модалку (с наивысшим приоритетом)
        const topModal = modalStack[0];
        console.log(`⌨️ Escape pressed, top modal: ${topModal.modalId}`);
        
        // Вызываем её обработчик
        if (topModal.escapeHandler) {
          const handled = topModal.escapeHandler();
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`✅ Escape handled by: ${topModal.modalId}`);
          } else {
            console.log(`⏭️ Escape not handled by: ${topModal.modalId}, passing to next`);
          }
        }
      }
    };
    
    // Сохраняем ссылку для отладки
    escapeHandlerRef.current = handleEscape;
    
    // Используем capture: true для перехвата события до bubbling
    document.addEventListener('keydown', handleEscape, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleEscape, { capture: true });
    };
  }, [modalStack]);
  
  // Debug helpers
  const debugStack = useCallback(() => {
    console.log('🔍 Current Modal Stack:');
    modalStack.forEach((modal, index) => {
      console.log(`  ${index + 1}. ${modal.modalId} (priority: ${modal.priority})`);
    });
    if (modalStack.length === 0) {
      console.log('  (empty)');
    }
  }, [modalStack]);
  
  const value = {
    registerModal,
    unregisterModal,
    modalStack,
    debugStack
  };
  
  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
}

// Hook для использования в компонентах
export function useModalEscape(modalId, escapeHandler, priority = 0, options = {}) {
  const context = useContext(ModalStackContext);
  
  if (!context) {
    console.warn(`⚠️ useModalEscape called outside ModalStackProvider for: ${modalId}`);
    return;
  }
  
  const { registerModal } = context;
  
  useEffect(() => {
    // Регистрируем только если есть обработчик и приоритет больше 0
    if (escapeHandler && priority > 0) {
      const unregister = registerModal(modalId, priority, escapeHandler, options);
      return unregister;
    }
  }, [modalId, priority, escapeHandler, registerModal, options]);
}

// Hook для доступа к контексту
export function useModalStack() {
  const context = useContext(ModalStackContext);
  if (!context) {
    throw new Error('useModalStack must be used within ModalStackProvider');
  }
  return context;
}

// Debug command для консоли
if (typeof window !== 'undefined') {
  window.debugModalStack = () => {
    console.log('🔍 Modal Stack Debug:');
    console.log('  Use within a component with useModalStack hook');
    console.log('  Example: const { debugStack } = useModalStack(); debugStack();');
  };
}