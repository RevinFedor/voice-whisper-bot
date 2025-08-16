import { useCallback } from 'react';

export function useToast() {
    const showToast = useCallback((message, type = 'info') => {
        // Временно используем console.log для уведомлений
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        console.log(`${icons[type] || icons.info} ${message}`);
        
        // TODO: В будущем можно добавить визуальные уведомления
    }, []);

    return { showToast };
}