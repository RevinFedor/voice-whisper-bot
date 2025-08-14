import { useRef, useLayoutEffect, useState, useCallback } from 'react';

/**
 * Хук для textarea с сохранением позиции скролла и курсора
 * Решает все проблемы:
 * - Сброс скролла при изменении
 * - Позиция курсора 0 при первом клике
 * - Прыжок при Enter
 */
export const useScrollPreservingTextarea = () => {
  const textAreaRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);

  // Восстановление позиции после обновления
  const restorePosition = useCallback(() => {
    const textArea = textAreaRef.current;
    
    if (textArea && !isFirstInteraction && !isRestoringScroll) {
      const scrollDiff = Math.abs(textArea.scrollTop - scrollTop);
      
      if (scrollDiff > 10) {
        setIsRestoringScroll(true);
        
        textArea.setSelectionRange(cursor, cursor);
        textArea.scrollTop = scrollTop;
        
        requestAnimationFrame(() => {
          setIsRestoringScroll(false);
        });
      }
    }
  }, [cursor, scrollTop, isFirstInteraction, isRestoringScroll]);

  const handleChange = useCallback((e) => {
    const { selectionStart, scrollTop: currentScroll } = e.target;
    
    setCursor(selectionStart);
    setScrollTop(currentScroll);
  }, []);

  const handleClick = useCallback((e) => {
    if (isFirstInteraction) {
      requestAnimationFrame(() => {
        const realPosition = e.target.selectionStart;
        if (realPosition >= 0) {
          e.target.setSelectionRange(realPosition, realPosition);
          setCursor(realPosition);
          setScrollTop(e.target.scrollTop);
        }
      });
      setIsFirstInteraction(false);
    } else {
      setCursor(e.target.selectionStart);
      setScrollTop(e.target.scrollTop);
    }
  }, [isFirstInteraction]);

  const handleFocus = useCallback((e) => {
    if (isFirstInteraction) {
      setTimeout(() => {
        const currentPos = e.target.selectionStart;
        setCursor(currentPos);
        setScrollTop(e.target.scrollTop);
        setIsFirstInteraction(false);
      }, 0);
    }
  }, [isFirstInteraction]);

  const handleScroll = useCallback((e) => {
    if (!isRestoringScroll) {
      setScrollTop(e.target.scrollTop);
    }
  }, [isRestoringScroll]);

  const handleSelect = useCallback((e) => {
    setCursor(e.target.selectionStart);
  }, []);

  const handleKeyDown = useCallback((e, value, onChange) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const pos = e.target.selectionStart;
      const currentScrollTop = e.target.scrollTop;
      const newValue = value.slice(0, pos) + '\n' + value.slice(pos);
      
      if (isFirstInteraction) {
        setIsFirstInteraction(false);
      }
      
      onChange && onChange(newValue);
      
      requestAnimationFrame(() => {
        e.target.setSelectionRange(pos + 1, pos + 1);
        e.target.scrollTop = currentScrollTop;
        setCursor(pos + 1);
        setScrollTop(currentScrollTop);
      });
    }
  }, [isFirstInteraction]);

  return {
    textAreaRef,
    restorePosition,
    handlers: {
      onChange: handleChange,
      onClick: handleClick,
      onFocus: handleFocus,
      onScroll: handleScroll,
      onSelect: handleSelect,
      onKeyDown: handleKeyDown
    }
  };
};