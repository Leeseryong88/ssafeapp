'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { storage, db, auth } from '../../firebase';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Analysis {
  risk_factors: string[];
  improvements: string[];
  regulations: string[];
  date?: string; // 저장 날짜
  title?: string; // 저장 제목
}

interface SavedAnalysis extends Analysis {
  id: string;
  createdAt: string;
  title: string;
  imageUrl: string;
  storageRef?: string; // Firebase Storage 참조 경로
}

export default function CameraPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'saved' | 'detail'>('main');
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editRiskFactors, setEditRiskFactors] = useState<string[]>([]);
  const [editImprovements, setEditImprovements] = useState<string[]>([]);
  const [editRegulations, setEditRegulations] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // 사용자 인증 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      // 로그인 상태가 아니면 홈으로 리디렉션
      if (!currentUser) {
        router.push('/');
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  // 저장된 분석 결과 불러오기
  useEffect(() => {
    if (user) {
      loadSavedAnalyses();
    }
  }, [user]);

  // Firestore에서 저장된 분석 결과 불러오기
  const loadSavedAnalyses = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const analysisRef = collection(db, 'analyses');
      const q = query(
        analysisRef, 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const analysesData: SavedAnalysis[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SavedAnalysis;
        analysesData.push({
          ...data,
          id: doc.id
        });
      });
      
      setSavedAnalyses(analysesData);
    } catch (error) {
      console.error('분석 결과를 불러오는 중 오류가 발생했습니다:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 파일을 base64로 변환
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          
          // 압축된 이미지 생성
          const compressedImage = await compressImage(base64);
          
          // 압축된 이미지를 상태에 저장
          setCapturedImage(compressedImage);
          
          // base64를 Blob으로 변환
          const response = await fetch(compressedImage);
          const blob = await response.blob();
          
          // Blob을 File 객체로 변환
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          // 압축된 파일 저장 및 분석
          setImageFile(compressedFile);
          await analyzeImage(compressedFile);
          
        } catch (error) {
          console.error('이미지 압축 중 오류:', error);
          setAnalysisError('이미지 처리 중 오류가 발생했습니다.');
        }
      };
      
      reader.onerror = () => {
        setAnalysisError('이미지 파일을 읽을 수 없습니다.');
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      setAnalysisError('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  // 이미지 분석 함수
  const analyzeImage = async (file: File) => {
    setIsLoading(true);
    setAnalysisError(null);
    
    try {
      // 모션포토나 특수 이미지 처리를 위한 변환 과정
      let processedFile = file;
      
      // 파일 타입 확인 - 모션포토는 일반적으로 image/jpeg 타입으로 감지됨
      if (file.type.includes('image/')) {
        try {
          // 모션포토 추가 처리 - 정적 이미지만 추출
          processedFile = await extractStaticImageFromFile(file);
        } catch (conversionError) {
          console.warn('모션포토 변환 시도 중 오류, 원본 파일 사용:', conversionError);
          // 변환 실패 시 원본 파일 사용
          processedFile = file;
        }
      }

      const formData = new FormData();
      formData.append('image', processedFile);
      formData.append('processName', '현장 사진');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '이미지 분석 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      
      if (!data.analysis) {
        throw new Error('분석 결과를 받지 못했습니다.');
      }

      // HTML 파싱을 위한 임시 div 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.analysis;

      // 테이블에서 데이터 추출
      const tables = tempDiv.querySelectorAll('table');
      const analysisData: Analysis = {
        risk_factors: [],
        improvements: [],
        regulations: []
      };

      if (tables.length > 0) {
        // 첫 번째 테이블에서 위험 요소와 대책 추출
        const rows = tables[0].querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 5) {
            const riskFactor = cells[0]?.textContent?.trim();
            const improvement = cells[4]?.textContent?.trim();
            
            if (riskFactor && !riskFactor.includes('사진에서 발견된 위험성은 없습니다')) analysisData.risk_factors.push(riskFactor);
            if (improvement && !improvement.includes('추가적인 안전 조치가 필요하지 않습니다')) analysisData.improvements.push(improvement);
          }
        });
      }

      // 분석 결과 설정
      setAnalysis(analysisData);
      setAnalysisError(null);
      setShowSaveDialog(false);
    } catch (error: any) {
      console.error('Error:', error);
      setAnalysisError(error.message || '이미지 분석 중 오류가 발생했습니다.');
      alert(error.message || '이미지 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 모션포토에서 정적 이미지 추출 함수
  const extractStaticImageFromFile = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      try {
        // 이미지 로드
        const url = URL.createObjectURL(file);
        const img: HTMLImageElement = document.createElement('img');
        
        img.onload = () => {
          try {
            // 캔버스에 그려서 정적 이미지만 추출
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'));
              return;
            }
            
            ctx.drawImage(img, 0, 0);
            
            // 캔버스에서 JPEG 형식으로 데이터 추출
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('이미지 변환에 실패했습니다.'));
                return;
              }
              
              // 새 파일 객체 생성 (모션포토 데이터 제외)
              const convertedFile = new File([blob], file.name, { 
                type: 'image/jpeg',
                lastModified: file.lastModified 
              });
              
              // URL 객체 해제
              URL.revokeObjectURL(url);
              
              resolve(convertedFile);
            }, 'image/jpeg', 0.95);
          } catch (error) {
            URL.revokeObjectURL(url);
            reject(error);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('이미지를 로드할 수 없습니다.'));
        };
        
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  };

  // 다시 분석하기 함수
  const handleReanalyze = async () => {
    if (!imageFile && !capturedImage) {
      alert('분석할 이미지가 없습니다. 먼저 사진을 촬영해주세요.');
      return;
    }
    
    if (imageFile) {
      await analyzeImage(imageFile);
    } else if (capturedImage) {
      // base64 이미지를 File 객체로 변환
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], "recaptured-image.jpg", { type: 'image/jpeg' });
        setImageFile(file);
        await analyzeImage(file);
      } catch (error) {
        console.error("이미지 변환 중 오류 발생:", error);
        setAnalysisError("이미지를 다시 분석할 수 없습니다. 새 이미지를 촬영해주세요.");
      }
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 저장 다이얼로그 열기
  const openSaveDialog = () => {
    if (!user) {
      alert('로그인이 필요한 기능입니다.');
      router.push('/auth?mode=login');
      return;
    }
    
    setSaveTitle(`현장분석 ${new Date().toLocaleDateString()}`);
    setShowSaveDialog(true);
  };

  // 분석 결과 저장 (Firebase)
  const saveAnalysis = async () => {
    if (!analysis || !capturedImage || !user) return;
    
    try {
      setIsSaving(true);
      
      // 이미지 압축 (최대 너비 600px, 품질 30%)
      const compressedImage = await compressImage(capturedImage, 600, 0.3);
      
      // 1. Firebase Storage에 이미지 업로드
      const timestamp = Date.now();
      const storageRefPath = `analyses/${user.uid}/${timestamp}.jpg`;
      const storageReference = ref(storage, storageRefPath);
      
      // Base64 형식에서 접두사 제거
      const imageData = compressedImage.split(',')[1];
      
      await uploadString(storageReference, imageData, 'base64');
      const imageUrl = await getDownloadURL(storageReference);
      
      // 2. Firestore에 분석 결과 저장
      const analysisData = {
        userId: user.uid,
        title: saveTitle || `현장분석 ${new Date().toLocaleDateString()}`,
        risk_factors: analysis.risk_factors,
        improvements: analysis.improvements,
        regulations: analysis.regulations || [],
        createdAt: new Date().toISOString(),
        imageUrl: imageUrl,
        storageRef: storageRefPath
      };
      
      const docRef = await addDoc(collection(db, 'analyses'), analysisData);
      
      // 로컬 상태 업데이트
      const newSavedAnalysis: SavedAnalysis = {
        ...analysisData,
        id: docRef.id
      };
      
      setSavedAnalyses([newSavedAnalysis, ...savedAnalyses]);
      setShowSaveDialog(false);
      
      // 저장 완료 후 상태 초기화
      setAnalysis(null);
      setCapturedImage(null);
      setImageFile(null);
      setSaveTitle('');
      
      alert('분석 결과가 저장되었습니다.');
      
      // 저장된 분석 목록 화면으로 이동
      setCurrentView('saved');
      
    } catch (error) {
      console.error('저장 중 오류가 발생했습니다:', error);
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // 저장된 분석 결과 삭제
  const deleteSavedAnalysis = async (id: string) => {
    if (!user) return;
    
    if (confirm('정말로 이 분석 결과를 삭제하시겠습니까?')) {
      try {
        setIsLoading(true);
        
        // 삭제할 항목 찾기
        const analysisToDelete = savedAnalyses.find(item => item.id === id);
        
        if (analysisToDelete && analysisToDelete.storageRef) {
          // 1. Storage에서 이미지 삭제
          const imageRef = ref(storage, analysisToDelete.storageRef);
          await deleteObject(imageRef);
        }
        
        // 2. Firestore에서 문서 삭제
        await deleteDoc(doc(db, 'analyses', id));
        
        // 3. 로컬 상태 업데이트
        const updatedSavedAnalyses = savedAnalyses.filter(item => item.id !== id);
        setSavedAnalyses(updatedSavedAnalyses);
        
        // 상세 보기 화면에서 삭제한 경우 목록 화면으로 돌아가기
        if (selectedAnalysis && selectedAnalysis.id === id) {
          setCurrentView('saved');
          setSelectedAnalysis(null);
        }
        
        alert('분석 결과가 삭제되었습니다.');
      } catch (error) {
        console.error('삭제 중 오류가 발생했습니다:', error);
        alert('삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 저장된 분석 결과 상세 보기
  const viewSavedAnalysis = (saved: SavedAnalysis) => {
    setSelectedAnalysis(saved);
    setCurrentView('detail');
  };

  // 분석 화면으로 돌아가기
  const goBackToMain = () => {
    setCurrentView('main');
    setSelectedAnalysis(null);
    setIsEditing(false);
  };
  
  // 저장된 분석 목록으로 돌아가기
  const goBackToSaved = () => {
    setCurrentView('saved');
    setSelectedAnalysis(null);
    setIsEditing(false);
  };
  
  // 수정 모드 시작
  const startEditing = () => {
    if (selectedAnalysis) {
      setEditTitle(selectedAnalysis.title);
      setEditRiskFactors([...selectedAnalysis.risk_factors]);
      setEditImprovements([...selectedAnalysis.improvements]);
      setEditRegulations(selectedAnalysis.regulations || []);
      setIsEditing(true);
    }
  };
  
  // 수정 저장
  const saveEdit = async () => {
    if (!selectedAnalysis || !user) return;
    
    try {
      setIsLoading(true);
      
      // Firestore에서 문서 업데이트
      const docRef = doc(db, 'analyses', selectedAnalysis.id);
      await updateDoc(docRef, {
        title: editTitle,
        risk_factors: editRiskFactors,
        improvements: editImprovements,
        regulations: editRegulations
      });
      
      // 로컬 상태 업데이트
      const updatedAnalysis = {
        ...selectedAnalysis,
        title: editTitle,
        risk_factors: editRiskFactors,
        improvements: editImprovements,
        regulations: editRegulations
      };
      
      const updatedSavedAnalyses = savedAnalyses.map(item => 
        item.id === selectedAnalysis.id ? updatedAnalysis : item
      );
      
      setSavedAnalyses(updatedSavedAnalyses);
      setSelectedAnalysis(updatedAnalysis);
      setIsEditing(false);
      
      alert('수정이 완료되었습니다.');
    } catch (error) {
      console.error('수정 중 오류가 발생했습니다:', error);
      alert('수정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 수정 취소
  const cancelEdit = () => {
    setIsEditing(false);
  };

  // 분석 결과를 HTML 테이블로 변환하는 함수
  const renderAnalysisTable = (analysis: Analysis) => {
    if (!analysis) return null;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-3 text-gray-800">위험 요인</h3>
          <div className="bg-white rounded-lg shadow-md p-5">
            {isEditing ? (
              <div className="space-y-2">
                {(editRiskFactors || []).map((risk, index) => (
                  <div key={index} className="flex items-center">
                    <input
                      type="text"
                      value={risk}
                      onChange={(e) => {
                        const newRiskFactors = [...editRiskFactors];
                        newRiskFactors[index] = e.target.value;
                        setEditRiskFactors(newRiskFactors);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const newRiskFactors = [...editRiskFactors];
                        newRiskFactors.splice(index, 1);
                        setEditRiskFactors(newRiskFactors);
                      }}
                      className="ml-2 p-2 text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditRiskFactors([...editRiskFactors, ""])}
                  className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  항목 추가
                </button>
              </div>
            ) : (
              <ul className="list-disc list-inside space-y-3">
                {analysis.risk_factors && analysis.risk_factors.length > 0 ? (
                  analysis.risk_factors.map((risk, index) => (
                    <li key={index} className="text-gray-700">{risk}</li>
                  ))
                ) : (
                  <li className="text-gray-500">감지된 위험 요인이 없습니다.</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-gray-800">개선 방안</h3>
          <div className="bg-white rounded-lg shadow-md p-5">
            {isEditing ? (
              <div className="space-y-2">
                {editImprovements.map((improvement, index) => (
                  <div key={index} className="flex items-center">
                    <input
                      type="text"
                      value={improvement}
                      onChange={(e) => {
                        const newImprovements = [...editImprovements];
                        newImprovements[index] = e.target.value;
                        setEditImprovements(newImprovements);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const newImprovements = [...editImprovements];
                        newImprovements.splice(index, 1);
                        setEditImprovements(newImprovements);
                      }}
                      className="ml-2 p-2 text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditImprovements([...editImprovements, ""])}
                  className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  항목 추가
                </button>
              </div>
            ) : (
              <ul className="list-disc list-inside space-y-3">
                {analysis.improvements && analysis.improvements.length > 0 ? (
                  analysis.improvements.map((improvement, index) => (
                    <li key={index} className="text-gray-700">{improvement}</li>
                  ))
                ) : (
                  <li className="text-gray-500">제안된 개선 방안이 없습니다.</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-gray-800">관련 규정</h3>
          <div className="bg-white rounded-lg shadow-md p-5">
            {isEditing ? (
              <div className="space-y-2">
                {editRegulations.map((regulation, index) => (
                  <div key={index} className="flex items-center">
                    <input
                      type="text"
                      value={regulation}
                      onChange={(e) => {
                        const newRegulations = [...editRegulations];
                        newRegulations[index] = e.target.value;
                        setEditRegulations(newRegulations);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const newRegulations = [...editRegulations];
                        newRegulations.splice(index, 1);
                        setEditRegulations(newRegulations);
                      }}
                      className="ml-2 p-2 text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditRegulations([...editRegulations, ""])}
                  className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  항목 추가
                </button>
              </div>
            ) : (
              <ul className="list-disc list-inside space-y-3">
                {analysis.regulations && analysis.regulations.length > 0 ? (
                  analysis.regulations.map((regulation, index) => (
                    <li key={index} className="text-gray-700">{regulation}</li>
                  ))
                ) : (
                  <li className="text-gray-500">관련 규정이 없습니다.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 저장 다이얼로그 렌더링
  const renderSaveDialog = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-xl font-bold mb-4 text-gray-800">분석 결과 저장</h3>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              저장 제목
            </label>
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="제목을 입력하세요"
              disabled={isSaving}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
              disabled={isSaving}
            >
              취소
            </button>
            <button
              onClick={saveAnalysis}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  const compressImage = async (imageDataUrl: string, maxSize = 4 * 1024 * 1024): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const img: HTMLImageElement = document.createElement('img');
      img.src = imageDataUrl;
      
      img.onload = () => {
        let quality = 0.7; // 초기 품질
        let maxWidth = 1600; // 초기 최대 너비
        
        const compress = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 이미지 크기 조정
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('이미지 압축 실패'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // base64로 변환하여 크기 확인
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // base64 문자열의 실제 바이트 크기 계산
          const base64Size = Math.ceil((compressedDataUrl.length * 3) / 4);
          
          if (base64Size > maxSize && quality > 0.1 && maxWidth > 800) {
            // 여전히 크기가 크면 품질과 크기를 더 줄임
            quality -= 0.1;
            maxWidth -= 200;
            compress(); // 재귀적으로 다시 시도
          } else {
            resolve(compressedDataUrl);
          }
        };
        
        compress();
      };
      
      img.onerror = () => {
        reject(new Error('이미지 로드 실패'));
      };
    });
  };

  const renderDetailView = () => {
    if (!selectedAnalysis) return null;

    return (
      <div className="bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div className="flex items-center">
            <button 
              onClick={goBackToSaved}
              className="mr-4 p-2 hover:bg-blue-700 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-blue-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 text-xl font-semibold"
                placeholder="제목을 입력하세요"
              />
            ) : (
              <h2 className="text-xl font-semibold">{selectedAnalysis.title}</h2>
            )}
          </div>
          
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <button 
                  onClick={cancelEdit}
                  className="px-4 py-2 hover:bg-blue-700 rounded-md transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={saveEdit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                >
                  저장
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={startEditing}
                  className="p-2 hover:bg-blue-700 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button 
                  onClick={() => deleteSavedAnalysis(selectedAnalysis.id)}
                  className="p-2 hover:bg-blue-700 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="text-sm text-gray-500 mb-4">
            저장일: {new Date(selectedAnalysis.createdAt).toLocaleDateString()}
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* 이미지 영역 */}
            <div className="w-full lg:w-1/2">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-md">
                <Image
                  src={selectedAnalysis.imageUrl}
                  alt={selectedAnalysis.title}
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            
            {/* 분석 결과 영역 */}
            <div className="w-full lg:w-1/2">
              {renderAnalysisTable(selectedAnalysis)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">사진으로 보는 위험</h1>
          <div className="flex space-x-4">
            {currentView === 'main' && (
              <button
                onClick={() => setCurrentView('saved')}
                className="flex items-center text-blue-600 hover:text-blue-800 transition-colors px-4 py-2 rounded-md bg-white shadow-sm border border-gray-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                저장된 분석 보기
              </button>
            )}
            
            {currentView === 'saved' && (
              <button
                onClick={goBackToMain}
                className="flex items-center text-blue-600 hover:text-blue-800 transition-colors px-4 py-2 rounded-md bg-white shadow-sm border border-gray-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h2a1 1 0 001-1v-5" />
                </svg>
                분석으로 돌아가기
              </button>
            )}
          </div>
        </div>

        {currentView === 'saved' && (
          <div className="bg-white rounded-xl shadow-xl overflow-hidden p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">저장된 분석 결과</h2>
            {(savedAnalyses || []).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedAnalyses.map((savedAnalysis) => (
                  <div 
                    key={savedAnalysis.id} 
                    className="bg-gray-50 rounded-lg overflow-hidden shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => viewSavedAnalysis(savedAnalysis)}
                  >
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={savedAnalysis.imageUrl}
                        alt={savedAnalysis.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2 text-gray-800">{savedAnalysis.title}</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {new Date(savedAnalysis.createdAt).toLocaleDateString()} - 
                        위험요소 {savedAnalysis.risk_factors.length}개
                      </p>
                      <div className="flex justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewSavedAnalysis(savedAnalysis);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          자세히 보기
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedAnalysis(savedAnalysis.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-lg">저장된 분석 결과가 없습니다.</p>
              </div>
            )}
          </div>
        )}
        
        {currentView === 'detail' && renderDetailView()}

        {currentView === 'main' && (
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* 카메라/이미지 영역 */}
                <div className="w-full lg:w-1/2">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCapture}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    
                    {capturedImage ? (
                      <div className="relative aspect-[4/3] mb-4 rounded-lg overflow-hidden shadow-md">
                        <Image
                          src={capturedImage}
                          alt="Captured"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                        <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                    
                    <button
                      onClick={openCamera}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-colors flex items-center justify-center shadow-md"
                    >
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {capturedImage ? '다시 촬영' : '사진 촬영'}
                    </button>
                  </div>
                </div>

                {/* 분석 결과 영역 */}
                <div className="w-full lg:w-1/2">
                  {isLoading ? (
                    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center min-h-[300px]">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-lg text-gray-700">이미지 분석 중...</p>
                    </div>
                  ) : analysis ? (
                    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-6">
                      {renderAnalysisTable(analysis)}
                      
                      <div className="mt-6 flex justify-center space-x-4">
                        <button
                          onClick={handleReanalyze}
                          className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-colors flex items-center justify-center shadow-md"
                          disabled={isLoading}
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          다시 분석하기
                        </button>
                        
                        <button
                          onClick={openSaveDialog}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-colors flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!analysis || isSaving}
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          {isSaving ? '저장 중...' : '저장하기'}
                        </button>
                      </div>
                    </div>
                  ) : analysisError ? (
                    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                      <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-red-600 mb-6">{analysisError}</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                      <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-600">
                        사진을 촬영하면 AI가 자동으로 위험 요소를 분석하여 표시합니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 저장 다이얼로그 */}
      {showSaveDialog && renderSaveDialog()}
    </div>
  );
} 