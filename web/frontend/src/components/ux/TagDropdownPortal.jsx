import React, { forwardRef, useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

/**
 * TagDropdownPortal - компонент выпадающего списка тегов с Portal
 * Рендерится вне модалки для избежания проблем с overflow
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - открыт ли dropdown
 * @param {Array} props.tags - массив всех доступных тегов
 * @param {Array} props.usedTags - массив уже использованных тегов
 * @param {string} props.searchValue - строка поиска для фильтрации
 * @param {function} props.onTagSelect - обработчик выбора тега
 * @param {HTMLElement} props.anchorEl - элемент к которому привязан dropdown (input)
 * @param {string} props.verticalPosition - позиция по вертикали: 'top' | 'bottom' | 'auto'
 * @param {string} props.horizontalPosition - позиция по горизонтали: 'left' | 'right' | 'center'
 * @param {number} props.maxHeight - максимальная высота dropdown
 * @param {number} props.width - ширина dropdown
 * @param {string} props.noResultsText - текст когда нет результатов
 * @param {string} props.allUsedText - текст когда все теги уже использованы
 * @param {React.Ref} ref - ref для dropdown элемента
 */
const TagDropdownPortal = forwardRef(({
    isOpen = false,
    tags = [],
    usedTags = [],
    searchValue = '',
    onTagSelect,
    anchorEl,
    verticalPosition = 'auto',
    horizontalPosition = 'left',
    maxHeight = 250,
    width = 400,
    noResultsText = 'Теги не найдены',
    allUsedText = 'Все подходящие теги уже добавлены',
    style = {},
    ...props
}, ref) => {
    
    const [position, setPosition] = useState({ top: -9999, left: -9999 }); // Начальная позиция за экраном
    const [positionReady, setPositionReady] = useState(false);
    const dropdownRef = useRef(null);
    
    // Вычисляем позицию dropdown относительно anchorEl
    useEffect(() => {
        if (!isOpen || !anchorEl) {
            setPositionReady(false);
            setPosition({ top: -9999, left: -9999 });
            return;
        }
        
        const calculatePosition = () => {
            const rect = anchorEl.getBoundingClientRect();
            const dropdownHeight = maxHeight;
            const dropdownWidth = width;
            
            let top = 0;
            let left = 0;
            
            // Вертикальное позиционирование
            if (verticalPosition === 'auto') {
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                
                if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
                    // Показываем снизу
                    top = rect.bottom + 4;
                    console.log('📍 TagDropdown: auto positioning - showing below', { spaceBelow, spaceAbove });
                } else {
                    // Показываем сверху
                    top = rect.top - dropdownHeight - 4;
                    console.log('📍 TagDropdown: auto positioning - showing above', { spaceBelow, spaceAbove });
                }
            } else if (verticalPosition === 'top') {
                top = rect.top - dropdownHeight - 4;
                console.log('📍 TagDropdown: fixed top positioning');
            } else if (verticalPosition === 'bottom') {
                top = rect.bottom + 4;
                console.log('📍 TagDropdown: fixed bottom positioning');
            }
            
            // Горизонтальное позиционирование
            if (horizontalPosition === 'left') {
                left = rect.left;
            } else if (horizontalPosition === 'right') {
                left = rect.right - dropdownWidth;
            } else if (horizontalPosition === 'center') {
                left = rect.left + (rect.width / 2) - (dropdownWidth / 2);
            }
            
            // Корректируем если выходит за границы viewport
            if (left < 10) left = 10;
            if (left + dropdownWidth > window.innerWidth - 10) {
                left = window.innerWidth - dropdownWidth - 10;
            }
            
            console.log('📍 TagDropdown position calculated:', { top, left, rect, windowHeight: window.innerHeight });
            setPosition({ top, left });
            setPositionReady(true);
        };
        
        calculatePosition();
        
        // Пересчитываем при изменении размера окна
        window.addEventListener('resize', calculatePosition);
        window.addEventListener('scroll', calculatePosition, true);
        
        return () => {
            window.removeEventListener('resize', calculatePosition);
            window.removeEventListener('scroll', calculatePosition, true);
        };
    }, [isOpen, anchorEl, verticalPosition, horizontalPosition, maxHeight, width]);
    
    if (!isOpen || !anchorEl) return null;
    
    // Фильтрация тегов по поисковому запросу
    const filtered = tags.filter(tag => 
        tag.toLowerCase().includes(searchValue.toLowerCase())
    );
    
    // Исключаем уже использованные теги
    const availableTags = filtered.filter(tag => 
        !usedTags.includes(tag.replace(/^#/, ''))
    );
    
    console.log('📍 TagDropdown render:', { 
        isOpen, 
        tagsCount: tags.length, 
        filteredCount: filtered.length,
        availableCount: availableTags.length,
        searchValue,
        positionReady
    });
    
    // Рендерим через Portal в body
    return ReactDOM.createPortal(
        <div
            ref={(el) => {
                dropdownRef.current = el;
                if (ref) {
                    if (typeof ref === 'function') ref(el);
                    else ref.current = el;
                }
            }}
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${width}px`,
                maxHeight: `${maxHeight}px`,
                overflowY: 'auto',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                padding: '10px',
                zIndex: 10000, // Выше чем модалка (9999)
                opacity: positionReady ? 1 : 0,
                visibility: positionReady ? 'visible' : 'hidden',
                transition: 'opacity 0.15s ease-in-out, visibility 0.15s ease-in-out',
                ...style,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            {...props}
        >
            {availableTags.length === 0 ? (
                <div style={{
                    padding: '12px',
                    color: '#666',
                    fontSize: '13px',
                    textAlign: 'center',
                }}>
                    {filtered.length === 0 ? noResultsText : allUsedText}
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                }}>
                    {availableTags.map((tag, index) => (
                        <TagItem
                            key={index}
                            tag={tag}
                            onClick={() => onTagSelect(tag)}
                        />
                    ))}
                </div>
            )}
        </div>,
        document.body
    );
});

// Компонент отдельного тега
const TagItem = ({ tag, onClick }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    
    return (
        <div
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                backgroundColor: isHovered ? '#224455' : '#1a2d3d',
                border: '1px solid #2288aa',
                borderRadius: '14px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#4ec7e7',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                opacity: isHovered ? 1 : 0.9,
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {tag}
        </div>
    );
};

TagDropdownPortal.displayName = 'TagDropdownPortal';

export default TagDropdownPortal;