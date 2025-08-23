import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing toast timer
 * Clean and simple timer management without extra complexity
 */
export function useToastTimer(show, duration, onComplete, onProgressUpdate) {
    const intervalRef = useRef(null);
    
    useEffect(() => {
        if (show) {
            // Clear any existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            
            // Reset to 100% and start countdown
            let progress = 100;
            onProgressUpdate(100);
            
            intervalRef.current = setInterval(() => {
                progress -= (100 / (duration / 100));
                
                if (progress <= 0) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    onComplete();
                } else {
                    onProgressUpdate(progress);
                }
            }, 100);
            
            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        }
    }, [show, duration]); // Dependencies are stable
}