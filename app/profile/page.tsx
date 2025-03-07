'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../firebase';
import Image from 'next/image';

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

  useEffect(() => {
    const checkAuth = async () => {
      // Firebase 사용자 인증 상태 확인
      auth.onAuthStateChanged(async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          // Firestore에서 사용자 프로필 데이터 가져오기
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      
      // 이미지 업로드 (있는 경우)
      let profileImageUrl = profileImage;
      if (imageFile) {
        try {
          const storageRef = ref(storage, `profile-images/${user.uid}`);
          await uploadBytes(storageRef, imageFile);
          profileImageUrl = await getDownloadURL(storageRef);
        } catch (storageError) {
          console.error('이미지 업로드 오류:', storageError);
          setMessage({ type: 'error', text: '이미지 업로드 중 오류가 발생했습니다. 다시 시도해주세요.' });
          setSaving(false);
          return;
        }
      }
      
      try {
        // Firestore 문서 업데이트
        await setDoc(userDocRef, {
          ...formData,
          profileImage: profileImageUrl,
          updatedAt: new Date(),
          uid: user.uid,  // UID를 명시적으로 포함
          email: user.email // 이메일도 포함
        }, { merge: true });  // merge 옵션 추가
        
        setMessage({ type: 'success', text: '프로필이 성공적으로 저장되었습니다.' });
        setEditMode(false); // 저장 후 조회 모드로 전환
        setImageFile(null); // 업로드 파일 상태 초기화
      } catch (dbError: any) {
        console.error('Firestore 저장 오류:', dbError);
        if (dbError.code === 'permission-denied') {
          setMessage({ type: 'error', text: '저장 권한이 없습니다. 로그인 상태를 확인해주세요.' });
        } else {
          setMessage({ type: 'error', text: `프로필 저장 실패: ${dbError.message}` });
        }
      }
    } catch (error: any) {
      console.error('프로필 저장 오류:', error);
      setMessage({ type: 'error', text: `오류가 발생했습니다: ${error.message}` });
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        {message && (
          <div 
            className={`p-4 mb-6 rounded ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">내 프로필</h1>
          </div>
          
          {editMode ? (
            // 편집 모드
            <form onSubmit={handleSubmit} className="p-6">
              <div className="flex flex-col sm:flex-row gap-8 mb-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200">
                    {profileImage ? (
                      <Image
                        src={profileImage}
                        alt="프로필 이미지"
                        fill
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
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-8">
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 mb-4 border-4 border-white shadow-lg">
                    {profileImage ? (
                      <Image
                        src={profileImage}
                        alt="프로필 이미지"
                        fill
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
      </div>
    </div>
  );
} 