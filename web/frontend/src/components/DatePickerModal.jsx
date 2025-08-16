import React, { useState, useRef } from 'react';
import { useModalEscape, MODAL_PRIORITIES } from '../contexts/ModalStackContext';

const modalStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
    },
    modal: {
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '24px',
        minWidth: '300px',
        maxWidth: '400px',
        border: '1px solid #333',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    },
    title: {
        color: '#fff',
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '20px',
        textAlign: 'center',
    },
    dateGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        marginBottom: '20px',
    },
    dateButton: {
        padding: '12px',
        backgroundColor: '#2a2a2a',
        border: '1px solid #444',
        borderRadius: '8px',
        color: '#fff',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'center',
    },
    dateButtonHover: {
        backgroundColor: '#3a3a3a',
        borderColor: '#2a4',
    },
    dateButtonToday: {
        backgroundColor: '#1a3a1a',
        borderColor: '#2a4',
    },
    dateLabel: {
        fontSize: '18px',
        fontWeight: 'bold',
    },
    dateMonth: {
        fontSize: '12px',
        color: '#888',
        marginTop: '4px',
    },
    customDateSection: {
        marginTop: '20px',
        paddingTop: '20px',
        borderTop: '1px solid #333',
    },
    customDateInput: {
        width: '100%',
        padding: '10px',
        backgroundColor: '#2a2a2a',
        border: '1px solid #444',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '14px',
        marginBottom: '10px',
    },
    buttons: {
        display: 'flex',
        gap: '10px',
        marginTop: '20px',
    },
    button: {
        flex: 1,
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    createButton: {
        backgroundColor: '#2a4',
        color: 'white',
    },
    cancelButton: {
        backgroundColor: '#444',
        color: '#ccc',
    },
};

