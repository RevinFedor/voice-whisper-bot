import { useEffect, useRef } from 'react';

/**
 * Hook для обработки кликов вне элемента
 * @param {Function} handler - Функция, которая вызывается при клике вне элемента
 * @param {boolean} isActive - Активен ли обработчик (по умолчанию true)
 * @param {Array} excludeRefs - Массив ref элементов, клики по которым не должны вызывать handler
 * @returns {Object} ref - Ref который нужно присвоить элементу
 */
export function useClickOutside(handler, isActive = true, excludeRefs = []) {
    const ref = useRef(null);
    const handlerRef = useRef(handler);
    
    // Обновляем handler ref при изменении
    useEffect(() => {
        handlerRef.current = handler;
    });
    
    useEffect(() => {
        if (!isActive) return;
        
        const handleClickOutside = (event) => {
            // Проверяем что клик был не по нашему элементу
            if (ref.current && !ref.current.contains(event.target)) {
                // Проверяем что клик не по исключенным элементам
                const isExcluded = excludeRefs.some(excludeRef => 
                    excludeRef.current && excludeRef.current.contains(event.target)
                );
                
                if (!isExcluded) {
                    handlerRef.current(event);
                }
            }
        };
        
        // Используем mousedown для консистентности с существующим кодом
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isActive, excludeRefs]);
    
    return ref;
}

/**
 * Hook для обработки кликов вне нескольких элементов
 * @param {Function} handler - Функция, которая вызывается при клике вне всех элементов
 * @param {boolean} isActive - Активен ли обработчик
 * @returns {Array} refs - Массив ref которые нужно присвоить элементам
 */
export function useClickOutsideMultiple(handler, isActive = true, count = 2) {
    const refs = useRef(Array(count).fill(null).map(() => ({ current: null }))).current;
    const handlerRef = useRef(handler);
    
    // Обновляем handler ref при изменении
    useEffect(() => {
        handlerRef.current = handler;
    });
    
    useEffect(() => {
        if (!isActive) return;
        
        const handleClickOutside = (event) => {
            // Проверяем что клик был не по любому из наших элементов
            const clickedInside = refs.some(ref => 
                ref.current && ref.current.contains(event.target)
            );
            
            if (!clickedInside) {
                handlerRef.current(event);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isActive, refs]);
    
    return refs;
}