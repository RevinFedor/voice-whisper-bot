import { ShapeUtil, HTMLContainer, Rectangle2d, T } from 'tldraw';
import React from 'react';

// Кастомный StaticDateHeaderShapeUtil для неперемещаемых заголовков дат
export class StaticDateHeaderShapeUtil extends ShapeUtil {
    static type = 'static-date-header';
    
    static props = {
        w: T.number,
        h: T.number,
        day: T.string,
        month: T.string,
        isToday: T.boolean,
    };

    getDefaultProps() {
        return {
            w: 80,
            h: 60,
            day: '01',
            month: 'ЯНВ',
            isToday: false,
        };
    }

    getGeometry(shape) {
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: false, // Не заполненный для предотвращения hover эффектов
        });
    }

    // НЕ МОЖЕТ быть выделен
    canSelect() {
        return false;
    }

    // НЕ МОЖЕТ быть отредактирован
    canEdit() {
        return false;
    }

    // Заблокированное соотношение сторон
    isAspectRatioLocked() {
        return true;
    }

    // НЕ ПОКАЗЫВАЕТ обводки при наведении - скрыть фон выделения
    hideSelectionBoundsBg() {
        return true;
    }

    // НЕ ПОКАЗЫВАЕТ обводки при наведении - скрыть передний план выделения
    hideSelectionBoundsFg() {
        return true;
    }

    // НЕ МОЖЕТ быть перемещен
    canResize() {
        return false;
    }

    // НЕ МОЖЕТ быть повернут
    canRotate() {
        return false;
    }

    // НЕ показывать хендлы
    canBind() {
        return false;
    }

    // Отключить drag
    canDrag() {
        return false;
    }

    // Отключить drop
    canDrop() {
        return false;
    }

    // Отключить crop
    canCrop() {
        return false;
    }

    // Отключить unmount
    canUnmount() {
        return false;
    }

    // Основной компонент отображения
    component(shape) {
        const { day, month, isToday, w, h } = shape.props;
        
        // Определяем цвета - зеленый для сегодня, серый для остальных
        const dayColor = isToday ? '#22c55e' : '#9ca3af'; // зеленый для сегодня, серый для остальных
        const monthColor = isToday ? '#16a34a' : '#6b7280'; // более темный оттенок для месяца

        return (
            <HTMLContainer
                style={{
                    width: w,
                    height: h,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start', // Выравниваем к верху
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    textAlign: 'center',
                    lineHeight: '1',
                    userSelect: 'none', // Предотвращаем выделение текста
                    pointerEvents: 'none', // Отключаем все pointer события
                    paddingTop: '4px', // Небольшой отступ сверху
                }}
            >
                {/* Число - крупнее, выше */}
                <div style={{
                    fontSize: '32px', // Увеличили размер числа
                    color: dayColor,
                    marginBottom: '0px', // Убрали отступ между числом и месяцем
                    fontWeight: '800', // Более жирный шрифт
                    lineHeight: '0.9', // Плотная линия
                }}>
                    {day}
                </div>
                
                {/* Месяц - меньше, ниже */}
                <div style={{
                    fontSize: '12px', // Немного уменьшили размер месяца
                    color: monthColor,
                    fontWeight: '700', // Более жирный
                    letterSpacing: '0.3px', // Меньше расстояние между буквами
                    lineHeight: '1',
                    marginTop: '-2px', // Приближаем к числу
                }}>
                    {month}
                </div>
            </HTMLContainer>
        );
    }

    // Отключаем индикатор выделения
    indicator() {
        return null;
    }

    // Отключаем onResize
    onResize() {
        return null;
    }

    // Отключаем onRotate  
    onRotate() {
        return null;
    }

    // Отключаем onTranslateStart
    onTranslateStart() {
        return null;
    }

    // Отключаем onTranslate
    onTranslate() {
        return null;
    }

    // Отключаем onTranslateEnd
    onTranslateEnd() {
        return null;
    }

    // Отключаем onDoubleClick
    onDoubleClick() {
        return null;
    }

    // Отключаем onClick
    onClick() {
        return null;
    }

    // Отключаем onPointerDown
    onPointerDown() {
        return null;
    }

    // Отключаем onPointerUp
    onPointerUp() {
        return null;
    }

    // Отключаем onPointerEnter
    onPointerEnter() {
        return null;
    }

    // Отключаем onPointerLeave  
    onPointerLeave() {
        return null;
    }

    // Отключаем onPointerMove
    onPointerMove() {
        return null;
    }

    // Отключаем onKeyDown
    onKeyDown() {
        return null;
    }

    // Отключаем onKeyUp
    onKeyUp() {
        return null;
    }

    // Отключаем все операции изменения
    onBeforeCreate() {
        return null;
    }

    onBeforeUpdate() {
        return null;
    }

    onBeforeDelete() {
        return null;
    }
}