export default function DatePickerModal({ isOpen, onClose, onSelectDate }) {
    const modalId = useRef(`date-picker-${Date.now()}`).current;
    const [selectedDate, setSelectedDate] = useState(null);
    const [customDate, setCustomDate] = useState('');
    const [customTime, setCustomTime] = useState('01:00'); // Default time 01:00
    const [hoveredDate, setHoveredDate] = useState(null);
    const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
    
    // Обработка Escape для закрытия модалки
    useModalEscape(
        modalId,
        () => {
            handleCancel();
            return true;
        },
        isOpen ? MODAL_PRIORITIES.DATE_PICKER : -1
    );
    
    if (!isOpen) return null;
    
    // Generate dates for last 7 days and today (no future dates)
    const generateDates = () => {
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Past 7 days
        for (let i = 7; i >= 1; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date);
        }
        
        // Today only (no future dates)
        dates.push(new Date(today));
        
        return dates;
    };
    
    const dates = generateDates();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
        return { day, month };
    };
    
    const isToday = (date) => {
        return date.getTime() === today.getTime();
    };
    
    const handleDateClick = (date) => {
        setSelectedDate(date);
        setCustomDate('');
    };
    
    const handleCustomDateChange = (e) => {
        setCustomDate(e.target.value);
        setSelectedDate(null);
    };
    
    const handleCreate = () => {
        let finalDate;
        
        if (customDate) {
            // Parse YYYY-MM-DD as local date, not UTC
            const [year, month, day] = customDate.split('-').map(Number);
            finalDate = new Date(year, month - 1, day);
        } else if (selectedDate) {
            finalDate = selectedDate;
        } else {
            // Default to today if nothing selected
            finalDate = new Date();
        }
        
        finalDate.setHours(0, 0, 0, 0);
        
        // Prevent future dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (finalDate > today) {
            alert('Нельзя создавать заметки для будущих дат');
            return;
        }
        
        onSelectDate(finalDate);
        onClose();
        
        // Reset state
        setSelectedDate(null);
        setCustomDate('');
    };
    
    const handleCancel = () => {
        setSelectedDate(null);
        setCustomDate('');
        onClose();
    };
    
    // ВРЕМЕННАЯ ФУНКЦИЯ: Генерация тестовых данных - удалить в продакшене
    const handleGenerateMockData = async () => {
        if (isGeneratingMockData) return;
        
        const confirmGenerate = window.confirm(
            'Это создаст около 50 тестовых заметок на текущую неделю.\n' +
            'Заметки будут иметь осмысленный контент на темы IT и психологии.\n' +
            'Продолжить?'
        );
        
        if (!confirmGenerate) return;
        
        setIsGeneratingMockData(true);
        
        try {
            const response = await fetch('http://localhost:3001/api/mock-data/generate-week', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': 'test-user-id',
                },
                body: JSON.stringify({
                    startDate: new Date().toISOString(),
                }),
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`✅ Создано ${result.count} тестовых заметок на неделю!`);
                onClose();
                window.location.reload(); // Перезагружаем для отображения новых заметок
            } else {
                alert('❌ Ошибка при генерации тестовых данных');
            }
        } catch (error) {
            console.error('Error generating mock data:', error);
            alert('❌ Ошибка при генерации тестовых данных');
        } finally {
            setIsGeneratingMockData(false);
        }
    };
    
    return (
        <div style={modalStyles.overlay} onClick={handleCancel}>
            <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={modalStyles.title}>
                    📅 Выберите дату для заметки
                </div>
                
                <div style={modalStyles.dateGrid}>
                    {dates.map((date, index) => {
                        const { day, month } = formatDate(date);
                        const isSelected = selectedDate?.getTime() === date.getTime();
                        const isTodayDate = isToday(date);
                        const isHovered = hoveredDate === index;
                        
                        return (
                            <div
                                key={index}
                                style={{
                                    ...modalStyles.dateButton,
                                    ...(isTodayDate ? modalStyles.dateButtonToday : {}),
                                    ...(isHovered ? modalStyles.dateButtonHover : {}),
                                    ...(isSelected ? { 
                                        backgroundColor: '#2a4', 
                                        borderColor: '#2a4' 
                                    } : {}),
                                }}
                                onClick={() => handleDateClick(date)}
                                onMouseEnter={() => setHoveredDate(index)}
                                onMouseLeave={() => setHoveredDate(null)}
                            >
                                <div style={modalStyles.dateLabel}>{day}</div>
                                <div style={modalStyles.dateMonth}>{month}</div>
                                {isTodayDate && (
                                    <div style={{ fontSize: '10px', color: '#2a4', marginTop: '2px' }}>
                                        СЕГОДНЯ
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                <div style={modalStyles.customDateSection}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                        Или выберите другую дату:
                    </div>
                    <input
                        type="date"
                        value={customDate}
                        onChange={handleCustomDateChange}
                        style={modalStyles.customDateInput}
                        max={new Date().toISOString().split('T')[0]}
                    />
                </div>
                
                <div style={modalStyles.buttons}>
                    <button
                        style={{ ...modalStyles.button, ...modalStyles.cancelButton }}
                        onClick={handleCancel}
                    >
                        Отмена
                    </button>
                    <button
                        style={{ ...modalStyles.button, ...modalStyles.createButton }}
                        onClick={handleCreate}
                    >
                        Создать заметку
                    </button>
                </div>
                
                {/* ВРЕМЕННЫЙ БЛОК: Генерация тестовых данных - удалить в продакшене */}
                <div style={{
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid #333',
                    opacity: 0.7,
                }}>
                    <div style={{
                        color: '#ff9500',
                        fontSize: '11px',
                        marginBottom: '10px',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                    }}>
                        ⚠️ Тестовые данные (временно)
                    </div>
                    <button
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: isGeneratingMockData ? '#555' : '#4a3a00',
                            border: '1px solid #ff9500',
                            borderRadius: '8px',
                            color: '#ff9500',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: isGeneratingMockData ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: isGeneratingMockData ? 0.5 : 1,
                        }}
                        onClick={handleGenerateMockData}
                        disabled={isGeneratingMockData}
                        onMouseEnter={(e) => !isGeneratingMockData && (e.target.style.backgroundColor = '#5a4a00')}
                        onMouseLeave={(e) => !isGeneratingMockData && (e.target.style.backgroundColor = '#4a3a00')}
                    >
                        {isGeneratingMockData ? (
                            <>🔄 Генерируется...</>
                        ) : (
                            <>🎲 Заполнить неделю тестовыми заметками</>
                        )}
                    </button>
                    <div style={{
                        color: '#666',
                        fontSize: '10px',
                        marginTop: '8px',
                        textAlign: 'center',
                    }}>
                        Создаст ~50 заметок с текстом на темы IT и психологии
                    </div>
                </div>
            </div>
        </div>
    );
}