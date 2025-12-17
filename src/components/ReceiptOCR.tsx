import { useState, useRef, useEffect } from 'react';
import { Button, Box, CircularProgress, Alert, IconButton } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CloseIcon from '@mui/icons-material/Close';
import Tesseract from 'tesseract.js';
import { useTranslate } from 'react-admin';

interface ReceiptOCRProps {
  onExtract: (data: {
    amount?: number;
    description?: string;
    date?: string;
    notes?: string;
  }) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export const ReceiptOCR = ({ onExtract, onLoadingChange }: ReceiptOCRProps) => {
  const translate = useTranslate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect if device is mobile
  useEffect(() => {
    // Check if mobile
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
  }, []);

  // Notify parent when loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(loading);
    }
  }, [loading, onLoadingChange]);


  // Preprocess image to improve OCR accuracy (especially for crumpled receipts)
  const preprocessImage = (imageFile: File | Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        // Set canvas size
        // For mobile photos (often 4000x3000), processing full res causes memory crashes
        // We reduce max dimension to 1024px which is sufficient for receipts and safe for mobile
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1024;
        const MID_DIMENSION = 800;

        let scale = 1;
        if (Math.max(width, height) > MAX_DIMENSION) {
          // Scale down if too big to save memory
          scale = MAX_DIMENSION / Math.max(width, height);
        } else if (Math.max(width, height) < MID_DIMENSION) {
          // Scale up if too small for better OCR
          scale = 2;
        }

        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);

        // Draw image with correct scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale using luminosity method
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

          // Increase contrast (simple threshold)
          const threshold = 128;
          const contrast = 1.5; // Contrast factor
          let adjusted = (gray - threshold) * contrast + threshold;
          adjusted = Math.max(0, Math.min(255, adjusted)); // Clamp to 0-255

          data[i] = adjusted;     // R
          data[i + 1] = adjusted; // G
          data[i + 2] = adjusted; // B
          // Alpha stays the same
        }

        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          // Free memory
          img.src = '';
          canvas.width = 1;
          canvas.height = 1;

          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.85); // Slightly lower quality to save memory
      };

      img.onerror = () => reject(new Error('Failed to load image'));

      // Load the image
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(imageFile);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Preprocess image for better OCR accuracy and memory safety
      console.log('Preprocessing image...');
      // IMPORTANT: Preprocess FIRST to resize image before doing anything else
      // This prevents using full resolution image which crashes mobile browsers
      const processedImage = await preprocessImage(file);

      // Create preview from PROCESSED (resized) image, not original
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(processedImage);

      const result = await Tesseract.recognize(processedImage, 'fra', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
          }
        },
      });

      const text = result.data.text;
      console.log('OCR Text:', text);

      // Extract information from the receipt
      const extractedData = extractReceiptData(text);
      onExtract(extractedData);

      setLoading(false);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(translate('app.components.ocr.error'));
      setLoading(false);
    }
  };


  const extractReceiptData = (text: string): {
    amount?: number;
    description?: string;
    date?: string;
    notes?: string;
  } => {
    const data: {
      amount?: number;
      description?: string;
      date?: string;
      notes?: string;
    } = {};

    console.log('=== Extracting data from CB receipt ===');
    console.log('Raw text:', text);

    // Extract date - Format "LE DD/MM/YY A HH:MM:SS" or "LE DD/MM/YYYY"
    const datePatterns = [
      /LE\s+(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})(?:\s+A\s+[\d:]+)?/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const day = match[1];
        const month = match[2];
        let year = match[3];

        // Handle 2-digit year (YY -> 20YY)
        if (year.length === 2) {
          year = `20${year}`;
        }

        // Convert to ISO format (YYYY-MM-DD)
        data.date = `${year}-${month}-${day}`;
        console.log('Date found:', data.date);
        break;
      }
    }

    // Extract city, postal code, and merchant name in one pass
    // The merchant name is systematically on the line before the city
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let city = '';
    let postalCode = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`Line ${i}: "${line}"`); // Debug

      // Check if line contains postal code + city on SAME line first
      // Patterns: "76BARENTIN" (2 digits), "76190YVETOT" (5 digits), "76 BARENTIN" (with space)
      const sameLineMatch = line.match(/^(\d{2,5})\s*([A-Z]{2,})/i);
      if (sameLineMatch) {
        const digits = sameLineMatch[1];
        city = sameLineMatch[2];

        // If we have 5 digits, it's a full postal code
        // If we have 2 digits, it's a department code - use it as postal code
        postalCode = digits.length === 5 ? digits : digits;
        console.log(`Detected ${digits.length === 5 ? 'full postal code' : 'department code'}: ${postalCode}, city: ${city}`);

        // Merchant name is on the line before this combined line
        if (i > 0) {
          const merchantLine = lines[i - 1];
          // Make sure it's not a number, code, or card number
          if (!/^\d+$/.test(merchantLine) &&
            !/^[A-Z0-9]{10,}$/.test(merchantLine) &&
            !/#/.test(merchantLine) &&
            !/[XKO]{4,}/.test(merchantLine) && // Not a masked card number
            merchantLine.length > 2 &&
            merchantLine.length < 50) {
            data.description = merchantLine;
            console.log('Merchant name found (line before city+postal):', data.description);
          }
        }

        console.log('City and postal code found (same line):', city, postalCode);
        break;
      }

      // Check if line is ONLY a postal code (5 digits) - fallback
      if (/^\d{5}$/.test(line)) {
        postalCode = line;

        // City is usually on the line just before the postal code
        if (i > 0) {
          const cityLine = lines[i - 1];
          console.log(`Checking line before postal code: "${cityLine}"`); // Debug
          // Make sure it's not a number or code
          if (!/^\d+$/.test(cityLine) && !/^[A-Z0-9]{10,}$/.test(cityLine) && cityLine.length > 2 && cityLine.length < 30) {
            city = cityLine;

            // Merchant name is on the line before the city
            if (i > 1) {
              const merchantLine = lines[i - 2];
              // Make sure it's not a number, code, or card number
              if (!/^\d+$/.test(merchantLine) &&
                !/^[A-Z0-9]{10,}$/.test(merchantLine) &&
                !/#/.test(merchantLine) &&
                !/[XKO]{4,}/.test(merchantLine) && // Not a masked card number
                merchantLine.length > 2 &&
                merchantLine.length < 50) {
                data.description = merchantLine;
                console.log('Merchant name found (line before city):', data.description);
              }
            }
          }
        }

        console.log('City and postal code found (separate lines):', city, postalCode);
        break;
      }
    }

    // Extract masked card number - Pattern like "############4360"
    // OCR can severely misread masking characters (e.g., "#éhnnttrttt#4360")
    // We look for any sequence of non-digit characters (8+) followed by exactly 4 digits
    const cardPatterns = [
      /([^\d\s]{8,}\s?\d{4})(?!\d)/,           // 8+ non-digit chars + optional space + 4 digits
      /([^\d\s]{4,}\s+[^\d\s]{4,}\s+\d{4})(?!\d)/,  // With spaces in between
      /(\d{4}\s+[^\d\s]{4,}\s+[^\d\s]{4,}\s+\d{4})(?!\d)/,  // Format: 1234 #### #### 4360
    ];

    for (const pattern of cardPatterns) {
      const cardMatch = text.match(pattern);
      if (cardMatch) {
        // Clean up the matched string (remove extra spaces, keep only the masked part)
        let cardNumber = cardMatch[1].replace(/\s+/g, '');

        // If it looks like a card number (has enough characters + 4 digits at end)
        if (cardNumber.length >= 12) {
          // Normalize: replace all non-digit characters with # (except last 4 digits)
          // Extract the last 4 digits
          const lastFourDigits = cardNumber.slice(-4);
          // Extract the masked part (everything before the last 4 digits)
          const maskedPart = cardNumber.slice(0, -4);
          // Replace all non-digit characters in the masked part with #
          const normalizedMask = maskedPart.replace(/\D/g, '#');
          // Reconstruct the card number
          const normalizedCardNumber = normalizedMask + lastFourDigits;

          data.notes = `Carte: ${normalizedCardNumber}`;
          console.log('Card number found:', normalizedCardNumber, '(original:', cardNumber, ')');
          break;
        }
      }
    }

    // Extract amount - Patterns for French CB receipts
    const amountPatterns = [
      /MONTANT\s*:?\s*\n?\s*([0-9]+[.,][0-9]{2})\s*EUR/i,  // "MONTANT :\n37,50 EUR"
      /MONTANT\s*:?\s*([0-9]+[.,][0-9]{2})\s*EUR/i,         // "MONTANT : 37,50 EUR"
      /([0-9]+[.,][0-9]{2})\s*EUR/i,                        // "37,50 EUR"
      /TOTAL\s*:?\s*([0-9]+[.,][0-9]{2})/i,                 // "TOTAL : 37,50"
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(',', '.');
        let amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
          // Check for keywords indicating a DEBIT (expense)
          // OCR can misread D as V or O, and B as E
          // Patterns: DEBIT, VEBIT, OEBIT, OEEIT, etc.
          // Also look for: COMPTANT, PAIEMENT, BANCAIRE, ACHAT which suggest an expense
          const isDebit =
            /[DVO]E[BE]I[T7]/i.test(text) ||
            /COMPTANT/i.test(text) ||
            /PAIEMENT/i.test(text) ||
            /BANCAIRE/i.test(text) ||
            /ACHAT/i.test(text);

          // Check for CREDIT (refund) which overrides debit
          const isCredit = /CREDIT/i.test(text) && !/CARTE\s+DE\s+CREDIT/i.test(text); // avoid "CARTE DE CREDIT" confusion

          if (isDebit && !isCredit) {
            amount = -amount;
            console.log('Expense keyword detected (DEBIT/COMPTANT/etc), amount set to negative');
          }

          data.amount = amount;
          console.log('Amount found:', data.amount);
          break;
        }
      }
    }

    // Combine all notes information
    const noteParts = [];
    if (data.notes) noteParts.push(data.notes); // Card number
    if (city && postalCode) noteParts.push(`${city} (${postalCode})`);
    else if (city) noteParts.push(city);
    else if (postalCode) noteParts.push(postalCode);
    if (noteParts.length > 0) {
      data.notes = noteParts.join(' - ');
    }

    // If no date was found, use today's date as fallback
    if (!data.date) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      data.date = `${year}-${month}-${day}`;
      console.log('No date found, using today:', data.date);
    }

    console.log('=== Extracted data ===', data);
    return data;
  };

  const clearPreview = () => {
    setPreview(null);
    setError(null);
    // Clear all extracted data
    onExtract({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />


      {!preview ? (
        /* Upload/Camera mode - show appropriate button(s) based on device */
        isMobile ? (
          /* Mobile: File upload with camera capture */
          <Button
            variant="outlined"
            startIcon={<PhotoCameraIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            fullWidth
            sx={{
              borderStyle: 'dashed',
              borderWidth: 2,
              py: 1.5,
              color: 'primary.main',
              borderColor: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                backgroundColor: 'primary.50',
              },
            }}
          >
            {translate('app.components.ocr.scan_button')}
          </Button>
        ) : (
          /* Desktop: File upload only */
          <Button
            variant="outlined"
            startIcon={<PhotoCameraIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            fullWidth
            sx={{
              borderStyle: 'dashed',
              borderWidth: 2,
              py: 1.5,
              color: 'primary.main',
              borderColor: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                backgroundColor: 'primary.50',
              },
            }}
          >
            {translate('app.components.ocr.scan_button')}
          </Button>
        )
      ) : (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={preview}
            alt="Preview"
            style={{
              width: '100%',
              maxHeight: '200px',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
          />
          <IconButton
            onClick={clearPreview}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 1)',
              },
            }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      )}

      {loading && (
        <Box display="flex" alignItems="center" gap={2} mt={2}>
          <CircularProgress size={24} />
          <Box>{translate('app.components.ocr.processing')}</Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

    </Box>
  );
};
