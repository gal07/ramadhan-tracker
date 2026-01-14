'use client';

import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

export default function QRScanner({ onScanSuccess, onScanFailure }: QRScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [scanResult, setScanResult] = useState<string | null>(null);

    useEffect(() => {
        // Unique ID for the scanner element
        const scannerId = 'reader';

        // Prevent duplicate initialization
        if (!scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                scannerId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
        /* verbose= */ false
            );

            scanner.render(
                (decodedText) => {
                    setScanResult(decodedText);
                    onScanSuccess(decodedText);
                    // Optional: clear on success if you want single scan
                    // scanner.clear(); 
                },
                (errorMessage) => {
                    if (onScanFailure) onScanFailure(errorMessage);
                }
            );

            scannerRef.current = scanner;
        }

        // Cleanup function
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch((error) => {
                    console.error('Failed to clear html5-qrcode scanner. ', error);
                });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess, onScanFailure]);

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div id="reader" className="w-full overflow-hidden rounded-lg"></div>
            {scanResult && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium text-center">
                    Berhasil Scan: <span className="font-bold">{scanResult}</span>
                </div>
            )}
            <p className="mt-4 text-xs text-gray-400 text-center">
                Arahkan kamera ke kode QR
            </p>
        </div>
    );
}
