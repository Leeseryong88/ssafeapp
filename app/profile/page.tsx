'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../../firebase';
import Image from 'next/image';

// 위험성평가 인터페이스 정의
interface SavedAssessment {
  id: string;
  title: string;
  createdAt: string;
  tableData: {
    processName: string;
    riskFactor: string;
    severity: string;
    probability: string;
    riskLevel: string;
    countermeasure: string;
  }[];
  tableHTML: string;
  userId: string;
}

// 카메라 분석 인터페이스 정의
interface SavedAnalysis {
  id: string;
  createdAt: string;
  title: string;
  imageUrl: string;
  risk_factors: string[];
  improvements: string[];
  regulations: string[];
  userId: string;
  storageRef?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '',
    company: '',
    position: '',
    bio: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newProfileImage, setNewProfileImage] = useState<File | null>(null);
  
  // 저장소 관련 상태 추가
  const [activeTab, setActiveTab] = useState<'profile' | 'assessments' | 'analyses'>('profile');
  const [savedAssessments, setSavedAssessments] = useState<SavedAssessment[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<SavedAssessment | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
  const [showAssessmentDetail, setShowAssessmentDetail] = useState(false);
  const [showAnalysisDetail, setShowAnalysisDetail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Firebase 사용자 인증 상태 확인
      auth.onAuthStateChanged(async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          console.log('Current user photo URL:', currentUser.photoURL);
          // Firestore에서 사용자 프로필 데이터 가져오기
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log('User data from Firestore:', userData);
              setFormData({
                displayName: userData.displayName || '',
                phoneNumber: userData.phoneNumber || '',
                company: userData.company || '',
                position: userData.position || '',
                bio: userData.bio || ''
              });
              // 프로필 이미지 설정 시 provider 이미지 URL도 확인
              setProfileImage(userData.profileImage || userData.providerPhotoURL || null);
            } else {
              // 사용자 문서가 없으면 새로 생성
              await setDoc(userDocRef, {
                email: currentUser.email,
                createdAt: new Date(),
                displayName: currentUser.displayName || '',
                phoneNumber: currentUser.phoneNumber || '',
                company: '',
                position: '',
                bio: '',
                profileImage: null
              });
              // 새 사용자는 바로 편집 모드로 시작
              setEditMode(true);
            }
            
            // 저장된 위험성평가와 분석 결과 로드
            loadSavedAssessments(currentUser.uid);
            loadSavedAnalyses(currentUser.uid);
            
          } catch (error) {
            console.error('프로필 로딩 오류:', error);
            setMessage({ type: 'error', text: '프로필 정보를 불러오는데 실패했습니다.' });
          }
        } else {
          // 로그인되지 않은 경우 로그인 페이지로 리디렉션
          router.push('/auth?mode=login');
        }
        setLoading(false);
      });
    };

    checkAuth();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // 이미지 미리보기 표시
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      // 프로필 이미지 업로드 처리
      let profileImageUrl = profileImage;
      if (newProfileImage) {
        const storageRef = ref(storage, `profile-images/${currentUser.uid}`);
        const uploadResult = await uploadBytes(storageRef, newProfileImage);
        profileImageUrl = await getDownloadURL(uploadResult.ref);
      }

      // Firestore 사용자 문서 업데이트
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        ...formData,
        profileImage: profileImageUrl,
        updatedAt: new Date(),
        // 기존 데이터 보존을 위한 병합 옵션
        email: currentUser.email,
        provider: currentUser.providerData[0]?.providerId || 'unknown'
      }, { merge: true }); // merge: true 옵션 추가

      setProfileImage(profileImageUrl);
      setNewProfileImage(null);
      setEditMode(false);
      setMessage({ type: 'success', text: '프로필이 성공적으로 업데이트되었습니다.' });
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      setMessage({ type: 'error', text: '프로필 업데이트에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 편집 모드로 전환
  const handleEditClick = () => {
    setEditMode(true);
    setMessage(null);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditMode(false);
    setImageFile(null);
    // 기존 데이터로 폼 복원
    if (user) {
      const fetchUserData = async () => {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setFormData({
              displayName: userData.displayName || '',
              phoneNumber: userData.phoneNumber || '',
              company: userData.company || '',
              position: userData.position || '',
              bio: userData.bio || ''
            });
            setProfileImage(userData.profileImage || null);
          }
        } catch (error) {
          console.error('프로필 데이터 복원 오류:', error);
        }
      };
      
      fetchUserData();
    }
    setMessage(null);
  };

  // 이미지 URL 안전하게 처리하는 함수
  const getSafeImageUrl = (url: string | null) => {
    if (!url || url === '') return '/placeholder-profile.png';
    
    try {
      console.log('Processing image URL:', url);
      
      // 데이터 URL인 경우 (미리보기 이미지)
      if (url.startsWith('data:')) {
        return url;
      }
      
      // Kakao CDN URL인 경우
      if (url.includes('kakaocdn.net') || url.includes('kakao.com')) {
        console.log('Kakao image URL detected:', url);
        return url;
      }
      
      // Firebase Storage URL인 경우
      if (url.startsWith('https://firebasestorage.googleapis.com') || 
          url.startsWith('https://storage.googleapis.com') ||
          url.includes('firebasestorage.app')) {
        return url;
      }
      
      // Google 프로필 이미지인 경우
      if (url.includes('googleusercontent.com')) {
        return url;
      }
      
      // 절대 URL인 경우
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // 기타 URL은 상대 경로로 간주
      return url;
    } catch (error) {
      console.error('이미지 URL 처리 오류:', error);
      return '/placeholder-profile.png';
    }
  };

  // Firestore에서 저장된 위험성평가 결과 불러오기
  const loadSavedAssessments = async (userId: string) => {
    try {
      setRepositoryLoading(true);
      
      const assessmentsRef = collection(db, 'assessments');
      const assessmentsQuery = query(
        assessmentsRef, 
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const assessmentsSnapshot = await getDocs(assessmentsQuery);
      const assessmentsData: SavedAssessment[] = [];
      
      assessmentsSnapshot.forEach((doc) => {
        const data = doc.data() as SavedAssessment;
        assessmentsData.push({
          ...data,
          id: doc.id
        });
      });
      
      console.log('로드된 위험성평가 개수:', assessmentsData.length);
      setSavedAssessments(assessmentsData);
      
    } catch (error) {
      console.error('위험성평가 결과를 불러오는 중 오류가 발생했습니다:', error);
      setMessage({ type: 'error', text: '위험성평가 결과를 불러오는데 실패했습니다.' });
    } finally {
      setRepositoryLoading(false);
    }
  };
  
  // Firestore에서 저장된 카메라 분석 결과 불러오기
  const loadSavedAnalyses = async (userId: string) => {
    try {
      setRepositoryLoading(true);
      
      const analysesRef = collection(db, 'analyses');
      const analysesQuery = query(
        analysesRef, 
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(analysesQuery);
      const analysesData: SavedAnalysis[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SavedAnalysis;
        analysesData.push({
          ...data,
          id: doc.id
        });
      });
      
      console.log('로드된 카메라 분석 개수:', analysesData.length);
      setSavedAnalyses(analysesData);
      
    } catch (error) {
      console.error('카메라 분석 결과를 불러오는 중 오류가 발생했습니다:', error);
      setMessage({ type: 'error', text: '카메라 분석 결과를 불러오는데 실패했습니다.' });
    } finally {
      setRepositoryLoading(false);
    }
  };

  // 저장된 위험성평가 상세 보기
  const viewAssessmentDetail = (assessment: SavedAssessment) => {
    setSelectedAssessment(assessment);
    setShowAssessmentDetail(true);
  };
  
  // 저장된 카메라 분석 상세 보기
  const viewAnalysisDetail = (analysis: SavedAnalysis) => {
    setSelectedAnalysis(analysis);
    setShowAnalysisDetail(true);
  };
  
  // 저장된 위험성평가 삭제
  const deleteAssessment = async (id: string) => {
    if (!user) return;
    
    if (confirm('정말로 이 위험성평가를 삭제하시겠습니까?')) {
      try {
        setRepositoryLoading(true);
        
        // Firestore에서 문서 삭제
        await deleteDoc(doc(db, 'assessments', id));
        
        // 로컬 상태 업데이트
        setSavedAssessments(savedAssessments.filter(item => item.id !== id));
        
        // 상세 보기 화면에서 삭제한 경우 닫기
        if (selectedAssessment && selectedAssessment.id === id) {
          setShowAssessmentDetail(false);
          setSelectedAssessment(null);
        }
        
        setMessage({ type: 'success', text: '위험성평가가 삭제되었습니다.' });
      } catch (error) {
        console.error('위험성평가 삭제 중 오류가 발생했습니다:', error);
        setMessage({ type: 'error', text: '위험성평가 삭제에 실패했습니다.' });
      } finally {
        setRepositoryLoading(false);
      }
    }
  };
  
  // 저장된 카메라 분석 결과 삭제
  const deleteAnalysis = async (id: string) => {
    if (!user) return;
    
    if (confirm('정말로 이 분석 결과를 삭제하시겠습니까?')) {
      try {
        setRepositoryLoading(true);
        
        // 삭제할 항목 찾기
        const analysisToDelete = savedAnalyses.find(item => item.id === id);
        
        if (analysisToDelete && analysisToDelete.storageRef) {
          // Storage에서 이미지 삭제
          const imageRef = ref(storage, analysisToDelete.storageRef);
          await deleteObject(imageRef);
        }
        
        // Firestore에서 문서 삭제
        await deleteDoc(doc(db, 'analyses', id));
        
        // 로컬 상태 업데이트
        setSavedAnalyses(savedAnalyses.filter(item => item.id !== id));
        
        // 상세 보기 화면에서 삭제한 경우 닫기
        if (selectedAnalysis && selectedAnalysis.id === id) {
          setShowAnalysisDetail(false);
          setSelectedAnalysis(null);
        }
        
        setMessage({ type: 'success', text: '분석 결과가 삭제되었습니다.' });
      } catch (error) {
        console.error('분석 결과 삭제 중 오류가 발생했습니다:', error);
        setMessage({ type: 'error', text: '분석 결과 삭제에 실패했습니다.' });
      } finally {
        setRepositoryLoading(false);
      }
    }
  };
  
  // PDF로 저장 기능
  const saveToPdf = async () => {
    if (!selectedAssessment) return;
    
    try {
      setIsGeneratingPdf(true);
      
      // 동적으로 html2pdf 라이브러리 로드
      const html2pdf = (await import('html2pdf.js')).default;
      
      // PDF 변환 대상 엘리먼트
      const element = document.getElementById('assessment-detail-content');
      if (!element) {
        throw new Error('PDF로 변환할 콘텐츠를 찾을 수 없습니다.');
      }
      
      // html2pdf 옵션 설정
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${selectedAssessment.title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // PDF 생성 및 다운로드
      await html2pdf().set(opt).from(element).save();
      
      setMessage({ type: 'success', text: 'PDF가 성공적으로 생성되었습니다.' });
    } catch (error) {
      console.error('PDF 생성 중 오류가 발생했습니다:', error);
      setMessage({ type: 'error', text: 'PDF 생성에 실패했습니다.' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Excel로 저장 기능
  const downloadExcel = async () => {
    if (!selectedAssessment) return;
    
    try {
      // 동적으로 xlsx 라이브러리 로드
      const XLSX = (await import('xlsx')).default;
      
      // 제목 설정
      const title = selectedAssessment.title;
      
      // 데이터 구조화
      const data = [
        [title],
        [''],
        ['날짜', new Date(selectedAssessment.createdAt).toLocaleDateString()],
        [''],
        ['공정/장비', '위험 요소', '심각도', '발생가능성', '위험도', '개선대책']
      ];
      
      // 위험성 평가 데이터 추가
      selectedAssessment.tableData.forEach((item) => {
        data.push([
          item.processName || '',
          item.riskFactor || '',
          item.severity || '',
          item.probability || '',
          item.riskLevel || '',
          item.countermeasure || ''
        ]);
      });
      
      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // 셀 병합
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // 제목 행 병합
      ];
      
      // 워크시트 추가
      XLSX.utils.book_append_sheet(wb, ws, "위험성평가");
      
      // 파일명 생성
      const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // 파일 다운로드
      XLSX.writeFile(wb, fileName);
      
      setMessage({ type: 'success', text: 'Excel 파일이 성공적으로 생성되었습니다.' });
    } catch (error) {
      console.error('Excel 파일 생성 오류:', error);
      setMessage({ type: 'error', text: 'Excel 파일 생성에 실패했습니다.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl space-y-8">
        {message && (
          <div 
            className={`p-4 mb-6 rounded-lg shadow-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 프로필 섹션 */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <h1 className="text-3xl font-bold text-white">내 프로필</h1>
          </div>
          
          {editMode ? (
            // 편집 모드
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-8">
              <div className="flex flex-col sm:flex-row gap-8 mb-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200">
                    {profileImage ? (
                      <Image
                        src={getSafeImageUrl(profileImage) || '/placeholder-profile.png'}
                        alt="프로필 이미지"
                        fill
                        sizes="128px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-gray-400">
                        <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="profile-image"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="profile-image"
                      className="bg-blue-600 text-white text-sm px-4 py-2 rounded cursor-pointer hover:bg-blue-700 transition-colors"
                    >
                      이미지 변경
                    </label>
                  </div>
                </div>
              
                <div className="flex-1 space-y-4">
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                      이름
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                      연락처
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                        회사/소속
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  
                    <div>
                      <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                        직책/직위
                      </label>
                      <input
                        type="text"
                        id="position"
                        name="position"
                        value={formData.position}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            
              <div className="mb-6">
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  자기소개
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="간단한 자기소개를 입력하세요"
                />
              </div>
            
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="mr-4 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>
            </form>
          ) : (
            // 조회 모드 (카드 형태)
            <div className="p-8">
              <div className="flex flex-col sm:flex-row gap-8">
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 mb-4 border-4 border-white shadow-lg">
                    {profileImage ? (
                      <Image
                        src={getSafeImageUrl(profileImage) || '/placeholder-profile.png'}
                        alt="프로필 이미지"
                        fill
                        sizes="128px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-gray-400">
                        <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {formData.displayName || '이름 없음'}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">
                    {user?.email}
                  </p>
                </div>

                <div className="flex-1 bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">연락처</h3>
                      <p className="mt-1 text-base text-gray-900">
                        {formData.phoneNumber || '미설정'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">회사/소속</h3>
                      <p className="mt-1 text-base text-gray-900">
                        {formData.company || '미설정'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">직책/직위</h3>
                      <p className="mt-1 text-base text-gray-900">
                        {formData.position || '미설정'}
                      </p>
                    </div>
                  </div>

                  {formData.bio && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-gray-500 mb-2">자기소개</h3>
                      <p className="text-gray-900 text-base bg-white p-4 rounded-md border border-gray-200">
                        {formData.bio}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => router.push('/')}
                  className="mr-4 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  뒤로가기
                </button>
                <button
                  onClick={handleEditClick}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  프로필 수정
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 나의 저장소 섹션 */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <h2 className="text-3xl font-bold text-white">나의 저장소</h2>
          </div>

          <div className="p-8">
            {/* 위험성평가 저장소 */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">위험성평가 저장소</h3>
                <button 
                  onClick={() => router.push('/assessment')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                >
                  새 위험성평가 생성
                </button>
              </div>

              {repositoryLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : savedAssessments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedAssessments.map((assessment) => (
                    <div 
                      key={assessment.id} 
                      className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <div className="p-6 cursor-pointer" onClick={() => viewAssessmentDetail(assessment)}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                            위험요소 {assessment.tableData.length}개
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(assessment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-xl mb-2 text-gray-800">{assessment.title}</h3>
                      </div>
                      <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between">
                        <button
                          onClick={() => viewAssessmentDetail(assessment)}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
                        >
                          자세히 보기
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteAssessment(assessment.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m4-6v6m-4 6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  <p className="text-lg text-gray-600 mb-4">저장된 위험성평가 결과가 없습니다.</p>
                  <button 
                    onClick={() => router.push('/assessment')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    위험성평가 생성하기
                  </button>
                </div>
              )}
            </div>

            {/* 현장분석 저장소 */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">현장분석 저장소</h3>
                <button 
                  onClick={() => router.push('/camera')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                >
                  새 현장분석 시작
                </button>
              </div>

              {repositoryLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : savedAnalyses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedAnalyses.map((analysis) => (
                    <div 
                      key={analysis.id} 
                      className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <div className="relative aspect-[4/3] w-full cursor-pointer" onClick={() => viewAnalysisDetail(analysis)}>
                        <Image
                          src={analysis.imageUrl}
                          alt={analysis.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                            위험요소 {analysis.risk_factors.length}개
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(analysis.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-xl mb-2 text-gray-800">{analysis.title}</h3>
                      </div>
                      <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between">
                        <button
                          onClick={() => viewAnalysisDetail(analysis)}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
                        >
                          자세히 보기
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteAnalysis(analysis.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  <p className="text-lg text-gray-600 mb-4">저장된 현장분석 결과가 없습니다.</p>
                  <button 
                    onClick={() => router.push('/camera')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    현장분석 시작하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 상세 보기 모달 */}
        {(showAssessmentDetail || showAnalysisDetail) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {showAssessmentDetail && selectedAssessment && (
                <div>
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center">
                      <button 
                        onClick={() => setShowAssessmentDetail(false)}
                        className="mr-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <h2 className="text-2xl font-bold">{selectedAssessment.title}</h2>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button 
                        onClick={saveToPdf}
                        disabled={isGeneratingPdf}
                        className={`px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors ${
                          isGeneratingPdf ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isGeneratingPdf ? '생성 중...' : 'PDF로 저장'}
                      </button>
                      <button 
                        onClick={downloadExcel}
                        className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Excel로 저장
                      </button>
                      <button 
                        onClick={() => deleteAssessment(selectedAssessment.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <div className="text-sm text-gray-500 mb-6">
                      저장일: {new Date(selectedAssessment.createdAt).toLocaleDateString()}
                    </div>
                    
                    <div id="assessment-detail-content" className="final-analysis-content" dangerouslySetInnerHTML={{ __html: selectedAssessment.tableHTML }}></div>
                  </div>
                </div>
              )}

              {showAnalysisDetail && selectedAnalysis && (
                <div>
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center">
                      <button 
                        onClick={() => setShowAnalysisDetail(false)}
                        className="mr-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <h2 className="text-2xl font-bold">{selectedAnalysis.title}</h2>
                    </div>
                    
                    <button 
                      onClick={() => deleteAnalysis(selectedAnalysis.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="p-8">
                    <div className="text-sm text-gray-500 mb-6">
                      저장일: {new Date(selectedAnalysis.createdAt).toLocaleDateString()}
                    </div>
                    
                    <div className="mb-8">
                      <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden shadow-lg">
                        <Image
                          src={selectedAnalysis.imageUrl}
                          alt={selectedAnalysis.title}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* 위험 요소 */}
                      <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
                        <h3 className="text-xl font-bold text-red-700 mb-4">위험 요소</h3>
                        <ul className="space-y-3">
                          {selectedAnalysis.risk_factors.map((item, index) => (
                            <li key={`risk-${index}`} className="flex items-start">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-red-200 text-red-700 rounded-full mr-3 shrink-0 font-bold text-sm">
                                {index + 1}
                              </span>
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                          {selectedAnalysis.risk_factors.length === 0 && (
                            <li className="text-gray-500 italic">위험 요소가 없습니다.</li>
                          )}
                        </ul>
                      </div>
                      
                      {/* 개선 대책 */}
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                        <h3 className="text-xl font-bold text-green-700 mb-4">개선 대책</h3>
                        <ul className="space-y-3">
                          {selectedAnalysis.improvements.map((item, index) => (
                            <li key={`improvement-${index}`} className="flex items-start">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-200 text-green-700 rounded-full mr-3 shrink-0 font-bold text-sm">
                                {index + 1}
                              </span>
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                          {selectedAnalysis.improvements.length === 0 && (
                            <li className="text-gray-500 italic">개선 대책이 없습니다.</li>
                          )}
                        </ul>
                      </div>
                      
                      {/* 관련 법규 */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                        <h3 className="text-xl font-bold text-blue-700 mb-4">관련 법규</h3>
                        <ul className="space-y-3">
                          {(selectedAnalysis.regulations || []).map((item, index) => (
                            <li key={`regulation-${index}`} className="flex items-start">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-200 text-blue-700 rounded-full mr-3 shrink-0 font-bold text-sm">
                                {index + 1}
                              </span>
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                          {(!selectedAnalysis.regulations || selectedAnalysis.regulations.length === 0) && (
                            <li className="text-gray-500 italic">관련 법규가 없습니다.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CSS 스타일 */}
        <style jsx global>{`
          .final-analysis-content table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5rem;
            font-size: 0.95rem;
            background: white;
            border-radius: 0.5rem;
            overflow: hidden;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          }
          
          .final-analysis-content th,
          .final-analysis-content td {
            border: 1px solid #e2e8f0;
            padding: 1rem;
            text-align: left;
          }
          
          .final-analysis-content th {
            background: linear-gradient(to right, #f8fafc, #f1f5f9);
            font-weight: 600;
            color: #334155;
          }
          
          .final-analysis-content tr:nth-child(even) {
            background-color: #f8fafc;
          }
          
          .final-analysis-content tr:hover {
            background-color: #f1f5f9;
          }
          
          .final-analysis-content tr:last-child td:first-child {
            border-bottom-left-radius: 0.5rem;
          }
          
          .final-analysis-content tr:last-child td:last-child {
            border-bottom-right-radius: 0.5rem;
          }
        `}</style>
      </div>
    </div>
  );
} 