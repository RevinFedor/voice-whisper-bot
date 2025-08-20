import React, { forwardRef } from 'react';

/**
 * TagDropdown - компонент выпадающего списка тегов
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - открыт ли dropdown
 * @param {Array} props.tags - массив всех доступных тегов
 * @param {Array} props.usedTags - массив уже использованных тегов
 * @param {string} props.searchValue - строка поиска для фильтрации
 * @param {function} props.onTagSelect - обработчик выбора тега
 * @param {string} props.verticalPosition - позиция по вертикали: 'top' | 'bottom' | 'auto'
 * @param {string} props.horizontalPosition - позиция по горизонтали: 'left' | 'right' | 'center'
 * @param {number} props.maxHeight - максимальная высота dropdown
 * @param {number} props.width - ширина dropdown
 * @param {string} props.noResultsText - текст когда нет результатов
 * @param {string} props.allUsedText - текст когда все теги уже использованы
 * @param {React.Ref} ref - ref для dropdown элемента
 */
const TagDropdown = forwardRef(({
    isOpen = false,
    tags = [],
    usedTags = [],
    searchValue = '',
    onTagSelect,
    verticalPosition = 'bottom',
    horizontalPosition = 'left',
    maxHeight = 250,
    width = 400,
    noResultsText = 'Теги не найдены',
    allUsedText = 'Все подходящие теги уже добавлены',
    style = {},
    ...props
}, ref) => {
    
    if (!isOpen) return null;
    
    // Фильтрация тегов по поисковому запросу
    const filtered = tags.filter(tag => 
        tag.toLowerCase().includes(searchValue.toLowerCase())
    );
    
    // Исключаем уже использованные теги
    const availableTags = filtered.filter(tag => 
        !usedTags.includes(tag.replace(/^#/, ''))
    );
    
    // Определяем стили позиционирования
    const positionStyles = {
        position: 'absolute',
        zIndex: 100,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
        overflowY: 'auto',
    };
    
    // Вертикальное позиционирование
    if (verticalPosition === 'top') {
        positionStyles.bottom = '100%';
        positionStyles.marginBottom = '4px';
    } else if (verticalPosition === 'bottom') {
        positionStyles.top = '100%';
        positionStyles.marginTop = '4px';
    }
    
    // Горизонтальное позиционирование
    if (horizontalPosition === 'left') {
        positionStyles.left = 0;
    } else if (horizontalPosition === 'right') {
        positionStyles.right = 0;
    } else if (horizontalPosition === 'center') {
        positionStyles.left = '50%';
        positionStyles.transform = 'translateX(-50%)';
    }
    
    return (
        <div
            ref={ref}
            style={{
                ...positionStyles,
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                padding: '10px',
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
        </div>
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

TagDropdown.displayName = 'TagDropdown';

export default TagDropdown;