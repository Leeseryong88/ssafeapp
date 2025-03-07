'use client';

import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  listAll,
  UploadResult
} from 'firebase/storage';
import { storage } from './firebase';

// 파일 업로드
export const uploadFile = async (
  file: File,
  path: string,
  fileName?: string
): Promise<{ url: string; path: string }> => {
  try {
    // 파일명 설정 (제공되지 않은 경우 원본 파일명 사용)
    const name = fileName || file.name;
    // 경로 생성
    const fullPath = `${path}/${name}`;
    const storageRef = ref(storage, fullPath);
    
    // 파일 업로드
    const uploadResult: UploadResult = await uploadBytes(storageRef, file);
    // 다운로드 URL 가져오기
    const url = await getDownloadURL(uploadResult.ref);
    
    return { url, path: fullPath };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// 이미지 업로드 (분석 이미지용)
export const uploadAnalysisImage = async (
  file: File,
  userId: string
): Promise<{ url: string; path: string }> => {
  // 타임스탬프를 파일명에 추가하여 고유한 파일명 생성
  const timestamp = new Date().getTime();
  const fileName = `${timestamp}_${file.name}`;
  return uploadFile(file, `analysis/${userId}`, fileName);
};

// 파일 삭제
export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

// 디렉토리의 모든 파일 URL 목록 가져오기
export const getFilesInDirectory = async (
  directoryPath: string
): Promise<{ name: string; url: string; path: string }[]> => {
  try {
    const directoryRef = ref(storage, directoryPath);
    const fileList = await listAll(directoryRef);
    
    // 각 파일의 다운로드 URL 얻기
    const filesPromises = fileList.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      return {
        name: itemRef.name,
        url,
        path: itemRef.fullPath
      };
    });
    
    return Promise.all(filesPromises);
  } catch (error) {
    console.error('Error getting files:', error);
    throw error;
  }
};

// 사용자별 분석 이미지 가져오기
export const getUserAnalysisImages = async (userId: string) => {
  return getFilesInDirectory(`analysis/${userId}`);
}; 