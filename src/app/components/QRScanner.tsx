'use client';

import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

export default function QRScanner({ onScanSuccess, onScanFailure }: QRScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const scannerId = 'reader';

        if (scannerRef.current) {
            scannerRef.current.clear();
        }

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        // Start scanning with back camera automatically
        scanner.start(
            { facingMode: "environment" }, // Prefer back camera
            config,
            (decodedText) => {
                setScanResult(decodedText);
                onScanSuccess(decodedText);
                // Stop after success if desired, but for now we keep scanning or let parent handle unmount
            },
            (errorMessage) => {
                // Ignore errors for better UX (scanning continually produces errors when no QR found)
                // if (onScanFailure) onScanFailure(errorMessage);
            }
        ).catch((err) => {
            console.error("Error starting scanner:", err);
            setError("Gagal memulai kamera. Pastikan izin kamera diberikan.");
        });

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => {
                    console.error("Error stopping scanner:", err);
                });
            }
        };
    }, []); // Empty dependency array to run once on mount

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-0 bg-black rounded-xl overflow-hidden relative">
            {error ? (
                <div className="p-8 text-center text-white">
                    <p className="text-red-400 mb-2">⚠️ Error</p>
                    <p className="text-sm border border-red-500/30 bg-red-500/10 p-4 rounded-lg">{error}</p>
                </div>
            ) : (
                <div id="reader" className="w-full h-full min-h-[300px]"></div>
            )}

            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none border-[30px] border-black/50 w-full h-full">
                <div className="w-full h-full border-2 border-white/50 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
                </div>
            </div>

            {scanResult && (
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-green-500 text-white rounded-lg text-sm font-medium text-center animate-in fade-in slide-in-from-bottom-2">
                    Berhasil Scan!
                </div>
            )}
        </div>
    );
}
