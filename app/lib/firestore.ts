'use client';

import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  CollectionReference
} from 'firebase/firestore';
import { db } from './firebase';

// 컬렉션에 문서 추가
export const addDocument = async <T extends Record<string, any>>(
  collectionName: string, 
  data: T
) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

// 문서 업데이트
export const updateDocument = async <T extends Record<string, any>>(
  collectionName: string, 
  docId: string, 
  data: Partial<T>
) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

// 문서 삭제
export const deleteDocument = async (collectionName: string, docId: string) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// 단일 문서 조회
export const getDocument = async <T = DocumentData>(
  collectionName: string, 
  docId: string
): Promise<T | null> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

// 컬렉션의 모든 문서 조회
export const getDocuments = async <T = DocumentData>(
  collectionName: string,
  orderField = 'createdAt',
  orderDirection: 'asc' | 'desc' = 'desc',
  limitCount?: number
): Promise<T[]> => {
  try {
    const collectionRef = collection(db, collectionName);
    
    // 정렬 및 제한 적용
    let q;
    if (limitCount) {
      q = query(collectionRef, orderBy(orderField, orderDirection), limit(limitCount));
    } else {
      q = query(collectionRef, orderBy(orderField, orderDirection));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
  } catch (error) {
    console.error('Error getting documents:', error);
    throw error;
  }
};

// 특정 조건으로 문서 조회
export const getDocumentsWhere = async <T = DocumentData>(
  collectionName: string,
  fieldPath: string,
  opStr: '==' | '!=' | '>' | '>=' | '<' | '<=',
  value: any,
  orderField = 'createdAt',
  orderDirection: 'asc' | 'desc' = 'desc'
): Promise<T[]> => {
  try {
    const collectionRef = collection(db, collectionName);
    const q = query(
      collectionRef,
      where(fieldPath, opStr, value),
      orderBy(orderField, orderDirection)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
  } catch (error) {
    console.error('Error querying documents:', error);
    throw error;
  }
};

// 사용자별 문서 조회
export const getUserDocuments = async <T = DocumentData>(
  collectionName: string,
  userId: string,
  orderField = 'createdAt',
  orderDirection: 'asc' | 'desc' = 'desc'
): Promise<T[]> => {
  return getDocumentsWhere<T>(
    collectionName,
    'userId',
    '==',
    userId,
    orderField,
    orderDirection
  );
}; 