'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

// 이미지 압축 옵션 인터페이스
interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  initialQuality: number;
  minQuality: number;
  maxFileSize: number;
}

const ImageUploader = ({ onImageUpload }: ImageUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 압축 옵션 설정
  const compressionOptions: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    initialQuality: 0.7,
    minQuality: 0.3,
    maxFileSize: 5 * 1024 * 1024 // 5MB
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (isValidImageFile(file)) {
        processFile(file);
      } else {
        alert('유효한 이미지 파일을 업로드해주세요 (JPEG, PNG, GIF, WebP)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (isValidImageFile(file)) {
        processFile(file);
      } else {
        alert('유효한 이미지 파일을 업로드해주세요 (JPEG, PNG, GIF, WebP)');
      }
    }
  };

  const processFile = async (file: File) => {
    // 파일 크기가 제한 이하면 압축 없이 처리
    if (file.size <= compressionOptions.maxFileSize) {
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      onImageUpload(file);
      return;
    }
    
    // 파일 크기가 제한을 초과하면 압축 진행
    setIsCompressing(true);
    try {
      const compressedFile = await compressImage(file, compressionOptions);
      const previewUrl = URL.createObjectURL(compressedFile);
      setPreview(previewUrl);
      onImageUpload(compressedFile);
    } catch (error) {
      console.error('이미지 압축 중 오류 발생:', error);
      alert('이미지 압축 중 오류가 발생했습니다. 다른 이미지를 시도해주세요.');
    } finally {
      setIsCompressing(false);
    }
  };

  // 이미지 압축 함수 개선
  const compressImage = (file: File, options: CompressionOptions): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        if (!event.target?.result) {
          return reject(new Error('이미지를 읽을 수 없습니다.'));
        }
        
        const img = new Image();
        img.src = event.target.result as string;
        
        img.onload = () => {
          let { maxWidth, maxHeight, initialQuality, minQuality } = options;
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 이미지 크기에 따라 압축 비율 조정
          let quality = initialQuality;
          
          if (file.size > options.maxFileSize * 2) {
            quality = 0.5; // 용량이 큰 경우 더 많이 압축
          }
          
          // 이미지 크기 조절
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'));
          }
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);
          
          // 이미지 형식 결정
          let outputFormat = 'image/jpeg';
          if (file.type === 'image/png' && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
            outputFormat = 'image/png';
          }
          
          // 압축 시도 함수
          const tryCompression = (currentQuality: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  return reject(new Error('이미지를 압축할 수 없습니다.'));
                }
                
                // 압축 후에도 크기가 크면 품질을 더 낮춤
                if (blob.size > options.maxFileSize && currentQuality > minQuality) {
                  // 다음 압축 품질 계산 (10% 감소)
                  const nextQuality = Math.max(currentQuality - 0.1, minQuality);
                  tryCompression(nextQuality);
                } else {
                  // 압축 완료 또는 최소 품질 도달
                  const fileName = file.name;
                  const compressedFile = new File([blob], fileName, {
                    type: outputFormat,
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                }
              },
              outputFormat,
              currentQuality
            );
          };
          
          // 압축 시작
          tryCompression(quality);
        };
        
        img.onerror = () => {
          reject(new Error('이미지를 로드할 수 없습니다.'));
        };
      };
      
      reader.onerror = () => {
        reject(new Error('파일을 읽을 수 없습니다.'));
      };
    });
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isValidImageFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  };

  // 컴포넌트가 언마운트될 때 URL 객체 해제
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center h-full ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />
      
      <div className="flex flex-col items-center justify-center h-full">
        {isCompressing ? (
          <div className="mb-4 w-full text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">이미지 압축 중...</p>
          </div>
        ) : preview ? (
          <div className="mb-4 w-full">
            <h3 className="text-sm font-semibold mb-2">업로드된 이미지</h3>
            <div className="flex justify-center">
              <img 
                src={preview} 
                alt="미리보기" 
                className="max-h-40 object-contain rounded-lg shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleButtonClick}
              className="mt-3 px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-md hover:bg-gray-300 focus:outline-none transition-colors"
            >
              이미지 변경
            </button>
          </div>
        ) : (
          <>
            <svg
              className="w-10 h-10 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
            
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">이미지 선택</span> 또는 드래그 앤 드롭
            </p>
            <p className="text-xs text-gray-500 mb-3">
              지원 형식: JPEG, PNG, GIF, WebP (5MB 초과 시 자동 압축)
            </p>
            
            <button
              type="button"
              onClick={handleButtonClick}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
            >
              이미지 선택
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ImageUploader; 